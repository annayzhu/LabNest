import { describe, expect, it } from "vitest";
import type { ResultDatasetColumn } from "./types";
import { applySpreadsheetPaste, parseSpreadsheetClipboard } from "./result-dataset-paste";

const columns: ResultDatasetColumn[] = [
  { key: "sample_id", label: "Sample ID", dataType: "text" },
  { key: "concentration", label: "Concentration", dataType: "number", unit: "ng/uL" },
  { key: "accepted", label: "Accepted", dataType: "boolean" },
  { key: "run_date", label: "Run date", dataType: "date" },
  { key: "recorded_at", label: "Recorded at", dataType: "datetime" },
];

describe("spreadsheet clipboard parsing", () => {
  it("parses a rectangular TSV payload and preserves empty cells", () => {
    expect(parseSpreadsheetClipboard("S1\t12.5\t\nS2\t\tYes\n")).toEqual([
      ["S1", "12.5", ""],
      ["S2", "", "Yes"],
    ]);
  });

  it("supports quoted tabs, newlines, and doubled quotes", () => {
    expect(parseSpreadsheetClipboard('"sample\tA"\t"line 1\nline 2"\t"a ""quote"""')).toEqual([
      ["sample\tA", "line 1\nline 2", 'a "quote"'],
    ]);
  });
});

describe("result dataset spreadsheet paste", () => {
  it("skips a matching label header and expands the table by row", () => {
    const result = applySpreadsheetPaste({
      text: "Sample ID\tConcentration (ng/uL)\tAccepted\nS1\t1,234.5\t是\nS2\t88\tNo",
      columns,
      rows: [{}],
      startRow: 0,
      startColumn: 0,
    });

    expect(result.skippedHeader).toBe(true);
    expect(result.pastedRows).toBe(2);
    expect(result.pastedColumns).toBe(3);
    expect(result.rows).toEqual([
      { sample_id: "S1", concentration: 1234.5, accepted: true },
      { sample_id: "S2", concentration: 88, accepted: false },
    ]);
  });

  it("starts at the selected cell and ignores columns outside the template", () => {
    const result = applySpreadsheetPaste({
      text: "12\tYes\t2026/8/14\t2026-08-14 09:05:06\textra",
      columns,
      rows: [{ sample_id: "S1" }],
      startRow: 0,
      startColumn: 1,
    });

    expect(result.ignoredColumns).toBe(1);
    expect(result.rows[0]).toEqual({
      sample_id: "S1",
      concentration: 12,
      accepted: true,
      run_date: "2026-08-14",
      recorded_at: "2026-08-14T09:05:06",
    });
  });

  it("does not overwrite an existing typed value when pasted input is invalid", () => {
    const result = applySpreadsheetPaste({
      text: "not a number\tmaybe\t2026-02-30",
      columns,
      rows: [{ concentration: 42, accepted: true, run_date: "2026-02-28" }],
      startRow: 0,
      startColumn: 1,
    });

    expect(result.rows[0]).toEqual({ concentration: 42, accepted: true, run_date: "2026-02-28" });
    expect(result.invalidCells).toHaveLength(3);
  });

  it("accepts template keys as a header row", () => {
    const result = applySpreadsheetPaste({
      text: "sample_id\tconcentration\nS1\t10",
      columns,
      rows: [],
      startRow: 0,
      startColumn: 0,
    });

    expect(result.skippedHeader).toBe(true);
    expect(result.rows).toEqual([{ sample_id: "S1", concentration: 10 }]);
  });
});
