"use client";

import type { ReactNode, RefObject } from "react";
import {
  buildSetMemberships,
  correlation,
  correlationMatrix,
  hierarchicalClusterOrder,
  kaplanMeier,
  matrixFromRows,
  rocCurve,
  upsetVerticalLayout,
  vennRegionLayout,
} from "@/lib/visualization-advanced";
import {
  boxStatistics,
  divergingColor,
  figureFontPresets,
  formatTick,
  getPlotDefinition,
  groupNumericValues,
  interpolateColor,
  journalThemes,
  kernelDensityEstimate,
  linearRegression,
  numericExtent,
  parseNumericValue,
  parseRatioValue,
  scaleLinear,
  type JournalThemeId,
  type ParsedDataset,
  type PlotType,
  type VisualizationSettings,
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
  const noAxes = ["venn", "sankey", "chord", "circos"].includes(type);
  const labelHeavy = ["enrichment-bar", "survival-forest", "upset"].includes(type);
  const legend = !noAxes && settings.legendPosition === "right" ? 145 : 0;
  const left = noAxes ? 22 : labelHeavy ? Math.min(178, settings.width * 0.32) : 66;
  const top = settings.title ? 48 : 24;
  const bottom = settings.legendPosition === "bottom" ? 80 : 58;
  const right = 22 + legend;
  return { width: settings.width, height: settings.height, left, right, top, bottom, plotWidth: Math.max(100, settings.width - left - right), plotHeight: Math.max(90, settings.height - top - bottom) };
}

function palette(groups: string[], colors: string[]) {
  return new Map(groups.map((group, index) => [group, colors[index % Math.max(1, colors.length)]]));
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
  if (settings.legendPosition === "bottom") return <g transform={`translate(${frame.left} ${frame.height - 23})`}>{entries.slice(0, 8).map((entry, index) => <g key={entry.label} transform={`translate(${index * Math.min(120, frame.plotWidth / Math.max(1, entries.length))} 0)`}><circle cx={4} cy={-4} r={4} fill={entry.color} /><text x={13} y={0} fill={TEXT} fontSize={settings.legendSize}>{entry.label.slice(0, 15)}</text></g>)}</g>;
  return <g transform={`translate(${frame.left + frame.plotWidth + 18} ${frame.top + 5})`}>{entries.slice(0, 12).map((entry, index) => <g key={entry.label} transform={`translate(0 ${index * (settings.legendSize + 10)})`}><circle cx={4} cy={-4} r={4} fill={entry.color} /><text x={13} y={0} fill={TEXT} fontSize={settings.legendSize}>{entry.label.slice(0, 24)}</text></g>)}</g>;
}

function ScatterFamily({ type, frame, dataset, mapping, settings, colors, gridColor }: Omit<Props, "svgRef" | "themeId"> & { frame: Frame; colors: string[]; gridColor: string }) {
  const points = dataset.rows.map((row, index) => ({
    x: parseNumericValue(row[mapping.x]) ?? 0,
    y: parseNumericValue(row[mapping.y]) ?? 0,
    group: mapping.group ? row[mapping.group] || "All" : "All",
    label: mapping.label ? row[mapping.label] || "" : "",
    index,
  }));
  const xDomain = numericExtent([...points.map((point) => point.x), ...(type === "quadrant" ? [settings.xThreshold] : [])]);
  const yDomain = numericExtent([...points.map((point) => point.y), ...(type === "quadrant" ? [settings.yThreshold] : [])]);
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
    {type === "quadrant" ? <><line x1={xAt(settings.xThreshold)} x2={xAt(settings.xThreshold)} y1={frame.top} y2={frame.top + frame.plotHeight} stroke={TEXT} strokeDasharray="5 4" opacity={0.65} /><line x1={frame.left} x2={frame.left + frame.plotWidth} y1={yAt(settings.yThreshold)} y2={yAt(settings.yThreshold)} stroke={TEXT} strokeDasharray="5 4" opacity={0.65} /></> : null}
    {type === "correlation" && settings.showTrend && fit ? <line x1={xAt(xDomain[0])} y1={yAt(fit.intercept + fit.slope * xDomain[0])} x2={xAt(xDomain[1])} y2={yAt(fit.intercept + fit.slope * xDomain[1])} stroke={colors[0]} strokeWidth={settings.dataLineWidth} /> : null}
    {points.map((point) => <g key={point.index}><circle cx={xAt(point.x)} cy={yAt(point.y)} r={settings.pointSize} fill={colorMap.get(point.group)} fillOpacity={settings.opacity} stroke="#FFFFFF" strokeWidth={0.7} />{settings.showLabels && point.label ? <text x={xAt(point.x) + settings.pointSize + 2} y={yAt(point.y) - 3} fill={TEXT} fontSize={settings.tickSize}>{point.label}</text> : null}</g>)}
    {type === "correlation" ? <text x={frame.left + 10} y={frame.top + 18} fill={TEXT} fontSize={settings.legendSize} fontWeight={700}>{settings.correlationMethod === "pearson" ? "Pearson r" : "Spearman ρ"} = {coefficient.toFixed(3)} · n = {points.length}</text> : null}
    <Legend entries={groups.map((group) => ({ label: group, color: colorMap.get(group) ?? colors[0] }))} frame={frame} settings={settings} />
  </>;
}

