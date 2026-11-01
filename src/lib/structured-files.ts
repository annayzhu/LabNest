import { createHash, randomUUID } from "node:crypto";
import { readSheet } from "read-excel-file/node";
import writeXlsxFile from "write-excel-file/node";
import type { SheetData } from "write-excel-file/node";
import {
  getCellAddress,
  getOrderOfSiblings,
  insertElementMarkupAccordingToOrderOfSiblings,
  sanitizeAttributeValue,
} from "write-excel-file/utility";
import { translateUiText } from "./i18n";
import { parseProtocolDocxBytes } from "./protocol-docx";
import { convertLegacyProtocol, isLegacyProtocol } from "./protocol-conversion";
import { extractDocxMedia, type DocxEmbeddedImage } from "./docx-media-import";
import { decideProtocolImportState, type ProtocolImportDecision } from "./protocol-import-state";
import { exportProtocolDocxTemplate, protocolDocxTemplateFilename } from "./protocol-docx-template";
import { createEmptyProtocolDocument, type ProtocolDocument } from "./protocol-document";
import { exportStructuredDocxTemplate, parseStructuredDocx } from "./structured-docx";
import {
  formatFromFilename,
  type StructuredFieldDefinition,
  type StructuredFileFormat,
  type StructuredModuleKey,
  structuredModules,
} from "./structured-modules";
import { bilingual, choiceValue, columnHeader, hasChoices, headerNames, sampleValue, templateChoices } from "./structured-template";
import { hasImportEdits, tableImportFormats, type ImportRowEdits, type ImportRowOrigin } from "./structured-import-edits";

export type StructuredColumnMapping = { source: string; target?: string; targetLabel?: string };
export type ParsedStructuredFile = {
  module: StructuredModuleKey;
  format: StructuredFileFormat;
  fileName: string;
  checksum: string;
  records: Record<string, unknown>[];
  mapping: StructuredColumnMapping[];
  warnings: string[];
  protocolDecisions?: ProtocolImportDecision[];
  embeddedImages?: DocxEmbeddedImage[];
  /** Set once preview edits are laid over the file: where each record comes from, and the edits themselves. */
  origins?: ImportRowOrigin[];
  edits?: ImportRowEdits;
};

export type StructuredTemplate = {
  body: string | Uint8Array | ArrayBuffer;
  filename: string;
  contentType: string;
};

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
}

function scalar(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value.trim();
  return value;
}

function fieldLookup(module: StructuredModuleKey) {
  const lookup = new Map<string, StructuredFieldDefinition>();
  for (const field of structuredModules[module].fields) {
    for (const alias of headerNames(field)) {
      lookup.set(normalizeKey(alias), field);
    }
  }
  return lookup;
}

function mapRecords(module: StructuredModuleKey, records: Record<string, unknown>[], overrides: Record<string,string> = {}) {
  const lookup = fieldLookup(module);
  const mapping = new Map<string, StructuredColumnMapping>();
  const normalizedRecords = records.map((record) => {
    const normalized: Record<string, unknown> = {};
    for (const [source, value] of Object.entries(record)) {
      if (source.startsWith("__")) {
        normalized[source] = value;
        continue;
      }
      const field = Object.hasOwn(overrides,source) ? structuredModules[module].fields.find(field=>field.key===overrides[source]) : lookup.get(normalizeKey(source));
      if(field && Object.hasOwn(normalized,field.key))throw new Error(`Multiple source columns map to ${field.label}; choose one source.`);
      mapping.set(source, { source, target: field?.key, targetLabel: field?.label });
      if (field) normalized[field.key] = hasChoices(field) ? choiceValue(field, scalar(value)) : scalar(value);
    }
    return normalized;
  });
  return { records: normalizedRecords, mapping: [...mapping.values()] };
}

function parseDelimitedLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

function parseDelimited(text: string, delimiter: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const headers = parseDelimitedLine(lines[0], delimiter);
  return lines.slice(1).map((line) => {
    const cells = parseDelimitedLine(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  }).filter((record) => Object.values(record).some((value) => String(value).trim()));
}

function workbookRows(rows: unknown[][]) {
  const headerIndex = rows.findIndex((row) => row.some((cell) => String(cell ?? "").trim()));
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex].map((cell) => String(cell ?? "").trim());
  return rows.slice(headerIndex + 1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, scalar(row[index])])),
  ).filter((record) => Object.values(record).some((value) => String(value ?? "").trim()));
}

