import { describe, expect, it } from 'vitest';
import { checkDesign, parseDesign, parseExtraction, parseSelection, parseSubQuestions, searchPrompt, splitPrompt } from './stages';
import type { Paper, PaperExtraction } from './types';
import { clampBudget, estimateModelCalls } from './types';

const paper = (key: string, openAccess = true): Paper => ({ key, title: `Paper ${key}`, year: '2020', openAccess });

describe('Splitting a research purpose', () => {
  it('reads the questions, keeps ids unique and fills a missing one', () => {
    const raw = '```json\n{"subQuestions":[{"id":"q1","question":"A 基因是否促进增殖","why":"CCK-8 升高","keywords":["gene A","proliferation"]},{"id":"q1","question":"A 通过哪条通路"},{"question":"敲低后能否回复"}]}\n```';
    const questions = parseSubQuestions(raw);
    expect(questions.map(question => question.id)).toEqual(['q1', 'q2', 'q3']);
    expect(questions[0]).toMatchObject({ why: 'CCK-8 升高', keywords: ['gene A', 'proliferation'] });
    expect(questions[1].keywords).toEqual([]);
  });

  it('refuses an answer that is not the shape asked for', () => {
    expect(() => parseSubQuestions('没有 JSON')).toThrow();
    expect(() => parseSubQuestions('{"subQuestions":[]}')).toThrow();
  });

  it('asks only for what the plan lacks when the run adjusts a plan that is already written', () => {
    expect(splitPrompt('补机制部分', { mode: 'adjust' }).task).toContain('调整一份已有的研究方案');
    expect(splitPrompt('补机制部分', { mode: 'new' }).task).not.toContain('调整一份已有的研究方案');
  });

  it('gives the model the purpose and the inputs, and tells it not to plan protocols', () => {
    const prompt = splitPrompt('验证 A 基因在食管癌中的作用', { sample: 'KYSE150 细胞' });
    expect(prompt.task).toContain('验证 A 基因在食管癌中的作用');
    expect(prompt.task).toContain('KYSE150 细胞');
    expect(prompt.system).toMatch(/不要规划实验规程/);
  });
});

describe('Picking papers and reading their experiments', () => {
  it('reads the picks with their reasons', () => {
    expect(parseSelection('{"selected":[{"ref":"r2","why":"同一细胞系","subQuestionIds":["q1"]},{"ref":"r5"}]}')).toEqual([{ ref: 'r2', why: '同一细胞系', subQuestionIds: ['q1'] }, { ref: 'r5', why: '', subQuestionIds: [] }]);
  });

  it('asks for at most the budget and for refs the tool returned', () => {
    const prompt = searchPrompt('目的', {}, [{ id: 'q1', question: '问题', why: '', keywords: ['gene A'] }], { maxPapers: 12, maxFullText: 4 });
    expect(prompt.system).toContain('最多选 12 篇');
    expect(prompt.task).toContain('q1. 问题（检索词：gene A）');
  });

  it('marks an experiment 未核实 when its quote is not in the paper, and drops ids of questions that do not exist', () => {
    const text = 'Cells were seeded in 96-well plates and cell viability was measured by CCK-8 assay at 24 h.';
    const raw = JSON.stringify({ experiments: [
      { name: 'CCK-8 增殖实验', subQuestionIds: ['q1', 'q9'], approach: 'CCK-8', readouts: ['OD450'], quote: 'viability was measured by CCK-8 assay' },
      { name: '划痕实验', subQuestionIds: ['q1'], quote: 'wound healing was assessed' },
      { name: '没有引文', subQuestionIds: [] },
    ] });
    const experiments = parseExtraction(raw, text, new Set(['q1', 'q2']));
    expect(experiments.map(item => [item.name, item.verified, item.problem])).toEqual([['CCK-8 增殖实验', true, undefined], ['划痕实验', false, '引文不在论文文本中'], ['没有引文', false, '没有引文']]);
    expect(experiments[0].subQuestionIds).toEqual(['q1']);
  });
});

