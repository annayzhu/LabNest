import { describe, expect, it } from "vitest";
import type { AlignmentColumn } from "./align";
import { alignedBlocks, alignedRuns, hiddenEnds, placedColumns } from "./aligned-rows";

const column = (referencePosition: number | null, kind: AlignmentColumn["kind"], readBase: string, originalIndex: number | null, quality: number | null = 40): AlignmentColumn => ({ referencePosition, readIndex: originalIndex, originalIndex, referenceBase: "A", readBase, quality, kind });

describe("the alignment view's lines", () => {
  const placed = placedColumns({ columns: [
    column(10, "match", "A", 0),
    column(11, "mismatch", "G", 1),
    column(null, "insertion", "T", 2),
    column(12, "match", "A", 3),
    column(13, "deletion", "-", null, null),
    column(14, "mismatch", "C", 4, 8),
  ] });

  it("draws matches as dots, changes as letters and an insertion on the base after it", () => {
    expect(alignedRuns(placed, 8, 16, { minQuality: 20 })).toEqual([
      { text: "  " },
      { text: "·", kind: "match" },
      { text: "G", kind: "mismatch" },
      { text: "·", kind: "match", insert: true },
      { text: "-", kind: "deletion" },
      { text: "C", kind: "mismatch", low: true },
      { text: " " },
    ]);
  });

  it("marks one place, also where the read has nothing, and says when a read has nothing to show", () => {
    expect(alignedRuns(placed, 10, 12, { minQuality: 20, mark: 11 })).toEqual([{ text: "·", kind: "match" }, { text: "G", kind: "mismatch", mark: true }]);
    expect(alignedRuns(placed, 0, 10, { minQuality: 20 })).toBeNull();
  });

  it("joins alike bases into one run, so a long match stays one element", () => {
    const long = placedColumns({ columns: Array.from({ length: 100 }, (_, at) => column(at, "match", "A", at)) });
    expect(alignedRuns(long, 0, 100, { minQuality: 20 })).toEqual([{ text: "·".repeat(100), kind: "match" }]);
  });

  it("hides the poor ends of a read but never a confident difference out there", () => {
    const quality = [...Array(30).fill(5), ...Array(60).fill(40), ...Array(30).fill(5)];
    quality[2] = 40;
    const hidden = hiddenEnds(quality, 20);
    expect(hidden(column(0, "match", "A", 1, 5))).toBe(true);
    expect(hidden(column(0, "mismatch", "G", 2, 40))).toBe(false);
    expect(hidden(column(0, "mismatch", "G", 110, 5))).toBe(true);
    expect(hidden(column(0, "match", "A", 50, 40))).toBe(false);
    expect(hiddenEnds(null, 20)(column(0, "match", "A", 1))).toBe(false);
  });

  it("folds runs of empty lines into one stretch, unless a line is asked for", () => {
    const covered = (start: number, end: number) => start < 200 && end > 100;
    expect(alignedBlocks(400, 50, covered, () => false)).toEqual([
      { kind: "gap", start: 0, end: 100 },
      { kind: "line", start: 100, end: 150 },
      { kind: "line", start: 150, end: 200 },
      { kind: "gap", start: 200, end: 400 },
    ]);
    expect(alignedBlocks(200, 50, () => false, (start) => start === 50).map((block) => block.kind)).toEqual(["gap", "line", "gap"]);
  });
});
