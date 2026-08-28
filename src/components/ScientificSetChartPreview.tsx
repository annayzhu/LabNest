"use client";

import {
  analyzeSetIntersections,
  radialIntersectionLayout,
  exactIntersectionCount,
  upsetAdaptiveLayout,
} from "@/lib/visualization-sets";
import {
  categoricalColorForIndex,
  type ParsedDataset,
  type VisualizationSettings,
} from "@/lib/visualization-studio";

type Frame = { width: number; height: number; left: number; right: number; top: number; bottom: number; plotWidth: number; plotHeight: number };
type Props = { type: "venn" | "upset"; frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[] };
const TEXT = "#23242A";

function polar(cx: number, cy: number, radius: number, angle: number) { return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius] as const; }
function sectorPath(cx: number, cy: number, inner: number, outer: number, start: number, end: number) {
  const a = polar(cx, cy, outer, start); const b = polar(cx, cy, outer, end); const c = polar(cx, cy, inner, end); const d = polar(cx, cy, inner, start); const large = end - start > Math.PI ? 1 : 0;
  return `M ${a[0]} ${a[1]} A ${outer} ${outer} 0 ${large} 1 ${b[0]} ${b[1]} L ${c[0]} ${c[1]} A ${inner} ${inner} 0 ${large} 0 ${d[0]} ${d[1]} Z`;
}
function arcPath(cx: number, cy: number, radius: number, start: number, end: number) { const a = polar(cx, cy, radius, start); const b = polar(cx, cy, radius, end); return `M ${a[0]} ${a[1]} A ${radius} ${radius} 0 ${end - start > Math.PI ? 1 : 0} 1 ${b[0]} ${b[1]}`; }

function RegionLabel({ x, y, count, signature, fontSize }: { x: number; y: number; count: number; signature: string; fontSize: number }) {
  return <text data-plot-label data-plot-element="set-region-label" data-intersection-signature={signature} x={x} y={y + fontSize * 0.34} textAnchor="middle" fill={TEXT} fontSize={fontSize} fontWeight={700}>{count}<title>{`${signature.split("\u0001").join(" ∩ ")}: ${count}`}</title></text>;
}

function SetLegend({ sets, frame, settings, colors }: { sets: string[]; frame: Frame; settings: VisualizationSettings; colors: string[] }) {
  const columns = Math.min(4, sets.length); const cellWidth = frame.width / Math.max(1, columns);
  const fontSize = Math.max(7, settings.tickSize - 2); const labelCapacity = Math.max(2, Math.floor((cellWidth - 20) / (fontSize * 0.58)));
  return <g data-no-clip="true" data-plot-element="set-legend">{sets.map((set, index) => { const x = 8 + (index % columns) * cellWidth; const y = frame.top + frame.plotHeight + 14 + Math.floor(index / columns) * 13; const visible = set.length > labelCapacity ? `${set.slice(0, Math.max(1, labelCapacity - 1))}…` : set; return <g key={set}><rect data-no-clip="true" x={x} y={y - 8} width={7} height={7} rx={1} fill={categoricalColorForIndex(index, colors)} /><text data-no-clip="true" data-full-label={set} x={x + 10} y={y - 1} fill={TEXT} fontSize={fontSize}>{visible}<title>{set}</title></text></g>; })}</g>;
}

