import { describe, expect, it } from 'vitest';
import { createScientificDocument, researchPlanSections } from '../../scientific-document';
import { emptyLedger, entryGaps, entryStatus, parseIdentifier, quoteIn, readingReader, type EvidenceEntry } from './evidence';
import { srgnCards, srgnChain, srgnContext, srgnHypotheses } from './fixtures';
import { parseCard, parseChain, parseHypotheses } from './prompts';
import { checkCards, checkHypotheses } from './rules';
import { planSampleSize, sampleSizeLine, withComputedN } from './sample-size';
import { reviewDimensions, stepsOf, type DesignCard, type DesignRunView } from './spec';
import { applyAction, changedSinceReview, readFoundPaper, runModelStep, signBlockers, type DesignDeps } from './workflow';
import { buildSignOff } from './write-back';

const now = new Date('2026-11-02T01:00:00.000Z');
const judged = reviewDimensions.map(key => ({ key, verdict: 'ok', note: '' }));
const card = (patch: Partial<DesignCard> = {}): DesignCard => ({ ...srgnCards[1], ...patch });
const sized = (sampleSize: Partial<DesignCard['sampleSize']>, patch: Partial<DesignCard> = {}) => card({ ...patch, sampleSize: { ...srgnCards[1].sampleSize, ...sampleSize } });

describe('sample size worked out by the program (Q305)', () => {
  it('computes n per group from the smallest effect worth finding, then the losses', () => {
    const plan = planSampleSize(sized({ basis: 'minimum_effect', difference: -30, sd: 15, attrition: 0.2 }));
    expect(plan.effect).toBe(2);
    expect(plan.analysed).toBe(6);
    expect(plan.enrolled).toBe(8);
    // statsmodels: d = 1.5 → 8.06, d = 2 → 5.09, d = 2.5 → 3.76 per group.
    expect(plan.sensitivity.map(item => [item.scale, item.n])).toEqual([[0.75, 9], [1, 6], [1.25, 4]]);
  });

  it('shares α across comparisons and looks at smaller effects for a pilot', () => {
    expect(planSampleSize(sized({ basis: 'minimum_effect', effect: 2, comparisons: 2 })).analysed).toBe(7);
    expect(planSampleSize(sized({ basis: 'pilot', effect: 2 })).sensitivity.map(item => item.scale)).toEqual([0.5, 0.75, 1]);
  });

  it('turns the planned replicates around into the smallest effect they detect', () => {
    const plan = planSampleSize(sized({ basis: 'convention', n: 3 }));
    expect(plan.analysed).toBeUndefined();
    expect(plan.detectable).toBeCloseTo(3.0709, 3);
    expect(sampleSizeLine(sized({ basis: 'convention', n: 3 }))).toContain('能发现的最小效应 d ≈ 3.07');
  });

  it('uses Cohen’s f for several groups and needs three of them', () => {
    const plan = planSampleSize(sized({ basis: 'minimum_effect', design: 'anova', difference: 30, sd: 15 }));
    expect(plan.effect).toBeCloseTo(2 / Math.sqrt(6), 10);
    expect(planSampleSize(sized({ basis: 'minimum_effect', design: 'anova', effect: 1 }, { groups: srgnCards[1].groups.slice(0, 2) })).missing).toBe('groups');
  });

  it('never keeps an n the model or the author typed for a computed basis', () => {
    expect(withComputedN(sized({ basis: 'minimum_effect', effect: 2, n: 3 })).sampleSize.n).toBe(6);
    expect(withComputedN(sized({ basis: 'minimum_effect', n: 3 })).sampleSize.n).toBeNull();
    expect(withComputedN(sized({ basis: 'pending', n: 4 })).sampleSize.n).toBeNull();
    expect(withComputedN(sized({ basis: 'convention', n: 4 })).sampleSize.n).toBe(4);
    const block = srgnChain.blocks[1];
    const parsed = parseCard(JSON.stringify({ ...srgnCards[1], sampleSize: { basis: 'minimum_effect', difference: 30, sd: 15, n: 2 } }), block, [], ['r2']);
    expect(parsed.sampleSize.n).toBe(6);
  });
});

