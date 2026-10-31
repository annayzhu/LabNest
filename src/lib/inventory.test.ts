import { describe, expect, it } from "vitest";
import {
  applyInventoryTransaction,
  calculateQuantityFromTransactions,
  directQuantityEditToAdjustTransaction,
  getInventoryRiskFlags,
  inventoryNoteText,
  inventoryQuantityLabel,
  isStrictlyControlled,
  controlledUseProblem,
  deleteBlockers,
  exportedSafetyStock,
  kitBoxStatus,
  lotRiskFlags,
  lowStockAdvice,
  movementReversalProblem,
  observationUnits,
  productStock,
} from "./inventory";

describe("inventory transaction logic", () => {
  it("derives quantity from same-unit transactions", () => {
    const quantity = calculateQuantityFromTransactions(
      0,
      [
        { quantityChange: 120, unit: "uL" },
        { quantityChange: -8, unit: "uL" },
      ],
      "uL",
    );

    expect(quantity).toBe(112);
  });

  it("blocks unit mismatches", () => {
    expect(() =>
      calculateQuantityFromTransactions(0, [{ quantityChange: 1, unit: "mL" }], "uL"),
    ).toThrow("Unit mismatch");
  });

  it("blocks transactions that make inventory negative", () => {
    expect(() =>
      applyInventoryTransaction(
        { id: "inv-1", name: "Lipofectamine 3000", currentQuantity: 4, unit: "uL" },
        { type: "consume", quantityChange: -8, unit: "uL" },
      ),
    ).toThrow("negative");
  });

  it("converts direct quantity edits into adjust transactions", () => {
    const adjustment = directQuantityEditToAdjustTransaction({
      item: { id: "inv-1", name: "Agarose", currentQuantity: 9, unit: "g" },
      desiredQuantity: 25,
    });

    expect(adjustment.type).toBe("adjust");
    expect(adjustment.quantityChange).toBe(16);
    expect(adjustment.unit).toBe("g");
  });
});

describe("inventory display", () => {
  it("shows stock by the site-wide quantity rule: at most two decimals from 1 up, two significant figures below 1", () => {
    // 5 mL less two confirmed 0.264 mL uses, as the stored float sum.
    expect(inventoryQuantityLabel({ currentQuantity: 5 - 0.264 - 0.264, unit: "mL" })).toBe("4.47 mL");
    expect(inventoryQuantityLabel({ currentQuantity: 0.63008, unit: "mL" })).toBe("0.63 mL");
    expect(inventoryQuantityLabel({ currentQuantity: 0.005, unit: "mL" })).toBe("0.005 mL");
    expect(inventoryQuantityLabel({ currentQuantity: 500, unit: "mL" })).toBe("500 mL");
    expect(inventoryQuantityLabel({ currentQuantity: 0, unit: "mL", quantityRecorded: false })).toBe("数量未记录 / Quantity not recorded");
  });

  it("reads a run's ledger notes by run code and step, never by record IDs", () => {
    const experiment = { id: "cmveqhp6u00066crfl7wqt1zd", runCode: "EXP-002" };
    const use = "Confirmed material use 402bdf2d-cb69-45e3-b9dd-79917f5a36a5; source";
    expect(inventoryNoteText(`${use} Chip:2× sybr 预混液#volume|按下表配制反应液 · qPCR 反应液`, experiment)).toBe("Confirmed material use · EXP-002 · 按下表配制反应液 · qPCR 反应液");
    expect(inventoryNoteText(`${use} manual`, experiment)).toBe("Confirmed material use · EXP-002");
    expect(inventoryNoteText("Explicit correction of material use 402bdf2d-cb69-45e3-b9dd-79917f5a36a5", experiment)).toBe("Explicit correction of material use · EXP-002");
    expect(inventoryNoteText(`Consumed during ${experiment.id}.`, experiment)).toBe("Consumed during EXP-002.");
    // The experiment is gone: its ID means nothing to a reader.
    expect(inventoryNoteText(`Consumed during ${experiment.id}.`, null)).toBe("Consumed during an experiment.");
    expect(inventoryNoteText("Opening balance recorded when the item was registered.", null)).toBe("Opening balance recorded when the item was registered.");
    expect(inventoryNoteText(null, experiment)).toBeNull();
  });
});

