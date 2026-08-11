"use client";

import { Plus, Trash2 } from "lucide-react";

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

  return <figure className="mt-2 overflow-hidden rounded-[8px] border border-hairline bg-surface">
    <div className="flex flex-wrap items-center gap-2 border-b border-hairline bg-stone/55 px-2 py-1.5" data-print-hidden>
      {onCaptionChange ? <input value={caption ?? ""} onChange={(event) => onCaptionChange(event.target.value)} className="focus-ring mr-auto h-8 min-w-40 flex-1 border-0 bg-transparent px-2 text-xs font-semibold text-ink outline-none" placeholder="Table caption" /> : <span className="mr-auto px-2 text-xs font-semibold text-muted">Table</span>}
      <button type="button" onClick={addRow} className="focus-ring inline-flex h-8 items-center gap-1 rounded-[6px] px-2 text-xs text-graphite hover:bg-surface"><Plus className="h-3.5 w-3.5" />Row</button>
      <button type="button" onClick={addColumn} className="focus-ring inline-flex h-8 items-center gap-1 rounded-[6px] px-2 text-xs text-graphite hover:bg-surface"><Plus className="h-3.5 w-3.5" />Column</button>
      <button type="button" onClick={removeRow} disabled={normalized.length <= 1} className="focus-ring inline-flex h-8 items-center gap-1 rounded-[6px] px-2 text-xs text-error hover:bg-error-surface disabled:opacity-35"><Trash2 className="h-3.5 w-3.5" />Row</button>
      <button type="button" onClick={removeColumn} disabled={columnCount <= 1} className="focus-ring inline-flex h-8 items-center gap-1 rounded-[6px] px-2 text-xs text-error hover:bg-error-surface disabled:opacity-35"><Trash2 className="h-3.5 w-3.5" />Column</button>
    </div>
    <div className="max-h-[520px] overflow-auto editorial-scrollbar">
      <table className="min-w-full border-collapse text-left text-sm">
        <tbody>
          {normalized.map((row, rowIndex) => <tr key={rowIndex} className={rowIndex === 0 ? "sticky top-0 z-10 bg-stone/90" : "bg-surface even:bg-warm/70"}>
            {row.map((cell, columnIndex) => {
              const Cell = rowIndex === 0 ? "th" : "td";
              return <Cell key={columnIndex} className="min-w-36 border-b border-r border-hairline p-0 last:border-r-0">
                <input
                  value={cell}
                  onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)}
                  onPaste={(event) => pasteCells(event, rowIndex, columnIndex)}
                  className={`focus-ring h-10 w-full border-0 bg-transparent px-3 text-sm outline-none ${rowIndex === 0 ? "font-semibold text-ink" : "text-graphite"}`}
                  aria-label={`Table row ${rowIndex + 1}, column ${columnIndex + 1}`}
                />
              </Cell>;
            })}
          </tr>)}
        </tbody>
      </table>
    </div>
    <p className="border-t border-hairline px-3 py-1.5 text-[11px] text-muted" data-print-hidden>Paste a rectangular range directly from Excel; rows and columns expand automatically.</p>
  </figure>;
}
