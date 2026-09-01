import { z } from "zod";
import type {
  ResultCardinality,
  ResultChartSpec,
  ResultDatasetColumn,
  ResultDatasetColumnType,
  ResultFieldDataType,
  ResultKind,
  ResultSemanticRole,
  ResultTemplate,
  ResultTemplateArtifact,
  ResultTemplateDataset,
  ResultTemplateField,
  ResultViewPreset,
} from "./types";
import { richTextFontSizeSchema } from "./rich-text-font-size-schema";

const fieldDataTypes = ["text", "number", "select", "attachment[]", "boolean", "date", "datetime"] as const;
const datasetColumnTypes = ["text", "number", "category", "boolean", "date", "datetime"] as const;
const semanticRoles = ["identifier", "design", "group", "label", "measurement", "qc", "annotation"] as const;
const cardinalities = ["single", "per_run", "per_sample", "per_timepoint", "repeatable"] as const;
const resultKinds = ["measurement", "assay", "imaging", "blot", "flow_cytometry", "omics", "observation"] as const;
const viewPresets = ["generic", "qpcr", "imaging", "blot", "flow", "timeseries", "omics"] as const;

export const resultFieldDataTypes = [...fieldDataTypes];
export const resultDatasetColumnTypes = [...datasetColumnTypes];
export const resultSemanticRoles = [...semanticRoles];
export const resultCardinalities = [...cardinalities];
export const resultKindsOptions = [...resultKinds];
export const resultViewPresetOptions = [...viewPresets];

