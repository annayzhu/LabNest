"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { isSingleResultTemplate } from "@/lib/experiment-results";
import { formActionErrorMessage, type FormActionState } from "@/lib/form-actions";
import { normalizeResultTemplates, parseResultValuesJson, validateResultRecord } from "@/lib/result-templates";
import { resultRequiresAssociationPreservingRecycle } from "@/lib/record-lifecycle";
import { captureDeletedRecord } from "@/lib/recycle-bin";
import { normalizeResultDocument, parseScientificDocumentJson, resultSections } from "@/lib/scientific-document";

const resultSchema = z.object({
  id: z.string().optional(), experimentId: z.string().min(1, "Experiment is required."), title: z.string().trim().min(1, "Title is required.").max(180), resultType: z.string().trim().min(1, "Result type is required.").max(100),
  recordStatus: z.enum(["draft", "recorded", "submitted", "reviewed"]), sourceType: z.enum(["manual", "protocol_template", "file_import", "tool", "analysis"]), qualityStatus: z.enum(["not_assessed", "pass", "warning", "fail"]),
});
const lifecycleSchema = z.object({ id: z.string().min(1, "Result ID is required."), confirmation: z.string().trim().optional() });
function optionalText(value: FormDataEntryValue | null) { const text = String(value ?? "").trim(); return text || undefined; }
function optionalNumber(value: FormDataEntryValue | null) { const text = optionalText(value); if (!text) return undefined; const number = Number(text); if (!Number.isFinite(number)) throw new Error("Numeric value must be finite."); return number; }
function fields(formData: FormData) {
  const parsed = resultSchema.parse({ id: optionalText(formData.get("id")), experimentId: formData.get("experimentId"), title: formData.get("title"), resultType: formData.get("resultType"), recordStatus: formData.get("recordStatus"), sourceType: formData.get("sourceType"), qualityStatus: formData.get("qualityStatus") });
  return { parsed, templateKey: optionalText(formData.get("templateKey")), templateProtocolVersionId: optionalText(formData.get("templateProtocolVersionId")), templateInstanceKey: optionalText(formData.get("templateInstanceKey")), templateInstanceLabel: optionalText(formData.get("templateInstanceLabel")), textValue: optionalText(formData.get("textValue")), numericValue: optionalNumber(formData.get("numericValue")), unit: optionalText(formData.get("unit")), analysisMethod: optionalText(formData.get("analysisMethod")), notes: optionalText(formData.get("notes")), valuesJson: parseResultValuesJson(formData.get("templateValuesJson")), contentJson: normalizeResultDocument(parseScientificDocumentJson(formData.get("contentJson"), resultSections)) };
}

