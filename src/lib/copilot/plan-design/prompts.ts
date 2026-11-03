import { jsonObject } from '../structured';
import { relationLabels, verifiedEntries, type EvidenceEntry, type Ledger } from './evidence';
import type { RuleFinding } from './rules';
import { planSampleSize, withComputedN } from './sample-size';
import {
  chainSchema, claimTypes, contextCardSchema, contextFields, designCardSchema, hypothesesSchema, reviewDimensions, reviewSchema, requiredBlocks, rivalKinds,
  type Chain, type ChainBlock, type ContextCard, type ContextItem, type DesignCard, type Hypotheses, type Tier,
} from './spec';
import type { ChainTemplate } from './templates';

/**
 * One prompt and one reader per model step. Every reader refuses an answer that is not the shape asked for. The prompts
 * carry the confirmed artifacts as JSON, so a step sees exactly what the author confirmed and nothing of earlier turns.
 * Evidence reaches a prompt only once it passed all three checks of the ledger.
 */
const cardOf = (card: ContextCard) => JSON.stringify(Object.fromEntries(contextFields.map(field => [field, card[field]])), null, 1);
const common = '只输出一个 JSON 对象，不要其他文字。用中文写内容，分子、细胞系、试剂名保留原文。不知道的值留空字符串或 null，不要编造数字、批号或文献。';
const evidenceOf = (entries: EvidenceEntry[]) => entries.map(entry => ({ id: entry.id, relation: relationLabels[entry.relation], about: entry.target, paper: `${entry.title}${entry.year ? `（${entry.year}）` : ''}`, system: entry.system, quote: entry.quote.slice(0, 400) }));
const verifiedText = (entries: EvidenceEntry[]) => entries.length ? `\n\n已核实的证据（存在、引文逐字在原文、作者确认了关系）：\n${JSON.stringify(evidenceOf(entries), null, 1)}` : '';

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

/** ② (plan-design.hypotheses v1, K-Dense hypothesis-generation): rivals before tests, a table of discriminating predictions, no scores. */
export function hypothesesPrompt(card: ContextCard, verified: EvidenceEntry[] = []) {
  return {
    system: [
      '你是研究方案的设计助手，现在做第二步“假设与预测”：根据已确认的情境卡，写出主假设和对立解释，并为每个对立解释写出能把它和主假设区分开的检验。不设计完整实验，不检索文献。',
      `先列对立解释，再想检验。对立解释要来自不同类别，不要是同一种解释的变体：kind 取 ${rivalKinds.join(' / ')}：mechanism 另一种机制、reagent 试剂或操作假象（脱靶、转染毒性、过表达假象、抗体非特异）、measurement 测量假象（参照基因不稳定、信号饱和、选择性拍照）、confounding 混杂（增殖、细胞密度、批次、代次）、reverse 因果方向相反、context 只在这个体系或条件下成立、chance 随机波动。列 2–4 个，不凑数。`,
      '所有假设都只是候选：不打分、不排序、不替作者选择；exclude 默认 true，由作者决定排除哪些。',
      'main.statement 写主假设，措辞与主张类型一致：关联不写成因果，复合物中的相互作用不写成直接结合。mechanism 写设想的过程（可留空）；predicts 写主假设成立时能观察到什么；incompatible 写什么结果与主假设不相容（必须写）。estimand 写要估计的量：比较什么、在什么体系、什么读出、什么时间点。',
      '每个对立解释：test 写哪个实验能把它和主假设分开；ifMain 写主假设成立时这个实验的结果；ifRival 写这个对立解释成立时的结果，两者必须不同；undecided 写什么结果算无法判断。',
      '如果你认为情境卡本身有问题（主张类型不对、研究对象写错），写进 drift，不要自行修改情境卡。',
      `输出：{"estimand":"","main":{"statement":"","mechanism":"","predicts":"","incompatible":""},"rivals":[{"id":"r1","statement":"","kind":"reagent","test":"","ifMain":"","ifRival":"","undecided":"","exclude":true}],"drift":[]}。${common}`,
    ].join('\n'),
    user: `已确认的情境卡：\n${cardOf(card)}${verifiedText(verified)}`,
  };
}

