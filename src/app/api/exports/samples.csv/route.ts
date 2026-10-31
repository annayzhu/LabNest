import { downloadResponse, formatExportTimestamp, toCsv } from "@/lib/export";
import { prisma } from "@/lib/db";
import { sampleLocationOptions } from "@/lib/samples.server";

export const runtime = "nodejs";

/** The checked samples of the list ("Export selected…"), or every sample. Headers read back through the sample import. */
export async function GET(request: Request) {
  const ids = new URL(request.url).searchParams.getAll("id").filter(Boolean);
  const [samples, locations] = await Promise.all([
    prisma.sample.findMany({
      where: ids.length ? { id: { in: ids } } : {},
      include: { type: { select: { label: true } }, parent: { select: { code: true } }, project: { select: { name: true } } },
      orderBy: [{ code: "asc" }],
    }),
    sampleLocationOptions(prisma),
  ]);
  const place = new Map(locations.map((location) => [location.id, location.label]));
  const rows = samples.map((sample) => ({
    code: sample.code,
    name: sample.name,
    type: sample.type.label,
    origin: sample.origin,
    parent: sample.parent?.code,
    box: sample.locationId ? place.get(sample.locationId) : undefined,
    position: sample.position,
    amount: sample.amount,
    amountUnit: sample.amountUnit,
    concentration: sample.concentration,
    concentrationUnit: sample.concentrationUnit,
    status: sample.status,
    project: sample.project?.name,
    biosafetyLevel: sample.biosafetyLevel,
    date: sample.collectedAt?.toISOString().slice(0, 10),
    externalSource: sample.externalSource,
    externalId: sample.externalId,
    notes: sample.notes,
  }));
  const headers = ["code", "name", "type", "origin", "parent", "box", "position", "amount", "amountUnit", "concentration", "concentrationUnit", "status", "project", "biosafetyLevel", "date", "externalSource", "externalId", "notes"] as const;
  return downloadResponse(`﻿${toCsv(rows, headers)}`, `labnest-samples-${formatExportTimestamp()}.csv`, "text/csv; charset=utf-8");
}
