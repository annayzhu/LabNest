import { queuedRunContextSchema, queuedRunRevision } from './queued-run-revision.server';
import { isDeepStrictEqual } from 'node:util';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from './db';
import { assertRecordEditable } from './record-lifecycle';
import { proposedExecutionPlan, structuredRunView, changedStructuredSteps, assertStructuredStepExecutable, type StructuredRunView } from './structured-run';
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
  continuationStartRef: z.string().min(1).optional(),
  cancelAffectedTimers: z.boolean().optional(),
  confirmCalculations: z.array(z.string().min(1).max(120)).max(100).default([]),
});
function json(value: unknown) { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }

/** Called inside the shared parent lock after an execution write, not only after a selection change. */
export async function advanceExecutionRevision(tx: Prisma.TransactionClient, experimentId: string, view: StructuredRunView) {
  if (!view.hasSystems) return;
  await tx.protocolRun.update({ where: { experimentId }, data: { executionPlanJson: json({ ...view.plan, revision: view.plan.revision + 1 }) } });
}

/** All selection writes serialize against the same Experiment lock as step/timer writes. */
export async function updateRunSystemSelection(raw: z.input<typeof selectionInput>) {
  const input = selectionInput.parse(raw);
  return prisma.$transaction(tx => updateSelectionInTransaction(tx, input));
}

