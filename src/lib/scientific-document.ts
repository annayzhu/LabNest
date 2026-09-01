import { z } from "zod";
import { stripLabNestFontFamilyMarkup } from "./rich-text-font-family";
import { stripLabNestFontSizeMarkup } from "./rich-text-font-size";
import { stripLabNestLineHeightMarkup } from "./rich-text-line-height";

const baseBlockSchema = z.object({ id: z.string().min(1) });
const tableFontSizeSchema = z.union([z.literal(8), z.literal(9), z.literal(10), z.literal(11), z.literal(12), z.literal(14)]);

export const scientificContentBlockSchema = z.discriminatedUnion("type", [
  baseBlockSchema.extend({ type: z.literal("heading"), text: z.string() }),
  baseBlockSchema.extend({ type: z.literal("text"), text: z.string() }),
  baseBlockSchema.extend({ type: z.literal("checklist"), items: z.array(z.string()) }),
  baseBlockSchema.extend({
    type: z.literal("table"),
    caption: z.string().optional(),
    rows: z.array(z.array(z.string())),
    columnWidths: z.array(z.number().finite().positive().nullable()).optional(),
    cellFontSizesPt: z.array(z.array(tableFontSizeSchema.nullable())).optional(),
  }),
  baseBlockSchema.extend({
    type: z.literal("callout"),
    tone: z.enum(["note", "warning", "critical"]),
    text: z.string(),
  }),
  baseBlockSchema.extend({
    type: z.literal("metric"),
    label: z.string(),
    value: z.string(),
    unit: z.string().optional(),
  }),
  baseBlockSchema.extend({
    type: z.literal("media"),
    mediaType: z.enum(["image", "video", "file"]),
    url: z.string(),
    caption: z.string().optional(),
  }),
  baseBlockSchema.extend({
    type: z.literal("dataset"),
    datasetId: z.string(),
    label: z.string(),
  }),
]);

export type ScientificContentBlock = z.infer<typeof scientificContentBlockSchema>;

export const scientificDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  sections: z.array(z.object({
    key: z.string().min(1),
    title: z.string().min(1),
    blocks: z.array(scientificContentBlockSchema),
  })),
});

export type ScientificDocument = z.infer<typeof scientificDocumentSchema>;
export type ScientificSectionDefinition = { key: string; title: string; aliases?: string[] };

function markdownTableRow(line: string) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return undefined;
  const cells: string[] = [];
  let cell = "";
  let escaped = false;
  for (const character of trimmed.slice(1, -1)) {
    if (escaped) {
      cell += character;
      escaped = false;
    } else if (character === "\\") escaped = true;
    else if (character === "|") {
      cells.push(cell.trim().replaceAll(/<br\s*\/?>/gi, "\n"));
      cell = "";
    } else cell += character;
  }
  if (escaped) cell += "\\";
  cells.push(cell.trim().replaceAll(/<br\s*\/?>/gi, "\n"));
  return cells;
}

function markdownTableAt(lines: string[], start: number) {
  const header = markdownTableRow(lines[start] ?? "");
  const separator = markdownTableRow(lines[start + 1] ?? "");
  if (!header?.length || !separator?.length || separator.some((cell) => !/^:?-{3,}:?$/.test(cell))) return undefined;
  const rows = [header];
  let next = start + 2;
  while (next < lines.length) {
    const row = markdownTableRow(lines[next]);
    if (!row) break;
    rows.push(row);
    next += 1;
  }
  const width = Math.max(...rows.map((row) => row.length));
  return {
    rows: rows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? "")),
    next,
  };
}

/**
 * Upgrade legacy text blocks containing Markdown tables into native scientific
 * table blocks. This also lets structured imports share one lossless path for
 * Markdown and DOCX sources.
 */
export function scientificBlocksFromText(text: string, idPrefix: string): ScientificContentBlock[] {
  const lines = text.replaceAll("\r\n", "\n").split("\n");
  const blocks: ScientificContentBlock[] = [];
  let textLines: string[] = [];
  let tableCount = 0;
  let textCount = 0;

  const flushText = () => {
    const value = textLines.join("\n").trim();
    textLines = [];
    if (!value) return;
    textCount += 1;
    blocks.push({ id: `${idPrefix}-text-${textCount}`, type: "text", text: value });
  };

  for (let index = 0; index < lines.length;) {
    const table = markdownTableAt(lines, index);
    if (!table) {
      textLines.push(lines[index]);
      index += 1;
      continue;
    }
    flushText();
    tableCount += 1;
    blocks.push({ id: `${idPrefix}-table-${tableCount}`, type: "table", rows: table.rows });
    index = table.next;
  }
  flushText();

  if (!tableCount) return [{ id: idPrefix, type: "text", text }];
  return blocks;
}

export function scientificDocumentFromStructuredRecord(
  definitions: ScientificSectionDefinition[],
  record: Record<string, unknown>,
  fields: Record<string, string>,
) {
  const document = createScientificDocument(definitions);
  for (const section of document.sections) {
    const sourceField = fields[section.key];
    const source = sourceField ? record[sourceField] : undefined;
    const text = source === null || source === undefined
      ? ""
      : typeof source === "object"
        ? JSON.stringify(source)
        : String(source).trim();
    if (text) section.blocks.push(...scientificBlocksFromText(text, `${section.key}-import-1`));
  }
  return document;
}

