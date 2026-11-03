import { describe, expect, it } from "vitest";
import { arcPath, circularLabels, formatSegments, selectionSegments, sequenceRows, stackFeatures } from "./layout";

const features = [
  { segments: [{ start: 0, end: 300 }], strand: 1 as const },
  { segments: [{ start: 100, end: 200 }], strand: -1 as const },
  { segments: [{ start: 400, end: 500 }], strand: 0 as const },
  { segments: [{ start: 950, end: 1000 }, { start: 0, end: 52 }], strand: 1 as const },
];

describe("workbench layout", () => {
  it("stacks overlapping features into lanes, longest nearest the backbone", () => {
    const { pieces, laneCount } = stackFeatures(features, 1000);
    const laneOf = (index: number) => pieces.find((piece) => piece.featureIndex === index)!.lane;
    // Feature 1 (100–200) and the origin-crossing feature 3 do not overlap each other, so they share a lane.
    expect(laneCount).toBe(2);
    expect([laneOf(0), laneOf(1), laneOf(2), laneOf(3)]).toEqual([0, 1, 0, 1]);
    expect(pieces.filter((piece) => piece.featureIndex === 3).map((piece) => piece.arrow)).toEqual([false, true]);
  });

  it("draws arcs and labels without gaps or overlaps", () => {
    for (const piece of stackFeatures(features, 1000).pieces) {
      const path = arcPath(piece, 1000, 80, 92);
      expect(path).toMatch(/^M .* Z$/);
      expect(path).not.toContain("NaN");
    }
    const many = Array.from({ length: 12 }, (_, index) => ({ segments: [{ start: index * 5, end: index * 5 + 4 }] }));
    const labels = circularLabels(many, 1000, 100, 14).filter((label) => label.side === "right").sort((left, right) => left.y - right.y);
    for (let index = 1; index < labels.length; index += 1) expect(labels[index].y - labels[index - 1].y).toBeGreaterThanOrEqual(14);
  });

  it("splits the sequence view into rows and keeps each arrowhead on its 3' end", () => {
    const rows = sequenceRows(1000, features, 60);
    expect(rows).toHaveLength(17);
    const reverse = rows.flatMap((row) => row.pieces.filter((piece) => piece.featureIndex === 1));
    expect(reverse.map((piece) => [piece.start, piece.end, piece.arrow])).toEqual([[100, 120, true], [120, 180, false], [180, 200, false]]);
    const forward = rows.flatMap((row) => row.pieces.filter((piece) => piece.featureIndex === 0));
    expect(forward.filter((piece) => piece.arrow).map((piece) => piece.end)).toEqual([300]);
  });

  it("handles selections across the origin and shows 1-based ranges", () => {
    expect(selectionSegments(950, 52, 1000, true)).toEqual([{ start: 950, end: 1000 }, { start: 0, end: 52 }]);
    expect(selectionSegments(52, 950, 1000, false)).toEqual([{ start: 52, end: 950 }]);
    expect(selectionSegments(950, 52, 1000, false)).toEqual([{ start: 52, end: 950 }]);
    expect(formatSegments([{ start: 2949, end: 3000 }, { start: 0, end: 52 }, { start: 9, end: 10 }])).toBe("2,950–3,000 + 1–52 + 10");
  });
});
