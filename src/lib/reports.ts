import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { createScientificDocument, type ScientificDocument, reportSections } from "@/lib/scientific-document";

export type ReportSourceDraft = {
  sourceType: string; sourceId: string; titleSnapshot: string; versionSnapshot?: string; hrefSnapshot?: string; resultId?: string; metadataJson?: Prisma.InputJsonObject; order: number;
};

export async function collectReportSources(projectId: string, researchPlanId?: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found.");
  const planWhere = researchPlanId ? { id: researchPlanId, projectId } : { projectId };
  const [plans, experiments, results, entries] = await Promise.all([
    prisma.researchPlan.findMany({ where: planWhere, orderBy: { updatedAt: "asc" } }),
    prisma.experiment.findMany({ where: { projectId, ...(researchPlanId ? { researchPlanId } : {}) }, include: { protocolVersions: { include: { protocolVersion: { include: { protocol: true } } } } }, orderBy: { date: "asc" } }),
    prisma.result.findMany({ where: { projectId, ...(researchPlanId ? { researchPlanId } : {}) }, orderBy: { updatedAt: "asc" } }),
    prisma.entry.findMany({ where: { projectId, ...(researchPlanId ? { researchPlanId } : {}) }, orderBy: { occurredAt: "asc" } }),
  ]);
  if (researchPlanId && !plans.length) throw new Error("Research Plan does not belong to the selected Project.");

  const sources: ReportSourceDraft[] = [];
  const push = (source: Omit<ReportSourceDraft, "order">) => sources.push({ ...source, order: sources.length });
  plans.forEach((plan) => push({ sourceType: "research_plan", sourceId: plan.id, titleSnapshot: plan.title, versionSnapshot: plan.status, hrefSnapshot: `/research-plans/${plan.id}` }));

  const versionMap = new Map<string, ReportSourceDraft>();
  experiments.forEach((experiment) => experiment.protocolVersions.forEach((link) => {
    const version = link.protocolVersion;
    if (!versionMap.has(version.id)) versionMap.set(version.id, { sourceType: "protocol_version", sourceId: version.id, titleSnapshot: version.protocol.canonicalTitle ?? version.protocol.title, versionSnapshot: version.displayVersion, hrefSnapshot: `/protocols/${version.protocolId}?version=${version.id}`, order: 0, metadataJson: { reviewStage: version.reviewStage } });
  }));
  versionMap.forEach((source) => push(source));
  experiments.forEach((experiment) => push({ sourceType: "experiment", sourceId: experiment.id, titleSnapshot: experiment.title, versionSnapshot: experiment.runCode ?? experiment.status, hrefSnapshot: `/experiments/${experiment.id}`, metadataJson: { date: experiment.date.toISOString(), status: experiment.status, recordStatus: experiment.recordStatus } }));
  results.forEach((result) => push({ sourceType: "result", sourceId: result.id, resultId: result.id, titleSnapshot: result.title, versionSnapshot: result.recordStatus, hrefSnapshot: `/results/${result.id}`, metadataJson: { resultType: result.resultType, qualityStatus: result.qualityStatus, sourceType: result.sourceType } }));
  entries.forEach((entry) => push({ sourceType: "entry", sourceId: entry.id, titleSnapshot: entry.title, versionSnapshot: entry.recordStatus, hrefSnapshot: `/entries?entry=${entry.id}`, metadataJson: { occurredAt: entry.occurredAt.toISOString() } }));

  const snapshot = {
    schemaVersion: 1, generatedAt: new Date().toISOString(), projectId, researchPlanId: researchPlanId ?? null,
    counts: { researchPlans: plans.length, protocolVersions: versionMap.size, experiments: experiments.length, results: results.length, entries: entries.length },
    sourceIds: sources.map((source) => ({ type: source.sourceType, id: source.sourceId })),
  };
  return { project, plans, experiments, results, entries, sources, snapshot };
}

export function buildReportDraft(input: Awaited<ReturnType<typeof collectReportSources>>): ScientificDocument {
  const document = createScientificDocument(reportSections);
  const section = (key: string) => document.sections.find((item) => item.key === key)!;
  section("executive_summary").blocks.push({ id: "generated-summary", type: "text", text: `Draft source map for ${input.project.name}: ${input.plans.length} Research Plan(s), ${input.experiments.length} Experiment(s), and ${input.results.length} Result(s). This sentence is generated from record counts, not by AI.` });
  section("research_question").blocks.push(...input.plans.map((plan, index) => ({ id: `plan-${index}`, type: "text" as const, text: [plan.title, plan.objective, plan.hypothesis ? `Hypothesis: ${plan.hypothesis}` : ""].filter(Boolean).join("\n") })));
  const methods = Array.from(new Map(input.sources.filter((source) => source.sourceType === "protocol_version").map((source) => [source.sourceId, `${source.titleSnapshot} · version ${source.versionSnapshot ?? "unknown"}`])).values());
  if (methods.length) section("methods").blocks.push({ id: "method-list", type: "checklist", items: methods });
  const experimentItems = input.experiments.map((experiment) => `${experiment.runCode ? `${experiment.runCode} · ` : ""}${experiment.title} — ${experiment.status}`);
  if (experimentItems.length) section("methods").blocks.push({ id: "experiment-list", type: "checklist", items: experimentItems });
  const resultItems = input.results.map((result) => `${result.title} — ${result.resultType}; QC ${result.qualityStatus}; record ${result.recordStatus}`);
  if (resultItems.length) section("results").blocks.push({ id: "result-list", type: "checklist", items: resultItems });
  section("interpretation").blocks.push({ id: "interpretation-placeholder", type: "callout", tone: "note", text: "Add scientific interpretation here. LabNest does not infer a conclusion from source counts or result titles." });
  const unassessed = input.results.filter((result) => result.qualityStatus === "not_assessed").length;
  section("limitations_next_steps").blocks.push({ id: "review-checklist", type: "checklist", items: [`Review every linked source before changing report status.`, `${unassessed} Result(s) have not yet received a QC assessment.`, "State unresolved limitations and planned validation explicitly."] });
  return document;
}