describe("inventory risk flags", () => {
  // Business day follows runtime local calendar, independent of UTC offset.
  const now = new Date(2026, 7, 8, 12);

  it("distinguishes depleted and low stock", () => {
    expect(getInventoryRiskFlags({ currentQuantity: 0, lowThreshold: 10 }, now)).toContain("depleted");
    expect(getInventoryRiskFlags({ currentQuantity: 8, lowThreshold: 10 }, now)).toContain("low");
  });

  it("distinguishes expired and soon-to-expire items", () => {
    expect(getInventoryRiskFlags({ currentQuantity: 1, expiryDate: "2026-08-07" }, now)).toContain("expired");
    expect(getInventoryRiskFlags({ currentQuantity: 1, expiryDate: "2026-08-20" }, now)).toContain("expiring");
  });

  it("keeps an item valid through its expiry date", () => {
    expect(getInventoryRiskFlags({ currentQuantity: 1, expiryDate: "2026-08-08" }, new Date("2026-08-08T15:00:00Z"))).not.toContain("expired");
  });

  it("does not flag healthy stock", () => {
    expect(getInventoryRiskFlags({ currentQuantity: 20, lowThreshold: 10, expiryDate: "2027-01-01" }, now)).toEqual([]);
  });
});

it("expiry calendar boundaries apply to date inputs and persisted Date objects",()=>{for(const expiryDate of ['2026-08-08',new Date('2026-08-08T00:00:00Z')]){expect(getInventoryRiskFlags({currentQuantity:1,expiryDate},new Date(2026,7,8,23,59))).not.toContain('expired');expect(getInventoryRiskFlags({currentQuantity:1,expiryDate},new Date(2026,7,9,0,0))).toContain('expired');}expect(getInventoryRiskFlags({currentQuantity:1,expiryDate:'2026-09-07'},new Date(2026,7,8,12))).toContain('expiring');expect(getInventoryRiskFlags({currentQuantity:1,expiryDate:'2026-09-08'},new Date(2026,7,8,12))).not.toContain('expiring');});

describe("product safety stock (Q140)", () => {
  const lots = [
    { currentQuantity: 3, unit: "mL", quantityRecorded: true, status: "active" },
    { currentQuantity: 12, unit: "mL", quantityRecorded: true, status: "active" },
    { currentQuantity: 500, unit: "µL", quantityRecorded: true, status: "active" },
    { currentQuantity: 40, unit: "mL", quantityRecorded: false, status: "active" },
    { currentQuantity: 40, unit: "mL", quantityRecorded: true, status: "archived" },
  ];

  it("adds up the active, counted lots in the unit the safety stock is set in", () => {
    expect(productStock(lots, "mL")).toBe(15);
    expect(productStock(lots, "µL")).toBe(500);
  });

  it("flags every lot low when the product total reaches its safety stock, not the lot alone", () => {
    expect(getInventoryRiskFlags({ currentQuantity: 3, lowThreshold: 10, productQuantity: 15 })).toEqual([]);
    expect(getInventoryRiskFlags({ currentQuantity: 12, lowThreshold: 20, productQuantity: 15 })).toEqual(["low"]);
    expect(getInventoryRiskFlags({ currentQuantity: 0, lowThreshold: 20, productQuantity: 15 })).toEqual(["depleted"]);
  });
});

describe("a lot's flags with its product's safety stock", () => {
  const product = { lowThreshold: 20, lowThresholdUnit: "mL" };
  const lots = [{ currentQuantity: 12, unit: "mL" }, { currentQuantity: 5, unit: "mL" }];

  it("compares the product total in the safety-stock unit, and keeps a legacy lot's own threshold", () => {
    expect(lotRiskFlags({ currentQuantity: 12, unit: "mL" }, product, lots)).toEqual(["low"]);
    expect(lotRiskFlags({ currentQuantity: 12, unit: "mL" }, { ...product, lowThreshold: 10 }, lots)).toEqual([]);
    expect(lotRiskFlags({ currentQuantity: 3, unit: "mL", lowThreshold: 5 }, null, [])).toEqual(["low"]);
    expect(lotRiskFlags({ currentQuantity: 3, unit: "mL", lowThreshold: 5 }, { lowThreshold: null, lowThresholdUnit: null }, lots)).toEqual([]);
  });
});

describe("low-stock advice by 大类 (Q142)", () => {
  it.each([
    ["reagent", "purchase"],
    ["consumable", "purchase"],
    ["equipment", "purchase"],
    ["biological", "expand"],
    ["sample", "remaining"],
    [null, "purchase"],
  ] as const)("%s → %s", (group, advice) => {
    expect(lowStockAdvice(group)).toBe(advice);
  });
});