export const researchPlanSections: ScientificSectionDefinition[] = [
  { key: "design", title: "Design" },
  { key: "material_methods", title: "Material & methods", aliases: ["variables"] },
  { key: "acceptance_criteria", title: "Acceptance criteria" },
  { key: "constraints", title: "Constraints & dependencies" },
  { key: "references", title: "References & working notes" },
];

export const experimentSections: ScientificSectionDefinition[] = [
  { key: "background", title: "Background & rationale" },
  { key: "setup", title: "Setup & samples", aliases: ["materials"] },
  { key: "execution", title: "Execution notes", aliases: ["steps"] },
  { key: "observations", title: "Observations & media" },
  { key: "deviations", title: "Deviations & incidents" },
  { key: "conclusion", title: "Summary & conclusion" },
];

export const resultSections: ScientificSectionDefinition[] = [
  { key: "summary", title: "Summary" },
  { key: "data_media", title: "Data & media" },
  { key: "analysis", title: "Analysis" },
  { key: "interpretation", title: "Interpretation" },
  { key: "quality_limitations", title: "Deviations & limitations" },
];

const legacyTemplateSummary = "Result record created from a selected ProtocolVersion template. Measurement pending.";

export const reportSections: ScientificSectionDefinition[] = [
  { key: "executive_summary", title: "Executive summary" },
  { key: "research_question", title: "Research question & design" },
  { key: "methods", title: "Methods & execution" },
  { key: "results", title: "Results & evidence" },
  { key: "interpretation", title: "Interpretation" },
  { key: "limitations_next_steps", title: "Limitations & next steps" },
];

export function createScientificDocument(definitions: ScientificSectionDefinition[]): ScientificDocument {
  return {
    schemaVersion: 1,
    sections: definitions.map(({ key, title }) => ({ key, title, blocks: [] })),
  };
}

/**
 * Build a document from plain text keyed by section. Used wherever narrative
 * text arrives as loose strings (entry formalization, structured import) and
 * has to land in the document rather than in its own column.
 */
export function scientificDocumentFromSectionText(
  definitions: ScientificSectionDefinition[],
  texts: Record<string, string | null | undefined>,
  idSuffix = "1",
): ScientificDocument {
  const document = createScientificDocument(definitions);
  for (const section of document.sections) {
    const text = texts[section.key]?.trim();
    if (text) section.blocks.push({ id: `${section.key}-${idSuffix}`, type: "text", text });
  }
  return document;
}

export function normalizeScientificDocument(
  value: unknown,
  definitions: ScientificSectionDefinition[],
): ScientificDocument {
  const parsed = scientificDocumentSchema.safeParse(value);
  if (!parsed.success) return createScientificDocument(definitions);

  const sections = new Map(parsed.data.sections.map((section) => [section.key, section]));
  return {
    schemaVersion: 1,
    sections: definitions.map(({ key, title, aliases }) => {
      const existing = sections.get(key) ?? aliases?.map((alias) => sections.get(alias)).find(Boolean);
      return existing
        ? {
            ...existing,
            key,
            title,
            blocks: existing.blocks.flatMap((block) => block.type === "text" ? scientificBlocksFromText(block.text, block.id) : [block]),
          }
        : { key, title, blocks: [] };
    }),
  };
}

export function normalizeResearchPlanDocument(value: unknown, legacyDesign?: string | null): ScientificDocument {
  const document = normalizeScientificDocument(value, researchPlanSections);
  const design = document.sections.find((section) => section.key === "design");
  const legacyText = legacyDesign?.trim();
  if (design && !design.blocks.length && legacyText) {
    design.blocks.push({ id: "design-legacy-1", type: "text", text: legacyText });
  }
  return document;
}

export function normalizeResultDocument(value: unknown): ScientificDocument {
  const document = normalizeScientificDocument(value, resultSections);
  const summary = document.sections.find((section) => section.key === "summary");
  if (summary) {
    summary.blocks = summary.blocks.filter((block) => !(block.id === "template-summary" && block.type === "text" && block.text.trim() === legacyTemplateSummary));
  }
  return document;
}

export function parseScientificDocumentJson(
  value: FormDataEntryValue | null,
  definitions: ScientificSectionDefinition[],
): ScientificDocument {
  if (typeof value !== "string" || !value.trim()) return createScientificDocument(definitions);
  try {
    return normalizeScientificDocument(JSON.parse(value), definitions);
  } catch {
    throw new Error("The structured document could not be parsed. Reload the page and try again.");
  }
}

export function documentPlainText(document: ScientificDocument) {
  return document.sections.flatMap((section) => section.blocks.flatMap((block) => {
    if (block.type === "heading" || block.type === "callout") return [block.text];
    if (block.type === "text") return [stripLabNestFontFamilyMarkup(stripLabNestLineHeightMarkup(stripLabNestFontSizeMarkup(block.text)))];
    if (block.type === "checklist") return block.items;
    if (block.type === "table") return block.rows.flat();
    if (block.type === "metric") return [`${block.label}: ${block.value} ${block.unit ?? ""}`.trim()];
    if (block.type === "media") return [block.caption || block.url];
    return [block.label];
  })).filter(Boolean).join("\n");
}
