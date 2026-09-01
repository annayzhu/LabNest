"use client";

import { useLayoutEffect, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ResizableTableFrame } from "@/components/ui/ResizableTableFrame";
import { isRectangularSpreadsheetPaste } from "@/lib/result-dataset-paste";

const tableToolbarButtonClass = "focus-ring inline-flex h-[var(--ln-inline-table-button-height)] min-h-0 shrink-0 items-center gap-0.5 rounded-[4px] px-[var(--ln-inline-table-button-padding-x)] text-[length:var(--ln-inline-table-button-font-size)] text-graphite hover:bg-surface";
const tableToolbarDangerButtonClass = "focus-ring inline-flex h-[var(--ln-inline-table-button-height)] min-h-0 shrink-0 items-center gap-0.5 rounded-[4px] px-[var(--ln-inline-table-button-padding-x)] text-[length:var(--ln-inline-table-button-font-size)] text-error hover:bg-error-surface disabled:opacity-35";

function widthOf(rows: string[][]) {
  return Math.max(1, ...rows.map((row) => row.length));
}

function rectangular(rows: string[][]) {
  const width = widthOf(rows);
  const source = rows.length ? rows : [[""]];
  return source.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ""));
}

function AutoGrowingTableCell({
  value,
  header,
  rowIndex,
  columnIndex,
  onChange,
  onPaste,
  onUndoTableChange,
}: {
  value: string;
  header: boolean;
  rowIndex: number;
  columnIndex: number;
  onChange: (value: string) => void;
  onPaste: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onUndoTableChange: () => boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  return <textarea
    ref={textareaRef}
    rows={1}
    value={value}
    onChange={(event) => onChange(event.target.value)}
    onPaste={onPaste}
    onKeyDown={(event) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z" || event.shiftKey) return;
      event.stopPropagation();
      if (!onUndoTableChange()) return;
      event.preventDefault();
    }}
    className={`focus-ring field-sizing-content min-h-[var(--ln-inline-table-cell-height)] max-h-48 w-full resize-y overflow-y-auto whitespace-pre-wrap break-words border-0 bg-transparent px-[var(--ln-inline-table-cell-padding-x)] py-[var(--ln-inline-table-cell-padding-y)] text-[length:var(--ln-inline-table-font-size)] leading-[var(--ln-inline-table-line-height)] outline-none ${header ? "font-medium text-graphite" : "text-graphite"}`}
    aria-label={`Table row ${rowIndex + 1}, column ${columnIndex + 1}`}
  />;
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
  const tableHistoryRef = useRef<string[][][]>([]);

  const commitTableChange = (next: string[][]) => {
    tableHistoryRef.current = [...tableHistoryRef.current.slice(-19), normalized.map((row) => [...row])];
    onChange(next);
  };
  const undoTableChange = () => {
    const previous = tableHistoryRef.current.at(-1);
    if (!previous) return false;
    tableHistoryRef.current = tableHistoryRef.current.slice(0, -1);
    onChange(previous);
    return true;
  };

  const updateCell = (rowIndex: number, columnIndex: number, value: string) => {
    // Once the user types again, the browser's per-textarea undo stack is the
    // most recent history. Do not jump back to an older structural table edit.
    tableHistoryRef.current = [];
    onChange(normalized.map((row, currentRow) => row.map((cell, currentColumn) => currentRow === rowIndex && currentColumn === columnIndex ? value : cell)));
  };
  const pasteCells = (event: React.ClipboardEvent<HTMLTextAreaElement>, startRow: number, startColumn: number) => {
    const value = event.clipboardData.getData("text/plain");
    // Plain or multiline prose belongs in the active cell at the caret. Only a
    // tab-delimited clipboard payload is treated as a spreadsheet rectangle.
    if (!isRectangularSpreadsheetPaste(value)) return;
    event.preventDefault();
    const pasted = value.replaceAll("\r\n", "\n").replace(/\n$/, "").split("\n").map((line) => line.split("\t"));
    const requiredRows = Math.max(normalized.length, startRow + pasted.length);
    const requiredColumns = Math.max(columnCount, startColumn + Math.max(1, ...pasted.map((row) => row.length)));
    const next = Array.from({ length: requiredRows }, (_, rowIndex) => Array.from({ length: requiredColumns }, (_, columnIndex) => normalized[rowIndex]?.[columnIndex] ?? ""));
    pasted.forEach((row, rowOffset) => row.forEach((cell, columnOffset) => { next[startRow + rowOffset][startColumn + columnOffset] = cell; }));
    commitTableChange(next);
  };
  const addRow = () => commitTableChange([...normalized, Array.from({ length: columnCount }, () => "")]);
  const addColumn = () => commitTableChange(normalized.map((row) => [...row, ""]));
  const removeRow = () => normalized.length > 1 && commitTableChange(normalized.slice(0, -1));
  const removeColumn = () => columnCount > 1 && commitTableChange(normalized.map((row) => row.slice(0, -1)));

  return <figure className="mt-0.5 overflow-hidden rounded-[var(--ln-radius-control-md)] border border-hairline bg-surface">
    <div className="flex flex-wrap items-center gap-[var(--ln-inline-table-toolbar-gap)] border-b border-hairline bg-stone/35 px-[var(--ln-inline-table-toolbar-padding-x)] py-[var(--ln-inline-table-toolbar-padding-y)]" data-print-hidden>
      {onCaptionChange ? <input value={caption ?? ""} onChange={(event) => onCaptionChange(event.target.value)} className="focus-ring mr-auto h-[var(--ln-inline-table-caption-height)] min-h-0 min-w-[var(--ln-inline-table-caption-min-width)] flex-[1_1_var(--ln-inline-table-caption-basis)] border-0 bg-transparent px-[var(--ln-inline-table-caption-padding-x)] text-[length:var(--ln-inline-table-caption-font-size)] font-semibold leading-none text-ink outline-none" placeholder="Table caption" /> : <span className="mr-auto min-w-[var(--ln-inline-table-caption-min-width)] flex-[1_1_var(--ln-inline-table-caption-basis)] px-[var(--ln-inline-table-caption-padding-x)] text-[length:var(--ln-inline-table-caption-font-size)] font-semibold text-muted">Table</span>}
      <button type="button" onClick={addRow} className={tableToolbarButtonClass}><Plus className="h-3 w-3" />Row</button>
      <button type="button" onClick={addColumn} className={tableToolbarButtonClass}><Plus className="h-3 w-3" />Column</button>
      <button type="button" onClick={removeRow} disabled={normalized.length <= 1} className={tableToolbarDangerButtonClass}><Trash2 className="h-3 w-3" />Row</button>
      <button type="button" onClick={removeColumn} disabled={columnCount <= 1} className={tableToolbarDangerButtonClass}><Trash2 className="h-3 w-3" />Column</button>
    </div>
    <ResizableTableFrame className="max-h-[520px] overflow-auto editorial-scrollbar">
      <table className="min-w-full table-fixed border-collapse text-left text-[length:var(--ln-result-dataset-font-size)]">
        <colgroup>{Array.from({ length: columnCount }).map((_, columnIndex) => <col key={columnIndex} data-resizable-column-index={columnIndex} style={{ width: "var(--ln-inline-table-col-width)" }} />)}</colgroup>
        <tbody>
          {normalized.map((row, rowIndex) => <tr key={rowIndex} className={rowIndex === 0 ? "sticky top-0 z-10 bg-[var(--ln-inline-table-head-bg)]" : "bg-surface even:bg-warm/70"}>
            {row.map((cell, columnIndex) => {
              const Cell = rowIndex === 0 ? "th" : "td";
              return <Cell key={columnIndex} data-resizable-column-cell={rowIndex === 0 ? columnIndex : undefined} className={`min-w-[var(--ln-inline-table-cell-min-width)] border-b border-r p-0 align-top last:border-r-0 ${rowIndex === 0 ? "border-b-border-strong border-r-hairline" : "border-hairline"}`}>
                <AutoGrowingTableCell
                  value={cell}
                  header={rowIndex === 0}
                  rowIndex={rowIndex}
                  columnIndex={columnIndex}
                  onChange={(value) => updateCell(rowIndex, columnIndex, value)}
                  onPaste={(event) => pasteCells(event, rowIndex, columnIndex)}
                  onUndoTableChange={undoTableChange}
                />
                {rowIndex === 0 ? <span data-column-resize-handle={columnIndex} data-min-width="var(--ln-inline-table-cell-min-width)" aria-hidden /> : null}
              </Cell>;
            })}
          </tr>)}
        </tbody>
      </table>
    </ResizableTableFrame>
    <p className="border-t border-hairline px-2 py-0.5 text-[10.5px] leading-5 text-muted" data-print-hidden>Cells wrap and grow with content. Paste a rectangular range from Excel; rows and columns expand automatically.</p>
  </figure>;
}
