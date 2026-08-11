"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { formActionErrorMessage, type FormActionState } from "@/lib/form-actions";
import { buildReportDraft, collectReportSources } from "@/lib/reports";
import { reportDeleteBlockers } from "@/lib/record-lifecycle";
import { captureDeletedRecord } from "@/lib/recycle-bin";
import { parseScientificDocumentJson, reportSections } from "@/lib/scientific-document";
import { parseTags } from "@/lib/tags";

const schema = z.object({ id: z.string().optional(), projectId: z.string().min(1, "Project is required."), researchPlanId: z.string().optional(), title: z.string().trim().min(1, "Title is required.").max(180), status: z.enum(["draft", "ready_for_review", "final", "archived"]).optional(), periodStart: z.coerce.date().optional(), periodEnd: z.coerce.date().optional() });
const lifecycleSchema = z.object({ id: z.string().min(1, "Report ID is required."), confirmation: z.string().trim().optional() });
function optionalText(value: FormDataEntryValue | null) { const text = String(value ?? "").trim(); return text || undefined; }
function parse(formData: FormData) { return schema.parse({ id: optionalText(formData.get("id")), projectId: formData.get("projectId"), researchPlanId: optionalText(formData.get("researchPlanId")), title: formData.get("title"), status: optionalText(formData.get("status")), periodStart: optionalText(formData.get("periodStart")), periodEnd: optionalText(formData.get("periodEnd")) }); }

async function persistNewReport(formData: FormData) {
  const parsed = parse(formData); const collected = await collectReportSources(parsed.projectId, parsed.researchPlanId); const content = buildReportDraft(collected);
  const report = await prisma.report.create({ data: { projectId: parsed.projectId, researchPlanId: parsed.researchPlanId, title: parsed.title, periodStart: parsed.periodStart, periodEnd: parsed.periodEnd, tags: parseTags(formData.get("tags")), contentJson: content, sourceSnapshotJson: collected.snapshot, sources: { create: collected.sources.map((source) => ({ sourceType: source.sourceType, sourceId: source.sourceId, titleSnapshot: source.titleSnapshot, versionSnapshot: source.versionSnapshot, hrefSnapshot: source.hrefSnapshot, metadataJson: source.metadataJson ?? {}, order: source.order, resultId: source.resultId })) } } });
  await prisma.activityLog.create({ data: { action: "create", targetType: "report", targetId: report.id, metadataJson: { projectId: report.projectId, researchPlanId: report.researchPlanId, sourceCount: collected.sources.length } } });
  return report.id;
}

export async function createReport(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let reportId: string;
  try {
    reportId = await persistNewReport(formData);
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Report could not be created.") };
  }
  revalidatePath("/reports");
  redirect(`/reports/${reportId}`);
}

async function persistReportUpdate(formData: FormData) {
  const parsed = parse(formData); if (!parsed.id) throw new Error("Report ID is required."); const current = await prisma.report.findUnique({ where: { id: parsed.id } }); if (!current) throw new Error("Report not found.");
  if (current.projectId !== parsed.projectId || current.researchPlanId !== (parsed.researchPlanId ?? null)) throw new Error("Report scope cannot be moved after its source snapshot is created.");
  const contentJson = parseScientificDocumentJson(formData.get("contentJson"), reportSections);
  await prisma.$transaction([
    prisma.report.update({ where: { id: current.id }, data: { title: parsed.title, status: parsed.status, periodStart: parsed.periodStart, periodEnd: parsed.periodEnd, tags: parseTags(formData.get("tags")), contentJson } }),
    prisma.activityLog.create({ data: { action: "update", targetType: "report", targetId: current.id, metadataJson: { status: parsed.status } } }),
  ]);
  return current.id;
}

export async function updateReport(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let reportId: string;
  try {
    reportId = await persistReportUpdate(formData);
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Report could not be saved.") };
  }
  revalidatePath("/reports");
  revalidatePath(`/reports/${reportId}`);
  redirect(`/reports/${reportId}`);
}

