import { reverseComplement } from "@/lib/sequence";
import type { AlignmentDifference } from "./align";
import type { SequenceFeature, SequenceRecord } from "./model";
import { translateCodon } from "./translate";

export type CodingChange = {
  feature: string;
  /** 1-based codon number in the feature (after codon_start). */
  codon: number;
  referenceCodon: string;
  readCodon: string;
  referenceAminoAcid: string;
  readAminoAcid: string;
};

export type DifferenceContext = {
  features: string[];
  /** Note of a `variation` feature at this position: a known variant, not by itself a cloning error (A11). */
  knownVariant?: string;
  matchesKnownVariant?: boolean;
  coding: CodingChange[];
};

export function extractFeature(record: SequenceRecord, feature: SequenceFeature) {
  return feature.segments.map((segment) => {
    const part = record.sequence.slice(segment.start, segment.end);
    return feature.strand === -1 ? reverseComplement(part) : part;
  }).join("");
}

/** Lists the features a difference falls in, a known-variant note there, and for a mismatch the codon it changes. */
export function differenceContext(difference: AlignmentDifference, record: SequenceRecord): DifferenceContext {
  const overlapping = record.features.filter((feature) => covers(feature, difference.referenceStart, difference.referenceEnd));
  const variant = overlapping.find((feature) => feature.type === "variation");
  const coding: CodingChange[] = [];
  if (difference.kind === "mismatch") {
    for (const feature of overlapping.filter((item) => item.type === "CDS" && item.strand !== 0)) {
      const skip = (feature.codonStart ?? 1) - 1;
      const offset = featureOffset(feature, difference.referenceStart) - skip;
      if (offset < 0) continue;
      const cds = extractFeature(record, feature).slice(skip);
      const first = offset - (offset % 3);
      const referenceCodon = cds.slice(first, first + 3);
      if (referenceCodon.length < 3) continue;
      const base = feature.strand === -1 ? reverseComplement(difference.readBases) : difference.readBases;
      const readCodon = `${referenceCodon.slice(0, offset % 3)}${base}${referenceCodon.slice((offset % 3) + 1)}`;
      coding.push({
        feature: feature.name,
        codon: first / 3 + 1,
        referenceCodon,
        readCodon,
        referenceAminoAcid: translateCodon(referenceCodon),
        readAminoAcid: translateCodon(readCodon),
      });
    }
  }
  const replace = variant?.qualifiers.replace?.[0]?.toUpperCase();
  return {
    features: overlapping.map((feature) => feature.name),
    ...(variant ? { knownVariant: variant.qualifiers.note?.[0] ?? variant.name, matchesKnownVariant: replace === difference.readBases } : {}),
    coding,
  };
}

/** An insertion (end === start) sits between two bases: it is inside only when both neighbours are. */
function covers(feature: SequenceFeature, start: number, end: number) {
  return feature.segments.some((segment) => (end === start ? segment.start < start && start < segment.end : segment.start < end && start < segment.end));
}

/** Offset of a top-strand position inside the feature's 5'→3' sequence, or -1. */
function featureOffset(feature: SequenceFeature, position: number) {
  let walked = 0;
  for (const segment of feature.segments) {
    if (position >= segment.start && position < segment.end) {
      return walked + (feature.strand === -1 ? segment.end - 1 - position : position - segment.start);
    }
    walked += segment.end - segment.start;
  }
  return -1;
}
