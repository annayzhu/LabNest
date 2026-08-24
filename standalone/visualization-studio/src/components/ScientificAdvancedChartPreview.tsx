"use client";

import type { ReactNode, RefObject } from "react";
import { ScientificGenomicPlot, isGenomicPlotType } from "@/components/ScientificGenomicChartPreview";
import { ScientificRelationshipPlot, isRelationshipPlotType } from "@/components/ScientificNetworkChartPreview";
import { ScientificFlowCircularPlot } from "@/components/ScientificFlowCircularChartPreview";
import { ScientificSetPlot } from "@/components/ScientificSetChartPreview";
import { ScientificClinicalPlot, type ClinicalPlotType } from "@/components/ScientificClinicalChartPreview";
import { ScientificEnrichmentSpecializedPlot, type EnrichmentSpecializedPlotType } from "@/components/ScientificEnrichmentSpecializedPreview";
import { genomicFrameMetrics } from "@/lib/visualization-genomics";
import { networkFrameMetrics } from "@/lib/visualization-network";
import {
  correlation,
  correlationPValue,
  correlationMatrix,
  cutHierarchicalCluster,
  hierarchicalClusterTree,
  kaplanMeier,
  matrixFromRows,
  rocCurve,
  type HierarchicalClusterNode,
} from "@/lib/visualization-advanced";
import {
  alignHeatmapAnnotations,
  categoricalColorForIndex,
  boxStatistics,
  confidenceInterval95,
  compactLegendLabel,
  covarianceEllipsePoints,
  deterministicBeeswarmLayout,
  deterministicHistogram,
  divergingColor,
  enrichmentSpecializedFrameMetrics,
  figureFontPresets,
  formatTick,
  getPlotDefinition,
  heatmapLayoutMetrics,
  interpolateColor,
  journalThemes,
  kernelDensityEstimate,
  linearRegression,
  linearConfidenceBand95,
  loessSmooth,
  meanErrorStatistics,
  numericExtent,
  ordinationAnnotationLayout,
  ordinationFrameMetrics,
  ordinationLegendLayout,
  ordinationLoadingLayout,
  ordinationScoreDomains,
  parseNumericValue,
  parseRatioValue,
  polynomialRegression,
  resolveAxisDomain,
  scaleLinear,
  type JournalThemeId,
  type OrdinationType,
  type ParsedDataset,
  type PlotType,
  type VisualizationSettings,
  type HeatmapAnnotationTrack,
} from "@/lib/visualization-studio";

type Props = {
  svgRef: RefObject<SVGSVGElement | null>;
  type: PlotType;
  dataset: ParsedDataset;
  mapping: Record<string, string>;
  settings: VisualizationSettings;
  themeId: JournalThemeId;
};

type Frame = { width: number; height: number; left: number; right: number; top: number; bottom: number; plotWidth: number; plotHeight: number };
type LegendEntry = { label: string; color: string };
const TEXT = "#23242A";

function frameFor(type: PlotType, settings: VisualizationSettings): Frame {
  if (isGenomicPlotType(type)) return genomicFrameMetrics(type, settings);
  if (isRelationshipPlotType(type)) return networkFrameMetrics(settings);
  if (["go-circle", "kegg-circle", "go-chord", "pathway-impact", "nes-fdr", "multi-gsea", "enrichment-ridge", "sankey-bubble", "geographic-map", "petal", "word-cloud"].includes(type)) return enrichmentSpecializedFrameMetrics(type, settings);
  const noAxes = ["venn", "sankey", "alluvial", "chord", "ligand-receptor", "network", "ppi", "cerna", "mirna-target", "cnet", "enrichment-map", "tree", "dendrogram", "circos", "pie", "donut", "rose", "waffle", "treemap", "sunburst", "radar", "polar-profile", "population-pyramid", "chromosome-ideogram", "snp-density", "go-circle", "kegg-circle", "go-chord", "sankey-bubble", "geographic-map", "petal", "word-cloud"].includes(type);
  const heatmapType = ["heatmap", "clustered-heatmap", "correlation-heatmap"].includes(type);
  const hasHeatmapAnnotationLegend = heatmapType && Boolean(settings.heatmapRowAnnotationData.trim() || settings.heatmapColumnAnnotationData.trim());
  const labelHeavy = ["heatmap", "clustered-heatmap", "correlation-heatmap", "enrichment-bar", "survival-forest", "upset", "genome-tracks", "oncoplot"].includes(type);
  const hasLegend = !["box", "violin", "beeswarm", "raincloud", "histogram", "density", "ridge", "heatmap", "clustered-heatmap", "correlation-heatmap", "venn", "upset", "sankey", "alluvial", "chord", "ligand-receptor", "circos", "treemap", "manhattan", "qq", "chromosome-ideogram", "snp-density", "genome-tracks", "waterfall", "oncoplot", "motif-logo", "funnel", "precision-recall", "calibration", "decision-curve", "nomogram", "lasso-path", "km-cutoff", "risk-score", "go-circle", "kegg-circle", "go-chord", "pathway-impact", "nes-fdr", "multi-gsea", "enrichment-ridge", "sankey-bubble", "geographic-map", "petal", "word-cloud"].includes(type);
  const compactRadialLegend = ["pie", "donut", "rose", "waffle", "sunburst", "radar", "polar-profile", "population-pyramid"].includes(type);
  const legend = hasLegend && settings.legendPosition === "right" ? (compactRadialLegend ? 110 : 145) : 0;
  if (heatmapType) return heatmapLayoutMetrics(settings, { hasAnnotationLegend: hasHeatmapAnnotationLegend, rowAnnotationTracks: 0, columnAnnotationTracks: 0, showRowCut: false, showColumnCut: false, showRowDendrogram: false, showColumnDendrogram: false, showSidePlot: false, rowCount: 1, columnCount: 1, maxColumnLabelCharacters: 0, maxCutClusters: 0 }).frame;
  const left = noAxes ? 14 : labelHeavy ? Math.min(178, settings.width * 0.32) : 66;
  const top = settings.title ? 48 : 24;
  const bottom = hasLegend && settings.legendPosition === "bottom" ? 80 : 58;
  const right = 22 + legend;
  return { width: settings.width, height: settings.height, left, right, top, bottom, plotWidth: Math.max(100, settings.width - left - right), plotHeight: Math.max(90, settings.height - top - bottom) };
}

function palette(groups: string[], colors: string[]) {
  return new Map(groups.map((group, index) => [group, categoricalColorForIndex(index, colors)]));
}

function tickValues(domain: [number, number], count = 5) {
  return Array.from({ length: count }, (_, index) => domain[0] + (domain[1] - domain[0]) * index / Math.max(1, count - 1));
}

function Axes({ frame, settings, xDomain, yDomain, xLabel, yLabel, gridColor, hideXTicks = false, hideYTicks = false, categoryXPositions, categoryYPositions }: { frame: Frame; settings: VisualizationSettings; xDomain: [number, number]; yDomain: [number, number]; xLabel: string; yLabel: string; gridColor: string; hideXTicks?: boolean; hideYTicks?: boolean; categoryXPositions?: number[]; categoryYPositions?: number[] }) {
  const bottom = frame.top + frame.plotHeight;
  const xTicks = tickValues(xDomain, Math.max(3, Math.min(6, Math.floor(frame.plotWidth / 90))));
  const yTicks = tickValues(yDomain, Math.max(3, Math.min(6, Math.floor(frame.plotHeight / 70))));
  const verticalGridPositions = categoryXPositions
    ?? (hideXTicks ? [] : xTicks.map((value) => scaleLinear(value, xDomain, [frame.left, frame.left + frame.plotWidth])));
  const horizontalGridPositions = categoryYPositions
    ?? (hideYTicks ? [] : yTicks.map((value) => scaleLinear(value, yDomain, [bottom, frame.top])));
  return <g>
    {settings.grid === "both" ? verticalGridPositions.map((x) => <line key={`gx-${x}`} data-grid-axis="x" x1={x} x2={x} y1={frame.top} y2={bottom} stroke={gridColor} strokeWidth={settings.gridLineWidth} />) : null}
    {settings.grid !== "none" ? horizontalGridPositions.map((y) => <line key={`gy-${y}`} data-grid-axis="y" x1={frame.left} x2={frame.left + frame.plotWidth} y1={y} y2={y} stroke={gridColor} strokeWidth={settings.gridLineWidth} />) : null}
    <line x1={frame.left} x2={frame.left + frame.plotWidth} y1={bottom} y2={bottom} stroke={TEXT} strokeWidth={settings.axisLineWidth} />
    <line x1={frame.left} x2={frame.left} y1={frame.top} y2={bottom} stroke={TEXT} strokeWidth={settings.axisLineWidth} />
    {!hideXTicks ? xTicks.map((value) => { const x = scaleLinear(value, xDomain, [frame.left, frame.left + frame.plotWidth]); return <g key={`xt-${value}`}><line x1={x} x2={x} y1={bottom} y2={bottom + 5} stroke={TEXT} strokeWidth={settings.axisLineWidth} /><text x={x} y={bottom + 19} textAnchor="middle" fill={TEXT} fontSize={settings.tickSize}>{formatTick(value)}</text></g>; }) : null}
    {!hideYTicks ? yTicks.map((value) => { const y = scaleLinear(value, yDomain, [bottom, frame.top]); return <g key={`yt-${value}`}><line x1={frame.left - 5} x2={frame.left} y1={y} y2={y} stroke={TEXT} strokeWidth={settings.axisLineWidth} /><text x={frame.left - 9} y={y + 4} textAnchor="end" fill={TEXT} fontSize={settings.tickSize}>{formatTick(value)}</text></g>; }) : null}
    {xLabel ? <text x={frame.left + frame.plotWidth / 2} y={frame.height - (settings.legendPosition === "bottom" ? 47 : 13)} textAnchor="middle" fill={TEXT} fontSize={settings.axisLabelSize} fontWeight={600}>{xLabel}</text> : null}
    {yLabel ? <text transform={`translate(18 ${frame.top + frame.plotHeight / 2}) rotate(-90)`} textAnchor="middle" fill={TEXT} fontSize={settings.axisLabelSize} fontWeight={600}>{yLabel}</text> : null}
  </g>;
}

function Legend({ entries, frame, settings }: { entries: LegendEntry[]; frame: Frame; settings: VisualizationSettings }) {
  if (settings.legendPosition === "none" || entries.length < 2) return null;
  if (settings.legendPosition === "bottom") {
    const visible = entries.slice(0, 12);
    const perRow = Math.max(2, Math.min(4, Math.floor(frame.plotWidth / 90)));
    const cellWidth = frame.plotWidth / perRow;
    return <g data-plot-element="plot-legend" transform={`translate(${frame.left} ${frame.height - 72})`}>{visible.map((entry, index) => <g key={entry.label} transform={`translate(${(index % perRow) * cellWidth} ${Math.floor(index / perRow) * (settings.legendSize + 7)})`}><circle cx={4} cy={-4} r={4} fill={entry.color} /><text data-full-label={entry.label} x={13} y={0} fill={TEXT} fontSize={settings.legendSize}><title>{entry.label}</title>{compactLegendLabel(entry.label, settings.legendSize, cellWidth - 17, 15)}</text></g>)}</g>;
  }
  const availableLabelWidth = frame.width - (frame.left + frame.plotWidth + 18) - 13 - 4;
  return <g data-plot-element="plot-legend" transform={`translate(${frame.left + frame.plotWidth + 18} ${frame.top + 5})`}>{entries.slice(0, 12).map((entry, index) => <g key={entry.label} transform={`translate(0 ${index * (settings.legendSize + 10)})`}><circle cx={4} cy={-4} r={4} fill={entry.color} /><text data-full-label={entry.label} x={13} y={0} fill={TEXT} fontSize={settings.legendSize}><title>{entry.label}</title>{compactLegendLabel(entry.label, settings.legendSize, availableLabelWidth, 24)}</text></g>)}</g>;
}

type AssociationPoint = { x: number; y: number; z: number | null; group: string; label: string; index: number };

