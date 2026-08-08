"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createExperimentWithProtocolSnapshot } from "@/lib/experiments";
import { experimentSections, parseScientificDocumentJson } from "@/lib/scientific-document";

const schema = z.object({
  id: z.string().optional(),
  researchPlanId: z.string().min(1),
  runCode: z.string().trim().max(48).optional(),
  title: z.string().trim().min(1).max(180),
  date: z.coerce.date(),
  status: z.enum(["planned", "running", "completed", "failed", "archived"]),
  recordStatus: z.enum(["draft", "recorded", "submitted", "reviewed"]),
  primaryProtocolVersionId: z.string().optional(),
});

function optionalText(value: FormDataEntryValue | null) { const text = String(value ?? "").trim(); return text || undefined; }
function tags(value: FormDataEntryValue | null) { return String(value ?? "").split(",").map((tag) => tag.trim()).filter(Boolean); }
function fields(formData: FormData) {
  const parsed = schema.parse({
    id: optionalText(formData.get("id")), researchPlanId: formData.get("researchPlanId"), runCode: optionalText(formData.get("runCode")), title: formData.get("title"), date: formData.get("date"), status: formData.get("status"), recordStatus: formData.get("recordStatus"), primaryProtocolVersionId: optionalText(formData.get("primaryProtocolVersionId")),
  });
  return {
    parsed,
    purpose: optionalText(formData.get("purpose")), background: optionalText(formData.get("background")), materialsText: optionalText(formData.get("materialsText")), stepsText: optionalText(formData.get("stepsText")), observations: optionalText(formData.get("observations")), resultSummary: optionalText(formData.get("resultSummary")), conclusion: optionalText(formData.get("conclusion")), deviations: optionalText(formData.get("deviations")),
    tags: tags(formData.get("tags")),
    contentJson: parseScientificDocumentJson(formData.get("contentJson"), experimentSections),
  };
}

export async function createExperiment(formData: FormData) {
  const data = fields(formData);
  if (!data.parsed.primaryProtocolVersionId) throw new Error("A primary ProtocolVersion is required.");
  const experiment = await createExperimentWithProtocolSnapshot({
    ...data,
    ...data.parsed,
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
      runCode: data.parsed.runCode, title: data.parsed.title, date: data.parsed.date, status: data.parsed.status, recordStatus: data.parsed.recordStatus,
      purpose: data.purpose, background: data.background, materialsText: data.materialsText, stepsText: data.stepsText, observations: data.observations, resultSummary: data.resultSummary, conclusion: data.conclusion, deviations: data.deviations, tags: data.tags, contentJson: data.contentJson,
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