/** Rivals are numbered r1, r2… in order, whatever ids the model wrote. */
export function parseHypotheses(raw: string): Hypotheses {
  const answer = jsonObject(raw) as { rivals?: unknown };
  const rivals = Array.isArray(answer.rivals) ? answer.rivals.map((rival, index) => rival && typeof rival === 'object' ? { ...rival, id: `r${index + 1}` } : rival) : answer.rivals;
  return hypothesesSchema.parse({ ...answer, rivals });
}

export function chainPrompt(card: ContextCard, template: ChainTemplate, hypotheses?: Hypotheses, verified: EvidenceEntry[] = []) {
  const ruled = hypotheses?.rivals.filter(rival => rival.exclude) ?? [];
  return {
    system: [
      '你是研究方案的设计助手，现在做“证据链”：主张 → 最低可信证据 → 实验块，同时写出要排除的对立解释。不检索文献，按常规实验逻辑设计。',
      '以给出的证据链模板打底：保留模板里适用的实验块和对照，按研究对象改写标题和成功标准；不适用的删掉，缺的补上。',
      '实验块按依赖排序：基线 → 操作是否成功（敲低/过表达效率）→ 表型 → 特异性或拯救 → 机制。每块写 purpose（要回答什么）、success（预先写定的成功标准）、failure（失败意味着什么）、fallback（备选做法）、dependsOn（依赖的块 id）。',
      'minTier 表示从哪一档起这块是必做：light 轻量、standard 标准、publication 发表级。light 档的必做块最多 3 个，standard 最多 5 个。只推荐一个档位 recommendedTier。',
      hypotheses
        ? '主假设和对立解释已由作者确认（见下），不要改写，也不要输出 hypothesis 和 alternatives。作者勾选要排除的每个对立解释，都要由某个实验块排除或在设计卡里用对照排除：在负责排除它的实验块的 addresses 里写它的 id。rationale 写依据，只用情境卡里已有的结果和记录，以及下面已核实的证据（写明证据 id）。'
        : 'alternatives 列 2–6 个对立解释，exclude 默认 true；不打分、不排序、不替作者选择。hypothesis 写主假设，rationale 写依据（只用情境卡里已有的结果和记录）。',
      '如果你认为情境卡或假设本身有问题，写进 drift，不要自行修改。',
      `输出结构：{"claim":"","hypothesis":"","rationale":"","minimumEvidence":[""],${hypotheses ? '' : '"alternatives":[{"text":"","exclude":true}],'}"blocks":[{"id":"小写字母数字和-","title":"","kind":"baseline|manipulation|phenotype|specificity|mechanism","minTier":"light|standard|publication","purpose":"","success":"","failure":"","fallback":"","dependsOn":[]${hypotheses ? ',"addresses":[]' : ''}}],"recommendedTier":"standard","drift":[]}。${common}`,
    ].join('\n'),
    user: [
      `已确认的情境卡：\n${cardOf(card)}`,
      hypotheses ? `已确认的假设与预测：\n${JSON.stringify({ estimand: hypotheses.estimand, main: hypotheses.main, rivalsToRuleOut: ruled.map(rival => ({ id: rival.id, statement: rival.statement, test: rival.test })) }, null, 1)}` : '',
      `证据链模板（${template.label} v${template.version}）：\n${JSON.stringify({ minimumEvidence: template.minimumEvidence, requiredControls: template.requiredControls, alternatives: template.alternatives, blocks: template.blocks }, null, 1)}`,
    ].filter(Boolean).join('\n\n') + verifiedText(verified),
  };
}