function convexHull(points: AssociationPoint[]) {
  const sorted = [...points].sort((left, right) => left.x - right.x || left.y - right.y || left.index - right.index);
  if (sorted.length <= 2) return sorted;
  const cross = (origin: AssociationPoint, left: AssociationPoint, right: AssociationPoint) => (left.x - origin.x) * (right.y - origin.y) - (left.y - origin.y) * (right.x - origin.x);
  const half = (source: AssociationPoint[]) => {
    const result: AssociationPoint[] = [];
    source.forEach((point) => { while (result.length >= 2 && cross(result[result.length - 2], result[result.length - 1], point) <= 0) result.pop(); result.push(point); });
    return result;
  };
  const lower = half(sorted);
  const upper = half([...sorted].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function LineAssociationPlot({ frame, dataset, mapping, settings, colors, gridColor }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[]; gridColor: string }) {
  const rows = dataset.rows.map((row, index) => {
    const rawX = parseNumericValue(row[mapping.x]) ?? 0;
    const rawY = parseNumericValue(row[mapping.value]) ?? 0;
    return { x: settings.swapAxes ? rawY : rawX, y: settings.swapAxes ? rawX : rawY, error: settings.lineErrorType !== "none" && mapping.error ? Math.max(0, parseNumericValue(row[mapping.error]) ?? 0) : 0, group: mapping.series ? row[mapping.series] || "All" : "All", index };
  });
  const groups = [...new Set(rows.map((row) => row.group))];
  const colorMap = palette(groups, colors);
  const valueExtent = rows.flatMap((row) => settings.swapAxes ? [row.x - row.error, row.x + row.error] : [row.y - row.error, row.y + row.error]);
  const xDomain = resolveAxisDomain(numericExtent(settings.swapAxes ? valueExtent : rows.map((row) => row.x)), settings.xMin, settings.xMax);
  const yDomain = resolveAxisDomain(numericExtent(settings.swapAxes ? rows.map((row) => row.y) : valueExtent), settings.yMin, settings.yMax);
  const xAt = (value: number) => scaleLinear(value, xDomain, [frame.left, frame.left + frame.plotWidth]);
  const yAt = (value: number) => scaleLinear(value, yDomain, [frame.top + frame.plotHeight, frame.top]);
  return <>
    <Axes frame={frame} settings={settings} xDomain={xDomain} yDomain={yDomain} xLabel={settings.xLabel || (settings.swapAxes ? "Value" : "X")} yLabel={settings.yLabel || (settings.swapAxes ? "X" : "Value")} gridColor={gridColor} />
    <g data-plot-data data-plot-family="line-association">
      {groups.map((group) => { const groupRows = rows.filter((row) => row.group === group).sort((left, right) => (settings.swapAxes ? left.y - right.y : left.x - right.x) || left.index - right.index); const color = colorMap.get(group) ?? colors[0]; const upper = groupRows.map((row) => settings.swapAxes ? `${xAt(row.x + row.error)},${yAt(row.y)}` : `${xAt(row.x)},${yAt(row.y + row.error)}`); const lower = [...groupRows].reverse().map((row) => settings.swapAxes ? `${xAt(row.x - row.error)},${yAt(row.y)}` : `${xAt(row.x)},${yAt(row.y - row.error)}`); return <g key={group}>
        {settings.lineErrorType !== "none" && settings.lineUncertaintyStyle === "band" ? <polygon data-plot-element="line-uncertainty-band" points={[...upper, ...lower].join(" ")} fill={color} fillOpacity={settings.lineBandOpacity} stroke="none" /> : null}
        <polyline data-plot-element="line-series" points={groupRows.map((row) => `${xAt(row.x)},${yAt(row.y)}`).join(" ")} fill="none" stroke={color} strokeWidth={settings.dataLineWidth} strokeLinejoin="round" strokeLinecap="round" />
        {settings.lineErrorType !== "none" && settings.lineUncertaintyStyle === "bars" ? groupRows.map((row) => settings.swapAxes ? <g key={row.index} data-plot-element="line-uncertainty-bar" stroke={color} strokeWidth={settings.errorBarLineWidth}><line x1={xAt(row.x - row.error)} x2={xAt(row.x + row.error)} y1={yAt(row.y)} y2={yAt(row.y)} /><line x1={xAt(row.x - row.error)} x2={xAt(row.x - row.error)} y1={yAt(row.y) - settings.errorBarCapSize / 2} y2={yAt(row.y) + settings.errorBarCapSize / 2} /><line x1={xAt(row.x + row.error)} x2={xAt(row.x + row.error)} y1={yAt(row.y) - settings.errorBarCapSize / 2} y2={yAt(row.y) + settings.errorBarCapSize / 2} /></g> : <g key={row.index} data-plot-element="line-uncertainty-bar" stroke={color} strokeWidth={settings.errorBarLineWidth}><line x1={xAt(row.x)} x2={xAt(row.x)} y1={yAt(row.y - row.error)} y2={yAt(row.y + row.error)} /><line x1={xAt(row.x) - settings.errorBarCapSize / 2} x2={xAt(row.x) + settings.errorBarCapSize / 2} y1={yAt(row.y - row.error)} y2={yAt(row.y - row.error)} /><line x1={xAt(row.x) - settings.errorBarCapSize / 2} x2={xAt(row.x) + settings.errorBarCapSize / 2} y1={yAt(row.y + row.error)} y2={yAt(row.y + row.error)} /></g>) : null}
        {settings.showPoints ? groupRows.map((row) => <circle key={row.index} data-plot-element="line-point" cx={xAt(row.x)} cy={yAt(row.y)} r={settings.pointSize} fill={color} stroke="#FFFFFF" strokeWidth={0.7} />) : null}
      </g>; })}
    </g>
    <Legend entries={groups.map((group) => ({ label: group, color: colorMap.get(group) ?? colors[0] }))} frame={frame} settings={settings} />
  </>;
}

function AssociationPlot({ type, frame, dataset, mapping, settings, colors, gridColor }: { type: "scatter" | "correlation"; frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[]; gridColor: string }) {
  const points: AssociationPoint[] = dataset.rows.map((row, index) => { const rawX = parseNumericValue(row[mapping.x]) ?? 0; const rawY = parseNumericValue(row[mapping.y]) ?? 0; return { x: settings.swapAxes ? rawY : rawX, y: settings.swapAxes ? rawX : rawY, z: mapping.z ? parseNumericValue(row[mapping.z]) : null, group: mapping.group ? row[mapping.group] || "All" : "All", label: mapping.label ? row[mapping.label] || "" : "", index }; });
  const groups = [...new Set(points.map((point) => point.group))];
  const colorMap = palette(groups, colors);
  const buckets = settings.associationGroupMode === "by-group" ? groups.map((group) => ({ group, points: points.filter((point) => point.group === group), color: colorMap.get(group) ?? colors[0] })) : [{ group: "Combined", points, color: colors[0] }];
  if (settings.associationVariant === "ternary") {
    const top: [number, number] = [frame.left + frame.plotWidth / 2, frame.top + 8]; const left: [number, number] = [frame.left + 12, frame.top + frame.plotHeight - 6]; const right: [number, number] = [frame.left + frame.plotWidth - 12, frame.top + frame.plotHeight - 6];
    return <><g data-plot-data data-plot-family="ternary"><polygon points={`${top.join(",")} ${left.join(",")} ${right.join(",")}`} fill="#FAF9F7" stroke={TEXT} strokeWidth={settings.axisLineWidth} />{[0.25, 0.5, 0.75].map((fraction) => <g key={fraction} stroke={gridColor} strokeWidth={settings.gridLineWidth}><line x1={left[0] + (top[0] - left[0]) * fraction} y1={left[1] + (top[1] - left[1]) * fraction} x2={right[0] + (top[0] - right[0]) * fraction} y2={right[1] + (top[1] - right[1]) * fraction} /><line x1={top[0] + (right[0] - top[0]) * fraction} y1={top[1] + (right[1] - top[1]) * fraction} x2={left[0] + (right[0] - left[0]) * fraction} y2={left[1] + (right[1] - left[1]) * fraction} /><line x1={right[0] + (left[0] - right[0]) * fraction} y1={right[1]} x2={top[0] + (left[0] - top[0]) * fraction} y2={top[1] + (left[1] - top[1]) * fraction} /></g>)}{points.map((point) => { const total = Math.max(point.x + point.y + (point.z ?? 0), Number.EPSILON); const x = (point.x * left[0] + point.y * right[0] + (point.z ?? 0) * top[0]) / total; const y = (point.x * left[1] + point.y * right[1] + (point.z ?? 0) * top[1]) / total; return <circle key={point.index} data-plot-element="ternary-point" cx={x} cy={y} r={settings.pointSize} fill={colorMap.get(point.group)} fillOpacity={settings.opacity} stroke="#FFFFFF" strokeWidth={0.7} />; })}<text x={left[0]} y={left[1] + 18} textAnchor="middle" fill={TEXT} fontSize={settings.tickSize}>{mapping.x}</text><text x={right[0]} y={right[1] + 18} textAnchor="middle" fill={TEXT} fontSize={settings.tickSize}>{mapping.y}</text><text x={top[0]} y={top[1] - 7} textAnchor="middle" fill={TEXT} fontSize={settings.tickSize}>{mapping.z}</text></g><Legend entries={groups.map((group) => ({ label: group, color: colorMap.get(group) ?? colors[0] }))} frame={frame} settings={settings} /></>;
  }
  if (settings.associationVariant === "3d") {
    const xExtent = numericExtent(points.map((point) => point.x)); const yExtent = numericExtent(points.map((point) => point.y)); const zExtent = numericExtent(points.map((point) => point.z ?? 0));
    const normalize = (value: number, extent: [number, number]) => (value - extent[0]) / Math.max(Number.EPSILON, extent[1] - extent[0]);
    const projected = points.map((point) => { const nx = normalize(point.x, xExtent) - 0.5; const ny = normalize(point.y, yExtent) - 0.5; const nz = normalize(point.z ?? 0, zExtent) - 0.5; return { ...point, px: frame.left + frame.plotWidth * (0.5 + nx * 0.68 + nz * 0.25), py: frame.top + frame.plotHeight * (0.52 - ny * 0.72 + nz * 0.2), depth: nz }; }).sort((leftPoint, rightPoint) => leftPoint.depth - rightPoint.depth || leftPoint.index - rightPoint.index);
    const origin = [frame.left + frame.plotWidth * 0.22, frame.top + frame.plotHeight * 0.78];
    return <><g data-plot-data data-plot-family="scatter-3d"><g stroke={TEXT} strokeWidth={settings.axisLineWidth}><line x1={origin[0]} y1={origin[1]} x2={frame.left + frame.plotWidth * 0.82} y2={origin[1]} /><line x1={origin[0]} y1={origin[1]} x2={origin[0]} y2={frame.top + frame.plotHeight * 0.18} /><line x1={origin[0]} y1={origin[1]} x2={frame.left + frame.plotWidth * 0.42} y2={frame.top + frame.plotHeight * 0.9} /></g>{projected.map((point) => <circle key={point.index} data-plot-element="scatter-3d-point" cx={point.px} cy={point.py} r={settings.pointSize} fill={colorMap.get(point.group)} fillOpacity={settings.opacity} stroke="#FFFFFF" strokeWidth={0.7} />)}<text x={frame.left + frame.plotWidth * 0.84} y={origin[1] + 4} fill={TEXT} fontSize={settings.tickSize}>{mapping.x}</text><text x={origin[0]} y={frame.top + frame.plotHeight * 0.14} textAnchor="middle" fill={TEXT} fontSize={settings.tickSize}>{mapping.y}</text><text x={frame.left + frame.plotWidth * 0.44} y={frame.top + frame.plotHeight * 0.94} fill={TEXT} fontSize={settings.tickSize}>{mapping.z}</text><text x={frame.left + frame.plotWidth - 2} y={frame.top + 12} textAnchor="end" fill={TEXT} fontSize={Math.max(8, settings.tickSize - 1)}>Per-axis normalized · orthographic</text></g><Legend entries={groups.map((group) => ({ label: group, color: colorMap.get(group) ?? colors[0] }))} frame={frame} settings={settings} /></>;
  }
  if (settings.associationVariant === "pair-matrix") {
    const variables = [{ key: mapping.x, values: points.map((point) => point.x) }, { key: mapping.y, values: points.map((point) => point.y) }, { key: mapping.z, values: points.map((point) => point.z ?? 0) }]; const cellWidth = frame.plotWidth / 3; const cellHeight = frame.plotHeight / 3;
    return <><g data-plot-data data-plot-family="pair-matrix">{variables.flatMap((vertical, row) => variables.map((horizontal, column) => { const x = frame.left + column * cellWidth; const y = frame.top + row * cellHeight; const xDomain = numericExtent(horizontal.values); const yDomain = numericExtent(vertical.values); if (row === column) { const bins = deterministicHistogram(horizontal.values, 6, xDomain); const max = Math.max(...bins.map((bin) => bin.count), 1); return <g key={`${row}-${column}`} data-plot-element="pair-diagonal"><rect x={x} y={y} width={cellWidth} height={cellHeight} fill="#FAF9F7" stroke={gridColor} />{bins.map((bin) => <rect key={bin.index} x={scaleLinear(bin.lower, xDomain, [x + 3, x + cellWidth - 3])} y={y + cellHeight - 4 - bin.count / max * (cellHeight - 18)} width={Math.max(1, cellWidth / bins.length - 1)} height={bin.count / max * (cellHeight - 18)} fill={colors[0]} fillOpacity={0.5} />)}<text x={x + 5} y={y + 12} fill={TEXT} fontSize={Math.max(8, settings.tickSize - 1)}>{horizontal.key}</text></g>; } return <g key={`${row}-${column}`} data-plot-element="pair-cell"><rect x={x} y={y} width={cellWidth} height={cellHeight} fill="#FFFFFF" stroke={gridColor} />{points.map((point, index) => <circle key={point.index} cx={scaleLinear(horizontal.values[index], xDomain, [x + 4, x + cellWidth - 4])} cy={scaleLinear(vertical.values[index], yDomain, [y + cellHeight - 4, y + 4])} r={Math.max(1.4, settings.pointSize * 0.45)} fill={colorMap.get(point.group)} fillOpacity={settings.opacity} />)}</g>; }))}</g><Legend entries={groups.map((group) => ({ label: group, color: colorMap.get(group) ?? colors[0] }))} frame={frame} settings={settings} /></>;
  }
  const marginal = settings.associationVariant === "marginal";
  const denseVariant = ["density", "hexbin"].includes(settings.associationVariant);
  const showAssociationStatistics = type === "correlation" || settings.associationShowPValue;
  const showFitStatistics = settings.associationFit !== "none";
  const summaryInSidebar = settings.legendPosition === "right" && !denseVariant;
  const annotationRows = !summaryInSidebar && (showAssociationStatistics || showFitStatistics) ? Math.min(4, buckets.length) + 1 : 0;
  const annotationLineHeight = Math.max(10, settings.legendSize + 1);
  const annotationHeight = annotationRows * annotationLineHeight;
  const annotatedFrame = annotationHeight > 0 ? { ...frame, top: frame.top + annotationHeight, plotHeight: Math.max(80, frame.plotHeight - annotationHeight) } : frame;
  const chartFrame = marginal ? { ...annotatedFrame, top: annotatedFrame.top + 28, right: annotatedFrame.right + 28, plotWidth: annotatedFrame.plotWidth - 28, plotHeight: Math.max(70, annotatedFrame.plotHeight - 28) } : annotatedFrame;
  const ellipseGeometries = settings.associationVariant === "ellipse" ? buckets.map((bucket) => ({ group: bucket.group, color: bucket.color, points: covarianceEllipsePoints(bucket.points) })) : [];
  const xDomain = resolveAxisDomain(numericExtent([...points.map((point) => point.x), ...ellipseGeometries.flatMap((ellipse) => ellipse.points.map((point) => point.x))]), settings.xMin, settings.xMax);
  const fitCurves = buckets.map((bucket) => { const samples = Array.from({ length: 64 }, (_, index) => xDomain[0] + (xDomain[1] - xDomain[0]) * index / 63); if (settings.associationFit === "linear") { const fit = linearRegression(bucket.points); return { ...bucket, curve: fit ? samples.map((x) => ({ x, y: fit.intercept + fit.slope * x })) : [], statistic: fit ? `linear R²=${fit.rSquared.toFixed(3)}` : "linear undefined", band: settings.associationShowConfidenceBand ? linearConfidenceBand95(bucket.points, samples) : [] }; } if (settings.associationFit === "polynomial") { const fit = polynomialRegression(bucket.points, settings.associationPolynomialDegree); return { ...bucket, curve: fit ? samples.map((x) => ({ x, y: fit.predict(x) })) : [], statistic: fit ? `degree-${settings.associationPolynomialDegree} R²=${fit.rSquared.toFixed(3)}` : "polynomial undefined", band: [] }; } if (settings.associationFit === "loess") return { ...bucket, curve: loessSmooth(bucket.points, settings.associationLoessSpan), statistic: `LOESS span=${settings.associationLoessSpan.toFixed(2)}`, band: [] }; return { ...bucket, curve: [], statistic: "", band: [] }; });
  const fittedYValues = fitCurves.flatMap((fit) => [...fit.curve.map((point) => point.y), ...fit.band.flatMap((point) => [point.lower, point.upper])]);
  const yDomain = resolveAxisDomain(numericExtent([...points.map((point) => point.y), ...fittedYValues, ...ellipseGeometries.flatMap((ellipse) => ellipse.points.map((point) => point.y))]), settings.yMin, settings.yMax);
  const xAt = (value: number) => scaleLinear(value, xDomain, [chartFrame.left, chartFrame.left + chartFrame.plotWidth]); const yAt = (value: number) => scaleLinear(value, yDomain, [chartFrame.top + chartFrame.plotHeight, chartFrame.top]);
  const statistics = buckets.map((bucket) => { const coefficient = correlation(bucket.points.map((point) => point.x), bucket.points.map((point) => point.y), settings.correlationMethod); const p = correlationPValue(coefficient, bucket.points.length); return { ...bucket, coefficient, p }; });
  const summaryHeaders = [showAssociationStatistics ? settings.correlationMethod === "pearson" ? "Pearson r" : "Spearman ρ" : "", settings.associationShowPValue ? settings.correlationMethod === "pearson" ? "two-sided t p" : "two-sided t-approx p" : "", showFitStatistics ? settings.associationFit === "linear" ? "linear R²" : settings.associationFit === "polynomial" ? `degree-${settings.associationPolynomialDegree} R²` : `LOESS span ${settings.associationLoessSpan.toFixed(2)}` : ""].filter(Boolean);
  const densityMarks = settings.associationVariant === "density" ? buckets.flatMap((bucket) => { const xSpan = Math.max(xDomain[1] - xDomain[0], Number.EPSILON); const ySpan = Math.max(yDomain[1] - yDomain[0], Number.EPSILON); const bandwidth = settings.associationDensityBandwidth; const cells = Array.from({ length: 14 * 12 }, (_, index) => { const column = index % 14; const row = Math.floor(index / 14); const x = xDomain[0] + (column + 0.5) / 14 * xSpan; const y = yDomain[0] + (row + 0.5) / 12 * ySpan; const density = bucket.points.reduce((sum, point) => sum + Math.exp(-0.5 * (((point.x - x) / (xSpan / 7 * bandwidth)) ** 2 + ((point.y - y) / (ySpan / 6 * bandwidth)) ** 2)), 0); return { column, row, density }; }); const maximum = Math.max(...cells.map((cell) => cell.density), Number.EPSILON); return cells.filter((cell) => cell.density / maximum > 0.05).map((cell) => <rect key={`${bucket.group}-${cell.column}-${cell.row}`} data-plot-element="density-cell" x={chartFrame.left + cell.column / 14 * chartFrame.plotWidth} y={chartFrame.top + (11 - cell.row) / 12 * chartFrame.plotHeight} width={chartFrame.plotWidth / 14 + 0.4} height={chartFrame.plotHeight / 12 + 0.4} fill={bucket.color} fillOpacity={cell.density / maximum * 0.32} />); }) : [];
  const hexMarks = settings.associationVariant === "hexbin" ? buckets.flatMap((bucket) => { const size = settings.associationHexbinSize; const bins = new Map<string, { x: number; y: number; count: number }>(); bucket.points.forEach((point) => { const px = xAt(point.x); const py = yAt(point.y); const row = Math.round(py / (size * 0.86)); const column = Math.round((px - (row % 2) * size * 0.5) / size); const key = `${column}\u0000${row}`; const bin = bins.get(key) ?? { x: column * size + (row % 2) * size * 0.5, y: row * size * 0.86, count: 0 }; bin.count += 1; bins.set(key, bin); }); const maximum = Math.max(...[...bins.values()].map((bin) => bin.count), 1); return [...bins.values()].map((bin, index) => { const radius = size * 0.46; const vertices = Array.from({ length: 6 }, (_, vertex) => `${bin.x + Math.cos(Math.PI / 3 * vertex) * radius},${bin.y + Math.sin(Math.PI / 3 * vertex) * radius}`).join(" "); return <polygon key={`${bucket.group}-${index}`} data-plot-element="hexbin" data-bin-count={bin.count} points={vertices} fill={bucket.color} fillOpacity={0.18 + bin.count / maximum * 0.62} stroke="#FFFFFF" strokeWidth={0.5} />; }); }) : [];
  const associationLegendEntries = denseVariant ? [{ label: "Combined", color: colors[0] }] : groups.map((group) => ({ label: group, color: colorMap.get(group) ?? colors[0] }));
  return <><Axes frame={chartFrame} settings={settings} xDomain={xDomain} yDomain={yDomain} xLabel={settings.xLabel || "X"} yLabel={settings.yLabel || "Y"} gridColor={gridColor} /><g data-plot-data data-plot-family={`association-${settings.associationVariant}`}>{densityMarks}{hexMarks}
    {settings.associationVariant === "hull" ? buckets.map((bucket) => { const hull = convexHull(bucket.points); return hull.length >= 3 ? <polygon key={bucket.group} data-plot-element="convex-hull" points={hull.map((point) => `${xAt(point.x)},${yAt(point.y)}`).join(" ")} fill={bucket.color} fillOpacity={0.1} stroke={bucket.color} strokeWidth={settings.dataLineWidth} /> : null; }) : null}
    {settings.associationVariant === "ellipse" ? ellipseGeometries.map((ellipse) => ellipse.points.length ? <polyline key={ellipse.group} data-plot-element="covariance-ellipse" points={ellipse.points.map((point) => `${xAt(point.x)},${yAt(point.y)}`).join(" ")} fill={ellipse.color} fillOpacity={0.08} stroke={ellipse.color} strokeWidth={settings.dataLineWidth} /> : null) : null}
    {fitCurves.map((fit) => <g key={fit.group}>{fit.band.length ? <polygon data-plot-element="fit-confidence-band" points={[...fit.band.map((point) => `${xAt(point.x)},${yAt(point.upper)}`), ...[...fit.band].reverse().map((point) => `${xAt(point.x)},${yAt(point.lower)}`)].join(" ")} fill={fit.color} fillOpacity={settings.lineBandOpacity} /> : null}{fit.curve.length ? <polyline data-plot-element="association-fit" points={fit.curve.map((point) => `${xAt(point.x)},${yAt(point.y)}`).join(" ")} fill="none" stroke={fit.color} strokeWidth={settings.dataLineWidth} strokeDasharray={settings.associationFit === "loess" ? undefined : "5 4"} /> : null}</g>)}
    {settings.associationVariant !== "density" && settings.associationVariant !== "hexbin" ? points.map((point) => { const x = xAt(point.x); const y = yAt(point.y); return <g key={point.index}><circle data-plot-element="association-point" cx={x} cy={y} r={settings.pointSize} fill={colorMap.get(point.group)} fillOpacity={settings.opacity} stroke="#FFFFFF" strokeWidth={0.7} />{settings.showLabels && point.label ? <text data-plot-label x={x + settings.pointSize + 2} y={y - 3} fill={TEXT} fontSize={settings.tickSize}>{point.label.slice(0, 12)}</text> : null}</g>; }) : null}
    {marginal ? <g data-plot-element="marginals">{deterministicHistogram(points.map((point) => point.x), 10, xDomain).map((bin) => <rect key={`x-${bin.index}`} x={xAt(bin.lower)} y={frame.top + 25 - bin.count / Math.max(1, points.length) * 65} width={Math.max(1, xAt(bin.upper) - xAt(bin.lower) - 0.5)} height={bin.count / Math.max(1, points.length) * 65} fill={colors[0]} fillOpacity={0.45} />)}{deterministicHistogram(points.map((point) => point.y), 10, yDomain).map((bin) => <rect key={`y-${bin.index}`} x={chartFrame.left + chartFrame.plotWidth + 3} y={yAt(bin.upper)} width={bin.count / Math.max(1, points.length) * 65} height={Math.max(1, yAt(bin.lower) - yAt(bin.upper) - 0.5)} fill={colors[0]} fillOpacity={0.45} />)}</g> : null}
  </g>{showAssociationStatistics || showFitStatistics ? <g data-plot-element="association-summary">{summaryInSidebar ? summaryHeaders.map((header, index) => <text key={header} x={frame.left + frame.plotWidth + 10} y={frame.top + associationLegendEntries.length * (settings.legendSize + 8) + 12 + index * annotationLineHeight} fill={TEXT} fontSize={Math.max(8, settings.legendSize - 2)} fontWeight={700}>{header}</text>) : <text x={frame.left + 2} y={frame.top + annotationLineHeight - 2} fill={TEXT} fontSize={Math.max(8, settings.legendSize - 2)} fontWeight={700}>{summaryHeaders.join(" · ")}</text>}{statistics.slice(0, 4).map((statistic, index) => { const fit = fitCurves[index]; const pLabel = Number.isFinite(statistic.p) ? (statistic.p < 0.001 ? "<0.001" : statistic.p.toFixed(3)) : "NA"; const coefficient = Number.isFinite(statistic.coefficient) ? statistic.coefficient.toFixed(3) : "NA"; const fitValue = fit?.statistic.match(/R²=([\d.]+)/)?.[1]; const x = summaryInSidebar ? frame.left + frame.plotWidth + 10 : frame.left + 2; const y = summaryInSidebar ? frame.top + associationLegendEntries.length * (settings.legendSize + 8) + 12 + (summaryHeaders.length + index) * annotationLineHeight : frame.top + (index + 2) * annotationLineHeight - 2; return <text key={statistic.group} data-plot-element="association-statistic" x={x} y={y} fill={statistic.color} fontSize={Math.max(8, settings.legendSize - 2)}>{settings.associationGroupMode === "by-group" ? `${statistic.group.slice(0, 10)} · ` : ""}{showAssociationStatistics ? `${coefficient} · n=${statistic.points.length}${settings.associationShowPValue ? ` · ${pLabel}` : ""}` : ""}{showAssociationStatistics && showFitStatistics ? " · " : ""}{showFitStatistics ? settings.associationFit === "loess" ? settings.associationLoessSpan.toFixed(2) : fitValue ?? "NA" : ""}</text>; })}</g> : null}<Legend entries={associationLegendEntries} frame={frame} settings={settings} /></>;
}

function ScatterFamily({ type, frame, dataset, mapping, settings, colors, gridColor }: Omit<Props, "svgRef" | "themeId"> & { frame: Frame; colors: string[]; gridColor: string }) {
  const points = dataset.rows.map((row, index) => ({
    x: parseNumericValue(row[mapping.x]) ?? 0,
    y: parseNumericValue(row[mapping.y]) ?? 0,
    group: mapping.group ? row[mapping.group] || "All" : "All",
    label: mapping.label ? row[mapping.label] || "" : "",
    index,
  }));
  const xDomain = resolveAxisDomain(numericExtent([...points.map((point) => point.x), ...(type === "quadrant" ? [settings.xThreshold] : [])]), settings.xMin, settings.xMax);
  const yDomain = resolveAxisDomain(numericExtent([...points.map((point) => point.y), ...(type === "quadrant" ? [settings.yThreshold] : [])]), settings.yMin, settings.yMax);
  const groups = [...new Set(points.map((point) => point.group))];
  const colorMap = palette(groups, colors);
  const xAt = (value: number) => scaleLinear(value, xDomain, [frame.left, frame.left + frame.plotWidth]);
  const yAt = (value: number) => scaleLinear(value, yDomain, [frame.top + frame.plotHeight, frame.top]);
  const fit = linearRegression(points);
  const coefficient = correlation(points.map((point) => point.x), points.map((point) => point.y), settings.correlationMethod);
  const xLabel = settings.xLabel || (type === "pcoa" ? "PCoA 1" : type === "umap" ? "UMAP 1" : "X");
  const yLabel = settings.yLabel || (type === "pcoa" ? "PCoA 2" : type === "umap" ? "UMAP 2" : "Y");
  return <>
    <Axes frame={frame} settings={settings} xDomain={xDomain} yDomain={yDomain} xLabel={xLabel} yLabel={yLabel} gridColor={gridColor} />
    <g data-plot-data>
    {type === "quadrant" ? <><line x1={xAt(settings.xThreshold)} x2={xAt(settings.xThreshold)} y1={frame.top} y2={frame.top + frame.plotHeight} stroke={TEXT} strokeDasharray="5 4" opacity={0.65} /><line x1={frame.left} x2={frame.left + frame.plotWidth} y1={yAt(settings.yThreshold)} y2={yAt(settings.yThreshold)} stroke={TEXT} strokeDasharray="5 4" opacity={0.65} /></> : null}
    {type === "correlation" && settings.showTrend && fit ? <line x1={xAt(xDomain[0])} y1={yAt(fit.intercept + fit.slope * xDomain[0])} x2={xAt(xDomain[1])} y2={yAt(fit.intercept + fit.slope * xDomain[1])} stroke={colors[0]} strokeWidth={settings.dataLineWidth} /> : null}
    {points.map((point) => { const x = xAt(point.x); const y = yAt(point.y); const rightHalf = point.x > (xDomain[0] + xDomain[1]) / 2; const upperHalf = point.y > (yDomain[0] + yDomain[1]) / 2; return <g key={point.index}><circle cx={x} cy={y} r={settings.pointSize} fill={colorMap.get(point.group)} fillOpacity={settings.opacity} stroke="#FFFFFF" strokeWidth={0.7} />{settings.showLabels && point.label ? <text data-plot-label x={rightHalf ? x - settings.pointSize - 2 : x + settings.pointSize + 2} y={upperHalf ? y + settings.tickSize + 2 + (point.index % 2) * 3 : y - 3 - (point.index % 2) * 3} textAnchor={rightHalf ? "end" : "start"} fill={TEXT} fontSize={settings.tickSize}>{point.label}</text> : null}</g>; })}
    </g>
    {type === "correlation" ? <text x={frame.left + 10} y={frame.top + 18} fill={TEXT} fontSize={settings.legendSize} fontWeight={700}>{settings.correlationMethod === "pearson" ? "Pearson r" : "Spearman ρ"} = {coefficient.toFixed(3)} · n = {points.length}</text> : null}
    <Legend entries={groups.map((group) => ({ label: group, color: colorMap.get(group) ?? colors[0] }))} frame={frame} settings={settings} />
  </>;
}

function OrdinationMark({ x, y, radius, shapeIndex, color, opacity }: { x: number; y: number; radius: number; shapeIndex: number; color: string; opacity: number }) {
  const shape = shapeIndex % 4;
  if (shape === 1) return <rect data-plot-element="ordination-point" data-shape="square" x={x - radius * 0.86} y={y - radius * 0.86} width={radius * 1.72} height={radius * 1.72} rx={0.8} fill={color} fillOpacity={opacity} stroke="#FFFFFF" strokeWidth={0.7} />;
  if (shape === 2) return <polygon data-plot-element="ordination-point" data-shape="triangle" points={`${x},${y - radius} ${x + radius * 0.92},${y + radius * 0.8} ${x - radius * 0.92},${y + radius * 0.8}`} fill={color} fillOpacity={opacity} stroke="#FFFFFF" strokeWidth={0.7} />;
  if (shape === 3) return <polygon data-plot-element="ordination-point" data-shape="diamond" points={`${x},${y - radius} ${x + radius},${y} ${x},${y + radius} ${x - radius},${y}`} fill={color} fillOpacity={opacity} stroke="#FFFFFF" strokeWidth={0.7} />;
  return <circle data-plot-element="ordination-point" data-shape="circle" cx={x} cy={y} r={radius} fill={color} fillOpacity={opacity} stroke="#FFFFFF" strokeWidth={0.7} />;
}

function OrdinationShapeLegend({ shapes, shapeMap, settings, layout }: { shapes: string[]; shapeMap: Map<string, number>; settings: VisualizationSettings; layout: ReturnType<typeof ordinationLegendLayout> }) {
  if (!settings.ordinationUseShapes || shapes.length < 2 || settings.legendPosition === "none") return null;
  const fontSize = Math.max(8, settings.legendSize - 1);
  const availableLabelWidth = settings.legendPosition === "right" ? settings.width - layout.shapeX - 12 - 4 : 62;
  return <g data-plot-element="ordination-shape-legend" transform={`translate(${layout.shapeX} ${layout.shapeY})`}><text x={0} y={0} fill={TEXT} fontSize={fontSize} fontWeight={700}>Shape</text>{shapes.slice(0, 4).map((shape, index) => <g key={shape} transform={`translate(${settings.legendPosition === "right" ? 0 : index * 74} ${settings.legendPosition === "right" ? 9 + index * (settings.legendSize + 6) : 9})`}><OrdinationMark x={4} y={4} radius={4} shapeIndex={shapeMap.get(shape) ?? 0} color={TEXT} opacity={0.85} /><text data-full-label={shape} x={12} y={8} fill={TEXT} fontSize={fontSize}><title>{shape}</title>{compactLegendLabel(shape, fontSize, availableLabelWidth, 10)}</text></g>)}</g>;
}

function OrdinationLabel({ x, y, radius, label, frame, fontSize }: { x: number; y: number; radius: number; label: string; frame: Frame; fontSize: number }) {
  const fullText = label.slice(0, 12);
  const rightSpace = frame.left + frame.plotWidth - x - radius - 3;
  const leftSpace = x - frame.left - radius - 3;
  const fullWidth = fullText.length * fontSize;
  const side = rightSpace >= fullWidth ? "right" : leftSpace >= fullWidth ? "left" : "center";
  const centeredCapacity = Math.max(1, Math.floor((frame.plotWidth - 6) / fontSize));
  const capacity = side === "center" ? centeredCapacity : Math.max(1, Math.floor((side === "right" ? rightSpace : leftSpace) / fontSize));
  const text = fullText.length <= capacity ? fullText : capacity > 1 ? `${fullText.slice(0, capacity - 1)}…` : "…";
  const estimatedWidth = text.length * fontSize;
  const labelX = side === "right" ? x + radius + 2 : side === "left" ? x - radius - 2 : Math.max(frame.left + estimatedWidth / 2 + 2, Math.min(frame.left + frame.plotWidth - estimatedWidth / 2 - 2, x));
  const textAnchor = side === "right" ? "start" : side === "left" ? "end" : "middle";
  const placeAbove = y - fontSize - 3 >= frame.top;
  const labelY = placeAbove ? y - 3 : Math.min(frame.top + frame.plotHeight - 2, y + fontSize + 2);
  return <text data-plot-label data-full-label={label} x={labelX} y={labelY} textAnchor={textAnchor} fill={TEXT} fontSize={fontSize}><title>{label}</title>{text}</text>;
}

function OrdinationPlot({ type, frame, dataset, mapping, settings, colors, gridColor }: { type: OrdinationType; frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[]; gridColor: string }) {
  const explainedVariance = dataset.analysis?.pca?.explainedVariance ?? [];
  if (type === "pca" && settings.ordinationView === "scree") {
    const values = explainedVariance.slice(0, 10);
    const yDomain = numericExtent([0, ...values.map((value) => value * 100)], true);
    const band = frame.plotWidth / Math.max(1, values.length);
    const positions = values.map((_, index) => frame.left + (index + 0.5) * band);
    const yAt = (value: number) => scaleLinear(value, yDomain, [frame.top + frame.plotHeight, frame.top]);
    return <><Axes frame={frame} settings={settings} xDomain={[0, values.length]} yDomain={yDomain} xLabel={settings.xLabel || "Principal component"} yLabel={settings.yLabel || "Explained variance (%)"} gridColor={gridColor} hideXTicks categoryXPositions={positions} /><g data-plot-data data-plot-family="ordination-scree">{values.map((value, index) => { const x = frame.left + index * band + band * 0.16; const y = yAt(value * 100); return <g key={index}><rect data-plot-element="scree-bar" x={x} y={y} width={band * 0.68} height={frame.top + frame.plotHeight - y} rx={1.5} fill={colors[index % colors.length]} fillOpacity={settings.opacity} /><circle data-plot-element="scree-point" cx={x + band * 0.34} cy={y} r={Math.max(2.2, settings.pointSize * 0.58)} fill={TEXT} /><text x={x + band * 0.34} y={frame.top + frame.plotHeight + 17} textAnchor="middle" fill={TEXT} fontSize={settings.tickSize}>PC{index + 1}</text><text x={x + band * 0.34} y={Math.max(frame.top + settings.tickSize, y - 5)} textAnchor="middle" fill={TEXT} fontSize={Math.max(8, settings.tickSize - 1)}>{(value * 100).toFixed(1)}%</text></g>; })}{values.length > 1 ? <polyline data-plot-element="scree-line" points={values.map((value, index) => `${frame.left + (index + 0.5) * band},${yAt(value * 100)}`).join(" ")} fill="none" stroke={TEXT} strokeWidth={settings.dataLineWidth} /> : null}</g></>;
  }

  const annotation = ordinationAnnotationLayout(type, settings);
  const annotationLines = annotation.lines;
  const annotationFontSize = annotation.fontSize;
  const annotationLineHeight = annotation.lineHeight;
  const sharedFrame = ordinationFrameMetrics(type, settings);
  const chartFrame: Frame = sharedFrame;
  const scoreDomains = ordinationScoreDomains(type, dataset, mapping, settings);
  const displayedXColumn = scoreDomains.displayedXColumn;
  const displayedYColumn = scoreDomains.displayedYColumn;
  const rawPoints = dataset.rows.map((row, index) => ({
    x: parseNumericValue(row[displayedXColumn]) ?? 0,
    y: parseNumericValue(row[displayedYColumn]) ?? 0,
    z: mapping.z ? parseNumericValue(row[mapping.z]) ?? 0 : 0,
    group: mapping.group ? row[mapping.group] || "All" : "All",
    shape: settings.ordinationUseShapes && mapping.shape ? row[mapping.shape] || "All" : "All",
    label: mapping.label ? row[mapping.label] || "" : "",
    index,
  }));
  const groups = [...new Set(rawPoints.map((point) => point.group))];
  const shapes = [...new Set(rawPoints.map((point) => point.shape))];
  const ordinationLegend = ordinationLegendLayout(type, settings, groups.length, shapes.length);
  const colorMap = palette(groups, colors);
  const shapeMap = new Map(shapes.map((shape, index) => [shape, index]));
  const componentIndex = (header: string) => Math.max(0, Number(header.match(/\d+/)?.[0] ?? 1) - 1);
  const defaultAxis = (axis: 1 | 2 | 3) => type === "pca" ? `PC${axis}` : type === "pcoa" ? `PCoA ${axis}` : type === "umap" ? `UMAP ${axis}` : type === "tsne" ? `t-SNE ${axis}` : `NMDS ${axis}`;
  const axisLabel = (axis: 1 | 2 | 3) => {
    const custom = axis === 1 ? settings.xLabel : axis === 2 ? settings.yLabel : "";
    if (custom) return custom;
    if (type === "pca") {
      const componentColumn = axis === 1 ? displayedXColumn : axis === 2 ? displayedYColumn : mapping.z;
      const component = componentIndex(componentColumn);
      const explained = explainedVariance[component];
      return `${componentColumn || defaultAxis(axis)}${Number.isFinite(explained) ? ` (${(explained * 100).toFixed(1)}%)` : ""}`;
    }
    const coordinateColumn = axis === 1 ? mapping.x : axis === 2 ? mapping.y : mapping.z;
    const numberMatch = coordinateColumn?.match(/(?:^|[_ .-])(?:dim|axis|component|pc|pcoa|umap|tsne|nmds)[_ .-]?(\d+)$/i);
    const coordinateNumber = numberMatch ? Math.max(1, Number(numberMatch[1])) : axis;
    const mappedLabel = numberMatch
      ? type === "pcoa" ? `PCoA ${coordinateNumber}` : type === "umap" ? `UMAP ${coordinateNumber}` : type === "tsne" ? `t-SNE ${coordinateNumber}` : `NMDS ${coordinateNumber}`
      : coordinateColumn || defaultAxis(axis);
    const suppliedVariance = [settings.ordinationXVariance, settings.ordinationYVariance, settings.ordinationZVariance][coordinateNumber - 1] ?? null;
    return `${mappedLabel}${type === "pcoa" && suppliedVariance !== null ? ` (${suppliedVariance.toFixed(1)}%)` : ""}`;
  };

  if (settings.ordinationView === "3d") {
    const xExtent = numericExtent(rawPoints.map((point) => point.x)); const yExtent = numericExtent(rawPoints.map((point) => point.y)); const zExtent = numericExtent(rawPoints.map((point) => point.z));
    const project = (point: { x: number; y: number; z: number }) => { const nx = scaleLinear(point.x, xExtent, [-1, 1]); const ny = scaleLinear(point.y, yExtent, [-1, 1]); const nz = scaleLinear(point.z, zExtent, [-1, 1]); return { x: chartFrame.left + chartFrame.plotWidth * (0.5 + nx * 0.34 + nz * 0.13), y: chartFrame.top + chartFrame.plotHeight * (0.5 - ny * 0.34 + nz * 0.1) }; };
    const projected = rawPoints.map((point) => ({ ...point, ...project(point) }));
    const centroids = groups.map((group) => { const members = rawPoints.filter((point) => point.group === group); const centroid = { x: members.reduce((sum, point) => sum + point.x, 0) / members.length, y: members.reduce((sum, point) => sum + point.y, 0) / members.length, z: members.reduce((sum, point) => sum + point.z, 0) / members.length }; return { group, ...project(centroid) }; });
    return <>{annotationLines.map((line, index) => <text key={`${index}-${line}`} x={14} y={sharedFrame.annotationTop + (index + 1) * annotationLineHeight - 4} fill={TEXT} fontSize={annotationFontSize}>{line}</text>)}<g data-plot-data data-plot-family="ordination-3d"><rect x={chartFrame.left} y={chartFrame.top} width={chartFrame.plotWidth} height={chartFrame.plotHeight} fill="none" stroke={gridColor} /><path d={`M ${chartFrame.left + 20} ${chartFrame.top + chartFrame.plotHeight - 20} l 42 0 m -42 0 l 0 -42 m 0 42 l 24 18`} fill="none" stroke={TEXT} strokeWidth={settings.axisLineWidth} /><text x={chartFrame.left + 66} y={chartFrame.top + chartFrame.plotHeight - 16} fill={TEXT} fontSize={settings.tickSize}>{axisLabel(1)}</text><text x={chartFrame.left + 4} y={chartFrame.top + chartFrame.plotHeight - 67} fill={TEXT} fontSize={settings.tickSize}>{axisLabel(2)}</text><text x={chartFrame.left + 47} y={chartFrame.top + chartFrame.plotHeight + 2} fill={TEXT} fontSize={settings.tickSize}>{axisLabel(3)}</text>{projected.map((point) => <g key={point.index}><OrdinationMark x={point.x} y={point.y} radius={settings.pointSize} shapeIndex={shapeMap.get(point.shape) ?? 0} color={colorMap.get(point.group) ?? colors[0]} opacity={settings.opacity} />{settings.showLabels && point.label ? <OrdinationLabel x={point.x} y={point.y} radius={settings.pointSize} label={point.label} frame={chartFrame} fontSize={settings.tickSize} /> : null}</g>)}{settings.ordinationShowCentroids ? centroids.map((centroid) => <g key={centroid.group} data-plot-element="ordination-centroid"><line x1={centroid.x - 5} x2={centroid.x + 5} y1={centroid.y} y2={centroid.y} stroke={colorMap.get(centroid.group)} strokeWidth={2} /><line x1={centroid.x} x2={centroid.x} y1={centroid.y - 5} y2={centroid.y + 5} stroke={colorMap.get(centroid.group)} strokeWidth={2} /></g>) : null}</g><Legend entries={groups.map((group) => ({ label: group, color: colorMap.get(group) ?? colors[0] }))} frame={chartFrame} settings={settings} /><OrdinationShapeLegend shapes={shapes} shapeMap={shapeMap} settings={settings} layout={ordinationLegend} /></>;
  }

  const buckets = groups.map((group) => ({ group, points: rawPoints.filter((point) => point.group === group), color: colorMap.get(group) ?? colors[0] }));
  const ellipses = settings.ordinationShowEllipse ? buckets.map((bucket) => ({ ...bucket, ellipse: covarianceEllipsePoints(bucket.points) })) : [];
  const hulls = settings.ordinationShowHull ? buckets.map((bucket) => ({ ...bucket, hull: convexHull(bucket.points) })) : [];
  const { xDomain, yDomain } = scoreDomains;
  const xAt = (value: number) => scaleLinear(value, xDomain, [chartFrame.left, chartFrame.left + chartFrame.plotWidth]); const yAt = (value: number) => scaleLinear(value, yDomain, [chartFrame.top + chartFrame.plotHeight, chartFrame.top]);
  const centroids = buckets.map((bucket) => ({ group: bucket.group, color: bucket.color, x: bucket.points.reduce((sum, point) => sum + point.x, 0) / bucket.points.length, y: bucket.points.reduce((sum, point) => sum + point.y, 0) / bucket.points.length }));
  const loadingLayout = settings.ordinationShowLoadings && type === "pca" ? ordinationLoadingLayout(dataset, mapping, settings) : null;
  const originX = loadingLayout?.originX ?? xAt(0);
  const originY = loadingLayout?.originY ?? yAt(0);
  const loadingFontSize = loadingLayout?.fontSize ?? Math.max(8, settings.tickSize - 1);
  const loadingSafetyScale = loadingLayout?.safetyScale ?? 1;
  const loadingGeometries = loadingLayout?.geometries ?? [];
  return <>{annotationLines.map((line, index) => <text key={`${index}-${line}`} x={14} y={sharedFrame.annotationTop + (index + 1) * annotationLineHeight - 4} fill={TEXT} fontSize={annotationFontSize}>{line}</text>)}<Axes frame={chartFrame} settings={settings} xDomain={xDomain} yDomain={yDomain} xLabel={axisLabel(1)} yLabel={axisLabel(2)} gridColor={gridColor} /><g data-plot-data data-plot-family="ordination-scores"><defs><marker id={`ordination-arrow-${type}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={TEXT} /></marker></defs>{hulls.map((entry) => entry.hull.length >= 3 ? <polygon key={entry.group} data-plot-element="ordination-hull" points={entry.hull.map((point) => `${xAt(point.x)},${yAt(point.y)}`).join(" ")} fill={entry.color} fillOpacity={0.08} stroke={entry.color} strokeWidth={settings.dataLineWidth} /> : null)}{ellipses.map((entry) => entry.ellipse.length ? <polyline key={entry.group} data-plot-element="ordination-ellipse" points={entry.ellipse.map((point) => `${xAt(point.x)},${yAt(point.y)}`).join(" ")} fill={entry.color} fillOpacity={0.07} stroke={entry.color} strokeWidth={settings.dataLineWidth} /> : null)}{rawPoints.map((point) => { const x = xAt(point.x); const y = yAt(point.y); return <g key={point.index}><OrdinationMark x={x} y={y} radius={settings.pointSize} shapeIndex={shapeMap.get(point.shape) ?? 0} color={colorMap.get(point.group) ?? colors[0]} opacity={settings.opacity} />{settings.showLabels && point.label ? <OrdinationLabel x={x} y={y} radius={settings.pointSize} label={point.label} frame={chartFrame} fontSize={settings.tickSize} /> : null}</g>; })}{settings.ordinationShowCentroids ? centroids.map((centroid) => <g key={centroid.group} data-plot-element="ordination-centroid"><line x1={xAt(centroid.x) - 5} x2={xAt(centroid.x) + 5} y1={yAt(centroid.y)} y2={yAt(centroid.y)} stroke={centroid.color} strokeWidth={2} /><line x1={xAt(centroid.x)} x2={xAt(centroid.x)} y1={yAt(centroid.y) - 5} y2={yAt(centroid.y) + 5} stroke={centroid.color} strokeWidth={2} /><text x={xAt(centroid.x) + 7} y={yAt(centroid.y) - 5} fill={centroid.color} fontSize={Math.max(8, settings.tickSize - 1)}>{centroid.group.slice(0, 10)}</text></g>) : null}{loadingGeometries.map((loading) => { const placeBelow = loading.endY - loadingFontSize < chartFrame.top + 2; return <g key={loading.feature} data-plot-element="ordination-loading" data-loading-scale={loadingSafetyScale.toFixed(4)}><line x1={originX} y1={originY} x2={loading.endX} y2={loading.endY} stroke={TEXT} strokeWidth={Math.max(0.8, settings.dataLineWidth * 0.7)} markerEnd={`url(#ordination-arrow-${type})`} /><text x={loading.endX + (loading.endX >= originX ? 3 : -3)} y={loading.endY + (placeBelow ? loadingFontSize + 2 : -3)} textAnchor={loading.endX >= originX ? "start" : "end"} fill={TEXT} fontSize={loadingFontSize}><title>{loading.feature}</title>{loading.displayFeature}</text></g>; })}</g><Legend entries={groups.map((group) => ({ label: group, color: colorMap.get(group) ?? colors[0] }))} frame={chartFrame} settings={settings} /><OrdinationShapeLegend shapes={shapes} shapeMap={shapeMap} settings={settings} layout={ordinationLegend} /></>;
}

function MaPlot({ frame, dataset, mapping, settings, colors, gridColor }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[]; gridColor: string }) {
  const rows = dataset.rows.map((row, index) => ({ index, label: row[mapping.label], x: Math.log10(Math.max(parseNumericValue(row[mapping.mean]) ?? 1, Number.MIN_VALUE)), effect: parseNumericValue(row[mapping.effect]) ?? 0, p: parseNumericValue(row[mapping.pValue]) ?? 1 }));
  const xDomain = resolveAxisDomain(numericExtent(rows.map((row) => row.x)), settings.xMin, settings.xMax);
  const yDomain = resolveAxisDomain(numericExtent([...rows.map((row) => row.effect), -settings.foldChangeThreshold, settings.foldChangeThreshold]), settings.yMin, settings.yMax);
  const xAt = (value: number) => scaleLinear(value, xDomain, [frame.left, frame.left + frame.plotWidth]);
  const yAt = (value: number) => scaleLinear(value, yDomain, [frame.top + frame.plotHeight, frame.top]);
  const labels = new Set(rows.filter((row) => row.p <= settings.pValueThreshold && Math.abs(row.effect) >= settings.foldChangeThreshold).sort((a, b) => a.p - b.p).slice(0, settings.labelLimit).map((row) => row.index));
  return <>
    <Axes frame={frame} settings={settings} xDomain={xDomain} yDomain={yDomain} xLabel={settings.xLabel || "log₁₀ mean expression"} yLabel={settings.yLabel || "log₂ fold change"} gridColor={gridColor} />
    <g data-plot-data>
    <line x1={frame.left} x2={frame.left + frame.plotWidth} y1={yAt(0)} y2={yAt(0)} stroke={TEXT} strokeDasharray="4 4" />
    {rows.map((row) => { const up = row.p <= settings.pValueThreshold && row.effect >= settings.foldChangeThreshold; const down = row.p <= settings.pValueThreshold && row.effect <= -settings.foldChangeThreshold; const color = up ? colors[1] ?? colors[0] : down ? colors[0] : "#B7B8BC"; const x = xAt(row.x); const y = yAt(row.effect); const rightHalf = row.x > (xDomain[0] + xDomain[1]) / 2; const upperHalf = row.effect > (yDomain[0] + yDomain[1]) / 2; return <g key={row.index}><circle cx={x} cy={y} r={settings.pointSize * 0.75} fill={color} fillOpacity={settings.opacity} />{labels.has(row.index) ? <text data-plot-label x={rightHalf ? x - 4 : x + 4} y={upperHalf ? y + settings.tickSize + 2 + (row.index % 2) * 3 : y - 4 - (row.index % 2) * 3} textAnchor={rightHalf ? "end" : "start"} fill={TEXT} fontSize={settings.tickSize}>{row.label}</text> : null}</g>; })}
    </g>
    <Legend entries={[{ label: "Down", color: colors[0] }, { label: "Up", color: colors[1] ?? colors[0] }, { label: "Not significant", color: "#B7B8BC" }]} frame={frame} settings={settings} />
  </>;
}

function ErrorBarPlot({ frame, dataset, mapping, settings, colors, gridColor }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[]; gridColor: string }) {
  const rows = dataset.rows.map((row) => ({ category: row[mapping.category], value: parseNumericValue(row[mapping.value]) ?? 0, error: Math.max(0, parseNumericValue(row[mapping.error]) ?? 0), group: mapping.group ? row[mapping.group] || "All" : "All" }));
  const yDomain = resolveAxisDomain(numericExtent(rows.flatMap((row) => [row.value - row.error, row.value + row.error]), true), settings.yMin, settings.yMax);
  const band = frame.plotWidth / Math.max(1, rows.length);
  const groups = [...new Set(rows.map((row) => row.group))];
  const colorMap = palette(groups, colors);
  const yAt = (value: number) => scaleLinear(value, yDomain, [frame.top + frame.plotHeight, frame.top]);
  const categoryPositions = rows.map((_, index) => frame.left + band * (index + 0.5));
  return <>
    <Axes frame={frame} settings={settings} xDomain={[0, rows.length]} yDomain={yDomain} xLabel={settings.xLabel} yLabel={settings.yLabel || "Mean ± error"} gridColor={gridColor} hideXTicks categoryXPositions={categoryPositions} />
    <g data-plot-data>
    {rows.map((row, index) => { const x = frame.left + band * (index + 0.5); const low = yAt(row.value - row.error); const high = yAt(row.value + row.error); const color = colorMap.get(row.group) ?? colors[0]; return <g key={`${row.category}-${index}`}><line x1={x} x2={x} y1={low} y2={high} stroke={color} strokeWidth={settings.errorBarLineWidth} /><line x1={x - settings.errorBarCapSize / 2} x2={x + settings.errorBarCapSize / 2} y1={low} y2={low} stroke={color} strokeWidth={settings.errorBarLineWidth} /><line x1={x - settings.errorBarCapSize / 2} x2={x + settings.errorBarCapSize / 2} y1={high} y2={high} stroke={color} strokeWidth={settings.errorBarLineWidth} /><circle cx={x} cy={yAt(row.value)} r={settings.pointSize} fill="#FFFFFF" stroke={color} strokeWidth={settings.dataLineWidth} /><text x={x} y={frame.top + frame.plotHeight + 19} textAnchor="middle" fill={TEXT} fontSize={settings.tickSize} transform={`rotate(-28 ${x} ${frame.top + frame.plotHeight + 19})`}>{row.category.slice(0, 16)}</text></g>; })}
    </g>
    <Legend entries={groups.map((group) => ({ label: group, color: colorMap.get(group) ?? colors[0] }))} frame={frame} settings={settings} />
  </>;
}

function AreaPlot({ frame, dataset, mapping, settings, colors, gridColor }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[]; gridColor: string }) {
  const rows = dataset.rows.map((row) => ({ x: parseNumericValue(row[mapping.x]) ?? 0, y: parseNumericValue(row[mapping.value]) ?? 0, group: mapping.series ? row[mapping.series] || "All" : "All" }));
  const xDomain = resolveAxisDomain(numericExtent(rows.map((row) => row.x)), settings.xMin, settings.xMax);
  const yDomain = resolveAxisDomain(numericExtent([...rows.map((row) => row.y), 0], true), settings.yMin, settings.yMax);
  const groups = [...new Set(rows.map((row) => row.group))];
  const colorMap = palette(groups, colors);
  const xAt = (value: number) => scaleLinear(value, xDomain, [frame.left, frame.left + frame.plotWidth]);
  const yAt = (value: number) => scaleLinear(value, yDomain, [frame.top + frame.plotHeight, frame.top]);
  return <>
    <Axes frame={frame} settings={settings} xDomain={xDomain} yDomain={yDomain} xLabel={settings.xLabel || "X"} yLabel={settings.yLabel || "Value"} gridColor={gridColor} />
    <g data-plot-data>
    {groups.map((group) => { const points = rows.filter((row) => row.group === group).sort((a, b) => a.x - b.x); const line = points.map((point) => `${xAt(point.x)},${yAt(point.y)}`).join(" "); const area = `${xAt(points[0]?.x ?? 0)},${yAt(0)} ${line} ${xAt(points.at(-1)?.x ?? 0)},${yAt(0)}`; const color = colorMap.get(group) ?? colors[0]; return <g key={group}><polygon points={area} fill={color} fillOpacity={settings.opacity * 0.28} /><polyline points={line} fill="none" stroke={color} strokeWidth={settings.dataLineWidth} strokeLinejoin="round" />{points.map((point, index) => <circle key={index} cx={xAt(point.x)} cy={yAt(point.y)} r={settings.pointSize * 0.65} fill={color} />)}</g>; })}
    </g>
    <Legend entries={groups.map((group) => ({ label: group, color: colorMap.get(group) ?? colors[0] }))} frame={frame} settings={settings} />
  </>;
}

