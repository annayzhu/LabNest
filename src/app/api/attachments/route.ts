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
  const clientMutationId = String(formData.get("clientMutationId") ?? "").trim() || undefined;
  const deviceCreatedAtText = String(formData.get("deviceCreatedAt") ?? "").trim();
  const deviceCreatedAt = deviceCreatedAtText ? new Date(deviceCreatedAtText) : undefined;
  if (clientMutationId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientMutationId)) return Response.json({ error: "Invalid client mutation ID." }, { status: 400 });
  if (deviceCreatedAt && Number.isNaN(deviceCreatedAt.getTime())) return Response.json({ error: "Invalid device creation time." }, { status: 400 });
  if (clientMutationId) {
    const replay = await prisma.attachment.findUnique({ where: { clientMutationId }, include: { links: true } });
    if (replay) return Response.json({ attachment: replay, replay: true });
  }
  const targetStep = targetType === "experiment_step" && targetId ? await prisma.experimentStep.findUnique({ where: { id: targetId }, select: { id: true, experimentId: true } }) : undefined;
  if (targetType === "experiment_step" && !targetStep) return Response.json({ error: "Experiment step not found." }, { status: 404 });
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
    const attachment = await prisma.$transaction(async (tx) => {
      const created = await tx.attachment.create({
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
          clientMutationId,
          deviceCreatedAt,
          links:
            targetType && targetId
              ? { create: { targetType, targetId, linkType, order: Number.isFinite(order) ? order : 0 } }
              : undefined,
        },
        include: { links: true },
      });
      if (targetStep) {
        await tx.experimentStepEvent.create({ data: { experimentStepId: targetStep.id, experimentId: targetStep.experimentId, eventType: "attachment", clientMutationId, deviceCreatedAt, payloadJson: { attachmentId: created.id, filename: created.originalFilename, mimeType: created.mimeType, size: created.size } } });
        await tx.activityLog.create({ data: { action: "link_step_attachment", targetType: "experiment_step", targetId: targetStep.id, metadataJson: { experimentId: targetStep.experimentId, attachmentId: created.id, clientMutationId: clientMutationId ?? null } } });
      }
      return created;
    });
    if (targetType === "result" && targetId) await refreshResultValidation(targetId);
    return Response.json({ attachment }, { status: 201 });
  } catch (error) {
    await cleanupPreparedAttachmentFiles([prepared]);
    return Response.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 });
  }
}
