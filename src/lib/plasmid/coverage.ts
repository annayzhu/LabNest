import { columnPositions, type AlignmentColumn, type ReadAlignment } from "./align";
import { DEFAULT_MIN_QUALITY, type Segment } from "./model";

export type CoverageState = "uncovered" | "low" | "interrupted" | "supported" | "conflict";

export type CoverageOptions = {
  minQuality?: number;
  /** Q357: a match is support only with no unresolved high-quality difference this many alignment columns either side. */
  continuity?: number;
  /** Reference positions whose difference a person has accepted (for example a known variant). */
  resolvedPositions?: Set<number>;
};

export type CoverageProfile = ReturnType<typeof coverageProfile>;

export type SequencingStatus = "not-checked" | "partial" | "range-complete" | "full-complete" | "unresolved-differences";

// Within one read the higher rank wins at a position, so a conflict beats everything.
const stateRank: Record<CoverageState, number> = { uncovered: 0, low: 1, interrupted: 2, supported: 3, conflict: 4 };

/**
 * Per-position evidence across reads (F06, F12). Reads in one evidence group (copies,
 * paired exports) count once; a position counts once per read even on a circular origin.
 * Support needs continuous agreement (Q357): matches next to an unresolved high-quality
 * difference are only "interrupted", so a stray agreeing base inside a misaligned insert
 * never counts. An accepted difference counts like a match.
 */
export function coverageProfile(referenceLength: number, reads: Array<{ alignment: ReadAlignment; group?: string }>, options: CoverageOptions = {}) {
  const minQuality = options.minQuality ?? DEFAULT_MIN_QUALITY;
  const continuity = options.continuity ?? 10;
  const resolvedPositions = options.resolvedPositions ?? new Set<number>();
  const reliable = (column: AlignmentColumn) => column.quality !== null && column.quality >= minQuality;
  const byGroup = new Map<string, Uint8Array>();
  for (const { alignment, group } of reads) {
    const key = group ?? `${alignment.readName}#${byGroup.size}`;
    const states = byGroup.get(key) ?? new Uint8Array(referenceLength);
    const columns = alignment.columns;
    const positions = columnPositions(columns);
    const conflicts = columns.map((column, at) => column.kind !== "match" && column.kind !== "ambiguous" && reliable(column)
      && (column.kind === "deletion" || "ACGT".includes(column.readBase))
      && (positions[at] === null || !resolvedPositions.has(positions[at]!)));
    const conflictsBefore = new Int32Array(columns.length + 1);
    conflicts.forEach((value, at) => {
      conflictsBefore[at + 1] = conflictsBefore[at] + (value ? 1 : 0);
    });
    const nearConflict = (at: number) => conflictsBefore[Math.min(columns.length, at + continuity + 1)] - conflictsBefore[Math.max(0, at - continuity)] > 0;
    columns.forEach((column, at) => {
      const position = positions[at];
      if (position === null) return;
      let state: CoverageState;
      if (conflicts[at]) state = "conflict";
      else if (!reliable(column) || column.kind === "ambiguous") state = "low";
      else if (column.kind === "insertion") return;
      else state = nearConflict(at) ? "interrupted" : "supported";
      states[position] = Math.max(states[position], stateRank[state]);
    });
    byGroup.set(key, states);
  }
  const supported = new Uint16Array(referenceLength);
  const interrupted = new Uint16Array(referenceLength);
  const conflicting = new Uint16Array(referenceLength);
  const low = new Uint16Array(referenceLength);
  for (const states of byGroup.values()) {
    for (let position = 0; position < referenceLength; position += 1) {
      if (states[position] === stateRank.supported) supported[position] += 1;
      else if (states[position] === stateRank.interrupted) interrupted[position] += 1;
      else if (states[position] === stateRank.conflict) conflicting[position] += 1;
      else if (states[position] === stateRank.low) low[position] += 1;
    }
  }
  const stateAt = (position: number): CoverageState => (conflicting[position] ? "conflict"
    : supported[position] ? "supported" : interrupted[position] ? "interrupted" : low[position] ? "low" : "uncovered");
  const ranges: Array<{ start: number; end: number; state: CoverageState }> = [];
  for (let position = 0; position < referenceLength; position += 1) {
    const state = stateAt(position);
    const last = ranges[ranges.length - 1];
    if (last && last.state === state) last.end = position + 1;
    else ranges.push({ start: position, end: position + 1, state });
  }
  return { referenceLength, independentReads: byGroup.size, supported, interrupted, conflicting, low, stateAt, ranges };
}

/**
 * Sequencing-check dimension of F12. "Complete" needs every position in scope supported
 * and a person's confirmation; the full-sequence state also needs the whole reference.
 * Differences a person accepted are passed to `coverageProfile` as resolved positions.
 */
export function sequencingStatus(profile: CoverageProfile, options: { range?: Segment; confirmed?: boolean } = {}): SequencingStatus {
  const range = options.range ?? { start: 0, end: profile.referenceLength };
  if (!profile.ranges.some((item) => item.state !== "uncovered")) return "not-checked";
  let allSupported = true;
  for (let position = range.start; position < range.end; position += 1) {
    const state = profile.stateAt(position);
    if (state === "conflict") return "unresolved-differences";
    if (state !== "supported") allSupported = false;
  }
  if (!allSupported || !options.confirmed) return "partial";
  return range.start === 0 && range.end === profile.referenceLength ? "full-complete" : "range-complete";
}
