import { normalizeChromosome } from "./visualization-genomics";

export type SetInputMode = "auto" | "membership" | "peak-overlap";
export type SetRow = Record<string, string>;

export type SetMemberMetadata = {
  chromosome?: string;
  start?: number;
  end?: number;
  contributingRecords: string[];
};

export type ExactIntersection = {
  signature: string;
  sets: string[];
  size: number;
  items: string[];
};

export type SetIntersectionAnalysis = {
  mode: Exclude<SetInputMode, "auto">;
  sets: string[];
  memberships: Map<string, Set<string>>;
  metadata: Map<string, SetMemberMetadata>;
  setSizes: Map<string, number>;
  intersections: ExactIntersection[];
  duplicatesCollapsed: number;
  invalidRows: number[];
  sourceRows: number;
  safetyError?: string;
};

const MAX_SET_ROWS = 20_000;
const MAX_SET_COUNT = 20;
const MAX_PROVENANCE_LINKS = 200_000;

function clean(value: string | undefined) { return String(value ?? "").trim(); }

export function resolveSetInputMode(rows: SetRow[], mapping: Record<string, string>, requested: SetInputMode): Exclude<SetInputMode, "auto"> {
  if (requested !== "auto") return requested;
  const intervalColumns = [mapping.chromosome, mapping.start, mapping.end];
  return intervalColumns.every(Boolean) && rows.some((row) => intervalColumns.every((column) => clean(row[column]))) ? "peak-overlap" : "membership";
}

function finalizeAnalysis(mode: Exclude<SetInputMode, "auto">, sets: string[], memberships: Map<string, Set<string>>, metadata: Map<string, SetMemberMetadata>, duplicatesCollapsed: number, invalidRows: number[], sourceRows: number): SetIntersectionAnalysis {
  const intersectionItems = new Map<string, string[]>();
  memberships.forEach((membership, item) => {
    const signature = sets.filter((set) => membership.has(set)).join("\u0001");
    if (!signature) return;
    const items = intersectionItems.get(signature) ?? [];
    items.push(item);
    intersectionItems.set(signature, items);
  });
  const intersections = [...intersectionItems.entries()].map(([signature, items]) => ({ signature, sets: signature.split("\u0001"), size: items.length, items: [...items].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) })).sort((a, b) => b.size - a.size || a.sets.length - b.sets.length || a.signature.localeCompare(b.signature));
  return {
    mode,
    sets,
    memberships,
    metadata,
    setSizes: new Map(sets.map((set) => [set, [...memberships.values()].filter((membership) => membership.has(set)).length])),
    intersections,
    duplicatesCollapsed,
    invalidRows,
    sourceRows,
  };
}