const optionalNumberSchema = z.number().finite().optional();
const resultTemplateFieldInputSchema = z.object({
  key: z.string().optional(),
  label: z.string().optional(),
  dataType: z.enum(fieldDataTypes).optional(),
  name: z.string().optional(),
  type: z.enum(fieldDataTypes).optional(),
  unit: z.string().optional(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  semanticRole: z.enum(semanticRoles).optional(),
  description: z.string().optional(),
  validation: z.object({ min: optionalNumberSchema, max: optionalNumberSchema, pattern: z.string().optional() }).optional(),
});

const resultDatasetColumnInputSchema = z.object({
  key: z.string(),
  label: z.string().optional(),
  dataType: z.enum(datasetColumnTypes).optional(),
  required: z.boolean().optional(),
  unit: z.string().optional(),
  semanticRole: z.enum(semanticRoles).optional(),
});

const resultTemplateDatasetInputSchema = z.object({
  key: z.string(),
  label: z.string().optional(),
  required: z.boolean().optional(),
  columns: z.array(resultDatasetColumnInputSchema).default([]),
});

const resultTemplateArtifactInputSchema = z.object({
  key: z.string(),
  label: z.string().optional(),
  kind: z.enum(["file", "image", "video"]).default("file"),
  required: z.boolean().optional(),
});

const resultChartInputSchema = z.object({
  key: z.string(),
  label: z.string().optional(),
  type: z.enum(["bar", "line", "scatter"]).default("bar"),
  datasetKey: z.string(),
  xField: z.string(),
  yField: z.string(),
  seriesField: z.string().optional(),
});

const resultTemplateInstructionRunSchema = z.object({
  text: z.string(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  strike: z.boolean().optional(),
  code: z.boolean().optional(),
  link: z.string().optional(),
  color: z.literal("risk").optional(),
  fontSizePt: richTextFontSizeSchema.optional(),
});

const resultTemplateInstructionNodeSchema = z.object({
  type: z.enum(["paragraph", "heading2", "heading3", "bullet", "numbered", "quote"]),
  content: z.array(resultTemplateInstructionRunSchema),
  lineHeight: z.union([z.literal(1), z.literal(1.15), z.literal(1.3), z.literal(1.5), z.literal(2)]).optional(),
  fontFamily: z.enum(["sans", "serif", "mono"]).optional(),
});

export const resultTemplateInputSchema = z.object({
  result_type: z.string().optional(),
  templateKey: z.string().optional(),
  schemaVersion: z.number().int().positive().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  instructions: z.array(resultTemplateInstructionNodeSchema).optional(),
  resultKind: z.enum(resultKinds).optional(),
  cardinality: z.enum(cardinalities).optional(),
  fields: z.array(resultTemplateFieldInputSchema).default([]),
  datasets: z.array(resultTemplateDatasetInputSchema).optional(),
  artifacts: z.array(resultTemplateArtifactInputSchema).optional(),
  view: z.object({
    preset: z.enum(viewPresets).optional(),
    primaryMetric: z.string().optional(),
    groupBy: z.string().optional(),
    charts: z.array(resultChartInputSchema).optional(),
  }).optional(),
});

export type ResultTemplateCheck = {
  status: "complete" | "warning" | "invalid";
  errors: string[];
  warnings: string[];
};

export type ResultValidation = {
  status: "not_applicable" | "incomplete" | "valid" | "warning" | "invalid";
  complete: boolean;
  errors: string[];
  warnings: string[];
  checkedAt: string;
  templateCheck?: ResultTemplateCheck;
};

export type DatasetPreviewShape = {
  columns: Array<{ name: string; index: number; inferredType: string }>;
  rows: Array<Array<string | number | boolean | null>>;
  rowCount: number;
  columnCount: number;
};

export const RESULT_DATASET_VALUES_KEY = "__datasets";
export type ResultDatasetRowValues = Record<string, unknown>;
export type ResultDatasetValues = Record<string, ResultDatasetRowValues[]>;

export const RESULT_VIEW_PRESETS: Record<ResultViewPreset, { label: string; description: string; evidence: string[] }> = {
  generic: { label: "Generic evidence", description: "Metrics, tables, media and narrative are arranged without assay-specific assumptions.", evidence: ["Structured fields", "Datasets", "Attachments"] },
  qpcr: { label: "qPCR", description: "Prioritizes run QC, Cq-derived tables and relative-expression plots.", evidence: ["Instrument export", "Cq table", "Amplification or expression plot"] },
  imaging: { label: "Imaging", description: "Prioritizes image collections, acquisition metadata and quantitative image analysis.", evidence: ["Representative images", "Acquisition settings", "Quantification table"] },
  blot: { label: "Blot", description: "Keeps uncropped source images, lane mapping and normalized densitometry together.", evidence: ["Uncropped blot", "Lane map", "Densitometry table"] },
  flow: { label: "Flow cytometry", description: "Prioritizes source files, gating evidence, population frequencies and QC.", evidence: ["FCS or export", "Gating plots", "Population table"] },
  timeseries: { label: "Time series", description: "Prioritizes timepoint identity, repeated measures and trajectory views.", evidence: ["Timepoint table", "Trajectory plot", "Missing-timepoint QC"] },
  omics: { label: "Omics", description: "Prioritizes immutable source data, analysis provenance, summary figures and paged result tables.", evidence: ["Source matrix", "Analysis parameters", "Complete statistics table"] },
};

export function stableResultKey(value: string, fallback = "result") {
  const normalized = value
    .normalize("NFKD")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return normalized || fallback;
}

function cleanText(value: string | undefined) {
  const text = value?.trim();
  return text || undefined;
}

function inferredPreset(resultType: string): ResultViewPreset {
  const value = resultType.toLowerCase();
  if (/qpcr|pcr|cq|ct|relative.expression/.test(value)) return "qpcr";
  if (/microscop|imaging|image|fluorescen/.test(value)) return "imaging";
  if (/western|blot|gel|lane/.test(value)) return "blot";
  if (/flow|facs|cytometry/.test(value)) return "flow";
  if (/time|kinetic|growth.curve/.test(value)) return "timeseries";
  if (/rna.?seq|proteom|metabolom|omics|differential/.test(value)) return "omics";
  return "generic";
}

type ResultTemplateEvidenceShape = Pick<ResultTemplate, "fields" | "datasets" | "artifacts"> & {
  result_type?: string;
  title?: string;
};

export function inferResultViewPreset(input: ResultTemplateEvidenceShape): ResultViewPreset {
  const resultType = cleanText(input.result_type) ?? cleanText(input.title) ?? "result";
  const namedPreset = inferredPreset(resultType);
  if (namedPreset !== "generic") return namedPreset;
  if (input.artifacts?.some((artifact) => artifact.kind === "image" || artifact.kind === "video")) return "imaging";
  if (input.datasets?.some((dataset) => dataset.columns.some((column) => {
    const key = `${column.key} ${column.label}`.toLowerCase();
    return column.dataType === "date" || column.dataType === "datetime" || /time|day|hour|minute|时间|时点/.test(key);
  }))) return "timeseries";
  return "generic";
}

export function inferResultKind(input: ResultTemplateEvidenceShape, preset = inferResultViewPreset(input)): ResultKind {
  if (preset === "qpcr") return "assay";
  if (preset === "imaging") return "imaging";
  if (preset === "blot") return "blot";
  if (preset === "flow") return "flow_cytometry";
  if (preset === "omics") return "omics";
  if (input.datasets?.length || input.fields.some((field) => (field.dataType ?? field.type) === "number")) return "measurement";
  return "observation";
}

export function withInferredResultTemplateMetadata(template: ResultTemplate): ResultTemplate {
  const preset = inferResultViewPreset(template);
  return {
    ...template,
    resultKind: inferResultKind(template, preset),
    view: { ...template.view, preset },
  };
}

export function uniqueResultKey(value: string, usedKeys: Iterable<string>, fallback = "result") {
  const used = new Set(usedKeys);
  const base = stableResultKey(value, fallback);
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}

function normalizeField(input: z.infer<typeof resultTemplateFieldInputSchema>, index: number): ResultTemplateField {
  const label = cleanText(input.label) ?? cleanText(input.name) ?? cleanText(input.key) ?? `Field ${index + 1}`;
  const key = stableResultKey(input.key ?? input.name ?? input.label ?? label, `field_${index + 1}`);
  const dataType = input.dataType ?? input.type ?? "text";
  return {
    key,
    label,
    dataType,
    name: label,
    type: dataType,
    unit: cleanText(input.unit),
    required: input.required ?? false,
    options: input.options?.map((option) => option.trim()).filter(Boolean),
    semanticRole: input.semanticRole ?? (dataType === "number" ? "measurement" : "annotation"),
    description: cleanText(input.description),
    validation: input.validation,
  };
}

function normalizeColumn(input: z.infer<typeof resultDatasetColumnInputSchema>, index: number): ResultDatasetColumn {
  const key = stableResultKey(input.key, `column_${index + 1}`);
  return {
    key,
    label: cleanText(input.label) ?? (input.key.trim() || key),
    dataType: input.dataType ?? "text",
    required: input.required ?? false,
    unit: cleanText(input.unit),
    semanticRole: input.semanticRole ?? "measurement",
  };
}

export function normalizeResultTemplate(value: unknown, index = 0): ResultTemplate {
  const parsed = resultTemplateInputSchema.safeParse(value);
  const input: z.infer<typeof resultTemplateInputSchema> = parsed.success ? parsed.data : { fields: [] };
  const resultType = cleanText(input.result_type) ?? cleanText(input.title) ?? cleanText(input.templateKey) ?? `result_template_${index + 1}`;
  const templateKey = stableResultKey(input.templateKey ?? resultType, `result_template_${index + 1}`);
  const fields = input.fields.map(normalizeField);
  const datasets: ResultTemplateDataset[] = (input.datasets ?? []).map((dataset, datasetIndex) => ({
    key: stableResultKey(dataset.key, `dataset_${datasetIndex + 1}`),
    label: cleanText(dataset.label) ?? (dataset.key.trim() || `Dataset ${datasetIndex + 1}`),
    required: dataset.required ?? false,
    columns: dataset.columns.map(normalizeColumn),
  }));
  const artifacts: ResultTemplateArtifact[] = (input.artifacts ?? []).map((artifact, artifactIndex) => ({
    key: stableResultKey(artifact.key, `artifact_${artifactIndex + 1}`),
    label: cleanText(artifact.label) ?? (artifact.key.trim() || `Artifact ${artifactIndex + 1}`),
    kind: artifact.kind,
    required: artifact.required ?? false,
  }));
  const charts: ResultChartSpec[] = (input.view?.charts ?? []).map((chart, chartIndex) => ({
    key: stableResultKey(chart.key, `chart_${chartIndex + 1}`),
    label: cleanText(chart.label) ?? (chart.key.trim() || `Chart ${chartIndex + 1}`),
    type: chart.type,
    datasetKey: stableResultKey(chart.datasetKey),
    xField: stableResultKey(chart.xField),
    yField: stableResultKey(chart.yField),
    seriesField: chart.seriesField ? stableResultKey(chart.seriesField) : undefined,
  }));
  const evidenceShape = { result_type: resultType, title: input.title, fields, datasets, artifacts };
  const preset = input.view?.preset ?? inferResultViewPreset(evidenceShape);
  return {
    result_type: resultType,
    templateKey,
    schemaVersion: input.schemaVersion ?? 1,
    title: cleanText(input.title) ?? resultType,
    description: cleanText(input.description),
    instructions: input.instructions?.length ? input.instructions : undefined,
    resultKind: input.resultKind ?? inferResultKind(evidenceShape, preset),
    cardinality: input.cardinality ?? "per_run",
    fields,
    datasets,
    artifacts,
    view: {
      preset,
      primaryMetric: cleanText(input.view?.primaryMetric),
      groupBy: cleanText(input.view?.groupBy),
      charts,
    },
  };
}

export function normalizeResultTemplates(value: unknown): ResultTemplate[] {
  if (!Array.isArray(value)) return [];
  return value.map((template, index) => normalizeResultTemplate(template, index));
}

export function createDefaultResultTemplate(resultType = "measurement"): ResultTemplate {
  return normalizeResultTemplate({
    result_type: resultType,
    templateKey: stableResultKey(resultType),
    schemaVersion: 1,
    cardinality: "per_run",
    instructions: [{ type: "paragraph", content: [{ text: "" }] }],
    fields: [{ key: "value", label: "Value", dataType: "number", required: false, semanticRole: "measurement" }],
    datasets: [],
    artifacts: [],
    view: { charts: [] },
  });
}

export function resultTemplateFieldsToRows(template: ResultTemplate) {
  const normalized = normalizeResultTemplate(template);
  const fieldRows = normalized.fields.map((field) => [
    field.key ?? "",
    field.label ?? field.name ?? "",
    field.dataType ?? field.type ?? "text",
    field.unit ?? "",
    field.required ? "Yes" : "No",
    field.semanticRole ?? "annotation",
    field.options?.join(" | ") ?? "",
    field.validation?.min === undefined ? "" : String(field.validation.min),
    field.validation?.max === undefined ? "" : String(field.validation.max),
  ]);
  return [
    ["Field key", "Label", "Type", "Unit", "Required", "Role", "Options", "Min", "Max"],
    ...(fieldRows.length ? fieldRows : [["", "", "text", "", "No", "annotation", "", "", ""]]),
  ];
}

function duplicateKeys(values: string[]) {
  const seen = new Set<string>();
  return [...new Set(values.filter((value) => seen.has(value) || !seen.add(value)))];
}

export function checkResultTemplate(value: unknown): ResultTemplateCheck {
  const template = normalizeResultTemplate(value);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!template.templateKey) errors.push("Template key is required.");
  if (!template.result_type.trim()) errors.push("Result type is required.");
  if (template.result_type === "result_type") errors.push("Replace the placeholder with a Result name.");
  if (!template.fields.length && !(template.datasets?.length) && !(template.artifacts?.length)) errors.push("Define at least one field, Dataset, or artifact.");
  const duplicateFields = duplicateKeys(template.fields.map((field) => field.key ?? ""));
  if (duplicateFields.length) errors.push(`Duplicate field keys: ${duplicateFields.join(", ")}.`);
  const duplicateDatasets = duplicateKeys((template.datasets ?? []).map((dataset) => dataset.key));
  if (duplicateDatasets.length) errors.push(`Duplicate Dataset keys: ${duplicateDatasets.join(", ")}.`);
  for (const field of template.fields) {
    if ((field.dataType ?? field.type) === "select" && !field.options?.length) errors.push(`${field.label ?? field.name} is a select field without options.`);
    const { min, max } = field.validation ?? {};
    if (min !== undefined && max !== undefined && min > max) errors.push(`${field.label ?? field.name} has min greater than max.`);
  }
  for (const dataset of template.datasets ?? []) {
    if (!dataset.columns.length) warnings.push(`${dataset.label} has no column schema; the file can be registered but not column-validated.`);
    const duplicates = duplicateKeys(dataset.columns.map((column) => column.key));
    if (duplicates.length) errors.push(`${dataset.label} has duplicate columns: ${duplicates.join(", ")}.`);
  }
  const datasetMap = new Map((template.datasets ?? []).map((dataset) => [dataset.key, dataset]));
  for (const chart of template.view?.charts ?? []) {
    const dataset = datasetMap.get(chart.datasetKey);
    if (!dataset) { errors.push(`${chart.label} references unknown Dataset ${chart.datasetKey}.`); continue; }
    const columns = new Set(dataset.columns.map((column) => column.key));
    if (!columns.has(chart.xField)) errors.push(`${chart.label} references unknown x field ${chart.xField}.`);
    if (!columns.has(chart.yField)) errors.push(`${chart.label} references unknown y field ${chart.yField}.`);
  }
  return { status: errors.length ? "invalid" : warnings.length ? "warning" : "complete", errors, warnings };
}

function isBlank(value: unknown) {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

export function normalizeResultValues(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

export function resultDatasetValuesFromResultValues(value: unknown): ResultDatasetValues {
  const values = normalizeResultValues(value);
  const rawDatasets = values[RESULT_DATASET_VALUES_KEY];
  if (!rawDatasets || typeof rawDatasets !== "object" || Array.isArray(rawDatasets)) return {};
  return Object.fromEntries(Object.entries(rawDatasets).flatMap(([datasetKey, rawRows]) => {
    if (!Array.isArray(rawRows)) return [];
    const rows = rawRows.flatMap((row) => row && typeof row === "object" && !Array.isArray(row)
      ? [{ ...(row as ResultDatasetRowValues) }]
      : []);
    return [[stableResultKey(datasetKey), rows]];
  }));
}

export function withResultDatasetValues(value: unknown, datasets: ResultDatasetValues) {
  const values = normalizeResultValues(value);
  const normalized = Object.fromEntries(Object.entries(datasets).map(([datasetKey, rows]) => [
    stableResultKey(datasetKey),
    rows.map((row) => ({ ...row })),
  ]));
  if (Object.keys(normalized).length) values[RESULT_DATASET_VALUES_KEY] = normalized;
  else delete values[RESULT_DATASET_VALUES_KEY];
  return values;
}

function rowHasRecordedValue(row: ResultDatasetRowValues, dataset: ResultTemplateDataset) {
  return dataset.columns.some((column) => !isBlank(row[column.key]));
}

export function validateResultDatasetRows(dataset: ResultTemplateDataset, rawRows: unknown) {
  const rows = Array.isArray(rawRows)
    ? rawRows.flatMap((row) => row && typeof row === "object" && !Array.isArray(row) ? [{ ...(row as ResultDatasetRowValues) }] : [])
    : [];
  const recordedRows = rows.filter((row) => rowHasRecordedValue(row, dataset));
  const errors: string[] = [];
  for (const [rowIndex, row] of recordedRows.entries()) {
    for (const column of dataset.columns) {
      const value = row[column.key];
      if (column.required && isBlank(value)) {
        errors.push(`Row ${rowIndex + 1}: ${column.label} is required.`);
        continue;
      }
      if (isBlank(value)) continue;
      if (column.dataType === "number" && (typeof value !== "number" || !Number.isFinite(value))) errors.push(`Row ${rowIndex + 1}: ${column.label} must be a finite number.`);
      if (column.dataType === "boolean" && typeof value !== "boolean") errors.push(`Row ${rowIndex + 1}: ${column.label} must be true or false.`);
      if ((column.dataType === "date" || column.dataType === "datetime") && (typeof value !== "string" || Number.isNaN(Date.parse(value)))) errors.push(`Row ${rowIndex + 1}: ${column.label} must be a valid ${column.dataType}.`);
    }
  }
  return {
    status: recordedRows.length ? errors.length ? "invalid" as const : "valid" as const : "not_applicable" as const,
    rows: recordedRows,
    rowCount: recordedRows.length,
    errors,
    warnings: [] as string[],
  };
}

export function validateResultRecord(input: {
  template?: unknown;
  values?: unknown;
  instanceKey?: string | null;
  datasetStatuses?: Array<{ templateDatasetKey?: string | null; validationStatus?: string | null }>;
  artifactKeys?: string[];
}): ResultValidation {
  if (!input.template || typeof input.template !== "object" || Array.isArray(input.template) || !Object.keys(input.template as object).length) {
    return { status: "not_applicable", complete: true, errors: [], warnings: [], checkedAt: new Date().toISOString() };
  }
  const template = normalizeResultTemplate(input.template);
  const templateCheck = checkResultTemplate(template);
  const values = normalizeResultValues(input.values);
  const inlineDatasets = resultDatasetValuesFromResultValues(values);
  const errors = [...templateCheck.errors];
  const warnings = [...templateCheck.warnings];
  if (["per_sample", "per_timepoint", "repeatable"].includes(template.cardinality ?? "per_run") && !input.instanceKey?.trim()) {
    const label = template.cardinality === "per_sample" ? "Sample" : template.cardinality === "per_timepoint" ? "Timepoint" : "Repeat";
    errors.push(`${label} instance key is required.`);
  }
  for (const field of template.fields) {
    const key = field.key ?? stableResultKey(field.name ?? field.label ?? "field");
    const value = values[key];
    if (field.required && isBlank(value)) { errors.push(`${field.label ?? field.name ?? key} is required.`); continue; }
    if (isBlank(value)) continue;
    const type = field.dataType ?? field.type ?? "text";
    if (type === "number" && (typeof value !== "number" || !Number.isFinite(value))) errors.push(`${field.label ?? field.name ?? key} must be a finite number.`);
    if (type === "boolean" && typeof value !== "boolean") errors.push(`${field.label ?? field.name ?? key} must be true or false.`);
    if (type === "select" && field.options?.length && !field.options.includes(String(value))) errors.push(`${field.label ?? field.name ?? key} must use an allowed option.`);
    if (type === "number" && typeof value === "number") {
      if (field.validation?.min !== undefined && value < field.validation.min) warnings.push(`${field.label ?? field.name ?? key} is below ${field.validation.min}${field.unit ? ` ${field.unit}` : ""}.`);
      if (field.validation?.max !== undefined && value > field.validation.max) warnings.push(`${field.label ?? field.name ?? key} is above ${field.validation.max}${field.unit ? ` ${field.unit}` : ""}.`);
    }
  }
  const datasetStatuses = input.datasetStatuses ?? [];
  for (const dataset of template.datasets ?? []) {
    const matches = datasetStatuses.filter((item) => item.templateDatasetKey === dataset.key);
    const inlineValidation = validateResultDatasetRows(dataset, inlineDatasets[dataset.key]);
    if (dataset.required && !matches.length && !inlineValidation.rowCount) errors.push(`${dataset.label} Dataset is required.`);
    if (inlineValidation.errors.length) errors.push(...inlineValidation.errors.map((error) => `${dataset.label} · ${error}`));
    if (matches.some((item) => item.validationStatus === "invalid")) errors.push(`${dataset.label} Dataset failed schema validation.`);
    if (matches.some((item) => item.validationStatus === "warning" || item.validationStatus === "not_assessed")) warnings.push(`${dataset.label} Dataset needs validation review.`);
  }
  const artifactKeys = new Set(input.artifactKeys ?? []);
  for (const artifact of template.artifacts ?? []) {
    if (artifact.required && !artifactKeys.has(artifact.key)) errors.push(`${artifact.label} attachment is required.`);
  }
  const incomplete = errors.length > 0 && errors.every((error) => /required|Dataset is required|attachment is required/.test(error));
  const status = errors.length ? (incomplete ? "incomplete" : "invalid") : warnings.length ? "warning" : "valid";
  return { status, complete: status === "valid" || status === "warning", errors, warnings, checkedAt: new Date().toISOString(), templateCheck };
}

function normalizedHeader(value: string) {
  return stableResultKey(value).replaceAll("_", "");
}

function typeCompatible(expected: ResultDatasetColumnType, inferred: string) {
  if (expected === "number") return inferred === "number" || inferred === "empty";
  if (expected === "boolean") return inferred === "boolean" || inferred === "empty";
  return true;
}

export function validateDatasetPreview(schema: ResultTemplateDataset | undefined, preview: DatasetPreviewShape) {
  if (!schema) return { status: "not_applicable" as const, errors: [], warnings: [], columnMapping: {} as Record<string, string>, checkedAt: new Date().toISOString() };
  const errors: string[] = [];
  const warnings: string[] = [];
  const actual = new Map(preview.columns.map((column) => [normalizedHeader(column.name), column]));
  const columnMapping: Record<string, string> = {};
  for (const expected of schema.columns) {
    const match = actual.get(normalizedHeader(expected.key)) ?? actual.get(normalizedHeader(expected.label));
    if (!match) {
      if (expected.required) errors.push(`Required column ${expected.label} is missing.`);
      else warnings.push(`Optional column ${expected.label} is not present.`);
      continue;
    }
    columnMapping[expected.key] = match.name;
    if (!typeCompatible(expected.dataType, match.inferredType)) warnings.push(`${expected.label} was inferred as ${match.inferredType}, expected ${expected.dataType}.`);
  }
  const status: "invalid" | "warning" | "valid" = errors.length ? "invalid" : warnings.length ? "warning" : "valid";
  return { status, errors, warnings, columnMapping, checkedAt: new Date().toISOString() };
}

export function parseResultValuesJson(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return {};
  try { return normalizeResultValues(JSON.parse(value)); }
  catch { throw new Error("Template values could not be parsed. Reload the page and try again."); }
}

export function resultTemplateDatasetByKey(template: unknown, key: string | undefined) {
  if (!key) return undefined;
  return normalizeResultTemplate(template).datasets?.find((dataset) => dataset.key === key);
}

export function resultTemplateCardinalityLabel(value: ResultCardinality | undefined) {
  return ({ single: "Single result", per_run: "One per run", per_sample: "One per sample", per_timepoint: "One per timepoint", repeatable: "Repeatable" } as const)[value ?? "per_run"];
}

export function resultKindLabel(value: ResultKind | undefined) {
  return (value ?? "measurement").replaceAll("_", " ");
}

export function fieldDataType(value: ResultTemplateField): ResultFieldDataType {
  return value.dataType ?? value.type ?? "text";
}

export function datasetColumnType(value: ResultDatasetColumn): ResultDatasetColumnType {
  return value.dataType ?? "text";
}

export function fieldSemanticRole(value: ResultTemplateField): ResultSemanticRole {
  return value.semanticRole ?? "annotation";
}
