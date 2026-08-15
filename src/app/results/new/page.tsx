import { AppShell } from "@/components/AppShell";
import { ExperimentResultRecordingCard } from "@/components/ExperimentResultRecording";
import { PageHeader } from "@/components/PageHeader";
import { ResultForm } from "@/components/ResultForm";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { buildExperimentResultRecording, existingResultHref, isSingleResultTemplate, newTemplateResultHref } from "@/lib/experiment-results";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { createScientificDocument, resultSections } from "@/lib/scientific-document";
import { normalizeResultTemplates } from "@/lib/result-templates";
import { createResult } from "../actions";

export const dynamic = "force-dynamic";
export default async function NewResultPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const query = searchParams ? await searchParams : undefined;
  const experimentId = firstSearchParam(query, "experiment");
  const templateKey = firstSearchParam(query, "template");
  const manualMode = firstSearchParam(query, "manual") === "1";
  const requestedTemplateProtocolVersionId = firstSearchParam(query, "protocolVersionId");
  const [experiments, resultTypes] = await Promise.all([
    prisma.experiment.findMany({ where: { status: { not: "archived" } }, include: { project: { select: { name: true } }, researchPlan: { select: { code: true, title: true } }, protocolVersions: { orderBy: { order: "asc" }, include: { protocolVersion: { include: { protocol: true } } } }, results: { where: { status: { not: "archived" } }, orderBy: { createdAt: "asc" } } }, orderBy: { date: "desc" } }),
    prisma.resultTypeDefinition.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
  ]);
  const selectedExperiment = experiments.find((experiment) => experiment.id === experimentId);
  const resultRecording = selectedExperiment ? buildExperimentResultRecording(selectedExperiment.protocolVersions.map((link) => ({
    protocolVersionId: link.protocolVersionId,
    protocolCode: link.protocolVersion.protocol.humanCode,
    protocolTitle: link.protocolVersion.protocol.canonicalTitle ?? link.protocolVersion.protocol.title,
    displayVersion: link.protocolVersion.displayVersion,
    resultTemplatesJson: link.protocolVersion.resultTemplatesJson,
  })), selectedExperiment.results) : undefined;

  if (selectedExperiment && !templateKey && !manualMode && resultRecording?.slots.length) {
    if (resultRecording.slots.length === 1 && isSingleResultTemplate(resultRecording.slots[0].template)) {
      const slot = resultRecording.slots[0];
      redirect(slot.records[0] ? existingResultHref(slot.records[0]) : newTemplateResultHref(selectedExperiment.id, slot));
    }
    return <AppShell><div className="mx-auto max-w-3xl space-y-6"><PageHeader identifier={selectedExperiment.runCode ?? undefined} title="Choose a result record" /><ExperimentResultRecordingCard experimentId={selectedExperiment.id} recording={resultRecording} /></div></AppShell>;
  }
  const templateVersionLink = templateKey ? (requestedTemplateProtocolVersionId
    ? selectedExperiment?.protocolVersions.find((link) => link.protocolVersionId === requestedTemplateProtocolVersionId)
    : selectedExperiment?.protocolVersions.find((link) => normalizeResultTemplates(link.protocolVersion.resultTemplatesJson).some((item) => item.templateKey === templateKey))) : undefined;
  const template = templateKey ? normalizeResultTemplates(templateVersionLink?.protocolVersion.resultTemplatesJson).find((item) => item.templateKey === templateKey) : undefined;
  return <AppShell><div className="space-y-6"><PageHeader eyebrow="Structured evidence" title={template ? `New ${template.title ?? template.result_type}` : manualMode ? "New additional Result" : "New Result"} description={template ? "先填写实验规程锁定的结果字段与数据表，再补充分析和解释。" : "先记录直接实验结果，再根据需要补充分析、解释和质控限制。"} /><ResultForm action={createResult} experiments={experiments} resultTypes={resultTypes} initial={{ experimentId, resultType: template?.result_type, title: template && selectedExperiment ? `${selectedExperiment.title} · ${template.result_type}` : undefined, sourceType: template ? "protocol_template" : "manual", templateKey: template?.templateKey, templateProtocolVersionId: templateVersionLink?.protocolVersionId, templateSnapshotJson: template, valuesJson: {}, validationStatus: template ? "incomplete" : "not_applicable", document: createScientificDocument(resultSections) }} /></div></AppShell>;
}
