import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { prisma } from "./db";
import { resolveAttachmentPath } from "./attachments";
import { collectDocumentMedia, documentMediaAttachmentId } from "./document-media";
import type { DocxImageAssets } from "./docx-media";

/** Read managed originals locally. Never download a user-provided external URL. */
export async function loadDocumentImageAssets(document: unknown): Promise<DocxImageAssets> {
  const assets: DocxImageAssets = {};
  for (const media of collectDocumentMedia(document).filter(block => block.mediaType === "image")) {
    const id = documentMediaAttachmentId(media);
    if (!id) throw new Error("请先上传外部图片再导出 Word。 / Upload external images before Word export.");
    if (assets[id]) continue;
    const attachment = await prisma.attachment.findUnique({ where: { id } });
    if (!attachment) throw new Error("图片原文件记录缺失 / Image attachment is missing");
    const original = await readFile(resolveAttachmentPath(attachment.storagePath));
    const metadata = await sharp(original).metadata();
    const native = metadata.format === "png" || metadata.format === "jpeg";
    const bytes = native ? original : await sharp(original).png().toBuffer();
    if (!metadata.width || !metadata.height) throw new Error("无法读取图片尺寸 / Image dimensions unavailable");
    assets[id] = { bytes, extension: metadata.format === "jpeg" ? "jpeg" : "png", mimeType: metadata.format === "jpeg" ? "image/jpeg" : "image/png", width: metadata.width, height: metadata.height };
  }
  return assets;
}
