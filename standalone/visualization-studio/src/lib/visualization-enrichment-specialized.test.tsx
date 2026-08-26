import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ScientificChartPreview } from "@/components/ScientificChartPreview";
import { defaultVisualizationSettings, defaultVisualizationThemeId, getPlotDefinition, getPlotModule, inferPlotMapping, parseDelimitedData, validatePlotDataset, type PlotType } from "./visualization-studio";

const enrichmentTypes: PlotType[] = ["enrichment", "enrichment-bar", "go-circle", "kegg-circle", "go-chord", "pathway-impact", "nes-fdr", "multi-gsea", "enrichment-ridge", "sankey-bubble"];

describe("specialized enrichment contracts", () => {
  it("ships explicit precomputed background, ratio, and FDR roles where applicable", () => {
    enrichmentTypes.forEach((type) => {
      const definition = getPlotDefinition(type);
      const keys = new Set(definition.roles.map((role) => role.key));
      expect(keys.has("background"), type).toBe(true);
      expect(keys.has("pValue"), type).toBe(true);
      if (type !== "multi-gsea") expect(keys.has("ratio"), type).toBe(true);
      expect(definition.inputHint).toMatch(/precomputed|upstream/i);
      expect(getPlotModule(type).guidance.references.length).toBeGreaterThan(0);
    });
  });

  it("provides dense representative multi-GSEA ranks and hit positions", () => {
    const definition = getPlotDefinition("multi-gsea"); const dataset = parseDelimitedData(definition.sampleData); const mapping = inferPlotMapping(definition, dataset.headers);
    const sets = [...new Set(dataset.rows.map((row) => row[mapping.group]))];
    expect(sets).toHaveLength(3);
    sets.forEach((set) => {
      const rows = dataset.rows.filter((row) => row[mapping.group] === set);
      expect(rows.length).toBeGreaterThanOrEqual(60);
      expect(rows.filter((row) => row[mapping.hit] === "1").length).toBeGreaterThanOrEqual(8);
    });
    expect(validatePlotDataset(definition, dataset, mapping, defaultVisualizationSettings).errors).toEqual([]);
  });

  it("blocks invalid enrichment denominators, ratios, and FDR values", () => {
    const definition = getPlotDefinition("go-circle");
    const dataset = parseDelimitedData("term\tgeneRatio\tcount\tFDR\tontology\tbackground\nA\t1.2\t3\t0\tBP\t10.5\nB\t0.2\t2\t0.1\tCC\t100");
    const mapping = inferPlotMapping(definition, dataset.headers); const errors = validatePlotDataset(definition, dataset, mapping, defaultVisualizationSettings).errors.join(" ");
    expect(errors).toMatch(/FDR must be in/);
    expect(errors).toMatch(/Gene ratio must be/);
    expect(errors).toMatch(/background size must be a strictly positive integer/);
  });

  it("keeps specialized decorative views explicit about quantitative limits", () => {
    (["go-circle", "go-chord", "sankey-bubble", "geographic-map", "petal", "word-cloud"] as PlotType[]).forEach((type) => {
      const definition = getPlotDefinition(type); const dataset = parseDelimitedData(definition.sampleData); const mapping = inferPlotMapping(definition, dataset.headers); const validation = validatePlotDataset(definition, dataset, mapping, defaultVisualizationSettings);
      expect(validation.errors, type).toEqual([]);
      expect(validation.warnings.join(" "), type).toMatch(/decorative|approximate|distort|quantitative meaning|layout choices|do not encode/i);
    });
  });

  it("rejects impossible coordinates and duplicate cloud terms", () => {
    const map = getPlotDefinition("geographic-map"); const mapData = parseDelimitedData("site\tlatitude\tlongitude\tvalue\nX\t91\t181\t2");
    expect(validatePlotDataset(map, mapData, inferPlotMapping(map, mapData.headers), defaultVisualizationSettings).errors.join(" ")).toMatch(/latitude \[-90, 90\]/);
    const cloud = getPlotDefinition("word-cloud"); const cloudData = parseDelimitedData("term\tweight\nA\t2\nA\t3\nB\t1");
    expect(validatePlotDataset(cloud, cloudData, inferPlotMapping(cloud, cloudData.headers), defaultVisualizationSettings).errors).toContain("Word-cloud terms must be unique; aggregate duplicate labels upstream.");
  });

  it("renders GO ontology sectors and an explicit FDR scale", () => {
    const definition = getPlotDefinition("go-circle"); const dataset = parseDelimitedData(definition.sampleData); const mapping = inferPlotMapping(definition, dataset.headers);
    const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="go-circle" dataset={dataset} mapping={mapping} settings={defaultVisualizationSettings} themeId={defaultVisualizationThemeId} />);
    expect(markup.match(/data-plot-element="enrichment-group-sector"/g)).toHaveLength(3);
    expect(markup).toContain("data-plot-element=\"enrichment-group-legend\"");
    expect(markup).toContain("data-plot-element=\"fdr-scale\"");
    expect(markup).toContain("−log₁₀(FDR)");
  });

  it("encodes GO chord sign and absolute effect without a signed-domain width artifact", () => {
    const definition = getPlotDefinition("go-chord");
    const dataset = parseDelimitedData("term\tgene\teffect\tgeneRatio\tcount\tFDR\tontology\tbackground\nT\tGneg\t-10\t3/20\t3\t0.01\tBP\t100\nT\tGzero\t0\t3/20\t3\t0.01\tBP\t100\nT\tGpos\t2\t3/20\t3\t0.01\tBP\t100");
    const mapping = inferPlotMapping(definition, dataset.headers); const settings = { ...defaultVisualizationSettings, dataLineWidth: 4 };
    expect(validatePlotDataset(definition, dataset, mapping, settings).errors).toEqual([]);
    const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="go-chord" dataset={dataset} mapping={mapping} settings={settings} themeId={defaultVisualizationThemeId} />);
    expect(markup).toMatch(/data-effect="-10"[^>]+stroke-width="8"[^>]+stroke-dasharray="4 3"/);
    expect(markup).toMatch(/data-effect="0"[^>]+data-effect-magnitude="0"[^>]+stroke-width="2.8"/);
    expect(markup).toContain("width: |effect| 0–10");
  });

  it("blocks duplicate identities and internally contradictory enrichment summaries", () => {
    const circle = getPlotDefinition("go-circle");
    const duplicated = parseDelimitedData("term\tgeneRatio\tcount\tFDR\tontology\tbackground\nA\t2/100\t3\t0.1\tBP\t100\nA\t0\t2\t0.1\tBP\t1");
    const errors = validatePlotDataset(circle, duplicated, inferPlotMapping(circle, duplicated.headers), defaultVisualizationSettings).errors.join(" ");
    expect(errors).toMatch(/unique term rows/);
    expect(errors).toMatch(/fraction numerator 2 but hit count 3/);
    expect(errors).toMatch(/positive hit count but zero gene ratio/);
    expect(errors).toMatch(/hit count 2 greater than tested background 1/);

    const ridge = getPlotDefinition("enrichment-ridge");
    const ridgeData = parseDelimitedData("term\tgene\tscore\tFDR\tgeneRatio\tbackground\nT\tG1\t1\t0.1\t0.2\t100\nT\tG1\t2\t0.1\t0.2\t100\nT\tG2\t3\t0.1\t0.2\t100\nT\tG3\t4\t0.1\t0.2\t100\nT\tG4\t5\t0.1\t0.2\t100");
    expect(validatePlotDataset(ridge, ridgeData, inferPlotMapping(ridge, ridgeData.headers), defaultVisualizationSettings).errors.join(" ")).toMatch(/unique term–gene rows/);
  });

  it("uses background-bounded integer ranks and pixel-aware compact density checks", () => {
    const multi = getPlotDefinition("multi-gsea");
    const base = parseDelimitedData(multi.sampleData); const mapping = inferPlotMapping(multi, base.headers);
    base.rows[0][mapping.rank] = "1.5";
    expect(validatePlotDataset(multi, base, mapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/non-negative integers/);

    const ribbon = getPlotDefinition("sankey-bubble");
    const rows = Array.from({ length: 12 }, (_, index) => `S\tT${index}\t0.2\t2\t0.01\t100`).join("\n");
    const dense = parseDelimitedData(`source\tterm\tgeneRatio\tcount\tFDR\tbackground\n${rows}`);
    expect(validatePlotDataset(ribbon, dense, inferPlotMapping(ribbon, dense.headers), defaultVisualizationSettings).errors.join(" ")).toMatch(/bubble\/label budget/);
  });

  it("requires a complete common Multi-GSEA rank scale and canonicalizes equivalent constants", () => {
    const multi = getPlotDefinition("multi-gsea"); const data = parseDelimitedData(multi.sampleData); const mapping = inferPlotMapping(multi, data.headers);
    data.rows.find((row) => row[mapping.group] === "DNA repair")![mapping.background] = "17000";
    const multiErrors = validatePlotDataset(multi, data, mapping, defaultVisualizationSettings).errors.join(" ");
    expect(multiErrors).toMatch(/one common ranked background/);
    expect(multiErrors).toMatch(/cover the common ranked list/);

    const chord = getPlotDefinition("go-chord");
    const chordData = parseDelimitedData("term\tgene\teffect\tgeneRatio\tcount\tFDR\tontology\tbackground\nT\tG1\t1\t3/20\t3\t0.10\tbp\t100\nT\tG2\t-1\t0.15\t3.0\t0.1\tBP\t100.0");
    expect(validatePlotDataset(chord, chordData, inferPlotMapping(chord, chordData.headers), defaultVisualizationSettings).errors).toEqual([]);
  });

  it("blocks overlapping geographic marks and unplaceable labels", () => {
    const definition = getPlotDefinition("geographic-map");
    const dataset = parseDelimitedData("site\tlatitude\tlongitude\tvalue\tgroup\nA very long site name\t30\t120\t10\tA\nA neighboring long site name\t30\t120\t9\tB\nA third neighboring site name\t30\t120\t8\tA\nA fourth neighboring site name\t30\t120\t7\tB\nA fifth neighboring site name\t30\t120\t6\tA");
    const errors = validatePlotDataset(definition, dataset, inferPlotMapping(definition, dataset.headers), { ...defaultVisualizationSettings, showLabels: true }).errors.join(" ");
    expect(errors).toMatch(/overlapping point pair/);
    expect(errors).toMatch(/cannot place .* site label/);
  });

  it("keeps decorative group mappings honest and renders zero-value petals without an extension", () => {
    for (const type of ["petal", "word-cloud"] as PlotType[]) {
      const definition = getPlotDefinition(type);
      expect(definition.roles.map((role) => role.key)).not.toContain("group");
      expect(definition.defaultMapping.group).toBeUndefined();
    }
    const definition = getPlotDefinition("petal");
    const dataset = parseDelimitedData("category\tvalue\nZero\t0\nMedium\t5\nHigh\t10");
    const mapping = inferPlotMapping(definition, dataset.headers);
    expect(validatePlotDataset(definition, dataset, mapping, defaultVisualizationSettings).errors).toEqual([]);
    const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="petal" dataset={dataset} mapping={mapping} settings={defaultVisualizationSettings} themeId={defaultVisualizationThemeId} />);
    expect(markup).toContain('data-petal-extension="0"');
    expect(markup).toMatch(/data-petal-extension="[1-9][^"]*"/);
  });

  it("blocks pathway-impact point and label collisions using renderer-shared geometry", () => {
    const definition = getPlotDefinition("pathway-impact");
    const dataset = parseDelimitedData("term\timpact\tcount\tgeneRatio\tFDR\tgroup\tbackground\nLong pathway alpha\t0.5\t10\t0.1\t0.01\tA\t100\nLong pathway beta\t0.5\t9\t0.09\t0.01\tA\t100\nLong pathway gamma\t0.5\t8\t0.08\t0.01\tA\t100");
    const mapping = inferPlotMapping(definition, dataset.headers);
    const errors = validatePlotDataset(definition, dataset, mapping, { ...defaultVisualizationSettings, showLabels: true }).errors.join(" ");
    expect(errors).toMatch(/overlapping point pair/);
    expect(errors).toMatch(/cannot place .* pathway label/);
  });

  it("renders visible legends for every specialized size, width, color, and group encoding", () => {
    for (const type of ["go-circle", "pathway-impact", "geographic-map", "sankey-bubble"] as PlotType[]) {
      const definition = getPlotDefinition(type); const dataset = parseDelimitedData(definition.sampleData); const mapping = inferPlotMapping(definition, dataset.headers);
      const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type={type} dataset={dataset} mapping={mapping} settings={defaultVisualizationSettings} themeId={defaultVisualizationThemeId} />);
      if (type !== "sankey-bubble") expect(markup, type).toContain('data-plot-element="size-scale"');
      if (["go-circle", "pathway-impact"].includes(type)) expect(markup, type).toContain('data-plot-element="fdr-scale"');
      if (type === "geographic-map") expect(markup).toContain('data-plot-element="category-footer-legend"');
      if (type === "sankey-bubble") expect(markup).toContain('data-plot-element="relationship-scale"');
    }
    for (const type of ["go-chord", "pathway-impact"] as PlotType[]) {
      const definition = getPlotDefinition(type); const dataset = parseDelimitedData(definition.sampleData); const mapping = inferPlotMapping(definition, dataset.headers);
      const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type={type} dataset={dataset} mapping={mapping} settings={defaultVisualizationSettings} themeId={defaultVisualizationThemeId} />);
      expect(markup, type).toContain('data-plot-element="category-footer-legend"');
      expect(markup, type).toMatch(/group=/);
    }
  });

  it("uses the same endpoint geometry in specialized marks and their static legends", () => {
    const pathway = getPlotDefinition("pathway-impact"); const pathwayData = parseDelimitedData("term\timpact\tcount\tgeneRatio\tFDR\tgroup\tbackground\nA\t0.2\t5\t0.05\t0.02\tG\t100\nB\t0.8\t5\t0.05\t0.001\tG\t100"); const pathwayMapping = inferPlotMapping(pathway, pathwayData.headers); const settings = { ...defaultVisualizationSettings, pointSize: 9 };
    const pathwayMarkup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="pathway-impact" dataset={pathwayData} mapping={pathwayMapping} settings={settings} themeId={defaultVisualizationThemeId} />);
    expect(pathwayMarkup).toContain('data-min-radius="13"');
    expect(pathwayMarkup).toContain('data-max-radius="13"');
    expect(pathwayMarkup.match(/r="13"/g)?.length).toBeGreaterThanOrEqual(4);

    const ribbon = getPlotDefinition("sankey-bubble"); const ribbonData = parseDelimitedData("source\tterm\tgeneRatio\tcount\tFDR\tbackground\nS\tA\t0.25\t4\t0.01\t100\nS\tB\t0.25\t4\t0.02\t100"); const ribbonMapping = inferPlotMapping(ribbon, ribbonData.headers);
    const ribbonMarkup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="sankey-bubble" dataset={ribbonData} mapping={ribbonMapping} settings={defaultVisualizationSettings} themeId={defaultVisualizationThemeId} />);
    expect(ribbonMarkup).toContain('data-min-line-width="4"');
    expect(ribbonMarkup).toContain('data-max-line-width="4"');
    expect(ribbonMarkup).toContain('data-min-radius="14"');
    expect(ribbonMarkup).toContain('data-max-radius="14"');
  });

  it("blocks geographic group footers that cannot fit and rejects blank mapped groups", () => {
    const definition = getPlotDefinition("geographic-map");
    const rows = Array.from({ length: 13 }, (_, index) => `Site${index}\t${-60 + index * 10}\t${-150 + index * 24}\t${index + 1}\tGroup${index}`).join("\n");
    const dataset = parseDelimitedData(`site\tlatitude\tlongitude\tvalue\tgroup\n${rows}`); const mapping = inferPlotMapping(definition, dataset.headers);
    expect(validatePlotDataset(definition, dataset, mapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/group legend needs .* footer rows/);
    const twelve = { ...dataset, rows: dataset.rows.slice(0, 12) };
    expect(validatePlotDataset(definition, twelve, mapping, defaultVisualizationSettings).errors.join(" ")).not.toMatch(/group legend needs .* footer rows/);
    dataset.rows[0][mapping.group] = "";
    expect(validatePlotDataset(definition, dataset, mapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/groups must be non-empty/);
  });

  it("uses the exact GO ontology colors in both nodes and the footer legend", () => {
    const definition = getPlotDefinition("go-chord"); const dataset = parseDelimitedData("term\tgene\teffect\tgeneRatio\tcount\tFDR\tontology\tbackground\nTerm BP\tG1\t1\t0.1\t1\t0.01\tBP\t100\nTerm CC\tG2\t-1\t0.1\t1\t0.02\tCC\t100\nTerm MF\tG3\t0.5\t0.1\t1\t0.03\tMF\t100"); const mapping = inferPlotMapping(definition, dataset.headers);
    const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="go-chord" dataset={dataset} mapping={mapping} settings={defaultVisualizationSettings} themeId={defaultVisualizationThemeId} />);
    for (const ontology of ["BP", "CC", "MF"]) {
      const color = markup.match(new RegExp(`fill="([^"]+)" data-ontology="${ontology}"`))?.[1];
      expect(color, ontology).toBeTruthy();
      expect(markup.split(`fill="${color}"`).length - 1, ontology).toBeGreaterThanOrEqual(2);
    }
    const invalid = parseDelimitedData("term\tgene\teffect\tgeneRatio\tcount\tFDR\tontology\tbackground\nT\tG\t1\t0.1\t1\t0.01\tMetabolic\t100");
    expect(validatePlotDataset(definition, invalid, inferPlotMapping(definition, invalid.headers), defaultVisualizationSettings).errors.join(" ")).toMatch(/ontology must use BP, CC, or MF/);
  });
});