function MaPlot({ frame, dataset, mapping, settings, colors, gridColor }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[]; gridColor: string }) {
  const rows = dataset.rows.map((row, index) => ({ index, label: row[mapping.label], x: Math.log10(Math.max(parseNumericValue(row[mapping.mean]) ?? 1, Number.MIN_VALUE)), effect: parseNumericValue(row[mapping.effect]) ?? 0, p: parseNumericValue(row[mapping.pValue]) ?? 1 }));
  const xDomain = numericExtent(rows.map((row) => row.x));
  const yDomain = numericExtent(rows.map((row) => row.effect));
  const xAt = (value: number) => scaleLinear(value, xDomain, [frame.left, frame.left + frame.plotWidth]);
  const yAt = (value: number) => scaleLinear(value, yDomain, [frame.top + frame.plotHeight, frame.top]);
  const labels = new Set(rows.filter((row) => row.p <= settings.pValueThreshold && Math.abs(row.effect) >= settings.foldChangeThreshold).sort((a, b) => a.p - b.p).slice(0, settings.labelLimit).map((row) => row.index));
  return <>
    <Axes frame={frame} settings={settings} xDomain={xDomain} yDomain={yDomain} xLabel={settings.xLabel || "log₁₀ mean expression"} yLabel={settings.yLabel || "log₂ fold change"} gridColor={gridColor} />
    <line x1={frame.left} x2={frame.left + frame.plotWidth} y1={yAt(0)} y2={yAt(0)} stroke={TEXT} strokeDasharray="4 4" />
    {rows.map((row) => { const up = row.p <= settings.pValueThreshold && row.effect >= settings.foldChangeThreshold; const down = row.p <= settings.pValueThreshold && row.effect <= -settings.foldChangeThreshold; const color = up ? colors[1] ?? colors[0] : down ? colors[0] : "#B7B8BC"; return <g key={row.index}><circle cx={xAt(row.x)} cy={yAt(row.effect)} r={settings.pointSize * 0.75} fill={color} fillOpacity={settings.opacity} />{labels.has(row.index) ? <text x={xAt(row.x) + 4} y={yAt(row.effect) - 4} fill={TEXT} fontSize={settings.tickSize}>{row.label}</text> : null}</g>; })}
    <Legend entries={[{ label: "Down", color: colors[0] }, { label: "Up", color: colors[1] ?? colors[0] }, { label: "Not significant", color: "#B7B8BC" }]} frame={frame} settings={settings} />
  </>;
}

function ErrorBarPlot({ frame, dataset, mapping, settings, colors, gridColor }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[]; gridColor: string }) {
  const rows = dataset.rows.map((row) => ({ category: row[mapping.category], value: parseNumericValue(row[mapping.value]) ?? 0, error: Math.max(0, parseNumericValue(row[mapping.error]) ?? 0), group: mapping.group ? row[mapping.group] || "All" : "All" }));
  const yDomain = numericExtent(rows.flatMap((row) => [row.value - row.error, row.value + row.error]), true);
  const band = frame.plotWidth / Math.max(1, rows.length);
  const groups = [...new Set(rows.map((row) => row.group))];
  const colorMap = palette(groups, colors);
  const yAt = (value: number) => scaleLinear(value, yDomain, [frame.top + frame.plotHeight, frame.top]);
  const categoryPositions = rows.map((_, index) => frame.left + band * (index + 0.5));
  return <>
    <Axes frame={frame} settings={settings} xDomain={[0, rows.length]} yDomain={yDomain} xLabel={settings.xLabel} yLabel={settings.yLabel || "Mean ± error"} gridColor={gridColor} hideXTicks categoryXPositions={categoryPositions} />
    {rows.map((row, index) => { const x = frame.left + band * (index + 0.5); const low = yAt(row.value - row.error); const high = yAt(row.value + row.error); const color = colorMap.get(row.group) ?? colors[0]; return <g key={`${row.category}-${index}`}><line x1={x} x2={x} y1={low} y2={high} stroke={color} strokeWidth={settings.errorBarLineWidth} /><line x1={x - settings.errorBarCapSize / 2} x2={x + settings.errorBarCapSize / 2} y1={low} y2={low} stroke={color} strokeWidth={settings.errorBarLineWidth} /><line x1={x - settings.errorBarCapSize / 2} x2={x + settings.errorBarCapSize / 2} y1={high} y2={high} stroke={color} strokeWidth={settings.errorBarLineWidth} /><circle cx={x} cy={yAt(row.value)} r={settings.pointSize} fill="#FFFFFF" stroke={color} strokeWidth={settings.dataLineWidth} /><text x={x} y={frame.top + frame.plotHeight + 19} textAnchor="middle" fill={TEXT} fontSize={settings.tickSize} transform={`rotate(-28 ${x} ${frame.top + frame.plotHeight + 19})`}>{row.category.slice(0, 16)}</text></g>; })}
    <Legend entries={groups.map((group) => ({ label: group, color: colorMap.get(group) ?? colors[0] }))} frame={frame} settings={settings} />
  </>;
}

function AreaPlot({ frame, dataset, mapping, settings, colors, gridColor }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[]; gridColor: string }) {
  const rows = dataset.rows.map((row) => ({ x: parseNumericValue(row[mapping.x]) ?? 0, y: parseNumericValue(row[mapping.value]) ?? 0, group: mapping.series ? row[mapping.series] || "All" : "All" }));
  const xDomain = numericExtent(rows.map((row) => row.x));
  const yDomain = numericExtent([...rows.map((row) => row.y), 0], true);
  const groups = [...new Set(rows.map((row) => row.group))];
  const colorMap = palette(groups, colors);
  const xAt = (value: number) => scaleLinear(value, xDomain, [frame.left, frame.left + frame.plotWidth]);
  const yAt = (value: number) => scaleLinear(value, yDomain, [frame.top + frame.plotHeight, frame.top]);
  return <>
    <Axes frame={frame} settings={settings} xDomain={xDomain} yDomain={yDomain} xLabel={settings.xLabel || "X"} yLabel={settings.yLabel || "Value"} gridColor={gridColor} />
    {groups.map((group) => { const points = rows.filter((row) => row.group === group).sort((a, b) => a.x - b.x); const line = points.map((point) => `${xAt(point.x)},${yAt(point.y)}`).join(" "); const area = `${xAt(points[0]?.x ?? 0)},${yAt(0)} ${line} ${xAt(points.at(-1)?.x ?? 0)},${yAt(0)}`; const color = colorMap.get(group) ?? colors[0]; return <g key={group}><polygon points={area} fill={color} fillOpacity={settings.opacity * 0.28} /><polyline points={line} fill="none" stroke={color} strokeWidth={settings.dataLineWidth} strokeLinejoin="round" />{points.map((point, index) => <circle key={index} cx={xAt(point.x)} cy={yAt(point.y)} r={settings.pointSize * 0.65} fill={color} />)}</g>; })}
    <Legend entries={groups.map((group) => ({ label: group, color: colorMap.get(group) ?? colors[0] }))} frame={frame} settings={settings} />
  </>;
}

