import { describe, expect, it } from "vitest";
import { cleanStrands, productsFasta, sequenceKinds, strandFacts } from "./product-sequences";

describe("product sequences (Q185)", () => {
  it("checks typed strands by the product type's molecule and keeps an empty strand empty", () => {
    expect(cleanStrands(sequenceKinds.primer, { forward: " gtc tcc tct gac ttc aac agc g ", reverse: "" })).toEqual([
      { role: "forward", label: "Forward primer", sequence: "GTCTCCTCTGACTTCAACAGCG" },
      { role: "reverse", label: "Reverse primer", sequence: "" },
    ]);
    // An siRNA strand may end in a deoxythymidine overhang.
    expect(cleanStrands(sequenceKinds.sirna, { sense: "GCAGAAUGCUGAAGUGAAATT", antisense: "UUUCACUUCAGCAUUCUGCTT" })[0].sequence).toBe("GCAGAAUGCUGAAGUGAAATT");
    expect(() => cleanStrands(sequenceKinds.primer, { forward: "GTCXX", reverse: "" })).toThrow("Forward primer:");
  });

  it("gives a primer its length, GC, Tm and reverse complement", () => {
    const facts = strandFacts("GTCTCCTCTGACTTCAACAGCG", "DNA");
    expect(facts).toMatchObject({ length: 22, reverseComplement: "CGCTGTTGAAGTCAGAGGAGAC" });
    expect(facts.gc).toBeCloseTo(54.5, 0);
    expect(facts.tm).toBeGreaterThan(50);
    expect(strandFacts("MKT", "Protein")).toMatchObject({ length: 3, gc: undefined, tm: undefined });
  });

  it("names FASTA records by product, and by strand when there are two", () => {
    expect(productsFasta([{ name: "hGAPDH", strands: [{ label: "Forward primer", sequence: "ACGT" }, { label: "Reverse primer", sequence: "TTGG" }] }, { name: "Probe 1", strands: [{ label: "Sequence", sequence: "CCAA" }] }]))
      .toBe(">hGAPDH Forward primer\nACGT\n>hGAPDH Reverse primer\nTTGG\n>Probe 1\nCCAA");
  });
});
