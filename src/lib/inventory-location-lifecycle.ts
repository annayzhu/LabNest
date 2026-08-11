export const inventoryLocationTypes = [
  "freezer",
  "fridge",
  "shelf",
  "box",
  "position",
  "drawer",
  "plate",
  "rack",
  "room",
  "other",
] as const;

export type InventoryLocationTypeValue = (typeof inventoryLocationTypes)[number];

export type InventoryLocationReferenceCounts = {
  items: number;
  itemsFrom: number;
  itemsTo: number;
  sampleEventsFrom: number;
  sampleEventsTo: number;
  childLocations: number;
};

export function inventoryLocationReferenceSummary(counts: InventoryLocationReferenceCounts) {
  return {
    items: counts.items,
    movements: counts.itemsFrom + counts.itemsTo,
    sampleEvents: counts.sampleEventsFrom + counts.sampleEventsTo,
    childLocations: counts.childLocations,
  };
}

export function inventoryLocationDeleteBlockers(counts: InventoryLocationReferenceCounts) {
  const summary = inventoryLocationReferenceSummary(counts);
  return [
    summary.items ? `${summary.items} assigned inventory item${summary.items === 1 ? "" : "s"}` : undefined,
    summary.movements ? `${summary.movements} stock-movement reference${summary.movements === 1 ? "" : "s"}` : undefined,
    summary.sampleEvents ? `${summary.sampleEvents} sample-event reference${summary.sampleEvents === 1 ? "" : "s"}` : undefined,
    summary.childLocations ? `${summary.childLocations} child location${summary.childLocations === 1 ? "" : "s"}` : undefined,
  ].filter((value): value is string => Boolean(value));
}