export function analyzeSetIntersections(rows: SetRow[], mapping: Record<string, string>, requested: SetInputMode = "auto"): SetIntersectionAnalysis {
  const mode = resolveSetInputMode(rows, mapping, requested);
  const detectedSets = [...new Set(rows.map((row) => clean(row[mapping.set])).filter(Boolean))];
  const stoppedAnalysis = (safetyError: string): SetIntersectionAnalysis => ({ mode, sets: detectedSets, memberships: new Map(), metadata: new Map(), setSizes: new Map(), intersections: [], duplicatesCollapsed: 0, invalidRows: [], sourceRows: rows.length, safetyError });
  if (rows.length > MAX_SET_ROWS) return stoppedAnalysis(`Set-intersection analysis accepts at most ${MAX_SET_ROWS.toLocaleString()} input rows; detected ${rows.length.toLocaleString()}.`);
  if (detectedSets.length > MAX_SET_COUNT) return stoppedAnalysis(`Set-intersection analysis accepts at most ${MAX_SET_COUNT} sets; detected ${detectedSets.length}.`);
  const sets: string[] = [];
  const rememberSet = (set: string) => { if (set && !sets.includes(set)) sets.push(set); };
  const memberships = new Map<string, Set<string>>();
  const metadata = new Map<string, SetMemberMetadata>();
  const invalidRows: number[] = [];
  let duplicatesCollapsed = 0;

  if (mode === "membership") {
    rows.forEach((row, index) => {
      const item = clean(row[mapping.item]); const set = clean(row[mapping.set]);
      if (!item || !set) { invalidRows.push(index + 2); return; }
      rememberSet(set);
      const membership = memberships.get(item) ?? new Set<string>();
      if (membership.has(set)) duplicatesCollapsed += 1;
      membership.add(set); memberships.set(item, membership);
      metadata.set(item, { contributingRecords: [item] });
    });
    return finalizeAnalysis(mode, sets, memberships, metadata, duplicatesCollapsed, invalidRows, rows.length);
  }

  type Peak = { chromosome: string; start: number; end: number; set: string; label: string; row: number };
  const peaks: Peak[] = [];
  const peakKeys = new Set<string>();
  rows.forEach((row, index) => {
    const chromosomeText = clean(row[mapping.chromosome]); const chromosome = normalizeChromosome(chromosomeText); const set = clean(row[mapping.set]);
    const startText = clean(row[mapping.start]); const endText = clean(row[mapping.end]); const start = Number(startText); const end = Number(endText);
    if (!chromosomeText || !chromosome || !set || !startText || !endText || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start) { invalidRows.push(index + 2); return; }
    rememberSet(set);
    const key = `${chromosome}\u0000${start}\u0000${end}\u0000${set}`;
    if (peakKeys.has(key)) { duplicatesCollapsed += 1; return; }
    peakKeys.add(key);
    peaks.push({ chromosome, start, end, set, label: clean(row[mapping.item]) || `${set}:${chromosome}:${start}-${end}`, row: index + 2 });
  });
  const byChromosome = new Map<string, Peak[]>();
  peaks.forEach((peak) => { const list = byChromosome.get(peak.chromosome) ?? []; list.push(peak); byChromosome.set(peak.chromosome, list); });
  let segmentIndex = 0; let provenanceOverflow = false; let provenanceLinks = 0;
  byChromosome.forEach((chromosomePeaks, chromosome) => {
    if (provenanceOverflow) return;
    const events = new Map<number, { add: Peak[]; remove: Peak[] }>();
    const eventAt = (position: number) => { const event = events.get(position) ?? { add: [], remove: [] }; events.set(position, event); return event; };
    chromosomePeaks.forEach((peak) => { eventAt(peak.start).add.push(peak); eventAt(peak.end).remove.push(peak); });
    const positions = [...events.keys()].sort((a, b) => a - b); const activeCounts = new Map<string, number>(); const activeLabels = new Map<number, string>();
    type AtomicSegment = { start: number; end: number; sets: Set<string>; labels: Set<string>; signature: string };
    const segments: AtomicSegment[] = []; let current: AtomicSegment | null = null;
    for (let positionIndex = 0; positionIndex < positions.length - 1; positionIndex += 1) {
      const position = positions[positionIndex];
      const event = events.get(position)!;
      event.remove.forEach((peak) => { activeLabels.delete(peak.row); const next = (activeCounts.get(peak.set) ?? 1) - 1; if (next <= 0) activeCounts.delete(peak.set); else activeCounts.set(peak.set, next); });
      event.add.forEach((peak) => { activeLabels.set(peak.row, peak.label); activeCounts.set(peak.set, (activeCounts.get(peak.set) ?? 0) + 1); });
      const next = positions[positionIndex + 1];
      if (next <= position || activeCounts.size === 0) { current = null; continue; }
      const activeSets = new Set(activeCounts.keys());
      const signature = sets.filter((set) => activeSets.has(set)).join("\u0001");
      if (current && current.end === position && current.signature === signature) {
        current.end = next;
        event.add.forEach((peak) => { if (!current!.labels.has(peak.label)) { current!.labels.add(peak.label); provenanceLinks += 1; } });
      } else {
        const labels = new Set(activeLabels.values()); provenanceLinks += labels.size;
        current = { start: position, end: next, sets: activeSets, labels, signature }; segments.push(current);
      }
      if (provenanceLinks > MAX_PROVENANCE_LINKS) { provenanceOverflow = true; return; }
    }
    if (provenanceOverflow) return;
    segments.forEach((segment) => {
      segmentIndex += 1; const item = `${chromosome}:${segment.start}-${segment.end}#${segmentIndex}`;
      memberships.set(item, segment.sets);
      metadata.set(item, { chromosome, start: segment.start, end: segment.end, contributingRecords: [...segment.labels] });
    });
  });
  if (provenanceOverflow) return stoppedAnalysis(`Atomic genomic segmentation would retain more than ${MAX_PROVENANCE_LINKS.toLocaleString()} segment-to-peak provenance links. Pre-merge peaks within each set or filter to a documented region.`);
  return finalizeAnalysis(mode, sets, memberships, metadata, duplicatesCollapsed, invalidRows, rows.length);
}

