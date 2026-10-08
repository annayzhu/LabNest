import { z } from "zod";
import { AI_LIMITS, extractJsonPayload } from "./ai";
import { evaluateFormula, type ProtocolParameterValues } from "./protocol";
import { richTextPlainText, type ProtocolDocument, type projectProtocolDocument } from "./protocol-document";
import { normalizeResultTemplate, stableResultKey } from "./result-templates";
import { signature } from "./structured-import-confirmation";
import type { ConsumptionRule, ProtocolParameter, ProtocolStep, ResultFieldDataType, ResultTemplate } from "./types";

/**
 * AI-assisted extraction for Protocol imports.
 *
 * The model reads the parsed document and proposes parameters, consumption rules, step
 * attributes, and result-template fields. Every proposal is checked here, signed, and
 * returned to the preview. Only items the user ticks are merged into the new version.
 */

type Projection = ReturnType<typeof projectProtocolDocument>;

export const MAX_CONTEXT_CHARS = 24_000;
const TOKEN_TTL_MS = 30 * 60 * 1000;
const FORMULA_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const resultFieldTypes = ["text", "number", "select", "boolean", "date", "datetime"] as const satisfies readonly ResultFieldDataType[];

// ---------------------------------------------------------------------------
// Model output
// ---------------------------------------------------------------------------

const evidence = z.string().trim().min(1).max(600);

const rawProposalSchema = z.object({
  parameters: z.array(z.object({
    name: z.string().trim().min(1).max(60),
    label: z.string().trim().max(120).optional(),
    type: z.enum(["number", "text", "select", "boolean"]),
    default: z.union([z.string(), z.number(), z.boolean()]).optional(),
    unit: z.string().trim().max(30).optional(),
    required: z.boolean().optional(),
    options: z.array(z.string().trim().min(1)).max(30).optional(),
    evidence,
  })).max(40).default([]),
  consumptionRules: z.array(z.object({
    material_name: z.string().trim().min(1).max(160),
    formula: z.string().trim().min(1).max(200),
    unit: z.string().trim().min(1).max(30),
    requires_inventory_selection: z.boolean().optional(),
    evidence,
  })).max(40).default([]),
  stepAttributes: z.array(z.object({
    order: z.number().int().positive(),
    requires_confirmation: z.boolean().optional(),
    allows_deviation: z.boolean().optional(),
    evidence,
  })).max(80).default([]),
  resultFields: z.array(z.object({
    template_title: z.string().trim().min(1).max(120),
    key: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(120),
    type: z.enum(resultFieldTypes),
    unit: z.string().trim().max(30).optional(),
    evidence,
  })).max(60).default([]),
  warnings: z.array(z.string().max(300)).max(20).default([]),
});

type RawProposal = z.infer<typeof rawProposalSchema>;

export type ExtractionStatus = "ok" | "duplicate" | "unmatched" | "invalid";

export type ExtractionItem =
  | { id: string; kind: "parameter"; status: ExtractionStatus; message?: string; evidence: string; value: ProtocolParameter }
  | { id: string; kind: "consumption_rule"; status: ExtractionStatus; message?: string; evidence: string; value: ConsumptionRule }
  | { id: string; kind: "step_attribute"; status: ExtractionStatus; message?: string; evidence: string; value: { order: number; title?: string; requires_confirmation?: boolean; allows_deviation?: boolean } }
  | { id: string; kind: "result_field"; status: ExtractionStatus; message?: string; evidence: string; value: { template_title: string; key: string; label: string; type: (typeof resultFieldTypes)[number]; unit?: string } };

export type ExtractionProposal = {
  checksum: string;
  rowIndex: number;
  provider: string;
  model: string | null;
  expiresAt: number;
  items: ExtractionItem[];
  warnings: string[];
  truncated: boolean;
};

export type SignedExtractionProposal = { proposal: ExtractionProposal; token: string };

export type AcceptedExtraction = { proposal: ExtractionProposal; token: string; acceptedIds: string[] };

// ---------------------------------------------------------------------------
// Context and prompt
// ---------------------------------------------------------------------------