describe('phase 2 rules', () => {
  it('ask for randomization, batches and every factor combination', () => {
    const findings = checkCards([card({ randomization: '', batch: '', factors: [{ name: 'siRNA', levels: ['NC', 'si-1', 'si-2'] }, { name: '药物', levels: ['溶剂', 'X'] }] })], srgnChain, 'standard');
    expect(findings.map(finding => finding.rule)).toEqual([13, 14, 15]);
    expect(findings[2].text).toContain('3 of the 6 combinations');
  });

  it('check the sample size against the calculation', () => {
    expect(checkCards([sized({ basis: 'minimum_effect' })], srgnChain, 'standard').map(finding => finding.rule)).toEqual([16]);
    expect(checkCards([withComputedN(sized({ basis: 'minimum_effect', difference: 30, sd: 15 }))], srgnChain, 'standard').map(finding => [finding.rule, finding.text])).toEqual([[17, 'Planned 3 biological replicates per group; the sample-size calculation needs 6']]);
  });

  it('tie each rival the author rules out to a control or a required block', () => {
    expect(checkCards(srgnCards, srgnChain, 'standard', srgnHypotheses)).toEqual([]);
    const withoutCck = srgnCards.map(item => ({ ...item, controls: item.controls.filter(control => !control.addresses.length) }));
    expect(checkCards(withoutCck, srgnChain, 'standard', srgnHypotheses).map(finding => [finding.key, finding.blockId])).toEqual([['r18:r2', '']]);
    expect(checkCards(withoutCck, srgnChain, 'standard', { ...srgnHypotheses, rivals: srgnHypotheses.rivals.map(rival => ({ ...rival, exclude: rival.id !== 'r2' })) })).toEqual([]);
  });

  it('check the prediction table without scoring it', () => {
    expect(checkHypotheses(srgnHypotheses, 'necessity')).toEqual([]);
    const broken = { ...srgnHypotheses, main: { ...srgnHypotheses.main, statement: 'SRGN 促进迁移', incompatible: '' }, rivals: [{ ...srgnHypotheses.rivals[0], ifRival: srgnHypotheses.rivals[0].ifMain, undecided: '' }] };
    expect(checkHypotheses(broken, 'association').map(finding => [finding.key, finding.severity])).toEqual([['h1', 'serious'], ['h5', 'important'], ['h7', 'minor'], ['h3:r1', 'important'], ['h4:r1', 'minor']]);
    expect(checkHypotheses({ ...srgnHypotheses, main: { ...srgnHypotheses.main, statement: 'SRGN 与 LRP1 直接结合' } }, 'interaction').map(finding => finding.key)).toEqual(['h6']);
  });
});

