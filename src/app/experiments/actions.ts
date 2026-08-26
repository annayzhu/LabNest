"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ExperimentStatus, RecordLifecycleStatus } from "@/generated/prisma/enums";
import type { ExperimentFormState } from "@/components/ExperimentForm";
import { prisma } from "@/lib/db";
import { experimentSearchText } from "@/lib/experiment-document";
import { createExperimentWithProtocolSnapshot } from "@/lib/experiments";
import { orderedUniqueIds, parseCustomExperimentSteps } from "@/lib/experiment-planning";
import { recordCodeFromSuffix } from "@/lib/record-codes";
import { experimentDeleteBlockers } from "@/lib/record-lifecycle";
import { formActionErrorMessage, type FormActionState } from "@/lib/form-actions";
import { captureDeletedRecord } from "@/lib/recycle-bin";
import { experimentSections, parseScientificDocumentJson } from "@/lib/scientific-document";
import { parseTags } from "@/lib/tags";

const schema = z.object({
  id: z.string().optional(),
  researchPlanId: z.string().min(1, "Research Plan is required."),
  title: z.string().trim().min(1, "Title is required.").max(180),
  date: z.coerce.date(),
  status: z.enum(ExperimentStatus),
  recordStatus: z.enum(RecordLifecycleStatus),
  methodMode: z.enum(["protocol", "custom"]),
});

const lifecycleSchema = z.object({ id: z.string().min(1, "Experiment ID is required."), confirmation: z.string().trim().optional() });

function optionalText(value: FormDataEntryValue | null) { const text = String(value ?? "").trim(); return text || undefined; }
function fields(formData: FormData) {
  const parsed = schema.parse({
    id: optionalText(formData.get("id")), researchPlanId: formData.get("researchPlanId"), title: formData.get("title"), date: formData.get("date"), status: formData.get("status"), recordStatus: formData.get("recordStatus"), methodMode: formData.get("methodMode"),
  });
  const purpose = optionalText(formData.get("purpose"));
  const document = parseScientificDocumentJson(formData.get("contentJson"), experimentSections);
  return {
    parsed,
    purpose,
    tags: parseTags(formData.get("tags")),
    contentJson: document,
    searchText: experimentSearchText(purpose, document),
  };
}

function saveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) {
    const message = error.issues.find((issue) => issue.message.trim())?.message.trim();
    return message || fallback;
  }
  if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
    return "This Experiment code is already in use. Enter a different suffix.";
  }
  const message = error instanceof Error ? error.message.trim() : "";
  return message || fallback;
}

export async function createExperiment(
  _previousState: ExperimentFormState,
  formData: FormData,
): Promise<ExperimentFormState> {
  let experimentId: string;
  let researchPlanId: string;
  try {
    const data = fields(formData);
    const runCode = recordCodeFromSuffix("experiment", String(formData.get("runCodeSuffix") ?? ""));
    const protocolVersionIds = data.parsed.methodMode === "protocol"
      ? orderedUniqueIds(formData.getAll("protocolVersionIds").map(String))
      : [];
    const experiment = await createExperimentWithProtocolSnapshot({
      ...data,
      ...data.parsed,
      runCode,
      methodMode: data.parsed.methodMode,
      protocolVersionIds,
      customSteps: data.parsed.methodMode === "custom" ? parseCustomExperimentSteps(String(formData.get("customSteps") ?? "")) : [],
      createResultTemplates: data.parsed.methodMode === "protocol",
    });
    experimentId = experiment.id;
    researchPlanId = data.parsed.researchPlanId;
  } catch (error) {
    return { error: saveErrorMessage(error, "The Experiment could not be created.") };
  }
  revalidatePath("/experiments");
  revalidatePath("/results");
  revalidatePath(`/research-plans/${researchPlanId}`);
  redirect(`/experiments/${experimentId}`);
}

export async function updateExperiment(
  _previousState: ExperimentFormState,
  formData: FormData,
): Promise<ExperimentFormState> {
  let experimentId: string;
  let researchPlanId: string;
  try {
    const data = fields(formData);
    if (!data.parsed.id) throw new Error("Experiment ID is required.");
    const current = await prisma.experiment.findUnique({ where: { id: data.parsed.id } });
    if (!current) throw new Error("Experiment not found.");
    if (current.researchPlanId !== data.parsed.researchPlanId) throw new Error("An Experiment cannot be moved to a different Research Plan after its ProtocolVersion snapshot is locked.");
    const completedStepIds = new Set(formData.getAll("completedStepIds").map(String));
    await prisma.$transaction(async (tx) => {
      await tx.experiment.update({ where: { id: current.id }, data: {
        title: data.parsed.title, date: data.parsed.date, status: data.parsed.status, recordStatus: data.parsed.recordStatus,
        purpose: data.purpose, tags: data.tags, contentJson: data.contentJson, searchText: data.searchText,
      } });
      const steps = await tx.experimentStep.findMany({ where: { experimentId: current.id }, select: { id: true, completed: true } });
      for (const step of steps) {
        const completed = completedStepIds.has(step.id);
        if (completed !== step.completed) await tx.experimentStep.update({ where: { id: step.id }, data: { completed, completedAt: completed ? new Date() : null } });
      }
      if (current.primaryProtocolVersionId) await tx.protocolRun.updateMany({ where: { experimentId: current.id }, data: { status: data.parsed.status } });
      await tx.activityLog.create({ data: { action: "update", targetType: "experiment", targetId: current.id, metadataJson: { status: data.parsed.status, recordStatus: data.parsed.recordStatus } } });
    });
    experimentId = current.id;
    researchPlanId = data.parsed.researchPlanId;
  } catch (error) {
    return { error: saveErrorMessage(error, "The Experiment could not be saved.") };
  }
  revalidatePath("/experiments");
  revalidatePath(`/experiments/${experimentId}`);
  revalidatePath(`/research-plans/${researchPlanId}`);
  redirect(`/experiments/${experimentId}`);
}

