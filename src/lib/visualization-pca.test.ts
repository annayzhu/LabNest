import { describe, expect, it } from "vitest";
import { analyzeExpressionMatrix, inferPcaGroup, nipalsPca } from "./visualization-pca";

const mixedExpressionTable = `gene_id\tC1_count\tC2_count\tC3_count\tT1_count\tT2_count\tT3_count\tC1_fpkm\tC2_fpkm\tC3_fpkm\tT1_fpkm\tT2_fpkm\tT3_fpkm\tTvsC_log2FoldChange\tTvsC_padj\tgene_length\tgene_name
g1\t100\t110\t105\t420\t440\t410\t2.1\t2.2\t2.0\t8.4\t8.8\t8.2\t2.0\t0.001\t1200\tGene1
g2\t500\t520\t490\t180\t190\t170\t10.0\t10.4\t9.8\t3.6\t3.8\t3.4\t-1.5\t0.004\t980\tGene2
g3\t80\t85\t78\t250\t265\t245\t1.6\t1.7\t1.5\t5.0\t5.3\t4.9\t1.7\t0.008\t1500\tGene3
g4\t300\t315\t290\t305\t295\t310\t6.0\t6.3\t5.8\t6.1\t5.9\t6.2\t0.0\t0.9\t2000\tGene4
g5\t45\t50\t48\t160\t170\t155\t0.9\t1.0\t0.96\t3.2\t3.4\t3.1\t1.8\t0.002\t700\tGene5
g6\t720\t700\t735\t400\t420\t390\t14.4\t14.0\t14.7\t8.0\t8.4\t7.8\t-0.9\t0.03\t1100\tGene6`;

