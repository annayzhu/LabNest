import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { experimentDocumentFromNarrative } from "@/lib/experiment-document";
import { createExperimentWithProtocolSnapshotInTransaction, type ExperimentSnapshotInput } from "@/lib/experiments";
import { parseCustomExperimentSteps } from "@/lib/experiment-planning";
import {
  createEmptyProtocolDocument,
  normalizeProtocolDocument,
  projectProtocolDocument,
  type ProtocolDocument,
} from "@/lib/protocol-document";
import { isValidRecordCode, reserveRecordCode } from "@/lib/record-codes";
import { collectReportSources } from "@/lib/reports";
import { createResultInTransaction } from "@/lib/result-creation";
import { checkResultTemplate, normalizeResultTemplate, normalizeResultValues, validateResultRecord } from "@/lib/result-templates";
import {
  documentPlainText,
  reportSections,
  researchPlanSections,
  resultSections,
  scientificDocumentFromStructuredRecord,
} from "@/lib/scientific-document";
import type { ParsedStructuredFile } from "@/lib/structured-files";
import { structuredModules, type StructuredModuleKey } from "@/lib/structured-modules";
import { parseTags } from "@/lib/tags";

export type StructuredImportRowPreview = {
  index: number;
  values: Record<string, string>;
  errors: string[];
  warnings: string[];
};

export type StructuredImportPreview = {
  module: StructuredModuleKey;
  format: ParsedStructuredFile["format"];
  fileName: string;
  checksum: string;
  mapping: ParsedStructuredFile["mapping"];
  warnings: string[];
  errors: string[];
  rows: StructuredImportRowPreview[];
  canImport: boolean;
};

type ProjectData = { kind: "projects"; name: string; description?: string; status: "active" | "paused" | "completed" | "archived"; tags: string[] };
type ResearchPlanData = {
  kind: "research-plans";
  projectId: string;
  code?: string;
  title: string;
  objective?: string;
  hypothesis?: string;
  rationale?: string;
  design?: string;
  status: "draft" | "active" | "paused" | "completed" | "archived";
  tags: string[];
  protocolIds: string[];
  primaryProtocolId?: string;
  contentJson: Prisma.InputJsonValue;
};
type ProtocolData = {
  kind: "protocols";
  humanCode?: string;
  canonicalTitle: string;
  shortTitle?: string;
  englishTitle?: string;
  scope: "general" | "project";
  projectId?: string;
  availability: "draft" | "active" | "retired" | "archived";
  reviewStage: "draft" | "ready_for_review" | "reviewed";
  displayVersion: string;
  tags: string[];
  researchPlanIds: string[];
  primaryResearchPlanIds: string[];
  document: ProtocolDocument;
};
type ExperimentData = { kind: "experiments"; input: ExperimentSnapshotInput };
type ResultData = {
  kind: "results";
  experimentId: string;
  projectId?: string;
  researchPlanId?: string;
  title: string;
  resultType: string;
  recordStatus: "draft" | "recorded" | "submitted" | "reviewed";
  sourceType: "manual" | "protocol_template" | "file_import" | "tool" | "analysis";
  qualityStatus: "not_assessed" | "pass" | "warning" | "fail";
  textValue?: string;
  numericValue?: number;
  unit?: string;
  analysisMethod?: string;
  notes?: string;
  protocolVersionId?: string;
  templateKey?: string;
  templateInstanceKey?: string;
  templateInstanceLabel?: string;
  templateSnapshotJson: Prisma.InputJsonValue;
  valuesJson: Prisma.InputJsonValue;
  validationStatus: "not_applicable" | "incomplete" | "valid" | "warning" | "invalid";
  validationJson: Prisma.InputJsonValue;
  viewSpecJson: Prisma.InputJsonValue;
  contentJson: Prisma.InputJsonValue;
  provenanceJson: Prisma.InputJsonValue;
};
type InventoryData = {
  kind: "inventory";
  name: string;
  englishName?: string;
  category?: string;
  brand?: string;
  principalInvestigator?: string;
  containerType?: string;
  barcode?: string;
  aliquotCode?: string;
  lotNumber?: string;
  vendor?: string;
  catalogNumber?: string;
  casNumber?: string;
  currentQuantity: number;
  unit: string;
  lowThreshold?: number;
  concentration?: string;
  locationId?: string;
  positionCode?: string;
  expiryDate?: Date;
  storageCondition?: string;
  freezeThawCount: number;
  status: "active" | "inactive" | "archived";
  notes?: string;
};
type CollectedReportSources = Awaited<ReturnType<typeof collectReportSources>>;
type ReportData = {
  kind: "reports";
  projectId: string;
  researchPlanId?: string;
  title: string;
  status: "draft" | "ready_for_review" | "final" | "archived";
  periodStart?: Date;
  periodEnd?: Date;
  tags: string[];
  contentJson: Prisma.InputJsonValue;
  collected: CollectedReportSources;
};
type PreparedData = ProjectData | ResearchPlanData | ProtocolData | ExperimentData | ResultData | InventoryData | ReportData;
type PreparedRow = { index: number; data: PreparedData };

