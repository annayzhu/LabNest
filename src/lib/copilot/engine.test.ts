import { describe, expect, it } from 'vitest';
import type { ChatMessage, ChatTurn } from '../ai-chat';
import { runUnit, type EngineDeps } from './engine';
import { clampBudget, type CopilotRunView, type Paper } from './types';

const papers: Paper[] = [
  { key: 'PMC1', title: 'Gene A drives growth', year: '2021', openAccess: true, abstract: 'Gene A knockdown reduced growth.' },
  { key: 'MED:2', title: 'Pathway B in ESCC', year: '2019', openAccess: false, abstract: 'We examined pathway B.' },
];
const paperTexts: Record<string, string> = { PMC1: 'Cell viability was measured by CCK-8 assay after A knockdown.', 'MED:2': 'Pathway B in ESCC\n\nWe examined pathway B by Western blot.' };

function fakeDeps(options: { failPaper?: string } = {}) {
  const searches: string[] = [], completions: string[] = [];
  let chatCalls = 0;
  const deps: EngineDeps = {
    now: () => new Date('2026-10-20T08:00:00Z'),
    planContext: async () => JSON.stringify({ title: '食管癌 A 基因', objective: '验证 A 基因作用' }),
    searchPapers: async query => { searches.push(query); return papers; },
    paperText: async (paper, useFullText) => { if (paper.key === options.failPaper) throw new Error('Europe PMC is busy'); return { text: paperTexts[paper.key], basis: useFullText && paper.openAccess ? 'fulltext' : 'abstract' }; },
    complete: async (_system, user) => {
      completions.push(user);
      if (user.includes('论文：Gene A')) return { text: JSON.stringify({ experiments: [{ name: 'CCK-8 增殖实验', subQuestionIds: ['q1'], approach: 'CCK-8', readouts: ['OD450'], quote: 'viability was measured by CCK-8 assay' }] }), model: 'fake-model' };
      if (user.includes('论文：Pathway B')) return { text: JSON.stringify({ experiments: [{ name: 'Western 验证', subQuestionIds: ['q1'], approach: 'Western blot', quote: 'We examined pathway B by Western blot' }] }) };
      return { text: JSON.stringify({ summary: '先表型后通路', gaps: [], items: [{ subQuestionId: 'q1', experiments: [{ name: 'CCK-8 增殖', priority: 'must', evidence: ['PMC1'] }, { name: 'Western 通路', approach: 'Western blot', priority: 'must', evidence: ['MED:2'] }] }] }) };
    },
    chat: async (_system: string, messages: ChatMessage[], tools): Promise<ChatTurn> => {
      chatCalls += 1;
      const last = messages.at(-1);
      if (tools.some(tool => tool.name === 'read_plan_context')) {
        return last?.role === 'user' ? { text: '', toolCalls: [{ id: 'c1', name: 'read_plan_context', arguments: {} }] } : { text: JSON.stringify({ subQuestions: [{ id: 'q1', question: 'A 基因是否促进增殖', why: 'CCK-8', keywords: ['gene A', 'proliferation'] }] }), toolCalls: [], model: 'fake-model' };
      }
      return last?.role === 'user' ? { text: '', toolCalls: [{ id: 's1', name: 'search_papers', arguments: { query: 'gene A proliferation' } }] }
        : { text: JSON.stringify({ selected: [{ ref: 'r1', why: '同一问题', subQuestionIds: ['q1'] }, { ref: 'r2', why: '通路', subQuestionIds: ['q1', 'q9'] }, { ref: 'r99' }] }), toolCalls: [] };
    },
  };
  return { deps, searches, completions, chatCalls: () => chatCalls };
}

const start = (change: Partial<CopilotRunView> = {}): CopilotRunView => ({
  id: 'run1', researchPlanId: 'plan1', purpose: '验证 A 基因在食管癌中的作用', inputs: { sample: 'KYSE150' }, status: 'ready', stage: 'split', autoContinue: true, budget: clampBudget({ maxPapers: 5, maxFullText: 1 }),
  state: { done: [] }, log: [], suggestions: [], modelCalls: 0, createdAt: '2026-10-20T08:00:00Z', updatedAt: '2026-10-20T08:00:00Z', ...change,
});

async function runAll(run: CopilotRunView, deps: EngineDeps) {
  const stages: string[] = [];
  for (let step = 0; step < 30 && run.status !== 'done' && run.status !== 'paused'; step += 1) { run = await runUnit(run, deps); stages.push(run.stage); }
  return { run, stages };
}

