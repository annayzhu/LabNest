import { reverseComplement } from "@/lib/sequence";
import { DEFAULT_MIN_QUALITY, IUPAC_BASES, type SangerRead, type Segment, type Topology } from "./model";

export const ALIGNER_VERSION = "labnest-sanger-align/0.1.0 (local Smith-Waterman, affine gaps, 12-mer seeds)";

export type AlignmentParameters = {
  match: number;
  mismatch: number;
  /** A gap of length k costs gapOpen + k × gapExtend. */
  gapOpen: number;
  gapExtend: number;
  seedLength: number;
  /** Phred value below which a base is shown as low quality. */
  minQuality: number;
  minScore: number;
  /** A second placement scoring at least this share of the best one marks the read as multi-mapped. */
  secondaryRatio: number;
};

export const defaultAlignmentParameters: AlignmentParameters = {
  match: 2,
  mismatch: 3,
  gapOpen: 5,
  gapExtend: 2,
  seedLength: 12,
  minQuality: DEFAULT_MIN_QUALITY,
  minScore: 50,
  secondaryRatio: 0.9,
};

export type Orientation = "forward" | "reverse";

export type AlignmentColumn = {
  /** Reference position (0-based); circular positions are folded into 0..length-1. Null for an insertion. */
  referencePosition: number | null;
  /** Index in the read as aligned (reverse-complemented for a reverse read). Null for a deletion. */
  readIndex: number | null;
  /** Index in the read as stored in the file; the trace and quality use this one. */
  originalIndex: number | null;
  referenceBase: string;
  readBase: string;
  /** Read quality; for a deletion the lower quality of the two flanking bases. */
  quality: number | null;
  kind: "match" | "mismatch" | "insertion" | "deletion" | "ambiguous";
};

export type DifferenceConfidence = "high" | "low-quality" | "no-quality" | "ambiguous-base";

export type AlignmentDifference = {
  kind: "mismatch" | "insertion" | "deletion" | "ambiguous";
  /** For an insertion, the reference position the inserted bases sit before. */
  referenceStart: number;
  /** Past the reference length when a deletion crosses a circular origin (it goes on from position 0). */
  referenceEnd: number;
  referenceBases: string;
  readBases: string;
  lowestQuality: number | null;
  confidence: DifferenceConfidence;
  /** An indel that only changes the length of a run of one base: a common basecalling error, so check the trace. */
  homopolymer?: boolean;
};

export type ReadAlignment = {
  readName: string;
  orientation: Orientation;
  score: number;
  /** Reference intervals covered (two when the read crosses a circular origin). */
  referenceSegments: Segment[];
  /** Aligned part of the read in aligned orientation; bases outside it are clipped. */
  readStart: number;
  readEnd: number;
  readLength: number;
  columns: AlignmentColumn[];
  differences: AlignmentDifference[];
  /** Other places scoring at least `secondaryRatio` of the best: the read is multi-mapped when there are any. */
  secondary: Array<{ orientation: Orientation; referenceStart: number; score: number }>;
  parameters: AlignmentParameters;
  algorithm: string;
};

export type AlignmentOutcome = { readName: string; aligned: true; alignment: ReadAlignment } | { readName: string; aligned: false; reason: string };

/**
 * Aligns Sanger reads to one reference (F06). Each read is tried in both orientations
 * around its k-mer seed clusters; on a circular reference the start is appended to the
 * end so a read across the origin aligns in one piece and folds back to single-turn
 * positions. Reads are never merged into a consensus.
 */