function ClassicVenn({ frame, analysis, settings, colors }: { frame: Frame; analysis: ReturnType<typeof analyzeSetIntersections>; settings: VisualizationSettings; colors: string[] }) {
  const sets = analysis.sets; const baseRadius = Math.min(frame.plotWidth, frame.plotHeight) * (sets.length === 2 ? 0.29 : 0.255); const cx = frame.left + frame.plotWidth / 2; const cy = frame.top + frame.plotHeight * 0.49;
  const centers: Array<[number, number]> = sets.length === 2 ? [[cx - baseRadius * 0.42, cy], [cx + baseRadius * 0.42, cy]] : [[cx - baseRadius * 0.43, cy - baseRadius * 0.23], [cx + baseRadius * 0.43, cy - baseRadius * 0.23], [cx, cy + baseRadius * 0.48]];
  const maxSetSize = Math.max(...sets.map((set) => analysis.setSizes.get(set) ?? 0), 1);
  const radii = sets.map((set) => settings.vennProportional ? baseRadius * (0.66 + 0.34 * Math.sqrt((analysis.setSizes.get(set) ?? 0) / maxSetSize)) : baseRadius);
  const labels = sets.length === 2 ? [
    { wanted: [sets[0]], x: centers[0][0] - baseRadius * 0.54, y: cy },
    { wanted: [sets[1]], x: centers[1][0] + baseRadius * 0.54, y: cy },
    { wanted: sets, x: cx, y: cy },
  ] : [
    { wanted: [sets[0]], x: centers[0][0] - baseRadius * 0.55, y: centers[0][1] },
    { wanted: [sets[1]], x: centers[1][0] + baseRadius * 0.55, y: centers[1][1] },
    { wanted: [sets[2]], x: cx, y: centers[2][1] + baseRadius * 0.54 },
    { wanted: [sets[0], sets[1]], x: cx, y: cy - baseRadius * 0.53 },
    { wanted: [sets[0], sets[2]], x: cx - baseRadius * 0.35, y: cy + baseRadius * 0.21 },
    { wanted: [sets[1], sets[2]], x: cx + baseRadius * 0.35, y: cy + baseRadius * 0.21 },
    { wanted: sets, x: cx, y: cy + baseRadius * 0.02 },
  ];
  const setLabelPositions: Array<[number, number]> = sets.length === 2 ? [[cx - baseRadius * 1.08, cy - baseRadius * 0.92], [cx + baseRadius * 1.08, cy - baseRadius * 0.92]] : [[cx - baseRadius * 1.13, cy - baseRadius * 0.83], [cx + baseRadius * 1.13, cy - baseRadius * 0.83], [cx, cy + baseRadius * 1.48]];
  const labelCapacity = Math.max(3, Math.floor(baseRadius * 1.5 / (settings.tickSize * 0.58)));
  return <g data-plot-data data-plot-family="venn-classic" data-input-mode={analysis.mode} data-size-weighting={settings.vennProportional ? "set-size-radius-cue" : "none"}>
    {sets.map((set, index) => { const visible = set.length > labelCapacity ? `${set.slice(0, Math.max(2, labelCapacity - 1))}…` : set; return <g key={set}><circle data-plot-element="venn-set" data-set={set} cx={centers[index][0]} cy={centers[index][1]} r={radii[index]} fill={categoricalColorForIndex(index, colors)} fillOpacity={settings.opacity * 0.24} stroke={categoricalColorForIndex(index, colors)} strokeWidth={settings.dataLineWidth} /><text data-plot-label data-full-label={set} x={setLabelPositions[index][0]} y={setLabelPositions[index][1]} textAnchor="middle" fill={TEXT} fontSize={settings.tickSize} fontWeight={700}>{visible}<title>{set}</title></text></g>; })}
    {labels.map((entry) => { const signature = sets.filter((set) => entry.wanted.includes(set)).join("\u0001"); return <RegionLabel key={signature} x={entry.x} y={entry.y} count={exactIntersectionCount(analysis, entry.wanted)} signature={signature} fontSize={settings.axisLabelSize} />; })}
    {settings.vennProportional ? <text data-plot-label x={frame.left} y={frame.top + frame.plotHeight - 5} fill={TEXT} fontSize={Math.max(7, settings.tickSize - 3)}>Radius is a set-size cue, not an area-proportional fit; region counts are exact.</text> : null}
  </g>;
}

