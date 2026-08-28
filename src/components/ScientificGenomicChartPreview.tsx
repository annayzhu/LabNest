"use client";

import {
  alterationMatrixLayout,
  alterationPriority,
  buildGenomeAxis,
  canonicalAlteration,
  chromosomeLaneLayout,
  genomeTrackLayout,
  genomeAxisLabelLayout,
  motifLayoutMetrics,
  motifLetterHeights,
  naturalChromosomeOrder,
  normalizeChromosome,
  oncoplotLayoutMetrics,
  waterfallLayoutMetrics,
  type AlterationRecord,
} from "@/lib/visualization-genomics";
import {
  categoricalColorForIndex,
  compactLegendLabel,
  formatTick,
  interpolateColor,
  numericExtent,
  parseNumericValue,
  scaleLinear,
  type ParsedDataset,
  type PlotType,
  type VisualizationSettings,
} from "@/lib/visualization-studio";

type GenomicPlotType = "manhattan" | "qq" | "chromosome-ideogram" | "snp-density" | "genome-tracks" | "waterfall" | "oncoplot" | "motif-logo";
type Frame = { width: number; height: number; left: number; right: number; top: number; bottom: number; plotWidth: number; plotHeight: number };
type Props = { type: GenomicPlotType; frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[]; gridColor: string };

const TEXT = "#23242A";
const BASE_COLORS: Record<"A" | "C" | "G" | "T", string> = { A: "#3F7D5A", C: "#3C6FA3", G: "#D58A32", T: "#C54E4E" };

function yTicks(maximum: number, count = 5) {
  return Array.from({ length: count }, (_, index) => maximum * index / Math.max(1, count - 1));
}

function NumericAxes({ frame, settings, maximum, xLabel, yLabel, gridColor, showXTicks = false }: { frame: Frame; settings: VisualizationSettings; maximum: number; xLabel: string; yLabel: string; gridColor: string; showXTicks?: boolean }) {
  const bottom = frame.top + frame.plotHeight;
  const ticks = yTicks(maximum);
  return <g>{ticks.map((value) => { const y = scaleLinear(value, [0, maximum], [bottom, frame.top]); return <g key={`y-${value}`}>{settings.grid !== "none" ? <line x1={frame.left} x2={frame.left + frame.plotWidth} y1={y} y2={y} stroke={gridColor} strokeWidth={settings.gridLineWidth} /> : null}<line x1={frame.left - 4} x2={frame.left} y1={y} y2={y} stroke={TEXT} strokeWidth={settings.axisLineWidth} /><text x={frame.left - 8} y={y + 4} textAnchor="end" fill={TEXT} fontSize={settings.tickSize}>{formatTick(value)}</text></g>; })}{showXTicks ? ticks.map((value) => { const x = scaleLinear(value, [0, maximum], [frame.left, frame.left + frame.plotWidth]); return <g key={`x-${value}`}>{settings.grid === "both" ? <line data-grid-axis="x" x1={x} x2={x} y1={frame.top} y2={bottom} stroke={gridColor} strokeWidth={settings.gridLineWidth} /> : null}<line x1={x} x2={x} y1={bottom} y2={bottom + 4} stroke={TEXT} strokeWidth={settings.axisLineWidth} /><text x={x} y={bottom + 17} textAnchor="middle" fill={TEXT} fontSize={settings.tickSize}>{formatTick(value)}</text></g>; }) : null}<line x1={frame.left} x2={frame.left + frame.plotWidth} y1={bottom} y2={bottom} stroke={TEXT} strokeWidth={settings.axisLineWidth} /><line x1={frame.left} x2={frame.left} y1={frame.top} y2={bottom} stroke={TEXT} strokeWidth={settings.axisLineWidth} />{xLabel ? <text x={frame.left + frame.plotWidth / 2} y={frame.height - 13} textAnchor="middle" fill={TEXT} fontSize={settings.axisLabelSize} fontWeight={600}>{xLabel}</text> : null}{yLabel ? <text transform={`translate(18 ${frame.top + frame.plotHeight / 2}) rotate(-90)`} textAnchor="middle" fill={TEXT} fontSize={settings.axisLabelSize} fontWeight={600}>{yLabel}</text> : null}</g>;
}