function LollipopPlot({ frame, dataset, mapping, settings, colors, gridColor }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[]; gridColor: string }) {
  const rows = dataset.rows.map((row) => ({ category: row[mapping.category], value: parseNumericValue(row[mapping.value]) ?? 0, group: mapping.group ? row[mapping.group] || "All" : "All" }));
  const yDomain = numericExtent([...rows.map((row) => row.value), 0], true);
  const groups = [...new Set(rows.map((row) => row.group))];
  const colorMap = palette(groups, colors);
  const band = frame.plotWidth / Math.max(1, rows.length);
  const yAt = (value: number) => scaleLinear(value, yDomain, [frame.top + frame.plotHeight, frame.top]);
  const categoryPositions = rows.map((_, index) => frame.left + band * (index + 0.5));
  return <>
    <Axes frame={frame} settings={settings} xDomain={[0, rows.length]} yDomain={yDomain} xLabel={settings.xLabel} yLabel={settings.yLabel || "Value"} gridColor={gridColor} hideXTicks categoryXPositions={categoryPositions} />
    {rows.map((row, index) => { const x = frame.left + band * (index + 0.5); const color = colorMap.get(row.group) ?? colors[0]; return <g key={`${row.category}-${index}`}><line x1={x} x2={x} y1={yAt(0)} y2={yAt(row.value)} stroke={color} strokeWidth={settings.dataLineWidth} /><circle cx={x} cy={yAt(row.value)} r={settings.pointSize + 1} fill={color} fillOpacity={settings.opacity} /><text x={x} y={frame.top + frame.plotHeight + 19} textAnchor="end" fill={TEXT} fontSize={settings.tickSize} transform={`rotate(-35 ${x} ${frame.top + frame.plotHeight + 19})`}>{row.category.slice(0, 18)}</text></g>; })}
    <Legend entries={groups.map((group) => ({ label: group, color: colorMap.get(group) ?? colors[0] }))} frame={frame} settings={settings} />
  </>;
}

function DistributionPlot({ type, frame, dataset, mapping, settings, colors, gridColor }: { type: "beeswarm" | "raincloud"; frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[]; gridColor: string }) {
  const entries = [...groupNumericValues(dataset.rows, mapping.group, mapping.value).entries()];
  const rawDomain = numericExtent(entries.flatMap(([, values]) => values));
  const rawSpan = rawDomain[1] - rawDomain[0];
  const densityBoundaryDomain: [number, number] = [rawDomain[0] - rawSpan, rawDomain[1] + rawSpan];
  const densityCurves = new Map(entries.map(([group, values]) => [group, kernelDensityEstimate(values, densityBoundaryDomain, settings.violinBandwidth).points]));
  const densitySupport = [...densityCurves.values()].flatMap((curve) => curve.map((point) => point.position));
  const yDomain = type === "raincloud" && densitySupport.length > 0 ? numericExtent(densitySupport) : rawDomain;
  const band = frame.plotWidth / Math.max(1, entries.length);
  const yAt = (value: number) => scaleLinear(value, yDomain, [frame.top + frame.plotHeight, frame.top]);
  const colorMap = palette(entries.map(([group]) => group), colors);
  const categoryPositions = entries.map((_, index) => frame.left + band * (index + 0.5));
  return <>
    <Axes frame={frame} settings={settings} xDomain={[0, entries.length]} yDomain={yDomain} xLabel={settings.xLabel} yLabel={settings.yLabel || "Value"} gridColor={gridColor} hideXTicks categoryXPositions={categoryPositions} />
    {entries.map(([group, values], groupIndex) => { const center = frame.left + band * (groupIndex + 0.5); const color = colorMap.get(group) ?? colors[0]; const stats = boxStatistics(values); const curve = densityCurves.get(group) ?? []; const maxDensity = Math.max(...curve.map((point) => point.density), 1e-9); return <g key={group}>
      {type === "raincloud" ? <><polygon points={`${center + 3},${yAt(curve[0]?.position ?? 0)} ${curve.map((point) => `${center + 3 + point.density / maxDensity * band * 0.35},${yAt(point.position)}`).join(" ")} ${center + 3},${yAt(curve.at(-1)?.position ?? 0)}`} fill={color} fillOpacity={settings.opacity * 0.38} stroke={color} strokeWidth={settings.dataLineWidth * 0.7} /><line x1={center - band * 0.18} x2={center - band * 0.18} y1={yAt(stats.q1)} y2={yAt(stats.q3)} stroke={color} strokeWidth={5} /><line x1={center - band * 0.26} x2={center - band * 0.1} y1={yAt(stats.median)} y2={yAt(stats.median)} stroke={TEXT} strokeWidth={1.6} /></> : null}
      {settings.showPoints ? values.map((value, index) => { const signed = ((index * 37) % 17 - 8) / 8; const spread = type === "raincloud" ? band * 0.13 : band * 0.3; return <circle key={index} cx={center + signed * spread - (type === "raincloud" ? band * 0.18 : 0)} cy={yAt(value)} r={settings.pointSize * 0.7} fill={color} fillOpacity={settings.opacity} stroke="#FFFFFF" strokeWidth={0.5} />; }) : null}
      <text x={center} y={frame.top + frame.plotHeight + 20} textAnchor="middle" fill={TEXT} fontSize={settings.tickSize}>{group.slice(0, 15)}</text>
      {settings.showSampleSize ? <text x={center} y={frame.top + frame.plotHeight + 36} textAnchor="middle" fill={TEXT} fontSize={settings.tickSize - 1}>n={values.length}</text> : null}
    </g>; })}
  </>;
}

