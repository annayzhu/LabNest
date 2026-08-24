import { compareChromosomes, normalizeChromosome } from "./visualization-genomics";

export type FlowEdge = { source: string; target: string; value: number; group: string; rows: number };
export type AlluvialRecord = { flow: string; axis: string; stratum: string; value: number; group: string };
export type LigandReceptorRecord = { sourceCell: string; targetCell: string; ligand: string; receptor: string; value: number; evidence: string };
export type CircosRecordType = "bar" | "heatmap" | "scatter" | "label" | "link" | "fusion" | "correlation";
export type CircosTrackRecord = {
  type: CircosRecordType;
  chromosome: string;
  start: number;
  end: number;
  chromosomeLength: number;
  targetChromosome: string;
  targetStart: number;
  targetEnd: number;
  targetChromosomeLength: number;
  value: number;
  label: string;
  track: string;
};

type Row = Record<string, string>;

function number(value: string | undefined, fallback = Number.NaN) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function aggregateFlowEdges(rows: Row[], mapping: Record<string, string>): FlowEdge[] {
  const aggregate = new Map<string, FlowEdge>();
  rows.forEach((row) => {
    const source = row[mapping.source]?.trim() ?? "";
    const target = row[mapping.target]?.trim() ?? "";
    const value = number(row[mapping.value], 0);
    const group = mapping.group ? row[mapping.group]?.trim() || "Unspecified" : "All";
    if (!source || !target || !Number.isFinite(value) || value < 0) return;
    const key = `${source}\u0000${target}\u0000${group}`;
    const prior = aggregate.get(key);
    if (prior) { prior.value += value; prior.rows += 1; }
    else aggregate.set(key, { source, target, value, group, rows: 1 });
  });
  return [...aggregate.values()];
}

export function flowDisclosure(rows: Row[], mapping: Record<string, string>) {
  const edges = aggregateFlowEdges(rows, mapping);
  const inputRows = rows.length;
  const aggregatedRows = edges.reduce((sum, edge) => sum + Math.max(0, edge.rows - 1), 0);
  const total = edges.reduce((sum, edge) => sum + edge.value, 0);
  return { edges, inputRows, aggregatedRows, total };
}

export function parseAlluvialRecords(rows: Row[], mapping: Record<string, string>): AlluvialRecord[] {
  return rows.map((row) => ({
    flow: row[mapping.flow]?.trim() ?? "",
    axis: row[mapping.axis]?.trim() ?? "",
    stratum: row[mapping.stratum]?.trim() ?? "",
    value: number(row[mapping.value]),
    group: mapping.group ? row[mapping.group]?.trim() || "Unspecified" : "All",
  }));
}

export function alluvialAxisOrder(records: AlluvialRecord[]) {
  return [...new Set(records.map((record) => record.axis))];
}

export function parseLigandReceptorRecords(rows: Row[], mapping: Record<string, string>): LigandReceptorRecord[] {
  return rows.map((row) => ({
    sourceCell: row[mapping.sourceCell]?.trim() ?? "",
    targetCell: row[mapping.targetCell]?.trim() ?? "",
    ligand: row[mapping.ligand]?.trim() ?? "",
    receptor: row[mapping.receptor]?.trim() ?? "",
    value: number(row[mapping.value]),
    evidence: mapping.evidence ? row[mapping.evidence]?.trim() || "Unspecified" : "Unspecified",
  }));
}

const circosTypes = new Set<CircosRecordType>(["bar", "heatmap", "scatter", "label", "link", "fusion", "correlation"]);
export function isCircosRecordType(value: string): value is CircosRecordType {
  return circosTypes.has(value.trim().toLowerCase() as CircosRecordType);
}

export function parseCircosTrackRecords(rows: Row[], mapping: Record<string, string>): CircosTrackRecord[] {
  return rows.map((row) => {
    const rawType = row[mapping.recordType]?.trim().toLowerCase() ?? "";
    return {
      type: (isCircosRecordType(rawType) ? rawType : rawType) as CircosRecordType,
      chromosome: normalizeChromosome(row[mapping.chromosome] ?? ""),
      start: number(row[mapping.start]),
      end: number(row[mapping.end]),
      chromosomeLength: number(row[mapping.chromosomeLength]),
      targetChromosome: normalizeChromosome(row[mapping.targetChromosome] ?? ""),
      targetStart: number(row[mapping.targetStart]),
      targetEnd: number(row[mapping.targetEnd]),
      targetChromosomeLength: number(row[mapping.targetChromosomeLength]),
      value: number(row[mapping.value]),
      label: mapping.label ? row[mapping.label]?.trim() || "" : "",
      track: mapping.track ? row[mapping.track]?.trim() || rawType : rawType,
    };
  });
}

