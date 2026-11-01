import { describe, expect, it } from 'vitest';
import { createScientificDocument, researchPlanSections } from '../scientific-document';
import { appendBlocks, buildSuggestions } from './suggestions';
import type { Design, Paper, SubQuestion } from './types';

const subQuestions: SubQuestion[] = [{ id: 'q1', question: 'A 基因是否促进增殖', why: '', keywords: [] }, { id: 'q2', question: '通过哪条通路', why: '', keywords: [] }];
const papers: Paper[] = [
  { key: 'PMC1', title: 'Gene A drives growth', authors: 'Li X, Wang Y', year: '2021', venue: 'Cancer Res', url: 'https://europepmc.org/article/PMC/PMC1', openAccess: true },
  { key: 'MED:2', title: 'Pathway B', year: '2019', openAccess: false },
  { key: 'PMC9', title: 'Never cited', openAccess: true },
];
const design: Design = { summary: '先验证表型，再找通路。', gaps: ['动物模型要自己决定'], items: [
  { subQuestionId: 'q1', experiments: [{ name: 'CCK-8 增殖', purpose: '看增殖是否变化', approach: 'CCK-8', readouts: ['OD450'], controls: ['空载体'], priority: 'must', evidence: ['PMC1'], note: '', verified: true }] },
  { subQuestionId: 'q2', experiments: [{ name: 'Western 验证通路', purpose: '', approach: 'Western blot', readouts: [], controls: [], priority: 'optional', evidence: ['MED:2', 'PMC1'], note: '抗体要验证', verified: false, problem: '依据只来自摘要，请核对原文' }] },
] };

describe('A design as suggestions', () => {
  const suggestions = buildSuggestions('run1', design, subQuestions, papers, '2026-10-20');

  it('keeps the question, evidence and unverified label in the experiment purpose', () => {
    const suggestion = buildSuggestions('run1', design, subQuestions, papers, '2026-10-21').find(item => item.kind === 'experiment' && !item.verified);
    expect(suggestion?.kind).toBe('experiment');
    if (suggestion?.kind !== 'experiment') throw new Error('Missing experiment suggestion');
    expect(suggestion.purpose).toContain('未核实');
    expect(suggestion.purpose).toContain('MED:2');
    expect(suggestion.purpose).toContain('通过哪条通路');
  });

  it('writes the design under each sub-question, cites papers by number and flags what is 未核实', () => {
    const card = suggestions.find(item => item.kind === 'design');
    if (card?.kind !== 'design') throw new Error('Missing design');
    expect(card.sections?.map(section => section.key)).toEqual(['design', 'material_methods', 'acceptance_criteria', 'constraints']);
    const text = card.blocks.map(block => block.text).join('\n');
    expect(text).toContain('q1：A 基因是否促进增殖');
    expect(text).toContain('目的：看增殖是否变化');
    expect(text).toContain('读出：OD450');
    expect(text).toContain('对照：空载体');
    expect(text).toContain('来源：[1]');
    expect(text).toContain('证据限制：依据只来自摘要，请核对原文');
    expect(card.sections?.find(section => section.key === 'acceptance_criteria')?.blocks.map(block => block.text).join('')).toContain('待研究者补充');
  });

  it('lists only the papers the design cites, in citation order', () => {
    const card = suggestions.find(item => item.kind === 'references');
    expect(card?.kind === 'references' && card.blocks.map(block => block.text)).toEqual([
      '文献（Copilot 检索，2026-10-20）',
      '[1] Li X, Wang Y. Gene A drives growth. Cancer Res. 2021 PMC1 https://europepmc.org/article/PMC/PMC1 · 来源：Europe PMC · 仅摘要或待核对全文',
      '[2] Pathway B. 2019 · 来源：Europe PMC · 仅摘要或待核对全文',
    ]);
  });

  it('offers one card per experiment, all pending, saying whether it was verified', () => {
    const experiments = suggestions.filter(item => item.kind === 'experiment');
    expect(experiments.map(item => item.kind === 'experiment' && [item.experimentName, item.note, item.verified])).toEqual([['CCK-8 增殖', '必做', true], ['Western 验证通路', '可选', false]]);
    expect(suggestions.every(item => item.status === 'pending')).toBe(true);
  });
});

describe('Adopting a design into the plan', () => {
  it('adds the blocks at the end of the section, after what is already there, with ids from the run', () => {
    const document = createScientificDocument(researchPlanSections);
    document.sections.find(section => section.key === 'design')!.blocks.push({ id: 'mine', type: 'text', text: '我写的' });
    const next = appendBlocks(document, 'design', [{ type: 'heading', text: '标题' }, { type: 'text', text: '正文' }], 'run1');
    expect(next.sections.find(section => section.key === 'design')!.blocks.map(block => [block.id, 'text' in block ? block.text : ''])).toEqual([['mine', '我写的'], ['copilot-run1-design-1', '标题'], ['copilot-run1-design-2', '正文']]);
    expect(document.sections.find(section => section.key === 'design')!.blocks).toHaveLength(1);
  });
});


it('fills all proposed sections without changing existing content or media and with globally distinct ids', () => {
  const document = createScientificDocument(researchPlanSections);
  document.sections[0].blocks.push({ id: 'original', type: 'text', text: '原始内容' });
  const card = buildSuggestions('run', design, subQuestions, papers, '2026-11-01')[0];
  if (card.kind !== 'design') throw new Error('Missing design');
  let after = document;
  for (const section of card.sections!) after = appendBlocks(after, section.key, section.blocks, 'run');
  expect(after.sections[0].blocks[0]).toEqual(document.sections[0].blocks[0]);
  expect(after.sections.slice(0, 4).every(section => section.blocks.length > 0)).toBe(true);
  const ids = after.sections.flatMap(section => section.blocks.map(block => block.id));
  expect(new Set(ids).size).toBe(ids.length);
  expect(document.sections[1].blocks).toEqual([]);
});


it('fills confirmed sample and method literally, retaining unresolved material type', () => {
  const card = buildSuggestions('run', design, subQuestions, papers, '2026-11-01', { method: 'Ligand blot / far-Western', sample: 'KYSE150 或 KYSE410；蛋白类型待定', subject: 'SRGN 与候选分子', objective: '验证结合' })[0];
  if (card.kind !== 'design') throw new Error('Missing design');
  expect(card.sections?.find(section => section.key === 'material_methods')?.blocks.map(block => block.text)).toContain('样本与模型：KYSE150 或 KYSE410；蛋白类型待定');
  expect(card.blocks.map(block => block.text)).toContain('已确认目标：验证结合');
});
