import { describe, expect, it } from "vitest";
import { bulkProductPlan, bulkStockPlan } from "./inventory-bulk";

const stock = (id: string, fields: Partial<{ status: string; locationId: string | null; principalInvestigator: string | null; blockers: string[]; managementMode: string; inStore: number }> = {}) => ({
  id, name: id, status: "active", locationId: "shelf", principalInvestigator: "Zhang Lab", blockers: [], managementMode: "package", inStore: 3, ...fields,
});

describe("bulkStockPlan", () => {
  it("archives active stock and skips what is already archived", () => {
    expect(bulkStockPlan("archive", [stock("a"), stock("b", { status: "archived" })])).toEqual([
      { id: "a", name: "a", outcome: "change" },
      { id: "b", name: "b", outcome: "skip", reason: "Already archived." },
    ]);
    expect(bulkStockPlan("restore", [stock("a")])[0]).toMatchObject({ outcome: "skip", reason: "Not archived." });
  });

  it("moves only active stock that is somewhere else", () => {
    expect(bulkStockPlan("move", [stock("a"), stock("b", { locationId: "freezer" }), stock("c", { status: "archived" })], { locationId: "freezer" }).map((entry) => [entry.id, entry.outcome, entry.reason])).toEqual([
      ["a", "change", undefined],
      ["b", "skip", "Already in this location."],
      ["c", "skip", "Archived; restore it first."],
    ]);
  });

  it("changes the PI only where it differs", () => {
    expect(bulkStockPlan("pi", [stock("a"), stock("b", { principalInvestigator: null })], { principalInvestigator: "Zhang Lab" }).map((entry) => entry.outcome)).toEqual(["skip", "change"]);
  });

  it("takes containers out only of container stock with enough in store", () => {
    expect(bulkStockPlan("takeOut", [stock("a"), stock("b", { inStore: 1 }), stock("c", { managementMode: "precise" }), stock("d", { status: "archived" })], { count: 2 }).map((entry) => [entry.id, entry.outcome, entry.reason])).toEqual([
      ["a", "change", undefined],
      ["b", "skip", "Only 1 in store."],
      ["c", "skip", "Not kept as containers; record use on its page."],
      ["d", "skip", "Archived; restore it first."],
    ]);
  });

  it("deletes stock nothing refers to and archives the rest, saying why", () => {
    expect(bulkStockPlan("delete", [stock("a"), stock("b", { blockers: ["2 stock movements"] }), stock("c", { status: "archived", blockers: ["1 aliquot"] })])).toEqual([
      { id: "a", name: "a", outcome: "delete" },
      { id: "b", name: "b", outcome: "archive", reason: "Still referred to: 2 stock movements." },
      { id: "c", name: "c", outcome: "skip", reason: "Still referred to: 1 aliquot." },
    ]);
  });
});

const product = (id: string, fields: Partial<{ status: string; typeId: string | null; groupKey: string | null; controlLevels: string[]; lots: number; impreciseLots: number }> = {}) => ({
  id, name: id, status: "active", typeId: null, groupKey: "reagent", controlLevels: [], lots: 0, impreciseLots: 0, ...fields,
});

describe("bulkProductPlan", () => {
  it("classifies products that are not yet of the chosen type or 大类", () => {
    expect(bulkProductPlan("classify", [product("a"), product("b", { typeId: "t-kit" })], { typeId: "t-kit", groupKey: "reagent" }).map((entry) => [entry.outcome, entry.reason])).toEqual([
      ["change", undefined],
      ["skip", "Already classified this way."],
    ]);
  });

  it("adds a strict control level only where every lot is recorded precisely", () => {
    expect(bulkProductPlan("addControl", [product("a"), product("b", { lots: 3, impreciseLots: 2 }), product("c", { controlLevels: ["highly_toxic"] })], { level: "highly_toxic" }).map((entry) => [entry.outcome, entry.reason])).toEqual([
      ["change", undefined],
      ["skip", "2 lots are not recorded precisely."],
      ["skip", "Already has this control level."],
    ]);
    expect(bulkProductPlan("addControl", [product("b", { lots: 3, impreciseLots: 1 })], { level: "hazardous" })[0].outcome).toBe("change");
  });

  it("removes a control level only where it is set", () => {
    expect(bulkProductPlan("removeControl", [product("a"), product("b", { controlLevels: ["hazardous"] })], { level: "hazardous" }).map((entry) => entry.outcome)).toEqual(["skip", "change"]);
  });

  it("deletes products without lots and archives the others", () => {
    expect(bulkProductPlan("delete", [product("a"), product("b", { lots: 2 })]).map((entry) => [entry.outcome, entry.reason])).toEqual([
      ["delete", undefined],
      ["archive", "Still referred to: 2 lots."],
    ]);
  });
});