export function createAligner(reference: string, topology: Topology, parameters = defaultAlignmentParameters, maxReadLength = 3_000) {
  const circular = topology === "circular";
  const length = reference.length;
  const target = circular ? reference + reference.slice(0, Math.min(length, maxReadLength)) : reference;
  const table = scoreTable(parameters);
  const k = parameters.seedLength;
  const index = new Map<string, number[]>();
  for (let at = 0; at + k <= target.length; at += 1) {
    const kmer = target.slice(at, at + k);
    if (!/^[ACGT]+$/.test(kmer)) continue;
    const positions = index.get(kmer);
    if (positions) positions.push(at);
    else index.set(kmer, [at]);
  }

  const candidates = (query: string) => {
    const diagonals: number[] = [];
    for (let at = 0; at + k <= query.length; at += 1) {
      const positions = index.get(query.slice(at, at + k));
      if (!positions || positions.length > 64) continue;
      for (const position of positions) diagonals.push(position - at);
    }
    diagonals.sort((left, right) => left - right);
    const clusters: Array<{ low: number; high: number; seeds: number }> = [];
    for (const diagonal of diagonals) {
      const last = clusters[clusters.length - 1];
      if (last && diagonal - last.high <= 60) {
        last.high = diagonal;
        last.seeds += 1;
      } else clusters.push({ low: diagonal, high: diagonal, seeds: 1 });
    }
    return clusters.filter((cluster) => cluster.seeds >= 3).sort((left, right) => right.seeds - left.seeds).slice(0, 4);
  };

  function align(read: SangerRead): AlignmentOutcome {
    const readLength = read.bases.length;
    if (readLength > maxReadLength) return { readName: read.name, aligned: false, reason: `The read is longer than ${maxReadLength} bases.` };
    const placements: Placement[] = [];
    for (const orientation of ["forward", "reverse"] as const) {
      const query = orientation === "forward" ? read.bases : reverseComplement(read.bases);
      for (const cluster of candidates(query)) {
        const offset = Math.max(0, cluster.low - 80);
        const windowEnd = Math.min(target.length, cluster.high + query.length + 80);
        const hit = localAlign(query, target.slice(offset, windowEnd), table, parameters);
        if (!hit || hit.score < parameters.minScore) continue;
        placements.push({ hit, orientation, offset, segments: foldedSegments(offset + hit.targetStart, offset + hit.targetEnd, length, circular) });
      }
    }
    if (!placements.length) return { readName: read.name, aligned: false, reason: "No placement on the reference reached the minimum score." };
    placements.sort((left, right) => right.hit.score - left.hit.score);
    const best = placements[0];
    const samePlace = (a: Placement, b: Placement) => a.orientation === b.orientation && overlap(a.segments, b.segments) > 0.5;
    const distinct: Placement[] = [];
    for (const placement of placements.slice(1)) if (![best, ...distinct].some((other) => samePlace(placement, other))) distinct.push(placement);
    const secondary = distinct.filter((placement) => placement.hit.score >= best.hit.score * parameters.secondaryRatio);

    const query = best.orientation === "forward" ? read.bases : reverseComplement(read.bases);
    const qualityAt = (originalIndex: number) => (read.quality ? read.quality[originalIndex] : null);
    const columns: AlignmentColumn[] = [];
    let readIndex = best.hit.queryStart;
    let targetIndex = best.offset + best.hit.targetStart;
    for (const op of best.hit.ops) {
      const referencePosition = op === "I" ? null : circular ? targetIndex % length : targetIndex;
      const originalIndex = op === "D" ? null : best.orientation === "forward" ? readIndex : readLength - 1 - readIndex;
      const readBase = op === "D" ? "-" : query[readIndex];
      const referenceBase = op === "I" ? "-" : target[targetIndex];
      let kind: AlignmentColumn["kind"] = op === "I" ? "insertion" : op === "D" ? "deletion" : "match";
      if (op === "M" && readBase !== referenceBase) kind = compatible(readBase, referenceBase) ? "ambiguous" : "mismatch";
      else if (op === "M" && !"ACGT".includes(readBase)) kind = "ambiguous";
      columns.push({ referencePosition, readIndex: op === "D" ? null : readIndex, originalIndex, referenceBase, readBase, quality: originalIndex === null ? null : qualityAt(originalIndex), kind });
      if (op !== "D") readIndex += 1;
      if (op !== "I") targetIndex += 1;
    }
    columns.forEach((column, at) => {
      if (column.kind !== "deletion" || !read.quality) return;
      const before = columns.slice(0, at).reverse().find((item) => item.originalIndex !== null);
      const after = columns.slice(at + 1).find((item) => item.originalIndex !== null);
      const flanks = [before?.quality, after?.quality].filter((value): value is number => typeof value === "number");
      column.quality = flanks.length ? Math.min(...flanks) : null;
    });

    return {
      readName: read.name,
      aligned: true,
      alignment: {
        readName: read.name,
        orientation: best.orientation,
        score: best.hit.score,
        referenceSegments: best.segments,
        readStart: best.hit.queryStart,
        readEnd: best.hit.queryEnd,
        readLength,
        columns,
        differences: differencesOf(columns, parameters.minQuality, circular ? length : undefined),
        secondary: secondary.map((placement) => ({ orientation: placement.orientation, referenceStart: placement.segments[0].start, score: placement.hit.score })),
        parameters,
        algorithm: ALIGNER_VERSION,
      },
    };
  }

  return { align };
}

