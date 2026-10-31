import { randomBytes } from "node:crypto";
import { zhUi } from "../i18n";
import { matchKey, sampleTypeNamed, sampleUnit, type SampleRowInput, type SampleTypeRef } from "../samples";
import {
  MAX_RECORDS_PER_PUSH, SAMPLE_BANK_CONTRACT, sampleBankResultPushSchema, sampleBankSearchRequestSchema,
  type SampleBankQuery, type SampleBankRecord, type SampleBankResultPush, type SampleBankSearchAck, type SampleBankSearchRequest,
} from "./contract";

/**
 * The seam where a real sample bank plugs in (S16). Searching is asynchronous: requestSearch only hands the search over;
 * the bank pushes the results to the request's callbackUrl later, and those pushes are checked with parseResultPush.
 * LabNest sends searches with httpSampleBankConnector; pushes arrive at /api/sample-bank/results.
 */
export interface SampleBankConnector {
  /** The bank's short name, stored on imported samples as their external source. */
  readonly source: string;
  requestSearch(request: SampleBankSearchRequest): Promise<SampleBankSearchAck>;
}

/** A search ready to send: a fresh request ID, the time, and where the bank pushes the results. */
export function newSampleBankSearch(query: SampleBankQuery, options: { callbackUrl: string; requestedBy?: string; limit?: number; now?: Date }): SampleBankSearchRequest {
  return sampleBankSearchRequestSchema.parse({
    contract: SAMPLE_BANK_CONTRACT,
    requestId: `sbr_${randomBytes(12).toString("base64url")}`,
    requestedAt: (options.now ?? new Date()).toISOString(),
    ...(options.requestedBy ? { requestedBy: options.requestedBy } : {}),
    callbackUrl: options.callbackUrl,
    query,
    limit: options.limit ?? MAX_RECORDS_PER_PUSH,
  });
}

/** A pushed page checked against the contract; the error names the first problem. */
export function parseResultPush(body: unknown): SampleBankResultPush {
  const parsed = sampleBankResultPushSchema.safeParse(body);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  throw new Error(`${issue.path.join(".") || "push"}: ${issue.message}`);
}

/** The first notes line of a sample from the bank: where the bank keeps it (S23). */
export const BANK_LOCATION_PREFIX = "样本库位置：";

/** Notes with the bank's location as their first line, replacing an earlier one; other lines stay as they were. */
export function withBankLocation(notes: string | null | undefined, location: string | undefined) {
  const lines = (notes ?? "").split("\n").filter((line) => !line.startsWith(BANK_LOCATION_PREFIX));
  const joined = [location ? `${BANK_LOCATION_PREFIX}${location}` : "", ...lines].filter(Boolean).join("\n");
  return joined || null;
}

/** The bank's location as a sample's notes record it, or undefined. */
export const bankLocationOf = (notes: string | null | undefined) =>
  notes?.split("\n").find((line) => line.startsWith(BANK_LOCATION_PREFIX))?.slice(BANK_LOCATION_PREFIX.length);

/**
 * A bank record as a LabNest sample row. The type comes from the bank's remembered pairs (S27), else by key, name or
 * prefix, else Other with a warning. Attributes named like one of the type's fields (by key, or by the field's name in
 * English or Chinese) fill that field; the bank's location and the other attributes go into notes.
 */
export function sampleRowFromBankRecord(record: SampleBankRecord, types: SampleTypeRef[], typeMap: ReadonlyMap<string, string> = new Map()) {
  const warnings: string[] = [];
  const mapped = types.find((candidate) => candidate.id === typeMap.get(matchKey(record.sampleType)));
  const matched = mapped ?? sampleTypeNamed(types, record.sampleType);
  const type = matched ?? types.find((candidate) => candidate.key === "sample_other");
  if (!matched) warnings.push(`Sample type ${record.sampleType} has no match; it is kept as ${type?.label ?? "no type"}.`);
  const fieldFor = (name: string) => type?.fields.find((field) => [field.key, field.label, zhUi[field.label] ?? ""].some((candidate) => candidate && matchKey(candidate) === matchKey(name)));
  const fields: Record<string, string> = {};
  const extra: string[] = [];
  for (const [name, value] of Object.entries(record.attributes ?? {})) {
    const field = fieldFor(name);
    if (field && !(field.key in fields)) fields[field.key] = value;
    else extra.push(`${name}: ${value}`);
  }
  const row: SampleRowInput & { externalSource: string; externalId: string; parentExternalId?: string } = {
    ...(record.code ? { code: record.code } : {}),
    name: record.name,
    typeId: type?.id,
    origin: record.origin,
    collectedAt: record.collectedAt,
    amount: record.amount ? String(record.amount.value) : undefined,
    amountUnit: record.amount ? sampleUnit(record.amount.unit) : undefined,
    concentration: record.concentration ? String(record.concentration.value) : undefined,
    concentrationUnit: record.concentration ? sampleUnit(record.concentration.unit) : undefined,
    biosafetyLevel: record.biosafetyLevel,
    notes: withBankLocation(extra.join("\n"), record.location) ?? undefined,
    ...(Object.keys(fields).length ? { fields } : {}),
    externalSource: record.source,
    externalId: record.externalId,
    ...(record.parentExternalId ? { parentExternalId: record.parentExternalId } : {}),
  };
  return { row, warnings, typeMatched: Boolean(matched) };
}
