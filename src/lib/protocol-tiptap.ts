import type { JSONContent } from "@tiptap/core";
import {
  createEmptyProtocolDocument,
  protocolContentBlockSchema,
  protocolSectionKeys,
  type ProtocolContentBlock,
  type ProtocolDocument,
  type ProtocolRichTextNode,
  type ProtocolRichTextRun,
  type ProtocolSectionKey,
} from "@/lib/protocol-document";
import { parseRichTextColor, RICH_TEXT_RISK_COLOR_HEX } from "@/lib/rich-text-color";

type TiptapMark = NonNullable<JSONContent["marks"]>[number];

const richTextNodeTypes = new Set(["paragraph", "heading", "blockquote", "bulletList", "orderedList"]);

function newBlockId(prefix = "block") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function textContent(text: string): JSONContent[] | undefined {
  if (!text) return undefined;
  const lines = text.split("\n");
  return lines.flatMap((line, index) => [
    ...(index ? [{ type: "hardBreak" } satisfies JSONContent] : []),
    ...(line ? [{ type: "text", text: line } satisfies JSONContent] : []),
  ]);
}

function marksFromRun(run: ProtocolRichTextRun): TiptapMark[] | undefined {
  const marks: TiptapMark[] = [];
  if (run.bold) marks.push({ type: "bold" });
  if (run.italic) marks.push({ type: "italic" });
  if (run.underline) marks.push({ type: "underline" });
  if (run.strike) marks.push({ type: "strike" });
  if (run.code) marks.push({ type: "code" });
  if (run.link) marks.push({ type: "link", attrs: { href: run.link } });
  const textStyle = {
    ...(run.fontSizePt ? { fontSize: `${run.fontSizePt}pt` } : {}),
    ...(run.color === "risk" ? { color: RICH_TEXT_RISK_COLOR_HEX } : {}),
  };
  if (Object.keys(textStyle).length) marks.push({ type: "textStyle", attrs: textStyle });
  return marks.length ? marks : undefined;
}

function inlineContentFromRuns(runs: ProtocolRichTextRun[]): JSONContent[] | undefined {
  const content = runs.flatMap((run) => {
    if (!run.text) return [];
    const lines = run.text.split("\n");
    return lines.flatMap((line, index) => [
      ...(index ? [{ type: "hardBreak" } satisfies JSONContent] : []),
      ...(line ? [{ type: "text", text: line, marks: marksFromRun(run) } satisfies JSONContent] : []),
    ]);
  });
  return content.length ? content : undefined;
}

function legacyAttrs(blockId: string, blockType: ProtocolContentBlock["type"], node?: ProtocolRichTextNode) {
  return {
    protocolBlockId: blockId,
    protocolBlockType: blockType,
    protocolLineHeight: node?.lineHeight ?? null,
    protocolFontFamily: node?.fontFamily ?? null,
  };
}

function richNodeToTiptap(node: ProtocolRichTextNode, blockId: string): JSONContent {
  const attrs = legacyAttrs(blockId, "rich_text", node);
  const content = inlineContentFromRuns(node.content);
  if (node.type === "heading2") return { type: "heading", attrs: { ...attrs, level: 2 }, content };
  if (node.type === "heading3") return { type: "heading", attrs: { ...attrs, level: 3 }, content };
  if (node.type === "quote") return {
    type: "blockquote",
    attrs,
    content: [{ type: "paragraph", attrs, content }],
  };
  return { type: "paragraph", attrs, content };
}

function richNodesToTiptap(nodes: ProtocolRichTextNode[], blockId: string): JSONContent[] {
  const content: JSONContent[] = [];
  for (let index = 0; index < nodes.length;) {
    const node = nodes[index];
    if (node.type !== "bullet" && node.type !== "numbered") {
      content.push(richNodeToTiptap(node, blockId));
      index += 1;
      continue;
    }
    const listType = node.type;
    const items: JSONContent[] = [];
    while (nodes[index]?.type === listType) {
      const item = nodes[index];
      const attrs = legacyAttrs(blockId, "rich_text", item);
      items.push({
        type: "listItem",
        content: [{ type: "paragraph", attrs, content: inlineContentFromRuns(item.content) }],
      });
      index += 1;
    }
    content.push({
      type: listType === "bullet" ? "bulletList" : "orderedList",
      attrs: legacyAttrs(blockId, "rich_text", node),
      content: items,
    });
  }
  return content.length ? content : [{ type: "paragraph", attrs: legacyAttrs(blockId, "rich_text") }];
}

