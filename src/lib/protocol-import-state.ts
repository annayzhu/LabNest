import { z } from "zod";

/** Source declarations are evidence; only the import policy chooses persisted states. */
export const protocolAvailabilityValues = ["draft", "active", "retired", "archived"] as const;
export const protocolReviewValues = ["draft", "ready_for_review", "reviewed"] as const;
export type ProtocolAvailability = typeof protocolAvailabilityValues[number];
export type ProtocolReviewStage = typeof protocolReviewValues[number];
export type StateDeclaration<T extends string = string> = {
  status: "valid" | "missing" | "invalid";
  raw: string | null;
  value: T | null;
};
export type ProtocolImportIssue = {
  code: "PROTOCOL_AVAILABILITY_MISMATCH" | "PROTOCOL_STATE_MISSING" | "PROTOCOL_STATE_INVALID";
  field: "availability" | "reviewStage";
  source?: "filename" | "document";
  filenameValue?: string | null;
  documentValue?: string | null;
  rawValue?: string | null;
  importedValue: "draft" | null;
  resolution: "import_as_draft" | "legacy_unverified";
  originalText?: string;
};
export type ProtocolImportDecision = {
  policyVersion: "protocol-draft-v1";
  filenameAvailability: StateDeclaration<ProtocolAvailability>;
  documentAvailability: StateDeclaration<ProtocolAvailability>;
  documentReviewStage: StateDeclaration<ProtocolReviewStage>;
  importedAvailability: "draft";
  importedReviewStage: "draft";
  issues: ProtocolImportIssue[];
};

const issueSchema = z.object({
  code: z.enum(["PROTOCOL_AVAILABILITY_MISMATCH", "PROTOCOL_STATE_MISSING", "PROTOCOL_STATE_INVALID"]),
  field: z.enum(["availability", "reviewStage"]), source: z.enum(["filename", "document"]).optional(),
  filenameValue: z.string().nullable().optional(), documentValue: z.string().nullable().optional(), rawValue: z.string().nullable().optional(),
  importedValue: z.literal("draft").nullable(), resolution: z.enum(["import_as_draft", "legacy_unverified"]), originalText: z.string().optional(),
});
const availabilityDeclaration = z.object({ status: z.enum(["valid", "missing", "invalid"]), raw: z.string().nullable(), value: z.enum(protocolAvailabilityValues).nullable() });
const decisionSchema = z.object({
  policyVersion: z.literal("protocol-draft-v1"), filenameAvailability: availabilityDeclaration, documentAvailability: availabilityDeclaration,
  documentReviewStage: availabilityDeclaration.extend({ value: z.enum(protocolReviewValues).nullable() }),
  importedAvailability: z.literal("draft"), importedReviewStage: z.literal("draft"), issues: z.array(issueSchema),
});
export function readImportDecision(value: unknown): ProtocolImportDecision | null {
  const parsed = decisionSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
export function readImportIssues(value: unknown): ProtocolImportIssue[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((issue) => { const parsed = issueSchema.safeParse(issue); return parsed.success ? [parsed.data] : []; });
}

function declaration<T extends string>(raw: unknown, allowed: readonly T[]): StateDeclaration<T> {
  const text = raw == null ? "" : String(raw).trim();
  const value = text.split(/[（(]/)[0].trim().toLowerCase().replaceAll(" ", "_");
  return { raw: text || null, status: !text ? "missing" : allowed.includes(value as T) ? "valid" : "invalid", value: allowed.includes(value as T) ? value as T : null };
}

export function decideProtocolImportState(input: { fileName: string; availability?: unknown; reviewStage?: unknown; compareFilename?: boolean }): ProtocolImportDecision {
  // Capture unrecognized suffixes too: a spelling error must not silently become Draft.
  const filenameRaw = input.fileName.match(/_v\d+(?:\.\d+)+_([^.]*)\.[^.]+$/i)?.[1];
  const filenameAvailability = declaration(filenameRaw, protocolAvailabilityValues);
  const documentAvailability = declaration(input.availability, protocolAvailabilityValues);
  const documentReviewStage = declaration(input.reviewStage, protocolReviewValues);
  const issues: ProtocolImportIssue[] = [];
  if (input.compareFilename !== false && filenameAvailability.value && documentAvailability.value && filenameAvailability.value !== documentAvailability.value) {
    issues.push({ code: "PROTOCOL_AVAILABILITY_MISMATCH", field: "availability", filenameValue: filenameAvailability.value, documentValue: documentAvailability.value, importedValue: "draft", resolution: "import_as_draft" });
  }
  for (const [source, field, state] of [
    ...(input.compareFilename === false ? [] : [["filename", "availability", filenameAvailability]]),
    ["document", "availability", documentAvailability], ["document", "reviewStage", documentReviewStage],
  ] as Array<["filename" | "document", "availability" | "reviewStage", StateDeclaration]>) {
    if (state.status !== "valid") issues.push({ code: state.status === "missing" ? "PROTOCOL_STATE_MISSING" : "PROTOCOL_STATE_INVALID", field, source, rawValue: state.raw, importedValue: "draft", resolution: "import_as_draft" });
  }
  return { policyVersion: "protocol-draft-v1", filenameAvailability, documentAvailability, documentReviewStage, importedAvailability: "draft", importedReviewStage: "draft", issues };
}

/** A read-only compatibility projection. Never alters a saved version or Run snapshot. */
export function separateLegacyImportWarnings(warnings: readonly string[]) {
  const history: ProtocolImportIssue[] = [];
  const contentWarnings: string[] = [];
  for (const originalText of warnings) {
    const match = originalText.match(/^Filename availability (draft|active|retired|archived) does not match document availability (draft|active|retired|archived)\.$/);
    if (match) history.push({ code: "PROTOCOL_AVAILABILITY_MISMATCH", field: "availability", filenameValue: match[1], documentValue: match[2], importedValue: null, resolution: "legacy_unverified", originalText });
    else contentWarnings.push(originalText);
  }
  return { history, contentWarnings };
}
