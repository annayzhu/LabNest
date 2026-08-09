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
  templateMode?: boolean;
};

const tableWidth = 9576;
const palette = {
  text: "222222",
  secondaryText: "666666",
  border: "666666",
  tableHeader: "D9D9D9",
  tableStripe: "F2F2F2",
  white: "FFFFFF",
  risk: "C00000",
  riskFill: "FDECEC",
} as const;

function xml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function run(text: string, options: { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; code?: boolean; heading?: boolean; color?: string; size?: number } = {}) {
  const preserve = /^\s|\s$|\s{2}/.test(text) ? ' xml:space="preserve"' : "";
  const fonts = options.heading
    ? '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Microsoft YaHei"/>'
    : `<w:rFonts w:ascii="${options.code ? "Courier New" : "Times New Roman"}" w:hAnsi="${options.code ? "Courier New" : "Times New Roman"}" w:eastAsia="SimSun"/>`;
  return `<w:r><w:rPr>${fonts}${options.bold ? "<w:b/>" : ""}${options.italic ? "<w:i/>" : ""}${options.underline ? '<w:u w:val="single"/>' : ""}${options.strike ? "<w:strike/>" : ""}${options.color ? `<w:color w:val="${options.color}"/>` : ""}${options.size ? `<w:sz w:val="${options.size}"/><w:szCs w:val="${options.size}"/>` : ""}</w:rPr><w:t${preserve}>${xml(text)}</w:t></w:r>`;
}

function paragraph(
  content: string,
  style?: string,
  options: { before?: number; after?: number; align?: "left" | "center" | "right"; keepNext?: boolean } = {},
) {
  const spacing = `<w:spacing w:before="${options.before ?? 0}" w:after="${options.after ?? 60}" w:line="240" w:lineRule="auto"/>`;
  return `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}${spacing}${options.align ? `<w:jc w:val="${options.align}"/>` : ""}${options.keepNext ? "<w:keepNext/>" : ""}</w:pPr>${content || run(" ")}</w:p>`;
}

function richRuns(runs: ProtocolRichTextRun[]) {
  return runs.map((item) => run(item.text, {
    bold: item.bold,
    italic: item.italic,
    underline: item.underline,
    strike: item.strike,
    code: item.code,
    color: item.link ? palette.secondaryText : undefined,
  })).join("");
}

type TableKind = "data" | "identity" | "callout";
type CalloutTone = "note" | "warning" | "critical";

function columnWidths(rows: string[][], kind: TableKind) {
  const columnCount = Math.max(1, ...rows.map((row) => row.length));
  if (kind === "identity") return [2183, 7393];
  if (columnCount === 1) return [tableWidth];

  const header = (rows[0] ?? []).map((value) => value.trim().toLowerCase()).join("|");
  const knownWidths: Record<string, number[]> = {
    "name|unit|role|notes": [3000, 1200, 2300, 3076],
    "field|type|unit|required": [3600, 1800, 1500, 2676],
    "material|formula|unit": [3000, 5076, 1500],
    "name|notes": [3600, 5976],
  };
  const known = knownWidths[header];
  if (known) return known;

  const width = Math.floor(tableWidth / columnCount);
  return Array.from({ length: columnCount }, (_, index) => index === columnCount - 1
    ? tableWidth - (width * (columnCount - 1))
    : width);
}

function border(side: string, value: "single" | "none", size: number, color: string) {
  return `<w:${side} w:val="${value}" w:sz="${size}" w:color="${color}" w:space="0"/>`;
}