function LollipopPlot({ frame, dataset, mapping, settings, colors, gridColor }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[]; gridColor: string }) {
  const rows = dataset.rows.map((row) => ({ category: row[mapping.category], value: parseNumericValue(row[mapping.value]) ?? 0, group: mapping.group ? row[mapping.group] || "All" : "All" }));
  const yDomain = resolveAxisDomain(numericExtent([...rows.map((row) => row.value), 0], true), settings.yMin, settings.yMax);
  const groups = [...new Set(rows.map((row) => row.group))];
  const colorMap = palette(groups, colors);
  const band = frame.plotWidth / Math.max(1, rows.length);
  const yAt = (value: number) => scaleLinear(value, yDomain, [frame.top + frame.plotHeight, frame.top]);
  const categoryPositions = rows.map((_, index) => frame.left + band * (index + 0.5));
  return <>
    <Axes frame={frame} settings={settings} xDomain={[0, rows.length]} yDomain={yDomain} xLabel={settings.xLabel} yLabel={settings.yLabel || "Value"} gridColor={gridColor} hideXTicks categoryXPositions={categoryPositions} />
    <g data-plot-data>
    {rows.map((row, index) => { const x = frame.left + band * (index + 0.5); const color = colorMap.get(row.group) ?? colors[0]; return <g key={`${row.category}-${index}`}><line x1={x} x2={x} y1={yAt(0)} y2={yAt(row.value)} stroke={color} strokeWidth={settings.dataLineWidth} /><circle cx={x} cy={yAt(row.value)} r={settings.pointSize + 1} fill={color} fillOpacity={settings.opacity} /><text x={x} y={frame.top + frame.plotHeight + 19} textAnchor="end" fill={TEXT} fontSize={settings.tickSize} transform={`rotate(-35 ${x} ${frame.top + frame.plotHeight + 19})`}>{row.category.slice(0, 18)}</text></g>; })}
    </g>
    <Legend entries={groups.map((group) => ({ label: group, color: colorMap.get(group) ?? colors[0] }))} frame={frame} settings={settings} />
  </>;
}

