import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ResearchPlanForm } from "@/components/ResearchPlanForm";
import { prisma } from "@/lib/db";
import { suggestNextRecordCode } from "@/lib/record-codes";
import { createScientificDocument, researchPlanSections } from "@/lib/scientific-document";
import { createResearchPlan } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewResearchPlanPage() {
  const [projects, protocols, existingPlanCodes, counter] = await Promise.all([
    prisma.project.findMany({ where: { status: { not: "archived" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.protocol.findMany({ where: { availability: { in: ["draft", "active"] } }, orderBy: [{ scope: "asc" }, { title: "asc" }], select: { id: true, humanCode: true, title: true, scope: true, projectId: true } }),
    prisma.researchPlan.findMany({ select: { code: true } }),
    prisma.recordCodeCounter.findUnique({ where: { key: "research-plan" }, select: { value: true } }),
  ]);
  const suggestedCode = suggestNextRecordCode("researchPlan", existingPlanCodes.map((plan) => plan.code), counter?.value);
  return <AppShell><div className="space-y-6"><PageHeader eyebrow="Scientific design" title="New Research Plan" description="Create one testable research scheme inside a Project, then associate the reusable Protocols that will generate repeated Experiments." /><ResearchPlanForm action={createResearchPlan} projects={projects} protocols={protocols} initial={{ suggestedCodeSuffix: suggestedCode.slice("RP-".length), document: createScientificDocument(researchPlanSections) }} /></div></AppShell>;
}
