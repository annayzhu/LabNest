import { describe, expect, it } from "vitest";
import { stockRows, type SearchLot } from "./inventory-search";

const lot = (id: string, fields: Partial<SearchLot> = {}): SearchLot => ({
  id, productId: "p_pbs", name: "PBS 10x", brand: "Gibco", catalogNumber: "10010", lotNumber: null, barcode: null, aliquotCode: null,
  managementMode: "precise", currentQuantity: 1, unit: "bottle", quantityRecorded: true, expiryDate: null, location: "Shelf 2", inStore: 0, flags: [], ...fields,
});
const products = new Map([["p_pbs", { kind: "Solutions & buffers", strict: false }], ["p_cd3", { kind: "Antibody", strict: false }]]);

describe("stock search rows (Q180, Q181)", () => {
  it("shows a product once with its lots earliest-expiry first, the earliest with stock chosen, and totals in one unit; an empty lot does not make the product out of stock", () => {
    const [row] = stockRows([
      lot("late", { expiryDate: new Date("2027-06-01"), unit: "瓶", currentQuantity: 2 }),
      lot("empty", { expiryDate: new Date("2026-12-01"), currentQuantity: 0, flags: ["used_up"] }),
      lot("soon", { expiryDate: new Date("2027-01-01"), currentQuantity: 3, location: "Freezer A / Shelf 1" }),
    ], products, "");
    expect(row).toMatchObject({ name: "PBS 10x", detail: "Gibco · 10010", kind: "Solutions & buffers", href: "/inventory/products/p_pbs", expiry: "2027-01-01", focusLotId: "soon", flags: [] });
    expect(row.lots.map((entry) => entry.id)).toEqual(["empty", "soon", "late"]);
    expect(row.totals).toEqual([{ quantity: 5, unit: "bottle" }]);
    expect(row.places).toEqual(["Shelf 2", "Freezer A / Shelf 1"]);
  });

  it("marks a product used up only when every lot is, and out of stock only when its lots say so (Q237, Q238)", () => {
    expect(stockRows([lot("a", { currentQuantity: 0, flags: ["used_up"] }), lot("b", { currentQuantity: 0, flags: ["used_up"] })], products, "")[0].flags).toEqual(["used_up"]);
    expect(stockRows([lot("a", { currentQuantity: 0, flags: ["used_up", "depleted"] })], products, "")[0].flags).toEqual(["depleted", "used_up"]);
    expect(stockRows([lot("a", { currentQuantity: 0, held: 1, flags: [] })], products, "")[0].focusLotId).toBe("a");
  });

  it("puts an exact lot number or code first and focuses that lot; a single lot opens its own page", () => {
    const rows = stockRows([
      lot("pbs"),
      lot("cd3", { productId: "p_cd3", name: "Anti-human CD3", lotNumber: "B312451" }),
      lot("legacy", { productId: null, name: "Old buffer", barcode: "b312451" }),
    ], products, "B312451");
    expect(rows.map((row) => [row.key, row.exact])).toEqual([["p_cd3", true], ["legacy", true], ["p_pbs", false]]);
    expect(rows[0]).toMatchObject({ focusLotId: "cd3", href: "/inventory/cd3" });
    expect(rows[1]).toMatchObject({ kind: null, href: "/inventory/legacy" });
  });

  it("ranks names that start with the search before names that only contain it, and keeps recency for an empty search", () => {
    const lots = [lot("a", { productId: null, name: "Anti-PBS antibody" }), lot("b", { productId: null, name: "PBS tablets" })];
    expect(stockRows(lots, products, "pbs").map((row) => row.key)).toEqual(["b", "a"]);
    expect(stockRows(lots, products, "").map((row) => row.key)).toEqual(["a", "b"]);
  });
});
