"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

function storageKeyFor(key?: string) {
  return key ? `labnest:table-widths:v2:${key}` : undefined;
}

function readStoredWidths(key?: string) {
  const storageKey = storageKeyFor(key);
  if (!storageKey || typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}");
    return typeof parsed === "object" && parsed ? parsed as Record<string, number> : {};
  } catch {
    return {};
  }
}

function storedWidthKey(tableKey: string, columnIndex: string) {
  return `${tableKey}:${columnIndex}`;
}

function writeStoredWidth(key: string | undefined, tableKey: string, columnIndex: string, width: number) {
  const storageKey = storageKeyFor(key);
  if (!storageKey || typeof window === "undefined") return;
  const current = readStoredWidths(key);
  window.localStorage.setItem(storageKey, JSON.stringify({ ...current, [storedWidthKey(tableKey, columnIndex)]: width }));
}

function tablesIn(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLTableElement>("table"));
}

function tableKeyFor(root: HTMLElement, table: HTMLTableElement) {
  if (table.dataset.resizableTableId) return table.dataset.resizableTableId;
  const index = tablesIn(root).indexOf(table);
  return String(index >= 0 ? index : 0);
}

function resizableColumns(table: HTMLTableElement) {
  return Array.from(table.querySelectorAll<HTMLTableColElement>("col[data-resizable-column-index]"));
}

function setTableInlineWidth(table: HTMLTableElement, width: number) {
  const nextWidth = Math.max(1, Math.round(width));
  table.style.width = `${nextWidth}px`;
  table.style.minWidth = `${nextWidth}px`;
}

function applyColumnWidthToTable(table: HTMLTableElement, columnIndex: string, width: number, tableWidth?: number) {
  const col = table.querySelector<HTMLTableColElement>(`col[data-resizable-column-index="${columnIndex}"]`);
  if (!col) return;
  col.style.width = `${width}px`;
  col.style.minWidth = `${width}px`;
  if (tableWidth !== undefined) setTableInlineWidth(table, tableWidth);
}

function measuredColumnWidth(table: HTMLTableElement, columnIndex: string, col: HTMLTableColElement) {
  const headerCell = table.querySelector<HTMLElement>(`[data-resizable-column-cell="${columnIndex}"]`);
  const measuredWidth = headerCell?.getBoundingClientRect().width;
  if (measuredWidth && Number.isFinite(measuredWidth)) return Math.round(measuredWidth);
  return Math.round(cssLengthToPixels(col.style.width, table));
}

function freezeTableColumns(table: HTMLTableElement) {
  const widths = new Map<string, number>();
  const tableWidth = Math.round(table.getBoundingClientRect().width);
  const columns = resizableColumns(table);
  for (const col of columns) {
    const columnIndex = col.dataset.resizableColumnIndex;
    if (columnIndex === undefined) continue;
    const width = Math.max(1, measuredColumnWidth(table, columnIndex, col));
    widths.set(columnIndex, width);
  }
  for (const col of columns) {
    const columnIndex = col.dataset.resizableColumnIndex;
    if (columnIndex === undefined) continue;
    const width = widths.get(columnIndex);
    if (!width) continue;
    col.style.width = `${width}px`;
    col.style.minWidth = `${width}px`;
  }
  if (tableWidth > 0) setTableInlineWidth(table, tableWidth);
  return { widths, tableWidth };
}

function cssLengthToPixels(value: string, root: HTMLElement) {
  let current = value.trim();
  const variableMatch = current.match(/^var\((--[^)]+)\)$/);
  if (variableMatch) {
    current = getComputedStyle(root).getPropertyValue(variableMatch[1]).trim();
  }
  const numericValue = Number.parseFloat(current);
  if (!Number.isFinite(numericValue)) return 56;
  if (current.endsWith("rem")) {
    const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    return numericValue * (Number.isFinite(rootFontSize) ? rootFontSize : 16);
  }
  return numericValue;
}

export function ResizableTableFrame({
  children,
  className,
  storageKey,
}: {
  children: ReactNode;
  className?: string;
  storageKey?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const widths = readStoredWidths(storageKey);
    if (!Object.keys(widths).length) return;
    const tables = tablesIn(root);
    for (const table of tables) {
      const tableKey = tableKeyFor(root, table);
      const singleTable = tables.length === 1;
      let applied = false;
      let nextTableWidth = freezeTableColumns(table).tableWidth;
      for (const col of resizableColumns(table)) {
        const columnIndex = col.dataset.resizableColumnIndex;
        if (columnIndex === undefined) continue;
        const width = widths[storedWidthKey(tableKey, columnIndex)] ?? (singleTable ? widths[columnIndex] : undefined);
        if (!Number.isFinite(width)) continue;
        const currentWidth = Number.parseFloat(col.style.width);
        if (Number.isFinite(currentWidth)) nextTableWidth += width - currentWidth;
        col.style.width = `${width}px`;
        col.style.minWidth = `${width}px`;
        applied = true;
      }
      if (applied) setTableInlineWidth(table, nextTableWidth);
    }
  }, [storageKey]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const root = rootRef.current;
    const target = event.target instanceof HTMLElement ? event.target : null;
    const handle = target?.closest<HTMLElement>("[data-column-resize-handle]");
    if (!root || !handle || !root.contains(handle)) return;

    const headerCell = handle.closest<HTMLElement>("[data-resizable-column-cell]");
    const columnIndex = handle.dataset.columnResizeHandle ?? headerCell?.dataset.resizableColumnCell;
    if (!headerCell || columnIndex === undefined) return;
    const activeTable = headerCell.closest("table");
    if (!(activeTable instanceof HTMLTableElement) || !root.contains(activeTable)) return;

    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const frozen = freezeTableColumns(activeTable);
    const frozenWidths = frozen.widths;
    const startWidth = frozenWidths.get(columnIndex) ?? Math.round(headerCell.getBoundingClientRect().width);
    const startTableWidth = frozen.tableWidth || Math.round(activeTable.getBoundingClientRect().width);
    const tableKey = tableKeyFor(root, activeTable);
    const minWidth = cssLengthToPixels(handle.dataset.minWidth ?? "56", root);
    document.body.classList.add("labnest-column-resizing");

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const width = Math.max(minWidth, Math.round(startWidth + moveEvent.clientX - startX));
      applyColumnWidthToTable(activeTable, columnIndex, width, startTableWidth + width - startWidth);
    };

    const stopResize = (upEvent: PointerEvent) => {
      const width = Math.max(minWidth, Math.round(startWidth + upEvent.clientX - startX));
      applyColumnWidthToTable(activeTable, columnIndex, width, startTableWidth + width - startWidth);
      writeStoredWidth(storageKey, tableKey, columnIndex, width);
      document.body.classList.remove("labnest-column-resizing");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
  }

  return <div ref={rootRef} onPointerDown={handlePointerDown} className={cn("resizable-table-frame", className)}>{children}</div>;
}
