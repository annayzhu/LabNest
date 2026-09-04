import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { validateMeasurementRange } from "@/lib/measurement-validation";

const schema = z.object({
  experimentId: z.string().min(1),
  experimentStepId: z.string().min(1),
  value: z.number().finite(),
  unit: z.string().trim().min(1).max(32),
  observedAt: z.coerce.date(),
  sampleLabel: z.string().trim().max(160).optional(),
  expectedMin: z.number().finite().optional(),
  expectedMax: z.number().finite().optional(),
  notes: z.string().trim().max(2000).optional(),
  clientMutationId: z.string().uuid(),
  deviceCreatedAt: z.coerce.date(),
}).superRefine((value, context) => {
  if (value.expectedMin !== undefined && value.expectedMax !== undefined && value.expectedMin > value.expectedMax) context.addIssue({ code: "custom", path: ["expectedMax"], message: "Expected maximum must be greater than or equal to the minimum." });
});

function json(value: unknown) { return value as Prisma.InputJsonValue; }

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const replay = await prisma.result.findUnique({ where: { clientMutationId: input.clientMutationId }, select: { id: true } });
    if (replay) return Response.json({ resultId: replay.id, replay: true });
    const result = await prisma.$transaction(async (tx) => {
      const step = await tx.experimentStep.findFirst({ where: { id: input.experimentStepId, experimentId: input.experimentId }, include: { experiment: { select: { projectId: true, researchPlanId: true, title: true } } } });
      if (!step) throw new Error("The selected experiment step is no longer available.");
      const rangeValidation = validateMeasurementRange(input.value, input.expectedMin, input.expectedMax);
      const outsideRange = rangeValidation.outsideRange;
      const created = await tx.result.create({ data: {
        experimentId: input.experimentId, experimentStepId: step.id,
        projectId: step.experiment.projectId, researchPlanId: step.experiment.researchPlanId,
        title: `${step.title} · ${input.value} ${input.unit}`, resultType: "Measurement",
        numericValue: input.value, unit: input.unit, observedAt: input.observedAt,
        sampleLabel: input.sampleLabel, expectedMin: input.expectedMin, expectedMax: input.expectedMax,
        notes: input.notes, recordStatus: "recorded", sourceType: "manual",
        qualityStatus: outsideRange ? "warning" : "pass", validationStatus: outsideRange ? "warning" : "valid",
        validationJson: json({ ...rangeValidation, expectedMin: input.expectedMin ?? null, expectedMax: input.expectedMax ?? null }),
        provenanceJson: json({ experimentId: input.experimentId, experimentStepId: step.id, observedAt: input.observedAt.toISOString(), deviceCreatedAt: input.deviceCreatedAt.toISOString() }),
        clientMutationId: input.clientMutationId, deviceCreatedAt: input.deviceCreatedAt,
      } });
      await tx.experimentStepEvent.create({ data: { experimentStepId: step.id, experimentId: input.experimentId, eventType: "measurement", clientMutationId: input.clientMutationId, deviceCreatedAt: input.deviceCreatedAt, payloadJson: json({ resultId: created.id, value: input.value, unit: input.unit, observedAt: input.observedAt.toISOString(), sampleLabel: input.sampleLabel ?? null, outsideExpectedRange: outsideRange }) } });
      await tx.activityLog.create({ data: { action: "create_measurement", targetType: "result", targetId: created.id, metadataJson: json({ experimentId: input.experimentId, experimentStepId: step.id, clientMutationId: input.clientMutationId, outsideExpectedRange: outsideRange }) } });
      return { id: created.id, outsideRange };
    });
    return Response.json({ resultId: result.id, validationStatus: result.outsideRange ? "warning" : "valid" }, { status: 201 });
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "Measurement could not be saved.";
    return Response.json({ error: message }, { status: 400 });
  }
}
