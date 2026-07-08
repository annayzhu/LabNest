export type CsvCell = string | number | boolean | Date | null | undefined;

export function formatExportTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function csvEscape(value: CsvCell) {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function toCsv<T extends Record<string, CsvCell>>(rows: T[], headers: readonly (keyof T)[]) {
  const headerLine = headers.map((header) => csvEscape(String(header))).join(",");
  const bodyLines = rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","));

  return [headerLine, ...bodyLines].join("\n");
}

export function downloadResponse(
  body: BodyInit,
  filename: string,
  contentType: string,
) {
  return new Response(body, {
    headers: {
      "content-type": contentType,
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