type DistributionPlotType = "box" | "violin" | "beeswarm" | "raincloud" | "histogram" | "density" | "ridge";

function DistributionPlot({ type, frame, dataset, mapping, settings, colors, gridColor }: { type: DistributionPlotType; frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[]; gridColor: string }) {
  const facetFor = (row: Record<string, string>) => mapping.facet ? row[mapping.facet] || "All" : "All";
  const facets = [...new Set(dataset.rows.map(facetFor))];
  const lanes = facets.flatMap((facet) => [...new Set(dataset.rows.filter((row) => facetFor(row) === facet).map((row) => row[mapping.group] || "All"))].map((group) => ({
    facet,
    group,
    key: `${facet}\u0000${group}`,
    rows: dataset.rows.filter((row) => facetFor(row) === facet && (row[mapping.group] || "All") === group),
  }))).map((lane) => ({ ...lane, values: lane.rows.flatMap((row) => { const value = parseNumericValue(row[mapping.value]); return value === null ? [] : [value]; }) }));
  const rawValues = lanes.flatMap((lane) => lane.values);
  const rawDomain = numericExtent(rawValues);
  const rawSpan = Math.max(rawDomain[1] - rawDomain[0], 1e-9);
  const densityBoundaryDomain: [number, number] = [rawDomain[0] - rawSpan * 0.16, rawDomain[1] + rawSpan * 0.16];
  const densityCurves = new Map(lanes.map((lane) => [lane.key, kernelDensityEstimate(lane.values, densityBoundaryDomain, settings.violinBandwidth).points]));
  const histograms = new Map(lanes.map((lane) => [lane.key, deterministicHistogram(lane.values, settings.histogramBins, rawDomain)]));
  const maximumDensity = Math.max(...[...densityCurves.values()].flatMap((curve) => curve.map((point) => point.density)), 1e-9);
  const maximumBinCount = Math.max(...[...histograms.values()].flatMap((bins) => bins.map((bin) => bin.count)), 1);
  const uncertaintyExtent = settings.boxErrorType === "none" ? [] : lanes.flatMap((lane) => {
    const summary = meanErrorStatistics(lane.values);
    if (summary.n < 2) return [];
    const margin = settings.boxErrorType === "sd" ? summary.sd : settings.boxErrorType === "sem" ? summary.sem : confidenceInterval95(lane.values).margin;
    return [summary.mean - margin, summary.mean + margin];
  });
  const densityExtent = settings.showDensity ? [...densityCurves.values()].flatMap((curve) => curve.map((point) => point.position)) : [];
  const automaticDomain = numericExtent([...rawValues, ...uncertaintyExtent, ...densityExtent]);
  const horizontal = settings.distributionOrientation === "horizontal";
  const valueDomain = horizontal ? resolveAxisDomain(automaticDomain, settings.xMin, settings.xMax) : resolveAxisDomain(automaticDomain, settings.yMin, settings.yMax);
  const laneRange: [number, number] = horizontal ? [frame.top, frame.top + frame.plotHeight] : [frame.left, frame.left + frame.plotWidth];
  const band = Math.abs(laneRange[1] - laneRange[0]) / Math.max(1, lanes.length);
  const laneAt = (index: number) => laneRange[0] + band * (index + 0.5);
  const valueAt = (value: number) => horizontal ? scaleLinear(value, valueDomain, [frame.left, frame.left + frame.plotWidth]) : scaleLinear(value, valueDomain, [frame.top + frame.plotHeight, frame.top]);
  const colorMap = palette([...new Set(lanes.map((lane) => lane.group))], colors);
  const lanePositions = lanes.map((_, index) => laneAt(index));
  const axes = horizontal
    ? <Axes frame={frame} settings={settings} xDomain={valueDomain} yDomain={[0, lanes.length]} xLabel={settings.xLabel || "Value"} yLabel={settings.yLabel || "Group"} gridColor={gridColor} hideYTicks categoryYPositions={lanePositions} />
    : <Axes frame={frame} settings={settings} xDomain={[0, lanes.length]} yDomain={valueDomain} xLabel={settings.xLabel || "Group"} yLabel={settings.yLabel || "Value"} gridColor={gridColor} hideXTicks categoryXPositions={lanePositions} />;
  const subjectPaths = settings.distributionShowPairedLines && mapping.subject ? [...new Set(dataset.rows.map((row) => row[mapping.subject]).filter(Boolean))].flatMap((subject) => facets.map((facet) => {
    const points = lanes.map((lane, index) => {
      if (lane.facet !== facet) return null;
      const row = lane.rows.find((entry) => entry[mapping.subject] === subject); const value = parseNumericValue(row?.[mapping.value]);
      return value === null ? null : horizontal ? [valueAt(value), laneAt(index)] : [laneAt(index), valueAt(value)];
    }).filter((point): point is number[] => Boolean(point));
    return points.length > 1 ? <polyline key={`${facet}-${subject}`} data-plot-element="paired-line" points={points.map((point) => point.join(",")).join(" ")} fill="none" stroke={TEXT} strokeWidth={Math.max(0.7, settings.dataLineWidth * 0.55)} strokeOpacity={0.28} /> : null;
  })) : [];
  const facetStarts = facets.slice(1).map((facet) => lanes.findIndex((lane) => lane.facet === facet)).filter((index) => index > 0);

  return <>
    {axes}
    <g data-plot-data data-plot-family="distribution">
      {facetStarts.map((index) => horizontal ? <line key={index} x1={frame.left} x2={frame.left + frame.plotWidth} y1={laneRange[0] + index * band} y2={laneRange[0] + index * band} stroke={gridColor} strokeWidth={1.2} /> : <line key={index} x1={laneRange[0] + index * band} x2={laneRange[0] + index * band} y1={frame.top} y2={frame.top + frame.plotHeight} stroke={gridColor} strokeWidth={1.2} />)}
      {mapping.facet ? facets.map((facet) => { const indices = lanes.map((lane, index) => lane.facet === facet ? index : -1).filter((index) => index >= 0); const first = Math.min(...indices); const last = Math.max(...indices); return horizontal ? <text key={facet} data-plot-element="facet-label" x={frame.left + 4} y={laneAt(first) - band * 0.36} fill={TEXT} fontSize={Math.max(8, settings.tickSize - 1)} fontWeight={700}>{facet.slice(0, 16)}</text> : <text key={facet} data-plot-element="facet-label" x={(laneAt(first) + laneAt(last)) / 2} y={frame.top + 10} textAnchor="middle" fill={TEXT} fontSize={Math.max(8, settings.tickSize - 1)} fontWeight={700}>{facet.slice(0, 16)}</text>; }) : null}
      {settings.distributionShowSignificance && mapping.pValue ? facets.map((facet) => { const indices = lanes.map((lane, index) => lane.facet === facet ? index : -1).filter((index) => index >= 0); const first = Math.min(...indices); const last = Math.max(...indices); const value = dataset.rows.filter((row) => facetFor(row) === facet).map((row) => parseNumericValue(row[mapping.pValue])).find((entry): entry is number => entry !== null) ?? null; if (value === null) return null; const label = value <= settings.significanceThreshold ? `p=${formatTick(value)}` : "ns"; return horizontal ? <text key={facet} data-plot-element="significance-label" x={frame.left + frame.plotWidth - 2} y={(laneAt(first) + laneAt(last)) / 2 + 3} textAnchor="end" fill={TEXT} fontSize={Math.max(8, settings.tickSize - 1)}>{label}</text> : <text key={facet} data-plot-element="significance-label" x={(laneAt(first) + laneAt(last)) / 2} y={frame.top + 24} textAnchor="middle" fill={TEXT} fontSize={Math.max(8, settings.tickSize - 1)}>{label}</text>; }) : null}
      {subjectPaths}
      {lanes.map((lane, laneIndex) => {
        const center = laneAt(laneIndex); const color = colorMap.get(lane.group) ?? colors[0]; const stats = boxStatistics(lane.values); const summary = meanErrorStatistics(lane.values);
        const curve = densityCurves.get(lane.key) ?? []; const densityWidth = band * settings.violinWidth;
        const symmetric = type !== "raincloud" && type !== "ridge";
        const densityPoints = horizontal
          ? [...curve.map((point) => `${valueAt(point.position)},${center - point.density / maximumDensity * densityWidth}`), ...(symmetric ? [...curve].reverse().map((point) => `${valueAt(point.position)},${center + point.density / maximumDensity * densityWidth}`) : [...curve].reverse().map((point) => `${valueAt(point.position)},${center}`))]
          : [...curve.map((point) => `${center + point.density / maximumDensity * densityWidth},${valueAt(point.position)}`), ...(symmetric ? [...curve].reverse().map((point) => `${center - point.density / maximumDensity * densityWidth},${valueAt(point.position)}`) : [...curve].reverse().map((point) => `${center},${valueAt(point.position)}`))];
        const bins = histograms.get(lane.key) ?? [];
        const summaryValue = settings.distributionSummary === "mean" ? summary.mean : stats.median;
        const margin = settings.boxErrorType === "sd" ? summary.sd : settings.boxErrorType === "sem" ? summary.sem : settings.boxErrorType === "ci95" ? confidenceInterval95(lane.values).margin : 0;
        const basePointRadius = Math.max(2.1, settings.pointSize * 0.62);
        const lanePointRadius = type === "beeswarm" ? Math.min(basePointRadius, Math.max(Number.EPSILON, band * 0.2)) : basePointRadius;
        const laneBoundaryGap = Math.min(0.4, band * 0.05);
        const maximumBeeswarmOffset = Math.max(0, band / 2 - lanePointRadius - laneBoundaryGap);
        const beeswarmLayout = type === "beeswarm" ? deterministicBeeswarmLayout(lane.values.map(valueAt), lanePointRadius, maximumBeeswarmOffset) : null;
        const pointRadius = beeswarmLayout?.pointRadius ?? basePointRadius;
        const pointOffsets = beeswarmLayout?.offsets ?? lane.values.map((_, index) => (((index * 37) % 17) - 8) / 8 * band * 0.22);
        return <g key={lane.key}>
          {settings.showDensity && densityPoints.length > 2 ? <polygon data-plot-element="density" data-density-scale-maximum={maximumDensity} points={densityPoints.join(" ")} fill={color} fillOpacity={settings.opacity * 0.28} stroke={color} strokeWidth={settings.dataLineWidth} /> : null}
          {settings.showHistogram ? bins.map((bin) => {
            const frequencySize = bin.count / maximumBinCount * band * 0.68;
            if (horizontal) return <rect key={bin.index} data-plot-element="histogram-bin" data-bin-count={bin.count} data-bin-scale-maximum={maximumBinCount} x={valueAt(bin.lower)} y={center - frequencySize / 2} width={Math.max(0.7, valueAt(bin.upper) - valueAt(bin.lower) - 0.6)} height={frequencySize} fill={color} fillOpacity={settings.opacity * 0.48} stroke={color} strokeWidth={0.5} />;
            return <rect key={bin.index} data-plot-element="histogram-bin" data-bin-count={bin.count} data-bin-scale-maximum={maximumBinCount} x={center - frequencySize / 2} y={valueAt(bin.upper)} width={frequencySize} height={Math.max(0.7, valueAt(bin.lower) - valueAt(bin.upper) - 0.6)} fill={color} fillOpacity={settings.opacity * 0.48} stroke={color} strokeWidth={0.5} />;
          }) : null}
          {settings.showBox ? horizontal ? <g data-plot-element="box-layer"><line x1={valueAt(stats.low)} x2={valueAt(stats.high)} y1={center} y2={center} stroke={TEXT} strokeWidth={settings.dataLineWidth} /><rect x={valueAt(stats.q1)} y={center - band * 0.13} width={Math.max(1, valueAt(stats.q3) - valueAt(stats.q1))} height={band * 0.26} fill={color} fillOpacity={0.24} stroke={color} strokeWidth={settings.dataLineWidth} /><line x1={valueAt(stats.median)} x2={valueAt(stats.median)} y1={center - band * 0.13} y2={center + band * 0.13} stroke={TEXT} strokeWidth={settings.dataLineWidth} /></g> : <g data-plot-element="box-layer"><line x1={center} x2={center} y1={valueAt(stats.low)} y2={valueAt(stats.high)} stroke={TEXT} strokeWidth={settings.dataLineWidth} /><rect x={center - band * 0.13} y={valueAt(stats.q3)} width={band * 0.26} height={Math.max(1, valueAt(stats.q1) - valueAt(stats.q3))} fill={color} fillOpacity={0.24} stroke={color} strokeWidth={settings.dataLineWidth} /><line x1={center - band * 0.13} x2={center + band * 0.13} y1={valueAt(stats.median)} y2={valueAt(stats.median)} stroke={TEXT} strokeWidth={settings.dataLineWidth} /></g> : null}
          {settings.distributionSummary !== "none" ? horizontal ? <line data-plot-element="center-summary" x1={valueAt(summaryValue)} x2={valueAt(summaryValue)} y1={center - band * 0.2} y2={center + band * 0.2} stroke={TEXT} strokeWidth={2} /> : <line data-plot-element="center-summary" x1={center - band * 0.2} x2={center + band * 0.2} y1={valueAt(summaryValue)} y2={valueAt(summaryValue)} stroke={TEXT} strokeWidth={2} /> : null}
          {settings.boxErrorType !== "none" && summary.n >= 2 ? horizontal ? <g data-plot-element="uncertainty" stroke={TEXT} strokeWidth={settings.errorBarLineWidth}><line x1={valueAt(summary.mean - margin)} x2={valueAt(summary.mean + margin)} y1={center} y2={center} /><line x1={valueAt(summary.mean - margin)} x2={valueAt(summary.mean - margin)} y1={center - settings.errorBarCapSize / 2} y2={center + settings.errorBarCapSize / 2} /><line x1={valueAt(summary.mean + margin)} x2={valueAt(summary.mean + margin)} y1={center - settings.errorBarCapSize / 2} y2={center + settings.errorBarCapSize / 2} /></g> : <g data-plot-element="uncertainty" stroke={TEXT} strokeWidth={settings.errorBarLineWidth}><line x1={center} x2={center} y1={valueAt(summary.mean - margin)} y2={valueAt(summary.mean + margin)} /><line x1={center - settings.errorBarCapSize / 2} x2={center + settings.errorBarCapSize / 2} y1={valueAt(summary.mean - margin)} y2={valueAt(summary.mean - margin)} /><line x1={center - settings.errorBarCapSize / 2} x2={center + settings.errorBarCapSize / 2} y1={valueAt(summary.mean + margin)} y2={valueAt(summary.mean + margin)} /></g> : null}
          {settings.showPoints ? lane.values.map((value, index) => <circle key={index} data-plot-element="observation" data-beeswarm-offset={type === "beeswarm" ? pointOffsets[index] : undefined} data-beeswarm-scaled={beeswarmLayout?.scaled ? "true" : undefined} cx={horizontal ? valueAt(value) : center + pointOffsets[index]} cy={horizontal ? center + pointOffsets[index] : valueAt(value)} r={pointRadius} fill={color} fillOpacity={settings.opacity} stroke="#FFFFFF" strokeWidth={Math.min(0.55, pointRadius * 0.25)} />) : null}
          {horizontal ? <><text x={frame.left - 8} y={center + 3} textAnchor="end" fill={TEXT} fontSize={settings.tickSize}>{lane.group.slice(0, 14)}</text>{settings.showSampleSize ? <text x={frame.left + frame.plotWidth - 2} y={center - 5} textAnchor="end" fill={TEXT} fontSize={Math.max(8, settings.tickSize - 1)}>n={lane.values.length}</text> : null}</> : <><text x={center} y={frame.top + frame.plotHeight + 18} textAnchor="middle" fill={TEXT} fontSize={settings.tickSize}>{lane.group.slice(0, 12)}</text>{settings.showSampleSize ? <text x={center} y={frame.top + frame.plotHeight + 33} textAnchor="middle" fill={TEXT} fontSize={Math.max(8, settings.tickSize - 1)}>n={lane.values.length}</text> : null}</>}
        </g>;
      })}
    </g>
  </>;
}

