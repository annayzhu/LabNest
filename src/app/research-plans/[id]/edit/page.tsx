import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ResearchPlanForm } from "@/components/ResearchPlanForm";
import { prisma } from "@/lib/db";
import { normalizeResearchPlanDocument } from "@/lib/scientific-document";
import { updateResearchPlan } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditResearchPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [plan, projects, protocols] = await Promise.all([
    prisma.researchPlan.findUnique({ where: { id }, include: { protocols: true } }),
    prisma.project.findMany({ where: { status: { not: "archived" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.protocol.findMany({ where: { availability: { in: ["draft", "active"] } }, orderBy: [{ scope: "asc" }, { title: "asc" }], select: { id: true, humanCode: true, title: true, scope: true, projectId: true } }),
  ]);
  if (!plan) notFound();
  return <AppShell><div className="space-y-6"><PageHeader eyebrow={plan.code ?? "Research Plan"} title={`Edit ${plan.title}`} description="Changing a plan does not alter any ProtocolVersion already used by an Experiment." /><ResearchPlanForm action={updateResearchPlan} projects={projects} protocols={protocols} initial={{ ...plan, selectedProtocolIds: plan.protocols.map((link) => link.protocolId), primaryProtocolId: plan.protocols.find((link) => link.isPrimary)?.protocolId, document: normalizeResearchPlanDocument(plan.contentJson, plan.design) }} /></div></AppShell>;
}