/** The reference position each column speaks for; an insertion speaks for the base after it (null when none follows). */
export function columnPositions(columns: AlignmentColumn[]) {
  const positions: Array<number | null> = new Array(columns.length).fill(null);
  for (let at = columns.length - 1, next: number | null = null; at >= 0; at -= 1) {
    if (columns[at].referencePosition !== null) next = columns[at].referencePosition;
    positions[at] = next;
  }
  return positions;
}

type LocalHit = { score: number; queryStart: number; queryEnd: number; targetStart: number; targetEnd: number; ops: string };

type Placement = { hit: LocalHit; orientation: Orientation; offset: number; segments: Segment[] };

/** Two IUPAC codes that could stand for the same base (an N could be anything). */
function compatible(left: string, right: string) {
  const options = IUPAC_BASES[right] ?? "";
  return [...(IUPAC_BASES[left] ?? "")].some((base) => options.includes(base));
}

/** Scores every pair of IUPAC codes. A code that could be the other base scores 0: an N neither supports nor breaks an alignment. */
function scoreTable(parameters: AlignmentParameters) {
  const table = new Int32Array(128 * 128).fill(-parameters.mismatch);
  for (const [left, leftBases] of Object.entries(IUPAC_BASES)) {
    for (const [right, rightBases] of Object.entries(IUPAC_BASES)) {
      const certain = leftBases.length === 1 && rightBases.length === 1;
      table[left.charCodeAt(0) * 128 + right.charCodeAt(0)] = !compatible(left, right) ? -parameters.mismatch : certain ? parameters.match : 0;
    }
  }
  return table;
}

/**
 * Smith-Waterman local alignment with Gotoh's affine gaps; `ops` lists M (aligned pair),
 * I (read base only) and D (reference base only). Each traceback cell holds where H came
 * from (0 start, 1 diagonal, 2 a D gap, 3 an I gap), plus 4 when the D gap opened at that
 * cell and 8 when the I gap did.
 */
function localAlign(query: string, target: string, table: Int32Array, parameters: AlignmentParameters): LocalHit | null {
  const n = query.length;
  const m = target.length;
  const width = m + 1;
  const negative = -1_000_000_000;
  const traceback = new Uint8Array((n + 1) * width);
  let previousH = new Int32Array(width);
  let currentH = new Int32Array(width);
  let previousF = new Int32Array(width).fill(negative);
  let currentF = new Int32Array(width).fill(negative);
  const openCost = parameters.gapOpen + parameters.gapExtend;
  let best = 0;
  let bestI = 0;
  let bestJ = 0;
  for (let i = 1; i <= n; i += 1) {
    const row = query.charCodeAt(i - 1) * 128;
    let e = negative;
    currentH[0] = 0;
    for (let j = 1; j <= m; j += 1) {
      let flags = 0;
      const eOpen = currentH[j - 1] - openCost;
      const eExtend = e - parameters.gapExtend;
      if (eOpen >= eExtend) {
        e = eOpen;
        flags |= 4;
      } else e = eExtend;
      const fOpen = previousH[j] - openCost;
      const fExtend = previousF[j] - parameters.gapExtend;
      let f: number;
      if (fOpen >= fExtend) {
        f = fOpen;
        flags |= 8;
      } else f = fExtend;
      currentF[j] = f;
      const diagonal = previousH[j - 1] + table[row + target.charCodeAt(j - 1)];
      let h = 0;
      let source = 0;
      if (diagonal > h) {
        h = diagonal;
        source = 1;
      }
      if (e > h) {
        h = e;
        source = 2;
      }
      if (f > h) {
        h = f;
        source = 3;
      }
      currentH[j] = h;
      traceback[i * width + j] = flags | source;
      if (h > best) {
        best = h;
        bestI = i;
        bestJ = j;
      }
    }
    [previousH, currentH] = [currentH, previousH];
    [previousF, currentF] = [currentF, previousF];
  }
  if (best <= 0) return null;
  const ops: string[] = [];
  let i = bestI;
  let j = bestJ;
  let state = 0;
  while (i > 0 && j > 0) {
    const cell = traceback[i * width + j];
    if (state === 0) {
      const source = cell & 3;
      if (source === 0) break;
      if (source === 1) {
        ops.push("M");
        i -= 1;
        j -= 1;
      } else state = source === 2 ? 1 : 2;
      continue;
    }
    if (state === 1) {
      ops.push("D");
      j -= 1;
      if (cell & 4) state = 0;
      continue;
    }
    ops.push("I");
    i -= 1;
    if (cell & 8) state = 0;
  }
  return { score: best, queryStart: i, queryEnd: bestI, targetStart: j, targetEnd: bestJ, ops: ops.reverse().join("") };
}

