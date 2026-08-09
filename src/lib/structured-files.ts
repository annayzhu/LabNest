import { createHash } from "node:crypto";
import { readSheet } from "read-excel-file/node";
import writeXlsxFile from "write-excel-file/node";
import type { SheetData } from "write-excel-file/node";
import {
  getCellAddress,
  getOrderOfSiblings,
  insertElementMarkupAccordingToOrderOfSiblings,
  sanitizeAttributeValue,
  sanitizeTextContent,
} from "write-excel-file/utility";
import { parseProtocolDocxBytes } from "./protocol-docx";
import { exportProtocolDocxTemplate, protocolDocxTemplateFilename } from "./protocol-docx-template";
import { createEmptyProtocolDocument, type ProtocolDocument } from "./protocol-document";
import { exportStructuredDocxTemplate, parseStructuredDocx } from "./structured-docx";
import {
  formatFromFilename,
  type StructuredFileFormat,
  type StructuredModuleKey,
  structuredModules,
} from "./structured-modules";

export type StructuredColumnMapping = { source: string; target?: string; targetLabel?: string };
export type ParsedStructuredFile = {
  module: StructuredModuleKey;
  format: StructuredFileFormat;
  fileName: string;
  checksum: string;
  records: Record<string, unknown>[];
  mapping: StructuredColumnMapping[];
  warnings: string[];
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
  const lookup = new Map<string, { key: string; label: string }>();
  for (const field of structuredModules[module].fields) {
    for (const alias of [field.key, field.label, ...(field.aliases ?? [])]) {
      lookup.set(normalizeKey(alias), { key: field.key, label: field.label });
    }
  }
  return lookup;
}

function mapRecords(module: StructuredModuleKey, records: Record<string, unknown>[]) {
  const lookup = fieldLookup(module);
  const mapping = new Map<string, StructuredColumnMapping>();
  const normalizedRecords = records.map((record) => {
    const normalized: Record<string, unknown> = {};
    for (const [source, value] of Object.entries(record)) {
      if (source.startsWith("__")) {
        normalized[source] = value;
        continue;
      }
      const field = lookup.get(normalizeKey(source));
      mapping.set(source, { source, target: field?.key, targetLabel: field?.label });
      if (field) normalized[field.key] = scalar(value);
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
  return {
    humanCode: parsed.humanCode,
    canonicalTitle: parsed.canonicalTitle,
    englishTitle: parsed.englishTitle,
    availability: parsed.availability,
    reviewStage: parsed.reviewStage,
    displayVersion: parsed.displayVersion,
    tags: parsed.tags,
    description: parsed.description,
    purpose: parsed.purpose,
    background: parsed.background,
    contentJson: parsed.document,
    __importWarnings: parsed.document.importWarnings,
  };
}

export async function parseStructuredFile(file: File, module: StructuredModuleKey): Promise<ParsedStructuredFile> {
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

  if (rawRecords.length > 500) throw new Error("A single structured import is limited to 500 records.");
  if (!rawRecords.length) throw new Error("No data rows were found in the import file.");
  const mapped = mapRecords(module, rawRecords);
  const unknownColumns = mapped.mapping.filter((item) => !item.target).map((item) => item.source);
  if (unknownColumns.length) warnings.push(`Unmapped columns retained outside the import: ${unknownColumns.join(", ")}.`);
  for (const record of mapped.records) {
    if (module === "protocols" && format === "md") record.contentJson = protocolDocumentFromMarkdown(record);
    const recordWarnings = record.__importWarnings;
    if (Array.isArray(recordWarnings)) warnings.push(...recordWarnings.map(String));
  }
  return { module, format, fileName: file.name, checksum, records: mapped.records, mapping: mapped.mapping, warnings: [...new Set(warnings)] };
}

function templateSample(module: StructuredModuleKey) {
  return Object.fromEntries(structuredModules[module].fields.map((field) => [field.key, field.example ?? ""]));
}

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

function xlsxControlledValueFeature(module: StructuredModuleKey) {
  const fields = structuredModules[module].fields;
  const rules = fields.flatMap((field, columnIndex) => field.allowedValues?.length
    ? [{ field, columnIndex }]
    : []);

  if (!rules.length) return undefined;

  return {
    files: {
      transform: {
        "xl/worksheets/sheet{id}.xml": {
          transform(xml: string, _sheetOptions: unknown, { sheetIndex }: { sheetIndex: number }) {
            if (sheetIndex !== 0) return xml;
            const validations = rules.map(({ field, columnIndex }) => {
              const start = getCellAddress(1, columnIndex);
              const end = getCellAddress(500, columnIndex);
              const values = field.allowedValues ?? [];
              const formula = `&quot;${sanitizeTextContent(values.join(","))}&quot;`;
              const prompt = `Choose one of: ${values.join(", ")}.`;
              return `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorStyle="stop" promptTitle="Allowed ${sanitizeAttributeValue(field.label)}" prompt="${sanitizeAttributeValue(prompt)}" errorTitle="Invalid ${sanitizeAttributeValue(field.label)}" error="${sanitizeAttributeValue(prompt)}" sqref="${start}:${end}"><formula1>${formula}</formula1></dataValidation>`;
            }).join("");
            const markup = `<dataValidations count="${rules.length}">${validations}</dataValidations>`;
            return insertElementMarkupAccordingToOrderOfSiblings(
              xml,
              markup,
              getOrderOfSiblings("xl/worksheets/sheet{id}.xml", "worksheet") ?? [],
              "worksheet",
            );
          },
        },
      },
    },
  };
}

export async function buildStructuredTemplate(module: StructuredModuleKey, format: StructuredFileFormat): Promise<StructuredTemplate> {
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
  const headers = definition.fields.map((field) => field.key);
  if (format === "csv" || format === "tsv") {
    const delimiter = format === "tsv" ? "\t" : ",";
    return { body: `${headers.map(csvValue).join(delimiter)}\n`, filename: `${filenameBase}.${format}`, contentType: `${format === "csv" ? "text/csv" : "text/tab-separated-values"}; charset=utf-8` };
  }
  const sample = templateSample(module);
  const data: SheetData = [
    headers.map((header) => ({ value: header, type: String, fontWeight: "bold", backgroundColor: "#DDE8EA", wrap: true })),
    headers.map((header) => {
      const value = sample[header];
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
  const instructions: SheetData = [
    [{ value: `${definition.title} structured import`, type: String, fontWeight: "bold" }],
    ["Keep the header names unchanged. Add one structured record per row."],
    ["Row 2 is an example. Replace its placeholder values before importing; unchanged placeholders are blocked."],
    ...definition.fields.filter((field) => field.allowedValues?.length).map((field) => [
      `${field.label} (${field.key}) only accepts: ${field.allowedValues?.join(", ")}. Use the drop-down in the Import sheet.`,
    ]),
    ["Download JSON or Markdown templates when nested scientific sections are required."],
  ];
  const controlledValueFeature = xlsxControlledValueFeature(module);
  const buffer = await writeXlsxFile([
    { sheet: "Import", data, columns: headers.map(() => ({ width: 22 })) },
    { sheet: "Instructions", data: instructions, columns: [{ width: 120 }] },
  ], {
    fontFamily: "Arial",
    fontSize: 10,
    ...(controlledValueFeature ? { features: [controlledValueFeature] } : {}),
  }).toBuffer();
  return { body: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer, filename: `${filenameBase}.xlsx`, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
}