export function buildExtractionContext(document: ProtocolDocument, projection: Projection) {
  const sections = document.sections.map((section) => {
    const lines = section.blocks.flatMap((block): string[] => {
      switch (block.type) {
        case "heading":
          return [`### ${block.text}`];
        case "text":
          return [block.text];
        case "rich_text":
          return [richTextPlainText(block.nodes)];
        case "checklist":
          return block.items.map((item) => `- [ ] ${item}`);
        case "callout":
          return [`> ${block.tone.toUpperCase()}: ${block.text}`];
        case "timer":
          return [`Timer: ${block.label} ${block.durationMinutes} min${block.notes ? ` (${block.notes})` : ""}`];
        case "table":
          return [tableToMarkdown(block.rows, block.caption)];
        default:
          // Media and embedded tools carry no extractable text and are never sent.
          return [];
      }
    });
    return [`## ${section.title} [${section.key}]`, ...lines.filter((line) => line.trim())].join("\n");
  });
  const full = sections.join("\n\n");
  const truncated = full.length > MAX_CONTEXT_CHARS;
  return { text: truncated ? full.slice(0, MAX_CONTEXT_CHARS) : full, truncated, recognized: summarizeProjection(projection) };
}

function tableToMarkdown(rows: string[][], caption?: string) {
  if (!rows.length) return "";
  const width = Math.max(...rows.map((row) => row.length));
  const cell = (value: string | undefined) => (value ?? "").replace(/\|/g, "/").replace(/\s+/g, " ").trim();
  const line = (row: string[]) => `| ${Array.from({ length: width }, (_, index) => cell(row[index])).join(" | ")} |`;
  return [caption ? `Table: ${caption}` : "", line(rows[0]), `|${" --- |".repeat(width)}`, ...rows.slice(1).map(line)].filter(Boolean).join("\n");
}

function summarizeProjection(projection: Projection) {
  return {
    materials: projection.materials.map((item) => item.name),
    steps: projection.steps.map((step) => ({ order: step.order, title: step.title, requires_confirmation: Boolean(step.requires_confirmation), allows_deviation: Boolean(step.allows_deviation) })),
    consumptionRules: projection.consumptionRules,
    resultTemplates: projection.resultTemplates.map((template) => ({ title: template.title ?? template.result_type, fields: template.fields.map(fieldKey) })),
  };
}

export function buildExtractionPrompt(context: ReturnType<typeof buildExtractionContext>) {
  const system = [
    "You read a laboratory protocol and propose structured data for a lab notebook. A scientist reviews every item before anything is saved.",
    "Return only one JSON object with these arrays (use [] when nothing applies):",
    '{"parameters":[{"name","label","type","default","unit","required","options","evidence"}],',
    ' "consumptionRules":[{"material_name","formula","unit","requires_inventory_selection","evidence"}],',
    ' "stepAttributes":[{"order","requires_confirmation","allows_deviation","evidence"}],',
    ' "resultFields":[{"template_title","key","label","type","unit","evidence"}],',
    ' "warnings":[string]}',
    "Rules:",
    "- parameters: run-time variables a scientist sets per run (cell count, well count, volume per well, concentration, time). name must be an identifier: letters, digits, underscore, starting with a letter, e.g. well_count. type is number, text, select, or boolean. Give a default only when the document states one.",
    "- consumptionRules: how much of a listed material one run consumes. formula uses only numbers, + - * / and parentheses, and parameter names you defined. material_name must be a material that appears in the document.",
    "- stepAttributes: order is the step number from the recognized steps. requires_confirmation=true for safety-critical or irreversible steps; allows_deviation=true when the text allows adjusting the step.",
    "- resultFields: values the scientist records after the run. type is text, number, select, boolean, date, or datetime. key is snake_case.",
    "- evidence: copy the exact short sentence or table row from the document that supports the item. Items without evidence are discarded.",
    "- Never invent quantities, concentrations, or materials that are not in the document. Skip anything already recognized unless you correct it.",
  ].join("\n");
  const user = [
    "Already recognized by the importer:",
    JSON.stringify(context.recognized, null, 1),
    "",
    context.truncated ? `Document text (truncated to ${MAX_CONTEXT_CHARS} characters):` : "Document text:",
    context.text,
  ].join("\n");
  return { system, user };
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

export function parseRawProposal(text: string): RawProposal {
  if (text.length > AI_LIMITS.responseText) throw new Error("The model response is too large. Nothing was proposed.");
  let json: unknown;
  try {
    json = JSON.parse(extractJsonObject(text));
  } catch {
    throw new Error("The model response was not valid JSON. Nothing was proposed.");
  }
  const parsed = rawProposalSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`The model response did not match the extraction format (${issue?.path.join(".") || "root"}: ${issue?.message}).`);
  }
  return parsed.data;
}

