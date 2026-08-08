import { strToU8, zipSync } from "fflate";
import type { ProtocolContentBlock, ProtocolDocument, ProtocolRichTextRun } from "./protocol-document";

export type ProtocolDocxIdentity = {
  humanCode?: string | null;
  canonicalTitle: string;
  englishTitle?: string | null;
  availability: string;
  reviewStage: string;
  displayVersion: string;
  scope: string;
  projectName?: string | null;
  tags: string[];
};

function xml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function run(text: string, options: { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; code?: boolean; heading?: boolean; color?: string } = {}) {
  const preserve = /^\s|\s$|\s{2}/.test(text) ? ' xml:space="preserve"' : "";
  const fonts = options.heading
    ? '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Microsoft YaHei"/>'
    : `<w:rFonts w:ascii="${options.code ? "Courier New" : "Times New Roman"}" w:hAnsi="${options.code ? "Courier New" : "Times New Roman"}" w:eastAsia="SimSun"/>`;
  return `<w:r><w:rPr>${fonts}${options.bold ? "<w:b/>" : ""}${options.italic ? "<w:i/>" : ""}${options.underline ? '<w:u w:val="single"/>' : ""}${options.strike ? "<w:strike/>" : ""}${options.color ? `<w:color w:val="${options.color}"/>` : ""}</w:rPr><w:t${preserve}>${xml(text)}</w:t></w:r>`;
}

function paragraph(content: string, style?: string, options: { before?: number; after?: number } = {}) {
  const spacing = `<w:spacing w:before="${options.before ?? 0}" w:after="${options.after ?? 80}" w:line="300" w:lineRule="auto"/>`;
  return `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}${spacing}</w:pPr>${content || run(" ")}</w:p>`;
}

function richRuns(runs: ProtocolRichTextRun[]) {
  return runs.map((item) => run(item.text, { bold: item.bold, italic: item.italic, underline: item.underline, strike: item.strike, code: item.code, color: item.link ? "465A45" : undefined })).join("");
}

function table(rows: string[][], caption?: string, critical = false) {
  const columnCount = Math.max(1, ...rows.map((row) => row.length));
  const width = Math.floor(9000 / columnCount);
  const body = rows.map((row, rowIndex) => `<w:tr>${Array.from({ length: columnCount }).map((_, columnIndex) => {
    const value = row[columnIndex] ?? "";
    const fill = critical ? "F3DEDA" : rowIndex === 0 ? "DDE8EA" : rowIndex % 2 === 0 ? "F7F4EC" : "FFFDF8";
    return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="${fill}"/><w:tcMar><w:top w:w="80" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr>${paragraph(run(value, { bold: rowIndex === 0 || critical, color: critical ? "9B4E49" : undefined }), undefined, { after: 0 })}</w:tc>`;
  }).join("")}</w:tr>`).join("");
  return `${caption ? paragraph(run(caption, { bold: true }), undefined, { before: 80, after: 50 }) : ""}<w:tbl><w:tblPr>${caption ? `<w:tblCaption w:val="${xml(caption)}"/>` : ""}<w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D9D3C6"/><w:left w:val="single" w:sz="4" w:color="D9D3C6"/><w:bottom w:val="single" w:sz="4" w:color="D9D3C6"/><w:right w:val="single" w:sz="4" w:color="D9D3C6"/><w:insideH w:val="single" w:sz="4" w:color="D9D3C6"/><w:insideV w:val="single" w:sz="4" w:color="D9D3C6"/></w:tblBorders></w:tblPr>${body}</w:tbl>`;
}

