import { describe, expect, it } from "vitest";
import { keyInformationMaxLength, normalizeKeyInformation } from "./key-information";

describe("normalizeKeyInformation", () => {
  it("trims saved notes and treats an empty note as cleared", () => {
    expect(normalizeKeyInformation("  critical decision  ")).toBe("critical decision");
    expect(normalizeKeyInformation("  \n ")).toBeNull();
  });

  it("rejects oversized control notes", () => {
    expect(() => normalizeKeyInformation("x".repeat(keyInformationMaxLength + 1))).toThrow(/5000/);
  });
});
