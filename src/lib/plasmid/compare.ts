import { reverseComplement } from "@/lib/sequence";
import type { SequenceRecord } from "./model";

/** 序列比较 (PRD PW-09): two whole sequences, not a read against a reference, so ends count and nothing has quality. */
export type CompareDifference = {
  /** substitution: both have bases there; insertion: only the other sequence has them; deletion: only this one has them. */
  kind: "substitution" | "insertion" | "deletion";
  /** 0-based half-open on this sequence; start = end for an insertion, which sits before `aStart`. */
  aStart: number;
  aEnd: number;
  /** Half-open, in the other sequence as aligned (after any turn and reverse complement). */
  bStart: number;
  bEnd: number;
  aBases: string;
  bBases: string;
  /** Column in the aligned strings where it starts. */
  column: number;
};

export type Comparison = {
  /** The aligned sequences, of equal length, with "-" in gaps. */
  a: string;
  b: string;
  differences: CompareDifference[];
  /** Matching columns over all columns; end gaps count, so a fragment is never "the same". */
  identity: number;
  /** The other sequence was read on its opposite strand. */
  reversed: boolean;
  /** Bases its origin was moved by; only ever non-zero when both are circular. */
  turn: number;
  /** The same molecule: no differences once strand and origin are allowed for. */
  equivalent: boolean;
  /** Written exactly alike. */
  identical: boolean;
  /** 0-based position in the other sequence as stored, for a position as aligned. */
  originalPosition: (aligned: number) => number;
};

type Molecule = Pick<SequenceRecord, "sequence" | "topology">;

const anchorLength = 14;
// Gaps between anchors are aligned base by base; one this big is two unrelated stretches, not worth the memory.
const maxCells = 16_000_000;

/**
 * Compares two whole sequences (AT17). It tries both strands of the other sequence and, when both are circular, turns
 * its origin to line up; then anchors on stretches found once in each and aligns between them, end to end.
 */
export function compareSequences(first: Molecule, second: Molecule): Comparison {
  const a = first.sequence.toUpperCase();
  const stored = second.sequence.toUpperCase();
  const size = stored.length;
  const reverse = size ? reverseComplement(stored) : "";
  const words = wordsOnce(a);
  const reversed = sharedWords(reverse, words) > sharedWords(stored, words);
  const oriented = reversed ? reverse : stored;
  const turn = first.topology === "circular" && second.topology === "circular" ? bestTurn(oriented, words) : 0;
  const b = turn ? oriented.slice(size - turn) + oriented.slice(0, size - turn) : oriented;
  const aligned = alignWhole(a, b);
  const differences = differencesOf(aligned.a, aligned.b);
  const matches = aligned.a.length - differences.reduce((total, item) => total + Math.max(item.aBases.length, item.bBases.length), 0);
  return {
    ...aligned,
    differences,
    identity: aligned.a.length ? matches / aligned.a.length : 1,
    reversed,
    turn,
    equivalent: !differences.length,
    identical: a === stored,
    originalPosition: (position) => {
      const unturned = (position + size - turn) % Math.max(1, size);
      return reversed ? size - 1 - unturned : unturned;
    },
  };
}

/** Features named in only one of the two, by type and name; positions differ too often to mean anything. */
export function featureDifferences(first: Pick<SequenceRecord, "features">, second: Pick<SequenceRecord, "features">) {
  const names = (record: Pick<SequenceRecord, "features">) => new Set(record.features.map((feature) => `${feature.name} (${feature.type})`));
  const left = names(first);
  const right = names(second);
  return { onlyFirst: [...left].filter((name) => !right.has(name)), onlySecond: [...right].filter((name) => !left.has(name)) };
}

/** Words of `anchorLength` bases found once in the sequence, with where. */
function wordsOnce(sequence: string) {
  const seen = new Map<string, number>();
  for (let at = 0; at + anchorLength <= sequence.length; at += 1) {
    const word = sequence.slice(at, at + anchorLength);
    seen.set(word, seen.has(word) ? -1 : at);
  }
  return seen;
}

function sharedWords(sequence: string, words: Map<string, number>) {
  let shared = 0;
  for (let at = 0; at + anchorLength <= sequence.length; at += 1) if ((words.get(sequence.slice(at, at + anchorLength)) ?? -1) >= 0) shared += 1;
  return shared;
}

/** The turn most shared words agree on: how far to move the other sequence's bases along to line them up with this one. */
function bestTurn(sequence: string, words: Map<string, number>) {
  const size = sequence.length;
  const votes = new Map<number, number>();
  for (let at = 0; at + anchorLength <= size; at += 1) {
    const place = words.get(sequence.slice(at, at + anchorLength)) ?? -1;
    if (place < 0) continue;
    const turn = ((place - at) % size + size) % size;
    votes.set(turn, (votes.get(turn) ?? 0) + 1);
  }
  let best = 0;
  let most = 0;
  for (const [turn, count] of votes) {
    if (count > most) {
      best = turn;
      most = count;
    }
  }
  return best;
}

/** Anchors, in order on both sequences: the longest increasing run of words found once in each. */
function anchors(a: string, b: string) {
  const inA = wordsOnce(a);
  const inB = wordsOnce(b);
  const pairs: Array<[number, number]> = [];
  for (const [word, place] of inA) {
    const other = inB.get(word) ?? -1;
    if (place >= 0 && other >= 0) pairs.push([place, other]);
  }
  pairs.sort((left, right) => left[0] - right[0]);
  const tails: number[] = [];
  const before = new Array<number>(pairs.length).fill(-1);
  pairs.forEach(([, other], index) => {
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (pairs[tails[middle]][1] < other) low = middle + 1;
      else high = middle;
    }
    if (low > 0) before[index] = tails[low - 1];
    tails[low] = index;
  });
  const chain: Array<[number, number]> = [];
  for (let index = tails.length ? tails[tails.length - 1] : -1; index >= 0; index = before[index]) chain.push(pairs[index]);
  return chain.reverse();
}