function ManhattanPlot({ frame, dataset, mapping, settings, colors, gridColor }: Omit<Props, "type">) {
  const rows = dataset.rows.map((row, index) => ({ chromosome: row[mapping.chromosome], position: parseNumericValue(row[mapping.position]) ?? 0, p: parseNumericValue(row[mapping.pValue]) ?? 1, label: mapping.label ? row[mapping.label] : "", index }));
  const axis = buildGenomeAxis(rows.map((row) => ({ chromosome: row.chromosome, start: row.position, end: row.position })));
  const points = rows.map((row) => ({ ...row, genomeX: axis.coordinate(row.chromosome, row.position), y: -Math.log10(row.p) }));
  const maximum = Math.max(settings.genomicSignificanceLog10, ...points.map((point) => point.y), 1) * 1.08;
  const xAt = (value: number) => scaleLinear(value, [0, axis.totalLength], [frame.left, frame.left + frame.plotWidth]);
  const yAt = (value: number) => scaleLinear(value, [0, maximum], [frame.top + frame.plotHeight, frame.top]);
  const chromosomeIndex = new Map(axis.segments.map((segment, index) => [segment.normalizedChromosome, index]));
  const labelSet = new Set(settings.showLabels ? [...points].sort((left, right) => right.y - left.y).filter((point) => point.y >= settings.genomicSignificanceLog10).slice(0, settings.labelLimit).map((point) => point.index) : []);
  const chromosomeLabels = genomeAxisLabelLayout(axis.segments, axis.totalLength, frame.plotWidth, settings.tickSize);
  return <><NumericAxes frame={frame} settings={settings} maximum={maximum} xLabel={settings.xLabel || "Chromosome"} yLabel={settings.yLabel || "−log₁₀(P)"} gridColor={gridColor} /><g data-plot-data data-plot-family="manhattan">{settings.grid === "both" ? axis.segments.slice(1).map((segment) => <line key={segment.normalizedChromosome} data-grid-axis="x" x1={xAt(segment.offset)} x2={xAt(segment.offset)} y1={frame.top} y2={frame.top + frame.plotHeight} stroke={gridColor} strokeWidth={settings.gridLineWidth} />) : null}<line data-plot-element="genome-wide-threshold" x1={frame.left} x2={frame.left + frame.plotWidth} y1={yAt(settings.genomicSignificanceLog10)} y2={yAt(settings.genomicSignificanceLog10)} stroke={colors[2] ?? "#B25D4B"} strokeWidth={settings.dataLineWidth} strokeDasharray="5 4" />{points.map((point) => { const x = xAt(point.genomeX); const y = yAt(point.y); const color = colors[(chromosomeIndex.get(normalizeChromosome(point.chromosome)) ?? 0) % 2] ?? colors[0]; return <g key={point.index}><circle data-plot-element="manhattan-point" cx={x} cy={y} r={Math.max(1.5, settings.pointSize * 0.55)} fill={color} fillOpacity={settings.opacity} />{labelSet.has(point.index) && point.label ? <text data-plot-label x={Math.max(frame.left + 2, Math.min(frame.left + frame.plotWidth - 2, x))} y={Math.max(frame.top + settings.tickSize, y - 4)} textAnchor={x > frame.left + frame.plotWidth * 0.75 ? "end" : x < frame.left + frame.plotWidth * 0.25 ? "start" : "middle"} fill={TEXT} fontSize={Math.max(8, settings.tickSize - 1)}>{compactLegendLabel(point.label, settings.tickSize, 72, 12)}</text> : null}</g>; })}</g>{chromosomeLabels.map(({ segment, maxWidth }) => <text key={segment.normalizedChromosome} data-plot-element="genome-axis-label" data-full-label={segment.normalizedChromosome} x={xAt(segment.center)} y={frame.top + frame.plotHeight + 18} textAnchor="middle" fill={TEXT} fontSize={settings.tickSize}><title>{segment.normalizedChromosome}</title>{compactLegendLabel(segment.normalizedChromosome, settings.tickSize, maxWidth, 12)}</text>)}</>;
}

