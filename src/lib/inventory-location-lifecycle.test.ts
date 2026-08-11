import { describe, expect, it } from "vitest";
import { inventoryLocationDeleteBlockers, inventoryLocationReferenceSummary } from "./inventory-location-lifecycle";

describe("inventory location lifecycle", () => {
  it("allows permanent deletion only when the location is unreferenced", () => {
    expect(inventoryLocationDeleteBlockers({ items: 0, itemsFrom: 0, itemsTo: 0, sampleEventsFrom: 0, sampleEventsTo: 0, childLocations: 0 })).toEqual([]);
  });

  it("reports every provenance reference that prevents deletion", () => {
    const counts = { items: 2, itemsFrom: 1, itemsTo: 3, sampleEventsFrom: 2, sampleEventsTo: 0, childLocations: 1 };
    expect(inventoryLocationReferenceSummary(counts)).toEqual({ items: 2, movements: 4, sampleEvents: 2, childLocations: 1 });
    expect(inventoryLocationDeleteBlockers(counts)).toEqual([
      "2 assigned inventory items",
      "4 stock-movement references",
      "2 sample-event references",
      "1 child location",
    ]);
  });
});
