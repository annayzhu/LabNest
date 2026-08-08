"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { buildReportDraft, collectReportSources } from "@/lib/reports";
import { parseScientificDocumentJson, reportSections } from "@/lib/scientific-document";

const schema = z.object({ id: z.string().optional(), projectId: z.string().min(1), researchPlanId: z.string().optional(), title: z.string().trim().min(1).max(180), status: z.enum(["draft", "ready_for_review", "final", "archived"]).optional(), periodStart: z.coerce.date().optional(), periodEnd: z.coerce.date().optional() });
function optionalText(value: FormDataEntryValue | null) { const text = String(value ?? "").trim(); return text || undefined; }
function tags(value: FormDataEntryValue | null) { return String(value ?? "").split(",").map((tag) => tag.trim()).filter(Boolean); }
function parse(formData: FormData) { return schema.parse({ id: optionalText(formData.get("id")), projectId: formData.get("projectId"), researchPlanId: optionalText(formData.get("researchPlanId")), title: formData.get("title"), status: optionalText(formData.get("status")), periodStart: optionalText(formData.get("periodStart")), periodEnd: optionalText(formData.get("periodEnd")) }); }

export async function createReport(formData: FormData) {
  const parsed = parse(formData); const collected = await collectReportSources(parsed.projectId, parsed.researchPlanId); const content = buildReportDraft(collected);
  const report = await prisma.report.create({ data: { projectId: parsed.projectId, researchPlanId: parsed.researchPlanId, title: parsed.title, periodStart: parsed.periodStart, periodEnd: parsed.periodEnd, tags: tags(formData.get("tags")), contentJson: content, sourceSnapshotJson: collected.snapshot, sources: { create: collected.sources.map((source) => ({ sourceType: source.sourceType, sourceId: source.sourceId, titleSnapshot: source.titleSnapshot, versionSnapshot: source.versionSnapshot, hrefSnapshot: source.hrefSnapshot, metadataJson: source.metadataJson ?? {}, order: source.order, resultId: source.resultId })) } } });
  await prisma.activityLog.create({ data: { action: "create", targetType: "report", targetId: report.id, metadataJson: { projectId: report.projectId, researchPlanId: report.researchPlanId, sourceCount: collected.sources.length } } });
  revalidatePath("/reports"); redirect(`/reports/${report.id}`);
}

export async function updateReport(formData: FormData) {
  const parsed = parse(formData); if (!parsed.id) throw new Error("Report ID is required."); const current = await prisma.report.findUnique({ where: { id: parsed.id } }); if (!current) throw new Error("Report not found.");
  if (current.projectId !== parsed.projectId || current.researchPlanId !== (parsed.researchPlanId ?? null)) throw new Error("Report scope cannot be moved after its source snapshot is created.");
  const contentJson = parseScientificDocumentJson(formData.get("contentJson"), reportSections);
  await prisma.$transaction([
    prisma.report.update({ where: { id: current.id }, data: { title: parsed.title, status: parsed.status, periodStart: parsed.periodStart, periodEnd: parsed.periodEnd, tags: tags(formData.get("tags")), contentJson } }),
    prisma.activityLog.create({ data: { action: "update", targetType: "report", targetId: current.id, metadataJson: { status: parsed.status } } }),
  ]);
  revalidatePath("/reports"); revalidatePath(`/reports/${current.id}`); redirect(`/reports/${current.id}`);
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
