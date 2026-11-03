import { describe, expect, it } from "vitest";
import { reverseComplement } from "@/lib/sequence";
import { codonMarks, detectFeatures, openReadingFrames } from "./feature-library";
import { BUILT_IN_ELEMENTS } from "./feature-library.data";
import type { SequenceRecord } from "./model";
import { backTranslate } from "./test-samples/build";

const element = (id: string) => BUILT_IN_ELEMENTS.find((item) => item.id === id)!;

function filler(length: number, seed: number) {
  let state = seed;
  let bases = "";
  for (let at = 0; at < length; at += 1) {
    state = (state * 1103515245 + 12345) % 2147483648;
    bases += "ACGT"[(state >>> 16) % 4];
  }
  return bases;
}

describe("common features, found the way SnapGene marks them (Q362, Q363)", () => {
  const ori = element("ori").sequence;
  const egfp = `${backTranslate(element("egfp").sequence)}TAA`;
  // The ori is cut in two and its halves put at the two ends, so on a circle it runs across position 1.
  const body = `${ori.slice(300)}${filler(150, 1)}${element("cmv-promoter").sequence}${filler(60, 2)}${egfp}${filler(80, 3)}${reverseComplement(element("attb1").sequence)}${filler(120, 4)}${ori.slice(0, 300)}`;
  const record: SequenceRecord = { name: "test", sequence: body, topology: "circular", features: [] };

  it("marks DNA elements, coding elements and short sites on either strand and across the origin", () => {
    const found = Object.fromEntries(detectFeatures(record).map((item) => [item.feature.name, item]));
    expect(found["CMV promoter"]).toMatchObject({ identity: 1, feature: { type: "promoter", strand: 1, evidence: "reference-match" } });
    expect(found.EGFP.feature).toMatchObject({ type: "CDS", strand: 1, codonStart: 1 });
    expect(found.EGFP.feature.segments[0].end - found.EGFP.feature.segments[0].start).toBe(egfp.length);
    expect(found.attB1.feature.strand).toBe(-1);
    expect(found.ori.feature.segments).toEqual([{ start: body.length - 300, end: body.length }, { start: 0, end: ori.length - 300 }]);
  });

  it("writes a CDS's amino acids under the middle base of each codon, ending at its stop", () => {
    const egfpFeature = detectFeatures(record).find((item) => item.feature.name === "EGFP")!.feature;
    const marks = codonMarks(record, egfpFeature);
    expect(marks.map((mark) => mark.aminoAcid).join("")).toBe(`${element("egfp").sequence}*`);
    expect(marks[0].position).toBe(egfpFeature.segments[0].start + 1);
    expect(openReadingFrames(record).some((frame) => frame.strand === 1 && frame.segments[0].start === egfpFeature.segments[0].start)).toBe(true);
  });

  it("follows a minus-strand feature codon by codon", () => {
    const minus: SequenceRecord = { name: "minus", sequence: `GG${reverseComplement("ATGGCTAAATAA")}GG`, topology: "linear", features: [] };
    expect(codonMarks(minus, { strand: -1, segments: [{ start: 2, end: 14 }] }).map((mark) => [mark.aminoAcid, mark.position])).toEqual([["M", 12], ["A", 9], ["K", 6], ["*", 3]]);
  });

  it("does not repeat a feature the file already has", () => {
    const promoter = detectFeatures(record).find((item) => item.feature.name === "CMV promoter")!.feature;
    const annotated = { ...record, features: [{ ...promoter, name: "CMV", evidence: "file" as const }] };
    expect(detectFeatures(annotated).some((item) => item.feature.name === "CMV promoter")).toBe(false);
  });

  it("keeps every built-in element traceable to the record it came from", () => {
    for (const item of BUILT_IN_ELEMENTS) {
      expect(item.source, item.id).toMatchObject({ accession: expect.stringMatching(/^[A-Z]{1,2}\d{5,6}\.\d+$/) });
      if (item.kind === "protein") expect(item.sequence, item.id).toMatch(/^M[A-Z]+$/);
      else expect(item.sequence, item.id).toMatch(/^[ACGT]+$/);
    }
  });
});
