import { loadProtocolVersionOptions } from "@/lib/protocol-version-options.server";
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
    loadProtocolVersionOptions(),
    prisma.experiment.findMany({ select: { runCode: true } }),
    prisma.recordCodeCounter.findUnique({ where: { key: "experiment" }, select: { value: true } }),
  ]);
  const plans = plansRaw.map((plan) => ({ id: plan.id, code: plan.code, title: plan.title, project: { name: plan.project.name } }));
  const protocolVersions = protocolVersionsRaw;
  const selectedPlanId = requestedPlanId;
  const suggestedCode = suggestNextRecordCode("experiment", existingExperimentCodes.map((experiment) => experiment.runCode), counter?.value);
  const fromVersion = protocolVersionsRaw.find((version) => version.id === selectedProtocolVersionId);
  const intro = fromVersion
    ? `New from Protocol ${fromVersion.protocol.humanCode} v${fromVersion.displayVersion} “${fromVersion.protocol.title}”. Confirm the experiment name, research plan and date; once saved, the steps come from the Protocol and are ticked off one by one on the run page.`
    : "Enter the experiment name, research plan and date first. The method can follow a Protocol (steps generated from it) or be recorded freely.";
  return <AppShell><div className="space-y-6"><PageHeader eyebrow="Experiment" title="New Experiment" /><ExperimentForm intro={intro} action={createExperiment} plans={plans} protocolVersions={protocolVersions} initial={{ researchPlanId: selectedPlanId, methodMode: "protocol", selectedProtocolVersionIds: selectedProtocolVersionId ? [selectedProtocolVersionId] : [], suggestedCodeSuffix: suggestedCode.slice("EXP-".length), document: createScientificDocument(experimentSections) }} /></div></AppShell>;
}
