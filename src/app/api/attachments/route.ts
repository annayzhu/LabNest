import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertUploadSize, getAttachmentRoot, safeAttachmentFilename } from "@/lib/attachments";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const attachments = await prisma.attachment.findMany({
    include: { links: true },
    orderBy: { uploadedAt: "desc" },
    take: 100,
  });

  return Response.json({ count: attachments.length, attachments });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: "A file field is required." }, { status: 400 });
  }

  try {
    assertUploadSize(file.size);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid attachment." }, { status: 400 });
  }

  const targetType = String(formData.get("targetType") ?? "").trim();
  const targetId = String(formData.get("targetId") ?? "").trim();
  const linkType = String(formData.get("linkType") ?? "attached_to").trim() || "attached_to";
  const safeName = safeAttachmentFilename(file.name);
  const now = new Date();
  const datePath = [String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, "0")];
  const storedFilename = `${randomUUID()}-${safeName}`;
  const relativePath = path.join(...datePath, storedFilename);
  const absolutePath = path.join(getAttachmentRoot(), relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

  const attachment = await prisma.attachment.create({
    data: {
      filename: storedFilename,
      originalFilename: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      storagePath: relativePath,
      links:
        targetType && targetId
          ? {
              create: {
                targetType,
                targetId,
                linkType,
              },
            }
          : undefined,
    },
    include: { links: true },
  });

  return Response.json({ attachment }, { status: 201 });
}