function extractJsonObject(text: string) {
  const payload = extractJsonPayload(text);
  if (payload.startsWith("{")) return payload;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start !== -1 && end > start ? text.slice(start, end + 1) : payload;
}

const squash = (value: string) => value.toLowerCase().normalize("NFKC").replace(/[\s\p{P}\p{S}]+/gu, "");

/** Loose check that the quoted evidence comes from the document rather than the model. */
function evidenceFound(quote: string, documentText: string) {
  const needle = squash(quote);
  if (!needle) return false;
  const haystack = squash(documentText);
  if (haystack.includes(needle)) return true;
  // Models often trim or merge table cells; accept when most of a long quote is present in order.
  const probe = needle.slice(0, Math.min(24, needle.length));
  return needle.length >= 8 && haystack.includes(probe);
}

export function checkProposal(raw: RawProposal, context: { text: string }, projection: Projection): { items: ExtractionItem[]; warnings: string[] } {
  const items: ExtractionItem[] = [];
  const evidenceStatus = (quote: string): { status?: ExtractionStatus; message?: string } =>
    evidenceFound(quote, context.text) ? {} : { status: "unmatched", message: "Evidence not found in the document text." };

  const parameterNames = new Set<string>();
  const defaults: ProtocolParameterValues = {};
  raw.parameters.forEach((parameter, index) => {
    let status: ExtractionStatus = "ok";
    let message: string | undefined;
    const value: ProtocolParameter = {
      name: parameter.name,
      type: parameter.type,
      ...(parameter.unit ? { unit: parameter.unit } : {}),
      ...(parameter.required !== undefined ? { required: parameter.required } : {}),
      ...(parameter.options?.length ? { options: parameter.options } : {}),
    };
    if (parameter.default !== undefined) {
      const coerced = parameter.type === "number" ? Number(parameter.default) : parameter.default;
      if (parameter.type === "number" && !Number.isFinite(coerced)) {
        status = "invalid";
        message = "Default value is not a number.";
      } else {
        value.default = coerced;
      }
    }
    if (!FORMULA_IDENTIFIER.test(parameter.name)) {
      status = "invalid";
      message = "Name must use letters, digits, and underscores so formulas can reference it.";
    } else if (parameterNames.has(parameter.name)) {
      status = "invalid";
      message = "Duplicate parameter name in this proposal.";
    } else if (parameter.type === "select" && !parameter.options?.length) {
      status = "invalid";
      message = "A select parameter needs options.";
    }
    if (status === "ok") {
      const check = evidenceStatus(parameter.evidence);
      if (check.status) {
        status = check.status;
        message = check.message;
      }
    }
    if (status !== "invalid") {
      parameterNames.add(parameter.name);
      if (typeof value.default === "number") defaults[parameter.name] = value.default;
    }
    items.push({ id: `parameter-${index + 1}`, kind: "parameter", status, message, evidence: parameter.evidence, value });
  });

  const materialNames = projection.materials.map((material) => squash(material.name));
  const existingRules = new Set(projection.consumptionRules.map((rule) => squash(rule.material_name)));
  raw.consumptionRules.forEach((rule, index) => {
    let status: ExtractionStatus = "ok";
    let message: string | undefined;
    const value: ConsumptionRule = {
      material_name: rule.material_name,
      formula: rule.formula,
      unit: rule.unit,
      ...(rule.requires_inventory_selection !== undefined ? { requires_inventory_selection: rule.requires_inventory_selection } : {}),
    };
    try {
      const quantity = evaluateFormula(rule.formula, defaults);
      if (!Number.isFinite(quantity) || quantity < 0) throw new Error("Formula gives a negative or non-finite quantity.");
    } catch (error) {
      status = "invalid";
      message = `Formula check failed with the proposed defaults: ${error instanceof Error ? error.message : "unknown error"}`;
    }
    const name = squash(rule.material_name);
    if (status === "ok") {
      if (!materialNames.some((material) => material && (material.includes(name) || name.includes(material))) && !squash(context.text).includes(name)) {
        status = "unmatched";
        message = "Material is not listed in the document.";
      } else if (existingRules.has(name)) {
        status = "duplicate";
        message = "Replaces the rule the importer already found for this material.";
      } else {
        const check = evidenceStatus(rule.evidence);
        if (check.status) {
          status = check.status;
          message = check.message;
        }
      }
    }
    items.push({ id: `consumption-${index + 1}`, kind: "consumption_rule", status, message, evidence: rule.evidence, value });
  });

  const stepsByOrder = new Map(projection.steps.map((step) => [step.order, step]));
  raw.stepAttributes.forEach((attribute, index) => {
    const step = stepsByOrder.get(attribute.order);
    let status: ExtractionStatus = "ok";
    let message: string | undefined;
    if (!step) {
      status = "invalid";
      message = `Step ${attribute.order} does not exist in the recognized steps.`;
    } else if (attribute.requires_confirmation === undefined && attribute.allows_deviation === undefined) {
      status = "invalid";
      message = "No attribute was proposed.";
    } else if (
      (attribute.requires_confirmation === undefined || attribute.requires_confirmation === Boolean(step.requires_confirmation)) &&
      (attribute.allows_deviation === undefined || attribute.allows_deviation === Boolean(step.allows_deviation))
    ) {
      status = "duplicate";
      message = "The step already has these attributes.";
    } else {
      const check = evidenceStatus(attribute.evidence);
      if (check.status) {
        status = check.status;
        message = check.message;
      }
    }
    items.push({
      id: `step-${index + 1}`,
      kind: "step_attribute",
      status,
      message,
      evidence: attribute.evidence,
      value: {
        order: attribute.order,
        ...(step ? { title: step.title } : {}),
        ...(attribute.requires_confirmation !== undefined ? { requires_confirmation: attribute.requires_confirmation } : {}),
        ...(attribute.allows_deviation !== undefined ? { allows_deviation: attribute.allows_deviation } : {}),
      },
    });
  });

  const existingFields = new Set(projection.resultTemplates.flatMap((template) => template.fields.map((field) => squash(fieldKey(field)))));
  const seenFields = new Set<string>();
  raw.resultFields.forEach((field, index) => {
    const key = stableResultKey(field.key, `field_${index + 1}`);
    let status: ExtractionStatus = "ok";
    let message: string | undefined;
    const identity = `${squash(field.template_title)}:${key}`;
    if (seenFields.has(identity)) {
      status = "invalid";
      message = "Duplicate field in this proposal.";
    } else if (existingFields.has(squash(key)) || existingFields.has(squash(field.label))) {
      status = "duplicate";
      message = "A result template already defines this field.";
    } else {
      const check = evidenceStatus(field.evidence);
      if (check.status) {
        status = check.status;
        message = check.message;
      }
    }
    seenFields.add(identity);
    items.push({
      id: `result-${index + 1}`,
      kind: "result_field",
      status,
      message,
      evidence: field.evidence,
      value: { template_title: field.template_title, key, label: field.label, type: field.type, ...(field.unit ? { unit: field.unit } : {}) },
    });
  });

  return { items, warnings: raw.warnings };
}