function zScore(values: number[]) {
  const average = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const deviation = Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / Math.max(1, values.length - 1)) || 1;
  return values.map((value) => (value - average) / deviation);
}

function selectedLabelIndices(count: number, availablePixels: number, fontSize: number, density: VisualizationSettings["heatmapLabelDensity"], minimum = 2) {
  if (density === "none") return new Set<number>();
  if (density === "all") return new Set(Array.from({ length: count }, (_, index) => index));
  const maximum = Math.max(minimum, Math.floor(availablePixels / Math.max(11, fontSize + 3)));
  if (count <= maximum) return new Set(Array.from({ length: count }, (_, index) => index));
  const step = Math.ceil(count / maximum);
  return new Set(Array.from({ length: count }, (_, index) => index).filter((index) => index % step === 0 || index === count - 1));
}

function annotationTrackColor(track: HeatmapAnnotationTrack, value: string, colors: string[], sequential: [string, string]) {
  if (!value) return "#F1F0ED";
  if (track.kind === "continuous" && track.numericExtent) {
    const numeric = parseNumericValue(value) ?? track.numericExtent[0];
    return interpolateColor(sequential[0], sequential[1], scaleLinear(numeric, track.numericExtent, [0, 1]));
  }
  const categoryIndex = Math.max(0, track.categories.indexOf(value));
  return categoricalColorForIndex(categoryIndex, colors);
}

function annularSectorPath(cx: number, cy: number, innerRadius: number, outerRadius: number, startAngle: number, endAngle: number) {
  const point = (radius: number, angle: number) => [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius] as const;
  const outerStart = point(outerRadius, startAngle); const outerEnd = point(outerRadius, endAngle);
  const innerEnd = point(innerRadius, endAngle); const innerStart = point(innerRadius, startAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${outerStart[0]} ${outerStart[1]} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd[0]} ${outerEnd[1]} L ${innerEnd[0]} ${innerEnd[1]} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart[0]} ${innerStart[1]} Z`;
}

function HeatmapColorLegend({ id, x, y, width, minimum, maximum, diverging, sequential, useDiverging, label, fontSize }: { id: string; x: number; y: number; width: number; minimum: number; maximum: number; diverging: [string, string, string]; sequential: [string, string]; useDiverging: boolean; label: string; fontSize: number }) {
  const small = Math.max(8, fontSize - 1);
  return <g data-plot-element="heatmap-color-legend">
    <defs><linearGradient id={id} x1="0%" x2="100%">{useDiverging ? <><stop offset="0%" stopColor={diverging[0]} /><stop offset="50%" stopColor={diverging[1]} /><stop offset="100%" stopColor={diverging[2]} /></> : <><stop offset="0%" stopColor={sequential[0]} /><stop offset="100%" stopColor={sequential[1]} /></>}</linearGradient></defs>
    <text x={x} y={y + 7} fill={TEXT} fontSize={fontSize} fontWeight={700}>{label}</text>
    <rect data-no-clip="true" x={x + 34} y={y} width={width} height={5} rx={1} fill={`url(#${id})`} stroke="#D7D4CE" strokeWidth={0.4} />
    <text x={x + 34} y={y + 15} fill={TEXT} fontSize={small} textAnchor="start">{formatTick(minimum)}</text>
    {useDiverging ? <text x={x + 34 + width / 2} y={y + 15} fill={TEXT} fontSize={small} textAnchor="middle">0</text> : null}
    <text x={x + 34 + width} y={y + 15} fill={TEXT} fontSize={small} textAnchor="end">{formatTick(maximum)}</text>
  </g>;
}

function HeatmapAnnotationLegend({ id, x, y, rowTracks, columnTracks, colors, sequential, fontSize }: { id: string; x: number; y: number; rowTracks: HeatmapAnnotationTrack[]; columnTracks: HeatmapAnnotationTrack[]; colors: string[]; sequential: [string, string]; fontSize: number }) {
  let cursor = y;
  const small = Math.max(8, fontSize - 1);
  const rowHeight = fontSize + 3;
  const groups = [{ target: "Rows", tracks: rowTracks }, { target: "Columns", tracks: columnTracks }];
  const content: ReactNode[] = [];
  groups.forEach(({ target, tracks }) => {
    if (tracks.length === 0) return;
    content.push(<text key={`${target}-heading`} x={x} y={cursor + fontSize} fill={TEXT} fontSize={fontSize} fontWeight={700}>{target}</text>);
    cursor += rowHeight;
    tracks.forEach((track, trackIndex) => {
      content.push(<text key={`${target}-${track.name}`} x={x} y={cursor + fontSize} fill={TEXT} fontSize={fontSize} fontWeight={600}>{track.name.slice(0, 14)}</text>);
      cursor += rowHeight;
      if (track.kind === "continuous" && track.numericExtent) {
        const gradientId = `${id}-${target}-${trackIndex}`.replace(/[^a-zA-Z0-9_-]/g, "-");
        content.push(<g key={`${target}-${track.name}-scale`}><defs><linearGradient id={gradientId} x1="0%" x2="100%"><stop offset="0%" stopColor={sequential[0]} /><stop offset="100%" stopColor={sequential[1]} /></linearGradient></defs><rect data-no-clip="true" x={x} y={cursor} width={52} height={5} rx={1} fill={`url(#${gradientId})`} /><text x={x} y={cursor + rowHeight} fill={TEXT} fontSize={small}>{formatTick(track.numericExtent[0])}</text><text x={x + 52} y={cursor + rowHeight} textAnchor="end" fill={TEXT} fontSize={small}>{formatTick(track.numericExtent[1])}</text></g>);
        cursor += rowHeight + 5;
      } else {
        track.categories.forEach((category, categoryIndex) => {
          content.push(<g key={`${target}-${track.name}-${category}`}><rect data-no-clip="true" x={x} y={cursor + 1} width={7} height={7} rx={1} fill={categoricalColorForIndex(categoryIndex, colors)} /><text x={x + 11} y={cursor + fontSize} fill={TEXT} fontSize={small}>{category.slice(0, 14)}</text></g>);
          cursor += rowHeight;
        });
      }
      cursor += 3;
    });
  });
  return <g data-plot-element="heatmap-annotation-legend" aria-label="Heatmap annotation legend">{content}</g>;
}

function HeatmapCutLegend({ x, y, rowClusters, columnClusters, colors, fontSize }: { x: number; y: number; rowClusters: number; columnClusters: number; colors: string[]; fontSize: number }) {
  const rows = [{ label: "R", count: rowClusters }, { label: "C", count: columnClusters }].filter(({ count }) => count > 1);
  if (rows.length === 0) return null;
  const readable = Math.max(8, fontSize);
  const rowHeight = readable + 2;
  const itemStep = Math.max(13, readable * 1.15);
  return <g data-plot-element="heatmap-cut-legend" aria-label="Cluster cut legend">{rows.map(({ label, count }, rowIndex) => <g key={label} transform={`translate(${x} ${y + rowIndex * rowHeight})`}><text x={0} y={readable} fill={TEXT} fontSize={readable} fontWeight={700}>{label}</text>{Array.from({ length: count }, (_, clusterIndex) => <g key={clusterIndex}><rect data-no-clip="true" x={12 + clusterIndex * itemStep} y={1} width={8} height={8} rx={1} fill={categoricalColorForIndex(clusterIndex, colors)} /><text x={21 + clusterIndex * itemStep} y={readable} fill={TEXT} fontSize={readable}>{clusterIndex + 1}</text></g>)}</g>)}</g>;
}

