import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ScientificChartPreview } from "@/components/ScientificChartPreview";
import {
  analyzeSetIntersections,
  radialIntersectionLayout,
  exactIntersectionCount,
  intersectionExportTsv,
  setDiagramLayoutMetrics,
  upsetAdaptiveLayout,
} from "./visualization-sets";
import {
  defaultVisualizationSettings,
  defaultVisualizationThemeId,
  getPlotDefinition,
  parseDelimitedData,
  plotModuleRegistry,
  validatePlotDataset,
} from "./visualization-studio";

describe("set-intersection scientific contracts", () => {
  it("deduplicates item–set rows and counts exact intersections", () => {
    const dataset = parseDelimitedData("item\tset\na\tA\na\tB\na\tB\nb\tA\nc\tB\nd\tA\nd\tB\nd\tC\ne\tC");
    const analysis = analyzeSetIntersections(dataset.rows, { item: "item", set: "set" }, "membership");
    expect(analysis.sets).toEqual(["A", "B", "C"]);
    expect(analysis.duplicatesCollapsed).toBe(1);
    expect(analysis.setSizes).toEqual(new Map([["A", 3], ["B", 3], ["C", 2]]));
    expect(exactIntersectionCount(analysis, ["A"])).toBe(1);
    expect(exactIntersectionCount(analysis, ["A", "B"])).toBe(1);
    expect(exactIntersectionCount(analysis, ["A", "B", "C"])).toBe(1);
    expect(intersectionExportTsv(analysis, analysis.intersections.find((entry) => entry.sets.join("+") === "A+B")!.signature)).toContain("a\tA & B");
  });

  it("uses half-open atomic genomic segments with constant active-set membership", () => {
    const dataset = parseDelimitedData("peak\tset\tchromosome\tstart\tend\na\tA\tchr1\t0\t10\nb\tB\tchr1\t9\t20\nc\tC\tchr1\t19\t30\nd\tD\tchr1\t30\t40\ne\tA\tchr2\t9\t20");
    const mapping = { item: "peak", set: "set", chromosome: "chromosome", start: "start", end: "end" };
    const analysis = analyzeSetIntersections(dataset.rows, mapping, "peak-overlap");
    expect(analysis.memberships.size).toBe(7);
    expect(exactIntersectionCount(analysis, ["A", "B", "C"])).toBe(0);
    expect(exactIntersectionCount(analysis, ["A", "B"])).toBe(1);
    expect(exactIntersectionCount(analysis, ["B", "C"])).toBe(1);
    expect(exactIntersectionCount(analysis, ["D"])).toBe(1);
    expect(exactIntersectionCount(analysis, ["A"])).toBe(2);
    const pair = analysis.intersections.find((entry) => entry.sets.join("+") === "A+B")!;
    const exported = intersectionExportTsv(analysis, pair.signature);
    expect(exported.startsWith("atomic_segment\tchromosome\tstart\tend")).toBe(true);
    expect(exported).toContain("\t1\t9\t10\tA & B\ta; b");
  });

  it("bounds provenance work for a 20,000-row adversarial nested peak input", () => {
    const rows = [
      ...Array.from({ length: 10_000 }, (_, index) => ({ peak: `A${index}`, set: "A", chromosome: "chr1", start: String(index), end: String(1_000_000 - index) })),
      ...Array.from({ length: 10_000 }, (_, index) => ({ peak: `B${index}`, set: "B", chromosome: "chr1", start: String(20_000 + index * 2), end: String(20_001 + index * 2) })),
    ];
    const started = performance.now();
    const analysis = analyzeSetIntersections(rows, { item: "peak", set: "set", chromosome: "chromosome", start: "start", end: "end" }, "peak-overlap");
    expect(performance.now() - started).toBeLessThan(3_000);
    expect(analysis.safetyError).toMatch(/provenance links/i);
    expect(analysis.memberships.size).toBe(0);
  });

  it("orders sparse seven-set radial regions deterministically without invalid geometry", () => {
    const rows = parseDelimitedData(["item\tset", ...Array.from({ length: 7 }, (_, index) => `only${index}\tS${index + 1}`), ...Array.from({ length: 7 }, (_, index) => `shared\tS${index + 1}`)].join("\n")).rows;
    const analysis = analyzeSetIntersections(rows, { item: "item", set: "set" });
    const regions = radialIntersectionLayout(analysis);
    expect(regions).toHaveLength(8);
    expect(new Set(regions.map((region) => region.signature)).size).toBe(8);
    expect(regions.every((region) => Number.isFinite(region.start) && Number.isFinite(region.end) && region.span > 0)).toBe(true);
    expect(setDiagramLayoutMetrics(600, 420, analysis, 11, false).fits).toBe(true);
  });

  it("adapts UpSet content to the available height instead of leaving a fixed blank tail", () => {
    const compact = upsetAdaptiveLayout(24, 258, 7, 8, 280, 11);
    const tall = upsetAdaptiveLayout(24, 718, 7, 8, 280, 11);
    expect(compact.contentBottom).toBe(270);
    expect(tall.contentBottom).toBe(730);
    expect(tall.barHeight).toBeGreaterThan(compact.barHeight);
    expect(compact.fits).toBe(true);
  });

  it("validates input-specific mappings, set limits, and compact region capacity", () => {
    const venn = getPlotDefinition("venn");
    const membership = parseDelimitedData("item\tset\na\tA\nb\tB");
    expect(validatePlotDataset(venn, membership, { item: "item", set: "set", chromosome: "", start: "", end: "" }, { ...defaultVisualizationSettings, setInputMode: "membership" }).errors).toEqual([]);
    const missingPeakCoordinates = validatePlotDataset(venn, membership, { item: "", set: "set", chromosome: "", start: "", end: "" }, { ...defaultVisualizationSettings, setInputMode: "peak-overlap" });
    expect(missingPeakCoordinates.errors.join(" ")).toMatch(/requires chromosome, start, and end/i);
    const eightSets = parseDelimitedData(["item\tset", ...Array.from({ length: 8 }, (_, index) => `i${index}\tS${index}`)].join("\n"));
    expect(validatePlotDataset(venn, eightSets, venn.defaultMapping, { ...defaultVisualizationSettings, setInputMode: "membership" }).errors.join(" ")).toMatch(/2–7 unique sets/i);
  });

  it("renders exact region identities, set summaries, and finite SVG marks", () => {
    for (const type of ["venn", "upset"] as const) {
      const plotModule = plotModuleRegistry.get(type);
      const example = plotModule.examples[0];
      const dataset = parseDelimitedData(example.data);
      const settings = { ...defaultVisualizationSettings, setInputMode: "membership" as const, vennLayout: "auto" as const };
      const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type={type} dataset={dataset} mapping={example.mapping ?? plotModule.definition.defaultMapping} settings={settings} themeId={defaultVisualizationThemeId} />);
      expect(markup).toContain(`data-plot-family="${type === "venn" ? "venn-classic" : "upset"}"`);
      expect(markup).toContain("data-intersection-signature");
      if (type === "upset") expect(markup).toContain("data-plot-element=\"upset-set-summary\"");
      expect(markup).not.toMatch(/(?:NaN|Infinity|-Infinity|undefined)/);
    }
  });

  it("exposes only meaningful Venn and UpSet controls", () => {
    expect(plotModuleRegistry.get("venn").capabilities.settingKeys).toEqual(expect.arrayContaining(["setInputMode", "vennLayout", "vennProportional"]));
    expect(plotModuleRegistry.get("venn").capabilities.settingKeys).not.toContain("grid");
    expect(plotModuleRegistry.get("upset").capabilities.settingKeys).toEqual(expect.arrayContaining(["setInputMode", "upsetMaxIntersections"]));
    expect(plotModuleRegistry.get("upset").capabilities.settingKeys).not.toContain("xLabel");
  });
});