function MatrixPlot({ type, frame, dataset, settings, diverging }: { type: "clustered-heatmap" | "correlation-heatmap"; frame: Frame; dataset: ParsedDataset; settings: VisualizationSettings; diverging: [string, string, string] }) {
  const labelColumn = dataset.headers[0];
  const sourceColumns = dataset.headers.slice(1);
  const source = matrixFromRows(dataset.rows, sourceColumns);
  let rowLabels: string[];
  let columnLabels: string[];
  let matrix: number[][];
  if (type === "correlation-heatmap") {
    matrix = correlationMatrix(source, settings.correlationMethod);
    rowLabels = [...sourceColumns];
    columnLabels = [...sourceColumns];
  } else {
    matrix = settings.heatmapScale === "row" ? source.map((row) => { const avg = row.reduce((sum, value) => sum + value, 0) / row.length; const sd = Math.sqrt(row.reduce((sum, value) => sum + (value - avg) ** 2, 0) / Math.max(1, row.length - 1)) || 1; return row.map((value) => (value - avg) / sd); }) : source;
    rowLabels = dataset.rows.map((row) => row[labelColumn]);
    columnLabels = [...sourceColumns];
  }
  const rowOrder = settings.clusterRows ? hierarchicalClusterOrder(matrix) : matrix.map((_, index) => index);
  const columnVectors = columnLabels.map((_, column) => matrix.map((row) => row[column]));
  const columnOrder = settings.clusterColumns ? hierarchicalClusterOrder(columnVectors) : columnLabels.map((_, index) => index);
  if (type === "correlation-heatmap" && (settings.clusterRows || settings.clusterColumns)) {
    const shared = settings.clusterRows ? rowOrder : columnOrder;
    rowLabels = shared.map((index) => rowLabels[index]);
    columnLabels = shared.map((index) => columnLabels[index]);
    matrix = shared.map((row) => shared.map((column) => matrix[row][column]));
  } else {
    rowLabels = rowOrder.map((index) => rowLabels[index]);
    columnLabels = columnOrder.map((index) => columnLabels[index]);
    matrix = rowOrder.map((row) => columnOrder.map((column) => matrix[row][column]));
  }
  const max = type === "correlation-heatmap" ? 1 : Math.max(...matrix.flat().map(Math.abs), 1);
  const cellWidth = frame.plotWidth / Math.max(1, columnLabels.length);
  const cellHeight = frame.plotHeight / Math.max(1, rowLabels.length);
  return <g>
    {matrix.map((row, rowIndex) => row.map((value, columnIndex) => <rect key={`${rowIndex}-${columnIndex}`} x={frame.left + columnIndex * cellWidth} y={frame.top + rowIndex * cellHeight} width={cellWidth + 0.2} height={cellHeight + 0.2} fill={divergingColor(diverging[0], diverging[1], diverging[2], scaleLinear(value, [-max, max], [0, 1]))} />))}
    {rowLabels.slice(0, Math.floor(frame.plotHeight / Math.max(10, settings.tickSize + 2))).map((label, index) => <text key={label} x={frame.left - 7} y={frame.top + (index + 0.68) * cellHeight} textAnchor="end" fill={TEXT} fontSize={settings.tickSize}>{label.slice(0, 12)}</text>)}
    {columnLabels.map((label, index) => <text key={label} x={frame.left + (index + 0.5) * cellWidth} y={frame.top + frame.plotHeight + 8} textAnchor="end" fill={TEXT} fontSize={settings.tickSize} transform={`rotate(-45 ${frame.left + (index + 0.5) * cellWidth} ${frame.top + frame.plotHeight + 8})`}>{label.slice(0, 12)}</text>)}
    <rect x={frame.left} y={frame.top} width={frame.plotWidth} height={frame.plotHeight} fill="none" stroke={TEXT} strokeWidth={0.8} />
  </g>;
}

function EnrichmentBar({ frame, dataset, mapping, settings, sequential, gridColor }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; sequential: [string, string]; gridColor: string }) {
  const rows = dataset.rows.map((row) => ({ term: row[mapping.term], ratio: parseRatioValue(row[mapping.ratio]) ?? 0, p: Math.max(parseNumericValue(row[mapping.pValue]) ?? 1, Number.MIN_VALUE) })).sort((a, b) => a.ratio - b.ratio);
  const domain = numericExtent(rows.map((row) => row.ratio), true);
  const significance = rows.map((row) => -Math.log10(row.p));
  const sigDomain = numericExtent(significance, true);
  const band = frame.plotHeight / Math.max(1, rows.length);
  const categoryPositions = rows.map((_, index) => frame.top + frame.plotHeight - band * (index + 0.5));
  return <>
    <Axes frame={frame} settings={settings} xDomain={domain} yDomain={[0, rows.length]} xLabel={settings.xLabel || "Gene ratio"} yLabel="" gridColor={gridColor} hideYTicks categoryYPositions={categoryPositions} />
    {rows.map((row, index) => { const y = frame.top + frame.plotHeight - band * (index + 0.84); const width = scaleLinear(row.ratio, domain, [0, frame.plotWidth]); const color = interpolateColor(sequential[0], sequential[1], scaleLinear(-Math.log10(row.p), sigDomain, [0, 1])); return <g key={`${row.term}-${index}`}><rect x={frame.left} y={y} width={Math.max(0, width)} height={band * 0.68} rx={2} fill={color} fillOpacity={settings.opacity} /><text x={frame.left - 8} y={y + band * 0.47} textAnchor="end" fill={TEXT} fontSize={settings.tickSize}>{row.term.slice(0, 22)}</text></g>; })}
  </>;
}

function GseaPlot({ frame, dataset, mapping, settings, colors, gridColor }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[]; gridColor: string }) {
  const rows = dataset.rows.map((row) => ({ rank: parseNumericValue(row[mapping.rank]) ?? 0, score: parseNumericValue(row[mapping.score]) ?? 0, hit: parseNumericValue(row[mapping.hit]) === 1 }));
  const xDomain = numericExtent(rows.map((row) => row.rank));
  const yDomain = numericExtent([...rows.map((row) => row.score), 0]);
  const xAt = (value: number) => scaleLinear(value, xDomain, [frame.left, frame.left + frame.plotWidth]);
  const yAt = (value: number) => scaleLinear(value, yDomain, [frame.top + frame.plotHeight, frame.top]);
  return <>
    <Axes frame={frame} settings={settings} xDomain={xDomain} yDomain={yDomain} xLabel={settings.xLabel || "Rank in ordered dataset"} yLabel={settings.yLabel || "Running enrichment score"} gridColor={gridColor} />
    <line x1={frame.left} x2={frame.left + frame.plotWidth} y1={yAt(0)} y2={yAt(0)} stroke={TEXT} opacity={0.6} />
    <polyline points={rows.sort((a, b) => a.rank - b.rank).map((row) => `${xAt(row.rank)},${yAt(row.score)}`).join(" ")} fill="none" stroke={colors[0]} strokeWidth={settings.dataLineWidth} strokeLinejoin="round" />
    {rows.filter((row) => row.hit).map((row, index) => <line key={index} x1={xAt(row.rank)} x2={xAt(row.rank)} y1={frame.top + frame.plotHeight - 18} y2={frame.top + frame.plotHeight} stroke={colors[1] ?? TEXT} strokeWidth={1.2} />)}
  </>;
}