function MatrixPlot({ type, dataset, settings, diverging, sequential, colors }: { type: "heatmap" | "clustered-heatmap" | "correlation-heatmap"; frame: Frame; dataset: ParsedDataset; settings: VisualizationSettings; diverging: [string, string, string]; sequential: [string, string]; colors: string[] }) {
  const labelColumn = dataset.headers[0];
  const sourceColumns = dataset.headers.slice(1);
  const source = matrixFromRows(dataset.rows, sourceColumns);
  let sourceRowLabels = dataset.rows.map((row) => row[labelColumn]);
  const sourceColumnLabels = [...sourceColumns];
  let sourceMatrix: number[][];
  if (type === "correlation-heatmap") {
    sourceMatrix = correlationMatrix(source, settings.correlationMethod);
    sourceRowLabels = [...sourceColumns];
  } else if (settings.heatmapScale === "row") {
    sourceMatrix = source.map(zScore);
  } else if (settings.heatmapScale === "column") {
    const columns = sourceColumns.map((_, columnIndex) => zScore(source.map((row) => row[columnIndex])));
    sourceMatrix = source.map((_, rowIndex) => columns.map((column) => column[rowIndex]));
  } else sourceMatrix = source;

  const allowsClustering = type !== "heatmap";
  const linkedCorrelationClustering = type === "correlation-heatmap" ? settings.clusterRows && settings.clusterColumns : null;
  const effectiveClusterRows = type === "correlation-heatmap" ? Boolean(linkedCorrelationClustering) : settings.clusterRows;
  const effectiveClusterColumns = type === "correlation-heatmap" ? Boolean(linkedCorrelationClustering) : settings.clusterColumns;
  const rowTree = allowsClustering && effectiveClusterRows ? hierarchicalClusterTree(sourceMatrix, settings.heatmapDistance, settings.heatmapLinkage) : null;
  const sourceColumnVectors = sourceColumnLabels.map((_, columnIndex) => sourceMatrix.map((row) => row[columnIndex]));
  const columnTree = allowsClustering && effectiveClusterColumns ? hierarchicalClusterTree(sourceColumnVectors, settings.heatmapDistance, settings.heatmapLinkage) : null;
  let rowOrder = rowTree?.order ?? sourceMatrix.map((_, index) => index);
  let columnOrder = columnTree?.order ?? sourceColumnLabels.map((_, index) => index);
  let displayedRowTree = rowTree;
  let displayedColumnTree = columnTree;
  if (type === "correlation-heatmap" && (rowTree || columnTree)) {
    const sharedTree = rowTree ?? columnTree;
    rowOrder = sharedTree?.order ?? rowOrder;
    columnOrder = rowOrder;
    displayedRowTree = effectiveClusterRows ? sharedTree : null;
    displayedColumnTree = effectiveClusterColumns ? sharedTree : null;
  }
  const rowLabels = rowOrder.map((index) => sourceRowLabels[index]);
  const columnLabels = columnOrder.map((index) => sourceColumnLabels[index]);
  const matrix = rowOrder.map((rowIndex) => columnOrder.map((columnIndex) => sourceMatrix[rowIndex][columnIndex]));
  const sidePlotMatrix = type === "correlation-heatmap" ? matrix : rowOrder.map((rowIndex) => columnOrder.map((columnIndex) => source[rowIndex][columnIndex]));
  const rowAnnotations = alignHeatmapAnnotations(settings.heatmapRowAnnotationData, sourceRowLabels, "row").tracks;
  const columnAnnotations = alignHeatmapAnnotations(settings.heatmapColumnAnnotationData, sourceColumnLabels, "column").tracks;
  const rowCutCount = settings.heatmapRowClusters;
  const columnCutCount = type === "correlation-heatmap" ? rowCutCount : settings.heatmapColumnClusters;
  const rowClusterAssignments = cutHierarchicalCluster(displayedRowTree, rowCutCount);
  const columnClusterAssignments = cutHierarchicalCluster(displayedColumnTree, columnCutCount);
  const showRowCut = Boolean(displayedRowTree && rowCutCount > 1);
  const showColumnCut = Boolean(displayedColumnTree && columnCutCount > 1);
  const flatValues = matrix.flat();
  const rawMinimum = Math.min(...flatValues); const rawMaximum = Math.max(...flatValues);
  const absoluteMaximum = type === "correlation-heatmap" ? 1 : Math.max(Math.abs(rawMinimum), Math.abs(rawMaximum), Number.EPSILON);
  const useDiverging = type === "correlation-heatmap" || settings.heatmapScale !== "none" || settings.heatmapColorMode === "diverging";
  const colorMinimum = useDiverging ? -absoluteMaximum : rawMinimum;
  const colorMaximum = useDiverging ? absoluteMaximum : rawMaximum;
  const colorScaleLabel = type === "correlation-heatmap" ? (settings.correlationMethod === "spearman" ? "ρ" : "r") : settings.heatmapScale === "none" ? "Value" : "z";
  const fillFor = (value: number) => useDiverging
    ? divergingColor(diverging[0], diverging[1], diverging[2], scaleLinear(value, [-absoluteMaximum, absoluteMaximum], [0, 1]))
    : interpolateColor(sequential[0], sequential[1], scaleLinear(value, [rawMinimum, rawMaximum === rawMinimum ? rawMinimum + 1 : rawMaximum], [0, 1]));
  const visibleCell = (rowIndex: number, columnIndex: number) => settings.heatmapDisplay === "circular" || type !== "correlation-heatmap" || settings.heatmapTriangle === "full" || (settings.heatmapTriangle === "lower" ? rowIndex >= columnIndex : rowIndex <= columnIndex);
  const showDendrograms = allowsClustering && settings.heatmapShowDendrograms && settings.heatmapDisplay === "rectangular";
  const layout = heatmapLayoutMetrics(settings, {
    hasAnnotationLegend: rowAnnotations.length > 0 || columnAnnotations.length > 0,
    rowAnnotationTracks: rowAnnotations.length,
    columnAnnotationTracks: columnAnnotations.length,
    showRowCut,
    showColumnCut,
    showRowDendrogram: Boolean(showDendrograms && displayedRowTree),
    showColumnDendrogram: Boolean(showDendrograms && displayedColumnTree),
    showSidePlot: settings.heatmapDisplay === "rectangular" && settings.heatmapShowSidePlot,
    rowCount: rowLabels.length,
    columnCount: columnLabels.length,
    maxColumnLabelCharacters: Math.max(0, ...columnLabels.map((label) => label.length)),
    maxCutClusters: Math.max(showRowCut ? Math.min(rowCutCount, rowLabels.length) : 0, showColumnCut ? Math.min(columnCutCount, columnLabels.length) : 0),
  });
  const frame = layout.frame;
  const legendFontSize = Math.max(8, settings.legendSize);

  if (settings.heatmapDisplay === "circular") {
    const cx = frame.left + frame.plotWidth / 2; const cy = frame.top + frame.plotHeight / 2;
    const outerRadius = Math.max(1, layout.circularOuterRadius);
    const innerRadius = Math.max(0.5, Math.min(outerRadius - 0.5, layout.circularInnerRadius));
    const ringWidth = Math.max(0.1, layout.circularRingWidth);
    const sector = Math.PI * 2 / Math.max(1, columnLabels.length);
    const columnLabelIndices = selectedLabelIndices(columnLabels.length, outerRadius * Math.PI * 2, settings.tickSize * 4, settings.heatmapLabelDensity);
    const rowLabelIndices = selectedLabelIndices(rowLabels.length, layout.circularRingListAvailableHeight, legendFontSize, settings.heatmapLabelDensity, 1);
    return <g data-plot-data data-plot-family="circular-heatmap">
      {matrix.map((row, rowIndex) => row.map((value, columnIndex) => {
        if (!visibleCell(rowIndex, columnIndex)) return null;
        const start = -Math.PI / 2 + columnIndex * sector; const end = start + sector;
        return <path key={`${rowIndex}-${columnIndex}`} data-plot-element="heatmap-cell" d={annularSectorPath(cx, cy, innerRadius + rowIndex * ringWidth, innerRadius + (rowIndex + 1) * ringWidth + 0.15, start, end)} fill={fillFor(value)} stroke="#FFFFFF" strokeWidth={0.18}><title>{`${rowLabels[rowIndex]} × ${columnLabels[columnIndex]}: ${formatTick(value)}`}</title></path>;
      }))}
      {columnAnnotations.map((track, trackIndex) => columnLabels.map((label, columnIndex) => { const start = -Math.PI / 2 + columnIndex * sector; return <path key={`${track.name}-${label}`} data-annotation-target="column" data-annotation-track={track.name} d={annularSectorPath(cx, cy, outerRadius + trackIndex * 5 + 1, outerRadius + (trackIndex + 1) * 5, start, start + sector)} fill={annotationTrackColor(track, track.values.get(label) ?? "", colors, sequential)} stroke="#FFFFFF" strokeWidth={0.2}><title>{`${track.name} · ${label}: ${track.values.get(label) || "missing"}`}</title></path>; }))}
      {rowAnnotations.map((track, trackIndex) => rowLabels.map((label, rowIndex) => <path key={`${track.name}-${label}`} data-annotation-target="row" data-annotation-track={track.name} d={annularSectorPath(cx, cy, innerRadius + rowIndex * ringWidth, innerRadius + (rowIndex + 1) * ringWidth, -Math.PI / 2 - 0.055 * (trackIndex + 1), -Math.PI / 2 - 0.055 * trackIndex)} fill={annotationTrackColor(track, track.values.get(label) ?? "", colors, sequential)}><title>{`${track.name} · ${label}: ${track.values.get(label) || "missing"}`}</title></path>))}
      {showColumnCut ? columnLabels.map((label, columnIndex) => { const sourceIndex = sourceColumnLabels.indexOf(label); const start = -Math.PI / 2 + columnIndex * sector; return <path key={`column-cut-${label}`} data-cluster-cut="column" d={annularSectorPath(cx, cy, outerRadius - 3, outerRadius, start, start + sector)} fill={categoricalColorForIndex(columnClusterAssignments[sourceIndex], colors)} />; }) : null}
      {showRowCut ? rowLabels.map((label, rowIndex) => { const sourceIndex = sourceRowLabels.indexOf(label); return <path key={`row-cut-${label}`} data-cluster-cut="row" d={annularSectorPath(cx, cy, innerRadius + rowIndex * ringWidth, innerRadius + (rowIndex + 1) * ringWidth, -Math.PI / 2, -Math.PI / 2 + 0.05)} fill={categoricalColorForIndex(rowClusterAssignments[sourceIndex], colors)} />; }) : null}
      {columnLabels.map((label, index) => { if (!columnLabelIndices.has(index)) return null; const angle = -Math.PI / 2 + (index + 0.5) * sector; const radius = outerRadius + columnAnnotations.length * 5 + 10; const x = cx + Math.cos(angle) * radius; const y = cy + Math.sin(angle) * radius; const flip = Math.cos(angle) < 0; const degrees = angle * 180 / Math.PI + (flip ? 180 : 0); return <text key={label} x={x} y={y} transform={`rotate(${degrees} ${x} ${y})`} textAnchor={flip ? "end" : "start"} dominantBaseline="middle" fill={TEXT} fontSize={settings.tickSize}>{label.slice(0, 12)}</text>; })}
      {settings.heatmapLabelDensity !== "none" ? <><text x={4} y={frame.top + legendFontSize} fill={TEXT} fontSize={legendFontSize} fontWeight={700}>Rings · inner → outer</text>{rowLabels.map((label, index) => rowLabelIndices.has(index) ? <text key={`ring-${label}`} x={4} y={frame.top + legendFontSize * 2 + 4 + [...rowLabelIndices].indexOf(index) * (legendFontSize + 3)} fill={TEXT} fontSize={legendFontSize}>{`${index + 1} · ${label.slice(0, 11)}`}</text> : null)}</> : null}
      <HeatmapColorLegend id={`heatmap-scale-${type}`} x={cx - 42} y={frame.top + frame.plotHeight - 17} width={48} minimum={colorMinimum} maximum={colorMaximum} diverging={diverging} sequential={sequential} useDiverging={useDiverging} label={colorScaleLabel} fontSize={legendFontSize} />
      <HeatmapCutLegend x={frame.left} y={frame.top} rowClusters={showRowCut ? Math.min(rowCutCount, rowLabels.length) : 0} columnClusters={showColumnCut ? Math.min(columnCutCount, columnLabels.length) : 0} colors={colors} fontSize={legendFontSize} />
      {(rowAnnotations.length > 0 || columnAnnotations.length > 0) ? <HeatmapAnnotationLegend id={`heatmap-annotations-${type}`} x={frame.left + frame.plotWidth + 10} y={frame.top} rowTracks={rowAnnotations} columnTracks={columnAnnotations} colors={colors} sequential={sequential} fontSize={legendFontSize} /> : null}
      <circle cx={cx} cy={cy} r={outerRadius} fill="none" stroke={TEXT} strokeWidth={0.7} />
    </g>;
  }

  const { rowTrackWidth, columnTrackHeight, rowDendrogramWidth, columnDendrogramHeight, sidePlotWidth, colorLegendHeight } = layout;
  const matrixLeft = frame.left + rowDendrogramWidth + rowTrackWidth;
  const matrixTop = frame.top + colorLegendHeight + columnDendrogramHeight + columnTrackHeight;
  const matrixWidth = Math.max(1, layout.matrixWidth);
  const matrixHeight = Math.max(1, layout.matrixHeight);
  const cellWidth = matrixWidth / Math.max(1, columnLabels.length);
  const cellHeight = matrixHeight / Math.max(1, rowLabels.length);
  const rowLabelIndices = selectedLabelIndices(rowLabels.length, matrixHeight, settings.tickSize, settings.heatmapLabelDensity);
  const columnLabelIndices = selectedLabelIndices(columnLabels.length, matrixWidth, settings.tickSize * 4, settings.heatmapLabelDensity);
  const showValues = settings.heatmapShowValues && cellWidth >= 18 && cellHeight >= 12 && matrix.length * columnLabels.length <= 225;

  const dendrogramSegments = (tree: HierarchicalClusterNode | null, orientation: "row" | "column") => {
    if (!tree) return [] as ReactNode[];
    const maxHeight = Math.max(tree.height, Number.EPSILON);
    const originalOrder = orientation === "row" ? rowOrder : columnOrder;
    const leafPosition = new Map(originalOrder.map((originalIndex, index) => [originalIndex, orientation === "row" ? matrixTop + (index + 0.5) * cellHeight : matrixLeft + (index + 0.5) * cellWidth]));
    const segments: ReactNode[] = [];
    const visit = (node: HierarchicalClusterNode): [number, number] => {
      if (!node.left || !node.right) {
        const position = leafPosition.get(node.members[0]) ?? 0;
        return orientation === "row" ? [matrixLeft - rowTrackWidth, position] : [position, matrixTop - columnTrackHeight];
      }
      const left = visit(node.left); const right = visit(node.right);
      if (orientation === "row") {
        const x = matrixLeft - rowTrackWidth - node.height / maxHeight * rowDendrogramWidth;
        segments.push(<path key={node.id} data-plot-element="dendrogram" data-dendrogram-axis="row" d={`M ${left[0]} ${left[1]} H ${x} V ${right[1]} H ${right[0]}`} fill="none" stroke={TEXT} strokeWidth={0.7} />);
        return [x, (left[1] + right[1]) / 2];
      }
      const y = matrixTop - columnTrackHeight - node.height / maxHeight * columnDendrogramHeight;
      segments.push(<path key={node.id} data-plot-element="dendrogram" data-dendrogram-axis="column" d={`M ${left[0]} ${left[1]} V ${y} H ${right[0]} V ${right[1]}`} fill="none" stroke={TEXT} strokeWidth={0.7} />);
      return [(left[0] + right[0]) / 2, y];
    };
    visit(tree);
    return segments;
  };

  const rowSummaries = sidePlotMatrix.map((row) => {
    const average = row.reduce((sum, value) => sum + value, 0) / Math.max(1, row.length);
    if (settings.heatmapSidePlotStatistic === "sd") return Math.sqrt(row.reduce((sum, value) => sum + (value - average) ** 2, 0) / Math.max(1, row.length - 1));
    if (settings.heatmapSidePlotStatistic === "range") return Math.max(...row) - Math.min(...row);
    return average;
  });
  const summaryExtent = [Math.min(0, ...rowSummaries), Math.max(0, ...rowSummaries)] as [number, number];
  const safeSummaryExtent: [number, number] = summaryExtent[0] === summaryExtent[1] ? [summaryExtent[0], summaryExtent[0] + 1] : summaryExtent;
  const sideZero = scaleLinear(0, safeSummaryExtent, [matrixLeft + matrixWidth + 4, matrixLeft + matrixWidth + sidePlotWidth - 4]);
  return <g data-plot-data data-plot-family="rectangular-heatmap">
    <HeatmapColorLegend id={`heatmap-scale-${type}`} x={matrixLeft} y={frame.top} width={Math.max(28, Math.min(64, matrixWidth - 36))} minimum={colorMinimum} maximum={colorMaximum} diverging={diverging} sequential={sequential} useDiverging={useDiverging} label={colorScaleLabel} fontSize={legendFontSize} />
    <HeatmapCutLegend x={matrixLeft} y={frame.top + 17} rowClusters={showRowCut ? Math.min(rowCutCount, rowLabels.length) : 0} columnClusters={showColumnCut ? Math.min(columnCutCount, columnLabels.length) : 0} colors={colors} fontSize={legendFontSize} />
    {(rowAnnotations.length > 0 || columnAnnotations.length > 0) ? <HeatmapAnnotationLegend id={`heatmap-annotations-${type}`} x={frame.left + frame.plotWidth + 10} y={frame.top} rowTracks={rowAnnotations} columnTracks={columnAnnotations} colors={colors} sequential={sequential} fontSize={legendFontSize} /> : null}
    {dendrogramSegments(displayedRowTree, "row")}
    {dendrogramSegments(displayedColumnTree, "column")}
    {matrix.map((row, rowIndex) => row.map((value, columnIndex) => visibleCell(rowIndex, columnIndex) ? <g key={`${rowIndex}-${columnIndex}`}><rect data-plot-element="heatmap-cell" x={matrixLeft + columnIndex * cellWidth} y={matrixTop + rowIndex * cellHeight} width={cellWidth + 0.2} height={cellHeight + 0.2} fill={fillFor(value)}><title>{`${rowLabels[rowIndex]} × ${columnLabels[columnIndex]}: ${formatTick(value)}`}</title></rect>{showValues ? <text x={matrixLeft + (columnIndex + 0.5) * cellWidth} y={matrixTop + (rowIndex + 0.5) * cellHeight + settings.tickSize * 0.32} textAnchor="middle" fill={TEXT} fontSize={Math.min(settings.tickSize, cellHeight * 0.62)}>{formatTick(value)}</text> : null}</g> : null))}
    {rowAnnotations.map((track, trackIndex) => rowLabels.map((label, rowIndex) => <rect key={`${track.name}-${label}`} data-annotation-target="row" data-annotation-track={track.name} x={matrixLeft - 6 * (trackIndex + 1)} y={matrixTop + rowIndex * cellHeight} width={5.5} height={cellHeight + 0.15} fill={annotationTrackColor(track, track.values.get(label) ?? "", colors, sequential)}><title>{`${track.name} · ${label}: ${track.values.get(label) || "missing"}`}</title></rect>))}
    {columnAnnotations.map((track, trackIndex) => columnLabels.map((label, columnIndex) => <rect key={`${track.name}-${label}`} data-annotation-target="column" data-annotation-track={track.name} x={matrixLeft + columnIndex * cellWidth} y={matrixTop - 6 * (trackIndex + 1)} width={cellWidth + 0.15} height={5.5} fill={annotationTrackColor(track, track.values.get(label) ?? "", colors, sequential)}><title>{`${track.name} · ${label}: ${track.values.get(label) || "missing"}`}</title></rect>))}
    {showRowCut ? rowLabels.map((label, rowIndex) => { const originalIndex = sourceRowLabels.indexOf(label); return <rect key={`row-cut-${label}`} data-cluster-cut="row" x={matrixLeft - rowTrackWidth} y={matrixTop + rowIndex * cellHeight} width={5.5} height={cellHeight + 0.15} fill={categoricalColorForIndex(rowClusterAssignments[originalIndex], colors)} />; }) : null}
    {showColumnCut ? columnLabels.map((label, columnIndex) => { const originalIndex = sourceColumnLabels.indexOf(label); return <rect key={`column-cut-${label}`} data-cluster-cut="column" x={matrixLeft + columnIndex * cellWidth} y={matrixTop - columnTrackHeight} width={cellWidth + 0.15} height={5.5} fill={categoricalColorForIndex(columnClusterAssignments[originalIndex], colors)} />; }) : null}
    {rowLabels.map((label, index) => rowLabelIndices.has(index) ? <text key={label} x={frame.left - 6} y={matrixTop + (index + 0.68) * cellHeight} textAnchor="end" fill={TEXT} fontSize={settings.tickSize}>{label.slice(0, 12)}</text> : null)}
    {columnLabels.map((label, index) => columnLabelIndices.has(index) ? <text key={label} x={matrixLeft + (index + 0.5) * cellWidth} y={matrixTop + matrixHeight + 8} textAnchor="end" fill={TEXT} fontSize={settings.tickSize} transform={`rotate(-45 ${matrixLeft + (index + 0.5) * cellWidth} ${matrixTop + matrixHeight + 8})`}>{label.slice(0, 12)}</text> : null)}
    {settings.heatmapShowSidePlot ? <g data-plot-element="heatmap-side-plot"><line x1={sideZero} x2={sideZero} y1={matrixTop} y2={matrixTop + matrixHeight} stroke={TEXT} strokeWidth={0.7} />{rowSummaries.map((value, rowIndex) => { const x = scaleLinear(value, safeSummaryExtent, [matrixLeft + matrixWidth + 4, matrixLeft + matrixWidth + sidePlotWidth - 4]); return <rect key={rowLabels[rowIndex]} x={Math.min(x, sideZero)} y={matrixTop + rowIndex * cellHeight + cellHeight * 0.2} width={Math.max(0.7, Math.abs(x - sideZero))} height={Math.max(0.7, cellHeight * 0.6)} fill={colors[0]} fillOpacity={0.78}><title>{`${settings.heatmapSidePlotStatistic}: ${formatTick(value)}`}</title></rect>; })}<text x={matrixLeft + matrixWidth + sidePlotWidth / 2} y={matrixTop - 5} textAnchor="middle" fill={TEXT} fontSize={Math.max(8, settings.tickSize - 2)}>{settings.heatmapSidePlotStatistic.toUpperCase()}</text></g> : null}
    <rect x={matrixLeft} y={matrixTop} width={matrixWidth} height={matrixHeight} fill="none" stroke={TEXT} strokeWidth={0.8} />
  </g>;
}

function EnrichmentBar({ frame, dataset, mapping, settings, sequential, gridColor }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; sequential: [string, string]; gridColor: string }) {
  const rows = dataset.rows.map((row) => ({ term: row[mapping.term], ratio: parseRatioValue(row[mapping.ratio]) ?? 0, p: Math.max(parseNumericValue(row[mapping.pValue]) ?? 1, Number.MIN_VALUE) })).sort((a, b) => a.ratio - b.ratio);
  const domain = resolveAxisDomain(numericExtent(rows.map((row) => row.ratio), true), settings.xMin, settings.xMax);
  const significance = rows.map((row) => -Math.log10(row.p));
  const sigDomain = numericExtent(significance, true);
  const band = frame.plotHeight / Math.max(1, rows.length);
  const categoryPositions = rows.map((_, index) => frame.top + frame.plotHeight - band * (index + 0.5));
  return <>
    <Axes frame={frame} settings={settings} xDomain={domain} yDomain={[0, rows.length]} xLabel={settings.xLabel || "Gene ratio"} yLabel="" gridColor={gridColor} hideYTicks categoryYPositions={categoryPositions} />
    <g data-plot-data>
    {rows.map((row, index) => { const y = frame.top + frame.plotHeight - band * (index + 0.84); const width = scaleLinear(row.ratio, domain, [0, frame.plotWidth]); const color = interpolateColor(sequential[0], sequential[1], scaleLinear(-Math.log10(row.p), sigDomain, [0, 1])); return <g key={`${row.term}-${index}`}><rect x={frame.left} y={y} width={Math.max(0, width)} height={band * 0.68} rx={2} fill={color} fillOpacity={settings.opacity} /><text x={frame.left - 8} y={y + band * 0.47} textAnchor="end" fill={TEXT} fontSize={settings.tickSize}>{row.term.slice(0, 22)}</text></g>; })}
    </g>
  </>;
}