function QqPlot({ frame, dataset, mapping, settings, colors, gridColor }: Omit<Props, "type">) {
  const rows = dataset.rows.map((row, index) => ({ p: parseNumericValue(row[mapping.pValue]) ?? 1, label: mapping.label ? row[mapping.label] : "", index })).sort((left, right) => left.p - right.p || left.index - right.index);
  const points = rows.map((row, index) => ({ ...row, expected: -Math.log10((index + 0.5) / rows.length), observed: -Math.log10(row.p) }));
  const maximum = Math.max(1, ...points.flatMap((point) => [point.expected, point.observed])) * 1.06;
  const xAt = (value: number) => scaleLinear(value, [0, maximum], [frame.left, frame.left + frame.plotWidth]);
  const yAt = (value: number) => scaleLinear(value, [0, maximum], [frame.top + frame.plotHeight, frame.top]);
  const labels = new Set(settings.showLabels ? [...points].sort((left, right) => Math.abs(right.observed - right.expected) - Math.abs(left.observed - left.expected)).slice(0, settings.labelLimit).map((point) => point.index) : []);
  return <><NumericAxes frame={frame} settings={settings} maximum={maximum} xLabel={settings.xLabel || "Expected −log₁₀(P)"} yLabel={settings.yLabel || "Observed −log₁₀(P)"} gridColor={gridColor} showXTicks /><g data-plot-data data-plot-family="qq"><line data-plot-element="qq-reference" x1={xAt(0)} y1={yAt(0)} x2={xAt(maximum)} y2={yAt(maximum)} stroke="#8A8985" strokeWidth={settings.dataLineWidth} strokeDasharray="4 4" />{points.map((point) => {
    const x = xAt(point.expected);
    const y = yAt(point.observed);
    const placeLeft = x > frame.left + frame.plotWidth - 72;
    return <g key={point.index}><circle data-plot-element="qq-point" cx={x} cy={y} r={Math.max(1.7, settings.pointSize * 0.6)} fill={colors[0]} fillOpacity={settings.opacity} />{labels.has(point.index) && point.label ? <text data-plot-label data-full-label={point.label} x={placeLeft ? x - 4 : x + 4} y={Math.max(frame.top + settings.tickSize, y - 3)} textAnchor={placeLeft ? "end" : "start"} fill={TEXT} fontSize={Math.max(8, settings.tickSize - 1)}><title>{point.label}</title>{compactLegendLabel(point.label, settings.tickSize, 68, 10)}</text> : null}</g>;
  })}</g></>;
}

const STAIN_COLORS: Record<string, string> = { gneg: "#F4F1EC", gpos25: "#D9D3CB", gpos50: "#AAA49C", gpos75: "#77736F", gpos100: "#343538", acen: "#C77A6A", gvar: "#C9C2B8", stalk: "#B9AAA0" };

function IdeogramPlot({ frame, dataset, mapping, settings }: Omit<Props, "type" | "colors" | "gridColor">) {
  const rows = dataset.rows.map((row) => ({ chromosome: row[mapping.chromosome], start: parseNumericValue(row[mapping.start]) ?? 0, end: parseNumericValue(row[mapping.end]) ?? 0, stain: mapping.stain ? row[mapping.stain]?.toLowerCase() : "", label: mapping.label ? row[mapping.label] : "" }));
  const chromosomes = naturalChromosomeOrder(rows.map((row) => row.chromosome));
  const maximumLength = Math.max(...rows.map((row) => row.end), 1);
  const rowHeight = chromosomeLaneLayout("chromosome-ideogram", settings, chromosomes.length).laneHeight;
  const labelWidth = Math.min(96, Math.max(32, frame.plotWidth * 0.3));
  const plotLeft = frame.left + labelWidth;
  const plotWidth = frame.plotWidth - labelWidth;
  return <g data-plot-data data-plot-family="chromosome-ideogram">{chromosomes.map((chromosome, chromosomeIndex) => { const bands = rows.filter((row) => normalizeChromosome(row.chromosome) === normalizeChromosome(chromosome)).sort((left, right) => left.start - right.start); const length = Math.max(...bands.map((band) => band.end), 1); const width = plotWidth * length / maximumLength; const y = frame.top + chromosomeIndex * rowHeight + rowHeight * 0.18; const height = Math.max(3, rowHeight * 0.64); return <g key={chromosome}><text data-full-label={normalizeChromosome(chromosome)} x={plotLeft - 7} y={y + height * 0.7} textAnchor="end" fill={TEXT} fontSize={settings.tickSize}><title>{normalizeChromosome(chromosome)}</title>{compactLegendLabel(normalizeChromosome(chromosome), settings.tickSize, labelWidth - 10, 16)}</text><rect x={plotLeft} y={y} width={width} height={height} rx={height / 2} fill="#F4F1EC" stroke={TEXT} strokeWidth={settings.axisLineWidth} />{bands.map((band) => { const x = plotLeft + band.start / maximumLength * plotWidth; const bandWidth = Math.max(0.7, (band.end - band.start) / maximumLength * plotWidth); return <g key={`${band.start}-${band.end}`}><rect data-plot-element="cytoband" x={x} y={y} width={bandWidth} height={height} fill={STAIN_COLORS[band.stain] ?? "#D9D3CB"} stroke="#FFFFFF" strokeWidth={0.35} />{settings.showLabels && band.label && bandWidth > settings.tickSize * 2.4 ? <text x={x + bandWidth / 2} y={y + height * 0.7} textAnchor="middle" fill={band.stain === "gpos100" ? "#FFFFFF" : TEXT} fontSize={Math.max(7, settings.tickSize - 3)}>{compactLegendLabel(band.label, settings.tickSize - 3, bandWidth - 2, 8)}</text> : null}</g>; })}</g>; })}</g>;
}

