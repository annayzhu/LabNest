import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ScientificChartPreview } from "@/components/ScientificChartPreview";
import {
  aggregateFlowEdges,
  circosCoordinateSystem,
  parseCircosTrackRecords,
} from "./visualization-flow-circular";
import {
  defaultVisualizationSettings,
  defaultVisualizationThemeId,
  getPlotDefinition,
  parseDelimitedData,
  plotModuleRegistry,
  validatePlotDataset,
  type PlotType,
} from "./visualization-studio";

function moduleData(type: PlotType) {
  const definition = getPlotDefinition(type);
  return { definition, dataset: parseDelimitedData(definition.sampleData), mapping: definition.defaultMapping };
}

describe("flow and circular scientific contracts", () => {
  it("aggregates repeated flow rows without losing total weight", () => {
    const rows = parseDelimitedData("source\ttarget\tvalue\tgroup\nA\tB\t2\tG\nA\tB\t3\tG\nA\tB\t4\tH").rows;
    const edges = aggregateFlowEdges(rows, { source: "source", target: "target", value: "value", group: "group" });
    expect(edges).toHaveLength(2);
    expect(edges.find((edge) => edge.group === "G")).toMatchObject({ value: 5, rows: 2 });
    expect(edges.reduce((sum, edge) => sum + edge.value, 0)).toBe(9);
  });

  it("requires conserved complete alluvial flows across ordered axes", () => {
    const definition = getPlotDefinition("alluvial");
    const incomplete = parseDelimitedData("flow_id\taxis\tstratum\tvalue\tgroup\nP1\tT0\tA\t5\tG\nP1\tT1\tB\t4\tG\nP2\tT0\tA\t2\tG");
    const errors = validatePlotDataset(definition, incomplete, definition.defaultMapping, defaultVisualizationSettings).errors.join(" ");
    expect(errors).toMatch(/missing paths|not occur on every axis/i);
    expect(errors).toMatch(/changes weight/i);
    const valid = moduleData("alluvial");
    expect(validatePlotDataset(valid.definition, valid.dataset, valid.mapping, defaultVisualizationSettings).errors).toEqual([]);
  });

  it("keeps Alluvial group/color stable and provides a bounded group legend", () => {
    const definition = getPlotDefinition("alluvial");
    const changing = parseDelimitedData("flow_id\taxis\tstratum\tvalue\tgroup\nP1\tT0\tA\t5\tG1\nP1\tT1\tB\t5\tG2");
    expect(validatePlotDataset(definition, changing, definition.defaultMapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/changes ribbon group/i);
    const fiveGroups = parseDelimitedData(["flow_id\taxis\tstratum\tvalue\tgroup", ...Array.from({ length: 5 }, (_, index) => `P${index}\tT0\tA${index}\t1\tG${index}`), ...Array.from({ length: 5 }, (_, index) => `P${index}\tT1\tB${index}\t1\tG${index}`)].join("\n"));
    expect(validatePlotDataset(definition, fiveGroups, definition.defaultMapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/at most four groups/i);
    const blankGroup = parseDelimitedData("flow_id\taxis\tstratum\tvalue\tgroup\nP1\tT0\tA\t5\tG\nP1\tT1\tB\t5\t");
    expect(validatePlotDataset(definition, blankGroup, definition.defaultMapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/group values must be complete/i);
    const unmapped = { ...definition.defaultMapping, group: "" };
    const stable = parseDelimitedData("flow_id\taxis\tstratum\tvalue\nP1\tT0\tA\t5\nP1\tT1\tB\t5");
    const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="alluvial" dataset={stable} mapping={unmapped} settings={{ ...defaultVisualizationSettings, showLabels: true }} themeId={defaultVisualizationThemeId} />);
    expect(markup).not.toContain("alluvial-group-swatch");
    expect(new Set([...markup.matchAll(/data-plot-element="alluvial-ribbon"[^>]*stroke="([^"]+)"/g)].map((match) => match[1])).size).toBe(1);
  });

  it("requires complete ligand-receptor evidence and strictly positive weights", () => {
    const definition = getPlotDefinition("ligand-receptor");
    const invalid = parseDelimitedData("source_cell\tligand\treceptor\ttarget_cell\tweight\tevidence\nTumor\tTGFB1\tTGFBR2\tFibroblast\t-1\t");
    expect(validatePlotDataset(definition, invalid, definition.defaultMapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/incomplete|strictly positive/i);
  });

  it("rejects zero-weight flows and Sankey legends that cannot explain every group", () => {
    for (const type of ["sankey", "chord"] as const) {
      const definition = getPlotDefinition(type);
      const zero = parseDelimitedData("source\ttarget\tvalue\tgroup\nA\tB\t0\tG");
      expect(validatePlotDataset(definition, zero, definition.defaultMapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/strictly positive/i);
    }
    const ligand = getPlotDefinition("ligand-receptor");
    const zeroLigand = parseDelimitedData("source_cell\tligand\treceptor\ttarget_cell\tweight\tevidence\nTumor\tL1\tR1\tT cell\t0\tvalidated");
    expect(validatePlotDataset(ligand, zeroLigand, ligand.defaultMapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/strictly positive/i);

    const sankey = getPlotDefinition("sankey");
    const fiveGroups = parseDelimitedData(["source\ttarget\tvalue\tgroup", ...Array.from({ length: 5 }, (_, index) => `A${index}\tB${index}\t1\tGroup ${index + 1}`)].join("\n"));
    expect(validatePlotDataset(sankey, fiveGroups, sankey.defaultMapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/at most four groups/i);
    const noGroupMapping = { ...sankey.defaultMapping, group: "" };
    expect(validatePlotDataset(sankey, fiveGroups, noGroupMapping, defaultVisualizationSettings).errors).toEqual([]);
    const ungroupedMarkup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="sankey" dataset={fiveGroups} mapping={noGroupMapping} settings={{ ...defaultVisualizationSettings, showLabels: true }} themeId={defaultVisualizationThemeId} />);
    expect(ungroupedMarkup).not.toContain("legend-Group");
    expect(new Set([...ungroupedMarkup.matchAll(/data-plot-element="flow-ribbon"[^>]*stroke="([^"]+)"/g)].map((match) => match[1])).size).toBe(5);
    const blankGroup = parseDelimitedData("source\ttarget\tvalue\tgroup\nA\tB\t1\tG1\nC\tD\t1\t");
    expect(validatePlotDataset(sankey, blankGroup, sankey.defaultMapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/group values must be complete/i);
  });

  it("normalizes every Circos track onto one natural chromosome coordinate system", () => {
    const { definition, dataset, mapping } = moduleData("circos");
    const records = parseCircosTrackRecords(dataset.rows, mapping);
    const coordinates = circosCoordinateSystem(records);
    expect(coordinates.chromosomes).toEqual(["1", "5", "8"]);
    expect(coordinates.angle("chr1", 0)).toBe(coordinates.sectors.get("1")?.start);
    expect(coordinates.angle("1", 16_000_000)).toBeCloseTo(coordinates.angle("chr1", 16_000_000));
    const sparse = circosCoordinateSystem(records.filter((record) => record.chromosome !== "1" || record.start <= 16_000_000));
    expect(sparse.angle("chr1", 16_000_000)).toBeCloseTo(coordinates.angle("chr1", 16_000_000));
    expect(validatePlotDataset(definition, dataset, mapping, defaultVisualizationSettings).errors).toEqual([]);
  });

  it("rejects unknown Circos records, invalid target intervals, and unsafe cumulative spans", () => {
    const definition = getPlotDefinition("circos");
    const mapping = definition.defaultMapping;
    const unknown = parseDelimitedData("record_type\tchromosome\tstart\tend\tchromosome_length\tvalue\tlabel\ttrack\ttarget_chromosome\ttarget_start\ttarget_end\ttarget_chromosome_length\nrainbow\tchr1\t0\t10\t100\t1\tx\tT\t\t\t\t");
    expect(validatePlotDataset(definition, unknown, mapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/Unsupported Circos record type/);
    const missingTarget = parseDelimitedData("record_type\tchromosome\tstart\tend\tchromosome_length\tvalue\tlabel\ttrack\ttarget_chromosome\ttarget_start\ttarget_end\ttarget_chromosome_length\nlink\tchr1\t0\t10\t100\t1\tx\tT\tchr2\t20\t10\t100");
    expect(validatePlotDataset(definition, missingTarget, mapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/target genomic coordinates/);
    const unsafe = parseDelimitedData(`record_type\tchromosome\tstart\tend\tchromosome_length\tvalue\tlabel\ttrack\ttarget_chromosome\ttarget_start\ttarget_end\ttarget_chromosome_length\nbar\tchr1\t0\t${Number.MAX_SAFE_INTEGER}\t${Number.MAX_SAFE_INTEGER}\t1\tx\tT\t\t\t\t\nbar\tchr2\t0\t${Number.MAX_SAFE_INTEGER}\t${Number.MAX_SAFE_INTEGER}\t1\ty\tT\t\t\t\t`);
    expect(validatePlotDataset(definition, unsafe, mapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/safe browser limit/);
  });

  it("never imputes missing Circos values and enforces record-specific numeric semantics", () => {
    const definition = getPlotDefinition("circos");
    const header = "record_type\tchromosome\tstart\tend\tchromosome_length\tvalue\tlabel\ttrack\ttarget_chromosome\ttarget_start\ttarget_end\ttarget_chromosome_length";
    for (const type of ["bar", "heatmap", "scatter", "link", "fusion", "correlation"] as const) {
      const relational = ["link", "fusion", "correlation"].includes(type);
      const row = `${type}\tchr1\t0\t10\t100\t\tX\tT\t${relational ? "chr2\t20\t30\t100" : "\t\t\t"}`;
      const errors = validatePlotDataset(definition, parseDelimitedData(`${header}\n${row}`), definition.defaultMapping, defaultVisualizationSettings).errors.join(" ");
      expect(errors, type).toMatch(/missing a finite value/i);
    }
    const negativeBar = parseDelimitedData(`${header}\nbar\tchr1\t0\t10\t100\t-2\tX\tT\t\t\t\t`);
    expect(validatePlotDataset(definition, negativeBar, definition.defaultMapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/bar values must be non-negative/i);
    for (const type of ["link", "fusion"] as const) {
      const zero = parseDelimitedData(`${header}\n${type}\tchr1\t0\t10\t100\t0\tX\tT\tchr2\t20\t30\t100`);
      expect(validatePlotDataset(definition, zero, definition.defaultMapping, defaultVisualizationSettings).errors.join(" "), type).toMatch(/strictly positive/i);
    }
    const zeroCorrelation = parseDelimitedData(`${header}\ncorrelation\tchr1\t0\t10\t100\t0\tX\tT\tchr2\t20\t30\t100`);
    expect(validatePlotDataset(definition, zeroCorrelation, definition.defaultMapping, defaultVisualizationSettings).warnings.join(" ")).toMatch(/omitted because r = 0/i);
  });

  it("blocks self-loop Chord input and Circos tracks that cannot fit the selected gap", () => {
    const chord = getPlotDefinition("chord");
    expect(validatePlotDataset(chord, parseDelimitedData("source\ttarget\tvalue\tgroup\nA\tA\t2\tG\nA\tB\t1\tG"), chord.defaultMapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/self-loops/i);
    const circos = getPlotDefinition("circos");
    const dense = parseDelimitedData(["record_type\tchromosome\tstart\tend\tchromosome_length\tvalue\tlabel\ttrack\ttarget_chromosome\ttarget_start\ttarget_end\ttarget_chromosome_length", ...Array.from({ length: 8 }, (_, index) => `bar\tchr1\t${index * 10}\t${index * 10 + 5}\t1000\t${index + 1}\tF${index + 1}\tTrack ${index + 1}\t\t\t\t`)].join("\n"));
    expect(validatePlotDataset(circos, dense, circos.defaultMapping, { ...defaultVisualizationSettings, genomicTrackGap: 12 }).errors.join(" ")).toMatch(/track spacing/i);
  });

  it("blocks tiny weighted sectors, colliding circular labels, and scatter points wider than their tracks", () => {
    const chord = getPlotDefinition("chord");
    const unequalChord = parseDelimitedData("source\ttarget\tvalue\nA\tB\t1000\nC\tD\t0.001");
    expect(validatePlotDataset(chord, unequalChord, chord.defaultMapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/minimum category arc/i);

    const circos = getPlotDefinition("circos");
    const header = "record_type\tchromosome\tstart\tend\tchromosome_length\tvalue\tlabel\ttrack\ttarget_chromosome\ttarget_start\ttarget_end\ttarget_chromosome_length";
    const unequalChromosomes = parseDelimitedData(`${header}\nbar\tchr1\t0\t10\t1000000000\t2\tA\tT\t\t\t\t\nbar\tcontigTiny\t0\t10\t100\t2\tB\tT\t\t\t\t`);
    expect(validatePlotDataset(circos, unequalChromosomes, circos.defaultMapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/minimum chromosome arc/i);
    const collidingLabels = parseDelimitedData(`${header}\nlabel\tchr1\t10\t11\t100\t\tLong label one\tGenes\t\t\t\t\nlabel\tchr1\t10\t11\t100\t\tLong label two\tGenes\t\t\t\t`);
    expect(validatePlotDataset(circos, collidingLabels, circos.defaultMapping, { ...defaultVisualizationSettings, showLabels: true }).errors.join(" ")).toMatch(/labels are not collision-safe/i);
    const scatterTracks = parseDelimitedData([header, ...Array.from({ length: 8 }, (_, index) => `scatter\tchr1\t${index * 10}\t${index * 10 + 5}\t1000\t${index + 1}\tS${index}\tTrack ${index + 1}\t\t\t\t`)].join("\n"));
    expect(validatePlotDataset(circos, scatterTracks, circos.defaultMapping, { ...defaultVisualizationSettings, genomicTrackGap: 0, pointSize: 12 }).errors.join(" ")).toMatch(/scatter diameter within its track band/i);
  });

  it("uses the title-aware compact frame when checking dense ligand-receptor layers", () => {
    const definition = getPlotDefinition("ligand-receptor");
    const dense = parseDelimitedData(["source_cell\tligand\treceptor\ttarget_cell\tweight\tevidence", ...Array.from({ length: 31 }, (_, index) => `Sender ${index}\tL${index}\tR${index}\tReceiver ${index}\t1\tvalidated`)].join("\n"));
    const errors = validatePlotDataset(definition, dense, definition.defaultMapping, { ...defaultVisualizationSettings, width: 340, height: 340, title: "Dense signaling network", showLabels: true }).errors.join(" ");
    expect(errors).toMatch(/cannot fit 31 entries/i);
  });

  it("publishes only settings consumed by each compact flow renderer", () => {
    for (const type of ["sankey", "alluvial", "chord", "ligand-receptor"] as const) {
      const keys = new Set(plotModuleRegistry.get(type).capabilities.settingKeys);
      expect(keys.has("showLabels"), type).toBe(true);
      expect(keys.has("xLabel"), type).toBe(false);
      expect(keys.has("grid"), type).toBe(false);
      expect(keys.has("dataLineWidth"), type).toBe(false);
    }
    const circosKeys = new Set(plotModuleRegistry.get("circos").capabilities.settingKeys);
    expect(circosKeys.has("genomicTrackGap")).toBe(true);
    expect(circosKeys.has("pointSize")).toBe(true);
    expect(circosKeys.has("axisLineWidth")).toBe(false);
  });
});

describe("flow and circular renderers", () => {
  it("renders each upgraded module with explicit semantic marks and finite geometry", () => {
    const expected: Record<"sankey" | "alluvial" | "chord" | "ligand-receptor" | "circos", string> = {
      sankey: "flow-ribbon",
      alluvial: "alluvial-ribbon",
      chord: "chord-ribbon",
      "ligand-receptor": "ligand-receptor-edge",
      circos: "circos-chromosome",
    };
    for (const [type, element] of Object.entries(expected) as Array<[keyof typeof expected, string]>) {
      const { definition, dataset, mapping } = moduleData(type);
      const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type={type} dataset={dataset} mapping={mapping} settings={{ ...defaultVisualizationSettings, showLabels: true }} themeId={defaultVisualizationThemeId} />);
      expect(markup, type).toContain(`data-plot-family="${type}"`);
      expect(markup, type).toContain(`data-plot-element="${element}"`);
      expect(markup, type).not.toMatch(/(?:NaN|Infinity|-Infinity|undefined)/);
      expect(validatePlotDataset(definition, dataset, mapping, defaultVisualizationSettings).errors, type).toEqual([]);
    }
  });

  it("renders all requested Circos track and relationship types", () => {
    const { dataset, mapping } = moduleData("circos");
    const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="circos" dataset={dataset} mapping={mapping} settings={{ ...defaultVisualizationSettings, showLabels: true }} themeId={defaultVisualizationThemeId} />);
    for (const element of ["circos-bar", "circos-heatmap", "circos-scatter", "circos-fusion", "circos-correlation", "circos-link", "circos-scale-legend"]) expect(markup).toContain(`data-plot-element="${element}"`);
    expect(markup).toContain('data-full-label="GENE1"');
    expect(markup).toContain('data-coordinate-system="shared-genomic"');
    expect(markup).toContain("Copy number: -1.4–2.8");
    expect(markup).toContain('data-plot-element="circos-heatmap-gradient"');
    expect(markup).toContain('data-plot-element="circos-correlation-key"');
    expect(markup).toContain("r &lt; 0");
    expect(markup).toContain("r &gt; 0");
  });

  it("aggregates shared ligand-receptor subedges and truly color-encodes Sankey groups", () => {
    const ligand = getPlotDefinition("ligand-receptor");
    const ligandData = parseDelimitedData("source_cell\tligand\treceptor\ttarget_cell\tweight\tevidence\nTumor\tL1\tR1\tT cell\t2\tvalidated\nTumor\tL1\tR2\tB cell\t3\tpredicted");
    const ligandMarkup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="ligand-receptor" dataset={ligandData} mapping={ligand.defaultMapping} settings={{ ...defaultVisualizationSettings, showLabels: true }} themeId={defaultVisualizationThemeId} />);
    expect(ligandMarkup.match(/data-plot-element="ligand-receptor-edge"/g)).toHaveLength(5);
    expect(ligandMarkup).toContain('data-weight="5"');
    expect(ligandMarkup).toContain("validated; predicted");

    const sankey = getPlotDefinition("sankey");
    const sankeyData = parseDelimitedData("source\ttarget\tvalue\tgroup\nA\tB\t2\tGroup one\nA\tB\t3\tGroup two");
    const sankeyMarkup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="sankey" dataset={sankeyData} mapping={sankey.defaultMapping} settings={{ ...defaultVisualizationSettings, showLabels: true }} themeId={defaultVisualizationThemeId} />);
    const colors = [...sankeyMarkup.matchAll(/data-plot-element="flow-ribbon"[^>]*data-group="[^"]+"[^>]*stroke="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(colors).size).toBe(2);
    expect(sankeyMarkup).toContain("Group one");
    expect(sankeyMarkup).toContain("Group two");
  });

  it("uses neutral styling for ligand-receptor subedges shared by multiple senders", () => {
    const definition = getPlotDefinition("ligand-receptor");
    const dataset = parseDelimitedData("source_cell\tligand\treceptor\ttarget_cell\tweight\tevidence\nSender 1\tL1\tR1\tReceiver 1\t2\tvalidated\nSender 2\tL1\tR1\tReceiver 2\t3\tpredicted");
    const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="ligand-receptor" dataset={dataset} mapping={definition.defaultMapping} settings={{ ...defaultVisualizationSettings, showLabels: true }} themeId={defaultVisualizationThemeId} />);
    expect(markup).toMatch(/data-senders="Sender 1, Sender 2"[^>]*data-weight="5"[^>]*stroke="#7C7E83"/);
  });

  it("keeps a full-chromosome Circos bar inside its assigned annular band", () => {
    const definition = getPlotDefinition("circos");
    const dataset = parseDelimitedData("record_type\tchromosome\tstart\tend\tchromosome_length\tvalue\tlabel\ttrack\ttarget_chromosome\ttarget_start\ttarget_end\ttarget_chromosome_length\nbar\tchr1\t0\t100\t100\t5\tWhole chromosome\tCopy number\t\t\t\t");
    const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="circos" dataset={dataset} mapping={definition.defaultMapping} settings={{ ...defaultVisualizationSettings, showLabels: true }} themeId={defaultVisualizationThemeId} />);
    const radii = markup.match(/data-plot-element="circos-bar" data-inner-radius="([^"]+)" data-outer-radius="([^"]+)"/);
    expect(radii).not.toBeNull();
    expect(Number(radii?.[2]) - Number(radii?.[1])).toBeGreaterThan(0);
    expect(Number(radii?.[2]) - Number(radii?.[1])).toBeLessThanOrEqual(12);
    expect(markup).not.toMatch(/data-plot-element="circos-bar"[^>]*stroke-width/);
  });

  it("uses a scientific zero baseline for every non-negative Circos bar", () => {
    const definition = getPlotDefinition("circos");
    const dataset = parseDelimitedData("record_type\tchromosome\tstart\tend\tchromosome_length\tvalue\tlabel\ttrack\ttarget_chromosome\ttarget_start\ttarget_end\ttarget_chromosome_length\nbar\tchr1\t0\t10\t100\t5\tLow\tAbundance\t\t\t\t\nbar\tchr1\t20\t30\t100\t10\tHigh\tAbundance\t\t\t\t");
    const markup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="circos" dataset={dataset} mapping={definition.defaultMapping} settings={{ ...defaultVisualizationSettings, showLabels: true }} themeId={defaultVisualizationThemeId} />);
    const bars = [...markup.matchAll(/data-plot-element="circos-bar" data-inner-radius="([^"]+)" data-outer-radius="([^"]+)"/g)].map((match) => Number(match[2]) - Number(match[1]));
    expect(bars).toHaveLength(2);
    expect(bars[0]).toBeGreaterThan(0);
    expect(bars[1] / bars[0]).toBeCloseTo(2, 5);
    const allZero = parseDelimitedData("record_type\tchromosome\tstart\tend\tchromosome_length\tvalue\tlabel\ttrack\ttarget_chromosome\ttarget_start\ttarget_end\ttarget_chromosome_length\nbar\tchr1\t0\t10\t100\t0\tZero A\tAbundance\t\t\t\t\nbar\tchr1\t20\t30\t100\t0\tZero B\tAbundance\t\t\t\t");
    const zeroMarkup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="circos" dataset={allZero} mapping={definition.defaultMapping} settings={{ ...defaultVisualizationSettings, showLabels: true }} themeId={defaultVisualizationThemeId} />);
    expect(zeroMarkup).not.toContain('data-plot-element="circos-bar"');
    expect(zeroMarkup).toContain("Abundance: 0–0");
  });

  it("shows correlation semantics only when present and omits zero-correlation paths", () => {
    const definition = getPlotDefinition("circos");
    const header = "record_type\tchromosome\tstart\tend\tchromosome_length\tvalue\tlabel\ttrack\ttarget_chromosome\ttarget_start\ttarget_end\ttarget_chromosome_length";
    const correlationOnly = parseDelimitedData(`${header}\ncorrelation\tchr1\t0\t10\t100\t0.4\tR\tRelationships\tchr2\t20\t30\t100\ncorrelation\tchr1\t40\t50\t100\t0\tZero\tRelationships\tchr2\t60\t70\t100`);
    const correlationMarkup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="circos" dataset={correlationOnly} mapping={definition.defaultMapping} settings={{ ...defaultVisualizationSettings, showLabels: true }} themeId={defaultVisualizationThemeId} />);
    expect(correlationMarkup).toContain('data-plot-element="circos-correlation-key"');
    expect(correlationMarkup).toContain("dashed width = |r|");
    expect(correlationMarkup.match(/data-plot-element="circos-correlation"/g)).toHaveLength(1);

    const numericOnly = parseDelimitedData(`${header}\nheatmap\tchr1\t0\t10\t100\t-1\tH\tAccessibility\t\t\t\t`);
    const numericMarkup = renderToStaticMarkup(<ScientificChartPreview svgRef={createRef<SVGSVGElement>()} type="circos" dataset={numericOnly} mapping={definition.defaultMapping} settings={{ ...defaultVisualizationSettings, showLabels: true }} themeId={defaultVisualizationThemeId} />);
    expect(numericMarkup).toContain("Accessibility: -1–-1");
    expect(numericMarkup).not.toContain("circos-correlation-key");
  });
});