function GseaPlot({ frame, dataset, mapping, settings, colors, gridColor }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[]; gridColor: string }) {
  const rows = dataset.rows.map((row) => ({ rank: parseNumericValue(row[mapping.rank]) ?? 0, score: parseNumericValue(row[mapping.score]) ?? 0, hit: parseNumericValue(row[mapping.hit]) === 1 }));
  const xDomain = resolveAxisDomain(numericExtent(rows.map((row) => row.rank)), settings.xMin, settings.xMax);
  const yDomain = resolveAxisDomain(numericExtent([...rows.map((row) => row.score), 0]), settings.yMin, settings.yMax);
  const xAt = (value: number) => scaleLinear(value, xDomain, [frame.left, frame.left + frame.plotWidth]);
  const yAt = (value: number) => scaleLinear(value, yDomain, [frame.top + frame.plotHeight, frame.top]);
  return <>
    <Axes frame={frame} settings={settings} xDomain={xDomain} yDomain={yDomain} xLabel={settings.xLabel || "Rank in ordered dataset"} yLabel={settings.yLabel || "Running enrichment score"} gridColor={gridColor} />
    <g data-plot-data>
    <line x1={frame.left} x2={frame.left + frame.plotWidth} y1={yAt(0)} y2={yAt(0)} stroke={TEXT} opacity={0.6} />
    <polyline points={rows.sort((a, b) => a.rank - b.rank).map((row) => `${xAt(row.rank)},${yAt(row.score)}`).join(" ")} fill="none" stroke={colors[0]} strokeWidth={settings.dataLineWidth} strokeLinejoin="round" />
    {rows.filter((row) => row.hit).map((row, index) => <line key={index} x1={xAt(row.rank)} x2={xAt(row.rank)} y1={frame.top + frame.plotHeight - 18} y2={frame.top + frame.plotHeight} stroke={colors[1] ?? TEXT} strokeWidth={1.2} />)}
    </g>
  </>;
}

function KmPlot({ frame, dataset, mapping, settings, colors, gridColor }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[]; gridColor: string }) {
  const groups = [...new Set(dataset.rows.map((row) => mapping.group ? row[mapping.group] || "All" : "All"))];
  const colorMap = palette(groups, colors);
  const maxTime = Math.max(...dataset.rows.map((row) => parseNumericValue(row[mapping.time]) ?? 0), 1);
  const xDomain = resolveAxisDomain([0, maxTime], settings.xMin, settings.xMax);
  const yDomain = resolveAxisDomain([0, 1], settings.yMin, settings.yMax);
  const chartFrame = settings.showRiskTable ? { ...frame, plotHeight: Math.max(70, frame.plotHeight - 44) } : frame;
  const xAt = (value: number) => scaleLinear(value, xDomain, [chartFrame.left, chartFrame.left + chartFrame.plotWidth]);
  const yAt = (value: number) => scaleLinear(value, yDomain, [chartFrame.top + chartFrame.plotHeight, chartFrame.top]);
  return <>
    <Axes frame={chartFrame} settings={settings} xDomain={xDomain} yDomain={yDomain} xLabel={settings.xLabel || "Time"} yLabel={settings.yLabel || "Survival probability"} gridColor={gridColor} />
    <g data-plot-data>
    {groups.map((group) => { const records = dataset.rows.filter((row) => (mapping.group ? row[mapping.group] || "All" : "All") === group).map((row) => ({ time: parseNumericValue(row[mapping.time]) ?? 0, event: (parseNumericValue(row[mapping.event]) === 1 ? 1 : 0) as 0 | 1 })); const curve = kaplanMeier(records); const path = curve.slice(1).reduce((current, point) => `${current} H ${xAt(point.time)} V ${yAt(point.survival)}`, `M ${xAt(0)} ${yAt(1)}`); const color = colorMap.get(group) ?? colors[0]; return <g key={group}><path d={path} fill="none" stroke={color} strokeWidth={settings.dataLineWidth} />{curve.filter((point) => point.censored > 0).map((point) => <g key={point.time}><line x1={xAt(point.time) - 4} x2={xAt(point.time) + 4} y1={yAt(point.survival)} y2={yAt(point.survival)} stroke={color} strokeWidth={1.5} /><line x1={xAt(point.time)} x2={xAt(point.time)} y1={yAt(point.survival) - 4} y2={yAt(point.survival) + 4} stroke={color} strokeWidth={1.5} /></g>)}{settings.showRiskTable ? <text x={chartFrame.left - 8} y={chartFrame.top + chartFrame.plotHeight + 36 + groups.indexOf(group) * 13} textAnchor="end" fill={color} fontSize={settings.tickSize - 1}>{group.slice(0, 10)}</text> : null}{settings.showRiskTable ? [0, maxTime / 2, maxTime].map((time) => <text key={time} x={xAt(time)} y={chartFrame.top + chartFrame.plotHeight + 36 + groups.indexOf(group) * 13} textAnchor="middle" fill={TEXT} fontSize={settings.tickSize - 1}>{records.filter((record) => record.time >= time).length}</text>) : null}</g>; })}
    </g>
    {settings.showRiskTable ? <text x={chartFrame.left - 8} y={chartFrame.top + chartFrame.plotHeight + 21} textAnchor="end" fill={TEXT} fontSize={settings.tickSize} fontWeight={700}>At risk</text> : null}
    <Legend entries={groups.map((group) => ({ label: group, color: colorMap.get(group) ?? colors[0] }))} frame={frame} settings={settings} />
  </>;
}

function ForestPlot({ frame, dataset, mapping, settings, colors, gridColor }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[]; gridColor: string }) {
  const rows = dataset.rows.map((row) => ({ label: row[mapping.label], estimate: parseNumericValue(row[mapping.estimate]) ?? 0, lower: parseNumericValue(row[mapping.lower]) ?? 0, upper: parseNumericValue(row[mapping.upper]) ?? 0, group: mapping.group ? row[mapping.group] || "All" : "All" }));
  const xDomain = resolveAxisDomain(numericExtent([...rows.flatMap((row) => [row.lower, row.upper]), settings.forestReferenceValue]), settings.xMin, settings.xMax);
  const groups = [...new Set(rows.map((row) => row.group))];
  const colorMap = palette(groups, colors);
  const xAt = (value: number) => scaleLinear(value, xDomain, [frame.left, frame.left + frame.plotWidth]);
  const band = frame.plotHeight / Math.max(1, rows.length);
  const categoryPositions = rows.map((_, index) => frame.top + band * (index + 0.5));
  return <>
    <Axes frame={frame} settings={settings} xDomain={xDomain} yDomain={[0, rows.length]} xLabel={settings.xLabel || "Effect estimate (95% CI)"} yLabel="" gridColor={gridColor} hideYTicks categoryYPositions={categoryPositions} />
    <g data-plot-data>
    <line x1={xAt(settings.forestReferenceValue)} x2={xAt(settings.forestReferenceValue)} y1={frame.top} y2={frame.top + frame.plotHeight} stroke={TEXT} strokeDasharray="5 4" />
    {rows.map((row, index) => { const y = frame.top + band * (index + 0.5); const color = colorMap.get(row.group) ?? colors[0]; return <g key={`${row.label}-${index}`}><line x1={xAt(row.lower)} x2={xAt(row.upper)} y1={y} y2={y} stroke={color} strokeWidth={settings.errorBarLineWidth} /><line x1={xAt(row.lower)} x2={xAt(row.lower)} y1={y - 4} y2={y + 4} stroke={color} /><line x1={xAt(row.upper)} x2={xAt(row.upper)} y1={y - 4} y2={y + 4} stroke={color} /><rect x={xAt(row.estimate) - settings.pointSize} y={y - settings.pointSize} width={settings.pointSize * 2} height={settings.pointSize * 2} fill={color} /><text x={frame.left - 8} y={y + 4} textAnchor="end" fill={TEXT} fontSize={settings.tickSize}>{row.label.slice(0, 23)}</text></g>; })}
    </g>
    <Legend entries={groups.map((group) => ({ label: group, color: colorMap.get(group) ?? colors[0] }))} frame={frame} settings={settings} />
  </>;
}

function RocPlot({ frame, dataset, mapping, settings, colors, gridColor }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[]; gridColor: string }) {
  const xDomain = resolveAxisDomain([0, 1], settings.xMin, settings.xMax);
  const yDomain = resolveAxisDomain([0, 1], settings.yMin, settings.yMax);
  const xAt = (value: number) => scaleLinear(value, xDomain, [frame.left, frame.left + frame.plotWidth]);
  const yAt = (value: number) => scaleLinear(value, yDomain, [frame.top + frame.plotHeight, frame.top]);
  if (settings.rocInputMode === "precomputed-time") {
    const curveKeys = [...new Set(dataset.rows.map((row) => `${mapping.group ? row[mapping.group] || "Model" : "Model"}\u0000${parseNumericValue(row[mapping.horizon])}`))];
    const curves = curveKeys.map((key, index) => {
      const [group, horizon] = key.split("\u0000");
      const rows = dataset.rows.filter((row) => (mapping.group ? row[mapping.group] || "Model" : "Model") === group && parseNumericValue(row[mapping.horizon]) === Number(horizon)).sort((a, b) => (parseNumericValue(a[mapping.fpr]) ?? 0) - (parseNumericValue(b[mapping.fpr]) ?? 0));
      const first = rows[0];
      return { key, group, horizon, color: categoricalColorForIndex(index, colors), rows, auc: parseNumericValue(first?.[mapping.auc]) ?? Number.NaN, aucLower: parseNumericValue(first?.[mapping.aucLower]) ?? Number.NaN, aucUpper: parseNumericValue(first?.[mapping.aucUpper]) ?? Number.NaN };
    });
    const compactProbability = (value: number) => value.toFixed(3).replace(/^0/, "");
    const timeLegend = settings.legendPosition === "none" ? null : settings.legendPosition === "right"
      ? <g data-plot-element="time-roc-legend" transform={`translate(${frame.left + frame.plotWidth + 18} ${frame.top + 5})`}>{curves.map((curve, index) => { const label = `${curve.group} · ${curve.horizon}`; return <g key={curve.key} transform={`translate(0 ${index * (settings.legendSize * 2 + 11)})`}><circle cx={4} cy={-4} r={4} fill={curve.color} /><text data-full-label={label} x={13} y={0} fill={TEXT} fontSize={settings.legendSize}><title>{label}</title>{compactLegendLabel(label, settings.legendSize, frame.width - (frame.left + frame.plotWidth + 35), 22)}</text><text data-auc-interval x={13} y={settings.legendSize + 4} fill={TEXT} fontSize={Math.max(8, settings.legendSize - 1)}>{`AUC ${compactProbability(curve.auc)} [${compactProbability(curve.aucLower)}–${compactProbability(curve.aucUpper)}]`}</text></g>; })}</g>
      : <g data-plot-element="time-roc-legend" transform={`translate(${frame.left} ${frame.height - 68})`}>{curves.map((curve, index) => { const cellWidth = frame.plotWidth / 2; return <g key={curve.key} transform={`translate(${index % 2 * cellWidth} ${Math.floor(index / 2) * (settings.legendSize * 2 + 8)})`}><circle cx={4} cy={-4} r={4} fill={curve.color} /><text x={13} y={0} fill={TEXT} fontSize={settings.legendSize}>{compactLegendLabel(`${curve.group} · ${curve.horizon}`, settings.legendSize, cellWidth - 17, 18)}</text><text data-auc-interval x={13} y={settings.legendSize + 3} fill={TEXT} fontSize={Math.max(7, settings.legendSize - 2)}>{`AUC ${curve.auc.toFixed(2)} [${curve.aucLower.toFixed(2)}, ${curve.aucUpper.toFixed(2)}]`}</text></g>; })}</g>;
    return <>
      <Axes frame={frame} settings={settings} xDomain={xDomain} yDomain={yDomain} xLabel={settings.xLabel || "1 − specificity"} yLabel={settings.yLabel || "Sensitivity"} gridColor={gridColor} />
      <g data-plot-data>
        <line x1={xAt(0)} x2={xAt(1)} y1={yAt(0)} y2={yAt(1)} stroke="#9B9DA3" strokeDasharray="5 4" />
        {curves.map((curve) => {
          const upper = curve.rows.map((row) => `${xAt(parseNumericValue(row[mapping.fpr]) ?? 0)},${yAt(parseNumericValue(row[mapping.tprUpper]) ?? 0)}`);
          const lower = [...curve.rows].reverse().map((row) => `${xAt(parseNumericValue(row[mapping.fpr]) ?? 0)},${yAt(parseNumericValue(row[mapping.tprLower]) ?? 0)}`);
          return <g key={curve.key} data-plot-element="time-dependent-roc" data-model={curve.group} data-horizon={curve.horizon}>
            <polygon points={[...upper, ...lower].join(" ")} fill={curve.color} fillOpacity={0.13} stroke="none"><title>Pointwise 95% confidence band supplied upstream</title></polygon>
            <polyline points={curve.rows.map((row) => `${xAt(parseNumericValue(row[mapping.fpr]) ?? 0)},${yAt(parseNumericValue(row[mapping.tpr]) ?? 0)}`).join(" ")} fill="none" stroke={curve.color} strokeWidth={settings.dataLineWidth} />
          </g>;
        })}
      </g>
      {timeLegend}
    </>;
  }
  const groups = [...new Set(dataset.rows.map((row) => mapping.group ? row[mapping.group] || "Model" : "Model"))];
  const colorMap = palette(groups, colors);
  const curves = groups.map((group) => ({ group, ...rocCurve(dataset.rows.filter((row) => (mapping.group ? row[mapping.group] || "Model" : "Model") === group).map((row) => ({ truth: (parseNumericValue(row[mapping.truth]) === 1 ? 1 : 0) as 0 | 1, score: parseNumericValue(row[mapping.score]) ?? 0 }))) }));
  return <>
    <Axes frame={frame} settings={settings} xDomain={xDomain} yDomain={yDomain} xLabel={settings.xLabel || "1 − specificity"} yLabel={settings.yLabel || "Sensitivity"} gridColor={gridColor} />
    <g data-plot-data>
    <line x1={xAt(0)} x2={xAt(1)} y1={yAt(0)} y2={yAt(1)} stroke="#9B9DA3" strokeDasharray="5 4" />
    {curves.map((curve) => <polyline key={curve.group} points={curve.points.map((point) => `${xAt(point.fpr)},${yAt(point.tpr)}`).join(" ")} fill="none" stroke={colorMap.get(curve.group)} strokeWidth={settings.dataLineWidth} />)}
    </g>
    <Legend entries={curves.map((curve) => ({ label: `${curve.group} · AUC ${Number.isFinite(curve.auc) ? curve.auc.toFixed(3) : "NA"}`, color: colorMap.get(curve.group) ?? colors[0] }))} frame={frame} settings={settings} />
  </>;
}

function SankeyPlot({ frame, dataset, mapping, settings, colors }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[] }) {
  return <ScientificFlowCircularPlot type="sankey" frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} />;
}

function polar(cx: number, cy: number, radius: number, angle: number) { return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius] as const; }

function ChordPlot({ frame, dataset, mapping, settings, colors }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[] }) {
  return <ScientificFlowCircularPlot type="chord" frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} />;
}

function CircosPlot({ frame, dataset, mapping, settings, colors }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[] }) {
  return <ScientificFlowCircularPlot type="circos" frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} />;
}

function sectorPath(cx: number, cy: number, outerRadius: number, start: number, end: number, innerRadius = 0) {
  const safeEnd = Math.min(end, start + Math.PI * 2 - 1e-6);
  const outerStart = polar(cx, cy, outerRadius, start);
  const outerEnd = polar(cx, cy, outerRadius, safeEnd);
  const large = safeEnd - start > Math.PI ? 1 : 0;
  if (innerRadius <= 0) return `M ${cx} ${cy} L ${outerStart[0]} ${outerStart[1]} A ${outerRadius} ${outerRadius} 0 ${large} 1 ${outerEnd[0]} ${outerEnd[1]} Z`;
  const innerEnd = polar(cx, cy, innerRadius, safeEnd);
  const innerStart = polar(cx, cy, innerRadius, start);
  return `M ${outerStart[0]} ${outerStart[1]} A ${outerRadius} ${outerRadius} 0 ${large} 1 ${outerEnd[0]} ${outerEnd[1]} L ${innerEnd[0]} ${innerEnd[1]} A ${innerRadius} ${innerRadius} 0 ${large} 0 ${innerStart[0]} ${innerStart[1]} Z`;
}

function compositionLabel(mode: VisualizationSettings["compositionLabelMode"], value: number, total: number) {
  const percent = total > 0 ? `${(value / total * 100).toFixed(value / total < 0.1 ? 1 : 0)}%` : "0%";
  if (mode === "value") return formatTick(value);
  if (mode === "both") return `${formatTick(value)} (${percent})`;
  return mode === "percent" ? percent : "";
}

function CompositionPlot({ type, frame, dataset, mapping, settings, colors }: { type: "pie" | "donut" | "rose"; frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[] }) {
  const rows = dataset.rows.map((row) => ({ category: row[mapping.category], value: Math.max(0, parseNumericValue(row[mapping.value]) ?? 0) }));
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const colorMap = palette(rows.map((row) => row.category), colors);
  const cx = frame.left + frame.plotWidth / 2;
  const cy = frame.top + frame.plotHeight / 2;
  const radius = Math.min(frame.plotWidth, frame.plotHeight) * 0.42;
  if (type === "rose") {
    const maximum = settings.radialMaximum && settings.radialMaximum > 0 ? settings.radialMaximum : Math.max(...rows.map((row) => row.value), 1) * 1.05;
    const step = Math.PI * 2 / rows.length;
    return <><g data-plot-data data-plot-family="rose">{[0.25, 0.5, 0.75, 1].map((fraction) => <circle key={fraction} cx={cx} cy={cy} r={radius * fraction} fill="none" stroke="#E4E1DC" strokeWidth={settings.gridLineWidth} />)}{rows.map((row, index) => {
      const start = -Math.PI / 2 + index * step + 0.018;
      const end = start + step - 0.036;
      const rowRadius = radius * Math.sqrt(Math.min(1, row.value / maximum));
      const labelPoint = polar(cx, cy, radius + 13, start + (end - start) / 2);
      const labelCosine = Math.cos(start + (end - start) / 2);
      return <g key={`${row.category}-${index}`}><path data-plot-element="rose-sector" d={sectorPath(cx, cy, rowRadius, start, end)} fill={colorMap.get(row.category)} fillOpacity={settings.opacity} stroke="#FFFFFF" strokeWidth={1} />{settings.compositionLabelMode !== "none" ? <text x={labelPoint[0]} y={labelPoint[1] + 3} textAnchor={labelCosine < -0.2 ? "start" : labelCosine > 0.2 ? "end" : "middle"} fill={TEXT} fontSize={settings.tickSize}>{row.category.slice(0, 8)} {formatTick(row.value)}</text> : null}</g>;
    })}</g><Legend entries={rows.map((row) => ({ label: row.category, color: colorMap.get(row.category) ?? colors[0] }))} frame={frame} settings={settings} /></>;
  }
  const inner = type === "donut" ? radius * settings.donutHole : 0;
  return <><g data-plot-data data-plot-family={type}>{rows.map((row, index) => {
    const previous = rows.slice(0, index).reduce((sum, entry) => sum + entry.value, 0);
    const start = -Math.PI / 2 + (previous / Math.max(total, Number.EPSILON)) * Math.PI * 2;
    const end = start + (row.value / Math.max(total, Number.EPSILON)) * Math.PI * 2;
    const middle = (start + end) / 2;
    const labelRadius = inner + (radius - inner) * 0.61;
    const labelPoint = polar(cx, cy, labelRadius, middle);
    const label = compositionLabel(settings.compositionLabelMode, row.value, total);
    return <g key={`${row.category}-${index}`}><path data-plot-element={`${type}-sector`} d={sectorPath(cx, cy, radius, start, end, inner)} fill={colorMap.get(row.category)} fillOpacity={settings.opacity} stroke="#FFFFFF" strokeWidth={1.2} />{label && row.value / total >= 0.045 ? <text x={labelPoint[0]} y={labelPoint[1] + 3} textAnchor="middle" fill={TEXT} fontSize={settings.tickSize} fontWeight={700}>{label}</text> : null}</g>;
  })}{type === "donut" ? <><text x={cx} y={cy - 3} textAnchor="middle" fill={TEXT} fontSize={settings.legendSize}>Total</text><text x={cx} y={cy + settings.axisLabelSize} textAnchor="middle" fill={TEXT} fontSize={settings.axisLabelSize} fontWeight={700}>{formatTick(total)}</text></> : null}</g><Legend entries={rows.map((row) => ({ label: `${row.category} ${compositionLabel("percent", row.value, total)}`, color: colorMap.get(row.category) ?? colors[0] }))} frame={frame} settings={settings} /></>;
}