function SnpDensityPlot({ frame, dataset, mapping, settings }: Omit<Props, "type" | "colors" | "gridColor">) {
  const rows = dataset.rows.map((row) => ({ chromosome: row[mapping.chromosome], start: parseNumericValue(row[mapping.start]) ?? 0, end: parseNumericValue(row[mapping.end]) ?? 0, value: parseNumericValue(row[mapping.value]) ?? 0 }));
  const chromosomes = naturalChromosomeOrder(rows.map((row) => row.chromosome));
  const maximumLength = Math.max(...rows.map((row) => row.end), 1);
  const values = rows.map((row) => row.value);
  const valueExtent = numericExtent(values, true);
  const rowHeight = chromosomeLaneLayout("snp-density", settings, chromosomes.length).laneHeight;
  const labelWidth = Math.min(96, Math.max(32, frame.plotWidth * 0.3));
  const plotLeft = frame.left + labelWidth;
  const plotWidth = frame.plotWidth - labelWidth;
  return <g data-plot-data data-plot-family="snp-density">{chromosomes.map((chromosome, chromosomeIndex) => { const bins = rows.filter((row) => normalizeChromosome(row.chromosome) === normalizeChromosome(chromosome)); const y = frame.top + chromosomeIndex * rowHeight + rowHeight * 0.18; const height = Math.max(3, rowHeight * 0.64); return <g key={chromosome}><text data-full-label={normalizeChromosome(chromosome)} x={plotLeft - 7} y={y + height * 0.7} textAnchor="end" fill={TEXT} fontSize={settings.tickSize}><title>{normalizeChromosome(chromosome)}</title>{compactLegendLabel(normalizeChromosome(chromosome), settings.tickSize, labelWidth - 10, 16)}</text>{bins.map((bin) => <rect key={`${bin.start}-${bin.end}`} data-plot-element="snp-density-bin" x={plotLeft + bin.start / maximumLength * plotWidth} y={y} width={Math.max(0.7, (bin.end - bin.start) / maximumLength * plotWidth)} height={height} fill={interpolateColor(settings.continuousLow, settings.continuousHigh, scaleLinear(bin.value, valueExtent, [0, 1]))} stroke="#FFFFFF" strokeWidth={0.3} />)}</g>; })}<text x={frame.left + frame.plotWidth} y={frame.top + frame.plotHeight + 17} textAnchor="end" fill={TEXT} fontSize={Math.max(8, settings.tickSize - 1)}>Low {formatTick(valueExtent[0])} → High {formatTick(valueExtent[1])}</text></g>;
}

