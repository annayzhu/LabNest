"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { formActionErrorMessage, type FormActionState } from "@/lib/form-actions";
import { entryDeleteBlockers } from "@/lib/record-lifecycle";
import { captureDeletedRecord } from "@/lib/recycle-bin";

const lifecycleSchema = z.object({
  id: z.string().min(1, "Entry ID is required."),
  confirmation: z.string().trim().optional(),
});

export async function archiveEntry(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let entryId: string;
  try {
    const parsed = lifecycleSchema.parse({ id: formData.get("id") });
    const entry = await prisma.entry.findUnique({ where: { id: parsed.id }, select: { id: true, title: true, archivedAt: true } });
    if (!entry) throw new Error("This Entry no longer exists.");
    if (entry.archivedAt) throw new Error("This Entry is already archived.");
    await prisma.$transaction([
      prisma.entry.update({ where: { id: entry.id }, data: { archivedAt: new Date() } }),
      prisma.activityLog.create({ data: { action: "archive", targetType: "entry", targetId: entry.id, metadataJson: { title: entry.title } } }),
    ]);
    entryId = entry.id;
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Entry could not be archived.") };
  }
  revalidatePath("/entries");
  revalidatePath(`/entries/${entryId}`);
  redirect(`/entries/${entryId}`);
}

export async function restoreEntry(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let entryId: string;
  try {
    const parsed = lifecycleSchema.parse({ id: formData.get("id") });
    const entry = await prisma.entry.findUnique({ where: { id: parsed.id }, select: { id: true, title: true, archivedAt: true } });
    if (!entry) throw new Error("This Entry no longer exists.");
    if (!entry.archivedAt) throw new Error("This Entry is not archived.");
    await prisma.$transaction([
      prisma.entry.update({ where: { id: entry.id }, data: { archivedAt: null } }),
      prisma.activityLog.create({ data: { action: "restore", targetType: "entry", targetId: entry.id, metadataJson: { title: entry.title, archivedAt: entry.archivedAt.toISOString() } } }),
    ]);
    entryId = entry.id;
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Entry could not be restored.") };
  }
  revalidatePath("/entries");
  revalidatePath(`/entries/${entryId}`);
  redirect(`/entries/${entryId}`);
}

export async function deleteEntry(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  try {
    const parsed = lifecycleSchema.parse({ id: formData.get("id"), confirmation: formData.get("confirmation") });
    await prisma.$transaction(async (tx) => {
      const entry = await tx.entry.findUnique({ where: { id: parsed.id }, select: { id: true, title: true, recordStatus: true, projectId: true, researchPlanId: true, archivedAt: true } });
      if (!entry) throw new Error("This Entry no longer exists.");
      if (parsed.confirmation !== entry.title) throw new Error(`Enter ${entry.title} exactly to confirm moving it to the Recycle Bin.`);
      const [itemLinks, proposedActions, reportSourceReferences, attachmentCount] = await Promise.all([
        tx.itemLink.count({ where: { OR: [{ sourceType: "entry", sourceId: entry.id }, { targetType: "entry", targetId: entry.id }] } }),
        tx.proposedAction.count({ where: { sourceType: "entry", sourceId: entry.id } }),
        tx.reportSource.count({ where: { sourceType: "entry", sourceId: entry.id } }),
        tx.attachmentLink.count({ where: { targetType: "entry", targetId: entry.id } }),
      ]);
      const counts = { itemLinks, proposedActions, reportSourceReferences };
      const blockers = entryDeleteBlockers(entry.recordStatus, counts);
      if (blockers.length) throw new Error("This Entry is recorded or linked and can only be archived.");

      const recycled = await captureDeletedRecord(tx, "entry", entry.id);
      await tx.attachmentLink.deleteMany({ where: { targetType: "entry", targetId: entry.id } });
      await tx.activityLog.create({ data: { action: "delete", targetType: "entry", targetId: entry.id, metadataJson: { recycleBinId: recycled.id, title: entry.title, recordStatus: entry.recordStatus, projectId: entry.projectId, researchPlanId: entry.researchPlanId, archivedAt: entry.archivedAt?.toISOString(), preservedAttachmentCount: attachmentCount, dependencyCounts: counts } } });
      await tx.entry.delete({ where: { id: entry.id } });
    });
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Entry could not be moved to the recycle bin.") };
  }
  revalidatePath("/");
  revalidatePath("/entries");
  revalidatePath("/projects");
  revalidatePath("/research-plans");
  revalidatePath("/search");
  redirect("/entries");
}
