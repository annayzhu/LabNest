import { validateSequence } from "@/lib/sequence";
import { checkedDna, SequenceParseError, type Channel, type ChromatogramTraces, type ParseIssue, type ParsedSequenceFile, type SangerRead } from "./model";

/** One ABIF directory entry (Applied Biosystems "ABIF File Format Specification", 2009). */
export type AbifEntry = {
  name: string;
  number: number;
  elementType: number;
  elementSize: number;
  count: number;
  dataSize: number;
  dataOffset: number;
};

function ascii(bytes: Uint8Array, start: number, length: number) {
  let text = "";
  for (let index = start; index < start + length && index < bytes.length; index += 1) text += String.fromCharCode(bytes[index]);
  return text;
}

export function readAbifDirectory(bytes: Uint8Array) {
  if (bytes.length < 34 || ascii(bytes, 0, 4) !== "ABIF") throw new SequenceParseError("abif.signature", "Not an ABIF (.ab1) file.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getInt32(18);
  const directory = view.getInt32(26);
  if (count <= 0 || count > 100_000 || directory < 0 || directory + count * 28 > bytes.length) {
    throw new SequenceParseError("abif.directory", "The ABIF directory lies outside the file; the file may be truncated.");
  }
  const entries = new Map<string, AbifEntry>();
  for (let index = 0; index < count; index += 1) {
    const at = directory + index * 28;
    const dataSize = view.getInt32(at + 16);
    const entry: AbifEntry = {
      name: ascii(bytes, at, 4),
      number: view.getInt32(at + 4),
      elementType: view.getInt16(at + 8),
      elementSize: view.getInt16(at + 10),
      count: view.getInt32(at + 12),
      dataSize,
      // Data of four bytes or less is stored in the offset field itself.
      dataOffset: dataSize <= 4 ? at + 20 : view.getInt32(at + 20),
    };
    entries.set(`${entry.name}${entry.number}`, entry);
  }
  return entries;
}

function entryBytes(bytes: Uint8Array, entry: AbifEntry) {
  if (entry.dataOffset < 0 || entry.dataSize < 0 || entry.dataOffset + entry.dataSize > bytes.length) {
    throw new SequenceParseError("abif.truncated", `${entry.name}${entry.number} lies outside the file; the file may be truncated.`);
  }
  return bytes.subarray(entry.dataOffset, entry.dataOffset + entry.dataSize);
}

function readShorts(bytes: Uint8Array, entry: AbifEntry) {
  const data = entryBytes(bytes, entry);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const values = new Int16Array(Math.floor(data.length / 2));
  for (let index = 0; index < values.length; index += 1) values[index] = view.getInt16(index * 2);
  return values;
}

function readText(bytes: Uint8Array, entry: AbifEntry) {
  const data = entryBytes(bytes, entry);
  // Type 18 is a Pascal string (length byte first), type 19 a C string.
  if (entry.elementType === 18) return ascii(data, 1, data[0] ?? 0);
  const end = data.indexOf(0);
  return ascii(data, 0, end < 0 ? data.length : end);
}

function readDate(bytes: Uint8Array, entry: AbifEntry) {
  const data = entryBytes(bytes, entry);
  if (data.length < 4) return undefined;
  const year = (data[0] << 8) | data[1];
  return `${year}-${String(data[2]).padStart(2, "0")}-${String(data[3]).padStart(2, "0")}`;
}

/**
 * Reads called bases (PBAS2), their Phred values (PCON2), peak scan positions (PLOC2) and
 * the four analysed channels (DATA9–12, base order from FWO_1). Edited bases (PBAS1) are
 * kept only when they differ from the called ones; without PBAS2 it reads PBAS1, PCON1
 * and PLOC1 and warns.
 */
export function parseAbif(bytes: Uint8Array, name: string): ParsedSequenceFile {
  const entries = readAbifDirectory(bytes);
  const warnings: ParseIssue[] = [];
  const called = entries.get("PBAS2");
  const edited = entries.get("PBAS1");
  const baseEntry = called ?? edited;
  if (!baseEntry) throw new SequenceParseError("abif.no-bases", "The file has no base calls (PBAS); it may be a fragment-analysis file.");
  if (!called) warnings.push({ code: "abif.edited-only", message: "Only edited base calls (PBAS1) are present; the original calls are missing." });
  const suffix = called ? "2" : "1";
  const raw = ascii(entryBytes(bytes, baseEntry), 0, baseEntry.dataSize);
  if (!raw.trim()) throw new SequenceParseError("abif.empty", "The base-call list is empty.");
  const bases = checkedDna(raw, "abif.alphabet");

  let quality: number[] | null = null;
  const qualityEntry = entries.get(`PCON${suffix}`);
  if (!qualityEntry) warnings.push({ code: "abif.no-quality", message: "The file provides no quality values." });
  else {
    const values = Array.from(entryBytes(bytes, qualityEntry));
    if (values.length === bases.length) quality = values;
    else warnings.push({ code: "abif.quality-length", message: `${values.length} quality values for ${bases.length} bases; quality is not used.` });
  }

  let peaks: number[] | null = null;
  const peakEntry = entries.get(`PLOC${suffix}`);
  if (peakEntry) {
    const values = Array.from(readShorts(bytes, peakEntry), (value) => value & 0xffff);
    if (values.length === bases.length) peaks = values;
    else warnings.push({ code: "abif.peak-length", message: `${values.length} peak positions for ${bases.length} bases; peaks are not used.` });
  }

  let traces: ChromatogramTraces | null = null;
  const orderEntry = entries.get("FWO_1");
  const order = orderEntry ? readText(bytes, { ...orderEntry, elementType: 2 }).slice(0, 4).toUpperCase() : "GATC";
  if (!orderEntry) warnings.push({ code: "abif.no-base-order", message: "No channel order (FWO_1); assumed GATC." });
  const dataEntries = [9, 10, 11, 12].map((number) => entries.get(`DATA${number}`));
  if (dataEntries.every(Boolean) && [...order].sort().join("") === "ACGT") {
    const byChannel = {} as ChromatogramTraces;
    dataEntries.forEach((entry, index) => {
      byChannel[order[index] as Channel] = readShorts(bytes, entry!);
    });
    traces = byChannel;
  } else {
    warnings.push({ code: "abif.no-traces", message: "The analysed trace channels (DATA9–12) are missing or their order is unreadable." });
  }

  const metadata: Record<string, string> = { baseOrder: order };
  const textTags: Array<[string, string]> = [["SMPL1", "sample"], ["MCHN1", "machine"], ["MODL1", "model"], ["DySN1", "dyeSet"], ["CMNT1", "comment"], ["LANE1", "lane"], ["TUBE1", "well"]];
  for (const [tag, key] of textTags) {
    const entry = entries.get(tag);
    if (!entry || (entry.elementType !== 18 && entry.elementType !== 19 && entry.elementType !== 2)) continue;
    const value = readText(bytes, entry).trim();
    if (value) metadata[key] = value;
  }
  const runDate = entries.get("RUND1");
  if (runDate?.elementType === 10) {
    const value = readDate(bytes, runDate);
    if (value) metadata.runDate = value;
  }

  const read: SangerRead = { name, bases, quality, peaks, traces, metadata };
  if (called && edited) {
    const editedBases = validateSequence(ascii(entryBytes(bytes, edited), 0, edited.dataSize), "DNA").normalized;
    if (editedBases !== bases) {
      read.editedBases = editedBases;
      warnings.push({ code: "abif.edited-bases", message: "The file holds hand-edited base calls (PBAS1) that differ from the original calls; the original calls are used." });
    }
  }
  return { format: "abif", records: [], reads: [read], warnings, unsupported: [] };
}
