import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { readSheet } from "read-excel-file/node";
import { getAttachmentRoot, safeAttachmentFilename } from "./attachments";

const maxDatasetBytes = 25 * 1024 * 1024;
const previewRows = 30;

export type DatasetPreview = {
  columns: Array<{ name: string; index: number; inferredType: string }>;
  rows: Array<Array<string | number | boolean | null>>;
  rowCount: number;
  columnCount: number;
};

function datasetRoot() { return path.join(getAttachmentRoot(), "datasets"); }

export function resolveDatasetPath(storagePath: string) {
  const root = datasetRoot();
  const resolved = path.resolve(root, storagePath);
  if (!resolved.startsWith(root)) throw new Error("Dataset path resolves outside the configured dataset root.");
  return resolved;
}

function normalizeCell(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

function parseDelimitedLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') { current += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { cells.push(current); current = ""; }
    else current += char;
  }
  cells.push(current);
  return cells;
}

function inferredType(values: Array<string | number | boolean | null>) {
  const present = values.filter((value) => value !== null && value !== "");
  if (!present.length) return "empty";
  if (present.every((value) => typeof value === "number" || (typeof value === "string" && Number.isFinite(Number(value))))) return "number";
  if (present.every((value) => typeof value === "boolean" || ["true", "false"].includes(String(value).toLowerCase()))) return "boolean";
  return "text";
}

function previewFromRows(inputRows: unknown[][]): DatasetPreview {
  const nonEmptyRows = inputRows.filter((row) => row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== ""));
  const header = nonEmptyRows[0]?.map((cell, index) => String(cell ?? "").trim() || `Column ${index + 1}`) ?? [];
  const dataRows = nonEmptyRows.slice(1);
  const columnCount = Math.max(header.length, ...dataRows.map((row) => row.length), 0);
  const names = Array.from({ length: columnCount }, (_, index) => header[index] || `Column ${index + 1}`);
  const normalizedPreview = dataRows.slice(0, previewRows).map((row) => Array.from({ length: columnCount }, (_, index) => normalizeCell(row[index])));
  return {
    columns: names.map((name, index) => ({ name, index, inferredType: inferredType(normalizedPreview.map((row) => row[index])) })),
    rows: normalizedPreview,
    rowCount: dataRows.length,
    columnCount,
  };
}

export async function inspectDataset(buffer: Buffer, filename: string): Promise<DatasetPreview> {
  const extension = path.extname(filename).toLowerCase();
  if (extension === ".xlsx") {
    const rows = await readSheet(buffer, { trim: true }) as unknown[][];
    return previewFromRows(rows);
  }
  if (![".csv", ".tsv", ".txt"].includes(extension)) throw new Error("Dataset files must be CSV, TSV, TXT, or XLSX.");
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const delimiter = extension === ".tsv" ? "\t" : extension === ".csv" ? "," : (text.includes("\t") ? "\t" : ",");
  return previewFromRows(text.split(/\r?\n/).filter((line) => line.trim()).map((line) => parseDelimitedLine(line, delimiter)));
}

export async function saveManagedDataset(file: File) {
  if (!file.size) throw new Error("The selected dataset is empty.");
  if (file.size > maxDatasetBytes) throw new Error("Managed dataset upload is limited to 25 MB. Use an external reference for larger tables.");
  const buffer = Buffer.from(await file.arrayBuffer());
  const preview = await inspectDataset(buffer, file.name);
  const now = new Date();
  const relativePath = path.join(String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, "0"), `${randomUUID()}-${safeAttachmentFilename(file.name)}`);
  const absolutePath = resolveDatasetPath(relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);
  return { ...preview, storagePath: relativePath, checksum: createHash("sha256").update(buffer).digest("hex"), size: file.size, sourceFileName: file.name, mimeType: file.type || "application/octet-stream" };
}

export async function readManagedDataset(storagePath: string) { return readFile(resolveDatasetPath(storagePath)); }
