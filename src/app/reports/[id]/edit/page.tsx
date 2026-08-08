import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ReportEditForm } from "@/components/ReportEditForm";
import { prisma } from "@/lib/db";
import { normalizeScientificDocument, reportSections } from "@/lib/scientific-document";
import { updateReport } from "../../actions";

export const dynamic = "force-dynamic";
export default async function EditReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const report = await prisma.report.findUnique({ where: { id }, include: { project: true, researchPlan: true } }); if (!report) notFound();
  return <AppShell><div className="space-y-6"><PageHeader eyebrow={report.status.replaceAll("_", " ")} title={`Edit ${report.title}`} description="Edit the synthesis while the separately stored source snapshot preserves exactly what records were included." /><ReportEditForm action={updateReport} initial={{ id: report.id, projectId: report.projectId, researchPlanId: report.researchPlanId, projectName: report.project.name, researchPlanTitle: report.researchPlan?.title, title: report.title, status: report.status, periodStart: report.periodStart?.toISOString().slice(0, 10) ?? "", periodEnd: report.periodEnd?.toISOString().slice(0, 10) ?? "", tags: report.tags, document: normalizeScientificDocument(report.contentJson, reportSections) }} /></div></AppShell>;
}