/** Under v2 the hypothesis and the rivals are the confirmed ones, whatever the model wrote; addresses keep only rivals that exist. */
export function parseChain(raw: string, hypotheses?: Hypotheses): Chain {
  const answer = jsonObject(raw) as Record<string, unknown>;
  const chain = chainSchema.parse(hypotheses ? { ...answer, hypothesis: hypotheses.main.statement, alternatives: hypotheses.rivals.map(rival => ({ id: rival.id, text: rival.statement, exclude: rival.exclude })) } : answer);
  const ids = new Set<string>();
  for (const block of chain.blocks) { if (ids.has(block.id)) throw new Error(`Block id ${block.id} is used twice`); ids.add(block.id); }
  const rivals = new Set(chain.alternatives.map(item => item.id).filter(Boolean));
  for (const block of chain.blocks) {
    block.dependsOn = block.dependsOn.filter(id => ids.has(id) && id !== block.id);
    block.addresses = block.addresses.filter(id => rivals.has(id));
  }
  return chain;
}

export type ProtocolChoice = { id: string; code: string; title: string };

export function cardPrompt(card: ContextCard, chain: Chain, tier: Tier, block: ChainBlock, protocols: ProtocolChoice[], verified: EvidenceEntry[] = []) {
  const required = requiredBlocks(chain, tier);
  const rivals = chain.alternatives.filter(item => item.exclude && item.id);
  return {
    system: [
      '你是研究方案的设计助手，现在为一个实验块写“设计卡”。按常规实验逻辑设计；凡是依据只是常规做法的，不要写成“文献证明”，只有下面已核实的证据可以作为依据（写明证据 id）。',
      '不要为了简短而省略：对照、读出、判定标准有几条写几条。每个对照写清它排除哪个对立解释：excludes 写文字，addresses 写对立解释的 id（没有就写空数组）；kind：negative 阴性、positive 阳性、vehicle 溶剂、empty_vector 空载体、isotype 同型/IgG、loading 上样、reference_gene 参照基因、other。concurrent 表示与处理组同期进行。',
      'groups 是这个实验的分组（name 简短，会成为 LabNest 实验里的分组名；control 标记对照组）。unit.nCounts 写 n 数的是什么：biological 独立生物学重复、technical 技术重复、wells 孔、animals 动物。',
      'randomization 写怎么随机分配（哪些孔、皿或板位分到哪组）；batch 写批次安排（每个独立重复在不同的一天或代次完成，每批都包含全部分组）；blinding 写谁在不知道分组的情况下计数或定量。',
      '样本量由程序计算，不要填 sampleSize.n。只填：basis（minimum_effect 最小关注效应 / pilot 预实验 / convention 惯例 / pending 需要预实验）、design（two_groups 两组独立比较 / paired 配对 / anova 多组单因素）、difference（要发现的最小差异，用读出的单位）、sd（同一单位的标准差）、source（这些数字从哪里来：情境卡里的已有结果或证据 id）。情境卡和证据里都没有数字时，basis 写 pending，difference 和 sd 写 null，note 写“需要预实验”，不要编。',
      'readouts 的 assay 取 qpcr、western_blot、imaging、flow、viability、migration、elisa、co_ip、sequencing、other。用 qPCR 时 referenceGenes 写参照基因；用 WB 时写 loadingControl 和 normalization。',
      'criteria 是预先写定的判定标准，可以直接判断“成立 / 不成立 / 无法判断”。analysis 写检验方法、主要比较、多重比较校正、剔除规则。',
      `protocol：如果下面的 LabNest 规程里有合适的，填它的 id 和 title；没有就 needed 填 true、title 写需要什么规程。不要编造规程 id。`,
      '如果你认为情境卡或证据链需要修改，写进 drift，不要自行修改。',
      `输出 designCard 结构：{"blockId":"${block.id}","title":"","unit":{"experimental":"","analysis":"","nCounts":"biological"},"factors":[{"name":"","levels":[]}],"groups":[{"name":"","treatment":"","control":false}],"controls":[{"name":"","kind":"negative","excludes":"","concurrent":true,"addresses":[]}],"manipulation":{"kind":"none|knockdown|knockout|overexpression|drug|other","independentReagents":null,"efficiencyCheck":""},"replicates":{"biological":null,"technical":null,"note":""},"sampleSize":{"basis":"pending","design":"two_groups","difference":null,"sd":null,"source":"","note":""},"randomization":"","blinding":"","batch":"","readouts":[{"name":"","method":"","timepoint":"","assay":"other"}],"referenceGenes":[],"loadingControl":"","normalization":"","analysis":{"test":"","primaryComparison":"","multipleComparison":"","exclusion":""},"criteria":[],"dependsOn":[],"protocol":{"id":"","title":"","needed":false},"methodNote":"","drift":[]}。${common}`,
    ].join('\n'),
    user: [
      `情境卡：\n${cardOf(card)}`,
      `主张：${chain.claim}\n要排除的对立解释：\n${chain.alternatives.filter(item => item.exclude).map(item => `- ${item.id ? `${item.id}：` : ''}${item.text}`).join('\n') || '（无）'}`,
      rivals.length ? `这个实验块负责排除：${block.addresses.length ? block.addresses.join('、') : '（无指定）'}` : '',
      `本档（${tier}）的必做实验块：${required.map(item => `${item.id}「${item.title}」`).join('、')}`,
      `现在要写的实验块：${JSON.stringify(block)}`,
      `LabNest 规程（id · 编号 · 名称）：\n${protocols.map(item => `${item.id} · ${item.code} · ${item.title}`).join('\n') || '（无）'}`,
    ].filter(Boolean).join('\n\n') + verifiedText(verified),
  };
}

