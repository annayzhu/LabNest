"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { normalizeResultTemplates, parseResultValuesJson, validateResultRecord } from "@/lib/result-templates";
import { parseScientificDocumentJson, resultSections } from "@/lib/scientific-document";

const resultSchema = z.object({
  id: z.string().optional(), experimentId: z.string().min(1), title: z.string().trim().min(1).max(180), resultType: z.string().trim().min(1).max(100),
  recordStatus: z.enum(["draft", "recorded", "submitted", "reviewed"]), sourceType: z.enum(["manual", "protocol_template", "file_import", "tool", "analysis"]), qualityStatus: z.enum(["not_assessed", "pass", "warning", "fail"]),
});
function optionalText(value: FormDataEntryValue | null) { const text = String(value ?? "").trim(); return text || undefined; }
function optionalNumber(value: FormDataEntryValue | null) { const text = optionalText(value); if (!text) return undefined; const number = Number(text); if (!Number.isFinite(number)) throw new Error("Numeric value must be finite."); return number; }
function fields(formData: FormData) {
  const parsed = resultSchema.parse({ id: optionalText(formData.get("id")), experimentId: formData.get("experimentId"), title: formData.get("title"), resultType: formData.get("resultType"), recordStatus: formData.get("recordStatus"), sourceType: formData.get("sourceType"), qualityStatus: formData.get("qualityStatus") });
  return { parsed, templateKey: optionalText(formData.get("templateKey")), templateInstanceKey: optionalText(formData.get("templateInstanceKey")), templateInstanceLabel: optionalText(formData.get("templateInstanceLabel")), textValue: optionalText(formData.get("textValue")), numericValue: optionalNumber(formData.get("numericValue")), unit: optionalText(formData.get("unit")), analysisMethod: optionalText(formData.get("analysisMethod")), notes: optionalText(formData.get("notes")), valuesJson: parseResultValuesJson(formData.get("templateValuesJson")), contentJson: parseScientificDocumentJson(formData.get("contentJson"), resultSections) };
}

export async function createResult(formData: FormData) {
  const data = fields(formData);
  const experiment = await prisma.experiment.findUnique({ where: { id: data.parsed.experimentId }, select: { id: true, projectId: true, researchPlanId: true, primaryProtocolVersionId: true, primaryProtocolVersion: { select: { resultTemplatesJson: true } } } });
  if (!experiment) throw new Error("Selected Experiment does not exist.");
  const template = data.templateKey ? normalizeResultTemplates(experiment.primaryProtocolVersion?.resultTemplatesJson).find((item) => item.templateKey === data.templateKey) : undefined;
  if (data.templateKey && !template) throw new Error("The selected Result Template is not part of this Experiment's locked primary ProtocolVersion.");
  const validation = validateResultRecord({ template, values: data.valuesJson, instanceKey: data.templateInstanceKey });
  if (["submitted", "reviewed"].includes(data.parsed.recordStatus) && !validation.complete) throw new Error(`This Result cannot be ${data.parsed.recordStatus}: ${validation.errors.join(" ")}`);
  const result = await prisma.result.create({ data: {
    experimentId: experiment.id, projectId: experiment.projectId, researchPlanId: experiment.researchPlanId,
    protocolVersionId: template ? experiment.primaryProtocolVersionId : undefined,
    title: data.parsed.title, resultType: template?.result_type ?? data.parsed.resultType, recordStatus: data.parsed.recordStatus, sourceType: template ? "protocol_template" : data.parsed.sourceType, qualityStatus: data.parsed.qualityStatus,
    templateKey: template?.templateKey, templateInstanceKey: template ? data.templateInstanceKey : undefined, templateInstanceLabel: template ? data.templateInstanceLabel : undefined,
    templateSnapshotJson: (template ?? {}) as Prisma.InputJsonValue, valuesJson: data.valuesJson as Prisma.InputJsonValue, validationStatus: validation.status, validationJson: validation as unknown as Prisma.InputJsonValue, viewSpecJson: (template?.view ?? {}) as Prisma.InputJsonValue,
    textValue: data.textValue, numericValue: data.numericValue, unit: data.unit, analysisMethod: data.analysisMethod, notes: data.notes, contentJson: data.contentJson,
    provenanceJson: { experimentId: experiment.id, researchPlanId: experiment.researchPlanId, projectId: experiment.projectId, protocolVersionId: template ? experiment.primaryProtocolVersionId : undefined },
    metadataJson: template ? { templateKey: template.templateKey, cardinality: template.cardinality, viewPreset: template.view?.preset } : {},
  } });
  await prisma.$transaction([
    prisma.itemLink.create({ data: { sourceType: "result", sourceId: result.id, targetType: "experiment", targetId: experiment.id, linkType: "produced_by", createdBy: "user" } }),
    prisma.activityLog.create({ data: { action: "create", targetType: "result", targetId: result.id, metadataJson: { experimentId: experiment.id, sourceType: data.parsed.sourceType } } }),
  ]);
  revalidatePath("/results"); revalidatePath(`/experiments/${experiment.id}`); if (experiment.researchPlanId) revalidatePath(`/research-plans/${experiment.researchPlanId}`);
  redirect(`/results/${result.id}`);
}

