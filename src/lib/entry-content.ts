import { stripLabNestFontFamilyMarkup } from "./rich-text-font-family";
import { stripLabNestFontSizeMarkup } from "./rich-text-font-size";
import { stripLabNestLineHeightMarkup } from "./rich-text-line-height";

export const ENTRY_CONTENT_SCHEMA_VERSION = 1;
export const ENTRY_MARKDOWN_FORMAT = "labnest-markdown-v1";

export type EntryTextContentBlock = {
  id: string;
  type: "text";
  order: number;
  format: typeof ENTRY_MARKDOWN_FORMAT;
  markdown: string;
};

export type EntryAttachmentContentBlock = {
  id: string;
  type: "image" | "file";
  order: number;
  attachmentId: string;
  originalFilename: string;
  mimeType: string;
  size: number;
};

export type EntryContentBlock = EntryTextContentBlock | EntryAttachmentContentBlock;

export type EntryContentDocument = {
  schemaVersion: typeof ENTRY_CONTENT_SCHEMA_VERSION;
  blocks: EntryContentBlock[];
};

export type EntryContentAttachment = {
  id: string;
  originalFilename: string;
  mimeType: string;
  size: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseEntryContent(value: unknown): EntryContentDocument | undefined {
  if (!isRecord(value) || value.schemaVersion !== ENTRY_CONTENT_SCHEMA_VERSION || !Array.isArray(value.blocks)) {
    return undefined;
  }

  const blocks: EntryContentBlock[] = [];
  for (const candidate of value.blocks) {
    if (!isRecord(candidate) || typeof candidate.id !== "string" || typeof candidate.order !== "number") continue;

    if (
      candidate.type === "text" &&
      candidate.format === ENTRY_MARKDOWN_FORMAT &&
      typeof candidate.markdown === "string"
    ) {
      blocks.push({
        id: candidate.id,
        type: "text",
        order: candidate.order,
        format: ENTRY_MARKDOWN_FORMAT,
        markdown: candidate.markdown,
      });
      continue;
    }

    if (
      (candidate.type === "image" || candidate.type === "file") &&
      typeof candidate.attachmentId === "string" &&
      typeof candidate.originalFilename === "string" &&
      typeof candidate.mimeType === "string" &&
      typeof candidate.size === "number"
    ) {
      blocks.push({
        id: candidate.id,
        type: candidate.type,
        order: candidate.order,
        attachmentId: candidate.attachmentId,
        originalFilename: candidate.originalFilename,
        mimeType: candidate.mimeType,
        size: candidate.size,
      });
    }
  }

  return { schemaVersion: ENTRY_CONTENT_SCHEMA_VERSION, blocks: blocks.sort((a, b) => a.order - b.order) };
}

export function buildEntryContent(markdown: string, attachments: EntryContentAttachment[]): EntryContentDocument {
  return {
    schemaVersion: ENTRY_CONTENT_SCHEMA_VERSION,
    blocks: [
      {
        id: "entry-text",
        type: "text",
        order: 0,
        format: ENTRY_MARKDOWN_FORMAT,
        markdown: markdown.trim(),
      },
      ...attachments.map<EntryAttachmentContentBlock>((attachment, index) => ({
        id: `attachment-${attachment.id}`,
        type: attachment.mimeType.startsWith("image/") ? "image" : "file",
        order: index + 1,
        attachmentId: attachment.id,
        originalFilename: attachment.originalFilename,
        mimeType: attachment.mimeType,
        size: attachment.size,
      })),
    ],
  };
}

export function getEntryMarkdown(value: unknown, fallbackBody = "") {
  const textBlock = parseEntryContent(value)?.blocks.find((block): block is EntryTextContentBlock => block.type === "text");
  return textBlock?.markdown ?? fallbackBody;
}

export function getOrderedAttachmentIds(value: unknown) {
  return (
    parseEntryContent(value)?.blocks
      .filter((block): block is EntryAttachmentContentBlock => block.type === "image" || block.type === "file")
      .map((block) => block.attachmentId) ?? []
  );
}

export function plainTextFromEntryMarkdown(markdown: string) {
  return stripLabNestFontFamilyMarkup(stripLabNestLineHeightMarkup(stripLabNestFontSizeMarkup(markdown)))
    .replace(/```[\s\S]*?```/g, (block) => block.replaceAll("```", ""))
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\((?:https?:\/\/)[^)]+\)/g, "$1")
    .replace(/^[ \t]{0,3}(?:#{1,6}|>|-\s+\[[ xX]\]\s+|[-*+]\s+|\d+\.\s+)/gm, "")
    .replace(/(\*\*|~~|\+\+|`|__)/g, "")
    .replace(/(^|\s)[*_]([^*_\n]+)[*_](?=\s|[.,;:!?)]|$)/g, "$1$2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
