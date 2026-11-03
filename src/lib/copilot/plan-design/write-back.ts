import type { ScientificContentBlock, ScientificDocument } from '../../scientific-document';
import { databaseLabels, entryGaps, entryStatus, verifiedEntries, type EvidenceEntry } from './evidence';
import type { RuleFinding } from './rules';
import { sampleSizeLine } from './sample-size';
import { claimTypeLabels, dimensionLabels, requiredBlocks, type ContextCard, type DesignCard, type DesignState, type ReviewRound, type Tier } from './spec';
import { changedSinceReview } from './workflow';

/**
 * What signing writes (Q309, Q310), built without touching anything so the author sees it first: the premise fields
 * with before and after, the plan sections the design fills, and one planned experiment per required block. Blocks a
 * signed design wrote carry `copilot-design-<run>-` ids; signing again replaces them unless the author keeps both.
 */
export const DESIGN_BLOCK_PREFIX = 'copilot-design-';
export const premiseFields = ['objective', 'hypothesis', 'rationale'] as const;
/** The plan sections a signed design writes; the author ticks which (§14.2). */
export const designSections = ['design', 'material_methods', 'acceptance_criteria', 'constraints', 'references'] as const;
export type PremiseField = typeof premiseFields[number];
export type PremiseChange = { field: PremiseField; before: string; after: string; apply: boolean };
export type SectionWrite = { key: string; blocks: ScientificContentBlock[]; replaced: number };
export type PlannedExperiment = { blockId: string; title: string; purpose: string; protocolId?: string; protocolNeeded?: string; groups: string[]; dependsOn: string[]; background: ScientificContentBlock[] };
export type SignOff = { premise: PremiseChange[]; sections: SectionWrite[]; experiments: PlannedExperiment[]; optional: string[] };
export type SignContext = { runId: string; version: number; date: string; purpose: string; protocols: Map<string, { code: string; title: string }>; drafting: string; rules: RuleFinding[] };

