import { cleanupPreparedAttachmentFiles, prepareAttachmentFile, writePreparedAttachmentFiles } from "@/lib/attachment-files";
import { assertUploadSize } from "@/lib/attachments";
import { prisma } from "@/lib/db";
import { refreshResultValidation } from "@/lib/result-validation";
import { normalizeResultTemplate } from "@/lib/result-templates";

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
  const derivedFromId = String(formData.get("derivedFromId") ?? "").trim() || undefined;
  const derivativeKind = String(formData.get("derivativeKind") ?? "").trim() || undefined;
  const order = Number.parseInt(String(formData.get("order") ?? "0"), 10);
  if (targetType === "result" && targetId && linkType.startsWith("template_artifact:")) {
    const result = await prisma.result.findUnique({ where: { id: targetId }, select: { templateSnapshotJson: true } });
    if (!result) return Response.json({ error: "Result not found." }, { status: 404 });
    const artifactKey = linkType.slice("template_artifact:".length);
    const artifact = normalizeResultTemplate(result.templateSnapshotJson).artifacts?.find((item) => item.key === artifactKey);
    if (!artifact) return Response.json({ error: "The selected artifact slot is not part of this Result Template." }, { status: 400 });
    if (artifact.kind === "image" && !file.type.startsWith("image/")) return Response.json({ error: `${artifact.label} requires an image file.` }, { status: 400 });
    if (artifact.kind === "video" && !file.type.startsWith("video/")) return Response.json({ error: `${artifact.label} requires a video file.` }, { status: 400 });
  }
  const prepared = await prepareAttachmentFile(file);

  try {
    await writePreparedAttachmentFiles([prepared]);
    const attachment = await prisma.attachment.create({
      data: {
        filename: prepared.filename,
        originalFilename: prepared.originalFilename,
        mimeType: prepared.mimeType,
        size: prepared.size,
        storagePath: prepared.storagePath,
        sha256: prepared.sha256,
        metadataJson: prepared.metadataJson,
        derivedFromId,
        derivativeKind,
        links:
          targetType && targetId
            ? { create: { targetType, targetId, linkType, order: Number.isFinite(order) ? order : 0 } }
            : undefined,
      },
      include: { links: true },
    });
    if (targetType === "result" && targetId) await refreshResultValidation(targetId);
    return Response.json({ attachment }, { status: 201 });
  } catch (error) {
    await cleanupPreparedAttachmentFiles([prepared]);
    return Response.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 });
  }
}