function WafflePlot({ frame, dataset, mapping, settings, colors }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[] }) {
  const rows = dataset.rows.map((row) => ({ category: row[mapping.category], value: Math.max(0, parseNumericValue(row[mapping.value]) ?? 0) }));
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const count = Math.max(25, Math.min(400, Math.round(settings.waffleCells)));
  const columns = Math.ceil(Math.sqrt(count)); const rowCount = Math.ceil(count / columns);
  const gap = 2; const cell = Math.max(2, Math.min((frame.plotWidth - gap * (columns - 1)) / columns, (frame.plotHeight - gap * (rowCount - 1)) / rowCount));
  const gridWidth = columns * cell + (columns - 1) * gap; const gridHeight = rowCount * cell + (rowCount - 1) * gap;
  const left = frame.left + (frame.plotWidth - gridWidth) / 2; const top = frame.top + (frame.plotHeight - gridHeight) / 2;
  const colorMap = palette(rows.map((row) => row.category), colors);
  const cumulative = rows.reduce<number[]>((acc, row) => [...acc, (acc.at(-1) ?? 0) + row.value / Math.max(total, Number.EPSILON) * count], []);
  return <><g data-plot-data data-plot-family="waffle">{Array.from({ length: count }, (_, index) => {
    const matchedIndex = cumulative.findIndex((boundary) => index + 0.5 <= boundary);
    const row = rows[matchedIndex < 0 ? rows.length - 1 : matchedIndex];
    const columnIndex = index % columns; const rowIndex = rowCount - 1 - Math.floor(index / columns);
    return <rect key={index} data-plot-element="waffle-cell" x={left + columnIndex * (cell + gap)} y={top + rowIndex * (cell + gap)} width={cell} height={cell} rx={Math.min(1.5, cell * 0.15)} fill={colorMap.get(row.category)} fillOpacity={settings.opacity} />;
  })}</g><Legend entries={rows.map((row) => ({ label: settings.compositionLabelMode === "none" ? row.category : `${row.category} ${compositionLabel(settings.compositionLabelMode, row.value, total)}`, color: colorMap.get(row.category) ?? colors[0] }))} frame={frame} settings={settings} /></>;
}

type HierarchyNode = { name: string; ownValue: number; value: number; depth: number; children: HierarchyNode[]; color: string };
function hierarchyFromRows(dataset: ParsedDataset, mapping: Record<string, string>, colors: string[]) {
  const nodes = new Map<string, HierarchyNode>();
  dataset.rows.forEach((row) => nodes.set(row[mapping.node], { name: row[mapping.node], ownValue: Math.max(0, parseNumericValue(row[mapping.value]) ?? 0), value: 0, depth: 0, children: [], color: colors[0] }));
  let root: HierarchyNode | undefined;
  dataset.rows.forEach((row) => { const node = nodes.get(row[mapping.node])!; const parentName = mapping.parent ? row[mapping.parent] : ""; const parent = parentName ? nodes.get(parentName) : undefined; if (parent) parent.children.push(node); else root = node; });
  const fill = (node: HierarchyNode, depth: number, inheritedColor: string): number => { node.depth = depth; node.color = inheritedColor; node.value = node.children.length ? node.children.reduce((sum, child, index) => sum + fill(child, depth + 1, depth === 0 ? colors[index % colors.length] : inheritedColor), 0) : node.ownValue; return node.value; };
  if (root) fill(root, 0, colors[0]);
  return root;
}

function TreemapPlot({ frame, dataset, mapping, settings, colors }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[] }) {
  const root = hierarchyFromRows(dataset, mapping, colors);
  if (!root) return null;
  const marks: ReactNode[] = [];
  const layout = (node: HierarchyNode, x: number, y: number, width: number, height: number, vertical: boolean, key: string) => {
    if (node.depth > 0) {
      const gap = Math.min(settings.hierarchyGap, width / 5, height / 5);
      marks.push(<g key={key}><rect data-plot-element="treemap-node" x={x + gap / 2} y={y + gap / 2} width={Math.max(0, width - gap)} height={Math.max(0, height - gap)} fill={node.color} fillOpacity={Math.max(0.28, settings.opacity - node.depth * 0.12)} stroke="#FFFFFF" strokeWidth={0.8} />{width > 55 && height > 24 ? <><text x={x + 6} y={y + 15} fill={TEXT} fontSize={settings.tickSize} fontWeight={node.children.length ? 700 : 500}>{node.name.slice(0, Math.max(6, Math.floor(width / 7)))}</text>{settings.compositionLabelMode !== "none" && height > 39 ? <text x={x + 6} y={y + 30} fill={TEXT} fontSize={Math.max(8, settings.tickSize - 1)}>{compositionLabel(settings.compositionLabelMode, node.value, root.value)}</text> : null}</> : null}</g>);
    }
    if (!node.children.length || node.value <= 0) return;
    let cursor = vertical ? x : y;
    node.children.forEach((child, index) => { const fraction = child.value / node.value; const childWidth = vertical ? width * fraction : width; const childHeight = vertical ? height : height * fraction; layout(child, vertical ? cursor : x, vertical ? y : cursor, childWidth, childHeight, !vertical, `${key}-${index}`); cursor += vertical ? childWidth : childHeight; });
  };
  layout(root, frame.left, frame.top, frame.plotWidth, frame.plotHeight, frame.plotWidth >= frame.plotHeight, "root");
  return <g data-plot-data data-plot-family="treemap">{marks}</g>;
}

function SunburstPlot({ frame, dataset, mapping, settings, colors }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[] }) {
  const root = hierarchyFromRows(dataset, mapping, colors);
  if (!root) return null;
  const cx = frame.left + frame.plotWidth / 2; const cy = frame.top + frame.plotHeight / 2;
  const depthOf = (node: HierarchyNode): number => node.children.length ? Math.max(node.depth, ...node.children.map(depthOf)) : node.depth;
  const maximumDepth = Math.max(1, depthOf(root));
  const radius = Math.min(frame.plotWidth, frame.plotHeight) * 0.43; const ring = radius / (maximumDepth + 1);
  const safeGap = Math.min(settings.hierarchyGap, ring * 0.7);
  const marks: ReactNode[] = [];
  const renderNode = (node: HierarchyNode, start: number, end: number, key: string) => {
    if (node.depth > 0) {
      marks.push(<path key={key} data-plot-element="sunburst-node" d={sectorPath(cx, cy, ring * (node.depth + 1) - safeGap / 2, start, end, ring * node.depth + safeGap / 2)} fill={node.color} fillOpacity={Math.max(0.3, settings.opacity - node.depth * 0.1)} stroke="#FFFFFF" strokeWidth={0.7} />);
    }
    let cursor = start;
    node.children.forEach((child, index) => { const childEnd = cursor + (end - start) * child.value / Math.max(node.value, Number.EPSILON); renderNode(child, cursor, childEnd, `${key}-${index}`); cursor = childEnd; });
  };
  renderNode(root, -Math.PI / 2, Math.PI * 1.5, "root");
  return <><g data-plot-data data-plot-family="sunburst"><circle cx={cx} cy={cy} r={Math.max(5, ring - safeGap / 2)} fill="#F5F2ED" /><text x={cx} y={cy + 3} textAnchor="middle" fill={TEXT} fontSize={Math.max(8, settings.tickSize - 1)} fontWeight={700}>{root.name.slice(0, 11)}</text>{marks}</g><Legend entries={root.children.map((node) => ({ label: settings.compositionLabelMode === "none" ? node.name : `${node.name} ${compositionLabel(settings.compositionLabelMode, node.value, root.value)}`, color: node.color }))} frame={frame} settings={settings} /></>;
}

function RadialProfilePlot({ type, frame, dataset, mapping, settings, colors }: { type: "radar" | "polar-profile"; frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[] }) {
  const categoryKey = type === "radar" ? "feature" : "angle";
  const categories = [...new Set(dataset.rows.map((row) => row[mapping[categoryKey]]))];
  const series = [...new Set(dataset.rows.map((row) => mapping.series ? row[mapping.series] || "All" : "All"))];
  const colorMap = palette(series, colors); const values = dataset.rows.map((row) => Math.max(0, parseNumericValue(row[mapping.value]) ?? 0));
  const maximum = settings.radialMaximum && settings.radialMaximum > 0 ? settings.radialMaximum : Math.max(...values, 1) * 1.08;
  const cx = frame.left + frame.plotWidth / 2 + Math.min(22, frame.plotWidth * 0.1); const cy = frame.top + frame.plotHeight / 2; const radius = Math.min(frame.plotWidth * 0.31, frame.plotHeight * 0.39);
  const angleAt = (index: number) => -Math.PI / 2 + index * Math.PI * 2 / categories.length;
  const pointAt = (category: string, currentSeries: string) => { const row = dataset.rows.find((entry) => entry[mapping[categoryKey]] === category && (mapping.series ? entry[mapping.series] || "All" : "All") === currentSeries); const value = Math.max(0, parseNumericValue(row?.[mapping.value]) ?? 0); return polar(cx, cy, radius * Math.min(1, value / maximum), angleAt(categories.indexOf(category))); };
  return <><g data-plot-data data-plot-family={type}>{[0.25, 0.5, 0.75, 1].map((fraction) => <polygon key={fraction} points={categories.map((_, index) => polar(cx, cy, radius * fraction, angleAt(index)).join(",")).join(" ")} fill="none" stroke="#DDD9D2" strokeWidth={settings.gridLineWidth} />)}{categories.map((category, index) => { const end = polar(cx, cy, radius, angleAt(index)); const label = polar(cx, cy, radius + 16, angleAt(index)); return <g key={category}><line x1={cx} y1={cy} x2={end[0]} y2={end[1]} stroke="#DDD9D2" strokeWidth={settings.gridLineWidth} /><text x={label[0]} y={label[1] + 3} textAnchor={Math.cos(angleAt(index)) > 0.2 ? "start" : Math.cos(angleAt(index)) < -0.2 ? "end" : "middle"} fill={TEXT} fontSize={settings.tickSize}>{category.slice(0, 13)}</text></g>; })}{series.map((currentSeries) => { const points = categories.map((category) => pointAt(category, currentSeries)); const closed = [...points, points[0]]; return <g key={currentSeries}><polygon data-plot-element={`${type}-profile`} points={points.map((point) => point.join(",")).join(" ")} fill={colorMap.get(currentSeries)} fillOpacity={settings.radarFillOpacity} stroke={colorMap.get(currentSeries)} strokeWidth={settings.dataLineWidth} />{closed.slice(0, -1).map((point, index) => <circle key={index} cx={point[0]} cy={point[1]} r={Math.max(2.5, settings.pointSize * 0.65)} fill={colorMap.get(currentSeries)} stroke="#FFFFFF" strokeWidth={0.7} />)}</g>; })}</g><Legend entries={series.map((entry) => ({ label: entry, color: colorMap.get(entry) ?? colors[0] }))} frame={frame} settings={settings} /></>;
}

function PopulationPyramidPlot({ frame, dataset, mapping, settings, colors }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[] }) {
  const categories = [...new Set(dataset.rows.map((row) => row[mapping.category]))]; const groups = [...new Set(dataset.rows.map((row) => row[mapping.group]))];
  const groupTotals = new Map(groups.map((group) => [group, dataset.rows.filter((row) => row[mapping.group] === group).reduce((sum, row) => sum + Math.max(0, parseNumericValue(row[mapping.value]) ?? 0), 0)]));
  const displayedValue = (row: Record<string, string> | undefined, group: string) => {
    const raw = Math.max(0, parseNumericValue(row?.[mapping.value]) ?? 0);
    return settings.pyramidDisplayMode === "percent" ? raw / Math.max(groupTotals.get(group) ?? 0, Number.EPSILON) * 100 : raw;
  };
  const maximum = Math.max(...dataset.rows.map((row) => displayedValue(row, row[mapping.group])), 1) * 1.08;
  const center = frame.left + frame.plotWidth / 2; const half = frame.plotWidth * 0.43; const band = frame.plotHeight / Math.max(1, categories.length);
  const colorMap = palette(groups, colors);
  const valueFor = (category: string, group: string) => displayedValue(dataset.rows.find((row) => row[mapping.category] === category && row[mapping.group] === group), group);
  const valueLabel = (value: number) => settings.pyramidDisplayMode === "percent" ? `${value.toFixed(value < 10 ? 1 : 0)}%` : formatTick(value);
  return <><g data-plot-data data-plot-family="population-pyramid"><line x1={center} x2={center} y1={frame.top} y2={frame.top + frame.plotHeight} stroke={TEXT} strokeWidth={settings.axisLineWidth} />{categories.map((category, index) => { const y = frame.top + index * band + band * 0.14; const height = band * 0.72; const leftValue = valueFor(category, groups[0]); const rightValue = valueFor(category, groups[1]); const leftWidth = leftValue / maximum * half; const rightWidth = rightValue / maximum * half; return <g key={category}><rect data-plot-element="pyramid-bar" x={center - leftWidth} y={y} width={leftWidth} height={height} fill={colorMap.get(groups[0])} fillOpacity={settings.opacity} /><rect data-plot-element="pyramid-bar" x={center} y={y} width={rightWidth} height={height} fill={colorMap.get(groups[1])} fillOpacity={settings.opacity} /><text x={center} y={y + height / 2 + settings.tickSize * 0.35} textAnchor="middle" fill="#FFFFFF" stroke={TEXT} strokeWidth={2.8} paintOrder="stroke" fontSize={settings.tickSize} fontWeight={700}>{category.slice(0, 11)}</text><text x={center - leftWidth - 5} y={y + height / 2 + 4} textAnchor="end" fill={TEXT} fontSize={settings.tickSize}>{valueLabel(leftValue)}</text><text x={center + rightWidth + 5} y={y + height / 2 + 4} fill={TEXT} fontSize={settings.tickSize}>{valueLabel(rightValue)}</text></g>; })}</g><Legend entries={groups.map((group) => ({ label: group, color: colorMap.get(group) ?? colors[0] }))} frame={frame} settings={settings} /></>;
}

export function ScientificAdvancedChartPreview({ svgRef, type, dataset, mapping, settings, themeId }: Props) {
  const theme = journalThemes[themeId];
  const definition = getPlotDefinition(type);
  const hidesDenseLegend = (type === "scatter" || type === "correlation") && ["density", "hexbin"].includes(settings.associationVariant);
  const frame = frameFor(type, hidesDenseLegend ? { ...settings, legendPosition: "none" } : settings);
  const colors = settings.categoricalColors.length > 0 ? settings.categoricalColors : theme.categorical;
  const sequential: [string, string] = [settings.continuousLow, settings.continuousHigh];
  const diverging: [string, string, string] = [settings.divergingLow, settings.divergingMid, settings.divergingHigh];
  let content: ReactNode = null;
  if (type === "line") content = <LineAssociationPlot frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} gridColor={theme.grid} />;
  else if (type === "scatter" || type === "correlation") content = <AssociationPlot type={type} frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} gridColor={theme.grid} />;
  else if (type === "quadrant") content = <ScatterFamily type={type} frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} gridColor={theme.grid} />;
  else if (["pca", "pcoa", "umap", "tsne", "nmds"].includes(type)) content = <OrdinationPlot type={type as OrdinationType} frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} gridColor={theme.grid} />;
  else if (type === "ma") content = <MaPlot frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} gridColor={theme.grid} />;
  else if (type === "errorbar") content = <ErrorBarPlot frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} gridColor={theme.grid} />;
  else if (type === "area") content = <AreaPlot frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} gridColor={theme.grid} />;
  else if (type === "lollipop") content = <LollipopPlot frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} gridColor={theme.grid} />;
  else if (["box", "violin", "beeswarm", "raincloud", "histogram", "density", "ridge"].includes(type)) content = <DistributionPlot type={type as DistributionPlotType} frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} gridColor={theme.grid} />;
  else if (type === "heatmap" || type === "clustered-heatmap" || type === "correlation-heatmap") content = <MatrixPlot type={type} frame={frame} dataset={dataset} settings={settings} diverging={diverging} sequential={sequential} colors={colors} />;
  else if (type === "enrichment-bar") content = <EnrichmentBar frame={frame} dataset={dataset} mapping={mapping} settings={settings} sequential={sequential} gridColor={theme.grid} />;
  else if (type === "gsea") content = <GseaPlot frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} gridColor={theme.grid} />;
  else if (type === "km") content = <KmPlot frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} gridColor={theme.grid} />;
  else if (type === "survival-forest") content = <ForestPlot frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} gridColor={theme.grid} />;
  else if (type === "roc") content = <RocPlot frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} gridColor={theme.grid} />;
  else if (["funnel", "precision-recall", "calibration", "decision-curve", "nomogram", "lasso-path", "km-cutoff", "risk-score"].includes(type)) content = <ScientificClinicalPlot type={type as ClinicalPlotType} frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} gridColor={theme.grid} />;
  else if (["go-circle", "kegg-circle", "go-chord", "pathway-impact", "nes-fdr", "multi-gsea", "enrichment-ridge", "sankey-bubble", "geographic-map", "petal", "word-cloud"].includes(type)) content = <ScientificEnrichmentSpecializedPlot type={type as EnrichmentSpecializedPlotType} frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} sequential={sequential} gridColor={theme.grid} />;
  else if (type === "venn" || type === "upset") content = <ScientificSetPlot type={type} frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} />;
  else if (type === "sankey") content = <SankeyPlot frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} />;
  else if (type === "alluvial") content = <ScientificFlowCircularPlot type="alluvial" frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} />;
  else if (type === "chord") content = <ChordPlot frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} />;
  else if (type === "ligand-receptor") content = <ScientificFlowCircularPlot type="ligand-receptor" frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} />;
  else if (type === "circos") content = <CircosPlot frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} />;
  else if (isRelationshipPlotType(type)) content = <ScientificRelationshipPlot type={type} frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} />;
  else if (isGenomicPlotType(type)) content = <ScientificGenomicPlot type={type} frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} gridColor={theme.grid} />;
  else if (type === "pie" || type === "donut" || type === "rose") content = <CompositionPlot type={type} frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} />;
  else if (type === "waffle") content = <WafflePlot frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} />;
  else if (type === "treemap") content = <TreemapPlot frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} />;
  else if (type === "sunburst") content = <SunburstPlot frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} />;
  else if (type === "radar" || type === "polar-profile") content = <RadialProfilePlot type={type} frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} />;
  else if (type === "population-pyramid") content = <PopulationPyramidPlot frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} />;
  return <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${frame.width} ${frame.height}`} width={frame.width} height={frame.height} role="img" data-plot-renderer="advanced" data-chart-text-color={TEXT} aria-label={`${definition.name} scientific figure preview`} style={{ fontFamily: figureFontPresets[settings.fontFamily].family, background: "white", maxWidth: "100%", height: "auto" }}>
    <title>{settings.title || `${definition.name} figure`}</title><desc>{definition.summary} Generated in LabNest Visualization Studio.</desc><rect width={frame.width} height={frame.height} fill="#FFFFFF" />
    <defs><clipPath id={`plot-area-${type}`}><rect x={frame.left} y={frame.top} width={frame.plotWidth} height={frame.plotHeight} /></clipPath></defs>
    <style>{`[data-plot-data] path:not([data-no-clip]),[data-plot-data] circle:not([data-no-clip]),[data-plot-data] rect:not([data-no-clip]),[data-plot-data] line:not([data-no-clip]),[data-plot-data] polyline:not([data-no-clip]),[data-plot-data] polygon:not([data-no-clip]),[data-plot-data] text[data-plot-label]:not([data-no-clip]){clip-path:url(#plot-area-${type})}`}</style>
    {settings.title ? <text x={frame.left} y={24} fill={TEXT} fontSize={settings.titleSize} fontWeight={700}>{settings.title}</text> : null}
    {content}
  </svg>;
}
