import { dnaComplement, reverseComplement } from "@/lib/sequence";
import { createAligner } from "./align";
import { BUILT_IN_ELEMENTS, FEATURE_LIBRARY_VERSION } from "./feature-library.data";
import { foldSegments } from "./layout";
import type { Segment, SequenceFeature, SequenceRecord, Strand } from "./model";
import { TAG_LIBRARY, findPeptide } from "./tags";
import { sixFrameTranslations, translateCodon } from "./translate";

/** A known element (Q362): DNA is matched as bases, a coding element as its protein in six frames. */
export type LibraryElement = {
  id: string;
  name: string;
  /** GenBank feature key the match is annotated with. */
  type: string;
  kind: "dna" | "protein";
  sequence: string;
  source: { accession: string; from: number; to: number; strand: Strand } | { citation: string };
  note?: string;
};

/** A library match shown as a feature of its own (evidence "reference-match"), like SnapGene's common features. */
export type DetectedFeature = { key: string; elementId: string; identity: number; feature: SequenceFeature };

export { FEATURE_LIBRARY_VERSION };

/** Every built-in element: the DNA and coding elements from NCBI records, plus the peptide tags. */
export function builtInElements(): LibraryElement[] {
  const tags = TAG_LIBRARY.tags.map((tag): LibraryElement => ({ id: `tag-${tag.id}`, name: tag.name, type: "misc_feature", kind: "protein", sequence: tag.protein, source: { citation: tag.source } }));
  return [...BUILT_IN_ELEMENTS, ...tags];
}

const shortDna = 40;
const minIdentity = 0.95;

/**
 * Finds library elements in a record (Q362, Q363). Short DNA elements match exactly on either strand; longer ones need
 * 95% identity over their whole length; coding elements match their protein in six frames with up to 5% substitutions
 * (peptide tags only exactly). A tag inside a longer tag is left out, and so is a match that repeats a feature the
 * record already has.
 */
export function detectFeatures(record: SequenceRecord, elements = builtInElements()): DetectedFeature[] {
  const circular = record.topology === "circular";
  const length = record.sequence.length;
  const found: DetectedFeature[] = [];
  const add = (element: LibraryElement, strand: Strand, segments: Segment[], identity: number) => {
    const ordered = strand === -1 ? [...segments].reverse() : segments;
    const note = identity < 1 ? `${element.note ? `${element.note}; ` : ""}${Math.floor(identity * 1000) / 10}% identical to the library entry` : element.note;
    found.push({
      key: `${element.id}@${segments[0].start}:${strand}`,
      elementId: element.id,
      identity,
      feature: { name: element.name, type: element.type, strand, segments: ordered, ...(element.type === "CDS" ? { codonStart: 1 as const } : {}), qualifiers: { label: [element.name], ...(note ? { note: [note] } : {}) }, evidence: "reference-match" },
    });
  };

  // A 95% match keeps about half of its 12-base words intact, so an element sharing under 30% of them cannot match.
  const words = wordSet(circular ? record.sequence + record.sequence.slice(0, 11) : record.sequence);
  const longDna = elements.filter((element) => element.kind === "dna" && element.sequence.length > shortDna && sharedWords(element.sequence, words) >= 0.3);
  if (longDna.length && length) {
    const aligner = createAligner(record.sequence, circular ? "circular" : "linear", undefined, 5_000);
    for (const element of longDna) {
      const outcome = aligner.align({ name: element.id, bases: element.sequence, quality: null, peaks: null, traces: null, metadata: {} });
      if (!outcome.aligned) continue;
      const matches = outcome.alignment.columns.filter((column) => column.kind === "match").length;
      const identity = matches / element.sequence.length;
      if (identity >= minIdentity) add(element, outcome.alignment.orientation === "forward" ? 1 : -1, outcome.alignment.referenceSegments, identity);
    }
  }

  const extended = circular ? record.sequence + record.sequence.slice(0, shortDna) : record.sequence;
  for (const element of elements.filter((item) => item.kind === "dna" && item.sequence.length <= shortDna)) {
    for (const [strand, query] of [[1, element.sequence], [-1, reverseComplement(element.sequence)]] as const) {
      if (strand === -1 && query === element.sequence) continue;
      for (let at = extended.indexOf(query); at >= 0 && at < length; at = extended.indexOf(query, at + 1)) add(element, strand, foldSegments(at, at + query.length, length), 1);
    }
  }

  const proteins = elements.filter((element) => element.kind === "protein");
  if (proteins.length && length) {
    const reach = Math.max(...proteins.map((element) => element.sequence.length)) * 3 + 3;
    const scanned = circular ? record.sequence + record.sequence.slice(0, Math.min(length, reach)) : record.sequence;
    const frames = sixFrameTranslations(scanned);
    const hits = proteins.flatMap((element) => {
      const tag = element.id.startsWith("tag-");
      return findPeptide(scanned, element.sequence, element.id, { frames, maxMismatches: tag ? 0 : Math.floor(element.sequence.length * (1 - minIdentity)) })
        .filter((hit) => hit.ambiguousBases === 0 && hit.start < length)
        .map((hit) => ({ hit, element }));
    });
    for (const { hit, element } of hits) {
      const inside = hits.some((other) => other.hit !== hit && other.hit.strand === hit.strand && other.hit.start <= hit.start && other.hit.end >= hit.end && other.hit.end - other.hit.start > hit.end - hit.start);
      if (inside) continue;
      // A coding element runs to its stop codon, as GenBank and SnapGene draw a CDS.
      const stop = element.type === "CDS" && frames.find((frame) => frame.strand === hit.strand && frame.offset === hit.offset)?.protein[hit.aaEnd] === "*";
      const start = stop && hit.strand === -1 ? hit.start - 3 : hit.start;
      const end = stop && hit.strand === 1 ? hit.end + 3 : hit.end;
      add(element, hit.strand, foldSegments((start + length) % length, (start + length) % length + end - start, length), 1 - hit.mismatches / element.sequence.length);
    }
  }

  return found.filter((detected) => !record.features.some((feature) => sameFeature(feature, detected.feature)));
}

