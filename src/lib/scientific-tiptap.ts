import type { JSONContent } from "@tiptap/core";
import { scientificBlockHasContent } from "@/lib/cell-editor";
import { LABNEST_COLOR_TOKEN_SOURCE, parseLabNestColorToken, parseRichTextColor, RICH_TEXT_RISK_COLOR_HEX } from "@/lib/rich-text-color";
import { scientificContentBlockSchema, type ScientificContentBlock, type ScientificDocument } from "@/lib/scientific-document";
import { LABNEST_FONT_FAMILY_TOKEN_SOURCE, parseLabNestFontFamilyToken, parseRichTextFontFamily, parseRichTextFontFamilyLine, richTextFontFamilyPrefix } from "@/lib/rich-text-font-family";
import { LABNEST_FONT_SIZE_TOKEN_SOURCE, parseLabNestFontSizeToken } from "@/lib/rich-text-font-size";
import { parseRichTextLineHeightLine, richTextLineHeightPrefix } from "@/lib/rich-text-line-height";
import { persistedTableFromTiptap, tiptapTableRows } from "@/lib/tiptap-table-serialization";

type TiptapMark = NonNullable<JSONContent["marks"]>[number];

const inlinePattern = new RegExp(`(${LABNEST_FONT_SIZE_TOKEN_SOURCE}|${LABNEST_COLOR_TOKEN_SOURCE}|\\*\\*[^*\\n]+\\*\\*|~~[^~\\n]+~~|\\+\\+[^+\\n]+\\+\\+|\`[^\`\\n]+\`|\\*[^*\\n]+\\*|\\[[^\\]\\n]+\\]\\(https?:\\/\\/[^)\\n]+\\))`, "g");

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function mergeMarks(base: TiptapMark[] | undefined, mark: TiptapMark): TiptapMark[] {
  if (mark.type === "textStyle") {
    const current = base?.find((item) => item.type === "textStyle");
    return [...(base ?? []).filter((item) => item.type !== "textStyle"), {
      type: "textStyle",
      attrs: { ...(current?.attrs ?? {}), ...(mark.attrs ?? {}) },
    }];
  }
  return [...(base ?? []).filter((item) => item.type !== mark.type), mark];
}

function inlineMarkdownToTiptap(value: string, inheritedMarks?: TiptapMark[]): JSONContent[] | undefined {
  const fontParts = value.split(new RegExp(`(${LABNEST_FONT_FAMILY_TOKEN_SOURCE})`, "g")).filter(Boolean);
  if (fontParts.length > 1 || parseLabNestFontFamilyToken(fontParts[0])) {
    const nodes = fontParts.flatMap((part) => {
      const token = parseLabNestFontFamilyToken(part);
      return inlineMarkdownToTiptap(token?.content ?? part, token ? mergeMarks(inheritedMarks, { type: "textStyle", attrs: { fontFamily: token.fontFamily } }) : inheritedMarks) ?? [];
    });
    return nodes.length ? nodes : undefined;
  }
  const content = value.split(inlinePattern).filter(Boolean).flatMap((part): JSONContent[] => {
    const sized = parseLabNestFontSizeToken(part);
    if (sized) return inlineMarkdownToTiptap(sized.content, mergeMarks(inheritedMarks, { type: "textStyle", attrs: { fontSize: `${sized.size}pt` } })) ?? [];
    const colored = parseLabNestColorToken(part);
    if (colored) return inlineMarkdownToTiptap(colored.content, mergeMarks(inheritedMarks, { type: "textStyle", attrs: { color: RICH_TEXT_RISK_COLOR_HEX } })) ?? [];
    if (part.startsWith("**") && part.endsWith("**")) return inlineMarkdownToTiptap(part.slice(2, -2), mergeMarks(inheritedMarks, { type: "bold" })) ?? [];
    if (part.startsWith("~~") && part.endsWith("~~")) return inlineMarkdownToTiptap(part.slice(2, -2), mergeMarks(inheritedMarks, { type: "strike" })) ?? [];
    if (part.startsWith("++") && part.endsWith("++")) return inlineMarkdownToTiptap(part.slice(2, -2), mergeMarks(inheritedMarks, { type: "underline" })) ?? [];
    if (part.startsWith("`") && part.endsWith("`")) return [{ type: "text", text: part.slice(1, -1), marks: mergeMarks(inheritedMarks, { type: "code" }) }];
    if (part.startsWith("*") && part.endsWith("*")) return inlineMarkdownToTiptap(part.slice(1, -1), mergeMarks(inheritedMarks, { type: "italic" })) ?? [];
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (link) return inlineMarkdownToTiptap(link[1], mergeMarks(inheritedMarks, { type: "link", attrs: { href: link[2] } })) ?? [];
    return part ? [{ type: "text", text: part, marks: inheritedMarks?.length ? inheritedMarks : undefined }] : [];
  });
  return content.length ? content : undefined;
}

