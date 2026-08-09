"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { experimentSearchText } from "@/lib/experiment-document";
import { createExperimentWithProtocolSnapshot } from "@/lib/experiments";
import { recordCodeFromSuffix } from "@/lib/record-codes";
import { experimentSections, parseScientificDocumentJson } from "@/lib/scientific-document";
import { parseTags } from "@/lib/tags";

const schema = z.object({
  id: z.string().optional(),
  researchPlanId: z.string().min(1),
  title: z.string().trim().min(1).max(180),
  date: z.coerce.date(),
  status: z.enum(["planned", "running", "completed", "failed", "archived"]),
  recordStatus: z.enum(["draft", "recorded", "submitted", "reviewed"]),
  primaryProtocolVersionId: z.string().optional(),
});

function optionalText(value: FormDataEntryValue | null) { const text = String(value ?? "").trim(); return text || undefined; }
function fields(formData: FormData) {
  const parsed = schema.parse({
    id: optionalText(formData.get("id")), researchPlanId: formData.get("researchPlanId"), title: formData.get("title"), date: formData.get("date"), status: formData.get("status"), recordStatus: formData.get("recordStatus"), primaryProtocolVersionId: optionalText(formData.get("primaryProtocolVersionId")),
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

export async function createExperiment(formData: FormData) {
  const data = fields(formData);
  if (!data.parsed.primaryProtocolVersionId) throw new Error("A primary ProtocolVersion is required.");
  const runCode = recordCodeFromSuffix("experiment", String(formData.get("runCodeSuffix") ?? ""));
  const experiment = await createExperimentWithProtocolSnapshot({
    ...data,
    ...data.parsed,
    runCode,
    primaryProtocolVersionId: data.parsed.primaryProtocolVersionId,
    supportingProtocolVersionIds: formData.getAll("supportingProtocolVersionIds").map(String).filter((id) => id !== data.parsed.primaryProtocolVersionId),
    createResultTemplates: formData.get("createResultTemplates") === "on",
  });
  revalidatePath("/experiments"); revalidatePath("/results"); revalidatePath(`/research-plans/${data.parsed.researchPlanId}`);
  redirect(`/experiments/${experiment.id}`);
}

export async function updateExperiment(formData: FormData) {
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
  revalidatePath("/experiments"); revalidatePath(`/experiments/${current.id}`); revalidatePath(`/research-plans/${data.parsed.researchPlanId}`);
  redirect(`/experiments/${current.id}`);
}