export function protocolRichTextToTiptap(nodes: ProtocolRichTextNode[]): JSONContent {
  return { type: "doc", content: richNodesToTiptap(nodes, "standalone-protocol-rich-text") };
}

function tableCell(text: string, header: boolean, width?: number | null, fontSizePt?: number | null): JSONContent {
  const marks = fontSizePt ? [{ type: "textStyle", attrs: { fontSize: `${fontSizePt}pt` } }] : undefined;
  const content = text.split("\n").flatMap((line, index) => [
    ...(index ? [{ type: "hardBreak" } satisfies JSONContent] : []),
    ...(line ? [{ type: "text", text: line, marks } satisfies JSONContent] : []),
  ]);
  return {
    type: header ? "tableHeader" : "tableCell",
    attrs: width ? { colwidth: [Math.round(width)] } : undefined,
    content: [{ type: "paragraph", content }],
  };
}

function tableToTiptap(block: Extract<ProtocolContentBlock, { type: "table" }>): JSONContent {
  const width = Math.max(1, ...block.rows.map((row) => row.length));
  const rows = block.rows.length ? block.rows : [[""]];
  return {
    type: "table",
    attrs: {
      ...legacyAttrs(block.id, "table"),
      protocolCaption: block.caption ?? "",
    },
    content: rows.map((row, rowIndex) => ({
      type: "tableRow",
      content: Array.from({ length: width }, (_, columnIndex) => tableCell(row[columnIndex] ?? "", rowIndex === 0, block.columnWidths?.[columnIndex], block.cellFontSizesPt?.[rowIndex]?.[columnIndex])),
    })),
  };
}

function blockToTiptap(block: ProtocolContentBlock): JSONContent[] {
  if (block.type === "rich_text") return richNodesToTiptap(block.nodes, block.id);
  if (block.type === "heading") return [{
    type: "heading",
    attrs: { ...legacyAttrs(block.id, "heading"), level: 3 },
    content: textContent(block.text),
  }];
  if (block.type === "text") return block.text.split(/\r?\n/).map((text) => ({
    type: "paragraph",
    attrs: legacyAttrs(block.id, "text"),
    content: textContent(text),
  }));
  if (block.type === "checklist") return [{
    type: "taskList",
    attrs: legacyAttrs(block.id, "checklist"),
    content: (block.items.length ? block.items : [""]).map((item) => ({
      type: "taskItem",
      attrs: { checked: false },
      content: [{ type: "paragraph", content: textContent(item) }],
    })),
  }];
  if (block.type === "table" && !block.resultTemplate) return [tableToTiptap(block)];
  return [{ type: "protocolWidget", attrs: { block } }];
}

export function protocolDocumentToTiptap(document: ProtocolDocument): JSONContent {
  return {
    type: "doc",
    content: protocolSectionKeys.map((sectionKey) => {
      const section = document.sections.find((item) => item.key === sectionKey);
      const content = section?.blocks.flatMap(blockToTiptap) ?? [];
      return {
        type: "protocolSection",
        attrs: { sectionKey },
        content: content.length ? content : [{
          type: "paragraph",
          attrs: legacyAttrs(newBlockId(sectionKey), "rich_text"),
        }],
      } satisfies JSONContent;
    }),
  };
}

function plainText(node: JSONContent | undefined): string {
  if (!node) return "";
  if (node.type === "hardBreak") return "\n";
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map(plainText).join("");
}

function fontSizeFromMark(mark: TiptapMark | undefined): ProtocolRichTextRun["fontSizePt"] {
  const value = mark?.attrs?.fontSize;
  const parsed = typeof value === "string" ? Number.parseFloat(value) : Number.NaN;
  return [8, 9, 10, 11, 12, 14].includes(parsed) ? parsed as ProtocolRichTextRun["fontSizePt"] : undefined;
}

