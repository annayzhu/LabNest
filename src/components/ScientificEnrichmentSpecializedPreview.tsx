"use client";

import {
  categoricalColorForIndex,
  categoryFooterLayoutMetrics,
  compactLegendLabel,
  enrichmentCircleRadius,
  formatTick,
  geographicPointRadius,
  geographicPointLayout,
  interpolateColor,
  numericExtent,
  parseNumericValue,
  parseRatioValue,
  pathwayImpactLayout,
  pathwayImpactRadius,
  petalLabelLayout,
  relationshipBubbleRadius,
  relationshipRibbonWidth,
  scaleLinear,
  type ParsedDataset,
  type VisualizationSettings,
} from "@/lib/visualization-studio";

export type EnrichmentSpecializedPlotType =
  | "go-circle" | "kegg-circle" | "go-chord" | "pathway-impact" | "nes-fdr"
  | "multi-gsea" | "enrichment-ridge" | "sankey-bubble" | "geographic-map"
  | "petal" | "word-cloud";

type Frame = { width: number; height: number; left: number; right: number; top: number; bottom: number; plotWidth: number; plotHeight: number };
type Props = { type: EnrichmentSpecializedPlotType; frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[]; sequential: [string, string]; gridColor: string };
const TEXT = "#23242A";

function numericAxes(frame: Frame, settings: VisualizationSettings, xDomain: [number, number], yDomain: [number, number], xLabel: string, yLabel: string, gridColor: string) {
  const bottom = frame.top + frame.plotHeight;
  return <g data-specialized-axes>
    {Array.from({ length: 5 }, (_, index) => index / 4).map((fraction) => {
      const x = frame.left + fraction * frame.plotWidth;
      const y = bottom - fraction * frame.plotHeight;
      return <g key={fraction}>
        {settings.grid !== "none" ? <line x1={frame.left} x2={frame.left + frame.plotWidth} y1={y} y2={y} stroke={gridColor} strokeWidth={settings.gridLineWidth} /> : null}
        {settings.grid === "both" ? <line x1={x} x2={x} y1={frame.top} y2={bottom} stroke={gridColor} strokeWidth={settings.gridLineWidth} /> : null}
        <text x={frame.left - 7} y={y + 4} textAnchor="end" fill={TEXT} fontSize={settings.tickSize}>{formatTick(yDomain[0] + fraction * (yDomain[1] - yDomain[0]))}</text>
        <text x={x} y={bottom + 17} textAnchor="middle" fill={TEXT} fontSize={settings.tickSize}>{formatTick(xDomain[0] + fraction * (xDomain[1] - xDomain[0]))}</text>
      </g>;
    })}
    <line x1={frame.left} x2={frame.left + frame.plotWidth} y1={bottom} y2={bottom} stroke={TEXT} strokeWidth={settings.axisLineWidth} />
    <line x1={frame.left} x2={frame.left} y1={frame.top} y2={bottom} stroke={TEXT} strokeWidth={settings.axisLineWidth} />
    {xLabel ? <text data-specialized-x-label="true" x={frame.left + frame.plotWidth / 2} y={frame.height - 13} textAnchor="middle" fill={TEXT} fontSize={settings.axisLabelSize} fontWeight={600}>{xLabel}</text> : null}
    {yLabel ? <text transform={`translate(18 ${frame.top + frame.plotHeight / 2}) rotate(-90)`} textAnchor="middle" fill={TEXT} fontSize={settings.axisLabelSize} fontWeight={600}>{yLabel}</text> : null}
  </g>;
}

function methodNote(frame: Frame, settings: VisualizationSettings, text: string, offset = 32) {
  const size = Math.max(7, settings.tickSize - 2);
  return <text data-no-clip="true" data-plot-element="method-note" data-full-label={text} x={frame.left} y={frame.top + frame.plotHeight + offset} fill="#666970" fontSize={size}><title>{text}</title>{compactLegendLabel(text, size, frame.plotWidth, 70)}</text>;
}

function safeExtent(values: number[], includeZero = false): [number, number] {
  const domain = numericExtent(includeZero ? [...values, 0] : values, includeZero);
  return domain[0] === domain[1] ? [domain[0] - 1, domain[1] + 1] : domain;
}

function paddedExtent(values: number[], includeZero = false): [number, number] {
  const domain = safeExtent(values, includeZero);
  const padding = Math.max((domain[1] - domain[0]) * 0.08, Number.EPSILON);
  return [domain[0] - padding, domain[1] + padding];
}

function polar(cx: number, cy: number, radius: number, angle: number) {
  return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
}

function arcPath(cx: number, cy: number, radius: number, start: number, end: number) {
  const from = polar(cx, cy, radius, start);
  const to = polar(cx, cy, radius, end);
  return `M ${from.x} ${from.y} A ${radius} ${radius} 0 ${end - start > Math.PI ? 1 : 0} 1 ${to.x} ${to.y}`;
}

