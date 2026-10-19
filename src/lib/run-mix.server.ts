import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from './db';
import { assertRecordEditable } from './record-lifecycle';
import { mixState, stepMixes, structuredRunView, type ExecutionPlan, type StructuredRunView } from './structured-run';
import { mixView, type ProtocolMix } from './protocol-mix';
import { prefixedClientId } from './client-mutation-id';

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

/** Every mix write takes the same Experiment lock as step, timer and selection writes. */
async function withRun<T>(experimentId: string, work: (tx: Prisma.TransactionClient, context: { experiment: Awaited<ReturnType<typeof load>>; view: StructuredRunView }) => Promise<T>) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Experiment" WHERE id=${experimentId} FOR UPDATE`;
    const experiment = await load(tx, experimentId);
    if (['archived', 'completed'].includes(experiment.status)) throw new Error('This run has ended; its mix cards can no longer change');
    assertRecordEditable(experiment.recordStatus);
    if (!experiment.protocolRun) throw new Error('This experiment has no execution plan');
    return work(tx, { experiment, view: structuredRunView(experiment.protocolSnapshotJson, experiment.protocolRun.executionPlanJson, experiment.steps) });
  });
}
const load = (tx: Prisma.TransactionClient, id: string) => tx.experiment.findUniqueOrThrow({ where: { id }, include: { protocolRun: true, steps: true } });
const savePlan = (tx: Prisma.TransactionClient, experimentId: string, plan: ExecutionPlan) => tx.protocolRun.update({ where: { experimentId }, data: { executionPlanJson: json(plan) } });

const confirmInput = z.object({ experimentId: z.string().min(1), stepId: z.string().min(1), mixId: z.string().min(1), expectedRevision: z.number().int().nonnegative(), quantity: z.number().positive().max(1_000_000), quantitySource: z.enum(['run', 'card']), fingerprint: z.string().min(1) });
/** Confirm a mix card as the bench sees it: the server recomputes it and refuses if anything moved since. */
export async function confirmRunMix(raw: z.input<typeof confirmInput>) {
  const input = confirmInput.parse(raw);
  return withRun(input.experimentId, async (tx, { experiment, view }) => {
    if (view.plan.revision !== input.expectedRevision) throw new Error('Execution plan changed; reload before confirming');
    const step = view.steps[input.stepId], source = experiment.steps.find(item => item.id === input.stepId);
    if (!step || !source) throw new Error('This step is not part of this run');
    if (source.completed) throw new Error('The step is complete; its mix cards no longer change');
    if (step.blocked) throw new Error('Confirm the systems and this step’s parameters first');
    const mix = stepMixes(view, input.stepId).find(item => item.id === input.mixId);
    if (!mix) throw new Error('The mix card does not belong to this step');
    const state = mixState(view, input.stepId, mix);
    if (input.quantitySource === 'run' && state.runQuantity !== input.quantity) throw new Error('The run quantity changed; reload and check');
    const live = mixView(mix, state.version?.document.systems, state.version?.parameters ?? {}, input.quantity);
    if (!live.ready) throw new Error('The mix card still has undetermined amounts');
    if (live.fingerprint !== input.fingerprint) throw new Error('The mix card’s values changed; check them and confirm again');
    const now = new Date().toISOString();
    const receipt = { fingerprint: live.fingerprint, quantity: input.quantity, quantitySource: input.quantitySource, overagePercent: mix.overagePercent, aliquot: live.aliquot, confirmedAt: now,
      lines: live.lines.map(line => ({ id: line.id, name: line.name, mode: line.mode, unit: line.unit, perReaction: line.perReaction!, total: line.total! })) };
    // New totals start the crossing-off afresh.
    const key = `${input.stepId}:${mix.id}`;
    const mixStrikes = Object.fromEntries(Object.entries(view.plan.mixStrikes).filter(([other]) => other !== key));
    await savePlan(tx, input.experimentId, { ...view.plan, revision: view.plan.revision + 1, mixes: { ...view.plan.mixes, [key]: receipt }, mixStrikes });
    await tx.experimentStepEvent.create({ data: { experimentId: input.experimentId, experimentStepId: input.stepId, eventType: 'mix_confirmed', payloadJson: json({ mixId: mix.id, title: mix.title, receipt, previous: view.plan.mixes[key] ?? null }) } });
  });
}

const strikeInput = z.object({ experimentId: z.string().min(1), stepId: z.string().min(1), mixId: z.string().min(1), lineId: z.string().min(1), struck: z.boolean() });
/**
 * Cross one line off (or back on) while pipetting. A bench aid shared with the watch: it does not count as progress or change the
 * revision. Each write sets one line's state under the Experiment lock, so phone and watch never undo each other's lines.
 */
export async function strikeRunMixLine(raw: z.input<typeof strikeInput>) {
  const input = strikeInput.parse(raw);
  return withRun(input.experimentId, async (tx, { view }) => {
    const mix = stepMixes(view, input.stepId).find(item => item.id === input.mixId);
    if (!mix) throw new Error('The mix card does not belong to this step');
    if (!mix.components.some(component => component.id === input.lineId)) throw new Error('The component does not belong to this mix card');
    if (!mixState(view, input.stepId, mix).current) throw new Error('The mix card is not confirmed or its values changed; confirm it first');
    const key = `${input.stepId}:${mix.id}`, current = new Set(view.plan.mixStrikes[key] ?? []);
    if (input.struck) current.add(input.lineId); else current.delete(input.lineId);
    await savePlan(tx, input.experimentId, { ...view.plan, mixStrikes: { ...view.plan.mixStrikes, [key]: [...current] } });
  });
}

