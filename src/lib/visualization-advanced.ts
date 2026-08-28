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
  if (pairs.length < 2) return Number.NaN;
  const meanX = mean(pairs.map(([a]) => a));
  const meanY = mean(pairs.map(([, b]) => b));
  const numerator = pairs.reduce((sum, [a, b]) => sum + (a - meanX) * (b - meanY), 0);
  const denominatorX = Math.sqrt(pairs.reduce((sum, [a]) => sum + (a - meanX) ** 2, 0));
  const denominatorY = Math.sqrt(pairs.reduce((sum, [, b]) => sum + (b - meanY) ** 2, 0));
  return denominatorX > 0 && denominatorY > 0 ? numerator / (denominatorX * denominatorY) : Number.NaN;
}

export function correlation(x: number[], y: number[], method: CorrelationMethod) {
  return method === "spearman" ? pearsonCorrelation(rankValues(x), rankValues(y)) : pearsonCorrelation(x, y);
}

function logGamma(value: number): number {
  const coefficients = [676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406, 12.507343278686905, -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7];
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  const shifted = value - 1;
  let series = 0.9999999999998099;
  coefficients.forEach((coefficient, index) => { series += coefficient / (shifted + index + 1); });
  const t = shifted + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(series);
}

function betaContinuedFraction(a: number, b: number, x: number) {
  const maximumIterations = 200;
  const epsilon = 3e-14;
  const floor = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - qab * x / qap;
  if (Math.abs(d) < floor) d = floor;
  d = 1 / d;
  let result = d;
  for (let iteration = 1; iteration <= maximumIterations; iteration += 1) {
    const doubled = iteration * 2;
    let numerator = iteration * (b - iteration) * x / ((qam + doubled) * (a + doubled));
    d = 1 + numerator * d; if (Math.abs(d) < floor) d = floor;
    c = 1 + numerator / c; if (Math.abs(c) < floor) c = floor;
    d = 1 / d; result *= d * c;
    numerator = -(a + iteration) * (qab + iteration) * x / ((a + doubled) * (qap + doubled));
    d = 1 + numerator * d; if (Math.abs(d) < floor) d = floor;
    c = 1 + numerator / c; if (Math.abs(c) < floor) c = floor;
    d = 1 / d;
    const delta = d * c;
    result *= delta;
    if (Math.abs(delta - 1) < epsilon) break;
  }
  return result;
}

export function regularizedIncompleteBeta(x: number, a: number, b: number) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2)
    ? front * betaContinuedFraction(a, b, x) / a
    : 1 - front * betaContinuedFraction(b, a, 1 - x) / b;
}

export function correlationPValue(coefficient: number, sampleSize: number) {
  if (sampleSize < 3 || !Number.isFinite(coefficient)) return Number.NaN;
  const bounded = Math.max(-1, Math.min(1, coefficient));
  if (Math.abs(bounded) >= 1) return 0;
  const degreesOfFreedom = sampleSize - 2;
  const tSquared = bounded ** 2 * degreesOfFreedom / Math.max(Number.EPSILON, 1 - bounded ** 2);
  return Math.max(0, Math.min(1, regularizedIncompleteBeta(degreesOfFreedom / (degreesOfFreedom + tSquared), degreesOfFreedom / 2, 0.5)));
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

export type ClusterDistance = "euclidean" | "correlation";
export type ClusterLinkage = "average" | "complete" | "single";
export type HierarchicalClusterNode = {
  id: string;
  members: number[];
  order: number[];
  height: number;
  left?: HierarchicalClusterNode;
  right?: HierarchicalClusterNode;
};

function vectorDistance(left: number[], right: number[], distance: ClusterDistance) {
  if (distance === "correlation") {
    const coefficient = pearsonCorrelation(left, right);
    if (!Number.isFinite(coefficient)) throw new Error("Correlation distance is undefined for a zero-variance vector.");
    return Math.max(0, 1 - coefficient);
  }
  return euclidean(left, right);
}

export function hierarchicalClusterTree(
  vectors: number[][],
  distance: ClusterDistance = "euclidean",
  linkage: ClusterLinkage = "average",
): HierarchicalClusterNode | null {
  if (vectors.length === 0) return null;
  const clusters: HierarchicalClusterNode[] = vectors.map((_, index) => ({ id: `leaf-${index}`, members: [index], order: [index], height: 0 }));
  const distances = new Map<string, number>();
  const distanceKey = (left: HierarchicalClusterNode, right: HierarchicalClusterNode) => left.id < right.id ? `${left.id}\u0000${right.id}` : `${right.id}\u0000${left.id}`;
  const getDistance = (left: HierarchicalClusterNode, right: HierarchicalClusterNode) => distances.get(distanceKey(left, right)) ?? Number.POSITIVE_INFINITY;
  for (let left = 0; left < clusters.length; left += 1) {
    for (let right = left + 1; right < clusters.length; right += 1) distances.set(distanceKey(clusters[left], clusters[right]), vectorDistance(vectors[left], vectors[right], distance));
  }
  while (clusters.length > 1) {
    let bestI = 0;
    let bestJ = 1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < clusters.length; i += 1) {
      for (let j = i + 1; j < clusters.length; j += 1) {
        const candidateDistance = getDistance(clusters[i], clusters[j]);
        if (candidateDistance < bestDistance - 1e-12) {
          bestDistance = candidateDistance;
          bestI = i;
          bestJ = j;
        }
      }
    }
    const left = clusters[bestI];
    const right = clusters[bestJ];
    const merged: HierarchicalClusterNode = {
      id: `node-${left.id}-${right.id}`,
      members: [...left.members, ...right.members],
      order: [...left.order, ...right.order],
      height: bestDistance,
      left,
      right,
    };
    const updatedDistances = clusters.flatMap((other) => {
      if (other === left || other === right) return;
      const leftDistance = getDistance(left, other);
      const rightDistance = getDistance(right, other);
      const mergedDistance = linkage === "single"
        ? Math.min(leftDistance, rightDistance)
        : linkage === "complete"
          ? Math.max(leftDistance, rightDistance)
          : (left.members.length * leftDistance + right.members.length * rightDistance) / (left.members.length + right.members.length);
      return [{ other, mergedDistance }];
    }).filter((entry): entry is { other: HierarchicalClusterNode; mergedDistance: number } => Boolean(entry));
    [...distances.keys()].forEach((key) => {
      const [firstId, secondId] = key.split("\u0000");
      if (firstId === left.id || secondId === left.id || firstId === right.id || secondId === right.id) distances.delete(key);
    });
    updatedDistances.forEach(({ other, mergedDistance }) => distances.set(distanceKey(merged, other), mergedDistance));
    clusters.splice(bestJ, 1);
    clusters.splice(bestI, 1, merged);
  }
  return clusters[0];
}

