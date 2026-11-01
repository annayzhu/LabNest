import type { ScientificDocument } from '../scientific-document';
import type { Design, DesignExperiment, Paper, SubQuestion, Suggestion, PlanBlocks, PlanSectionDraft, CopilotInputs } from './types';

/**
 * Stage 5: the design as changes the author may adopt: the design written into 设计, the papers cited into
 * 参考与工作笔记, and one card for each experiment that can become a planned Experiment. Nothing here writes anything.
 */
export function buildSuggestions(runId: string, design: Design, subQuestions: SubQuestion[], papers: Paper[], date: string, inputs: CopilotInputs = {}): Suggestion[] {
  // Papers are numbered in the order the design first cites them.
  const cited: Paper[] = [];
  const numberOf = (key: string) => { const found = papers.find(paper => paper.key === key); if (!found) return undefined; if (!cited.includes(found)) cited.push(found); return cited.indexOf(found) + 1; };
  const line = (experiment: DesignExperiment) => {
    const refs = experiment.evidence.map(key => numberOf(key)).filter((number): number is number => number !== undefined).map(number => `[${number}]`).join('');
    const parts = [`${experiment.priority === 'must' ? '【必做】' : '【可选】'}${experiment.name}`, experiment.purpose && `验证：${experiment.purpose}`, experiment.approach && `做法：${experiment.approach}`,
      experiment.readouts.length && `读出：${experiment.readouts.join('、')}`, experiment.controls.length && `对照：${experiment.controls.join('、')}`, refs && `依据：${refs}`, experiment.note && `注意：${experiment.note}`].filter(Boolean);
    return `${parts.join('；')}${experiment.verified ? '' : `（未核实：${experiment.problem}）`}`;
  };
  const designBlocks: PlanBlocks = [{ type: 'heading', text: `Copilot 实验设计（${date}）` }];
  if (inputs.objective) designBlocks.push({ type: 'text', text: `已确认目标：${inputs.objective}` });
  if (inputs.subject) designBlocks.push({ type: 'text', text: `研究对象：${inputs.subject}` });
  if (design.summary) designBlocks.push({ type: 'text', text: design.summary });
  for (const item of design.items) {
    const question = subQuestions.find(q => q.id === item.subQuestionId);
    designBlocks.push({ type: 'heading', text: `${item.subQuestionId}：${question?.question ?? ''}` });
    for (const experiment of item.experiments) {
      designBlocks.push({ type: 'heading', text: `${experiment.priority === 'must' ? '【必做】' : '【可选】'}${experiment.name}` });
      const refs = experiment.evidence.map(numberOf).filter(Boolean).map(number => `[${number}]`).join('');
      for (const text of [experiment.purpose && `目的：${experiment.purpose}`, `比较：${experiment.comparison || '待研究者补充'}`, `读出：${experiment.readouts.join('、') || '待定'}`, `对照：${experiment.controls.join('、') || '待定'}`, refs && `来源：${refs}`, !experiment.verified && `证据限制：${experiment.problem || '待核对原文'}`]) {
        if (text) designBlocks.push({ type: 'text', text });
      }
    }
  }
  if (design.gaps.length) designBlocks.push({ type: 'heading', text: '文献没有覆盖、需要自己决定的地方' }, ...design.gaps.map(gap => ({ type: 'text' as const, text: gap })));
  const referenceBlocks: { type: 'heading' | 'text'; text: string }[] = [{ type: 'heading', text: `文献（Copilot 检索，${date}）` },
    ...cited.map((paper, index) => ({ type: 'text' as const, text: `[${index + 1}] ${[paper.authors?.replace(/\.$/, ''), paper.title, paper.venue, paper.year].filter(Boolean).join('. ')}${paper.key.startsWith('PMC') ? ` ${paper.key}` : ''}${paper.url ? ` ${paper.url}` : ''} · 来源：${paper.source === 'pubmed' ? 'PubMed' : 'Europe PMC'} · ${paper.basis === 'fulltext' ? '已读全文' : '仅摘要或待核对全文'}` }))];
  const methods: PlanBlocks = [{ type: 'heading', text: `Copilot 材料与方法概览（${date}）` }];
  if (inputs.method) methods.push({ type: 'text', text: `已确认方法：${inputs.method}` });
  if (inputs.sample) methods.push({ type: 'text', text: `样本与模型：${inputs.sample}` });
  const criteria: PlanBlocks = [{ type: 'heading', text: `Copilot 判定标准（${date}）` }];
  for (const item of design.items) for (const experiment of item.experiments) {
    methods.push({ type: 'heading', text: experiment.name }, { type: 'text', text: `方法：${experiment.approach || '待定'}` });
    if (experiment.note) methods.push({ type: 'text', text: `注意事项：${experiment.note}` });
    criteria.push({ type: 'heading', text: experiment.name }, ...(experiment.decisionCriteria?.length ? experiment.decisionCriteria : ['判定标准待研究者补充；不得据此直接宣称结合或因果作用。']).map(text => ({ type: 'text' as const, text })));
  }
  const sections: PlanSectionDraft[] = [
    { key: 'design', title: '设计', blocks: designBlocks },
    { key: 'material_methods', title: '材料与方法', blocks: methods },
    { key: 'acceptance_criteria', title: '验收标准', blocks: criteria },
    { key: 'constraints', title: '限制与待确认项', blocks: [{ type: 'heading', text: `Copilot 待确认项（${date}）` }, ...design.gaps.map(text => ({ type: 'text' as const, text }))] },
  ];
  const suggestions: Suggestion[] = [{ id: `${runId}-design`, kind: 'design', title: '将方案填入设计、材料与方法、验收标准和待确认项', status: 'pending', sections, blocks: designBlocks }];
  if (cited.length) suggestions.push({ id: `${runId}-references`, kind: 'references', title: `把引用的 ${cited.length} 篇文献写进“参考与工作笔记”`, status: 'pending', blocks: referenceBlocks });
  design.items.forEach(item => item.experiments.forEach((experiment, index) => suggestions.push({
    id: `${runId}-experiment-${item.subQuestionId}-${index}`, kind: 'experiment', title: `建成计划中的实验：${experiment.name}`, status: 'pending', experimentName: experiment.name,
    note: experiment.priority === 'must' ? '必做' : '可选', verified: experiment.verified,
    purpose: [`科学问题：${subQuestions.find(question => question.id === item.subQuestionId)?.question ?? item.subQuestionId}`, line(experiment),
      ...experiment.evidence.flatMap(key => { const paper = papers.find(candidate => candidate.key === key); return paper ? [`${key}：${paper.title}${paper.url ? ` ${paper.url}` : ''}`] : []; })].join('\n'),
  })));
  return suggestions;
}

/** The blocks added at the end of a section of the plan, with ids that say they came from this run. */
export function appendBlocks(document: ScientificDocument, sectionKey: string, blocks: { type: 'heading' | 'text'; text: string }[], runId: string): ScientificDocument {
  return {
    ...document,
    sections: document.sections.map(section => section.key !== sectionKey ? section : { ...section, blocks: [...section.blocks, ...blocks.map((block, index) => ({ id: `copilot-${runId}-${sectionKey}-${section.blocks.length + index}`, ...block }))] }),
  };
}
