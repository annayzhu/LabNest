import { describe, expect, it } from "vitest";
import { formatRecordCode, isValidRecordCode, recordCodeExample, recordCodeFromSuffix, reserveRecordCodes, suggestNextRecordCode } from "./record-codes";

describe("record code rules", () => {
  it("uses the fixed prefixes and starting formats", () => {
    expect(recordCodeExample("researchPlan")).toBe("RP-001");
    expect(recordCodeExample("protocol")).toBe("PRT-100001");
    expect(recordCodeExample("experiment")).toBe("EXP-001");
  });

  it("pads numeric suffixes without truncating larger sequences", () => {
    expect(formatRecordCode("researchPlan", 8)).toBe("RP-008");
    expect(formatRecordCode("protocol", 100009)).toBe("PRT-100009");
    expect(formatRecordCode("experiment", 1002)).toBe("EXP-1002");
  });

  it("rejects missing, incorrect, or undersized prefixes", () => {
    expect(isValidRecordCode("researchPlan", "RP-008")).toBe(true);
    expect(isValidRecordCode("protocol", "PRT-100008")).toBe(true);
    expect(isValidRecordCode("experiment", "EXP-008")).toBe(true);
    expect(isValidRecordCode("researchPlan", "EXP-008")).toBe(false);
    expect(isValidRecordCode("protocol", "PRT-8")).toBe(false);
    expect(isValidRecordCode("experiment", "8")).toBe(false);
  });

  it("combines a fixed prefix with a user-entered numeric suffix", () => {
    expect(recordCodeFromSuffix("researchPlan", "008")).toBe("RP-008");
    expect(recordCodeFromSuffix("protocol", " 100008 ")).toBe("PRT-100008");
    expect(recordCodeFromSuffix("experiment", "1002")).toBe("EXP-1002");
  });

  it("rejects invalid user-entered suffixes", () => {
    expect(() => recordCodeFromSuffix("researchPlan", "8")).toThrow("RP- must be followed by at least 3 digits.");
    expect(() => recordCodeFromSuffix("protocol", "ABC123")).toThrow("PRT- must be followed by at least 6 digits.");
    expect(() => recordCodeFromSuffix("experiment", "EXP-008")).toThrow("EXP- must be followed by at least 3 digits.");
  });

  it("suggests the next available code from records and the reservation counter", () => {
    expect(suggestNextRecordCode("researchPlan", ["RP-001"])).toBe("RP-002");
    expect(suggestNextRecordCode("researchPlan", ["RP-001", "legacy"], 4)).toBe("RP-005");
    expect(suggestNextRecordCode("protocol", [])).toBe("PRT-100001");
    expect(suggestNextRecordCode("protocol", ["PRT-100008"], 100008)).toBe("PRT-100009");
    expect(suggestNextRecordCode("experiment", ["EXP-001"], 1)).toBe("EXP-002");
  });

  it("reserves a contiguous code range with one counter operation", async () => {
    const tx = {
      sequence: { findMany: async () => [{ code: "SEQ-000004" }] },
      $queryRaw: async () => [{ value: 7 }],
    };
    await expect(reserveRecordCodes(tx as never, "sequence", 3)).resolves.toEqual(["SEQ-000005", "SEQ-000006", "SEQ-000007"]);
  });
});
