"use server";

import { revalidatePath } from "next/cache";
import type { SuggestionDecision } from "@/lib/ai-suggestion";
import { decideSuggestion } from "@/lib/entry-suggestions";

/** 采纳 / 忽略 on an entry's AI suggestion; an accepted one answers with the experiment the entry now belongs to. */
export async function decideEntrySuggestion(entryId: string, suggestionId: string, decision: SuggestionDecision): Promise<{ experimentId?: string; error?: string }> {
  try {
    const { experimentId } = await decideSuggestion(entryId, suggestionId, decision);
    ["/entries", `/entries/${entryId}`, "/experiments"].forEach(path => revalidatePath(path));
    if (experimentId) revalidatePath(`/experiments/${experimentId}`);
    return { experimentId };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "没有处理成功，请重试" };
  }
}