describe("Visualization Studio PCA", () => {
  it("prefers explicitly suffixed raw-count columns in a mixed results table", () => {
    const result = analyzeExpressionMatrix(mixedExpressionTable, { dataLayer: "auto", topVariableFeatures: 2_000, scaleFeatures: false });
    expect(result.dataset.errors).toEqual([]);
    expect(result.detectedLayer).toBe("counts");
    expect(result.sampleColumns).toEqual(["C1_count", "C2_count", "C3_count", "T1_count", "T2_count", "T3_count"]);
    expect(result.sampleNames).toEqual(["C1", "C2", "C3", "T1", "T2", "T3"]);
    expect(result.groups).toEqual(["C1", "C2", "C3", "T1", "T2", "T3"]);
    expect(result.dataset.rows).toHaveLength(6);
    expect(result.explainedVariance.slice(0, 2).every((value) => value > 0)).toBe(true);
    expect(result.explainedVariance.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 8);
    expect(result.loadings).toHaveLength(6);
    expect(result.loadings.every((loading) => loading.feature && loading.coordinates.length >= 2 && loading.coordinates.every(Number.isFinite))).toBe(true);
    expect(result.dataset.analysis?.pca?.loadings).toEqual(result.loadings);
    expect(result.transformation).toContain("log₂(CPM + 1)");
  });

  it("switches the same mixed table to the FPKM layer explicitly", () => {
    const result = analyzeExpressionMatrix(mixedExpressionTable, { dataLayer: "abundance", topVariableFeatures: 500, scaleFeatures: false });
    expect(result.dataset.errors).toEqual([]);
    expect(result.detectedLayer).toBe("abundance");
    expect(result.sampleColumns).toEqual(["C1_fpkm", "C2_fpkm", "C3_fpkm", "T1_fpkm", "T2_fpkm", "T3_fpkm"]);
    expect(result.transformation).toBe("log₂(non-negative abundance + 1)");
  });

  it("does not guess counts from unsigned integer values without an explicit suffix", () => {
    const raw = `gene_id\tA1\tA2\tA3\tgene_start\tgene_end\tgene_length
G1\t10\t12\t11\t100\t200\t101
G2\t40\t42\t38\t300\t500\t201
G3\t80\t75\t85\t600\t800\t201
G4\t20\t18\t22\t900\t950\t51`;
    const automatic = analyzeExpressionMatrix(raw, { dataLayer: "auto", topVariableFeatures: 500, scaleFeatures: false });
    expect(automatic.dataset.errors).toEqual([]);
    expect(automatic.sampleColumns).toEqual(["A1", "A2", "A3"]);
    expect(automatic.detectedLayer).toBe("normalized");
    expect(automatic.transformation).toBe("No log transformation");

    const explicitCounts = analyzeExpressionMatrix(raw, { dataLayer: "counts", topVariableFeatures: 500, scaleFeatures: false });
    expect(explicitCounts.dataset.errors).toEqual([]);
    expect(explicitCounts.detectedLayer).toBe("counts");
    expect(explicitCounts.transformation).toContain("log₂(CPM + 1)");
  });

  it("treats unsigned decimal matrices as normalized unless abundance is explicit", () => {
    const raw = "feature\tS1\tS2\tS3\nA\t1.2\t1.8\t2.5\nB\t4.3\t3.1\t2.2\nC\t0.4\t1.0\t1.6";
    expect(analyzeExpressionMatrix(raw).detectedLayer).toBe("normalized");
    expect(analyzeExpressionMatrix(raw, { dataLayer: "abundance", topVariableFeatures: 2_000, scaleFeatures: false }).detectedLayer).toBe("abundance");
  });

  it("joins independent observation metadata by exact sample ID", () => {
    const metadata = `sample\tgroup\tbatch\tlabel
C1\tVehicle\tB1\tControl one
C2\tVehicle\tB2\tControl two
C3\tVehicle\tB1\tControl three
T1\tDrug\tB2\tTreatment one
T2\tDrug\tB1\tTreatment two
T3\tDrug\tB2\tTreatment three`;
    const result = analyzeExpressionMatrix(mixedExpressionTable, undefined, metadata);
    expect(result.dataset.errors).toEqual([]);
    expect(result.groups).toEqual(["Vehicle", "Drug"]);
    expect(result.dataset.headers).toEqual(expect.arrayContaining(["group", "batch", "label", "PC1", "PC2"]));
    expect(result.dataset.rows[0]).toMatchObject({ sample: "C1", group: "Vehicle", batch: "B1", label: "Control one" });

    const invalid = analyzeExpressionMatrix(mixedExpressionTable, undefined, metadata.replace("T3\tDrug\tB2\tTreatment three", "C1\tDrug\tB2\tDuplicate"));
    expect(invalid.dataset.errors.join(" ")).toMatch(/duplicate: C1/i);
    expect(invalid.dataset.errors.join(" ")).toMatch(/missing 1 sample ID: T3/i);
  });

  it("matches a small reference PCA spectrum and keeps every selected loading", () => {
    const reference = `feature_id\tS1\tS2\tS3\tS4
A\t0\t2\t4\t6
B\t0\t2\t2\t0`;
    const result = analyzeExpressionMatrix(reference, { dataLayer: "normalized", topVariableFeatures: 100, scaleFeatures: false });
    expect(result.dataset.errors).toEqual([]);
    expect(result.explainedVariance[0]).toBeCloseTo(5 / 6, 6);
    expect(result.explainedVariance[1]).toBeCloseTo(1 / 6, 6);
    expect(result.loadings).toHaveLength(2);
    expect(result.loadings.every((loading) => loading.coordinates.length === 2)).toBe(true);
  });

  it("retains feature loadings for higher selected components instead of prefiltering by PC1-PC3", () => {
    const headers = Array.from({ length: 8 }, (_, index) => `S${index + 1}`);
    const rows = Array.from({ length: 60 }, (_, featureIndex) => {
      const values = headers.map((_, sampleIndex) => Math.cos(Math.PI * (sampleIndex + 0.5) * (featureIndex + 1) / 8) * (1 + featureIndex / 20));
      return `Feature_${featureIndex + 1}\t${values.join("\t")}`;
    });
    const result = analyzeExpressionMatrix(`feature\t${headers.join("\t")}\n${rows.join("\n")}`, { dataLayer: "normalized", topVariableFeatures: 100, scaleFeatures: false });
    expect(result.dataset.errors).toEqual([]);
    expect(result.loadings).toHaveLength(result.featuresUsed);
    expect(result.loadings.length).toBeGreaterThan(50);
    expect(result.loadings.every((loading) => Number.isFinite(loading.coordinates[3]))).toBe(true);
  });

  it("caps browser PCA at 300 observations and counts malformed input rows in provenance", () => {
    const sampleHeaders = Array.from({ length: 301 }, (_, index) => `S${index + 1}`).join("\t");
    const oversized = `feature\t${sampleHeaders}\nA\t${Array.from({ length: 301 }, (_, index) => index).join("\t")}\nB\t${Array.from({ length: 301 }, (_, index) => index % 7).join("\t")}`;
    expect(analyzeExpressionMatrix(oversized).dataset.errors.join(" ")).toMatch(/limited to 300 observations/);

    const incomplete = "feature\tS1\tS2\tS3\nA\t1\t2\t3\nmalformed\t1\t2\nB\t4\tbad\t6\nC\t2\t4\t7\nD\t3\t7\t8";
    const result = analyzeExpressionMatrix(incomplete, { dataLayer: "normalized", topVariableFeatures: 100, scaleFeatures: false });
    expect(result.featuresRead).toBe(5);
    expect(result.featuresComplete).toBe(3);
    expect(result.dataset.warnings.join(" ")).toMatch(/malformed feature row/);
    expect(result.dataset.warnings.join(" ")).toMatch(/incomplete/);
  });

  it("treats blank cells as incomplete and requires unique feature IDs", () => {
    const blank = "feature\tS1\tS2\tS3\nA\t1\t\t3\nB\t2\t4\t6\nC\t3\t5\t8\nD\t4\t7\t9";
    const blankResult = analyzeExpressionMatrix(blank, { dataLayer: "normalized", topVariableFeatures: 100, scaleFeatures: false });
    expect(blankResult.featuresComplete).toBe(3);
    expect(blankResult.dataset.warnings.join(" ")).toMatch(/incomplete/);

    const duplicate = "feature\tS1\tS2\tS3\nA\t1\t2\t3\nA\t2\t3\t5\nB\t3\t5\t8";
    expect(analyzeExpressionMatrix(duplicate).dataset.errors.join(" ")).toMatch(/Feature IDs must be unique.*A/);
    const blankId = "feature\tS1\tS2\tS3\nA\t1\t2\t3\n\t2\t3\t5\nB\t3\t5\t8";
    expect(analyzeExpressionMatrix(blankId).dataset.errors.join(" ")).toMatch(/Feature IDs must not be blank.*3/);
  });

  it("supports the 300-observation boundary and enforces the one-million-cell boundary", () => {
    const observationHeaders = Array.from({ length: 300 }, (_, index) => `S${index + 1}`);
    const boundaryMatrix = `feature\t${observationHeaders.join("\t")}\nA\t${observationHeaders.map((_, index) => Math.sin(index / 7)).join("\t")}\nB\t${observationHeaders.map((_, index) => Math.cos(index / 11)).join("\t")}\nC\t${observationHeaders.map((_, index) => index % 5).join("\t")}`;
    expect(analyzeExpressionMatrix(boundaryMatrix, { dataLayer: "normalized", topVariableFeatures: 100, scaleFeatures: false }).dataset.errors).toEqual([]);

    const compactHeaders = Array.from({ length: 100 }, (_, index) => `O${index + 1}`);
    const makeRows = (count: number) => Array.from({ length: count }, (_, featureIndex) => `F${featureIndex + 1}\t${compactHeaders.map((_, sampleIndex) => ((featureIndex % 2 === 0 ? sampleIndex % 2 : sampleIndex % 4 < 2) ? 1 : -1) * (1 + featureIndex / count)).join("\t")}`).join("\n");
    const atLimit = analyzeExpressionMatrix(`feature\t${compactHeaders.join("\t")}\n${makeRows(10_000)}`, { dataLayer: "normalized", topVariableFeatures: 0, scaleFeatures: false });
    expect(atLimit.dataset.errors).toEqual([]);
    const overLimit = analyzeExpressionMatrix(`feature\t${compactHeaders.join("\t")}\n${makeRows(10_001)}`, { dataLayer: "normalized", topVariableFeatures: 0, scaleFeatures: false });
    expect(overLimit.dataset.errors.join(" ")).toMatch(/limited to one million/);
  });

  it("keeps NIPALS large-feature norms bounded and exposes non-convergence", () => {
    const wideFeatureMatrix = Array.from({ length: 120_000 }, (_, index) => index % 2 === 0 ? [1, -1, 0] : [1, 1, -2]);
    const result = nipalsPca(wideFeatureMatrix, 2, 2);
    expect(result.converged).toBe(true);
    expect(result.components).toHaveLength(2);
    expect(nipalsPca([[1, -1, 0], [1, 1, -2]], 2, 2, 0).converged).toBe(false);
  });

  it("infers replicate groups without collapsing biological names", () => {
    expect(inferPcaGroup("H151_4")).toBe("H151");
    expect(inferPcaGroup("F_Pep_H151_2")).toBe("F_Pep_H151");
    expect(inferPcaGroup("Control-3")).toBe("Control");
    expect(inferPcaGroup("H151")).toBe("H151");
    expect(inferPcaGroup("H1650")).toBe("H1650");
  });
});
