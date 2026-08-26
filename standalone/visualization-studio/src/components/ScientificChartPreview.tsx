"use client";

import type { ReactNode, RefObject } from "react";
import { ScientificAdvancedChartPreview } from "@/components/ScientificAdvancedChartPreview";
import {
  boxStatistics,
  divergingColor,
  formatTick,
  figureFontPresets,
  getPlotDefinition,
  getPlotModule,
  groupNumericValues,
  interpolateColor,
  journalThemes,
  kernelDensityEstimate,
  linearRegression,
  meanErrorStatistics,
  numericExtent,
  parseNumericValue,
  parseRatioValue,
  resolveAxisDomain,
  scaleLinear,
  type JournalThemeId,
  type ParsedDataset,
  type PlotType,
  type VisualizationSettings,
} from "@/lib/visualization-studio";

type ChartProps = {
  svgRef: RefObject<SVGSVGElement | null>;
  type: PlotType;
  dataset: ParsedDataset;
  mapping: Record<string, string>;
  settings: VisualizationSettings;
  themeId: JournalThemeId;
};

type PlotFrame = {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  plotWidth: number;
  plotHeight: number;
};

const CHART_TEXT_COLOR = "#23242A";

type LegendItem = { label: string; color: string; shape?: "circle" | "line" | "square" };

function getFrame(settings: VisualizationSettings, type: PlotType): PlotFrame {
  const titleOffset = settings.title ? 24 : 0;
  const supportsLegend = type !== "box" && type !== "violin";
  const compactWidth = settings.width < 420;
  const compactHeight = settings.height < 300;
  const rightLegend = supportsLegend && settings.legendPosition === "right" ? (compactWidth ? 104 : 132) : 0;
  const bottomLegend = supportsLegend && settings.legendPosition === "bottom" ? 34 : 0;
  const left = compactWidth
    ? type === "enrichment" ? 124 : type === "heatmap" ? 90 : type === "bar" && (settings.swapAxes || ["horizontal", "bullet", "pyramid"].includes(settings.barVariant)) ? 104 : 60
    : type === "enrichment" ? 168 : type === "heatmap" ? 108 : type === "bar" && (settings.swapAxes || ["horizontal", "bullet", "pyramid"].includes(settings.barVariant)) ? 132 : 72;
  const right = (compactWidth ? 18 : 24) + rightLegend + (type === "bar" && settings.barVariant === "dual-axis" ? 38 : 0);
  const top = (compactHeight ? 20 : 24) + titleOffset;
  const bottom = (compactHeight ? 48 : 58) + bottomLegend;
  return {
    width: settings.width,
    height: settings.height,
    left,
    right,
    top,
    bottom,
    plotWidth: Math.max(80, settings.width - left - right),
    plotHeight: Math.max(80, settings.height - top - bottom),
  };
}

function ticks(domain: [number, number], count = 5) {
  return Array.from({ length: count }, (_, index) => domain[0] + ((domain[1] - domain[0]) * index) / (count - 1));
}

function ChartTitle({ frame, settings, color }: { frame: PlotFrame; settings: VisualizationSettings; color: string }) {
  if (!settings.title) return null;
  return (
    <text x={frame.left} y={22} fill={color} fontSize={settings.titleSize} fontWeight={700}>
      {settings.title}
    </text>
  );
}

function NumericAxes({
  frame,
  settings,
  xDomain,
  yDomain,
  xLabel,
  yLabel,
  ink,
  muted,
  gridColor,
  hideXTicks = false,
  hideYTicks = false,
  categoryXPositions,
  categoryYPositions,
  xTickValues,
  yTickValues,
  xScaleOverride,
  yScaleOverride,
}: {
  frame: PlotFrame;
  settings: VisualizationSettings;
  xDomain: [number, number];
  yDomain: [number, number];
  xLabel: string;
  yLabel: string;
  ink: string;
  muted: string;
  gridColor: string;
  hideXTicks?: boolean;
  hideYTicks?: boolean;
  categoryXPositions?: number[];
  categoryYPositions?: number[];
  xTickValues?: number[];
  yTickValues?: number[];
  xScaleOverride?: (value: number) => number;
  yScaleOverride?: (value: number) => number;
}) {
  const xTicks = xTickValues ?? ticks(xDomain);
  const yTicks = yTickValues ?? ticks(yDomain);
  const xBottom = frame.top + frame.plotHeight;
  const verticalGridPositions = categoryXPositions
    ?? (hideXTicks ? [] : xTicks.map((value) => xScaleOverride ? xScaleOverride(value) : scaleLinear(value, xDomain, [frame.left, frame.left + frame.plotWidth])));
  const horizontalGridPositions = categoryYPositions
    ?? (hideYTicks ? [] : yTicks.map((value) => yScaleOverride ? yScaleOverride(value) : scaleLinear(value, yDomain, [xBottom, frame.top])));
  return (
    <g>
      {settings.grid === "both"
        ? verticalGridPositions.map((x) => (
            <line key={`gx-${x}`} data-grid-axis="x" x1={x} x2={x} y1={frame.top} y2={xBottom} stroke={gridColor} strokeWidth={settings.gridLineWidth} />
          ))
        : null}
      {settings.grid !== "none"
        ? horizontalGridPositions.map((y) => (
            <line key={`gy-${y}`} data-grid-axis="y" x1={frame.left} x2={frame.left + frame.plotWidth} y1={y} y2={y} stroke={gridColor} strokeWidth={settings.gridLineWidth} />
          ))
        : null}
      <line x1={frame.left} x2={frame.left + frame.plotWidth} y1={xBottom} y2={xBottom} stroke={ink} strokeWidth={settings.axisLineWidth} />
      <line x1={frame.left} x2={frame.left} y1={frame.top} y2={xBottom} stroke={ink} strokeWidth={settings.axisLineWidth} />
      {!hideXTicks ? xTicks.map((value) => {
        const x = xScaleOverride ? xScaleOverride(value) : scaleLinear(value, xDomain, [frame.left, frame.left + frame.plotWidth]);
        return (
          <g key={`xt-${value}`}>
            <line x1={x} x2={x} y1={xBottom} y2={xBottom + 5} stroke={ink} strokeWidth={settings.axisLineWidth} />
            <text x={x} y={xBottom + 19} textAnchor="middle" fill={muted} fontSize={settings.tickSize}>{formatTick(value)}</text>
          </g>
        );
      }) : null}
      {!hideYTicks ? yTicks.map((value) => {
        const y = yScaleOverride ? yScaleOverride(value) : scaleLinear(value, yDomain, [xBottom, frame.top]);
        return (
          <g key={`yt-${value}`}>
            <line x1={frame.left - 5} x2={frame.left} y1={y} y2={y} stroke={ink} strokeWidth={settings.axisLineWidth} />
            <text x={frame.left - 9} y={y + settings.tickSize * 0.34} textAnchor="end" fill={muted} fontSize={settings.tickSize}>{formatTick(value)}</text>
          </g>
        );
      }) : null}
      <text x={frame.left + frame.plotWidth / 2} y={frame.height - (settings.legendPosition === "bottom" ? 57 : 13)} textAnchor="middle" fill={ink} fontSize={settings.axisLabelSize} fontWeight={600}>{xLabel}</text>
      <text transform={`translate(18 ${frame.top + frame.plotHeight / 2}) rotate(-90)`} textAnchor="middle" fill={ink} fontSize={settings.axisLabelSize} fontWeight={600}>{yLabel}</text>
    </g>
  );
}

