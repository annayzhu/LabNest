import type { ResultDatasetRowValues } from "./result-templates";
import type { ResultDatasetColumn } from "./types";

export type ResultDatasetPasteIssue = {
  row: number;
  column: number;
  value: string;
};

export type ResultDatasetPasteResult = {
  rows: ResultDatasetRowValues[];
  pastedRows: number;
  pastedColumns: number;
  skippedHeader: boolean;
  ignoredColumns: number;
  invalidCells: ResultDatasetPasteIssue[];
};

/** Parse the tab-separated clipboard format produced by Excel and similar spreadsheet apps. */
export function parseSpreadsheetClipboard(text: string): string[][] {
  const normalized = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  if (!normalized) return [];

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    if (quoted) {
      if (character === '"') {
        if (normalized[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === "\t") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  row.push(cell);
  rows.push(row);

  // Spreadsheet clipboard payloads normally end with one newline. It is a
  // delimiter, not an additional empty observation.
  if (normalized.endsWith("\n") && rows.at(-1)?.every((value) => value === "")) rows.pop();
  return rows;
}

function normalizeHeader(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function isTemplateHeader(row: string[], columns: ResultDatasetColumn[], startColumn: number) {
  let matchedCells = 0;
  for (let offset = 0; offset < row.length; offset += 1) {
    const cell = row[offset].trim();
    if (!cell) continue;
    const column = columns[startColumn + offset];
    if (!column) return false;
    const normalizedCell = normalizeHeader(cell);
    const aliases = [
      column.key,
      column.label,
      column.unit ? `${column.label} (${column.unit})` : "",
      column.unit ? `${column.label} ${column.unit}` : "",
    ].filter(Boolean).map(normalizeHeader);
    if (!aliases.includes(normalizedCell)) return false;
    matchedCells += 1;
  }
  return matchedCells > 0;
}

function validDateParts(year: number, month: number, day: number) {
  const value = new Date(Date.UTC(year, month - 1, day));
  return value.getUTCFullYear() === year && value.getUTCMonth() === month - 1 && value.getUTCDate() === day;
}

function normalizeDate(value: string) {
  const match = value.trim().match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!validDateParts(year, month, day)) return undefined;
  return `${match[1]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeDateTime(value: string) {
  const match = value.trim().match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] === undefined ? undefined : Number(match[6]);
  if (!validDateParts(year, month, day) || hour > 23 || minute > 59 || (second !== undefined && second > 59)) return undefined;
  const date = `${match[1]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return `${date}T${time}${second === undefined ? "" : `:${String(second).padStart(2, "0")}`}`;
}

function convertCellValue(value: string, column: ResultDatasetColumn): { valid: true; value: unknown } | { valid: false } {
  const trimmed = value.trim();
  if (!trimmed) return { valid: true, value: undefined };

  if (column.dataType === "number") {
    const normalized = trimmed.replaceAll("−", "-");
    const validNumber = normalized.includes(",")
      ? /^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(normalized)
      : /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized);
    if (!validNumber) return { valid: false };
    const parsed = Number(normalized.replaceAll(",", ""));
    return Number.isFinite(parsed) ? { valid: true, value: parsed } : { valid: false };
  }

  if (column.dataType === "boolean") {
    const normalized = trimmed.normalize("NFKC").toLocaleLowerCase();
    if (["true", "yes", "y", "1", "是"].includes(normalized)) return { valid: true, value: true };
    if (["false", "no", "n", "0", "否"].includes(normalized)) return { valid: true, value: false };
    return { valid: false };
  }

  if (column.dataType === "date") {
    const date = normalizeDate(trimmed);
    return date ? { valid: true, value: date } : { valid: false };
  }

  if (column.dataType === "datetime") {
    const dateTime = normalizeDateTime(trimmed);
    return dateTime ? { valid: true, value: dateTime } : { valid: false };
  }

  return { valid: true, value };
}

export function applySpreadsheetPaste({
  text,
  columns,
  rows,
  startRow,
  startColumn,
}: {
  text: string;
  columns: ResultDatasetColumn[];
  rows: ResultDatasetRowValues[];
  startRow: number;
  startColumn: number;
}): ResultDatasetPasteResult {
  const parsed = parseSpreadsheetClipboard(text);
  const skippedHeader = parsed.length > 0 && isTemplateHeader(parsed[0], columns, startColumn);
  const pasted = skippedHeader ? parsed.slice(1) : parsed;
  const maxPastedColumns = pasted.reduce((maximum, row) => Math.max(maximum, row.length), 0);
  const availableColumns = Math.max(columns.length - startColumn, 0);
  const pastedColumns = Math.min(maxPastedColumns, availableColumns);
  const ignoredColumns = Math.max(maxPastedColumns - availableColumns, 0);
  const nextRows = (rows.length ? rows : [{}]).map((row) => ({ ...row }));
  const invalidCells: ResultDatasetPasteIssue[] = [];

  while (nextRows.length < startRow + pasted.length) nextRows.push({});

  pasted.forEach((sourceRow, rowOffset) => {
    sourceRow.slice(0, availableColumns).forEach((sourceValue, columnOffset) => {
      const column = columns[startColumn + columnOffset];
      if (!column) return;
      const converted = convertCellValue(sourceValue, column);
      if (!converted.valid) {
        invalidCells.push({ row: startRow + rowOffset, column: startColumn + columnOffset, value: sourceValue });
        return;
      }
      if (converted.value === undefined) delete nextRows[startRow + rowOffset][column.key];
      else nextRows[startRow + rowOffset][column.key] = converted.value;
    });
  });

  return {
    rows: nextRows,
    pastedRows: pasted.length,
    pastedColumns,
    skippedHeader,
    ignoredColumns,
    invalidCells,
  };
}