export function hierarchicalClusterOrder(
  vectors: number[][],
  distance: ClusterDistance = "euclidean",
  linkage: ClusterLinkage = "average",
) {
  return hierarchicalClusterTree(vectors, distance, linkage)?.order ?? [];
}

export function cutHierarchicalCluster(tree: HierarchicalClusterNode | null, clusterCount: number) {
  if (!tree) return [];
  const requested = Math.max(1, Math.min(Math.floor(clusterCount), tree.members.length));
  const clusters = [tree];
  while (clusters.length < requested) {
    const splittable = clusters
      .map((node, index) => ({ node, index }))
      .filter(({ node }) => node.left && node.right)
      .sort((a, b) => b.node.height - a.node.height || Math.min(...a.node.members) - Math.min(...b.node.members))[0];
    if (!splittable?.node.left || !splittable.node.right) break;
    clusters.splice(splittable.index, 1, splittable.node.left, splittable.node.right);
  }
  clusters.sort((left, right) => Math.min(...left.members) - Math.min(...right.members));
  const labels = Array(tree.members.length).fill(0) as number[];
  clusters.forEach((node, clusterIndex) => node.members.forEach((member) => { labels[member] = clusterIndex; }));
  return labels;
}

export type KaplanMeierPoint = { time: number; survival: number; atRisk: number; events: number; censored: number };

export function kaplanMeier(records: Array<{ time: number; event: 0 | 1 }>) {
  const ordered = [...records].sort((a, b) => a.time - b.time || b.event - a.event);
  const points: KaplanMeierPoint[] = [{ time: 0, survival: 1, atRisk: ordered.length, events: 0, censored: 0 }];
  let survival = 1;
  let atRisk = ordered.length;
  for (let start = 0; start < ordered.length;) {
    const time = ordered[start].time;
    let end = start; let events = 0;
    while (end < ordered.length && ordered[end].time === time) { if (ordered[end].event === 1) events += 1; end += 1; }
    const countAtTime = end - start;
    const censored = countAtTime - events;
    if (atRisk > 0 && events > 0) survival *= 1 - events / atRisk;
    points.push({ time, survival, atRisk, events, censored });
    atRisk -= countAtTime;
    start = end;
  }
  return points;
}

export type RocPoint = { fpr: number; tpr: number; threshold: number };

export function rocCurve(records: Array<{ truth: 0 | 1; score: number }>) {
  const positives = records.filter((record) => record.truth === 1).length;
  const negatives = records.length - positives;
  if (positives === 0 || negatives === 0) return { points: [] as RocPoint[], auc: Number.NaN };
  const ordered = [...records].sort((a, b) => b.score - a.score);
  const unique: RocPoint[] = [{ fpr: 0, tpr: 0, threshold: Number.POSITIVE_INFINITY }];
  let truePositive = 0; let falsePositive = 0;
  for (let start = 0; start < ordered.length;) {
    const threshold = ordered[start].score; let end = start;
    while (end < ordered.length && ordered[end].score === threshold) { if (ordered[end].truth === 1) truePositive += 1; else falsePositive += 1; end += 1; }
    unique.push({ fpr: falsePositive / negatives, tpr: truePositive / positives, threshold });
    start = end;
  }
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
