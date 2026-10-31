import type { Prisma } from "@/generated/prisma/client";
import { bankChanges } from "./compare";
import { searchRecordRows } from "./import.server";

export type BankResultStatus = "new" | "changed" | "unchanged";

/**
 * A search's records for its results page (S22): each as a sample row, compared with the sample LabNest already has
 * for the same source and external ID, with the record of its parent when the parent came in the same search.
 */
export async function searchResults(db: Prisma.TransactionClient, searchId: string) {
  const { search, types, rows } = await searchRecordRows(db, searchId);
  const stored = rows.length ? await db.sample.findMany({
    where: { externalSource: search.connection.source, externalId: { in: rows.map(({ record }) => record.externalId) } },
    select: {
      id: true, code: true, externalId: true, name: true, typeId: true, origin: true, collectedAt: true, biosafetyLevel: true, fieldValues: true, notes: true,
      amount: true, amountUnit: true, concentration: true, concentrationUnit: true,
    },
  }) : [];
  const byExternal = new Map(stored.map((sample) => [sample.externalId!, sample]));
  const recordOf = new Map(rows.map(({ record, recordId }) => [record.externalId, recordId]));
  const results = rows.map(({ recordId, record, row, warnings, typeMatched }) => {
    const sample = byExternal.get(record.externalId);
    const changes = sample ? bankChanges(sample, row) : [];
    const status: BankResultStatus = !sample ? "new" : changes.length ? "changed" : "unchanged";
    return {
      recordId, record, row, warnings, typeMatched, status, changes,
      sample: sample ? { id: sample.id, code: sample.code, amount: sample.amount, amountUnit: sample.amountUnit, concentration: sample.concentration, concentrationUnit: sample.concentrationUnit } : null,
      parentRecordId: record.parentExternalId ? recordOf.get(record.parentExternalId) ?? null : null,
    };
  });
  return { search, types, results };
}
