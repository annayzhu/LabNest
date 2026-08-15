"use client";

import { Plus, Trash2 } from "lucide-react";
import { ResizableTableFrame } from "@/components/ui/ResizableTableFrame";

function widthOf(rows: string[][]) {
  return Math.max(1, ...rows.map((row) => row.length));
}

function rectangular(rows: string[][]) {
  const width = widthOf(rows);
  const source = rows.length ? rows : [[""]];
  return source.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ""));
}

export function InlineTableEditor({
  rows,
  onChange,
  caption,
  onCaptionChange,
}: {
  rows: string[][];
  onChange: (rows: string[][]) => void;
  caption?: string;
  onCaptionChange?: (caption: string) => void;
}) {
  const normalized = rectangular(rows);
  const columnCount = widthOf(normalized);

  const updateCell = (rowIndex: number, columnIndex: number, value: string) => {
    onChange(normalized.map((row, currentRow) => row.map((cell, currentColumn) => currentRow === rowIndex && currentColumn === columnIndex ? value : cell)));
  };
  const pasteCells = (event: React.ClipboardEvent<HTMLInputElement>, startRow: number, startColumn: number) => {
    const value = event.clipboardData.getData("text/plain");
    if (!value.includes("\t") && !value.includes("\n")) return;
    event.preventDefault();
    const pasted = value.replaceAll("\r\n", "\n").replace(/\n$/, "").split("\n").map((line) => line.split("\t"));
    const requiredRows = Math.max(normalized.length, startRow + pasted.length);
    const requiredColumns = Math.max(columnCount, startColumn + Math.max(1, ...pasted.map((row) => row.length)));
    const next = Array.from({ length: requiredRows }, (_, rowIndex) => Array.from({ length: requiredColumns }, (_, columnIndex) => normalized[rowIndex]?.[columnIndex] ?? ""));
    pasted.forEach((row, rowOffset) => row.forEach((cell, columnOffset) => { next[startRow + rowOffset][startColumn + columnOffset] = cell; }));
    onChange(next);
  };
  const addRow = () => onChange([...normalized, Array.from({ length: columnCount }, () => "")]);
  const addColumn = () => onChange(normalized.map((row) => [...row, ""]));
  const removeRow = () => onChange(normalized.length > 1 ? normalized.slice(0, -1) : normalized);
  const removeColumn = () => onChange(columnCount > 1 ? normalized.map((row) => row.slice(0, -1)) : normalized);

  return <figure className="mt-0.5 overflow-hidden rounded-[7px] border border-hairline bg-surface">
    <div className="flex flex-wrap items-center gap-0.5 border-b border-hairline bg-stone/35 px-1 py-0.5" data-print-hidden>
      {onCaptionChange ? <input value={caption ?? ""} onChange={(event) => onCaptionChange(event.target.value)} className="focus-ring mr-auto h-5 min-h-0 min-w-28 flex-1 border-0 bg-transparent px-1.5 text-[10.5px] font-semibold text-ink outline-none" placeholder="Table caption" /> : <span className="mr-auto px-1.5 text-[10.5px] font-semibold text-muted">Table</span>}
      <button type="button" onClick={addRow} className="focus-ring inline-flex h-5 min-h-0 items-center gap-0.5 rounded-[4px] px-1 text-[10.5px] text-graphite hover:bg-surface"><Plus className="h-3 w-3" />Row</button>
      <button type="button" onClick={addColumn} className="focus-ring inline-flex h-5 min-h-0 items-center gap-0.5 rounded-[4px] px-1 text-[10.5px] text-graphite hover:bg-surface"><Plus className="h-3 w-3" />Column</button>
      <button type="button" onClick={removeRow} disabled={normalized.length <= 1} className="focus-ring inline-flex h-5 min-h-0 items-center gap-0.5 rounded-[4px] px-1 text-[10.5px] text-error hover:bg-error-surface disabled:opacity-35"><Trash2 className="h-3 w-3" />Row</button>
      <button type="button" onClick={removeColumn} disabled={columnCount <= 1} className="focus-ring inline-flex h-5 min-h-0 items-center gap-0.5 rounded-[4px] px-1 text-[10.5px] text-error hover:bg-error-surface disabled:opacity-35"><Trash2 className="h-3 w-3" />Column</button>
    </div>
    <ResizableTableFrame className="max-h-[520px] overflow-auto editorial-scrollbar">
      <table className="min-w-full table-fixed border-collapse text-left text-[length:var(--ln-result-dataset-font-size)]">
        <colgroup>{Array.from({ length: columnCount }).map((_, columnIndex) => <col key={columnIndex} data-resizable-column-index={columnIndex} style={{ width: "var(--ln-inline-table-col-width)" }} />)}</colgroup>
        <tbody>
          {normalized.map((row, rowIndex) => <tr key={rowIndex} className={rowIndex === 0 ? "sticky top-0 z-10 bg-stone/90" : "bg-surface even:bg-warm/70"}>
            {row.map((cell, columnIndex) => {
              const Cell = rowIndex === 0 ? "th" : "td";
              return <Cell key={columnIndex} data-resizable-column-cell={rowIndex === 0 ? columnIndex : undefined} className="min-w-[var(--ln-inline-table-cell-min-width)] border-b border-r border-hairline p-0 last:border-r-0">
                <input
                  value={cell}
                  onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)}
                  onPaste={(event) => pasteCells(event, rowIndex, columnIndex)}
                  className={`focus-ring h-[var(--ln-inline-table-cell-height)] min-h-0 w-full border-0 bg-transparent px-[var(--ln-inline-table-cell-padding-x)] text-[length:var(--ln-inline-table-font-size)] leading-none outline-none ${rowIndex === 0 ? "font-semibold text-ink" : "text-graphite"}`}
                  aria-label={`Table row ${rowIndex + 1}, column ${columnIndex + 1}`}
                />
                {rowIndex === 0 ? <span data-column-resize-handle={columnIndex} data-min-width="var(--ln-inline-table-cell-min-width)" aria-hidden /> : null}
              </Cell>;
            })}
          </tr>)}
        </tbody>
      </table>
    </ResizableTableFrame>
    <p className="border-t border-hairline px-2 py-0.5 text-[10.5px] leading-5 text-muted" data-print-hidden>Paste a rectangular range directly from Excel; rows and columns expand automatically.</p>
  </figure>;
}
