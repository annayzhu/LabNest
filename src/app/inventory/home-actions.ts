"use server";

import { revalidatePath } from "next/cache";
import { formActionErrorMessage } from "@/lib/form-actions";
import { addInventoryContainers } from "@/lib/inventory-containers";
import type { StockSearch } from "@/lib/inventory-search";
import { findStock } from "@/lib/inventory-search.server";

/** The inventory home's live search; an empty search returns the stock changed most recently. */
export async function searchStock(query: string): Promise<StockSearch> {
  return findStock(String(query ?? ""));
}

/** Containers received from the inventory home; the key is made when the form opens, so a retry adds nothing twice. */
export async function receiveContainers(lotId: string, input: { count: number; place?: string; clientMutationId: string }): Promise<{ error?: string }> {
  try {
    await addInventoryContainers(lotId, { count: input.count, location: input.place?.trim() || undefined, clientMutationId: input.clientMutationId });
  } catch (error) {
    return { error: formActionErrorMessage(error, "The containers could not be added.") };
  }
  revalidatePath(`/inventory/${lotId}`);
  return {};
}
