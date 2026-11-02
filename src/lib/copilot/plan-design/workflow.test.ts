import { describe, expect, it } from 'vitest';
import { createScientificDocument, researchPlanSections } from '../../scientific-document';
import { brokenCards, srgnCards, srgnChain, srgnContext } from './fixtures';
import type { DesignRunView } from './spec';
import { applyAction, runModelStep, signBlockers, type DesignDeps } from './workflow';
import { applySections, buildSignOff, DESIGN_BLOCK_PREFIX } from './write-back';

const now = new Date('2026-11-02T01:00:00.000Z');
const fresh = (): DesignRunView => ({
  id: 'run1', researchPlanId: 'plan1', spec: 'plan-design-v1', purpose: '研究 SRGN 敲低是否抑制 KYSE150 迁移', step: 'context', status: 'idle',
  state: { gathered: [{ id: 'inventory-1', kind: 'inventory', label: 'KYSE150', detail: '细胞系 · 在库 3 份', included: true }, { id: 'result-1', kind: 'result', label: '旧结果', detail: '', included: false }] },
  log: [], modelCalls: 0, createdAt: now.toISOString(), updatedAt: now.toISOString(),
});

/** A model that answers each step with the fixtures, and records what it was sent. */
function fakeModel(review = { verdict: 'revise', dimensions: [{ key: 'controls', verdict: 'concern', note: '' }], findings: [{ severity: 'critical', dimension: 'overclaiming', blockId: 'phenotype', field: 'criteria', problem: '迁移下降可能来自增殖', suggestion: '加增殖对照' }] }) {
  const sent: { system: string; user: string }[] = [];
  const answer = (system: string, user: string) => {
    sent.push({ system, user });
    if (system.includes('情境卡”。')) return { text: JSON.stringify({ ...srgnContext, constraints: '', questions: ['迁移用 Transwell 还是划痕？'] }), model: 'fake-1' };
    if (system.includes('设计卡')) { const id = /"id":"([a-z-]+)"/.exec(user.split('现在要写的实验块：')[1])![1]; return { text: JSON.stringify(srgnCards.find(card => card.blockId === id)), model: 'fake-1' }; }
    if (system.includes('现在做“证据链”')) return { text: JSON.stringify(srgnChain), model: 'fake-1' };
    return { text: `审查如下：${JSON.stringify(review)}`, model: 'reviewer-1' };
  };
  const deps: DesignDeps = { now: () => now, complete: async (system, user) => answer(system, user), review: { complete: async (system, user) => answer(system, user), provider: 'Reviewer', selfReview: false }, protocols: [{ id: 'p1', code: 'PRT-001', title: 'Transwell 迁移' }] };
  return { sent, deps };
}

async function throughCards() {
  const { sent, deps } = fakeModel();
  let run = await runModelStep(fresh(), deps);
  const act = (action: Parameters<typeof applyAction>[1]) => { const next = applyAction(run, action, now); run = { ...run, ...next }; };
  act({ kind: 'confirm' });
  run = await runModelStep(run, deps);
  act({ kind: 'confirm' });
  run = await runModelStep(run, deps);
  run = await runModelStep(run, deps);
  return { run, act: (action: Parameters<typeof applyAction>[1]) => { act(action); return run; }, sent, deps, get: () => run };
}