export function circosCoordinateSystem(records: CircosTrackRecord[]) {
  const lengths = new Map<string, number>();
  records.forEach((record) => {
    if (record.chromosome && Number.isFinite(record.chromosomeLength)) lengths.set(record.chromosome, record.chromosomeLength);
    if (record.targetChromosome && Number.isFinite(record.targetChromosomeLength)) lengths.set(record.targetChromosome, record.targetChromosomeLength);
  });
  const chromosomes = [...lengths.keys()].sort(compareChromosomes);
  const gap = Math.min(0.055, Math.PI / Math.max(30, chromosomes.length * 10));
  const usable = Math.PI * 2 - gap * chromosomes.length;
  const total = chromosomes.reduce((sum, chromosome) => sum + Math.max(1, lengths.get(chromosome) ?? 1), 0);
  let cursor = -Math.PI / 2;
  const sectors = new Map<string, { start: number; end: number; length: number }>();
  chromosomes.forEach((chromosome) => {
    const length = Math.max(1, lengths.get(chromosome) ?? 1);
    const span = usable * length / total;
    sectors.set(chromosome, { start: cursor, end: cursor + span, length });
    cursor += span + gap;
  });
  const angle = (chromosome: string, position: number) => {
    const sector = sectors.get(normalizeChromosome(chromosome));
    if (!sector) return Number.NaN;
    return sector.start + (sector.end - sector.start) * Math.max(0, Math.min(sector.length, position)) / sector.length;
  };
  return { chromosomes, sectors, lengths, angle };
}

export function circosTrackOrder(records: CircosTrackRecord[]) {
  return [...new Set(records.filter((record) => !["link", "fusion", "correlation"].includes(record.type)).map((record) => record.track || record.type))];
}

export function compactFlowLabel(label: string, fontSize: number, availablePixels: number) {
  const width = (value: string) => approximateFlowTextWidth(value, fontSize);
  if (width(label) <= availablePixels) return label;
  for (let length = Math.max(1, label.length - 1); length >= 1; length -= 1) {
    const candidate = `${label.slice(0, length)}…`;
    if (width(candidate) <= availablePixels) return candidate;
  }
  return "…";
}

export function approximateFlowTextWidth(value: string, fontSize: number) {
  return [...value].reduce((sum, character) => sum + (/[^\u0000-\u00ff]/.test(character) ? 1 : /[WM@%&]/.test(character) ? 0.96 : /[A-Z0-9]/.test(character) ? 0.7 : /\s/.test(character) ? 0.34 : 0.56), 0) * fontSize;
}

export function flowCircularFrame(width: number, height: number, title = false) {
  const left = 14; const right = 22; const top = title ? 48 : 24; const bottom = 58;
  return { width, height, left, right, top, bottom, plotWidth: Math.max(100, width - left - right), plotHeight: Math.max(90, height - top - bottom) };
}

export function chordSectorLayout(edges: FlowEdge[], radius: number) {
  const nodes = [...new Set(edges.flatMap((edge) => [edge.source, edge.target]))];
  const totals = new Map(nodes.map((node) => [node, edges.filter((edge) => edge.source === node || edge.target === node).reduce((sum, edge) => sum + edge.value, 0)]));
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
  const gap = 0.035; let cursor = -Math.PI / 2;
  const sectors = new Map<string, { start: number; end: number }>();
  nodes.forEach((node) => { const span = (Math.PI * 2 - nodes.length * gap) * (totals.get(node) ?? 0) / Math.max(total, Number.EPSILON); sectors.set(node, { start: cursor, end: cursor + span }); cursor += span + gap; });
  const minimumArcPixels = nodes.length ? Math.min(...nodes.map((node) => { const sector = sectors.get(node)!; return (sector.end - sector.start) * radius; })) : 0;
  return { nodes, totals, sectors, minimumArcPixels };
}