function RadialIntersections({ frame, analysis, settings, colors }: { frame: Frame; analysis: ReturnType<typeof analyzeSetIntersections>; settings: VisualizationSettings; colors: string[] }) {
  const cx = frame.left + frame.plotWidth / 2; const cy = frame.top + frame.plotHeight * 0.48; const radius = Math.min(frame.plotWidth, frame.plotHeight) * 0.31; const inner = radius * 0.28;
  const regions = radialIntersectionLayout(analysis, -Math.PI / 2, settings.vennProportional); const maximum = Math.max(...regions.map((region) => region.size), 1);
  return <g data-plot-data data-plot-family="venn-radial" data-input-mode={analysis.mode} data-layout="radial-exact-intersections" data-size-weighting={settings.vennProportional ? "intersection-angle" : "none"}>
    {regions.map((region) => { const label = polar(cx, cy, inner + (radius - inner) * 0.56, region.middle); const primarySet = analysis.sets.findIndex((set) => region.sets.includes(set)); return <g key={region.signature}><path data-plot-element="radial-intersection-region" data-intersection-signature={region.signature} data-intersection-size={region.size} d={sectorPath(cx, cy, inner, radius, region.start, region.end)} fill={categoricalColorForIndex(Math.max(0, primarySet), colors)} fillOpacity={settings.opacity * (0.16 + 0.24 * region.size / maximum)} stroke="#FFFFFF" strokeWidth={0.8}><title>{`${region.sets.join(" ∩ ")}: ${region.size}`}</title></path><RegionLabel x={label[0]} y={label[1]} count={region.size} signature={region.signature} fontSize={Math.max(7, settings.tickSize - (regions.length > 14 ? 3 : 1))} />{region.sets.map((set) => { const setIndex = analysis.sets.indexOf(set); return <path key={set} data-plot-element="radial-membership-arc" data-set={set} d={arcPath(cx, cy, radius + 4 + setIndex * 3, region.start, region.end)} fill="none" stroke={categoricalColorForIndex(setIndex, colors)} strokeWidth={2} />; })}</g>; })}
    <circle cx={cx} cy={cy} r={inner - 3} fill="#FFFFFF" stroke="#DDD9D2" /><text x={cx} y={cy - 2} textAnchor="middle" fill={TEXT} fontSize={settings.tickSize} fontWeight={700}>Radial</text><text x={cx} y={cy + 10} textAnchor="middle" fill={TEXT} fontSize={Math.max(7, settings.tickSize - 3)}>{regions.length} observed exact regions</text>
    <SetLegend sets={analysis.sets} frame={frame} settings={settings} colors={colors} />
  </g>;
}

function Venn({ frame, dataset, mapping, settings, colors }: Omit<Props, "type">) {
  const analysis = analyzeSetIntersections(dataset.rows, mapping, settings.setInputMode); const useRadial = settings.vennLayout === "radial" || analysis.sets.length > 3;
  return useRadial ? <RadialIntersections frame={frame} analysis={analysis} settings={settings} colors={colors} /> : <ClassicVenn frame={frame} analysis={analysis} settings={settings} colors={colors} />;
}

