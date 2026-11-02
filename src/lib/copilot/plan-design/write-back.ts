import type { ScientificContentBlock, ScientificDocument } from '../../scientific-document';
import type { RuleFinding } from './rules';
import { claimTypeLabels, dimensionLabels, requiredBlocks, type ContextCard, type DesignCard, type DesignState, type ReviewRound, type Tier } from './spec';

/**
 * What signing writes (Q309, Q310), built without touching anything so the author sees it first: the premise fields
 * with before and after, the plan sections the design fills, and one planned experiment per required block. Blocks a
 * signed design wrote carry `copilot-design-<run>-` ids; signing again replaces them unless the author keeps both.
 */
export const DESIGN_BLOCK_PREFIX = 'copilot-design-';
export const premiseFields = ['objective', 'hypothesis', 'rationale'] as const;
export type PremiseField = typeof premiseFields[number];
export type PremiseChange = { field: PremiseField; before: string; after: string; apply: boolean };
export type SectionWrite = { key: string; blocks: ScientificContentBlock[]; replaced: number };
export type PlannedExperiment = { blockId: string; title: string; purpose: string; protocolId?: string; protocolNeeded?: string; groups: string[]; dependsOn: string[]; background: ScientificContentBlock[] };
export type SignOff = { premise: PremiseChange[]; sections: SectionWrite[]; experiments: PlannedExperiment[]; optional: string[] };
export type SignContext = { runId: string; version: number; date: string; purpose: string; protocols: Map<string, { code: string; title: string }>; drafting: string; rules: RuleFinding[] };

export function buildSignOff(state: DesignState, plan: { objective: string | null; hypothesis: string | null; rationale: string | null; document: ScientificDocument }, context: SignContext): SignOff {
  const card = state.context!.card, chain = state.chain!.draft!, tier = state.chain!.tier!, cards = state.cards!.items;
  const round = state.review?.rounds.at(-1);
  const proposed: Record<PremiseField, string> = { objective: card.question, hypothesis: chain.hypothesis || chain.claim, rationale: chain.rationale };
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
      '依据：常规做法，未经文献核对。',
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
  if (left.length) limits.push(heading('constraints', '审查后仍保留的问题'), ...left.map(finding => para('constraints', `[${severityZh[finding.severity]}·${dimensionZh(finding.dimension)}] ${finding.problem}${finding.status === 'waived' ? `（作者说明：${finding.reason}）` : ''}`)));
  const waived = context.rules.filter(finding => state.waivers?.[finding.key]);
  if (waived.length) limits.push(heading('constraints', '规则检查的豁免'), ...waived.map(finding => para('constraints', `规则 ${finding.rule}（${titleOf(finding.blockId)}）：${state.waivers![finding.key]}`)));

  const notes: ScientificContentBlock[] = [heading('references', `设计工作台 v${context.version} 的说明（${context.date}）`),
    para('references', '本版设计未检索文献；各实验条目为常规做法，未经文献核对。'),
    para('references', `AI 使用：情境卡、证据链、设计卡由 ${context.drafting} 起草；${round ? `审查由 ${round.provider}${round.model ? `（${round.model}）` : ''} 完成，共 ${state.review!.rounds.length} 轮${round.selfReview ? '，与起草是同一服务，独立性有限' : ''}` : '未审查'}。每一步均由作者确认。`)];

  const sections = [['design', design], ['material_methods', methods], ['acceptance_criteria', criteria], ['constraints', limits], ['references', notes]] as const;
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