function parseJsonRecords(text: string, module: StructuredModuleKey) {
  const parsed = JSON.parse(text) as unknown;
  if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];
  if (!parsed || typeof parsed !== "object") throw new Error("The JSON root must be an object or array.");
  const object = parsed as Record<string, unknown>;
  const pluralAlias = module.replaceAll("-", "");
  const candidates = [object.records, object[module], object[pluralAlias], object[structuredModules[module].title]];
  const records = candidates.find(Array.isArray);
  if (records) return records as Record<string, unknown>[];
  return [object];
}

function parseFrontmatter(text: string) {
  const normalized = text.replace(/^\uFEFF/, "");
  const match = normalized.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  const metadata: Record<string, unknown> = {};
  if (!match) return { metadata, body: normalized };
  let currentList: string | undefined;
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("-") && currentList) {
      const list = Array.isArray(metadata[currentList]) ? metadata[currentList] as string[] : [];
      list.push(line.replace(/^-\s*/, "").trim());
      metadata[currentList] = list;
      continue;
    }
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    let value: unknown = line.slice(separator + 1).trim();
    if (value === "[]") value = [];
    else if (/^\[.*\]$/.test(String(value))) value = String(value).slice(1, -1).split(",").map((item) => item.trim()).filter(Boolean);
    else if (/^(true|false)$/i.test(String(value))) value = String(value).toLowerCase() === "true";
    metadata[key] = value;
    currentList = value === "" ? key : undefined;
  }
  return { metadata, body: normalized.slice(match[0].length) };
}

function parseMarkdownRecord(text: string, module: StructuredModuleKey) {
  const { metadata, body } = parseFrontmatter(text);
  const definition = structuredModules[module];
  const headingLookup = new Map((definition.markdownSections ?? []).flatMap((section) =>
    [section.title, ...(section.aliases ?? [])].map((title) => [normalizeKey(title), section.field] as const),
  ));
  const sections: Record<string, string[]> = {};
  let currentField: string | undefined;
  let firstHeading: string | undefined;
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^#{1,6}\s+(.+)$/);
    if (match) {
      const heading = match[1].trim();
      const field = headingLookup.get(normalizeKey(heading));
      if (field) currentField = field;
      else if (!firstHeading) { firstHeading = heading; currentField = undefined; }
      else currentField = undefined;
      continue;
    }
    if (currentField) sections[currentField] = [...(sections[currentField] ?? []), line];
  }
  const record = { ...metadata } as Record<string, unknown>;
  const titleKey = module === "projects" || module === "inventory" ? "name" : module === "protocols" ? "canonicalTitle" : "title";
  if (!record[titleKey] && firstHeading) record[titleKey] = firstHeading;
  for (const [field, lines] of Object.entries(sections)) record[field] = lines.join("\n").trim();
  return record;
}

function markdownTableRows(value: string) {
  const lines = value.split(/\r?\n/).filter((line) => /^\s*\|.*\|\s*$/.test(line));
  if (lines.length < 2) return [];
  return lines
    .filter((_, index) => index !== 1)
    .map((line) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
}

function protocolDocumentFromMarkdown(record: Record<string, unknown>): ProtocolDocument {
  const document = createEmptyProtocolDocument();
  const section = (key: ProtocolDocument["sections"][number]["key"]) => document.sections.find((item) => item.key === key)!;
  for (const key of ["description", "purpose", "background"] as const) {
    const text = String(record[key] ?? "").trim();
    if (text) section(key).blocks.push({ id: `${key}-import-1`, type: "text", text });
  }
  const material = String(record.material ?? "").trim();
  const materialRows = markdownTableRows(material);
  if (materialRows.length) section("material").blocks.push({ id: "material-import-1", type: "table", caption: "Materials", rows: materialRows });
  else if (material) section("material").blocks.push({ id: "material-import-1", type: "text", text: material });
  const steps = String(record.steps ?? "").trim();
  if (steps) {
    const nodes = steps.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => ({
      type: /^\d+[.、]\s*/.test(line) ? "numbered" as const : /^[-*]\s+/.test(line) ? "bullet" as const : "paragraph" as const,
      content: [{ text: line.replace(/^\d+[.、]\s*|^[-*]\s+/, "") }],
    }));
    section("steps").blocks.push({ id: "steps-import-1", type: "rich_text", nodes });
  }
  for (const [key, caption] of [["resultTemplates", "result_type"], ["consumptionRules", "Consumption rules"]] as const) {
    const text = String(record[key] ?? "").trim();
    const rows = markdownTableRows(text);
    const target = key === "resultTemplates" ? "result_templates" : "consumption_rules";
    if (rows.length) section(target).blocks.push({ id: `${target}-import-1`, type: "table", caption, rows });
    else if (text) section(target).blocks.push({ id: `${target}-import-1`, type: "text", text });
  }
  return document;
}