function runsFromInlineContent(content: JSONContent[] | undefined): ProtocolRichTextRun[] {
  const runs: ProtocolRichTextRun[] = [];
  const append = (run: ProtocolRichTextRun) => {
    const previous = runs.at(-1);
    if (previous && JSON.stringify({ ...previous, text: "" }) === JSON.stringify({ ...run, text: "" })) previous.text += run.text;
    else runs.push(run);
  };
  const visit = (node: JSONContent) => {
    if (node.type === "hardBreak") {
      append({ text: "\n" });
      return;
    }
    if (node.type === "text") {
      const marks = node.marks ?? [];
      const link = marks.find((mark) => mark.type === "link")?.attrs?.href;
      const textStyle = marks.find((mark) => mark.type === "textStyle");
      append({
        text: node.text ?? "",
        bold: marks.some((mark) => mark.type === "bold") || undefined,
        italic: marks.some((mark) => mark.type === "italic") || undefined,
        underline: marks.some((mark) => mark.type === "underline") || undefined,
        strike: marks.some((mark) => mark.type === "strike") || undefined,
        code: marks.some((mark) => mark.type === "code") || undefined,
        link: typeof link === "string" ? link : undefined,
        color: parseRichTextColor(textStyle?.attrs?.color),
        fontSizePt: fontSizeFromMark(textStyle),
      });
      return;
    }
    node.content?.forEach(visit);
  };
  content?.forEach(visit);
  return runs.length ? runs : [{ text: "" }];
}

function nodeTypography(node: JSONContent) {
  const textStyle = node.content?.flatMap((item) => item.marks ?? []).find((mark) => mark.type === "textStyle");
  const lineHeight = node.attrs?.protocolLineHeight ?? textStyle?.attrs?.lineHeight;
  const fontFamily = node.attrs?.protocolFontFamily ?? textStyle?.attrs?.fontFamily;
  return {
    lineHeight: [1, 1.15, 1.3, 1.5, 2].includes(Number(lineHeight)) ? Number(lineHeight) as ProtocolRichTextNode["lineHeight"] : undefined,
    fontFamily: ["sans", "serif", "mono"].includes(fontFamily) ? fontFamily as ProtocolRichTextNode["fontFamily"] : undefined,
  };
}

function listItemParagraph(item: JSONContent): JSONContent {
  return item.content?.find((node) => node.type === "paragraph") ?? { type: "paragraph" };
}

function tiptapNodeToRichNodes(node: JSONContent): ProtocolRichTextNode[] {
  if (node.type === "bulletList" || node.type === "orderedList") {
    return (node.content ?? []).map((item) => {
      const paragraph = listItemParagraph(item);
      return {
        type: node.type === "bulletList" ? "bullet" as const : "numbered" as const,
        content: runsFromInlineContent(paragraph.content),
        ...nodeTypography(paragraph),
      };
    });
  }
  if (node.type === "blockquote") {
    const paragraph = node.content?.find((item) => item.type === "paragraph") ?? node;
    return [{ type: "quote", content: runsFromInlineContent(paragraph.content), ...nodeTypography(node) }];
  }
  if (node.type === "heading") {
    return [{
      type: Number(node.attrs?.level) === 2 ? "heading2" : "heading3",
      content: runsFromInlineContent(node.content),
      ...nodeTypography(node),
    }];
  }
  if (node.type === "horizontalRule") return [{ type: "paragraph", content: [{ text: "---" }] }];
  return [{ type: "paragraph", content: runsFromInlineContent(node.content), ...nodeTypography(node) }];
}

export function tiptapToProtocolRichText(json: JSONContent): ProtocolRichTextNode[] {
  return (json.content ?? []).flatMap(tiptapNodeToRichNodes);
}

function rowsFromTable(node: JSONContent): string[][] {
  return (node.content ?? []).map((row) => (row.content ?? []).map((cell) => plainText(cell)));
}

function tableColumnWidths(node: JSONContent) {
  const widths = (node.content?.[0]?.content ?? []).map((cell) => {
    const value = Array.isArray(cell.attrs?.colwidth) ? Number(cell.attrs.colwidth[0]) : NaN;
    return Number.isFinite(value) && value > 0 ? value : null;
  });
  return widths.some((value) => value !== null) ? widths : undefined;
}

