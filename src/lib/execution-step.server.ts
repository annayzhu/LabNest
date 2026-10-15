import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from './db';
import { assertRecordEditable } from './record-lifecycle';
import { stepExecutionBlocker, structuredRunView } from './structured-run';
import { advanceExecutionRevision } from './structured-run.server';
import { deviationTypeOptions } from './experiment-document';

const input = z.object({
  experimentId: z.string().min(1), stepId: z.string().min(1), clientMutationId: z.string().uuid(),
  expectedRevision: z.number().int().nonnegative().optional(),
  completed: z.boolean().optional(),
  // null clears the deviation; omitted leaves it unchanged.
  deviation: z.object({ type: z.enum(deviationTypeOptions), note: z.string().trim().min(1, '请写明与计划不同之处').max(5000), impact: z.string().trim().max(5000).optional(), author: z.string().trim().max(120).optional() }).nullable().optional(),
});
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

/**
 * One step from the record page: check it, reopen it, or record its deviation. Writes the same step record as the Run page,
 * one step at a time, so unsaved notes elsewhere are never replaced. Completing the whole Experiment stays on the Run page.
 */
export async function updateExecutionStep(raw: z.input<typeof input>) {
  const request = input.parse(raw);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Experiment" WHERE id=${request.experimentId} FOR UPDATE`;
    const replay = await tx.experimentStepEvent.findUnique({ where: { clientMutationId: request.clientMutationId } });
    if (replay) {
      if (replay.experimentId !== request.experimentId || replay.experimentStepId !== request.stepId) throw new Error('重复请求不属于此步骤');
      return;
    }
    const experiment = await tx.experiment.findUnique({ where: { id: request.experimentId }, include: { protocolRun: true, steps: true } });
    if (!experiment) throw new Error('实验不存在');
    if (experiment.status === 'archived') throw new Error('已归档的实验不能修改');
    assertRecordEditable(experiment.recordStatus);
    const step = experiment.steps.find(item => item.id === request.stepId);
    if (!step) throw new Error('此步骤不属于本实验');
    const structured = structuredRunView(experiment.protocolSnapshotJson, experiment.protocolRun?.executionPlanJson, experiment.steps);
    const adopted = structured.steps[step.id];
    if (structured.hasSystems && experiment.status === 'completed') throw new Error('已结束的执行记录不可改写');
    if (adopted && request.expectedRevision !== structured.plan.revision) throw new Error('执行方案已变更，请刷新后再操作');
    const now = new Date();
    const data: Prisma.ExperimentStepUpdateInput = {};
    const completed = request.completed ?? step.completed;
    if (completed !== step.completed) {
      if (completed && adopted) {
        const blocker = stepExecutionBlocker(structured, step.id, true);
        if (blocker) throw new Error(blocker);
        if (step.timerStartedAt) throw new Error('请先结束计时，再确认步骤完成');
      }
      Object.assign(data, { completed, completedAt: completed ? step.completedAt ?? now : null });
    }
    // This write's deviation, else the one already recorded.
    const deviation = request.deviation === undefined ? { type: step.deviationType, note: step.deviationNote, impact: step.deviationImpact, author: step.deviationAuthor } : request.deviation;
    if (request.deviation !== undefined) {
      if (request.deviation && !step.allowsDeviation) throw new Error('此步骤不允许记录偏差');
      Object.assign(data, { deviationNote: deviation?.note ?? null, deviationType: deviation?.type ?? null, deviationImpact: deviation?.impact || null, deviationAuthor: deviation?.author || null, deviationAt: deviation ? now : null });
    }
    if (!Object.keys(data).length) return;
    await tx.experimentStep.update({ where: { id: step.id }, data });
    await tx.experimentStepEvent.create({ data: {
      experimentStepId: step.id, experimentId: experiment.id, clientMutationId: request.clientMutationId,
      eventType: completed !== step.completed ? (completed ? 'completed' : 'reopened') : deviation ? 'deviation_recorded' : 'deviation_cleared',
      payloadJson: json({ source: 'record', previousCompleted: step.completed, completed, deviationType: deviation?.type ?? null, actualExecution: deviation?.note ?? null, impactAssessment: deviation?.impact ?? null, author: deviation?.author ?? null,
        ...(adopted ? { executionPlanRevision: structured.plan.revision, adopted, actualValues: structured.plan.actualValues[step.id] ?? {} } : {}) }),
    } });
    // The first checked step starts the run; reopening a step of a finished plain run reopens it.
    const status = completed && experiment.status === 'planned' ? 'running' as const : !completed && experiment.status === 'completed' ? 'running' as const : experiment.status;
    if (status !== experiment.status) {
      await tx.experiment.update({ where: { id: experiment.id }, data: { status } });
      if (experiment.protocolRun) await tx.protocolRun.update({ where: { experimentId: experiment.id }, data: { status } });
    }
    await advanceExecutionRevision(tx, experiment.id, structured);
    await tx.activityLog.create({ data: { action: 'experiment_step_recorded', targetType: 'experiment', targetId: experiment.id, metadataJson: json({ stepId: step.id, completed, deviationChanged: request.deviation !== undefined, source: 'record' }) } });
  });
}
