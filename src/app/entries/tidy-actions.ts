"use server";

import { revalidatePath } from "next/cache";
import { pickableReasons } from "@/lib/copilot/suggestions";
import { adoptTidy, decideAssignment, ignoreTidy } from "@/lib/entry-tidy.server";

const refresh = (entryId: string) => ["/entries", `/entries/${entryId}`, "/ai"].forEach(path => revalidatePath(path));
const failure = (error: unknown) => ({ error: error instanceof Error ? error.message : "Not saved; try again" });

/** 采用 a tidied draft as the author left it (Q339). */
export async function adoptEntryTidy(entryId: string, input: { requestKey: string; title: string; markdown: string }): Promise<{ error?: string }> {
  try { await adoptTidy(entryId, input); refresh(entryId); return {}; } catch (error) { return failure(error); }
}

/** Ignores a tidied draft, with the reason the author picked (Q334). */
export async function ignoreEntryTidy(entryId: string, requestKey: string, reason: string): Promise<{ error?: string }> {
  if (!(pickableReasons as readonly string[]).includes(reason)) return { error: "Choose a reason" };
  try { await ignoreTidy(entryId, requestKey, reason as (typeof pickableReasons)[number]); refresh(entryId); return {}; } catch (error) { return failure(error); }
}

/** Files the record under the experiment its words named, or declines (Q340). */
export async function decideEntryAssignment(entryId: string, experimentId: string, adopt: boolean): Promise<{ error?: string }> {
  try { await decideAssignment(entryId, experimentId, adopt); refresh(entryId); if (adopt) revalidatePath(`/experiments/${experimentId}`); return {}; } catch (error) { return failure(error); }
}