/** The card as the model wrote it, with n worked out by the program and a made-up Protocol id dropped. */
export function parseCard(raw: string, block: ChainBlock, protocols: ProtocolChoice[], rivalIds: string[] = []): DesignCard {
  const answer = jsonObject(raw) as { title?: unknown; sampleSize?: Record<string, unknown> };
  const card = designCardSchema.parse({ ...answer, title: typeof answer.title === 'string' && answer.title.trim().length >= 2 ? answer.title : block.title, blockId: block.id, confirmed: false });
  if (card.protocol.id && !protocols.some(item => item.id === card.protocol.id)) card.protocol = { id: '', title: card.protocol.title, needed: true };
  card.controls = card.controls.map(control => ({ ...control, addresses: control.addresses.filter(id => rivalIds.includes(id)) }));
  return withComputedN(card);
}

/**
 * The review rubric (plan-design.review v3): each dimension with the questions scientific-critical-thinking and
 * statistical-power ask of it (biases, statistical pitfalls, the level of evidence a design can reach).
 */
const rubric: Record<typeof reviewDimensions[number], string> = {
  controls: '对照：每个要排除的对立解释是否都有对照或实验块排除；阴性对照是否与处理同期、走同样的流程；阳性对照能否证明检测本身有效；溶剂、mock、空载体是否齐全。',
  confounding: '混杂与批次：处理是否和日期、批次、代次、板位、操作者一起变化；独立重复是否分批完成且每批都含全部分组；增殖、密度、毒性会不会冒充表型；是否随机分配。',
  pseudoreplication: '伪重复：n 是否是独立的生物学重复；孔、视野、细胞、技术重复是否只用来求平均；分析单位与实验单元是否一致，或用了能处理嵌套的分析。',
  sample_size: '样本量依据：效应量从哪里来（最小关注效应优于预实验，预实验估计往往偏大，惯例最弱）；n 是否由计算得出并看了敏感性范围；计划的重复数是否少于计算所需；不能用事后功效。',
  multiple_comparisons: '多重比较：一共几次检验、用什么校正；主要比较是否事先写定；剔除规则和数据变换是否事先写定（避免分叉路径）；探索性分析是否与验证性分开。',
  overclaiming: '结论是否过度：主张类型与设计是否匹配（关联与因果、必要性与充分性、复合物与直接结合）；是否超出所用细胞系、时间点和条件外推；判定标准能否区分支持、不支持和无法判断。',
  feasibility: '可行性：资源（已有、可以获得、没有）、时间和依赖顺序是否可行；失败时有没有备选；关键试剂（抗体、siRNA、质粒）是否已经验证。',
  safety_ethics: '安全与伦理：涉及的生物安全等级（如慢病毒）、动物或人体样本的审批；只指出需要的审批，不写操作细节。',
};

