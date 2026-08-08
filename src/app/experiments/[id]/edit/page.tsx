import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ExperimentForm } from "@/components/ExperimentForm";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { experimentSections, normalizeScientificDocument } from "@/lib/scientific-document";
import { updateExperiment } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditExperimentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const experiment = await prisma.experiment.findUnique({ where: { id }, include: { steps: { orderBy: { order: "asc" } }, protocolVersions: true, researchPlan: { include: { project: true, protocols: { include: { protocol: { include: { versions: { orderBy: { revision: "desc" } } } } } } } } } });
  if (!experiment || !experiment.researchPlan) notFound();
  const plan = experiment.researchPlan;
  const plans = [{ id: plan.id, code: plan.code, title: plan.title, project: { name: plan.project.name }, protocols: plan.protocols.flatMap((link) => link.protocol.versions.map((version) => ({ id: version.id, displayVersion: version.displayVersion, reviewStage: version.reviewStage, protocol: { id: link.protocol.id, humanCode: link.protocol.humanCode, title: link.protocol.title, scope: link.protocol.scope } }))) }];
  return <AppShell><div className="space-y-6"><PageHeader eyebrow={experiment.runCode ?? "Experiment"} title={`Edit ${experiment.title}`} description="The locked ProtocolVersion snapshot is immutable; execution notes, step completion and result interpretation remain editable." /><ExperimentForm action={updateExperiment} plans={plans} lockedPlan initial={{ ...experiment, researchPlanId: plan.id, date: experiment.date.toISOString().slice(0, 10), supportingProtocolVersionIds: experiment.protocolVersions.filter((link) => link.role === "supporting").map((link) => link.protocolVersionId), document: normalizeScientificDocument(experiment.contentJson, experimentSections) }} /></div></AppShell>;
}
