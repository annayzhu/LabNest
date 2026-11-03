import { toFasta } from "@/lib/sequence";
import { readId, type ImportedSource } from "./files";
import type { Completeness, CompletenessSource, SangerRead, SequenceFeature, SequenceRecord, Topology } from "./model";
import { mottTrim } from "./trace";

/** What the workbench can open: a whole sequence, or one Sanger read. */
export type WorkbenchItem =
  | { kind: "record"; key: string; source?: string; record: SequenceRecord }
  | { kind: "read"; key: string; source?: string; read: SangerRead };

/** A read's key is its read id from `groupReadEvidence`, so it finds its evidence group by key. */
export function workbenchItems(sources: ImportedSource[]): WorkbenchItem[] {
  return sources.flatMap((source) => [
    ...source.records.map((record, index): WorkbenchItem => ({ kind: "record", key: `${source.path}#r${index}`, source: source.path, record })),
    ...source.reads.map((read, index): WorkbenchItem => ({ kind: "read", key: readId(source.path, index), source: source.path, read })),
  ]);
}

export const topologyLabels: Record<Topology, string> = { circular: "Circular", linear: "Linear", unknown: "Topology unknown" };
export const completenessLabels: Record<Completeness, string> = { full_length: "Known full length", partial: "Partial fragment", unknown: "Completeness unknown" };

export const completenessSourceLabels: Record<CompletenessSource, string> = { file: "Stated in the file", user: "Confirmed by a person" };

/**
 * The completeness a file states itself (Q369): an NCBI-style "complete sequence" (or "complete genome") in the
 * definition line, and nothing there saying "partial". `text` is the line, shown as the evidence.
 */
export function declaredCompleteness(record: Pick<SequenceRecord, "description">): { completeness: Completeness; text: string } | undefined {
  const text = record.description?.trim();
  if (!text || /\bpartial\b/i.test(text) || !/\bcomplete (sequence|genome)\b/i.test(text)) return undefined;
  return { completeness: "full_length", text };
}

/**
 * What an opened item starts as, and who said so. Sanger reads are local fragments. A circular map does not make a
 * record the whole molecule (R01): only the file's own statement does, until a person chooses.
 */
export function defaultCompleteness(item: WorkbenchItem): { completeness: Completeness; source: CompletenessSource | null } {
  if (item.kind === "read") return { completeness: "partial", source: null };
  return declaredCompleteness(item.record) ? { completeness: "full_length", source: "file" } : { completeness: "unknown", source: null };
}

/** A read seen as a linear sequence, so the map and sequence views can show it too (F03). */
export function readAsRecord(read: SangerRead): SequenceRecord {
  return { name: read.name, sequence: read.bases, topology: "linear", features: [] };
}

const typeColors: Record<string, string> = {
  CDS: "#4f7a5a",
  gene: "#4f7a5a",
  promoter: "#b07a2a",
  enhancer: "#b07a2a",
  terminator: "#9a5b5b",
  polyA_signal: "#9a5b5b",
  rep_origin: "#5a6f9a",
  primer_bind: "#7a6a9a",
  sig_peptide: "#3f8a8a",
  mature_peptide: "#6a8f4f",
  protein_bind: "#8a7a5a",
  misc_feature: "#7d7d74",
  variation: "#b0503e",
};

/** File colours are kept (F03) but pulled toward the page so a bright export does not shout. */
export function featureColor(feature: Pick<SequenceFeature, "type" | "color">) {
  const base = feature.color && /^#[0-9a-f]{6}$/i.test(feature.color) ? feature.color : typeColors[feature.type] ?? typeColors.misc_feature;
  return `color-mix(in srgb, ${base} 72%, var(--surface))`;
}

export function strandArrow(strand: SequenceFeature["strand"]) {
  return strand === 1 ? "→" : strand === -1 ? "←" : "—";
}

export function strandName(strand: SequenceFeature["strand"]) {
  return strand === 1 ? "Forward strand" : strand === -1 ? "Reverse strand" : "No direction";
}

/** Safari and iPadOS can drop a download whose blob URL goes away at once, so it stays a second. */
export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportFasta(record: SequenceRecord) {
  return `${toFasta(record.name.replace(/\s+/g, "_"), record.sequence)}\n`;
}

/** What a GenBank export leaves out of the record, shown next to the download (F11). */
export function genbankNotes(record: SequenceRecord) {
  const notes: string[] = [];
  if (record.topology === "unknown") notes.push("Topology is unknown, so the file says linear.");
  if (record.features.some((feature) => feature.strand === 0)) notes.push("Features without a direction are written on the forward strand.");
  if (record.features.some((feature) => feature.color && !feature.qualifiers.color && !feature.qualifiers.ApEinfo_fwdcolor)) notes.push("Feature colours are not written.");
  return notes;
}

export function readSummary(read: SangerRead) {
  const quality = read.quality;
  if (!quality) return { quality: null };
  const sorted = [...quality].sort((left, right) => left - right);
  const trim = mottTrim(quality);
  return {
    quality: {
      median: sorted[Math.floor(sorted.length / 2)] ?? 0,
      q20: quality.filter((value) => value >= 20).length / Math.max(1, quality.length),
      trimmed: trim,
    },
  };
}