function UpSet({ frame, dataset, mapping, settings, colors }: Omit<Props, "type">) {
  const analysis = analyzeSetIntersections(dataset.rows, mapping, settings.setInputMode); const maximumVisible = Math.max(1, Math.min(settings.upsetMaxIntersections, Math.floor(frame.plotWidth / 24))); const intersections = analysis.intersections.slice(0, maximumVisible); const layout = upsetAdaptiveLayout(frame.top, frame.plotHeight, analysis.sets.length, intersections.length, frame.plotWidth, settings.tickSize); const maximumIntersection = Math.max(...intersections.map((entry) => entry.size), 1); const maximumSet = Math.max(...analysis.sets.map((set) => analysis.setSizes.get(set) ?? 0), 1);
  const summaryBarMaximumWidth = Math.max(24, frame.left - 50); const summaryFontSize = Math.max(7, settings.tickSize - 2); const summaryLabelCapacity = Math.max(1, Math.floor((frame.left - 18 - summaryBarMaximumWidth) / (summaryFontSize * 0.58)));
  return <g data-plot-data data-plot-family="upset" data-input-mode={analysis.mode} data-content-height={layout.contentBottom - layout.barTop}>
    <text data-plot-label x={frame.left} y={frame.top + 13} fill={TEXT} fontSize={settings.axisLabelSize} fontWeight={700}>Intersection size</text>
    <line x1={frame.left} x2={frame.left + frame.plotWidth} y1={layout.baseline} y2={layout.baseline} stroke={TEXT} strokeWidth={settings.axisLineWidth} />
    {intersections.map((entry, index) => { const height = entry.size / maximumIntersection * layout.barHeight; const x = frame.left + layout.band * (index + 0.5); const active = entry.sets.map((set) => analysis.sets.indexOf(set)); return <g key={entry.signature} data-plot-element="upset-intersection" data-intersection-signature={entry.signature} data-intersection-size={entry.size}><rect x={x - layout.band * 0.29} y={layout.baseline - height} width={layout.band * 0.58} height={height} rx={1} fill={colors[0]} fillOpacity={settings.opacity} /><text data-plot-label x={x} y={layout.baseline - height - 5} textAnchor="middle" fill={TEXT} fontSize={Math.max(8, settings.tickSize - 1)}>{entry.size}</text>{analysis.sets.map((set, setIndex) => <circle key={set} cx={x} cy={layout.matrixTop + setIndex * layout.rowGap} r={4.2} fill={entry.sets.includes(set) ? colors[1] ?? colors[0] : "#D5D6D8"} />)}{active.length > 1 ? <line x1={x} x2={x} y1={layout.matrixTop + Math.min(...active) * layout.rowGap} y2={layout.matrixTop + Math.max(...active) * layout.rowGap} stroke={colors[1] ?? colors[0]} strokeWidth={2} /> : null}<title>{`${entry.sets.join(" ∩ ")}: ${entry.size}`}</title></g>; })}
    <text data-no-clip="true" x={4} y={frame.top + 13} fill={TEXT} fontSize={Math.max(8, settings.tickSize - 1)} fontWeight={700}>Set size</text>
    {analysis.sets.map((set, index) => { const size = analysis.setSizes.get(set) ?? 0; const y = layout.matrixTop + index * layout.rowGap; const width = size / maximumSet * summaryBarMaximumWidth; const visible = set.length > summaryLabelCapacity ? `${set.slice(0, Math.max(1, summaryLabelCapacity - 1))}…` : set; return <g key={set} data-plot-element="upset-set-summary"><text data-no-clip="true" data-plot-element="upset-set-label" data-full-label={set} x={4} y={y + 3} fill={TEXT} fontSize={summaryFontSize}>{visible}<title>{set}</title></text><rect data-no-clip="true" data-plot-element="upset-set-bar" x={frame.left - 10 - width} y={y - 4} width={width} height={8} rx={1} fill={categoricalColorForIndex(index, colors)} fillOpacity={0.62} /><text data-no-clip="true" x={frame.left - 6} y={y + 3} fill={TEXT} fontSize={summaryFontSize}>{size}</text></g>; })}
    <text data-no-clip="true" x={frame.left} y={frame.top + frame.plotHeight + 18} fill={TEXT} fontSize={Math.max(7, settings.tickSize - 3)}>{`${analysis.memberships.size} unique ${analysis.mode === "peak-overlap" ? "atomic genomic segments" : "items"} · ${analysis.intersections.length} exact intersections${analysis.duplicatesCollapsed ? ` · ${analysis.duplicatesCollapsed} duplicates collapsed` : ""}`}</text>
  </g>;
}

export function ScientificSetPlot(props: Props) { return props.type === "venn" ? <Venn {...props} /> : <UpSet {...props} />; }
