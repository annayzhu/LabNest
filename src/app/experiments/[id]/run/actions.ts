"use server";

import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { appendExperimentObservation, experimentSearchText } from "@/lib/experiment-document";
import { formActionErrorMessage } from "@/lib/form-actions";
import { remainingStepTimerSeconds } from "@/lib/step-timer";

export type ProtocolRunProgressState = { error?: string; message?: string; savedAt?: string };
export type StepTimerActionState = ProtocolRunProgressState;

const progressSchema = z.object({
  experimentId: z.string().min(1),
  intent: z.enum(["save", "start", "complete"]),
  quickNote: z.string().trim().max(10_000).optional(),
  completedCurrentStepId: z.string().trim().optional(),
  clientMutationId: z.string().uuid().optional(),
  deviceCreatedAt: z.coerce.date().optional(),
});

const consumptionSchema = z.object({
  experimentId: z.string().min(1),
  inventoryItemId: z.string().min(1),
  experimentStepId: z.string().optional(),
  quantity: z.coerce.number().finite().positive(),
  performedBy: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2_000).optional(),
});

const stepTimerSchema = z.object({
  experimentId: z.string().min(1),
  stepId: z.string().min(1),
  timerIntent: z.enum(["start", "pause", "reset"]),
  durationMinutes: z.coerce.number().finite().min(0.1).max(24 * 60).optional(),
});

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

