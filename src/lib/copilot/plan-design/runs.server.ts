import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '../../db';
import { draftNewSchedule } from '../../experiment-schedule.server';
import { addDays, labDayKey, labInstant } from '../../experiment-schedule';
import { createExperimentWithProtocolSnapshotInTransaction } from '../../experiments';
import { reserveRecordCode } from '../../record-codes';
import { createScientificDocument, experimentSections, normalizeResearchPlanDocument } from '../../scientific-document';
import { keepAttachment } from '../../attachment-files';
import { adoptedAs, decideSuggestion, recordSuggestions, ignoreOpen, type NewSuggestion } from '../suggestions.server';
import { gatherContext } from './context.server';
import type { PreparedStep } from './deps.server';
import { emptyLedger, paperKey, parseIdentifier, quoteIn, trimQuote, type EvidenceEntry, type EvidenceSearch, type Relation } from './evidence';
import { evidenceText, lookupEvidence, pdfText, searchEvidence } from './evidence.server';
import { DESIGN_SPEC, MAX_DESIGN_LOG, type DesignEvent, type DesignRunView, type DesignState, type RunStatus, type RunStep } from './spec';
import { applyAction, designRules, draftSearchTerms, fullTextsLeft, ledgerOpen, ledgerTargets, nextEntryId, readFoundPaper, runModelStep, signBlockers, type DesignAction } from './workflow';
import { applySections, buildSignOff, premiseFields, type PremiseField } from './write-back';

type Row = Prisma.ResearchPlanDesignRunGetPayload<Record<string, never>>;
type Db = Prisma.TransactionClient | typeof prisma;
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const STALE_MS = 10 * 60 * 1000;
const runTarget = (runId: string) => ({ targetType: 'research_plan_design_run', targetId: runId });