export async function archiveExperiment(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let experimentId: string;
  try {
    const parsed = lifecycleSchema.parse({ id: formData.get("id") });
    const experiment = await prisma.experiment.findUnique({ where: { id: parsed.id }, select: { id: true, runCode: true, title: true, status: true } });
    if (!experiment) throw new Error("This Experiment no longer exists.");
    await prisma.$transaction([
      prisma.experiment.update({ where: { id: experiment.id }, data: { status: "archived" } }),
      prisma.protocolRun.updateMany({ where: { experimentId: experiment.id }, data: { status: "archived" } }),
      prisma.activityLog.create({ data: { action: "archive", targetType: "experiment", targetId: experiment.id, metadataJson: { runCode: experiment.runCode, title: experiment.title, previousStatus: experiment.status } } }),
    ]);
    experimentId = experiment.id;
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Experiment could not be archived.") };
  }
  revalidatePath("/experiments");
  revalidatePath(`/experiments/${experimentId}`);
  redirect(`/experiments/${experimentId}`);
}

export async function deleteExperiment(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let researchPlanId: string | null = null;
  try {
    const parsed = lifecycleSchema.parse({ id: formData.get("id"), confirmation: formData.get("confirmation") });
    researchPlanId = await prisma.$transaction(async (tx) => {
      const experiment = await tx.experiment.findUnique({
        where: { id: parsed.id },
        select: {
          id: true,
          runCode: true,
          title: true,
          status: true,
          recordStatus: true,
          projectId: true,
          researchPlanId: true,
          protocolRun: { select: { id: true } },
          _count: { select: { results: true, inventoryTransactions: true, sampleEvents: true } },
        },
      });
      if (!experiment) throw new Error("This Experiment no longer exists.");
      if (parsed.confirmation !== experiment.runCode) throw new Error(`Enter ${experiment.runCode} exactly to confirm moving it to the Recycle Bin.`);
      const [completedSteps, deviations, attachments, reportSourceReferences, entryReferences, proposedActions] = await Promise.all([
        tx.experimentStep.count({ where: { experimentId: experiment.id, completed: true } }),
        tx.experimentStep.count({ where: { experimentId: experiment.id, deviationNote: { not: null } } }),
        tx.attachmentLink.count({ where: { targetType: "experiment", targetId: experiment.id } }),
        tx.reportSource.count({ where: { sourceType: "experiment", sourceId: experiment.id } }),
        tx.itemLink.count({ where: { sourceType: "entry", targetType: "experiment", targetId: experiment.id } }),
        experiment.protocolRun ? tx.proposedAction.count({ where: { sourceType: "protocol", sourceId: experiment.protocolRun.id } }) : Promise.resolve(0),
      ]);
      const counts = { ...experiment._count, completedSteps, deviations, attachments, reportSourceReferences, entryReferences, proposedActions };
      const blockers = experimentDeleteBlockers(experiment.status, experiment.recordStatus, counts);
      if (blockers.length) throw new Error("This Experiment contains execution evidence and can only be archived.");

      const recycled = await captureDeletedRecord(tx, "experiment", experiment.id);
      await tx.attachmentLink.deleteMany({ where: { targetType: "experiment", targetId: experiment.id } });
      await tx.itemLink.deleteMany({ where: { OR: [{ sourceType: "experiment", sourceId: experiment.id }, { targetType: "experiment", targetId: experiment.id }] } });
      await tx.activityLog.create({ data: { action: "delete", targetType: "experiment", targetId: experiment.id, metadataJson: { recycleBinId: recycled.id, runCode: experiment.runCode, title: experiment.title, status: experiment.status, recordStatus: experiment.recordStatus, projectId: experiment.projectId, researchPlanId: experiment.researchPlanId, dependencyCounts: counts } } });
      await tx.experiment.delete({ where: { id: experiment.id } });
      return experiment.researchPlanId;
    });
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Experiment could not be moved to the recycle bin.") };
  }
  revalidatePath("/");
  revalidatePath("/experiments");
  revalidatePath("/research-plans");
  if (researchPlanId) revalidatePath(`/research-plans/${researchPlanId}`);
  revalidatePath("/search");
  redirect("/experiments");
}
