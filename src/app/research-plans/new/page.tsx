import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ResearchPlanForm } from "@/components/ResearchPlanForm";
import { prisma } from "@/lib/db";
import { createScientificDocument, researchPlanSections } from "@/lib/scientific-document";
import { createResearchPlan } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewResearchPlanPage() {
  const [projects, protocols] = await Promise.all([
    prisma.project.findMany({ where: { status: { not: "archived" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.protocol.findMany({ where: { availability: { in: ["draft", "active"] } }, orderBy: [{ scope: "asc" }, { title: "asc" }], select: { id: true, humanCode: true, title: true, scope: true, projectId: true } }),
  ]);
  return <AppShell><div className="space-y-6"><PageHeader eyebrow="Scientific design" title="New Research Plan" description="Create one testable research scheme inside a Project, then associate the reusable Protocols that will generate repeated Experiments." /><ResearchPlanForm action={createResearchPlan} projects={projects} protocols={protocols} initial={{ document: createScientificDocument(researchPlanSections) }} /></div></AppShell>;
}
