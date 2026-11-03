import { describe, expect, it } from "vitest";
import { differenceStops, type AlignmentDifference, type ReadAlignment } from "./align";
import type { SangerRead } from "./model";
import { mixedPeaks } from "./trace";

function readWithSecondPeaks(second: Record<number, number>, quality = 40): SangerRead {
  const scans = 120;
  const channel = () => new Int16Array(scans);
  const traces = { A: channel(), C: channel(), G: channel(), T: channel() };
  const peaks = Array.from({ length: 10 }, (_, index) => 10 + index * 10);
  peaks.forEach((scan, index) => {
    traces.A[scan] = 1000;
    traces.G[scan] = second[index] ?? 50;
  });
  return { name: "r", bases: "AAAAAAAAAA", quality: Array(10).fill(quality), peaks, traces, metadata: {} };
}

describe("double peaks (Q365)", () => {
  it("flags a base whose second channel reaches 30% of the first, and runs of three as a possible mixed clone", () => {
    const result = mixedPeaks(readWithSecondPeaks({ 1: 400, 4: 300, 5: 500, 6: 350, 8: 290 }));
    expect(result.indices).toEqual([1, 4, 5, 6]);
    expect(result.runs).toEqual([{ start: 4, end: 7 }]);
  });

  it("leaves low-quality calls alone and follows an adjusted ratio", () => {
    expect(mixedPeaks(readWithSecondPeaks({ 1: 400 }, 12)).indices).toEqual([]);
    expect(mixedPeaks(readWithSecondPeaks({ 1: 400, 2: 600 }), 0.5).indices).toEqual([2]);
  });
});

describe("next difference (Q367)", () => {
  const difference = (referenceStart: number, confidence: AlignmentDifference["confidence"], homopolymer = false): AlignmentDifference => ({
    kind: "mismatch", referenceStart, referenceEnd: referenceStart + 1, referenceBases: "A", readBases: "C", lowestQuality: 30, confidence, ...(homopolymer ? { homopolymer } : {}),
  });
  const alignment = (differences: AlignmentDifference[]) => ({ differences }) as ReadAlignment;

  it("walks left to right across all reads, stopping at high-quality and homopolymer differences", () => {
    const reads = [alignment([difference(50, "high"), difference(10, "low-quality")]), undefined, alignment([difference(30, "low-quality", true), difference(50, "high")])];
    expect(differenceStops(reads).map((stop) => [stop.read, stop.difference.referenceStart])).toEqual([[2, 30], [0, 50], [2, 50]]);
    expect(differenceStops(reads, true).map((stop) => stop.difference.referenceStart)).toEqual([10, 30, 50, 50]);
  });
});