export type StructuredImportValidation = {
  preview: StructuredImportPreview;
  prepared: PreparedRow[];
};

function optionalText(value: unknown) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "object") return JSON.stringify(value);
  const text = String(value).trim();
  return text || undefined;
}

function requiredText(value: unknown, label: string, errors: string[]) {
  const text = optionalText(value);
  if (!text) errors.push(`${label} is required.`);
  return text ?? "";
}

function listValue(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value ?? "").split(/[;,；，\n]/).map((item) => item.trim()).filter(Boolean);
}

function numberValue(value: unknown, label: string, errors: string[], fallback?: number) {
  if (value === "" || value === null || value === undefined) {
    if (fallback !== undefined) return fallback;
    errors.push(`${label} is required.`);
    return 0;
  }
  const parsed = typeof value === "number" ? value : Number(String(value).replaceAll(",", ""));
  if (!Number.isFinite(parsed)) { errors.push(`${label} must be a finite number.`); return fallback ?? 0; }
  return parsed;
}

function dateValue(value: unknown, label: string, errors: string[], required = false) {
  const text = optionalText(value);
  if (!text) {
    if (required) errors.push(`${label} is required.`);
    return undefined;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) { errors.push(`${label} is not a valid date.`); return undefined; }
  return date;
}

function enumValue<const T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number], label: string, errors: string[]) {
  const normalized = optionalText(value)?.toLowerCase().replaceAll(" ", "_") ?? fallback;
  if (!allowed.includes(normalized)) {
    errors.push(`${label} must be one of: ${allowed.join(", ")}.`);
    return fallback;
  }
  return normalized as T[number];
}

function lower(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function isPlaceholder(value: string) {
  return /replace with|请填写/i.test(value);
}

function displayValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "object") return JSON.stringify(value).slice(0, 180);
  return String(value).slice(0, 180);
}

function previewValues(module: StructuredModuleKey, record: Record<string, unknown>) {
  return Object.fromEntries(structuredModules[module].fields
    .filter((field) => record[field.key] !== undefined && record[field.key] !== "")
    .map((field) => [field.label, displayValue(record[field.key])]));
}

