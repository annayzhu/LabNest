import { z } from "zod";

/**
 * The JSON contract with the lab's existing sample bank (S16). LabNest sends a search; the bank searches and pushes the
 * results back, in pages of at most 500 records, under the same request ID. The written contract with examples is
 * docs/modules/samples/20261031/SAMPLE-BANK-CONTRACT.md; a test checks every example there against these schemas.
 */
export const SAMPLE_BANK_CONTRACT = "labnest.sample-bank/v1";
export const MAX_RECORDS_PER_PUSH = 500;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "A date reads like 2026-10-31.");
const isoTime = z.string().datetime({ offset: true });
const text = (max: number) => z.string().trim().min(1).max(max);
const quantity = z.object({ value: z.number().finite().nonnegative(), unit: text(32) }).strict();
const requestId = z.string().regex(/^sbr_[A-Za-z0-9_-]{8,64}$/, "A request ID reads like sbr_ followed by 8–64 letters, digits, _ or -.");

export const sampleBankQuerySchema = z.object({
  text: text(200).optional(),
  /** LabNest sample type keys (sample_tissue…) or the bank's own type words. */
  sampleTypes: z.array(text(60)).max(20).optional(),
  origin: text(200).optional(),
  disease: text(200).optional(),
  collectedFrom: isoDate.optional(),
  collectedTo: isoDate.optional(),
  attributes: z.record(z.string(), text(200)).optional(),
}).strict().refine((query) => Object.values(query).some((value) => value !== undefined), "A search needs at least one condition.");

/** LabNest → bank: POST {bank}/searches. */
export const sampleBankSearchRequestSchema = z.object({
  contract: z.literal(SAMPLE_BANK_CONTRACT),
  requestId,
  requestedAt: isoTime,
  requestedBy: text(120).optional(),
  callbackUrl: z.string().url(),
  query: sampleBankQuerySchema,
  limit: z.number().int().min(1).max(5000).default(MAX_RECORDS_PER_PUSH),
}).strict();

/** Bank → LabNest, the immediate answer to a search: accepted (results follow as pushes) or refused. */
export const sampleBankSearchAckSchema = z.object({
  contract: z.literal(SAMPLE_BANK_CONTRACT),
  requestId,
  accepted: z.boolean(),
  bankRequestId: text(120).optional(),
  error: z.lazy(() => sampleBankErrorSchema).optional(),
}).strict().refine((ack) => ack.accepted || ack.error, "A refused search says why.");

export const sampleBankErrorCodes = ["invalid_request", "unauthorized", "unknown_request", "too_many_records", "bank_unavailable", "internal_error"] as const;
export const sampleBankErrorSchema = z.object({ code: z.enum(sampleBankErrorCodes), message: text(1000) }).strict();

/** One sample as the bank describes it. (source, externalId) is its identity in LabNest: a later push updates the same sample. */
export const sampleBankRecordSchema = z.object({
  source: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,59}$/, "A source is the bank's short name: lower-case letters, digits, . _ -."),
  externalId: text(120),
  code: text(80).optional(),
  name: text(200),
  sampleType: text(60),
  origin: text(500).optional(),
  parentExternalId: text(120).optional(),
  collectedAt: isoDate.optional(),
  amount: quantity.optional(),
  concentration: quantity.optional(),
  /** Where the bank keeps it, as the bank writes it; LabNest does not map it onto its own location tree. */
  location: text(300).optional(),
  biosafetyLevel: z.enum(["BSL-1", "BSL-2", "BSL-3"]).optional(),
  attributes: z.record(z.string(), z.string().max(500)).optional(),
  updatedAt: isoTime.optional(),
}).strict();

/** Bank → LabNest: POST {callbackUrl}; pages of one request share its requestId, and a page sent twice is taken once. */
export const sampleBankResultPushSchema = z.object({
  contract: z.literal(SAMPLE_BANK_CONTRACT),
  requestId,
  bankRequestId: text(120).optional(),
  page: z.number().int().min(1),
  pageCount: z.number().int().min(1),
  status: z.enum(["partial", "complete", "failed"]),
  total: z.number().int().min(0).optional(),
  records: z.array(sampleBankRecordSchema).max(MAX_RECORDS_PER_PUSH, `One push carries at most ${MAX_RECORDS_PER_PUSH} records.`),
  error: sampleBankErrorSchema.optional(),
}).strict()
  .refine((push) => push.page <= push.pageCount, "page cannot be above pageCount.")
  .refine((push) => push.status !== "failed" || push.error, "A failed push says why.")
  .refine((push) => new Set(push.records.map((record) => `${record.source}\n${record.externalId}`)).size === push.records.length, "A push lists each sample once.");

export type SampleBankQuery = z.infer<typeof sampleBankQuerySchema>;
export type SampleBankSearchRequest = z.infer<typeof sampleBankSearchRequestSchema>;
export type SampleBankSearchAck = z.infer<typeof sampleBankSearchAckSchema>;
export type SampleBankRecord = z.infer<typeof sampleBankRecordSchema>;
export type SampleBankResultPush = z.infer<typeof sampleBankResultPushSchema>;

export const sampleBankSchemas = {
  searchRequest: sampleBankSearchRequestSchema,
  searchAck: sampleBankSearchAckSchema,
  resultPush: sampleBankResultPushSchema,
  record: sampleBankRecordSchema,
  error: z.object({ contract: z.literal(SAMPLE_BANK_CONTRACT), requestId: requestId.optional(), error: sampleBankErrorSchema }).strict(),
} as const;
