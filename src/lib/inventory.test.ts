import { describe, expect, it } from "vitest";
import {
  applyInventoryTransaction,
  calculateQuantityFromTransactions,
  directQuantityEditToAdjustTransaction,
  getInventoryRiskFlags,
  inventoryNoteText,
  inventoryQuantityLabel,
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
