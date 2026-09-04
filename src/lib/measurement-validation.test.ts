import { describe, expect, it } from "vitest";
import { validateMeasurementRange } from "./measurement-validation";

describe("measurement range validation", () => {
  it("preserves and flags a raw value outside the declared range", () => {
    expect(validateMeasurementRange(12.4, 2, 10)).toEqual({ valid: false, outsideRange: true, belowRange: false, aboveRange: true });
  });

  it("accepts inclusive boundaries", () => {
    expect(validateMeasurementRange(2, 2, 10).valid).toBe(true);
    expect(validateMeasurementRange(10, 2, 10).valid).toBe(true);
  });

  it("rejects an inverted expected range", () => {
    expect(() => validateMeasurementRange(5, 10, 2)).toThrow(/maximum/);
  });
});
