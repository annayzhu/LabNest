import {
  experimentStatusOptions,
  projectStatusOptions,
  protocolAvailabilityOptions,
  protocolReviewStageOptions,
  protocolScopeOptions,
  recordStatusOptions,
  reportStatusOptions,
  resultQualityStatusOptions,
} from "./status-options";
import { structuredModules, type StructuredFieldDefinition, type StructuredFileFormat, type StructuredModuleKey } from "./structured-modules";

// Changes made in the import preview (Q216–Q220): values typed over a file row, rows left out, rows added. The file
// itself is never changed; the server reads it again and lays these over it, for the preview and for the import.

/** Field values by key for file rows (numbered from 1), the file rows left out, and new rows. */
export type ImportRowEdits = {
  changed: Record<string, Record<string, string>>;
  removed: number[];
  added: Record<string, string>[];
};

/** Where a previewed record comes from: a file row (with the fields changed in the preview) or a row added there. */
export type ImportRowOrigin = { row: number; changed: string[] } | { added: number };

export const noImportEdits: ImportRowEdits = { changed: {}, removed: [], added: [] };

/** Only rows of a table can be added to; a Word or Markdown document is one record. */
export const tableImportFormats: readonly StructuredFileFormat[] = ["csv", "tsv", "xlsx", "json"];

// Text that lands in a section of the record's document. It keeps its layout (tables, lists, pictures) only when
// edited in the document editor, so the preview shows it read-only.
const documentSectionKeys: Partial<Record<StructuredModuleKey, readonly string[]>> = {
  "research-plans": ["design", "materialMethods", "acceptanceCriteria", "constraints", "references"],
  protocols: ["description", "purpose", "background", "material", "steps", "resultTemplates", "consumptionRules"],
  experiments: ["background", "materials", "steps", "observations", "deviations", "conclusion"],
  results: ["summary", "analysis", "interpretation", "qualityLimitations"],
  reports: ["executiveSummary", "researchQuestion", "methods", "results", "interpretation", "limitationsNextSteps"],
};

// Columns an export writes that the import does not read.
const exportOnlyKeys: Partial<Record<StructuredModuleKey, readonly string[]>> = {
  experiments: ["researchPlanName", "methodSources"],
  results: ["validationStatus"],
};

export function isTechnicalImportField(key: string) {
  return /json|checksum|snapshot|values/i.test(key);
}

export function isDocumentSection(module: StructuredModuleKey, key: string) {
  return documentSectionKeys[module]?.includes(key) ?? false;
}

/** The fields a person can fill in or change in the preview. */
export function editableImportFields(module: StructuredModuleKey): StructuredFieldDefinition[] {
  return structuredModules[module].fields.filter((field) => !isTechnicalImportField(field.key) && !isDocumentSection(module, field.key) && !exportOnlyKeys[module]?.includes(field.key));
}

/** A record's values for the edit form, as text by field key; a list reads “a; b”, and nested data is left out. */
export function editableImportValues(module: StructuredModuleKey, record: Record<string, unknown>) {
  return Object.fromEntries(editableImportFields(module).flatMap((field) => {
    const value = record[field.key];
    if (value === undefined || value === null || value === "") return [];
    if (Array.isArray(value)) return [[field.key, value.map(String).join("; ")]];
    if (value instanceof Date) return [[field.key, value.toISOString()]];
    return typeof value === "object" ? [] : [[field.key, String(value)]];
  }));
}

export function hasImportEdits(edits: ImportRowEdits) {
  return Object.keys(edits.changed).length > 0 || edits.removed.length > 0 || edits.added.length > 0;
}

/** What an import keeps of its preview edits (Q220): the fields changed per file row, the rows left out, the rows added. */
export function importEditsSummary(edits: ImportRowEdits) {
  return {
    changedRows: Object.fromEntries(Object.entries(edits.changed).map(([row, values]) => [row, Object.keys(values)])),
    removedRows: edits.removed,
    addedRows: edits.added.length,
  };
}

