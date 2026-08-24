import { describe, expect, it } from "vitest";
import {
  buildSetMemberships,
  correlation,
  correlationPValue,
  correlationMatrix,
  cutHierarchicalCluster,
  hierarchicalClusterOrder,
  hierarchicalClusterTree,
  kaplanMeier,
  rankValues,
  rocCurve,
  upsetVerticalLayout,
  vennRegionLayout,
} from "@/lib/visualization-advanced";

describe("advanced visualization statistics", () => {
  it("assigns average ranks to ties", () => {
    expect(rankValues([30, 10, 20, 20])).toEqual([4, 1, 2.5, 2.5]);
  });

  it("calculates Pearson and Spearman correlations", () => {
    expect(correlation([1, 2, 3], [2, 4, 6], "pearson")).toBeCloseTo(1);
    expect(correlation([1, 2, 3], [9, 4, 1], "spearman")).toBeCloseTo(-1);
    expect(correlationMatrix([[1, 5], [2, 4], [3, 3]], "pearson")[0][1]).toBeCloseTo(-1);
    expect(Number.isNaN(correlation([1, 1, 1], [2, 3, 4], "pearson"))).toBe(true);
    expect(Number.isNaN(correlation([1, 1, 1], [2, 3, 4], "spearman"))).toBe(true);
  });

  it("calculates two-sided correlation P values from the t distribution", () => {
    expect(correlationPValue(0, 10)).toBeCloseTo(1, 12);
    expect(correlationPValue(0.5, 10)).toBeCloseTo(0.141113, 5);
    expect(correlationPValue(-0.5, 10)).toBeCloseTo(0.141113, 5);
    expect(correlationPValue(1, 10)).toBe(0);
    expect(Number.isNaN(correlationPValue(0.5, 2))).toBe(true);
  });

  it("returns every vector exactly once in deterministic clustering order", () => {
    const order = hierarchicalClusterOrder([[0, 0], [0.1, 0.1], [10, 10], [10.1, 10.1]]);
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
    expect(Math.abs(order.indexOf(0) - order.indexOf(1))).toBe(1);
    expect(Math.abs(order.indexOf(2) - order.indexOf(3))).toBe(1);
  });

  it("supports explicit distance/linkage choices and reproducible cluster cuts", () => {
    const vectors = [[0, 0, 0], [0.1, 0.1, 0.1], [8, 8, 8], [8.2, 8.1, 8.3]];
    for (const linkage of ["average", "complete", "single"] as const) {
      const tree = hierarchicalClusterTree(vectors, "euclidean", linkage);
      expect(tree?.order).toEqual(hierarchicalClusterOrder(vectors, "euclidean", linkage));
      const cuts = cutHierarchicalCluster(tree, 2);
      expect(cuts[0]).toBe(cuts[1]);
      expect(cuts[2]).toBe(cuts[3]);
      expect(cuts[0]).not.toBe(cuts[2]);
    }
    expect(() => hierarchicalClusterTree(vectors, "correlation", "average")).toThrow(/zero-variance/);
  });

  it("clusters the maximum supported 250 × 100 matrix without repeated vector-distance expansion", () => {
    const vectors = Array.from({ length: 250 }, (_, row) => Array.from({ length: 100 }, (_, column) => Math.sin(row * 0.17 + column * 0.11) + row * 0.002));
    const started = performance.now();
    const tree = hierarchicalClusterTree(vectors, "euclidean", "average");
    expect(tree?.order).toHaveLength(250);
    expect(performance.now() - started).toBeLessThan(3_000);
  });

  it("computes Kaplan-Meier survival after tied events and censoring", () => {
    const curve = kaplanMeier([{ time: 2, event: 1 }, { time: 2, event: 0 }, { time: 4, event: 1 }]);
    expect(curve[1]).toMatchObject({ time: 2, atRisk: 3, events: 1, censored: 1 });
    expect(curve[1].survival).toBeCloseTo(2 / 3);
    expect(curve[2].survival).toBeCloseTo(0);
  });

  it("computes ROC AUC and rejects one-class inputs", () => {
    expect(rocCurve([{ truth: 1, score: 0.9 }, { truth: 0, score: 0.1 }]).auc).toBeCloseTo(1);
    expect(Number.isNaN(rocCurve([{ truth: 1, score: 0.9 }]).auc)).toBe(true);
  });

  it("deduplicates long-format set memberships", () => {
    const result = buildSetMemberships([
      { item: "A", set: "S1" }, { item: "A", set: "S1" }, { item: "A", set: "S2" }, { item: "B", set: "S2" },
    ], "item", "set");
    expect(result.setSizes.get("S1")).toBe(1);
    expect(result.intersections.find((entry) => entry.sets.length === 2)?.size).toBe(1);
  });

  it("places all seven three-set Venn regions at distinct coordinates", () => {
    const layout = vennRegionLayout([[100, 100], [160, 100], [130, 160]], 70);
    const regionPoints = [...layout.only, ...layout.pairs, layout.triple].filter((point): point is [number, number] => point !== null);
    expect(regionPoints).toHaveLength(7);
    expect(new Set(regionPoints.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`))).toHaveLength(7);
    expect(layout.setLabels[2][1]).toBeGreaterThan(230);
  });

  it("anchors the UpSet membership matrix near the bottom at any canvas height", () => {
    const compact = upsetVerticalLayout(24, 198, 3);
    const tall = upsetVerticalLayout(24, 798, 3);
    expect(compact.contentBottom).toBe(206);
    expect(tall.contentBottom).toBe(806);
    expect(compact.contentBottom - (compact.matrixTop + compact.rowGap * 2)).toBeCloseTo(0);
    expect(tall.contentBottom - (tall.matrixTop + tall.rowGap * 2)).toBeCloseTo(0);
    expect(tall.barHeight).toBeGreaterThan(compact.barHeight);
  });
});
