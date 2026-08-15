"use client";

import type { ReactNode, RefObject } from "react";
import {
  boxStatistics,
  divergingColor,
  formatTick,
  figureFontPresets,
  getPlotDefinition,
  groupNumericValues,
  interpolateColor,
  journalThemes,
  kernelDensityEstimate,
  linearRegression,
  meanErrorStatistics,
  numericExtent,
  parseNumericValue,
  parseRatioValue,
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

type LegendItem = { label: string; color: string; shape?: "circle" | "line" | "square" };

function getFrame(settings: VisualizationSettings, type: PlotType): PlotFrame {
  const titleOffset = settings.title ? 24 : 0;
  const supportsLegend = type !== "box" && type !== "violin";
  const compactWidth = settings.width < 420;
  const compactHeight = settings.height < 300;
  const rightLegend = supportsLegend && settings.legendPosition === "right" ? (compactWidth ? 104 : 132) : 0;
  const bottomLegend = supportsLegend && settings.legendPosition === "bottom" ? 34 : 0;
  const left = compactWidth
    ? type === "enrichment" ? 124 : type === "heatmap" ? 90 : type === "bar" && settings.swapAxes ? 104 : 60
    : type === "enrichment" ? 168 : type === "heatmap" ? 108 : type === "bar" && settings.swapAxes ? 132 : 72;
  const right = (compactWidth ? 18 : 24) + rightLegend;
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
}) {
  const xTicks = ticks(xDomain);
  const yTicks = ticks(yDomain);
  const xBottom = frame.top + frame.plotHeight;
  const verticalGridPositions = categoryXPositions
    ?? (hideXTicks ? [] : xTicks.map((value) => scaleLinear(value, xDomain, [frame.left, frame.left + frame.plotWidth])));
  const horizontalGridPositions = categoryYPositions
    ?? (hideYTicks ? [] : yTicks.map((value) => scaleLinear(value, yDomain, [xBottom, frame.top])));
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
        const x = scaleLinear(value, xDomain, [frame.left, frame.left + frame.plotWidth]);
        return (
          <g key={`xt-${value}`}>
            <line x1={x} x2={x} y1={xBottom} y2={xBottom + 5} stroke={ink} strokeWidth={settings.axisLineWidth} />
            <text x={x} y={xBottom + 19} textAnchor="middle" fill={muted} fontSize={settings.tickSize}>{formatTick(value)}</text>
          </g>
        );
      }) : null}
      {!hideYTicks ? yTicks.map((value) => {
        const y = scaleLinear(value, yDomain, [xBottom, frame.top]);
        return (
          <g key={`yt-${value}`}>
            <line x1={frame.left - 5} x2={frame.left} y1={y} y2={y} stroke={ink} strokeWidth={settings.axisLineWidth} />
            <text x={frame.left - 9} y={y + settings.tickSize * 0.34} textAnchor="end" fill={muted} fontSize={settings.tickSize}>{formatTick(value)}</text>
          </g>
        );
      }) : null}
      <text x={frame.left + frame.plotWidth / 2} y={frame.height - (settings.legendPosition === "bottom" ? 45 : 13)} textAnchor="middle" fill={ink} fontSize={settings.axisLabelSize} fontWeight={600}>{xLabel}</text>
      <text transform={`translate(18 ${frame.top + frame.plotHeight / 2}) rotate(-90)`} textAnchor="middle" fill={ink} fontSize={settings.axisLabelSize} fontWeight={600}>{yLabel}</text>
    </g>
  );
}