function protocolDocxRecord(bytes: Uint8Array, fileName: string) {
  const parsed = parseProtocolDocxBytes(bytes, fileName);
  // A Word file is written by habit: its steps become step blocks, its amounts chips, its "记录：" lines result templates.
  // Step ownership is then explicit, so the parser's "re-confirm step ownership" warning no longer applies.
  let document = parsed.document;
  if (isLegacyProtocol(document)) {
    const { document: converted } = convertLegacyProtocol(document, prefix => `${prefix}-${randomUUID()}`);
    document = { ...converted, importWarnings: converted.importWarnings.filter((warning) => !warning.startsWith("DOCX_EXECUTION_REVIEW_REQUIRED")) };
  }
  return {
    humanCode: parsed.humanCode,
    canonicalTitle: parsed.canonicalTitle,
    englishTitle: parsed.englishTitle,
    availability: parsed.importDecision.documentAvailability.raw,
    reviewStage: parsed.importDecision.documentReviewStage.raw,
    displayVersion: parsed.displayVersion,
    tags: parsed.tags,
    description: parsed.description,
    purpose: parsed.purpose,
    background: parsed.background,
    contentJson: document,
    __importWarnings: document.importWarnings,
  };
}

export async function parseStructuredFile(file: File, module: StructuredModuleKey, overrides: Record<string,string> = {}): Promise<ParsedStructuredFile> {
  const { format, checksum, rawRecords, warnings, embedded } = await readRawRecords(file, module);
  if (rawRecords.length > 500) throw new Error("A single structured import is limited to 500 records.");
  if (!rawRecords.length) throw new Error("No data rows were found in the import file.");
  const mapped = mapRecords(module, rawRecords, overrides);
  const unknownColumns = mapped.mapping.filter((item) => !item.target).map((item) => item.source);
  if (unknownColumns.length) warnings.push(`Unmapped columns retained outside the import: ${unknownColumns.join(", ")}.`);
  for (const record of mapped.records) {
    if (module === "protocols" && format === "md") record.contentJson = protocolDocumentFromMarkdown(record);
    const recordWarnings = record.__importWarnings;
    if (Array.isArray(recordWarnings)) warnings.push(...recordWarnings.map(String));
  }
  const protocolDecisions = module === "protocols" ? mapped.records.map((record) => decideProtocolImportState({ fileName: file.name, availability: record.availability, reviewStage: record.reviewStage, compareFilename: format === "docx" })) : undefined;
  return { module, format, fileName: file.name, checksum, records: mapped.records, mapping: mapped.mapping, warnings: [...new Set(warnings)], protocolDecisions, embeddedImages: embedded?.images };
}

/**
 * The file's records with the preview's edits laid over them: changed values replace the file's (an empty value clears
 * it), left-out rows drop out and added rows follow the file's. The file and its checksum stay as they were.
 */