describe("control levels (Q143)", () => {
  it("holds highly toxic and drug-precursor products to precise records and an SDS", () => {
    expect(isStrictlyControlled(["highly_toxic"])).toBe(true);
    expect(isStrictlyControlled(["hazardous", "precursor"])).toBe(true);
    expect(isStrictlyControlled(["hazardous", "explosive_precursor"])).toBe(false);
    expect(isStrictlyControlled([])).toBe(false);
  });

  it("asks who took strictly controlled stock out and what for, and nothing of other stock", () => {
    expect(controlledUseProblem(["highly_toxic"], { type: "consume", performedBy: "Li", notes: "Fixation, EXP-012" })).toBeNull();
    expect(controlledUseProblem(["precursor"], { type: "consume", performedBy: "", notes: "Fixation" })).toMatch(/who/);
    expect(controlledUseProblem(["precursor"], { type: "discard", performedBy: "Li" })).toMatch(/purpose/);
    expect(controlledUseProblem(["precursor"], { type: "receive" })).toBeNull();
    expect(controlledUseProblem(["hazardous"], { type: "consume" })).toBeNull();
  });
});

describe("kit boxes (Q144)", () => {
  const components = [{ id: "a", name: "Buffer A" }, { id: "b", name: "Enzyme mix" }, { id: "c", name: "Wash" }];

  it("is complete while every component is present", () => {
    expect(kitBoxStatus(components, {})).toEqual({ complete: true, unavailable: [] });
  });

  it("is incomplete when any component is used up or missing, and names it", () => {
    expect(kitBoxStatus(components, { b: { state: "used_up" }, c: { state: "missing" } })).toEqual({
      complete: false,
      unavailable: [{ id: "b", name: "Enzyme mix", state: "used_up" }, { id: "c", name: "Wash", state: "missing" }],
    });
  });

  it("ignores states of components no longer in the kit and a component put back", () => {
    expect(kitBoxStatus(components, { gone: { state: "missing" }, a: { state: "present", location: "-20 °C" } })).toEqual({ complete: true, unavailable: [] });
  });
});

describe("remaining-amount units (Q146)", () => {
  it("offers pressure for gas, reactions for kits, and amounts otherwise", () => {
    expect(observationUnits("gas")).toEqual(["MPa", "%"]);
    expect(observationUnits("kit")).toEqual(["reactions", "%"]);
    expect(observationUnits("antibody")).toEqual(["mL", "µL", "L", "mg", "g", "%"]);
    expect(observationUnits(null)).toEqual(["mL", "µL", "L", "mg", "g", "%"]);
  });
});

describe("reversing a movement (Q150)", () => {
  const precise = { managementMode: "precise", currentQuantity: 10 };
  const consume = { type: "consume", quantityChange: -4 };

  it("reverses a manual movement while stock stays non-negative", () => {
    expect(movementReversalProblem(consume, precise)).toBeNull();
    expect(movementReversalProblem({ type: "receive", quantityChange: 6 }, precise)).toBeNull();
  });

  it.each([
    [{ ...consume, reversedBy: { id: "r" } }, precise, /already been reversed/],
    [{ ...consume, reversesTransactionId: "t" }, precise, /itself a reversal/],
    [{ type: "transfer", quantityChange: 0 }, precise, /no quantity/],
    [{ ...consume, materialUse: { id: "m" } }, precise, /experiment/],
    [{ type: "receive", quantityChange: 5, purchaseId: "p" }, precise, /purchase/],
    [consume, { managementMode: "package", currentQuantity: 3 }, /containers/],
    [{ type: "receive", quantityChange: 12 }, precise, /negative/],
  ])("refuses %o", (movement, item, problem) => {
    expect(movementReversalProblem(movement, item)).toMatch(problem);
  });
});

describe("delete blockers (Q149)", () => {
  it("lists what still refers to a record, and nothing when it is unused", () => {
    expect(deleteBlockers({ movements: 2, materialUses: 0, receipts: 1 })).toEqual(["2 stock movements", "1 purchase receipt"]);
    expect(deleteBlockers({ lots: 1, products: 0 })).toEqual(["1 lot"]);
    expect(deleteBlockers({ movements: 0, containerActions: 0 })).toEqual([]);
  });
});

describe("exported safety stock", () => {
  it("exports the product's safety stock in the lot's unit, and a legacy lot's own", () => {
    expect(exportedSafetyStock({ unit: "mL", lowThreshold: 3, product: { lowThreshold: 20, lowThresholdUnit: "mL" } })).toBe(20);
    expect(exportedSafetyStock({ unit: "µL", lowThreshold: 3, product: { lowThreshold: 20, lowThresholdUnit: "mL" } })).toBeNull();
    expect(exportedSafetyStock({ unit: "mL", lowThreshold: 3, product: null })).toBe(3);
  });
});
