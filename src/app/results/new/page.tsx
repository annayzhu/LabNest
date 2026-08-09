import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { ResultForm } from "@/components/ResultForm";
import { prisma } from "@/lib/db";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { createScientificDocument, resultSections } from "@/lib/scientific-document";
import { normalizeResultTemplates } from "@/lib/result-templates";
import { createResult } from "../actions";

export const dynamic = "force-dynamic";
export default async function NewResultPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const query = searchParams ? await searchParams : undefined;
  const experimentId = firstSearchParam(query, "experiment");
  const templateKey = firstSearchParam(query, "template");
  const experiments = await prisma.experiment.findMany({ where: { status: { not: "archived" } }, include: { project: { select: { name: true } }, researchPlan: { select: { code: true, title: true } }, primaryProtocolVersion: { select: { resultTemplatesJson: true } } }, orderBy: { date: "desc" } });
  const selectedExperiment = experiments.find((experiment) => experiment.id === experimentId);
  const template = templateKey ? normalizeResultTemplates(selectedExperiment?.primaryProtocolVersion?.resultTemplatesJson).find((item) => item.templateKey === templateKey) : undefined;
  return <AppShell><div className="space-y-6"><PageHeader eyebrow="Structured evidence" title={template ? `New ${template.title ?? template.result_type}` : "New Result"} description={template ? "Create another cardinality-aware Result instance from the Experiment's locked ProtocolVersion." : "Record evidence from one Experiment. Narrative, metrics, small tables and media stay flexible; large tables are registered as independent Datasets after saving."} /><ResultForm action={createResult} experiments={experiments} initial={{ experimentId, resultType: template?.result_type, title: template && selectedExperiment ? `${selectedExperiment.title} · ${template.result_type}` : undefined, sourceType: template ? "protocol_template" : "manual", templateKey: template?.templateKey, templateSnapshotJson: template, valuesJson: {}, validationStatus: template ? "incomplete" : "not_applicable", document: createScientificDocument(resultSections) }} /></div></AppShell>;
}