function KmPlot({ frame, dataset, mapping, settings, colors, gridColor }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[]; gridColor: string }) {
  const groups = [...new Set(dataset.rows.map((row) => mapping.group ? row[mapping.group] || "All" : "All"))];
  const colorMap = palette(groups, colors);
  const maxTime = Math.max(...dataset.rows.map((row) => parseNumericValue(row[mapping.time]) ?? 0), 1);
  const chartFrame = settings.showRiskTable ? { ...frame, plotHeight: Math.max(70, frame.plotHeight - 44) } : frame;
  const xAt = (value: number) => scaleLinear(value, [0, maxTime], [chartFrame.left, chartFrame.left + chartFrame.plotWidth]);
  const yAt = (value: number) => scaleLinear(value, [0, 1], [chartFrame.top + chartFrame.plotHeight, chartFrame.top]);
  return <>
    <Axes frame={chartFrame} settings={settings} xDomain={[0, maxTime]} yDomain={[0, 1]} xLabel={settings.xLabel || "Time"} yLabel={settings.yLabel || "Survival probability"} gridColor={gridColor} />
    {groups.map((group) => { const records = dataset.rows.filter((row) => (mapping.group ? row[mapping.group] || "All" : "All") === group).map((row) => ({ time: parseNumericValue(row[mapping.time]) ?? 0, event: (parseNumericValue(row[mapping.event]) === 1 ? 1 : 0) as 0 | 1 })); const curve = kaplanMeier(records); const path = curve.slice(1).reduce((current, point) => `${current} H ${xAt(point.time)} V ${yAt(point.survival)}`, `M ${xAt(0)} ${yAt(1)}`); const color = colorMap.get(group) ?? colors[0]; return <g key={group}><path d={path} fill="none" stroke={color} strokeWidth={settings.dataLineWidth} />{curve.filter((point) => point.censored > 0).map((point) => <g key={point.time}><line x1={xAt(point.time) - 4} x2={xAt(point.time) + 4} y1={yAt(point.survival)} y2={yAt(point.survival)} stroke={color} strokeWidth={1.5} /><line x1={xAt(point.time)} x2={xAt(point.time)} y1={yAt(point.survival) - 4} y2={yAt(point.survival) + 4} stroke={color} strokeWidth={1.5} /></g>)}{settings.showRiskTable ? <text x={chartFrame.left - 8} y={chartFrame.top + chartFrame.plotHeight + 36 + groups.indexOf(group) * 13} textAnchor="end" fill={color} fontSize={settings.tickSize - 1}>{group.slice(0, 10)}</text> : null}{settings.showRiskTable ? [0, maxTime / 2, maxTime].map((time) => <text key={time} x={xAt(time)} y={chartFrame.top + chartFrame.plotHeight + 36 + groups.indexOf(group) * 13} textAnchor="middle" fill={TEXT} fontSize={settings.tickSize - 1}>{records.filter((record) => record.time >= time).length}</text>) : null}</g>; })}
    {settings.showRiskTable ? <text x={chartFrame.left - 8} y={chartFrame.top + chartFrame.plotHeight + 21} textAnchor="end" fill={TEXT} fontSize={settings.tickSize} fontWeight={700}>At risk</text> : null}
    <Legend entries={groups.map((group) => ({ label: group, color: colorMap.get(group) ?? colors[0] }))} frame={frame} settings={settings} />
  </>;
}

function ForestPlot({ frame, dataset, mapping, settings, colors, gridColor }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[]; gridColor: string }) {
  const rows = dataset.rows.map((row) => ({ label: row[mapping.label], estimate: parseNumericValue(row[mapping.estimate]) ?? 0, lower: parseNumericValue(row[mapping.lower]) ?? 0, upper: parseNumericValue(row[mapping.upper]) ?? 0, group: mapping.group ? row[mapping.group] || "All" : "All" }));
  const xDomain = numericExtent([...rows.flatMap((row) => [row.lower, row.upper]), settings.forestReferenceValue]);
  const groups = [...new Set(rows.map((row) => row.group))];
  const colorMap = palette(groups, colors);
  const xAt = (value: number) => scaleLinear(value, xDomain, [frame.left, frame.left + frame.plotWidth]);
  const band = frame.plotHeight / Math.max(1, rows.length);
  const categoryPositions = rows.map((_, index) => frame.top + band * (index + 0.5));
  return <>
    <Axes frame={frame} settings={settings} xDomain={xDomain} yDomain={[0, rows.length]} xLabel={settings.xLabel || "Effect estimate (95% CI)"} yLabel="" gridColor={gridColor} hideYTicks categoryYPositions={categoryPositions} />
    <line x1={xAt(settings.forestReferenceValue)} x2={xAt(settings.forestReferenceValue)} y1={frame.top} y2={frame.top + frame.plotHeight} stroke={TEXT} strokeDasharray="5 4" />
    {rows.map((row, index) => { const y = frame.top + band * (index + 0.5); const color = colorMap.get(row.group) ?? colors[0]; return <g key={`${row.label}-${index}`}><line x1={xAt(row.lower)} x2={xAt(row.upper)} y1={y} y2={y} stroke={color} strokeWidth={settings.errorBarLineWidth} /><line x1={xAt(row.lower)} x2={xAt(row.lower)} y1={y - 4} y2={y + 4} stroke={color} /><line x1={xAt(row.upper)} x2={xAt(row.upper)} y1={y - 4} y2={y + 4} stroke={color} /><rect x={xAt(row.estimate) - settings.pointSize} y={y - settings.pointSize} width={settings.pointSize * 2} height={settings.pointSize * 2} fill={color} /><text x={frame.left - 8} y={y + 4} textAnchor="end" fill={TEXT} fontSize={settings.tickSize}>{row.label.slice(0, 23)}</text></g>; })}
    <Legend entries={groups.map((group) => ({ label: group, color: colorMap.get(group) ?? colors[0] }))} frame={frame} settings={settings} />
  </>;
}