export async function saveProtocolRunProgress(
  _previousState: ProtocolRunProgressState,
  formData: FormData,
): Promise<ProtocolRunProgressState> {
  let parsed: z.infer<typeof progressSchema>;
  try {
    parsed = progressSchema.parse({
      experimentId: formData.get("experimentId"),
      intent: optionalText(formData.get("intent")) ?? "save",
      quickNote: optionalText(formData.get("quickNote")),
      completedCurrentStepId: optionalText(formData.get("completedCurrentStepId")),
      clientMutationId: optionalText(formData.get("clientMutationId")),
      deviceCreatedAt: optionalText(formData.get("deviceCreatedAt")),
    });
    if (parsed.clientMutationId) {
      const replay = await prisma.experimentStepEvent.findUnique({ where: { clientMutationId: parsed.clientMutationId }, select: { id: true } });
      if (replay) return { message: "Step completion already saved.", savedAt: new Date().toISOString() };
    }
    const completedStepIds = new Set(formData.getAll("completedStepIds").map(String));
    if (parsed.completedCurrentStepId) completedStepIds.add(parsed.completedCurrentStepId);
    const recordedAt = new Date();

    await prisma.$transaction(async (tx) => {
    const experiment = await tx.experiment.findUnique({
      where: { id: parsed.experimentId },
      include: { steps: { orderBy: [{ groupOrder: "asc" }, { order: "asc" }] } },
    });
    if (!experiment) throw new Error("Experiment not found.");
    if (experiment.status === "archived") throw new Error("An archived Experiment cannot be changed in Run mode.");

    const knownStepIds = new Set(experiment.steps.map((step) => step.id));
    const unknownStep = [...completedStepIds].find((id) => !knownStepIds.has(id));
    if (unknownStep) throw new Error("A submitted step does not belong to this Experiment.");

    if (parsed.intent === "complete" && experiment.steps.some((step) => !completedStepIds.has(step.id))) {
      throw new Error("Complete every execution step before marking the Experiment completed.");
    }

    const allStepsCompleted = experiment.steps.every((step) => completedStepIds.has(step.id));
    const nextStatus = parsed.intent === "complete"
      ? "completed" as const
      : parsed.intent === "start" || (experiment.status === "planned" && (completedStepIds.size > 0 || parsed.quickNote))
        ? "running" as const
        : experiment.status === "completed" && !allStepsCompleted
          ? "running" as const
        : experiment.status;
    const contentJson = parsed.quickNote
      ? appendExperimentObservation(experiment.contentJson, {
          id: `run-note-${randomUUID()}`,
          text: parsed.quickNote,
          recordedAt,
        })
      : experiment.contentJson;

    await tx.experiment.update({
      where: { id: experiment.id },
      data: {
        status: nextStatus,
        contentJson: contentJson as Prisma.InputJsonValue,
        searchText: experimentSearchText(experiment.purpose, contentJson),
      },
    });

    for (const step of experiment.steps) {
      const completed = completedStepIds.has(step.id);
      const deviationNote = parsed.completedCurrentStepId
        ? step.id === parsed.completedCurrentStepId
          ? optionalText(formData.get(`mobileDeviation:${step.id}`))
          : step.deviationNote ?? undefined
        : optionalText(formData.get(`deviation:${step.id}`));
      const deviationType = parsed.completedCurrentStepId === step.id ? optionalText(formData.get(`mobileDeviationType:${step.id}`)) : step.deviationType ?? undefined;
      const deviationImpact = parsed.completedCurrentStepId === step.id ? optionalText(formData.get(`mobileDeviationImpact:${step.id}`)) : step.deviationImpact ?? undefined;
      const deviationAuthor = parsed.completedCurrentStepId === step.id ? optionalText(formData.get(`mobileDeviationAuthor:${step.id}`)) : step.deviationAuthor ?? undefined;
      if ((deviationNote?.length ?? 0) > 5_000) throw new Error(`Deviation note for step ${step.order} is too long.`);
      if ((deviationImpact?.length ?? 0) > 5_000) throw new Error(`Deviation impact for step ${step.order} is too long.`);
      if (!step.allowsDeviation && deviationNote) throw new Error(`Step ${step.order} does not allow a deviation record.`);
      if (completed !== step.completed || deviationNote !== (step.deviationNote ?? undefined) || deviationType !== (step.deviationType ?? undefined) || deviationImpact !== (step.deviationImpact ?? undefined) || deviationAuthor !== (step.deviationAuthor ?? undefined)) {
        await tx.experimentStep.update({
          where: { id: step.id },
          data: {
            completed,
            completedAt: completed ? step.completedAt ?? recordedAt : null,
            deviationNote: deviationNote ?? null,
            deviationType: deviationNote ? deviationType ?? "other" : null,
            deviationImpact: deviationNote ? deviationImpact ?? null : null,
            deviationAuthor: deviationNote ? deviationAuthor ?? null : null,
            deviationAt: deviationNote ? recordedAt : null,
          },
        });
        if (parsed.completedCurrentStepId === step.id) {
          await tx.experimentStepEvent.create({
            data: {
              experimentStepId: step.id,
              experimentId: experiment.id,
              eventType: completed ? "completed" : "reopened",
              clientMutationId: parsed.clientMutationId,
              deviceCreatedAt: parsed.deviceCreatedAt,
              payloadJson: { previousCompleted: step.completed, completed, deviationType: deviationType ?? null, actualExecution: deviationNote ?? null, impactAssessment: deviationImpact ?? null, author: deviationAuthor ?? null },
            },
          });
        }
      }
    }

    if (experiment.primaryProtocolVersionId) {
      await tx.protocolRun.upsert({
        where: { experimentId: experiment.id },
        create: {
          experimentId: experiment.id,
          protocolVersionId: experiment.primaryProtocolVersionId,
          status: nextStatus,
          parametersJson: {},
          calculatedConsumptionJson: [],
        },
        update: { status: nextStatus },
      });
    }
    await tx.activityLog.create({
      data: {
        action: `protocol_run_${parsed.intent}`,
        targetType: "experiment",
        targetId: experiment.id,
        metadataJson: {
          status: nextStatus,
          completedSteps: completedStepIds.size,
          totalSteps: experiment.steps.length,
          quickNoteAdded: Boolean(parsed.quickNote),
        },
      },
    });
    });
  } catch (error) {
    return { error: formActionErrorMessage(error, "Run progress could not be saved.") };
  }

  revalidatePath("/protocol-run");
  revalidatePath("/experiments");
  revalidatePath(`/experiments/${parsed.experimentId}`);
  revalidatePath(`/experiments/${parsed.experimentId}/run`);
  const message = parsed.intent === "start" ? "Run started." : parsed.intent === "complete" ? "Run completed." : "Progress saved.";
  return { message, savedAt: new Date().toISOString() };
}