function table(
  inputRows: string[][],
  caption?: string,
  options: { kind?: TableKind; tone?: CalloutTone; description?: string } = {},
) {
  const rows = inputRows.length ? inputRows : [[""]];
  const kind = options.kind ?? "data";
  const tone = options.tone ?? "note";
  const widths = columnWidths(rows, kind);
  const columnCount = widths.length;
  const isRisk = kind === "callout" && tone !== "note";
  const tableBorderColor = isRisk ? palette.risk : palette.border;
  const tableBorders = kind === "callout"
    ? ["top", "left", "bottom", "right", "insideH", "insideV"].map((side) => border(side, "single", 6, tableBorderColor)).join("")
    : [
        border("top", "single", 12, tableBorderColor),
        border("left", "none", 0, "auto"),
        border("bottom", "single", 12, tableBorderColor),
        border("right", "none", 0, "auto"),
        border("insideH", "none", 0, "auto"),
        border("insideV", "none", 0, "auto"),
      ].join("");

  const body = rows.map((row, rowIndex) => {
    const isHeader = kind === "data" && rowIndex === 0;
    const rowProperties = `<w:trPr><w:cantSplit/>${isHeader ? "<w:tblHeader/>" : ""}</w:trPr>`;
    const cells = Array.from({ length: columnCount }).map((_, columnIndex) => {
      const value = row[columnIndex] ?? "";
      const fill = kind === "callout"
        ? (isRisk ? palette.riskFill : palette.tableStripe)
        : isHeader
          ? palette.tableHeader
          : rowIndex % 2 === 0
            ? palette.tableStripe
            : palette.white;
      const bold = isHeader || (kind === "identity" && columnIndex === 0) || kind === "callout";
      const color = isRisk ? palette.risk : kind === "callout" ? palette.secondaryText : undefined;
      const headerBottomBorder = isHeader
        ? `<w:tcBorders>${border("bottom", "single", 6, palette.border)}</w:tcBorders>`
        : "";
      const cellProperties = `<w:tcPr><w:tcW w:w="${widths[columnIndex]}" w:type="dxa"/>${headerBottomBorder}<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/><w:tcMar><w:top w:w="40" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar><w:vAlign w:val="center"/></w:tcPr>`;
      return `<w:tc>${cellProperties}${paragraph(run(value, { bold, color }), undefined, { after: 0, align: isHeader ? "center" : "left" })}</w:tc>`;
    }).join("");
    return `<w:tr>${rowProperties}${cells}</w:tr>`;
  }).join("");

  const grid = widths.map((width) => `<w:gridCol w:w="${width}"/>`).join("");
  const captionXml = caption
    ? paragraph(run(caption, { bold: true, heading: true }), "Heading2", { before: 120, after: 60, keepNext: true })
    : "";
  return `${captionXml}<w:tbl><w:tblPr>${caption ? `<w:tblCaption w:val="${xml(caption)}"/>` : ""}${options.description ? `<w:tblDescription w:val="${xml(options.description)}"/>` : ""}<w:tblW w:w="${tableWidth}" w:type="dxa"/><w:tblInd w:w="120" w:type="dxa"/><w:tblBorders>${tableBorders}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${body}</w:tbl>`;
}

function blockXml(block: ProtocolContentBlock, sequence: { numbered: number }) {
  if (block.type === "heading") return paragraph(run(block.text, { bold: true, heading: true }), "Heading2", { before: 120, keepNext: true });
  if (block.type === "text") return block.text.split(/\r?\n/).map((line) => paragraph(run(line))).join("");
  if (block.type === "rich_text") return block.nodes.map((node) => {
    const content = richRuns(node.content);
    if (node.type === "heading2") return paragraph(content, "Heading2", { before: 120, keepNext: true });
    if (node.type === "heading3") return paragraph(content, "Heading3", { before: 80, keepNext: true });
    if (node.type === "bullet") return paragraph(run("• ") + content, "ListBullet");
    if (node.type === "numbered") {
      const prefix = `${sequence.numbered}. `;
      sequence.numbered += 1;
      return paragraph(run(prefix) + content, "ListBullet");
    }
    if (node.type === "quote") return paragraph(content, "Quote");
    return paragraph(content);
  }).join("");
  if (block.type === "checklist") return block.items.filter(Boolean).map((item) => paragraph(run(`☐ ${item}`), "Checklist")).join("");
  if (block.type === "table") return table(block.rows, block.caption, { description: block.resultTemplate ? `labnest-result-template:${JSON.stringify(block.resultTemplate)}` : undefined });
  if (block.type === "callout") {
    const prefix = block.tone === "critical"
      ? "关键警告 / CRITICAL · "
      : block.tone === "warning"
        ? "风险提示 / WARNING · "
        : "说明 / NOTE · ";
    return table([[`${prefix}${block.text}`]], undefined, { kind: "callout", tone: block.tone });
  }
  if (block.type === "media") return paragraph(run(`${block.caption || block.mediaType}: ${block.url}`));
  return paragraph(run(`${block.label} · ${block.durationMinutes} min${block.notes ? ` · ${block.notes}` : ""}`, { bold: true }));
}

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="SimSun"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-US" w:eastAsia="zh-CN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="60" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="SimSun"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="ProtocolCode"><w:name w:val="Protocol Code"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="SimSun"/><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="${palette.text}"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Microsoft YaHei"/><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/><w:color w:val="${palette.text}"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="SimSun"/><w:i/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="${palette.secondaryText}"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="SectionHeading"><w:name w:val="Section Heading"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Microsoft YaHei"/><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/><w:color w:val="${palette.text}"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="Heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Microsoft YaHei"/><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="${palette.text}"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="Heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Microsoft YaHei"/><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="${palette.secondaryText}"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="360"/></w:pPr><w:rPr><w:i/><w:color w:val="${palette.secondaryText}"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="360" w:hanging="240"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Checklist"><w:name w:val="Checklist"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="360" w:hanging="240"/></w:pPr></w:style>
</w:styles>`;

function headerXml(identity: ProtocolDocxIdentity) {
  const left = `${identity.humanCode ?? "PRT-XXXXXX"} | ${identity.canonicalTitle}`;
  const right = `${displayStatus(identity.availability)} | v${identity.displayVersion}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:tabs><w:tab w:val="right" w:pos="9576"/></w:tabs><w:pBdr><w:bottom w:val="single" w:sz="4" w:color="BFBFBF" w:space="1"/></w:pBdr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>${run(left, { color: palette.secondaryText, size: 16 })}<w:r><w:tab/></w:r>${run(right, { color: palette.secondaryText, size: 16 })}</w:p></w:hdr>`;
}

function footerXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/><w:pBdr><w:top w:val="single" w:sz="4" w:color="BFBFBF" w:space="1"/></w:pBdr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>${run("Research Use Only | 受控副本以 LabNest 中的最新版本为准 | Page ", { color: palette.secondaryText, size: 16 })}<w:fldSimple w:instr=" PAGE ">${run("1", { color: palette.secondaryText, size: 16 })}</w:fldSimple></w:p></w:ftr>`;
}

