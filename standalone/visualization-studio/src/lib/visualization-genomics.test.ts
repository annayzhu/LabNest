import { describe, expect, it } from "vitest";
import {
  alterationMatrixLayout,
  buildGenomeAxis,
  canonicalAlteration,
  compareChromosomes,
  genomeAxisSpanMetrics,
  motifInformationContent,
  motifLetterHeights,
  naturalChromosomeOrder,
  normalizeChromosome,
} from "./visualization-genomics";
import {
  defaultVisualizationSettings,
  getPlotDefinition,
  parseDelimitedData,
  plotModuleRegistry,
  validatePlotDataset,
} from "./visualization-studio";

describe("genomic coordinate and alteration helpers", () => {
  it("normalizes and naturally orders standard chromosomes before contigs", () => {
    expect(normalizeChromosome(" chrM ")).toBe("MT");
    expect(naturalChromosomeOrder(["chr30", "chr10", "chr2", "chrX", "chr1", "chrMT", "GL000220.1", "chr23", "chr2"]))
      .toEqual(["chr1", "chr2", "chr10", "chr23", "chr30", "chrX", "chrMT", "GL000220.1"]);
    expect(["chr23", "chr10", "chr2", "chrY", "chrX"].sort(compareChromosomes)).toEqual(["chr2", "chr10", "chr23", "chrX", "chrY"]);
  });

  it("builds one safe cumulative genome axis and clamps out-of-range coordinates", () => {
    const axis = buildGenomeAxis([
      { chromosome: "chr2", start: 0, end: 200 },
      { chromosome: "chr1", start: 0, end: 100 },
      { chromosome: "chr10", start: 0, end: 50 },
    ], 0.03);
    expect(axis.segments.map((segment) => segment.normalizedChromosome)).toEqual(["1", "2", "10"]);
    expect(axis.segments[1].offset).toBeGreaterThan(axis.segments[0].length);
    expect(axis.coordinate("chr1", -50)).toBe(axis.segments[0].offset);
    expect(axis.coordinate("2", 1_000)).toBe(axis.segments[1].offset + axis.segments[1].length);
    expect(axis.totalLength).toBeGreaterThan(350);
    expect(genomeAxisSpanMetrics([
      { chromosome: "chr1", start: 0, end: Number.MAX_SAFE_INTEGER },
      { chromosome: "chr2", start: 0, end: Number.MAX_SAFE_INTEGER },
    ]).fits).toBe(false);
  });

  it("builds and queries the maximum supported number of unique contigs without quadratic scans", () => {
    const intervals = Array.from({ length: 20_000 }, (_, index) => ({ chromosome: `contig_${index + 1}`, start: 0, end: index + 10 }));
    const axis = buildGenomeAxis(intervals);
    expect(axis.segments).toHaveLength(20_000);
    intervals.forEach((interval) => expect(axis.coordinate(interval.chromosome, interval.end)).toBeGreaterThanOrEqual(interval.end));
  }, 5_000);

  it("computes DNA sequence-logo information and probability heights explicitly", () => {
    expect(motifInformationContent([1, 0, 0, 0])).toBeCloseTo(2, 8);
    expect(motifInformationContent([0.25, 0.25, 0.25, 0.25])).toBeCloseTo(0, 8);
    expect(motifInformationContent([0.5, 0.5, 0, 0])).toBeCloseTo(1, 8);
    const probabilities = { A: 0.5, C: 0.25, G: 0.15, T: 0.1 };
    const information = motifLetterHeights(probabilities, "information");
    const probability = motifLetterHeights(probabilities, "probability");
    expect(information.reduce((sum, entry) => sum + entry.height, 0)).toBeCloseTo(motifInformationContent(Object.values(probabilities)), 8);
    expect(probability.reduce((sum, entry) => sum + entry.height, 0)).toBeCloseTo(1, 8);
    expect(probability.at(-1)).toMatchObject({ base: "A", height: 0.5 });
  });

  it("retains multiple alteration classes and derives stable cohort margins", () => {
    const records = [
      { sample: "S2", gene: "TP53", alteration: "missense_variant" },
      { sample: "S1", gene: "TP53", alteration: "stop_gained" },
      { sample: "S1", gene: "TP53", alteration: "copy number deletion" },
      { sample: "S1", gene: "KRAS", alteration: "SNV" },
    ];
    const layout = alterationMatrixLayout(records, true);
    expect(canonicalAlteration("copy number AMP")).toBe("Amplification");
    expect(layout.samples).toEqual(["S1", "S2"]);
    expect(layout.genes).toEqual(["TP53", "KRAS"]);
    expect(layout.cells.get("TP53\u0000S1")).toEqual(["Nonsense", "Deletion"]);
    expect(layout.sampleBurden.get("S1")).toBe(3);
    expect(layout.sampleAlterationCounts.get("S1\u0000Nonsense")).toBe(1);
    expect(layout.geneFrequency.get("TP53")).toBe(1);
    expect(layout.geneFrequency.get("KRAS")).toBe(0.5);
  });
});

