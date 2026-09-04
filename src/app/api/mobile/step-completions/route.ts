import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";

const schema = z.object({
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
    const replay = await prisma.experimentStepEvent.findUnique({ where: { clientMutationId: input.clientMutationId }, select: { id: true } });
    if (replay) return Response.json({ eventId: replay.id, replay: true });
    const event = await prisma.$transaction(async (tx) => {
      const step = await tx.experimentStep.findFirst({ where: { id: input.experimentStepId, experimentId: input.experimentId }, include: { experiment: { select: { status: true, primaryProtocolVersionId: true } } } });
      if (!step) throw new Error("The selected experiment step is no longer available.");
      if (step.experiment.status === "archived") throw new Error("An archived Experiment cannot be changed in Run mode.");
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
        payloadJson: json({ previousCompleted: step.completed, completed: true, deviationType: input.deviationType ?? null, actualExecution: input.deviationNote ?? null, impactAssessment: input.deviationImpact ?? null, author: input.deviationAuthor ?? null }),
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
