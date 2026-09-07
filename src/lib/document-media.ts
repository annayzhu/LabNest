import { z } from "zod";

/** Shared persisted media identity. Display dimensions never modify source files. */
export const documentMediaFields = {
  type: z.literal("media"),
  mediaType: z.enum(["image", "video", "audio", "file"]),
  url: z.string(),
  caption: z.string().optional(),
  attachmentId: z.string().min(1).optional(),
  filename: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.number().int().nonnegative().optional(),
  widthPercent: z.number().finite().min(10).max(100).optional(),
  // Transient editor state: every server save must reject unresolved uploads.
  pendingUploadId: z.string().uuid().optional(),
  importImageKey: z.string().optional(),
};

export const documentMediaSchema = z.object({ id: z.string().min(1), ...documentMediaFields });
export type DocumentMedia = z.infer<typeof documentMediaSchema>;

export function documentMediaAttachmentId(block: DocumentMedia): string | undefined {
  if (block.attachmentId) return block.attachmentId;
  // Only local, exact attachment routes are known identities. Never trust a foreign host.
  return block.url.match(/^\/api\/attachments\/([a-zA-Z0-9_-]+)(?:\?[^#]*)?$/)?.[1];
}

export function documentMediaUrl(block: DocumentMedia, preview = false): string | undefined {
  const id = documentMediaAttachmentId(block);
  if (id) return preview ? `/api/attachments/${encodeURIComponent(id)}?inline=1` : `/attachments/${encodeURIComponent(id)}`;
  const url = block.url.trim();
  return /^(https?:\/\/|\/(?!\/))/i.test(url) ? url : undefined;
}

/** The readable link survives outside LabNest; the annotation preserves display metadata. */
export function documentMediaToMarkdown(block: DocumentMedia): string {
  const name = (block.filename || block.caption || block.mediaType).replace(/[\[\]\r\n]/g, " ");
  const target = block.attachmentId ? `attachment:${encodeURIComponent(block.attachmentId)}` : block.url;
  return `${block.mediaType === "image" ? "!" : ""}[${name}](${target}) <!--labnest-media:${encodeURIComponent(JSON.stringify(block))}-->`;
}

export function documentMediaFromMarkdown(line: string): DocumentMedia | undefined {
  const match = line.match(/<!--labnest-media:([^\s]+)-->\s*$/);
  if (!match) return undefined;
  try {
    const parsed = documentMediaSchema.safeParse(JSON.parse(decodeURIComponent(match[1])));
    return parsed.success ? parsed.data : undefined;
  } catch { return undefined; }
}

/** Walk persisted documents and Markdown bodies, never fetch external links. */
export function collectDocumentMedia(value: unknown): DocumentMedia[] {
  if (typeof value === "string") return value.split("\n").flatMap(line => { const media = documentMediaFromMarkdown(line); return media ? [media] : []; });
  if (Array.isArray(value)) return value.flatMap(collectDocumentMedia);
  if (!value || typeof value !== "object") return [];
  const candidate = value as Record<string, unknown>;
  if (candidate.type === "media") {
    const parsed = documentMediaSchema.safeParse(value);
    if (!parsed.success) throw new Error("附件信息不完整 / Invalid attachment reference");
    return [parsed.data];
  }
  return Object.values(candidate).flatMap(collectDocumentMedia);
}

export function assertDocumentMediaReady(value: unknown) {
  for (const block of collectDocumentMedia(value)) {
    if (block.pendingUploadId) throw new Error("附件尚未上传完成，请重试或移除后保存。 / Finish or retry attachments before saving.");
    if (block.importImageKey) throw new Error("导入图片尚未关联 / Imported image has not been associated");
    if (/^(blob:|data:)/i.test(block.url.trim())) throw new Error("不能保存临时图片地址，请上传原文件。 / Upload the original file before saving.");
  }
}