function FdrLegend({ frame, settings, sequential, values, id, offset = 31 }: { frame: Frame; settings: VisualizationSettings; sequential: [string, string]; values: number[]; id: string; offset?: number }) {
  const significance = values.map((value) => -Math.log10(value));
  const domain = safeExtent(significance, true);
  const width = Math.min(64, frame.plotWidth * 0.24);
  const x = frame.left + frame.plotWidth - width - 5;
  const y = frame.top + frame.plotHeight + offset;
  const fontSize = Math.max(7, settings.tickSize - 3);
  return <g data-no-clip="true" data-plot-element="fdr-scale" aria-label="FDR color scale">
    <defs><linearGradient id={id} x1="0%" x2="100%"><stop offset="0%" stopColor={sequential[0]} /><stop offset="100%" stopColor={sequential[1]} /></linearGradient></defs>
    <text x={x} y={y - 3} fill={TEXT} fontSize={fontSize} fontWeight={600}>−log₁₀(FDR)</text>
    <rect data-no-clip="true" x={x} y={y} width={width} height={6} rx={1} fill={`url(#${id})`} stroke="#D7D4CE" strokeWidth={0.5} />
    <text x={x} y={y + 15} fill={TEXT} fontSize={fontSize}>{formatTick(domain[0])}</text>
    <text x={x + width} y={y + 15} textAnchor="end" fill={TEXT} fontSize={fontSize}>{formatTick(domain[1])}</text>
  </g>;
}

function SizeLegend({ frame, settings, label, values, offset, radiusFor, availableWidth }: { frame: Frame; settings: VisualizationSettings; label: string; values: number[]; offset: number; radiusFor: (value: number, maximum: number) => number; availableWidth?: number }) {
  const minimum = Math.min(...values); const maximum = Math.max(...values); const minimumRadius = radiusFor(minimum, maximum); const maximumRadius = radiusFor(maximum, maximum); const size = Math.max(7, settings.tickSize - 2); const y = frame.top + frame.plotHeight + offset;
  const text = compactLegendLabel(`${label}: ${formatTick(minimum)}–${formatTick(maximum)}`, size, availableWidth ?? frame.plotWidth, 28);
  const firstX = frame.left + maximumRadius; const secondX = firstX + minimumRadius + maximumRadius + 7; const textX = secondX + maximumRadius + 7;
  return <g data-no-clip="true" data-plot-element="size-scale" aria-label={`${label} size scale`} data-min-radius={minimumRadius} data-max-radius={maximumRadius}><circle data-no-clip="true" cx={firstX} cy={y} r={minimumRadius} fill="none" stroke={TEXT} /><circle data-no-clip="true" cx={secondX} cy={y} r={maximumRadius} fill="none" stroke={TEXT} /><text data-no-clip="true" data-full-label={`${label}: ${minimum}–${maximum}`} x={textX} y={y + 3} fill={TEXT} fontSize={size}><title>{`${label}: ${minimum}–${maximum}`}</title>{text}</text></g>;
}

function RelationshipScaleLegend({ frame, settings, ratios, counts }: { frame: Frame; settings: VisualizationSettings; ratios: number[]; counts: number[] }) {
  const minimumRatio = Math.min(...ratios); const maximumRatio = Math.max(...ratios); const maximumCount = Math.max(...counts); const minimumCount = Math.min(...counts); const minimumWidth = relationshipRibbonWidth(minimumRatio); const maximumWidth = relationshipRibbonWidth(maximumRatio); const minimumRadius = relationshipBubbleRadius(minimumCount, maximumCount); const maximumRadius = relationshipBubbleRadius(maximumCount, maximumCount); const size = Math.max(7, settings.tickSize - 2); const y = frame.top + frame.plotHeight + 18; const ratioText = `ratio ${formatTick(minimumRatio)}–${formatTick(maximumRatio)}`; const countText = `count ${formatTick(minimumCount)}–${formatTick(maximumCount)}`; const bubbleX = frame.left + frame.plotWidth * 0.57;
  return <g data-no-clip="true" data-plot-element="relationship-scale" data-min-line-width={minimumWidth} data-max-line-width={maximumWidth} data-min-radius={minimumRadius} data-max-radius={maximumRadius}><line data-no-clip="true" x1={frame.left} x2={frame.left + 8} y1={y} y2={y} stroke={TEXT} strokeWidth={minimumWidth} /><line data-no-clip="true" x1={frame.left + 13} x2={frame.left + 22} y1={y} y2={y} stroke={TEXT} strokeWidth={maximumWidth} /><text data-no-clip="true" x={frame.left + 28} y={y + 3} fill={TEXT} fontSize={size}>{ratioText}</text><circle data-no-clip="true" cx={bubbleX} cy={y} r={minimumRadius} fill="none" stroke={TEXT} /><circle data-no-clip="true" cx={bubbleX + minimumRadius + maximumRadius + 7} cy={y} r={maximumRadius} fill="none" stroke={TEXT} /><text data-no-clip="true" x={bubbleX + minimumRadius + maximumRadius * 2 + 14} y={y + 3} fill={TEXT} fontSize={size}>{countText}</text></g>;
}