export function applyImportEdits(parsed: ParsedStructuredFile, edits: ImportRowEdits): ParsedStructuredFile {
  if (!hasImportEdits(edits)) return parsed;
  const fields = new Map(structuredModules[parsed.module].fields.map((field) => [field.key, field]));
  const lay = (record: Record<string, unknown>, values: Record<string, string>) => {
    const next = { ...record };
    for (const [key, text] of Object.entries(values)) {
      const field = fields.get(key)!;
      if (text) next[key] = hasChoices(field) ? choiceValue(field, text) : text;
      else delete next[key];
    }
    return next;
  };
  if ([...edits.removed, ...Object.keys(edits.changed).map(Number)].some((row) => row > parsed.records.length)) throw new Error("The preview changes do not match this file. Preview it again.");
  if (edits.added.length && !tableImportFormats.includes(parsed.format)) throw new Error("Records can be added only to a table file.");
  const records: Record<string, unknown>[] = [];
  const origins: ImportRowOrigin[] = [];
  parsed.records.forEach((record, index) => {
    const row = index + 1;
    if (edits.removed.includes(row)) return;
    const changed = edits.changed[row] ?? {};
    records.push(lay(record, changed));
    origins.push({ row, changed: Object.keys(changed) });
  });
  edits.added.forEach((values, index) => {
    records.push(lay({}, values));
    origins.push({ added: index + 1 });
  });
  if (!records.length) throw new Error("Every record was removed; there is nothing left to import.");
  if (records.length > 500) throw new Error("A single structured import is limited to 500 records.");
  const protocolDecisions = parsed.module === "protocols" ? records.map((record) => decideProtocolImportState({ fileName: parsed.fileName, availability: record.availability, reviewStage: record.reviewStage, compareFilename: parsed.format === "docx" })) : undefined;
  return { ...parsed, records, origins, edits, protocolDecisions };
}

function templateSample(module: StructuredModuleKey) {
  return Object.fromEntries(structuredModules[module].fields.map((field) => [field.key, field.example ?? ""]));
}

const zhAndEn = (zh: string, en: string) => `${zh}\n${en}`;

function templateFieldGuidance(module: StructuredModuleKey) {
  return Object.fromEntries(
    structuredModules[module].fields
      .filter((field) => field.description || field.allowedValues?.length)
      .map((field) => [field.key, {
        ...(field.description ? { description: field.description } : {}),
        ...(field.allowedValues?.length ? { allowedValues: field.allowedValues } : {}),
      }]),
  );
}

