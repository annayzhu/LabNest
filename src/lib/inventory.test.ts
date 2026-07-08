import { describe, expect, it } from "vitest";
import {
  applyInventoryTransaction,
  calculateQuantityFromTransactions,
  directQuantityEditToAdjustTransaction,
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