function foldedSegments(start: number, end: number, length: number, circular: boolean): Segment[] {
  if (!circular || end <= length) return [{ start, end }];
  if (start >= length) return [{ start: start - length, end: end - length }];
  return [{ start, end: length }, { start: 0, end: end - length }];
}

function overlap(left: Segment[], right: Segment[]) {
  let shared = 0;
  for (const a of left) for (const b of right) shared += Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
  const size = (segments: Segment[]) => segments.reduce((total, segment) => total + segment.end - segment.start, 0);
  return shared / Math.max(1, Math.min(size(left), size(right)));
}

function confidence(qualities: Array<number | null>, bases: string, minQuality: number): DifferenceConfidence {
  if ([...bases].some((base) => !"ACGT".includes(base))) return "ambiguous-base";
  if (qualities.some((value) => value === null)) return "no-quality";
  return Math.min(...(qualities as number[])) >= minQuality ? "high" : "low-quality";
}

/** `circularLength` is the reference length when it is circular: a deletion across the origin then ends past it. */
function differencesOf(columns: AlignmentColumn[], minQuality: number, circularLength?: number) {
  const differences: AlignmentDifference[] = [];
  const positions = columnPositions(columns);
  const last = [...columns].reverse().find((column) => column.referencePosition !== null);
  for (let at = 0; at < columns.length; at += 1) {
    const column = columns[at];
    if (column.kind === "match") continue;
    if (column.kind === "mismatch" || column.kind === "ambiguous") {
      differences.push({
        kind: column.kind,
        referenceStart: column.referencePosition!,
        referenceEnd: column.referencePosition! + 1,
        referenceBases: column.referenceBase,
        readBases: column.readBase,
        lowestQuality: column.quality,
        confidence: confidence([column.quality], column.readBase, minQuality),
      });
      continue;
    }
    let end = at;
    while (end + 1 < columns.length && columns[end + 1].kind === column.kind) end += 1;
    const run = columns.slice(at, end + 1);
    const qualities = run.map((item) => item.quality);
    const known = qualities.filter((value): value is number => value !== null);
    const changed = run.map((item) => (column.kind === "insertion" ? item.readBase : item.referenceBase)).join("");
    const flanks = [columns[at - 1]?.referenceBase, columns[end + 1]?.referenceBase];
    const homopolymer = new Set(changed).size === 1 && flanks.includes(changed[0]) ? { homopolymer: true } : {};
    if (column.kind === "insertion") {
      const position = positions[end + 1] ?? (last ? last.referencePosition! + 1 : 0);
      differences.push({ kind: "insertion", referenceStart: position, referenceEnd: position, referenceBases: "", readBases: changed, lowestQuality: known.length ? Math.min(...known) : null, confidence: confidence(qualities, changed, minQuality), ...homopolymer });
    } else {
      const stop = run[run.length - 1].referencePosition! + 1;
      differences.push({
        kind: "deletion",
        referenceStart: column.referencePosition!,
        referenceEnd: circularLength && stop <= column.referencePosition! ? stop + circularLength : stop,
        referenceBases: changed,
        readBases: "",
        lowestQuality: known.length ? Math.min(...known) : null,
        confidence: confidence(qualities, "", minQuality),
        ...homopolymer,
      });
    }
    at = end;
  }
  return differences;
}

/** One place "next difference" stops (Q367): a difference in one read. */
export type DifferenceStop = { read: number; difference: AlignmentDifference };

/**
 * The order "next difference" walks (Q367): by reference position from left to right across every read, then by read.
 * It stops at high-quality differences and homopolymer flags; low-quality and ambiguous ones only with `includeLow`.
 */
export function differenceStops(alignments: Array<ReadAlignment | undefined>, includeLow = false): DifferenceStop[] {
  const stops = alignments.flatMap((alignment, read) => (alignment?.differences ?? [])
    .filter((difference) => includeLow || difference.confidence === "high" || difference.homopolymer)
    .map((difference) => ({ read, difference })));
  return stops.sort((left, right) => left.difference.referenceStart - right.difference.referenceStart || left.read - right.read);
}
