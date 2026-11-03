import { reverseComplement } from "@/lib/sequence";
import { columnPositions, type AlignmentColumn, type Orientation, type ReadAlignment } from "./align";
import type { Channel, ChromatogramTraces, SangerRead } from "./model";

const channels: Channel[] = ["A", "C", "G", "T"];
const complementChannel: Record<Channel, Channel> = { A: "T", C: "G", G: "C", T: "A" };

export function traceLength(read: SangerRead) {
  return read.traces ? read.traces.A.length : 0;
}

/**
 * The read as shown in one orientation (F06). The reverse view reverse-complements the
 * bases, reverses quality and peaks, mirrors peak scan positions and draws each channel
 * as its complement, so it stays in step with the trace.
 */
export function orientRead(read: SangerRead, orientation: Orientation): SangerRead {
  if (orientation === "forward") return read;
  const scans = traceLength(read);
  const traces = read.traces
    ? (Object.fromEntries(channels.map((channel) => [channel, read.traces![complementChannel[channel]].slice().reverse()])) as ChromatogramTraces)
    : null;
  return {
    ...read,
    bases: reverseComplement(read.bases),
    quality: read.quality ? [...read.quality].reverse() : null,
    peaks: read.peaks ? [...read.peaks].reverse().map((peak) => scans - 1 - peak) : null,
    traces,
    editedBases: read.editedBases ? reverseComplement(read.editedBases) : undefined,
  };
}

export type TraceWindow = {
  view: "aligned" | "original";
  scanStart: number;
  scanEnd: number;
  channels: ChromatogramTraces;
  calls: Array<{ scan: number; base: string; quality: number | null; referencePosition: number | null; kind: AlignmentColumn["kind"] }>;
};

/**
 * Chromatogram slice for reference positions `[start, end)`. `aligned` shows the read in
 * the reference direction; `original` shows the file as recorded.
 */
export function traceWindow(read: SangerRead, alignment: ReadAlignment, start: number, end: number, view: "aligned" | "original" = "aligned"): TraceWindow | null {
  if (!read.traces || !read.peaks) return null;
  const shown = view === "aligned" ? orientRead(read, alignment.orientation) : read;
  const positions = columnPositions(alignment.columns);
  const columns = alignment.columns.filter((column, at) => {
    const position = positions[at];
    return column.readIndex !== null && position !== null && position >= start && position < end;
  });
  if (!columns.length) return null;
  const indexOf = (column: AlignmentColumn) => (view === "aligned" ? column.readIndex! : column.originalIndex!);
  const scans = columns.map((column) => shown.peaks![indexOf(column)]);
  const first = Math.min(...scans);
  const last = Math.max(...scans);
  const spacing = columns.length > 1 ? (last - first) / (columns.length - 1) : 12;
  const scanStart = Math.max(0, Math.floor(first - spacing));
  const scanEnd = Math.min(traceLength(read), Math.ceil(last + spacing) + 1);
  const window = Object.fromEntries(channels.map((channel) => [channel, shown.traces![channel].slice(scanStart, scanEnd)])) as ChromatogramTraces;
  const calls = columns
    .map((column) => ({ scan: shown.peaks![indexOf(column)], base: shown.bases[indexOf(column)], quality: column.quality, referencePosition: column.referencePosition, kind: column.kind }))
    .sort((left, right) => left.scan - right.scan);
  return { view, scanStart, scanEnd, channels: window, calls };
}

/**
 * Richard Mott's trimming as Biopython applies it to ABI reads (cutoff 0.05): keeps the
 * stretch with the highest sum of (cutoff − error probability). Reads of 20 bases or
 * fewer are left whole, as in Biopython. Only a display and screening default; the
 * clipped bases are kept.
 */
export function mottTrim(quality: number[], cutoff = 0.05) {
  if (quality.length <= 20) return { start: 0, end: quality.length };
  let started = false;
  let start = 0;
  let running = 0;
  let best = 0;
  let end = 0;
  for (let index = 1; index < quality.length; index += 1) {
    running += cutoff - 10 ** (quality[index] / -10);
    if (running < 0) running = 0;
    else if (!started) {
      start = index;
      started = true;
    }
    if (running > best) {
      best = running;
      end = index;
    }
  }
  return { start, end };
}
