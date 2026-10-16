import { normalizeProtocolDocument, projectProtocolDocument } from "@/lib/protocol-document";
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
    prisma.protocolVersion.findMany({ where: { protocol: { availability: { not: "archived" } } }, include: { protocol: { include: { researchPlans: { select: { researchPlanId: true } }, project: { select: { name: true } } } } }, orderBy: [{ protocol: { title: "asc" } }, { revision: "desc" }] }),
    prisma.experiment.findMany({ select: { runCode: true } }),
    prisma.recordCodeCounter.findUnique({ where: { key: "experiment" }, select: { value: true } }),
  ]);
  const plans = plansRaw.map((plan) => ({ id: plan.id, code: plan.code, title: plan.title, project: { name: plan.project.name } }));
  const protocolVersions = protocolVersionsRaw.map((version) => {
    const document=normalizeProtocolDocument(version.contentJson);
    const execution=document?{...projectProtocolDocument(document),systems:document.systems}:{steps:[],commonBlocks:[],notePlacement:{},executionNeedsReview:true};
    return ({hasSystems: Boolean(document?.systems), execution, id: version.id, researchPlanIds: version.protocol.researchPlans.map(link=>link.researchPlanId), revision: version.revision, displayVersion: version.displayVersion, versionTitle: version.title, reviewStage: version.reviewStage, stepCount: execution.steps.length, protocol: { id: version.protocol.id, humanCode: version.protocol.humanCode, title: version.protocol.canonicalTitle ?? version.protocol.title, scope: version.protocol.scope, projectName: version.protocol.project?.name ?? null } });});
  const selectedPlanId = requestedPlanId;
  const suggestedCode = suggestNextRecordCode("experiment", existingExperimentCodes.map((experiment) => experiment.runCode), counter?.value);
  const fromVersion = protocolVersionsRaw.find((version) => version.id === selectedProtocolVersionId);
  const intro = fromVersion
    ? `从规程 ${fromVersion.protocol.humanCode} v${fromVersion.displayVersion}「${fromVersion.protocol.canonicalTitle ?? fromVersion.protocol.title}」新建。先确认实验名称、所属研究计划和日期；保存后，步骤按规程生成，在执行页逐步勾选。`
    : "先填实验名称、研究计划和日期。方法来源可以依据实验规程（步骤按规程生成），也可以自行记录。";
  return <AppShell><div className="space-y-6"><PageHeader eyebrow="实验" title="新建实验" /><ExperimentForm intro={intro} action={createExperiment} plans={plans} protocolVersions={protocolVersions} initial={{ researchPlanId: selectedPlanId, methodMode: "protocol", selectedProtocolVersionIds: selectedProtocolVersionId ? [selectedProtocolVersionId] : [], suggestedCodeSuffix: suggestedCode.slice("EXP-".length), document: createScientificDocument(experimentSections) }} /></div></AppShell>;
}
