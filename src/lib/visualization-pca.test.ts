import { describe, expect, it } from "vitest";
import { analyzeExpressionMatrix, inferPcaGroup } from "./visualization-pca";

const mixedExpressionTable = `gene_id\tC1_count\tC2_count\tC3_count\tT1_count\tT2_count\tT3_count\tC1_fpkm\tC2_fpkm\tC3_fpkm\tT1_fpkm\tT2_fpkm\tT3_fpkm\tTvsC_log2FoldChange\tTvsC_padj\tgene_length\tgene_name
g1\t100\t110\t105\t420\t440\t410\t2.1\t2.2\t2.0\t8.4\t8.8\t8.2\t2.0\t0.001\t1200\tGene1
g2\t500\t520\t490\t180\t190\t170\t10.0\t10.4\t9.8\t3.6\t3.8\t3.4\t-1.5\t0.004\t980\tGene2
g3\t80\t85\t78\t250\t265\t245\t1.6\t1.7\t1.5\t5.0\t5.3\t4.9\t1.7\t0.008\t1500\tGene3
g4\t300\t315\t290\t305\t295\t310\t6.0\t6.3\t5.8\t6.1\t5.9\t6.2\t0.0\t0.9\t2000\tGene4
g5\t45\t50\t48\t160\t170\t155\t0.9\t1.0\t0.96\t3.2\t3.4\t3.1\t1.8\t0.002\t700\tGene5
g6\t720\t700\t735\t400\t420\t390\t14.4\t14.0\t14.7\t8.0\t8.4\t7.8\t-0.9\t0.03\t1100\tGene6`;

describe("Visualization Studio PCA", () => {
  it("prefers raw-count sample columns in a mixed RNA-seq results table", () => {
    const result = analyzeExpressionMatrix(mixedExpressionTable, { dataLayer: "auto", topVariableFeatures: 2_000, scaleFeatures: false });
    expect(result.dataset.errors).toEqual([]);
    expect(result.detectedLayer).toBe("counts");
    expect(result.sampleColumns).toEqual(["C1_count", "C2_count", "C3_count", "T1_count", "T2_count", "T3_count"]);
    expect(result.sampleNames).toEqual(["C1", "C2", "C3", "T1", "T2", "T3"]);
    expect(result.groups).toEqual(["C", "T"]);
    expect(result.dataset.rows).toHaveLength(6);
    expect(result.explainedVariance.slice(0, 2).every((value) => value > 0)).toBe(true);
    expect(result.explainedVariance.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 8);
    expect(result.transformation).toContain("log₂(CPM + 1)");
  });

  it("switches the same mixed table to the FPKM layer explicitly", () => {
    const result = analyzeExpressionMatrix(mixedExpressionTable, { dataLayer: "abundance", topVariableFeatures: 500, scaleFeatures: false });
    expect(result.dataset.errors).toEqual([]);
    expect(result.detectedLayer).toBe("abundance");
    expect(result.sampleColumns).toEqual(["C1_fpkm", "C2_fpkm", "C3_fpkm", "T1_fpkm", "T2_fpkm", "T3_fpkm"]);
    expect(result.transformation).toBe("log₂(non-negative abundance + 1)");
  });

  it("excludes numeric gene annotations from a plain count matrix", () => {
    const raw = `gene_id\tA1\tA2\tA3\tgene_start\tgene_end\tgene_length\nG1\t10\t12\t11\t100\t200\t101\nG2\t40\t42\t38\t300\t500\t201\nG3\t80\t75\t85\t600\t800\t201\nG4\t20\t18\t22\t900\t950\t51`;
    const result = analyzeExpressionMatrix(raw, { dataLayer: "auto", topVariableFeatures: 500, scaleFeatures: false });
    expect(result.dataset.errors).toEqual([]);
    expect(result.sampleColumns).toEqual(["A1", "A2", "A3"]);
    expect(result.detectedLayer).toBe("counts");
  });

  it("infers replicate groups without collapsing biological names", () => {
    expect(inferPcaGroup("H151_4")).toBe("H151");
    expect(inferPcaGroup("F_Pep_H151_2")).toBe("F_Pep_H151");
    expect(inferPcaGroup("Control-3")).toBe("Control");
  });
});