export function buildSignOff(state: DesignState, plan: { objective: string | null; hypothesis: string | null; rationale: string | null; document: ScientificDocument }, context: SignContext): SignOff {
  const card = state.context!.card, chain = state.chain!.draft!, tier = state.chain!.tier!, cards = state.cards!.items;
  const round = state.review?.rounds.at(-1);
  const hypotheses = state.hypotheses?.confirmedAt ? state.hypotheses.draft : undefined;
  const verified = verifiedEntries(state.evidence);
  const proposed: Record<PremiseField, string> = { objective: card.question, hypothesis: hypotheses?.main.statement || chain.hypothesis || chain.claim, rationale: chain.rationale };
  const premise = premiseFields.map(field => {
    const before = plan[field]?.trim() ?? '', after = proposed[field].trim();
    // An empty field, or one that still holds the purpose the run started from, is filled; text the author wrote is kept unless they tick it.
    return { field, before, after, apply: Boolean(after) && after !== before && (!before || before === context.purpose.trim()) };
  }).filter(change => change.after && change.after !== change.before);

  let counter = 0;
  const id = (section: string) => `${DESIGN_BLOCK_PREFIX}${context.runId}-${section}-${++counter}`;
  const heading = (section: string, text: string): ScientificContentBlock => ({ id: id(section), type: 'heading', text });
  const para = (section: string, text: string): ScientificContentBlock => ({ id: id(section), type: 'text', text });
  const title = `研究方案设计 v${context.version}（${context.date}，设计工作台）`;
  const required = requiredBlocks(chain, tier);
  const optional = chain.blocks.filter(block => !required.includes(block));
  const titleOf = (blockId: string) => chain.blocks.find(block => block.id === blockId)?.title ?? blockId;

  const design: ScientificContentBlock[] = [heading('design', title),
    para('design', `主张（${claimTypeLabelZh(card.claimType)}）：${chain.claim}`),
    para('design', `最低可信证据：${chain.minimumEvidence.join('；') || '待定'}`),
    para('design', `要排除：${chain.alternatives.filter(item => item.exclude).map(item => item.text).join('；') || '无'}`),
    para('design', `档位：${tierZh[tier]}。必做 ${required.length} 项：${required.map(block => block.title).join(' → ')}`)];
  if (hypotheses) {
    design.push(heading('design', '假设与预测'));
    if (hypotheses.estimand) design.push(para('design', `要估计的量：${hypotheses.estimand}`));
    design.push(para('design', `主假设（候选）：${hypotheses.main.statement}${hypotheses.main.predicts ? `；成立时：${hypotheses.main.predicts}` : ''}；与之不相容的结果：${hypotheses.main.incompatible || '待定'}`));
    const ruled = hypotheses.rivals.filter(rival => rival.exclude);
    if (ruled.length) design.push({ id: id('design'), type: 'table', caption: '区分性预测', rows: [['对立解释', '类别', '区分的实验', '主假设成立时', '对立解释成立时', '无法判断'], ...ruled.map(rival => [rival.statement, rivalKindZh[rival.kind], rival.test || '待定', rival.ifMain || '待定', rival.ifRival || '待定', rival.undecided || '待定'])] });
    const kept = hypotheses.rivals.filter(rival => !rival.exclude);
    if (kept.length) design.push(para('design', `列出但这次不排除：${kept.map(rival => rival.statement).join('；')}`));
  }
  for (const item of cards) {
    design.push(heading('design', `【必做】${item.title}`));
    design.push({ id: id('design'), type: 'table', caption: `${item.title}：分组`, rows: [['组', '处理', '对照用途'], ...item.groups.map(group => [group.name, group.treatment || '待定', group.control ? controlPurpose(item, group.name) : ''])] });
    for (const line of [
      `读出：${item.readouts.map(readout => [readout.name, readout.method, readout.timepoint].filter(Boolean).join('，')).join('；') || '待定'}`,
      `对照：${item.controls.map(control => `${control.name}${control.excludes ? `（排除：${control.excludes}）` : ''}`).join('；') || '待定'}`,
      `实验单元与分析单位：${[item.unit.experimental, item.unit.analysis].filter(Boolean).join(' / ') || '待定'}；n 计的是${nCountsZh[item.unit.nCounts]}`,
      `重复：生物学 ${item.replicates.biological ?? '待定'}，技术 ${item.replicates.technical ?? '待定'}${item.replicates.note ? `（${item.replicates.note}）` : ''}；样本量：${item.sampleSize.n ?? '待定'}（${basisZh[item.sampleSize.basis]}${item.sampleSize.note ? `，${item.sampleSize.note}` : ''}）`,
      [item.randomization && `随机：${item.randomization}`, item.blinding && `盲法：${item.blinding}`, item.batch && `批次：${item.batch}`].filter(Boolean).join('；'),
      item.dependsOn.length ? `依赖：${item.dependsOn.map(titleOf).join('、')}` : '',
      hypotheses ? sampleSizeLine(item) : '',
      basisLine(verified.filter(entry => entry.target === item.blockId)),
    ]) if (line) design.push(para('design', line));
  }
  if (optional.length) design.push(heading('design', '可选实验（未建实验）'), ...optional.map(block => para('design', `${block.title}：${block.purpose || block.success}`)));

  const methods: ScientificContentBlock[] = [heading('material_methods', title)];
  for (const item of cards) {
    const protocol = item.protocol.id ? context.protocols.get(item.protocol.id) : undefined;
    methods.push(heading('material_methods', item.title), para('material_methods', protocol ? `规程：${protocol.code} ${protocol.title}` : `需要规程：${item.protocol.title || item.title}（可用“识别说明书”或“按目标设计”生成）`));
    if (item.methodNote) methods.push(para('material_methods', item.methodNote));
    const qc = [item.referenceGenes.length && `参照基因：${item.referenceGenes.join('、')}`, item.loadingControl && `上样对照：${item.loadingControl}`, item.normalization && `归一化：${item.normalization}`].filter(Boolean).join('；');
    if (qc) methods.push(para('material_methods', qc));
  }
  for (const [label, value] of [['已有', card.resourcesHave], ['可以获得', card.resourcesCanGet], ['没有', card.resourcesLack]] as const) if (value) methods.push(para('material_methods', `资源（${label}）：${value}`));

  const criteria: ScientificContentBlock[] = [heading('acceptance_criteria', title)];
  for (const item of cards) {
    criteria.push(heading('acceptance_criteria', item.title), { id: id('acceptance_criteria'), type: 'checklist', items: item.criteria.length ? item.criteria : ['判定标准待补充'] });
    const analysis = [item.analysis.test && `检验：${item.analysis.test}`, item.analysis.primaryComparison && `主要比较：${item.analysis.primaryComparison}`, item.analysis.multipleComparison && `多重比较：${item.analysis.multipleComparison}`, item.analysis.exclusion && `剔除规则：${item.analysis.exclusion}`].filter(Boolean).join('；');
    if (analysis) criteria.push(para('acceptance_criteria', `分析计划：${analysis}`));
  }

  const limits: ScientificContentBlock[] = [heading('constraints', title)];
  for (const block of required) if (block.dependsOn.length || block.failure || block.fallback) limits.push(para('constraints', `${block.title}：${[block.dependsOn.length && `依赖 ${block.dependsOn.map(titleOf).join('、')}`, block.failure && `失败意味着 ${block.failure}`, block.fallback && `备选 ${block.fallback}`].filter(Boolean).join('；')}`));
  if (card.constraints) limits.push(para('constraints', `约束：${card.constraints}`));
  if (card.outOfScope) limits.push(para('constraints', `不做：${card.outOfScope}`));
  const left = round?.findings.filter(finding => finding.status !== 'resolved') ?? [];
  if (round?.supports) limits.push(para('constraints', `审查认为这份设计最多能支持：${round.supports}`));
  if (left.length) limits.push(heading('constraints', '审查后仍保留的问题'), ...left.map(finding => para('constraints', `[${severityZh[finding.severity]}·${dimensionZh(finding.dimension)}] ${finding.problem}${finding.status === 'waived' ? `（作者说明：${finding.reason}）` : ''}`)));
  const unreviewed = changedSinceReview(state).map(label => artifactZh[label] ?? label).join('、');
  if (unreviewed) limits.push(para('constraints', `最后一轮审查之后又修改了：${unreviewed}。这些修改没有再审查。`));
  const waived = context.rules.filter(finding => state.waivers?.[finding.key]);
  if (waived.length) limits.push(heading('constraints', '规则检查的豁免'), ...waived.map(finding => para('constraints', `规则 ${finding.rule}（${titleOf(finding.blockId)}）：${state.waivers![finding.key]}`)));

  const ledger = state.evidence;
  const pending = (ledger?.entries ?? []).filter(entry => entryStatus(entry) !== 'verified');
  const searched = ledger?.searches ?? [];
  const notes: ScientificContentBlock[] = [heading('references', `设计工作台 v${context.version} 的说明（${context.date}）`)];
  if (verified.length) notes.push(heading('references', '已核实的证据'), ...verified.map(entry => para('references', citation(entry, titleOf, hypotheses))));
  if (pending.length) notes.push(heading('references', '待核实（未写入依据）'), ...pending.map(entry => para('references', `${reference(entry)}：${entryGaps(entry).map(gap => gapZh[gap] ?? gap).join('；')}`)));
  if (searched.length) notes.push(heading('references', '检索记录'), ...searched.map(search => para('references', `${search.at.slice(0, 10)} ${databaseLabels[search.database]}：“${search.query}”，${search.error ? `检索失败（${search.error.slice(0, 120)}）` : search.results ? `${search.results} 篇` : '在记录的检索范围内未找到'}`)));
  notes.push(
    para('references', verified.length ? '只有上面已核实的证据作为依据；其余条目为常规做法，未经文献核对。' : searched.length || ledger?.entries.length ? '本版没有已核实的文献证据；各实验条目为常规做法，未经文献核对。' : '本版设计未检索文献；各实验条目为常规做法，未经文献核对。'),
    para('references', `AI 使用：情境卡、${hypotheses ? '假设与预测、' : ''}证据链、设计卡由 ${context.drafting} 起草${(ledger?.entries ?? []).some(entry => entry.model) ? '，文献的引文与关系由它初读、程序逐字核对' : ''}；${round ? `审查由 ${round.provider}${round.model ? `（${round.model}）` : ''} 完成，共 ${state.review!.rounds.length} 轮${round.selfReview ? '，与起草是同一服务，独立性有限' : ''}${unreviewed ? `；之后修改的内容（${unreviewed}）未再审查` : ''}` : '未审查'}。样本量由程序计算，不由 AI 填写。每一步均由作者确认。`));

  const sections = [['design', design], ['material_methods', methods], ['acceptance_criteria', criteria], ['constraints', limits], ['references', notes]] as const satisfies readonly (readonly [typeof designSections[number], ScientificContentBlock[]])[];
  const writes = sections.map(([key, blocks]) => ({ key, blocks: [...blocks], replaced: (plan.document.sections.find(section => section.key === key)?.blocks ?? []).filter(block => block.id.startsWith(DESIGN_BLOCK_PREFIX)).length }));

  const experiments = cards.map(item => {
    const block = chain.blocks.find(entry => entry.id === item.blockId);
    const protocol = item.protocol.id && context.protocols.has(item.protocol.id) ? item.protocol.id : undefined;
    const purpose = [block?.purpose || item.title, item.criteria.length ? `判定标准：${item.criteria.join('；')}` : ''].filter(Boolean).join('\n');
    const background: ScientificContentBlock[] = [
      { id: `design-${context.runId}-${item.blockId}-1`, type: 'text', text: `来自研究方案设计 v${context.version}：${chain.claim}` },
      { id: `design-${context.runId}-${item.blockId}-2`, type: 'checklist', items: item.criteria.length ? item.criteria : ['判定标准待补充'] },
      { id: `design-${context.runId}-${item.blockId}-3`, type: 'text', text: `对照：${item.controls.map(control => control.name).join('；') || '待定'}` },
    ];
    return { blockId: item.blockId, title: item.title, purpose, protocolId: protocol, protocolNeeded: protocol ? undefined : item.protocol.title || item.title, groups: [...new Set(item.groups.map(group => group.name.trim()).filter(Boolean))], dependsOn: item.dependsOn.filter(dep => cards.some(other => other.blockId === dep)), background };
  });
  return { premise, sections: writes, experiments, optional: optional.map(block => block.title) };
}

