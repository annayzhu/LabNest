import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { checkSampleRows, matchKey, MAX_SAMPLE_BATCH, samplePrefix, type SampleBatchContext } from "../samples";
import { reserveSampleCodes, SampleBatchError, sampleTypes } from "../samples.server";
import { sampleBankRecordSchema } from "./contract";
import { sampleRowFromBankRecord, withBankLocation } from "./connector";
import { bankChanges, bankOwnedSnapshot, keepValidFields, type BankOwnedSnapshot, type BankRow } from "./compare";

type Tx = Prisma.TransactionClient;

/** One import takes at most a whole search (S25, set by the user on 2026-10-31); rows are checked and written 500 at a time. */
export const MAX_BANK_IMPORT = 5000;

/** What a bank import changed, so that undoing its batch can put updated samples back. */
export type BankImportUpdate = { sampleId: string; before: BankOwnedSnapshot };

/** A search's records as sample rows: remembered type pairs applied, field values the type cannot take moved to notes. */
export async function searchRecordRows(db: Tx, searchId: string, recordIds?: string[]) {
  const search = await db.sampleBankSearch.findUnique({ where: { id: searchId }, include: { connection: { select: { id: true, name: true, source: true } } } });
  if (!search) throw new Error("This search was not found.");
  const [types, typeMap, entries] = await Promise.all([
    sampleTypes(db),
    bankTypeMap(db, search.connectionId),
    db.sampleBankRecord.findMany({ where: { searchId, ...(recordIds ? { id: { in: recordIds } } : {}) }, orderBy: [{ page: "asc" }, { receivedAt: "asc" }, { id: "asc" }] }),
  ]);
  const byId = new Map(types.map((type) => [type.id, type]));
  const rows = entries.map((entry) => {
    const record = sampleBankRecordSchema.parse(entry.record);
    const mapped = sampleRowFromBankRecord(record, types, typeMap);
    const type = mapped.row.typeId ? byId.get(mapped.row.typeId) : undefined;
    return { recordId: entry.id, page: entry.page, record, ...mapped, row: type ? keepValidFields(type, mapped.row) : mapped.row };
  });
  return { search, types, rows };
}

/** The bank's remembered type words (S27), as matchKey reads them, and the sample type each means. */
export async function bankTypeMap(db: Pick<Tx, "sampleBankTypeMap">, connectionId: string) {
  const maps = await db.sampleBankTypeMap.findMany({ where: { connectionId }, select: { bankType: true, typeId: true } });
  return new Map(maps.map((map) => [map.bankType, map.typeId]));
}

/**
 * The chosen records of a search into LabNest, in one transaction (S23–S26):
 * - a record LabNest does not have yet becomes a sample of a new batch: its own code when free, else the type's next
 *   code; not placed; linked to its parent when the parent is in LabNest or comes with it, else a note says so;
 * - a record LabNest has already updates the bank-owned values that differ, keeping what they were for undo;
 * - a record that changes nothing is counted and left alone.
 */
