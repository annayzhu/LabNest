import { reverseComplement } from "@/lib/sequence";
import { foldSegments } from "./layout";
import { IUPAC_BASES, type Segment, type SequenceRecord, type Strand } from "./model";
import { findPeptide } from "./tags";
import { sixFrameTranslations } from "./translate";

export type SearchHit = { strand: Strand; segments: Segment[]; mismatches: number };

const maxHits = 500;

/**
 * Finds a DNA query on both strands (F04). IUPAC codes on either side match any base they can stand for, so an R in
 * the query finds A or G and an N in the sequence never stops a match; `maxMismatches` allows that many other bases.
 * On a circular record a hit may run across the origin.
 */
export function searchDna(record: SequenceRecord, query: string, maxMismatches = 0): SearchHit[] {
  const pattern = query.toUpperCase().replace(/[^A-Z]/g, "");
  const length = record.sequence.length;
  if (!pattern || pattern.length > length) return [];
  const scanned = record.topology === "circular" ? record.sequence + record.sequence.slice(0, pattern.length - 1) : record.sequence;
  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  for (const [strand, oriented] of [[1, pattern], [-1, reverseComplement(pattern)]] as const) {
    for (let at = 0; at < length && at + oriented.length <= scanned.length; at += 1) {
      let mismatches = 0;
      for (let index = 0; index < oriented.length && mismatches <= maxMismatches; index += 1) if (!sameBase(oriented[index], scanned[at + index])) mismatches += 1;
      if (mismatches > maxMismatches) continue;
      const segments = foldSegments(at, at + oriented.length, length);
      const key = segments.map((segment) => `${segment.start}-${segment.end}`).join(",");
      // A palindrome reads the same on both strands: one hit, on the top strand.
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({ strand, segments: strand === -1 ? [...segments].reverse() : segments, mismatches });
      if (hits.length >= maxHits) return hits;
    }
  }
  return hits.sort((left, right) => left.mismatches - right.mismatches || first(left) - first(right));
}

/** Finds a peptide in all six frames (F04), across the origin of a circular record too. */
export function searchProtein(record: SequenceRecord, peptide: string, maxMismatches = 0): SearchHit[] {
  const query = peptide.toUpperCase().replace(/[^A-Z*]/g, "");
  const length = record.sequence.length;
  if (!query || query.length * 3 > length) return [];
  const scanned = record.topology === "circular" ? record.sequence + record.sequence.slice(0, query.length * 3) : record.sequence;
  return findPeptide(scanned, query, query, { frames: sixFrameTranslations(scanned), maxMismatches })
    .filter((hit) => hit.start < length)
    .slice(0, maxHits)
    .map((hit) => {
      const segments = foldSegments(hit.start, hit.end, length);
      return { strand: hit.strand, segments: hit.strand === -1 ? [...segments].reverse() : segments, mismatches: hit.mismatches };
    })
    .sort((left, right) => left.mismatches - right.mismatches || first(left) - first(right));
}

/**
 * A query is read as DNA when its letters are nucleotide codes and at least 80% of them are A, C, G, T, U or N: D, Y
 * and K are IUPAC codes too, so "DYKDDDDK" would otherwise pass for DNA.
 */
export function looksLikeDna(query: string) {
  const letters = query.toUpperCase().replace(/[^A-Z]/g, "");
  if (!letters.length || ![...letters].every((letter) => letter in IUPAC_BASES || letter === "U")) return false;
  return [...letters].filter((letter) => "ACGTUN".includes(letter)).length >= 0.8 * letters.length;
}

function sameBase(query: string, base: string) {
  const options = IUPAC_BASES[base] ?? base;
  return [...(IUPAC_BASES[query] ?? query)].some((letter) => options.includes(letter));
}

function first(hit: SearchHit) {
  return Math.min(...hit.segments.map((segment) => segment.start));
}