export async function updateResult(formData: FormData) {
  const data = fields(formData);
  if (!data.parsed.id) throw new Error("Result ID is required.");
  const [current, attachmentLinks] = await Promise.all([
    prisma.result.findUnique({ where: { id: data.parsed.id }, include: { datasets: { select: { templateDatasetKey: true, validationStatus: true } } } }),
    prisma.attachmentLink.findMany({ where: { targetType: "result", targetId: data.parsed.id }, select: { linkType: true } }),
  ]);
  if (!current) throw new Error("Result not found.");
  if (current.experimentId !== data.parsed.experimentId) throw new Error("A Result cannot be moved to another Experiment; create a new Result to preserve provenance.");
  if (current.templateKey && current.resultType !== data.parsed.resultType) throw new Error("A template-created Result cannot change result type; create a new Result instead.");
  if (current.templateKey && current.sourceType !== data.parsed.sourceType) throw new Error("A template-created Result cannot change source type.");
  const validation = validateResultRecord({
    template: current.templateSnapshotJson,
    values: data.valuesJson,
    instanceKey: data.templateInstanceKey,
    datasetStatuses: current.datasets,
    artifactKeys: attachmentLinks.flatMap((link) => link.linkType.startsWith("template_artifact:") ? [link.linkType.slice("template_artifact:".length)] : []),
  });
  if (["submitted", "reviewed"].includes(data.parsed.recordStatus) && !validation.complete) {
    throw new Error(`This Result cannot be ${data.parsed.recordStatus}: ${validation.errors.join(" ")}`);
  }
  await prisma.$transaction([
    prisma.result.update({ where: { id: current.id }, data: { title: data.parsed.title, resultType: data.parsed.resultType, recordStatus: data.parsed.recordStatus, sourceType: data.parsed.sourceType, qualityStatus: data.parsed.qualityStatus, validationStatus: validation.status, validationJson: validation as unknown as Prisma.InputJsonValue, templateInstanceKey: current.templateKey ? data.templateInstanceKey : current.templateInstanceKey, templateInstanceLabel: current.templateKey ? data.templateInstanceLabel : current.templateInstanceLabel, textValue: data.textValue, numericValue: data.numericValue, unit: data.unit, analysisMethod: data.analysisMethod, notes: data.notes, valuesJson: data.valuesJson as Prisma.InputJsonValue, contentJson: data.contentJson } }),
    prisma.activityLog.create({ data: { action: "update", targetType: "result", targetId: current.id, metadataJson: { recordStatus: data.parsed.recordStatus, qualityStatus: data.parsed.qualityStatus, validationStatus: validation.status } } }),
  ]);
  revalidatePath("/results"); revalidatePath(`/results/${current.id}`); revalidatePath(`/experiments/${current.experimentId}`);
  redirect(`/results/${current.id}`);
}