export async function updateStepTimer(
  _previousState: StepTimerActionState,
  formData: FormData,
): Promise<StepTimerActionState> {
  let parsed: z.infer<typeof stepTimerSchema>;
  try {
    parsed = stepTimerSchema.parse({
      experimentId: formData.get("experimentId"),
      stepId: formData.get("stepId"),
      timerIntent: formData.get("timerIntent"),
      durationMinutes: optionalText(formData.get("durationMinutes")),
    });
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const step = await tx.experimentStep.findFirst({
        where: { id: parsed.stepId, experimentId: parsed.experimentId },
        include: { experiment: { select: { status: true } } },
      });
      if (!step) throw new Error("Experiment step not found.");
      if (step.experiment.status === "archived") throw new Error("An archived Experiment cannot change timers.");

      const submittedDuration = parsed.durationMinutes ? Math.round(parsed.durationMinutes * 60) : undefined;
      const durationSeconds = submittedDuration ?? step.timerDurationSeconds ?? 300;
      const currentRemaining = remainingStepTimerSeconds({
        remainingSeconds: step.timerRemainingSeconds ?? durationSeconds,
        startedAt: step.timerStartedAt,
        now,
      });
      const timerData = parsed.timerIntent === "pause"
        ? { timerDurationSeconds: durationSeconds, timerRemainingSeconds: currentRemaining, timerStartedAt: null, timerPausedAt: now }
        : parsed.timerIntent === "reset"
          ? { timerDurationSeconds: durationSeconds, timerRemainingSeconds: durationSeconds, timerStartedAt: null, timerPausedAt: null }
          : { timerDurationSeconds: durationSeconds, timerRemainingSeconds: currentRemaining > 0 ? currentRemaining : durationSeconds, timerStartedAt: now, timerPausedAt: null };

      await tx.experimentStep.update({ where: { id: step.id }, data: timerData });
      await tx.activityLog.create({
        data: {
          action: `experiment_step_timer_${parsed.timerIntent}`,
          targetType: "experiment_step",
          targetId: step.id,
          metadataJson: { experimentId: parsed.experimentId, durationSeconds, remainingSeconds: timerData.timerRemainingSeconds },
        },
      });
    });
  } catch (error) {
    return { error: formActionErrorMessage(error, "Timer could not be updated.") };
  }

  revalidatePath("/");
  revalidatePath(`/experiments/${parsed.experimentId}/run`);
  return { message: `Timer ${parsed.timerIntent === "start" ? "started" : parsed.timerIntent === "pause" ? "paused" : "reset"}.`, savedAt: new Date().toISOString() };
}

export async function recordProtocolRunConsumption(formData: FormData) {
  const parsed = consumptionSchema.parse({
    experimentId: formData.get("experimentId"),
    inventoryItemId: formData.get("inventoryItemId"),
    experimentStepId: optionalText(formData.get("experimentStepId")),
    quantity: formData.get("quantity"),
    performedBy: optionalText(formData.get("performedBy")),
    notes: optionalText(formData.get("notes")),
  });

  await prisma.$transaction(async (tx) => {
    const [experiment, item, step] = await Promise.all([
      tx.experiment.findUnique({ where: { id: parsed.experimentId }, select: { id: true, status: true } }),
      tx.inventoryItem.findUnique({ where: { id: parsed.inventoryItemId } }),
      parsed.experimentStepId ? tx.experimentStep.findFirst({ where: { id: parsed.experimentStepId, experimentId: parsed.experimentId }, select: { id: true } }) : null,
    ]);
    if (!experiment) throw new Error("Experiment not found.");
    if (experiment.status === "archived") throw new Error("An archived Experiment cannot consume Inventory.");
    if (!item || item.status !== "active") throw new Error("Inventory Item not found or inactive.");
    if (parsed.experimentStepId && !step) throw new Error("The selected Step does not belong to this Experiment.");

    const nextQuantity = Number((item.currentQuantity - parsed.quantity).toFixed(6));
    if (nextQuantity < 0) throw new Error(`Available stock is ${item.currentQuantity} ${item.unit}.`);

    await tx.inventoryTransaction.create({
      data: {
        inventoryItemId: item.id,
        type: "consume",
        quantityChange: -parsed.quantity,
        unit: item.unit,
        fromLocationId: item.locationId ?? undefined,
        experimentId: experiment.id,
        experimentStepId: step?.id,
        performedBy: parsed.performedBy,
        notes: parsed.notes ?? `Consumed during ${experiment.id}.`,
      },
    });
    const updated = await tx.inventoryItem.updateMany({
      where: { id: item.id, currentQuantity: item.currentQuantity },
      data: { currentQuantity: nextQuantity },
    });
    if (updated.count !== 1) throw new Error("Stock changed during submission. Review the latest quantity and try again.");

    await tx.activityLog.create({
      data: {
        action: "consume",
        targetType: "inventory_item",
        targetId: item.id,
        metadataJson: {
          experimentId: experiment.id,
          experimentStepId: step?.id ?? null,
          quantityChange: -parsed.quantity,
          unit: item.unit,
        },
      },
    });
  });

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${parsed.inventoryItemId}`);
  revalidatePath(`/experiments/${parsed.experimentId}`);
  revalidatePath(`/experiments/${parsed.experimentId}/run`);
  redirect(`/experiments/${parsed.experimentId}/run`);
}
