import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { ExperimentSampleLine } from "./experiment-samples";
import { isRecordLocked } from "./record-lifecycle";
import {
  boxGeometry, checkSampleRows, matchKey, normalizePosition, samplePrefix, sampleCode, sampleCodeNumber, sampleTypeRef,
  type BoxGeometry, type SampleBatchContext, type SampleRowInput, type SampleTypeRef,
} from "./samples";

type Db = Prisma.TransactionClient;

/** The preset types in the order S6 lists them; types people add follow in the order they were made. */
const presetOrder = ["sample_tissue", "sample_blood", "sample_serum", "sample_plasma", "sample_cells", "sample_rna", "sample_cdna", "sample_dna", "sample_protein", "sample_other"];
export const bySampleTypeOrder = (a: { key: string }, b: { key: string }) => {
  const left = presetOrder.indexOf(a.key), right = presetOrder.indexOf(b.key);
  return (left < 0 ? presetOrder.length : left) - (right < 0 ? presetOrder.length : right);
};

/** The sample types people can choose (S6); a disabled type stays only on the samples that have it. */
export async function sampleTypes(db: Pick<Db, "scientificSchemaDefinition">, options: { includeDisabled?: boolean } = {}): Promise<SampleTypeRef[]> {
  const types = await db.scientificSchemaDefinition.findMany({
    where: { objectKind: "sample", ...(options.includeDisabled ? {} : { enabled: true }) },
    select: { id: true, key: true, label: true, prefix: true, fieldDefinitions: true, defaultSettings: true },
    orderBy: [{ createdAt: "asc" }, { key: "asc" }],
  });
  return types.sort(bySampleTypeOrder).map(sampleTypeRef);
}

export type SampleLocationOption = { id: string; label: string; name: string; type: string; geometry: BoxGeometry | null; temperature: string | null };

/** Active storage locations with their path (Freezer A › Shelf 2 › RNA box 1), boxes first in tree order. */
export async function sampleLocationOptions(db: Pick<Db, "inventoryLocation">): Promise<SampleLocationOption[]> {
  const locations = await db.inventoryLocation.findMany({ where: { status: "active" }, select: { id: true, name: true, type: true, parentLocationId: true, temperature: true, gridRows: true, gridColumns: true }, orderBy: { name: "asc" } });
  const byId = new Map(locations.map((location) => [location.id, location]));
  const path = (id: string) => {
    const names: string[] = [];
    const seen = new Set<string>();
    for (let current = byId.get(id); current && !seen.has(current.id); current = current.parentLocationId ? byId.get(current.parentLocationId) : undefined) {
      names.unshift(current.name);
      seen.add(current.id);
    }
    return names.join(" › ");
  };
  return locations
    .map((location) => ({ id: location.id, label: path(location.id), name: location.name, type: location.type, geometry: boxGeometry(location), temperature: location.temperature }))
    .sort((a, b) => a.label.localeCompare(b.label, "zh-Hans-CN", { numeric: true }));
}

/** An experiment whose samples may change: it exists, is not archived and its record is not locked (S12). Edits to its samples queue behind its row lock. */
export async function openExperiment(db: Db, id: string) {
  const experiment = await db.experiment.findUnique({ where: { id }, select: { id: true, status: true, recordStatus: true, projectId: true } });
  if (!experiment) throw new Error("This Experiment no longer exists.");
  if (experiment.status === "archived" || isRecordLocked(experiment.recordStatus)) throw new Error("This Experiment is locked; its samples cannot change.");
  await db.$queryRaw`SELECT 1 FROM "Experiment" WHERE "id" = ${id} FOR UPDATE`;
  return experiment;
}

