// When two products, or two stock lots, are the same thing, and what merging two products keeps
// (docs/modules/inventory/bulk-duplicates-20261030/PLAN.md).

const fold = (value: string | null | undefined) => value?.normalize("NFKC").toLowerCase();

/** A catalogue number as compared for identity: no case, spaces, hyphens or full-width forms. */
export function catalogKey(value: string | null | undefined) {
  return fold(value)?.replace(/[\s\-‐‑‒–—―−]+/g, "") || null;
}

const brandKey = (value: string | null | undefined) => fold(value)?.replace(/\s+/g, " ").trim() || null;
const casKey = (value: string | null | undefined) => fold(value)?.replace(/\s+/g, "") || null;
const nameKey = (value: string | null | undefined) => fold(value)?.replace(/[\s\p{P}\p{S}]+/gu, "") || null;

/** Two ids in order, so a pair marked as not duplicates reads the same either way round. */
export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export type DuplicateReason = "catalogue" | "cas" | "name";
type ProductIdentity = { id: string; name: string; englishName: string | null; brand: string | null; catalogNumber: string | null; casNumber: string | null };

/**
 * Products that may be the same: the same catalogue number (exact when the brand matches too), the same CAS number, or the
 * same name in either language. Pairs keep the order of `products`; pairs marked as not duplicates are left out.
 */
export function duplicateProductPairs<T extends ProductIdentity>(products: readonly T[], dismissed: ReadonlySet<string> = new Set()) {
  const pairs = new Map<string, { first: T; second: T; reasons: DuplicateReason[]; exact: boolean }>();
  const rules: [DuplicateReason, (product: T) => (string | null)[]][] = [
    ["catalogue", (product) => [catalogKey(product.catalogNumber)]],
    ["cas", (product) => [casKey(product.casNumber)]],
    ["name", (product) => [nameKey(product.name), nameKey(product.englishName)]],
  ];
  for (const [reason, keysOf] of rules) {
    const groups = new Map<string, T[]>();
    for (const product of products) {
      for (const key of new Set(keysOf(product))) if (key) groups.set(key, [...(groups.get(key) ?? []), product]);
    }
    for (const group of groups.values()) {
      group.forEach((first, index) => group.slice(index + 1).forEach((second) => {
        const key = pairKey(first.id, second.id);
        if (dismissed.has(key)) return;
        const pair = pairs.get(key) ?? { first, second, reasons: [], exact: false };
        if (!pair.reasons.includes(reason)) pair.reasons.push(reason);
        if (reason === "catalogue" && brandKey(first.brand) === brandKey(second.brand)) pair.exact = true;
        pairs.set(key, pair);
      }));
    }
  }
  return [...pairs.values()];
}

type LotIdentity = { id: string; productId: string | null; lotNumber: string | null; locationId: string | null; status: string };

/** Active lots of one product with the same lot number and location: probably registered twice. Lots are never merged automatically. */
export function duplicateLotGroups<T extends LotIdentity>(lots: readonly T[], dismissed: ReadonlySet<string> = new Set()) {
  const groups = new Map<string, T[]>();
  for (const lot of lots) {
    const lotNumber = fold(lot.lotNumber)?.replace(/\s+/g, "");
    if (!lot.productId || !lotNumber || lot.status !== "active") continue;
    const key = [lot.productId, lotNumber, lot.locationId ?? ""].join("|");
    groups.set(key, [...(groups.get(key) ?? []), lot]);
  }
  return [...groups.values()].filter((group) => group.some((lot, index) => group.slice(index + 1).some((other) => !dismissed.has(pairKey(lot.id, other.id)))));
}

type MergeSide = {
  name: string; englishName: string | null; brand: string | null; catalogNumber: string | null; casNumber: string | null;
  typeId: string | null; groupKey: string | null; entityId: string | null; fieldValues: unknown; controlLevels: string[];
  lowThreshold: number | null; lowThresholdUnit: string | null; notes: string | null;
};

/**
 * What the kept product holds after another is merged into it: its own values first, the other's where it has none, both
 * products' control levels and notes. When both set a different safety stock, someone chooses which one stays.
 */
export function mergeProductPlan(keep: MergeSide, other: MergeSide, safetyStock?: "keep" | "other") {
  const hasStock = (side: MergeSide) => side.lowThreshold != null && !!side.lowThresholdUnit;
  const conflict = hasStock(keep) && hasStock(other) && (keep.lowThreshold !== other.lowThreshold || keep.lowThresholdUnit !== other.lowThresholdUnit);
  if (conflict && !safetyStock) return { needsSafetyStockChoice: true as const };
  const stock = conflict ? (safetyStock === "other" ? other : keep) : hasStock(keep) ? keep : other;
  const classified = keep.typeId || keep.groupKey ? keep : other;
  return {
    needsSafetyStockChoice: false as const,
    data: {
      brand: keep.brand ?? other.brand,
      catalogNumber: keep.catalogNumber ?? other.catalogNumber,
      englishName: keep.englishName ?? other.englishName,
      casNumber: keep.casNumber ?? other.casNumber,
      entityId: keep.entityId ?? other.entityId,
      typeId: classified.typeId,
      groupKey: classified.groupKey,
      fieldValues: { ...(other.fieldValues as Record<string, string>), ...(keep.fieldValues as Record<string, string>) },
      controlLevels: [...new Set([...keep.controlLevels, ...other.controlLevels])],
      lowThreshold: hasStock(stock) ? stock.lowThreshold : null,
      lowThresholdUnit: hasStock(stock) ? stock.lowThresholdUnit : null,
      notes: [...new Set([keep.notes?.trim(), other.notes?.trim()].filter(Boolean))].join("\n\n") || null,
    },
  };
}
