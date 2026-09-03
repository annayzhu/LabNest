import { z } from "zod";
import { plainTextFromEntryMarkdown } from "@/lib/entry-content";
import { parseTags } from "@/lib/tags";
import { entrySchema } from "@/lib/validation";

export const entrySourceTypes = ["text", "photo", "file", "voice", "manual"] as const;
export const entryRecordStatuses = ["draft", "recorded", "submitted", "reviewed"] as const;
export const entryExperimentStatuses = ["planned", "running", "completed", "failed", "archived"] as const;

const entryMutationSchema = entrySchema.omit({ body: true }).extend({
  contentMarkdown: z.string().trim().min(1, "Entry body is required."),
  occurredAt: z.coerce.date(),
  recordStatus: z.enum(entryRecordStatuses).default("recorded"),
  moodStatus: z.string().trim().optional(),
  researchPlanId: z.string().trim().optional(),
  protocolVersionId: z.string().trim().optional(),
  experimentTitle: z.string().trim().optional(),
  experimentStatus: z.enum(entryExperimentStatuses).default("running"),
  createInitialResult: z.boolean().default(false),
  resultTitle: z.string().trim().optional(),
  resultType: z.string().trim().optional(),
  resultTextValue: z.string().trim().optional(),
  resultNotes: z.string().trim().optional(),
}).superRefine((value, context) => {
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
    contentMarkdown,
    occurredAt: formData.get("occurredAt") || new Date(),
    projectId: optionalString(formData.get("projectId")),
    researchPlanId: optionalString(formData.get("researchPlanId")),
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
  });

  const body = plainTextFromEntryMarkdown(parsed.contentMarkdown);
  if (!body) throw new Error("Entry body must contain searchable text.");
  return { ...parsed, body };
}

export function entryMutationError(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Entry data is invalid.";
  return error instanceof Error ? error.message : "The Entry could not be saved.";
}
