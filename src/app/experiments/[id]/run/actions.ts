"use server";

import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { appendExperimentObservation, experimentSearchText } from "@/lib/experiment-document";
import { formActionErrorMessage } from "@/lib/form-actions";

export type ProtocolRunProgressState = { error?: string; message?: string; savedAt?: string };

const progressSchema = z.object({
  experimentId: z.string().min(1),
  intent: z.enum(["save", "start", "complete"]),
  quickNote: z.string().trim().max(10_000).optional(),
});

const consumptionSchema = z.object({
  experimentId: z.string().min(1),
  inventoryItemId: z.string().min(1),
  quantity: z.coerce.number().finite().positive(),
  performedBy: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2_000).optional(),
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
    });
    const completedStepIds = new Set(formData.getAll("completedStepIds").map(String));
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
      const deviationNote = optionalText(formData.get(`deviation:${step.id}`));
      if ((deviationNote?.length ?? 0) > 5_000) throw new Error(`Deviation note for step ${step.order} is too long.`);
      if (completed !== step.completed || deviationNote !== (step.deviationNote ?? undefined)) {
        await tx.experimentStep.update({
          where: { id: step.id },
          data: {
            completed,
            completedAt: completed ? step.completedAt ?? recordedAt : null,
            deviationNote: deviationNote ?? null,
          },
        });
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

export async function recordProtocolRunConsumption(formData: FormData) {
  const parsed = consumptionSchema.parse({
    experimentId: formData.get("experimentId"),
    inventoryItemId: formData.get("inventoryItemId"),
    quantity: formData.get("quantity"),
    performedBy: optionalText(formData.get("performedBy")),
    notes: optionalText(formData.get("notes")),
  });

  await prisma.$transaction(async (tx) => {
    const [experiment, item] = await Promise.all([
      tx.experiment.findUnique({ where: { id: parsed.experimentId }, select: { id: true, status: true } }),
      tx.inventoryItem.findUnique({ where: { id: parsed.inventoryItemId } }),
    ]);
    if (!experiment) throw new Error("Experiment not found.");
    if (experiment.status === "archived") throw new Error("An archived Experiment cannot consume Inventory.");
    if (!item || item.status !== "active") throw new Error("Inventory Item not found or inactive.");

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
