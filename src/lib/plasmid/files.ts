import { unzipSync } from "fflate";
import { parseAbif } from "./abif";
import { parseFastaText, parseSeqText } from "./fasta";
import { parseGenbankText } from "./genbank";
import {
  PLASMID_PARSER_VERSION,
  SequenceParseError,
  type ParseIssue,
  type ParsedSequenceFile,
  type SangerRead,
  type SequenceFileFormat,
} from "./model";
import { sha256Hex } from "./sha256";
import { isSnapGene, parseSnapGene } from "./snapgene";

export type SourceFile = { path: string; bytes: Uint8Array };

export type ImportedSource = ParsedSequenceFile & {
  /** Relative path; a ZIP member is `archive.zip::member/path`. */
  path: string;
  container?: string;
  size: number;
  sha256: string;
  parser: string;
  status: "parsed" | "attachment" | "failed" | "skipped";
  /** The first source with byte-identical content: a copy, not new evidence. */
  duplicateOf?: string;
  error?: ParseIssue;
};

export type ZipLimits = { maxEntries: number; maxTotalBytes: number; maxEntryBytes: number };

export const defaultZipLimits: ZipLimits = { maxEntries: 2_000, maxTotalBytes: 500 * 1024 * 1024, maxEntryBytes: 100 * 1024 * 1024 };

const officeExtensions = new Set(["xlsx", "xlsm", "docx", "pptx", "odt", "ods"]);
const sequenceExtensions = new Set(["ab1", "abi", "seq", "dna", "gb", "gbk", "genbank", "fa", "fasta", "fas", "fna"]);

function extension(path: string) {
  const name = path.split(/[/\\]/).pop() ?? path;
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function fileStem(path: string) {
  const name = (path.split("::").pop() ?? path).split(/[/\\]/).pop() ?? path;
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

/** The id of a source's read, as evidence groups and the workbench list name it. */
export function readId(path: string, index: number) {
  return `${path}#${index}`;
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

const binarySignatures = [
  [0x25, 0x50, 0x44, 0x46], // %PDF (also Illustrator .ai)
  [0x89, 0x50, 0x4e, 0x47], // PNG
  [0xff, 0xd8, 0xff], // JPEG
  [0x47, 0x49, 0x46, 0x38], // GIF
  [0xd0, 0xcf, 0x11, 0xe0], // OLE2: .xls, .doc
  [0x49, 0x49, 0x2a, 0x00], // TIFF
  [0x4d, 0x4d, 0x00, 0x2a], // TIFF
  [0x25, 0x21, 0x50, 0x53], // %!PS (.eps, older .ai)
];

/** Detects the format from content first; the extension only breaks ties (F01). */
export function detectFormat(path: string, bytes: Uint8Array): SequenceFileFormat {
  const ext = extension(path);
  if (startsWith(bytes, [0x41, 0x42, 0x49, 0x46])) return "abif";
  if (isSnapGene(bytes)) return "snapgene";
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06])) return officeExtensions.has(ext) ? "attachment" : "zip";
  if (binarySignatures.some((signature) => startsWith(bytes, signature))) return "attachment";
  const head = bytes.subarray(0, 4096);
  if (head.includes(0)) return sequenceExtensions.has(ext) ? "unknown" : "attachment";
  // The decoder drops a leading byte-order mark.
  const text = new TextDecoder("utf-8").decode(head);
  const firstLine = text.split(/\r?\n/).find((line) => line.trim())?.trim() ?? "";
  if (firstLine.startsWith("LOCUS")) return "genbank";
  if (firstLine.startsWith(">")) return ext === "seq" ? "seq-text" : "fasta";
  if (ext === "seq" || (text.trim() && /^[ACGTURYSWKMBDHVN\s\d]+$/i.test(text) && /[ACGT]{8}/i.test(text))) return "seq-text";
  return sequenceExtensions.has(ext) ? "unknown" : "attachment";
}

/** UTF-8 first; files exported on Chinese Windows often carry GBK text (dates, notes). */
function tryDecode(bytes: Uint8Array) {
  for (const encoding of ["utf-8", "gbk"]) {
    try {
      return new TextDecoder(encoding, { fatal: true }).decode(bytes);
    } catch {
      continue;
    }
  }
  return undefined;
}