export type OpenReadingFrame = { strand: Strand; segments: Segment[]; aminoAcids: number };

/** ATG-to-stop frames of at least `minAminoAcids` on both strands (Q368); a circular record's frames may cross the origin. */
export function openReadingFrames(record: SequenceRecord, minAminoAcids = 100): OpenReadingFrame[] {
  const length = record.sequence.length;
  const circular = record.topology === "circular";
  const scanned = circular ? record.sequence + record.sequence : record.sequence;
  const frames: OpenReadingFrame[] = [];
  for (const frame of sixFrameTranslations(scanned)) {
    for (let at = 0; at < frame.protein.length; at += 1) {
      if (frame.protein[at] !== "M") continue;
      const stop = frame.protein.indexOf("*", at);
      if (stop < 0) break;
      const top = frame.strand === 1 ? frame.offset + at * 3 : scanned.length - (frame.offset + (stop + 1) * 3);
      if (stop - at >= minAminoAcids && top < length && (stop + 1 - at) * 3 <= length) {
        frames.push({ strand: frame.strand, segments: foldSegments(top, top + (stop + 1 - at) * 3, length), aminoAcids: stop - at });
      }
      at = stop;
    }
  }
  const seen = new Set<string>();
  return frames.filter((orf) => {
    const key = `${orf.strand}:${orf.segments.map((segment) => `${segment.start}-${segment.end}`).join(",")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** One amino acid drawn under its codon: `position` is the top-strand base in the middle of the codon. */
export type CodonMark = { position: number; aminoAcid: string };

/**
 * The amino acids of a coding feature, codon by codon from `codon_start`, each placed at the middle base of its codon
 * on the top strand, so a sequence view can write them under the DNA (as SnapGene does). Joins and origin crossings
 * are followed base by base.
 */
export function codonMarks(record: SequenceRecord, feature: Pick<SequenceFeature, "strand" | "segments" | "codonStart">): CodonMark[] {
  const positions: number[] = [];
  for (const segment of feature.segments) {
    if (feature.strand === -1) for (let at = segment.end - 1; at >= segment.start; at -= 1) positions.push(at);
    else for (let at = segment.start; at < segment.end; at += 1) positions.push(at);
  }
  const marks: CodonMark[] = [];
  const base = (at: number) => (feature.strand === -1 ? dnaComplement[record.sequence[at]] ?? "N" : record.sequence[at]);
  for (let at = (feature.codonStart ?? 1) - 1; at + 3 <= positions.length; at += 3) {
    marks.push({ position: positions[at + 1], aminoAcid: translateCodon(base(positions[at]) + base(positions[at + 1]) + base(positions[at + 2])) });
  }
  return marks;
}

const wordLength = 12;

function wordSet(sequence: string) {
  const words = new Set<string>();
  for (const strand of [sequence, reverseComplement(sequence)]) for (let at = 0; at + wordLength <= strand.length; at += 1) words.add(strand.slice(at, at + wordLength));
  return words;
}

function sharedWords(sequence: string, words: Set<string>) {
  let shared = 0;
  const total = Math.max(1, sequence.length - wordLength + 1);
  for (let at = 0; at + wordLength <= sequence.length; at += 1) if (words.has(sequence.slice(at, at + wordLength))) shared += 1;
  return shared / total;
}

/** Same strand and at least 90% overlap both ways: the record already has this feature. */
function sameFeature(existing: SequenceFeature, detected: SequenceFeature) {
  if (existing.strand !== 0 && existing.strand !== detected.strand) return false;
  const size = (segments: Segment[]) => segments.reduce((total, segment) => total + segment.end - segment.start, 0);
  let shared = 0;
  for (const a of existing.segments) for (const b of detected.segments) shared += Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
  return shared > 0 && shared >= 0.9 * size(existing.segments) && shared >= 0.9 * size(detected.segments);
}
