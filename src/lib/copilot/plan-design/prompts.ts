import type { RuleFinding } from './rules';
import { chainSchema, claimTypes, contextCardSchema, contextFields, designCardSchema, reviewDimensions, reviewSchema, requiredBlocks, type Chain, type ChainBlock, type ContextCard, type ContextItem, type DesignCard, type Tier } from './spec';
import type { ChainTemplate } from './templates';

/**
 * One prompt and one reader per model step. Every reader refuses an answer that is not the shape asked for. The prompts
 * carry the confirmed artifacts as JSON, so a step sees exactly what the author confirmed and nothing of earlier turns.
 */
/** The outermost object of an answer, fenced or not: prose before it ("审查如下：") is skipped. */
function jsonObject(raw: string): unknown {
  const payload = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw)?.[1] ?? raw;
  const start = payload.indexOf('{'), end = payload.lastIndexOf('}');
  return JSON.parse(start >= 0 && end > start ? payload.slice(start, end + 1) : payload);
}
const cardOf = (card: ContextCard) => JSON.stringify(Object.fromEntries(contextFields.map(field => [field, card[field]])), null, 1);
const common = '只输出一个 JSON 对象，不要其他文字。用中文写内容，分子、细胞系、试剂名保留原文。不知道的值留空字符串或 null，不要编造数字、批号或文献。';

export function contextPrompt(purpose: string, items: ContextItem[]) {
  return {
    system: [
      '你是研究方案的设计助手，现在只做第一步：把作者的研究目的整理成“情境卡”。不设计实验，不检索文献。',
      '只根据研究目的和下面列出的 LabNest 记录填写；记录里没有、作者也没说的，留空，不要推测。',
      '术语有歧义时保留原词，把需要作者决定的地方写进 questions（最多 4 个，只问会改变设计的）。例：ligation blot 可能指 ligand blot（far-Western），也可能是连接相关检测。',
      `claimType 只能是 ${claimTypes.join(' / ')} 之一：association 关联、necessity 必要性（敲低/敲除）、sufficiency 充分性（过表达）、mechanism 机制或通路、interaction 复合物中的相互作用、direct_binding 纯化蛋白之间的直接结合。膜上共现、复合物关联、直接结合、因果作用是四种不同主张。`,
      'resourcesHave 写 LabNest 库存或记录里已有的（写名称和批次信息），resourcesCanGet 写可以买到或做出的，resourcesLack 写缺的。',
      `字段：${contextFields.join('、')}、questions。${common}`,
    ].join('\n'),
    user: `研究目的：${purpose}\n\nLabNest 记录（作者已勾选可发送的）：\n${items.map(item => `- [${item.kind}] ${item.label}${item.detail ? `：${item.detail}` : ''}`).join('\n') || '（无）'}`,
  };
}

/** The model's card: what it filled is marked as its suggestion, what it left empty stays open for the author. */
export function parseContext(raw: string): ContextCard {
  const card = contextCardSchema.parse(jsonObject(raw));
  card.states = Object.fromEntries(contextFields.map(field => [field, String(card[field] ?? '').trim() ? 'ai' : 'pending']));
  return card;
}

