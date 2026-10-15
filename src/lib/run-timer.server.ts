import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { prisma } from './db';
import { assertRecordEditable } from './record-lifecycle';
import { structuredRunView, assertStructuredStepExecutable, stepVersion, type StructuredRunView } from './structured-run';
import { convert, normalizeUnit, units } from './calculators/quantities';
import { advanceExecutionRevision } from './structured-run.server';
import { remainingStepTimerSeconds } from './step-timer';
const timerInput = z.object({
 experimentId: z.string().min(1), stepId: z.string().min(1), timerIntent: z.enum(['start','pause','reset','finish']),
 durationMinutes: z.coerce.number().finite().min(0.1).max(1440).optional(), expectedRevision: z.number().int().nonnegative().optional(), clientMutationId: z.string().uuid().optional(),
 // A time chip in the step: the countdown takes that chip's adopted duration.
 parameterId: z.string().min(1).max(120).optional(),
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
      const chipDuration = parsed.parameterId ? chipTimerSeconds(structured, step.id, parsed.parameterId) : undefined;
      const source = structured.plan.timerSources[step.id];
      if (parsed.parameterId && source && source !== parsed.parameterId && step.timerStartedAt) throw new Error('这一步已有计时在进行，请先结束当前计时');
      const durationSeconds = chipDuration ?? structured.steps[step.id]?.timerDurationSeconds ?? submittedDuration ?? step.timerDurationSeconds ?? 300;
      if (durationSeconds <= 0) throw new Error('计时时长必须大于零 / Timer duration must be positive');
      // Repeated Start must never move an already-running deadline.
      if (parsed.timerIntent === 'start' && step.timerStartedAt) return;
      // Starting from another chip begins that chip's countdown afresh.
      const switching = parsed.parameterId !== undefined && parsed.timerIntent === 'start' && source !== parsed.parameterId;
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
          : { timerDurationSeconds: durationSeconds, timerRemainingSeconds: currentRemaining > 0 && !switching ? currentRemaining : durationSeconds, timerStartedAt: now, timerPausedAt: null };

      await tx.experimentStep.update({ where: { id: step.id }, data: timerData });
      if (structured.steps[step.id]) await tx.experimentStepEvent.create({ data: { experimentId: parsed.experimentId, experimentStepId: step.id, eventType: `timer_${parsed.timerIntent}`, clientMutationId: parsed.clientMutationId, payloadJson: JSON.parse(JSON.stringify({ request: parsed, executionPlanRevision: structured.plan.revision, previous: { startedAt: step.timerStartedAt, remainingSeconds: step.timerRemainingSeconds }, timerData })) } });
      // The countdown belongs to the chip that started it; the plain step timer takes it back on start or reset.
      const otherSources = Object.fromEntries(Object.entries(structured.plan.timerSources).filter(([id]) => id !== step.id));
      const timerSources = parsed.parameterId ? { ...otherSources, [step.id]: parsed.parameterId } : ['start', 'reset'].includes(parsed.timerIntent) ? otherSources : structured.plan.timerSources;
      await advanceExecutionRevision(tx, parsed.experimentId, structured.steps[step.id] ? { ...structured, plan: { ...structured.plan, timerSources } } : structured);
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

/** The adopted duration of a time chip that belongs to this step, in seconds. */
function chipTimerSeconds(view: StructuredRunView, stepId: string, parameterId: string) {
  const step = view.steps[stepId];
  if (!step?.chipIds?.includes(parameterId)) throw new Error('这个计时不属于此步骤');
  const resolved = stepVersion(view, stepId)?.parameters[parameterId];
  if (resolved?.status !== 'resolved' || units[normalizeUnit(resolved.unit)]?.dimension !== 'time') throw new Error('计时时长尚未确定');
  const seconds = Math.round(convert(resolved.value!, resolved.unit, 's'));
  if (seconds <= 0 || seconds > 7 * 86400) throw new Error('计时时长超出范围');
  return seconds;
}