function legacyAttrs(blockId: string, blockType: ScientificContentBlock["type"], lineHeight?: number, fontFamily?: string) {
  return {
    scientificBlockId: blockId,
    scientificBlockType: blockType,
    documentLineHeight: lineHeight ?? null,
    scientificLineHeight: lineHeight ?? null,
    scientificFontFamily: fontFamily ?? null,
  };
}

function typographyMarks(lineHeight?: number, fontFamily?: string): TiptapMark[] | undefined {
  const attrs = {
    ...(fontFamily ? { fontFamily } : {}),
  };
  return Object.keys(attrs).length ? [{ type: "textStyle", attrs }] : undefined;
}

function listLine(value: string) {
  const height = parseRichTextLineHeightLine(value);
  const font = parseRichTextFontFamilyLine(height.content);
  const match = font.content.match(/^(\s*)(?:([-*+])\s+(?:\[([ xX])\]\s+)?|(\d+)\.\s+)(.*)$/);
  if (!match) return undefined;
  return { indent: match[1].length, type: match[3] !== undefined ? "taskList" : match[4] ? "orderedList" : "bulletList", checked: match[3]?.toLowerCase() === "x", start: Number(match[4] || 1), text: match[5], lineHeight: height.lineHeight, fontFamily: font.fontFamily };
}