export function chainPrompt(card: ContextCard, template: ChainTemplate) {
  return {
    system: [
      '你是研究方案的设计助手，现在做“证据链”：主张 → 最低可信证据 → 实验块，同时写出要排除的对立解释。不检索文献，按常规实验逻辑设计。',
      '以给出的证据链模板打底：保留模板里适用的实验块和对照，按研究对象改写标题和成功标准；不适用的删掉，缺的补上。',
      '实验块按依赖排序：基线 → 操作是否成功（敲低/过表达效率）→ 表型 → 特异性或拯救 → 机制。每块写 purpose（要回答什么）、success（预先写定的成功标准）、failure（失败意味着什么）、fallback（备选做法）、dependsOn（依赖的块 id）。',
      'minTier 表示从哪一档起这块是必做：light 轻量、standard 标准、publication 发表级。light 档的必做块最多 3 个，standard 最多 5 个。只推荐一个档位 recommendedTier。',
      'alternatives 列 2–6 个对立解释，exclude 默认 true；不打分、不排序、不替作者选择。hypothesis 写主假设，rationale 写依据（只用情境卡里已有的结果和记录）。',
      '如果你认为情境卡本身有问题（主张类型不对、研究对象写错），写进 drift，不要自行修改情境卡。',
      `输出结构：{"claim":"","hypothesis":"","rationale":"","minimumEvidence":[""],"alternatives":[{"text":"","exclude":true}],"blocks":[{"id":"小写字母数字和-","title":"","kind":"baseline|manipulation|phenotype|specificity|mechanism","minTier":"light|standard|publication","purpose":"","success":"","failure":"","fallback":"","dependsOn":[]}],"recommendedTier":"standard","drift":[]}。${common}`,
    ].join('\n'),
    user: `已确认的情境卡：\n${cardOf(card)}\n\n证据链模板（${template.label} v${template.version}）：\n${JSON.stringify({ minimumEvidence: template.minimumEvidence, requiredControls: template.requiredControls, alternatives: template.alternatives, blocks: template.blocks }, null, 1)}`,
  };
}

export function parseChain(raw: string): Chain {
  const chain = chainSchema.parse(jsonObject(raw));
  const ids = new Set<string>();
  for (const block of chain.blocks) { if (ids.has(block.id)) throw new Error(`Block id ${block.id} is used twice`); ids.add(block.id); }
  for (const block of chain.blocks) block.dependsOn = block.dependsOn.filter(id => ids.has(id) && id !== block.id);
  return chain;
}

export type ProtocolChoice = { id: string; code: string; title: string };

export function cardPrompt(card: ContextCard, chain: Chain, tier: Tier, block: ChainBlock, protocols: ProtocolChoice[]) {
  const required = requiredBlocks(chain, tier);
  return {
    system: [
      '你是研究方案的设计助手，现在为一个实验块写“设计卡”。按常规实验逻辑设计，不引用文献；凡是依据只是常规做法的，不要写成“文献证明”。',
      '不要为了简短而省略：对照、读出、判定标准有几条写几条。每个对照写清它排除哪个对立解释（excludes）和 kind：negative 阴性、positive 阳性、vehicle 溶剂、empty_vector 空载体、isotype 同型/IgG、loading 上样、reference_gene 参照基因、other。concurrent 表示与处理组同期进行。',
      'groups 是这个实验的分组（name 简短，会成为 LabNest 实验里的分组名；control 标记对照组）。unit.nCounts 写 n 数的是什么：biological 独立生物学重复、technical 技术重复、wells 孔、animals 动物。',
      '样本量不要编：不知道效应量时 sampleSize.n 填 null，basis 填 pending，note 写“需要预实验”；只有作者情境卡里给了依据时才填 minimum_effect 或 pilot；按惯例填写时 basis 填 convention。',
      'readouts 的 assay 取 qpcr、western_blot、imaging、flow、viability、migration、elisa、co_ip、sequencing、other。用 qPCR 时 referenceGenes 写参照基因；用 WB 时写 loadingControl 和 normalization。',
      'criteria 是预先写定的判定标准，可以直接判断“成立 / 不成立 / 无法判断”。analysis 写检验方法、主要比较、多重比较校正、剔除规则。',
      `protocol：如果下面的 LabNest 规程里有合适的，填它的 id 和 title；没有就 needed 填 true、title 写需要什么规程。不要编造规程 id。`,
      '如果你认为情境卡或证据链需要修改，写进 drift，不要自行修改。',
      `输出 designCard 结构：{"blockId":"${block.id}","title":"","unit":{"experimental":"","analysis":"","nCounts":"biological"},"factors":[{"name":"","levels":[]}],"groups":[{"name":"","treatment":"","control":false}],"controls":[{"name":"","kind":"negative","excludes":"","concurrent":true}],"manipulation":{"kind":"none|knockdown|knockout|overexpression|drug|other","independentReagents":null,"efficiencyCheck":""},"replicates":{"biological":null,"technical":null,"note":""},"sampleSize":{"n":null,"basis":"pending","note":""},"randomization":"","blinding":"","batch":"","readouts":[{"name":"","method":"","timepoint":"","assay":"other"}],"referenceGenes":[],"loadingControl":"","normalization":"","analysis":{"test":"","primaryComparison":"","multipleComparison":"","exclusion":""},"criteria":[],"dependsOn":[],"protocol":{"id":"","title":"","needed":false},"methodNote":"","drift":[]}。${common}`,
    ].join('\n'),
    user: [
      `情境卡：\n${cardOf(card)}`,
      `主张：${chain.claim}\n要排除的对立解释：\n${chain.alternatives.filter(item => item.exclude).map(item => `- ${item.text}`).join('\n') || '（无）'}`,
      `本档（${tier}）的必做实验块：${required.map(item => `${item.id}「${item.title}」`).join('、')}`,
      `现在要写的实验块：${JSON.stringify(block)}`,
      `LabNest 规程（id · 编号 · 名称）：\n${protocols.map(item => `${item.id} · ${item.code} · ${item.title}`).join('\n') || '（无）'}`,
    ].join('\n\n'),
  };
}

