import type { ScientificDocument } from '../scientific-document';
import type { Design, DesignExperiment, Paper, SubQuestion, Suggestion } from './types';

/**
 * Stage 5: the design as changes the author may adopt: the design written into 设计, the papers cited into
 * 参考与工作笔记, and one card for each experiment that can become a planned Experiment. Nothing here writes anything.
 */
export function buildSuggestions(runId: string, design: Design, subQuestions: SubQuestion[], papers: Paper[], date: string): Suggestion[] {
  // Papers are numbered in the order the design first cites them.
  const cited: Paper[] = [];
  const numberOf = (key: string) => { const found = papers.find(paper => paper.key === key); if (!found) return undefined; if (!cited.includes(found)) cited.push(found); return cited.indexOf(found) + 1; };
  const line = (experiment: DesignExperiment) => {
    const refs = experiment.evidence.map(key => numberOf(key)).filter((number): number is number => number !== undefined).map(number => `[${number}]`).join('');
    const parts = [`${experiment.priority === 'must' ? '【必做】' : '【可选】'}${experiment.name}`, experiment.purpose && `验证：${experiment.purpose}`, experiment.approach && `做法：${experiment.approach}`,
      experiment.readouts.length && `读出：${experiment.readouts.join('、')}`, experiment.controls.length && `对照：${experiment.controls.join('、')}`, refs && `依据：${refs}`, experiment.note && `注意：${experiment.note}`].filter(Boolean);
    return `${parts.join('；')}${experiment.verified ? '' : `（未核实：${experiment.problem}）`}`;
  };
  const designBlocks: { type: 'heading' | 'text'; text: string }[] = [{ type: 'heading', text: `Copilot 实验设计（${date}）` }];
  if (design.summary) designBlocks.push({ type: 'text', text: design.summary });
  for (const item of design.items) {
    const question = subQuestions.find(q => q.id === item.subQuestionId);
    designBlocks.push({ type: 'heading', text: `${item.subQuestionId}：${question?.question ?? ''}` }, ...item.experiments.map(experiment => ({ type: 'text' as const, text: line(experiment) })));
  }
  if (design.gaps.length) designBlocks.push({ type: 'heading', text: '文献没有覆盖、需要自己决定的地方' }, ...design.gaps.map(gap => ({ type: 'text' as const, text: gap })));
  const referenceBlocks: { type: 'heading' | 'text'; text: string }[] = [{ type: 'heading', text: `文献（Copilot 检索，Europe PMC，${date}）` },
    ...cited.map((paper, index) => ({ type: 'text' as const, text: `[${index + 1}] ${[paper.authors?.replace(/\.$/, ''), paper.title, paper.venue, paper.year].filter(Boolean).join('. ')}${paper.key.startsWith('PMC') ? ` ${paper.key}` : ''}${paper.url ? ` ${paper.url}` : ''}` }))];
  const suggestions: Suggestion[] = [{ id: `${runId}-design`, kind: 'design', title: '把实验设计写进“设计”一节', status: 'pending', blocks: designBlocks }];
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
    sections: document.sections.map(section => section.key !== sectionKey ? section : { ...section, blocks: [...section.blocks, ...blocks.map((block, index) => ({ id: `copilot-${runId}-${section.blocks.length + index}`, ...block }))] }),
  };
}
