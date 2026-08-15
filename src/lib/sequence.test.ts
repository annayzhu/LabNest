import { describe, expect, it } from "vitest";
import {
  estimatedMeltingTemperature,
  estimatedMolecularWeight,
  gcPercent,
  parseFasta,
  reverseComplement,
  sequenceLength,
  toFasta,
  translateDna,
  validateSequence,
} from "./sequence";

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

  it("validates IUPAC nucleic acid and amino-acid alphabets", () => {
    expect(validateSequence("ACGTRYNN", "DNA").errors).toEqual([]);
    expect(validateSequence("AUGC", "DNA").errors[0]).toContain("U");
    expect(validateSequence("MKWVTFIS", "Protein").errors).toEqual([]);
  });

  it("allows only terminal dT overhangs when validating synthetic siRNA", () => {
    const siRnaOptions = { allowTerminalDeoxythymidineOverhang: true };
    expect(validateSequence("GUCCCGAUUUGUAGAAAUATT", "RNA", siRnaOptions).errors).toEqual([]);
    expect(reverseComplement("AUGCUUTT", "RNA")).toBe("AAAAGCAU");
    expect(validateSequence("AUGCUUT", "RNA", siRnaOptions).errors).toEqual([]);
    expect(validateSequence("AUGTUU", "RNA", siRnaOptions).errors[0]).toContain("T");
    expect(validateSequence("AUGCUUTTT", "RNA", siRnaOptions).errors[0]).toContain("T");
    expect(validateSequence("AUGCUUTT", "RNA").errors[0]).toContain("T");
  });

  it("parses multi-record FASTA files", () => {
    expect(parseFasta(">forward primer\nATGC\n>reverse\nGCTA")).toEqual([
      { name: "forward", description: "primer", sequence: "ATGC" },
      { name: "reverse", sequence: "GCTA" },
    ]);
  });

  it("calculates clearly approximate sequence properties", () => {
    expect(estimatedMeltingTemperature("ATGC", "DNA")).toBe(12);
    expect(estimatedMolecularWeight("ATGC", "DNA")).toBe(1320);
    expect(estimatedMolecularWeight("MKW", "Protein")).toBe(330);
  });
});
