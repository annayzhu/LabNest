export function validateMeasurementRange(value: number, expectedMin?: number, expectedMax?: number) {
  if (!Number.isFinite(value)) throw new Error("Measurement value must be finite.");
  if (expectedMin !== undefined && !Number.isFinite(expectedMin)) throw new Error("Expected minimum must be finite.");
  if (expectedMax !== undefined && !Number.isFinite(expectedMax)) throw new Error("Expected maximum must be finite.");
  if (expectedMin !== undefined && expectedMax !== undefined && expectedMin > expectedMax) throw new Error("Expected maximum must be greater than or equal to the minimum.");
  const belowRange = expectedMin !== undefined && value < expectedMin;
  const aboveRange = expectedMax !== undefined && value > expectedMax;
  return { valid: !(belowRange || aboveRange), outsideRange: belowRange || aboveRange, belowRange, aboveRange };
}