function RocPlot({ frame, dataset, mapping, settings, colors, gridColor }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[]; gridColor: string }) {
  const groups = [...new Set(dataset.rows.map((row) => mapping.group ? row[mapping.group] || "Model" : "Model"))];
  const colorMap = palette(groups, colors);
  const xAt = (value: number) => scaleLinear(value, [0, 1], [frame.left, frame.left + frame.plotWidth]);
  const yAt = (value: number) => scaleLinear(value, [0, 1], [frame.top + frame.plotHeight, frame.top]);
  const curves = groups.map((group) => ({ group, ...rocCurve(dataset.rows.filter((row) => (mapping.group ? row[mapping.group] || "Model" : "Model") === group).map((row) => ({ truth: (parseNumericValue(row[mapping.truth]) === 1 ? 1 : 0) as 0 | 1, score: parseNumericValue(row[mapping.score]) ?? 0 }))) }));
  return <>
    <Axes frame={frame} settings={settings} xDomain={[0, 1]} yDomain={[0, 1]} xLabel={settings.xLabel || "1 − specificity"} yLabel={settings.yLabel || "Sensitivity"} gridColor={gridColor} />
    <line x1={xAt(0)} x2={xAt(1)} y1={yAt(0)} y2={yAt(1)} stroke="#9B9DA3" strokeDasharray="5 4" />
    {curves.map((curve) => <polyline key={curve.group} points={curve.points.map((point) => `${xAt(point.fpr)},${yAt(point.tpr)}`).join(" ")} fill="none" stroke={colorMap.get(curve.group)} strokeWidth={settings.dataLineWidth} />)}
    <Legend entries={curves.map((curve) => ({ label: `${curve.group} · AUC ${Number.isFinite(curve.auc) ? curve.auc.toFixed(3) : "NA"}`, color: colorMap.get(curve.group) ?? colors[0] }))} frame={frame} settings={settings} />
  </>;
}

function VennPlot({ frame, dataset, mapping, settings, colors }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[] }) {
  const membership = buildSetMemberships(dataset.rows, mapping.item, mapping.set);
  const sets = membership.sets;
  const centers = sets.length === 2 ? [[frame.left + frame.plotWidth * 0.43, frame.top + frame.plotHeight * 0.52], [frame.left + frame.plotWidth * 0.57, frame.top + frame.plotHeight * 0.52]] : [[frame.left + frame.plotWidth * 0.43, frame.top + frame.plotHeight * 0.43], [frame.left + frame.plotWidth * 0.57, frame.top + frame.plotHeight * 0.43], [frame.left + frame.plotWidth * 0.5, frame.top + frame.plotHeight * 0.59]];
  const radius = Math.min(frame.plotWidth, frame.plotHeight) * 0.27;
  const layout = vennRegionLayout(centers as Array<[number, number]>, radius);
  const exact = (wanted: string[]) => [...membership.memberships.values()].filter((itemSets) => itemSets.size === wanted.length && wanted.every((set) => itemSets.has(set))).length;
  return <g>
    {sets.map((set, index) => <g key={set}><circle cx={centers[index][0]} cy={centers[index][1]} r={radius} fill={colors[index % colors.length]} fillOpacity={settings.opacity * 0.3} stroke={colors[index % colors.length]} strokeWidth={settings.dataLineWidth} /><text x={layout.setLabels[index][0]} y={layout.setLabels[index][1]} textAnchor="middle" fill={TEXT} fontSize={settings.legendSize} fontWeight={700}>{set}</text></g>)}
    {sets.map((set, index) => <text key={`only-${set}`} x={layout.only[index][0]} y={layout.only[index][1]} textAnchor="middle" fill={TEXT} fontSize={settings.axisLabelSize} fontWeight={700}>{exact([set])}</text>)}
    {sets.length >= 2 ? <text x={layout.pairs[0][0]} y={layout.pairs[0][1]} textAnchor="middle" fill={TEXT} fontSize={settings.axisLabelSize} fontWeight={700}>{exact([sets[0], sets[1]])}</text> : null}
    {sets.length === 3 && layout.triple ? <><text x={layout.pairs[1][0]} y={layout.pairs[1][1]} textAnchor="middle" fill={TEXT} fontSize={settings.tickSize} fontWeight={700}>{exact([sets[0], sets[2]])}</text><text x={layout.pairs[2][0]} y={layout.pairs[2][1]} textAnchor="middle" fill={TEXT} fontSize={settings.tickSize} fontWeight={700}>{exact([sets[1], sets[2]])}</text><text x={layout.triple[0]} y={layout.triple[1]} textAnchor="middle" fill={TEXT} fontSize={settings.axisLabelSize} fontWeight={700}>{exact(sets)}</text></> : null}
  </g>;
}

function UpSetPlot({ frame, dataset, mapping, settings, colors }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[] }) {
  const membership = buildSetMemberships(dataset.rows, mapping.item, mapping.set);
  const intersections = membership.intersections.slice(0, Math.min(10, Math.floor(frame.plotWidth / 38)));
  const max = Math.max(...intersections.map((entry) => entry.size), 1);
  const layout = upsetVerticalLayout(frame.top, frame.plotHeight, membership.sets.length);
  const band = frame.plotWidth / Math.max(1, intersections.length);
  return <g>
    <line x1={frame.left} x2={frame.left + frame.plotWidth} y1={layout.baseline} y2={layout.baseline} stroke={TEXT} strokeWidth={settings.axisLineWidth} />
    {intersections.map((entry, index) => { const height = entry.size / max * layout.barHeight; const x = frame.left + band * (index + 0.5); return <g key={entry.sets.join("|")}><rect x={x - band * 0.28} y={layout.baseline - height} width={band * 0.56} height={height} fill={colors[0]} fillOpacity={settings.opacity} /><text x={x} y={layout.baseline - height - 7} textAnchor="middle" fill={TEXT} fontSize={settings.tickSize}>{entry.size}</text>{membership.sets.map((set, setIndex) => <circle key={set} cx={x} cy={layout.matrixTop + setIndex * layout.rowGap} r={4.5} fill={entry.sets.includes(set) ? colors[1] ?? colors[0] : "#D5D6D8"} />)}{entry.sets.length > 1 ? <line x1={x} x2={x} y1={layout.matrixTop + Math.min(...entry.sets.map((set) => membership.sets.indexOf(set))) * layout.rowGap} y2={layout.matrixTop + Math.max(...entry.sets.map((set) => membership.sets.indexOf(set))) * layout.rowGap} stroke={colors[1] ?? colors[0]} strokeWidth={2} /> : null}</g>; })}
    {membership.sets.map((set, index) => <text key={set} x={frame.left - 8} y={layout.matrixTop + index * layout.rowGap + settings.tickSize * 0.34} textAnchor="end" fill={TEXT} fontSize={settings.tickSize}>{set.slice(0, 16)}</text>)}
    <text x={frame.left} y={frame.top + settings.axisLabelSize} fill={TEXT} fontSize={settings.axisLabelSize} fontWeight={700}>Intersection size</text>
  </g>;
}

