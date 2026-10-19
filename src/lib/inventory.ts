import { formatQuantity } from "./calculators/quantity-format";
import type { InventoryItem, InventoryTransaction } from "./types";

export const inventoryCategories = [
  { value: "reagent", label: "Reagent" },
  { value: "consumable", label: "Consumable" },
  { value: "antibody", label: "Antibody" },
  { value: "kit", label: "Kit" },
  { value: "chemical", label: "Chemical" },
  { value: "instrument_accessory", label: "Instrument accessory" },
  { value: "biological_sample", label: "Biological sample" },
  { value: "other", label: "Other" },
] as const;

export type InventoryRiskFlag = "depleted" | "low" | "expired" | "expiring";

type InventoryRiskInput = {
  currentQuantity: number;
  quantityRecorded?: boolean;
  lowThreshold?: number | null;
  expiryDate?: string | Date | null;
};

export function getInventoryRiskFlags(
  item: InventoryRiskInput,
  now = new Date(),
  expiringWithinDays = 30,
): InventoryRiskFlag[] {
  const flags: InventoryRiskFlag[] = [];

  if (item.quantityRecorded !== false && item.currentQuantity <= 0) {
    flags.push("depleted");
  } else if (item.quantityRecorded !== false && item.lowThreshold != null && item.currentQuantity <= item.lowThreshold) {
    flags.push("low");
  }

  if (item.expiryDate) {
    // Date-input values are stored as UTC midnight. Compare calendar days,
    // using the caller/runtime local day for "today", not an expiry instant.
    const expiryDay = item.expiryDate instanceof Date ? item.expiryDate.toISOString().slice(0,10) : item.expiryDate.slice(0,10);
    const expiry = Date.parse(expiryDay);
    const today = Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
    const expiringCutoff = today + expiringWithinDays * 86400000;

    if (expiry < today) {
      flags.push("expired");
    } else if (expiry <= expiringCutoff) {
      flags.push("expiring");
    }
  }

  return flags;
}

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

export function inventoryQuantityLabel(item: {currentQuantity:number;unit:string;quantityRecorded?:boolean}) {
  return item.quantityRecorded === false ? "数量未记录 / Quantity not recorded" : `${formatQuantity(item.currentQuantity)} ${item.unit}`;
}

const recordId = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/**
 * A movement's note as people read it. Notes written by a run carry record IDs and the Protocol rule key
 * ("Confirmed material use <id>; source Chip:<key>|<step>", "Consumed during <experiment id>."); they read as the
 * run code and the step instead. Every other note is shown as written.
 */
export function inventoryNoteText(notes: string | null, experiment?: { id: string; runCode: string } | null) {
  if (!notes) return notes;
  const confirmed = notes.match(new RegExp(`^Confirmed material use ${recordId}; source ([\\s\\S]*)$`));
  if (confirmed) {
    // As the run's material list reads a source: the step after "|"; nothing for a manual entry or a correction.
    const source = confirmed[1];
    const step = /^(Chip|Consumption):/.test(source) ? source.split("|").slice(1).join("|") : source === "manual" || source.startsWith("correction:") ? "" : source;
    return ["Confirmed material use", experiment?.runCode, step].filter(Boolean).join(" · ");
  }
  if (new RegExp(`^Explicit correction of material use ${recordId}$`).test(notes)) return ["Explicit correction of material use", experiment?.runCode].filter(Boolean).join(" · ");
  const consumed = notes.match(/^Consumed during (c[a-z0-9]{24})\.$/);
  if (consumed) return consumed[1] === experiment?.id ? `Consumed during ${experiment.runCode}.` : "Consumed during an experiment.";
  return notes;
}
