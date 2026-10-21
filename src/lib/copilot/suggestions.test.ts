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
    expect(card?.kind === 'design' && card.blocks.map(block => block.text)).toEqual([
      'Copilot 实验设计（2026-10-20）', '先验证表型，再找通路。',
      'q1：A 基因是否促进增殖', '【必做】CCK-8 增殖；验证：看增殖是否变化；做法：CCK-8；读出：OD450；对照：空载体；依据：[1]',
      'q2：通过哪条通路', '【可选】Western 验证通路；做法：Western blot；依据：[2][1]；注意：抗体要验证（未核实：依据只来自摘要，请核对原文）',
      '文献没有覆盖、需要自己决定的地方', '动物模型要自己决定',
    ]);
  });

  it('lists only the papers the design cites, in citation order', () => {
    const card = suggestions.find(item => item.kind === 'references');
    expect(card?.kind === 'references' && card.blocks.map(block => block.text)).toEqual([
      '文献（Copilot 检索，Europe PMC，2026-10-20）',
      '[1] Li X, Wang Y. Gene A drives growth. Cancer Res. 2021 PMC1 https://europepmc.org/article/PMC/PMC1',
      '[2] Pathway B. 2019',
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
    expect(next.sections.find(section => section.key === 'design')!.blocks.map(block => [block.id, 'text' in block ? block.text : ''])).toEqual([['mine', '我写的'], ['copilot-run1-1', '标题'], ['copilot-run1-2', '正文']]);
    expect(document.sections.find(section => section.key === 'design')!.blocks).toHaveLength(1);
  });
});
