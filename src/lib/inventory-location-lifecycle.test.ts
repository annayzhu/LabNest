import { describe, expect, it } from "vitest";
import { inventoryLocationDeleteBlockers, inventoryLocationReferenceSummary } from "./inventory-location-lifecycle";

describe("inventory location lifecycle", () => {
  it("allows permanent deletion only when the location is unreferenced", () => {
    expect(inventoryLocationDeleteBlockers({ items: 0, itemsFrom: 0, itemsTo: 0, samples: 0, childLocations: 0 })).toEqual([]);
  });

  it("reports every provenance reference that prevents deletion", () => {
    const counts = { items: 2, itemsFrom: 1, itemsTo: 3, samples: 2, childLocations: 1 };
    expect(inventoryLocationReferenceSummary(counts)).toEqual({ items: 2, movements: 4, samples: 2, childLocations: 1 });
    expect(inventoryLocationDeleteBlockers(counts)).toEqual([
      "2 assigned inventory items",
      "4 stock-movement references",
      "2 samples",
      "1 child location",
    ]);
  });
});