function GenomeTracksPlot({ frame, dataset, mapping, settings, colors }: Omit<Props, "type" | "gridColor">) {
  const rows = dataset.rows.map((row, index) => ({ chromosome: row[mapping.chromosome], start: parseNumericValue(row[mapping.start]) ?? 0, end: parseNumericValue(row[mapping.end]) ?? 0, value: mapping.value ? parseNumericValue(row[mapping.value]) : null, track: row[mapping.track], label: mapping.label ? row[mapping.label] : "", index }));
  const axis = buildGenomeAxis(rows);
  const tracks = [...new Set(rows.map((row) => row.track))];
  const values = rows.flatMap((row) => row.value === null ? [] : [row.value]);
  const valueExtent = numericExtent(values.length ? values : [0, 1]);
  const { laneHeight: rowHeight, effectiveGap } = genomeTrackLayout(settings, tracks.length);
  const xAt = (chromosome: string, value: number) => scaleLinear(axis.coordinate(chromosome, value), [0, axis.totalLength], [frame.left, frame.left + frame.plotWidth]);
  const chromosomeLabels = genomeAxisLabelLayout(axis.segments, axis.totalLength, frame.plotWidth, settings.tickSize);
  const legendWidth = Math.min(84, frame.plotWidth * 0.36);
  const legendX = frame.left + frame.plotWidth - legendWidth;
  const legendY = frame.top + frame.plotHeight + 28;
  return <g data-plot-data data-plot-family="genome-tracks">{tracks.map((track, trackIndex) => { const y = frame.top + trackIndex * (rowHeight + effectiveGap); return <g key={track}><rect x={frame.left} y={y} width={frame.plotWidth} height={rowHeight} fill={trackIndex % 2 ? "#FAF9F7" : "#F3F1ED"} /><text data-full-label={track} x={frame.left - 7} y={y + rowHeight / 2 + 4} textAnchor="end" fill="#23242A" fontSize={settings.tickSize}><title>{track}</title>{compactLegendLabel(track, settings.tickSize, Math.max(30, frame.left - 15), 16)}</text>{rows.filter((row) => row.track === track).map((row) => { const x = xAt(row.chromosome, row.start); const width = Math.max(2, xAt(row.chromosome, row.end) - x); const fill = row.value === null ? categoricalColorForIndex(trackIndex, colors) : interpolateColor(settings.continuousLow, settings.continuousHigh, scaleLinear(row.value, valueExtent, [0, 1])); return <g key={row.index}><rect data-plot-element="genome-track-interval" x={x} y={y + rowHeight * 0.18} width={width} height={rowHeight * 0.64} rx={1.5} fill={fill} fillOpacity={settings.opacity} />{settings.showLabels && row.label && width > settings.tickSize * 2 ? <text data-plot-label x={x + width / 2} y={y + rowHeight * 0.62} textAnchor="middle" fill="#23242A" fontSize={Math.max(7, settings.tickSize - 3)}>{compactLegendLabel(row.label, settings.tickSize - 3, width - 2, 14)}</text> : null}</g>; })}</g>; })}{axis.segments.map((segment) => <line key={segment.normalizedChromosome} data-no-clip x1={xAt(segment.chromosome, 0)} x2={xAt(segment.chromosome, segment.length)} y1={frame.top + frame.plotHeight + 3} y2={frame.top + frame.plotHeight + 3} stroke="#23242A" strokeWidth={settings.axisLineWidth} />)}{chromosomeLabels.map(({ segment, maxWidth }) => <text key={segment.normalizedChromosome} data-plot-element="genome-axis-label" data-full-label={segment.normalizedChromosome} x={xAt(segment.chromosome, segment.length / 2)} y={frame.top + frame.plotHeight + 17} textAnchor="middle" fill="#23242A" fontSize={settings.tickSize}><title>{segment.normalizedChromosome}</title>{compactLegendLabel(segment.normalizedChromosome, settings.tickSize, maxWidth, 12)}</text>)}{values.length > 0 ? <g data-plot-element="genome-track-color-legend"><title>{`Track value from ${formatTick(valueExtent[0])} to ${formatTick(valueExtent[1])}`}</title>{Array.from({ length: 12 }, (_, index) => <rect key={index} data-no-clip x={legendX + index * legendWidth / 12} y={legendY} width={legendWidth / 12 + 0.2} height={5} fill={interpolateColor(settings.continuousLow, settings.continuousHigh, index / 11)} />)}<text x={legendX} y={legendY + 16} fill="#23242A" fontSize={Math.max(8, settings.tickSize - 2)}>{formatTick(valueExtent[0])}</text><text x={legendX + legendWidth} y={legendY + 16} textAnchor="end" fill="#23242A" fontSize={Math.max(8, settings.tickSize - 2)}>{formatTick(valueExtent[1])}</text></g> : null}</g>;
}

