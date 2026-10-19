import { stepsWithExecutionEvidence } from "@/lib/run-evidence.server";
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
  const experiment = await prisma.experiment.findUnique({ where: { id }, include: { protocolRun: true, steps: { orderBy: [{ groupOrder: "asc" }, { order: "asc" }] }, protocolVersions: { orderBy: { order: "asc" } }, researchPlan: { include: { project: true } } } });
  if (!experiment) notFound();
  const plan = experiment.researchPlan;
  // An unassigned Experiment may choose its plan here; an assigned one keeps it.
  const rows = plan ? [plan] : await prisma.researchPlan.findMany({ where: { status: { in: ["draft", "active"] } }, include: { project: true }, orderBy: [{ project: { name: "asc" } }, { title: "asc" }] });
  const plans = rows.map((row) => ({ id: row.id, code: row.code, title: row.title, project: { name: row.project.name } }));
  const selectedProtocolVersionIds = experiment.protocolVersions.map((link) => link.protocolVersionId);
  return <AppShell><div className="space-y-6"><PageHeader eyebrow={experiment.runCode ?? "Experiment"} title={`Edit ${experiment.title}`} description="The locked method snapshot is immutable; execution notes, step completion and result interpretation remain editable." /><ExperimentForm action={updateExperiment} plans={plans} lockedPlan={Boolean(plan)} initial={{ ...experiment, executionParameters: experiment.protocolRun?.parametersJson, executionPlan: experiment.protocolRun?.executionPlanJson, steps: await stepsWithExecutionEvidence(experiment.steps), methodMode: selectedProtocolVersionIds.length ? "protocol" : "custom", researchPlanId: plan?.id, date: experiment.date.toISOString().slice(0, 10), selectedProtocolVersionIds, document: normalizeScientificDocument(experiment.contentJson, experimentSections) }} /></div></AppShell>;
}
