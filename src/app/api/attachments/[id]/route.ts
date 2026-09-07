import { readFile, unlink } from "node:fs/promises";
import { resolveAttachmentPath } from "@/lib/attachments";
import { prisma } from "@/lib/db";
import { cleanupErrorMessage, runPostCommitCleanup } from "@/lib/post-commit-cleanup";
import { hasLegacyDocumentReference, lockAttachmentOriginals } from "@/lib/attachment-reference-protection";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const attachment = await prisma.attachment.findUnique({ where: { id } });

  if (!attachment) {
    return Response.json({ error: "Attachment not found." }, { status: 404 });
  }

  const query = new URL(request.url).searchParams;
  const metadata = attachment.metadataJson as { preview?: { storagePath?: string; mimeType?: string } };
  const preview = query.get("preview") === "1" && typeof metadata.preview?.storagePath === "string" ? metadata.preview : undefined;
  const mimeType = preview?.mimeType || attachment.mimeType;
  let fileBuffer: Buffer;
  try {
    fileBuffer = await readFile(resolveAttachmentPath(preview?.storagePath || attachment.storagePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return Response.json({ error: "The attachment record exists, but its stored file is missing." }, { status: 410 });
    }
    throw error;
  }
  const inline = query.get("inline") === "1" && (/^image\/(png|jpeg|gif|webp|avif)$/.test(mimeType) || /^(audio|video)\//.test(mimeType) || mimeType === "application/pdf");

  return new Response(new Uint8Array(fileBuffer), {
    headers: {
      "content-type": mimeType,
      "content-length": String(fileBuffer.byteLength),
      "content-disposition": inline
        ? "inline"
        : `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(attachment.originalFilename)}`,
      "x-content-type-options": "nosniff",
    },
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const linkId = new URL(request.url).searchParams.get("linkId")?.trim();
  const result = await prisma.$transaction(async (tx) => {
    await lockAttachmentOriginals(tx, [id]);
    const attachment = await tx.attachment.findUnique({ where: { id }, include: { links: true } });
    if (!attachment) return { error: "Attachment not found.", status: 404 } as const;
    const link = linkId ? attachment.links.find(candidate => candidate.id === linkId) : undefined;
    if (linkId && !link) return { error: "Attachment link not found.", status: 404 } as const;
    if (!linkId && (attachment.links.length || await hasLegacyDocumentReference(tx, id))) return { error: "正文或历史记录仍引用此附件，不能删除原文件。 / A document or history still references this original.", status: 409 } as const;
    const deleteOriginal = !link;
    if (link) await tx.attachmentLink.delete({ where: { id: link.id } });
    await tx.activityLog.create({ data: {
      action: deleteOriginal ? "delete_attachment" : "unlink_attachment",
      targetType: link?.targetType ?? "attachment",
      targetId: link?.targetId ?? attachment.id,
      metadataJson: { attachmentId: attachment.id, filename: attachment.originalFilename, linkType: link?.linkType },
    } });
    if (deleteOriginal) await tx.attachment.delete({ where: { id: attachment.id } });
    return { attachment, link, deleteOriginal };
  });
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  const { attachment, link, deleteOriginal } = result;

  const cleanupWarnings = await runPostCommitCleanup([
    ...(deleteOriginal ? [{ name: "remove attachment storage", run: async () => {
      await unlink(resolveAttachmentPath(attachment.storagePath)).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
      const preview = (attachment.metadataJson as { preview?: { storagePath?: string } }).preview?.storagePath;
      if (preview) await unlink(resolveAttachmentPath(preview)).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
    } }] : []),
    ...(link?.targetType === "result" ? [{ name: "refresh result validation", run: async () => {
      const { refreshResultValidation } = await import("@/lib/result-validation");
      await refreshResultValidation(link.targetId);
    } }] : []),
  ], async (taskName, error) => {
    await prisma.activityLog.create({ data: {
      action: "attachment_cleanup_pending",
      targetType: link?.targetType ?? "attachment",
      targetId: link?.targetId ?? attachment.id,
      metadataJson: { attachmentId: attachment.id, storagePath: attachment.storagePath, taskName, error: cleanupErrorMessage(error) },
    } });
  });
  return Response.json({ removed: true, deletedOriginal: deleteOriginal, cleanupWarnings });
}