async function updateSelectionInTransaction(tx: Prisma.TransactionClient, input: z.output<typeof selectionInput>) {
    await tx.$queryRaw`SELECT id FROM "Experiment" WHERE id=${input.experimentId} FOR UPDATE`;
    const experiment = await tx.experiment.findUniqueOrThrow({ where: { id: input.experimentId }, include: { protocolRun: true, protocolVersions: true, steps: { orderBy: [{ groupOrder: 'asc' }, { order: 'asc' }], include: { _count: { select: { events: true, results: true, entries: true, inventoryTransactions: true } } } } } });
    assertRecordEditable(experiment.recordStatus);
    if (['archived', 'completed'].includes(experiment.status)) throw new Error('此执行已结束，不能变更采用体系 / Finished execution is fixed');
    const before = structuredRunView(experiment.protocolSnapshotJson, experiment.protocolRun?.executionPlanJson, experiment.steps);
    if (input.continuationKey) {
      const previous = await tx.experiment.findUnique({ where: { creationKey: input.continuationKey }, include: { protocolRun: true } });
      if (previous) {
        const saved = structuredRunView(previous.protocolSnapshotJson, previous.protocolRun?.executionPlanJson, []);
        if (saved.plan.continuation?.experimentId !== experiment.id || saved.plan.continuation.startSourceRef !== input.continuationStartRef || !isDeepStrictEqual(saved.plan.versions[input.versionId]?.selections, input.selections) || !isDeepStrictEqual(saved.plan.versions[input.versionId]?.actualInputs, input.actualInputs)) throw new Error('继续实例请求与原请求不一致');
        return { experimentId: previous.id, revision: saved.plan.revision, changedStepIds: [] };
      }
    }
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
    const attachedSteps = await tx.attachmentLink.findMany({ where: { targetType: 'experiment_step', targetId: { in: changed } }, select: { targetId: true } });
    const attachedIds = new Set(attachedSteps.map(link => link.targetId));
    const protectedSteps = experiment.steps.filter(s => changed.includes(s.id) && (s.completed || s.completedAt || s.deviationNote || s.timerStartedAt || s.timerPausedAt || s._count.events || s._count.results || s._count.entries || s._count.inventoryTransactions || attachedIds.has(s.id) || before.plan.actualValues[s.id] || before.plan.skips[s.id]));
    if (protectedSteps.length && !input.continuationKey) throw new Error('受影响步骤已有执行记录，请保留原执行并创建继续实例 / Recorded effects require a linked continuation');
    if (protectedSteps.length && input.continuationKey) {
      const startIndex = experiment.steps.findIndex(s => (before.steps[s.id] ? `${before.steps[s.id].versionId}:${before.steps[s.id].source_ref}` : s.protocolStepRef) === input.continuationStartRef);
      if (version.groupId && protectedSteps.some(step => before.plan.stepGroups[step.id] === 'shared')) throw new Error('已记录的共同操作也受到影响；请保留各组历史并另建实验，不能仅继续其中一组。');
      if (startIndex < 0 || after.steps[experiment.steps[startIndex].id]?.applicability === 'not-applicable') throw new Error('请明确选择继续位置，并核对样本此前已经经历的处理');
      const remainingSteps = experiment.steps.filter((s, index) => index >= startIndex && (!version.groupId || before.plan.stepGroups[s.id] === version.groupId) && (!s.completed || changed.includes(s.id)));
      const active = protectedSteps.filter(s => s.timerStartedAt);
      if (active.length && !input.cancelAffectedTimers) throw new Error('受影响步骤有活动计时器；请明确确认取消旧计时器后继续');
      const history = experiment.steps.map(s => ({ sourceRef: s.id, title: [before.steps[s.id]?.groupLabel, before.steps[s.id]?.title ?? s.title].filter(Boolean).join(' · '), completed: s.completed, completedAt: s.completedAt?.toISOString() ?? null, description: before.steps[s.id]?.description ?? s.description, actualValues: before.plan.actualValues[s.id] ?? {}, deviationNote: s.deviationNote }));
      const continuedIds = new Map(remainingSteps.map(step => [step.id, randomUUID()]));
      const continuationPlan = { ...next, groups: version.groupId ? next.groups.filter(group => group.id === version.groupId) : next.groups, versions: version.groupId ? Object.fromEntries(Object.entries(next.versions).filter(([id]) => id.endsWith(`@${version.groupId}`))) : next.versions, revision: 1, actualValues: {}, skips: {}, stepGroups: Object.fromEntries(remainingSteps.flatMap(step => next.stepGroups[step.id] ? [[continuedIds.get(step.id)!, next.stepGroups[step.id]]] : [])), continuation: { experimentId: experiment.id, createdAt: now, startSourceRef: input.continuationStartRef, history, affectedSourceRefs: experiment.steps.filter(s => changed.includes(s.id)).map(s => s.protocolStepRef ?? s.id), priorRecord: { runCode: experiment.runCode, plan: before.plan, steps: experiment.steps } } };
      const created = await tx.experiment.create({ data: {
        creationKey: input.continuationKey, runCode: await reserveRecordCode(tx, 'experiment'), title: `${experiment.title} · 继续执行`,
        projectId: experiment.projectId, researchPlanId: experiment.researchPlanId, primaryProtocolVersionId: experiment.primaryProtocolVersionId,
        status: 'planned', recordStatus: 'draft', date: new Date(), purpose: experiment.purpose, tags: experiment.tags,
        contentJson: {}, searchText: experiment.searchText, protocolSnapshotJson: json(experiment.protocolSnapshotJson),
        protocolVersions: { create: experiment.protocolVersions.map(v => ({ protocolVersionId: v.protocolVersionId, role: v.role, order: v.order })) },
        steps: { create: remainingSteps.map(s => ({ id: continuedIds.get(s.id), protocolStepRef: s.protocolStepRef, groupKey: s.groupKey, groupTitle: s.groupTitle, groupOrder: s.groupOrder, order: s.order, title: s.title, description: s.description, requiresConfirmation: s.requiresConfirmation, allowsDeviation: s.allowsDeviation })) },
        protocolRun: { create: { protocolVersionId: experiment.protocolRun.protocolVersionId, executionPlanJson: json(continuationPlan), status: 'planned' } },
      } });
      for (const step of active) {
        const remaining = remainingStepTimerSeconds({ remainingSeconds: step.timerRemainingSeconds ?? step.timerDurationSeconds ?? 0, startedAt: step.timerStartedAt, now: new Date(now) });
        await tx.experimentStep.update({ where: { id: step.id }, data: { timerStartedAt: null, timerRemainingSeconds: remaining, timerPausedAt: new Date(now) } });
        await tx.experimentStepEvent.create({ data: { experimentId: experiment.id, experimentStepId: step.id, eventType: 'timer_cancelled_for_continuation', payloadJson: json({ priorStartedAt: step.timerStartedAt, remainingSeconds: remaining, continuationId: created.id, confirmedAt: now }) } });
      }
      if (active.length) await advanceExecutionRevision(tx, experiment.id, before);
      await associateDocumentMedia(tx, experiment.protocolSnapshotJson, 'experiment', created.id);
      await tx.itemLink.create({ data: { sourceType: 'experiment', sourceId: created.id, targetType: 'experiment', targetId: experiment.id, linkType: 'continued_from', createdBy: 'user', note: '体系变更；原执行记录保留，继续实例未复制完成状态。' } });
      await tx.activityLog.create({ data: { action: 'protocol_system_continuation_created', targetType: 'experiment', targetId: created.id, metadataJson: json({ previousExperimentId: experiment.id, affectedSourceRefs: continuationPlan.continuation.affectedSourceRefs, cancelledTimerIds: active.map(s => s.id) }) } });
      return { experimentId: created.id, revision: 1, changedStepIds: changed };
    }
    await tx.protocolRun.update({ where: { experimentId: experiment.id }, data: { executionPlanJson: json(next) } });
    await tx.activityLog.create({ data: { action: 'protocol_system_selection_confirmed', targetType: 'experiment', targetId: experiment.id, metadataJson: json({ revision: next.revision, sourceVersionId: version.id, previous: before.plan.versions[version.id] ?? null, adopted: next.versions[version.id], changedStepIds: changed, confirmedAt: now }) } });
    return { experimentId: experiment.id, revision: next.revision, changedStepIds: changed };
}

