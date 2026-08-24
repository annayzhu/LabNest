export type GenomeInterval = {
  chromosome: string;
  start: number;
  end: number;
};

export type GenomeAxisSegment = {
  chromosome: string;
  normalizedChromosome: string;
  length: number;
  offset: number;
  center: number;
};

export const maximumGenomeAxisSpan = 1_000_000_000_000;

const SPECIAL_CHROMOSOMES = new Map([["X", 0], ["Y", 1], ["MT", 2]]);

export const supportedCytobandStains = ["gneg", "gpos25", "gpos50", "gpos75", "gpos100", "acen", "gvar", "stalk"] as const;

export type GenomicLayoutType = "manhattan" | "qq" | "chromosome-ideogram" | "snp-density" | "genome-tracks" | "waterfall" | "oncoplot" | "motif-logo";
export type GenomicLayoutSettings = {
  width: number;
  height: number;
  title: string;
  tickSize: number;
  legendSize: number;
  genomicTrackGap: number;
  oncoplotShowMargins: boolean;
};

export function genomicFrameMetrics(type: GenomicLayoutType, settings: Pick<GenomicLayoutSettings, "width" | "height" | "title">) {
  const noAxes = type === "chromosome-ideogram" || type === "snp-density";
  const labelHeavy = type === "genome-tracks" || type === "oncoplot";
  const left = noAxes ? 14 : labelHeavy ? Math.min(178, settings.width * 0.32) : 66;
  const right = 22;
  const top = settings.title ? 48 : 24;
  const bottom = 58;
  return { width: settings.width, height: settings.height, left, right, top, bottom, plotWidth: Math.max(100, settings.width - left - right), plotHeight: Math.max(90, settings.height - top - bottom) };
}

export function chromosomeLaneLayout(type: "chromosome-ideogram" | "snp-density", settings: GenomicLayoutSettings, chromosomeCount: number) {
  const frame = genomicFrameMetrics(type, settings);
  const laneHeight = frame.plotHeight / Math.max(1, chromosomeCount);
  const minimumLaneHeight = Math.max(8, settings.tickSize + 2);
  return { frame, laneHeight, minimumLaneHeight, fits: laneHeight >= minimumLaneHeight };
}

export function genomeTrackLayout(settings: GenomicLayoutSettings, trackCount: number) {
  const frame = genomicFrameMetrics("genome-tracks", settings);
  const minimumLaneHeight = Math.max(8, settings.tickSize + 2);
  const requestedHeight = trackCount * minimumLaneHeight + Math.max(0, trackCount - 1) * settings.genomicTrackGap;
  const effectiveGap = trackCount > 1 ? Math.min(settings.genomicTrackGap, Math.max(0, (frame.plotHeight - trackCount * 2) / (trackCount - 1))) : 0;
  const laneHeight = Math.max(0.5, (frame.plotHeight - Math.max(0, trackCount - 1) * effectiveGap) / Math.max(1, trackCount));
  return { frame, laneHeight, minimumLaneHeight, effectiveGap, requestedHeight, fits: requestedHeight <= frame.plotHeight };
}

export function oncoplotLayoutMetrics(settings: GenomicLayoutSettings, geneCount: number, sampleCount: number, alterationCount: number) {
  const frame = genomicFrameMetrics("oncoplot", settings);
  const legendHeight = Math.ceil(alterationCount / 4) * 14 + 7;
  const burdenHeight = settings.oncoplotShowMargins ? 27 : 0;
  const matrixTop = frame.top + legendHeight + burdenHeight;
  const availableMatrixHeight = frame.plotHeight - legendHeight - burdenHeight;
  const matrixHeight = Math.max(0.5, availableMatrixHeight);
  const frequencyWidth = settings.oncoplotShowMargins ? 44 : 0;
  const availableMatrixWidth = frame.plotWidth - frequencyWidth;
  const matrixWidth = Math.max(0.5, availableMatrixWidth);
  const cellWidth = matrixWidth / Math.max(1, sampleCount);
  const cellHeight = matrixHeight / Math.max(1, geneCount);
  const minimumGeneHeight = Math.max(8, settings.tickSize * 0.85);
  const minimumSampleWidth = 2;
  return { frame, legendHeight, burdenHeight, matrixTop, matrixHeight, availableMatrixHeight, frequencyWidth, matrixWidth, availableMatrixWidth, cellWidth, cellHeight, minimumGeneHeight, minimumSampleWidth, fits: availableMatrixHeight >= 70 && availableMatrixWidth > 0 && cellHeight >= minimumGeneHeight && cellWidth >= minimumSampleWidth };
}

