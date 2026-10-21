"use server";

import { revalidatePath } from "next/cache";
import { keepAttachment } from "@/lib/attachment-files";
import { prisma } from "@/lib/db";
import { formActionErrorMessage } from "@/lib/form-actions";
import { manualFileProblem } from "@/lib/inventory-manuals";

export type ManualUploadState = { error?: string; message?: string };

/** 说明书: keep the manual of a product on its inventory item, where 按产品查找说明书 finds it later. */
export async function addInventoryManual(itemId: string, _previous: ManualUploadState, formData: FormData): Promise<ManualUploadState> {
  try {
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("Choose the manual file");
    const problem = manualFileProblem(file);
    if (problem) throw new Error(problem);
    if (!await prisma.inventoryItem.findUnique({ where: { id: itemId }, select: { id: true } })) throw new Error("The inventory item no longer exists");
    const attachmentId = await keepAttachment(file, { targetType: "inventory_item", targetId: itemId, linkType: "product_manual" });
    await prisma.activityLog.create({ data: { action: "inventory_manual_added", targetType: "inventory_item", targetId: itemId, metadataJson: { attachmentId, filename: file.name } } });
    revalidatePath(`/inventory/${itemId}`);
    return { message: "Manual added" };
  } catch (error) { return { error: formActionErrorMessage(error, "The manual was not added") }; }
}
