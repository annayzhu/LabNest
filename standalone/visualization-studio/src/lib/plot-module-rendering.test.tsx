import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ScientificChartPreview } from "@/components/ScientificChartPreview";
import { analyzeExpressionMatrix } from "./visualization-pca";
import {
  defaultVisualizationSettings,
  defaultVisualizationThemeId,
  inferPlotMapping,
  parseDelimitedData,
  plotModuleRegistry,
  validatePlotDataset,
} from "./visualization-studio";

const expectedAdvancedRenderers = new Set([
  "line", "scatter", "correlation", "pca", "pcoa", "umap", "tsne", "nmds", "box", "violin", "beeswarm", "raincloud", "histogram", "density", "ridge", "ma", "quadrant", "errorbar", "area", "lollipop",
  "heatmap", "clustered-heatmap", "correlation-heatmap", "enrichment-bar", "gsea", "go-circle", "kegg-circle", "go-chord", "pathway-impact", "nes-fdr", "multi-gsea", "enrichment-ridge", "sankey-bubble", "geographic-map", "petal", "word-cloud", "km", "survival-forest", "roc", "venn",
  "funnel", "precision-recall", "calibration", "decision-curve", "nomogram", "lasso-path", "km-cutoff", "risk-score",
  "upset", "sankey", "alluvial", "chord", "ligand-receptor", "circos",
  "network", "ppi", "cerna", "mirna-target", "cnet", "enrichment-map", "tree", "dendrogram",
  "manhattan", "qq", "chromosome-ideogram", "snp-density", "genome-tracks", "waterfall", "oncoplot", "motif-logo",
  "pie", "donut", "rose", "waffle", "treemap", "sunburst", "radar", "polar-profile", "population-pyramid",
]);