/** Explicitly selected scopes are applied atomically; one invalid group rolls back the entire batch. */
export async function updateRunSystemSelections(raw: z.input<typeof selectionInput>, versionIds: string[]) {
  const input = selectionInput.parse(raw);
  const ids = z.array(z.string().min(1)).min(1).max(24).parse(versionIds);
  if (new Set(ids).size !== ids.length || !ids.includes(input.versionId)) throw new Error('请明确选择要应用的实验组。');
  if (input.continuationKey && ids.length > 1) throw new Error('已有操作的继续实例须逐组核对，不能批量继续。');
  return prisma.$transaction(async tx => {
    let revision = input.expectedRevision;
    let result: Awaited<ReturnType<typeof updateSelectionInTransaction>> | undefined;
    for (const versionId of ids) {
      if (versionId.split('@')[0] !== input.versionId.split('@')[0]) throw new Error('批量应用只能使用相同的源规程版本。');
      result = await updateSelectionInTransaction(tx, { ...input, versionId, expectedRevision: revision });
      revision = result.revision;
    }
    return result!;
  });
}

const groupsInput = z.object({ experimentId: z.string().min(1), expectedRevision: z.number().int().nonnegative(), groups: z.array(z.object({ id: z.string().regex(/^[\w-]+$/).refine(id => id !== 'shared'), label: z.string().trim().min(1).max(100) })).min(1).max(24) });

/** Grouping is a preparation operation. Never rebuild or renumber recorded operations. */
export async function configureRunGroups(raw: z.input<typeof groupsInput>) {
  const input = groupsInput.parse(raw);
  if (new Set(input.groups.map(group => group.id)).size !== input.groups.length) throw new Error('实验组标识重复。');
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Experiment" WHERE id=${input.experimentId} FOR UPDATE`;
    const experiment = await tx.experiment.findUniqueOrThrow({ where: { id: input.experimentId }, include: { protocolRun: true, steps: { orderBy: [{ groupOrder: 'asc' }, { order: 'asc' }], include: { _count: { select: { events: true, entries: true, results: true, inventoryTransactions: true } } } } } });
    assertRecordEditable(experiment.recordStatus);
    const view = structuredRunView(experiment.protocolSnapshotJson, experiment.protocolRun?.executionPlanJson, experiment.steps);
    if (isDeepStrictEqual(view.plan.groups, input.groups)) return;
    if (!view.hasSystems || !experiment.protocolRun || ['archived', 'completed'].includes(experiment.status)) throw new Error('此实验不能配置体系分组。');
    if (view.plan.groups.length) throw new Error('实验组已固定；需要不同分组时请新建实验，避免改变步骤身份。');
    if (view.plan.revision !== input.expectedRevision) throw new Error('执行方案已变更，请刷新核对。');
    const files = await tx.attachmentLink.count({ where: { targetType: 'experiment_step', targetId: { in: experiment.steps.map(step => step.id) } } });
    if (files || experiment.steps.some(step => step.completed || step.completedAt || step.deviationNote || step.timerStartedAt || step.timerPausedAt || Object.values(step._count).some(Boolean)) || Object.keys(view.plan.actualValues).length || Object.keys(view.plan.skips).length) throw new Error('已有执行记录，请保留原实验并新建多组实验。');
    if (experiment.steps.some(step => !view.steps[step.id])) throw new Error('多组执行要求所有选用规程明确配置体系；请先补齐规程再创建实验。');
    const next = { ...view.plan, groups: input.groups, stepGroups: {} as Record<string, string>, versions: {}, revision: view.plan.revision + 1 };
    for (const step of experiment.steps) {
      const source = view.steps[step.id];
      const rules = view.versions.find(version => version.id === source.versionId)!.document.systems!.rules;
      if (rules.some(rule => rule.target === 'step' && rule.targetId === source.source_ref && rule.scope === 'experiment')) { next.stepGroups[step.id] = 'shared'; continue; }
      next.stepGroups[step.id] = input.groups[0].id;
      for (const group of input.groups.slice(1)) {
        const created = await tx.experimentStep.create({ data: { experimentId: experiment.id, protocolStepRef: step.protocolStepRef, groupKey: step.groupKey, groupTitle: step.groupTitle, groupOrder: step.groupOrder, order: step.order, title: step.title, description: step.description, requiresConfirmation: step.requiresConfirmation, allowsDeviation: step.allowsDeviation } });
        next.stepGroups[created.id] = group.id;
      }
    }
    await tx.protocolRun.update({ where: { experimentId: experiment.id }, data: { executionPlanJson: json(next) } });
    await tx.activityLog.create({ data: { action: 'experiment_groups_configured', targetType: 'experiment', targetId: experiment.id, metadataJson: json({ groups: next.groups, revision: next.revision, priorSelections: view.plan.versions, message: '各组需重新明确确认体系；未复制原选择为确认事实。' }) } });
  });
}