function fieldKey(field: { key?: string; name?: string; label?: string }) {
  return field.key || field.name || field.label || "";
}

// ---------------------------------------------------------------------------
// Signing
// ---------------------------------------------------------------------------

function proposalDigest(proposal: ExtractionProposal) {
  return signature(`protocol-extraction:${canonicalJson(proposal)}`);
}

/** JSON with sorted keys, so a proposal that round-trips through the browser and zod keeps its digest. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function signProposal(fields: Omit<ExtractionProposal, "expiresAt">, now = Date.now()): SignedExtractionProposal {
  const proposal: ExtractionProposal = { ...fields, expiresAt: now + TOKEN_TTL_MS };
  return { proposal, token: proposalDigest(proposal) };
}

/** Returns the accepted items when the proposal is authentic, unexpired, and bound to this file and row. */
export function verifyAcceptedExtraction(accepted: AcceptedExtraction, checksum: string, rowIndex: number, now = Date.now()): ExtractionItem[] {
  const { proposal, token, acceptedIds } = accepted;
  if (proposal.checksum !== checksum || proposal.rowIndex !== rowIndex) throw new Error("The AI extraction belongs to a different file or record. Run it again.");
  if (proposal.expiresAt < now) throw new Error("The AI extraction expired. Run it again before importing.");
  if (!/^[a-f0-9]{64}$/.test(token) || proposalDigest(proposal) !== token) throw new Error("The AI extraction was changed after it was checked. Run it again.");
  const wanted = new Set(acceptedIds);
  const chosen = proposal.items.filter((item) => wanted.has(item.id));
  const rejected = chosen.find((item) => item.status === "invalid");
  if (rejected) throw new Error(`An invalid AI item was selected (${rejected.id}). Clear it before importing.`);
  return chosen;
}