function SankeyPlot({ frame, dataset, mapping, settings, colors }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[] }) {
  const edges = dataset.rows.map((row) => ({ source: row[mapping.source], target: row[mapping.target], value: Math.max(0, parseNumericValue(row[mapping.value]) ?? 0) }));
  const sources = [...new Set(edges.map((edge) => edge.source))];
  const targets = [...new Set(edges.map((edge) => edge.target))];
  const nodes = [...new Set([...sources, ...targets])];
  const colorMap = palette(nodes, colors);
  const sourceTotals = new Map(sources.map((source) => [source, edges.filter((edge) => edge.source === source).reduce((sum, edge) => sum + edge.value, 0)]));
  const targetTotals = new Map(targets.map((target) => [target, edges.filter((edge) => edge.target === target).reduce((sum, edge) => sum + edge.value, 0)]));
  const maximumTotal = Math.max(...sourceTotals.values(), ...targetTotals.values(), 1);
  const sourceY = new Map(sources.map((source, index) => [source, frame.top + frame.plotHeight * (index + 0.5) / sources.length]));
  const targetY = new Map(targets.map((target, index) => [target, frame.top + frame.plotHeight * (index + 0.5) / targets.length]));
  const left = frame.left + frame.plotWidth * 0.08;
  const right = frame.left + frame.plotWidth * 0.92;
  return <g>
    {edges.map((edge, index) => { const sy = sourceY.get(edge.source) ?? 0; const ty = targetY.get(edge.target) ?? 0; const width = Math.max(1, edge.value / maximumTotal * 32); return <path key={index} d={`M ${left + 10} ${sy} C ${left + frame.plotWidth * 0.35} ${sy}, ${right - frame.plotWidth * 0.35} ${ty}, ${right - 10} ${ty}`} fill="none" stroke={colorMap.get(edge.source)} strokeWidth={width} strokeOpacity={settings.opacity * 0.5} />; })}
    {sources.map((source) => { const y = sourceY.get(source) ?? 0; const h = Math.max(12, (sourceTotals.get(source) ?? 0) / maximumTotal * 40); return <g key={source}><rect x={left} y={y - h / 2} width={10} height={h} rx={2} fill={colorMap.get(source)} /><text x={left - 7} y={y + 4} textAnchor="end" fill={TEXT} fontSize={settings.tickSize}>{source.slice(0, 15)}</text></g>; })}
    {targets.map((target) => { const y = targetY.get(target) ?? 0; const h = Math.max(12, (targetTotals.get(target) ?? 0) / maximumTotal * 40); return <g key={target}><rect x={right - 10} y={y - h / 2} width={10} height={h} rx={2} fill={colorMap.get(target)} /><text x={right + 7} y={y + 4} fill={TEXT} fontSize={settings.tickSize}>{target.slice(0, 15)}</text></g>; })}
  </g>;
}

function polar(cx: number, cy: number, radius: number, angle: number) { return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius] as const; }
function arcPath(cx: number, cy: number, radius: number, start: number, end: number) { const a = polar(cx, cy, radius, start); const b = polar(cx, cy, radius, end); return `M ${a[0]} ${a[1]} A ${radius} ${radius} 0 ${end - start > Math.PI ? 1 : 0} 1 ${b[0]} ${b[1]}`; }

function ChordPlot({ frame, dataset, mapping, settings, colors }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[] }) {
  const edges = dataset.rows.map((row) => ({ source: row[mapping.source], target: row[mapping.target], value: Math.max(0, parseNumericValue(row[mapping.value]) ?? 0) }));
  const nodes = [...new Set(edges.flatMap((edge) => [edge.source, edge.target]))];
  const colorMap = palette(nodes, colors);
  const cx = frame.left + frame.plotWidth / 2; const cy = frame.top + frame.plotHeight / 2; const radius = Math.min(frame.plotWidth, frame.plotHeight) * 0.39;
  const angle = new Map(nodes.map((node, index) => [node, -Math.PI / 2 + index * Math.PI * 2 / nodes.length]));
  const maxValue = Math.max(...edges.map((edge) => edge.value), 1);
  return <g>
    {nodes.map((node) => { const center = angle.get(node) ?? 0; const start = center - Math.PI * 0.8 / nodes.length; const end = center + Math.PI * 0.8 / nodes.length; const label = polar(cx, cy, radius + 20, center); return <g key={node}><path d={arcPath(cx, cy, radius, start, end)} fill="none" stroke={colorMap.get(node)} strokeWidth={12} /><text x={label[0]} y={label[1] + 4} textAnchor={Math.cos(center) > 0.15 ? "start" : Math.cos(center) < -0.15 ? "end" : "middle"} fill={TEXT} fontSize={settings.tickSize}>{node.slice(0, 14)}</text></g>; })}
    {edges.map((edge, index) => { const source = polar(cx, cy, radius - 7, angle.get(edge.source) ?? 0); const target = polar(cx, cy, radius - 7, angle.get(edge.target) ?? 0); return <path key={index} d={`M ${source[0]} ${source[1]} Q ${cx} ${cy} ${target[0]} ${target[1]}`} fill="none" stroke={colorMap.get(edge.source)} strokeOpacity={settings.opacity * 0.55} strokeWidth={1 + edge.value / maxValue * 8} />; })}
  </g>;
}

