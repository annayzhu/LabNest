import type { JSONContent } from "@tiptap/core";
import { parseRichTextFontSizePt, type RichTextFontSizePt } from "@/lib/rich-text-font-size";
import { parseRichTextColor, RICH_TEXT_RISK_COLOR_HEX, type RichTextColor } from "@/lib/rich-text-color";
import { documentMediaFromMarkdown, documentMediaToMarkdown } from "./document-media";

export type PersistedTiptapTable = {
  rows: string[][];
  rowIds?: string[];
  columnWidths?: Array<number | null>;
  cellFontSizesPt?: Array<Array<RichTextFontSizePt | null>>;
  cellColors?: Array<Array<RichTextColor | null>>;
  cellRichContent?: Array<Array<JSONContent[] | null>>;
  /** A recipe column that belongs to one system option; edited as the header cell's `protocolColumn`. */
  columnConditions?: Array<{ dimensionId: string; optionId: string } | null>;
};

function plainText(node: JSONContent | undefined): string {
  if (!node) return "";
  if (node.type === "hardBreak") return "\n";
  if (node.type === "text") return node.text ?? "";
  if (node.type === "documentMedia") return documentMediaToMarkdown(node.attrs?.block);
  return (node.content ?? []).map(plainText).join(["tableCell", "tableHeader", "listItem", "taskItem"].includes(node.type ?? "") ? "\n" : "");
}

function cloneContent(content: JSONContent[]) {
  return structuredClone(content);
}

export function tiptapTableCell(value: string, header: boolean, width?: number | null, fontSizePt?: RichTextFontSizePt | null, color?: RichTextColor | null, richContent?: JSONContent[] | null, column?: string | null): JSONContent {
  const textStyle = { ...(fontSizePt ? { fontSize: `${fontSizePt}pt` } : {}), ...(color === "risk" ? { color: RICH_TEXT_RISK_COLOR_HEX } : {}) };
  const marks = Object.keys(textStyle).length ? [{ type: "textStyle", attrs: textStyle }] : undefined;
  const content = value.split("\n").flatMap((line, index) => [
    ...(index ? [{ type: "hardBreak" } satisfies JSONContent] : []),
    ...(line ? [{ type: "text", text: line, marks } satisfies JSONContent] : []),
  ]);
  return {
    type: header ? "tableHeader" : "tableCell",
    attrs: width || column ? { ...(width ? { colwidth: [Math.round(width)] } : {}), ...(column ? { protocolColumn: column } : {}) } : undefined,
    content: richContent ? cloneContent(richContent) : value.split("\n").some(documentMediaFromMarkdown) ? value.split("\n").map(line => {
      const media = documentMediaFromMarkdown(line);
      return media ? { type: "documentMedia", attrs: { block: media } } : { type: "paragraph", content: line ? [{ type: "text", text: line, marks }] : [] };
    }) : [{ type: "paragraph", content }],
  };
}

export function tiptapTableRows(table: PersistedTiptapTable): JSONContent[] {
  const rows = table.rows.length ? table.rows : [[""]];
  const width = Math.max(1, ...rows.map((row) => row.length));
  return rows.map((row, rowIndex) => ({
    type: "tableRow",
    ...(table.rowIds?.[rowIndex] ? { attrs: { protocolRowId: table.rowIds[rowIndex] } } : {}),
    content: Array.from({ length: width }, (_, columnIndex) => { const column = rowIndex === 0 ? table.columnConditions?.[columnIndex] : null; return tiptapTableCell(row[columnIndex] ?? "", rowIndex === 0, table.columnWidths?.[columnIndex], table.cellFontSizesPt?.[rowIndex]?.[columnIndex], table.cellColors?.[rowIndex]?.[columnIndex], table.cellRichContent?.[rowIndex]?.[columnIndex], column ? `${column.dimensionId}:${column.optionId}` : null); }),
  }));
}

