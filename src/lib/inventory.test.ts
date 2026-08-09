import { describe, expect, it } from "vitest";
import {
  applyInventoryTransaction,
  calculateQuantityFromTransactions,
  directQuantityEditToAdjustTransaction,
  getInventoryRiskFlags,
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

describe("inventory risk flags", () => {
  const now = new Date("2026-08-08T00:00:00Z");

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
