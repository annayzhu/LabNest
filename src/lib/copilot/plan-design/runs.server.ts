import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '../../db';
import { draftNewSchedule } from '../../experiment-schedule.server';
import { addDays, labDayKey, labInstant } from '../../experiment-schedule';
import { createExperimentWithProtocolSnapshotInTransaction } from '../../experiments';
import { reserveRecordCode } from '../../record-codes';
import { createScientificDocument, experimentSections, normalizeResearchPlanDocument } from '../../scientific-document';
import { gatherContext } from './context.server';
import { DESIGN_SPEC, MAX_DESIGN_LOG, type DesignEvent, type DesignRunView, type DesignState, type RunStatus, type RunStep } from './spec';
import { applyAction, designRules, runModelStep, signBlockers, type DesignAction, type DesignDeps } from './workflow';
import { applySections, buildSignOff, premiseFields, type PremiseField } from './write-back';

type Row = Prisma.ResearchPlanDesignRunGetPayload<Record<string, never>>;
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const STALE_MS = 10 * 60 * 1000;

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
export async function stepDesignRun(planId: string, runId: string, options: { blockId?: string }, prepare: (purpose: string) => Promise<{ deps: DesignDeps; provider: string; assertAllowed: () => Promise<void> }>) {
  const claimed = await prisma.researchPlanDesignRun.updateMany({
    where: { id: runId, researchPlanId: planId, OR: [{ status: { in: ['idle', 'failed'] } }, { status: 'working', updatedAt: { lt: new Date(Date.now() - STALE_MS) } }] },
    data: { status: 'working' },
  });
  if (claimed.count !== 1) throw new Error('A step is already running, or the design is signed');
  const before = designViewOf(await loadRow(planId, runId));
  try {
    const { deps, provider, assertAllowed } = await prepare(before.purpose);
    const after = await runModelStep(before, deps, options);
    await assertAllowed();
    return designViewOf(await prisma.researchPlanDesignRun.update({ where: { id: runId }, data: { status: after.status, stateJson: json(after.state), logJson: json(after.log.slice(-MAX_DESIGN_LOG)), provider, model: after.model ?? null, modelCalls: after.modelCalls, error: after.error ?? null } }));
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
    return designViewOf(await tx.researchPlanDesignRun.update({ where: { id: runId }, data: { step, stateJson: json(state), logJson: json(log.slice(-MAX_DESIGN_LOG)), status: 'idle', error: null } }));
  });
}

export async function removeDesignRun(planId: string, runId: string) {
  const row = await loadRow(planId, runId);
  if (row.status === 'working') throw new Error('A step is running; wait for it to finish');
  if (row.status === 'signed') throw new Error('A signed design stays as the record of what was written');
  await prisma.researchPlanDesignRun.delete({ where: { id: runId } });
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

export type SignChoices = { premise: PremiseField[]; keepPrevious: boolean; experiments: string[]; planSeen: string; runSeen: string };

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
    await tx.researchPlan.update({ where: { id: planId }, data: { ...premise, contentJson: json(applySections(document, signOff.sections, choices.keepPrevious)) } });

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
    const state: DesignState = { ...view.state, signed: { at: new Date().toISOString(), version: context.version, experimentIds, sections: signOff.sections.map(section => section.key) } };
    const log = [...view.log, { at: new Date().toISOString(), step: 'review' as const, kind: 'step' as const, text: `Signed as v${context.version}: ${experimentIds.length} planned experiments` }];
    await tx.researchPlanDesignRun.update({ where: { id: runId }, data: { step: 'signed', status: 'signed', signedAt: new Date(), stateJson: json(state), logJson: json(log.slice(-MAX_DESIGN_LOG)) } });
    // Activity entries print their fields as text: keep them flat.
    await tx.activityLog.create({ data: { action: 'research_plan_design_signed', targetType: 'research_plan', targetId: planId, metadataJson: { runId, version: context.version, experiments: experimentIds.length, premise: Object.keys(premise).join(','), keepPrevious: choices.keepPrevious } } });
    return { run: designViewOf(await tx.researchPlanDesignRun.findUniqueOrThrow({ where: { id: runId } })), experimentIds };
  }, { timeout: 30_000 });
}