export function exactIntersectionCount(analysis: SetIntersectionAnalysis, wanted: string[]) {
  const signature = analysis.sets.filter((set) => wanted.includes(set)).join("\u0001");
  return analysis.intersections.find((intersection) => intersection.signature === signature)?.size ?? 0;
}

export function intersectionExportTsv(analysis: SetIntersectionAnalysis, signature: string) {
  const intersection = analysis.intersections.find((entry) => entry.signature === signature);
  if (!intersection) return "";
  if (analysis.mode === "membership") return ["item\texact_intersection", ...intersection.items.map((item) => `${item}\t${intersection.sets.join(" & ")}`)].join("\n");
  return ["atomic_segment\tchromosome\tstart\tend\texact_intersection\tcontributing_records", ...intersection.items.map((item) => { const entry = analysis.metadata.get(item); return [item, entry?.chromosome ?? "", entry?.start ?? "", entry?.end ?? "", intersection.sets.join(" & "), (entry?.contributingRecords ?? []).join("; ")].join("\t"); })].join("\n");
}

export function grayCode(value: number) { return value ^ (value >> 1); }

export function radialIntersectionLayout(analysis: SetIntersectionAnalysis, startAngle = -Math.PI / 2, sizeWeighted = false) {
  const ordered = [...analysis.intersections].sort((a, b) => {
    const mask = (entry: ExactIntersection) => analysis.sets.reduce((value, set, index) => value | (entry.sets.includes(set) ? (1 << index) : 0), 0);
    return grayCode(mask(a)) - grayCode(mask(b));
  });
  const total = ordered.reduce((sum, entry) => sum + entry.size, 0);
  const gap = Math.min(0.025, Math.PI / Math.max(120, ordered.length * 12));
  const usable = Math.PI * 2 - gap * ordered.length;
  let cursor = startAngle;
  return ordered.map((entry) => {
    const fraction = sizeWeighted ? entry.size / Math.max(total, 1) : 1 / Math.max(ordered.length, 1);
    const span = usable * fraction;
    const region = { ...entry, start: cursor, end: cursor + span, middle: cursor + span / 2, span };
    cursor += span + gap;
    return region;
  });
}

export function setDiagramLayoutMetrics(width: number, height: number, analysis: SetIntersectionAnalysis, tickSize: number, sizeWeighted: boolean) {
  const plotWidth = Math.max(100, width - 36); const plotHeight = Math.max(90, height - 82); const radius = Math.min(plotWidth, plotHeight) * 0.33;
  const regions = radialIntersectionLayout(analysis, -Math.PI / 2, sizeWeighted);
  const minimumArc = regions.length ? Math.min(...regions.map((region) => region.span * radius)) : 0;
  const minimumLabelArc = Math.max(9, tickSize * 0.88);
  return { radius, regions, minimumArc, minimumLabelArc, fits: analysis.sets.length >= 2 && analysis.sets.length <= 7 && regions.length <= 32 && minimumArc >= minimumLabelArc };
}

export function upsetAdaptiveLayout(frameTop: number, plotHeight: number, setCount: number, intersectionCount: number, plotWidth: number, tickSize: number) {
  const rowGap = Math.max(13, Math.min(25, (plotHeight * 0.36) / Math.max(1, setCount - 1)));
  const matrixHeight = Math.max(0, setCount - 1) * rowGap;
  const contentBottom = frameTop + plotHeight - 12;
  const matrixTop = contentBottom - matrixHeight;
  const baseline = matrixTop - 24;
  const barTop = frameTop + 28;
  const barHeight = Math.max(30, baseline - barTop);
  const band = plotWidth / Math.max(1, intersectionCount);
  const fits = setCount >= 2 && setCount <= 20 && rowGap >= Math.max(10, tickSize + 1) && band >= 24 && barHeight >= 30;
  return { rowGap, matrixHeight, contentBottom, matrixTop, baseline, barTop, barHeight, band, fits };
}
