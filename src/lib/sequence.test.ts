import { describe, expect, it } from "vitest";
import { gcPercent, reverseComplement, sequenceLength, toFasta, translateDna } from "./sequence";

describe("sequence utilities", () => {
  it("calculates basic sequence metrics", () => {
    expect(sequenceLength("ATGC\nAT")).toBe(6);
    expect(gcPercent("ATGC")).toBe(50);
  });

  it("reverse complements DNA and RNA", () => {
    expect(reverseComplement("ATGC", "DNA")).toBe("GCAT");
    expect(reverseComplement("AUGC", "RNA")).toBe("GCAU");
  });

  it("translates DNA with the simple codon table", () => {
    expect(translateDna("ATGGGCTAA")).toBe("MG*");
  });

  it("exports FASTA in wrapped lines", () => {
    expect(toFasta("demo", "ATGCATGC", 4)).toBe(">demo\nATGC\nATGC");
  });
});