/** Everything a batch is checked against: codes in use, parents, boxes and the positions samples in storage hold. */
export async function sampleBatchContext(db: Db, rows: SampleRowInput[]): Promise<SampleBatchContext> {
  const codes = [...new Set(rows.map((row) => row.code?.trim()).filter((code): code is string => Boolean(code)))];
  const parentCodes = [...new Set(rows.map((row) => row.parentCode?.trim()).filter((code): code is string => Boolean(code)))];
  const insensitive = (values: string[]) => values.map((value) => ({ code: { equals: value, mode: "insensitive" as const } }));
  const [types, existing, parents, locations] = await Promise.all([
    sampleTypes(db),
    codes.length ? db.sample.findMany({ where: { OR: insensitive(codes) }, select: { code: true } }) : Promise.resolve([]),
    parentCodes.length ? db.sample.findMany({ where: { OR: insensitive(parentCodes) }, select: { id: true, code: true, origin: true, status: true } }) : Promise.resolve([]),
    sampleLocationOptions(db),
  ]);
  const locationIds = [...new Set(rows.map((row) => row.locationId).filter((id): id is string => Boolean(id)))];
  const held = locationIds.length ? await db.sample.findMany({ where: { locationId: { in: locationIds }, position: { not: null } }, select: { locationId: true, position: true } }) : [];
  const occupied = new Map<string, Set<string>>();
  for (const sample of held) occupied.set(sample.locationId!, (occupied.get(sample.locationId!) ?? new Set()).add(normalizePosition(sample.position)));
  return {
    types: new Map(types.map((type) => [type.id, type])),
    existingCodes: new Set(existing.map((sample) => matchKey(sample.code))),
    parents: new Map(parents.map((parent) => [matchKey(parent.code), parent])),
    locations: new Map(locations.map((location) => [location.id, { id: location.id, label: location.label, geometry: location.geometry }])),
    occupied,
  };
}

/** The next codes for a prefix (RNA-0012…): above every code already made from it, reserved under a row lock. */
export async function reserveSampleCodes(db: Db, prefix: string, count: number) {
  if (!Number.isSafeInteger(count) || count < 1 || count > 5000) throw new Error("Sample code reservation count must be between 1 and 5000.");
  const existing = await db.sample.findMany({ where: { code: { startsWith: `${prefix}-` } }, select: { code: true } });
  const highest = existing.reduce((max, sample) => Math.max(max, sampleCodeNumber(prefix, sample.code) ?? 0), 0);
  const rows = await db.$queryRaw<Array<{ value: number | bigint }>>(Prisma.sql`
    INSERT INTO "RecordCodeCounter" ("key", "value", "updatedAt")
    VALUES (${`sample:${prefix}`}, ${highest + count}, CURRENT_TIMESTAMP)
    ON CONFLICT ("key") DO UPDATE
    SET "value" = GREATEST("RecordCodeCounter"."value" + ${count}, EXCLUDED."value"),
        "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "value"
  `);
  const end = Number(rows[0]?.value);
  if (!Number.isSafeInteger(end)) throw new Error(`Could not reserve the next ${prefix} codes.`);
  return Array.from({ length: count }, (_, index) => sampleCode(prefix, end - count + index + 1));
}

export type SampleBatchProblem = { index: number; problems: string[] };
export class SampleBatchError extends Error {
  constructor(readonly rows: SampleBatchProblem[]) {
    super(`${rows.length} row${rows.length === 1 ? "" : "s"} need${rows.length === 1 ? "s" : ""} attention before saving.`);
  }
}

/**
 * Checks and writes a whole batch in one transaction: nothing is saved unless every row passes (S8). Rows without a
 * code take their type's next codes. Output samples of an experiment are linked to it, in the grid's order and with
 * their parent's group when the parent was one of its inputs (S11).
 */
