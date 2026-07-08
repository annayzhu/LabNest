import { prisma } from "@/lib/db";
import { downloadResponse, formatExportTimestamp, toCsv } from "@/lib/export";

export const runtime = "nodejs";

export async function GET() {
  const entities = await prisma.entity.findMany({
    include: { project: true, parentEntity: true, sequence: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  const rows = entities.map((entity) => ({
    id: entity.id,
    name: entity.name,
    type: entity.type,
    code: entity.code,
    project: entity.project?.name,
    status: entity.status,
    parentEntity: entity.parentEntity?.name,
    sequence: entity.sequence?.name,
    description: entity.description,
    metadataJson: JSON.stringify(entity.metadataJson),
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  }));
  const headers = [
    "id",
    "name",
    "type",
    "code",
    "project",
    "status",
    "parentEntity",
    "sequence",
    "description",
    "metadataJson",
    "createdAt",
    "updatedAt",
  ] as const;

  return downloadResponse(
    toCsv(rows, headers),
    `labnest-entities-${formatExportTimestamp()}.csv`,
    "text/csv; charset=utf-8",
  );
}
