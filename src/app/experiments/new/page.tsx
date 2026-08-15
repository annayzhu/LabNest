import { AppShell } from "@/components/AppShell";
import { ExperimentForm } from "@/components/ExperimentForm";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { suggestNextRecordCode } from "@/lib/record-codes";
import { createScientificDocument, experimentSections } from "@/lib/scientific-document";
import { createExperiment } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewExperimentPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const query = searchParams ? await searchParams : undefined;
  const requestedPlanId = firstSearchParam(query, "plan");
  const selectedProtocolVersionId = firstSearchParam(query, "protocolVersionId");
  const [plansRaw, protocolVersionsRaw, existingExperimentCodes, counter] = await Promise.all([
    prisma.researchPlan.findMany({ where: { status: { in: ["draft", "active"] } }, include: { project: true }, orderBy: [{ project: { name: "asc" } }, { title: "asc" }] }),
    prisma.protocolVersion.findMany({ where: { protocol: { availability: { not: "archived" } } }, include: { protocol: { include: { project: { select: { name: true } } } } }, orderBy: [{ protocol: { title: "asc" } }, { revision: "desc" }] }),
    prisma.experiment.findMany({ select: { runCode: true } }),
    prisma.recordCodeCounter.findUnique({ where: { key: "experiment" }, select: { value: true } }),
  ]);
  const plans = plansRaw.map((plan) => ({ id: plan.id, code: plan.code, title: plan.title, project: { name: plan.project.name } }));
  const protocolVersions = protocolVersionsRaw.map((version) => ({ id: version.id, displayVersion: version.displayVersion, versionTitle: version.title, reviewStage: version.reviewStage, stepCount: Array.isArray(version.stepsJson) ? version.stepsJson.length : 0, protocol: { id: version.protocol.id, humanCode: version.protocol.humanCode, title: version.protocol.canonicalTitle ?? version.protocol.title, scope: version.protocol.scope, projectName: version.protocol.project?.name ?? null } }));
  const selectedPlanId = requestedPlanId;
  const suggestedCode = suggestNextRecordCode("experiment", existingExperimentCodes.map((experiment) => experiment.runCode), counter?.value);
  return <AppShell><div className="space-y-6"><PageHeader eyebrow="Experiment planning" title="New Experiment" description="Plan a future Experiment from any ordered set of ProtocolVersions, or create it independently with a fully custom method." /><ExperimentForm action={createExperiment} plans={plans} protocolVersions={protocolVersions} initial={{ researchPlanId: selectedPlanId, methodMode: "protocol", selectedProtocolVersionIds: selectedProtocolVersionId ? [selectedProtocolVersionId] : [], suggestedCodeSuffix: suggestedCode.slice("EXP-".length), document: createScientificDocument(experimentSections) }} /></div></AppShell>;
}
