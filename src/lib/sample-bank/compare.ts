import { checkFieldValues, type SampleRowInput, type SampleTypeRef } from "../samples";
import { bankLocationOf } from "./connector";

// A sample that came from the bank has two owners (S24). The bank owns what describes it: name, type, origin,
// collection date, biosafety level, the type fields it sends and the location line in notes. LabNest owns the rest:
// code, place, amount, concentration, status, project, parent, notes of its own and use in experiments.

export type BankRow = SampleRowInput & { externalSource: string; externalId: string; parentExternalId?: string };

/** The parts of a stored sample that comparing and undoing need. */
export type BankOwned = {
  name: string; typeId: string; origin: string | null; collectedAt: Date | string | null;
  biosafetyLevel: string | null; fieldValues: unknown; notes: string | null;
};

export type BankChange = { field: string; from: string; to: string };

const day = (value: Date | string | null | undefined) => value instanceof Date ? value.toISOString().slice(0, 10) : value?.slice(0, 10) ?? "";
const text = (value: string | null | undefined) => value?.trim() ?? "";
const fieldValues = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

/**
 * The bank-owned values that differ between a stored sample and the bank's row, keyed so the page can name them:
 * `name`, `type`, `origin`, `collectedAt`, `biosafetyLevel`, `location`, or `field:<key>` for a type field.
 */
export function bankChanges(sample: BankOwned, row: BankRow): BankChange[] {
  const changes: BankChange[] = [];
  const compare = (field: string, from: string, to: string) => { if (from !== to) changes.push({ field, from, to }); };
  compare("name", text(sample.name), text(row.name));
  compare("type", sample.typeId, row.typeId ?? "");
  compare("origin", text(sample.origin), text(row.origin));
  compare("collectedAt", day(sample.collectedAt), day(row.collectedAt));
  compare("biosafetyLevel", text(sample.biosafetyLevel), text(row.biosafetyLevel));
  for (const [key, value] of Object.entries(row.fields ?? {})) compare(`field:${key}`, String(fieldValues(sample.fieldValues)[key] ?? ""), value.trim());
  compare("location", bankLocationOf(sample.notes) ?? "", bankLocationOf(row.notes) ?? "");
  return changes;
}

/** A stored sample's bank-owned values, as an import keeps them to put back on undo (S26). */
export function bankOwnedSnapshot(sample: BankOwned) {
  return {
    name: sample.name, typeId: sample.typeId, origin: sample.origin, collectedAt: day(sample.collectedAt) || null,
    biosafetyLevel: sample.biosafetyLevel, fieldValues: fieldValues(sample.fieldValues), notes: sample.notes,
  };
}
export type BankOwnedSnapshot = ReturnType<typeof bankOwnedSnapshot>;

/** A type field the bank filled with a value the type cannot take goes into notes instead of stopping the import. */
export function keepValidFields(type: SampleTypeRef, row: BankRow): BankRow {
  const fields: Record<string, string> = {};
  const moved: string[] = [];
  for (const [key, value] of Object.entries(row.fields ?? {})) {
    const problems: string[] = [];
    const checked = checkFieldValues(type.fields, { [key]: value }, problems);
    if (problems.length) moved.push(`${type.fields.find((field) => field.key === key)?.label ?? key}: ${value}`);
    else Object.assign(fields, checked);
  }
  if (!moved.length) return row;
  return { ...row, fields, notes: [row.notes, ...moved].filter(Boolean).join("\n") || undefined };
}
