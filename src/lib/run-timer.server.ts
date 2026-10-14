import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { prisma } from './db';
import { assertRecordEditable } from './record-lifecycle';
import { structuredRunView, assertStructuredStepExecutable } from './structured-run';
import { advanceExecutionRevision } from './structured-run.server';
import { remainingStepTimerSeconds } from './step-timer';
const timerInput = z.object({
 experimentId: z.string().min(1), stepId: z.string().min(1), timerIntent: z.enum(['start','pause','reset','finish']),
 durationMinutes: z.coerce.number().finite().min(0.1).max(1440).optional(), expectedRevision: z.number().int().nonnegative().optional(), clientMutationId: z.string().uuid().optional(),
});
/** Web and watch clients use the same locked timer transition and execution checks. */
export async function updateRunTimer(raw: z.input<typeof timerInput>) {
 const parsed = timerInput.parse(raw);
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      // Historical Draft repair uses the same parent lock before inspecting any
      // execution evidence. A timer may not start between its check and write.
      await tx.$queryRaw`SELECT id FROM "Experiment" WHERE id=${parsed.experimentId} FOR UPDATE`;
      if (parsed.clientMutationId) {
        const replay = await tx.experimentStepEvent.findUnique({ where: { clientMutationId: parsed.clientMutationId } });
        if (replay) {
          if (replay.experimentId !== parsed.experimentId || replay.experimentStepId !== parsed.stepId || !isDeepStrictEqual((replay.payloadJson as { request?: unknown }).request, parsed)) throw new Error('重复计时请求与原请求不同');
          return;
        }
      }
      const step = await tx.experimentStep.findFirst({
        where: { id: parsed.stepId, experimentId: parsed.experimentId },
        include: { experiment: { include: { protocolRun: true, steps: true } } },
      });
      if (!step) throw new Error("Experiment step not found.");
      if (step.experiment.status === "archived") throw new Error("An archived Experiment cannot change timers.");
      assertRecordEditable(step.experiment.recordStatus);
      const structured = structuredRunView(step.experiment.protocolSnapshotJson, step.experiment.protocolRun?.executionPlanJson, step.experiment.steps);
      const expectedRevision = parsed.expectedRevision;
      assertStructuredStepExecutable(structured, step.id, expectedRevision);
      if (structured.steps[step.id] && (step.completed || step.experiment.status === 'completed')) throw new Error('已完成步骤的计时记录不可覆盖 / Completed operation is fixed');

      const submittedDuration = parsed.durationMinutes ? Math.round(parsed.durationMinutes * 60) : undefined;
      const durationSeconds = structured.steps[step.id]?.timerDurationSeconds ?? submittedDuration ?? step.timerDurationSeconds ?? 300;
      if (durationSeconds <= 0) throw new Error('计时时长必须大于零 / Timer duration must be positive');
      // Repeated Start must never move an already-running deadline.
      if (parsed.timerIntent === 'start' && step.timerStartedAt) return;
      if (step.timerStartedAt && step.timerStartedAt.getTime() > now.getTime() + 1000) throw new Error('检测到时钟倒退，请核对时间后重试 / Clock moved backwards');
      const currentRemaining = remainingStepTimerSeconds({
        remainingSeconds: step.timerRemainingSeconds ?? durationSeconds,
        startedAt: step.timerStartedAt,
        now,
      });
      const timerData = parsed.timerIntent === "finish"
        ? { timerDurationSeconds: durationSeconds, timerRemainingSeconds: 0, timerStartedAt: null, timerPausedAt: now }
        : parsed.timerIntent === "pause"
        ? { timerDurationSeconds: durationSeconds, timerRemainingSeconds: currentRemaining, timerStartedAt: null, timerPausedAt: now }
        : parsed.timerIntent === "reset"
          ? { timerDurationSeconds: durationSeconds, timerRemainingSeconds: durationSeconds, timerStartedAt: null, timerPausedAt: null }
          : { timerDurationSeconds: durationSeconds, timerRemainingSeconds: currentRemaining > 0 ? currentRemaining : durationSeconds, timerStartedAt: now, timerPausedAt: null };

      await tx.experimentStep.update({ where: { id: step.id }, data: timerData });
      if (structured.steps[step.id]) await tx.experimentStepEvent.create({ data: { experimentId: parsed.experimentId, experimentStepId: step.id, eventType: `timer_${parsed.timerIntent}`, clientMutationId: parsed.clientMutationId, payloadJson: JSON.parse(JSON.stringify({ request: parsed, executionPlanRevision: structured.plan.revision, previous: { startedAt: step.timerStartedAt, remainingSeconds: step.timerRemainingSeconds }, timerData })) } });
      await advanceExecutionRevision(tx, parsed.experimentId, structured);
      await tx.activityLog.create({
        data: {
          action: `experiment_step_timer_${parsed.timerIntent}`,
          targetType: "experiment_step",
          targetId: step.id,
          metadataJson: { experimentId: parsed.experimentId, durationSeconds, remainingSeconds: timerData.timerRemainingSeconds },
        },
      });
    });
}