const recordInput = z.object({ queueContext: queuedRunContextSchema.optional(), deviceCreatedAt: z.coerce.date().optional(), experimentId: z.string().min(1), stepId: z.string().min(1), expectedRevision: z.number().int().nonnegative(), clientMutationId: z.string().uuid(), intent: z.enum(['actual', 'skip', 'unskip']), reason: z.string().trim().max(5000).optional(), values: z.record(z.string(), z.object({ value: z.number().finite(), unit: z.string().min(1) })).default({}) });
export async function recordStructuredStep(raw: z.input<typeof recordInput>) {
  const input = recordInput.parse(raw);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Experiment" WHERE id=${input.experimentId} FOR UPDATE`;
    const replay = await tx.experimentStepEvent.findUnique({ where: { clientMutationId: input.clientMutationId } });
    if (replay) {
      if (replay.experimentId !== input.experimentId || replay.experimentStepId !== input.stepId || (replay.payloadJson as { request?: unknown }).request && !isDeepStrictEqual((replay.payloadJson as { request?: unknown }).request, { intent: input.intent, values: input.values, reason: input.reason ?? '' })) throw new Error('重复请求与原记录不一致');
      return { revision: (replay.payloadJson as { revision: number }).revision };
    }
    const experiment = await tx.experiment.findUniqueOrThrow({ where: { id: input.experimentId }, include: { steps: true, protocolRun: true } });
    assertRecordEditable(experiment.recordStatus);
    if (['archived', 'completed'].includes(experiment.status)) throw new Error('此执行记录已结束');
    const view = structuredRunView(experiment.protocolSnapshotJson, experiment.protocolRun?.executionPlanJson, experiment.steps);
    const step = view.steps[input.stepId];
    if (!step || !experiment.protocolRun || experiment.steps.find(s => s.id === input.stepId)?.completed) throw new Error('此操作不能修改记录');
    if (input.queueContext && input.queueContext.sourceRef !== experiment.steps.find(s => s.id === input.stepId)?.protocolStepRef) throw new Error('离线操作的来源版本与当前步骤不同');
    const expectedRevision = await queuedRunRevision(tx, input);
    if (expectedRevision !== view.plan.revision) throw new Error('执行方案已变更，请刷新 / Execution plan changed');
    if (input.intent !== 'unskip') assertStructuredStepExecutable(view, input.stepId, expectedRevision);
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
    await tx.experimentStepEvent.create({ data: { experimentId: input.experimentId, experimentStepId: input.stepId, clientMutationId: input.clientMutationId, eventType: `structured_${input.intent}`, deviceCreatedAt: input.deviceCreatedAt, payloadJson: json({ queueContext: input.queueContext, clientBaseRevision: input.expectedRevision, resultingRevision: next.revision, request: { intent: input.intent, values: input.values, reason: input.reason ?? '' }, revision: next.revision, values: input.values, reason: input.reason, recordedAt: now }) } });
    return { revision: next.revision };
  });
}