function Legend({ frame, settings, items, ink }: { frame: PlotFrame; settings: VisualizationSettings; items: LegendItem[]; ink: string }) {
  if (settings.legendPosition === "none" || items.length === 0) return null;
  if (settings.legendPosition === "bottom") {
    const available = frame.width - frame.left - 20;
    const columns = Math.min(items.length, Math.max(1, Math.floor(available / 112)));
    const rows = Math.ceil(items.length / columns);
    const itemWidth = available / columns;
    const rowHeight = settings.legendSize + 7;
    const labelLimit = Math.max(8, Math.min(24, Math.floor((itemWidth - 15) / Math.max(5.5, settings.legendSize * .55))));
    return (
      <g transform={`translate(${frame.left} ${frame.height - 22 - (rows - 1) * rowHeight})`}>
        {items.map((item, index) => (
          <g key={item.label} transform={`translate(${(index % columns) * itemWidth} ${Math.floor(index / columns) * rowHeight})`}>
            <LegendMark item={item} y={-4} />
            <text x={13} y={0} fill={ink} fontSize={settings.legendSize}>{truncate(item.label, labelLimit)}</text>
          </g>
        ))}
      </g>
    );
  }
  return (
    <g transform={`translate(${frame.left + frame.plotWidth + 20} ${frame.top + 4})`}>
      {items.slice(0, 12).map((item, index) => (
        <g key={item.label} transform={`translate(0 ${index * (settings.legendSize + 10)})`}>
          <LegendMark item={item} y={-4} />
          <text x={15} y={0} fill={ink} fontSize={settings.legendSize}>{truncate(item.label, 17)}</text>
        </g>
      ))}
    </g>
  );
}

function LegendMark({ item, y }: { item: LegendItem; y: number }) {
  if (item.shape === "line") return <line x1={0} x2={10} y1={y} y2={y} stroke={item.color} strokeWidth={2.4} />;
  if (item.shape === "square") return <rect x={0} y={y - 5} width={10} height={10} rx={1.5} fill={item.color} />;
  return <circle cx={5} cy={y} r={4.5} fill={item.color} />;
}

function truncate(value: string, length: number) {
  return value.length <= length ? value : `${value.slice(0, length - 1)}…`;
}

function paletteForGroups(groups: string[], colors: string[]) {
  return new Map(groups.map((group, index) => [group, colors[index % colors.length]]));
}

function barIntervalAwayFromAxis(valuePosition: number, baseline: number, axisLineWidth: number) {
  const clearance = Math.max(1, axisLineWidth / 2 + 0.5);
  const direction = valuePosition < baseline ? -1 : 1;
  const axisEdge = baseline + direction * clearance;
  const length = Math.abs(valuePosition - axisEdge);
  if (length <= 0.2) return null;
  const start = Math.min(valuePosition, axisEdge);
  return { start, length: Math.max(0.8, length) };
}