export async function importBankRecords(tx: Tx, input: { searchId: string; recordIds: string[]; projectId: string | null }) {
  const ids = [...new Set(input.recordIds)];
  if (!ids.length) throw new Error("Choose the records to import.");
  if (ids.length > MAX_BANK_IMPORT) throw new Error(`One import takes at most ${MAX_BANK_IMPORT} records.`);
  const { search, types, rows } = await searchRecordRows(tx, input.searchId, ids);
  if (rows.length !== ids.length) throw new Error("Some of the chosen records are no longer in this search.");
  const source = search.connection.source;
  const parentIds = rows.flatMap(({ record }) => record.parentExternalId ? [record.parentExternalId] : []);
  const stored = await tx.sample.findMany({
    where: { externalSource: source, externalId: { in: [...new Set([...rows.map(({ record }) => record.externalId), ...parentIds])] } },
    select: { id: true, externalId: true, name: true, typeId: true, origin: true, collectedAt: true, biosafetyLevel: true, fieldValues: true, notes: true },
  });
  const byExternal = new Map(stored.map((sample) => [sample.externalId!, sample]));
  const fresh = rows.filter(({ record }) => !byExternal.has(record.externalId));
  const known = rows.filter(({ record }) => byExternal.has(record.externalId));
  const context: SampleBatchContext = { types: new Map(types.map((type) => [type.id, type])), existingCodes: new Set(), parents: new Map(), locations: new Map(), occupied: new Map() };

  // New samples. A code the bank asks for is used when nobody has it; a taken or repeated one falls back to the prefix.
  const arriving = new Set(fresh.map(({ record }) => record.externalId));
  const taken = await takenCodes(tx, fresh.flatMap(({ row }) => row.code ? [row.code] : []));
  const seen = new Set<string>();
  const prepared = fresh.map(({ record, row }) => {
    const key = row.code ? matchKey(row.code) : undefined;
    const ownCode = key && !taken.has(key) && !seen.has(key);
    if (key && ownCode) seen.add(key);
    const parentMissing = record.parentExternalId && !arriving.has(record.parentExternalId) && !byExternal.has(record.parentExternalId);
    const notes = [row.notes, parentMissing ? `母样本（样本库编号 ${record.parentExternalId}）未导入` : ""].filter(Boolean).join("\n");
    return { record, row: { ...row, code: ownCode ? row.code : undefined, notes: notes || undefined } };
  });
  const values = checkInChunks(prepared.map(({ row }) => row), context);
  const codes = new Map<number, string>();
  const byPrefix = new Map<string, number[]>();
  values.forEach((value, index) => {
    if (value.code) return;
    const prefix = samplePrefix(context.types.get(value.typeId)?.prefix);
    byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), index]);
  });
  for (const [prefix, indexes] of byPrefix) (await reserveSampleCodes(tx, prefix, indexes.length)).forEach((code, position) => codes.set(indexes[position], code));
  const batchId = `batch_${randomUUID()}`;
  const data = values.map((value, index) => ({
    code: value.code ?? codes.get(index)!, name: value.name, typeId: value.typeId, origin: value.origin, projectId: input.projectId,
    amount: value.amount, amountUnit: value.amountUnit, concentration: value.concentration, concentrationUnit: value.concentrationUnit,
    collectedAt: value.collectedAt, biosafetyLevel: value.biosafetyLevel, notes: value.notes, fieldValues: value.fieldValues,
    batchId, externalSource: source, externalId: prepared[index].record.externalId,
  }));
  const created = new Map<string, string>();
  for (let start = 0; start < data.length; start += MAX_SAMPLE_BATCH) {
    for (const sample of await tx.sample.createManyAndReturn({ data: data.slice(start, start + MAX_SAMPLE_BATCH), select: { id: true, externalId: true } })) created.set(sample.externalId!, sample.id);
  }
  // Parents are linked once everything exists, so their order in the push does not matter (S25).
  const children = new Map<string, string[]>();
  for (const { record } of prepared) {
    const parentId = record.parentExternalId ? created.get(record.parentExternalId) ?? byExternal.get(record.parentExternalId)?.id : undefined;
    if (parentId) children.set(parentId, [...(children.get(parentId) ?? []), created.get(record.externalId)!]);
  }
  for (const [parentId, childIds] of children) await tx.sample.updateMany({ where: { id: { in: childIds } }, data: { parentId } });

  // Samples LabNest has already: the bank's own values only (S24).
  const updated: BankImportUpdate[] = [];
  const knownValues = checkInChunks(known.map(({ row }) => ({ ...row, code: undefined })), context);
  for (const [index, { record, row }] of known.entries()) {
    const sample = byExternal.get(record.externalId)!;
    if (!bankChanges(sample, row).length) continue;
    const value = knownValues[index];
    updated.push({ sampleId: sample.id, before: bankOwnedSnapshot(sample) });
    await tx.sample.update({
      where: { id: sample.id },
      data: {
        name: value.name, typeId: value.typeId, origin: value.origin, collectedAt: value.collectedAt, biosafetyLevel: value.biosafetyLevel,
        fieldValues: { ...(sample.fieldValues as Record<string, string>), ...value.fieldValues }, notes: withBankLocation(sample.notes, record.location),
      },
    });
  }

  const result = { batchId, created: created.size, updated: updated.length, unchanged: known.length - updated.length };
  if (result.created || result.updated) await tx.sampleBankImport.create({ data: { id: batchId, searchId: search.id, created: result.created, updated: updated as unknown as Prisma.InputJsonValue } });
  await tx.activityLog.create({ data: { action: "sample_bank_import", targetType: "sample_bank_search", targetId: search.id, metadataJson: { ...result, source, projectId: input.projectId } } });
  return result;
}

/** Rows checked 500 at a time, the most one check takes; any problem stops the whole import. */
function checkInChunks(rows: BankRow[], context: SampleBatchContext) {
  const values = [];
  const problems = [];
  for (let start = 0; start < rows.length; start += MAX_SAMPLE_BATCH) {
    for (const row of checkSampleRows(rows.slice(start, start + MAX_SAMPLE_BATCH), context).rows) {
      if (row.problems.length || !row.value) problems.push({ index: start + row.index, problems: row.problems.length ? row.problems : ["Check this row."] });
      else values.push(row.value);
    }
  }
  if (problems.length) throw new SampleBatchError(problems);
  return values;
}

/** Which of these codes a sample already has, compared as matchKey does. */
async function takenCodes(tx: Tx, codes: string[]) {
  if (!codes.length) return new Set<string>();
  const wanted = [...new Set(codes.map(matchKey))];
  const rows = await tx.$queryRaw<{ code: string }[]>`SELECT code FROM "Sample" WHERE upper(code) = ANY(${wanted})`;
  return new Set(rows.map((row) => matchKey(row.code)));
}