function alignWhole(a: string, b: string) {
  const left: string[] = [];
  const right: string[] = [];
  let atA = 0;
  let atB = 0;
  const between = (toA: number, toB: number) => {
    const part = alignGap(a.slice(atA, toA), b.slice(atB, toB));
    left.push(part.a);
    right.push(part.b);
    atA = toA;
    atB = toB;
  };
  for (const [placeA, placeB] of anchors(a, b)) {
    // Overlapping words of one matching run extend it; an anchor out of step with the last one is skipped.
    if (placeA < atA || placeB < atB) {
      if (placeA - atA === placeB - atB && placeA + anchorLength > atA) {
        const more = a.slice(atA, placeA + anchorLength);
        left.push(more);
        right.push(more);
        atA = placeA + anchorLength;
        atB = placeB + anchorLength;
      }
      continue;
    }
    between(placeA, placeB);
    const word = a.slice(placeA, placeA + anchorLength);
    left.push(word);
    right.push(word);
    atA = placeA + anchorLength;
    atB = placeB + anchorLength;
  }
  between(a.length, b.length);
  return { a: left.join(""), b: right.join("") };
}

/** Global alignment with affine gaps (Gotoh), so an indel stays in one piece. */
function alignGap(x: string, y: string) {
  if (x === y) return { a: x, b: y };
  if (!x.length) return { a: "-".repeat(y.length), b: y };
  if (!y.length) return { a: x, b: "-".repeat(x.length) };
  const rows = x.length + 1;
  const columns = y.length + 1;
  if (rows * columns > maxCells) return { a: x + "-".repeat(y.length), b: "-".repeat(x.length) + y };
  const match = 2;
  const mismatch = -3;
  const open = -5;
  const extend = -2;
  const worst = -1_000_000_000;
  // Per cell: bits 0-1 where the best came from (0 diagonal, 1 gap in y, 2 gap in x); bit 2, 3 whether each gap goes on.
  const trace = new Uint8Array(rows * columns);
  let best = new Int32Array(columns);
  let gapInY = new Int32Array(columns).fill(worst);
  for (let j = 1; j < columns; j += 1) {
    best[j] = open + extend * j;
    trace[j] = 2 | (j > 1 ? 8 : 0);
  }
  for (let i = 1; i < rows; i += 1) {
    const nextBest = new Int32Array(columns);
    const nextGap = new Int32Array(columns).fill(worst);
    nextBest[0] = open + extend * i;
    nextGap[0] = nextBest[0];
    trace[i * columns] = 1 | (i > 1 ? 4 : 0);
    let gapInX = worst;
    for (let j = 1; j < columns; j += 1) {
      let bits = 0;
      const goOnY = gapInY[j] + extend;
      const startY = best[j] + open + extend;
      if (goOnY > startY) bits |= 4;
      nextGap[j] = Math.max(goOnY, startY);
      const goOnX = gapInX + extend;
      const startX = nextBest[j - 1] + open + extend;
      if (goOnX > startX) bits |= 8;
      gapInX = Math.max(goOnX, startX);
      const diagonal = best[j - 1] + (x[i - 1] === y[j - 1] ? match : mismatch);
      let top = diagonal;
      if (nextGap[j] > top) {
        top = nextGap[j];
        bits = (bits & 12) | 1;
      }
      if (gapInX > top) {
        top = gapInX;
        bits = (bits & 12) | 2;
      }
      nextBest[j] = top;
      trace[i * columns + j] = bits;
    }
    best = nextBest;
    gapInY = nextGap;
  }
  const left: string[] = [];
  const right: string[] = [];
  let i = rows - 1;
  let j = columns - 1;
  let state = 0;
  while (i > 0 || j > 0) {
    const bits = trace[i * columns + j];
    if (state === 0) state = bits & 3;
    if (state === 0) {
      i -= 1;
      j -= 1;
      left.push(x[i]);
      right.push(y[j]);
    } else if (state === 1) {
      state = bits & 4 ? 1 : 0;
      i -= 1;
      left.push(x[i]);
      right.push("-");
    } else {
      state = bits & 8 ? 2 : 0;
      j -= 1;
      left.push("-");
      right.push(y[j]);
    }
  }
  return { a: left.reverse().join(""), b: right.reverse().join("") };
}

function differencesOf(a: string, b: string) {
  const differences: CompareDifference[] = [];
  const kindAt = (column: number): CompareDifference["kind"] | null => (a[column] === b[column] ? null : a[column] === "-" ? "insertion" : b[column] === "-" ? "deletion" : "substitution");
  let atA = 0;
  let atB = 0;
  for (let column = 0; column < a.length;) {
    const kind = kindAt(column);
    if (!kind) {
      atA += 1;
      atB += 1;
      column += 1;
      continue;
    }
    let end = column;
    while (end < a.length && kindAt(end) === kind) end += 1;
    const aBases = a.slice(column, end).replaceAll("-", "");
    const bBases = b.slice(column, end).replaceAll("-", "");
    differences.push({ kind, aStart: atA, aEnd: atA + aBases.length, bStart: atB, bEnd: atB + bBases.length, aBases, bBases, column });
    atA += aBases.length;
    atB += bBases.length;
    column = end;
  }
  return differences;
}
