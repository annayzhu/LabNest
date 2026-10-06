import { z } from "zod";
import { plainTextFromEntryMarkdown } from "@/lib/entry-content";
import { parseTags } from "@/lib/tags";
import { entryTypes } from "./entry-assignment";
import { entrySchema } from "@/lib/validation";

export const entrySourceTypes = ["text", "photo", "file", "voice", "manual"] as const;
export const entryRecordStatuses = ["draft", "recorded", "submitted", "reviewed"] as const;
export const entryExperimentStatuses = ["planned", "running", "completed", "failed", "archived"] as const;

const entryMutationSchema = entrySchema.omit({ body: true }).extend({
  entryType: z.enum(entryTypes).default("unclassified"),
  eventTimePrecision: z.enum(["unknown", "date", "datetime"]).default("unknown"),
  expectedUpdatedAt: z.coerce.date().optional(),
  contentMarkdown: z.string().trim().min(1, "Entry body is required."),
  occurredAt: z.coerce.date(),
  recordStatus: z.enum(entryRecordStatuses).default("recorded"),
  moodStatus: z.string().trim().optional(),
  researchPlanId: z.string().trim().optional(),
  experimentId: z.string().trim().optional(),
  experimentStepId: z.string().trim().optional(),
  protocolVersionId: z.string().trim().optional(),
  experimentTitle: z.string().trim().optional(),
  experimentStatus: z.enum(entryExperimentStatuses).default("running"),
  createInitialResult: z.boolean().default(false),
  resultTitle: z.string().trim().optional(),
  resultType: z.string().trim().optional(),
  resultTextValue: z.string().trim().optional(),
  resultNotes: z.string().trim().optional(),
  clientMutationId: z.string().uuid().optional(),
  deviceCreatedAt: z.coerce.date().optional(),
}).superRefine((value, context) => {
  if (value.experimentId && value.protocolVersionId) context.addIssue({code:"custom",path:["protocolVersionId"],message:"本记录已属于现有实验，不能同时新建另一个 Protocol 实验。请先保存，再从归属菜单更改目标。"});
  if (value.createInitialResult && !value.protocolVersionId) {
    context.addIssue({ code: "custom", path: ["protocolVersionId"], message: "Choose a Protocol version before creating an initial Result." });
  }
});

export type EntryMutationInput = z.infer<typeof entryMutationSchema> & { body: string };

function optionalString(value: FormDataEntryValue | null) {
  return String(value ?? "").trim() || undefined;
}

export function parseEntryMutationFormData(formData: FormData): EntryMutationInput {
  const contentMarkdown = String(formData.get("contentMarkdown") ?? "");
  const parsed = entryMutationSchema.parse({
    title: formData.get("title"),
    entryType: formData.get("entryType") || "unclassified",
    eventTimePrecision: formData.get("eventTimePrecision") ?? (formData.get("occurredAt") ? "datetime" : "unknown"),
    expectedUpdatedAt: optionalString(formData.get("expectedUpdatedAt")),
    contentMarkdown,
    occurredAt: formData.get("occurredAt") || new Date(),
    projectId: optionalString(formData.get("projectId")),
    researchPlanId: optionalString(formData.get("researchPlanId")),
    experimentId: optionalString(formData.get("experimentId")),
    experimentStepId: optionalString(formData.get("experimentStepId")),
    tags: parseTags(formData.get("tags")),
    sourceType: formData.get("sourceType") || "text",
    recordStatus: formData.get("recordStatus") || "recorded",
    moodStatus: optionalString(formData.get("moodStatus")),
    protocolVersionId: optionalString(formData.get("protocolVersionId")),
    experimentTitle: optionalString(formData.get("experimentTitle")),
    experimentStatus: formData.get("experimentStatus") || "running",
    createInitialResult: formData.get("createInitialResult") === "true",
    resultTitle: optionalString(formData.get("resultTitle")),
    resultType: optionalString(formData.get("resultType")),
    resultTextValue: optionalString(formData.get("resultTextValue")),
    resultNotes: optionalString(formData.get("resultNotes")),
    clientMutationId: optionalString(formData.get("clientMutationId")),
    deviceCreatedAt: optionalString(formData.get("deviceCreatedAt")),
  });

  const body = plainTextFromEntryMarkdown(parsed.contentMarkdown);
  if (!body) throw new Error("Entry body must contain searchable text.");
  return { ...parsed, body };
}

export function entryMutationError(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Entry data is invalid.";
  return error instanceof Error ? error.message : "The Entry could not be saved.";
}
