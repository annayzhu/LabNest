import { validateSequence } from "@/lib/sequence";

export const PLASMID_PARSER_VERSION = "labnest-plasmid-parsers/0.1.0";

/** IUPAC nucleotide codes and the bases each can stand for. */
export const IUPAC_BASES: Record<string, string> = { A: "A", C: "C", G: "G", T: "T", R: "AG", Y: "CT", S: "CG", W: "AT", K: "GT", M: "AC", B: "CGT", D: "AGT", H: "ACT", V: "ACG", N: "ACGT" };

/** Phred value below which a base counts as low quality (F06 default Q20, adjustable). */
export const DEFAULT_MIN_QUALITY = 20;

export const topologies = ["linear", "circular", "unknown"] as const;
export type Topology = (typeof topologies)[number];
export type Strand = 1 | -1;
export type Channel = "A" | "C" | "G" | "T";

/** 序列完整性 (F12): a Sanger read is never taken as the whole molecule. */
export const completenessKinds = ["full_length", "partial", "unknown"] as const;
export type Completeness = (typeof completenessKinds)[number];
/** Who said how complete a record is (Q370); null when nobody did, or nobody recorded it. */
export const completenessSources = ["file", "user"] as const;
export type CompletenessSource = (typeof completenessSources)[number];

/**
 * 0-based, half-open on the top strand. A segment never wraps: a feature across a
 * circular origin has two segments. `openStart`/`openEnd` keep GenBank's `<` and `>`.
 */
export type Segment = { start: number; end: number; openStart?: boolean; openEnd?: boolean };

export const evidenceKinds = ["file", "user", "reference-match", "prediction"] as const;
export type FeatureEvidence = (typeof evidenceKinds)[number];

export type SequenceFeature = {
  name: string;
  type: string;
  /** 0 = no direction (for example a SnapGene feature without an arrow). */
  strand: Strand | 0;
  /** Biological order: joining the oriented segments gives the feature 5'→3'. */
  segments: Segment[];
  codonStart?: 1 | 2 | 3;
  color?: string;
  qualifiers: Record<string, string[]>;
  evidence: FeatureEvidence;
};

export type SequenceRecord = {
  name: string;
  description?: string;
  sequence: string;
  topology: Topology;
  moleculeType?: string;
  features: SequenceFeature[];
};

export type ChromatogramTraces = Record<Channel, Int16Array>;

export type SangerRead = {
  name: string;
  bases: string;
  /** Phred value of each base, or null when the file provides none (shown as 未提供). */
  quality: number[] | null;
  /** Scan index of each base call in `traces`, or null without a chromatogram. */
  peaks: number[] | null;
  traces: ChromatogramTraces | null;
  /** Bases as edited in the sequencing software (ABIF PBAS1), kept only when they differ. */
  editedBases?: string;
  metadata: Record<string, string>;
};

export type ParseIssue = { code: string; message: string };

/** Formats LabNest reads bases from; anything else is kept as a file or refused. */
export const readableFormats = ["fasta", "genbank", "snapgene", "abif", "seq-text"] as const;
export type ReadableFormat = (typeof readableFormats)[number];
export type SequenceFileFormat = ReadableFormat | "zip" | "attachment" | "unknown";

export type ParsedSequenceFile = {
  format: SequenceFileFormat;
  records: SequenceRecord[];
  reads: SangerRead[];
  warnings: ParseIssue[];
  /** Content the file holds that this parser does not read (the `.dna` compatibility summary). */
  unsupported: ParseIssue[];
};

export class SequenceParseError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SequenceParseError";
    this.code = code;
  }
}

export function featureLength(feature: Pick<SequenceFeature, "segments">) {
  return feature.segments.reduce((total, segment) => total + segment.end - segment.start, 0);
}

/** Upper-cased DNA, or a parse error with `code`, prefixed by `label` (a record name) when one is given. */
export function checkedDna(sequence: string, code: string, label?: string) {
  const { normalized, errors } = validateSequence(sequence, "DNA");
  if (errors.length) throw new SequenceParseError(code, label === undefined ? errors.join(" ") : `${label}: ${errors.join(" ")}`);
  return normalized;
}

/** GenBank's and SnapGene's `codon_start` qualifier, when it is 1, 2 or 3. */
export function readCodonStart(qualifiers: Record<string, string[]>): { codonStart?: 1 | 2 | 3 } {
  const value = Number(qualifiers.codon_start?.[0]);
  return value === 1 || value === 2 || value === 3 ? { codonStart: value } : {};
}
