import { randomBytes } from "node:crypto";
import { sampleTypeNamed, sampleUnit, type SampleRowInput, type SampleTypeRef } from "../samples";
import {
  MAX_RECORDS_PER_PUSH, SAMPLE_BANK_CONTRACT, sampleBankResultPushSchema, sampleBankSearchRequestSchema,
  type SampleBankQuery, type SampleBankRecord, type SampleBankResultPush, type SampleBankSearchAck, type SampleBankSearchRequest,
} from "./contract";

/**
 * The seam where a real sample bank plugs in (S16). Searching is asynchronous: requestSearch only hands the search over;
 * the bank pushes the results to the request's callbackUrl later, and those pushes are checked with parseResultPush.
 * Nothing in LabNest calls a connector yet, no endpoint receives pushes and no connection settings are stored.
 */
export interface SampleBankConnector {
  /** The bank's short name, stored on imported samples as their external source. */
  readonly source: string;
  requestSearch(request: SampleBankSearchRequest): Promise<SampleBankSearchAck>;
}

/** The connector until a bank is connected: it refuses every search, saying so. */
export const noSampleBankConnector: SampleBankConnector = {
  source: "none",
  async requestSearch(request) {
    return { contract: SAMPLE_BANK_CONTRACT, requestId: request.requestId, accepted: false, error: { code: "bank_unavailable", message: "No external sample bank is connected yet." } };
  },
};

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

/**
 * How a bank record would become a LabNest sample row when imports are wired: its type matched by key, name or prefix
 * (else Other), its amount and concentration with units, the bank's location and attributes kept in notes.
 */
export function sampleRowFromBankRecord(record: SampleBankRecord, types: SampleTypeRef[]) {
  const warnings: string[] = [];
  const matched = sampleTypeNamed(types, record.sampleType);
  const type = matched ?? types.find((candidate) => candidate.key === "sample_other");
  if (!matched) warnings.push(`Sample type ${record.sampleType} has no match; it is kept as ${type?.label ?? "no type"}.`);
  const fields = Object.fromEntries(Object.entries(record.attributes ?? {}).filter(([key]) => type?.fields.some((field) => field.key === key)));
  const extra = Object.entries(record.attributes ?? {}).filter(([key]) => !(key in fields));
  const notes = [
    record.location ? `Location in ${record.source}: ${record.location}` : "",
    ...extra.map(([key, value]) => `${key}: ${value}`),
  ].filter(Boolean).join("\n");
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
    notes: notes || undefined,
    ...(Object.keys(fields).length ? { fields } : {}),
    externalSource: record.source,
    externalId: record.externalId,
    ...(record.parentExternalId ? { parentExternalId: record.parentExternalId } : {}),
  };
  return { row, warnings };
}
