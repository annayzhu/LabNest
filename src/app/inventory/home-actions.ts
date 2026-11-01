"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formActionErrorMessage } from "@/lib/form-actions";
import { addInventoryContainers, commandInventoryContainer } from "@/lib/inventory-containers";
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

const settleInput = z.object({
  itemId: z.string().min(1),
  containerId: z.string().min(1),
  action: z.enum(["empty", "return", "transfer"]),
  holder: z.string().trim().max(120).optional(),
  place: z.string().trim().max(240).optional(),
  clientMutationId: z.string().uuid(),
});

/** 用完, 归还 or 转交 for a container someone has, from the home's in-use list (Q196). */
export async function settleHeldContainer(raw: unknown): Promise<{ error?: string }> {
  let itemId: string;
  try {
    const input = settleInput.parse(raw);
    itemId = input.itemId;
    await commandInventoryContainer(input.itemId, {
      action: input.action,
      containerId: input.containerId,
      clientMutationId: input.clientMutationId,
      ...(input.holder ? { holder: input.holder } : {}),
      ...(input.place ? { location: input.place } : {}),
    });
  } catch (error) {
    return { error: formActionErrorMessage(error, "The container could not be changed.") };
  }
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${itemId}`);
  return {};
}
