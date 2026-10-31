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
  samples: number;
  childLocations: number;
};

export function inventoryLocationReferenceSummary(counts: InventoryLocationReferenceCounts) {
  return {
    items: counts.items,
    movements: counts.itemsFrom + counts.itemsTo,
    samples: counts.samples,
    childLocations: counts.childLocations,
  };
}

export function inventoryLocationDeleteBlockers(counts: InventoryLocationReferenceCounts) {
  const summary = inventoryLocationReferenceSummary(counts);
  return [
    summary.items ? `${summary.items} assigned inventory item${summary.items === 1 ? "" : "s"}` : undefined,
    summary.movements ? `${summary.movements} stock-movement reference${summary.movements === 1 ? "" : "s"}` : undefined,
    summary.samples ? `${summary.samples} sample${summary.samples === 1 ? "" : "s"}` : undefined,
    summary.childLocations ? `${summary.childLocations} child location${summary.childLocations === 1 ? "" : "s"}` : undefined,
  ].filter((value): value is string => Boolean(value));
}

/**
 * Temperatures are kept as text ("4 °C", "Room temperature"); the form takes a number in °C. Older free text such as
 * "4 ℃" or "-80°C" reads back as its number; text that is not one number (a range, a note) reads as undefined.
 */
export function readLocationTemperature(text: string | null | undefined): { degrees: string; room: boolean } | undefined {
  const value = text?.trim();
  if (!value) return { degrees: "", room: false };
  if (/^(room temperature|rt|室温|常温)$/i.test(value)) return { degrees: "", room: true };
  const number = value.replace(/\s*(°\s*C|℃|C|摄氏度)$/i, "").replace("−", "-");
  return /^[-+]?\d+(\.\d+)?$/.test(number) ? { degrees: String(Number(number)), room: false } : undefined;
}

export function locationTemperature(degrees: string | undefined, room: boolean) {
  if (room) return "Room temperature";
  const value = degrees?.trim();
  if (!value) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < -273 || number > 300) throw new Error("Enter the temperature as a number of °C.");
  return `${number} °C`;
}

/** “4 ℃” and “4 °C” look the same everywhere; text that is not one temperature is shown as written. */
export function temperatureLabel(text: string | null | undefined) {
  const read = readLocationTemperature(text);
  if (!read) return text?.trim() || null;
  return locationTemperature(read.degrees, read.room) ?? null;
}

/** Each location's full path, outermost first: “16F fridge / Shelf 2 / Box A”. */
export function locationPaths(locations: { id: string; name: string; parentLocationId: string | null }[]) {
  const byId = new Map(locations.map((location) => [location.id, location]));
  return new Map(locations.map((location) => {
    const names = [location.name];
    const seen = new Set([location.id]);
    for (let parent = location.parentLocationId && byId.get(location.parentLocationId); parent && !seen.has(parent.id); parent = parent.parentLocationId ? byId.get(parent.parentLocationId) : undefined) {
      seen.add(parent.id);
      names.unshift(parent.name);
    }
    return [location.id, names.join(" / ")];
  }));
}