export function waterfallLayoutMetrics(settings: GenomicLayoutSettings, sampleCount: number, alterationCount: number) {
  const frame = genomicFrameMetrics("waterfall", settings);
  const legendHeight = Math.ceil(alterationCount / 4) * 14 + 9;
  const availableChartHeight = frame.plotHeight - legendHeight;
  const chartTop = frame.top + legendHeight;
  const chartHeight = Math.max(0.5, availableChartHeight);
  const bandWidth = frame.plotWidth / Math.max(1, sampleCount);
  const minimumBandWidth = 2;
  return { frame, legendHeight, chartTop, chartHeight, availableChartHeight, bandWidth, minimumBandWidth, fits: availableChartHeight >= 70 && bandWidth >= minimumBandWidth };
}

export function motifLayoutMetrics(settings: GenomicLayoutSettings, positionCount: number) {
  const frame = genomicFrameMetrics("motif-logo", settings);
  const bandWidth = frame.plotWidth / Math.max(1, positionCount);
  const minimumBandWidth = Math.max(5, settings.tickSize * 0.45);
  const labelCapacity = Math.max(1, Math.floor(frame.plotWidth / Math.max(12, settings.tickSize * 1.4)));
  const labelEvery = Math.max(1, Math.ceil(positionCount / labelCapacity));
  return { frame, bandWidth, minimumBandWidth, labelEvery, fits: bandWidth >= minimumBandWidth };
}

export function normalizeChromosome(chromosome: string) {
  const trimmed = chromosome.trim().replace(/^chr/i, "");
  const upper = trimmed.toUpperCase();
  return upper === "M" ? "MT" : upper;
}

export function isValidChromosome(chromosome: string) {
  return /^(?:chr)?[A-Za-z0-9][A-Za-z0-9_.-]*$/i.test(chromosome.trim());
}

export function compareChromosomes(left: string, right: string) {
  const normalizedLeft = normalizeChromosome(left);
  const normalizedRight = normalizeChromosome(right);
  const leftNumeric = /^\d+$/.test(normalizedLeft) ? normalizedLeft.replace(/^0+(?=\d)/, "") : null;
  const rightNumeric = /^\d+$/.test(normalizedRight) ? normalizedRight.replace(/^0+(?=\d)/, "") : null;
  if (leftNumeric !== null || rightNumeric !== null) {
    if (leftNumeric === null) return 1;
    if (rightNumeric === null) return -1;
    if (leftNumeric.length !== rightNumeric.length) return leftNumeric.length - rightNumeric.length;
    const numericOrder = leftNumeric.localeCompare(rightNumeric);
    if (numericOrder !== 0) return numericOrder;
    return normalizedLeft.localeCompare(normalizedRight, undefined, { numeric: true, sensitivity: "base" });
  }
  const leftRank = SPECIAL_CHROMOSOMES.get(normalizedLeft);
  const rightRank = SPECIAL_CHROMOSOMES.get(normalizedRight);
  if (leftRank !== undefined || rightRank !== undefined) {
    if (leftRank === undefined) return 1;
    if (rightRank === undefined) return -1;
    if (leftRank !== rightRank) return leftRank - rightRank;
  }
  return normalizedLeft.localeCompare(normalizedRight, undefined, { numeric: true, sensitivity: "base" });
}

export function naturalChromosomeOrder(chromosomes: string[]) {
  const representative = new Map<string, string>();
  chromosomes.forEach((chromosome) => {
    const normalized = normalizeChromosome(chromosome);
    if (!representative.has(normalized)) representative.set(normalized, chromosome.trim());
  });
  return [...representative.values()].sort(compareChromosomes);
}