function renderBar(
  frame: PlotFrame,
  dataset: ParsedDataset,
  mapping: Record<string, string>,
  settings: VisualizationSettings,
  colors: string[],
  ink: string,
  muted: string,
  gridColor: string,
) {
  type BarDatum = { category: string; value: number; error: number; group: string; facet: string; secondary: number | null; target: number | null; pValue: number | null };
  const rawRows: BarDatum[] = dataset.rows.map((row) => ({
    category: row[mapping.category], value: parseNumericValue(row[mapping.value]) ?? 0,
    error: settings.barErrorType !== "none" && mapping.error ? Math.max(0, parseNumericValue(row[mapping.error]) ?? 0) : 0,
    group: mapping.group ? row[mapping.group] || "Value" : "Value", facet: mapping.facet ? row[mapping.facet] || "All" : "All",
    secondary: mapping.secondary ? parseNumericValue(row[mapping.secondary]) : null,
    target: mapping.target ? parseNumericValue(row[mapping.target]) : null,
    pValue: mapping.pValue ? parseNumericValue(row[mapping.pValue]) : null,
  }));
  const rows = settings.barInputMode === "summary" ? rawRows : [...rawRows.reduce((buckets, row) => {
    const key = `${row.category}\u0000${row.group}\u0000${row.facet}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(row); buckets.set(key, bucket); return buckets;
  }, new Map<string, BarDatum[]>())].map(([, values]) => {
    const mean = values.reduce((sum, row) => sum + row.value, 0) / values.length;
    const variance = values.length > 1 ? values.reduce((sum, row) => sum + (row.value - mean) ** 2, 0) / (values.length - 1) : 0;
    const sd = Math.sqrt(variance);
    const meanOptional = (key: "secondary" | "target") => {
      const numeric = values.flatMap((row) => row[key] === null ? [] : [row[key] as number]);
      return numeric.length ? numeric.reduce((sum, value) => sum + value, 0) / numeric.length : null;
    };
    return { ...values[0], value: mean, secondary: meanOptional("secondary"), target: meanOptional("target"), error: settings.barErrorType === "sd" ? sd : settings.barErrorType === "sem" ? sd / Math.sqrt(values.length) : 0 };
  });
  const categoryKey = (row: BarDatum) => settings.barVariant === "faceted" ? `${row.facet}\u0000${row.category}` : row.category;
  const categories = [...new Set(rows.map(categoryKey))];
  const groups = [...new Set(rows.map((row) => row.group))];
  const facets = [...new Set(rows.map((row) => row.facet))];
  const colorMap = paletteForGroups(groups, colors);
  const stacked = settings.barVariant === "stacked" || settings.barVariant === "percentage";
  const isHorizontal = settings.swapAxes || ["horizontal", "bullet", "pyramid"].includes(settings.barVariant);
  const valueFor = (row: BarDatum) => settings.barVariant === "pyramid"
    ? (groups.indexOf(row.group) < Math.ceil(groups.length / 2) ? -Math.abs(row.value) : Math.abs(row.value))
    : row.value;
  const stackExtents = categories.flatMap((category) => {
    const matching = rows.filter((row) => categoryKey(row) === category);
    return [matching.filter((row) => valueFor(row) < 0).reduce((sum, row) => sum + valueFor(row), 0), matching.filter((row) => valueFor(row) >= 0).reduce((sum, row) => sum + valueFor(row), 0)];
  });
  const automaticValues = stacked ? stackExtents : rows.flatMap((row) => {
    const values = [valueFor(row) - row.error, valueFor(row) + row.error];
    if (settings.barVariant === "overlay" && row.secondary !== null) values.push(row.secondary);
    if (settings.barVariant === "bullet" && row.target !== null) values.push(row.target);
    return values;
  });
  const automaticDomain = settings.barVariant === "percentage" ? [0, 100] as [number, number] : numericExtent(automaticValues, true);
  const domain = isHorizontal
    ? resolveAxisDomain(automaticDomain, settings.xMin, settings.xMax)
    : resolveAxisDomain(automaticDomain, settings.yMin, settings.yMax);
  const band = (isHorizontal ? frame.plotHeight : frame.plotWidth) / Math.max(1, categories.length);
  const categoryPositions = categories.map((_, index) => isHorizontal ? frame.top + band * (index + 0.5) : frame.left + band * (index + 0.5));
  const linearValueScale = isHorizontal
    ? (value: number) => scaleLinear(value, domain, [frame.left, frame.left + frame.plotWidth])
    : (value: number) => scaleLinear(value, domain, [frame.top + frame.plotHeight, frame.top]);
  const hasAxisBreak = settings.barVariant === "axis-break" && domain[0] < settings.axisBreakStart && settings.axisBreakEnd < domain[1];
  const valueScale = (value: number) => {
    if (!hasAxisBreak) return linearValueScale(value);
    const rangeStart = isHorizontal ? frame.left : frame.top + frame.plotHeight;
    const rangeEnd = isHorizontal ? frame.left + frame.plotWidth : frame.top;
    const direction = rangeEnd >= rangeStart ? 1 : -1;
    const totalPixels = Math.abs(rangeEnd - rangeStart); const gap = 12; const segmentPixels = (totalPixels - gap) / 2;
    if (value <= settings.axisBreakStart) return rangeStart + direction * scaleLinear(value, [domain[0], settings.axisBreakStart], [0, segmentPixels]);
    if (value >= settings.axisBreakEnd) return rangeStart + direction * (segmentPixels + gap + scaleLinear(value, [settings.axisBreakEnd, domain[1]], [0, segmentPixels]));
    return rangeStart + direction * (segmentPixels + gap / 2);
  };
  const breakTicks = hasAxisBreak ? [domain[0], settings.axisBreakStart, settings.axisBreakEnd, domain[1]] : undefined;
  const categoryLabel = (isHorizontal ? settings.yLabel : settings.xLabel).trim();
  const valueLabel = (isHorizontal ? settings.xLabel : settings.yLabel).trim();
  const numericAxes = isHorizontal ? (
    <NumericAxes frame={frame} settings={settings} xDomain={domain} yDomain={[0, categories.length]} xLabel={valueLabel} yLabel={categoryLabel} ink={ink} muted={muted} gridColor={gridColor} hideYTicks categoryYPositions={categoryPositions} xTickValues={breakTicks} xScaleOverride={hasAxisBreak ? valueScale : undefined} />
  ) : (
    <NumericAxes frame={frame} settings={settings} xDomain={[0, categories.length]} yDomain={domain} xLabel={categoryLabel} yLabel={valueLabel} ink={ink} muted={muted} gridColor={gridColor} hideXTicks categoryXPositions={categoryPositions} yTickValues={breakTicks} yScaleOverride={hasAxisBreak ? valueScale : undefined} />
  );

  if (settings.barVariant === "polar") {
    const cx = frame.left + frame.plotWidth / 2; const cy = frame.top + frame.plotHeight / 2;
    const inner = 24; const outer = Math.max(inner + 10, Math.min(frame.plotWidth, frame.plotHeight) / 2 - 28);
    const max = Math.max(...rows.map((row) => Math.abs(row.value)), 1);
    const step = Math.PI * 2 / Math.max(1, rows.length); const gap = Math.min(step * settings.barGap, 0.18);
    const arc = (radius: number, start: number, end: number) => { const p1 = [cx + Math.cos(start) * radius, cy + Math.sin(start) * radius]; const p2 = [cx + Math.cos(end) * radius, cy + Math.sin(end) * radius]; return `M ${p1[0]} ${p1[1]} A ${radius} ${radius} 0 ${end - start > Math.PI ? 1 : 0} 1 ${p2[0]} ${p2[1]}`; };
    return <><circle cx={cx} cy={cy} r={inner} fill="white" stroke={gridColor} />{rows.map((row, index) => { const radius = inner + Math.abs(row.value) / max * (outer - inner); const start = -Math.PI / 2 + index * step + gap; const end = -Math.PI / 2 + (index + 1) * step - gap; const angle = (start + end) / 2; return <g key={`${row.category}-${index}`} data-plot-data><path data-plot-element="bar" d={arc(radius, start, end)} fill="none" stroke={colorMap.get(row.group) ?? colors[0]} strokeWidth={Math.max(7, (outer - inner) * 0.16)} strokeOpacity={settings.opacity} /><text x={cx + Math.cos(angle) * (outer + 13)} y={cy + Math.sin(angle) * (outer + 13) + 3} textAnchor={Math.cos(angle) > .2 ? "start" : Math.cos(angle) < -.2 ? "end" : "middle"} fill={muted} fontSize={settings.tickSize}>{truncate(row.category, 11)}</text></g>; })}<Legend frame={frame} settings={settings} ink={ink} items={groups.map((group) => ({ label: group, color: colorMap.get(group) ?? colors[0], shape: "square" }))} /></>;
  }

  const starFor = (p: number | null) => p === null || p > settings.significanceThreshold ? "" : p <= .001 ? "***" : p <= .01 ? "**" : "*";
  const groupBand = band * (1 - settings.barGap);
  const maximumGroupsPerCategory = Math.max(1, ...categories.map((category) => new Set(rows.filter((row) => categoryKey(row) === category).map((row) => row.group)).size));
  const usesGroupedSlots = maximumGroupsPerCategory > 1;
  const subgroupBand = stacked ? groupBand : groupBand / (usesGroupedSlots ? Math.max(1, groups.length) : 1);
  const stackOffsets = new Map<string, { positive: number; negative: number }>();
  const marks = rows.map((row, index) => {
    const categoryIndex = categories.indexOf(categoryKey(row));
    const groupIndex = usesGroupedSlots ? groups.indexOf(row.group) : 0;
    const stack = stackOffsets.get(categoryKey(row)) ?? { positive: 0, negative: 0 };
    let displayValue = valueFor(row); let from = 0;
    if (settings.barVariant === "percentage") { const total = rows.filter((item) => categoryKey(item) === categoryKey(row)).reduce((sum, item) => sum + Math.abs(valueFor(item)), 0) || 1; displayValue = Math.abs(displayValue) / total * 100; }
    if (stacked) { from = displayValue >= 0 ? stack.positive : stack.negative; if (displayValue >= 0) stack.positive += displayValue; else stack.negative += displayValue; stackOffsets.set(categoryKey(row), stack); }
    const to = from + displayValue; const color = colorMap.get(row.group) ?? colors[0];
    const categoryStart = (isHorizontal ? frame.top : frame.left) + categoryIndex * band + band * settings.barGap / 2;
    const cross = categoryStart + (stacked ? 0 : groupIndex * subgroupBand); const thickness = stacked ? groupBand : subgroupBand;
    const primaryScale = valueScale;
    const a = primaryScale(from); const b = primaryScale(to);
    const axisSafeInterval = from === 0 ? barIntervalAwayFromAxis(b, a, settings.axisLineWidth) : { start: Math.min(a, b), length: Math.abs(b - a) };
    const start = axisSafeInterval?.start ?? Math.min(a, b); const length = axisSafeInterval?.length ?? 0;
    const center = cross + thickness / 2; const errorA = primaryScale(displayValue - row.error); const errorB = primaryScale(displayValue + row.error); const cap = Math.min(settings.errorBarCapSize / 2, thickness * .35);
    const star = settings.showSignificance ? starFor(row.pValue) : "";
    return <g key={`${row.category}-${row.group}-${index}`} data-plot-data data-facet={row.facet}>
      <rect data-plot-element="bar" data-value={displayValue} x={isHorizontal ? start : cross} y={isHorizontal ? cross : start} width={isHorizontal ? Math.max(.8, length) : thickness} height={isHorizontal ? thickness : Math.max(.8, length)} rx={settings.barVariant === "bullet" ? 0 : 1.5} fill={color} fillOpacity={settings.opacity} stroke={settings.barBorderWidth > 0 ? settings.barBorderColor : "none"} strokeWidth={settings.barBorderWidth} />
      {settings.barVariant === "bullet" && row.target !== null ? <line data-plot-element="target" x1={primaryScale(row.target)} x2={primaryScale(row.target)} y1={cross - 2} y2={cross + thickness + 2} stroke={ink} strokeWidth={Math.max(2, settings.dataLineWidth)} /> : null}
      {!stacked && settings.barErrorType !== "none" ? <g data-plot-element="error-bar" stroke={ink} strokeWidth={settings.errorBarLineWidth} strokeLinecap="round">{isHorizontal ? <><line x1={errorA} x2={errorB} y1={center} y2={center} /><line x1={errorA} x2={errorA} y1={center-cap} y2={center+cap} /><line x1={errorB} x2={errorB} y1={center-cap} y2={center+cap} /></> : <><line x1={center} x2={center} y1={errorA} y2={errorB} /><line x1={center-cap} x2={center+cap} y1={errorA} y2={errorA} /><line x1={center-cap} x2={center+cap} y1={errorB} y2={errorB} /></>}</g> : null}
      {star ? <text data-plot-label x={isHorizontal ? Math.min(frame.left + frame.plotWidth - 4, b + 6) : center} y={isHorizontal ? center + settings.tickSize / 3 : Math.max(frame.top + settings.tickSize, b - 5)} textAnchor={isHorizontal ? "start" : "middle"} fill={ink} fontSize={settings.tickSize} fontWeight={700}>{star}</text> : null}
    </g>;
  });

  const secondaryRows = rows.filter((row) => row.secondary !== null);
  const secondaryDomain = numericExtent(secondaryRows.map((row) => row.secondary ?? 0), true);
  const secondaryScaleDomain = settings.barVariant === "dual-axis" ? secondaryDomain : domain;
  const secondaryMarks = ["dual-axis", "overlay"].includes(settings.barVariant) ? groups.flatMap((group) => {
    const seriesRows = secondaryRows.filter((row) => row.group === group).sort((a, b) => categories.indexOf(categoryKey(a)) - categories.indexOf(categoryKey(b)));
    const color = colorMap.get(group) ?? ink;
    return seriesRows.map((row, index) => {
      const categoryIndex = categories.indexOf(categoryKey(row)); const x = frame.left + band * (categoryIndex + .5);
      const y = scaleLinear(row.secondary ?? 0, secondaryScaleDomain, [frame.top + frame.plotHeight, frame.top]);
      const previous = index > 0 ? seriesRows[index - 1] : null; const px = previous ? frame.left + band * (categories.indexOf(categoryKey(previous)) + .5) : x; const py = previous ? scaleLinear(previous.secondary ?? 0, secondaryScaleDomain, [frame.top + frame.plotHeight, frame.top]) : y;
      return <g key={`secondary-${group}-${index}`} data-plot-data>{settings.barOverlayType === "line" && previous ? <line x1={px} y1={py} x2={x} y2={y} stroke={color} strokeWidth={settings.dataLineWidth} /> : null}<circle cx={x} cy={y} r={settings.pointSize} fill="white" stroke={color} strokeWidth={settings.dataLineWidth} /></g>;
    });
  }) : null;

  return (
    <>
      {numericAxes}
      <g clipPath="url(#plot-area-bar)">{marks}{secondaryMarks}</g>
      {categories.map((category, index) => { const label = category.includes("\u0000") ? category.split("\u0000")[1] : category; return isHorizontal ? <text key={category} x={frame.left - 9} y={frame.top + band * (index + .5) + settings.tickSize / 3} textAnchor="end" fill={muted} fontSize={settings.tickSize}>{truncate(label, 18)}</text> : <text key={category} transform={`translate(${frame.left + band * (index + .5)} ${frame.top + frame.plotHeight + 10}) rotate(-30)`} textAnchor="end" fill={muted} fontSize={settings.tickSize}>{truncate(label, 16)}</text>; })}
      {hasAxisBreak ? isHorizontal ? <g><rect x={valueScale((settings.axisBreakStart+settings.axisBreakEnd)/2)-6} y={frame.top} width={12} height={frame.plotHeight} fill="white" /><path d={`M ${valueScale((settings.axisBreakStart+settings.axisBreakEnd)/2)-4} ${frame.top+frame.plotHeight+4} l 8 -8 m -8 0 l 8 8`} fill="none" stroke={ink} strokeWidth={settings.axisLineWidth} /></g> : <g><rect x={frame.left} y={valueScale((settings.axisBreakStart+settings.axisBreakEnd)/2)-6} width={frame.plotWidth} height={12} fill="white" /><path d={`M ${frame.left-4} ${valueScale((settings.axisBreakStart+settings.axisBreakEnd)/2)-4} l 8 8 m -8 0 l 8 -8`} fill="none" stroke={ink} strokeWidth={settings.axisLineWidth} /></g> : null}
      {settings.barVariant === "faceted" ? facets.map((facet) => { const indices = categories.map((key, index) => key.startsWith(`${facet}\u0000`) ? index : -1).filter((index) => index >= 0); const center = indices.length ? indices.reduce((sum, index) => sum + frame.left + band * (index + .5), 0) / indices.length : frame.left; return <text key={facet} x={center} y={frame.top + settings.tickSize} textAnchor="middle" fill={ink} fontSize={settings.tickSize} fontWeight={700}>{facet}</text>; }) : null}
      {settings.barVariant === "dual-axis" ? <g><line x1={frame.left+frame.plotWidth} x2={frame.left+frame.plotWidth} y1={frame.top} y2={frame.top+frame.plotHeight} stroke={ink} strokeWidth={settings.axisLineWidth} />{[0, .5, 1].map((t) => <text key={t} x={frame.left+frame.plotWidth+7} y={frame.top+frame.plotHeight*(1-t)+4} fill={muted} fontSize={settings.tickSize}>{formatTick(secondaryDomain[0]+t*(secondaryDomain[1]-secondaryDomain[0]))}</text>)}{settings.secondaryAxisLabel.trim() ? <text transform={`translate(${frame.width-10} ${frame.top+frame.plotHeight/2}) rotate(90)`} textAnchor="middle" fill={ink} fontSize={settings.axisLabelSize} fontWeight={600}>{settings.secondaryAxisLabel}</text> : null}</g> : null}
      <Legend frame={frame} settings={settings} ink={ink} items={groups.map((group) => ({ label: group, color: colorMap.get(group) ?? colors[0], shape: "square" }))} />
    </>
  );
}

function renderLineOrScatter(
  type: "line" | "scatter" | "pca",
  frame: PlotFrame,
  dataset: ParsedDataset,
  mapping: Record<string, string>,
  settings: VisualizationSettings,
  colors: string[],
  ink: string,
  muted: string,
  gridColor: string,
) {
  const lineErrorsEnabled = type === "line" && settings.lineErrorType !== "none";
  const points = dataset.rows.map((row, index) => {
    const rawX = parseNumericValue(row[mapping.x]) ?? 0;
    const rawY = parseNumericValue(row[type === "line" ? mapping.value : mapping.y]) ?? 0;
    return {
      x: settings.swapAxes ? rawY : rawX,
      y: settings.swapAxes ? rawX : rawY,
      error: lineErrorsEnabled && mapping.error ? Math.max(0, parseNumericValue(row[mapping.error]) ?? 0) : 0,
      group: row[type === "line" ? mapping.series : mapping.group] || "All",
      label: type !== "line" && mapping.label ? row[mapping.label] : "",
      index,
      order: rawX,
    };
  });
  const xDomain = resolveAxisDomain(numericExtent(lineErrorsEnabled && settings.swapAxes
    ? points.flatMap((point) => [point.x - point.error, point.x + point.error])
    : points.map((point) => point.x)), settings.xMin, settings.xMax);
  const yDomain = resolveAxisDomain(numericExtent(lineErrorsEnabled && !settings.swapAxes
    ? points.flatMap((point) => [point.y - point.error, point.y + point.error])
    : points.map((point) => point.y)), settings.yMin, settings.yMax);
  const groups = [...new Set(points.map((point) => point.group))];
  const colorMap = paletteForGroups(groups, colors);
  const xLabel = settings.swapAxes
    ? settings.yLabel || (type === "line" ? "Value" : "Y")
    : settings.xLabel || "X";
  const yLabel = settings.swapAxes
    ? settings.xLabel || "X"
    : settings.yLabel || (type === "line" ? "Value" : "Y");
  const scaled = points.map((point) => ({
    ...point,
    sx: scaleLinear(point.x, xDomain, [frame.left, frame.left + frame.plotWidth]),
    sy: scaleLinear(point.y, yDomain, [frame.top + frame.plotHeight, frame.top]),
  }));

  return (
    <>
      <NumericAxes frame={frame} settings={settings} xDomain={xDomain} yDomain={yDomain} xLabel={xLabel} yLabel={yLabel} ink={ink} muted={muted} gridColor={gridColor} />
      <g data-plot-data>
      {lineErrorsEnabled
        ? scaled.map((point) => {
            const capHalf = settings.errorBarCapSize / 2;
            const color = colorMap.get(point.group);
            if (settings.swapAxes) {
              const low = scaleLinear(point.x - point.error, xDomain, [frame.left, frame.left + frame.plotWidth]);
              const high = scaleLinear(point.x + point.error, xDomain, [frame.left, frame.left + frame.plotWidth]);
              return <g key={`line-error-${point.index}`} data-plot-element="line-error-bar" stroke={color} strokeWidth={settings.errorBarLineWidth} strokeLinecap="round"><line x1={low} x2={high} y1={point.sy} y2={point.sy} /><line x1={low} x2={low} y1={point.sy - capHalf} y2={point.sy + capHalf} /><line x1={high} x2={high} y1={point.sy - capHalf} y2={point.sy + capHalf} /></g>;
            }
            const low = scaleLinear(point.y - point.error, yDomain, [frame.top + frame.plotHeight, frame.top]);
            const high = scaleLinear(point.y + point.error, yDomain, [frame.top + frame.plotHeight, frame.top]);
            return <g key={`line-error-${point.index}`} data-plot-element="line-error-bar" stroke={color} strokeWidth={settings.errorBarLineWidth} strokeLinecap="round"><line x1={point.sx} x2={point.sx} y1={low} y2={high} /><line x1={point.sx - capHalf} x2={point.sx + capHalf} y1={low} y2={low} /><line x1={point.sx - capHalf} x2={point.sx + capHalf} y1={high} y2={high} /></g>;
          })
        : null}
      {type === "line"
        ? groups.map((group) => {
            const groupPoints = scaled.filter((point) => point.group === group).sort((a, b) => a.order - b.order);
            return (
              <polyline
                key={`line-${group}`}
                points={groupPoints.map((point) => `${point.sx},${point.sy}`).join(" ")}
                fill="none"
                stroke={colorMap.get(group)}
                strokeWidth={settings.dataLineWidth}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })
        : null}
      {type === "scatter" && settings.showTrend
        ? groups.map((group) => {
            const groupPoints = points.filter((point) => point.group === group);
            const fit = linearRegression(groupPoints);
            if (!fit) return null;
            const x1 = xDomain[0];
            const x2 = xDomain[1];
            return (
              <line
                key={`fit-${group}`}
                x1={scaleLinear(x1, xDomain, [frame.left, frame.left + frame.plotWidth])}
                x2={scaleLinear(x2, xDomain, [frame.left, frame.left + frame.plotWidth])}
                y1={scaleLinear(fit.slope * x1 + fit.intercept, yDomain, [frame.top + frame.plotHeight, frame.top])}
                y2={scaleLinear(fit.slope * x2 + fit.intercept, yDomain, [frame.top + frame.plotHeight, frame.top])}
                stroke={colorMap.get(group)}
                strokeWidth={settings.dataLineWidth}
                strokeDasharray="5 4"
                opacity={0.85}
              />
            );
          })
        : null}
      {scaled.map((point) => (
        <g key={`point-${point.index}`}>
          <circle cx={point.sx} cy={point.sy} r={settings.pointSize} fill={colorMap.get(point.group)} fillOpacity={settings.opacity} stroke="#FFFFFF" strokeWidth={0.8} />
          {settings.showLabels && point.label ? <text data-plot-label x={point.x > (xDomain[0] + xDomain[1]) / 2 ? point.sx - settings.pointSize - 2 : point.sx + settings.pointSize + 2} y={point.y > (yDomain[0] + yDomain[1]) / 2 ? point.sy + settings.tickSize + 2 + (point.index % 2) * 3 : point.sy - 3 - (point.index % 2) * 3} textAnchor={point.x > (xDomain[0] + xDomain[1]) / 2 ? "end" : "start"} fill={ink} fontSize={settings.tickSize}>{truncate(point.label, 12)}</text> : null}
        </g>
      ))}
      </g>
      <Legend frame={frame} settings={settings} ink={ink} items={groups.map((group) => ({ label: group, color: colorMap.get(group) ?? colors[0], shape: type === "line" ? "line" : "circle" }))} />
    </>
  );
}

function renderDistribution(
  type: "box" | "violin",
  frame: PlotFrame,
  dataset: ParsedDataset,
  mapping: Record<string, string>,
  settings: VisualizationSettings,
  colors: string[],
  ink: string,
  muted: string,
  gridColor: string,
) {
  const groups = groupNumericValues(dataset.rows, mapping.group, mapping.value);
  const entries = [...groups.entries()];
  const rawYDomain = numericExtent(entries.flatMap(([, values]) => values));
  const boxSummaries = new Map(entries.map(([group, values]) => [group, meanErrorStatistics(values)]));
  const boxSummaryExtent = type === "box" && settings.boxErrorType !== "none"
    ? entries.flatMap(([group]) => {
        const summary = boxSummaries.get(group);
        if (!summary) return [];
        const error = settings.boxErrorType === "sd" ? summary.sd : summary.sem;
        return [summary.mean - error, summary.mean + error];
      })
    : [];
  const rawSpan = rawYDomain[1] - rawYDomain[0];
  const densityBoundaryDomain: [number, number] = [rawYDomain[0] - rawSpan, rawYDomain[1] + rawSpan];
  const densityCurves = new Map(entries.map(([group, values]) => [group, kernelDensityEstimate(values, densityBoundaryDomain, settings.violinBandwidth).points]));
  const densitySupport = [...densityCurves.values()].flatMap((curve) => curve.map((point) => point.position));
  const automaticYDomain = type === "violin" && densitySupport.length > 0
    ? numericExtent(densitySupport)
    : numericExtent([...entries.flatMap(([, values]) => values), ...boxSummaryExtent]);
  const yDomain = resolveAxisDomain(automaticYDomain, settings.yMin, settings.yMax);
  const band = frame.plotWidth / Math.max(1, entries.length);
  const groupNames = entries.map(([group]) => group);
  const colorMap = paletteForGroups(groupNames, colors);
  const yAt = (value: number) => scaleLinear(value, yDomain, [frame.top + frame.plotHeight, frame.top]);
  const categoryPositions = entries.map((_, index) => frame.left + band * (index + 0.5));

  return (
    <>
      <NumericAxes frame={frame} settings={settings} xDomain={[0, entries.length]} yDomain={yDomain} xLabel={settings.xLabel || "Group"} yLabel={settings.yLabel || "Value"} ink={ink} muted={muted} gridColor={gridColor} hideXTicks categoryXPositions={categoryPositions} />
      {entries.map(([group, values], groupIndex) => {
        const center = frame.left + band * (groupIndex + 0.5);
        const color = colorMap.get(group) ?? colors[0];
        const stats = boxStatistics(values);
        const summary = boxSummaries.get(group) ?? meanErrorStatistics(values);
        const jittered = values.map((value, index) => ({ value, x: center + Math.sin((index + 1) * 12.9898) * band * 0.13 }));
        let violin: ReactNode = null;
        if (type === "violin") {
          const curve = densityCurves.get(group) ?? [];
          const maximumDensity = Math.max(...curve.map((point) => point.density), 0.0001);
          const right = curve.map((point) => `${center + (point.density / maximumDensity) * band * settings.violinWidth},${yAt(point.position)}`);
          const left = [...curve].reverse().map((point) => `${center - (point.density / maximumDensity) * band * settings.violinWidth},${yAt(point.position)}`);
          violin = <polygon data-plot-element="violin" points={[...right, ...left].join(" ")} fill={color} fillOpacity={0.3} stroke={color} strokeWidth={settings.dataLineWidth} strokeLinejoin="round" />;
        }
        return (
          <g key={group} data-plot-data>
            {violin}
            {type === "box" && settings.showBox ? (
              <g data-plot-element="box-layer">
                <line x1={center} x2={center} y1={yAt(stats.low)} y2={yAt(stats.high)} stroke={ink} strokeWidth={settings.dataLineWidth} />
                <line x1={center - band * 0.15} x2={center + band * 0.15} y1={yAt(stats.low)} y2={yAt(stats.low)} stroke={ink} strokeWidth={settings.dataLineWidth} />
                <line x1={center - band * 0.15} x2={center + band * 0.15} y1={yAt(stats.high)} y2={yAt(stats.high)} stroke={ink} strokeWidth={settings.dataLineWidth} />
                <rect x={center - band * 0.25} y={yAt(stats.q3)} width={band * 0.5} height={Math.max(1, yAt(stats.q1) - yAt(stats.q3))} fill={color} fillOpacity={0.28} stroke={color} strokeWidth={settings.dataLineWidth} />
                <line x1={center - band * 0.25} x2={center + band * 0.25} y1={yAt(stats.median)} y2={yAt(stats.median)} stroke={ink} strokeWidth={Math.max(1.8, settings.dataLineWidth)} />
              </g>
            ) : null}
            {type === "violin" ? <line x1={center - band * 0.25} x2={center + band * 0.25} y1={yAt(stats.median)} y2={yAt(stats.median)} stroke={ink} strokeWidth={Math.max(1.8, settings.dataLineWidth)} /> : null}
            {settings.showPoints ? jittered.map((point, index) => <circle data-plot-element="observation" key={`${group}-${index}`} cx={point.x} cy={yAt(point.value)} r={Math.max(2.2, settings.pointSize * 0.58)} fill={color} fillOpacity={0.72} stroke="#FFFFFF" strokeWidth={0.65} />) : null}
            {type === "box" && settings.boxErrorType !== "none" ? (() => {
              const error = settings.boxErrorType === "sd" ? summary.sd : summary.sem;
              const capHalf = settings.errorBarCapSize / 2;
              const low = yAt(summary.mean - error);
              const high = yAt(summary.mean + error);
              return <g data-plot-element="box-summary-error-bar" stroke={ink} strokeWidth={settings.errorBarLineWidth} strokeLinecap="round"><line x1={center} x2={center} y1={low} y2={high} /><line x1={center - capHalf} x2={center + capHalf} y1={low} y2={low} /><line x1={center - capHalf} x2={center + capHalf} y1={high} y2={high} /><circle data-plot-element="box-summary-mean" cx={center} cy={yAt(summary.mean)} r={Math.max(2.8, settings.pointSize * 0.62)} fill="#FFFFFF" stroke={ink} strokeWidth={settings.errorBarLineWidth} /></g>;
            })() : null}
            <text x={center} y={frame.top + frame.plotHeight + 18} textAnchor="middle" fill={muted} fontSize={settings.tickSize}>{truncate(group, 16)}</text>
            {settings.showSampleSize ? <text x={center} y={frame.top + frame.plotHeight + 34} textAnchor="middle" fill={muted} fontSize={Math.max(9, settings.tickSize - 1)}>n={values.length}</text> : null}
          </g>
        );
      })}
    </>
  );
}

function renderVolcano(
  frame: PlotFrame,
  dataset: ParsedDataset,
  mapping: Record<string, string>,
  settings: VisualizationSettings,
  colors: string[],
  ink: string,
  muted: string,
  gridColor: string,
) {
  const points = dataset.rows.map((row, index) => {
    const effect = parseNumericValue(row[mapping.effect]) ?? 0;
    const pValue = parseNumericValue(row[mapping.pValue]) ?? 1;
    const significance = -Math.log10(Math.max(pValue, Number.MIN_VALUE));
    const state = pValue <= settings.pValueThreshold && effect >= settings.foldChangeThreshold
      ? "Up"
      : pValue <= settings.pValueThreshold && effect <= -settings.foldChangeThreshold
        ? "Down"
        : "Not significant";
    return { index, label: row[mapping.label], effect, pValue, significance, state };
  });
  const xDomain = resolveAxisDomain(numericExtent([...points.map((point) => point.effect), -settings.foldChangeThreshold, settings.foldChangeThreshold]), settings.xMin, settings.xMax);
  const yDomain = resolveAxisDomain(numericExtent([...points.map((point) => point.significance), -Math.log10(settings.pValueThreshold)], true), settings.yMin, settings.yMax);
  const stateColors = new Map<string, string>([["Down", colors[0]], ["Up", colors[1] ?? colors[0]], ["Not significant", colors[2] ?? "#B8B8BC"]]);
  const labels = points
    .filter((point) => point.state !== "Not significant")
    .sort((a, b) => a.pValue - b.pValue)
    .slice(0, settings.labelLimit);
  const labelSet = new Set(labels.map((point) => point.index));

  return (
    <>
      <NumericAxes frame={frame} settings={settings} xDomain={xDomain} yDomain={yDomain} xLabel={settings.xLabel || "log₂ fold change"} yLabel={settings.yLabel || "−log₁₀ adjusted P"} ink={ink} muted={muted} gridColor={gridColor} />
      <g data-plot-data>
      {[-settings.foldChangeThreshold, settings.foldChangeThreshold].map((value) => <line key={value} data-plot-element="fold-change-threshold" x1={scaleLinear(value, xDomain, [frame.left, frame.left + frame.plotWidth])} x2={scaleLinear(value, xDomain, [frame.left, frame.left + frame.plotWidth])} y1={frame.top} y2={frame.top + frame.plotHeight} stroke={muted} strokeWidth={1} strokeDasharray="5 4" />)}
      <line data-plot-element="p-value-threshold" x1={frame.left} x2={frame.left + frame.plotWidth} y1={scaleLinear(-Math.log10(settings.pValueThreshold), yDomain, [frame.top + frame.plotHeight, frame.top])} y2={scaleLinear(-Math.log10(settings.pValueThreshold), yDomain, [frame.top + frame.plotHeight, frame.top])} stroke={muted} strokeWidth={1} strokeDasharray="5 4" />
      {points.map((point) => {
        const x = scaleLinear(point.effect, xDomain, [frame.left, frame.left + frame.plotWidth]);
        const y = scaleLinear(point.significance, yDomain, [frame.top + frame.plotHeight, frame.top]);
        return (
          <g key={point.index}>
            <circle cx={x} cy={y} r={settings.pointSize} fill={stateColors.get(point.state)} fillOpacity={settings.opacity} stroke="#FFFFFF" strokeWidth={0.6} />
            {labelSet.has(point.index) ? <text data-plot-label x={point.effect > (xDomain[0] + xDomain[1]) / 2 ? x - settings.pointSize - 2 : x + settings.pointSize + 2} y={point.significance > (yDomain[0] + yDomain[1]) / 2 ? y + settings.tickSize + 2 + (point.index % 2) * 3 : y - 3 - (point.index % 2) * 3} textAnchor={point.effect > (xDomain[0] + xDomain[1]) / 2 ? "end" : "start"} fill={ink} fontSize={settings.tickSize} fontWeight={600}>{truncate(point.label, 13)}</text> : null}
          </g>
        );
      })}
      </g>
      <Legend frame={frame} settings={settings} ink={ink} items={["Up", "Down", "Not significant"].map((state) => ({ label: state, color: stateColors.get(state) ?? colors[0] }))} />
    </>
  );
}

function renderHeatmap(
  frame: PlotFrame,
  dataset: ParsedDataset,
  settings: VisualizationSettings,
  diverging: [string, string, string],
  ink: string,
  muted: string,
) {
  const rowLabelColumn = dataset.headers[0];
  const columns = dataset.headers.slice(1);
  const rawMatrix = dataset.rows.map((row) => columns.map((column) => parseNumericValue(row[column]) ?? 0));
  const matrix = settings.heatmapScale === "row"
    ? rawMatrix.map((values) => {
        const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
        const sd = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, values.length - 1)) || 1;
        return values.map((value) => (value - mean) / sd);
      })
    : rawMatrix;
  const flat = matrix.flat();
  const maximum = Math.max(...flat.map(Math.abs), 1);
  const cellWidth = frame.plotWidth / Math.max(1, columns.length);
  const cellHeight = frame.plotHeight / Math.max(1, matrix.length);

  return (
    <>
      <g>
        {matrix.map((row, rowIndex) => row.map((value, columnIndex) => (
          <rect
            key={`${rowIndex}-${columnIndex}`}
            x={frame.left + columnIndex * cellWidth}
            y={frame.top + rowIndex * cellHeight}
            width={cellWidth + 0.2}
            height={cellHeight + 0.2}
            fill={divergingColor(diverging[0], diverging[1], diverging[2], (value + maximum) / (maximum * 2))}
          />
        )))}
        {dataset.rows.map((row, rowIndex) => (
          <text key={`row-${rowIndex}`} x={frame.left - 8} y={frame.top + rowIndex * cellHeight + cellHeight / 2 + settings.tickSize * 0.34} textAnchor="end" fill={muted} fontSize={Math.min(settings.tickSize, Math.max(8, cellHeight * 0.55))}>{truncate(row[rowLabelColumn], 18)}</text>
        ))}
        {columns.map((column, columnIndex) => (
          <text key={column} transform={`translate(${frame.left + columnIndex * cellWidth + cellWidth / 2} ${frame.top + frame.plotHeight + 8}) rotate(-35)`} textAnchor="end" fill={muted} fontSize={settings.tickSize}>{truncate(column, 16)}</text>
        ))}
        <rect x={frame.left} y={frame.top} width={frame.plotWidth} height={frame.plotHeight} fill="none" stroke={ink} strokeWidth={settings.axisLineWidth} />
      </g>
      {settings.legendPosition === "right" ? <g transform={`translate(${frame.left + frame.plotWidth + 28} ${frame.top})`}>
        {Array.from({ length: 40 }, (_, index) => (
          <rect key={index} x={0} y={(index * Math.min(180, frame.plotHeight)) / 40} width={12} height={Math.min(180, frame.plotHeight) / 40 + 0.4} fill={divergingColor(diverging[2], diverging[1], diverging[0], index / 39)} />
        ))}
        <text x={18} y={8} fill={muted} fontSize={settings.legendSize}>{formatTick(maximum)}</text>
        <text x={18} y={Math.min(180, frame.plotHeight) / 2 + 4} fill={muted} fontSize={settings.legendSize}>0</text>
        <text x={18} y={Math.min(180, frame.plotHeight)} fill={muted} fontSize={settings.legendSize}>{formatTick(-maximum)}</text>
      </g> : null}
      <text x={frame.left + frame.plotWidth / 2} y={frame.height - 14} textAnchor="middle" fill={ink} fontSize={settings.axisLabelSize} fontWeight={600}>{settings.xLabel || "Samples"}</text>
      <text transform={`translate(18 ${frame.top + frame.plotHeight / 2}) rotate(-90)`} textAnchor="middle" fill={ink} fontSize={settings.axisLabelSize} fontWeight={600}>{settings.yLabel || "Features"}</text>
    </>
  );
}

function renderEnrichment(
  frame: PlotFrame,
  dataset: ParsedDataset,
  mapping: Record<string, string>,
  settings: VisualizationSettings,
  sequential: [string, string],
  ink: string,
  muted: string,
  gridColor: string,
) {
  const rows = dataset.rows.map((row) => ({
    term: row[mapping.term],
    ratio: parseRatioValue(row[mapping.ratio]) ?? 0,
    count: parseNumericValue(row[mapping.count]) ?? 0,
    pValue: parseNumericValue(row[mapping.pValue]) ?? 1,
    group: mapping.group ? row[mapping.group] || "All" : "All",
  })).sort((a, b) => a.ratio - b.ratio);
  const ratioDomain = resolveAxisDomain(numericExtent(rows.map((row) => row.ratio), true), settings.xMin, settings.xMax);
  const countExtent = numericExtent(rows.map((row) => row.count), true);
  const significance = rows.map((row) => -Math.log10(row.pValue));
  const significanceExtent = numericExtent(significance, true);
  const band = frame.plotHeight / Math.max(1, rows.length);
  const categoryYPositions = rows.map((_, index) => frame.top + frame.plotHeight - band * (index + 0.5));
  const groups = [...new Set(rows.map((row) => row.group))];

  return (
    <>
      <NumericAxes frame={frame} settings={settings} xDomain={ratioDomain} yDomain={[0, rows.length]} xLabel={settings.xLabel || "Gene ratio"} yLabel={settings.yLabel || "Enriched term"} ink={ink} muted={muted} gridColor={gridColor} hideYTicks categoryYPositions={categoryYPositions} />
      {rows.map((row, index) => {
        const x = scaleLinear(row.ratio, ratioDomain, [frame.left, frame.left + frame.plotWidth]);
        const y = frame.top + frame.plotHeight - band * (index + 0.5);
        const radius = scaleLinear(row.count, countExtent, [3.5, 10.5]);
        const color = interpolateColor(sequential[0], sequential[1], scaleLinear(-Math.log10(row.pValue), significanceExtent, [0, 1]));
        return (
          <g key={`${row.term}-${index}`} data-plot-data>
            <circle cx={x} cy={y} r={radius} fill={color} fillOpacity={settings.opacity} stroke={ink} strokeWidth={0.45} />
            <text x={frame.left - 9} y={y + settings.tickSize * 0.34} textAnchor="end" fill={muted} fontSize={settings.tickSize}>{truncate(row.term, 24)}</text>
          </g>
        );
      })}
      {settings.legendPosition === "right" ? <g transform={`translate(${frame.left + frame.plotWidth + 20} ${frame.top + 4})`}>
        <text x={0} y={0} fill={ink} fontSize={settings.legendSize} fontWeight={700}>Adjusted P</text>
        {Array.from({ length: 32 }, (_, index) => <rect key={index} x={0} y={10 + index * 3.1} width={12} height={3.4} fill={interpolateColor(sequential[1], sequential[0], index / 31)} />)}
        <text x={18} y={18} fill={muted} fontSize={settings.legendSize}>lower</text>
        <text x={18} y={109} fill={muted} fontSize={settings.legendSize}>higher</text>
        <text x={0} y={137} fill={ink} fontSize={settings.legendSize} fontWeight={700}>Gene count</text>
        {[countExtent[0], (countExtent[0] + countExtent[1]) / 2, countExtent[1]].map((value, index) => {
          const radius = scaleLinear(value, countExtent, [3.5, 10.5]);
          return <g key={value} transform={`translate(${radius} ${154 + index * 27})`}><circle cx={0} cy={0} r={radius} fill="none" stroke={ink} /><text x={17} y={4} fill={muted} fontSize={settings.legendSize}>{formatTick(value)}</text></g>;
        })}
        {groups.length > 1 ? <text x={0} y={246} fill={muted} fontSize={settings.legendSize}>{groups.join(" · ")}</text> : null}
      </g> : null}
    </>
  );
}

export function ScientificChartPreview({ svgRef, type, dataset, mapping, settings, themeId }: ChartProps) {
  if (getPlotModule(type).renderer === "advanced") {
    return <ScientificAdvancedChartPreview svgRef={svgRef} type={type} dataset={dataset} mapping={mapping} settings={settings} themeId={themeId} />;
  }
  const theme = journalThemes[themeId];
  const frame = getFrame(settings, type);
  const definition = getPlotDefinition(type);
  const categorical: string[] = settings.categoricalColors.length > 0 ? settings.categoricalColors : theme.categorical;
  const sequential: [string, string] = [settings.continuousLow, settings.continuousHigh];
  const diverging: [string, string, string] = [settings.divergingLow, settings.divergingMid, settings.divergingHigh];
  let content: ReactNode;

  if (type === "bar") content = renderBar(frame, dataset, mapping, settings, categorical, CHART_TEXT_COLOR, CHART_TEXT_COLOR, theme.grid);
  else if (type === "line" || type === "scatter" || type === "pca") content = renderLineOrScatter(type, frame, dataset, mapping, settings, categorical, CHART_TEXT_COLOR, CHART_TEXT_COLOR, theme.grid);
  else if (type === "box" || type === "violin") content = renderDistribution(type, frame, dataset, mapping, settings, categorical, CHART_TEXT_COLOR, CHART_TEXT_COLOR, theme.grid);
  else if (type === "volcano") content = renderVolcano(frame, dataset, mapping, settings, categorical, CHART_TEXT_COLOR, CHART_TEXT_COLOR, theme.grid);
  else if (type === "heatmap") content = renderHeatmap(frame, dataset, settings, diverging, CHART_TEXT_COLOR, CHART_TEXT_COLOR);
  else content = renderEnrichment(frame, dataset, mapping, settings, sequential, CHART_TEXT_COLOR, CHART_TEXT_COLOR, theme.grid);

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${frame.width} ${frame.height}`}
      width={frame.width}
      height={frame.height}
      role="img"
      data-plot-renderer="standard"
      data-chart-text-color={CHART_TEXT_COLOR}
      aria-label={`${definition.name} scientific figure preview`}
      style={{ fontFamily: figureFontPresets[settings.fontFamily].family, background: "white", maxWidth: "100%", height: "auto" }}
    >
      <title>{settings.title || `${definition.name} figure`}</title>
      <desc>{definition.summary} Generated in LabNest Visualization Studio.</desc>
      <rect width={frame.width} height={frame.height} fill="#FFFFFF" />
      <defs><clipPath id={`plot-area-${type}`}><rect x={frame.left} y={frame.top} width={frame.plotWidth} height={frame.plotHeight} /></clipPath></defs>
      <style>{`[data-plot-data] path:not([data-no-clip]),[data-plot-data] circle:not([data-no-clip]),[data-plot-data] rect:not([data-no-clip]),[data-plot-data] line:not([data-no-clip]),[data-plot-data] polyline:not([data-no-clip]),[data-plot-data] polygon:not([data-no-clip]),[data-plot-data] text[data-plot-label]:not([data-no-clip]){clip-path:url(#plot-area-${type})}`}</style>
      <ChartTitle frame={frame} settings={settings} color={CHART_TEXT_COLOR} />
      {content}
    </svg>
  );
}
