"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ScheduleBlock } from "@/lib/experiment-schedule";
import { saveExperimentSchedule, saveScheduleInput, setScheduleItemDone } from "@/lib/experiment-schedule.server";
import { formActionErrorMessage } from "@/lib/form-actions";

export type ScheduleSaveResult = { ok: true; token: string; blocks: ScheduleBlock[] } | { ok: false; error: string };

function revalidateSchedule(experimentId: string) {
  revalidatePath(`/experiments/${experimentId}`);
  revalidatePath(`/experiments/${experimentId}/schedule`);
  revalidatePath(`/experiments/${experimentId}/run`);
  revalidatePath("/");
}

/** Saves the whole schedule shown on the page; the error comes back as text. */
export async function saveSchedule(raw: unknown): Promise<ScheduleSaveResult> {
  const input = saveScheduleInput.safeParse(raw);
  if (!input.success) return { ok: false, error: formActionErrorMessage(input.error, "The schedule was not saved.") };
  try {
    const saved = await saveExperimentSchedule(input.data);
    revalidateSchedule(input.data.experimentId);
    return { ok: true, ...saved };
  } catch (error) {
    return { ok: false, error: formActionErrorMessage(error, "The schedule was not saved.") };
  }
}

/** Ticks an item off, or reopens it; the page gets the saved schedule back. */
export async function setItemDone(raw: unknown): Promise<ScheduleSaveResult> {
  const input = z.object({ experimentId: z.string().min(1), blockId: z.string().min(1), done: z.boolean() }).safeParse(raw);
  if (!input.success) return { ok: false, error: "Choose an item." };
  try {
    const saved = await setScheduleItemDone(input.data.experimentId, input.data.blockId, input.data.done);
    revalidateSchedule(input.data.experimentId);
    return { ok: true, ...saved };
  } catch (error) {
    return { ok: false, error: formActionErrorMessage(error, "The item was not updated.") };
  }
}