function CategoryFooterLegend({ type, frame, settings, groups, colors, offset = 16 }: { type: EnrichmentSpecializedPlotType; frame: Frame; settings: VisualizationSettings; groups: string[]; colors: string[]; offset?: number }) {
  const layout = categoryFooterLayoutMetrics(type, settings, groups, offset);
  return <g data-no-clip="true" data-plot-element="category-footer-legend">{groups.map((group, index) => { const row = Math.floor(index / layout.perRow); const column = index % layout.perRow; return <g key={group} transform={`translate(${frame.left + column * layout.cellWidth} ${frame.top + frame.plotHeight + offset + row * 14})`}><rect data-no-clip="true" x={0} y={-7} width={7} height={7} rx={1} fill={categoricalColorForIndex(index, colors)} /><text data-no-clip="true" data-full-label={group} x={11} y={0} fill={TEXT} fontSize={layout.fontSize}><title>{group}</title>{compactLegendLabel(group, layout.fontSize, layout.cellWidth - 13, 14)}</text></g>; })}</g>;
}

function CircleTerms({ frame, dataset, mapping, settings, colors, sequential, type }: Omit<Props, "gridColor"> & { type: "go-circle" | "kegg-circle" }) {
  const rows = dataset.rows.map((row) => ({
    term: row[mapping.term], ratio: parseRatioValue(row[mapping.ratio]) ?? 0,
    count: parseNumericValue(row[mapping.count]) ?? 0, fdr: parseNumericValue(row[mapping.pValue]) ?? 1,
    group: mapping.group ? (type === "go-circle" ? row[mapping.group].trim().toUpperCase() : row[mapping.group].trim()) : type === "go-circle" ? "GO" : "KEGG",
  })).sort((left, right) => left.group.localeCompare(right.group) || left.term.localeCompare(right.term));
  const groups = [...new Set(rows.map((row) => row.group))];
  const cx = frame.left + frame.plotWidth / 2; const cy = frame.top + frame.plotHeight / 2 - 5;
  const orbit = Math.min(frame.plotWidth, frame.plotHeight) * 0.32;
  const maximumCount = Math.max(...rows.map((row) => row.count), 1);
  const sigDomain = safeExtent(rows.map((row) => -Math.log10(row.fdr)), true);
  let cursor = 0;
  const sectors = groups.map((group, groupIndex) => { const count = rows.filter((row) => row.group === group).length; const start = -Math.PI / 2 + cursor / rows.length * Math.PI * 2; cursor += count; const end = -Math.PI / 2 + cursor / rows.length * Math.PI * 2; return { group, groupIndex, start, end }; });
  const legendY = frame.top + frame.plotHeight + 18; const cellWidth = frame.plotWidth / Math.max(1, groups.length);
  return <>
    <g data-plot-data data-plot-family="enrichment-circle">
      {sectors.map((sector) => <path key={sector.group} data-plot-element="enrichment-group-sector" d={arcPath(cx, cy, orbit + 20, sector.start + 0.025, sector.end - 0.025)} fill="none" stroke={categoricalColorForIndex(sector.groupIndex, colors)} strokeWidth={4} />)}
      {rows.map((row, index) => { const angle = -Math.PI / 2 + (index + 0.5) * Math.PI * 2 / rows.length; const point = polar(cx, cy, orbit, angle); const radius = enrichmentCircleRadius(row.count, maximumCount); const groupIndex = groups.indexOf(row.group); const color = interpolateColor(sequential[0], sequential[1], scaleLinear(-Math.log10(row.fdr), sigDomain, [0, 1])); return <g key={row.term} data-plot-element="enrichment-circle-term"><line x1={cx} y1={cy} x2={point.x} y2={point.y} stroke={categoricalColorForIndex(groupIndex, colors)} opacity={0.22} /><circle cx={point.x} cy={point.y} r={radius} fill={color} fillOpacity={settings.opacity} stroke={categoricalColorForIndex(groupIndex, colors)} strokeWidth={1.4}><title>{`${row.term}; group=${row.group}; ratio=${row.ratio}; count=${row.count}; FDR=${row.fdr}`}</title></circle>{settings.showLabels ? <text data-plot-label data-full-label={row.term} x={point.x} y={point.y + radius + settings.tickSize} textAnchor="middle" fill={TEXT} fontSize={settings.tickSize}><title>{row.term}</title>{compactLegendLabel(row.term, settings.tickSize, Math.max(36, orbit * 0.72), 16)}</text> : null}</g>; })}
      <circle cx={cx} cy={cy} r={22} fill="#FFFFFF" stroke={TEXT} /><text x={cx} y={cy - 2} textAnchor="middle" fill={TEXT} fontSize={settings.tickSize} fontWeight={700}>{type === "go-circle" ? "GO" : "KEGG"}</text><text x={cx} y={cy + 10} textAnchor="middle" fill="#666970" fontSize={Math.max(7, settings.tickSize - 3)}>FDR / count</text>
    </g>
    <g data-no-clip="true" data-plot-element="enrichment-group-legend">{groups.map((group, index) => <g key={group} transform={`translate(${frame.left + index * cellWidth} ${legendY})`}><rect data-no-clip="true" x={0} y={-7} width={7} height={7} rx={1} fill={categoricalColorForIndex(index, colors)} /><text data-no-clip="true" data-full-label={group} x={11} y={0} fill={TEXT} fontSize={Math.max(7, settings.tickSize - 2)}><title>{group}</title>{compactLegendLabel(group, Math.max(7, settings.tickSize - 2), cellWidth - 13, 14)}</text></g>)}</g>
    <FdrLegend frame={frame} settings={settings} sequential={sequential} values={rows.map((row) => row.fdr)} id={`${type}-fdr-gradient`} />
    <SizeLegend frame={frame} settings={settings} label="count (circle size)" values={rows.map((row) => row.count)} radiusFor={enrichmentCircleRadius} offset={68} />
    {methodNote(frame, settings, "Terms are grouped into contiguous colored sectors; angular position within a sector is decorative.", 100)}
  </>;
}

