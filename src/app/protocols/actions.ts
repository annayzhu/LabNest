"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { formActionErrorMessage, type FormActionState } from "@/lib/form-actions";
import { protocolDeleteBlockers } from "@/lib/record-lifecycle";
import { captureDeletedRecord } from "@/lib/recycle-bin";

const lifecycleSchema = z.object({
  id: z.string().min(1, "Protocol ID is required."),
  confirmation: z.string().trim().optional(),
});

export async function archiveProtocol(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let protocolId: string;
  try {
    const parsed = lifecycleSchema.parse({ id: formData.get("id") });
    const protocol = await prisma.protocol.findUnique({ where: { id: parsed.id }, select: { id: true, humanCode: true, title: true, availability: true } });
    if (!protocol) throw new Error("This Protocol no longer exists.");
    await prisma.$transaction([
      prisma.protocol.update({ where: { id: protocol.id }, data: { availability: "archived" } }),
      prisma.activityLog.create({ data: { action: "archive", targetType: "protocol", targetId: protocol.id, metadataJson: { humanCode: protocol.humanCode, title: protocol.title, previousAvailability: protocol.availability } } }),
    ]);
    protocolId = protocol.id;
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Protocol could not be archived.") };
  }
  revalidatePath("/protocols");
  revalidatePath(`/protocols/${protocolId}`);
  redirect(`/protocols/${protocolId}`);
}

export async function deleteProtocol(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  try {
    const parsed = lifecycleSchema.parse({ id: formData.get("id"), confirmation: formData.get("confirmation") });
    await prisma.$transaction(async (tx) => {
      const protocol = await tx.protocol.findUnique({
        where: { id: parsed.id },
        select: {
          id: true,
          humanCode: true,
          title: true,
          availability: true,
          recordStatus: true,
          projectId: true,
          versions: { select: { id: true } },
          _count: { select: { researchPlans: true } },
        },
      });
      if (!protocol) throw new Error("This Protocol no longer exists.");
      if (parsed.confirmation !== protocol.humanCode) throw new Error(`Enter ${protocol.humanCode} exactly to confirm moving it to the Recycle Bin.`);
      const versionIds = protocol.versions.map((version) => version.id);
      const [experiments, results, nonDraftVersions, derivedVersions, reportSourceReferences] = await Promise.all([
        tx.experimentProtocolVersion.count({ where: { protocolVersion: { protocolId: protocol.id } } }),
        tx.result.count({ where: { protocolVersion: { protocolId: protocol.id } } }),
        tx.protocolVersion.count({ where: { protocolId: protocol.id, OR: [{ recordStatus: { not: "draft" } }, { reviewStage: { not: "draft" } }] } }),
        tx.protocolVersion.count({ where: { protocolId: { not: protocol.id }, derivedFromVersion: { protocolId: protocol.id } } }),
        tx.reportSource.count({ where: { OR: [{ sourceType: "protocol", sourceId: protocol.id }, { sourceType: "protocol_version", sourceId: { in: versionIds } }] } }),
      ]);
      const counts = { researchPlans: protocol._count.researchPlans, experiments, results, nonDraftVersions, derivedVersions, reportSourceReferences };
      const blockers = protocolDeleteBlockers(protocol.availability, protocol.recordStatus, counts);
      if (blockers.length) throw new Error("This Protocol is recorded or referenced and can only be archived.");

      const recycled = await captureDeletedRecord(tx, "protocol", protocol.id);
      await tx.attachmentLink.deleteMany({ where: { OR: [{ targetType: "protocol", targetId: protocol.id }, { targetType: "protocol_version", targetId: { in: versionIds } }] } });
      await tx.itemLink.deleteMany({
        where: {
          OR: [
            { sourceType: "protocol", sourceId: protocol.id },
            { targetType: "protocol", targetId: protocol.id },
            { sourceType: "protocol_version", sourceId: { in: versionIds } },
            { targetType: "protocol_version", targetId: { in: versionIds } },
          ],
        },
      });
      await tx.activityLog.create({ data: { action: "delete", targetType: "protocol", targetId: protocol.id, metadataJson: { recycleBinId: recycled.id, humanCode: protocol.humanCode, title: protocol.title, availability: protocol.availability, recordStatus: protocol.recordStatus, projectId: protocol.projectId, versionIds, dependencyCounts: counts } } });
      await tx.protocol.delete({ where: { id: protocol.id } });
    });
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Protocol could not be moved to the recycle bin.") };
  }
  revalidatePath("/");
  revalidatePath("/protocols");
  revalidatePath("/research-plans");
  revalidatePath("/search");
  redirect("/protocols");
}
