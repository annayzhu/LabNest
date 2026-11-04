import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { reverseComplement } from "@/lib/sequence";
import { compareSequences, featureDifferences } from "./compare";
import { parseSequenceFile } from "./files";

// PRD v2.0 PW-09 and AT17, on the simulated reference (软件测试用模拟序列).
const [reference] = parseSequenceFile("A10-reference.gb", new Uint8Array(readFileSync(join("src/lib/plasmid/test-samples/files", "A10-reference.gb")))).records;
const bases = reference.sequence;
const circular = (sequence: string) => ({ sequence, topology: "circular" as const });
const linear = (sequence: string) => ({ sequence, topology: "linear" as const });
const swap = (base: string) => (base === "A" ? "C" : "A");

describe("whole-sequence comparison", () => {
  it("AT17: the same bases written alike are identical", () => {
    const result = compareSequences(circular(bases), circular(bases));
    expect(result).toMatchObject({ identical: true, equivalent: true, identity: 1, reversed: false, turn: 0, differences: [] });
  });

  it("AT17: another origin on a circle is the same molecule, not identical", () => {
    const turned = bases.slice(700) + bases.slice(0, 700);
    const result = compareSequences(circular(bases), circular(turned));
    expect(result).toMatchObject({ identical: false, equivalent: true, differences: [], reversed: false });
    expect(result.turn).toBe(700);
    expect(turned[result.originalPosition(0)]).toBe(bases[0]);
    expect(result.originalPosition(700)).toBe(0);
  });

  it("AT17: the reverse complement is the same molecule, and positions map back to the stored strand", () => {
    const flipped = reverseComplement(bases);
    const result = compareSequences(circular(bases), circular(flipped));
    expect(result).toMatchObject({ identical: false, equivalent: true, reversed: true });
    for (const position of [0, 500, bases.length - 1]) expect(reverseComplement(flipped[result.originalPosition(position)])).toBe(bases[position]);
  });

  it("does not turn linear sequences: another start point there is a real difference", () => {
    const turned = bases.slice(700) + bases.slice(0, 700);
    const result = compareSequences(linear(bases), linear(turned));
    expect(result.turn).toBe(0);
    expect(result.equivalent).toBe(false);
  });

  it("AT17: places one substitution exactly, also through a turn and the other strand", () => {
    const changed = `${bases.slice(0, 1000)}${swap(bases[1000])}${bases.slice(1001)}`;
    const plain = compareSequences(circular(bases), circular(changed));
    expect(plain.equivalent).toBe(false);
    expect(plain.differences).toEqual([expect.objectContaining({ kind: "substitution", aStart: 1000, aEnd: 1001, aBases: bases[1000], bBases: swap(bases[1000]) })]);
    expect(plain.identity).toBeCloseTo(1 - 1 / bases.length, 6);

    const hidden = reverseComplement(changed.slice(300) + changed.slice(0, 300));
    const through = compareSequences(circular(bases), circular(hidden));
    expect(through.reversed).toBe(true);
    expect(through.differences).toEqual([expect.objectContaining({ kind: "substitution", aStart: 1000, aEnd: 1001 })]);
    expect(reverseComplement(hidden[through.originalPosition(through.differences[0].bStart)])).toBe(swap(bases[1000]));
  });

  it("keeps an insertion and a deletion in one piece, and on the right side", () => {
    const inserted = compareSequences(linear(bases), linear(`${bases.slice(0, 800)}GATTACAGATTACA${bases.slice(800)}`));
    expect(inserted.differences).toHaveLength(1);
    expect(inserted.differences[0]).toMatchObject({ kind: "insertion", aEnd: inserted.differences[0].aStart });
    expect(inserted.differences[0].bBases).toHaveLength(14);

    const deleted = compareSequences(linear(bases), linear(`${bases.slice(0, 800)}${bases.slice(830)}`));
    expect(deleted.differences).toHaveLength(1);
    expect(deleted.differences[0].kind).toBe("deletion");
    expect(deleted.differences[0].aBases).toHaveLength(30);
  });

  it("PW-09: a fragment is not \"the same\": the missing ends are differences", () => {
    const result = compareSequences(linear(bases), linear(bases.slice(200, 1200)));
    expect(result.equivalent).toBe(false);
    expect(result.differences.map((item) => [item.kind, item.aStart, item.aEnd])).toEqual([["deletion", 0, 200], ["deletion", 1200, bases.length]]);
    expect(result.identity).toBeCloseTo(1000 / bases.length, 6);
  });

  it("copes with empty and unrelated sequences, and with 100 kb in reasonable time", () => {
    expect(compareSequences(linear(""), linear("")).equivalent).toBe(true);
    expect(compareSequences(linear("ACGT"), linear("")).differences).toEqual([expect.objectContaining({ kind: "deletion", aBases: "ACGT" })]);
    const unrelated = compareSequences(linear("A".repeat(300)), linear("C".repeat(300)));
    expect(unrelated.equivalent).toBe(false);
    let seed = 7;
    const random = Array.from({ length: 100_000 }, () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return "ACGT"[seed & 3];
    }).join("");
    const started = Date.now();
    const big = compareSequences(circular(random), circular(`${random.slice(0, 50_000)}${swap(random[50_000])}${random.slice(50_001)}`));
    expect(big.differences).toHaveLength(1);
    expect(Date.now() - started).toBeLessThan(3_000);
  });

  it("lists features named in only one of the two", () => {
    const feature = (name: string) => ({ name, type: "CDS", strand: 1 as const, segments: [{ start: 0, end: 9 }], qualifiers: {}, evidence: "file" as const });
    expect(featureDifferences({ features: [feature("EGFP"), feature("AmpR")] }, { features: [feature("AmpR"), feature("mCherry")] })).toEqual({ onlyFirst: ["EGFP (CDS)"], onlySecond: ["mCherry (CDS)"] });
  });
});
