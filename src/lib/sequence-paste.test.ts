import { describe, expect, it } from "vitest";
import { parseSequencePaste } from "@/lib/sequence-paste";

describe("parseSequencePaste", () => {
  it("turns two supplier-style primer rows into one paired entry", () => {
    const pasted = [
      "序号\tPrimer名称\t序列\t碱基数\t管数\t纯化方式",
      "1\thFBN2-F\tGCAGGACCAAGCCAGGAAT\t19\t1\tPAGE",
      "2\thFBN2-R\tGCTGTGCTCCATGTTGTAGC\t20\t1\tPAGE",
    ].join("\n");
    const result = parseSequencePaste(pasted, "primer_pair");
    expect(result.errors).toEqual([]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      name: "hFBN2",
      targetName: "hFBN2",
      sourceRows: [2, 3],
      members: [
        { role: "forward", sequence: "GCAGGACCAAGCCAGGAAT" },
        { role: "reverse", sequence: "GCTGTGCTCCATGTTGTAGC" },
      ],
    });
  });

  it("accepts headerless supplier rows and ignores purchasing columns", () => {
    const pasted = [
      "1\thLRP1-F1\tACGTTGCAACGTTGCAACGT\t20\t2\tPAGE\t5 OD",
      "2\thLRP1-R1\tTTGCAACGTTGCAACGTTGC\t20\t2\tPAGE\t5 OD",
    ].join("\n");
    const result = parseSequencePaste(pasted, "primer_pair");
    expect(result.errors).toEqual([]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].name).toBe("hLRP1");
  });

  it("recognizes a two-row siRNA header and keeps a duplex in one row", () => {
    const pasted = [
      "编号\t基因名称\t序列（5′-3′）\t\t规格\t备注",
      "\t\tsense\tantisense\t\t",
      "1\tFBN2-siRNA-1\tGCAUGUUGCUACCUAAAUUTT\tAAUUUAGGUAGCAACAUGCTT\t2 OD\tfirst duplex",
    ].join("\n");
    const result = parseSequencePaste(pasted, "sirna_duplex");
    expect(result.errors).toEqual([]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      name: "FBN2-siRNA-1",
      description: "first duplex",
      members: [
        { role: "sense", sequence: "GCAUGUUGCUACCUAAAUUTT" },
        { role: "antisense", sequence: "AAUUUAGGUAGCAACAUGCTT" },
      ],
    });
  });

  it("reports an incomplete primer pair instead of silently importing it", () => {
    const result = parseSequencePaste("Primer名称\t序列\nhFBN2-F\tGCAGGACCAAGCCAGGAAT", "primer_pair");
    expect(result.entries).toEqual([]);
    expect(result.errors[0]).toContain("missing its reverse primer");
  });

  it("imports a compact single-sequence table", () => {
    const result = parseSequencePaste("Name\tSequence\tOrganism\tDescription\nFBN2 fragment\tATGCTGACCTGAACTG\tHomo sapiens\tPCR product", "single", "DNA");
    expect(result.errors).toEqual([]);
    expect(result.entries[0]).toMatchObject({
      name: "FBN2 fragment",
      organism: "Homo sapiens",
      description: "PCR product",
      members: [{ role: "sequence", sequence: "ATGCTGACCTGAACTG" }],
    });
  });
});