describe('the design workflow', () => {
  it('sends only the records the author left ticked, and marks what the model filled', async () => {
    const { sent, deps } = fakeModel();
    const run = await runModelStep(fresh(), deps);
    expect(sent[0].user).toContain('KYSE150');
    expect(sent[0].user).not.toContain('旧结果');
    expect(run.state.context?.card.states).toMatchObject({ question: 'ai', constraints: 'pending' });
    expect(run.state.context?.card.questions).toEqual(['迁移用 Transwell 还是划痕？']);
    expect(() => applyAction(run, { kind: 'reopen', step: 'context' }, now)).toThrow();
  });

  it('marks an author edit as confirmed and refuses to confirm without the required fields', async () => {
    const { deps } = fakeModel();
    const run = await runModelStep(fresh(), deps);
    const edited = applyAction(run, { kind: 'context', card: { ...run.state.context!.card, subject: 'SRGN（serglycin）', question: '' } }, now);
    expect(edited.state.context!.card.states).toMatchObject({ subject: 'confirmed', question: 'pending', modelSystem: 'ai' });
    expect(() => applyAction({ ...run, ...edited }, { kind: 'confirm' }, now)).toThrow(/question/);
    const confirmed = applyAction(run, { kind: 'confirm' }, now);
    expect(confirmed.step).toBe('chain');
    expect(confirmed.state.chain?.templateId).toBe('knockdown');
    expect(confirmed.state.context!.card.states.modelSystem).toBe('confirmed');
  });

  it('drafts one card per required block, and the chain prompt carries the template', async () => {
    const { run, sent } = await throughCards();
    expect(sent.find(item => item.system.includes('证据链'))!.user).toContain('基因功能（敲低） v1');
    expect(run.state.chain?.tier).toBe('standard');
    expect(run.state.cards!.items.map(card => card.blockId)).toEqual(['kd-check', 'phenotype']);
    expect(run.modelCalls).toBe(4);
    expect(run.state.cards!.items[1].protocol).toMatchObject({ needed: false });
  });

  it('allows at most five required blocks at the chosen tier', async () => {
    const { deps } = fakeModel();
    let run = await runModelStep(fresh(), deps);
    run = { ...run, ...applyAction(run, { kind: 'confirm' }, now) };
    run = await runModelStep(run, deps);
    const six = { ...srgnChain, blocks: Array.from({ length: 6 }, (_, index) => ({ ...srgnChain.blocks[0], id: `b${index}`, dependsOn: [] })) };
    const changed = { ...run, ...applyAction(run, { kind: 'chain', chain: six, tier: 'standard' }, now) };
    expect(() => applyAction(changed, { kind: 'confirm' }, now)).toThrow(/At most 5/);
  });

  it('blocks sign-off on a critical review finding until the card changes or the author waives it', async () => {
    const flow = await throughCards();
    flow.act({ kind: 'confirm' });
    expect(signBlockers(flow.get().state)).toEqual(['Run the review']);
    let run = await runModelStep(flow.get(), flow.deps);
    const round = run.state.review!.rounds[0];
    expect(round).toMatchObject({ provider: 'Reviewer', model: 'reviewer-1', selfReview: false, verdict: 'revise' });
    expect(signBlockers(run.state)).toEqual(['Critical review finding: 迁移下降可能来自增殖']);
    expect(() => applyAction(run, { kind: 'finding', findingId: '1-1', status: 'resolved' }, now)).toThrow(/Change the design card/);
    expect(() => applyAction(run, { kind: 'finding', findingId: '1-1', status: 'waived' }, now)).toThrow(/why/);
    const later = new Date(now.getTime() + 60_000);
    run = { ...run, ...applyAction(run, { kind: 'card', card: { ...run.state.cards!.items[1], readouts: [...run.state.cards!.items[1].readouts, { name: '增殖', method: 'CCK-8', timepoint: '24 h', assay: 'viability' }] } }, later) };
    run = { ...run, ...applyAction(run, { kind: 'finding', findingId: '1-1', status: 'resolved' }, later) };
    expect(signBlockers(run.state)).toEqual([]);
  });

  it('counts serious rule findings as blockers, and stops after two review rounds', async () => {
    const flow = await throughCards();
    flow.act({ kind: 'confirm' });
    let run = flow.get();
    run = { ...run, ...applyAction(run, { kind: 'card', card: brokenCards.noNc[0] }, now) };
    const deps = fakeModel({ verdict: 'ready', dimensions: [], findings: [] }).deps;
    run = await runModelStep(run, deps);
    expect(signBlockers(run.state)).toEqual(['Rule 1: No concurrent negative control: add one run alongside the treated groups']);
    run = { ...run, ...applyAction(run, { kind: 'waive', key: 'r1:kd-check', reason: 'NC 在同一板的迁移实验里' }, now) };
    expect(signBlockers(run.state)).toEqual([]);
    run = await runModelStep(run, deps);
    expect((await runModelStep(run, deps)).error).toMatch(/Two review rounds/);
  });
});

describe('signing', () => {
  it('fills the premise, writes five sections, and replaces an earlier signed design', async () => {
    const flow = await throughCards();
    flow.act({ kind: 'confirm' });
    const run = await runModelStep(flow.get(), fakeModel({ verdict: 'ready', dimensions: [], findings: [{ severity: 'minor', dimension: 'feasibility', blockId: '', field: '', problem: '时间紧', suggestion: '' }] }).deps);
    const document = createScientificDocument(researchPlanSections);
    document.sections[0].blocks.push({ id: `${DESIGN_BLOCK_PREFIX}old-design-1`, type: 'text', text: '旧设计' }, { id: 'mine', type: 'text', text: '作者写的' });
    const signOff = buildSignOff(run.state, { objective: run.purpose, hypothesis: '我自己的假设', rationale: null, document }, { runId: 'run1', version: 2, date: '2026-11-02', purpose: run.purpose, drafting: 'Fake', rules: [], protocols: new Map([['p1', { code: 'PRT-001', title: 'Transwell 迁移' }]]) });
    expect(signOff.premise.map(change => [change.field, change.apply])).toEqual([['objective', true], ['hypothesis', false], ['rationale', true]]);
    expect(signOff.sections.map(section => [section.key, section.replaced])).toEqual([['design', 1], ['material_methods', 0], ['acceptance_criteria', 0], ['constraints', 0], ['references', 0]]);
    expect(signOff.experiments.map(item => [item.blockId, item.groups, item.dependsOn])).toEqual([['kd-check', ['NC', 'si-1', 'si-2'], []], ['phenotype', ['NC', 'si-1', 'si-2'], ['kd-check']]]);
    expect(signOff.optional).toEqual(['拯救实验']);
    const text = JSON.stringify(signOff.sections);
    expect(text).toContain('常规做法，未经文献核对');
    expect(text).toContain('[次要·可行性] 时间紧');
    const written = applySections(document, signOff.sections, false);
    expect(written.sections[0].blocks.map(block => block.id)).not.toContain(`${DESIGN_BLOCK_PREFIX}old-design-1`);
    expect(written.sections[0].blocks.map(block => block.id)).toContain('mine');
    expect(applySections(document, signOff.sections, true).sections[0].blocks.map(block => block.id)).toContain(`${DESIGN_BLOCK_PREFIX}old-design-1`);
  });
});
