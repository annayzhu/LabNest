import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from './db';
import { assertRecordEditable } from './record-lifecycle';
import { proposedExecutionPlan, structuredRunView, changedStructuredSteps, assertStructuredStepExecutable } from './structured-run';
import { resolveProtocolSystem, previewProtocolCalculation } from './structured-protocol';
import { convert } from './calculators/quantities';
import { reserveRecordCode } from './record-codes';
import { remainingStepTimerSeconds } from './step-timer';
import { associateDocumentMedia } from './document-media.server';

const selectionInput = z.object({
  experimentId: z.string().min(1), versionId: z.string().min(1), expectedRevision: z.number().int().nonnegative(),
  selections: z.record(z.string().max(120), z.string().min(1).max(120)),
  actualInputs: z.record(z.string().max(120), z.object({ value: z.number().finite(), unit: z.string().min(1).max(40) })),
  continuationKey: z.string().uuid().optional(),
  cancelAffectedTimers: z.boolean().optional(),
  confirmCalculations: z.array(z.string().min(1).max(120)).max(100).default([]),
});
function json(value: unknown) { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }

/** All selection writes serialize against the same Experiment lock as step/timer writes. */
export async function updateRunSystemSelection(raw: z.input<typeof selectionInput>) {
  const input = selectionInput.parse(raw);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Experiment" WHERE id=${input.experimentId} FOR UPDATE`;
    const experiment = await tx.experiment.findUniqueOrThrow({ where: { id: input.experimentId }, include: { protocolRun: true, protocolVersions: true, steps: { orderBy: [{ groupOrder: 'asc' }, { order: 'asc' }], include: { _count: { select: { events: true, results: true, entries: true } } } } } });
    assertRecordEditable(experiment.recordStatus);
    if (['archived', 'completed'].includes(experiment.status)) throw new Error('此执行已结束，不能变更采用体系 / Finished execution is fixed');
    const before = structuredRunView(experiment.protocolSnapshotJson, experiment.protocolRun?.executionPlanJson, experiment.steps);
    if (before.plan.revision !== input.expectedRevision) throw new Error('执行方案已变更，请刷新核对 / Execution plan changed');
    const version = before.versions.find(v => v.id === input.versionId);
    if (!version?.document.systems || !experiment.protocolRun) throw new Error('所选规程不属于本次执行 / Protocol is not in this captured execution');
    for (const id of Object.keys(input.actualInputs)) if (!version.document.systems.parameters.some(p => p.id === id && p.source.kind === 'actual')) throw new Error('只能填写实际值来源的参数 / Parameter source is fixed by the Protocol');
    const calculations = { ...before.plan.versions[input.versionId]?.calculations };
    const now = new Date().toISOString();
    for (const id of input.confirmCalculations) {
      const parameter = version.document.systems.parameters.find(p => p.id === id);
      if (!parameter || parameter.source.kind !== 'calculator') throw new Error('计算绑定不属于本规程');
      const current = resolveProtocolSystem(version.document.systems, input.selections, input.actualInputs, calculations);
      calculations[id] = { ...previewProtocolCalculation(parameter, current.parameters), confirmedAt: now };
    }
    const resolution = resolveProtocolSystem(version.document.systems, input.selections, input.actualInputs, calculations);
    const invalid = resolution.issues.filter(i => !['parameter-unknown'].includes(i.code));
    if (invalid.length) throw new Error(invalid.map(i => i.message).join('；'));
    const next = proposedExecutionPlan(before.plan, input.versionId, input.selections, input.actualInputs, now);
    next.versions[input.versionId].calculations = calculations;
    const after = structuredRunView(experiment.protocolSnapshotJson, next, experiment.steps);
    const changed = changedStructuredSteps(before, after);
    const protectedSteps = experiment.steps.filter(s => changed.includes(s.id) && (s.completed || s.completedAt || s.deviationNote || s.timerStartedAt || s.timerPausedAt || s._count.events || s._count.results || s._count.entries || before.plan.actualValues[s.id] || before.plan.skips[s.id]));
    if (protectedSteps.length && !input.continuationKey) throw new Error('受影响步骤已有执行记录，请保留原执行并创建继续实例 / Recorded effects require a linked continuation');
    if (protectedSteps.length && input.continuationKey) {
      const previous = await tx.experiment.findUnique({ where: { creationKey: input.continuationKey }, include: { protocolRun: true } });
      if (previous) {
        const saved = structuredRunView(previous.protocolSnapshotJson, previous.protocolRun?.executionPlanJson, []);
        if (saved.plan.continuation?.experimentId !== experiment.id || JSON.stringify(saved.plan.versions[input.versionId]?.selections) !== JSON.stringify(input.selections) || JSON.stringify(saved.plan.versions[input.versionId]?.actualInputs) !== JSON.stringify(input.actualInputs)) throw new Error('继续实例请求与原请求不一致');
        return { experimentId: previous.id, revision: saved.plan.revision, changedStepIds: changed };
      }
      const active = protectedSteps.filter(s => s.timerStartedAt);
      if (active.length && !input.cancelAffectedTimers) throw new Error('受影响步骤有活动计时器；请明确确认取消旧计时器后继续');
      const continuationPlan = { ...next, revision: 1, actualValues: {}, skips: {}, continuation: { experimentId: experiment.id, createdAt: now, affectedSourceRefs: experiment.steps.filter(s => changed.includes(s.id)).map(s => s.protocolStepRef ?? s.id), priorRecord: { runCode: experiment.runCode, plan: before.plan, steps: experiment.steps } } };
      const created = await tx.experiment.create({ data: {
        creationKey: input.continuationKey, runCode: await reserveRecordCode(tx, 'experiment'), title: `${experiment.title} · 继续执行`,
        projectId: experiment.projectId, researchPlanId: experiment.researchPlanId, primaryProtocolVersionId: experiment.primaryProtocolVersionId,
        status: 'planned', recordStatus: 'draft', date: new Date(), purpose: experiment.purpose, tags: experiment.tags,
        contentJson: {}, searchText: experiment.searchText, protocolSnapshotJson: json(experiment.protocolSnapshotJson),
        protocolVersions: { create: experiment.protocolVersions.map(v => ({ protocolVersionId: v.protocolVersionId, role: v.role, order: v.order })) },
        steps: { create: experiment.steps.map(s => ({ protocolStepRef: s.protocolStepRef, groupKey: s.groupKey, groupTitle: s.groupTitle, groupOrder: s.groupOrder, order: s.order, title: s.title, description: s.description, requiresConfirmation: s.requiresConfirmation, allowsDeviation: s.allowsDeviation })) },
        protocolRun: { create: { protocolVersionId: experiment.protocolRun.protocolVersionId, executionPlanJson: json(continuationPlan), status: 'planned' } },
      } });
      for (const step of active) {
        const remaining = remainingStepTimerSeconds({ remainingSeconds: step.timerRemainingSeconds ?? step.timerDurationSeconds ?? 0, startedAt: step.timerStartedAt, now: new Date(now) });
        await tx.experimentStep.update({ where: { id: step.id }, data: { timerStartedAt: null, timerRemainingSeconds: remaining, timerPausedAt: new Date(now) } });
        await tx.experimentStepEvent.create({ data: { experimentId: experiment.id, experimentStepId: step.id, eventType: 'timer_cancelled_for_continuation', payloadJson: json({ priorStartedAt: step.timerStartedAt, remainingSeconds: remaining, continuationId: created.id, confirmedAt: now }) } });
      }
      await associateDocumentMedia(tx, experiment.protocolSnapshotJson, 'experiment', created.id);
      await tx.itemLink.create({ data: { sourceType: 'experiment', sourceId: created.id, targetType: 'experiment', targetId: experiment.id, linkType: 'continued_from', createdBy: 'user', note: '体系变更；原执行记录保留，继续实例未复制完成状态。' } });
      await tx.activityLog.create({ data: { action: 'protocol_system_continuation_created', targetType: 'experiment', targetId: created.id, metadataJson: json({ previousExperimentId: experiment.id, affectedSourceRefs: continuationPlan.continuation.affectedSourceRefs, cancelledTimerIds: active.map(s => s.id) }) } });
      return { experimentId: created.id, revision: 1, changedStepIds: changed };
    }
    await tx.protocolRun.update({ where: { experimentId: experiment.id }, data: { executionPlanJson: json(next) } });
    await tx.activityLog.create({ data: { action: 'protocol_system_selection_confirmed', targetType: 'experiment', targetId: experiment.id, metadataJson: json({ revision: next.revision, sourceVersionId: version.id, previous: before.plan.versions[version.id] ?? null, adopted: next.versions[version.id], changedStepIds: changed, confirmedAt: now }) } });
    return { experimentId: experiment.id, revision: next.revision, changedStepIds: changed };
  });
}

