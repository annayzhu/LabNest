"use server";

import { shouldFreezeEntrySources } from "@/lib/entry-lifecycle";
import { lockEntrySourceGraph } from "@/lib/entry-source-lock";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { RecordLifecycleStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { formActionErrorMessage, type FormActionState } from "@/lib/form-actions";
import { freezeEntrySources } from "@/lib/entry-assignment.server";
import { isRecordLocked } from "@/lib/record-lifecycle";

export type RecordStatusState = FormActionState & { message?: string };

const schema = z.object({
  targetType: z.enum(["experiment", "entry", "result"]),
  id: z.string().min(1),
  recordStatus: z.enum(RecordLifecycleStatus),
  reason: z.string().trim().max(2_000).optional(),
});

/** The only path that changes a notebook record's lifecycle; reopening a locked record requires a logged reason. */
export async function setRecordStatus(_previous: RecordStatusState, formData: FormData): Promise<RecordStatusState> {
  try {
    const parsed = schema.parse({
      targetType: formData.get("targetType"),
      id: formData.get("id"),
      recordStatus: formData.get("recordStatus"),
      reason: String(formData.get("reason") ?? "").trim() || undefined,
    });
    const { targetType, id, recordStatus, reason } = parsed;
    await prisma.$transaction(async (tx) => {
      await lockEntrySourceGraph(tx);
      if (targetType === "experiment") await tx.$queryRaw`SELECT id FROM "Experiment" WHERE id=${id} FOR UPDATE`;
      else if (targetType === "result") await tx.$queryRaw`SELECT id FROM "Result" WHERE id=${id} FOR UPDATE`;
      else await tx.$queryRaw`SELECT id FROM "Entry" WHERE id=${id} FOR UPDATE`;
      const current = targetType === "experiment"
        ? await tx.experiment.findUnique({ where: { id }, select: { recordStatus: true } })
        : targetType === "result" ? await tx.result.findUnique({ where: { id }, select: { recordStatus: true } }) : await tx.entry.findUnique({ where: { id }, select: { recordStatus: true } });
      if (!current) throw new Error("This record no longer exists.");
      if (current.recordStatus === recordStatus) return;
      const reopening = isRecordLocked(current.recordStatus) && !isRecordLocked(recordStatus);
      if (reopening && !reason) throw new Error("Give a reason for reopening a submitted or reviewed record.");
      if (targetType === "result" && !reopening) throw new Error("Submit or review Results through the validated Result editor; this control only reopens a locked Result.");
      if (targetType !== "entry" && shouldFreezeEntrySources(current.recordStatus, recordStatus)) await freezeEntrySources(tx, targetType, id);
      if (targetType === "experiment") await tx.experiment.update({ where: { id }, data: { recordStatus } });
      else if (targetType === "result") await tx.result.update({ where: { id }, data: { recordStatus } });
      else await tx.entry.update({ where: { id }, data: { recordStatus } });
      await tx.activityLog.create({ data: {
        action: reopening ? "reopen" : "record_status",
        targetType,
        targetId: id,
        metadataJson: { from: current.recordStatus, to: recordStatus, ...(reason ? { reason } : {}) },
      } });
    });
    revalidatePath(`/${targetType === "entry" ? "entries" : targetType + "s"}/${id}`);
    if (targetType === "experiment") revalidatePath(`/experiments/${id}/run`);
    revalidatePath(`/${targetType === "entry" ? "entries" : targetType + "s"}`);
    return { message: "Record status updated." };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The record status could not be changed.") };
  }
}