export async function refreshReportSources(formData: FormData) {
  const id = String(formData.get("id") ?? ""); const report = await prisma.report.findUnique({ where: { id } }); if (!report) throw new Error("Report not found.");
  const collected = await collectReportSources(report.projectId, report.researchPlanId ?? undefined);
  await prisma.$transaction(async (tx) => {
    await tx.reportSource.deleteMany({ where: { reportId: report.id } });
    if (collected.sources.length) await tx.reportSource.createMany({ data: collected.sources.map((source) => ({ reportId: report.id, sourceType: source.sourceType, sourceId: source.sourceId, titleSnapshot: source.titleSnapshot, versionSnapshot: source.versionSnapshot, hrefSnapshot: source.hrefSnapshot, metadataJson: source.metadataJson ?? {}, order: source.order, resultId: source.resultId })) });
    await tx.report.update({ where: { id: report.id }, data: { sourceSnapshotJson: collected.snapshot } });
    await tx.activityLog.create({ data: { action: "refresh_sources", targetType: "report", targetId: report.id, metadataJson: { sourceCount: collected.sources.length } } });
  });
  revalidatePath(`/reports/${report.id}`); redirect(`/reports/${report.id}`);
}

export async function archiveReport(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let reportId: string;
  try {
    const parsed = lifecycleSchema.parse({ id: formData.get("id") });
    const report = await prisma.report.findUnique({ where: { id: parsed.id }, select: { id: true, title: true, status: true } });
    if (!report) throw new Error("This Report no longer exists.");
    await prisma.$transaction([
      prisma.report.update({ where: { id: report.id }, data: { status: "archived" } }),
      prisma.activityLog.create({ data: { action: "archive", targetType: "report", targetId: report.id, metadataJson: { title: report.title, previousStatus: report.status } } }),
    ]);
    reportId = report.id;
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Report could not be archived.") };
  }
  revalidatePath("/reports");
  revalidatePath(`/reports/${reportId}`);
  redirect(`/reports/${reportId}`);
}

export async function deleteReport(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  try {
    const parsed = lifecycleSchema.parse({ id: formData.get("id"), confirmation: formData.get("confirmation") });
    await prisma.$transaction(async (tx) => {
      const report = await tx.report.findUnique({ where: { id: parsed.id }, select: { id: true, title: true, status: true, projectId: true, researchPlanId: true, _count: { select: { sources: true } } } });
      if (!report) throw new Error("This Report no longer exists.");
      if (parsed.confirmation !== report.title) throw new Error(`Enter ${report.title} exactly to confirm moving it to the Recycle Bin.`);
      const [itemReferences, reportSourceReferences] = await Promise.all([
        tx.itemLink.count({ where: { OR: [{ sourceType: "report", sourceId: report.id }, { targetType: "report", targetId: report.id }] } }),
        tx.reportSource.count({ where: { sourceType: "report", sourceId: report.id } }),
      ]);
      const counts = { externalReferences: itemReferences + reportSourceReferences };
      const blockers = reportDeleteBlockers(report.status, counts);
      if (blockers.length) throw new Error("This Report is finalized or externally referenced and can only be archived.");

      const recycled = await captureDeletedRecord(tx, "report", report.id);
      await tx.attachmentLink.deleteMany({ where: { targetType: "report", targetId: report.id } });
      await tx.itemLink.deleteMany({ where: { OR: [{ sourceType: "report", sourceId: report.id }, { targetType: "report", targetId: report.id }] } });
      await tx.activityLog.create({ data: { action: "delete", targetType: "report", targetId: report.id, metadataJson: { recycleBinId: recycled.id, title: report.title, status: report.status, projectId: report.projectId, researchPlanId: report.researchPlanId, ownedSourceCount: report._count.sources, dependencyCounts: counts } } });
      await tx.report.delete({ where: { id: report.id } });
    });
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Report could not be moved to the recycle bin.") };
  }
  revalidatePath("/");
  revalidatePath("/reports");
  revalidatePath("/projects");
  revalidatePath("/research-plans");
  revalidatePath("/search");
  redirect("/reports");
}