const maxValueLength = 20_000;

/**
 * The edits sent with a preview or an import, checked and written in one order (rows ascending, keys sorted), so the
 * same edits always sign the same confirmation.
 */
export function parseImportEdits(value: unknown, module: StructuredModuleKey): ImportRowEdits {
  if (value === null || value === undefined || value === "") return noImportEdits;
  let raw: unknown;
  try { raw = typeof value === "string" ? JSON.parse(value) : value; } catch { throw new Error("Invalid preview changes."); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid preview changes.");
  const editable = new Set(editableImportFields(module).map((field) => field.key));
  const values = (entry: unknown, keepEmpty: boolean) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("Invalid preview changes.");
    const pairs = Object.entries(entry).map(([key, text]) => {
      if (!editable.has(key) || typeof text !== "string" || text.length > maxValueLength) throw new Error("Invalid preview changes.");
      return [key, text.trim()] as const;
    });
    return Object.fromEntries(pairs.filter(([, text]) => keepEmpty || text).sort(([a], [b]) => a.localeCompare(b)));
  };
  const { changed = {}, removed = [], added = [] } = raw as Partial<Record<keyof ImportRowEdits, unknown>>;
  if (!changed || typeof changed !== "object" || Array.isArray(changed) || !Array.isArray(removed) || !Array.isArray(added)) throw new Error("Invalid preview changes.");
  const rowNumber = (row: unknown) => {
    const number = Number(row);
    if (!Number.isInteger(number) || number < 1) throw new Error("Invalid preview changes.");
    return number;
  };
  const removedRows = [...new Set(removed.map(rowNumber))].sort((a, b) => a - b);
  const changedRows = Object.entries(changed)
    .map(([row, entry]) => [rowNumber(row), values(entry, true)] as const)
    .filter(([row, entry]) => !removedRows.includes(row) && Object.keys(entry).length)
    .sort(([a], [b]) => a - b);
  return {
    changed: Object.fromEntries(changedRows.map(([row, entry]) => [String(row), entry])),
    removed: removedRows,
    added: added.map((entry) => values(entry, false)),
  };
}

type Choice = { value: string; label: string };

// Fields the import checks against a fixed list without the template offering one: the edit form picks from it.
const statusChoices: Partial<Record<StructuredModuleKey, Record<string, readonly Choice[]>>> = {
  projects: { status: projectStatusOptions },
  "research-plans": { status: [{ value: "draft", label: "Draft" }, ...projectStatusOptions] },
  protocols: { scope: protocolScopeOptions, availability: protocolAvailabilityOptions, reviewStage: protocolReviewStageOptions },
  experiments: { status: experimentStatusOptions, recordStatus: recordStatusOptions },
  results: {
    recordStatus: recordStatusOptions,
    qualityStatus: resultQualityStatusOptions,
    sourceType: [
      { value: "manual", label: "Manual" },
      { value: "protocol_template", label: "Protocol template" },
      { value: "file_import", label: "File import" },
      { value: "tool", label: "Tool" },
      { value: "analysis", label: "Analysis" },
    ],
  },
  reports: { status: reportStatusOptions },
};

/** The choices of a field picked from a list in the edit form; `lists` holds those the app loads (inventory locations). */
export function importFieldChoices(module: StructuredModuleKey, field: StructuredFieldDefinition, lists: Record<string, string[]> = {}): Choice[] | undefined {
  if (field.optionLabels) return Object.entries(field.optionLabels).map(([value, label]) => ({ value, label }));
  const listed = statusChoices[module]?.[field.key];
  if (listed) return [...listed];
  if (field.allowedValues?.length) return field.allowedValues.map((value) => ({ value, label: value }));
  return field.choices === "list" ? (lists[field.key] ?? []).map((value) => ({ value, label: value })) : undefined;
}
