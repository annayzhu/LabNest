import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertRecordEditable } from "@/lib/record-lifecycle";
import { structuredRunView, assertStructuredStepExecutable } from '@/lib/structured-run';

const schema = z.object({
  executionPlanRevision: z.number().int().nonnegative().optional(),
  experimentId: z.string().min(1),
  experimentStepId: z.string().min(1),
  deviationType: z.string().trim().max(80).optional(),
  deviationNote: z.string().trim().max(5000).optional(),
  deviationImpact: z.string().trim().max(5000).optional(),
  deviationAuthor: z.string().trim().max(120).optional(),
  clientMutationId: z.string().uuid(),
  deviceCreatedAt: z.coerce.date(),
});

function json(value: unknown) { return value as Prisma.InputJsonValue; }

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const event = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Experiment" WHERE id=${input.experimentId} FOR UPDATE`;
      const replay = await tx.experimentStepEvent.findUnique({ where: { clientMutationId: input.clientMutationId } });
      if (replay) {
        if (replay.experimentId !== input.experimentId || replay.experimentStepId !== input.experimentStepId) throw new Error('重复请求与原执行不一致');
        return replay;
      }
      const step = await tx.experimentStep.findFirst({ where: { id: input.experimentStepId, experimentId: input.experimentId }, include: { experiment: { include: { steps: true, protocolRun: true } } } });
      if (!step) throw new Error("The selected experiment step is no longer available.");
      if (step.experiment.status === "archived") throw new Error("An archived Experiment cannot be changed in Run mode.");
      assertRecordEditable(step.experiment.recordStatus);
      const structured = structuredRunView(step.experiment.protocolSnapshotJson, step.experiment.protocolRun?.executionPlanJson, step.experiment.steps);
      assertStructuredStepExecutable(structured, step.id, input.executionPlanRevision, true);
      if (structured.steps[step.id] && step.completed) throw new Error('此步骤已完成，不能用新的完成请求覆盖既有记录');
      if (structured.steps[step.id] && step.timerStartedAt) throw new Error('请先结束计时，再确认步骤完成');
      if (structured.hasSystems && step.experiment.status === 'completed') throw new Error('已结束的执行不可改写');
      if (!step.allowsDeviation && input.deviationNote) throw new Error("This locked Protocol step does not allow a deviation record.");
      const recordedAt = new Date();
      await tx.experimentStep.update({ where: { id: step.id }, data: {
        completed: true,
        completedAt: step.completedAt ?? recordedAt,
        deviationNote: input.deviationNote ?? null,
        deviationType: input.deviationNote ? input.deviationType ?? "other" : null,
        deviationImpact: input.deviationNote ? input.deviationImpact ?? null : null,
        deviationAuthor: input.deviationNote ? input.deviationAuthor ?? null : null,
        deviationAt: input.deviationNote ? recordedAt : null,
      } });
      if (step.experiment.status === "planned" || step.experiment.status === "failed") {
        await tx.experiment.update({ where: { id: input.experimentId }, data: { status: "running" } });
      }
      if (step.experiment.primaryProtocolVersionId) {
        await tx.protocolRun.upsert({
          where: { experimentId: input.experimentId },
          create: { experimentId: input.experimentId, protocolVersionId: step.experiment.primaryProtocolVersionId, status: "running", parametersJson: {}, calculatedConsumptionJson: [] },
          update: { status: "running" },
        });
      }
      const created = await tx.experimentStepEvent.create({ data: {
        experimentStepId: step.id,
        experimentId: input.experimentId,
        eventType: "completed",
        clientMutationId: input.clientMutationId,
        deviceCreatedAt: input.deviceCreatedAt,
        payloadJson: json(JSON.parse(JSON.stringify({ previousCompleted: step.completed, completed: true, deviationType: input.deviationType ?? null, actualExecution: input.deviationNote ?? null, impactAssessment: input.deviationImpact ?? null, author: input.deviationAuthor ?? null, ...(structured.steps[step.id] ? { executionPlanRevision: structured.plan.revision, adopted: structured.steps[step.id], actualValues: structured.plan.actualValues[step.id] ?? {} } : {}) }))),
      } });
      await tx.activityLog.create({ data: { action: "protocol_run_step_complete", targetType: "experiment_step", targetId: step.id, metadataJson: json({ experimentId: input.experimentId, clientMutationId: input.clientMutationId, offlineCapable: true }) } });
      return created;
    });
    return Response.json({ eventId: event.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "Step completion could not be saved.";
    return Response.json({ error: message }, { status: 400 });
  }
}