async function persistNewResult(formData: FormData) {
  const data = fields(formData);
  const experiment = await prisma.experiment.findUnique({ where: { id: data.parsed.experimentId }, select: { id: true, projectId: true, researchPlanId: true, primaryProtocolVersionId: true, protocolVersions: { orderBy: { order: "asc" }, select: { protocolVersionId: true, protocolVersion: { select: { resultTemplatesJson: true } } } } } });
  if (!experiment) throw new Error("Selected Experiment does not exist.");
  const templateVersionLink = data.templateKey
    ? data.templateProtocolVersionId
      ? experiment.protocolVersions.find((link) => link.protocolVersionId === data.templateProtocolVersionId)
      : experiment.protocolVersions.find((link) => normalizeResultTemplates(link.protocolVersion.resultTemplatesJson).some((item) => item.templateKey === data.templateKey))
    : undefined;
  const template = data.templateKey ? normalizeResultTemplates(templateVersionLink?.protocolVersion.resultTemplatesJson).find((item) => item.templateKey === data.templateKey) : undefined;
  if (data.templateKey && (!template || !templateVersionLink)) throw new Error("The selected Result Template is not part of this Experiment's locked ProtocolVersions.");
  if (template && templateVersionLink && isSingleResultTemplate(template)) {
    const existing = await prisma.result.findFirst({ where: { experimentId: experiment.id, protocolVersionId: templateVersionLink.protocolVersionId, templateKey: template.templateKey, sourceType: "protocol_template", status: { not: "archived" } }, select: { id: true, title: true } });
    if (existing) throw new Error(`This Protocol template already has a Result record (${existing.title}). Open the existing record instead of creating a duplicate.`);
  }
  if (!template) {
    const typeDefinition = await prisma.resultTypeDefinition.findUnique({ where: { label: data.parsed.resultType }, select: { id: true } });
    if (!typeDefinition) throw new Error("Choose an available Result type or add it in Manage types.");
  }
  const validation = validateResultRecord({ template, values: data.valuesJson, instanceKey: data.templateInstanceKey });
  if (["submitted", "reviewed"].includes(data.parsed.recordStatus) && !validation.complete) throw new Error(`This Result cannot be ${data.parsed.recordStatus}: ${validation.errors.join(" ")}`);
  const result = await prisma.result.create({ data: {
    experimentId: experiment.id, projectId: experiment.projectId, researchPlanId: experiment.researchPlanId,
    protocolVersionId: template ? templateVersionLink?.protocolVersionId : undefined,
    title: data.parsed.title, resultType: template?.result_type ?? data.parsed.resultType, recordStatus: data.parsed.recordStatus, sourceType: template ? "protocol_template" : data.parsed.sourceType, qualityStatus: data.parsed.qualityStatus,
    templateKey: template?.templateKey, templateInstanceKey: template ? data.templateInstanceKey : undefined, templateInstanceLabel: template ? data.templateInstanceLabel : undefined,
    templateSnapshotJson: (template ?? {}) as Prisma.InputJsonValue, valuesJson: data.valuesJson as Prisma.InputJsonValue, validationStatus: validation.status, validationJson: validation as unknown as Prisma.InputJsonValue, viewSpecJson: (template?.view ?? {}) as Prisma.InputJsonValue,
    textValue: data.textValue, numericValue: data.numericValue, unit: data.unit, analysisMethod: data.analysisMethod, notes: data.notes, contentJson: data.contentJson,
    provenanceJson: { experimentId: experiment.id, researchPlanId: experiment.researchPlanId, projectId: experiment.projectId, protocolVersionId: template ? templateVersionLink?.protocolVersionId : undefined },
    metadataJson: template ? { templateKey: template.templateKey, cardinality: template.cardinality, viewPreset: template.view?.preset } : {},
  } });
  await prisma.$transaction([
    prisma.itemLink.create({ data: { sourceType: "result", sourceId: result.id, targetType: "experiment", targetId: experiment.id, linkType: "produced_by", createdBy: "user" } }),
    prisma.activityLog.create({ data: { action: "create", targetType: "result", targetId: result.id, metadataJson: { experimentId: experiment.id, sourceType: data.parsed.sourceType } } }),
  ]);
  return { resultId: result.id, experimentId: experiment.id, researchPlanId: experiment.researchPlanId };
}

export async function createResult(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let saved: Awaited<ReturnType<typeof persistNewResult>>;
  try {
    saved = await persistNewResult(formData);
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Result could not be created.") };
  }
  revalidatePath("/results");
  revalidatePath(`/experiments/${saved.experimentId}`);
  if (saved.researchPlanId) revalidatePath(`/research-plans/${saved.researchPlanId}`);
  redirect(`/results/${saved.resultId}`);
}

async function persistResultUpdate(formData: FormData) {
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
  if (!current.templateKey && current.resultType !== data.parsed.resultType) {
    const typeDefinition = await prisma.resultTypeDefinition.findUnique({ where: { label: data.parsed.resultType }, select: { id: true } });
    if (!typeDefinition) throw new Error("Choose an available Result type or add it in Manage types.");
  }
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
  return { resultId: current.id, experimentId: current.experimentId };
}

export async function updateResult(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let saved: Awaited<ReturnType<typeof persistResultUpdate>>;
  try {
    saved = await persistResultUpdate(formData);
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Result could not be saved.") };
  }
  revalidatePath("/results");
  revalidatePath(`/results/${saved.resultId}`);
  if (saved.experimentId) revalidatePath(`/experiments/${saved.experimentId}`);
  redirect(`/results/${saved.resultId}`);
}

