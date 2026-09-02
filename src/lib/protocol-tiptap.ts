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
import { isRichTextFontSizePt } from "@/lib/rich-text-font-size";
import { parseRichTextFontFamily } from "@/lib/rich-text-font-family";
import { persistedTableFromTiptap, tiptapTableRows } from "@/lib/tiptap-table-serialization";

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

function tableToTiptap(block: Extract<ProtocolContentBlock, { type: "table" }>): JSONContent {
  return {
    type: "table",
    attrs: {
      ...legacyAttrs(block.id, "table"),
      protocolCaption: block.caption ?? "",
    },
    content: tiptapTableRows(block),
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
      const rawContent = section?.blocks.flatMap(blockToTiptap) ?? [];
      const firstBlock = section?.blocks[0];
      // The original empty template placeholder has a stable id. Remove only
      // that placeholder once real content follows; intentional blank content
      // must survive a schema round trip.
      const isTemplatePlaceholder = firstBlock?.id === `${sectionKey}-rich-1`;
      const content = rawContent.length > 1 && isTemplatePlaceholder && rawContent[0]?.type === "paragraph" && !plainText(rawContent[0])
        ? rawContent.slice(1)
        : rawContent;
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
  return isRichTextFontSizePt(parsed) ? parsed : undefined;
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
    lineHeight: [1, 1.15, 1.3, 1.5, 1.6, 2].includes(Number(lineHeight)) ? Number(lineHeight) as ProtocolRichTextNode["lineHeight"] : undefined,
    fontFamily: parseRichTextFontFamily(fontFamily),
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
      blocks.push({ id: identity.id, type: "table", caption: node.attrs?.protocolCaption ?? "", ...persistedTableFromTiptap(node) });
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
