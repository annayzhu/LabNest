import type { InventoryItem, InventoryTransaction } from "./types";

export type InventoryLedgerItem = Pick<InventoryItem, "id" | "name" | "currentQuantity" | "unit">;

export function calculateQuantityFromTransactions(
  openingQuantity: number,
  transactions: Pick<InventoryTransaction, "quantityChange" | "unit">[],
  unit: string,
): number {
  return transactions.reduce((quantity, transaction) => {
    if (transaction.unit !== unit) {
      throw new Error(`Unit mismatch: expected ${unit}, received ${transaction.unit}.`);
    }
    return quantity + transaction.quantityChange;
  }, openingQuantity);
}

export function applyInventoryTransaction(
  item: InventoryLedgerItem,
  transaction: Pick<InventoryTransaction, "quantityChange" | "unit" | "type">,
): InventoryLedgerItem {
  if (transaction.unit !== item.unit) {
    throw new Error(`Cannot apply ${transaction.unit} transaction to ${item.unit} inventory item.`);
  }

  const nextQuantity = item.currentQuantity + transaction.quantityChange;
  if (nextQuantity < 0) {
    throw new Error(`Transaction would make ${item.name} negative (${nextQuantity} ${item.unit}).`);
  }

  return {
    ...item,
    currentQuantity: Number(nextQuantity.toFixed(6)),
  };
}

export function directQuantityEditToAdjustTransaction({
  item,
  desiredQuantity,
  notes,
}: {
  item: InventoryLedgerItem;
  desiredQuantity: number;
  notes?: string;
}): Omit<InventoryTransaction, "id" | "createdAt"> {
  if (desiredQuantity < 0) {
    throw new Error("Inventory quantity cannot be negative.");
  }

  return {
    inventoryItemId: item.id,
    type: "adjust",
    quantityChange: Number((desiredQuantity - item.currentQuantity).toFixed(6)),
    unit: item.unit,
    notes: notes ?? "Quantity adjustment generated instead of direct edit.",
  };
}