/** The plan document with the signed design written in: earlier design blocks in those sections go unless `keepPrevious`. */
export function applySections(document: ScientificDocument, writes: SectionWrite[], keepPrevious: boolean): ScientificDocument {
  return { ...document, sections: document.sections.map(section => {
    const write = writes.find(item => item.key === section.key);
    if (!write) return section;
    return { ...section, blocks: [...(keepPrevious ? section.blocks : section.blocks.filter(block => !block.id.startsWith(DESIGN_BLOCK_PREFIX))), ...write.blocks] };
  }) };
}

/** The basis line of a card: its verified method papers, or the plain statement that it is common practice. */
function basisLine(entries: EvidenceEntry[]) {
  return entries.length ? `依据：${entries.map(entry => `${reference(entry)}（已核实）`).join('；')}` : '依据：常规做法，未经文献核对。';
}
const reference = (entry: EvidenceEntry) => `${entry.title}${entry.year ? `（${entry.year}）` : ''}${entry.pmid ? ` PMID ${entry.pmid}` : entry.doi ? ` doi:${entry.doi}` : ''}`;
function citation(entry: EvidenceEntry, titleOf: (id: string) => string, hypotheses?: { main: { statement: string }; rivals: { id: string; statement: string }[] }) {
  const about = entry.target === 'main' ? `主假设` : entry.target === 'background' ? '背景' : hypotheses?.rivals.find(rival => rival.id === entry.target)?.statement ?? titleOf(entry.target);
  return `[${relationZh[entry.relation]}·${about}] ${reference(entry)}${entry.venue ? `，${entry.venue}` : ''}。${entry.system ? `体系：${entry.system}。` : ''}引文（${readZh[entry.read] ?? '原文'}）：“${entry.quote}”${entry.note ? ` ${entry.note}` : ''}`;
}
const relationZh: Record<EvidenceEntry['relation'], string> = { subject: '支持', counter: '反证', method: '方法依据', background: '背景' };
const readZh: Record<string, string> = { abstract: '摘要', fulltext: '全文', pdf: 'PDF' };
const gapZh: Record<string, string> = {
  Retracted: '已撤稿', 'Not found in Europe PMC or PubMed': '在 Europe PMC 和 PubMed 都查不到', 'Not looked up: give its PMID or DOI': '没有查证：需要 PMID 或 DOI', 'No quote': '没有引文',
  'The quote is not in the text word for word': '引文没有逐字出现在原文里', 'The quote was not checked: the text could not be read': '没能读取原文，引文未核对', 'Relation not confirmed': '作者还没确认关系',
};
const artifactZh: Record<string, string> = { 'Context card': '情境卡', 'Hypotheses and predictions': '假设与预测', 'Evidence chain': '证据链', 'Evidence ledger': '证据账本' };
const rivalKindZh: Record<string, string> = { mechanism: '另一种机制', reagent: '试剂或操作假象', measurement: '测量假象', confounding: '混杂', reverse: '因果方向相反', context: '只在该体系或条件下', chance: '随机波动' };
const tierZh: Record<Tier, string> = { light: '轻量', standard: '标准', publication: '发表级' };
const claimZh: Record<string, string> = { association: '关联', necessity: '必要性', sufficiency: '充分性', mechanism: '机制', interaction: '相互作用', direct_binding: '直接结合' };
const claimTypeLabelZh = (type: ContextCard['claimType']) => claimZh[type] ?? (type ? claimTypeLabels[type] : '未定');
const nCountsZh: Record<DesignCard['unit']['nCounts'], string> = { biological: '独立生物学重复', technical: '技术重复', wells: '孔', animals: '动物', other: '其他' };
const basisZh: Record<DesignCard['sampleSize']['basis'], string> = { minimum_effect: '依据最小关注效应', pilot: '依据预实验', convention: '惯例', pending: '需要预实验' };
const severityZh: Record<ReviewRound['findings'][number]['severity'], string> = { critical: '严重', major: '重要', minor: '次要' };
const dimensionZhMap: Record<string, string> = { controls: '对照', confounding: '混杂与批次', pseudoreplication: '伪重复', sample_size: '样本量', multiple_comparisons: '多重比较', overclaiming: '结论过度', feasibility: '可行性', safety_ethics: '安全与伦理' };
const dimensionZh = (key: keyof typeof dimensionLabels) => dimensionZhMap[key] ?? dimensionLabels[key];
function controlPurpose(card: DesignCard, groupName: string) {
  const match = card.controls.find(control => control.name.includes(groupName) || groupName.includes(control.name));
  return match?.excludes ?? '对照';
}