function markdownToTiptap(value: string, blockId: string): JSONContent[] {
  const nodes: JSONContent[] = [];
  const lines = value.replaceAll("\r\n", "\n").split("\n");
  for (let index = 0; index < lines.length;) {
    const parsedLine = parseRichTextLineHeightLine(lines[index]);
    const parsedFontFamily = parseRichTextFontFamilyLine(parsedLine.content);
    const line = parsedFontFamily.content;
    const attrs = legacyAttrs(blockId, "text", parsedLine.lineHeight, parsedFontFamily.fontFamily);
    const inheritedMarks = typographyMarks(parsedLine.lineHeight, parsedFontFamily.fontFamily);
    const list = listLine(lines[index]);
    if (list) {
      const items: JSONContent[] = [];
      while (index < lines.length) {
        const item = listLine(lines[index]);
        if (!item || item.type !== list.type || item.indent !== list.indent) break;
        index += 1;
        const continuation: string[] = [];
        while (index < lines.length && lines[index].trim() && (lines[index].match(/^\s*/)?.[0].length ?? 0) > list.indent) {
          continuation.push(lines[index].slice(list.indent + 2));
          index += 1;
        }
        items.push({
          type: list.type === "taskList" ? "taskItem" : "listItem",
          ...(list.type === "taskList" ? { attrs: { checked: item.checked } } : {}),
          content: [{ type: "paragraph", attrs: legacyAttrs(blockId, "text", item.lineHeight, item.fontFamily), content: inlineMarkdownToTiptap(item.text, typographyMarks(item.lineHeight, item.fontFamily)) },
            ...(continuation.length ? markdownToTiptap(continuation.join("\n"), blockId) : [])],
        });
      }
      nodes.push({ type: list.type, attrs: { ...attrs, ...(list.type === "orderedList" ? { start: list.start } : {}) }, content: items });
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (heading) nodes.push({ type: "heading", attrs: { ...attrs, level: heading[1].length === 1 ? 2 : 3 }, content: inlineMarkdownToTiptap(heading[2], inheritedMarks) });
    else if (quote) nodes.push({ type: "blockquote", attrs, content: [{ type: "paragraph", attrs, content: inlineMarkdownToTiptap(quote[1], inheritedMarks) }] });
    else nodes.push({ type: "paragraph", attrs, content: inlineMarkdownToTiptap(line, inheritedMarks) });
    index += 1;
  }
  return nodes.length ? nodes : [{ type: "paragraph", attrs: legacyAttrs(blockId, "text") }];
}

export function markdownRichTextToTiptap(value: string): JSONContent {
  return { type: "doc", content: markdownToTiptap(value, "standalone-rich-text") };
}

function tableToTiptap(block: Extract<ScientificContentBlock, { type: "table" }>): JSONContent {
  return {
    type: "table",
    attrs: { ...legacyAttrs(block.id, "table"), scientificCaption: block.caption ?? "" },
    content: tiptapTableRows(block),
  };
}

function blockToTiptap(block: ScientificContentBlock): JSONContent[] {
  if (block.type === "text") return markdownToTiptap(block.text, block.id);
  if (block.type === "heading") return [{ type: "heading", attrs: { ...legacyAttrs(block.id, "heading"), level: 3 }, content: inlineMarkdownToTiptap(block.text) }];
  if (block.type === "checklist") return [{
    type: "taskList",
    attrs: legacyAttrs(block.id, "checklist"),
    content: (block.items.length ? block.items : [""]).map((item) => ({ type: "taskItem", attrs: { checked: false }, content: [{ type: "paragraph", content: inlineMarkdownToTiptap(item) }] })),
  }];
  if (block.type === "table") return [tableToTiptap(block)];
  return [{ type: "scientificWidget", attrs: { block } }];
}

export function scientificDocumentToTiptap(document: ScientificDocument, hiddenSectionKeys: string[] = []): JSONContent {
  return {
    type: "doc",
    content: document.sections.filter((section) => !hiddenSectionKeys.includes(section.key)).map((section) => ({
      type: "scientificSection",
      attrs: { sectionKey: section.key, sectionTitle: section.title },
      content: section.blocks.length ? section.blocks.flatMap(blockToTiptap) : [{ type: "paragraph", attrs: legacyAttrs(uniqueId(section.key), "text") }],
    })),
  };
}

function plainText(node: JSONContent | undefined): string {
  if (!node) return "";
  if (node.type === "hardBreak") return "\n";
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map(plainText).join("");
}

function inlineTiptapToMarkdown(content: JSONContent[] | undefined): string {
  return (content ?? []).map((node) => {
    if (node.type === "hardBreak") return "\n";
    if (node.type !== "text") return inlineTiptapToMarkdown(node.content);
    let value = node.text ?? "";
    const marks = node.marks ?? [];
    if (marks.some((mark) => mark.type === "code")) value = `\`${value}\``;
    if (marks.some((mark) => mark.type === "italic")) value = `*${value}*`;
    if (marks.some((mark) => mark.type === "underline")) value = `++${value}++`;
    if (marks.some((mark) => mark.type === "strike")) value = `~~${value}~~`;
    if (marks.some((mark) => mark.type === "bold")) value = `**${value}**`;
    const link = marks.find((mark) => mark.type === "link")?.attrs?.href;
    if (typeof link === "string" && /^https?:\/\//i.test(link)) value = `[${value}](${link})`;
    const textStyle = marks.find((mark) => mark.type === "textStyle");
    const fontSize = textStyle?.attrs?.fontSize;
    if (typeof fontSize === "string" && [8, 9, 10, 11, 12, 14].includes(Number.parseFloat(fontSize))) value = `<span data-labnest-size="${Number.parseFloat(fontSize)}">${value}</span>`;
    if (parseRichTextColor(textStyle?.attrs?.color) === "risk") value = `<mark data-labnest-color="risk">${value}</mark>`;
    const fontFamily = parseRichTextFontFamily(textStyle?.attrs?.fontFamily);
    if (fontFamily) value = `<font data-labnest-family="${fontFamily}">${value}</font>`;
    return value;
  }).join("");
}

function typographyPrefix(node: JSONContent) {
  const textStyle = node.content?.flatMap((item) => item.marks ?? []).find((mark) => mark.type === "textStyle");
  const lineHeightValue = node.attrs?.documentLineHeight ?? node.attrs?.scientificLineHeight ?? textStyle?.attrs?.lineHeight;
  const lineHeight = [1, 1.15, 1.3, 1.5, 1.6, 2].includes(Number(lineHeightValue)) ? Number(lineHeightValue) as 1 | 1.15 | 1.3 | 1.5 | 1.6 | 2 : undefined;
  // Paragraph-level families are a legacy compatibility path. New edits are
  // persisted as inline marks so mixed-font paragraphs round-trip exactly.
  const fontValue = node.attrs?.scientificFontFamily;
  const fontFamily = parseRichTextFontFamily(fontValue);
  return `${richTextLineHeightPrefix(lineHeight)}${richTextFontFamilyPrefix(fontFamily)}`;
}

function tiptapNodesToMarkdown(nodes: JSONContent[]): string {
  const lines: string[] = [];
  for (const node of nodes) {
    if (node.type === "bulletList" || node.type === "orderedList" || node.type === "taskList") {
      (node.content ?? []).forEach((item, index) => {
        const paragraph = item.content?.[0];
        const marker = node.type === "taskList" ? `- [${item.attrs?.checked ? "x" : " "}] ` : node.type === "orderedList" ? `${Number(node.attrs?.start ?? 1) + index}. ` : "- ";
        lines.push(`${paragraph ? typographyPrefix(paragraph) : ""}${marker}${inlineTiptapToMarkdown(paragraph?.content)}`);
        const rest = tiptapNodesToMarkdown(item.content?.slice(1) ?? []);
        if (rest) lines.push(...rest.split("\n").map((line) => `  ${line}`));
      });
    } else if (node.type === "heading") lines.push(`${typographyPrefix(node)}${Number(node.attrs?.level) === 2 ? "#" : "##"} ${inlineTiptapToMarkdown(node.content)}`);
    else if (node.type === "blockquote") {
      const paragraph = node.content?.find((child) => child.type === "paragraph") ?? node;
      lines.push(`${typographyPrefix(node)}> ${inlineTiptapToMarkdown(paragraph.content)}`);
    } else lines.push(`${typographyPrefix(node)}${inlineTiptapToMarkdown(node.content)}`);
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function tiptapToMarkdownRichText(json: JSONContent): string {
  return tiptapNodesToMarkdown(json.content ?? []);
}

function safeWidget(node: JSONContent) {
  const parsed = scientificContentBlockSchema.safeParse(node.attrs?.block);
  return parsed.success ? parsed.data : undefined;
}

function identity(node: JSONContent) {
  return {
    id: typeof node.attrs?.scientificBlockId === "string" ? node.attrs.scientificBlockId : undefined,
    type: typeof node.attrs?.scientificBlockType === "string" ? node.attrs.scientificBlockType : undefined,
  };
}

function sectionBlocks(section: JSONContent): ScientificContentBlock[] {
  const blocks: ScientificContentBlock[] = [];
  const content = section.content ?? [];
  for (let index = 0; index < content.length;) {
    const node = content[index];
    if (node.type === "scientificWidget") {
      const block = safeWidget(node);
      if (block) blocks.push(block);
      index += 1;
      continue;
    }
    const nodeIdentity = identity(node);
    if (node.type === "table") {
      blocks.push({ id: nodeIdentity.id ?? uniqueId("table"), type: "table", caption: node.attrs?.scientificCaption ?? "", ...persistedTableFromTiptap(node) });
      index += 1;
      continue;
    }
    if (node.type === "taskList" && nodeIdentity.type === "checklist") {
      blocks.push({ id: nodeIdentity.id ?? uniqueId("checklist"), type: "checklist", items: (node.content ?? []).map(plainText) });
      index += 1;
      continue;
    }
    if (node.type === "heading" && (nodeIdentity.type === "heading" || !nodeIdentity.id)) {
      blocks.push({ id: nodeIdentity.id ?? uniqueId("heading"), type: "heading", text: plainText(node) });
      index += 1;
      continue;
    }
    const groupId = nodeIdentity.id;
    const nodes: JSONContent[] = [];
    while (content[index] && !["scientificWidget", "table"].includes(content[index].type ?? "")) {
      const currentIdentity = identity(content[index]);
      if (nodes.length && (currentIdentity.id !== groupId || (content[index].type === "heading" && !currentIdentity.id))) break;
      if (!groupId && nodes.length && content[index].type === "heading") break;
      nodes.push(content[index]);
      index += 1;
      if (!groupId && content[index]?.type === "scientificWidget") break;
    }
    if (nodes.length) blocks.push({ id: groupId ?? uniqueId("text"), type: "text", text: tiptapNodesToMarkdown(nodes) });
    else index += 1;
  }
  return blocks.filter(scientificBlockHasContent);
}

export function tiptapToScientificDocument(json: JSONContent, original: ScientificDocument): ScientificDocument {
  const editedSections = new Map<string, ScientificContentBlock[]>();
  for (const node of json.content ?? []) {
    if (node.type !== "scientificSection" || typeof node.attrs?.sectionKey !== "string") continue;
    editedSections.set(node.attrs.sectionKey, sectionBlocks(node));
  }
  return {
    schemaVersion: 1,
    sections: original.sections.map((section) => editedSections.has(section.key) ? { ...section, blocks: editedSections.get(section.key) ?? [] } : section),
  };
}
