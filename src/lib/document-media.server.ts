import type { Prisma } from "@/generated/prisma/client";
import { assertDocumentMediaReady, collectDocumentMedia, documentMediaAttachmentId } from "./document-media";
import { lockAttachmentOriginals } from "./attachment-reference-protection";

/** Call inside the same transaction as the document write, so neither can succeed alone. */
export async function associateDocumentMedia(tx: Prisma.TransactionClient, value: unknown, targetType: string, targetId: string) {
  assertDocumentMediaReady(value);
  const ids = [...new Set(collectDocumentMedia(value).flatMap(block => { const id = documentMediaAttachmentId(block); return id ? [id] : []; }))];
  await lockAttachmentOriginals(tx, ids);
  const files = await tx.attachment.findMany({ where: { id: { in: ids } }, select: { id: true } });
  if (files.length !== ids.length) throw new Error("部分附件不存在，正文未保存。 / An attachment is missing; the document was not saved.");
  const previous = await tx.attachmentLink.findMany({ where: { targetType, targetId, linkType: "embedded_document_media" } });
  // Preserve provenance when a current reference is removed. Never delete the original.
  const removed = previous.filter(link => !ids.includes(link.attachmentId));
  if (removed.length) await tx.attachmentLink.updateMany({ where: { id: { in: removed.map(link => link.id) } }, data: { linkType: "document_media_history" } });
  for (const [order, id] of ids.entries()) {
    if (!previous.some(link => link.attachmentId === id)) await tx.attachmentLink.create({ data: { attachmentId: id, targetType, targetId, linkType: "embedded_document_media", order } });
  }
  if (ids.length) await tx.attachmentLink.deleteMany({ where: { attachmentId: { in: ids }, targetType: "document_upload_draft" } });
}
