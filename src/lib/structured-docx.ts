import { DOMParser } from "@xmldom/xmldom";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { StructuredModuleKey } from "./structured-modules";
import { structuredModules } from "./structured-modules";

function xml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function run(text: string, options: { bold?: boolean; heading?: boolean } = {}) {
  return `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="${options.heading ? "Microsoft YaHei" : "SimSun"}"/>${options.bold ? "<w:b/>" : ""}</w:rPr><w:t xml:space="preserve">${xml(text || " ")}</w:t></w:r>`;
}

function paragraph(text: string, style?: string) {
  return `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}<w:spacing w:after="100" w:line="300" w:lineRule="auto"/></w:pPr>${run(text, { bold: Boolean(style), heading: Boolean(style) })}</w:p>`;
}

function table(rows: string[][]) {
  const width = Math.floor(9000 / Math.max(1, ...rows.map((row) => row.length)));
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D9D3C6"/><w:left w:val="single" w:sz="4" w:color="D9D3C6"/><w:bottom w:val="single" w:sz="4" w:color="D9D3C6"/><w:right w:val="single" w:sz="4" w:color="D9D3C6"/><w:insideH w:val="single" w:sz="4" w:color="D9D3C6"/><w:insideV w:val="single" w:sz="4" w:color="D9D3C6"/></w:tblBorders></w:tblPr>${rows.map((row, rowIndex) => `<w:tr>${row.map((cell) => `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:shd w:val="clear" w:fill="${rowIndex === 0 ? "DDE8EA" : "FFFDF8"}"/></w:tcPr>${paragraph(cell)}</w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`;
}

const legacyStylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="SimSun"/><w:sz w:val="20"/></w:rPr></w:rPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Microsoft YaHei"/><w:b/><w:sz w:val="34"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Microsoft YaHei"/><w:b/><w:sz w:val="24"/><w:color w:val="465A45"/></w:rPr></w:style>
</w:styles>`;

type ResearchPlanParagraphRole = "title" | "heading" | "risk-heading" | "body" | "table-header" | "critical-action" | "risk-warning";

function researchPlanRun(text: string, role: ResearchPlanParagraphRole) {
  const isHeading = role === "title" || role === "heading" || role === "risk-heading";
  const isEmphasized = isHeading || role === "table-header" || role === "risk-warning";
  const isCritical = role === "risk-heading" || role === "critical-action" || role === "risk-warning";
  const chineseFont = isHeading ? "微软雅黑" : "宋体";
  const segments = (text || " ").match(/[\u3400-\u9FFF\uF900-\uFAFF]+|[^\u3400-\u9FFF\uF900-\uFAFF]+/g) ?? [" "];
  return segments.map((segment) => {
    const isChinese = /[\u3400-\u9FFF\uF900-\uFAFF]/.test(segment);
    const latinFont = isChinese ? chineseFont : "Times New Roman";
    return `<w:r><w:rPr><w:rFonts w:ascii="${latinFont}" w:hAnsi="${latinFont}" w:cs="${latinFont}" w:eastAsia="${chineseFont}"${isChinese ? ' w:hint="eastAsia"' : ""}/>${isEmphasized ? "<w:b/>" : ""}<w:color w:val="${isCritical ? "C00000" : "595959"}"/><w:sz w:val="${isHeading ? "24" : "20"}"/><w:szCs w:val="${isHeading ? "24" : "20"}"/></w:rPr><w:t xml:space="preserve">${xml(segment)}</w:t></w:r>`;
  }).join("");
}

function researchPlanParagraph(text: string, role: ResearchPlanParagraphRole = "body") {
  const style = {
    title: "Title",
    heading: "Heading1",
    "risk-heading": "RiskHeading",
    body: "Normal",
    "table-header": "TableHeader",
    "critical-action": "CriticalAction",
    "risk-warning": "RiskWarning",
  }[role];
  const spacing = role === "title"
    ? '<w:spacing w:before="0" w:after="120" w:line="240" w:lineRule="auto"/>'
    : role === "heading" || role === "risk-heading"
      ? '<w:keepNext/><w:spacing w:before="180" w:after="60" w:line="240" w:lineRule="auto"/>'
      : '<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>';
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/>${spacing}</w:pPr>${researchPlanRun(text, role)}</w:p>`;
}

