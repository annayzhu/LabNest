import { normalizeSequence, parseFasta } from "@/lib/sequence";
import { checkedDna, SequenceParseError, type ParseIssue, type ParsedSequenceFile, type SangerRead } from "./model";

function headerCount(text: string) {
  return text.split(/\r?\n/).filter((line) => line.trimStart().startsWith(">")).length;
}

/** FASTA keeps every record separate; FASTA has no topology, so it stays unknown. */
export function parseFastaText(text: string): ParsedSequenceFile {
  const parsed = parseFasta(text);
  if (!parsed.length) throw new SequenceParseError("fasta.empty", "The file holds no sequence.");
  const warnings: ParseIssue[] = [];
  const skipped = headerCount(text) - parsed.length;
  if (skipped > 0) warnings.push({ code: "fasta.empty-record", message: `${skipped} record(s) without bases were skipped.` });
  const records = parsed.map((record) => ({
    name: record.name,
    description: record.description,
    sequence: checkedDna(record.sequence, "fasta.alphabet", record.name),
    topology: "unknown" as const,
    features: [],
  }));
  return { format: "fasta", records, reads: [], warnings, unsupported: [] };
}

/**
 * Vendor `.seq` exports are plain bases or one FASTA-like record. Position numbers and
 * `;` comment lines are dropped. A `.seq` is a Sanger read without quality values.
 */
export function parseSeqText(text: string, fallbackName: string): ParsedSequenceFile {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => !line.trimStart().startsWith(";"));
  const chunks: Array<{ name: string; description?: string; lines: string[] }> = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(">")) {
      const header = trimmed.slice(1).trim();
      const separator = header.search(/\s/);
      chunks.push(separator < 0
        ? { name: header || fallbackName, lines: [] }
        : { name: header.slice(0, separator), description: header.slice(separator).trim() || undefined, lines: [] });
      continue;
    }
    if (!chunks.length) chunks.push({ name: fallbackName, lines: [] });
    chunks[chunks.length - 1].lines.push(trimmed);
  }
  const reads: SangerRead[] = chunks
    .map((chunk) => ({ ...chunk, bases: normalizeSequence(chunk.lines.join("").replace(/\d/g, "")) }))
    .filter((chunk) => chunk.bases.length > 0)
    .map((chunk): SangerRead => ({
      name: chunk.name,
      bases: checkedDna(chunk.bases, "seq.alphabet", chunk.name),
      quality: null,
      peaks: null,
      traces: null,
      metadata: chunk.description ? { description: chunk.description } : {},
    }));
  if (!reads.length) throw new SequenceParseError("seq.empty", "The file holds no bases.");
  return { format: "seq-text", records: [], reads, warnings: [], unsupported: [] };
}
