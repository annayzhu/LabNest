import { AppShell } from "@/components/AppShell";
import { ExperimentForm } from "@/components/ExperimentForm";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { createScientificDocument, experimentSections } from "@/lib/scientific-document";
import { createExperiment } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewExperimentPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const query = searchParams ? await searchParams : undefined;
  const selectedPlanId = firstSearchParam(query, "plan");
  const plansRaw = await prisma.researchPlan.findMany({ where: { status: { in: ["draft", "active"] } }, include: { project: true, protocols: { include: { protocol: { include: { versions: { orderBy: { revision: "desc" } } } } } } }, orderBy: [{ project: { name: "asc" } }, { title: "asc" }] });
  const plans = plansRaw.map((plan) => ({ id: plan.id, code: plan.code, title: plan.title, project: { name: plan.project.name }, protocols: plan.protocols.flatMap((link) => link.protocol.versions.map((version) => ({ id: version.id, displayVersion: version.displayVersion, reviewStage: version.reviewStage, protocol: { id: link.protocol.id, humanCode: link.protocol.humanCode, title: link.protocol.title, scope: link.protocol.scope } }))) }));
  return <AppShell><div className="space-y-6"><PageHeader eyebrow="Execution record" title="New Experiment" description="Create a repeatable run from one Research Plan and lock the exact primary and supporting ProtocolVersions used." /><ExperimentForm action={createExperiment} plans={plans} initial={{ researchPlanId: selectedPlanId, document: createScientificDocument(experimentSections) }} /></div></AppShell>;
}