export function buildGenomeAxis(intervals: GenomeInterval[], gapFraction = 0.012) {
  const representative = new Map<string, string>();
  const lengths = new Map<string, number>();
  intervals.forEach((interval) => {
    const normalizedChromosome = normalizeChromosome(interval.chromosome);
    if (!representative.has(normalizedChromosome)) representative.set(normalizedChromosome, interval.chromosome.trim());
    lengths.set(normalizedChromosome, Math.max(lengths.get(normalizedChromosome) ?? 1, interval.end));
  });
  const chromosomes = [...representative.values()].sort(compareChromosomes);
  const rawTotal = [...lengths.values()].reduce((sum, value) => sum + value, 0);
  const gap = chromosomes.length > 1 ? Math.max(1, rawTotal * gapFraction / chromosomes.length) : 0;
  let offset = 0;
  const segments: GenomeAxisSegment[] = chromosomes.map((chromosome) => {
    const normalizedChromosome = normalizeChromosome(chromosome);
    const length = lengths.get(normalizedChromosome) ?? 1;
    const segment = { chromosome, normalizedChromosome, length, offset, center: offset + length / 2 };
    offset += length + gap;
    return segment;
  });
  const segmentsByChromosome = new Map(segments.map((segment) => [segment.normalizedChromosome, segment]));
  return {
    segments,
    totalLength: Math.max(1, offset - gap),
    coordinate(chromosome: string, position: number) {
      const segment = segmentsByChromosome.get(normalizeChromosome(chromosome));
      if (!segment) return 0;
      return segment.offset + Math.max(0, Math.min(segment.length, position));
    },
  };
}

export function genomeAxisSpanMetrics(intervals: GenomeInterval[], gapFraction = 0.012) {
  const maximumEnds = new Map<string, number>();
  intervals.forEach((interval) => {
    const chromosome = normalizeChromosome(interval.chromosome);
    maximumEnds.set(chromosome, Math.max(maximumEnds.get(chromosome) ?? 1, interval.end));
  });
  const safeIntegerEnds = [...maximumEnds.values()].every((value) => Number.isSafeInteger(value) && value >= 0);
  if (!safeIntegerEnds) return { chromosomeCount: maximumEnds.size, rawSpan: Number.NaN, totalSpan: Number.NaN, maximumSpan: maximumGenomeAxisSpan, fits: false };
  const rawSpanBigInt = [...maximumEnds.values()].reduce((sum, value) => sum + BigInt(value), BigInt(0));
  if (rawSpanBigInt > BigInt(maximumGenomeAxisSpan)) return { chromosomeCount: maximumEnds.size, rawSpan: Number(rawSpanBigInt), totalSpan: Number(rawSpanBigInt), maximumSpan: maximumGenomeAxisSpan, fits: false };
  const rawSpan = Number(rawSpanBigInt);
  const gap = maximumEnds.size > 1 ? Math.max(1, rawSpan * gapFraction / maximumEnds.size) : 0;
  const totalSpan = rawSpan + Math.max(0, maximumEnds.size - 1) * gap;
  return { chromosomeCount: maximumEnds.size, rawSpan, totalSpan, maximumSpan: maximumGenomeAxisSpan, fits: Number.isFinite(totalSpan) && totalSpan <= maximumGenomeAxisSpan };
}

export function genomeAxisLabelLayout(segments: GenomeAxisSegment[], totalLength: number, plotWidth: number, tickSize: number) {
  const centers = segments.map((segment) => segment.center / Math.max(1, totalLength) * plotWidth);
  const minimumWidth = Math.max(10, tickSize * 1.05);
  return segments.flatMap((segment, index) => {
    const center = centers[index];
    const leftDistance = index === 0 ? center * 2 : center - centers[index - 1];
    const rightDistance = index === centers.length - 1 ? (plotWidth - center) * 2 : centers[index + 1] - center;
    const maxWidth = Math.max(0, Math.min(64, leftDistance, rightDistance) - 4);
    return maxWidth >= minimumWidth ? [{ segment, center, maxWidth }] : [];
  });
}