function alterationColorMap(colors: string[]) {
  return new Map(alterationPriority.map((alteration, index) => [alteration, categoricalColorForIndex(index, colors)]));
}

function AlterationLegend({ frame, settings, alterations, colorMap }: { frame: Frame; settings: VisualizationSettings; alterations: string[]; colorMap: Map<string, string> }) {
  const cellWidth = frame.plotWidth / Math.max(1, Math.min(4, alterations.length));
  return <g data-plot-element="alteration-legend" transform={`translate(${frame.left} ${frame.top})`}>{alterations.map((alteration, index) => <g key={alteration} transform={`translate(${index % 4 * cellWidth} ${Math.floor(index / 4) * 14})`}><rect x={0} y={-8} width={8} height={8} fill={colorMap.get(alteration)} /><text x={12} y={0} fill={TEXT} fontSize={Math.max(8, settings.legendSize - 2)}>{compactLegendLabel(alteration, settings.legendSize - 2, cellWidth - 15, 14)}</text></g>)}</g>;
}

function WaterfallPlot({ frame, dataset, mapping, settings, colors, gridColor }: Omit<Props, "type">) {
  const records: AlterationRecord[] = dataset.rows.map((row) => ({ sample: row[mapping.sample], gene: row[mapping.gene], alteration: row[mapping.alteration] }));
  const layout = alterationMatrixLayout(records, settings.genomicSortSamples);
  const alterations = alterationPriority.filter((alteration) => records.some((record) => canonicalAlteration(record.alteration) === alteration));
  const colorMap = alterationColorMap(colors);
  const { chartTop, chartHeight, bandWidth: band } = waterfallLayoutMetrics(settings, layout.samples.length, alterations.length);
  const maximum = Math.max(1, ...layout.samples.map((sample) => layout.sampleBurden.get(sample) ?? 0));
  const yAt = (value: number) => scaleLinear(value, [0, maximum], [chartTop + chartHeight, chartTop]);
  return <><AlterationLegend frame={frame} settings={settings} alterations={alterations} colorMap={colorMap} /><g data-plot-data data-plot-family="waterfall">{(settings.grid === "none" ? [] : yTicks(maximum, 4)).map((value) => <line key={value} x1={frame.left} x2={frame.left + frame.plotWidth} y1={yAt(value)} y2={yAt(value)} stroke={gridColor} strokeWidth={settings.gridLineWidth} />)}{settings.grid === "both" ? layout.samples.slice(1).map((sample, index) => <line key={sample} data-grid-axis="x" x1={frame.left + (index + 1) * band} x2={frame.left + (index + 1) * band} y1={chartTop} y2={chartTop + chartHeight} stroke={gridColor} strokeWidth={settings.gridLineWidth} />) : null}{layout.samples.map((sample, sampleIndex) => { const counts = alterations.map((alteration) => ({ alteration, count: layout.sampleAlterationCounts.get(`${sample}\u0000${alteration}`) ?? 0 })); let cumulative = 0; return <g key={sample}>{counts.map(({ alteration, count }) => { const lower = cumulative; cumulative += count; return count > 0 ? <rect key={alteration} data-plot-element="waterfall-segment" x={frame.left + sampleIndex * band + band * 0.12} y={yAt(cumulative)} width={Math.max(1, band * 0.76)} height={Math.max(0.8, yAt(lower) - yAt(cumulative))} fill={colorMap.get(alteration)} /> : null; })}{sampleIndex % Math.max(1, Math.ceil(layout.samples.length / Math.max(4, Math.floor(frame.plotWidth / 28)))) === 0 ? <text data-plot-element="waterfall-sample-label" data-full-label={sample} x={frame.left + (sampleIndex + 0.5) * band} y={chartTop + chartHeight + 12} textAnchor="end" transform={`rotate(-45 ${frame.left + (sampleIndex + 0.5) * band} ${chartTop + chartHeight + 12})`} fill={TEXT} fontSize={Math.max(7, settings.tickSize - 2)}><title>{sample}</title>{compactLegendLabel(sample, settings.tickSize - 2, 42, 9)}</text> : null}</g>; })}<line x1={frame.left} x2={frame.left + frame.plotWidth} y1={chartTop + chartHeight} y2={chartTop + chartHeight} stroke={TEXT} strokeWidth={settings.axisLineWidth} /><text transform={`translate(18 ${chartTop + chartHeight / 2}) rotate(-90)`} textAnchor="middle" fill={TEXT} fontSize={settings.axisLabelSize} fontWeight={600}>Input alteration events</text></g></>;
}

