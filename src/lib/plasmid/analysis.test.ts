import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSequenceFile } from "./files";
import { checkStructure, type StructureElement } from "./fusion";
import { findTags } from "./tags";
import { construct, FLAG, FLAG_3X_22AA, SRGN_PROTEIN, testChainProtein } from "./test-samples/build";
import { frameSpan, sixFrameTranslations, translate } from "./translate";

const root = "src/lib/plasmid/test-samples/files";
const parse = (path: string) => parseSequenceFile(path, new Uint8Array(readFileSync(join(root, path))));
const status = (check: ReturnType<typeof checkStructure>, id: string, element: string) => check.items.find((item) => item.id === id && item.element === element)?.status;

const srgnFusion: StructureElement[] = [
  { name: "SRGN signal peptide", protein: SRGN_PROTEIN.slice(0, 27) },
  { name: "3×FLAG", protein: [FLAG_3X_22AA, FLAG.repeat(3)], maxGapBefore: 0 },
  { name: "SRGN mature start", protein: ["YPTRRARY", "YPTQRARY"], maxGapBefore: 0 },
];

describe("translation", () => {
  it("resolves ambiguous codons as Biopython does", () => {
    expect(translate("GCNTARTRAMGNRAYSARMTTNNNTAN")).toBe("A**XBZJXX");
    expect(translate("ATGAAAT")).toBe("MK");
  });

  it("maps six-frame hits back to top-strand coordinates", () => {
    const dna = `CC${"ATGGACTACAAGGACGACGATGACAAG"}TT`;
    const frames = sixFrameTranslations(dna);
    expect(frames.map((frame) => `${frame.strand}:${frame.offset}`)).toEqual(["1:0", "1:1", "1:2", "-1:0", "-1:1", "-1:2"]);
    expect(frames[2].protein.indexOf(FLAG)).toBe(1);
    expect(frameSpan(frames[2], 1, 9, dna.length)).toEqual({ start: 5, end: 29 });
    expect(frameSpan({ strand: -1, offset: 1 }, 0, 2, 10)).toEqual({ start: 3, end: 9 });
  });
});

describe("A07 tag library", () => {
  it("tells the 22 aa 3×FLAG from three standard FLAGs", () => {
    const [threeFlag, tandem] = parse("A07-flag-variants.fasta").records.map((record) => findTags(record.sequence).filter((hit) => hit.strand === 1 && hit.offset === 0));
    expect(threeFlag.map((hit) => [hit.name, hit.containedIn ?? null, hit.confidence])).toEqual([
      ["FLAG", "3×FLAG (22 aa)", "exact"],
      ["3×FLAG (22 aa)", null, "exact"],
    ]);
    expect(tandem.map((hit) => [hit.name, hit.containedIn ?? null])).toEqual([
      ["FLAG", "Three standard FLAGs (24 aa)"],
      ["FLAG", "Three standard FLAGs (24 aa)"],
      ["FLAG", "Three standard FLAGs (24 aa)"],
      ["Three standard FLAGs (24 aa)", null],
    ]);
  });

  it("never counts ambiguous bases as a high-confidence exact hit", () => {
    expect(findTags("ATGGACTACAANGACGACGATGACAAGTGA").some((item) => item.name === "FLAG")).toBe(false);
    const ambiguous = findTags("ATGGACTACAAGGACGACGAYGACAAGTGA").find((item) => item.name === "FLAG");
    expect(ambiguous?.confidence).toBe("exact-with-ambiguous-bases");
  });
});

describe("A08–A10 fusion structure", () => {
  const chainThenFlag: StructureElement[] = [{ name: "test chain", protein: testChainProtein }, { name: "FLAG", protein: FLAG }];

  it("A08: a FLAG behind a stop codon is present and in frame but not a fusion tag", () => {
    const check = checkStructure({ sequence: parse("A08-flag-after-stop.fasta").records[0].sequence, elements: chainThenFlag });
    expect([status(check, "present", "FLAG"), status(check, "in-frame", "FLAG"), status(check, "no-stop", "FLAG")]).toEqual(["pass", "pass", "fail"]);
    expect(check.arrangementFound).toBe(false);
  });

  it("A09: a FLAG in another frame is not a fusion tag", () => {
    const check = checkStructure({ sequence: parse("A09-flag-other-frame.fasta").records[0].sequence, elements: chainThenFlag });
    expect([status(check, "present", "FLAG"), status(check, "in-frame", "FLAG")]).toEqual(["pass", "fail"]);
    expect(check.arrangementFound).toBe(false);
  });

  it("A10: signal peptide → 3×FLAG → mature chain, item by item", () => {
    const [reference] = parse("A10-reference.gb").records;
    const check = checkStructure({ sequence: reference.sequence, elements: srgnFusion });
    expect(check.frame).toEqual({ strand: 1, offset: construct.cdsStart });
    expect(check.items.filter((item) => item.id !== "junction-quality").every((item) => item.status === "pass")).toBe(true);
    expect(status(check, "junction-quality", "3×FLAG")).toBe("unknown");
    expect(check.arrangementFound).toBe(true);

    const read = parse("A10-read-F.ab1").reads[0];
    const fromRead = checkStructure({ sequence: read.bases, quality: read.quality, elements: srgnFusion });
    expect(fromRead.arrangementFound).toBe(true);
    expect([status(fromRead, "junction-quality", "3×FLAG"), status(fromRead, "junction-quality", "SRGN mature start")]).toEqual(["pass", "pass"]);
  });

  it("A10: without the tag the target arrangement is not found", () => {
    const withoutTag = `${construct.sequence.slice(0, construct.tag.start)}${construct.sequence.slice(construct.tag.end)}`;
    const check = checkStructure({ sequence: withoutTag, elements: srgnFusion });
    expect(status(check, "present", "3×FLAG")).toBe("fail");
    expect(status(check, "gap", "SRGN mature start")).toBeUndefined();
    expect(check.arrangementFound).toBe(false);
  });
});
