import { describe, expect, it } from "vitest";
import { adjustPValues, analyzeBarData, barAnalysisResultsTsv } from "./visualization-bar-analysis";

describe("Bar statistical analysis", () => {
  it("calculates a two-sided Welch comparison from independent biological observations", () => {
    const rows = [1, 2, 3].map((value, index) => ({ category: "Control", value: String(value), sample_id: `C${index + 1}` }))
      .concat([4, 5, 6].map((value, index) => ({ category: "Treatment", value: String(value), sample_id: `T${index + 1}` })));
    const analysis = analyzeBarData(rows, { category: "category", value: "value", subject: "sample_id" }, { mode: "raw-independent", adjustment: "none", referenceCategory: "Control" });
    expect(analysis.errors).toEqual([]);
    expect(analysis.results).toHaveLength(1);
    expect(analysis.results[0].difference).toBeCloseTo(3, 10);
    expect(analysis.results[0].statistic).toBeCloseTo(3.674234614, 8);
    expect(analysis.results[0].degreesOfFreedom).toBeCloseTo(4, 10);
    expect(analysis.results[0].rawPValue).toBeCloseTo(0.021311641, 8);
    expect(analysis.results[0].lower95).toBeCloseTo(0.733042, 5);
    expect(analysis.results[0].upper95).toBeCloseTo(5.266958, 5);
  });

  it("uses explicit n with SD for summary-data inference and never infers n from SEM", () => {
    const complete = analyzeBarData([
      { category: "Control", mean: "1", sd: "1", sem: "0.5", n: "4" },
      { category: "Treatment", mean: "3", sd: "1.5", sem: "0.75", n: "4" },
    ], { category: "category", value: "mean", sd: "sd", sem: "sem", n: "n" }, { mode: "summary-independent", adjustment: "none", referenceCategory: "Control" });
    expect(complete.errors).toEqual([]);
    expect(complete.results[0].nReference).toBe(4);
    expect(complete.results[0].method).toBe("Welch two-sample t-test");

    const missingN = analyzeBarData([
      { category: "Control", mean: "1", sd: "1", sem: "0.5" },
      { category: "Treatment", mean: "3", sd: "1.5", sem: "0.75" },
    ], { category: "category", value: "mean", sd: "sd", sem: "sem" }, { mode: "summary-independent", adjustment: "none" });
    expect(missingN.errors.some((message) => message.includes("sample-size"))).toBe(true);
  });

  it("matches paired subjects and rejects incomplete pairs", () => {
    const pairedRows = [
      { category: "Before", value: "1", subject: "P1" }, { category: "After", value: "2", subject: "P1" },
      { category: "Before", value: "2", subject: "P2" }, { category: "After", value: "4", subject: "P2" },
      { category: "Before", value: "4", subject: "P3" }, { category: "After", value: "7", subject: "P3" },
    ];
    const analysis = analyzeBarData(pairedRows, { category: "category", value: "value", subject: "subject" }, { mode: "raw-paired", adjustment: "none", referenceCategory: "Before" });
    expect(analysis.errors).toEqual([]);
    expect(analysis.results[0].difference).toBeCloseTo(2, 10);
    expect(analysis.results[0].statistic).toBeCloseTo(3.464101615, 8);
    expect(analysis.results[0].degreesOfFreedom).toBe(2);
    expect(analysis.results[0].rawPValue).toBeCloseTo(0.0741799, 6);

    const incomplete = analyzeBarData(pairedRows.slice(0, -1), { category: "category", value: "value", subject: "subject" }, { mode: "raw-paired", adjustment: "none", referenceCategory: "Before" });
    expect(incomplete.errors.some((message) => message.includes("same subject IDs"))).toBe(true);
  });

  it("tests qPCR on delta Ct while preserving relative expression for display", () => {
    const rows = [
      { category: "Control", relative_expression: "1.00", delta_ct: "4.0", sample_id: "C1" },
      { category: "Control", relative_expression: "1.05", delta_ct: "4.2", sample_id: "C2" },
      { category: "Treatment", relative_expression: "2.10", delta_ct: "3.0", sample_id: "T1" },
      { category: "Treatment", relative_expression: "1.95", delta_ct: "3.2", sample_id: "T2" },
    ];
    const analysis = analyzeBarData(rows, { category: "category", value: "relative_expression", analysisValue: "delta_ct", subject: "sample_id" }, { mode: "qpcr-delta-ct", adjustment: "none", referenceCategory: "Control" });
    expect(analysis.errors).toEqual([]);
    expect(analysis.results[0].meanReference).toBeCloseTo(4.1, 10);
    expect(analysis.results[0].meanComparison).toBeCloseTo(3.1, 10);
    expect(analysis.results[0].analysisScale).toBe("ΔCt");
    expect(analysis.rows[0].relative_expression).toBe("1.00");
  });

  it("adjusts the displayed comparison family with Holm or Benjamini-Hochberg", () => {
    expect(adjustPValues([0.01, 0.04, 0.03], "holm")).toEqual([0.03, 0.06, 0.06]);
    expect(adjustPValues([0.01, 0.04, 0.03], "bh")).toEqual([0.03, 0.04, 0.04]);
  });

  it("exports complete audit columns", () => {
    const analysis = analyzeBarData([
      { category: "A", value: "1", sample: "A1" }, { category: "A", value: "2", sample: "A2" },
      { category: "B", value: "3", sample: "B1" }, { category: "B", value: "4", sample: "B2" },
    ], { category: "category", value: "value", subject: "sample" }, { mode: "raw-independent", adjustment: "bh" });
    const tsv = barAnalysisResultsTsv(analysis.results);
    expect(tsv).toContain("p_raw\tp_adjusted\tmethod\tanalysis_scale");
    expect(tsv).toContain("Welch two-sample t-test");
  });

  it("rejects duplicated biological IDs instead of counting technical replicates as n", () => {
    const analysis = analyzeBarData([
      { category: "A", value: "1", sample: "S1" }, { category: "A", value: "1.1", sample: "S1" },
      { category: "B", value: "2", sample: "S2" }, { category: "B", value: "2.1", sample: "S3" },
    ], { category: "category", value: "value", subject: "sample" }, { mode: "raw-independent", adjustment: "none" });
    expect(analysis.errors.some((message) => message.includes("aggregate technical replicates"))).toBe(true);
  });
});
