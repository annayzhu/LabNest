import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { reverseComplement } from "@/lib/sequence";
import { createAligner, type ReadAlignment } from "./align";
import { coverageProfile, sequencingStatus } from "./coverage";
import { differenceContext } from "./effects";
import { groupReadEvidence, importSequenceFiles, parseSequenceFile } from "./files";
import type { SangerRead } from "./model";
import { construct, readPlans } from "./test-samples/build";
import { mottTrim, traceWindow } from "./trace";

const root = "src/lib/plasmid/test-samples/files";
const bytesOf = (path: string) => new Uint8Array(readFileSync(join(root, path)));
const readOf = (path: string) => parseSequenceFile(path, bytesOf(path)).reads[0];
const [reference] = parseSequenceFile("A10-reference.gb", bytesOf("A10-reference.gb")).records;
const aligner = createAligner(reference.sequence, reference.topology);

function aligned(read: SangerRead): ReadAlignment {
  const outcome = aligner.align(read);
  if (!outcome.aligned) throw new Error(outcome.reason);
  return outcome.alignment;
}

const high = (alignment: ReadAlignment) => alignment.differences.filter((difference) => difference.confidence === "high");

describe("Sanger alignment against a reference", () => {
  it("A10: a clean forward read covers both tag junctions without high-confidence differences", () => {
    const alignment = aligned(readOf("A10-read-F.ab1"));
    expect(alignment.orientation).toBe("forward");
    expect(alignment.referenceSegments[0].start).toBeLessThanOrEqual(570);
    expect(alignment.referenceSegments[0].end).toBeGreaterThanOrEqual(1250);
    expect(high(alignment)).toEqual([]);
    const profile = coverageProfile(reference.sequence.length, [{ alignment }]);
    for (const junction of [construct.tag.start, construct.tag.end]) {
      for (let position = junction - 9; position < junction + 9; position += 1) expect(profile.stateAt(position)).toBe("supported");
    }
  });

  it("A11: the R31Q change is one high-quality difference that matches the known-variant note", () => {
    const alignment = aligned(readOf("A11-read-Q31.ab1"));
    expect(high(alignment).map((difference) => [difference.kind, difference.referenceStart, difference.referenceBases, difference.readBases])).toEqual([
      ["mismatch", construct.r31Middle, "G", "A"],
    ]);
    const context = differenceContext(high(alignment)[0], reference);
    expect(context.knownVariant).toContain("R31Q");
    expect(context.matchesKnownVariant).toBe(true);
    expect(context.coding).toEqual([
      { feature: "SIM SRGN signal-3xFLAG-mature", codon: 53, referenceCodon: "CGG", readCodon: "CAG", referenceAminoAcid: "R", readAminoAcid: "Q" },
    ]);
  });

  it("Q357: support needs continuous agreement until a person accepts the difference", () => {
    const alignment = aligned(readOf("A11-read-Q31.ab1"));
    const position = construct.r31Middle;
    const range = { start: position - 30, end: position + 30 };
    const open = coverageProfile(reference.sequence.length, [{ alignment }]);
    expect(open.stateAt(position)).toBe("conflict");
    for (const offset of [1, 5, 10]) {
      expect(open.stateAt(position - offset)).toBe("interrupted");
      expect(open.stateAt(position + offset)).toBe("interrupted");
    }
    expect(open.stateAt(position + 11)).toBe("supported");
    expect(sequencingStatus(open, { range, confirmed: true })).toBe("unresolved-differences");
    const accepted = coverageProfile(reference.sequence.length, [{ alignment }], { resolvedPositions: new Set([position]) });
    expect([accepted.stateAt(position), accepted.stateAt(position + 1)]).toEqual(["supported", "supported"]);
    expect(sequencingStatus(accepted, { range, confirmed: true })).toBe("range-complete");
  });

  it("A12: a reverse read keeps bases, quality and trace in step in both views", () => {
    const read = readOf("A12-read-R.ab1");
    const alignment = aligned(read);
    expect(alignment.orientation).toBe("reverse");
    expect(alignment.referenceSegments[0].start).toBeLessThanOrEqual(910);
    expect(alignment.referenceSegments[0].end).toBeGreaterThanOrEqual(1590);
    expect(high(alignment)).toEqual([]);
    const complement: Record<string, string> = { A: "T", C: "G", G: "C", T: "A" };
    for (const column of alignment.columns.filter((item) => item.kind === "match")) {
      expect(column.readBase).toBe(reference.sequence[column.referencePosition!]);
      expect(read.bases[column.originalIndex!]).toBe(complement[column.readBase]);
      expect(column.quality).toBe(read.quality![column.originalIndex!]);
    }
    for (const view of ["aligned", "original"] as const) {
      const window = traceWindow(read, alignment, 1200, 1260, view)!;
      expect(window.calls).toHaveLength(60);
      for (const call of window.calls.filter((item) => item.kind === "match" && (item.quality ?? 0) >= 20)) {
        const at = call.scan - window.scanStart;
        const heights = (["A", "C", "G", "T"] as const).map((channel) => window.channels[channel][at]);
        expect(window.channels[call.base as "A"][at]).toBe(Math.max(...heights));
        const expected = reference.sequence[call.referencePosition!];
        expect(call.base).toBe(view === "aligned" ? expected : complement[expected]);
      }
    }
  });

  it("A13: low-quality tails and N are never high-confidence differences or support", () => {
    const read = readOf("A13-read-low-tail.ab1");
    const alignment = aligned(read);
    expect(high(alignment)).toEqual([]);
    expect(alignment.differences.some((difference) => difference.confidence === "low-quality" || difference.confidence === "ambiguous-base")).toBe(true);
    const trim = mottTrim(read.quality!);
    expect(trim.start).toBeGreaterThanOrEqual(25);
    expect(trim.end).toBeLessThanOrEqual(read.bases.length - 100);
    const profile = coverageProfile(reference.sequence.length, [{ alignment }]);
    const tail = alignment.columns.filter((column) => column.originalIndex !== null && column.originalIndex >= read.bases.length - 120 && column.referencePosition !== null);
    expect(tail.length).toBeGreaterThan(0);
    expect(tail.every((column) => profile.stateAt(column.referencePosition!) !== "supported")).toBe(true);
  });

  it("A14: copies and exports of one run count as one read", async () => {
    const sources = await importSequenceFiles(["A14-run/SIM-C3-M13F.ab1", "A14-run/SIM-C3-M13F.seq", "A14-run/SIM-C3-copy.zip"].map((path) => ({ path, bytes: bytesOf(path) })));
    const { reads } = groupReadEvidence(sources);
    const profile = coverageProfile(reference.sequence.length, reads.map((item) => ({ alignment: aligned(item.read), group: item.group })));
    expect(profile.independentReads).toBe(1);
    expect(Math.max(...profile.supported)).toBe(1);
  });

  it("A14: an .ab1 and its .seq picked on their own, without a folder, still pair", async () => {
    const sources = await importSequenceFiles(["A14-run/SIM-C3-M13F.ab1", "A14-run/SIM-C3-M13F.seq"].map((path) => ({ path: path.split("/").pop()!, bytes: bytesOf(path) })));
    const { groups } = groupReadEvidence(sources);
    expect(groups).toHaveLength(1);
    expect(groups[0].reasons).toEqual(["paired-export"]);
  });

  it("A15: covering only the insert is a partial check, never a full one", () => {
    const profile = coverageProfile(reference.sequence.length, [{ alignment: aligned(readOf("A15-read-insert-only.ab1")) }]);
    expect(sequencingStatus(profile, { confirmed: true })).toBe("partial");
    expect(sequencingStatus(profile, { range: construct.tag })).toBe("partial");
    expect(sequencingStatus(profile, { range: construct.tag, confirmed: true })).toBe("range-complete");
  });

  it("A16: a read across the circular origin covers each position once", () => {
    const alignment = aligned(readOf("A16-read-origin.ab1"));
    const length = reference.sequence.length;
    expect(alignment.referenceSegments).toHaveLength(2);
    expect(alignment.referenceSegments[0].end).toBe(length);
    expect(alignment.referenceSegments[1].start).toBe(0);
    const profile = coverageProfile(length, [{ alignment }]);
    expect(Math.max(...profile.supported)).toBe(1);
    const covered = profile.ranges.filter((range) => range.state !== "uncovered").reduce((total, range) => total + range.end - range.start, 0);
    expect(covered).toBe(alignment.columns.filter((column) => column.referencePosition !== null).length);
    expect(covered).toBeGreaterThan(560);
  });

  it("calls a deletion and an insertion at high quality", () => {
    const alignment = aligned(readOf("F06-read-indels.ab1"));
    expect(high(alignment).map((difference) => [difference.kind, difference.referenceStart, difference.referenceEnd, difference.referenceBases, difference.readBases])).toEqual([
      ["deletion", 1800, 1801, reference.sequence[1800], ""],
      ["insertion", 1950, 1950, "", "TTA"],
    ]);
  });

  it("flags a read that fits two places and refuses one that fits none", () => {
    const repeat = reference.sequence.slice(1300, 1700);
    const doubled = `${reference.sequence.slice(0, 2000)}${repeat}${reference.sequence.slice(2000)}`;
    const outcome = createAligner(doubled, "circular").align({ ...readOf("A10-read-F.ab1"), name: "inside repeat", bases: repeat.slice(50, 350), quality: Array(300).fill(40), peaks: null, traces: null });
    expect(outcome.aligned && outcome.alignment.secondary.length > 0).toBe(true);
    const unrelated = aligner.align({ name: "unrelated", bases: reverseComplement(readPlans.a10.template).replace(/[AC]/g, "G").slice(0, 400), quality: null, peaks: null, traces: null, metadata: {} });
    expect(unrelated.aligned).toBe(false);
  });

  it("meets the PRD target of 20 reads on a 10 kb reference within 10 s", () => {
    const big = `${reference.sequence}${reference.sequence.split("").reverse().join("")}${reference.sequence}${reference.sequence.slice(0, 1153)}`;
    expect(big).toHaveLength(10_000);
    const bigAligner = createAligner(big, "circular");
    const read = readOf("A10-read-F.ab1");
    const started = performance.now();
    for (let index = 0; index < 20; index += 1) {
      const outcome = bigAligner.align({ ...read, bases: index % 2 ? reverseComplement(read.bases) : read.bases, quality: index % 2 ? [...read.quality!].reverse() : read.quality });
      expect(outcome.aligned).toBe(true);
    }
    expect(performance.now() - started).toBeLessThan(10_000);
  });
});