function GoChord({ frame, dataset, mapping, settings, colors }: Omit<Props, "type" | "sequential" | "gridColor">) {
  const rows = dataset.rows.map((row) => ({ term: row[mapping.term], gene: row[mapping.label], effect: parseNumericValue(row[mapping.effect]) ?? 0, group: row[mapping.group].trim().toUpperCase() }));
  const terms = [...new Set(rows.map((row) => row.term))]; const genes = [...new Set(rows.map((row) => row.gene))];
  const groups = [...new Set(rows.map((row) => row.group))]; const termGroup = new Map(rows.map((row) => [row.term, row.group]));
  const groupColors = groups.map((_, index) => categoricalColorForIndex(index + 2, colors));
  const cx = frame.left + frame.plotWidth / 2; const cy = frame.top + frame.plotHeight / 2 - 4; const radius = Math.min(frame.plotWidth, frame.plotHeight) * 0.38;
  const point = (index: number, total: number, start: number, span: number) => { const angle = start + (index + 0.5) / Math.max(1, total) * span; return { ...polar(cx, cy, radius, angle), angle }; };
  const termPoints = new Map(terms.map((term, index) => [term, point(index, terms.length, Math.PI * 0.55, Math.PI * 0.9)]));
  const genePoints = new Map(genes.map((gene, index) => [gene, point(index, genes.length, -Math.PI * 0.45, Math.PI * 0.9)]));
  const maximumEffect = Math.max(...rows.map((row) => Math.abs(row.effect)), Number.EPSILON);
  const positive = colors[0] ?? "#9B3A46"; const negative = colors[1] ?? "#315C67";
  return <>
    <g data-plot-data data-plot-family="go-chord">
      {rows.map((row) => { const source = termPoints.get(row.term)!; const target = genePoints.get(row.gene)!; const normalized = Math.abs(row.effect) / maximumEffect; const strokeWidth = settings.dataLineWidth * (0.7 + 1.3 * normalized); const color = row.effect > 0 ? positive : row.effect < 0 ? negative : "#9A9A96"; return <path key={`${row.term}\u0000${row.gene}`} data-plot-element="go-chord-link" data-effect={row.effect} data-effect-magnitude={normalized} d={`M ${source.x} ${source.y} Q ${cx} ${cy} ${target.x} ${target.y}`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={row.effect < 0 ? "4 3" : undefined} opacity={0.62}><title>{`${row.term} → ${row.gene}; effect=${row.effect}; |effect| scale=${normalized.toFixed(3)}`}</title></path>; })}
      {terms.map((term) => { const p = termPoints.get(term)!; const group = termGroup.get(term)!; return <g key={term}><circle cx={p.x} cy={p.y} r={4.5} fill={groupColors[groups.indexOf(group)]} data-ontology={group}><title>{`${term}; group=${group}`}</title></circle>{settings.showLabels ? <text data-plot-label data-full-label={term} x={p.x - 7} y={p.y + 4} textAnchor="end" fill={TEXT} fontSize={settings.tickSize}><title>{term}</title>{compactLegendLabel(term, settings.tickSize, frame.plotWidth * 0.28, 18)}</text> : null}</g>; })}
      {genes.map((gene) => { const p = genePoints.get(gene)!; return <g key={gene}><circle cx={p.x} cy={p.y} r={3.4} fill={TEXT} />{settings.showLabels ? <text data-plot-label data-full-label={gene} x={p.x + 7} y={p.y + 4} fill={TEXT} fontSize={settings.tickSize}><title>{gene}</title>{compactLegendLabel(gene, settings.tickSize, frame.plotWidth * 0.2, 12)}</text> : null}</g>; })}
    </g>
    <g data-no-clip="true" data-plot-element="go-chord-effect-legend" transform={`translate(${frame.left} ${frame.top + frame.plotHeight + 17})`}><line data-no-clip="true" x1={0} x2={18} y1={-4} y2={-4} stroke={positive} strokeWidth={settings.dataLineWidth * 1.35} /><text data-no-clip="true" x={23} y={0} fill={TEXT} fontSize={Math.max(7, settings.tickSize - 2)}>positive</text><line data-no-clip="true" x1={78} x2={96} y1={-4} y2={-4} stroke={negative} strokeWidth={settings.dataLineWidth * 1.35} strokeDasharray="4 3" /><text data-no-clip="true" x={101} y={0} fill={TEXT} fontSize={Math.max(7, settings.tickSize - 2)}>negative</text><text data-no-clip="true" x={178} y={0} fill={TEXT} fontSize={Math.max(7, settings.tickSize - 2)}>{`width: |effect| 0–${formatTick(maximumEffect)}`}</text></g>
    <CategoryFooterLegend type="go-chord" frame={frame} settings={settings} groups={groups} colors={groupColors} offset={39} />
    {methodNote(frame, settings, "Effect sign/width encode gene effect; term-node color encodes ontology. Curvature and order are layout only.", 62)}
  </>;
}

function PathwayImpact({ frame, dataset, mapping, settings, sequential, gridColor, colors }: Omit<Props, "type">) {
  const rows = dataset.rows.map((row) => ({ term: row[mapping.term], impact: parseNumericValue(row[mapping.impact]) ?? 0, fdr: parseNumericValue(row[mapping.pValue]) ?? 1, count: parseNumericValue(row[mapping.count]) ?? 1, group: row[mapping.group].trim() }));
  const groups = [...new Set(rows.map((row) => row.group))];
  const layout = pathwayImpactLayout(settings, rows);
  return <>{numericAxes(frame, settings, layout.xDomain, layout.yDomain, settings.xLabel || "Pathway impact (supplied)", settings.yLabel || "−log₁₀(FDR)", gridColor)}<g data-plot-data>{layout.items.map((item) => { const row = rows[item.index]; const color = interpolateColor(sequential[0], sequential[1], scaleLinear(-Math.log10(item.fdr), layout.significanceDomain, [0, 1])); return <g key={item.term} data-plot-element="pathway-impact"><circle cx={item.x} cy={item.y} r={item.radius} fill={color} fillOpacity={settings.opacity} stroke={categoricalColorForIndex(groups.indexOf(row.group), colors)} strokeWidth={1.5}><title>{`${item.term}; group=${row.group}; impact=${item.impact}; FDR=${item.fdr}; count=${item.count}`}</title></circle>{settings.showLabels ? <text data-plot-label data-full-label={item.term} x={item.labelX} y={item.labelY} textAnchor={item.textAnchor} fill={TEXT} fontSize={settings.tickSize}><title>{item.term}</title>{item.text}</text> : null}</g>; })}</g><FdrLegend frame={frame} settings={settings} sequential={sequential} values={rows.map((row) => row.fdr)} id="pathway-impact-fdr-gradient" offset={40} /><SizeLegend frame={frame} settings={settings} label="count (circle size)" values={rows.map((row) => row.count)} radiusFor={(value, maximum) => pathwayImpactRadius(value, maximum, settings.pointSize)} offset={76} availableWidth={frame.plotWidth} /><CategoryFooterLegend type="pathway-impact" frame={frame} settings={settings} groups={groups} colors={colors} offset={110} /></>;
}

function NesFdr({ frame, dataset, mapping, settings, sequential, gridColor }: Omit<Props, "type">) {
  const rows = dataset.rows.map((row) => ({ term: row[mapping.term], nes: parseNumericValue(row[mapping.nes]) ?? 0, fdr: parseNumericValue(row[mapping.pValue]) ?? 1, group: mapping.group ? row[mapping.group] : "Set" })).sort((left, right) => left.nes - right.nes);
  const xDomain = paddedExtent(rows.map((row) => row.nes), true); const band = frame.plotHeight / rows.length; const x = (value: number) => scaleLinear(value, xDomain, [frame.left, frame.left + frame.plotWidth]); const sig = safeExtent(rows.map((row) => -Math.log10(row.fdr)), true);
  return <>{numericAxes(frame, settings, xDomain, [0, rows.length], settings.xLabel || "Normalized enrichment score (NES)", "", gridColor)}<g data-plot-data><line x1={x(0)} x2={x(0)} y1={frame.top} y2={frame.top + frame.plotHeight} stroke={TEXT} strokeDasharray="4 3" />{rows.map((row, index) => { const y = frame.top + frame.plotHeight - (index + 0.5) * band; const color = interpolateColor(sequential[0], sequential[1], scaleLinear(-Math.log10(row.fdr), sig, [0, 1])); return <g key={row.term} data-plot-element="nes-fdr"><line x1={x(0)} x2={x(row.nes)} y1={y} y2={y} stroke={color} strokeWidth={settings.dataLineWidth} /><circle cx={x(row.nes)} cy={y} r={settings.pointSize * 0.7} fill={color}><title>{`${row.term}; NES=${row.nes}; FDR=${row.fdr}; group=${row.group}`}</title></circle><text data-no-clip="true" data-plot-label data-full-label={row.term} x={frame.left - 7} y={y + 4} textAnchor="end" fill={TEXT} fontSize={settings.tickSize}><title>{row.term}</title>{compactLegendLabel(row.term, settings.tickSize, Math.max(54, frame.left - 10), 18)}</text></g>; })}</g><FdrLegend frame={frame} settings={settings} sequential={sequential} values={rows.map((row) => row.fdr)} id="nes-fdr-gradient" offset={40} /></>;
}

function MultiGsea({ frame, dataset, mapping, settings, colors, gridColor }: Omit<Props, "type" | "sequential">) {
  const sets = [...new Set(dataset.rows.map((row) => row[mapping.group]))]; const rows = dataset.rows.map((row) => ({ rank: parseNumericValue(row[mapping.rank]) ?? 0, score: parseNumericValue(row[mapping.score]) ?? 0, hit: parseNumericValue(row[mapping.hit]) === 1, set: row[mapping.group], nes: parseNumericValue(row[mapping.nes]) ?? 0, fdr: parseNumericValue(row[mapping.pValue]) ?? 1 }));
  const xDomain = safeExtent(rows.map((row) => row.rank)); const yDomain = paddedExtent(rows.map((row) => row.score), true); const x = (value: number) => scaleLinear(value, xDomain, [frame.left, frame.left + frame.plotWidth]); const y = (value: number) => scaleLinear(value, yDomain, [frame.top + frame.plotHeight, frame.top]); const labelFont = Math.max(8, settings.legendSize - 1); const labelStep = labelFont + 3;
  return <>{numericAxes(frame, settings, xDomain, yDomain, settings.xLabel || "Rank in ordered dataset", settings.yLabel || "Running enrichment score", gridColor)}<g data-plot-data><line x1={frame.left} x2={frame.left + frame.plotWidth} y1={y(0)} y2={y(0)} stroke={TEXT} opacity={0.5} />{sets.map((set, index) => { const series = rows.filter((row) => row.set === set).sort((left, right) => left.rank - right.rank); const color = categoricalColorForIndex(index, colors); const first = series[0]; return <g key={set} data-plot-element="multi-gsea-series"><polyline points={series.map((row) => `${x(row.rank)},${y(row.score)}`).join(" ")} fill="none" stroke={color} strokeWidth={settings.dataLineWidth} /><text data-no-clip="true" data-full-label={set} x={frame.left + 7} y={frame.top + labelFont + index * labelStep} fill={color} fontSize={labelFont}><title>{set}</title>{compactLegendLabel(`${set} · NES ${formatTick(first.nes)} · FDR ${formatTick(first.fdr)}`, labelFont, frame.plotWidth - 14, 38)}</text>{series.filter((row) => row.hit).map((row, hitIndex) => <line key={hitIndex} data-plot-element="multi-gsea-hit" x1={x(row.rank)} x2={x(row.rank)} y1={frame.top + frame.plotHeight - 5 - index * 3} y2={frame.top + frame.plotHeight - 2 - index * 3} stroke={color} />)}</g>; })}</g>{methodNote(frame, settings, "Running scores, NES and FDR are displayed exactly as supplied by the upstream GSEA workflow.")}</>;
}

function EnrichmentRidge({ frame, dataset, mapping, settings, colors, gridColor }: Omit<Props, "type" | "sequential">) {
  const terms = [...new Set(dataset.rows.map((row) => row[mapping.term]))]; const values = dataset.rows.map((row) => parseNumericValue(row[mapping.score]) ?? 0); const xDomain = safeExtent(values); const band = frame.plotHeight / terms.length; const x = (value: number) => scaleLinear(value, xDomain, [frame.left, frame.left + frame.plotWidth]);
  const density = (termRows: number[]) => Array.from({ length: 48 }, (_, index) => { const value = xDomain[0] + index / 47 * (xDomain[1] - xDomain[0]); const bandwidth = Math.max((xDomain[1] - xDomain[0]) / 12, 1e-6); return { value, density: termRows.reduce((sum, observation) => sum + Math.exp(-0.5 * ((value - observation) / bandwidth) ** 2), 0) }; });
  return <>{numericAxes(frame, settings, xDomain, [0, terms.length], settings.xLabel || "Ranked feature statistic", "", gridColor)}<g data-plot-data>{terms.map((term, index) => { const observations = dataset.rows.filter((row) => row[mapping.term] === term).map((row) => parseNumericValue(row[mapping.score]) ?? 0); const curve = density(observations); const maximum = Math.max(...curve.map((point) => point.density), 1); const baseline = frame.top + frame.plotHeight - (index + 0.25) * band; const path = curve.map((point, pointIndex) => `${pointIndex ? "L" : "M"} ${x(point.value)} ${baseline - point.density / maximum * band * 0.72}`).join(" ") + ` L ${x(xDomain[1])} ${baseline} L ${x(xDomain[0])} ${baseline} Z`; return <g key={term} data-plot-element="enrichment-ridge"><path d={path} fill={categoricalColorForIndex(index, colors)} fillOpacity={0.28} stroke={categoricalColorForIndex(index, colors)} /><text data-no-clip="true" data-plot-label data-full-label={term} x={frame.left - 7} y={baseline + 3} textAnchor="end" fill={TEXT} fontSize={settings.tickSize}><title>{term}</title>{compactLegendLabel(term, settings.tickSize, Math.max(54, frame.left - 10), 18)}</text></g>; })}</g>{methodNote(frame, settings, "Ridges summarize supplied member-level statistics; density height is normalized separately per term.")}</>;
}

function SankeyBubble({ frame, dataset, mapping, settings, colors }: Omit<Props, "type" | "sequential" | "gridColor">) {
  const rows = dataset.rows.map((row) => ({ source: row[mapping.source], term: row[mapping.term], count: parseNumericValue(row[mapping.count]) ?? 0, ratio: parseRatioValue(row[mapping.ratio]) ?? 0, fdr: parseNumericValue(row[mapping.pValue]) ?? 1 })); const sources = [...new Set(rows.map((row) => row.source))]; const maxCount = Math.max(...rows.map((row) => row.count), 1); const sourceY = new Map(sources.map((source, index) => [source, frame.top + (index + 0.5) / sources.length * frame.plotHeight])); const termY = rows.map((_, index) => frame.top + (index + 0.5) / rows.length * frame.plotHeight); const left = frame.left + 10; const right = frame.left + frame.plotWidth - 38;
  return <><g data-plot-data data-plot-family="sankey-bubble">{rows.map((row, index) => { const sourcePosition = sourceY.get(row.source)!; const termPosition = termY[index]; const color = categoricalColorForIndex(sources.indexOf(row.source), colors); return <g key={`${row.source}-${row.term}`} data-plot-element="sankey-bubble-term"><path d={`M ${left + 34} ${sourcePosition} C ${left + frame.plotWidth * 0.38} ${sourcePosition}, ${right - frame.plotWidth * 0.28} ${termPosition}, ${right} ${termPosition}`} fill="none" stroke={color} strokeWidth={relationshipRibbonWidth(row.ratio)} opacity={0.24 + settings.opacity * 0.35} /><circle cx={right} cy={termPosition} r={relationshipBubbleRadius(row.count, maxCount)} fill={color} fillOpacity={settings.opacity}><title>{`${row.source} → ${row.term}; independent ratio=${row.ratio}; count=${row.count}; FDR=${row.fdr}`}</title></circle>{settings.showLabels ? <text data-plot-label data-full-label={row.term} x={right + 13} y={termPosition + 4} fill={TEXT} fontSize={settings.tickSize}><title>{row.term}</title>{compactLegendLabel(row.term, settings.tickSize, frame.plotWidth * 0.3, 18)}</text> : null}</g>; })}{sources.map((source, index) => <g key={source}><rect x={left} y={sourceY.get(source)! - 7} width={34} height={14} rx={3} fill={categoricalColorForIndex(index, colors)} /><text data-plot-label data-full-label={source} x={left + 17} y={sourceY.get(source)! + 3} textAnchor="middle" fill="#FFFFFF" fontSize={Math.max(7, settings.tickSize - 2)}><title>{source}</title>{compactLegendLabel(source, Math.max(7, settings.tickSize - 2), 30, 8)}</text></g>)}</g><RelationshipScaleLegend frame={frame} settings={settings} ratios={rows.map((row) => row.ratio)} counts={rows.map((row) => row.count)} />{methodNote(frame, settings, "Non-conserved relationship ribbons: each width is an independent enrichment ratio and bubble size encodes count; values do not sum to a source total.", 44)}</>;
}

function GeographicMap({ frame, dataset, mapping, settings, colors }: Omit<Props, "type" | "sequential" | "gridColor">) {
  const rows = dataset.rows.map((row) => ({ label: row[mapping.label], latitude: parseNumericValue(row[mapping.latitude]) ?? 0, longitude: parseNumericValue(row[mapping.longitude]) ?? 0, value: parseNumericValue(row[mapping.value]) ?? 0, group: mapping.group ? row[mapping.group] : "Sites" }));
  const groups = [...new Set(rows.map((row) => row.group))]; const layout = geographicPointLayout(settings, rows); const footer = categoryFooterLayoutMetrics("geographic-map", settings, groups); const outline = [[-168,18],[-130,55],[-60,72],[-52,15],[-80,-55],[-35,-55],[-15,35],[40,72],[170,62],[145,8],[110,-45],[25,-35],[-5,5],[-60,5],[-168,18]];
  return <><g data-plot-data data-plot-family="geographic-map"><rect x={frame.left} y={frame.top} width={frame.plotWidth} height={frame.plotHeight} fill="#F7F5F0" stroke="#B8B8B2" /><polyline points={outline.map(([longitude, latitude]) => `${layout.xAt(longitude)},${layout.yAt(latitude)}`).join(" ")} fill="#E8E3D9" stroke="#AAA79F" strokeWidth={1} />{[-120,-60,0,60,120].map((longitude) => <line key={longitude} x1={layout.xAt(longitude)} x2={layout.xAt(longitude)} y1={frame.top + layout.inset} y2={frame.top + frame.plotHeight - layout.inset} stroke="#DDDAD3" />)}{[-60,-30,0,30,60].map((latitude) => <line key={latitude} x1={frame.left + layout.inset} x2={frame.left + frame.plotWidth - layout.inset} y1={layout.yAt(latitude)} y2={layout.yAt(latitude)} stroke="#DDDAD3" />)}{layout.items.map((item) => { const row = rows[item.index]; const color = categoricalColorForIndex(groups.indexOf(row.group), colors); return <g key={item.label} data-plot-element="geographic-site"><circle cx={item.x} cy={item.y} r={item.radius} fill={color} fillOpacity={settings.opacity} stroke="#FFFFFF"><title>{`${item.label}; ${item.latitude}, ${item.longitude}; value=${item.value}; group=${row.group}`}</title></circle>{settings.showLabels ? <><line x1={item.x} y1={item.y} x2={item.labelX} y2={item.labelY} stroke={color} strokeWidth={0.7} opacity={0.55} /><text data-plot-label data-full-label={item.label} x={item.labelX} y={item.labelY} textAnchor={item.textAnchor} fill={TEXT} fontSize={settings.tickSize}><title>{item.label}</title>{item.text}</text></> : null}</g>; })}</g><CategoryFooterLegend type="geographic-map" frame={frame} settings={settings} groups={groups} colors={colors} /><SizeLegend frame={frame} settings={settings} label="value (circle size)" values={rows.map((row) => row.value)} radiusFor={(value, maximum) => geographicPointRadius(value, maximum, settings.pointSize)} offset={footer.sizeOffset} />{methodNote(frame, settings, "Equirectangular locator map: suitable for approximate location, not distance, area or boundary inference.", footer.noteOffset)}</>;
}

function Petal({ frame, dataset, mapping, settings, colors }: Omit<Props, "type" | "sequential" | "gridColor">) {
  const rows = dataset.rows.map((row) => ({ label: row[mapping.label], value: parseNumericValue(row[mapping.value]) ?? 0 })); const cx = frame.left + frame.plotWidth / 2; const cy = frame.top + frame.plotHeight / 2; const maxValue = Math.max(...rows.map((row) => row.value), 1); const maxRadius = Math.min(frame.plotWidth, frame.plotHeight) * 0.36; const labels = petalLabelLayout(settings, rows.map((row) => row.label));
  return <><g data-plot-data data-plot-family="petal">{rows.map((row, index) => { const label = labels[index]; const angle = label.angle; const extension = row.value / maxValue * (maxRadius - 10); const length = 10 + extension; const width = Math.PI * 1.35 / rows.length; const first = polar(cx, cy, 10, angle - width / 2); const tip = polar(cx, cy, length, angle); const second = polar(cx, cy, 10, angle + width / 2); return <g key={row.label} data-plot-element="petal" data-petal-extension={extension}><path d={`M ${first.x} ${first.y} Q ${tip.x} ${tip.y} ${second.x} ${second.y} Q ${cx} ${cy} ${first.x} ${first.y} Z`} fill={categoricalColorForIndex(index, colors)} fillOpacity={settings.opacity}><title>{`${row.label}: ${row.value}`}</title></path>{settings.showLabels ? <text data-plot-label data-full-label={row.label} x={label.x} y={label.y} textAnchor={label.textAnchor} fill={TEXT} fontSize={settings.tickSize}><title>{row.label}</title>{label.text}</text> : null}</g>; })}<circle cx={cx} cy={cy} r={11} fill="#FFFFFF" stroke={TEXT} /></g>{methodNote(frame, settings, "Petal extension beyond the central hub is proportional to value; zero has no visible extension.")}</>;
}

function WordCloud({ frame, dataset, mapping, settings, colors }: Omit<Props, "type" | "sequential" | "gridColor">) {
  const rows = dataset.rows.map((row) => ({ label: row[mapping.label], value: parseNumericValue(row[mapping.value]) ?? 0 })).sort((left, right) => right.value - left.value); const values = safeExtent(rows.map((row) => row.value)); const columns = Math.max(2, Math.ceil(Math.sqrt(rows.length))); const cellWidth = frame.plotWidth / columns; const cellHeight = frame.plotHeight / Math.ceil(rows.length / columns);
  return <><g data-plot-data data-plot-family="word-cloud">{rows.map((row, index) => { const column = index % columns; const line = Math.floor(index / columns); const size = scaleLinear(row.value, values, [Math.max(9, settings.tickSize), Math.min(28, settings.titleSize + 8)]); return <text key={row.label} data-plot-element="word-cloud-term" data-full-label={row.label} x={frame.left + (column + 0.5) * cellWidth} y={frame.top + (line + 0.58) * cellHeight} textAnchor="middle" fill={categoricalColorForIndex(index, colors)} fontSize={size} fontWeight={index < 3 ? 700 : 500}><title>{`${row.label}: ${row.value}`}</title>{compactLegendLabel(row.label, size, cellWidth - 8, 24)}</text>; })}</g>{methodNote(frame, settings, "Font size supports approximate prominence only; word position and color have no quantitative meaning.")}</>;
}

export function ScientificEnrichmentSpecializedPlot(props: Props) {
  if (props.type === "go-circle" || props.type === "kegg-circle") return <CircleTerms {...props} type={props.type} />;
  if (props.type === "go-chord") return <GoChord {...props} />;
  if (props.type === "pathway-impact") return <PathwayImpact {...props} />;
  if (props.type === "nes-fdr") return <NesFdr {...props} />;
  if (props.type === "multi-gsea") return <MultiGsea {...props} />;
  if (props.type === "enrichment-ridge") return <EnrichmentRidge {...props} />;
  if (props.type === "sankey-bubble") return <SankeyBubble {...props} />;
  if (props.type === "geographic-map") return <GeographicMap {...props} />;
  if (props.type === "petal") return <Petal {...props} />;
  return <WordCloud {...props} />;
}