function blockXml(block: ProtocolContentBlock, sequence: { numbered: number }) {
  if (block.type === "heading") return paragraph(run(block.text, { bold: true, heading: true }), "Heading2", { before: 120 });
  if (block.type === "text") return block.text.split(/\r?\n/).map((line) => paragraph(run(line))).join("");
  if (block.type === "rich_text") return block.nodes.map((node) => {
    const content = richRuns(node.content);
    if (node.type === "heading2") return paragraph(content, "Heading2", { before: 120 });
    if (node.type === "heading3") return paragraph(content, "Heading3", { before: 80 });
    if (node.type === "bullet") return paragraph(run("• ") + content);
    if (node.type === "numbered") { const prefix = `${sequence.numbered}. `; sequence.numbered += 1; return paragraph(run(prefix) + content); }
    if (node.type === "quote") return paragraph(content, "Quote");
    return paragraph(content);
  }).join("");
  if (block.type === "checklist") return block.items.filter(Boolean).map((item) => paragraph(run(`☐ ${item}`))).join("");
  if (block.type === "table") return table(block.rows, block.caption);
  if (block.type === "callout") {
    const prefix = block.tone === "critical" ? "关键警告 / CRITICAL: 不得忽略 · " : block.tone === "warning" ? "警告 / WARNING · " : "说明 / NOTE · ";
    return table([[`${prefix}${block.text}`]], undefined, block.tone === "critical");
  }
  if (block.type === "media") return paragraph(run(`${block.caption || block.mediaType}: ${block.url}`));
  return paragraph(run(`${block.label} · ${block.durationMinutes} min${block.notes ? ` · ${block.notes}` : ""}`, { bold: true }));
}

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="SimSun"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Microsoft YaHei"/><w:b/><w:sz w:val="34"/><w:color w:val="1F2522"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="SectionHeading"><w:name w:val="Section Heading"/><w:basedOn w:val="Normal"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Microsoft YaHei"/><w:b/><w:sz w:val="24"/><w:color w:val="465A45"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="Heading 2"/><w:basedOn w:val="Normal"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Microsoft YaHei"/><w:b/><w:sz w:val="22"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="Heading 3"/><w:basedOn w:val="Normal"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Microsoft YaHei"/><w:b/><w:sz w:val="20"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="360"/></w:pPr><w:rPr><w:i/><w:color w:val="737B73"/></w:rPr></w:style>
</w:styles>`;

export function protocolDocxFilename(identity: ProtocolDocxIdentity) {
  const code = identity.humanCode ?? "PRT-UNASSIGNED";
  const status = identity.availability.charAt(0).toUpperCase() + identity.availability.slice(1);
  const title = identity.canonicalTitle.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
  return `${code}_${title}_v${identity.displayVersion}_${status}.docx`;
}

export function exportProtocolDocx(identity: ProtocolDocxIdentity, document: ProtocolDocument) {
  const identityRows = [
    ["Protocol Title", `${identity.humanCode ? `${identity.humanCode} ` : ""}${identity.canonicalTitle}`],
    ["Availability", identity.availability],
    ["Review stage", identity.reviewStage],
    ["Tag", identity.tags.join("; ")],
    ["Version", identity.displayVersion],
    ["Scope", identity.projectName ? `${identity.scope} · ${identity.projectName}` : identity.scope],
  ];
  const sequence = { numbered: 1 };
  const sections = document.sections.map((section) => `${paragraph(run(section.title, { bold: true, heading: true }), "SectionHeading", { before: 220, after: 100 })}${section.blocks.length ? section.blocks.map((block) => blockXml(block, sequence)).join("") : paragraph(run("Not recorded.", { italic: true, color: "737B73" }))}`).join("");
  const body = `${paragraph(run(identity.canonicalTitle, { bold: true, heading: true }), "Title", { after: 60 })}${identity.englishTitle ? paragraph(run(identity.englishTitle, { italic: true, color: "737B73" }), undefined, { after: 140 }) : ""}${table(identityRows)}${sections}`;
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  return zipSync({
    "[Content_Types].xml": strToU8(contentTypes),
    "_rels/.rels": strToU8(rootRels),
    "word/document.xml": strToU8(documentXml),
    "word/styles.xml": strToU8(stylesXml),
    "word/_rels/document.xml.rels": strToU8(documentRels),
  }, { level: 6 });
}
