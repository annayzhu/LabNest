import { describe, expect, it } from "vitest";
import { changedStretch, movedSegments } from "./edits";

describe("features through an edit of the bases", () => {
  const before = "AAAACCCCGGGGTTTT";

  it("keeps features beside a substitution in place and drops the one over it", () => {
    const stretch = changedStretch(before, "AAAACCCCGAGGTTTT");
    expect(stretch).toEqual({ start: 9, end: 10, delta: 0 });
    expect(movedSegments([{ start: 0, end: 8 }], stretch)).toEqual([{ start: 0, end: 8 }]);
    expect(movedSegments([{ start: 8, end: 12 }], stretch)).toBeNull();
    expect(movedSegments([{ start: 12, end: 16 }], stretch)).toEqual([{ start: 12, end: 16 }]);
  });

  it("moves the features after an insertion or a deletion by the change in length", () => {
    const inserted = changedStretch(before, "AAAACCCCAAGGGGTTTT");
    expect(movedSegments([{ start: 8, end: 12, openEnd: true }], inserted)).toEqual([{ start: 10, end: 14, openEnd: true }]);
    expect(movedSegments([{ start: 6, end: 10 }], inserted)).toBeNull();
    const deleted = changedStretch(before, "AAAACCCCTTTT");
    expect(movedSegments([{ start: 12, end: 16 }], deleted)).toEqual([{ start: 8, end: 12 }]);
  });

  it("keeps a feature across the origin when the edit lies between its parts", () => {
    const stretch = changedStretch(before, "AAAACCACGGGGTTTT");
    expect(movedSegments([{ start: 12, end: 16 }, { start: 0, end: 3 }], stretch)).toEqual([{ start: 12, end: 16 }, { start: 0, end: 3 }]);
  });
});