function displayStatus(value: string) {
  const spaced = value.replaceAll("_", " ");
  return `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}`;
}

export function protocolDocxFilename(identity: ProtocolDocxIdentity) {
  const code = identity.humanCode ?? "PRT-UNASSIGNED";
  const status = identity.availability.charAt(0).toUpperCase() + identity.availability.slice(1);
  const title = identity.canonicalTitle.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
  return `${code}_${title}_v${identity.displayVersion}_${status}.docx`;
}

export function exportProtocolDocx(identity: ProtocolDocxIdentity, document: ProtocolDocument) {
  const availabilityLabel = displayStatus(identity.availability);
  const reviewStageLabel = displayStatus(identity.reviewStage);
  const availability = identity.templateMode
    ? `${availabilityLabel} （可选状态：Draft / Active / Retired / Archived）`
    : availabilityLabel;
  const reviewStage = identity.templateMode
    ? `${reviewStageLabel} （可选阶段：Draft / Ready for review / Reviewed）`
    : reviewStageLabel;
  const identityRows = [
    ["Protocol Title", `${identity.humanCode ? `${identity.humanCode} ` : ""}${identity.canonicalTitle}`],
    ["Availability", availability],
    ["Review stage", reviewStage],
    ["Tag", identity.tags.join("; ")],
  ];
  const sequence = { numbered: 1 };
  const sections = document.sections.map((section) => `${paragraph(run(section.title, { bold: true, heading: true }), "SectionHeading", { before: 160, after: 60, keepNext: true })}${section.blocks.length ? section.blocks.map((block) => blockXml(block, sequence)).join("") : paragraph(run("Not recorded.", { italic: true, color: palette.secondaryText }))}`).join("");
  const body = `${paragraph(run(identity.humanCode ?? "PRT-XXXXXX", { bold: true }), "ProtocolCode", { before: 120, after: 20, align: "center" })}${paragraph(run(identity.canonicalTitle, { bold: true, heading: true }), "Title", { after: 40, align: "center" })}${identity.englishTitle ? paragraph(run(identity.englishTitle, { italic: true, color: palette.secondaryText }), "Subtitle", { after: 100, align: "center" }) : ""}${table(identityRows, undefined, { kind: "identity" })}${sections}`;
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:headerReference w:type="default" r:id="rId2"/><w:footerReference w:type="default" r:id="rId3"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1020" w:right="1077" w:bottom="964" w:left="1077" w:header="454" w:footer="454" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/></Relationships>`;
  const settingsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:updateFields w:val="true"/></w:settings>`;
  return zipSync({
    "[Content_Types].xml": strToU8(contentTypes),
    "_rels/.rels": strToU8(rootRels),
    "word/document.xml": strToU8(documentXml),
    "word/styles.xml": strToU8(stylesXml),
    "word/settings.xml": strToU8(settingsXml),
    "word/header1.xml": strToU8(headerXml(identity)),
    "word/footer1.xml": strToU8(footerXml()),
    "word/_rels/document.xml.rels": strToU8(documentRels),
  }, { level: 6 });
}
