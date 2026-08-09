import writeXlsxFile from "write-excel-file/node";
import type { SheetData } from "write-excel-file/node";
import { prisma } from "@/lib/db";
import { experimentNarrativeFromDocument } from "@/lib/experiment-document";
import { getInventoryRiskFlags } from "@/lib/inventory";
import { normalizeProtocolDocument, sectionPlainText } from "@/lib/protocol-document";
import { documentPlainText, normalizeResearchPlanDocument, normalizeScientificDocument, experimentSections, reportSections, resultSections, type ScientificDocument } from "@/lib/scientific-document";
import { structuredModules, type StructuredFileFormat, type StructuredModuleKey } from "@/lib/structured-modules";

export type StructuredExport = { body: string | ArrayBuffer; filename: string; contentType: string };
export type StructuredExportSelection = {
  scope: "all" | "filtered" | "selected";
  ids?: string[];
  filters?: Record<string, string>;
};

type ExportProjection = {
  search: Array<string | null | undefined>;
  filters: Record<string, string | string[] | null | undefined>;
};

function applyExportSelection<T extends { id: string }>(
  rows: T[],
  selection: StructuredExportSelection,
  project: (row: T) => ExportProjection,
) {
  if (selection.scope === "all") return rows;
  if (selection.scope === "selected") {
    const ids = new Set(selection.ids ?? []);
    return rows.filter((row) => ids.has(row.id));
  }
  const criteria = selection.filters ?? {};
  const query = criteria.q?.trim().toLocaleLowerCase();
  return rows.filter((row) => {
    const projected = project(row);
    if (query && !projected.search.some((value) => String(value ?? "").toLocaleLowerCase().includes(query))) return false;
    return Object.entries(criteria).every(([key, expected]) => {
      if (key === "q" || key === "sort" || expected === "" || !(key in projected.filters)) return true;
      const actual = projected.filters[key];
      return Array.isArray(actual) ? actual.includes(expected) : String(actual ?? "") === expected;
    });
  });
}

function scientificSectionText(document: ScientificDocument, key: string) {
  const section = document.sections.find((item) => item.key === key);
  return section ? documentPlainText({ schemaVersion: 1, sections: [section] }) : "";
}