export async function archiveResult(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let resultId: string;
  try {
    const parsed = lifecycleSchema.parse({ id: formData.get("id") });
    const result = await prisma.result.findUnique({ where: { id: parsed.id }, select: { id: true, title: true, status: true } });
    if (!result) throw new Error("This Result no longer exists.");
    await prisma.$transaction([
      prisma.result.update({ where: { id: result.id }, data: { status: "archived" } }),
      prisma.activityLog.create({ data: { action: "archive", targetType: "result", targetId: result.id, metadataJson: { title: result.title, previousStatus: result.status } } }),
    ]);
    resultId = result.id;
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Result could not be archived.") };
  }
  revalidatePath("/results");
  revalidatePath(`/results/${resultId}`);
  redirect(`/results/${resultId}`);
}

export async function restoreResult(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let resultId: string;
  try {
    const parsed = lifecycleSchema.parse({ id: formData.get("id") });
    const result = await prisma.result.findUnique({ where: { id: parsed.id }, select: { id: true, title: true, status: true } });
    if (!result) throw new Error("This Result no longer exists.");
    if (result.status !== "archived") throw new Error("This Result is not archived.");
    await prisma.$transaction([
      prisma.result.update({ where: { id: result.id }, data: { status: "active" } }),
      prisma.activityLog.create({ data: { action: "restore", targetType: "result", targetId: result.id, metadataJson: { title: result.title, previousStatus: result.status } } }),
    ]);
    resultId = result.id;
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Result could not be restored.") };
  }
  revalidatePath("/results");
  revalidatePath(`/results/${resultId}`);
  redirect(`/results/${resultId}`);
}

export async function deleteResult(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let experimentId: string | null = null;
  try {
    const parsed = lifecycleSchema.parse({ id: formData.get("id"), confirmation: formData.get("confirmation") });
    experimentId = await prisma.$transaction(async (tx) => {
      const result = await tx.result.findUnique({
        where: { id: parsed.id },
        select: { id: true, title: true, resultType: true, status: true, recordStatus: true, experimentId: true, projectId: true, researchPlanId: true, _count: { select: { datasets: true, reportSources: true } } },
      });
      if (!result) throw new Error("This Result no longer exists.");
      if (parsed.confirmation !== result.title) throw new Error(`Enter ${result.title} exactly to confirm moving it to the Recycle Bin.`);
      const [attachments, inboundLinks] = await Promise.all([
        tx.attachmentLink.count({ where: { targetType: "result", targetId: result.id } }),
        tx.itemLink.count({ where: { targetType: "result", targetId: result.id } }),
      ]);
      const counts = { datasets: result._count.datasets, reportSources: result._count.reportSources, attachments, inboundLinks };
      const preserveAssociations = resultRequiresAssociationPreservingRecycle(counts);

      const recycled = await captureDeletedRecord(tx, "result", result.id, { deletionMode: preserveAssociations ? "soft" : "physical" });
      if (preserveAssociations) {
        await tx.result.update({ where: { id: result.id }, data: { status: "archived" } });
        await tx.activityLog.create({ data: { action: "recycle", targetType: "result", targetId: result.id, metadataJson: { recycleBinId: recycled.id, deletionMode: "soft", title: result.title, resultType: result.resultType, previousStatus: result.status, recordStatus: result.recordStatus, projectId: result.projectId, researchPlanId: result.researchPlanId, experimentId: result.experimentId, dependencyCounts: counts } } });
        return result.experimentId;
      }
      await tx.attachmentLink.deleteMany({ where: { targetType: "result", targetId: result.id } });
      await tx.itemLink.deleteMany({ where: { OR: [{ sourceType: "result", sourceId: result.id }, { targetType: "result", targetId: result.id }] } });
      await tx.activityLog.create({ data: { action: "delete", targetType: "result", targetId: result.id, metadataJson: { recycleBinId: recycled.id, title: result.title, resultType: result.resultType, status: result.status, recordStatus: result.recordStatus, projectId: result.projectId, researchPlanId: result.researchPlanId, experimentId: result.experimentId, dependencyCounts: counts } } });
      await tx.result.delete({ where: { id: result.id } });
      return result.experimentId;
    });
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Result could not be moved to the recycle bin.") };
  }
  revalidatePath("/");
  revalidatePath("/results");
  revalidatePath("/experiments");
  if (experimentId) revalidatePath(`/experiments/${experimentId}`);
  revalidatePath("/research-plans");
  revalidatePath("/search");
  redirect("/results");
}
