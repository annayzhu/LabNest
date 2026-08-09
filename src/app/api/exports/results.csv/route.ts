import { prisma } from "@/lib/db";
import { downloadResponse, formatExportTimestamp, toCsv } from "@/lib/export";

export const runtime = "nodejs";

export async function GET() {
  const results = await prisma.result.findMany({
    include: { experiment: true, researchPlan: true, entity: true, project: true, _count: { select: { datasets: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const rows = results.map((result) => ({
    id: result.id,
    title: result.title,
    resultType: result.resultType,
    templateKey: result.templateKey,
    templateInstanceKey: result.templateInstanceKey,
    templateInstanceLabel: result.templateInstanceLabel,
    templateValuesJson: JSON.stringify(result.valuesJson),
    validationStatus: result.validationStatus,
    experiment: result.experiment?.title,
    entity: result.entity?.name,
    project: result.project?.name,
    researchPlan: result.researchPlan?.code ?? result.researchPlan?.title,
    status: result.status,
    recordStatus: result.recordStatus,
    sourceType: result.sourceType,
    qualityStatus: result.qualityStatus,
    analysisMethod: result.analysisMethod,
    datasetCount: result._count.datasets,
    numericValue: result.numericValue,
    textValue: result.textValue,
    unit: result.unit,
    notes: result.notes,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  }));
  const headers = [
    "id",
    "title",
    "resultType",
    "templateKey",
    "templateInstanceKey",
    "templateInstanceLabel",
    "templateValuesJson",
    "validationStatus",
    "experiment",
    "entity",
    "project",
    "researchPlan",
    "status",
    "recordStatus",
    "sourceType",
    "qualityStatus",
    "analysisMethod",
    "datasetCount",
    "numericValue",
    "textValue",
    "unit",
    "notes",
    "createdAt",
    "updatedAt",
  ] as const;

  return downloadResponse(
    toCsv(rows, headers),
    `labnest-results-${formatExportTimestamp()}.csv`,
    "text/csv; charset=utf-8",
  );
}
