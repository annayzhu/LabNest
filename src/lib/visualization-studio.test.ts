import { describe, expect, it } from "vitest";
import {
  assessCategoricalPalette,
  boxStatistics,
  defaultVisualizationPaletteSeriesId,
  defaultVisualizationSettings,
  defaultVisualizationThemeId,
  figureFontPresets,
  getPlotDefinition,
  getPlotExamples,
  journalThemes,
  paletteSeries,
  kernelDensityEstimate,
  linearRegression,
  meanErrorStatistics,
  numericExtent,
  parseDelimitedData,
  parseRatioValue,
  plotDefinitions,
  plotGuidance,
  plotReferences,
  validatePlotDataset,
} from "./visualization-studio";

function relativeLuminance(hex: string) {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function rgbChroma(hex: string) {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
  return Math.max(...channels) - Math.min(...channels);
}

describe("Visualization Studio data contracts", () => {
  it("uses a compact default canvas without reducing publication text sizes", () => {
    expect(defaultVisualizationSettings.width).toBe(340);
    expect(defaultVisualizationSettings.height).toBe(340);
    expect(defaultVisualizationSettings.titleSize).toBe(17);
    expect(defaultVisualizationSettings.axisLabelSize).toBe(14);
    expect(defaultVisualizationSettings.tickSize).toBe(11);
    expect(defaultVisualizationSettings.legendSize).toBe(11);
  });

  it("ships every requested first-batch plot type with a sample data contract", () => {
    const requested = [
      "scatter", "correlation", "volcano", "ma", "quadrant", "bar", "errorbar", "line", "area", "lollipop",
      "box", "violin", "beeswarm", "raincloud", "clustered-heatmap", "correlation-heatmap", "pca", "pcoa", "umap",
      "enrichment", "enrichment-bar", "gsea", "km", "survival-forest", "roc", "venn", "upset", "sankey", "chord", "circos",
    ];
    expect(plotDefinitions).toHaveLength(31);
    expect(requested.every((id) => plotDefinitions.some((definition) => definition.id === id && definition.sampleData.length > 20))).toBe(true);
    plotDefinitions.forEach((definition) => {
      const examples = getPlotExamples(definition);
      expect(examples.length).toBeGreaterThan(0);
      expect(examples.every((example) => example.label.startsWith("Example ") && example.data.length > 20)).toBe(true);
    });
    expect(getPlotExamples(getPlotDefinition("bar"))).toHaveLength(2);
    expect(getPlotExamples(getPlotDefinition("line"))).toHaveLength(2);
    expect(getPlotExamples(getPlotDefinition("pca"))).toHaveLength(2);
  });

  it("uses representative demo sizes for dense scientific plots", () => {
    const umap = parseDelimitedData(getPlotDefinition("umap").sampleData);
    const gsea = parseDelimitedData(getPlotDefinition("gsea").sampleData);
    const survival = parseDelimitedData(getPlotDefinition("km").sampleData);
    const roc = parseDelimitedData(getPlotDefinition("roc").sampleData);
    const heatmap = parseDelimitedData(getPlotDefinition("heatmap").sampleData);
    expect(umap.rows.length).toBeGreaterThanOrEqual(60);
    expect(new Set(umap.rows.map((row) => row.group)).size).toBe(3);
    expect(gsea.rows).toHaveLength(100);
    expect(Number(gsea.rows[0].runningES)).toBeCloseTo(0, 1);
    expect(Number(gsea.rows.at(-1)?.runningES)).toBe(0);
    expect(Math.max(...gsea.rows.map((row) => Number(row.runningES)))).toBeGreaterThan(0.5);
    expect(survival.rows.length).toBeGreaterThanOrEqual(40);
    expect(new Set(survival.rows.map((row) => row.group))).toEqual(new Set(["High risk", "Low risk"]));
    expect(survival.rows.some((row) => row.event === "0")).toBe(true);
    expect(survival.rows.some((row) => row.event === "1")).toBe(true);
    expect(roc.rows).toHaveLength(120);
    expect(new Set(roc.rows.map((row) => row.model))).toEqual(new Set(["Model A", "Model B"]));
    expect(heatmap.rows).toHaveLength(24);
    expect(heatmap.headers).toHaveLength(13);
  });

  it("shows all four Chai-dyed Brown categorical colors in the default bar demo", () => {
    const barDataset = parseDelimitedData(getPlotDefinition("bar").sampleData);
    expect(new Set(barDataset.rows.map((row) => row.group))).toEqual(new Set(["Control", "Treatment A", "Treatment B", "Treatment C"]));
    expect(defaultVisualizationSettings.categoricalColors).toHaveLength(4);
  });

  it("keeps plot families method-level and provides guidance for every module", () => {
    expect(getPlotDefinition("pca").family).toBe("Dimension reduction");
    expect(getPlotDefinition("pca").summary).not.toMatch(/RNA-seq|gene-expression/i);
    expect(plotGuidance.pca.suitableData).toMatch(/组学、影像特征、形态学、光谱/);
    expect(Object.keys(plotGuidance)).toHaveLength(plotDefinitions.length);
    plotDefinitions.forEach((definition) => {
      expect(plotGuidance[definition.id].definition.length).toBeGreaterThan(15);
      expect(plotGuidance[definition.id].suitableData.length).toBeGreaterThan(10);
      expect(plotGuidance[definition.id].answers.length).toBeGreaterThan(15);
      if (plotGuidance[definition.id].origin) expect(plotGuidance[definition.id].origin?.length).toBeGreaterThan(20);
      expect(plotGuidance[definition.id].references.length).toBeGreaterThan(0);
      plotGuidance[definition.id].references.forEach((reference) => {
        expect(reference.citation).toMatch(/\d{4}/);
        expect(reference.href).toMatch(/^https:\/\/doi\.org\/10\./);
      });
    });
    expect(Object.keys(plotReferences).length).toBeGreaterThanOrEqual(25);
    expect(plotGuidance.pca.references).toContain(plotReferences.pca);
  });

  it("distinguishes circular category relationships from coordinate-based genome tracks", () => {
    expect(plotGuidance.chord.definition).toMatch(/类别.*关系/);
    expect(plotGuidance.chord.definition).toMatch(/不包含.*基因组坐标/);
    expect(plotGuidance.circos.definition).toMatch(/真实坐标/);
    expect(plotGuidance.circos.definition).toMatch(/同心数据轨道/);
    expect(plotGuidance.chord.suitableData).not.toMatch(/染色体|基因组区段/);
    expect(plotGuidance.circos.suitableData).toMatch(/染色体.*起止坐标/);
  });

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

  it("rejects one-class ROC data and oversized heatmaps", () => {
    const roc = validatePlotDataset(
      getPlotDefinition("roc"),
      parseDelimitedData("truth\tscore\n1\t0.9\n1\t0.7\n"),
      { truth: "truth", score: "score", group: "" },
    );
    expect(roc.errors).toContain("ROC calculation requires both outcome classes (0 and 1).");

    const rows = Array.from({ length: 251 }, (_, index) => `G${index}\t${index}\t${index + 1}`).join("\n");
    const heatmap = validatePlotDataset(getPlotDefinition("clustered-heatmap"), parseDelimitedData(`gene\tS1\tS2\n${rows}`), {});
    expect(heatmap.errors.join(" ")).toMatch(/limited to 250 rows/);
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
    expect(Object.keys(journalThemes)).toHaveLength(23);
    expect(paletteSeries.minimal.themeIds).toHaveLength(5);
    expect(paletteSeries.journal.themeIds).toHaveLength(6);
    expect(paletteSeries.curated.themeIds).toHaveLength(3);
    expect(paletteSeries["chinese-traditional"].themeIds).toHaveLength(9);
    expect(paletteSeries.custom.themeIds).toHaveLength(0);
    expect(defaultVisualizationPaletteSeriesId).toBe("chinese-traditional");
    expect(defaultVisualizationThemeId).toBe("cn-beihai");
    expect(journalThemes[defaultVisualizationThemeId].name).toBe("柴染棕");
    expect(defaultVisualizationSettings.categoricalColors).toEqual(journalThemes[defaultVisualizationThemeId].categorical);
    expect(defaultVisualizationSettings.continuousLow).toBe(journalThemes[defaultVisualizationThemeId].sequential[0]);
    expect(defaultVisualizationSettings.continuousHigh).toBe(journalThemes[defaultVisualizationThemeId].sequential[1]);
    expect(defaultVisualizationSettings.divergingLow).toBe(journalThemes[defaultVisualizationThemeId].diverging[0]);
    expect(defaultVisualizationSettings.divergingMid).toBe(journalThemes[defaultVisualizationThemeId].diverging[1]);
    expect(defaultVisualizationSettings.divergingHigh).toBe(journalThemes[defaultVisualizationThemeId].diverging[2]);
    Object.values(journalThemes).forEach((theme) => {
      expect(theme.categorical.length).toBeGreaterThanOrEqual(theme.series === "chinese-traditional" ? 4 : 8);
      expect(new Set(theme.categorical).size).toBe(theme.categorical.length);
      const colors = [...theme.categorical, ...theme.sequential, ...theme.diverging, theme.ink, theme.muted, theme.grid];
      expect(colors.every((color) => /^#[0-9A-F]{6}$/i.test(color))).toBe(true);
      expect(Math.abs(relativeLuminance(theme.sequential[0]) - relativeLuminance(theme.sequential[1]))).toBeGreaterThan(theme.series === "chinese-traditional" ? 0.25 : 0.35);
      expect(relativeLuminance(theme.diverging[1])).toBeGreaterThan(Math.max(relativeLuminance(theme.diverging[0]), relativeLuminance(theme.diverging[2])));
    });
    Object.values(journalThemes).filter((theme) => theme.series === "chinese-traditional").forEach((theme) => {
      expect(relativeLuminance(theme.diverging[1])).toBeGreaterThan(0.85);
      expect(relativeLuminance(theme.diverging[0])).toBeGreaterThan(0.3);
      expect(relativeLuminance(theme.diverging[2])).toBeGreaterThan(0.3);
      expect(rgbChroma(theme.diverging[0])).toBeLessThan(0.3);
      expect(rgbChroma(theme.diverging[2])).toBeLessThan(0.3);
    });
  });

  it("keeps the nine canonical Chinese-traditional publication anchors exact", () => {
    const sourcePalettes = {
      "cn-beihai": ["#C09351", "#6C9BCA", "#F0945D", "#5FA88F"],
      "cn-imperial-orange": ["#D46D3A", "#2C9678", "#F17666", "#7BA4B8"],
      "cn-wisteria": ["#8076A3", "#C8ADC4", "#2775B6", "#EEAA9C"],
      "cn-sunset": ["#F9CB8B", "#63BBD0", "#C04851", "#83A78D"],
      "cn-hutong": ["#4E7CA1", "#C8A58E", "#F2C867", "#69A794"],
      "cn-dragon": ["#A49C93", "#8FB2C9", "#F17666", "#69A794"],
      "cn-coral": ["#F04A3A", "#AED9D4", "#2775B6", "#F2C867"],
      "cn-autumn": ["#F4A83A", "#8FB2C9", "#8076A3", "#7BC092"],
      "cn-vermilion": ["#D92121", "#2775B6", "#F4A83A", "#2C9678"],
    } as const;
    Object.entries(sourcePalettes).forEach(([id, colors]) => {
      expect(journalThemes[id as keyof typeof journalThemes].categorical).toEqual(colors);
      expect(journalThemes[id as keyof typeof journalThemes].ink).toBe("#23242A");
    });
  });

  it("reports deterministic normal, protanopia, and deuteranopia palette quality", () => {
    Object.values(journalThemes).forEach((theme) => {
      const report = assessCategoricalPalette(theme.categorical);
      expect(report.validHex).toBe(true);
      expect(report.duplicateColors).toEqual([]);
      expect(report.nearWhiteIndexes).toEqual([]);
      expect(report.minimumNormalDistance).toBeGreaterThan(0);
      expect(report.minimumProtanopiaDistance).toBeGreaterThanOrEqual(0);
      expect(report.minimumDeuteranopiaDistance).toBeGreaterThanOrEqual(0);
      if (Math.min(report.minimumProtanopiaDistance, report.minimumDeuteranopiaDistance) < 0.08) {
        expect(report.requiresSecondaryEncoding).toBe(true);
      }
    });
    expect(assessCategoricalPalette(["#AABBCC", "#aabbcc"]).duplicateColors).toEqual(["#AABBCC"]);
    expect(assessCategoricalPalette(["#FFFFFF", "#000000"]).nearWhiteIndexes).toEqual([0]);
    expect(assessCategoricalPalette(["not-a-color", "#000000"]).requiresSecondaryEncoding).toBe(true);
    expect(assessCategoricalPalette(journalThemes[defaultVisualizationThemeId].categorical.slice(0, 4)).requiresSecondaryEncoding).toBe(false);
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