export function decodeText(bytes: Uint8Array) {
  return tryDecode(bytes) ?? new TextDecoder("utf-8").decode(bytes);
}

export function parseSequenceFile(path: string, bytes: Uint8Array, format = detectFormat(path, bytes)): ParsedSequenceFile {
  const name = fileStem(path);
  const text = () => decodeText(bytes);
  if (format === "abif") return parseAbif(bytes, name);
  if (format === "snapgene") return parseSnapGene(bytes, name);
  if (format === "genbank") return parseGenbankText(text());
  if (format === "fasta") return parseFastaText(text());
  if (format === "seq-text") return parseSeqText(text(), name);
  throw new SequenceParseError("file.unknown-format", "The content is not a supported sequence format.");
}

/** fflate decodes names without the UTF-8 flag as Latin-1; Windows archives often hold GBK. */
function zipEntryName(name: string) {
  if (!/[\u0080-ÿ]/.test(name)) return name;
  return tryDecode(Uint8Array.from(name, (character) => character.charCodeAt(0))) ?? name;
}

function isUnsafePath(name: string) {
  const path = name.replace(/\\/g, "/");
  return path.startsWith("/") || /^[A-Za-z]:/.test(path) || path.split("/").includes("..") || path.includes("\0");
}

/**
 * Reads ZIP members in memory; nothing is written to disk. Entry count, sizes and unsafe
 * paths are checked before inflating, and macOS resource forks are skipped.
 */
export function expandZip(path: string, bytes: Uint8Array, limits = defaultZipLimits) {
  const rejected: ParseIssue[] = [];
  let entries = 0;
  let total = 0;
  const members = unzipSync(bytes, {
    filter(file) {
      if (file.name.endsWith("/") || file.name.startsWith("__MACOSX/") || /(^|\/)\.DS_Store$/.test(file.name)) return false;
      if (isUnsafePath(file.name)) {
        rejected.push({ code: "zip.unsafe-path", message: `${path}::${zipEntryName(file.name)} has an unsafe path and was not read.` });
        return false;
      }
      entries += 1;
      total += file.originalSize;
      if (entries > limits.maxEntries || file.originalSize > limits.maxEntryBytes || total > limits.maxTotalBytes) {
        rejected.push({ code: "zip.limit", message: `${path}::${zipEntryName(file.name)} exceeds the archive limits and was not read.` });
        return false;
      }
      return true;
    },
  });
  return {
    files: Object.keys(members).sort().map((name) => ({ path: `${path}::${zipEntryName(name)}`, bytes: members[name] })),
    rejected,
  };
}

export type ImportOptions = {
  zipLimits?: ZipLimits;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
};

/**
 * Imports a folder or file list. Each file is parsed on its own, so one bad file never
 * blocks the rest (A03); archives are expanded once (nested archives are not opened).
 */
export async function importSequenceFiles(files: SourceFile[], options: ImportOptions = {}) {
  const sources: ImportedSource[] = [];
  const seen = new Map<string, string>();
  const queue: Array<{ file: SourceFile; container?: string }> = files.map((file) => ({ file }));
  for (let index = 0; index < queue.length; index += 1) {
    if (options.signal?.aborted) break;
    const { file, container } = queue[index];
    const source = await importOne(file, container, seen);
    if (source.format === "zip" && !container) {
      try {
        const expanded = expandZip(file.path, file.bytes, options.zipLimits);
        source.status = "parsed";
        source.warnings.push(...expanded.rejected);
        queue.splice(index + 1, 0, ...expanded.files.map((member) => ({ file: member, container: file.path })));
      } catch (error) {
        source.status = "failed";
        source.error = { code: "zip.unreadable", message: error instanceof Error ? error.message : String(error) };
      }
    } else if (source.format === "zip") {
      source.warnings.push({ code: "zip.nested", message: "Archives inside archives are not opened." });
    }
    sources.push(source);
    options.onProgress?.(index + 1, queue.length);
  }
  return sources;
}