function csvValue(value: unknown) {
  const text = value === undefined || value === null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function markdownTemplate(module: StructuredModuleKey) {
  const definition = structuredModules[module];
  const sectionFields = new Set(definition.markdownSections?.map((section) => section.field) ?? []);
  const metadata = definition.fields.filter((field) => !sectionFields.has(field.key)).flatMap((field) => {
    const value = field.key === "tags" ? "[]" : field.example ?? "";
    return [
      ...(field.allowedValues?.length ? [`# ${field.key} allowed values: ${field.allowedValues.join(", ")}`] : []),
      `${field.key}: ${value}`,
    ];
  });
  return [
    "---",
    `schema: labnest/${module}@1`,
    ...metadata,
    "---",
    "",
    ...(definition.markdownSections ?? []).flatMap((section) => [`# ${section.title}`, "", ""]),
  ].join("\n");
}

/**
 * Drop-downs on the Import sheet. Every list lives on the hidden Lists sheet (an inline list stops at 255 characters).
 * A `suggest` list warns about other text but takes it; any other list refuses it.
 */
function xlsxChoicesFeature(rules: { column: number; listColumn: number; count: number; strict: boolean; header: string }[]) {
  if (!rules.length) return undefined;
  return {
    files: {
      transform: {
        "xl/workbook.xml": {
          transformElementAttributes(tagName: string, attributes: Record<string, string | number>) {
            return tagName === "sheet" && attributes.name === "Lists" ? { ...attributes, state: "hidden" } : attributes;
          },
        },
        "xl/worksheets/sheet{id}.xml": {
          transform(xml: string, _sheetOptions: unknown, { sheetIndex }: { sheetIndex: number }) {
            if (sheetIndex !== 0) return xml;
            const validations = rules.map((rule) => {
              const letter = getCellAddress(1, rule.listColumn).replace(/\d+$/, "");
              const message = sanitizeAttributeValue(rule.strict ? "从下拉中选择。 / Choose from the list." : "从下拉中选择，或填写其他内容。 / Choose from the list, or type another value.");
              // Excel refuses a drop-down title longer than 32 characters.
              const title = sanitizeAttributeValue(rule.header.slice(0, 32));
              return `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorStyle="${rule.strict ? "stop" : "warning"}" promptTitle="${title}" prompt="${message}" errorTitle="${title}" error="${message}" sqref="${getCellAddress(1, rule.column)}:${getCellAddress(500, rule.column)}"><formula1>Lists!$${letter}$2:$${letter}$${rule.count + 1}</formula1></dataValidation>`;
            }).join("");
            return insertElementMarkupAccordingToOrderOfSiblings(
              xml,
              `<dataValidations count="${rules.length}">${validations}</dataValidations>`,
              getOrderOfSiblings("xl/worksheets/sheet{id}.xml", "worksheet") ?? [],
              "worksheet",
            );
          },
        },
      },
    },
  };
}

/** The Instructions sheet: how to fill the template, then one row per column with whether it is required and its choices. */
function templateInstructions(module: StructuredModuleKey, lists: Record<string, string[]>): SheetData {
  const definition = structuredModules[module];
  const header = (value: string) => ({ value, type: String, fontWeight: "bold" as const, backgroundColor: "#DDE8EA", wrap: true });
  const text = (value: string) => ({ value, type: String, wrap: true });
  return [
    [{ value: `${bilingual(definition.title)} · 导入说明 / Import instructions`, type: String, fontWeight: "bold" }],
    [text(zhAndEn("每行填一条记录。表头保持不变，带 * 的列必填。", "Add one record per row. Keep the headers as they are; columns marked * are required."))],
    [text(zhAndEn("第 2 行是示例，导入前请替换或删除。", "Row 2 is an example; replace or delete it before importing."))],
    [text(zhAndEn("有可选值的列可以点单元格，从下拉中选择。", "Where a column has choices, click a cell and pick one from its drop-down."))],
    [],
    [header("列 / Column"), header("必填 / Required"), header("怎么填 / How to fill"), header("可选值 / Choices")],
    ...definition.fields.map((field) => {
      const choices = templateChoices(field, lists);
      const how = field.description ? (translateUiText(field.description, "zh") === field.description ? field.description : zhAndEn(translateUiText(field.description, "zh"), field.description)) : "";
      return [text(columnHeader(field)), text(field.required ? "是 / Yes" : ""), text(how), text(choices.join("\n"))];
    }),
  ];
}

/** An import template; `lists` holds the choices the app loads for a field, such as its types or storage locations. */
export async function buildStructuredTemplate(module: StructuredModuleKey, format: StructuredFileFormat, lists: Record<string, string[]> = {}): Promise<StructuredTemplate> {
  const definition = structuredModules[module];
  if (!definition.importFormats.includes(format)) throw new Error(`${format.toUpperCase()} is not supported for ${definition.title}.`);
  const filenameBase = `LabNest_${definition.title.replaceAll(" ", "_")}_Import_Template`;
  if (format === "docx") {
    if (module === "protocols") return { body: exportProtocolDocxTemplate(), filename: protocolDocxTemplateFilename, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
    if (module !== "research-plans" && module !== "reports") throw new Error("DOCX templates are not available for this module.");
    return { body: exportStructuredDocxTemplate(module), filename: `${filenameBase}.docx`, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  }
  if (format === "md") return { body: markdownTemplate(module), filename: `${filenameBase}.md`, contentType: "text/markdown; charset=utf-8" };
  if (format === "json") return { body: JSON.stringify({ schemaVersion: "labnest.structured-import/v1", module, fieldGuidance: templateFieldGuidance(module), records: [templateSample(module)] }, null, 2), filename: `${filenameBase}.json`, contentType: "application/json; charset=utf-8" };
  const headers = definition.fields.map(columnHeader);
  if (format === "csv" || format === "tsv") {
    const delimiter = format === "tsv" ? "\t" : ",";
    return { body: `${headers.map(csvValue).join(delimiter)}\n`, filename: `${filenameBase}.${format}`, contentType: `${format === "csv" ? "text/csv" : "text/tab-separated-values"}; charset=utf-8` };
  }
  const data: SheetData = [
    headers.map((header) => ({ value: header, type: String, fontWeight: "bold", backgroundColor: "#DDE8EA", wrap: true })),
    definition.fields.map((field) => {
      const value = sampleValue(field);
      const cellValue = typeof value === "boolean" ? value : typeof value === "number" ? value : String(value ?? "");
      return {
        value: cellValue,
        type: typeof cellValue === "boolean" ? Boolean : typeof cellValue === "number" ? Number : String,
        backgroundColor: "#F7F4ED",
        fontStyle: "italic" as const,
        textColor: "#6B6B63",
        wrap: true,
      };
    }),
  ];
  const listed = definition.fields.map((field, column) => ({ field, column, choices: templateChoices(field, lists) })).filter((entry) => entry.choices.length);
  const listRows = Math.max(0, ...listed.map((entry) => entry.choices.length));
  const listSheet: SheetData = [
    listed.map((entry) => ({ value: columnHeader(entry.field), type: String, fontWeight: "bold" as const })),
    ...Array.from({ length: listRows }, (_, row) => listed.map((entry) => entry.choices[row] === undefined ? null : { value: entry.choices[row], type: String })),
  ];
  const choicesFeature = xlsxChoicesFeature(listed.map((entry, listColumn) => ({ column: entry.column, listColumn, count: entry.choices.length, strict: entry.field.choices !== "suggest", header: columnHeader(entry.field) })));
  const buffer = await writeXlsxFile([
    { sheet: "Import", data, columns: headers.map(() => ({ width: 22 })), stickyRowsCount: 1 },
    { sheet: "Instructions", data: templateInstructions(module, lists), columns: [{ width: 28 }, { width: 12 }, { width: 60 }, { width: 36 }] },
    ...(listed.length ? [{ sheet: "Lists", data: listSheet, columns: listed.map(() => ({ width: 28 })) }] : []),
  ], {
    fontFamily: "Arial",
    fontSize: 10,
    ...(choicesFeature ? { features: [choicesFeature] } : {}),
  }).toBuffer();
  return { body: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer, filename: `${filenameBase}.xlsx`, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
}

/** A file's rows as written, before its columns are matched to fields. */
async function readRawRecords(file: File, module: StructuredModuleKey) {
  if (!file.name || file.size === 0) throw new Error("Choose a non-empty import file.");
  if (file.size > 25 * 1024 * 1024) throw new Error("Structured import files must be 25 MB or smaller.");
  const format = formatFromFilename(file.name);
  if (!format || !structuredModules[module].importFormats.includes(format)) {
    throw new Error(`${file.name} is not a supported ${structuredModules[module].singular} import format.`);
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(buffer).digest("hex");
  let rawRecords: Record<string, unknown>[];
  const warnings: string[] = [];
  const embedded = format === "docx" ? extractDocxMedia(new Uint8Array(buffer)) : undefined;
  if (embedded) warnings.push(...embedded.warnings);

  if (format === "csv" || format === "tsv") rawRecords = parseDelimited(buffer.toString("utf8"), format === "tsv" ? "\t" : ",");
  else if (format === "xlsx") rawRecords = workbookRows(await readSheet(buffer, { trim: true }) as unknown[][]);
  else if (format === "json") rawRecords = parseJsonRecords(buffer.toString("utf8"), module);
  else if (format === "md") {
    rawRecords = buffer.toString("utf8")
      .split(/\n?<!-- LabNest record boundary -->\n?/g)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => parseMarkdownRecord(part, module));
  }
  else if (module === "protocols") rawRecords = [protocolDocxRecord(new Uint8Array(buffer), file.name)];
  else rawRecords = [parseStructuredDocx(new Uint8Array(buffer), module)];
  return { format, checksum, rawRecords, warnings, embedded };
}

/** Each column of a file with up to five of its values and the field it is matched to now. */
export async function readColumnSamples(file: File, module: StructuredModuleKey, overrides: Record<string,string> = {}) {
  const { rawRecords } = await readRawRecords(file, module);
  const { mapping } = mapRecords(module, rawRecords, overrides);
  return mapping.map((column) => ({
    ...column,
    samples: rawRecords.map((record) => scalar(record[column.source])).filter((value) => value !== undefined && value !== null && value !== "").slice(0, 5).map(String),
  }));
}

export function parseColumnOverrides(value:FormDataEntryValue|null):Record<string,string>{
  if(!value)return {};
  const parsed=JSON.parse(String(value));
  if(!parsed||Array.isArray(parsed)||typeof parsed!=="object"||Object.values(parsed).some(v=>typeof v!=="string"))throw new Error("Invalid column mapping.");
  return parsed;
}