describe("registered plot-module examples", () => {
  it("parses, maps, validates, and renders every bundled example with finite SVG geometry", () => {
    for (const plotModule of plotModuleRegistry.list()) {
      for (const example of plotModule.examples) {
        const analysis = plotModule.definition.id === "pca" && example.pcaInputMode === "matrix" ? analyzeExpressionMatrix(example.data, undefined, example.metadata ?? "") : null;
        const dataset = analysis?.dataset ?? parseDelimitedData(example.data);
        const inferredMapping = analysis ? plotModule.definition.defaultMapping : inferPlotMapping(plotModule.definition, dataset.headers);
        const selectedMapping = example.mapping ?? inferredMapping;
        const mappings = analysis || example.mapping === undefined ? [selectedMapping] : [selectedMapping, inferredMapping];

        for (const mapping of mappings) {
          const settings = { ...defaultVisualizationSettings, ...example.settings } as typeof defaultVisualizationSettings;
          const validation = validatePlotDataset(plotModule.definition, dataset, mapping, settings);
          expect(validation.errors, `${plotModule.definition.id} / ${example.label}`).toEqual([]);

          const markup = renderToStaticMarkup(
            <ScientificChartPreview
              svgRef={createRef<SVGSVGElement>()}
              type={plotModule.definition.id}
              dataset={dataset}
              mapping={mapping}
              settings={settings}
              themeId={defaultVisualizationThemeId}
            />,
          );

          const expectedRenderer = expectedAdvancedRenderers.has(plotModule.definition.id) ? "advanced" : "standard";
          expect(plotModule.renderer, plotModule.definition.id).toBe(expectedRenderer);
        expect(markup, `${plotModule.definition.id} / ${example.label}`).toContain("<svg");
        expect(markup, `${plotModule.definition.id} / ${example.label}`).toContain("<clipPath");
          expect(markup, `${plotModule.definition.id} / ${example.label}`).toContain(`data-plot-renderer="${expectedRenderer}"`);
          expect(markup, `${plotModule.definition.id} / ${example.label}`).not.toMatch(/(?:NaN|Infinity|-Infinity|undefined)/);
        }
      }
    }
  });

  it("renders every categorical bar variant with finite marks", () => {
    const plotModule = plotModuleRegistry.get("bar");
    const example = plotModule.examples[0];
    const dataset = parseDelimitedData(example.data);
    const variants = ["grouped", "stacked", "percentage", "horizontal", "bidirectional", "faceted", "polar", "bullet", "pyramid", "axis-break", "dual-axis", "overlay"] as const;
    for (const barVariant of variants) {
      const settings = { ...defaultVisualizationSettings, barVariant, showSignificance: true };
      const validation = validatePlotDataset(plotModule.definition, dataset, example.mapping ?? plotModule.definition.defaultMapping, settings);
      expect(validation.errors, barVariant).toEqual([]);
      const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="bar" dataset={dataset} mapping={example.mapping ?? plotModule.definition.defaultMapping} settings={settings} themeId={defaultVisualizationThemeId} />);
      expect(markup, barVariant).toContain("data-plot-element=\"bar\"");
      expect(markup, barVariant).not.toMatch(/(?:NaN|Infinity|-Infinity|undefined)/);
    }
  });

  it("renders line uncertainty and every association variant with finite geometry", () => {
    const lineModule = plotModuleRegistry.get("line");
    const lineExample = lineModule.examples[0];
    const lineData = parseDelimitedData(lineExample.data);
    for (const lineUncertaintyStyle of ["bars", "band"] as const) {
      const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="line" dataset={lineData} mapping={lineExample.mapping ?? lineModule.definition.defaultMapping} settings={{ ...defaultVisualizationSettings, lineErrorType: "ci95", lineUncertaintyStyle }} themeId={defaultVisualizationThemeId} />);
      expect(markup).toContain(`data-plot-element="line-uncertainty-${lineUncertaintyStyle === "band" ? "band" : "bar"}"`);
      expect(markup).not.toMatch(/(?:NaN|Infinity|-Infinity|undefined)/);
    }

    const scatterModule = plotModuleRegistry.get("scatter");
    const scatterExample = scatterModule.examples[1];
    const scatterData = parseDelimitedData(scatterExample.data);
    const mapping = scatterExample.mapping ?? scatterModule.definition.defaultMapping;
    for (const associationVariant of ["points", "marginal", "density", "hexbin", "ellipse", "hull", "pair-matrix", "3d", "ternary"] as const) {
      const settings = { ...defaultVisualizationSettings, associationVariant, associationFit: associationVariant === "points" ? "linear" as const : "none" as const, associationShowConfidenceBand: associationVariant === "points", associationShowPValue: associationVariant === "points", associationGroupMode: "combined" as const };
      const validation = validatePlotDataset(scatterModule.definition, scatterData, mapping, settings);
      expect(validation.errors, associationVariant).toEqual([]);
      const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="scatter" dataset={scatterData} mapping={mapping} settings={settings} themeId={defaultVisualizationThemeId} />);
      expect(markup, associationVariant).toContain("data-plot-data");
      if (associationVariant === "density" || associationVariant === "hexbin") {
        expect(markup, associationVariant).not.toContain(">Control</text>");
        expect(markup, associationVariant).not.toContain(">Treatment</text>");
      }
      expect(markup, associationVariant).not.toMatch(/(?:NaN|Infinity|-Infinity|undefined)/);
    }
  });

  it("renders ordination overlays, supplied statistics, scree, loadings, shapes, and 3D views", () => {
    const pcaModule = plotModuleRegistry.get("pca");
    const matrixExample = pcaModule.examples.find((example) => example.pcaInputMode === "matrix")!;
    const pca = analyzeExpressionMatrix(matrixExample.data, undefined, matrixExample.metadata ?? "");
    expect(pca.dataset.errors).toEqual([]);
    const pcaMapping = matrixExample.mapping ?? pcaModule.definition.defaultMapping;
    const scoreSettings = { ...defaultVisualizationSettings, ordinationShowEllipse: true, ordinationShowHull: true, ordinationShowCentroids: true, ordinationShowLoadings: true, ordinationUseShapes: true };
    expect(validatePlotDataset(pcaModule.definition, pca.dataset, pcaMapping, scoreSettings).errors).toEqual([]);
    const scoreMarkup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="pca" dataset={pca.dataset} mapping={pcaMapping} settings={scoreSettings} themeId={defaultVisualizationThemeId} />);
    for (const element of ["ordination-ellipse", "ordination-hull", "ordination-centroid", "ordination-loading", "ordination-point"]) expect(scoreMarkup).toContain(`data-plot-element="${element}"`);
    expect(scoreMarkup).toContain('data-plot-element="ordination-shape-legend"');
    expect(scoreMarkup).toMatch(/PC1 \([\d.]+%\)/);
    expect(scoreMarkup).not.toMatch(/(?:NaN|Infinity|-Infinity|undefined)/);
    const swappedMarkup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="pca" dataset={pca.dataset} mapping={pcaMapping} settings={{ ...defaultVisualizationSettings, swapAxes: true, ordinationShowLoadings: true }} themeId={defaultVisualizationThemeId} />);
    expect(swappedMarkup).toMatch(/PC2 \([\d.]+%\)/);
    expect(swappedMarkup).toContain('data-plot-element="ordination-loading"');

    const screeSettings = { ...defaultVisualizationSettings, ordinationView: "scree" as const };
    expect(validatePlotDataset(pcaModule.definition, pca.dataset, {}, screeSettings).errors).toEqual([]);
    const screeMarkup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="pca" dataset={pca.dataset} mapping={{}} settings={screeSettings} themeId={defaultVisualizationThemeId} />);
    expect(screeMarkup).toContain('data-plot-family="ordination-scree"');
    expect(screeMarkup).toContain('data-plot-element="scree-bar"');
    const pca3dSettings = { ...defaultVisualizationSettings, ordinationView: "3d" as const, ordinationShowCentroids: true };
    expect(validatePlotDataset(pcaModule.definition, pca.dataset, pcaMapping, pca3dSettings).errors).toEqual([]);
    const pca3dMarkup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="pca" dataset={pca.dataset} mapping={pcaMapping} settings={pca3dSettings} themeId={defaultVisualizationThemeId} />);
    expect(pca3dMarkup).toContain('data-plot-family="ordination-3d"');
    expect(pca3dMarkup).toContain('data-plot-element="ordination-shape-legend"');
    expect(pca3dMarkup).toContain("PC3 (");
    expect(pca3dMarkup).not.toMatch(/(?:NaN|Infinity|-Infinity|undefined)/);

    const pcoaModule = plotModuleRegistry.get("pcoa");
    const pcoaData = parseDelimitedData(pcoaModule.definition.sampleData);
    const suppliedSettings = { ...defaultVisualizationSettings, ordinationView: "3d" as const, ordinationShowCentroids: true, ordinationXVariance: 41.2, ordinationYVariance: 22.4, ordinationZVariance: 11.3, ordinationPermanovaR2: 0.183, ordinationPermanovaP: 0.004, ordinationPermanovaPermutations: 999, ordinationMethodNote: "Bray-Curtis; blocked permutations by cohort" };
    expect(validatePlotDataset(pcoaModule.definition, pcoaData, pcoaModule.definition.defaultMapping, suppliedSettings).errors).toEqual([]);
    const pcoaMarkup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="pcoa" dataset={pcoaData} mapping={pcoaModule.definition.defaultMapping} settings={suppliedSettings} themeId={defaultVisualizationThemeId} />);
    expect(pcoaMarkup).toContain('data-plot-family="ordination-3d"');
    expect(pcoaMarkup).toContain("PERMANOVA (supplied)");
    expect(pcoaMarkup).toContain("PCoA 3 (11.3%)");
    expect(pcoaMarkup).not.toMatch(/(?:NaN|Infinity|-Infinity|undefined)/);

    const swappedPcoaMarkup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="pcoa" dataset={pcoaData} mapping={{ ...pcoaModule.definition.defaultMapping, x: "dim2", y: "dim1" }} settings={{ ...defaultVisualizationSettings, ordinationXVariance: 41.2, ordinationYVariance: 22.4 }} themeId={defaultVisualizationThemeId} />);
    expect(swappedPcoaMarkup).toContain("PCoA 2 (22.4%)");
    expect(swappedPcoaMarkup).toContain("PCoA 1 (41.2%)");
    const explicitSuffixData = parseDelimitedData("cohort2024_axis1\tcohort2024_axis2\tgroup\tsample\n0\t1\tA\tLeftBoundaryLabel\n1\t0\tB\tRightBoundaryLabel");
    const suffixMarkup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="pcoa" dataset={explicitSuffixData} mapping={{ x: "cohort2024_axis1", y: "cohort2024_axis2", group: "group", label: "sample" }} settings={{ ...defaultVisualizationSettings, showLabels: true, ordinationXVariance: 60, ordinationYVariance: 40 }} themeId={defaultVisualizationThemeId} />);
    expect(suffixMarkup).toContain("PCoA 1 (60.0%)");
    expect(suffixMarkup).toContain("PCoA 2 (40.0%)");
    expect(suffixMarkup).not.toContain("PCoA 2024");
    expect(suffixMarkup).toContain('data-full-label="RightBoundaryLabel"');
    expect(suffixMarkup).toMatch(/data-plot-label[^>]*text-anchor="middle"[^>]*>.*RightBou…/);
  });

  it("blocks overflowing ordination legends and keeps hidden-legend colors distinct", () => {
    const pcoaModule = plotModuleRegistry.get("pcoa");
    const rows = Array.from({ length: 13 }, (_, index) => `${index}\t${index % 4}\t${index % 3}\tGroup ${index + 1}\tS${index + 1}`).join("\n");
    const dataset = parseDelimitedData(`dim1\tdim2\tdim3\tgroup\tsample\n${rows}`);
    const mapping = { ...pcoaModule.definition.defaultMapping, shape: "" };
    expect(validatePlotDataset(pcoaModule.definition, dataset, mapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/at most 12/);
    const hiddenLegendSettings = { ...defaultVisualizationSettings, legendPosition: "none" as const };
    expect(validatePlotDataset(pcoaModule.definition, dataset, mapping, hiddenLegendSettings).errors).toEqual([]);
    const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="pcoa" dataset={dataset} mapping={mapping} settings={hiddenLegendSettings} themeId={defaultVisualizationThemeId} />);
    const pointColors = [...markup.matchAll(/data-plot-element="ordination-point"[^>]*fill="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(pointColors).size).toBe(13);
  });

  it("keeps dense correlation summaries inside the reclaimed compact canvas", () => {
    const correlationModule = plotModuleRegistry.get("correlation");
    const example = correlationModule.examples[1];
    const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="correlation" dataset={parseDelimitedData(example.data)} mapping={example.mapping ?? correlationModule.definition.defaultMapping} settings={{ ...defaultVisualizationSettings, associationVariant: "density", associationGroupMode: "combined", associationShowPValue: true }} themeId={defaultVisualizationThemeId} />);
    const summaryX = Number(markup.match(/data-plot-element="association-summary"><text x="([^"]+)"/)?.[1]);
    expect(summaryX).toBeGreaterThanOrEqual(0);
    expect(summaryX).toBeLessThan(300);
    expect(markup).toContain("two-sided t p");
    expect(markup).not.toMatch(/(?:NaN|Infinity|-Infinity|undefined)/);
  });

  it("assigns distinct static colors to categorical annotation levels beyond the base palette", () => {
    const heatmapModule = plotModuleRegistry.get("heatmap");
    const dataset = parseDelimitedData(heatmapModule.examples[0].data);
    const columnIds = dataset.headers.slice(1);
    const annotation = ["id\tcohort[categorical]", ...columnIds.map((id, index) => `${id}\tLevel_${index + 1}`)].join("\n");
    const settings = { ...defaultVisualizationSettings, width: 520, height: 420, heatmapColumnAnnotationData: annotation };
    expect(validatePlotDataset(heatmapModule.definition, dataset, {}, settings).errors).toEqual([]);
    const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="heatmap" dataset={dataset} mapping={{}} settings={settings} themeId={defaultVisualizationThemeId} />);
    const swatchFills = [...markup.matchAll(/data-no-clip="true"[^>]*fill="([^"]+)"/gi)].map((match) => match[1]);
    expect(new Set(swatchFills).size).toBeGreaterThanOrEqual(Math.min(columnIds.length, 5));
  });

  it("calculates long-form bar summaries without requiring a precomputed error column", () => {
    const plotModule = plotModuleRegistry.get("bar");
    const example = plotModule.examples[1];
    const dataset = parseDelimitedData(example.data);
    const settings = { ...defaultVisualizationSettings, barInputMode: "long" as const, barErrorType: "sem" as const };
    const validation = validatePlotDataset(plotModule.definition, dataset, example.mapping ?? plotModule.definition.defaultMapping, settings);
    expect(validation.errors).toEqual([]);
    const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="bar" dataset={dataset} mapping={example.mapping ?? plotModule.definition.defaultMapping} settings={settings} themeId={defaultVisualizationThemeId} />);
    expect(markup).toContain("data-plot-element=\"error-bar\"");
  });

  it("keeps categorical domains finite for positive, negative, and mixed values", () => {
    const plotModule = plotModuleRegistry.get("bar");
    for (const values of [[2, 5, 8], [-2, -5, -8], [-4, 1, 7]]) {
      const dataset = parseDelimitedData(`category\tvalue\tgroup\nA\t${values[0]}\tG1\nB\t${values[1]}\tG2\nC\t${values[2]}\tG3`);
      const mapping = { category: "category", value: "value", group: "group", error: "", secondary: "", target: "", pValue: "", facet: "" };
      const settings = { ...defaultVisualizationSettings, barVariant: "bidirectional" as const };
      expect(validatePlotDataset(plotModule.definition, dataset, mapping, settings).errors).toEqual([]);
      const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="bar" dataset={dataset} mapping={mapping} settings={settings} themeId={defaultVisualizationThemeId} />);
      expect(markup.match(/data-plot-element="bar"/g)).toHaveLength(3);
      if (values.some((value) => value < 0)) expect(markup).toMatch(/data-value="-/);
      expect(markup).not.toMatch(/(?:NaN|Infinity|-Infinity|undefined)/);
    }
  });

  it("keeps threshold annotations inside automatic volcano domains", () => {
    const plotModule = plotModuleRegistry.get("volcano");
    const dataset = parseDelimitedData("gene\tlog2FC\tpadj\nA\t0.1\t0.8\nB\t-0.2\t0.6");
    const markup = renderToStaticMarkup(
      <ScientificChartPreview
        svgRef={createRef<SVGSVGElement>()}
        type="volcano"
        dataset={dataset}
        mapping={plotModule.definition.defaultMapping}
        settings={{ ...defaultVisualizationSettings, foldChangeThreshold: 5, pValueThreshold: 1e-10 }}
        themeId={defaultVisualizationThemeId}
      />,
    );
    const foldCoordinates = [...markup.matchAll(/data-plot-element="fold-change-threshold" x1="([\d.]+)"/g)].map((match) => Number(match[1]));
    const pCoordinate = Number(markup.match(/data-plot-element="p-value-threshold"[^>]* y1="([\d.]+)"/)?.[1]);
    expect(foldCoordinates).toHaveLength(2);
    expect(foldCoordinates.every((coordinate) => coordinate >= 60 && coordinate <= 218)).toBe(true);
    expect(pCoordinate).toBeGreaterThanOrEqual(20);
    expect(pCoordinate).toBeLessThanOrEqual(292);
  });

  it("keeps deep sunburst rings valid at the maximum hierarchy gap", () => {
    const rows = ["node\tparent\tvalue", "Root\t\t0"];
    for (let depth = 1; depth <= 12; depth += 1) rows.push(`Level ${depth}\t${depth === 1 ? "Root" : `Level ${depth - 1}`}\t${depth === 12 ? 5 : 0}`);
    const dataset = parseDelimitedData(rows.join("\n"));
    const mapping = { node: "node", parent: "parent", value: "value" };
    const settings = { ...defaultVisualizationSettings, hierarchyGap: 8 };
    expect(validatePlotDataset(plotModuleRegistry.get("sunburst").definition, dataset, mapping, settings).errors).toEqual([]);
    const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="sunburst" dataset={dataset} mapping={mapping} settings={settings} themeId={defaultVisualizationThemeId} />);
    const arcRadii = [...markup.matchAll(/A ([\d.]+) ([\d.]+)/g)].flatMap((match) => [Number(match[1]), Number(match[2])]);
    expect(arcRadii.length).toBeGreaterThan(0);
    expect(arcRadii.every((radius) => Number.isFinite(radius) && radius > 0)).toBe(true);
    expect(markup).not.toMatch(/(?:NaN|Infinity|-Infinity|undefined)/);
  });

  it("uses the compact treemap canvas and renders population percentages", () => {
    const treemapModule = plotModuleRegistry.get("treemap");
    const treemapExample = treemapModule.examples[0];
    const treemapMarkup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="treemap" dataset={parseDelimitedData(treemapExample.data)} mapping={treemapExample.mapping ?? treemapModule.definition.defaultMapping} settings={defaultVisualizationSettings} themeId={defaultVisualizationThemeId} />);
    const rootWidth = Number(treemapMarkup.match(/data-plot-element="treemap-node"[^>]* width="([\d.]+)"/)?.[1]);
    expect(rootWidth).toBeGreaterThan(200);

    const pyramidModule = plotModuleRegistry.get("population-pyramid");
    const pyramidExample = pyramidModule.examples[0];
    const pyramidMarkup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="population-pyramid" dataset={parseDelimitedData(pyramidExample.data)} mapping={pyramidExample.mapping ?? pyramidModule.definition.defaultMapping} settings={{ ...defaultVisualizationSettings, pyramidDisplayMode: "percent" }} themeId={defaultVisualizationThemeId} />);
    expect(pyramidMarkup).toContain("%");
    expect(pyramidMarkup).not.toMatch(/(?:NaN|Infinity|-Infinity|undefined)/);
  });

  it("composes deterministic distribution layers in both orientations", () => {
    const plotModule = plotModuleRegistry.get("raincloud");
    const example = plotModule.examples[1];
    const dataset = parseDelimitedData(example.data);
    const mapping = example.mapping ?? plotModule.definition.defaultMapping;
    for (const orientation of ["vertical", "horizontal"] as const) {
      const settings = { ...defaultVisualizationSettings, distributionOrientation: orientation, showDensity: true, showHistogram: true, showBox: true, showPoints: true, distributionSummary: "mean" as const, boxErrorType: "ci95" as const, distributionShowPairedLines: true, distributionShowSignificance: true, histogramBins: 6 };
      expect(validatePlotDataset(plotModule.definition, dataset, mapping, settings).errors).toEqual([]);
      const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="raincloud" dataset={dataset} mapping={mapping} settings={settings} themeId={defaultVisualizationThemeId} />);
      for (const element of ["density", "histogram-bin", "box-layer", "observation", "center-summary", "uncertainty", "paired-line", "facet-label"]) expect(markup).toContain(`data-plot-element="${element}"`);
      const densityScales = [...markup.matchAll(/data-density-scale-maximum="([^"]+)"/g)].map((match) => match[1]);
      const histogramScales = [...markup.matchAll(/data-bin-scale-maximum="([^"]+)"/g)].map((match) => match[1]);
      expect(new Set(densityScales).size).toBe(1);
      expect(new Set(histogramScales).size).toBe(1);
      expect(markup).toMatch(/data-bin-count="[2-9]/);
      expect(markup).toContain("p=0.03");
      expect(markup).not.toMatch(/(?:NaN|Infinity|-Infinity|undefined)/);
    }
  });

  it("does not render pseudo-uncertainty for a one-observation distribution lane", () => {
    const dataset = parseDelimitedData("group\tvalue\nA\t1\nB\t2\nB\t3");
    const settings = { ...defaultVisualizationSettings, showDensity: false, showPoints: true, boxErrorType: "ci95" as const };
    const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="density" dataset={dataset} mapping={{ group: "group", value: "value", subject: "", facet: "", pValue: "" }} settings={settings} themeId={defaultVisualizationThemeId} />);
    expect((markup.match(/data-plot-element="uncertainty"/g) ?? [])).toHaveLength(1);
  });

  it("exports collision-free beeswarm coordinates in both orientations", () => {
    const dataset = parseDelimitedData("group\tvalue\nA\t5\nA\t5\nA\t5\nA\t5\nA\t5.02\nA\t5.04\nA\t5.06\nA\t5.08");
    for (const orientation of ["vertical", "horizontal"] as const) {
      const settings = { ...defaultVisualizationSettings, distributionOrientation: orientation, showDensity: false, showHistogram: false, showBox: false, showPoints: true, distributionSummary: "none" as const, boxErrorType: "none" as const };
      const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="beeswarm" dataset={dataset} mapping={{ group: "group", value: "value", subject: "", facet: "", pValue: "" }} settings={settings} themeId={defaultVisualizationThemeId} />);
      const points = [...markup.matchAll(/<circle[^>]*data-plot-element="observation"[^>]*cx="([^"]+)"[^>]*cy="([^"]+)"[^>]*r="([^"]+)"/g)].map((match) => ({ x: Number(match[1]), y: Number(match[2]), radius: Number(match[3]) }));
      expect(points).toHaveLength(8);
      for (let left = 0; left < points.length; left += 1) {
        for (let right = left + 1; right < points.length; right += 1) {
          expect(Math.hypot(points[left].x - points[right].x, points[left].y - points[right].y)).toBeGreaterThanOrEqual(points[left].radius + points[right].radius + 0.79);
        }
      }
      expect(markup).not.toMatch(/(?:NaN|Infinity|-Infinity|undefined)/);
    }
  });

  it("scales dense narrow-lane beeswarms without dropping or overlapping observations", () => {
    const rows = ["group\tvalue", ...Array.from({ length: 4 }, (_, groupIndex) => Array.from({ length: 64 }, () => `G${groupIndex + 1}\t5`)).flat()];
    const dataset = parseDelimitedData(rows.join("\n"));
    for (const orientation of ["vertical", "horizontal"] as const) {
      const settings = { ...defaultVisualizationSettings, width: 300, height: 300, distributionOrientation: orientation, showDensity: false, showHistogram: false, showBox: false, showPoints: true, distributionSummary: "none" as const, boxErrorType: "none" as const };
      const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="beeswarm" dataset={dataset} mapping={{ group: "group", value: "value", subject: "", facet: "", pValue: "" }} settings={settings} themeId={defaultVisualizationThemeId} />);
      const points = [...markup.matchAll(/<circle[^>]*data-plot-element="observation"[^>]*cx="([^"]+)"[^>]*cy="([^"]+)"[^>]*r="([^"]+)"/g)].map((match) => ({ x: Number(match[1]), y: Number(match[2]), radius: Number(match[3]) }));
      expect(points).toHaveLength(256);
      expect(markup).toContain("data-beeswarm-scaled=\"true\"");
      for (let left = 0; left < points.length; left += 1) {
        for (let right = left + 1; right < points.length; right += 1) {
          expect(Math.hypot(points[left].x - points[right].x, points[left].y - points[right].y)).toBeGreaterThanOrEqual(points[left].radius + points[right].radius - 1e-6);
        }
      }
    }
  });

  it("keeps sparse observations inside their lanes when many groups compress the band", () => {
    const rows = ["group\tvalue", ...Array.from({ length: 64 }, (_, groupIndex) => [`G${groupIndex + 1}\t5`, `G${groupIndex + 1}\t5`]).flat()];
    const dataset = parseDelimitedData(rows.join("\n"));
    for (const orientation of ["vertical", "horizontal"] as const) {
      const settings = { ...defaultVisualizationSettings, width: 300, height: 300, distributionOrientation: orientation, showDensity: false, showHistogram: false, showBox: false, showPoints: true, distributionSummary: "none" as const, boxErrorType: "none" as const };
      const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="beeswarm" dataset={dataset} mapping={{ group: "group", value: "value", subject: "", facet: "", pValue: "" }} settings={settings} themeId={defaultVisualizationThemeId} />);
      const points = [...markup.matchAll(/<circle[^>]*data-plot-element="observation"[^>]*cx="([^"]+)"[^>]*cy="([^"]+)"[^>]*r="([^"]+)"/g)].map((match) => ({ x: Number(match[1]), y: Number(match[2]), radius: Number(match[3]) }));
      expect(points).toHaveLength(128);
      for (let left = 0; left < points.length; left += 1) {
        for (let right = left + 1; right < points.length; right += 1) {
          expect(Math.hypot(points[left].x - points[right].x, points[left].y - points[right].y)).toBeGreaterThanOrEqual(points[left].radius + points[right].radius - 1e-6);
        }
      }
    }
  });

  it("renders aligned annotations, deterministic cuts, dendrograms, and a coordinated heatmap summary", () => {
    const heatmapModule = plotModuleRegistry.get("clustered-heatmap");
    const dataset = parseDelimitedData(heatmapModule.examples[0].data);
    const settings = {
      ...defaultVisualizationSettings,
      width: 520,
      height: 420,
      heatmapRowAnnotationData: "id\tmodule\nTP53\tDamage\nCDKN1A\tDamage\nEGFR\tRTK",
      heatmapColumnAnnotationData: "id\tgroup\tbatch\nControl_1\tControl\t1\nTreatment_1\tTreatment\t2",
      heatmapShowSidePlot: true,
      heatmapShowValues: true,
    };
    const validation = validatePlotDataset(heatmapModule.definition, dataset, {}, settings);
    expect(validation.errors).toEqual([]);
    expect(validation.warnings.join(" ")).toMatch(/missing from the annotation table/);
    const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="clustered-heatmap" dataset={dataset} mapping={{}} settings={settings} themeId={defaultVisualizationThemeId} />);
    expect(markup).toContain('data-plot-family="rectangular-heatmap"');
    expect(markup).toContain('data-annotation-target="row"');
    expect(markup).toContain('data-annotation-target="column"');
    expect(markup).toContain('data-cluster-cut="row"');
    expect(markup).toContain('data-cluster-cut="column"');
    expect(markup).toContain('data-plot-element="heatmap-side-plot"');
    expect(markup).toContain('data-plot-element="heatmap-color-legend"');
    expect(markup).toContain('data-plot-element="heatmap-annotation-legend"');
    expect(markup).toContain("Rows");
    expect(markup).toContain("Columns");
    const rawSummaryValues = [...markup.matchAll(/<title>mean: ([^<]+)<\/title>/g)].map((match) => Number(match[1]));
    expect(rawSummaryValues.some((value) => Math.abs(value) > 1)).toBe(true);
    expect(markup).not.toMatch(/(?:NaN|Infinity|-Infinity|undefined)/);
  });

  it("renders triangular correlation and circular heatmap views with finite geometry", () => {
    const correlationModule = plotModuleRegistry.get("correlation-heatmap");
    const correlationDataset = parseDelimitedData(correlationModule.examples[0].data);
    const triangular = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="correlation-heatmap" dataset={correlationDataset} mapping={{}} settings={{ ...defaultVisualizationSettings, width: 520, height: 420, heatmapTriangle: "lower" }} themeId={defaultVisualizationThemeId} />);
    const variableCount = correlationDataset.headers.length - 1;
    expect((triangular.match(/data-plot-element="heatmap-cell"/g) ?? [])).toHaveLength(variableCount * (variableCount + 1) / 2);

    const heatmapModule = plotModuleRegistry.get("heatmap");
    const heatmapDataset = parseDelimitedData(heatmapModule.examples[0].data);
    const circular = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="heatmap" dataset={heatmapDataset} mapping={{}} settings={{ ...defaultVisualizationSettings, width: 420, height: 420, heatmapDisplay: "circular", heatmapScale: "none", heatmapColorMode: "sequential" }} themeId={defaultVisualizationThemeId} />);
    expect(circular).toContain('data-plot-family="circular-heatmap"');
    expect(circular).toContain('data-plot-element="heatmap-cell"');
    expect(circular).not.toMatch(/(?:NaN|Infinity|-Infinity|undefined)/);
  });

  it("renders all genomic, alteration, and motif modules with their defining marks", () => {
    const expectations: Array<{ id: "manhattan" | "qq" | "chromosome-ideogram" | "snp-density" | "genome-tracks" | "waterfall" | "oncoplot" | "motif-logo"; element: string }> = [
      { id: "manhattan", element: "manhattan-point" },
      { id: "qq", element: "qq-point" },
      { id: "chromosome-ideogram", element: "cytoband" },
      { id: "snp-density", element: "snp-density-bin" },
      { id: "genome-tracks", element: "genome-track-interval" },
      { id: "waterfall", element: "waterfall-segment" },
      { id: "oncoplot", element: "oncoplot-cell" },
      { id: "motif-logo", element: "motif-letter" },
    ];
    expectations.forEach(({ id, element }) => {
      const plotModule = plotModuleRegistry.get(id);
      const dataset = parseDelimitedData(plotModule.definition.sampleData);
      const mapping = plotModule.definition.defaultMapping;
      expect(validatePlotDataset(plotModule.definition, dataset, mapping, defaultVisualizationSettings).errors, id).toEqual([]);
      const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type={id} dataset={dataset} mapping={mapping} settings={defaultVisualizationSettings} themeId={defaultVisualizationThemeId} />);
      expect(markup, id).toContain(`data-plot-family="${id}"`);
      expect(markup, id).toContain(`data-plot-element="${element}"`);
      expect(markup, id).not.toMatch(/(?:NaN|Infinity|-Infinity|undefined)/);
      if (id === "manhattan" || id === "qq" || id === "chromosome-ideogram" || id === "snp-density" || id === "genome-tracks") {
        expect((markup.match(new RegExp(`data-plot-element="${element}"`, "g")) ?? [])).toHaveLength(dataset.rows.length);
      }
    });
  });

  it("switches motif logos between information-content and probability scales", () => {
    const plotModule = plotModuleRegistry.get("motif-logo");
    const dataset = parseDelimitedData(plotModule.definition.sampleData);
    const render = (motifDisplayMode: "information" | "probability") => renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="motif-logo" dataset={dataset} mapping={plotModule.definition.defaultMapping} settings={{ ...defaultVisualizationSettings, motifDisplayMode }} themeId={defaultVisualizationThemeId} />);
    const information = render("information");
    const probability = render("probability");
    expect(information).toContain("Information (bits)");
    expect(probability).toContain("Probability");
    expect(information.match(/data-letter-height="([^"]+)"/)?.[1]).not.toBe(probability.match(/data-letter-height="([^"]+)"/)?.[1]);
  });

  it("merges equivalent chromosome spellings into one rendered lane", () => {
    const cases = [
      { id: "chromosome-ideogram" as const, data: "chromosome\tstart\tend\tstain\tband\nchr1\t0\t10\tgneg\tp1\n1\t10\t20\tgpos50\tq1", element: "cytoband" },
      { id: "snp-density" as const, data: "chromosome\tstart\tend\tvariant_count\nchr1\t0\t10\t2\n1\t10\t20\t4", element: "snp-density-bin" },
    ];
    cases.forEach(({ id, data, element }) => {
      const plotModule = plotModuleRegistry.get(id);
      const dataset = parseDelimitedData(data);
      const validation = validatePlotDataset(plotModule.definition, dataset, plotModule.definition.defaultMapping, defaultVisualizationSettings);
      expect(validation.errors, id).toEqual([]);
      expect(validation.warnings.join(" "), id).toMatch(/merged for natural ordering/i);
      const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type={id} dataset={dataset} mapping={plotModule.definition.defaultMapping} settings={defaultVisualizationSettings} themeId={defaultVisualizationThemeId} />);
      expect((markup.match(new RegExp(`data-plot-element="${element}"`, "g")) ?? [])).toHaveLength(2);
      expect((markup.match(/data-full-label="1"/g) ?? [])).toHaveLength(1);
    });
  });

  it("honors genomic grid and axis controls and thins dense motif position labels", () => {
    const waterfall = plotModuleRegistry.get("waterfall");
    const waterfallData = parseDelimitedData(waterfall.definition.sampleData);
    const hiddenGrid = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="waterfall" dataset={waterfallData} mapping={waterfall.definition.defaultMapping} settings={{ ...defaultVisualizationSettings, grid: "none" }} themeId={defaultVisualizationThemeId} />);
    expect(hiddenGrid).not.toContain("data-grid-axis=");
    const bothGrid = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="waterfall" dataset={waterfallData} mapping={waterfall.definition.defaultMapping} settings={{ ...defaultVisualizationSettings, grid: "both" }} themeId={defaultVisualizationThemeId} />);
    expect(bothGrid).toContain('data-grid-axis="x"');

    const ideogram = plotModuleRegistry.get("chromosome-ideogram");
    const ideogramMarkup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="chromosome-ideogram" dataset={parseDelimitedData(ideogram.definition.sampleData)} mapping={ideogram.definition.defaultMapping} settings={{ ...defaultVisualizationSettings, axisLineWidth: 2.3 }} themeId={defaultVisualizationThemeId} />);
    expect(ideogramMarkup).toMatch(/rx="[^"]+" fill="#F4F1EC" stroke="#23242A" stroke-width="2.3"/);

    const motifRows = ["position\tA\tC\tG\tT", ...Array.from({ length: 60 }, (_, index) => `${index + 1}\t0.4\t0.3\t0.2\t0.1`)].join("\n");
    const motif = plotModuleRegistry.get("motif-logo");
    const motifData = parseDelimitedData(motifRows);
    const motifSettings = { ...defaultVisualizationSettings, width: 520 };
    expect(validatePlotDataset(motif.definition, motifData, motif.definition.defaultMapping, motifSettings).errors).toEqual([]);
    const motifMarkup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="motif-logo" dataset={motifData} mapping={motif.definition.defaultMapping} settings={motifSettings} themeId={defaultVisualizationThemeId} />);
    const positionLabels = motifMarkup.match(/data-plot-element="motif-position-label"/g) ?? [];
    expect(positionLabels.length).toBeGreaterThan(1);
    expect(positionLabels.length).toBeLessThan(60);
  });

  it("keeps cumulative-axis labels compact and renders a numeric genome-track legend only when values are mapped", () => {
    const trackModule = plotModuleRegistry.get("genome-tracks");
    const trackData = parseDelimitedData([
      "chromosome\tstart\tend\tvalue\ttrack\tfeature",
      "VeryLongReferenceContigIdentifier_000001\t0\t100\t1.25\tAccessibility\tPeak_A",
      "VeryLongReferenceContigIdentifier_000002\t0\t120\t3.75\tAccessibility\tPeak_B",
      "chr23\t0\t80\t2.50\tAccessibility\tPeak_C",
    ].join("\n"));
    const withValues = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="genome-tracks" dataset={trackData} mapping={trackModule.definition.defaultMapping} settings={defaultVisualizationSettings} themeId={defaultVisualizationThemeId} />);
    expect(withValues).toContain('data-plot-element="genome-track-color-legend"');
    expect(withValues).toContain('data-plot-element="genome-axis-label"');
    expect(withValues).toContain('data-full-label="VERYLONGREFERENCECONTIGIDENTIFIER_000001"');
    expect(withValues).toContain("Track value from");

    const withoutValues = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="genome-tracks" dataset={trackData} mapping={{ ...trackModule.definition.defaultMapping, value: "" }} settings={defaultVisualizationSettings} themeId={defaultVisualizationThemeId} />);
    expect(withoutValues).not.toContain('data-plot-element="genome-track-color-legend"');
  });

  it("renders typed network semantics, isolated nodes, and deterministic seeded layouts", () => {
    const relationshipTypes = ["network", "ppi", "cerna", "mirna-target", "cnet", "enrichment-map"] as const;
    relationshipTypes.forEach((id) => {
      const plotModule = plotModuleRegistry.get(id);
      const dataset = parseDelimitedData(plotModule.definition.sampleData);
      const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type={id} dataset={dataset} mapping={plotModule.definition.defaultMapping} settings={{ ...defaultVisualizationSettings, showLabels: true }} themeId={defaultVisualizationThemeId} />);
      expect(markup, id).toContain(`data-plot-family="${id}"`);
      expect(markup, id).toContain('data-plot-element="network-node"');
      expect(markup, id).toContain('data-plot-element="network-edge"');
      expect(markup, id).toContain("data-direction=");
      expect(markup, id).toContain("data-sign=");
      expect(markup, id).toContain("data-edge-type=");
      expect(markup, id).toContain("data-edge-group=");
      expect(markup, id).toContain("Radius:");
      expect(markup, id).toContain("Width:");
      if (id === "cnet") expect(markup).toContain("Node value: 3e-4–2.4");
      expect(markup, id).not.toMatch(/(?:NaN|Infinity|-Infinity|undefined)/);
    });
    const ppi = plotModuleRegistry.get("ppi");
    const ppiData = parseDelimitedData(ppi.definition.sampleData);
    const withIsolate = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="ppi" dataset={ppiData} mapping={ppi.definition.defaultMapping} settings={{ ...defaultVisualizationSettings, networkShowIsolates: true }} themeId={defaultVisualizationThemeId} />);
    const withoutIsolate = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="ppi" dataset={ppiData} mapping={ppi.definition.defaultMapping} settings={{ ...defaultVisualizationSettings, networkShowIsolates: false }} themeId={defaultVisualizationThemeId} />);
    expect(withIsolate).toContain('data-node-id="Isolated_candidate"');
    expect(withoutIsolate).not.toContain('data-node-id="Isolated_candidate"');

    const general = plotModuleRegistry.get("network");
    const generalData = parseDelimitedData(general.definition.sampleData);
    const seeded = (networkSeed: number) => renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="network" dataset={generalData} mapping={general.definition.defaultMapping} settings={{ ...defaultVisualizationSettings, networkSeed }} themeId={defaultVisualizationThemeId} />);
    expect(seeded(42)).toBe(seeded(42));
    expect(seeded(42)).not.toBe(seeded(43));

    const loopAndParallelData = parseDelimitedData([
      "record_type\tnode\tsource\ttarget\tweight\tdirection\tsign\tedge_type\tgroup\tnode_type\tnode_value",
      "node\tA\t\t\t\t\t\t\tG\tCell\t1",
      "node\tB\t\t\t\t\t\t\tG\tCell\t2",
      "edge\t\tA\tA\t0.5\tundirected\tpositive\tself\tEvidence_A\t\t",
      "edge\t\tA\tB\t0.7\tdirected\tpositive\tpathway\tEvidence_B\t\t",
      "edge\t\tB\tA\t0.9\tbidirectional\tnegative\tphysical\tEvidence_C\t\t",
    ].join("\n"));
    const loopAndParallel = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="network" dataset={loopAndParallelData} mapping={general.definition.defaultMapping} settings={defaultVisualizationSettings} themeId={defaultVisualizationThemeId} />);
    const edgePaths = [...loopAndParallel.matchAll(/data-plot-element="network-edge"[^>]*><path d="([^"]+)"/g)].map((match) => match[1]);
    expect(edgePaths).toHaveLength(3);
    expect(new Set(edgePaths).size).toBe(3);
    expect(loopAndParallel).toContain('data-edge-group="Evidence_A"');
    expect(loopAndParallel).toContain('markerUnits="userSpaceOnUse"');
    expect(loopAndParallel).toMatch(/data-direction-kind="undirected"[^>]*>[\s\S]*?<path[^>]*visibility="hidden"/);
    expect(loopAndParallel).toMatch(/data-direction-kind="directed"[^>]*>[\s\S]*?<path(?![^>]*visibility="hidden")/);
    expect(loopAndParallel).toMatch(/data-direction-kind="bidirectional"[^>]*>[\s\S]*?<path[^>]*>[\s\S]*?<path/);
  });

  it("renders trees and dendrograms as hierarchy-preserving branches", () => {
    for (const id of ["tree", "dendrogram"] as const) {
      const plotModule = plotModuleRegistry.get(id);
      const dataset = parseDelimitedData(plotModule.definition.sampleData);
      const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type={id} dataset={dataset} mapping={plotModule.definition.defaultMapping} settings={{ ...defaultVisualizationSettings, showLabels: true }} themeId={defaultVisualizationThemeId} />);
      expect(markup).toContain(`data-plot-family="${id}"`);
      expect(markup).toContain(`data-plot-element="${id}-branch"`);
      expect(markup).toContain(`data-plot-element="${id}-node"`);
      expect(markup).toContain(`data-plot-element="${id}-label"`);
      if (id === "dendrogram") expect(markup).toContain("Merge height:");
      expect(markup).not.toMatch(/(?:NaN|Infinity|-Infinity|undefined)/);
    }
    const dendrogram = plotModuleRegistry.get("dendrogram");
    const fractional = parseDelimitedData("node\tparent\tlabel\tgroup\theight\nRoot\t\tRoot\tInternal\t0.2\nLeft\tRoot\tLeft\tG\t0\nRight\tRoot\tRight\tG\t0");
    const fractionalMarkup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="dendrogram" dataset={fractional} mapping={dendrogram.definition.defaultMapping} settings={defaultVisualizationSettings} themeId={defaultVisualizationThemeId} />);
    expect(fractionalMarkup).toContain("Merge height: 0.2");
    expect(fractionalMarkup).not.toContain("Merge height: 1<");
  });
});
