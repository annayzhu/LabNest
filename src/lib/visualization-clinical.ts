import { rocCurve } from "./visualization-advanced";

export type BinaryPrediction = { truth: 0 | 1; score: number };

export function precisionRecallCurve(rows: BinaryPrediction[]) {
  const sorted = [...rows].sort((a, b) => b.score - a.score); const positives = rows.filter((row) => row.truth === 1).length;
  let tp = 0; let fp = 0; const points = [{ recall: 0, precision: 1 }];
  for (let start = 0; start < sorted.length;) {
    let end = start + 1;
    while (end < sorted.length && sorted[end].score === sorted[start].score) end += 1;
    for (let index = start; index < end; index += 1) { if (sorted[index].truth === 1) tp += 1; else fp += 1; }
    points.push({ recall: positives ? tp / positives : 0, precision: tp / Math.max(1, tp + fp) });
    start = end;
  }
  let auprc = 0; for (let index = 1; index < points.length; index += 1) auprc += (points[index].recall - points[index - 1].recall) * points[index].precision;
  return { points, auprc, prevalence: rows.length ? positives / rows.length : 0 };
}

export function calibrationBins(rows: BinaryPrediction[], binCount = 8) {
  const sorted = [...rows].sort((a, b) => a.score - b.score); const bins: Array<{ predicted: number; observed: number; lower: number; upper: number; n: number }> = [];
  const targetSize = Math.max(1, Math.ceil(sorted.length / binCount));
  for (let start = 0; start < sorted.length;) {
    let end = Math.min(sorted.length, start + targetSize);
    while (end < sorted.length && sorted[end].score === sorted[end - 1].score) end += 1;
    const bin = sorted.slice(start, end); const n = bin.length;
    const predicted = bin.reduce((sum, row) => sum + row.score, 0) / n; const observed = bin.reduce((sum, row) => sum + row.truth, 0) / n;
    const z = 1.96; const denominator = 1 + z * z / n; const center = (observed + z * z / (2 * n)) / denominator; const half = z * Math.sqrt(observed * (1 - observed) / n + z * z / (4 * n * n)) / denominator;
    bins.push({ predicted, observed, lower: Math.max(0, center - half), upper: Math.min(1, center + half), n });
    start = end;
  }
  return bins;
}

export function decisionCurve(rows: BinaryPrediction[], thresholds = Array.from({ length: 16 }, (_, index) => 0.05 + index * 0.05)) {
  const n = Math.max(1, rows.length); const prevalence = rows.filter((row) => row.truth === 1).length / n;
  return thresholds.map((threshold) => {
    const selected = rows.filter((row) => row.score >= threshold); const tp = selected.filter((row) => row.truth === 1).length; const fp = selected.length - tp; const odds = threshold / (1 - threshold);
    return { threshold, model: tp / n - fp / n * odds, all: prevalence - (1 - prevalence) * odds, none: 0 };
  });
}

export function binaryRoc(rows: BinaryPrediction[]) { return rocCurve(rows); }
