import { deleteBlockers, isStrictlyControlled } from "./inventory";

// What a bulk action on the stock or product list does to each selected record, worked out before anything is written
// (docs/modules/inventory/bulk-duplicates-20261030/PLAN.md). Quantities change only through movements; a bulk take-out
// moves containers out of the store one by one, as on the stock page.

type BulkOutcome = "change" | "delete" | "archive" | "skip";
export type BulkEntry = { id: string; name: string; outcome: BulkOutcome; reason?: string };

export const stockBulkActions = ["archive", "restore", "move", "pi", "takeOut", "delete"] as const;
type StockBulkAction = (typeof stockBulkActions)[number];
export const productBulkActions = ["archive", "restore", "classify", "addControl", "removeControl", "reminder", "delete"] as const;
type ProductBulkAction = (typeof productBulkActions)[number];

export function bulkStockPlan(
  action: StockBulkAction,
  rows: (Row & { locationId: string | null; principalInvestigator: string | null; blockers: string[]; managementMode: string; inStore: number })[],
  params: { locationId?: string | null; principalInvestigator?: string | null; count?: number } = {},
) {
  return rows.map((row) => {
    if (action === "archive" || action === "restore") return lifecycle(row, action);
    if (action === "delete") return removal(row, row.blockers);
    if (action === "takeOut") {
      if (row.status === "archived") return entry(row, "skip", "Archived; restore it first.");
      if (row.managementMode !== "package") return entry(row, "skip", "Not kept as containers; record use on its page.");
      return row.inStore < (params.count ?? 1) ? entry(row, "skip", `Only ${row.inStore} in store.`) : entry(row, "change");
    }
    if (action === "move") {
      if (row.status === "archived") return entry(row, "skip", "Archived; restore it first.");
      return row.locationId === (params.locationId ?? null) ? entry(row, "skip", "Already in this location.") : entry(row, "change");
    }
    return (row.principalInvestigator ?? null) === (params.principalInvestigator ?? null) ? entry(row, "skip", "Already has this PI.") : entry(row, "change");
  });
}

export function bulkProductPlan(
  action: ProductBulkAction,
  rows: (Row & { typeId: string | null; groupKey: string | null; controlLevels: string[]; lots: number; impreciseLots: number; lowThreshold: number | null })[],
  params: { typeId?: string | null; groupKey?: string | null; level?: string; reminder?: "none" | "usedUp" } = {},
) {
  return rows.map((row) => {
    if (action === "archive" || action === "restore") return lifecycle(row, action);
    // A stock reminder set in bulk is unit-free: none, or when the product is used up (Q241).
    if (action === "reminder") {
      if (params.reminder === "usedUp") return row.lowThreshold === 0 ? entry(row, "skip", "Already reminds when used up.") : entry(row, "change");
      return row.lowThreshold == null ? entry(row, "skip", "Already has no stock reminder.") : entry(row, "change");
    }
    if (action === "delete") return removal(row, deleteBlockers({ lots: row.lots }));
    if (action === "classify") {
      const same = row.typeId === (params.typeId ?? null) && row.groupKey === (params.groupKey ?? null);
      return same ? entry(row, "skip", "Already classified this way.") : entry(row, "change");
    }
    const has = !!params.level && row.controlLevels.includes(params.level);
    if (action === "removeControl") return has ? entry(row, "change") : entry(row, "skip", "Does not have this control level.");
    if (has) return entry(row, "skip", "Already has this control level.");
    // Highly toxic and drug-precursor stock is recorded precisely, so every lot must already be.
    if (params.level && isStrictlyControlled([params.level]) && row.impreciseLots) return entry(row, "skip", `${row.impreciseLots} ${row.impreciseLots === 1 ? "lot is" : "lots are"} not recorded precisely.`);
    return entry(row, "change");
  });
}

type Row = { id: string; name: string; status: string };
const entry = (row: Row, outcome: BulkOutcome, reason?: string): BulkEntry => ({ id: row.id, name: row.name, outcome, ...(reason ? { reason } : {}) });

function lifecycle(row: Row, action: "archive" | "restore") {
  const archived = row.status === "archived";
  if (action === "archive") return archived ? entry(row, "skip", "Already archived.") : entry(row, "change");
  return archived ? entry(row, "change") : entry(row, "skip", "Not archived.");
}

/** Deleting keeps the single-record rule: only what nothing refers to goes; the rest is archived instead. */
function removal(row: Row, blockers: string[]) {
  if (!blockers.length) return entry(row, "delete");
  const reason = `Still referred to: ${blockers.join(", ")}.`;
  return row.status === "archived" ? entry(row, "skip", reason) : entry(row, "archive", reason);
}