describe("genomic module scientific contracts", () => {
  const validate = (id: Parameters<typeof getPlotDefinition>[0], data: string, mapping?: Record<string, string>) => {
    const definition = getPlotDefinition(id);
    return validatePlotDataset(definition, parseDelimitedData(data), mapping ?? definition.defaultMapping, defaultVisualizationSettings);
  };

  it("ships realistic, documented examples for every new family", () => {
    const expectedRows: Record<string, number> = {
      manhattan: 150,
      qq: 100,
      "chromosome-ideogram": 50,
      "snp-density": 100,
      "genome-tracks": 8,
      waterfall: 30,
      oncoplot: 30,
      "motif-logo": 8,
    };
    Object.entries(expectedRows).forEach(([id, minimum]) => {
      const definition = getPlotDefinition(id as Parameters<typeof getPlotDefinition>[0]);
      expect(parseDelimitedData(definition.sampleData).rows.length, id).toBeGreaterThanOrEqual(minimum);
      expect(validatePlotDataset(definition, parseDelimitedData(definition.sampleData), definition.defaultMapping, defaultVisualizationSettings).errors, id).toEqual([]);
      expect(plotModuleRegistry.get(definition.id).guidance.references.length, id).toBeGreaterThan(0);
    });
    expect(plotModuleRegistry.get("motif-logo").guidance.definition).toContain("2−H");
    expect(plotModuleRegistry.get("waterfall").guidance.suitableData).toContain("不是标准化 TMB");
  });

  it("rejects invalid chromosomes, point positions, intervals, overlaps, and P values", () => {
    expect(validate("manhattan", "chromosome\tposition\tp_value\tvariant\nchr 1\t10\t0.05\trs1").errors.join(" ")).toMatch(/invalid label/i);
    expect(validate("manhattan", "chromosome\tposition\tp_value\tvariant\nchr1\t1.5\t0.05\trs1").errors.join(" ")).toMatch(/positive safe integers/i);
    expect(validate("manhattan", "chromosome\tposition\tp_value\tvariant\nchr1\t10\t0\trs1").errors.join(" ")).toMatch(/\(0, 1\]/);
    expect(validate("qq", "p_value\tvariant\n0.5\trs1").errors.join(" ")).toMatch(/at least two/i);
    expect(validate("chromosome-ideogram", "chromosome\tstart\tend\tstain\tband\nchr1\t10\t5\tgneg\tp1").errors.join(" ")).toMatch(/0 ≤ start < end/);
    expect(validate("snp-density", "chromosome\tstart\tend\tvariant_count\nchr1\t0\t10\t2\nchr1\t9\t20\t3").errors.join(" ")).toMatch(/must not overlap/i);
    expect(validate("snp-density", "chromosome\tstart\tend\tvariant_count\nchr1\t0\t10\t-1").errors.join(" ")).toMatch(/non-negative/i);
  });

  it("merges equivalent chromosome spellings with a warning and validates motif probabilities", () => {
    const mixed = validate("manhattan", "chromosome\tposition\tp_value\tvariant\nchr1\t10\t0.5\trs1\n1\t20\t0.2\trs2");
    expect(mixed.errors).toEqual([]);
    expect(mixed.warnings.join(" ")).toMatch(/mixed prefixes/i);

    expect(validate("motif-logo", "position\tA\tC\tG\tT\n1\t0.4\t0.3\t0.2\t0.2").errors.join(" ")).toMatch(/summing to 1/i);
    expect(validate("motif-logo", "position\tA\tC\tG\tT\n1\t0.4\t0.3\t0.2\t0.1\n1\t0.2\t0.3\t0.3\t0.2").errors.join(" ")).toMatch(/unique positive/i);
    expect(validate("motif-logo", "position\tA\tC\tG\tT\n1\t0.4\t0.3\t0.2\t0.1\n2\t0.2\t0.3\t0.3\t0.2").errors).toEqual([]);
  });

  it("blocks a genome-track layout that cannot fit its selected lane gap", () => {
    const rows = ["chromosome\tstart\tend\tvalue\ttrack\tfeature", ...Array.from({ length: 30 }, (_, index) => `chr1\t${index * 10}\t${index * 10 + 5}\t${index}\tTrack_${index + 1}\tF${index + 1}`)].join("\n");
    const definition = getPlotDefinition("genome-tracks");
    const dataset = parseDelimitedData(rows);
    const cramped = validatePlotDataset(definition, dataset, definition.defaultMapping, { ...defaultVisualizationSettings, height: 300, genomicTrackGap: 12 });
    expect(cramped.errors.join(" ")).toMatch(/need at least .* increase height, reduce the gap, or filter tracks/i);
    const compact = validatePlotDataset(definition, dataset, definition.defaultMapping, { ...defaultVisualizationSettings, height: 600, genomicTrackGap: 2 });
    expect(compact.errors).toEqual([]);
  });

  it("ties chromosome lanes, oncoplot cells, and motif positions to actual canvas pixels", () => {
    const chromosomeRows = ["chromosome\tstart\tend\tvariant_count", ...Array.from({ length: 30 }, (_, index) => `contig${index + 1}\t0\t100\t${index + 1}`)].join("\n");
    const density = getPlotDefinition("snp-density");
    expect(validatePlotDataset(density, parseDelimitedData(chromosomeRows), density.defaultMapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/px per chromosome label/i);

    const alterationRows = ["sample\tgene\talteration", ...Array.from({ length: 30 }, (_, geneIndex) => Array.from({ length: 8 }, (_, sampleIndex) => `S${sampleIndex + 1}\tG${geneIndex + 1}\tMissense`)).flat()].join("\n");
    const oncoplot = getPlotDefinition("oncoplot");
    expect(validatePlotDataset(oncoplot, parseDelimitedData(alterationRows), oncoplot.defaultMapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/Oncoplot cells are only/i);
    expect(validatePlotDataset(oncoplot, parseDelimitedData(alterationRows), oncoplot.defaultMapping, { ...defaultVisualizationSettings, height: 700 }).errors).toEqual([]);

    const motifRows = ["position\tA\tC\tG\tT", ...Array.from({ length: 60 }, (_, index) => `${index + 1}\t0.4\t0.3\t0.2\t0.1`)].join("\n");
    const motif = getPlotDefinition("motif-logo");
    expect(validatePlotDataset(motif, parseDelimitedData(motifRows), motif.defaultMapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/px per position/i);
    expect(validatePlotDataset(motif, parseDelimitedData(motifRows), motif.defaultMapping, { ...defaultVisualizationSettings, width: 520 }).errors).toEqual([]);
  });

  it("rejects unsupported cytoband stains and pathological SVG row counts", () => {
    expect(validate("chromosome-ideogram", "chromosome\tstart\tend\tstain\tband\nchr1\t0\t10\tgposs50\tp1").errors.join(" ")).toMatch(/Unsupported cytoband stain/);
    const qqRows = ["p_value\tvariant", ...Array.from({ length: 20_001 }, (_, index) => `0.5\trs${index}`)].join("\n");
    expect(validate("qq", qqRows).errors.join(" ")).toMatch(/limited to 20,000 P values/);
    const alterationRows = ["sample\tgene\talteration", ...Array.from({ length: 10_001 }, (_, index) => `S${index % 8}\tG${index % 6}\tMissense`)].join("\n");
    expect(validate("oncoplot", alterationRows).errors.join(" ")).toMatch(/at most 10,000 alteration events/);
  });

  it("blocks unsafe cumulative axes and ignores hidden genomic settings", () => {
    const unsafeAxis = validate("manhattan", `chromosome\tposition\tp_value\tvariant\nchr1\t${Number.MAX_SAFE_INTEGER}\t0.5\trs1\nchr2\t${Number.MAX_SAFE_INTEGER}\t0.4\trs2`);
    expect(unsafeAxis.errors.join(" ")).toMatch(/cumulative genomic axis spans/i);

    const motif = getPlotDefinition("motif-logo");
    const motifData = parseDelimitedData("position\tA\tC\tG\tT\n1\t0.4\t0.3\t0.2\t0.1\n2\t0.2\t0.3\t0.3\t0.2");
    const staleSettings = { ...defaultVisualizationSettings, genomicSignificanceLog10: -1, genomicTrackGap: -5 };
    expect(validatePlotDataset(motif, motifData, motif.defaultMapping, staleSettings).errors).toEqual([]);
    expect(validatePlotDataset(getPlotDefinition("manhattan"), parseDelimitedData(getPlotDefinition("manhattan").sampleData), getPlotDefinition("manhattan").defaultMapping, staleSettings).errors.join(" ")).toMatch(/threshold must be positive/i);
    expect(validatePlotDataset(getPlotDefinition("genome-tracks"), parseDelimitedData(getPlotDefinition("genome-tracks").sampleData), getPlotDefinition("genome-tracks").defaultMapping, staleSettings).errors.join(" ")).toMatch(/track gap must be non-negative/i);
  });

  it("uses canonical alteration classes for pixel-layout validation", () => {
    const aliases = ["nonsense", "stopgain", "stop_gained", "frameshift", "frame_shift", "missense", "missense_variant", "Missense_Mutation"];
    const rows = ["sample\tgene\talteration", ...Array.from({ length: 17 }, (_, geneIndex) => Array.from({ length: 4 }, (_, sampleIndex) => `S${sampleIndex + 1}\tG${geneIndex + 1}\t${aliases[(geneIndex + sampleIndex) % aliases.length]}`)).flat()].join("\n");
    const definition = getPlotDefinition("oncoplot");
    const validation = validatePlotDataset(definition, parseDelimitedData(rows), definition.defaultMapping, { ...defaultVisualizationSettings, height: 300 });
    expect(validation.errors).toEqual([]);
  });
});
