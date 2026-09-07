import type { Prisma } from "@/generated/prisma/client";
import type { DocxEmbeddedImage } from "./docx-media-import";
import { cleanupPreparedAttachmentFiles, prepareAttachmentFile, writePreparedAttachmentFiles, type PreparedAttachmentFile } from "./attachment-files";
import { documentMediaFromMarkdown, documentMediaToMarkdown } from "./document-media";

export async function withPreparedDocxImages<T>(images: DocxEmbeddedImage[], work: (files: Array<{ key: string; file: PreparedAttachmentFile }>) => Promise<T>): Promise<T> {
  const files = await Promise.all(images.map(async image => ({ key: image.key, file: await prepareAttachmentFile(new File([new Uint8Array(image.bytes).buffer], image.filename, { type: image.mimeType })) })));
  try {
    await writePreparedAttachmentFiles(files.map(item => item.file));
    return await work(files);
  } catch (error) {
    await cleanupPreparedAttachmentFiles(files.map(item => item.file));
    throw error;
  }
}

export async function createImportedMedia(tx: Prisma.TransactionClient, files: Array<{ key: string; file: PreparedAttachmentFile }>, sourceAttachmentId: string) {
  const ids = new Map<string, string>();
  for (const { key, file } of files) {
    const attachment = await tx.attachment.create({ data: { filename: file.filename, originalFilename: file.originalFilename, mimeType: file.mimeType, size: file.size, storagePath: file.storagePath, sha256: file.sha256, metadataJson: file.metadataJson, derivedFromId: sourceAttachmentId, derivativeKind: "docx_embedded_original" } });
    ids.set(key, attachment.id);
  }
  return ids;
}

export function resolveImportedMedia<T>(value: T, ids: Map<string, string>): T {
  if (typeof value === "string") return value.split("\n").map(line => { const media = documentMediaFromMarkdown(line); return media?.importImageKey ? documentMediaToMarkdown(resolveImportedMedia(media, ids)) : line; }).join("\n") as T;
  if (Array.isArray(value)) return value.map(item => resolveImportedMedia(item, ids)) as T;
  if (!value || typeof value !== "object" || value instanceof Date) return value;
  const object = value as Record<string, unknown>;
  if (object.type === "media" && typeof object.importImageKey === "string") {
    const attachmentId = ids.get(object.importImageKey);
    if (!attachmentId) throw new Error("Word 图片未找到，已取消导入。 / Embedded image is missing; import cancelled.");
    const { importImageKey: _key, ...rest } = object; void _key;
    return { ...rest, attachmentId, url: "" } as T;
  }
  return Object.fromEntries(Object.entries(object).map(([key, item]) => [key, resolveImportedMedia(item, ids)])) as T;
}