export async function structuredExportRecords(
  module: StructuredModuleKey,
  selection: StructuredExportSelection = { scope: "all" },
): Promise<Record<string, unknown>[]> {
  if (module === "projects") {
    const rows = applyExportSelection(
      await prisma.project.findMany({ orderBy: { updatedAt: "desc" } }),
      selection,
      (row) => ({ search: [row.name, row.description, ...row.tags], filters: { status: row.status, tag: row.tags } }),
    );
    return rows.map((row) => ({ name: row.name, description: row.description, status: row.status, tags: row.tags }));
  }
  if (module === "research-plans") {
    const rows = applyExportSelection(
      await prisma.researchPlan.findMany({ include: { project: true, protocols: { include: { protocol: true } } }, orderBy: { updatedAt: "desc" } }),
      selection,
      (row) => ({ search: [row.code, row.title, row.objective], filters: { project: row.projectId, status: row.status } }),
    );
    return rows.map((row) => {
      const document = normalizeResearchPlanDocument(row.contentJson, row.design);
      return { project: row.project.name, code: row.code, title: row.title, objective: row.objective, hypothesis: row.hypothesis, rationale: row.rationale, design: scientificSectionText(document, "design"), status: row.status, tags: row.tags, protocolCodes: row.protocols.map((link) => link.protocol.humanCode ?? link.protocol.canonicalTitle ?? link.protocol.title), primaryProtocolCode: row.protocols.find((link) => link.isPrimary)?.protocol.humanCode, materialMethods: scientificSectionText(document, "material_methods"), acceptanceCriteria: scientificSectionText(document, "acceptance_criteria"), constraints: scientificSectionText(document, "constraints"), references: scientificSectionText(document, "references") };
    });
  }
  if (module === "protocols") {
    const rows = applyExportSelection(
      await prisma.protocol.findMany({ include: { project: true, researchPlans: { include: { researchPlan: true } }, versions: { orderBy: { revision: "desc" }, take: 1 } }, orderBy: { updatedAt: "desc" } }),
      selection,
      (row) => ({ search: [row.humanCode, row.title, row.canonicalTitle, row.englishTitle, row.description, ...row.tags], filters: { availability: row.availability, status: row.availability, scope: row.scope, review: row.versions[0]?.reviewStage } }),
    );
    return rows.map((row) => {
      const version = row.versions[0];
      const document = normalizeProtocolDocument(version?.contentJson);
      return { humanCode: row.humanCode, canonicalTitle: row.canonicalTitle ?? row.title, shortTitle: row.shortTitle, englishTitle: row.englishTitle, scope: row.scope, project: row.project?.name, researchPlanCodes: row.researchPlans.map((link) => link.researchPlan.code ?? link.researchPlan.title), primaryResearchPlanCodes: row.researchPlans.filter((link) => link.isPrimary).map((link) => link.researchPlan.code ?? link.researchPlan.title), availability: row.availability, reviewStage: version?.reviewStage, displayVersion: version?.displayVersion, tags: row.tags, description: document ? sectionPlainText(document, "description") : row.description, purpose: document ? sectionPlainText(document, "purpose") : version?.purpose, background: document ? sectionPlainText(document, "background") : version?.background, material: document ? sectionPlainText(document, "material") : "", steps: document ? sectionPlainText(document, "steps") : "", resultTemplates: document ? sectionPlainText(document, "result_templates") : "", consumptionRules: document ? sectionPlainText(document, "consumption_rules") : "", contentJson: document ?? version?.contentJson };
    });
  }
  if (module === "experiments") {
    const rows = applyExportSelection(
      await prisma.experiment.findMany({ include: { project: true, researchPlan: true, primaryProtocolVersion: { include: { protocol: true } }, protocolVersions: { include: { protocolVersion: { include: { protocol: true } } }, orderBy: { order: "asc" } } }, orderBy: { date: "desc" } }),
      selection,
      (row) => ({ search: [row.runCode, row.title, row.purpose], filters: { project: row.projectId, plan: row.researchPlanId, status: row.status } }),
    );
    return rows.map((row) => {
      const document = normalizeScientificDocument(row.contentJson, experimentSections);
      const narrative = experimentNarrativeFromDocument(document);
      return { project: row.project?.name, researchPlan: row.researchPlan?.code ?? row.researchPlan?.title, runCode: row.runCode, title: row.title, date: row.date.toISOString(), status: row.status, recordStatus: row.recordStatus, primaryProtocolCode: row.primaryProtocolVersion?.protocol.humanCode ?? row.primaryProtocolVersion?.protocol.canonicalTitle, protocolVersion: row.primaryProtocolVersion?.displayVersion, supportingProtocolCodes: row.protocolVersions.filter((link) => link.role === "supporting").map((link) => link.protocolVersion.protocol.humanCode ?? link.protocolVersion.protocol.canonicalTitle ?? link.protocolVersion.protocol.title), purpose: row.purpose, ...narrative, tags: row.tags, createResultTemplates: false };
    });
  }
  if (module === "results") {
    const rows = applyExportSelection(
      await prisma.result.findMany({ include: { experiment: true }, orderBy: { updatedAt: "desc" } }),
      selection,
      (row) => ({ search: [row.title, row.resultType, row.templateKey, row.textValue, row.analysisMethod], filters: { type: row.resultType, record: row.recordStatus, quality: row.qualityStatus, validation: row.validationStatus } }),
    );
    return rows.map((row) => {
      const document = normalizeScientificDocument(row.contentJson, resultSections);
      return { experiment: row.experiment?.runCode ?? row.experiment?.title, title: row.title, resultType: row.resultType, templateKey: row.templateKey, templateInstanceKey: row.templateInstanceKey, templateInstanceLabel: row.templateInstanceLabel, templateValuesJson: row.valuesJson, templateSnapshotJson: row.templateKey ? row.templateSnapshotJson : null, validationStatus: row.validationStatus, recordStatus: row.recordStatus, sourceType: row.sourceType, qualityStatus: row.qualityStatus, textValue: row.textValue, numericValue: row.numericValue, unit: row.unit, analysisMethod: row.analysisMethod, notes: row.notes, summary: scientificSectionText(document, "summary"), analysis: scientificSectionText(document, "analysis"), interpretation: scientificSectionText(document, "interpretation"), qualityLimitations: scientificSectionText(document, "quality_limitations") };
    });
  }
  if (module === "inventory") {
    const rows = applyExportSelection(
      await prisma.inventoryItem.findMany({ include: { location: true }, orderBy: { updatedAt: "desc" } }),
      selection,
      (row) => ({
        search: [row.name, row.englishName, row.barcode, row.aliquotCode, row.lotNumber, row.vendor, row.brand, row.catalogNumber, row.casNumber],
        filters: { status: row.status, category: row.category, location: row.locationId, flag: getInventoryRiskFlags(row) },
      }),
    );
    return rows.map((row) => ({ name: row.name, englishName: row.englishName, category: row.category, brand: row.brand, containerType: row.containerType, barcode: row.barcode, aliquotCode: row.aliquotCode, lotNumber: row.lotNumber, vendor: row.vendor, catalogNumber: row.catalogNumber, casNumber: row.casNumber, currentQuantity: row.currentQuantity, unit: row.unit, lowThreshold: row.lowThreshold, concentration: row.concentration, location: row.location?.name, positionCode: row.positionCode, expiryDate: row.expiryDate?.toISOString(), storageCondition: row.storageCondition, freezeThawCount: row.freezeThawCount, status: row.status, notes: row.notes }));
  }
  const rows = applyExportSelection(
    await prisma.report.findMany({ include: { project: true, researchPlan: true }, orderBy: { updatedAt: "desc" } }),
    selection,
    (row) => ({ search: [row.title, row.project.name], filters: { project: row.projectId, status: row.status } }),
  );
  return rows.map((row) => {
    const document = normalizeScientificDocument(row.contentJson, reportSections);
    return { project: row.project.name, researchPlan: row.researchPlan?.code ?? row.researchPlan?.title, title: row.title, status: row.status, periodStart: row.periodStart?.toISOString(), periodEnd: row.periodEnd?.toISOString(), tags: row.tags, executiveSummary: scientificSectionText(document, "executive_summary"), researchQuestion: scientificSectionText(document, "research_question"), methods: scientificSectionText(document, "methods"), results: scientificSectionText(document, "results"), interpretation: scientificSectionText(document, "interpretation"), limitationsNextSteps: scientificSectionText(document, "limitations_next_steps") };
  });
}

function flatValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join("; ");
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function csvEscape(value: unknown) {
  const text = String(flatValue(value));
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function markdownExport(module: StructuredModuleKey, records: Record<string, unknown>[]) {
  const definition = structuredModules[module];
  const sections = definition.markdownSections ?? [];
  const sectionFields = new Set(sections.map((section) => section.field));
  return records.map((record, index) => [
    "---",
    `schema: labnest/${module}@1`,
    ...definition.fields.filter((field) => !sectionFields.has(field.key) && field.key !== "contentJson").map((field) => `${field.key}: ${Array.isArray(record[field.key]) ? `[${(record[field.key] as unknown[]).join(", ")}]` : flatValue(record[field.key])}`),
    "---",
    "",
    ...sections.flatMap((section) => [`# ${section.title}`, "", String(record[section.field] ?? ""), ""]),
    index < records.length - 1 ? "\n<!-- LabNest record boundary -->\n" : "",
  ].join("\n")).join("\n");
}

export async function buildStructuredExport(
  module: StructuredModuleKey,
  format: StructuredFileFormat,
  selection: StructuredExportSelection = { scope: "all" },
): Promise<StructuredExport> {
  const definition = structuredModules[module];
  if (!definition.exportFormats.includes(format)) throw new Error(`${format.toUpperCase()} export is not available for ${definition.title}.`);
  const records = await structuredExportRecords(module, selection);
  if (!records.length) throw new Error("The selected export scope contains no records.");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = `LabNest_${definition.title.replaceAll(" ", "_")}_${stamp}`;
  if (format === "json") return { body: JSON.stringify({ schemaVersion: "labnest.structured-export/v1", module, exportedAt: new Date().toISOString(), records }, null, 2), filename: `${base}.json`, contentType: "application/json; charset=utf-8" };
  if (format === "md") return { body: markdownExport(module, records), filename: `${base}.md`, contentType: "text/markdown; charset=utf-8" };
  const headers = definition.fields.filter((field) => field.key !== "contentJson").map((field) => field.key);
  if (format === "csv" || format === "tsv") {
    const delimiter = format === "tsv" ? "\t" : ",";
    const body = [headers.join(delimiter), ...records.map((record) => headers.map((header) => csvEscape(record[header])).join(delimiter))].join("\n");
    return { body, filename: `${base}.${format}`, contentType: `${format === "csv" ? "text/csv" : "text/tab-separated-values"}; charset=utf-8` };
  }
  const data: SheetData = [
    headers.map((header) => ({ value: header, type: String, fontWeight: "bold", backgroundColor: "#DDE8EA", wrap: true })),
    ...records.map((record) => headers.map((header) => flatValue(record[header]))),
  ];
  const buffer = await writeXlsxFile([{ sheet: "Export", data, columns: headers.map(() => ({ width: 22 })) }], { fontFamily: "Arial", fontSize: 10 }).toBuffer();
  return { body: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer, filename: `${base}.xlsx`, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
}
