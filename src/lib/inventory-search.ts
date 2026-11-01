import type { Prisma } from "@/generated/prisma/client";
import { stockUnit, type InventoryRiskFlag } from "./inventory";

// Finding stock: what the stock list filters on, and the rows the inventory home shows as you type
// (docs/modules/inventory/home-20261031, Q180–Q181).

/** Names, codes, makers, the PI, the place (including the location it sits in) and the product's sequences. */
export function stockSearchWhere(query: string): Prisma.InventoryItemWhereInput {
  const contains = { contains: query, mode: "insensitive" as const };
  return {
    OR: [
      { name: contains }, { englishName: contains }, { positionCode: contains }, { location: { name: contains } }, { location: { parentLocation: { name: contains } } },
      { principalInvestigator: contains }, { barcode: contains }, { aliquotCode: contains }, { lotNumber: contains },
      { vendor: contains }, { brand: contains }, { catalogNumber: contains }, { casNumber: contains },
      ...strandWhere(query).map((entity) => ({ product: { entity } })),
    ],
  };
}

/** A run of letters may be part of a primer's or siRNA's strand: the entities whose sequence contains it, or none. */
export function strandWhere(query: string): Prisma.EntityWhereInput[] {
  if (!/^[A-Za-z\s]{6,}$/.test(query)) return [];
  return [{ sequenceLinks: { some: { sequenceVersion: { sequence: { contains: query.replace(/\s+/g, "").toUpperCase() } } } } }];
}

export type SearchLot = {
  id: string;
  productId: string | null;
  name: string;
  brand: string | null;
  catalogNumber: string | null;
  lotNumber: string | null;
  barcode: string | null;
  aliquotCode: string | null;
  managementMode: string;
  currentQuantity: number;
  unit: string;
  quantityRecorded: boolean;
  expiryDate: Date | null;
  location: string | null;
  /** Containers in store, for stock kept by container. */
  inStore: number;
  /** Containers out with someone and not yet used up: still stock, though not in store. */
  held?: number;
  flags: InventoryRiskFlag[];
};

/** What the inventory home shows: the first rows, and how many rows there are in all. */
export type StockSearch = { rows: StockRow[]; total: number };

export type RowLot = Pick<SearchLot, "id" | "lotNumber" | "managementMode" | "unit" | "quantityRecorded" | "location" | "inStore"> & { quantity: number; expiry: string | null };

export type StockRow = {
  /** The product, or the lot itself when it has no product. */
  key: string;
  name: string;
  detail: string;
  kind: string | null;
  href: string;
  strict: boolean;
  totals: { quantity: number; unit: string }[];
  places: string[];
  expiry: string | null;
  flags: InventoryRiskFlag[];
  /** Earliest expiry first, so the default lot is the one to use up first. */
  lots: RowLot[];
  focusLotId: string;
  /** A lot number, barcode, aliquot code or catalogue number equals the search. */
  exact: boolean;
};

const day = (date: Date | null) => date?.toISOString().slice(0, 10) ?? null;
const hasStock = (lot: SearchLot) => !lot.quantityRecorded || lot.currentQuantity + (lot.held ?? 0) > 0;

/**
 * Lots as one row per product. Rows whose code equals the search come first, then names starting with it, then the
 * rest, each in the order given (recency when nothing is searched). A row is used up only when all its lots are.
 */
export function stockRows(lots: SearchLot[], products: Map<string, { kind: string | null; strict: boolean }>, query: string): StockRow[] {
  const search = query.trim().toLowerCase();
  const exactLot = (lot: SearchLot) => !!search && [lot.lotNumber, lot.barcode, lot.aliquotCode, lot.catalogNumber].some((code) => code?.trim().toLowerCase() === search);
  const groups = Map.groupBy(lots, (lot) => lot.productId ?? lot.id);
  const ranked = [...groups].map(([key, group], index) => {
    const ordered = [...group].sort((a, b) => (day(a.expiryDate) ?? "9999").localeCompare(day(b.expiryDate) ?? "9999"));
    const name = ordered[0].name;
    const exact = ordered.find(exactLot);
    const rank = exact ? 0 : !search ? 3 : name.toLowerCase().startsWith(search) ? 1 : name.toLowerCase().includes(search) ? 2 : 3;
    return { rank, index, row: row(key, ordered, products.get(key), exact) };
  });
  return ranked.sort((a, b) => a.rank - b.rank || a.index - b.index).map((entry) => entry.row);
}

function row(key: string, lots: SearchLot[], product: { kind: string | null; strict: boolean } | undefined, exact: SearchLot | undefined): StockRow {
  const first = lots[0];
  const stocked = lots.filter(hasStock);
  const totals = new Map<string, { quantity: number; unit: string }>();
  for (const lot of lots.filter((entry) => entry.quantityRecorded)) {
    const code = stockUnit(lot.unit);
    const total = totals.get(code) ?? { quantity: 0, unit: lot.unit };
    totals.set(code, { ...total, quantity: Number((total.quantity + lot.currentQuantity).toFixed(6)) });
  }
  // Low and out of stock are the product's, so any lot carries them; a used-up lot beside stocked ones is no news (Q238).
  const flags = new Set(lots.flatMap((lot) => lot.flags));
  if (stocked.length) flags.delete("used_up");
  return {
    key,
    name: first.name,
    detail: [first.brand, first.catalogNumber].filter(Boolean).join(" · "),
    kind: product?.kind ?? null,
    href: lots.length === 1 || !first.productId ? `/inventory/${first.id}` : `/inventory/products/${first.productId}`,
    strict: product?.strict ?? false,
    totals: [...totals.values()],
    places: [...new Set(lots.flatMap((lot) => lot.location ? [lot.location] : []))],
    expiry: day(stocked.find((lot) => lot.expiryDate)?.expiryDate ?? null),
    flags: (["depleted", "low", "expired", "expiring", "used_up"] as const).filter((flag) => flags.has(flag)),
    lots: lots.map((lot) => ({ id: lot.id, lotNumber: lot.lotNumber, managementMode: lot.managementMode, quantity: lot.currentQuantity, unit: lot.unit, quantityRecorded: lot.quantityRecorded, location: lot.location, inStore: lot.inStore, expiry: day(lot.expiryDate) })),
    focusLotId: (exact ?? stocked[0] ?? first).id,
    exact: !!exact,
  };
}