describe('the evidence ledger checks', () => {
  it('find a quote word for word, whatever its spacing, case or dashes', () => {
    const text = 'Knockdown of SRGN reduced the migration of ESCC cells — measured by Transwell — in KYSE150.';
    expect(quoteIn('knockdown of  SRGN reduced the migration of ESCC cells - measured', text)).toBe(true);
    expect(quoteIn('“Knockdown of SRGN reduced the migration…”', text)).toBe(true);
    expect(quoteIn('SRGN reduced invasion of ESCC cells', text)).toBe(false);
    expect(quoteIn('SRGN reduced', text)).toBe(false);
  });

  it('read identifiers as people paste them', () => {
    expect(parseIdentifier('PMID: 31234567')).toEqual({ kind: 'pmid', value: '31234567' });
    expect(parseIdentifier('https://pubmed.ncbi.nlm.nih.gov/31234567/')).toEqual({ kind: 'pmid', value: '31234567' });
    expect(parseIdentifier('https://doi.org/10.1038/s41586-020-2649-2.')).toEqual({ kind: 'doi', value: '10.1038/s41586-020-2649-2' });
    expect(parseIdentifier('pmc7096066')).toEqual({ kind: 'pmcid', value: 'PMC7096066' });
    expect(parseIdentifier('SRGN migration')).toBeUndefined();
  });

  it('count a paper only after all three checks', () => {
    const entry: EvidenceEntry = { id: 'e1', found: 'search', database: 'europe_pmc', title: 'P', exists: 'yes', retracted: false, quote: 'a quote long enough to count here', read: 'abstract', quoteFound: true, target: 'main', relation: 'subject', system: '', note: '', confirmed: false, checkedAt: now.toISOString() };
    expect([entryStatus(entry), entryGaps(entry)]).toEqual(['pending', ['Relation not confirmed']]);
    expect(entryStatus({ ...entry, confirmed: true })).toBe('verified');
    expect(entryStatus({ ...entry, confirmed: true, retracted: true })).toBe('retracted');
    expect(entryGaps({ ...entry, exists: 'no', quoteFound: false, confirmed: true })).toEqual(['Not found in Europe PMC or PubMed', 'The quote is not in the text word for word']);
  });

  it('ask again once when the quote is not in the text, then keep it marked not found', () => {
    const text = 'We found that SRGN knockdown reduced migration of KYSE150 cells in Transwell assays.';
    const answer = (quote: string) => JSON.stringify({ relevant: true, target: 'main', relation: 'subject', quote, system: 'KYSE150', note: '' });
    const read = readingReader(text, ['main', 'r1']);
    expect(() => read(answer('SRGN knockdown inhibited cell invasion strongly'))).toThrow(/word for word/);
    expect(read(answer('SRGN knockdown inhibited cell invasion strongly'))).toMatchObject({ quoteFound: false });
    expect(readingReader(text, ['main'])(answer('SRGN knockdown reduced migration of KYSE150 cells'))).toMatchObject({ quoteFound: true, target: 'main' });
    expect(readingReader(text, ['main'])(JSON.stringify({ relevant: true, target: 'r9', relation: 'background', quote: 'SRGN knockdown reduced migration of KYSE150 cells' }))).toMatchObject({ target: 'background' });
    expect(readingReader(text, ['main'])(JSON.stringify({ relevant: false }))).toMatchObject({ quoteFound: false, quote: '' });
  });
});

/** A v2 run driven by a model that answers each prompt with the SRGN fixtures. */
function fakeDeps(review: object = { verdict: 'ready', supports: '必要性，仅限 KYSE150', strengths: ['两条 siRNA'], dimensions: judged, findings: [] }) {
  const sent: string[] = [];
  const answer = async (system: string, user: string) => {
    sent.push(system);
    if (system.includes('情境卡”。')) return { text: JSON.stringify(srgnContext), model: 'fake' };
    if (system.includes('假设与预测')) return { text: JSON.stringify({ ...srgnHypotheses, rivals: srgnHypotheses.rivals.map(rival => ({ ...rival, id: 'x' })) }), model: 'fake' };
    if (system.includes('现在做“证据链”')) return { text: JSON.stringify({ ...srgnChain, alternatives: [{ text: '模型自己改的对立解释' }], blocks: srgnChain.blocks.map(block => block.id === 'phenotype' ? { ...block, addresses: ['r1', 'r7'] } : block) }), model: 'fake' };
    if (system.includes('写“设计卡”')) { const id = /"id":"([a-z-]+)"/.exec(user.split('现在要写的实验块：')[1])![1]; return { text: JSON.stringify(srgnCards.find(item => item.blockId === id)), model: 'fake' }; }
    if (system.includes('证据账本读一篇论文')) return { text: JSON.stringify({ relevant: true, target: 'r1', relation: 'method', quote: 'two independent siRNAs gave the same phenotype', system: 'HeLa', note: '' }), model: 'fake' };
    return { text: JSON.stringify(review), model: 'reviewer' };
  };
  const deps: DesignDeps = { now: () => now, complete: answer, review: { complete: answer, provider: 'Reviewer', selfReview: false }, protocols: [] };
  return { deps, sent };
}
const start = (): DesignRunView => ({ id: 'run2', researchPlanId: 'plan1', spec: 'plan-design-v2', purpose: 'SRGN 敲低是否抑制 KYSE150 迁移', step: 'context', status: 'idle', state: { gathered: [] }, log: [], modelCalls: 0, createdAt: now.toISOString(), updatedAt: now.toISOString() });

