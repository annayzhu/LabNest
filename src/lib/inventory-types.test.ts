import { describe, expect, it } from "vitest";
import { inventoryClassFromCategory, inventoryTypeDefaults, inventoryTypeFields, similarInventoryTypes } from "./inventory-types";

const types = [
  { key: "antibody", label: "Antibody", inventoryGroupKey: "reagent" },
  { key: "kit", label: "Kit", inventoryGroupKey: "reagent" },
  { key: "chemical", label: "Chemical", inventoryGroupKey: "reagent" },
  { key: "accessory", label: "Accessory", inventoryGroupKey: "equipment" },
  { key: "plasmid", label: "Plasmid", inventoryGroupKey: "biological" },
] as const;

describe("inventoryClassFromCategory (Q138)", () => {
  it.each([
    ["reagent", "reagent", null],
    ["consumable", "consumable", null],
    ["antibody", "reagent", "antibody"],
    ["kit", "reagent", "kit"],
    ["chemical", "reagent", "chemical"],
    ["instrument_accessory", "equipment", "accessory"],
  ])("maps the old category %s", (category, groupKey, typeKey) => {
    expect(inventoryClassFromCategory(category, types)).toEqual({ groupKey, typeKey });
  });

  it.each(["biological_sample", "other", "", undefined, "Freezer stuff"])("leaves %s unclassified for a person to decide", (category) => {
    expect(inventoryClassFromCategory(category, types)).toEqual({ groupKey: null, typeKey: null });
  });

  it("reads an imported type by key, English label or Chinese label", () => {
    expect(inventoryClassFromCategory("Plasmid", types)).toEqual({ groupKey: "biological", typeKey: "plasmid" });
    expect(inventoryClassFromCategory("质粒", types)).toEqual({ groupKey: "biological", typeKey: "plasmid" });
    expect(inventoryClassFromCategory(" ANTIBODY ", types)).toEqual({ groupKey: "reagent", typeKey: "antibody" });
  });

  it("reads an imported 大类 without a type", () => {
    expect(inventoryClassFromCategory("Consumables", types)).toEqual({ groupKey: "consumable", typeKey: null });
    expect(inventoryClassFromCategory("生物材料", types)).toEqual({ groupKey: "biological", typeKey: null });
  });
});

describe("similar types (Q141)", () => {
  const existing = [
    { id: "1", label: "Antibody", fields: [{ key: "target", label: "Target" }, { key: "clone", label: "Clone" }] },
    { id: "2", label: "Chemical", fields: [{ key: "purity", label: "Purity" }, { key: "grade", label: "Grade" }] },
    { id: "3", label: "Solutions & buffers", fields: [{ key: "ph", label: "pH" }] },
  ];

  it("finds a type whose name contains, or is contained in, the new name, in English or Chinese", () => {
    expect(similarInventoryTypes({ label: "Primary antibody", fields: [] }, existing).map((type) => type.id)).toEqual(["1"]);
    expect(similarInventoryTypes({ label: "抗体", fields: [] }, existing).map((type) => type.id)).toEqual(["1"]);
    expect(similarInventoryTypes({ label: "Buffer", fields: [] }, existing).map((type) => type.id)).toEqual(["3"]);
  });

  it("finds a type that already records most of the same fields", () => {
    expect(similarInventoryTypes({ label: "Hazardous reagent", fields: ["Purity", "grade", "Hazard"] }, existing).map((type) => type.id)).toEqual(["2"]);
    expect(similarInventoryTypes({ label: "Gel", fields: ["Percentage"] }, existing)).toEqual([]);
  });
});

describe("type templates (Q139)", () => {
  it("reads field definitions, keeping only well-formed ones", () => {
    expect(inventoryTypeFields([{ key: "target", label: "Target" }, { key: "class", label: "Class", kind: "choice", options: ["Primary", "Secondary"] }, { label: "no key" }, "x"])).toEqual([
      { key: "target", label: "Target", kind: "text" },
      { key: "class", label: "Class", kind: "choice", options: ["Primary", "Secondary"] },
    ]);
  });

  it("reads inventory defaults with safe fallbacks", () => {
    expect(inventoryTypeDefaults({ inventory: { managementMode: "package", unit: "box", tracksLot: true, tracksExpiry: false } })).toEqual({ managementMode: "package", unit: "box", tracksLot: true, tracksExpiry: false });
    expect(inventoryTypeDefaults({ entryClass: "oligo" })).toEqual({ managementMode: "information", unit: "", tracksLot: true, tracksExpiry: true });
  });
});
