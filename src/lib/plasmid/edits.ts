import type { Segment } from "./model";

/** The stretch an edit changed, in the old coordinates: bases before `start` and from `end` on are untouched. */
export type ChangedStretch = { start: number; end: number; delta: number };

export function changedStretch(before: string, after: string): ChangedStretch {
  const shortest = Math.min(before.length, after.length);
  let prefix = 0;
  while (prefix < shortest && before[prefix] === after[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < shortest - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix += 1;
  return { start: prefix, end: before.length - suffix, delta: after.length - before.length };
}

/**
 * A feature's segments after an edit: segments wholly before the changed stretch stay, those wholly after it move with
 * the length change, and a feature with any segment on the changed bases is dropped (null).
 */
export function movedSegments(segments: Segment[], stretch: ChangedStretch): Segment[] | null {
  const moved: Segment[] = [];
  for (const segment of segments) {
    if (segment.end <= stretch.start) moved.push(segment);
    else if (segment.start >= stretch.end) moved.push({ ...segment, start: segment.start + stretch.delta, end: segment.end + stretch.delta });
    else return null;
  }
  return moved;
}
