"use server";

import { revalidatePath } from "next/cache";
import { addDayMethod, addDayMethodInput, addScheduleDay, moveDayPart, moveDayPartInput, removeDayPart, dayPartInput, replaceDayPart, replaceDayPartInput } from "@/lib/experiment-day-methods.server";
import { loadProtocolVersionOptions } from "@/lib/protocol-version-options.server";
import { formActionErrorMessage } from "@/lib/form-actions";

export type DayActionResult = { ok: true } | { ok: false; error: string };

function revalidateExperiment(experimentId: string) {
  for (const path of ["", "/edit", "/schedule", "/run"]) revalidatePath(`/experiments/${experimentId}${path}`);
  revalidatePath("/");
}

async function run(experimentId: unknown, action: () => Promise<unknown>, fallback: string): Promise<DayActionResult> {
  try {
    await action();
    if (typeof experimentId === "string") revalidateExperiment(experimentId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: formActionErrorMessage(error, fallback) };
  }
}
const idOf = (raw: unknown) => (raw && typeof raw === "object" ? (raw as { experimentId?: unknown }).experimentId : undefined);

/** 按规程执行 / 自定义步骤 on a day (Q428). */
export async function addMethodToDay(raw: unknown) {
  const input = addDayMethodInput.safeParse(raw);
  if (!input.success) return { ok: false, error: "请选择规程，或写下步骤。" } satisfies DayActionResult;
  return run(idOf(raw), () => addDayMethod(input.data), "没有加入这一天。");
}

/** 移到… (Q429, Q431). */
export async function moveDayPartAction(raw: unknown) {
  const input = moveDayPartInput.safeParse(raw);
  if (!input.success) return { ok: false, error: "请选择要移到的那一天。" } satisfies DayActionResult;
  return run(idOf(raw), () => moveDayPart(input.data), "没有移动。");
}

/** 移除 (Q431). */
export async function removeDayPartAction(raw: unknown) {
  const input = dayPartInput.safeParse(raw);
  if (!input.success) return { ok: false, error: "请选择要移除的部分。" } satisfies DayActionResult;
  return run(idOf(raw), () => removeDayPart(input.data), "没有移除。");
}

/** 换版本 / 编辑步骤 (Q431). */
export async function replaceDayPartAction(raw: unknown) {
  const input = replaceDayPartInput.safeParse(raw);
  if (!input.success) return { ok: false, error: "请选择规程版本，或写下步骤。" } satisfies DayActionResult;
  return run(idOf(raw), () => replaceDayPart(input.data), "没有修改。");
}

/** ＋ 加一天 (Q433). */
export async function addDayAction(experimentId: string) {
  return run(experimentId, () => addScheduleDay(experimentId), "没有加一天。");
}

/** The Protocol versions to choose from, loaded when the chooser opens. */
export async function protocolVersionChoices() {
  return loadProtocolVersionOptions();
}