const acceptedExtractionSchema = z.object({
  proposal: z.object({
    checksum: z.string(),
    rowIndex: z.number().int().nonnegative(),
    provider: z.string(),
    model: z.string().nullable(),
    expiresAt: z.number(),
    items: z.array(z.object({ id: z.string(), kind: z.string(), status: z.string(), evidence: z.string() }).passthrough()),
    warnings: z.array(z.string()),
    truncated: z.boolean(),
  }).passthrough(),
  token: z.string(),
  acceptedIds: z.array(z.string()),
});

/** Parses the `aiExtractions` form field: a JSON array of accepted extractions keyed by row. */
export function parseAcceptedExtractions(value: FormDataEntryValue | null): AcceptedExtraction[] {
  if (typeof value !== "string" || !value.trim()) return [];
  let json: unknown;
  try {
    json = JSON.parse(value);
  } catch {
    throw new Error("The AI extraction selection is malformed. Run it again.");
  }
  const parsed = z.array(acceptedExtractionSchema).safeParse(json);
  if (!parsed.success) throw new Error("The AI extraction selection is malformed. Run it again.");
  return parsed.data.filter((entry) => entry.acceptedIds.length) as unknown as AcceptedExtraction[];
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

export type ExtractionMerge = {
  parameters: ProtocolParameter[];
  steps: ProtocolStep[];
  consumptionRules: ConsumptionRule[];
  resultTemplates: ResultTemplate[];
  counts: { parameters: number; consumptionRules: number; stepAttributes: number; resultFields: number };
};

/** Applies accepted items over the importer's own projection. Accepted items win over heuristic ones. */
export function mergeExtraction(projection: Pick<Projection, "steps" | "consumptionRules" | "resultTemplates">, items: ExtractionItem[]): ExtractionMerge {
  const parameters: ProtocolParameter[] = [];
  const consumptionRules = [...projection.consumptionRules];
  const steps = projection.steps.map((step) => ({ ...step }));
  const resultTemplates = projection.resultTemplates.map((template) => ({ ...template, fields: [...template.fields] }));
  const counts = { parameters: 0, consumptionRules: 0, stepAttributes: 0, resultFields: 0 };
  const newTemplates = new Map<string, ResultTemplate>();

  for (const item of items) {
    if (item.kind === "parameter") {
      parameters.push(item.value);
      counts.parameters += 1;
    }
    if (item.kind === "consumption_rule") {
      const index = consumptionRules.findIndex((rule) => squash(rule.material_name) === squash(item.value.material_name));
      if (index >= 0) consumptionRules[index] = item.value;
      else consumptionRules.push(item.value);
      counts.consumptionRules += 1;
    }
    if (item.kind === "step_attribute") {
      const step = steps.find((candidate) => candidate.order === item.value.order);
      if (!step) continue;
      if (item.value.requires_confirmation !== undefined) step.requires_confirmation = item.value.requires_confirmation;
      if (item.value.allows_deviation !== undefined) step.allows_deviation = item.value.allows_deviation;
      counts.stepAttributes += 1;
    }
    if (item.kind === "result_field") {
      const titleKey = squash(item.value.template_title);
      const field = { key: item.value.key, label: item.value.label, name: item.value.label, dataType: item.value.type, type: item.value.type, unit: item.value.unit, content: [] };
      const existing = resultTemplates.find((template) => squash(template.title ?? "") === titleKey || squash(template.result_type) === titleKey);
      if (existing) {
        if (!existing.fields.some((candidate) => squash(fieldKey(candidate)) === squash(field.key))) existing.fields.push(field);
      } else {
        const created = newTemplates.get(titleKey) ?? { result_type: item.value.template_title, title: item.value.template_title, fields: [] };
        created.fields.push(field);
        newTemplates.set(titleKey, created);
      }
      counts.resultFields += 1;
    }
  }

  const appended = [...newTemplates.values()].map((template, index) => normalizeResultTemplate(template, resultTemplates.length + index));
  return { parameters, steps, consumptionRules, resultTemplates: [...resultTemplates, ...appended], counts };
}