/** The reviewer sees the artifacts, the program's checks and the computed sample sizes, never the drafting conversation (ARIS). */
export function reviewPrompt(card: ContextCard, chain: Chain, tier: Tier, cards: DesignCard[], rules: RuleFinding[], round: number, extra: { hypotheses?: Hypotheses; evidence?: Ledger } = {}) {
  const verified = verifiedEntries(extra.evidence);
  const searches = extra.evidence?.searches ?? [];
  return {
    system: [
      '你是独立的实验设计审稿人。你没有参与起草，只根据下面的成果判断这份设计能否支持它的主张。不重写方案，不替作者选择。',
      `按固定评分表逐项给出 verdict（ok / concern / not_applicable），${reviewDimensions.length} 个维度每个一条、不能省略：`,
      ...reviewDimensions.map(key => `- ${key}：${rubric[key]}`),
      'findings 每条分级：critical 严重（不改就不能支持主张，或有安全伦理问题）、major 重要、minor 次要；写明指向哪个实验块（blockId，整体问题留空）和字段（field）。problem 写问题，suggestion 写具体可执行的改法（加什么对照、改哪个字段、怎么改），不能只说“需要考虑”。判为 concern 的维度至少写一条 finding。',
      '程序已经做了规则检查并算好了样本量，结果列在下面；不要重复规则检查的条目，也不要重新计算样本量，只判断依据是否站得住，补充程序查不出的问题。没有问题的维度不要硬找问题。',
      'supports 写这份设计如果结果全部符合预期，最多能支持什么结论（主张类型、体系和条件的范围）。strengths 最多 5 条，写设计做得好的地方。',
      `总体 verdict：ready（可以签署）/ revise（需要修改）/ rethink（主张或证据链需要重想）。这是第 ${round} 轮审查，最多 2 轮。`,
      `输出：{"verdict":"revise","supports":"","strengths":[],"dimensions":[{"key":"controls","verdict":"ok","note":""}],"findings":[{"severity":"major","dimension":"controls","blockId":"","field":"","problem":"","suggestion":""}]}。${common}`,
    ].join('\n'),
    user: JSON.stringify({
      contextCard: JSON.parse(cardOf(card)), claim: chain.claim, hypothesis: chain.hypothesis,
      ...(extra.hypotheses ? { estimand: extra.hypotheses.estimand, main: extra.hypotheses.main, rivals: extra.hypotheses.rivals.filter(rival => rival.exclude).map(({ id, statement, kind, test, ifMain, ifRival, undecided }) => ({ id, statement, kind, test, ifMain, ifRival, undecided })) } : { alternatives: chain.alternatives.filter(item => item.exclude).map(item => item.text) }),
      tier, blocks: chain.blocks,
      designCards: cards.map(item => Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'confirmed' && key !== 'drift'))),
      sampleSize: cards.map(item => { const plan = planSampleSize(item); return { blockId: item.blockId, basis: plan.input.basis, design: plan.input.design, effect: plan.effect ?? null, analysedPerGroup: plan.analysed ?? null, enrolledPerGroup: plan.enrolled ?? null, plannedReplicates: plan.planned ?? null, detectableAtPlanned: plan.detectable ?? null, source: plan.input.source }; }),
      ...(extra.evidence ? { evidence: { verified: evidenceOf(verified), unverified: extra.evidence.entries.length - verified.length, searches: searches.map(search => `${search.database}：${search.query}（${search.error ? '失败' : `${search.results} 篇`}）`) } } : {}),
      ruleFindings: rules.map(({ rule, severity, blockId, text }) => ({ rule, severity, blockId, text })),
    }, null, 1),
  };
}

export const parseReview = (raw: string) => reviewSchema.parse(jsonObject(raw));
