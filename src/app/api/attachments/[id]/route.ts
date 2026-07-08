import { readFile } from "node:fs/promises";
import { resolveAttachmentPath } from "@/lib/attachments";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const attachment = await prisma.attachment.findUnique({ where: { id } });

  if (!attachment) {
    return Response.json({ error: "Attachment not found." }, { status: 404 });
  }

  const fileBuffer = await readFile(resolveAttachmentPath(attachment.storagePath));

  return new Response(new Uint8Array(fileBuffer), {
    headers: {
      "content-type": attachment.mimeType,
      "content-length": String(attachment.size),
      "content-disposition": `attachment; filename="${attachment.originalFilename.replaceAll('"', "'")}"`,
    },
  });
}