export async function createSampleBatch(db: Db, rows: SampleRowInput[], options: { projectId?: string | null; experimentId?: string | null } = {}) {
  const context = await sampleBatchContext(db, rows);
  const checked = checkSampleRows(rows, context);
  if (!checked.ok) throw new SampleBatchError(checked.rows.filter((row) => row.problems.length).map(({ index, problems }) => ({ index, problems: problems.length ? problems : ["Check this row."] })));
  const values = checked.rows.map((row) => row.value!);
  const codes = new Map<number, string>();
  const byPrefix = new Map<string, number[]>();
  values.forEach((value, index) => {
    if (value.code) return;
    const prefix = samplePrefix(context.types.get(value.typeId)?.prefix);
    byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), index]);
  });
  for (const [prefix, indexes] of byPrefix) (await reserveSampleCodes(db, prefix, indexes.length)).forEach((code, position) => codes.set(indexes[position], code));
  const batchId = `batch_${randomUUID()}`;
  const inputs = options.experimentId ? await db.experimentSample.findMany({ where: { experimentId: options.experimentId, role: "input" }, select: { sampleId: true, groupId: true } }) : [];
  const groupOfParent = new Map(inputs.map((input) => [input.sampleId, input.groupId]));
  const lastOrder = options.experimentId ? (await db.experimentSample.aggregate({ where: { experimentId: options.experimentId, role: "output" }, _max: { sortOrder: true } }))._max.sortOrder ?? -1 : -1;
  const data = values.map((value, index) => ({
    code: value.code ?? codes.get(index)!, name: value.name, typeId: value.typeId, origin: value.origin, parentId: value.parentId,
    projectId: options.projectId ?? null, locationId: value.locationId, position: value.position,
    amount: value.amount, amountUnit: value.amountUnit, concentration: value.concentration, concentrationUnit: value.concentrationUnit,
    collectedAt: value.collectedAt, biosafetyLevel: value.biosafetyLevel, notes: value.notes, fieldValues: value.fieldValues, batchId,
  }));
  const returned = await db.sample.createManyAndReturn({ data, select: { id: true, code: true, name: true } });
  // Codes are unique, so the grid's order is recovered by code whatever order the rows come back in.
  const byCode = new Map(returned.map((sample) => [sample.code, sample]));
  const created = data.map((row) => byCode.get(row.code)!);
  if (options.experimentId) {
    await db.experimentSample.createMany({ data: created.map((sample, index) => ({
      experimentId: options.experimentId!, sampleId: sample.id, role: "output" as const, sortOrder: lastOrder + 1 + index,
      groupId: values[index].parentId ? groupOfParent.get(values[index].parentId!) ?? null : null,
    })) });
  }
  await db.activityLog.create({ data: { action: "create_batch", targetType: "sample_batch", targetId: batchId, metadataJson: { count: created.length, sampleIds: created.map((sample) => sample.id), experimentId: options.experimentId ?? null } } });
  return { batchId, samples: created };
}

/** Each experiment's samples as lines of its record (S12): inputs then outputs, in the experiment's order. */
export async function experimentSampleLines(db: Pick<Db, "experimentSample" | "inventoryLocation">, experimentIds: string[]) {
  const lines = new Map<string, ExperimentSampleLine[]>();
  if (!experimentIds.length) return lines;
  const [links, locations] = await Promise.all([
    db.experimentSample.findMany({
      where: { experimentId: { in: experimentIds } },
      orderBy: [{ role: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      include: { group: { select: { label: true } }, sample: { select: { code: true, name: true, locationId: true, position: true, type: { select: { label: true } }, parent: { select: { code: true } } } } },
    }),
    sampleLocationOptions(db),
  ]);
  const place = new Map(locations.map((location) => [location.id, location.label]));
  for (const link of links) {
    const line: ExperimentSampleLine = {
      role: link.role, code: link.sample.code, name: link.sample.name, type: link.sample.type.label, group: link.group?.label ?? null, parent: link.sample.parent?.code ?? null,
      place: link.sample.locationId ? `${place.get(link.sample.locationId) ?? ""}${link.sample.position ? ` ${link.sample.position}` : ""}` : null,
      used: link.usedAmount === null ? null : `${link.usedAmount} ${link.usedUnit ?? ""}`.trim(),
    };
    lines.set(link.experimentId, [...(lines.get(link.experimentId) ?? []), line]);
  }
  return lines;
}

/** Why a sample cannot be deleted: samples derived from it and experiments it took part in (S10). */
export async function sampleReferenceCounts(db: Pick<Db, "sample" | "experimentSample">, ids: string[]) {
  const [children, links] = await Promise.all([
    db.sample.groupBy({ by: ["parentId"], where: { parentId: { in: ids } }, _count: { _all: true } }),
    db.experimentSample.groupBy({ by: ["sampleId"], where: { sampleId: { in: ids } }, _count: { _all: true } }),
  ]);
  const childCount = new Map(children.map((row) => [row.parentId!, row._count._all]));
  const linkCount = new Map(links.map((row) => [row.sampleId, row._count._all]));
  return new Map(ids.map((id) => [id, { children: childCount.get(id) ?? 0, experiments: linkCount.get(id) ?? 0 }]));
}