export function parseCard(raw: string, block: ChainBlock, protocols: ProtocolChoice[]): DesignCard {
  const answer = jsonObject(raw) as { title?: unknown };
  const card = designCardSchema.parse({ ...answer, title: typeof answer.title === 'string' && answer.title.trim().length >= 2 ? answer.title : block.title, blockId: block.id, confirmed: false });
  if (card.protocol.id && !protocols.some(item => item.id === card.protocol.id)) card.protocol = { id: '', title: card.protocol.title, needed: true };
  return card;
}

/** The reviewer sees the artifacts and the program's rule findings, never the drafting conversation (ARIS: the reviewer reads the work, not the author's summary). */
export function reviewPrompt(card: ContextCard, chain: Chain, tier: Tier, cards: DesignCard[], rules: RuleFinding[], round: number) {
  return {
    system: [
      '你是独立的实验设计审稿人。你没有参与起草，只根据下面的成果判断这份设计能否支持它的主张。不重写方案，不替作者选择。',
      `按固定评分表逐项给出 verdict（ok / concern / not_applicable）：${reviewDimensions.join('、')}（对照是否充分、混杂与批次、伪重复、样本量依据、多重比较、结论是否过度、可行性、安全与伦理）。`,
      'findings 每条分级：critical 严重（不改就不能支持主张，或有安全伦理问题）、major 重要、minor 次要；写明指向哪个实验块（blockId）和字段（field），problem 写问题，suggestion 写具体改法。',
      '程序已经做了规则检查，结果列在下面；不要重复这些条目，只补充程序查不出的问题。没有问题的维度不要硬找问题。',
      `总体 verdict：ready（可以签署）/ revise（需要修改）/ rethink（主张或证据链需要重想）。这是第 ${round} 轮审查，最多 2 轮。`,
      `输出：{"verdict":"revise","dimensions":[{"key":"controls","verdict":"ok","note":""}],"findings":[{"severity":"major","dimension":"controls","blockId":"","field":"","problem":"","suggestion":""}]}。${common}`,
    ].join('\n'),
    user: JSON.stringify({ contextCard: JSON.parse(cardOf(card)), claim: chain.claim, hypothesis: chain.hypothesis, alternatives: chain.alternatives.filter(item => item.exclude).map(item => item.text), tier, blocks: chain.blocks, designCards: cards.map(item => Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'confirmed' && key !== 'drift'))), ruleFindings: rules.map(({ rule, severity, blockId, text }) => ({ rule, severity, blockId, text })) }, null, 1),
  };
}

export const parseReview = (raw: string) => reviewSchema.parse(jsonObject(raw));