function cellFontSizePt(cell: JSONContent) {
  const sizes = new Set<number>();
  const visit = (node: JSONContent) => {
    if (node.type === "text") {
      const value = node.marks?.find((mark) => mark.type === "textStyle")?.attrs?.fontSize;
      const size = typeof value === "string" ? Number.parseFloat(value) : Number(value);
      if ([8, 9, 10, 11, 12, 14].includes(size)) sizes.add(size);
    }
    node.content?.forEach(visit);
  };
  visit(cell);
  return sizes.size === 1 ? [...sizes][0] as 8 | 9 | 10 | 11 | 12 | 14 : null;
}

function tableCellFontSizes(node: JSONContent) {
  const sizes = (node.content ?? []).map((row) => (row.content ?? []).map(cellFontSizePt));
  return sizes.some((row) => row.some((value) => value !== null)) ? sizes : undefined;
}

function taskItems(node: JSONContent): string[] {
  return (node.content ?? []).map((item) => plainText(item));
}

function safeWidgetBlock(node: JSONContent): ProtocolContentBlock | undefined {
  const result = protocolContentBlockSchema.safeParse(node.attrs?.block);
  return result.success ? result.data : undefined;
}

function blockIdentity(node: JSONContent) {
  return {
    id: typeof node.attrs?.protocolBlockId === "string" ? node.attrs.protocolBlockId : newBlockId("rich"),
    type: typeof node.attrs?.protocolBlockType === "string" ? node.attrs.protocolBlockType : "rich_text",
  };
}

function sectionBlocks(section: JSONContent): ProtocolContentBlock[] {
  const blocks: ProtocolContentBlock[] = [];
  const content = section.content ?? [];
  for (let index = 0; index < content.length;) {
    const node = content[index];
    if (node.type === "protocolWidget") {
      const block = safeWidgetBlock(node);
      if (block) blocks.push(block);
      index += 1;
      continue;
    }
    const identity = blockIdentity(node);
    if (node.type === "table") {
      blocks.push({ id: identity.id, type: "table", caption: node.attrs?.protocolCaption ?? "", rows: rowsFromTable(node), columnWidths: tableColumnWidths(node), cellFontSizesPt: tableCellFontSizes(node) });
      index += 1;
      continue;
    }
    if (node.type === "taskList") {
      blocks.push({ id: identity.id, type: "checklist", items: taskItems(node) });
      index += 1;
      continue;
    }
    if (identity.type === "heading" && node.type === "heading") {
      blocks.push({ id: identity.id, type: "heading", text: plainText(node) });
      index += 1;
      continue;
    }
    if (identity.type === "text") {
      const nodes: JSONContent[] = [];
      while (content[index] && blockIdentity(content[index]).id === identity.id && content[index].type === "paragraph") {
        nodes.push(content[index]);
        index += 1;
      }
      blocks.push({ id: identity.id, type: "text", text: nodes.map(plainText).join("\n") });
      continue;
    }
    const richNodes: JSONContent[] = [];
    while (content[index] && richTextNodeTypes.has(content[index].type ?? "")) {
      const nextIdentity = blockIdentity(content[index]);
      if (richNodes.length && nextIdentity.id !== identity.id) break;
      richNodes.push(content[index]);
      index += 1;
    }
    if (!richNodes.length) {
      index += 1;
      continue;
    }
    blocks.push({ id: identity.id, type: "rich_text", nodes: richNodes.flatMap(tiptapNodeToRichNodes) });
  }
  return blocks;
}

export function tiptapToProtocolDocument(json: JSONContent, importWarnings: string[] = []): ProtocolDocument {
  const empty = createEmptyProtocolDocument();
  const sections = new Map<ProtocolSectionKey, ProtocolContentBlock[]>();
  for (const node of json.content ?? []) {
    if (node.type !== "protocolSection") continue;
    const key = node.attrs?.sectionKey;
    if (protocolSectionKeys.includes(key)) sections.set(key, sectionBlocks(node));
  }
  return {
    ...empty,
    importWarnings,
    sections: empty.sections.map((section) => ({ ...section, blocks: sections.get(section.key) ?? [] })),
  };
}