async function throughReview() {
  const { deps, sent } = fakeDeps();
  let run = start();
  const act = (action: Parameters<typeof applyAction>[1]) => { run = { ...run, ...applyAction(run, action, now) }; return run; };
  run = await runModelStep(run, deps); act({ kind: 'confirm' });
  run = await runModelStep(run, deps);
  run = await runModelStep(run, deps); act({ kind: 'confirm' });
  run = await runModelStep(run, deps); act({ kind: 'confirm' });
  run = await runModelStep(run, deps); run = await runModelStep(run, deps); act({ kind: 'confirm' });
  run = await runModelStep(run, deps);
  return { get: () => run, set: (next: DesignRunView) => { run = next; }, act, deps, sent };
}

describe('the v2 workflow', () => {
  it('adds the hypotheses step; v1 runs keep their four steps', () => {
    expect(stepsOf('plan-design-v2')).toEqual(['context', 'hypotheses', 'chain', 'cards', 'review']);
    expect(stepsOf('plan-design-v1')).toEqual(['context', 'chain', 'cards', 'review']);
  });

  it('numbers the rivals itself and refuses to confirm without a result against the main hypothesis', async () => {
    const { deps } = fakeDeps();
    let run = await runModelStep(start(), deps);
    run = { ...run, ...applyAction(run, { kind: 'confirm' }, now) };
    expect(run.step).toBe('hypotheses');
    run = await runModelStep(run, deps);
    expect(run.state.hypotheses?.draft?.rivals.map(rival => rival.id)).toEqual(['r1', 'r2']);
    const without = applyAction(run, { kind: 'hypotheses', hypotheses: { ...run.state.hypotheses!.draft, main: { ...srgnHypotheses.main, incompatible: '' } } }, now);
    expect(() => applyAction({ ...run, ...without }, { kind: 'confirm' }, now)).toThrow(/count against the main hypothesis/);
    expect(applyAction(run, { kind: 'confirm' }, now).step).toBe('chain');
  });

  it('builds the chain on the confirmed rivals, whatever the model wrote', async () => {
    const flow = await throughReview();
    const chain = flow.get().state.chain!.draft!;
    expect(chain.alternatives).toEqual([{ id: 'r1', text: 'siRNA 脱靶', exclude: true }, { id: 'r2', text: '增殖差异混杂迁移', exclude: true }]);
    expect(chain.hypothesis).toBe(srgnHypotheses.main.statement);
    expect(chain.blocks.find(block => block.id === 'phenotype')?.addresses).toEqual(['r1']);
    expect(flow.sent.find(system => system.includes('现在做“证据链”'))).toContain('addresses');
    expect(parseChain(JSON.stringify(srgnChain)).alternatives[0].id).toBe('r1');
  });

  it('binds the review to what it read: an edit and its undo, a confirmed paper', async () => {
    const flow = await throughReview();
    let run = flow.get();
    const round = run.state.review!.rounds[0];
    expect(round.seen).toMatchObject({ context: expect.any(String), hypotheses: expect.any(String), 'card:phenotype': expect.any(String), evidence: expect.any(String) });
    expect([round.supports, round.strengths]).toEqual(['必要性，仅限 KYSE150', ['两条 siRNA']]);
    expect(signBlockers(run.state)).toEqual([]);
    const phenotype = run.state.cards!.items[1];
    run = flow.act({ kind: 'card', card: { ...phenotype, blinding: '' } });
    expect(changedSinceReview(run.state)).toEqual(['Transwell 迁移']);
    run = flow.act({ kind: 'card', card: phenotype });
    expect(changedSinceReview(run.state)).toEqual([]);
    // A paper the author confirms after the round is something the review did not read.
    const ledger = { ...emptyLedger(), found: [{ key: 'MED:1', database: 'europe_pmc' as const, title: 'Two siRNAs', openAccess: false, retracted: false, status: 'new' as const }] };
    flow.set({ ...run, state: { ...run.state, evidence: ledger } });
    run = await readFoundPaper(flow.get(), flow.deps, 'MED:1', { text: 'In HeLa cells, two independent siRNAs gave the same phenotype in every assay.', read: 'abstract' });
    expect(run.state.evidence!.entries[0]).toMatchObject({ id: 'e1', target: 'r1', relation: 'method', quoteFound: true, confirmed: false, exists: 'yes' });
    expect(changedSinceReview(run.state)).toEqual([]);
    flow.set(run);
    run = flow.act({ kind: 'evidence', entryId: 'e1', patch: { confirmed: true } });
    expect(changedSinceReview(run.state)).toEqual(['Evidence ledger']);
    expect(signBlockers(run.state)).toEqual(['Changed after review round 1, review again: Evidence ledger']);
  });

  it('reopening the hypotheses reopens everything after them', async () => {
    const flow = await throughReview();
    const reopened = flow.act({ kind: 'reopen', step: 'hypotheses' });
    expect(reopened.step).toBe('hypotheses');
    expect([reopened.state.hypotheses?.confirmedAt, reopened.state.chain?.confirmedAt, reopened.state.review, reopened.state.cards?.confirmedAt]).toEqual([undefined, undefined, undefined, undefined]);
    expect(() => applyAction(reopened, { kind: 'evidence', entryId: 'e9', patch: { confirmed: true } }, now)).toThrow(/not in the ledger/);
  });

  it('writes the prediction table, the sample size and only verified papers into the plan', async () => {
    const flow = await throughReview();
    const run = flow.get();
    const entry = (patch: Partial<EvidenceEntry>): EvidenceEntry => ({ id: 'e1', found: 'author', database: 'europe_pmc', pmid: '111', title: 'Two siRNAs', year: '2020', exists: 'yes', retracted: false, quote: 'two independent siRNAs gave the same phenotype', read: 'abstract', quoteFound: true, target: 'phenotype', relation: 'method', system: 'HeLa', note: '', confirmed: true, checkedAt: now.toISOString(), ...patch });
    const state = { ...run.state, evidence: { ...emptyLedger(), entries: [entry({}), entry({ id: 'e2', title: 'Unchecked', pmid: '222', quoteFound: false })], searches: [{ at: now.toISOString(), database: 'europe_pmc' as const, query: 'SRGN migration KYSE150', results: 0 }] } };
    const signOff = buildSignOff(state, { objective: null, hypothesis: null, rationale: null, document: createScientificDocument(researchPlanSections) }, { runId: 'run2', version: 1, date: '2026-11-02', purpose: run.purpose, drafting: 'Fake', rules: [], protocols: new Map() });
    const text = JSON.stringify(signOff.sections);
    expect(text).toContain('区分性预测');
    expect(text).toContain('依据：Two siRNAs（2020） PMID 111（已核实）');
    expect(text).toContain('样本量：需要预实验');
    expect(text).toContain('[方法依据·Transwell 迁移] Two siRNAs');
    expect(text).toContain('待核实（未写入依据）');
    expect(text).toContain('Unchecked（2020） PMID 222：引文没有逐字出现在原文里');
    expect(text).toContain('在记录的检索范围内未找到');
    expect(text).toContain('审查认为这份设计最多能支持：必要性，仅限 KYSE150');
    expect(signOff.premise.find(change => change.field === 'hypothesis')?.after).toBe(srgnHypotheses.main.statement);
    expect(parseHypotheses(JSON.stringify(srgnHypotheses)).rivals.map(rival => rival.id)).toEqual(['r1', 'r2']);
  });
});
