import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ResultForm } from "@/components/ResultForm";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { buildExperimentResultRecording, buildExperimentResultReportTemplate, existingResultHref } from "@/lib/experiment-results";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { createScientificDocument, resultSections, scientificDocumentFromSectionText } from "@/lib/scientific-document";
import { normalizeResultTemplates } from "@/lib/result-templates";
import { getEntryMarkdown, plainTextFromEntryMarkdown } from "@/lib/entry-content";
import { createResult } from "../actions";

export const dynamic = "force-dynamic";
export default async function NewResultPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const query = searchParams ? await searchParams : undefined;
  const experimentId = firstSearchParam(query, "experiment");
  const templateKey = firstSearchParam(query, "template");
  const manualMode = firstSearchParam(query, "manual") === "1";
  const reportMode = firstSearchParam(query, "report") === "1";
  const sourceEntryId = firstSearchParam(query, "entry");
  const requestedTemplateProtocolVersionId = firstSearchParam(query, "protocolVersionId");
  const [experiments, resultTypes, quickEntries] = await Promise.all([
    prisma.experiment.findMany({ where: { status: { not: "archived" } }, include: { project: { select: { name: true } }, researchPlan: { select: { code: true, title: true } }, protocolVersions: { orderBy: { order: "asc" }, include: { protocolVersion: { include: { protocol: true } } } }, results: { where: { status: { not: "archived" } }, orderBy: { createdAt: "asc" } } }, orderBy: { date: "desc" } }),
    prisma.resultTypeDefinition.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
    prisma.entry.findMany({ where: { archivedAt: null }, select: { id: true, title: true, occurredAt: true, body: true, contentJson: true, project: { select: { name: true } } }, orderBy: { occurredAt: "desc" }, take: 100 }),
  ]);
  const sourceEntry = quickEntries.find((entry) => entry.id === sourceEntryId);
  const selectedExperiment = experiments.find((experiment) => experiment.id === experimentId);
  const resultRecording = selectedExperiment ? buildExperimentResultRecording(selectedExperiment.protocolVersions.map((link) => ({
    protocolVersionId: link.protocolVersionId,
    protocolCode: link.protocolVersion.protocol.humanCode,
    protocolTitle: link.protocolVersion.protocol.canonicalTitle ?? link.protocolVersion.protocol.title,
    displayVersion: link.protocolVersion.displayVersion,
    resultTemplatesJson: link.protocolVersion.resultTemplatesJson,
  })), selectedExperiment.results) : undefined;

  if (selectedExperiment && !templateKey && !manualMode && resultRecording?.modules.length && resultRecording.report) {
    redirect(existingResultHref(resultRecording.report));
  }
  const templateVersionLink = templateKey ? (requestedTemplateProtocolVersionId
    ? selectedExperiment?.protocolVersions.find((link) => link.protocolVersionId === requestedTemplateProtocolVersionId)
    : selectedExperiment?.protocolVersions.find((link) => normalizeResultTemplates(link.protocolVersion.resultTemplatesJson).some((item) => item.templateKey === templateKey))) : undefined;
  const reportTemplate = selectedExperiment && resultRecording?.modules.length && (reportMode || (!templateKey && !manualMode))
    ? buildExperimentResultReportTemplate(resultRecording.modules)
    : undefined;
  const template = reportTemplate ?? (templateKey ? normalizeResultTemplates(templateVersionLink?.protocolVersion.resultTemplatesJson).find((item) => item.templateKey === templateKey) : undefined);
  const entryMarkdown = sourceEntry ? getEntryMarkdown(sourceEntry.contentJson, sourceEntry.body) : undefined;
  const initialDocument = entryMarkdown
    ? scientificDocumentFromSectionText(resultSections, { summary: entryMarkdown }, `entry-${sourceEntry?.id}`)
    : createScientificDocument(resultSections);
  return <AppShell><div className="space-y-4"><PageHeader identifier={selectedExperiment?.runCode ?? undefined} title={reportTemplate ? "实验结果" : template ? `New ${template.title ?? template.result_type}` : manualMode ? "New additional Result" : "New Result"} /><ResultForm action={createResult} experiments={experiments} resultTypes={resultTypes} availableModules={reportTemplate ? resultRecording?.modules : undefined} quickEntries={quickEntries.map((entry) => ({ id: entry.id, title: entry.title, occurredAt: entry.occurredAt.toISOString(), projectName: entry.project?.name }))} initial={{ experimentId, sourceEntryId: sourceEntry?.id, textValue: entryMarkdown ? plainTextFromEntryMarkdown(entryMarkdown) : undefined, resultType: template?.result_type ?? (sourceEntry ? resultTypes[0]?.label : undefined), title: reportTemplate && selectedExperiment ? `${selectedExperiment.title} · Result` : template && selectedExperiment ? `${selectedExperiment.title} · ${template.result_type}` : sourceEntry ? `${sourceEntry.title} · Result` : undefined, sourceType: template ? "protocol_template" : "manual", templateKey: template?.templateKey, templateProtocolVersionId: templateVersionLink?.protocolVersionId, templateSnapshotJson: template, valuesJson: {}, validationStatus: template ? "incomplete" : "not_applicable", document: initialDocument }} /></div></AppShell>;
}