function researchPlanTable(rows: string[][]) {
  const columnCount = Math.max(1, ...rows.map((row) => row.length));
  const tableWidth = 9000;
  const columnWidths = columnCount === 2
    ? [3000, 6000]
    : Array.from({ length: columnCount }, () => Math.floor(tableWidth / columnCount));
  const grid = columnWidths.map((width) => `<w:gridCol w:w="${width}"/>`).join("");
  const rowMarkup = rows.map((row, rowIndex) => {
    const fill = rowIndex === 0 ? "D9EAF7" : rowIndex % 2 === 0 ? "EAF3F8" : "FFFFFF";
    const rowProperties = rowIndex === 0 ? "<w:trPr><w:tblHeader/></w:trPr>" : "";
    const cells = Array.from({ length: columnCount }, (_, columnIndex) => {
      const width = columnWidths[columnIndex] ?? columnWidths.at(-1) ?? tableWidth;
      const headerBorder = rowIndex === 0
        ? '<w:tcBorders><w:bottom w:val="single" w:sz="8" w:space="0" w:color="7F8C8D"/></w:tcBorders>'
        : "";
      return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="${fill}"/><w:vAlign w:val="center"/><w:tcMar><w:top w:w="80" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>${headerBorder}</w:tcPr>${researchPlanParagraph(row[columnIndex] ?? "", rowIndex === 0 ? "table-header" : "body")}</w:tc>`;
    }).join("");
    return `<w:tr>${rowProperties}${cells}</w:tr>`;
  }).join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="${tableWidth}" w:type="dxa"/><w:tblInd w:w="120" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="single" w:sz="8" w:space="0" w:color="7F8C8D"/><w:left w:val="nil"/><w:bottom w:val="single" w:sz="8" w:space="0" w:color="7F8C8D"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rowMarkup}</w:tbl>`;
}

const researchPlanStylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="宋体"/><w:color w:val="595959"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="宋体"/><w:color w:val="595959"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="微软雅黑"/><w:b/><w:color w:val="595959"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="微软雅黑"/><w:b/><w:color w:val="595959"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="RiskHeading"><w:name w:val="Risk heading"/><w:basedOn w:val="Heading1"/><w:next w:val="RiskWarning"/><w:rPr><w:color w:val="C00000"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="TableHeader"><w:name w:val="Table header"/><w:basedOn w:val="Normal"/><w:rPr><w:b/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="CriticalAction"><w:name w:val="Critical action"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:color w:val="C00000"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="RiskWarning"><w:name w:val="Risk warning"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:color w:val="C00000"/></w:rPr></w:style>
</w:styles>`;

export function exportStructuredDocxTemplate(module: "research-plans" | "reports") {
  const definition = structuredModules[module];
  const isResearchPlan = module === "research-plans";
  const titleField = definition.fields.find((field) => field.key === "title")!;
  const sectionFields = new Set(definition.markdownSections?.map((section) => section.field) ?? []);
  const hiddenResearchPlanMetadata = new Set(["protocolCodes", "primaryProtocolCode"]);
  const metadata = definition.fields
    .filter((field) => field.key !== "title" && !sectionFields.has(field.key) && (!isResearchPlan || !hiddenResearchPlanMetadata.has(field.key)))
    .map((field) => [field.label, field.example === undefined ? "" : String(field.example)]);
  const body = [
    isResearchPlan
      ? researchPlanParagraph(String(titleField.example ?? `Replace with ${definition.singular} title`), "title")
      : paragraph(String(titleField.example ?? `Replace with ${definition.singular} title`), "Title"),
    isResearchPlan ? researchPlanTable([["Field", "Value"], ...metadata]) : table([["Field", "Value"], ...metadata]),
    ...(definition.markdownSections ?? []).flatMap((section) => {
      if (!isResearchPlan) return [paragraph(section.title, "Heading1"), paragraph("")];
      const isRiskSection = section.field === "constraints";
      return [
        researchPlanParagraph(section.title, isRiskSection ? "risk-heading" : "heading"),
        researchPlanParagraph("", isRiskSection ? "risk-warning" : "body"),
      ];
    }),
  ].join("");
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  return zipSync({
    "[Content_Types].xml": strToU8(contentTypes),
    "_rels/.rels": strToU8(rootRels),
    "word/document.xml": strToU8(documentXml),
    "word/styles.xml": strToU8(isResearchPlan ? researchPlanStylesXml : legacyStylesXml),
    "word/_rels/document.xml.rels": strToU8(documentRels),
  }, { level: 6 });
}

function elementText(element: Element) {
  return Array.from(element.getElementsByTagName("w:t")).map((node) => node.textContent ?? "").join("").trim();
}

function tableRows(element: Element) {
  return Array.from(element.getElementsByTagName("w:tr")).map((row) =>
    Array.from(row.childNodes)
      .filter((node): node is Element => node.nodeType === 1 && (node as Element).tagName === "w:tc")
      .map((cell) => elementText(cell)),
  );
}

function normalized(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
}

function markdownTable(rows: string[][]) {
  if (!rows.length) return "";
  const width = Math.max(...rows.map((row) => row.length));
  const padded = rows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ""));
  return [
    `| ${padded[0].join(" | ")} |`,
    `| ${padded[0].map(() => "---").join(" | ")} |`,
    ...padded.slice(1).map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

export function parseStructuredDocx(bytes: Uint8Array, module: Exclude<StructuredModuleKey, "protocols">) {
  const definition = structuredModules[module];
  const archive = unzipSync(bytes);
  const documentXml = archive["word/document.xml"];
  if (!documentXml) throw new Error("This file is not a readable Word DOCX document.");
  const document = new DOMParser().parseFromString(strFromU8(documentXml), "application/xml");
  const body = document.getElementsByTagName("w:body")[0];
  if (!body) throw new Error("The DOCX body could not be read.");

  const record: Record<string, unknown> = {};
  const headingMap = new Map<string, string>();
  for (const section of definition.markdownSections ?? []) {
    for (const title of [section.title, ...(section.aliases ?? [])]) headingMap.set(normalized(title), section.field);
  }
  const metadataMap = new Map<string, string>();
  for (const field of definition.fields) {
    for (const label of [field.key, field.label, ...(field.aliases ?? [])]) metadataMap.set(normalized(label), field.key);
  }
  let currentField: string | undefined;
  const content = new Map<string, string[]>();
  const identityParagraphs: string[] = [];

  for (const node of Array.from(body.childNodes)) {
    if (node.nodeType !== 1) continue;
    const element = node as unknown as Element;
    if (element.tagName === "w:p") {
      const text = elementText(element);
      if (!text) continue;
      const headingField = headingMap.get(normalized(text));
      if (headingField) {
        currentField = headingField;
        continue;
      }
      if (currentField) content.set(currentField, [...(content.get(currentField) ?? []), text]);
      else identityParagraphs.push(text);
    }
    if (element.tagName === "w:tbl") {
      const rows = tableRows(element);
      if (currentField) content.set(currentField, [...(content.get(currentField) ?? []), markdownTable(rows)]);
      else {
        for (const row of rows) {
          const key = row[0] ? metadataMap.get(normalized(row[0])) : undefined;
          if (key && row[1]) record[key] = row[1];
        }
      }
    }
  }
  if (!record.title) record.title = identityParagraphs[0] ?? "";
  for (const [field, values] of content) record[field] = values.join("\n\n").trim();
  return record;
}
