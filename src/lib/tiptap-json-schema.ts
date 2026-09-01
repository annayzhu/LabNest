import type { JSONContent } from "@tiptap/core";
import { z } from "zod";

const tiptapMarkSchema = z.object({
  type: z.string(),
  attrs: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

/** Validates the JSON-only Tiptap subtree persisted for rich table cells. */
export const tiptapJsonContentSchema: z.ZodType<JSONContent> = z.lazy(() => z.object({
  type: z.string().optional(),
  attrs: z.record(z.string(), z.unknown()).optional(),
  content: z.array(tiptapJsonContentSchema).optional(),
  marks: z.array(tiptapMarkSchema).optional(),
  text: z.string().optional(),
}).passthrough());

export const tiptapCellRichContentSchema = z.array(tiptapJsonContentSchema);
