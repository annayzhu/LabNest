import { parseNumericValue, type DelimitedRow } from "@/lib/visualization-studio";

export type CorrelationMethod = "pearson" | "spearman";

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

export function rankValues(values: number[]) {
  const indexed = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value || a.index - b.index);
  const ranks = Array(values.length).fill(0) as number[];
  let start = 0;
  while (start < indexed.length) {
    let end = start;
    while (end + 1 < indexed.length && indexed[end + 1].value === indexed[start].value) end += 1;
    const averageRank = (start + end + 2) / 2;
    for (let cursor = start; cursor <= end; cursor += 1) ranks[indexed[cursor].index] = averageRank;
    start = end + 1;
  }
  return ranks;
}

export function pearsonCorrelation(x: number[], y: number[]) {
  const pairs = x.map((value, index) => [value, y[index]] as const).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
  if (pairs.length < 2) return 0;
  const meanX = mean(pairs.map(([a]) => a));
  const meanY = mean(pairs.map(([, b]) => b));
  const numerator = pairs.reduce((sum, [a, b]) => sum + (a - meanX) * (b - meanY), 0);
  const denominatorX = Math.sqrt(pairs.reduce((sum, [a]) => sum + (a - meanX) ** 2, 0));
  const denominatorY = Math.sqrt(pairs.reduce((sum, [, b]) => sum + (b - meanY) ** 2, 0));
  return denominatorX > 0 && denominatorY > 0 ? numerator / (denominatorX * denominatorY) : 0;
}

export function correlation(x: number[], y: number[], method: CorrelationMethod) {
  return method === "spearman" ? pearsonCorrelation(rankValues(x), rankValues(y)) : pearsonCorrelation(x, y);
}

export function matrixFromRows(rows: DelimitedRow[], columns: string[]) {
  return rows.map((row) => columns.map((column) => parseNumericValue(row[column]) ?? 0));
}

export function correlationMatrix(matrix: number[][], method: CorrelationMethod) {
  const columnCount = matrix[0]?.length ?? 0;
  const columns = Array.from({ length: columnCount }, (_, column) => matrix.map((row) => row[column]));
  return columns.map((left) => columns.map((right) => correlation(left, right, method)));
}

function euclidean(left: number[], right: number[]) {
  return Math.sqrt(left.reduce((sum, value, index) => sum + (value - right[index]) ** 2, 0));
}

export function hierarchicalClusterOrder(vectors: number[][]) {
  if (vectors.length <= 1) return vectors.map((_, index) => index);
  type Cluster = { members: number[]; order: number[] };
  const clusters: Cluster[] = vectors.map((_, index) => ({ members: [index], order: [index] }));
  const averageDistance = (left: Cluster, right: Cluster) => {
    const distances = left.members.flatMap((a) => right.members.map((b) => euclidean(vectors[a], vectors[b])));
    return mean(distances);
  };
  while (clusters.length > 1) {
    let bestI = 0;
    let bestJ = 1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < clusters.length; i += 1) {
      for (let j = i + 1; j < clusters.length; j += 1) {
        const distance = averageDistance(clusters[i], clusters[j]);
        if (distance < bestDistance - 1e-12) {
          bestDistance = distance;
          bestI = i;
          bestJ = j;
        }
      }
    }
    const left = clusters[bestI];
    const right = clusters[bestJ];
    const merged: Cluster = { members: [...left.members, ...right.members], order: [...left.order, ...right.order] };
    clusters.splice(bestJ, 1);
    clusters.splice(bestI, 1, merged);
  }
  return clusters[0].order;
}

export type KaplanMeierPoint = { time: number; survival: number; atRisk: number; events: number; censored: number };

export function kaplanMeier(records: Array<{ time: number; event: 0 | 1 }>) {
  const ordered = [...records].sort((a, b) => a.time - b.time || b.event - a.event);
  const times = [...new Set(ordered.map((record) => record.time))];
  const points: KaplanMeierPoint[] = [{ time: 0, survival: 1, atRisk: ordered.length, events: 0, censored: 0 }];
  let survival = 1;
  let atRisk = ordered.length;
  times.forEach((time) => {
    const recordsAtTime = ordered.filter((record) => record.time === time);
    const events = recordsAtTime.filter((record) => record.event === 1).length;
    const censored = recordsAtTime.length - events;
    if (atRisk > 0 && events > 0) survival *= 1 - events / atRisk;
    points.push({ time, survival, atRisk, events, censored });
    atRisk -= recordsAtTime.length;
  });
  return points;
}

export type RocPoint = { fpr: number; tpr: number; threshold: number };