describe('Checking a design against what was read', () => {
  const extractions: PaperExtraction[] = [
    { paperKey: 'PMC1', basis: 'fulltext', experiments: [{ name: 'CCK-8', subQuestionIds: ['q1'], approach: 'CCK-8', purpose: '', readouts: [], controls: [], sample: '', quote: 'x', verified: true }] },
    { paperKey: 'MED:2', basis: 'abstract', experiments: [{ name: 'Western', subQuestionIds: ['q1'], approach: 'Western', purpose: '', readouts: [], controls: [], sample: '', quote: 'y', verified: true }] },
    { paperKey: 'PMC3', basis: 'fulltext', experiments: [{ name: 'Wound', subQuestionIds: [], approach: '', purpose: '', readouts: [], controls: [], sample: '', quote: 'z', verified: false, problem: '引文不在论文文本中' }] },
  ];
  const papers = [paper('PMC1'), paper('MED:2', false), paper('PMC3')];
  const design = parseDesign(JSON.stringify({ summary: '概括', gaps: ['动物模型要自己决定'], items: [
    { subQuestionId: 'q1', experiments: [
      { name: 'CCK-8 增殖', priority: 'must', evidence: ['PMC1', 'PMC404'] },
      { name: 'Western 验证', priority: 'must', evidence: ['MED:2'] },
      { name: '划痕', priority: 'must', evidence: ['PMC3'] },
      { name: '凭空想的', priority: 'must', evidence: [] },
    ] },
    { subQuestionId: 'q9', experiments: [{ name: '多余', evidence: [] }] },
  ] }));

  it('does not use an unrelated experiment in the same paper or a different question as evidence', () => {
    const unrelated = parseDesign(JSON.stringify({ summary: '', gaps: [], items: [
      { subQuestionId: 'q1', experiments: [{ name: 'RNA sequencing', approach: 'RNA-seq', priority: 'must', evidence: ['PMC1'] }] },
      { subQuestionId: 'q2', experiments: [{ name: 'CCK-8', approach: 'CCK-8', priority: 'must', evidence: ['PMC1'] }] },
    ] }));
    const checked = checkDesign(unrelated, papers, extractions, new Set(['q1', 'q2']));
    expect(checked.items.flatMap(item => item.experiments).map(item => [item.verified, item.priority])).toEqual([[false, 'optional'], [false, 'optional']]);
  });

  it('trusts an experiment that rests on a verified full-text experiment, and says why the others are not', () => {
    const checked = checkDesign(design, papers, extractions, new Set(['q1']));
    expect(checked.items).toHaveLength(1);
    expect(checked.items[0].experiments.map(item => [item.name, item.priority, item.verified, item.problem, item.evidence])).toEqual([
      ['CCK-8 增殖', 'must', true, undefined, ['PMC1']],
      ['Western 验证', 'must', false, '依据只来自摘要，请核对原文', ['MED:2']],
      ['划痕', 'optional', false, '依据的论文里没有核实过的实验', ['PMC3']],
      ['凭空想的', 'optional', false, '没有文献依据', []],
    ]);
    expect(checked.gaps).toEqual(['动物模型要自己决定']);
  });
});

describe('What a run may spend', () => {
  it('keeps the budget inside the limits and estimates the model calls from it', () => {
    expect(clampBudget({ maxPapers: 99, maxFullText: 50 })).toEqual({ maxPapers: 20, maxFullText: 8 });
    expect(clampBudget({ maxPapers: 0, maxFullText: -3 })).toEqual({ maxPapers: 1, maxFullText: 0 });
    expect(clampBudget()).toEqual({ maxPapers: 20, maxFullText: 8 });
    expect(estimateModelCalls({ maxPapers: 20, maxFullText: 8 })).toBe(32);
  });
});
