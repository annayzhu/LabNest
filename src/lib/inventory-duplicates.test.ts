import { describe, expect, it } from "vitest";
import { catalogKey, duplicateLotGroups, duplicateProductPairs, mergeProductPlan, pairKey, productMatches } from "./inventory-duplicates";

describe("catalogKey", () => {
  it("compares catalogue numbers without case, spaces, hyphens or full-width forms", () => {
    expect(catalogKey("S-2002")).toBe("s2002");
    expect(catalogKey(" s 2002 ")).toBe("s2002");
    expect(catalogKey("Ｓ２００２")).toBe("s2002");
    expect(catalogKey("4368–814")).toBe("4368814");
  });

  it("treats a blank catalogue number as none", () => {
    expect(catalogKey("  - ")).toBeNull();
    expect(catalogKey(null)).toBeNull();
  });
});

const product = (id: string, fields: Partial<{ name: string; englishName: string; brand: string; catalogNumber: string; casNumber: string }> = {}) => ({
  id, name: fields.name ?? id, englishName: fields.englishName ?? null, brand: fields.brand ?? null, catalogNumber: fields.catalogNumber ?? null, casNumber: fields.casNumber ?? null,
});

describe("duplicateProductPairs", () => {
  it("pairs products with the same catalogue number, exact only when the brand matches too", () => {
    const pairs = duplicateProductPairs([
      product("a", { brand: "BioLegend", catalogNumber: "300438" }),
      product("b", { brand: "biolegend ", catalogNumber: "300-438" }),
      product("c", { brand: "Thermo", catalogNumber: "300438" }),
    ]);
    expect(pairs.map((pair) => [pair.first.id, pair.second.id, pair.reasons, pair.exact])).toEqual([
      ["a", "b", ["catalogue"], true],
      ["a", "c", ["catalogue"], false],
      ["b", "c", ["catalogue"], false],
    ]);
  });

  it("pairs products sharing a CAS number or a name, in either language", () => {
    const pairs = duplicateProductPairs([
      product("azide", { name: "Sodium azide", casNumber: "26628-22-8" }),
      product("dieqi", { name: "叠氮化钠", englishName: "sodium  azide", casNumber: "26628-22-8" }),
      product("pbs10", { name: "PBS 10x" }),
      product("pbs1", { name: "PBS 1x" }),
    ]);
    expect(pairs.map((pair) => [pair.first.id, pair.second.id, pair.reasons])).toEqual([["azide", "dieqi", ["cas", "name"]]]);
  });

  it("leaves out pairs marked as not duplicates", () => {
    const products = [product("a", { catalogNumber: "74104" }), product("b", { catalogNumber: "74104" })];
    expect(duplicateProductPairs(products, new Set([pairKey("b", "a")]))).toEqual([]);
  });

  it("does not pair products only because both lack a catalogue number, CAS or English name", () => {
    expect(duplicateProductPairs([product("a", { name: "Tips" }), product("b", { name: "Tubes" })])).toEqual([]);
  });
});

const lot = (id: string, fields: Partial<{ productId: string | null; lotNumber: string | null; locationId: string | null; status: string }> = {}) => ({
  id, productId: "p", lotNumber: "B312451", locationId: "freezer", status: "active", ...fields,
});

describe("duplicateLotGroups", () => {
  it("groups active lots of one product with the same lot number and location", () => {
    const groups = duplicateLotGroups([
      lot("l1"), lot("l2", { lotNumber: " b312451 " }), lot("other-place", { locationId: "shelf" }),
      lot("archived", { status: "archived" }), lot("other-product", { productId: "q" }), lot("no-lot", { lotNumber: null }), lot("no-lot-2", { lotNumber: "" }),
    ]);
    expect(groups.map((group) => group.map((entry) => entry.id))).toEqual([["l1", "l2"]]);
  });

  it("hides a group once every pair in it is marked as not duplicates", () => {
    const lots = [lot("l1"), lot("l2"), lot("l3")];
    expect(duplicateLotGroups(lots, new Set([pairKey("l1", "l2"), pairKey("l1", "l3")]))).toHaveLength(1);
    expect(duplicateLotGroups(lots, new Set([pairKey("l1", "l2"), pairKey("l1", "l3"), pairKey("l2", "l3")]))).toEqual([]);
  });
});