function CircosPlot({ frame, dataset, mapping, settings, colors }: { frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[] }) {
  const links = dataset.rows.map((row) => ({ sourceChr: row[mapping.sourceChr], sourceStart: parseNumericValue(row[mapping.sourceStart]) ?? 0, sourceEnd: parseNumericValue(row[mapping.sourceEnd]) ?? 0, targetChr: row[mapping.targetChr], targetStart: parseNumericValue(row[mapping.targetStart]) ?? 0, targetEnd: parseNumericValue(row[mapping.targetEnd]) ?? 0, value: Math.max(0, parseNumericValue(row[mapping.value]) ?? 1) }));
  const chromosomes = [...new Set(links.flatMap((link) => [link.sourceChr, link.targetChr]))];
  const lengths = new Map(chromosomes.map((chromosome) => [chromosome, Math.max(1, ...links.flatMap((link) => [link.sourceChr === chromosome ? link.sourceEnd : 0, link.targetChr === chromosome ? link.targetEnd : 0]))]));
  const total = [...lengths.values()].reduce((sum, value) => sum + value, 0);
  const gap = 0.045;
  let cursor = -Math.PI / 2;
  const sectors = new Map<string, { start: number; end: number }>();
  chromosomes.forEach((chromosome) => { const span = (Math.PI * 2 - gap * chromosomes.length) * (lengths.get(chromosome) ?? 1) / total; sectors.set(chromosome, { start: cursor, end: cursor + span }); cursor += span + gap; });
  const cx = frame.left + frame.plotWidth / 2; const cy = frame.top + frame.plotHeight / 2; const radius = Math.min(frame.plotWidth, frame.plotHeight) * 0.39;
  const colorMap = palette(chromosomes, colors); const maxValue = Math.max(...links.map((link) => link.value), 1);
  const coordinateAngle = (chromosome: string, position: number) => { const sector = sectors.get(chromosome)!; return sector.start + (sector.end - sector.start) * position / (lengths.get(chromosome) ?? 1); };
  return <g>
    {chromosomes.map((chromosome) => { const sector = sectors.get(chromosome)!; const mid = (sector.start + sector.end) / 2; const label = polar(cx, cy, radius + 20, mid); return <g key={chromosome}><path d={arcPath(cx, cy, radius, sector.start, sector.end)} fill="none" stroke={colorMap.get(chromosome)} strokeWidth={14} /><path d={arcPath(cx, cy, radius - 20, sector.start, sector.end)} fill="none" stroke={colorMap.get(chromosome)} strokeOpacity={0.35} strokeWidth={5} /><text x={label[0]} y={label[1] + 4} textAnchor={Math.cos(mid) > 0.15 ? "start" : Math.cos(mid) < -0.15 ? "end" : "middle"} fill={TEXT} fontSize={settings.tickSize} fontWeight={700}>{chromosome}</text></g>; })}
    {links.map((link, index) => { const sourceAngle = coordinateAngle(link.sourceChr, (link.sourceStart + link.sourceEnd) / 2); const targetAngle = coordinateAngle(link.targetChr, (link.targetStart + link.targetEnd) / 2); const source = polar(cx, cy, radius - 23, sourceAngle); const target = polar(cx, cy, radius - 23, targetAngle); return <path key={index} d={`M ${source[0]} ${source[1]} Q ${cx} ${cy} ${target[0]} ${target[1]}`} fill="none" stroke={colorMap.get(link.sourceChr)} strokeWidth={1 + link.value / maxValue * 7} strokeOpacity={settings.opacity * 0.55} />; })}
  </g>;
}

export function ScientificAdvancedChartPreview({ svgRef, type, dataset, mapping, settings, themeId }: Props) {
  const theme = journalThemes[themeId];
  const definition = getPlotDefinition(type);
  const frame = frameFor(type, settings);
  const colors = settings.categoricalColors.length > 0 ? settings.categoricalColors : theme.categorical;
  const sequential: [string, string] = [settings.continuousLow, settings.continuousHigh];
  const diverging: [string, string, string] = [settings.divergingLow, settings.divergingMid, settings.divergingHigh];
  let content: ReactNode = null;
  if (["correlation", "quadrant", "pcoa", "umap"].includes(type)) content = <ScatterFamily type={type} frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} gridColor={theme.grid} />;
  else if (type === "ma") content = <MaPlot frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} gridColor={theme.grid} />;
  else if (type === "errorbar") content = <ErrorBarPlot frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} gridColor={theme.grid} />;
  else if (type === "area") content = <AreaPlot frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} gridColor={theme.grid} />;
  else if (type === "lollipop") content = <LollipopPlot frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} gridColor={theme.grid} />;
  else if (type === "beeswarm" || type === "raincloud") content = <DistributionPlot type={type} frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} gridColor={theme.grid} />;
  else if (type === "clustered-heatmap" || type === "correlation-heatmap") content = <MatrixPlot type={type} frame={frame} dataset={dataset} settings={settings} diverging={diverging} />;
  else if (type === "enrichment-bar") content = <EnrichmentBar frame={frame} dataset={dataset} mapping={mapping} settings={settings} sequential={sequential} gridColor={theme.grid} />;
  else if (type === "gsea") content = <GseaPlot frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} gridColor={theme.grid} />;
  else if (type === "km") content = <KmPlot frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} gridColor={theme.grid} />;
  else if (type === "survival-forest") content = <ForestPlot frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} gridColor={theme.grid} />;
  else if (type === "roc") content = <RocPlot frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} gridColor={theme.grid} />;
  else if (type === "venn") content = <VennPlot frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} />;
  else if (type === "upset") content = <UpSetPlot frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} />;
  else if (type === "sankey") content = <SankeyPlot frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} />;
  else if (type === "chord") content = <ChordPlot frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} />;
  else if (type === "circos") content = <CircosPlot frame={frame} dataset={dataset} mapping={mapping} settings={settings} colors={colors} />;
  return <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${frame.width} ${frame.height}`} width={frame.width} height={frame.height} role="img" data-chart-text-color={TEXT} aria-label={`${definition.name} scientific figure preview`} style={{ fontFamily: figureFontPresets[settings.fontFamily].family, background: "white", maxWidth: "100%", height: "auto" }}>
    <title>{settings.title || `${definition.name} figure`}</title><desc>{definition.summary} Generated in LabNest Visualization Studio.</desc><rect width={frame.width} height={frame.height} fill="#FFFFFF" />
    {settings.title ? <text x={frame.left} y={24} fill={TEXT} fontSize={settings.titleSize} fontWeight={700}>{settings.title}</text> : null}
    {content}
  </svg>;
}
