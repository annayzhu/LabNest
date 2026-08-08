import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ReportCreateForm } from "@/components/ReportCreateForm";
import { prisma } from "@/lib/db";
import { createReport } from "../actions";

export const dynamic = "force-dynamic";
export default async function NewReportPage() {
  const [projects, plans] = await Promise.all([prisma.project.findMany({ where: { status: { not: "archived" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }), prisma.researchPlan.findMany({ where: { status: { not: "archived" } }, orderBy: { title: "asc" }, select: { id: true, projectId: true, code: true, title: true } })]);
  return <AppShell><div className="space-y-6"><PageHeader eyebrow="Traceable synthesis" title="New Report" description="Choose a Project or one Research Plan. LabNest creates a deterministic source map and a conservative editable draft without asking AI to invent interpretation." /><ReportCreateForm action={createReport} projects={projects} plans={plans} /></div></AppShell>;
}