const side = (fields: Partial<Parameters<typeof mergeProductPlan>[0]> = {}) => ({
  name: "Anti-CD3", englishName: null, brand: null, catalogNumber: null, casNumber: null, typeId: null, groupKey: null, entityId: null,
  fieldValues: {}, controlLevels: [], lowThreshold: null, lowThresholdUnit: null, notes: null, ...fields,
});

describe("mergeProductPlan", () => {
  it("keeps the kept product's values and fills what it lacks from the other", () => {
    const plan = mergeProductPlan(
      side({ brand: "BioLegend", typeId: null, groupKey: null, fieldValues: { clone: "OKT3" } }),
      side({ brand: "Thermo", catalogNumber: "16-0037-81", casNumber: "x", typeId: "t-ab", groupKey: "reagent", fieldValues: { clone: "UCHT1", host: "Mouse" } }),
    );
    expect(plan.needsSafetyStockChoice).toBe(false);
    expect(plan.data).toMatchObject({ brand: "BioLegend", catalogNumber: "16-0037-81", casNumber: "x", typeId: "t-ab", groupKey: "reagent", fieldValues: { clone: "OKT3", host: "Mouse" } });
  });

  it("joins control levels and keeps both notes", () => {
    const plan = mergeProductPlan(side({ controlLevels: ["hazardous"], notes: "Keep cold." }), side({ controlLevels: ["highly_toxic", "hazardous"], notes: "Locked cabinet." }));
    expect(plan.data).toMatchObject({ controlLevels: ["hazardous", "highly_toxic"], notes: "Keep cold.\n\nLocked cabinet." });
  });

  it("needs a choice when both have a different safety stock, then uses the one chosen", () => {
    const keep = side({ lowThreshold: 50, lowThresholdUnit: "µL" });
    const other = side({ lowThreshold: 1, lowThresholdUnit: "vial" });
    expect(mergeProductPlan(keep, other).needsSafetyStockChoice).toBe(true);
    expect(mergeProductPlan(keep, other, "other").data).toMatchObject({ lowThreshold: 1, lowThresholdUnit: "vial" });
    expect(mergeProductPlan(keep, side({ lowThreshold: 50, lowThresholdUnit: "µL" })).needsSafetyStockChoice).toBe(false);
  });

  it("takes the other's safety stock when only it has one", () => {
    expect(mergeProductPlan(side(), side({ lowThreshold: 2, lowThresholdUnit: "box" })).data).toMatchObject({ lowThreshold: 2, lowThresholdUnit: "box" });
  });
});

describe("productMatches", () => {
  const products = [
    product("p-sigma", { name: "Sodium azide", brand: "Sigma-Aldrich", catalogNumber: "S2002" }),
    product("p-plain", { name: "PBS 10x", catalogNumber: "P-100" }),
    product("p-aladdin", { name: "叠氮化钠", englishName: "Sodium azide", brand: "Aladdin", catalogNumber: "S101101" }),
  ];

  it("finds the product with the line's brand and catalogue number, or one saved without a brand", () => {
    expect(productMatches({ name: "azide", brand: "sigma-aldrich", catalogNumber: "s-2002" }, products)).toEqual({ exact: products[0], candidates: [] });
    expect(productMatches({ name: "PBS", brand: "Gibco", catalogNumber: "P100" }, products).exact).toBe(products[1]);
  });

  it("takes a line without a brand as its supplier's product when the supplier's name holds the brand", () => {
    expect(productMatches({ name: "Kit", brand: null, catalogNumber: "S2002", supplier: "Sigma-Aldrich Trading Co., Ltd" }, products).exact).toBe(products[0]);
    expect(productMatches({ name: "Kit", brand: null, catalogNumber: "S2002", supplier: "Thermo Fisher" }, products).exact).toBeUndefined();
  });

  it("offers products sharing the catalogue number or the name when none is the same", () => {
    const match = productMatches({ name: "Sodium Azide", brand: "Merck", catalogNumber: "S2002" }, products);
    expect(match.exact).toBeUndefined();
    expect(match.candidates.map((candidate) => candidate.id)).toEqual(["p-sigma", "p-aladdin"]);
  });
});