function Oncoplot({ frame, dataset, mapping, settings, colors }: Omit<Props, "type" | "gridColor">) {
  const records: AlterationRecord[] = dataset.rows.map((row) => ({ sample: row[mapping.sample], gene: row[mapping.gene], alteration: row[mapping.alteration] }));
  const layout = alterationMatrixLayout(records, settings.genomicSortSamples);
  const alterations = alterationPriority.filter((alteration) => records.some((record) => canonicalAlteration(record.alteration) === alteration));
  const colorMap = alterationColorMap(colors);
  const { burdenHeight, matrixTop, matrixHeight, frequencyWidth, matrixWidth, cellWidth, cellHeight } = oncoplotLayoutMetrics(settings, layout.genes.length, layout.samples.length, alterations.length);
  const maximumBurden = Math.max(1, ...layout.samples.map((sample) => layout.sampleBurden.get(sample) ?? 0));
  const sampleLabelEvery = Math.max(1, Math.ceil(layout.samples.length / Math.max(4, Math.floor(matrixWidth / 28))));
  return <><AlterationLegend frame={frame} settings={settings} alterations={alterations} colorMap={colorMap} /><g data-plot-data data-plot-family="oncoplot">{settings.oncoplotShowMargins ? layout.samples.map((sample, sampleIndex) => { const burden = layout.sampleBurden.get(sample) ?? 0; const height = burden / maximumBurden * burdenHeight; return <rect key={sample} data-plot-element="oncoplot-burden" x={frame.left + sampleIndex * cellWidth + cellWidth * 0.12} y={matrixTop - height} width={Math.max(1, cellWidth * 0.76)} height={height} fill={TEXT} fillOpacity={0.72} />; }) : null}{layout.genes.map((gene, geneIndex) => <g key={gene}><text x={frame.left - 7} y={matrixTop + (geneIndex + 0.66) * cellHeight} textAnchor="end" fill={TEXT} fontSize={Math.max(7, Math.min(settings.tickSize, cellHeight * 0.72))}>{compactLegendLabel(gene, settings.tickSize, Math.max(30, frame.left - 15), 14)}</text>{layout.samples.map((sample, sampleIndex) => { const alterationsInCell = layout.cells.get(`${gene}\u0000${sample}`) ?? []; const x = frame.left + sampleIndex * cellWidth; const y = matrixTop + geneIndex * cellHeight; return <g key={sample}><rect x={x} y={y} width={cellWidth} height={cellHeight} fill={(sampleIndex + geneIndex) % 2 ? "#F7F5F1" : "#FBFAF8"} stroke="#FFFFFF" strokeWidth={0.4} />{alterationsInCell.map((alteration, alterationIndex) => <rect key={alteration} data-plot-element="oncoplot-cell" x={x + cellWidth * alterationIndex / alterationsInCell.length} y={y + 0.6} width={cellWidth / alterationsInCell.length} height={Math.max(1, cellHeight - 1.2)} fill={colorMap.get(alteration)} />)}</g>; })}{settings.oncoplotShowMargins ? <g><rect data-plot-element="oncoplot-frequency" x={frame.left + matrixWidth + 4} y={matrixTop + geneIndex * cellHeight + cellHeight * 0.18} width={(layout.geneFrequency.get(gene) ?? 0) * (frequencyWidth - 7)} height={cellHeight * 0.64} fill={colors[0]} fillOpacity={0.7} /><text x={frame.left + frame.plotWidth} y={matrixTop + (geneIndex + 0.67) * cellHeight} textAnchor="end" fill={TEXT} fontSize={Math.max(7, settings.tickSize - 2)}>{Math.round((layout.geneFrequency.get(gene) ?? 0) * 100)}%</text></g> : null}</g>)}{layout.samples.map((sample, sampleIndex) => sampleIndex % sampleLabelEvery === 0 ? <text key={sample} data-plot-element="oncoplot-sample-label" data-full-label={sample} x={frame.left + (sampleIndex + 0.5) * cellWidth} y={matrixTop + matrixHeight + 12} textAnchor="end" transform={`rotate(-45 ${frame.left + (sampleIndex + 0.5) * cellWidth} ${matrixTop + matrixHeight + 12})`} fill={TEXT} fontSize={Math.max(7, settings.tickSize - 2)}><title>{sample}</title>{compactLegendLabel(sample, settings.tickSize - 2, 42, 9)}</text> : null)}</g></>;
}

