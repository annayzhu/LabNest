"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { formActionErrorMessage, type FormActionState } from "@/lib/form-actions";
import { permanentlyDeleteSnapshot, restoreDeletedRecord } from "@/lib/recycle-bin";

const restoreSchema = z.object({ id: z.string().min(1, "Recycle-bin ID is required.") });
const purgeSchema = restoreSchema.extend({ confirmation: z.string().trim().min(1, "Confirmation is required.") });

export async function restoreTrashRecord(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let href: string;
  try {
    const parsed = restoreSchema.parse({ id: formData.get("id") });
    const restored = await restoreDeletedRecord(parsed.id);
    href = restored.href;
  } catch (error) {
    return { error: formActionErrorMessage(error, "This record could not be restored.", "A record with the same ID or code already exists. Rename or remove the conflict before restoring.") };
  }
  revalidatePath("/");
  revalidatePath("/trash");
  revalidatePath("/projects");
  revalidatePath("/research-plans");
  revalidatePath("/protocols");
  revalidatePath("/experiments");
  revalidatePath("/results");
  revalidatePath("/reports");
  revalidatePath("/entries");
  revalidatePath("/search");
  redirect(href);
}

export async function purgeTrashRecord(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  try {
    const parsed = purgeSchema.parse({ id: formData.get("id"), confirmation: formData.get("confirmation") });
    await permanentlyDeleteSnapshot(parsed.id, parsed.confirmation);
  } catch (error) {
    return { error: formActionErrorMessage(error, "This recycle-bin snapshot could not be permanently deleted.") };
  }
  revalidatePath("/trash");
  redirect("/trash");
}