/** Hashes and reads one file and never throws. The first path for each hash is kept in `seen`; later copies get `duplicateOf`. */
async function importOne(file: SourceFile, container: string | undefined, seen: Map<string, string>): Promise<ImportedSource> {
  const sha256 = await sha256Hex(file.bytes);
  const base: ImportedSource = {
    path: file.path,
    ...(container ? { container } : {}),
    size: file.bytes.length,
    sha256,
    format: "unknown",
    parser: PLASMID_PARSER_VERSION,
    status: "failed",
    warnings: [],
    unsupported: [],
    records: [],
    reads: [],
  };
  const duplicateOf = seen.get(sha256);
  if (duplicateOf) base.duplicateOf = duplicateOf;
  else seen.set(sha256, file.path);
  try {
    const format = detectFormat(file.path, file.bytes);
    base.format = format;
    if (format === "attachment") return { ...base, status: "attachment" };
    if (format === "zip") return { ...base, status: "skipped" };
    return { ...base, ...parseSequenceFile(file.path, file.bytes, format), status: "parsed" };
  } catch (error) {
    const issue = error instanceof SequenceParseError
      ? { code: error.code, message: error.message }
      : { code: "file.unexpected", message: error instanceof Error ? error.message : String(error) };
    return { ...base, status: "failed", error: issue };
  }
}

export type ReadEvidence = { id: string; source: ImportedSource; read: SangerRead; group: string };

export type GroupReason = "identical-file" | "paired-export" | "identical-bases";

export type EvidenceGroup = { id: string; readIds: string[]; reasons: GroupReason[] };

/**
 * Groups reads that are not independent evidence (F06, A14): byte copies, an `.ab1` and
 * the `.seq` exported from it (same folder and stem, same or trimmed bases), and reads
 * with identical base strings. A group counts as one read.
 */
export function groupReadEvidence(sources: ImportedSource[]) {
  const reads: ReadEvidence[] = [];
  for (const source of sources) source.reads.forEach((read, index) => reads.push({ id: readId(source.path, index), source, read, group: "" }));
  const parent = new Map(reads.map((item) => [item.id, item.id]));
  const find = (id: string): string => {
    const up = parent.get(id)!;
    if (up === id) return id;
    const root = find(up);
    parent.set(id, root);
    return root;
  };
  const reasons = new Map<string, Set<GroupReason>>();
  const union = (left: string, right: string, reason: GroupReason) => {
    const a = find(left);
    const b = find(right);
    const merged = new Set([...(reasons.get(a) ?? []), ...(reasons.get(b) ?? []), reason]);
    if (a !== b) parent.set(b, a);
    reasons.set(a, merged);
  };

  const byKey = (key: (item: ReadEvidence) => string | undefined) => {
    const map = new Map<string, ReadEvidence[]>();
    for (const item of reads) {
      const value = key(item);
      if (value !== undefined) map.set(value, [...(map.get(value) ?? []), item]);
    }
    return map;
  };
  const byPath = new Map(sources.map((source) => [source.path, source]));
  for (const source of sources) {
    const original = source.duplicateOf ? byPath.get(source.duplicateOf) : undefined;
    if (!original?.reads.length) continue;
    source.reads.forEach((_, index) => union(readId(original.path, index), readId(source.path, index), "identical-file"));
  }
  // A file picked on its own has no folder; it shares the empty one with the others picked with it.
  const folder = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf("/"), path.lastIndexOf("::")));
  for (const sameStem of byKey((item) => `${folder(item.source.path)}|${fileStem(item.source.path).toLowerCase()}`).values()) {
    const ab1s = sameStem.filter((item) => item.source.format === "abif");
    const seqs = sameStem.filter((item) => item.source.format === "seq-text");
    for (const ab1 of ab1s) {
      for (const seq of seqs) {
        const bases = [ab1.read.bases, ab1.read.editedBases].filter(Boolean) as string[];
        if (bases.some((value) => value.includes(seq.read.bases) || seq.read.bases.includes(value))) union(ab1.id, seq.id, "paired-export");
      }
    }
  }
  for (const sameBases of byKey((item) => item.read.bases).values()) {
    for (const item of sameBases.slice(1)) union(sameBases[0].id, item.id, "identical-bases");
  }

  const groups = new Map<string, EvidenceGroup>();
  for (const item of reads) {
    const root = find(item.id);
    item.group = root;
    const group = groups.get(root) ?? { id: root, readIds: [], reasons: [...(reasons.get(root) ?? [])] };
    group.readIds.push(item.id);
    groups.set(root, group);
  }
  return { reads, groups: [...groups.values()] };
}