function needsRichPersistence(cell: JSONContent) {
  const fontSizes = new Set<string>();
  const colors = new Set<string>();
  let lossyMark = false;
  let richStructure = (cell.content?.length ?? 0) > 1;
  const visit = (node: JSONContent, isRoot = false) => {
    if (!isRoot && !["paragraph", "text", "hardBreak"].includes(node.type ?? "")) richStructure = true;
    if (["textAlign", "documentIndent", "spaceBeforePt", "spaceAfterPt", "documentLineHeight"].some(key => node.attrs?.[key] != null)) richStructure = true;
    if (node.type === "text") {
      const textStyle = node.marks?.find((mark) => mark.type === "textStyle");
      fontSizes.add(textStyle?.attrs?.fontSize === undefined ? "default" : String(textStyle.attrs.fontSize));
      colors.add(textStyle?.attrs?.color === undefined ? "default" : String(textStyle.attrs.color));
    }
    for (const mark of node.marks ?? []) {
      if (mark.type !== "textStyle" || mark.attrs?.fontFamily) lossyMark = true;
    }
    node.content?.forEach((child) => visit(child));
  };
  visit(cell, true);
  return lossyMark || richStructure || fontSizes.size > 1 || colors.size > 1;
}

function cellFontSizePt(cell: JSONContent) {
  const sizes = new Set<RichTextFontSizePt | null>();
  const visit = (node: JSONContent) => {
    if (node.type === "text") {
      const raw = node.marks?.find((mark) => mark.type === "textStyle")?.attrs?.fontSize;
      const size = parseRichTextFontSizePt(typeof raw === "string" ? String(Number.parseFloat(raw)) : raw === undefined ? undefined : String(raw));
      sizes.add(size ?? null);
    }
    node.content?.forEach(visit);
  };
  visit(cell);
  return sizes.size === 1 ? [...sizes][0] : null;
}

function cellColor(cell: JSONContent) {
  const colors = new Set<RichTextColor | null>();
  const visit = (node: JSONContent) => {
    if (node.type === "text") {
      const color = parseRichTextColor(node.marks?.find((mark) => mark.type === "textStyle")?.attrs?.color);
      colors.add(color ?? null);
    }
    node.content?.forEach(visit);
  };
  visit(cell);
  return colors.size === 1 ? [...colors][0] : null;
}

export function persistedTableFromTiptap(node: JSONContent): PersistedTiptapTable {
  const rows = (node.content ?? []).map((row) => (row.content ?? []).map((cell) => plainText(cell)));
  const columnWidths = (node.content?.[0]?.content ?? []).map((cell) => {
    const value = Array.isArray(cell.attrs?.colwidth) ? Number(cell.attrs.colwidth[0]) : NaN;
    return Number.isFinite(value) && value > 0 ? value : null;
  });
  const cellFontSizesPt = (node.content ?? []).map((row) => (row.content ?? []).map(cellFontSizePt));
  const cellColors = (node.content ?? []).map((row) => (row.content ?? []).map(cellColor));
  const cellRichContent = (node.content ?? []).map((row) => (row.content ?? []).map((cell) => needsRichPersistence(cell) ? cloneContent(cell.content ?? []) : null));
  const columnConditions = (node.content?.[0]?.content ?? []).map((cell) => { const [dimensionId, optionId] = typeof cell.attrs?.protocolColumn === "string" ? cell.attrs.protocolColumn.split(":") : []; return dimensionId && optionId ? { dimensionId, optionId } : null; });
  return {
    rows,
    ...((node.content ?? []).some(row => row.attrs?.protocolRowId) ? { rowIds: (node.content ?? []).map(row => String(row.attrs?.protocolRowId ?? `row-${globalThis.crypto.randomUUID()}`)) } : {}),
    columnWidths: columnWidths.some((value) => value !== null) ? columnWidths : undefined,
    cellFontSizesPt: cellFontSizesPt.some((row) => row.some((value) => value !== null)) ? cellFontSizesPt : undefined,
    cellColors: cellColors.some((row) => row.some((value) => value !== null)) ? cellColors : undefined,
    cellRichContent: cellRichContent.some((row) => row.some((value) => value !== null)) ? cellRichContent : undefined,
    columnConditions: columnConditions.some(Boolean) ? columnConditions : undefined,
  };
}
