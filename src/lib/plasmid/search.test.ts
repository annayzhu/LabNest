import { describe, expect, it } from "vitest";
import { reverseComplement } from "@/lib/sequence";
import type { SequenceRecord } from "./model";
import { looksLikeDna, searchDna, searchProtein } from "./search";

const flag = "GACTACAAGGACGACGATGACAAG";

describe("search (F04)", () => {
  const record: SequenceRecord = { name: "s", sequence: `TTTT${flag}CCCCAAGG${reverseComplement("ATGGCTAAA")}GGTT`, topology: "circular", features: [] };

  it("finds DNA on both strands, IUPAC codes included, and with allowed mismatches", () => {
    expect(searchDna(record, "GACTACAAG").map((hit) => [hit.strand, hit.segments])).toEqual([[1, [{ start: 4, end: 13 }]]]);
    expect(searchDna(record, "ATGGCTAAA").map((hit) => hit.strand)).toEqual([-1]);
    expect(searchDna(record, "GAYTACAAG")).toHaveLength(1);
    expect(searchDna(record, "GACTACTAG")).toHaveLength(0);
    expect(searchDna(record, "GACTACTAG", 1)[0].mismatches).toBe(1);
  });

  it("finds a hit that runs across the origin of a circular sequence", () => {
    expect(searchDna(record, "GGTTTTTT")[0].segments).toEqual([{ start: record.sequence.length - 4, end: record.sequence.length }, { start: 0, end: 4 }]);
  });

  it("finds a peptide in any frame and tells DNA from protein", () => {
    expect(searchProtein(record, "DYKDDDDK").map((hit) => [hit.strand, hit.segments])).toEqual([[1, [{ start: 4, end: 28 }]]]);
    expect(searchProtein(record, "MAK")[0].strand).toBe(-1);
    expect([looksLikeDna("gaytac"), looksLikeDna("DYKDDDDK")]).toEqual([true, false]);
  });
});