export function motifInformationContent(probabilities: number[]) {
  const entropy = probabilities.reduce((sum, probability) => probability > 0 ? sum - probability * Math.log2(probability) : sum, 0);
  return Math.max(0, 2 - entropy);
}

export function motifLetterHeights(probabilities: Record<"A" | "C" | "G" | "T", number>, mode: "information" | "probability") {
  const bases = ["A", "C", "G", "T"] as const;
  const scale = mode === "information" ? motifInformationContent(bases.map((base) => probabilities[base])) : 1;
  return bases.map((base) => ({ base, height: probabilities[base] * scale })).sort((left, right) => left.height - right.height || left.base.localeCompare(right.base));
}

export const alterationPriority = [
  "Nonsense",
  "Frameshift",
  "Splice",
  "Missense",
  "Mutation",
  "Fusion",
  "Amplification",
  "Deletion",
  "Other",
] as const;

export type CanonicalAlteration = typeof alterationPriority[number];

export function canonicalAlteration(value: string): CanonicalAlteration {
  const normalized = value.trim().toLowerCase();
  if (/nonsense|stopgain|stop_gained/.test(normalized)) return "Nonsense";
  if (/frame/.test(normalized)) return "Frameshift";
  if (/splice/.test(normalized)) return "Splice";
  if (/missense/.test(normalized)) return "Missense";
  if (/fusion|rearrangement/.test(normalized)) return "Fusion";
  if (/amplification|\bamp\b|gain/.test(normalized)) return "Amplification";
  if (/deletion|\bdel\b|loss/.test(normalized)) return "Deletion";
  if (/mutation|snv|indel/.test(normalized)) return "Mutation";
  return "Other";
}

export type AlterationRecord = { sample: string; gene: string; alteration: string };

export function alterationMatrixLayout(records: AlterationRecord[], sortSamples = true) {
  const geneSamples = new Map<string, Set<string>>();
  const sampleEventCounts = new Map<string, number>();
  const sampleOrder: string[] = [];
  const cells = new Map<string, CanonicalAlteration[]>();
  const sampleAlterationCounts = new Map<string, number>();
  records.forEach((record) => {
    const samples = geneSamples.get(record.gene) ?? new Set<string>();
    samples.add(record.sample);
    geneSamples.set(record.gene, samples);
    if (!sampleEventCounts.has(record.sample)) sampleOrder.push(record.sample);
    sampleEventCounts.set(record.sample, (sampleEventCounts.get(record.sample) ?? 0) + 1);
    const key = `${record.gene}\u0000${record.sample}`;
    const values = cells.get(key) ?? [];
    const canonical = canonicalAlteration(record.alteration);
    const sampleAlterationKey = `${record.sample}\u0000${canonical}`;
    sampleAlterationCounts.set(sampleAlterationKey, (sampleAlterationCounts.get(sampleAlterationKey) ?? 0) + 1);
    if (!values.includes(canonical)) values.push(canonical);
    values.sort((left, right) => alterationPriority.indexOf(left) - alterationPriority.indexOf(right));
    cells.set(key, values);
  });
  const genes = [...geneSamples.keys()].sort((left, right) => {
    const leftCount = geneSamples.get(left)?.size ?? 0;
    const rightCount = geneSamples.get(right)?.size ?? 0;
    return rightCount - leftCount || left.localeCompare(right);
  });
  const samples = [...sampleOrder];
  if (sortSamples) samples.sort((left, right) => {
    const leftCount = sampleEventCounts.get(left) ?? 0;
    const rightCount = sampleEventCounts.get(right) ?? 0;
    return rightCount - leftCount || left.localeCompare(right, undefined, { numeric: true });
  });
  const sampleBurden = new Map(samples.map((sample) => [sample, sampleEventCounts.get(sample) ?? 0]));
  const geneFrequency = new Map(genes.map((gene) => [gene, (geneSamples.get(gene)?.size ?? 0) / Math.max(1, samples.length)]));
  return { genes, samples, cells, sampleBurden, geneFrequency, sampleAlterationCounts };
}
