import { createHash } from "node:crypto";
import { collectDocumentMedia, documentMediaAttachmentId, documentMediaFromMarkdown, documentMediaSchema, documentMediaToMarkdown } from "./document-media";
import type { DocxEmbeddedImage } from "./docx-media-import";

/**
 * A Protocol file that moves between LabNests (Q438–Q443): the JSON export, with the pictures of its documents written
 * into the same file. The importing LabNest gives every Protocol its own code and keeps its own copies of the pictures.
 */
export const PROTOCOL_TRANSFER_VERSION = 1;
export const PROTOCOL_EXPORT_SCHEMA = "labnest.structured-export/v1";
/** The import's upload limit; a file larger than this could not be imported anywhere. */
export const PROTOCOL_TRANSFER_MAX_BYTES = 25 * 1024 * 1024;

export type ProtocolTransferMedia = { attachmentId: string; filename: string; mimeType: string; sha256: string; base64: string };
export type ProtocolTransferInfo = { version: number; exportedAt?: string };

export const transferImageKey = (attachmentId: string) => `transfer:${attachmentId}`;

/** The managed files a document's pictures and attachments point to. */
export function documentAttachmentIds(document: unknown): string[] {
  return [...new Set(collectDocumentMedia(document).flatMap((block) => {
    const id = block.importImageKey ? undefined : documentMediaAttachmentId(block);
    return id ? [id] : [];
  }))];
}

export function protocolTransferEnvelope(records: Record<string, unknown>[], media: ProtocolTransferMedia[], exportedAt = new Date().toISOString()) {
  return { schemaVersion: PROTOCOL_EXPORT_SCHEMA, module: "protocols", protocolTransferVersion: PROTOCOL_TRANSFER_VERSION, exportedAt, records, media };
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

/**
 * What a JSON root says about being a LabNest Protocol export, with the pictures it carries. `undefined` for a JSON file
 * written by hand or from the template: that one is imported as before, against this LabNest's own Projects.
 */
export function readProtocolTransfer(root: unknown): { info: ProtocolTransferInfo; images: DocxEmbeddedImage[] } | undefined {
  const envelope = object(root);
  if (!envelope || typeof envelope.schemaVersion !== "string" || !envelope.schemaVersion.startsWith("labnest.structured-export/")) return undefined;
  if (envelope.module !== undefined && envelope.module !== "protocols") throw new Error("This export file holds another kind of record, not Protocols.");
  // An export written before pictures travelled with the file has no version; it reads as version 0.
  const version = envelope.protocolTransferVersion === undefined ? 0 : Number(envelope.protocolTransferVersion);
  if (!Number.isInteger(version) || version < 0) throw new Error("The Protocol file’s format version cannot be read.");
  if (envelope.schemaVersion !== PROTOCOL_EXPORT_SCHEMA || version > PROTOCOL_TRANSFER_VERSION) throw new Error("This file was exported by a newer LabNest. Update this LabNest, then import it again.");
  const listed = envelope.media === undefined ? [] : envelope.media;
  if (!Array.isArray(listed)) throw new Error("The pictures in this Protocol file cannot be read. Export it again.");
  const seen = new Set<string>();
  const images = listed.map((entry): DocxEmbeddedImage => {
    const item = object(entry);
    const attachmentId = typeof item?.attachmentId === "string" ? item.attachmentId : "";
    const base64 = typeof item?.base64 === "string" ? item.base64 : "";
    if (!attachmentId || seen.has(attachmentId) || !base64 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new Error("The pictures in this Protocol file cannot be read. Export it again.");
    seen.add(attachmentId);
    const bytes = Buffer.from(base64, "base64");
    if (!bytes.length || (typeof item?.sha256 === "string" && item.sha256 && createHash("sha256").update(bytes).digest("hex") !== item.sha256)) throw new Error("A picture in this Protocol file is damaged. Export it again.");
    return {
      key: transferImageKey(attachmentId),
      sourceAttachmentId: attachmentId,
      filename: typeof item?.filename === "string" && item.filename.trim() ? item.filename : "attachment",
      mimeType: typeof item?.mimeType === "string" && item.mimeType ? item.mimeType : "application/octet-stream",
      bytes: new Uint8Array(bytes),
    };
  });
  return { info: { version, ...(typeof envelope.exportedAt === "string" ? { exportedAt: envelope.exportedAt } : {}) }, images };
}

// The page of one record or stored file of the LabNest the text was written in: `/samples/<id>`, `/inventory/products/<id>`,
// `/experiments/<id>/run`. Only these are links to something the other LabNest does not have; any other text is left alone,
// and so is a page every LabNest has (`/inventory/list`, `/protocols/new`).
const RECORD_PATH = "\\/(?:samples|inventory(?:\\/products)?|projects|research-plans|protocols|experiments|results|reports|attachments|api\\/attachments)\\/(?!(?:new|list|import|export|products|types|locations|design)(?![A-Za-z0-9_-]))[A-Za-z0-9_-]+(?:[/?#][^)\\s]*)?";
const isRecordPage = (href: unknown): href is string => typeof href === "string" && new RegExp(`^${RECORD_PATH}$`).test(href.trim());
const recordMarkdownLink = new RegExp(`(?<!!)\\[([^\\]\\n]+)\\]\\(${RECORD_PATH}\\)`, "g");
const isCode = (node: Record<string, unknown>) => node.code === true || node.type === "codeBlock" || (Array.isArray(node.marks) && node.marks.some((mark) => object(mark)?.type === "code"));

/**
 * A document as it arrives in another LabNest. Its pictures point to the copies in the file, to be stored here. Tags and
 * links that open a record of the LabNest it came from (a sample, a stock item, an Experiment) keep the text written at
 * the time and lose the link, since that record is not here (Q442). Nothing else changes; text marked as code is never read
 * as a link.
 */
export function detachFromSourceLabNest<T>(value: T, embedded: ReadonlySet<string>): { value: T; unlinked: number } {
  let unlinked = 0;
  const media = (block: Record<string, unknown>) => {
    const parsed = documentMediaSchema.safeParse(block);
    const id = parsed.success && !parsed.data.importImageKey ? documentMediaAttachmentId(parsed.data) : undefined;
    if (!id || !embedded.has(id)) return block;
    const { attachmentId: _attachmentId, ...rest } = block; void _attachmentId;
    return { ...rest, url: "", importImageKey: transferImageKey(id) };
  };
  const walk = (item: unknown): unknown => {
    if (typeof item === "string") {
      if (!item.includes("](") && !item.includes("labnest-media:")) return item;
      return item.split("\n").map((line) => {
        const block = documentMediaFromMarkdown(line);
        if (block) return documentMediaToMarkdown(documentMediaSchema.parse(media(block)));
        return line.replace(recordMarkdownLink, (_match, label: string) => { unlinked += 1; return label; });
      }).join("\n");
    }
    if (Array.isArray(item)) return item.map(walk);
    const source = object(item);
    if (!source) return item;
    if (source.type === "media") return media(source);
    if (isCode(source)) return source;
    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(source)) {
      // A rich-text run that links to a local page keeps its text only.
      if (key === "link" && typeof source.text === "string" && isRecordPage(child)) { unlinked += 1; continue; }
      if (key === "marks" && Array.isArray(child)) {
        const kept = child.filter((mark) => !(object(mark)?.type === "link" && isRecordPage(object(object(mark)?.attrs)?.href)));
        unlinked += child.length - kept.length;
        if (kept.length) next[key] = kept.map(walk);
        continue;
      }
      next[key] = walk(child);
    }
    return next;
  };
  return { value: walk(value) as T, unlinked };
}
