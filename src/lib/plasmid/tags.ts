import type { Strand } from "./model";
import { frameSpan, sixFrameTranslations, type ReadingFrame } from "./translate";

export type ProteinTag = { id: string; name: string; protein: string; source: string };

/**
 * Built-in tag library (Q278). The 22 aa 3×FLAG and three standard FLAGs in a row are
 * different tags and are named apart (F04, A07).
 */
export const TAG_LIBRARY: { version: string; tags: ProteinTag[] } = {
  version: "labnest-tags/2026-11-02",
  tags: [
    { id: "flag", name: "FLAG", protein: "DYKDDDDK", source: "Hopp et al. 1988, Bio/Technology 6:1204" },
    { id: "3xflag-22aa", name: "3×FLAG (22 aa)", protein: "DYKDHDGDYKDHDIDYKDDDDK", source: "Sigma-Aldrich F4799 (N-terminal Met not included)" },
    { id: "flag-tandem-24aa", name: "Three standard FLAGs (24 aa)", protein: "DYKDDDDKDYKDDDDKDYKDDDDK", source: "Three copies of DYKDDDDK" },
    { id: "ha", name: "HA", protein: "YPYDVPDYA", source: "Influenza hemagglutinin 98–106" },
    { id: "myc", name: "Myc", protein: "EQKLISEEDL", source: "Human c-Myc 410–419" },
    { id: "his6", name: "6×His", protein: "HHHHHH", source: "Hexahistidine" },
    { id: "v5", name: "V5", protein: "GKPIPNPLLGLDST", source: "Simian virus 5 P/V protein" },
  ],
};

export type PeptideHit = {
  name: string;
  tagId?: string;
  strand: Strand;
  offset: 0 | 1 | 2;
  aaStart: number;
  aaEnd: number;
  /** Top-strand interval, 0-based and half-open. */
  start: number;
  end: number;
  mismatches: number;
  /** Non-ACGT bases inside the hit: an N never counts as high-confidence evidence (F04). */
  ambiguousBases: number;
  confidence: "exact" | "exact-with-ambiguous-bases" | "approximate";
  containedIn?: string;
};

export type PeptideSearchOptions = { maxMismatches?: number; frames?: ReadingFrame[] };

/**
 * Finds a peptide in all six frames, overlapping hits included. With `maxMismatches` it
 * also returns ungapped near matches, which are labelled approximate.
 */
export function findPeptide(sequence: string, peptide: string, name = peptide, options: PeptideSearchOptions = {}): PeptideHit[] {
  const hits: PeptideHit[] = [];
  const frames = options.frames ?? sixFrameTranslations(sequence);
  const allowed = options.maxMismatches ?? 0;
  for (const frame of frames) {
    for (let aaStart = 0; aaStart + peptide.length <= frame.protein.length; aaStart += 1) {
      let mismatches = 0;
      for (let index = 0; index < peptide.length && mismatches <= allowed; index += 1) if (frame.protein[aaStart + index] !== peptide[index]) mismatches += 1;
      if (mismatches > allowed) continue;
      const span = frameSpan(frame, aaStart, aaStart + peptide.length, sequence.length);
      const ambiguousBases = ambiguousCount(sequence, span.start, span.end);
      hits.push({
        name,
        strand: frame.strand,
        offset: frame.offset,
        aaStart,
        aaEnd: aaStart + peptide.length,
        ...span,
        mismatches,
        ambiguousBases,
        confidence: mismatches ? "approximate" : ambiguousBases ? "exact-with-ambiguous-bases" : "exact",
      });
    }
  }
  return hits;
}

/** Searches every library tag and marks a hit that lies inside a longer tag's hit. */
export function findTags(sequence: string, tags = TAG_LIBRARY.tags, options: PeptideSearchOptions = {}) {
  const frames = options.frames ?? sixFrameTranslations(sequence);
  const hits = tags.flatMap((tag) => findPeptide(sequence, tag.protein, tag.name, { ...options, frames }).map((hit) => ({ ...hit, tagId: tag.id })));
  for (const hit of hits) {
    const outer = hits.find((other) => other.strand === hit.strand && other.offset === hit.offset
      && other.aaEnd - other.aaStart > hit.aaEnd - hit.aaStart && other.aaStart <= hit.aaStart && other.aaEnd >= hit.aaEnd);
    if (outer) hit.containedIn = outer.name;
  }
  return hits;
}

function ambiguousCount(sequence: string, start: number, end: number) {
  let count = 0;
  for (let at = start; at < end; at += 1) if (!"ACGT".includes(sequence[at])) count += 1;
  return count;
}
