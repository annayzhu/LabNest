import { zhUi } from "./i18n";
import type { InventoryItem, InventoryTransaction } from "./types";

export type InventoryRiskFlag = "depleted" | "low" | "expired" | "expiring";

type InventoryRiskInput = {
  currentQuantity: number;
  quantityRecorded?: boolean;
  lowThreshold?: number | null;
  /** The product's stock across its lots (productStock); safety stock is the product's, so "low" compares this total. */
  productQuantity?: number;
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
  } else if (item.quantityRecorded !== false && item.lowThreshold != null && (item.productQuantity ?? item.currentQuantity) <= item.lowThreshold) {
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

type StockLot = { currentQuantity: number; unit: string; quantityRecorded?: boolean; status?: string };
type SafetyStock = { lowThreshold: number | null; lowThresholdUnit: string | null };

/** A product's stock, adding its active, counted lots in the unit its safety stock is set in; lots in another unit are left out. */
export function productStock(lots: StockLot[], unit: string) {
  return Number(lots.filter((lot) => sameUnit(lot.unit, unit) && lot.quantityRecorded !== false && (lot.status ?? "active") === "active")
    .reduce((sum, lot) => sum + lot.currentQuantity, 0).toFixed(6));
}

/** A product's stock in its safety-stock unit, and whether that is at or below its safety stock. */
export function productSafetyStock(product: SafetyStock, lots: StockLot[]) {
  if (product.lowThreshold == null || !product.lowThresholdUnit) return { total: undefined, low: false };
  const total = productStock(lots, product.lowThresholdUnit);
  return { total, low: total <= product.lowThreshold };
}

/** A lot's flags: "low" compares its product's total in the safety-stock unit; stock saved before products keeps its own threshold. */
export function lotRiskFlags(lot: InventoryRiskInput & { unit: string }, product: SafetyStock | null | undefined, productLots: StockLot[], now = new Date()) {
  if (!product) return getInventoryRiskFlags(lot, now);
  const productQuantity = product.lowThreshold != null && product.lowThresholdUnit ? productStock(productLots, product.lowThresholdUnit) : undefined;
  return getInventoryRiskFlags({ ...lot, lowThreshold: productQuantity === undefined ? null : product.lowThreshold, productQuantity }, now);
}

/** The safety stock a lot exports in its own unit: its product's when set in that unit, else the lot's own (from before products). */
export function exportedSafetyStock(lot: { unit: string; lowThreshold: number | null; product?: SafetyStock | null }) {
  if (!lot.product) return lot.lowThreshold;
  return lot.product.lowThreshold != null && sameUnit(lot.product.lowThresholdUnit, lot.unit) ? lot.product.lowThreshold : null;
}

/** What low stock asks for, by 大类. Biological material is grown again from its own stock; a sample cannot be replaced. */
export function lowStockAdvice(groupKey: string | null | undefined): "purchase" | "expand" | "remaining" {
  return groupKey === "biological" ? "expand" : groupKey === "sample" ? "remaining" : "purchase";
}

export const managementModeLabels: Record<string, string> = { information: "Record only", package: "By container", precise: "Precise use" };

/** Units stock and safety stock are counted in. */
export const stockUnits = ["mL", "µL", "L", "g", "mg", "µg", "vial", "tube", "bottle", "box", "pack", "cylinder", "piece", "reaction"];

const unitWords = new Map<string, string>([
  ...stockUnits.flatMap((unit) => [[unit.toLowerCase(), unit], ...(zhUi[unit] ? [[zhUi[unit], unit]] : [])] as [string, string][]),
  ["ul", "µL"], ["ug", "µg"], ["pcs", "piece"], ["pc", "piece"], ["件", "piece"], ["只", "piece"], ["瓶装", "bottle"],
  // A kit arrives and is counted as a box.
  ["kit", "box"], ["套", "box"],
]);

/** A unit as printed (盒, ML, μL, pcs, tube(s), bottles) in the spelling stock uses; anything else is kept as printed. */
export function stockUnit(value: string) {
  const word = value.trim().replace(/\(s\)$/i, "").replace(/μ/g, "µ");
  const lower = word.toLowerCase();
  return unitWords.get(lower) ?? unitWords.get(lower.replace(/e?s$/, "")) ?? unitWords.get(lower.replace(/s$/, "")) ?? word;
}

/** Whether two units are the same once spelled the way stock uses them: 瓶 and bottle, 个 and piece, uL and µL. */
export function sameUnit(a: string | null | undefined, b: string | null | undefined) {
  return !!a && !!b && stockUnit(a) === stockUnit(b);
}

/** Decimal places by unit: counted units (bottles, boxes, pieces, reactions) are whole numbers, mL to 1 µL, g to 0.1 mg; other units keep 3. */
const unitDecimals: Record<string, number> = { L: 3, mL: 3, "µL": 1, g: 4, mg: 3, "µg": 1, vial: 0, tube: 0, bottle: 0, box: 0, pack: 0, cylinder: 0, piece: 0, reaction: 0 };

/** How many decimal places an amount in this unit keeps (docs/modules/inventory/ai-import-20261030, Q172). */
export function quantityDecimals(unit: string | null | undefined) {
  return unitDecimals[stockUnit(unit ?? "")] ?? 3;
}

/** The smallest amount a unit keeps, as an input's min and step: "1" for bottles, "0.001" for mL. */
export function quantityStep(unit: string | null | undefined) {
  const decimals = quantityDecimals(unit);
  return (10 ** -decimals).toFixed(decimals);
}

/** Why a typed amount is finer than its unit keeps, or undefined. */
export function quantityPrecisionProblem(value: number, unit: string) {
  const decimals = quantityDecimals(unit);
  if (Math.abs(Number(value.toFixed(decimals)) - value) < 1e-9) return undefined;
  return decimals ? `${unit}: at most ${decimals} decimal places.` : `${unit}: whole numbers only.`;
}

/** A typed amount must keep its unit's precision: whole bottles, mL to 0.001 and so on (Q172). */
export function assertPrecision(quantity: number, unit: string) {
  const problem = quantityPrecisionProblem(quantity, unit);
  if (problem) throw new Error(problem);
}

/**
 * The quantity change a typed movement books, negative going out. It must keep its unit's precision; taking out the
 * amount shown for a balance kept finer than its unit (experiment use can leave 4.4725 mL, shown as 4.473) empties it.
 */
export function movementChange(typed: number, item: { currentQuantity: number; unit: string }, inbound: boolean) {
  assertPrecision(typed, item.unit);
  const remainder = !inbound && typed > item.currentQuantity && typed - item.currentQuantity < 10 ** -quantityDecimals(item.unit);
  const amount = remainder ? item.currentQuantity : typed;
  return inbound ? amount : -amount;
}

/** An amount to its unit's precision without trailing zeros; a trace too small to show reads as “<0.001”. */
export function formatStockQuantity(value: number, unit: string | null | undefined) {
  const shown = Number(value.toFixed(quantityDecimals(unit)));
  return shown === 0 && value !== 0 ? `<${quantityStep(unit)}` : String(shown || 0);
}

/** The fixed control levels. Chemical controls apply to any product; biosafety levels to biological material and samples. */
export const inventoryControlLevels = [
  { key: "hazardous", label: "Hazardous chemical" },
  { key: "highly_toxic", label: "Highly toxic" },
  { key: "precursor", label: "Drug precursor" },
  { key: "explosive_precursor", label: "Explosive precursor" },
  { key: "narcotic", label: "Narcotic or psychotropic" },
] as const;
export const inventoryBiosafetyLevels = [
  { key: "bsl1", label: "BSL-1" },
  { key: "bsl2", label: "BSL-2" },
  { key: "bsl3", label: "BSL-3" },
] as const;
const controlLevels = [...inventoryControlLevels, ...inventoryBiosafetyLevels];
export const inventoryControlKeys: readonly string[] = controlLevels.map((level) => level.key);
export const controlLevelName = (key: string) => controlLevels.find((level) => level.key === key)?.label ?? key;

/** Highly toxic and drug-precursor stock is recorded precisely, with who took it and why, and its product needs an SDS. */
export function isStrictlyControlled(levels: readonly string[]) {
  return levels.includes("highly_toxic") || levels.includes("precursor");
}

/** The documents a product keeps, as AttachmentLink link types on the product. */
export const productDocumentKinds = ["product_manual", "sds", "kit_manual"] as const;
export const productDocumentKindNames: Record<(typeof productDocumentKinds)[number], string> = { product_manual: "Product manual", sds: "SDS", kit_manual: "Kit manual" };

/** Taking strictly controlled stock out (use or discard) records who did it and what for. */
export function controlledUseProblem(levels: readonly string[], movement: { type: string; performedBy?: string | null; notes?: string | null }) {
  if (!isStrictlyControlled(levels) || (movement.type !== "consume" && movement.type !== "discard")) return null;
  if (!movement.performedBy?.trim()) return "Record who took this highly toxic or drug-precursor stock.";
  if (!movement.notes?.trim()) return "Record the purpose of using this highly toxic or drug-precursor stock.";
  return null;
}

/** Per kit component, what a box records about it; a component without an entry is present. */
export type KitComponentStates = Record<string, { state?: string; location?: string }>;

/** A box is complete while every component of its kit is present; one used up or missing makes the whole box incomplete. */
export function kitBoxStatus(components: { id: string; name: string }[], states: KitComponentStates) {
  const unavailable = components.flatMap((component) => {
    const state = states[component.id]?.state;
    return state === "used_up" || state === "missing" ? [{ id: component.id, name: component.name, state }] : [];
  });
  return { complete: unavailable.length === 0, unavailable };
}

/** Units a remaining amount is read in: a gas cylinder by its gauge, a kit by reactions, everything else by amount. */
export function observationUnits(typeKey: string | null | undefined) {
  return typeKey === "gas" ? ["MPa", "%"] : typeKey === "kit" ? ["reactions", "%"] : ["mL", "µL", "L", "mg", "g", "%"];
}
export const observationUnitValues = ["mL", "µL", "L", "mg", "g", "reactions", "MPa", "%"] as const;

type ReversibleMovement = {
  type: string;
  quantityChange: number;
  purchaseId?: string | null;
  reversesTransactionId?: string | null;
  reversedBy?: { id: string } | null;
  materialUse?: { id: string } | null;
};

/**
 * Why a movement cannot be undone here, or null. A reversal books the opposite quantity and leaves the original as
 * recorded; material used in an experiment, purchase receipts and container stock are corrected where they were made.
 */
export function movementReversalProblem(movement: ReversibleMovement, item: { managementMode: string; currentQuantity: number }) {
  if (movement.reversedBy) return "This movement has already been reversed.";
  if (movement.reversesTransactionId) return "This movement is itself a reversal; record the movement again instead.";
  if (movement.quantityChange === 0) return "This movement changed no quantity.";
  if (movement.materialUse) return "Correct this in the experiment's material list.";
  if (movement.purchaseId) return "This movement came with a purchase; correct the purchase receipt instead.";
  if (item.managementMode !== "precise") return "Stock of this item changes through its containers.";
  if (item.currentQuantity - movement.quantityChange < 0) return "Reversing this movement would make stock negative.";
  return null;
}

const blockerNouns: Record<string, [string, string]> = {
  movements: ["stock movement", "stock movements"],
  materialUses: ["experiment material use", "experiment material uses"],
  receipts: ["purchase receipt", "purchase receipts"],
  purchases: ["linked purchase", "linked purchases"],
  containerActions: ["container action", "container actions"],
  observations: ["remaining-amount reading", "remaining-amount readings"],
  aliquots: ["aliquot", "aliquots"],
  sampleEvents: ["sample event", "sample events"],
  lots: ["lot", "lots"],
  products: ["product", "products"],
};

/** What still refers to a record ("2 stock movements"); a record can be deleted only when this is empty. */
export function deleteBlockers(counts: Partial<Record<keyof typeof blockerNouns, number>>) {
  return Object.entries(counts).flatMap(([key, count]) => count ? [`${count} ${blockerNouns[key][count === 1 ? 0 : 1]}`] : []);
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
  return item.quantityRecorded === false ? "数量未记录 / Quantity not recorded" : `${formatStockQuantity(item.currentQuantity, item.unit)} ${item.unit}`;
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