export function designViewOf(row: Row): DesignRunView {
  return {
    id: row.id, researchPlanId: row.researchPlanId, spec: row.spec, purpose: row.purpose, step: row.step as RunStep, status: row.status as RunStatus,
    state: (row.stateJson ?? {}) as DesignState, log: Array.isArray(row.logJson) ? row.logJson as unknown as DesignEvent[] : [],
    provider: row.provider ?? undefined, model: row.model ?? undefined, modelCalls: row.modelCalls, error: row.error ?? undefined,
    signedAt: row.signedAt?.toISOString(), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listDesignRuns(planId: string) {
  return (await prisma.researchPlanDesignRun.findMany({ where: { researchPlanId: planId }, orderBy: { createdAt: 'desc' }, take: 10 })).map(designViewOf);
}

async function loadRow(planId: string, runId: string) {
  const row = await prisma.researchPlanDesignRun.findFirst({ where: { id: runId, researchPlanId: planId } });
  if (!row) throw new Error('Design run not found');
  return row;
}

const checkPurpose = (purpose: string) => {
  const text = purpose.trim();
  if (text.length < 4) throw new Error('Write the research purpose first');
  if (text.length > 1500) throw new Error('The research purpose is too long (1500 characters at most)');
  return text;
};

/** A new design, its LabNest context already gathered. Nothing leaves the machine until the author drafts the card. */
export async function createDesignRun(planId: string, rawPurpose: string) {
  const purpose = checkPurpose(rawPurpose);
  if (await prisma.researchPlanDesignRun.count({ where: { researchPlanId: planId, status: { in: ['idle', 'working', 'failed'] } } })) throw new Error('This plan already has a design in progress: finish or remove it first');
  const gathered = await gatherContext(planId, purpose);
  return designViewOf(await prisma.researchPlanDesignRun.create({ data: { researchPlanId: planId, spec: DESIGN_SPEC, purpose, stateJson: json({ gathered }), logJson: json([{ at: new Date().toISOString(), step: 'context', kind: 'step', text: `Gathered ${gathered.length} LabNest records` }]) } }));
}

/** A draft plan named from the purpose, in the project, with a design started on it: "new plan with the Copilot". */
export async function createPlanWithDesign(input: { projectId: string; purpose: string }) {
  const purpose = checkPurpose(input.purpose);
  const plan = await prisma.$transaction(async tx => {
    if (!await tx.project.findFirst({ where: { id: input.projectId, status: { not: 'archived' } }, select: { id: true } })) throw new Error('Choose a project for the plan');
    const code = await reserveRecordCode(tx, 'researchPlan');
    const sentence = purpose.split(/[。！？!?\n]|\.(?=\s|$)/)[0].trim();
    const created = await tx.researchPlan.create({ data: { projectId: input.projectId, code, title: sentence.length > 60 ? `${sentence.slice(0, 60)}…` : sentence, objective: purpose, status: 'draft' } });
    await tx.activityLog.create({ data: { action: 'create', targetType: 'research_plan', targetId: created.id, metadataJson: { code, via: 'design_workbench' } } });
    return created;
  });
  return { planId: plan.id, run: await createDesignRun(plan.id, purpose) };
}

/**
 * One model step. The run is claimed first (a step already running cannot start twice), the model is waited on outside
 * any transaction, and the result is kept only if the AI settings did not change meanwhile.
 */
export async function stepDesignRun(planId: string, runId: string, options: { blockId?: string }, prepare: (purpose: string) => Promise<PreparedStep>) {
  const claimed = await prisma.researchPlanDesignRun.updateMany({
    where: { id: runId, researchPlanId: planId, OR: [{ status: { in: ['idle', 'failed'] } }, { status: 'working', updatedAt: { lt: new Date(Date.now() - STALE_MS) } }] },
    data: { status: 'working' },
  });
  if (claimed.count !== 1) throw new Error('A step is already running, or the design is signed');
  const before = designViewOf(await loadRow(planId, runId));
  try {
    const prepared = await prepare(before.purpose);
    const after = await runModelStep(before, prepared.deps, options);
    await prepared.assertAllowed();
    return designViewOf(await prisma.$transaction(async tx => {
      const row = await tx.researchPlanDesignRun.update({ where: { id: runId }, data: { status: after.status, stateJson: json(after.state), logJson: json(after.log.slice(-MAX_DESIGN_LOG)), provider: prepared.provider, model: after.model ?? null, modelCalls: after.modelCalls, error: after.error ?? null } });
      if (after.status === 'idle') {
        // A new review round replaces the last one, findings and all.
        if ((after.state.review?.rounds.length ?? 0) > (before.state.review?.rounds.length ?? 0)) await ignoreOpen(tx, { ...runTarget(runId), kind: 'review_finding' }, 'regenerated');
        await recordSuggestions(tx, stepSuggestions(before, after, prepared));
      }
      return row;
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 400) : 'The step failed';
    return designViewOf(await prisma.researchPlanDesignRun.update({ where: { id: runId }, data: { status: 'failed', error: message, logJson: json([...before.log, { at: new Date().toISOString(), step: before.step, kind: 'error', text: message }].slice(-MAX_DESIGN_LOG)) } }));
  }
}

/** An author's change or confirmation. `seen` is the run's updatedAt the page read, so two tabs cannot overwrite each other. */
export async function actOnDesignRun(planId: string, runId: string, action: DesignAction, seen?: string) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "ResearchPlanDesignRun" WHERE id=${runId} FOR UPDATE`;
    const row = await tx.researchPlanDesignRun.findFirst({ where: { id: runId, researchPlanId: planId } });
    if (!row) throw new Error('Design run not found');
    if (row.status === 'working') throw new Error('A step is running; wait for it to finish');
    if (seen && row.updatedAt.toISOString() !== seen) throw new Error('The design was changed elsewhere; reload it');
    const view = designViewOf(row);
    const { step, state } = applyAction(view, action, new Date());
    const log = step !== view.step ? [...view.log, { at: new Date().toISOString(), step: view.step, kind: 'step' as const, text: action.kind === 'reopen' ? `Reopened ${step}` : `${view.step} confirmed` }] : view.log;
    await noteDecision(tx, view, action, state);
    return designViewOf(await tx.researchPlanDesignRun.update({ where: { id: runId }, data: { step, stateJson: json(state), logJson: json(log.slice(-MAX_DESIGN_LOG)), status: 'idle', error: null } }));
  });
}

export async function removeDesignRun(planId: string, runId: string) {
  const row = await loadRow(planId, runId);
  if (row.status === 'working') throw new Error('A step is running; wait for it to finish');
  if (row.status === 'signed') throw new Error('A signed design stays as the record of what was written');
  await prisma.$transaction(async tx => {
    await ignoreOpen(tx, runTarget(runId), 'other', 'The design was removed');
    await tx.researchPlanDesignRun.delete({ where: { id: runId } });
  });
}

/** What a model step proposed (Q336): the context card, the hypotheses, the chain, the card it drafted, or the new round's findings. */
function stepSuggestions(before: DesignRunView, after: DesignRunView, prepared: PreparedStep): NewSuggestion[] {
  const state = after.state;
  const drafted = (kind: string, subject: string, specId: NewSuggestion['specId'], proposed: unknown): NewSuggestion => ({
    ...runTarget(after.id), kind, subject, specId, proposed, requestKey: `design:${after.id}:${kind}:${subject}:${after.modelCalls}`,
    providerId: prepared.providerIds.drafting, provider: prepared.provider, model: after.model,
  });
  if (before.step === 'context' && state.context) return [drafted('context_card', 'context', 'plan-design.context', state.context.card)];
  if (before.step === 'hypotheses' && state.hypotheses?.draft) return [drafted('hypotheses', 'hypotheses', 'plan-design.hypotheses', state.hypotheses.draft)];
  if (before.step === 'chain' && state.chain?.draft) return [drafted('evidence_chain', 'chain', 'plan-design.chain', { ...state.chain.draft, tier: state.chain.tier })];
  if (before.step === 'cards') {
    const card = state.cards?.items.find(item => state.cards?.edited?.[item.blockId] !== before.state.cards?.edited?.[item.blockId]);
    return card ? [drafted('design_card', card.blockId, 'plan-design.card', card)] : [];
  }
  const round = state.review?.rounds.at(-1);
  if (before.step !== 'review' || !round || (state.review?.rounds.length ?? 0) === (before.state.review?.rounds.length ?? 0)) return [];
  return round.findings.map(finding => ({ ...runTarget(after.id), kind: 'review_finding', subject: finding.id, specId: 'plan-design.review', proposed: finding,
    requestKey: `design:${after.id}:review_finding:${finding.id}`, providerId: prepared.providerIds.review, provider: round.provider, model: round.model }));
}

/** What an author's action says about those suggestions (Q334): an edit, an adoption at confirm, a finding fixed or waived. */
async function noteDecision(db: Db, view: DesignRunView, action: DesignAction, next: DesignState) {
  const about = (kind: string, subject: string) => ({ ...runTarget(view.id), kind, subject });
  if (action.kind === 'context') return decideSuggestion(db, about('context_card', 'context'), { status: 'edited' });
  if (action.kind === 'hypotheses') return decideSuggestion(db, about('hypotheses', 'hypotheses'), { status: 'edited' });
  if (action.kind === 'evidence-remove') return decideSuggestion(db, about('evidence_entry', action.entryId), { status: 'ignored', reason: 'wrong', note: 'Removed from the ledger' });
  if (action.kind === 'evidence') {
    const entry = next.evidence?.entries.find(item => item.id === action.entryId);
    if (!entry || action.patch.confirmed === undefined) return entry ? decideSuggestion(db, about('evidence_entry', entry.id), { status: 'edited' }) : undefined;
    return decideSuggestion(db, about('evidence_entry', entry.id), action.patch.confirmed ? adoptedAs(evidenceProposal(entry)) : { status: 'pending' });
  }
  if (action.kind === 'chain') return decideSuggestion(db, about('evidence_chain', 'chain'), { status: 'edited' });
  if (action.kind === 'card') {
    for (const [blockId, at] of Object.entries(next.cards?.edited ?? {})) if (at !== view.state.cards?.edited?.[blockId]) await decideSuggestion(db, about('design_card', blockId), { status: 'edited' });
    return;
  }
  if (action.kind === 'finding') return decideSuggestion(db, about('review_finding', action.findingId),
    action.status === 'resolved' ? { status: 'adopted' } : action.status === 'waived' ? { status: 'ignored', reason: 'not_needed', note: action.reason } : { status: 'pending' });
  if (action.kind !== 'confirm') return;
  if (view.step === 'context' && next.context) return decideSuggestion(db, about('context_card', 'context'), adoptedAs(next.context.card, ['states', 'questions']));
  if (view.step === 'hypotheses' && next.hypotheses?.draft) return decideSuggestion(db, about('hypotheses', 'hypotheses'), adoptedAs(next.hypotheses.draft, ['drift']));
  if (view.step === 'chain' && next.chain?.draft) return decideSuggestion(db, about('evidence_chain', 'chain'), adoptedAs({ ...next.chain.draft, tier: next.chain.tier }, ['drift']));
  if (view.step === 'cards') for (const card of next.cards?.items ?? []) await decideSuggestion(db, about('design_card', card.blockId), adoptedAs(card, ['confirmed', 'drift']));
}

/** What the model proposed about a paper, as the suggestion keeps it: adopting compares the author's version with this. */
const evidenceProposal = (entry: Pick<EvidenceEntry, 'target' | 'relation' | 'quote' | 'system' | 'note'>) => ({ target: entry.target, relation: entry.relation, quote: entry.quote, system: entry.system, note: entry.note });

export type EvidenceRequest =
  | { kind: 'terms' }
  | { kind: 'search' }
  | { kind: 'read'; key: string }
  | { kind: 'add'; identifier: string; quote: string; target: string; relation: Relation; system: string; pdf?: File }
  | { kind: 'quote'; entryId: string; quote: string };

/**
 * A request on the evidence ledger that needs a model or the outside databases: drafting search terms, searching,
 * reading one result, adding a paper by its identifier (with a PDF if the author has one), or checking an edited
 * quote again. The run is claimed while it works, like a model step; what was searched is kept even when it failed.
 */
export async function evidenceDesignRun(planId: string, runId: string, request: EvidenceRequest, prepare: (purpose: string) => Promise<PreparedStep>) {
  const before = designViewOf(await loadRow(planId, runId));
  if (!ledgerOpen(before)) throw new Error('The evidence ledger opens with the hypotheses');
  const claimed = await prisma.researchPlanDesignRun.updateMany({
    where: { id: runId, researchPlanId: planId, OR: [{ status: { in: ['idle', 'failed'] } }, { status: 'working', updatedAt: { lt: new Date(Date.now() - STALE_MS) } }] },
    data: { status: 'working' },
  });
  if (claimed.count !== 1) throw new Error('A step is already running, or the design is signed');
  const now = new Date();
  const save = (after: DesignRunView, extra: { provider?: string; suggestions?: NewSuggestion[]; decided?: { entryId: string } } = {}) => prisma.$transaction(async tx => {
    const row = await tx.researchPlanDesignRun.update({ where: { id: runId }, data: { status: after.status, stateJson: json(after.state), logJson: json(after.log.slice(-MAX_DESIGN_LOG)), model: after.model ?? null, modelCalls: after.modelCalls, error: after.error ?? null, ...(extra.provider ? { provider: extra.provider } : {}) } });
    if (extra.suggestions?.length) await recordSuggestions(tx, extra.suggestions);
    if (extra.decided) await decideSuggestion(tx, { ...runTarget(runId), kind: 'evidence_entry', subject: extra.decided.entryId }, { status: 'edited' });
    return designViewOf(row);
  });
  const log = (run: DesignRunView, kind: DesignEvent['kind'], text: string) => run.log.push({ at: now.toISOString(), step: run.step, kind, text });
  const fail = (run: DesignRunView, error: unknown) => {
    run.status = 'failed';
    run.error = (error instanceof Error ? error.message : 'The request did not finish; try again').slice(0, 500);
    log(run, 'error', run.error);
    return save(run);
  };
  const run = structuredClone(before);
  run.error = undefined;
  const ledger = run.state.evidence ??= emptyLedger();
  try {
    if (request.kind === 'terms' || request.kind === 'read') {
      const prepared = await prepare(before.purpose);
      if (request.kind === 'terms') {
        const after = await draftSearchTerms(before, prepared.deps);
        await prepared.assertAllowed();
        return save(after, { provider: prepared.provider });
      }
      const paper = ledger.found.find(item => item.key === request.key);
      if (!paper) throw new Error('This paper is not in the search results');
      const source = await evidenceText(runId, paper, paper.openAccess && fullTextsLeft(ledger) > 0);
      const after = await readFoundPaper(before, prepared.deps, request.key, source);
      await prepared.assertAllowed();
      const added = after.state.evidence?.entries.find(entry => !ledger.entries.some(old => old.id === entry.id));
      return save(after, { provider: prepared.provider, suggestions: added ? [{
        ...runTarget(runId), kind: 'evidence_entry', subject: added.id, specId: 'plan-design.evidence', proposed: evidenceProposal(added), checks: { quoteFound: added.quoteFound, read: added.read, retracted: added.retracted },
        requestKey: `design:${runId}:evidence_entry:${added.id}:${after.modelCalls}`, providerId: prepared.providerIds.drafting, provider: prepared.provider, model: added.model,
      }] : [] });
    }
    if (request.kind === 'search') {
      if (!ledger.queries.length) throw new Error('Write or draft the search terms first');
      try {
        const result = await searchEvidence(runId, ledger.queries, now, new Set([...ledger.entries.map(paperKey), ...ledger.found.filter(paper => paper.status !== 'new').map(paper => paper.key)]));
        ledger.searches.push(...result.searches);
        ledger.found = [...result.papers, ...ledger.found.filter(paper => paper.status === 'new' && !result.papers.some(item => item.key === paper.key))].slice(0, 16);
        log(run, 'note', `Searched ${ledger.queries.length} terms: ${result.papers.length} new papers`);
      } catch (error) {
        ledger.searches.push(...((error as { searches?: EvidenceSearch[] }).searches ?? []));
        throw error;
      }
      run.status = 'idle';
      return save(run);
    }
    if (request.kind === 'add') {
      const id = parseIdentifier(request.identifier);
      if (!id) throw new Error('Give a PMID, PMCID or DOI');
      if (!ledgerTargets(run.state).includes(request.target)) throw new Error('Choose what the paper bears on');
      const { paper, database } = await lookupEvidence(runId, id);
      const attachmentId = request.pdf ? await keepAttachment(request.pdf, { ...runTarget(runId), linkType: 'evidence_pdf' }) : undefined;
      const quote = trimQuote(request.quote);
      const checked = await checkQuote(runId, quote, { attachmentId, abstract: paper?.abstract, paper: paper && { key: paper.key, title: paper.title, abstract: paper.abstract, openAccess: paper.openAccess } });
      const entry: EvidenceEntry = {
        id: nextEntryId(ledger), found: 'author', database: paper ? database : '', title: paper?.title ?? `${id.kind.toUpperCase()} ${id.value}`,
        pmid: paper?.pmid ?? (id.kind === 'pmid' ? id.value : undefined), pmcid: paper?.pmcid ?? (id.kind === 'pmcid' ? id.value : undefined), doi: paper?.doi ?? (id.kind === 'doi' ? id.value : undefined),
        authors: paper?.authors, year: paper?.year, venue: paper?.venue, url: paper?.url, exists: paper ? 'yes' : 'no', retracted: Boolean(paper?.retracted),
        quote, read: checked.read, quoteFound: checked.found, target: request.target, relation: request.relation, system: request.system.trim().slice(0, 300), note: '',
        // The author stated what it bears on and how: that is the third check.
        confirmed: true, checkedAt: now.toISOString(), attachmentId,
      };
      ledger.entries.push(entry);
      log(run, 'note', `Added ${entry.title.slice(0, 80)}: ${paper ? (entry.retracted ? 'retracted' : 'found') : 'not found'}${quote ? `, quote ${checked.found ? 'found' : 'not found'}` : ''}`);
      run.status = 'idle';
      return save(run);
    }
    const entry = ledger.entries.find(item => item.id === request.entryId);
    if (!entry) throw new Error('This paper is not in the ledger');
    const paper = ledger.found.find(item => item.key === paperKey(entry));
    const lookup = !entry.attachmentId && !paper?.abstract && entry.exists === 'yes' ? (await lookupEvidence(runId, entry.pmid ? { kind: 'pmid', value: entry.pmid } : entry.pmcid ? { kind: 'pmcid', value: entry.pmcid } : { kind: 'doi', value: entry.doi ?? '' })).paper : undefined;
    const known = paper ?? lookup;
    const checked = await checkQuote(runId, trimQuote(request.quote), { attachmentId: entry.attachmentId, abstract: known?.abstract, paper: known && { key: known.key, title: known.title, abstract: known.abstract, openAccess: known.openAccess } });
    Object.assign(entry, { quote: trimQuote(request.quote), quoteFound: checked.found, read: checked.read || entry.read });
    log(run, 'note', `Quote of ${entry.title.slice(0, 80)} checked again: ${checked.found ? 'found' : 'not found'}`);
    run.status = 'idle';
    return save(run, { decided: { entryId: entry.id } });
  } catch (error) {
    return fail(run, error);
  }
}

/** Where a quote is looked for: the author's PDF, then the abstract, then an open-access full text. */
async function checkQuote(runId: string, quote: string, from: { attachmentId?: string; abstract?: string; paper?: { key: string; title: string; abstract?: string; openAccess: boolean } }): Promise<{ found: boolean; read: EvidenceEntry['read'] }> {
  if (!quote) return { found: false, read: '' };
  if (from.attachmentId) return { found: quoteIn(quote, await pdfText(from.attachmentId)), read: 'pdf' };
  if (from.abstract && quoteIn(quote, from.abstract)) return { found: true, read: 'abstract' };
  if (from.paper?.openAccess) {
    const full = await evidenceText(runId, from.paper, true).catch(() => undefined);
    if (full?.read === 'fulltext') return { found: quoteIn(quote, full.text), read: 'fulltext' };
  }
  return { found: false, read: from.abstract ? 'abstract' : '' };
}

async function signContext(tx: Prisma.TransactionClient | typeof prisma, view: DesignRunView) {
  const ids = (view.state.cards?.items ?? []).map(card => card.protocol.id).filter(Boolean);
  const protocols = await tx.protocol.findMany({ where: { id: { in: ids } }, select: { id: true, humanCode: true, title: true, canonicalTitle: true } });
  const version = await tx.researchPlanDesignRun.count({ where: { researchPlanId: view.researchPlanId, status: 'signed' } }) + 1;
  return { runId: view.id, version, date: labDayKey(new Date()), purpose: view.purpose, drafting: `${view.provider ?? 'the default service'}${view.model ? `（${view.model}）` : ''}`, rules: designRules(view.state),
    protocols: new Map(protocols.map(row => [row.id, { code: row.humanCode, title: row.canonicalTitle ?? row.title }])) };
}

/** What signing would write, for the author to look at first, and what still stops it. */
export async function previewSignOff(planId: string, runId: string) {
  const view = designViewOf(await loadRow(planId, runId));
  if (view.step !== 'review') throw new Error('Finish the design cards and run the review first');
  const plan = await prisma.researchPlan.findUniqueOrThrow({ where: { id: planId } });
  const context = await signContext(prisma, view);
  return { blockers: signBlockers(view.state), version: context.version, planSeen: plan.updatedAt.toISOString(), runSeen: view.updatedAt,
    ...buildSignOff(view.state, { ...plan, document: normalizeResearchPlanDocument(plan.contentJson, plan.design) }, context) };
}

export type SignChoices = { premise: PremiseField[]; sections: string[]; keepPrevious: boolean; experiments: string[]; planSeen: string; runSeen: string };

/**
 * Sign the design (Q309, Q310) in one transaction: the premise fields the author ticked, the design written into the
 * plan's sections (replacing an earlier signed design's blocks unless both are kept), one planned experiment per chosen
 * required block with its Protocol, groups and a first schedule, and the run marked signed with its version.
 */
export async function signDesignRun(planId: string, runId: string, choices: SignChoices) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "ResearchPlan" WHERE id=${planId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM "ResearchPlanDesignRun" WHERE id=${runId} FOR UPDATE`;
    const row = await tx.researchPlanDesignRun.findFirst({ where: { id: runId, researchPlanId: planId } });
    if (!row) throw new Error('Design run not found');
    const view = designViewOf(row);
    if (view.step !== 'review' || view.status === 'working') throw new Error('This design cannot be signed now');
    const plan = await tx.researchPlan.findUniqueOrThrow({ where: { id: planId } });
    if (plan.updatedAt.toISOString() !== choices.planSeen || view.updatedAt !== choices.runSeen) throw new Error('The plan or the design changed since the preview; look at it again');
    const blockers = signBlockers(view.state);
    if (blockers.length) throw new Error(blockers[0]);
    const context = await signContext(tx, view);
    const document = normalizeResearchPlanDocument(plan.contentJson, plan.design);
    const signOff = buildSignOff(view.state, { ...plan, document }, context);
    const premise = Object.fromEntries(signOff.premise.filter(change => choices.premise.includes(change.field) && premiseFields.includes(change.field)).map(change => [change.field, change.after]));
    // Only the sections the author ticked are written (§14.2, adoption by field).
    const sections = signOff.sections.filter(section => choices.sections.includes(section.key));
    await tx.researchPlan.update({ where: { id: planId }, data: { ...premise, contentJson: json(applySections(document, sections, choices.keepPrevious)) } });

    const created = new Map<string, { id: string; end?: string }>();
    const firstMorning = labInstant(addDays(labDayKey(new Date()), 1), 9 * 60);
    for (const draft of signOff.experiments.filter(item => choices.experiments.includes(item.blockId))) {
      const ends = draft.dependsOn.map(dep => created.get(dep)?.end).filter((end): end is string => Boolean(end));
      const start = ends.length ? ends.sort().at(-1)! : firstMorning;
      const content = createScientificDocument(experimentSections);
      content.sections = content.sections.map(section => section.key === 'background' ? { ...section, blocks: draft.background } : section);
      const base = { researchPlanId: planId, title: draft.title, date: new Date(`${labDayKey(start)}T00:00:00.000Z`), status: 'planned' as const, recordStatus: 'draft' as const, purpose: draft.purpose, tags: ['设计工作台'], contentJson: json(content), customSteps: [] };
      let experiment: { id: string };
      let protocolNote = draft.protocolNeeded ? `需要规程：${draft.protocolNeeded}` : undefined;
      const version = draft.protocolId ? await tx.protocolVersion.findFirst({ where: { protocolId: draft.protocolId }, orderBy: { revision: 'desc' }, select: { id: true } }) : null;
      try {
        experiment = await createExperimentWithProtocolSnapshotInTransaction(tx, { ...base, methodMode: version ? 'protocol' : 'custom', protocolVersionIds: version ? [version.id] : [] });
      } catch (error) {
        // The Protocol's checks run before anything is written, so the experiment can still be made without it.
        if (!version) throw error;
        protocolNote = `规程需要先整理：${error instanceof Error ? error.message.slice(0, 200) : ''}`;
        experiment = await createExperimentWithProtocolSnapshotInTransaction(tx, { ...base, methodMode: 'custom', protocolVersionIds: [] });
      }
      if (protocolNote) await tx.experiment.update({ where: { id: experiment.id }, data: { purpose: `${draft.purpose}\n${protocolNote}` } });
      if (draft.groups.length) await tx.experimentSampleGroup.createMany({ data: draft.groups.map((label, index) => ({ experimentId: experiment.id, label, sortOrder: index })) });
      created.set(draft.blockId, { id: experiment.id, end: await draftNewSchedule(tx, experiment.id, start) });
    }
    const experimentIds = [...created.values()].map(item => item.id);
    const state: DesignState = { ...view.state, signed: { at: new Date().toISOString(), version: context.version, experimentIds, sections: sections.map(section => section.key) } };
    const log = [...view.log, { at: new Date().toISOString(), step: 'review' as const, kind: 'step' as const, text: `Signed as v${context.version}: ${experimentIds.length} planned experiments` }];
    await tx.researchPlanDesignRun.update({ where: { id: runId }, data: { step: 'signed', status: 'signed', signedAt: new Date(), stateJson: json(state), logJson: json(log.slice(-MAX_DESIGN_LOG)) } });
    // Activity entries print their fields as text: keep them flat.
    await tx.activityLog.create({ data: { action: 'research_plan_design_signed', targetType: 'research_plan', targetId: planId, metadataJson: { runId, version: context.version, experiments: experimentIds.length, premise: Object.keys(premise).join(','), sections: sections.map(section => section.key).join(','), keepPrevious: choices.keepPrevious } } });
    return { run: designViewOf(await tx.researchPlanDesignRun.findUniqueOrThrow({ where: { id: runId } })), experimentIds };
  }, { timeout: 30_000 });
}