const recordInput = z.object({ experimentId: z.string().min(1), stepId: z.string().min(1), expectedRevision: z.number().int().nonnegative(), clientMutationId: z.string().uuid(), intent: z.enum(['actual', 'skip', 'unskip']), reason: z.string().trim().max(5000).optional(), values: z.record(z.string(), z.object({ value: z.number().finite(), unit: z.string().min(1) })).default({}) });
export async function recordStructuredStep(raw: z.input<typeof recordInput>) {
  const input = recordInput.parse(raw);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Experiment" WHERE id=${input.experimentId} FOR UPDATE`;
    const replay = await tx.experimentStepEvent.findUnique({ where: { clientMutationId: input.clientMutationId } });
    if (replay) {
      if (replay.experimentId !== input.experimentId || replay.experimentStepId !== input.stepId) throw new Error('重复请求与原记录不一致');
      return { revision: (replay.payloadJson as { revision: number }).revision };
    }
    const experiment = await tx.experiment.findUniqueOrThrow({ where: { id: input.experimentId }, include: { steps: true, protocolRun: true } });
    assertRecordEditable(experiment.recordStatus);
    if (['archived', 'completed'].includes(experiment.status)) throw new Error('此执行记录已结束');
    const view = structuredRunView(experiment.protocolSnapshotJson, experiment.protocolRun?.executionPlanJson, experiment.steps);
    const step = view.steps[input.stepId];
    if (!step || !experiment.protocolRun || experiment.steps.find(s => s.id === input.stepId)?.completed) throw new Error('此操作不能修改记录');
    if (input.expectedRevision !== view.plan.revision) throw new Error('执行方案已变更，请刷新 / Execution plan changed');
    if (input.intent !== 'unskip') assertStructuredStepExecutable(view, input.stepId, input.expectedRevision);
    const next = structuredClone(view.plan), now = new Date().toISOString();
    next.revision++;
    if (input.intent === 'actual') {
      const values: typeof next.actualValues[string] = {};
      for (const [id, value] of Object.entries(input.values)) {
        const field = step.actualFields.find(f => f.id === id);
        if (!field) throw new Error('实际值字段不属于此步骤');
        values[id] = { value: convert(value.value, value.unit, field.unit), unit: field.unit, recordedAt: now };
      }
      next.actualValues[input.stepId] = { ...next.actualValues[input.stepId], ...values };
    } else if (input.intent === 'skip') {
      if (!input.reason) throw new Error('跳过步骤必须记录原因');
      next.skips[input.stepId] = { reason: input.reason, recordedAt: now };
    } else delete next.skips[input.stepId];
    await tx.protocolRun.update({ where: { experimentId: input.experimentId }, data: { executionPlanJson: json(next) } });
    await tx.experimentStepEvent.create({ data: { experimentId: input.experimentId, experimentStepId: input.stepId, clientMutationId: input.clientMutationId, eventType: `structured_${input.intent}`, payloadJson: json({ revision: next.revision, values: input.values, reason: input.reason, recordedAt: now }) } });
    return { revision: next.revision };
  });
}
