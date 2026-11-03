import type { Prisma } from "@/generated/prisma/client";
import { evidenceKinds, type Segment, type SequenceFeature, type Strand } from "./model";

type StoredFeature = {
  name: string;
  type: string;
  start: number;
  end: number;
  strand: string | null;
  note: string | null;
  segmentsJson?: Prisma.JsonValue | null;
  codonStart?: number | null;
  qualifiersJson?: Prisma.JsonValue | null;
  color?: string | null;
  evidence?: string | null;
};

/**
 * `segmentsJson` holds the exact parts (joins, origin crossing); rows written before it
 * keep only the overall span, 1-based and closed as GenBank writes it.
 */
export function storedFeature(row: StoredFeature): SequenceFeature {
  const strand: Strand | 0 = row.strand === "+" ? 1 : row.strand === "-" ? -1 : 0;
  const segments = Array.isArray(row.segmentsJson) && row.segmentsJson.length ? (row.segmentsJson as Segment[]) : [{ start: row.start - 1, end: row.end }];
  const qualifiers = row.qualifiersJson && typeof row.qualifiersJson === "object" && !Array.isArray(row.qualifiersJson)
    ? (row.qualifiersJson as Record<string, string[]>)
    : row.note ? { note: [row.note] } : {};
  const codonStart = row.codonStart === 1 || row.codonStart === 2 || row.codonStart === 3 ? row.codonStart : undefined;
  const evidence = evidenceKinds.find((value) => value === row.evidence) ?? "file";
  return { name: row.name, type: row.type, strand, segments, qualifiers, evidence, ...(codonStart ? { codonStart } : {}), ...(row.color ? { color: row.color } : {}) };
}

/** A feature as a SequenceFeature row: the overall span (1-based, closed) next to the exact segments. */
export function featureRow(feature: SequenceFeature, order: number, sourceLabel: string | null) {
  return {
    name: feature.name,
    type: feature.type,
    start: Math.min(...feature.segments.map((segment) => segment.start)) + 1,
    end: Math.max(...feature.segments.map((segment) => segment.end)),
    strand: feature.strand === 1 ? "+" : feature.strand === -1 ? "-" : null,
    note: feature.qualifiers.note?.[0] ?? null,
    segmentsJson: feature.segments as Prisma.InputJsonValue,
    codonStart: feature.codonStart ?? null,
    qualifiersJson: feature.qualifiers as Prisma.InputJsonValue,
    color: feature.color ?? null,
    evidence: feature.evidence,
    sourceLabel,
    order,
  };
}
