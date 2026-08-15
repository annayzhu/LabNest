import { describe, expect, it } from "vitest";
import {
  boxStatistics,
  defaultVisualizationSettings,
  figureFontPresets,
  getPlotDefinition,
  journalThemes,
  kernelDensityEstimate,
  linearRegression,
  meanErrorStatistics,
  numericExtent,
  parseDelimitedData,
  parseRatioValue,
  validatePlotDataset,
} from "./visualization-studio";

function relativeLuminance(hex: string) {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

describe("Visualization Studio data contracts", () => {
  it("parses tab-delimited data and reports blank cells", () => {
    const dataset = parseDelimitedData("sample\tvalue\nS1\t1.4\nS2\t\n");
    expect(dataset.delimiter).toBe("tab");
    expect(dataset.headers).toEqual(["sample", "value"]);
    expect(dataset.rows).toHaveLength(2);
    expect(dataset.warnings).toContain("1 blank cell detected.");
  });

  it("parses quoted comma-delimited labels", () => {
    const dataset = parseDelimitedData('term,value\n"DNA repair, homologous",0.32\n');
    expect(dataset.delimiter).toBe("comma");
    expect(dataset.rows[0]).toEqual({ term: "DNA repair, homologous", value: "0.32" });
  });

  it("rejects malformed row widths without silently shifting values", () => {
    const dataset = parseDelimitedData("sample,value\nS1,1,unexpected\n");
    expect(dataset.errors.join(" ")).toMatch(/Row 2 has 3 values; expected 2/);
    expect(dataset.rows).toHaveLength(0);
  });

  it("supports enrichment ratios encoded as fractions", () => {
    expect(parseRatioValue("8/40")).toBeCloseTo(0.2);
    expect(parseRatioValue("0.35")).toBeCloseTo(0.35);
    expect(parseRatioValue("2/0")).toBeNull();
  });

  it("validates required numeric mappings", () => {
    const definition = getPlotDefinition("scatter");
    const dataset = parseDelimitedData("x\ty\tgroup\n1\t2\tA\n2\tbad\tB\n");
    const validation = validatePlotDataset(definition, dataset, { x: "x", y: "y", group: "group", label: "" });
    expect(validation.errors).toContain("Y contains 1 non-numeric or blank value.");
  });

  it("validates volcano probability bounds", () => {
    const definition = getPlotDefinition("volcano");
    const dataset = parseDelimitedData("gene\tlog2FC\tpadj\nTP53\t2.1\t0\nEGFR\t1.3\t1.2\n");
    const validation = validatePlotDataset(definition, dataset, { label: "gene", effect: "log2FC", pValue: "padj" });
    expect(validation.errors.join(" ")).toMatch(/outside \(0, 1\]/);
  });

  it("requires a mapped non-negative error column when bar SD or SEM is enabled", () => {
    const definition = getPlotDefinition("bar");
    const dataset = parseDelimitedData("category\tvalue\terror\nControl\t4.2\t-0.4\n");
    const missing = validatePlotDataset(definition, dataset, { category: "category", value: "value", error: "" }, { ...defaultVisualizationSettings, barErrorType: "sd" });
    expect(missing.errors).toContain("Map an error column before displaying SD error bars.");

    const negative = validatePlotDataset(definition, dataset, { category: "category", value: "value", error: "error" }, { ...defaultVisualizationSettings, barErrorType: "sem" });
    expect(negative.errors.join(" ")).toMatch(/SD and SEM must be non-negative/);
  });

  it("requires a mapped non-negative error column when line SD or SEM is enabled", () => {
    const definition = getPlotDefinition("line");
    const dataset = parseDelimitedData("time\tvalue\terror\tseries\n0\t1.0\t-0.1\tControl\n");
    const missing = validatePlotDataset(definition, dataset, { x: "time", value: "value", error: "", series: "series" }, { ...defaultVisualizationSettings, lineErrorType: "sd" });
    expect(missing.errors).toContain("Map an error column before displaying SD error bars.");

    const negative = validatePlotDataset(definition, dataset, { x: "time", value: "value", error: "error", series: "series" }, { ...defaultVisualizationSettings, lineErrorType: "sem" });
    expect(negative.errors.join(" ")).toMatch(/SD and SEM must be non-negative/);
  });

  it("computes Tukey box statistics and outliers reproducibly", () => {
    expect(boxStatistics([1, 2, 3, 4, 100])).toEqual({
      q1: 2,
      median: 3,
      q3: 4,
      low: 1,
      high: 4,
      outliers: [100],
    });
  });

  it("computes sample SD and SEM for point-summary error bars", () => {
    const summary = meanErrorStatistics([1, 2, 3]);
    expect(summary).toEqual({ mean: 2, sd: 1, sem: 1 / Math.sqrt(3), n: 3 });
    expect(meanErrorStatistics([4])).toEqual({ mean: 4, sd: 0, sem: 0, n: 1 });
  });

  it("provides complete publication palettes for categorical and continuous plots", () => {
    expect(Object.keys(journalThemes)).toHaveLength(9);
    expect(defaultVisualizationSettings.categoricalColors).toEqual(journalThemes.nature.categorical);
    Object.values(journalThemes).forEach((theme) => {
      expect(theme.categorical.length).toBeGreaterThanOrEqual(8);
      expect(new Set(theme.categorical).size).toBe(theme.categorical.length);
      const colors = [...theme.categorical, ...theme.sequential, ...theme.diverging, theme.ink, theme.muted, theme.grid];
      expect(colors.every((color) => /^#[0-9A-F]{6}$/i.test(color))).toBe(true);
      expect(Math.abs(relativeLuminance(theme.sequential[0]) - relativeLuminance(theme.sequential[1]))).toBeGreaterThan(0.35);
      expect(relativeLuminance(theme.diverging[1])).toBeGreaterThan(Math.max(relativeLuminance(theme.diverging[0]), relativeLuminance(theme.diverging[2])));
    });
  });

  it("provides portable sans-serif and serif figure-font presets", () => {
    expect(defaultVisualizationSettings.fontFamily).toBe("arial");
    expect(Object.keys(figureFontPresets)).toHaveLength(6);
    expect(Object.values(figureFontPresets).some((font) => font.style === "sans")).toBe(true);
    expect(Object.values(figureFontPresets).some((font) => font.style === "serif")).toBe(true);
    Object.values(figureFontPresets).forEach((font) => expect(font.family).toMatch(/sans-serif|serif/));
  });

  it("returns a fitted line and R-squared for numeric pairs", () => {
    const fit = linearRegression([{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 6 }]);
    expect(fit).not.toBeNull();
    expect(fit?.slope).toBeCloseTo(2);
    expect(fit?.intercept).toBeCloseTo(0);
    expect(fit?.rSquared).toBeCloseTo(1);
  });

  it("limits violin density to group support and closes both tails at zero", () => {
    const estimate = kernelDensityEstimate([4.1, 4.6, 4.8, 5.0, 5.4], [3, 9], 1);
    expect(estimate.bandwidth).toBeGreaterThan(0);
    expect(estimate.points[0].position).toBeGreaterThan(3);
    expect(estimate.points.at(-1)?.position).toBeLessThan(9);
    expect(estimate.points[0].density).toBe(0);
    expect(estimate.points.at(-1)?.density).toBe(0);
    expect(Math.max(...estimate.points.map((point) => point.density))).toBeGreaterThan(0);
  });

  it("keeps zero-baseline domains scientifically interpretable", () => {
    expect(numericExtent([4, 8, 10], true)).toEqual([0, 10.8]);
    expect(numericExtent([-10, -4], true)).toEqual([-10.8, 0]);
    expect(numericExtent([-2, 3], true)).toEqual([-2.4, 3.4]);
  });
});
