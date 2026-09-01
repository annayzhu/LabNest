import type { JSONContent } from "@tiptap/core";
import { parseRichTextFontSizePt, type RichTextFontSizePt } from "@/lib/rich-text-font-size";
import { parseRichTextColor, RICH_TEXT_RISK_COLOR_HEX, type RichTextColor } from "@/lib/rich-text-color";

export type PersistedTiptapTable = {
  rows: string[][];
  columnWidths?: Array<number | null>;
  cellFontSizesPt?: Array<Array<RichTextFontSizePt | null>>;
  cellColors?: Array<Array<RichTextColor | null>>;
};

function plainText(node: JSONContent | undefined): string {
  if (!node) return "";
  if (node.type === "hardBreak") return "\n";
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map(plainText).join("");
}

export function tiptapTableCell(value: string, header: boolean, width?: number | null, fontSizePt?: RichTextFontSizePt | null, color?: RichTextColor | null): JSONContent {
  const textStyle = { ...(fontSizePt ? { fontSize: `${fontSizePt}pt` } : {}), ...(color === "risk" ? { color: RICH_TEXT_RISK_COLOR_HEX } : {}) };
  const marks = Object.keys(textStyle).length ? [{ type: "textStyle", attrs: textStyle }] : undefined;
  const content = value.split("\n").flatMap((line, index) => [
    ...(index ? [{ type: "hardBreak" } satisfies JSONContent] : []),
    ...(line ? [{ type: "text", text: line, marks } satisfies JSONContent] : []),
  ]);
  return {
    type: header ? "tableHeader" : "tableCell",
    attrs: width ? { colwidth: [Math.round(width)] } : undefined,
    content: [{ type: "paragraph", content }],
  };
}

export function tiptapTableRows(table: PersistedTiptapTable): JSONContent[] {
  const rows = table.rows.length ? table.rows : [[""]];
  const width = Math.max(1, ...rows.map((row) => row.length));
  return rows.map((row, rowIndex) => ({
    type: "tableRow",
    content: Array.from({ length: width }, (_, columnIndex) => tiptapTableCell(row[columnIndex] ?? "", rowIndex === 0, table.columnWidths?.[columnIndex], table.cellFontSizesPt?.[rowIndex]?.[columnIndex], table.cellColors?.[rowIndex]?.[columnIndex])),
  }));
}

function cellFontSizePt(cell: JSONContent) {
  const sizes = new Set<RichTextFontSizePt>();
  const visit = (node: JSONContent) => {
    if (node.type === "text") {
      const raw = node.marks?.find((mark) => mark.type === "textStyle")?.attrs?.fontSize;
      const size = parseRichTextFontSizePt(typeof raw === "string" ? String(Number.parseFloat(raw)) : raw === undefined ? undefined : String(raw));
      if (size !== undefined) sizes.add(size);
    }
    node.content?.forEach(visit);
  };
  visit(cell);
  return sizes.size === 1 ? [...sizes][0] : null;
}

function cellColor(cell: JSONContent) {
  const colors = new Set<RichTextColor>();
  const visit = (node: JSONContent) => {
    if (node.type === "text") {
      const color = parseRichTextColor(node.marks?.find((mark) => mark.type === "textStyle")?.attrs?.color);
      if (color) colors.add(color);
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
  return {
    rows,
    columnWidths: columnWidths.some((value) => value !== null) ? columnWidths : undefined,
    cellFontSizesPt: cellFontSizesPt.some((row) => row.some((value) => value !== null)) ? cellFontSizesPt : undefined,
    cellColors: cellColors.some((row) => row.some((value) => value !== null)) ? cellColors : undefined,
  };
}