const quantityInput = z.object({ experimentId: z.string().min(1), versionId: z.string().min(1), expectedRevision: z.number().int().nonnegative(), quantities: z.record(z.string().trim().min(1).max(20), z.number().positive().max(1_000_000).nullable()) });
/** 本次数量 for one version (group), entered in 实验准备. Changing it asks every mix card that uses it to be confirmed again. */
export async function setRunQuantities(raw: z.input<typeof quantityInput>) {
  const input = quantityInput.parse(raw);
  return withRun(input.experimentId, async (tx, { view }) => {
    if (view.plan.revision !== input.expectedRevision) throw new Error('Execution plan changed; reload before saving');
    if (!view.versions.some(version => version.id === input.versionId)) throw new Error('This protocol is not part of this run');
    const current = { ...view.plan.quantities[input.versionId] };
    for (const [label, value] of Object.entries(input.quantities)) { if (value === null) delete current[label]; else current[label] = value; }
    await savePlan(tx, input.experimentId, { ...view.plan, revision: view.plan.revision + 1, quantities: { ...view.plan.quantities, [input.versionId]: current } });
    await tx.activityLog.create({ data: { action: 'run_quantities_set', targetType: 'experiment', targetId: input.experimentId, metadataJson: json({ versionId: input.versionId, previous: view.plan.quantities[input.versionId] ?? {}, next: current }) } });
  });
}

const createInput = z.object({ experimentId: z.string().min(1), stepId: z.string().min(1), expectedRevision: z.number().int().nonnegative(), title: z.string().trim().max(120).default('现场配液'), per: z.string().trim().min(1).max(12).default('反应'), parameterIds: z.array(z.string().min(1)).min(1).max(40) });
/** A mix card made at the bench from chips already in the step; recorded for this run only, marked 执行时补充. */
export async function createRunMix(raw: z.input<typeof createInput>) {
  const input = createInput.parse(raw);
  return withRun(input.experimentId, async (tx, { view }) => {
    if (view.plan.revision !== input.expectedRevision) throw new Error('Execution plan changed; reload before making it');
    const step = view.steps[input.stepId];
    if (!step) throw new Error('This step is not part of this run');
    const systems = view.versions.find(version => version.id === step.versionId)?.document.systems;
    if (input.parameterIds.some(id => !step.chipIds?.includes(id))) throw new Error('Only parameters in this step can be chosen');
    const mix: ProtocolMix = { id: prefixedClientId('mix'), type: 'mix', title: input.title, per: input.per, overagePercent: 10, minPipetteUl: 0.5,
      components: input.parameterIds.map(id => { const parameter = systems?.parameters.find(p => p.id === id);
        return { id: prefixedClientId('component'), name: parameter?.label.trim() || parameter?.materialRef?.name || '', amount: `{{${id}}}`, mode: 'premix' as const }; }) };
    await savePlan(tx, input.experimentId, { ...view.plan, revision: view.plan.revision + 1, runMixes: { ...view.plan.runMixes, [input.stepId]: [...(view.plan.runMixes[input.stepId] ?? []), mix] } });
    await tx.experimentStepEvent.create({ data: { experimentId: input.experimentId, experimentStepId: input.stepId, eventType: 'mix_added_at_bench', payloadJson: json({ mix }) } });
    return mix.id;
  });
}

const proposeInput = z.object({ experimentId: z.string().min(1), stepId: z.string().min(1), mixId: z.string().min(1) });
/** Offer a bench-made mix card to the Protocol's next version; the author adds it from the editor. Nothing in the Protocol changes here. */
export async function proposeRunMix(raw: z.input<typeof proposeInput>) {
  const input = proposeInput.parse(raw);
  const experiment = await load(prisma, input.experimentId);
  const view = structuredRunView(experiment.protocolSnapshotJson, experiment.protocolRun?.executionPlanJson, experiment.steps);
  const step = view.steps[input.stepId];
  const mix = view.plan.runMixes[input.stepId]?.find(item => item.id === input.mixId);
  if (!step || !mix) throw new Error('Only mix cards added during the run can be proposed');
  const protocolVersionId = step.versionId.split('@')[0];
  const version = await prisma.protocolVersion.findUniqueOrThrow({ where: { id: protocolVersionId }, select: { protocolId: true } });
  if (await prisma.activityLog.findFirst({ where: { action: 'protocol_mix_proposed', targetType: 'protocol', targetId: version.protocolId, metadataJson: { path: ['mix', 'id'], equals: mix.id } } })) throw new Error('This mix card has already been proposed');
  await prisma.activityLog.create({ data: { action: 'protocol_mix_proposed', targetType: 'protocol', targetId: version.protocolId, metadataJson: json({ mix, protocolVersionId, stepRef: step.source_ref, stepTitle: step.title, experimentId: experiment.id, runCode: experiment.runCode }) } });
}

