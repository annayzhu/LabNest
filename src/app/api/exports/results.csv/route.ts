import { prisma } from "@/lib/db";
import { downloadResponse, formatExportTimestamp, toCsv } from "@/lib/export";

export const runtime = "nodejs";

export async function GET() {
  const results = await prisma.result.findMany({
    include: { experiment: true, entity: true, project: true },
    orderBy: { updatedAt: "desc" },
  });
  const rows = results.map((result) => ({
    id: result.id,
    title: result.title,
    resultType: result.resultType,
    experiment: result.experiment?.title,
    entity: result.entity?.name,
    project: result.project?.name,
    status: result.status,
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
    "experiment",
    "entity",
    "project",
    "status",
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