function parseJsonValue(value: unknown) {
  if (typeof value !== "string") return value;
  const text = value.trim();
  if (!text || !/^[{[]/.test(text)) return value;
  try { return JSON.parse(text) as unknown; } catch { return value; }
}

function protocolDocumentFromRecord(record: Record<string, unknown>) {
  const parsed = normalizeProtocolDocument(parseJsonValue(record.contentJson));
  if (parsed) return parsed;
  const document = createEmptyProtocolDocument();
  const section = (key: ProtocolDocument["sections"][number]["key"]) => document.sections.find((item) => item.key === key)!;
  for (const key of ["description", "purpose", "background"] as const) {
    const text = optionalText(record[key]);
    if (text) section(key).blocks.push({ id: `${key}-import-1`, type: "text", text });
  }
  const material = optionalText(record.material);
  if (material) section("material").blocks.push({ id: "material-import-1", type: "text", text: material });
  const steps = optionalText(record.steps);
  if (steps) section("steps").blocks.push({ id: "steps-import-1", type: "rich_text", nodes: steps.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => ({ type: /^\d+[.、]\s*/.test(line) ? "numbered" as const : "paragraph" as const, content: [{ text: line.replace(/^\d+[.、]\s*/, "") }] })) });
  const resultTemplates = optionalText(record.resultTemplates);
  if (resultTemplates) section("result_templates").blocks.push({ id: "results-import-1", type: "text", text: resultTemplates });
  const consumptionRules = optionalText(record.consumptionRules);
  if (consumptionRules) section("consumption_rules").blocks.push({ id: "consumption-import-1", type: "text", text: consumptionRules });
  return document;
}

function uniqueMatch<T>(items: T[], label: string): { value?: T; error?: string } {
  if (items.length === 1) return { value: items[0] };
  if (!items.length) return { error: `${label} was not found.` };
  return { error: `${label} is ambiguous; use a stable ID or a more specific code.` };
}

export async function validateStructuredImport(parsed: ParsedStructuredFile): Promise<StructuredImportValidation> {
  const [projects, plans, protocols, experiments, locations, inventoryItems, duplicateAttachment] = await Promise.all([
    prisma.project.findMany(),
    prisma.researchPlan.findMany({ include: { protocols: true } }),
    prisma.protocol.findMany({ include: { versions: { orderBy: { revision: "desc" } }, researchPlans: true } }),
    prisma.experiment.findMany(),
    prisma.inventoryLocation.findMany({ where: { status: "active" } }),
    prisma.inventoryItem.findMany({ select: { id: true, aliquotCode: true, barcode: true } }),
    prisma.attachment.findFirst({ where: { sha256: parsed.checksum, links: { some: { linkType: "structured_import_source" } } }, select: { id: true } }),
  ]);

  const prepared: PreparedRow[] = [];
  const previewRows: StructuredImportRowPreview[] = [];
  const globalErrors = duplicateAttachment ? ["This exact source file has already been imported."] : [];
  const batchKeys = new Set<string>();

  const resolveProject = (value: unknown) => {
    const needle = requiredText(value, "Project", []);
    return uniqueMatch(projects.filter((project) => project.id === needle || lower(project.name) === lower(needle)), `Project “${needle}”`);
  };
  const resolvePlan = (value: unknown, projectId?: string) => {
    const needle = requiredText(value, "Research Plan", []);
    return uniqueMatch(plans.filter((plan) => (!projectId || plan.projectId === projectId) && (plan.id === needle || lower(plan.code) === lower(needle) || lower(plan.title) === lower(needle))), `Research Plan “${needle}”`);
  };
  const resolveProtocol = (value: unknown) => {
    const needle = optionalText(value) ?? "";
    return uniqueMatch(protocols.filter((protocol) => protocol.id === needle || lower(protocol.humanCode) === lower(needle) || lower(protocol.canonicalTitle ?? protocol.title) === lower(needle)), `Protocol “${needle}”`);
  };
  const resolveExperiment = (value: unknown) => {
    const needle = optionalText(value) ?? "";
    return uniqueMatch(experiments.filter((experiment) => experiment.id === needle || lower(experiment.runCode) === lower(needle) || lower(experiment.title) === lower(needle)), `Experiment “${needle}”`);
  };

  for (const [index, record] of parsed.records.entries()) {
    const errors: string[] = [];
    const warnings: string[] = [];
    let data: PreparedData | undefined;
    for (const field of structuredModules[parsed.module].fields.filter((field) => field.required)) {
      if (record[field.key] === undefined || record[field.key] === null || String(record[field.key]).trim() === "") errors.push(`${field.label} is required.`);
    }

    if (parsed.module === "projects") {
      const name = requiredText(record.name, "Project name", errors);
      const key = `project:${lower(name)}`;
      if (isPlaceholder(name)) errors.push("Replace the template Project name before importing.");
      if (projects.some((project) => lower(project.name) === lower(name))) errors.push(`Project “${name}” already exists.`);
      if (batchKeys.has(key)) errors.push(`Project “${name}” is duplicated in this file.`); else batchKeys.add(key);
      data = { kind: "projects", name, description: optionalText(record.description), status: enumValue(record.status, ["active", "paused", "completed", "archived"] as const, "active", "Status", errors), tags: parseTags(record.tags) };
    }

    if (parsed.module === "research-plans") {
      const projectMatch = resolveProject(record.project);
      if (projectMatch.error) errors.push(projectMatch.error);
      const title = requiredText(record.title, "Title", errors);
      if (isPlaceholder(title)) errors.push("Replace the template Research Plan title before importing.");
      const code = optionalText(record.code)?.toUpperCase();
      if (code && !isValidRecordCode("researchPlan", code)) errors.push("Research Plan code must use RP- followed by at least three digits.");
      if (code && plans.some((plan) => lower(plan.code) === lower(code))) errors.push(`${code} already exists.`);
      const key = code ? `plan-code:${lower(code)}` : `plan:${projectMatch.value?.id ?? "missing"}:${lower(title)}`;
      if (batchKeys.has(key)) errors.push("This Research Plan is duplicated in the import file."); else batchKeys.add(key);
      const protocolCodes = listValue(record.protocolCodes);
      const protocolMatches = protocolCodes.map((codeValue) => resolveProtocol(codeValue));
      protocolMatches.filter((match) => match.error).forEach((match) => errors.push(match.error!));
      const primaryMatch = optionalText(record.primaryProtocolCode) ? resolveProtocol(record.primaryProtocolCode) : undefined;
      if (primaryMatch?.error) errors.push(primaryMatch.error);
      const protocolIds = [...new Set(protocolMatches.flatMap((match) => match.value ? [match.value.id] : []))];
      if (primaryMatch?.value && !protocolIds.includes(primaryMatch.value.id)) protocolIds.push(primaryMatch.value.id);
      const document = scientificDocumentFromStructuredRecord(researchPlanSections, record, { design: "design", material_methods: "materialMethods", acceptance_criteria: "acceptanceCriteria", constraints: "constraints", references: "references" });
      const designSection = document.sections.find((section) => section.key === "design");
      const design = designSection ? optionalText(documentPlainText({ schemaVersion: 1, sections: [designSection] })) : undefined;
      const declaredStatus = enumValue(record.status, ["draft", "active", "paused", "completed", "archived"] as const, "draft", "Status", errors);
      if (declaredStatus !== "draft") warnings.push(`Declared status “${declaredStatus}” is retained in the source file; imported Research Plans start as Draft.`);
      if (projectMatch.value) data = { kind: "research-plans", projectId: projectMatch.value.id, code, title, objective: optionalText(record.objective), hypothesis: optionalText(record.hypothesis), rationale: optionalText(record.rationale), design, status: "draft", tags: parseTags(record.tags), protocolIds, primaryProtocolId: primaryMatch?.value?.id, contentJson: document as Prisma.InputJsonValue };
    }

    if (parsed.module === "protocols") {
      const canonicalTitle = requiredText(record.canonicalTitle, "Protocol title", errors);
      if (isPlaceholder(canonicalTitle)) errors.push("Replace the template Protocol title before importing.");
      const humanCode = optionalText(record.humanCode)?.toUpperCase();
      if (humanCode && !isValidRecordCode("protocol", humanCode)) errors.push("Protocol code must use PRT- followed by at least six digits.");
      if (humanCode && protocols.some((protocol) => protocol.humanCode === humanCode)) errors.push(`${humanCode} already exists.`);
      const key = `protocol:${humanCode || lower(canonicalTitle)}`;
      if (batchKeys.has(key)) errors.push("This Protocol is duplicated in the import file."); else batchKeys.add(key);
      const scope = enumValue(record.scope, ["general", "project"] as const, "general", "Scope", errors);
      const projectMatch = optionalText(record.project) ? resolveProject(record.project) : undefined;
      if (projectMatch?.error) errors.push(projectMatch.error);
      if (scope === "project" && !projectMatch?.value) errors.push("A Project-scoped Protocol requires a resolvable Project.");
      const planCodes = listValue(record.researchPlanCodes);
      const primaryPlanCodes = listValue(record.primaryResearchPlanCodes);
      const planMatches = [...new Set([...planCodes, ...primaryPlanCodes])].map((codeValue) => resolvePlan(codeValue, projectMatch?.value?.id));
      planMatches.filter((match) => match.error).forEach((match) => errors.push(match.error!));
      const researchPlanIds = planMatches.flatMap((match) => match.value ? [match.value.id] : []);
      const primaryResearchPlanIds = primaryPlanCodes.flatMap((codeValue) => {
        const match = resolvePlan(codeValue, projectMatch?.value?.id);
        return match.value ? [match.value.id] : [];
      });
      const displayVersion = optionalText(record.displayVersion) ?? "0.1";
      if (!/^\d+\.\d+(?:\.\d+)?$/.test(displayVersion)) errors.push("Version must look like 0.1 or 1.0.");
      const document = protocolDocumentFromRecord(record);
      const declaredAvailability = enumValue(record.availability, ["draft", "active", "retired", "archived"] as const, "draft", "Availability", errors);
      const declaredReview = enumValue(record.reviewStage, ["draft", "ready_for_review", "reviewed"] as const, "draft", "Review stage", errors);
      if (declaredAvailability !== "draft" || declaredReview !== "draft") warnings.push(`Declared state ${declaredAvailability} / ${declaredReview} is preserved in the source file; imported Protocols start as Draft / Draft.`);
      data = { kind: "protocols", humanCode, canonicalTitle, shortTitle: optionalText(record.shortTitle), englishTitle: optionalText(record.englishTitle), scope, projectId: projectMatch?.value?.id, availability: "draft", reviewStage: "draft", displayVersion, tags: parseTags(record.tags), researchPlanIds, primaryResearchPlanIds, document };
    }

    if (parsed.module === "experiments") {
      const projectMatch = optionalText(record.project) ? resolveProject(record.project) : undefined;
      if (projectMatch?.error) errors.push(projectMatch.error);
      const planMatch = resolvePlan(record.researchPlan, projectMatch?.value?.id);
      if (planMatch.error) errors.push(planMatch.error);
      const title = requiredText(record.title, "Title", errors);
      if (isPlaceholder(title)) errors.push("Replace the template Experiment title before importing.");
      const primaryMatch = optionalText(record.primaryProtocolCode) ? resolveProtocol(record.primaryProtocolCode) : undefined;
      if (primaryMatch?.error) errors.push(primaryMatch.error);
      const versionLabel = optionalText(record.protocolVersion);
      const primaryVersion = primaryMatch?.value?.versions.find((version) => !versionLabel || version.displayVersion === versionLabel);
      if (primaryMatch?.value && !primaryVersion) errors.push(`${primaryMatch.value.humanCode ?? primaryMatch.value.title} version ${versionLabel} was not found.`);
      const supportingMatches = listValue(record.supportingProtocolCodes).map((codeValue) => resolveProtocol(codeValue));
      supportingMatches.filter((match) => match.error).forEach((match) => errors.push(match.error!));
      const supportingVersions = supportingMatches.flatMap((match) => match.value?.versions[0] ? [match.value.versions[0]] : []);
      const runCode = optionalText(record.runCode)?.toUpperCase();
      if (runCode && !isValidRecordCode("experiment", runCode)) errors.push("Experiment code must use EXP- followed by at least three digits.");
      if (runCode && experiments.some((experiment) => lower(experiment.runCode) === lower(runCode))) errors.push(`${runCode} already exists.`);
      const key = runCode ? `experiment-code:${lower(runCode)}` : `experiment:${planMatch.value?.id ?? "missing"}:${lower(title)}`;
      if (batchKeys.has(key)) errors.push("This Experiment is duplicated in the import file."); else batchKeys.add(key);
      const date = dateValue(record.date, "Date", errors, true);
      // Every narrative column in the source file lands in a document section;
      // the Experiment table keeps none of them. A legacy "Result summary"
      // column is aliased onto `conclusion` by the module definition.
      const document = experimentDocumentFromNarrative({
        background: optionalText(record.background),
        materials: optionalText(record.materials),
        steps: optionalText(record.steps),
        observations: optionalText(record.observations),
        deviations: optionalText(record.deviations),
        resultSummary: optionalText(record.resultSummary),
        conclusion: optionalText(record.conclusion),
      });
      const declaredStatus = enumValue(record.status, ["planned", "running", "completed", "failed", "archived"] as const, "planned", "Status", errors);
      const declaredRecordStatus = enumValue(record.recordStatus, ["draft", "recorded", "submitted", "reviewed"] as const, "draft", "Record status", errors);
      if (declaredStatus !== "planned" || declaredRecordStatus !== "draft") warnings.push(`Declared state ${declaredStatus} / ${declaredRecordStatus} is retained in the source file; imported Experiments start as Planned / Draft.`);
      if (planMatch.value && date) {
        const protocolVersionIds = primaryVersion ? [primaryVersion.id, ...supportingVersions.map((version) => version.id)] : [];
        data = { kind: "experiments", input: { researchPlanId: planMatch.value.id, runCode, title, date, status: "planned", recordStatus: "draft", purpose: optionalText(record.purpose), tags: parseTags(record.tags), contentJson: document as Prisma.InputJsonValue, methodMode: protocolVersionIds.length ? "protocol" : "custom", protocolVersionIds, customSteps: protocolVersionIds.length ? [] : parseCustomExperimentSteps(optionalText(record.steps) ?? "") } };
      }
    }

    if (parsed.module === "results") {
      const experimentMatch = resolveExperiment(record.experiment);
      if (experimentMatch.error) errors.push(experimentMatch.error);
      const title = requiredText(record.title, "Title", errors);
      if (isPlaceholder(title)) errors.push("Replace the template Result title before importing.");
      const numericText = optionalText(record.numericValue);
      const numericValue = numericText ? numberValue(record.numericValue, "Numeric value", errors) : undefined;
      const document = scientificDocumentFromStructuredRecord(resultSections, record, { summary: "summary", analysis: "analysis", interpretation: "interpretation", quality_limitations: "qualityLimitations" });
      const declaredRecordStatus = enumValue(record.recordStatus, ["draft", "recorded", "submitted", "reviewed"] as const, "draft", "Record status", errors);
      enumValue(record.sourceType, ["manual", "protocol_template", "file_import", "tool", "analysis"] as const, "file_import", "Source type", errors);
      if (declaredRecordStatus !== "draft") warnings.push(`Declared record status “${declaredRecordStatus}” is retained in the source file; imported Results start as Draft.`);
      const rawTemplate = parseJsonValue(record.templateSnapshotJson);
      const hasTemplate = rawTemplate && typeof rawTemplate === "object" && !Array.isArray(rawTemplate) && Object.keys(rawTemplate as object).length > 0;
      const template = hasTemplate ? normalizeResultTemplate(rawTemplate) : undefined;
      const templateCheck = template ? checkResultTemplate(template) : undefined;
      if (templateCheck?.errors.length) errors.push(...templateCheck.errors.map((message) => `Result Template: ${message}`));
      const values = normalizeResultValues(parseJsonValue(record.templateValuesJson));
      const templateInstanceKey = optionalText(record.templateInstanceKey);
      const validation = validateResultRecord({ template, values, instanceKey: templateInstanceKey });
      const declaredTemplateKey = optionalText(record.templateKey);
      if (declaredTemplateKey && !template) warnings.push("A Result Template key was supplied without a template snapshot; the imported Result remains untyped.");
      if (template && declaredTemplateKey && template.templateKey !== declaredTemplateKey) warnings.push(`Template key ${declaredTemplateKey} was normalized to ${template.templateKey}.`);
      if (experimentMatch.value) data = { kind: "results", experimentId: experimentMatch.value.id, projectId: experimentMatch.value.projectId ?? undefined, researchPlanId: experimentMatch.value.researchPlanId ?? undefined, title, resultType: requiredText(record.resultType, "Result type", errors), recordStatus: "draft", sourceType: "file_import", qualityStatus: enumValue(record.qualityStatus, ["not_assessed", "pass", "warning", "fail"] as const, "not_assessed", "Quality status", errors), textValue: optionalText(record.textValue), numericValue, unit: optionalText(record.unit), analysisMethod: optionalText(record.analysisMethod), notes: optionalText(record.notes), protocolVersionId: template ? experimentMatch.value.primaryProtocolVersionId ?? undefined : undefined, templateKey: template?.templateKey, templateInstanceKey, templateInstanceLabel: optionalText(record.templateInstanceLabel), templateSnapshotJson: (template ?? {}) as Prisma.InputJsonValue, valuesJson: values as Prisma.InputJsonValue, validationStatus: validation.status, validationJson: validation as unknown as Prisma.InputJsonValue, viewSpecJson: (template?.view ?? {}) as Prisma.InputJsonValue, contentJson: document as Prisma.InputJsonValue, provenanceJson: { experimentId: experimentMatch.value.id, projectId: experimentMatch.value.projectId, researchPlanId: experimentMatch.value.researchPlanId, protocolVersionId: template ? experimentMatch.value.primaryProtocolVersionId : undefined } };
    }

    if (parsed.module === "inventory") {
      const name = requiredText(record.name, "Item name", errors);
      if (isPlaceholder(name)) errors.push("Replace the template Inventory Item name before importing.");
      const aliquotCode = optionalText(record.aliquotCode);
      if (aliquotCode && inventoryItems.some((item) => lower(item.aliquotCode) === lower(aliquotCode))) errors.push(`Aliquot code ${aliquotCode} already exists.`);
      const key = `inventory:${lower(aliquotCode || optionalText(record.barcode) || `${name}:${optionalText(record.lotNumber)}`)}`;
      if (batchKeys.has(key)) errors.push("This Inventory Item is duplicated in the import file."); else batchKeys.add(key);
      const quantity = numberValue(record.currentQuantity, "Initial quantity", errors);
      if (quantity < 0) errors.push("Initial quantity cannot be negative.");
      const lowThreshold = record.lowThreshold === undefined || record.lowThreshold === ""
        ? undefined
        : numberValue(record.lowThreshold, "Safety stock", errors);
      if (lowThreshold !== undefined && lowThreshold < 0) errors.push("Safety stock cannot be negative.");
      const freezeThawCount = numberValue(record.freezeThawCount, "Freeze-thaw count", errors, 0);
      if (!Number.isInteger(freezeThawCount) || freezeThawCount < 0) errors.push("Freeze-thaw count must be a non-negative integer.");
      const locationName = optionalText(record.location);
      const locationMatch = locationName ? uniqueMatch(locations.filter((location) => location.id === locationName || lower(location.name) === lower(locationName)), `Inventory location “${locationName}”`) : undefined;
      if (locationMatch?.error) errors.push(locationMatch.error);
      data = { kind: "inventory", name, englishName: optionalText(record.englishName), category: optionalText(record.category), brand: optionalText(record.brand), principalInvestigator: optionalText(record.principalInvestigator), containerType: optionalText(record.containerType), barcode: optionalText(record.barcode), aliquotCode, lotNumber: optionalText(record.lotNumber), vendor: optionalText(record.vendor), catalogNumber: optionalText(record.catalogNumber), casNumber: optionalText(record.casNumber), currentQuantity: quantity, unit: requiredText(record.unit, "Unit", errors), lowThreshold, concentration: optionalText(record.concentration), locationId: locationMatch?.value?.id, positionCode: optionalText(record.positionCode), expiryDate: dateValue(record.expiryDate, "Expiry date", errors), storageCondition: optionalText(record.storageCondition), freezeThawCount, status: enumValue(record.status, ["active", "inactive", "archived"] as const, "active", "Status", errors), notes: optionalText(record.notes) };
    }

    if (parsed.module === "reports") {
      const projectMatch = resolveProject(record.project);
      if (projectMatch.error) errors.push(projectMatch.error);
      const planMatch = optionalText(record.researchPlan) ? resolvePlan(record.researchPlan, projectMatch.value?.id) : undefined;
      if (planMatch?.error) errors.push(planMatch.error);
      const title = requiredText(record.title, "Title", errors);
      if (isPlaceholder(title)) errors.push("Replace the template Report title before importing.");
      const periodStart = dateValue(record.periodStart, "Period start", errors);
      const periodEnd = dateValue(record.periodEnd, "Period end", errors);
      if (periodStart && periodEnd && periodStart > periodEnd) errors.push("Period start must not be after period end.");
      const document = scientificDocumentFromStructuredRecord(reportSections, record, { executive_summary: "executiveSummary", research_question: "researchQuestion", methods: "methods", results: "results", interpretation: "interpretation", limitations_next_steps: "limitationsNextSteps" });
      if (projectMatch.value) {
        const collected = await collectReportSources(projectMatch.value.id, planMatch?.value?.id);
        const declaredStatus = enumValue(record.status, ["draft", "ready_for_review", "final", "archived"] as const, "draft", "Status", errors);
        if (declaredStatus !== "draft") warnings.push(`Declared status “${declaredStatus}” is retained in the source file; imported Reports start as Draft.`);
        data = { kind: "reports", projectId: projectMatch.value.id, researchPlanId: planMatch?.value?.id, title, status: "draft", periodStart, periodEnd, tags: parseTags(record.tags), contentJson: document as Prisma.InputJsonValue, collected };
      }
    }

    if (!errors.length && data) prepared.push({ index, data });
    previewRows.push({ index: index + 1, values: previewValues(parsed.module, record), errors: [...new Set(errors)], warnings: [...new Set(warnings)] });
  }

  const preview: StructuredImportPreview = {
    module: parsed.module,
    format: parsed.format,
    fileName: parsed.fileName,
    checksum: parsed.checksum,
    mapping: parsed.mapping,
    warnings: parsed.warnings,
    errors: globalErrors,
    rows: previewRows,
    canImport: !globalErrors.length && previewRows.every((row) => !row.errors.length) && prepared.length === previewRows.length,
  };
  return { preview, prepared };
}

function recordStatusForReview(reviewStage: ProtocolData["reviewStage"]) {
  if (reviewStage === "reviewed") return "reviewed" as const;
  if (reviewStage === "ready_for_review") return "submitted" as const;
  return "draft" as const;
}

export async function commitStructuredImport(
  parsed: ParsedStructuredFile,
  validation: StructuredImportValidation,
  attachmentId: string,
) {
  if (!validation.preview.canImport) throw new Error("Resolve every import validation error before confirming.");
  const sourceMetadata = { sourceFileName: parsed.fileName, sourceFileChecksum: parsed.checksum, sourceFormat: parsed.format };
  const created = await prisma.$transaction(async (tx) => {
    const createdTargets: Array<{ targetType: string; targetId: string; href?: string }> = [];

    for (const row of validation.prepared) {
      const data = row.data;
      if (data.kind === "projects") {
        const record = await tx.project.create({ data: { name: data.name, description: data.description, status: data.status, tags: data.tags } });
        await tx.activityLog.create({ data: { action: "structured_import", targetType: "project", targetId: record.id, metadataJson: sourceMetadata } });
        createdTargets.push({ targetType: "project", targetId: record.id, href: `/projects/${record.id}` });
      }
      if (data.kind === "research-plans") {
        const code = data.code ?? await reserveRecordCode(tx, "researchPlan");
        const record = await tx.researchPlan.create({ data: { projectId: data.projectId, code, title: data.title, objective: data.objective, hypothesis: data.hypothesis, rationale: data.rationale, design: data.design, status: data.status, tags: data.tags, contentJson: data.contentJson, protocols: data.protocolIds.length ? { create: data.protocolIds.map((protocolId) => ({ protocolId, isPrimary: protocolId === data.primaryProtocolId })) } : undefined } });
        await tx.activityLog.create({ data: { action: "structured_import", targetType: "research_plan", targetId: record.id, metadataJson: { ...sourceMetadata, code } } });
        createdTargets.push({ targetType: "research_plan", targetId: record.id, href: `/research-plans/${record.id}` });
      }
      if (data.kind === "protocols") {
        const humanCode = data.humanCode ?? await reserveRecordCode(tx, "protocol");
        const projection = projectProtocolDocument(data.document);
        const recordStatus = recordStatusForReview(data.reviewStage);
        const record = await tx.protocol.create({ data: { humanCode, title: data.canonicalTitle, canonicalTitle: data.canonicalTitle, shortTitle: data.shortTitle, englishTitle: data.englishTitle, description: projection.description, scope: data.scope, availability: data.availability, recordStatus, projectId: data.scope === "project" ? data.projectId : null, tags: data.tags, versions: { create: { revision: 1, displayVersion: data.displayVersion, reviewStage: data.reviewStage, recordStatus, title: `${data.canonicalTitle} v${data.displayVersion}`, purpose: projection.purpose, background: projection.background, materialsJson: projection.materials, equipmentJson: projection.equipment, stepsJson: projection.steps, resultTemplatesJson: projection.resultTemplates, consumptionRulesJson: projection.consumptionRules, contentJson: data.document as Prisma.InputJsonValue, sourceType: parsed.format === "docx" ? "docx_import" : "manual", sourceFileName: parsed.fileName, sourceFileChecksum: parsed.checksum, sourceImportedAt: new Date(), changeSummary: `Imported from ${parsed.format.toUpperCase()}.` } }, researchPlans: data.researchPlanIds.length ? { create: data.researchPlanIds.map((researchPlanId) => ({ researchPlanId, isPrimary: data.primaryResearchPlanIds.includes(researchPlanId) })) } : undefined } });
        await tx.activityLog.create({ data: { action: "structured_import", targetType: "protocol", targetId: record.id, metadataJson: sourceMetadata } });
        createdTargets.push({ targetType: "protocol", targetId: record.id, href: `/protocols/${record.id}` });
      }
      if (data.kind === "experiments") {
        const record = await createExperimentWithProtocolSnapshotInTransaction(tx, data.input);
        await tx.activityLog.create({ data: { action: "structured_import", targetType: "experiment", targetId: record.id, metadataJson: sourceMetadata } });
        createdTargets.push({ targetType: "experiment", targetId: record.id, href: `/experiments/${record.id}` });
      }
      if (data.kind === "results") {
        const record = await createResultInTransaction(tx, {
          experimentId: data.experimentId,
          title: data.title,
          resultType: data.resultType,
          recordStatus: data.recordStatus,
          sourceType: data.sourceType,
          qualityStatus: data.qualityStatus,
          origin: { kind: "structured_import", sourceMetadata },
          templateKey: data.templateKey,
          templateProtocolVersionId: data.protocolVersionId,
          templateInstanceKey: data.templateInstanceKey,
          templateInstanceLabel: data.templateInstanceLabel,
          valuesJson: data.valuesJson,
          contentJson: data.contentJson,
          textValue: data.textValue,
          numericValue: data.numericValue,
          unit: data.unit,
          analysisMethod: data.analysisMethod,
          notes: data.notes,
          provenanceJson: data.provenanceJson as Record<string, unknown>,
        });
        createdTargets.push({ targetType: "result", targetId: record.resultId, href: `/results/${record.resultId}` });
      }
      if (data.kind === "inventory") {
        const record = await tx.inventoryItem.create({ data: { name: data.name, englishName: data.englishName, category: data.category, brand: data.brand, principalInvestigator: data.principalInvestigator, containerType: data.containerType, barcode: data.barcode, aliquotCode: data.aliquotCode, lotNumber: data.lotNumber, vendor: data.vendor, catalogNumber: data.catalogNumber, casNumber: data.casNumber, currentQuantity: data.currentQuantity, unit: data.unit, lowThreshold: data.lowThreshold, concentration: data.concentration, locationId: data.locationId, positionCode: data.positionCode, expiryDate: data.expiryDate, storageCondition: data.storageCondition, freezeThawCount: data.freezeThawCount, status: data.status, notes: data.notes } });
        if (data.currentQuantity !== 0) await tx.inventoryTransaction.create({ data: { inventoryItemId: record.id, type: "receive", quantityChange: data.currentQuantity, unit: data.unit, toLocationId: data.locationId, notes: `Initial structured import from ${parsed.fileName}.` } });
        await tx.activityLog.create({ data: { action: "structured_import", targetType: "inventory_item", targetId: record.id, metadataJson: sourceMetadata } });
        createdTargets.push({ targetType: "inventory_item", targetId: record.id, href: `/inventory/${record.id}` });
      }
      if (data.kind === "reports") {
        const record = await tx.report.create({ data: { projectId: data.projectId, researchPlanId: data.researchPlanId, title: data.title, status: data.status, periodStart: data.periodStart, periodEnd: data.periodEnd, tags: data.tags, contentJson: data.contentJson, sourceSnapshotJson: data.collected.snapshot, sources: data.collected.sources.length ? { create: data.collected.sources.map((source) => ({ sourceType: source.sourceType, sourceId: source.sourceId, titleSnapshot: source.titleSnapshot, versionSnapshot: source.versionSnapshot, hrefSnapshot: source.hrefSnapshot, metadataJson: source.metadataJson ?? {}, order: source.order, resultId: source.resultId })) } : undefined } });
        await tx.activityLog.create({ data: { action: "structured_import", targetType: "report", targetId: record.id, metadataJson: sourceMetadata } });
        createdTargets.push({ targetType: "report", targetId: record.id, href: `/reports/${record.id}` });
      }
    }

    if (createdTargets.length) await tx.attachmentLink.createMany({ data: createdTargets.map((target, index) => ({ attachmentId, targetType: target.targetType, targetId: target.targetId, linkType: "structured_import_source", order: index })) });
    return createdTargets;
  });

  return {
    count: created.length,
    targets: created,
    href: created.length === 1 && created[0]?.href ? created[0].href : `/${parsed.module}`,
  };
}
