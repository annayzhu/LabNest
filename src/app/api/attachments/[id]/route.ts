import { readFile, unlink } from "node:fs/promises";
import { resolveAttachmentPath } from "@/lib/attachments";
import { prisma } from "@/lib/db";
import { cleanupErrorMessage, runPostCommitCleanup } from "@/lib/post-commit-cleanup";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const attachment = await prisma.attachment.findUnique({ where: { id } });

  if (!attachment) {
    return Response.json({ error: "Attachment not found." }, { status: 404 });
  }

  let fileBuffer: Buffer;
  try {
    fileBuffer = await readFile(resolveAttachmentPath(attachment.storagePath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return Response.json({ error: "The attachment record exists, but its stored file is missing." }, { status: 410 });
    }
    throw error;
  }
  const inline = new URL(request.url).searchParams.get("inline") === "1";

  return new Response(new Uint8Array(fileBuffer), {
    headers: {
      "content-type": attachment.mimeType,
      "content-length": String(fileBuffer.byteLength),
      "content-disposition": inline
        ? "inline"
        : `attachment; filename="${attachment.originalFilename.replaceAll('"', "'")}"`,
      "x-content-type-options": "nosniff",
    },
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const linkId = new URL(request.url).searchParams.get("linkId")?.trim();
  const attachment = await prisma.attachment.findUnique({ where: { id }, include: { links: true } });
  if (!attachment) return Response.json({ error: "Attachment not found." }, { status: 404 });

  const link = linkId ? attachment.links.find((candidate) => candidate.id === linkId) : undefined;
  if (linkId && !link) return Response.json({ error: "Attachment link not found." }, { status: 404 });
  if (!linkId && attachment.links.length) {
    return Response.json({ error: "Remove this file from its linked records before deleting the stored original." }, { status: 409 });
  }

  const remainingLinks = attachment.links.filter((candidate) => candidate.id !== link?.id);
  await prisma.$transaction(async (tx) => {
    if (link) await tx.attachmentLink.delete({ where: { id: link.id } });
    await tx.activityLog.create({ data: {
      action: remainingLinks.length ? "unlink_attachment" : "delete_attachment",
      targetType: link?.targetType ?? "attachment",
      targetId: link?.targetId ?? attachment.id,
      metadataJson: { attachmentId: attachment.id, filename: attachment.originalFilename, linkType: link?.linkType },
    } });
    if (!remainingLinks.length) await tx.attachment.delete({ where: { id: attachment.id } });
  });

  const cleanupWarnings = await runPostCommitCleanup([
    ...(!remainingLinks.length ? [{ name: "remove attachment storage", run: async () => {
      await unlink(resolveAttachmentPath(attachment.storagePath)).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
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
  return Response.json({ removed: true, deletedOriginal: !remainingLinks.length, cleanupWarnings });
}