describe('A Copilot run, step by step', () => {
  it('goes through the five stages: questions, papers, experiments read, a checked design, and suggestions', async () => {
    const { deps, searches } = fakeDeps();
    const { run } = await runAll(start(), deps);
    expect(run.status).toBe('done');
    expect(run.state.done).toEqual(['split', 'search', 'extract', 'design', 'write']);
    expect(run.state.subQuestions?.map(question => question.id)).toEqual(['q1']);
    expect(searches).toEqual(['gene A proliferation']);
    // Chosen by ref; an unknown ref is ignored and an unknown question id dropped.
    expect(run.state.papers?.map(paper => [paper.key, paper.subQuestionIds])).toEqual([['PMC1', ['q1']], ['MED:2', ['q1']]]);
    expect(run.state.extractions?.map(item => [item.paperKey, item.basis, item.experiments[0].verified])).toEqual([['PMC1', 'fulltext', true], ['MED:2', 'abstract', true]]);
    const experiments = run.state.design!.items[0].experiments;
    expect(experiments.map(item => [item.name, item.verified, item.problem])).toEqual([['CCK-8 增殖', true, undefined], ['Western 通路', false, '依据只来自摘要，请核对原文']]);
    expect(run.suggestions.map(item => item.kind)).toEqual(['design', 'references', 'experiment', 'experiment']);
    expect(run.suggestions.every(item => item.status === 'pending')).toBe(true);
    expect(run.model).toBe('fake-model');
  });

  it('reads one paper per step and the full text of only as many as the budget allows', async () => {
    const { deps } = fakeDeps();
    let run = start();
    const seen: string[] = [];
    for (let step = 0; step < 30 && run.status !== 'done'; step += 1) { run = await runUnit(run, deps); seen.push(`${run.stage}:${run.state.extractIndex ?? '-'}`); }
    // Entering the stage reads nothing; each step after it reads one paper; the last one moves on to the design.
    expect(seen.slice(seen.indexOf('extract:0'), seen.indexOf('design:2') + 1)).toEqual(['extract:0', 'extract:1', 'design:2']);
    expect(run.state.extractions?.filter(item => item.basis === 'fulltext')).toHaveLength(1);
  });

  it('stops after each stage when the author wants to look first, and goes on from the next stage', async () => {
    const { deps } = fakeDeps();
    let run = await runUnit(start({ autoContinue: false }), deps);
    expect(run).toMatchObject({ status: 'paused', stage: 'search' });
    run = await runUnit(run, deps);
    expect(run).toMatchObject({ status: 'paused', stage: 'extract' });
    expect(run.state.papers).toHaveLength(2);
  });

  it('keeps going when one paper cannot be read, and says so in the log', async () => {
    const { deps } = fakeDeps({ failPaper: 'MED:2' });
    const { run } = await runAll(start(), deps);
    expect(run.status).toBe('done');
    expect(run.state.extractions?.find(item => item.paperKey === 'MED:2')).toMatchObject({ experiments: [], error: 'Europe PMC is busy' });
    expect(run.log.some(event => event.kind === 'error' && /Paper 2 could not be read/.test(event.text))).toBe(true);
  });

  it('records what the agent did, counts the model calls and leaves the run it was given untouched', async () => {
    const { deps } = fakeDeps();
    const original = start();
    const next = await runUnit(original, deps);
    expect(original.log).toEqual([]);
    expect(original.modelCalls).toBe(0);
    expect(next.log.map(event => [event.kind, event.text])).toEqual([['stage', 'Splitting the purpose into questions'], ['tool', 'read_plan_context({})'], ['model', '1 questions'], ['stage', 'split finished']]);
    expect(next.modelCalls).toBe(2);
  });

  it('asks again once when an answer is not the JSON that was asked for', async () => {
    const { deps } = fakeDeps();
    let designCalls = 0;
    const complete = deps.complete;
    deps.complete = async (system, user) => { if (user.includes('文献里做过的实验')) { designCalls += 1; if (designCalls === 1) return { text: '好的，设计如下……' }; } return complete(system, user); };
    const { run } = await runAll(start(), deps);
    expect(designCalls).toBe(2);
    expect(run.status).toBe('done');
    expect(run.log.some(event => event.kind === 'note' && /asked again/.test(event.text))).toBe(true);
  });
});


describe('Copilot evidence gates', () => {
  it('stops at search when the literature service fails and preserves calls and errors', async () => {
    const { deps } = fakeDeps();
    deps.searchPapers = async () => { throw new Error('Both literature sources failed'); };
    const run = await runUnit(start({ stage: 'search', state: { done: ['split'] } }), deps);
    expect(run.status).toBe('failed');
    expect(run.stage).toBe('search');
    expect(run.state.done).toEqual(['split']);
    expect(run.modelCalls).toBe(1);
    expect(run.error).toContain('Both literature sources failed');
    expect(run.suggestions).toEqual([]);
  });
  it('does not call an empty successful search complete', async () => {
    const { deps } = fakeDeps();
    deps.searchPapers = async () => [];
    const run = await runUnit(start({ stage: 'search', state: { done: ['split'] } }), deps);
    expect(run.status).toBe('failed');
    expect(run.state.done).not.toContain('search');
  });
  it('does not generate a design without any verified source excerpt', async () => {
    const { deps, completions } = fakeDeps();
    const run = await runUnit(start({ stage: 'design', state: { done: ['split'], papers: [], extractions: [] } }), deps);
    expect(run.status).toBe('failed');
    expect(run.state.design).toBeUndefined();
    expect(completions).toEqual([]);
  });
});


it('always pauses for author confirmation before any search, including repeated advance requests', async () => {
  const { deps, searches } = fakeDeps();
  let calls = 0;
  deps.complete = async () => { calls++; return { text: JSON.stringify({ method: 'ligation blot，含义待确认', subject: 'SRGN 与候选分子待确认', sample: '待定', objective: '验证结合', questions: ['是否指 ligand blot？'] }) }; };
  const first = await runUnit(start({ stage: 'clarify' }), deps);
  const second = await runUnit(first, deps);
  expect(first.status).toBe('paused');
  expect(second.stage).toBe('clarify');
  expect(second.state.done).toEqual([]);
  expect(calls).toBe(1);
  expect(searches).toEqual([]);
});
it('keeps extract incomplete when every paper failed', async () => {
  const { deps } = fakeDeps();
  deps.paperText = async () => { throw new Error('unavailable'); };
  const run = await runUnit(start({ stage: 'extract', state: { done: ['split', 'search'], papers: [papers[0]], extractIndex: 0 } }), deps);
  expect(run.status).toBe('failed');
  expect(run.stage).toBe('extract');
  expect(run.state.done).not.toContain('extract');
  expect(run.state.extractions?.[0].error).toBe('unavailable');
});
