import { describe, expect, it } from "vitest";
import { inventoryLocationDeleteBlockers, inventoryLocationReferenceSummary, locationPaths, locationTemperature, locationWithin, readLocationTemperature, temperatureLabel } from "./inventory-location-lifecycle";

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

describe("location temperature", () => {
  it("reads older free text back as a number of °C", () => {
    expect(readLocationTemperature("4 ℃")).toEqual({ degrees: "4", room: false });
    expect(readLocationTemperature("-80°C")).toEqual({ degrees: "-80", room: false });
    expect(readLocationTemperature("−20")).toEqual({ degrees: "-20", room: false });
    expect(readLocationTemperature("室温")).toEqual({ degrees: "", room: true });
    expect(readLocationTemperature(null)).toEqual({ degrees: "", room: false });
    expect(readLocationTemperature("2–8 °C")).toBeUndefined();
  });

  it("stores a number with the unit, or room temperature, and refuses what is not a temperature", () => {
    expect(locationTemperature("4", false)).toBe("4 °C");
    expect(locationTemperature("-80.5", false)).toBe("-80.5 °C");
    expect(locationTemperature("", true)).toBe("Room temperature");
    expect(locationTemperature("", false)).toBeUndefined();
    expect(() => locationTemperature("-400", false)).toThrow("°C");
    expect(temperatureLabel("4 ℃")).toBe("4 °C");
    expect(temperatureLabel("2–8 °C")).toBe("2–8 °C");
  });
});

describe("location paths", () => {
  it("names each location by the locations it sits in, and stops at a loop", () => {
    const paths = locationPaths([
      { id: "box", name: "Box A", parentLocationId: "shelf" },
      { id: "shelf", name: "Shelf 2", parentLocationId: "fridge" },
      { id: "fridge", name: "16F fridge", parentLocationId: null },
      { id: "x", name: "X", parentLocationId: "y" },
      { id: "y", name: "Y", parentLocationId: "x" },
    ]);
    expect(paths.get("box")).toBe("16F fridge / Shelf 2 / Box A");
    expect(paths.get("fridge")).toBe("16F fridge");
    expect(paths.get("x")).toBe("Y / X");
  });

  it("finds every place inside a location, however deep, and nothing beside it (Q194)", () => {
    const places = [
      { id: "fridge", parentLocationId: null },
      { id: "shelf", parentLocationId: "fridge" },
      { id: "box", parentLocationId: "shelf" },
      { id: "bench", parentLocationId: null },
    ];
    expect(locationWithin(places, "fridge").sort()).toEqual(["box", "fridge", "shelf"]);
    expect(locationWithin(places, "shelf").sort()).toEqual(["box", "shelf"]);
    expect(locationWithin(places, "bench")).toEqual(["bench"]);
  });
});