export function rocCurve(records: Array<{ truth: 0 | 1; score: number }>) {
  const positives = records.filter((record) => record.truth === 1).length;
  const negatives = records.length - positives;
  if (positives === 0 || negatives === 0) return { points: [] as RocPoint[], auc: Number.NaN };
  const thresholds = [Number.POSITIVE_INFINITY, ...[...new Set(records.map((record) => record.score))].sort((a, b) => b - a), Number.NEGATIVE_INFINITY];
  const points = thresholds.map((threshold) => {
    const predictedPositive = records.filter((record) => record.score >= threshold);
    const truePositive = predictedPositive.filter((record) => record.truth === 1).length;
    const falsePositive = predictedPositive.length - truePositive;
    return { fpr: falsePositive / negatives, tpr: truePositive / positives, threshold };
  });
  const unique = points.filter((point, index) => index === 0 || point.fpr !== points[index - 1].fpr || point.tpr !== points[index - 1].tpr);
  const auc = unique.slice(1).reduce((sum, point, index) => {
    const previous = unique[index];
    return sum + (point.fpr - previous.fpr) * (point.tpr + previous.tpr) / 2;
  }, 0);
  return { points: unique, auc };
}

export function buildSetMemberships(rows: DelimitedRow[], itemColumn: string, setColumn: string) {
  const memberships = new Map<string, Set<string>>();
  rows.forEach((row) => {
    const item = row[itemColumn]?.trim();
    const set = row[setColumn]?.trim();
    if (!item || !set) return;
    const current = memberships.get(item) ?? new Set<string>();
    current.add(set);
    memberships.set(item, current);
  });
  const sets = [...new Set([...memberships.values()].flatMap((membership) => [...membership]))];
  const intersections = new Map<string, number>();
  memberships.forEach((membership) => {
    const signature = sets.filter((set) => membership.has(set)).join("\u0001");
    intersections.set(signature, (intersections.get(signature) ?? 0) + 1);
  });
  return {
    sets,
    memberships,
    setSizes: new Map(sets.map((set) => [set, [...memberships.values()].filter((membership) => membership.has(set)).length])),
    intersections: [...intersections.entries()].map(([signature, size]) => ({ sets: signature.split("\u0001").filter(Boolean), size })).sort((a, b) => b.size - a.size || a.sets.length - b.sets.length),
  };
}

export function vennRegionLayout(centers: Array<[number, number]>, radius: number) {
  if (centers.length === 2) {
    const [left, right] = centers;
    return {
      setLabels: [
        [left[0] - radius * 0.2, left[1] - radius - 12] as [number, number],
        [right[0] + radius * 0.2, right[1] - radius - 12] as [number, number],
      ],
      only: [
        [left[0] - radius * 0.52, left[1] + 4] as [number, number],
        [right[0] + radius * 0.52, right[1] + 4] as [number, number],
      ],
      pairs: [[(left[0] + right[0]) / 2, (left[1] + right[1]) / 2 + 4] as [number, number]],
      triple: null,
    };
  }
  const [left, right, bottom] = centers;
  return {
    setLabels: [
      [left[0] - radius * 0.24, left[1] - radius - 12] as [number, number],
      [right[0] + radius * 0.24, right[1] - radius - 12] as [number, number],
      [bottom[0], bottom[1] + radius + 22] as [number, number],
    ],
    only: [
      [left[0] - radius * 0.58, left[1] - radius * 0.03] as [number, number],
      [right[0] + radius * 0.58, right[1] - radius * 0.03] as [number, number],
      [bottom[0], bottom[1] + radius * 0.56] as [number, number],
    ],
    pairs: [
      [(left[0] + right[0]) / 2, left[1] - radius * 0.48] as [number, number],
      [bottom[0] - radius * 0.34, bottom[1] + radius * 0.03] as [number, number],
      [bottom[0] + radius * 0.34, bottom[1] + radius * 0.03] as [number, number],
    ],
    triple: [(left[0] + right[0] + bottom[0]) / 3, left[1] + radius * 0.35] as [number, number],
  };
}

export function upsetVerticalLayout(frameTop: number, plotHeight: number, setCount: number) {
  const safeSetCount = Math.max(1, setCount);
  const rowGap = Math.max(18, Math.min(32, plotHeight / (safeSetCount + 8)));
  const contentBottom = frameTop + plotHeight - 16;
  const matrixTop = contentBottom - (safeSetCount - 1) * rowGap;
  const baseline = matrixTop - 24;
  const barTop = frameTop + 36;
  return {
    rowGap,
    contentBottom,
    matrixTop,
    baseline,
    barTop,
    barHeight: Math.max(24, baseline - barTop),
  };
}