function Legend({ frame, settings, items, ink }: { frame: PlotFrame; settings: VisualizationSettings; items: LegendItem[]; ink: string }) {
  if (settings.legendPosition === "none" || items.length === 0) return null;
  if (settings.legendPosition === "bottom") {
    const available = frame.width - frame.left - 20;
    const itemWidth = Math.min(130, available / Math.max(1, items.length));
    return (
      <g transform={`translate(${frame.left} ${frame.height - 23})`}>
        {items.map((item, index) => (
          <g key={item.label} transform={`translate(${index * itemWidth} 0)`}>
            <LegendMark item={item} y={-4} />
            <text x={13} y={0} fill={ink} fontSize={settings.legendSize}>{truncate(item.label, 18)}</text>
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
  const rows = dataset.rows.map((row) => ({
    category: row[mapping.category],
    value: parseNumericValue(row[mapping.value]) ?? 0,
    error: settings.barErrorType !== "none" && mapping.error ? Math.max(0, parseNumericValue(row[mapping.error]) ?? 0) : 0,
    group: mapping.group ? row[mapping.group] || "Value" : "Value",
  }));
  const groups = [...new Set(rows.map((row) => row.group))];
  const colorMap = paletteForGroups(groups, colors);
  const domain = numericExtent(rows.flatMap((row) => [row.value - row.error, row.value + row.error]), true);
  const band = (settings.swapAxes ? frame.plotHeight : frame.plotWidth) / Math.max(1, rows.length);
  const categoryPositions = rows.map((_, index) => settings.swapAxes
    ? frame.top + band * (index + 0.5)
    : frame.left + band * (index + 0.5));
  const baseline = settings.swapAxes
    ? scaleLinear(0, domain, [frame.left, frame.left + frame.plotWidth])
    : scaleLinear(0, domain, [frame.top + frame.plotHeight, frame.top]);
  const categoryLabel = (settings.swapAxes ? settings.yLabel : settings.xLabel).trim();
  const valueLabel = (settings.swapAxes ? settings.xLabel : settings.yLabel).trim();
  const numericAxes = settings.swapAxes ? (
    <NumericAxes frame={frame} settings={settings} xDomain={domain} yDomain={[0, rows.length]} xLabel={valueLabel} yLabel={categoryLabel} ink={ink} muted={muted} gridColor={gridColor} hideYTicks categoryYPositions={categoryPositions} />
  ) : (
    <NumericAxes frame={frame} settings={settings} xDomain={[0, rows.length]} yDomain={domain} xLabel={categoryLabel} yLabel={valueLabel} ink={ink} muted={muted} gridColor={gridColor} hideXTicks categoryXPositions={categoryPositions} />
  );

  return (
    <>
      {numericAxes}
      {rows.map((row, index) => {
        const color = colorMap.get(row.group) ?? colors[0];
        if (settings.swapAxes) {
          const y = frame.top + index * band + band * 0.16;
          const x = scaleLinear(row.value, domain, [frame.left, frame.left + frame.plotWidth]);
          const errorStart = scaleLinear(row.value - row.error, domain, [frame.left, frame.left + frame.plotWidth]);
          const errorEnd = scaleLinear(row.value + row.error, domain, [frame.left, frame.left + frame.plotWidth]);
          const errorCenter = y + band * 0.34;
          const capHalf = Math.min(settings.errorBarCapSize / 2, band * 0.3);
          return (
            <g key={`${row.category}-${index}`}>
              <rect data-plot-element="bar" x={Math.min(baseline, x)} y={y} width={Math.max(1, Math.abs(x - baseline))} height={band * 0.68} rx={2} fill={color} fillOpacity={settings.opacity} stroke={settings.barBorderWidth > 0 ? settings.barBorderColor : "none"} strokeWidth={settings.barBorderWidth} />
              {settings.barErrorType !== "none" ? <g data-plot-element="error-bar" stroke={ink} strokeWidth={settings.errorBarLineWidth} strokeLinecap="round"><line x1={errorStart} x2={errorEnd} y1={errorCenter} y2={errorCenter} /><line x1={errorStart} x2={errorStart} y1={errorCenter - capHalf} y2={errorCenter + capHalf} /><line x1={errorEnd} x2={errorEnd} y1={errorCenter - capHalf} y2={errorCenter + capHalf} /></g> : null}
              <text x={frame.left - 9} y={y + band * 0.43} textAnchor="end" fill={muted} fontSize={settings.tickSize}>{truncate(row.category, 18)}</text>
            </g>
          );
        }
        const x = frame.left + index * band + band * 0.16;
        const y = scaleLinear(row.value, domain, [frame.top + frame.plotHeight, frame.top]);
        const errorStart = scaleLinear(row.value - row.error, domain, [frame.top + frame.plotHeight, frame.top]);
        const errorEnd = scaleLinear(row.value + row.error, domain, [frame.top + frame.plotHeight, frame.top]);
        const errorCenter = x + band * 0.34;
        const capHalf = Math.min(settings.errorBarCapSize / 2, band * 0.3);
        return (
          <g key={`${row.category}-${index}`}>
            <rect data-plot-element="bar" x={x} y={Math.min(baseline, y)} width={band * 0.68} height={Math.max(1, Math.abs(y - baseline))} rx={2} fill={color} fillOpacity={settings.opacity} stroke={settings.barBorderWidth > 0 ? settings.barBorderColor : "none"} strokeWidth={settings.barBorderWidth} />
            {settings.barErrorType !== "none" ? <g data-plot-element="error-bar" stroke={ink} strokeWidth={settings.errorBarLineWidth} strokeLinecap="round"><line x1={errorCenter} x2={errorCenter} y1={errorStart} y2={errorEnd} /><line x1={errorCenter - capHalf} x2={errorCenter + capHalf} y1={errorStart} y2={errorStart} /><line x1={errorCenter - capHalf} x2={errorCenter + capHalf} y1={errorEnd} y2={errorEnd} /></g> : null}
            <text transform={`translate(${x + band * 0.34} ${frame.top + frame.plotHeight + 10}) rotate(-30)`} textAnchor="end" fill={muted} fontSize={settings.tickSize}>{truncate(row.category, 16)}</text>
          </g>
        );
      })}
      <Legend frame={frame} settings={settings} ink={ink} items={groups.map((group) => ({ label: group, color: colorMap.get(group) ?? colors[0], shape: "square" }))} />
    </>
  );
}

function renderLineOrScatter(
  type: "line" | "scatter",
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
      label: type === "scatter" && mapping.label ? row[mapping.label] : "",
      index,
      order: rawX,
    };
  });
  const xDomain = numericExtent(lineErrorsEnabled && settings.swapAxes
    ? points.flatMap((point) => [point.x - point.error, point.x + point.error])
    : points.map((point) => point.x));
  const yDomain = numericExtent(lineErrorsEnabled && !settings.swapAxes
    ? points.flatMap((point) => [point.y - point.error, point.y + point.error])
    : points.map((point) => point.y));
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
          {settings.showLabels && point.label ? <text x={point.sx + settings.pointSize + 2} y={point.sy - 3} fill={ink} fontSize={settings.tickSize}>{truncate(point.label, 12)}</text> : null}
        </g>
      ))}
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
  const yDomain = type === "violin" && densitySupport.length > 0
    ? numericExtent(densitySupport)
    : numericExtent([...entries.flatMap(([, values]) => values), ...boxSummaryExtent]);
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
          <g key={group}>
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
  const xDomain = numericExtent(points.map((point) => point.effect));
  const yDomain = numericExtent(points.map((point) => point.significance), true);
  const stateColors = new Map<string, string>([["Down", colors[0]], ["Up", colors[1] ?? colors[0]], ["Not significant", colors[2] ?? "#B8B8BC"]]);
  const labels = points
    .filter((point) => point.state !== "Not significant")
    .sort((a, b) => a.pValue - b.pValue)
    .slice(0, settings.labelLimit);
  const labelSet = new Set(labels.map((point) => point.index));

  return (
    <>
      <NumericAxes frame={frame} settings={settings} xDomain={xDomain} yDomain={yDomain} xLabel={settings.xLabel || "log₂ fold change"} yLabel={settings.yLabel || "−log₁₀ adjusted P"} ink={ink} muted={muted} gridColor={gridColor} />
      {[-settings.foldChangeThreshold, settings.foldChangeThreshold].map((value) => <line key={value} x1={scaleLinear(value, xDomain, [frame.left, frame.left + frame.plotWidth])} x2={scaleLinear(value, xDomain, [frame.left, frame.left + frame.plotWidth])} y1={frame.top} y2={frame.top + frame.plotHeight} stroke={muted} strokeWidth={1} strokeDasharray="5 4" />)}
      <line x1={frame.left} x2={frame.left + frame.plotWidth} y1={scaleLinear(-Math.log10(settings.pValueThreshold), yDomain, [frame.top + frame.plotHeight, frame.top])} y2={scaleLinear(-Math.log10(settings.pValueThreshold), yDomain, [frame.top + frame.plotHeight, frame.top])} stroke={muted} strokeWidth={1} strokeDasharray="5 4" />
      {points.map((point) => {
        const x = scaleLinear(point.effect, xDomain, [frame.left, frame.left + frame.plotWidth]);
        const y = scaleLinear(point.significance, yDomain, [frame.top + frame.plotHeight, frame.top]);
        return (
          <g key={point.index}>
            <circle cx={x} cy={y} r={settings.pointSize} fill={stateColors.get(point.state)} fillOpacity={settings.opacity} stroke="#FFFFFF" strokeWidth={0.6} />
            {labelSet.has(point.index) ? <text x={x + settings.pointSize + 2} y={y - 3} fill={ink} fontSize={settings.tickSize} fontWeight={600}>{truncate(point.label, 13)}</text> : null}
          </g>
        );
      })}
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
  const ratioDomain = numericExtent(rows.map((row) => row.ratio), true);
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
          <g key={`${row.term}-${index}`}>
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
  const theme = journalThemes[themeId];
  const frame = getFrame(settings, type);
  const definition = getPlotDefinition(type);
  const categorical: string[] = settings.categoricalColors.length > 0 ? settings.categoricalColors : theme.categorical;
  const sequential: [string, string] = [settings.continuousLow, settings.continuousHigh];
  const diverging: [string, string, string] = [settings.divergingLow, settings.divergingMid, settings.divergingHigh];
  let content: ReactNode;

  if (type === "bar") content = renderBar(frame, dataset, mapping, settings, categorical, theme.ink, theme.muted, theme.grid);
  else if (type === "line" || type === "scatter") content = renderLineOrScatter(type, frame, dataset, mapping, settings, categorical, theme.ink, theme.muted, theme.grid);
  else if (type === "box" || type === "violin") content = renderDistribution(type, frame, dataset, mapping, settings, categorical, theme.ink, theme.muted, theme.grid);
  else if (type === "volcano") content = renderVolcano(frame, dataset, mapping, settings, categorical, theme.ink, theme.muted, theme.grid);
  else if (type === "heatmap") content = renderHeatmap(frame, dataset, settings, diverging, theme.ink, theme.muted);
  else content = renderEnrichment(frame, dataset, mapping, settings, sequential, theme.ink, theme.muted, theme.grid);

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${frame.width} ${frame.height}`}
      width={frame.width}
      height={frame.height}
      role="img"
      aria-label={`${definition.name} scientific figure preview`}
      style={{ fontFamily: figureFontPresets[settings.fontFamily].family, background: "white", maxWidth: "100%", height: "auto" }}
    >
      <title>{settings.title || `${definition.name} figure`}</title>
      <desc>{definition.summary} Generated in LabNest Visualization Studio.</desc>
      <rect width={frame.width} height={frame.height} fill="#FFFFFF" />
      <ChartTitle frame={frame} settings={settings} color={theme.ink} />
      {content}
    </svg>
  );
}
