import { z } from "zod";

export const editorNamedStylesStorageKey = "labnest.editor-named-styles.v1";

const editorNamedStyleSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1).max(80),
  name: z.string().trim().min(1).max(80),
  paragraphType: z.enum(["paragraph", "heading2", "heading3"]),
  fontFamily: z.string().max(120).optional(),
  fontSize: z.string().regex(/^\d+(?:\.\d+)?pt$/).optional(),
  lineHeight: z.string().regex(/^\d+(?:\.\d+)?$/).optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  strike: z.boolean().optional(),
  color: z.string().max(32).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type EditorNamedStyle = z.infer<typeof editorNamedStyleSchema>;

export function parseEditorNamedStyles(serialized: string | null): EditorNamedStyle[] {
  if (!serialized) return [];
  try {
    const now = new Date().toISOString();
    const raw = JSON.parse(serialized);
    const migrated = Array.isArray(raw) ? raw.map((style) => ({ schemaVersion: 1, createdAt: now, updatedAt: now, ...style })) : raw;
    const result = z.array(editorNamedStyleSchema).safeParse(migrated);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

export function editorStyleNameExists(styles: EditorNamedStyle[], name: string, exceptId?: string) {
  const normalized = name.trim().toLocaleLowerCase();
  return styles.some((style) => style.id !== exceptId && style.name.toLocaleLowerCase() === normalized);
}

export function upsertEditorNamedStyle(styles: EditorNamedStyle[], style: EditorNamedStyle) {
  const parsed = editorNamedStyleSchema.parse(style);
  const index = styles.findIndex((item) => item.id === parsed.id);
  if (index < 0) return [...styles, parsed];
  return styles.map((item, itemIndex) => itemIndex === index ? parsed : item);
}