export type CircularLabelCandidate = { label: string; x: number; y: number; anchor: "start" | "middle" | "end"; fontSize: number; available: number };
export function circularLabelLayoutMetrics(candidates: CircularLabelCandidate[], width: number, height: number) {
  const boxes = candidates.map((candidate) => {
    const displayed = compactFlowLabel(candidate.label, candidate.fontSize, candidate.available);
    const textWidth = approximateFlowTextWidth(displayed, candidate.fontSize);
    const left = candidate.anchor === "start" ? candidate.x : candidate.anchor === "end" ? candidate.x - textWidth : candidate.x - textWidth / 2;
    return { left, right: left + textWidth, top: candidate.y - candidate.fontSize * 0.82, bottom: candidate.y + candidate.fontSize * 0.28 };
  });
  const outside = boxes.filter((box) => box.left < 1 || box.right > width - 1 || box.top < 1 || box.bottom > height - 1).length;
  let collisions = 0;
  for (let first = 0; first < boxes.length; first += 1) for (let second = first + 1; second < boxes.length; second += 1) {
    const a = boxes[first]; const b = boxes[second];
    if (a.left < b.right + 2 && a.right + 2 > b.left && a.top < b.bottom + 2 && a.bottom + 2 > b.top) collisions += 1;
  }
  return { boxes, outside, collisions, fits: outside === 0 && collisions === 0 };
}

export function circosRadialLayout(plotWidth: number, plotHeight: number, trackCount: number, requestedGap: number, pointSize = 5, hasScatter = false) {
  const outer = Math.min(plotWidth, plotHeight) * 0.39;
  const gap = Math.max(0, requestedGap);
  const available = outer * 0.42;
  const unconstrainedBand = (available - gap * Math.max(0, trackCount - 1)) / Math.max(1, trackCount);
  const band = Math.min(12, unconstrainedBand);
  const radii = Array.from({ length: trackCount }, (_, index) => outer - 17 - index * (band + gap));
  const minimumRadius = radii.length ? Math.min(...radii.map((radius) => radius - band / 2)) : outer - 17;
  const scatterRadius = Math.max(1.5, pointSize * 0.45);
  const scatterFits = !hasScatter || scatterRadius + 0.35 <= band / 2;
  return { outer, gap, band, radii, minimumRadius, scatterRadius, scatterFits, fits: trackCount <= 8 && band >= 5 && minimumRadius >= 14 && scatterFits };
}

export function flowCircularLayoutMetrics(type: "sankey" | "alluvial" | "chord" | "ligand-receptor" | "circos", width: number, height: number, primaryCount: number, secondaryCount = 0, options: { title?: boolean; trackGap?: number; tickSize?: number; showLabels?: boolean; minimumSectorPixels?: number; pointSize?: number; hasScatter?: boolean } = {}) {
  const frame = flowCircularFrame(width, height, Boolean(options.title));
  const { plotWidth, plotHeight } = frame;
  const compactSpan = Math.max(1, Math.min(plotWidth, plotHeight));
  if (type === "chord") {
    const spacing = Math.PI * compactSpan / Math.max(1, primaryCount);
    const minimum = options.showLabels ? Math.max(10, (options.tickSize ?? 11) * 0.9) : 7;
    const actualMinimum = options.minimumSectorPixels ?? spacing;
    return { fits: primaryCount <= 28 && spacing >= minimum && actualMinimum >= minimum, spacing: Math.min(spacing, actualMinimum), reason: "minimum category arc/label spacing" };
  }
  if (type === "circos") {
    const radial = circosRadialLayout(plotWidth, plotHeight, secondaryCount, options.trackGap ?? 4, options.pointSize, options.hasScatter);
    const chromosomeArc = Math.PI * 2 * radial.outer / Math.max(1, primaryCount);
    const actualMinimum = options.minimumSectorPixels ?? chromosomeArc;
    return { fits: primaryCount <= 32 && chromosomeArc >= 10 && actualMinimum >= 10 && radial.fits, spacing: Math.min(chromosomeArc, actualMinimum, radial.band), reason: radial.scatterFits ? "minimum chromosome arc and track spacing" : "scatter diameter within its track band", radial };
  }
  const reserved = type === "sankey" ? 38 : type === "alluvial" ? 48 : 74;
  const verticalSpacing = Math.max(1, plotHeight - reserved) / Math.max(1, primaryCount);
  const nodeMinimum = type === "ligand-receptor" ? 8.4 : 6;
  const labelMinimum = options.showLabels ? Math.max(nodeMinimum, (options.tickSize ?? 11) + 2) : nodeMinimum;
  return { fits: primaryCount <= 40 && secondaryCount <= 8 && verticalSpacing >= labelMinimum, spacing: verticalSpacing, reason: "node/stratum spacing" };
}
