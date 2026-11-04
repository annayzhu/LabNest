import type { AlignmentColumn, ReadAlignment } from "./align";
import { mottTrim } from "./trace";

/** One stretch of a read's line in the alignment view, all drawn alike. */
export type AlignedRun = {
  text: string;
  kind?: AlignmentColumn["kind"];
  low?: boolean;
  insert?: boolean;
  double?: boolean;
  mark?: boolean;
};

export type PlacedColumns = {
  /** The column at each reference position; insertions have none and show on the base after them. */
  columns: Map<number, AlignmentColumn>;
  inserted: Set<number>;
};

export function placedColumns(alignment: Pick<ReadAlignment, "columns">): PlacedColumns {
  const columns = new Map<number, AlignmentColumn>();
  const inserted = new Set<number>();
  alignment.columns.forEach((column, at, list) => {
    if (column.referencePosition !== null) columns.set(column.referencePosition, column);
    else if (column.kind === "insertion") {
      const next = list.slice(at + 1).find((item) => item.referencePosition !== null);
      if (next) inserted.add(next.referencePosition!);
    }
  });
  return { columns, inserted };
}

/**
 * Which columns the view leaves out when low-quality ends are hidden: outside the read's good stretch (Mott), unless
 * they are reliable and differ. A confident difference is never hidden, and nothing here changes coverage or the stops.
 */
export function hiddenEnds(quality: number[] | null, minQuality: number) {
  if (!quality) return () => false;
  const { start, end } = mottTrim(quality);
  return (column: AlignmentColumn) => {
    const index = column.originalIndex;
    if (index === null || (index >= start && index <= end)) return false;
    return column.kind === "match" || column.quality === null || column.quality < minQuality;
  };
}

/** A read's line for reference positions `[start, end)`, as runs of one look; `null` when it has nothing to show there. */
export function alignedRuns(placed: PlacedColumns, start: number, end: number, options: { minQuality: number; hidden?: (column: AlignmentColumn) => boolean; doubles?: Set<number>; mark?: number }): AlignedRun[] | null {
  const runs: AlignedRun[] = [];
  let shown = false;
  const key = (run: AlignedRun) => [run.kind, run.low, run.insert, run.double, run.mark].join();
  for (let position = start; position < end; position += 1) {
    const found = placed.columns.get(position);
    const column = found && !options.hidden?.(found) ? found : undefined;
    if (column) shown = true;
    const run: AlignedRun = column
      ? {
        text: column.kind === "match" ? "·" : column.kind === "deletion" ? "-" : column.readBase,
        kind: column.kind,
        ...(column.quality !== null && column.quality < options.minQuality ? { low: true } : {}),
        ...(placed.inserted.has(position) ? { insert: true } : {}),
        ...(column.originalIndex !== null && options.doubles?.has(column.originalIndex) ? { double: true } : {}),
        ...(position === options.mark ? { mark: true } : {}),
      }
      : { text: " ", ...(position === options.mark ? { mark: true } : {}) };
    const last = runs[runs.length - 1];
    if (last && key(last) === key(run)) last.text += run.text;
    else runs.push(run);
  }
  return shown ? runs : null;
}

/** The view's blocks: full lines where any read lies or where asked, and one folded stretch for each run of empty lines. */
export function alignedBlocks(length: number, perLine: number, covered: (start: number, end: number) => boolean, open: (start: number, end: number) => boolean) {
  const blocks: Array<{ kind: "line" | "gap"; start: number; end: number }> = [];
  for (let start = 0; start < length; start += perLine) {
    const end = Math.min(length, start + perLine);
    const kind = covered(start, end) || open(start, end) ? "line" : "gap";
    const last = blocks[blocks.length - 1];
    if (kind === "gap" && last?.kind === "gap") last.end = end;
    else blocks.push({ kind, start, end });
  }
  return blocks;
}