function MotifLogo({ frame, dataset, mapping, settings }: Omit<Props, "type" | "colors" | "gridColor">) {
  const rows = dataset.rows.map((row) => ({ position: parseNumericValue(row[mapping.position]) ?? 0, probabilities: { A: parseNumericValue(row[mapping.A]) ?? 0, C: parseNumericValue(row[mapping.C]) ?? 0, G: parseNumericValue(row[mapping.G]) ?? 0, T: parseNumericValue(row[mapping.T]) ?? 0 } })).sort((left, right) => left.position - right.position);
  const maximum = settings.motifDisplayMode === "information" ? 2 : 1;
  const { bandWidth: band, labelEvery } = motifLayoutMetrics(settings, rows.length);
  const unitHeight = frame.plotHeight / maximum;
  return <><NumericAxes frame={frame} settings={settings} maximum={maximum} xLabel={settings.xLabel || "Motif position"} yLabel={settings.yLabel || (settings.motifDisplayMode === "information" ? "Information (bits)" : "Probability")} gridColor="#ECE9E4" /><g data-plot-data data-plot-family="motif-logo">{rows.map((row, rowIndex) => { let cumulative = 0; return <g key={row.position}>{motifLetterHeights(row.probabilities, settings.motifDisplayMode).map(({ base, height }) => { const lower = cumulative; cumulative += height; if (height <= 0.002) return null; const pixelHeight = Math.max(0.5, height * unitHeight); const xScale = band * 0.82 / 20; const yScale = pixelHeight / 20; const bottom = frame.top + frame.plotHeight - lower * unitHeight; return <text key={base} data-plot-element="motif-letter" data-base={base} data-letter-height={height.toFixed(6)} x={0} y={0} textAnchor="middle" dominantBaseline="text-after-edge" fill={BASE_COLORS[base]} fontSize={20} fontWeight={800} transform={`translate(${frame.left + (rowIndex + 0.5) * band} ${bottom}) scale(${xScale} ${yScale})`}>{base}</text>; })}{rowIndex % labelEvery === 0 || rowIndex === rows.length - 1 ? <text data-plot-element="motif-position-label" x={frame.left + (rowIndex + 0.5) * band} y={frame.top + frame.plotHeight + 17} textAnchor="middle" fill={TEXT} fontSize={settings.tickSize}>{row.position}</text> : null}</g>; })}</g></>;
}

export function ScientificGenomicPlot(props: Props) {
  if (props.type === "manhattan") return <ManhattanPlot {...props} />;
  if (props.type === "qq") return <QqPlot {...props} />;
  if (props.type === "chromosome-ideogram") return <IdeogramPlot {...props} />;
  if (props.type === "snp-density") return <SnpDensityPlot {...props} />;
  if (props.type === "genome-tracks") return <GenomeTracksPlot {...props} />;
  if (props.type === "waterfall") return <WaterfallPlot {...props} />;
  if (props.type === "oncoplot") return <Oncoplot {...props} />;
  return <MotifLogo {...props} />;
}

export function isGenomicPlotType(type: PlotType): type is GenomicPlotType {
  return ["manhattan", "qq", "chromosome-ideogram", "snp-density", "genome-tracks", "waterfall", "oncoplot", "motif-logo"].includes(type);
}
