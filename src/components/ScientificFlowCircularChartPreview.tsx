"use client";

import type { ReactNode } from "react";
import {
  aggregateFlowEdges,
  alluvialAxisOrder,
  approximateFlowTextWidth,
  chordSectorLayout,
  circosRadialLayout,
  circosCoordinateSystem,
  circosTrackOrder,
  compactFlowLabel,
  flowDisclosure,
  parseAlluvialRecords,
  parseCircosTrackRecords,
  parseLigandReceptorRecords,
} from "@/lib/visualization-flow-circular";
import {
  categoricalColorForIndex,
  interpolateColor,
  type ParsedDataset,
  type PlotType,
  type VisualizationSettings,
} from "@/lib/visualization-studio";

type Frame = { width: number; height: number; left: number; right: number; top: number; bottom: number; plotWidth: number; plotHeight: number };
type Props = { type: FlowCircularPlotType; frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[] };
export type FlowCircularPlotType = "sankey" | "alluvial" | "chord" | "ligand-receptor" | "circos";
const TEXT = "#23242A";

export function isFlowCircularPlotType(type: PlotType): type is FlowCircularPlotType {
  return ["sankey", "alluvial", "chord", "ligand-receptor", "circos"].includes(type);
}

function colorMap(labels: string[], colors: string[]) {
  return new Map([...new Set(labels)].map((label, index) => [label, categoricalColorForIndex(index, colors)]));
}

function FlowLabel({ label, x, y, settings, available = 82, anchor = "middle", weight, element, noClip = false }: { label: string; x: number; y: number; settings: VisualizationSettings; available?: number; anchor?: "start" | "middle" | "end"; weight?: number; element?: string; noClip?: boolean }) {
  const displayed = compactFlowLabel(label, settings.tickSize, available);
  return <text data-plot-label={noClip ? undefined : true} data-no-clip={noClip ? "true" : undefined} data-plot-element={element} data-full-label={label} x={x} y={y} textAnchor={anchor} fill={TEXT} fontSize={settings.tickSize} fontWeight={weight}>{displayed}<title>{label}</title></text>;
}

function horizontalLabelRoom(x: number, anchor: "start" | "middle" | "end", width: number) {
  if (anchor === "start") return Math.max(8, width - x - 4);
  if (anchor === "end") return Math.max(8, x - 4);
  return Math.max(8, Math.min(x - 4, width - x - 4) * 2);
}

function polar(cx: number, cy: number, radius: number, angle: number) {
  return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius] as const;
}

function arcPath(cx: number, cy: number, radius: number, start: number, end: number) {
  const a = polar(cx, cy, radius, start); const b = polar(cx, cy, radius, end);
  return `M ${a[0]} ${a[1]} A ${radius} ${radius} 0 ${end - start > Math.PI ? 1 : 0} 1 ${b[0]} ${b[1]}`;
}

function annularSectorPath(cx: number, cy: number, innerRadius: number, outerRadius: number, start: number, end: number) {
  const outerStart = polar(cx, cy, outerRadius, start); const outerEnd = polar(cx, cy, outerRadius, end);
  const innerEnd = polar(cx, cy, innerRadius, end); const innerStart = polar(cx, cy, innerRadius, start);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${outerStart[0]} ${outerStart[1]} A ${outerRadius} ${outerRadius} 0 ${large} 1 ${outerEnd[0]} ${outerEnd[1]} L ${innerEnd[0]} ${innerEnd[1]} A ${innerRadius} ${innerRadius} 0 ${large} 0 ${innerStart[0]} ${innerStart[1]} Z`;
}

function disclosureText(inputRows: number, aggregatedRows: number, total: number) {
  return `${inputRows} input rows · ${aggregatedRows ? `${aggregatedRows} repeated ${aggregatedRows === 1 ? "row" : "rows"} aggregated · ` : ""}total weight ${Number(total.toPrecision(5))}`;
}

function Sankey({ frame, dataset, mapping, settings, colors }: Omit<Props, "type">) {
  const disclosure = flowDisclosure(dataset.rows, mapping);
  const edges = disclosure.edges.filter((edge) => edge.value > 0);
  const sources = [...new Set(edges.map((edge) => edge.source))];
  const targets = [...new Set(edges.map((edge) => edge.target))];
  const labels = [...new Set([...sources, ...targets])];
  const colorsByNode = colorMap(labels, colors);
  const groups = mapping.group ? [...new Set(edges.map((edge) => edge.group))] : [];
  const colorsByGroup = colorMap(groups, colors);
  const left = frame.left + Math.min(72, frame.plotWidth * 0.22);
  const right = frame.left + frame.plotWidth - Math.min(72, frame.plotWidth * 0.22);
  const top = frame.top + 19;
  const availableHeight = Math.max(30, frame.plotHeight - 38);
  const total = Math.max(disclosure.total, Number.EPSILON);
  const gapLeft = Math.min(9, availableHeight * 0.18 / Math.max(1, sources.length - 1));
  const gapRight = Math.min(9, availableHeight * 0.18 / Math.max(1, targets.length - 1));
  const usableLeft = Math.max(8, availableHeight - gapLeft * Math.max(0, sources.length - 1));
  const usableRight = Math.max(8, availableHeight - gapRight * Math.max(0, targets.length - 1));
  const sourceTotals = new Map(sources.map((source) => [source, edges.filter((edge) => edge.source === source).reduce((sum, edge) => sum + edge.value, 0)]));
  const targetTotals = new Map(targets.map((target) => [target, edges.filter((edge) => edge.target === target).reduce((sum, edge) => sum + edge.value, 0)]));
  const sourceBlocks = new Map<string, { y: number; height: number; offset: number }>();
  const targetBlocks = new Map<string, { y: number; height: number; offset: number }>();
  let sourceCursor = top; sources.forEach((source) => { const height = (sourceTotals.get(source) ?? 0) / total * usableLeft; sourceBlocks.set(source, { y: sourceCursor, height, offset: 0 }); sourceCursor += height + gapLeft; });
  let targetCursor = top; targets.forEach((target) => { const height = (targetTotals.get(target) ?? 0) / total * usableRight; targetBlocks.set(target, { y: targetCursor, height, offset: 0 }); targetCursor += height + gapRight; });
  return <g data-plot-data data-plot-family="sankey">
    <FlowLabel label={disclosureText(disclosure.inputRows, disclosure.aggregatedRows, disclosure.total)} x={frame.left} y={frame.top + 10} anchor="start" available={frame.plotWidth} settings={{ ...settings, tickSize: Math.max(8, settings.tickSize - 2) }} />
    {edges.map((edge, index) => {
      const source = sourceBlocks.get(edge.source)!; const target = targetBlocks.get(edge.target)!;
      const sourceBand = edge.value / Math.max(sourceTotals.get(edge.source) ?? 1, Number.EPSILON) * source.height;
      const targetBand = edge.value / Math.max(targetTotals.get(edge.target) ?? 1, Number.EPSILON) * target.height;
      const sy = source.y + source.offset + sourceBand / 2; const ty = target.y + target.offset + targetBand / 2;
      source.offset += sourceBand; target.offset += targetBand;
      const ribbonColor = mapping.group ? colorsByGroup.get(edge.group) : colorsByNode.get(edge.source);
      return <path key={`${edge.source}-${edge.target}-${edge.group}-${index}`} data-plot-element="flow-ribbon" data-group={mapping.group ? edge.group : undefined} data-weight={edge.value} d={`M ${left + 10} ${sy} C ${left + frame.plotWidth * 0.31} ${sy}, ${right - frame.plotWidth * 0.31} ${ty}, ${right - 10} ${ty}`} fill="none" stroke={ribbonColor} strokeOpacity={settings.opacity * 0.58} strokeWidth={Math.max(0.8, Math.min(sourceBand, targetBand))}><title>{`${edge.source} → ${edge.target}${mapping.group ? ` · ${edge.group}` : ""} · ${edge.value}`}</title></path>;
    })}
    {sources.map((source) => { const block = sourceBlocks.get(source)!; return <g key={`s-${source}`}><rect data-plot-element="flow-node" x={left} y={block.y} width={10} height={Math.max(1, block.height)} rx={1.5} fill={colorsByNode.get(source)} />{settings.showLabels ? <FlowLabel label={source} x={left - 5} y={block.y + block.height / 2 + 3} anchor="end" available={58} settings={settings} /> : null}</g>; })}
    {targets.map((target) => { const block = targetBlocks.get(target)!; return <g key={`t-${target}`}><rect data-plot-element="flow-node" x={right - 10} y={block.y} width={10} height={Math.max(1, block.height)} rx={1.5} fill={colorsByNode.get(target)} />{settings.showLabels ? <FlowLabel label={target} x={right + 5} y={block.y + block.height / 2 + 3} anchor="start" available={58} settings={settings} /> : null}</g>; })}
    {groups.slice(0, 4).map((group, index) => <g key={`legend-${group}`} data-no-clip="true"><rect data-no-clip="true" x={frame.left + index * Math.max(46, frame.plotWidth / 4)} y={frame.top + frame.plotHeight - 8} width={7} height={7} fill={colorsByGroup.get(group)} /><FlowLabel noClip label={group} x={frame.left + 10 + index * Math.max(46, frame.plotWidth / 4)} y={frame.top + frame.plotHeight - 1} anchor="start" available={Math.max(30, frame.plotWidth / 4 - 12)} settings={{ ...settings, tickSize: Math.max(7, settings.tickSize - 2) }} /></g>)}
  </g>;
}

function Alluvial({ frame, dataset, mapping, settings, colors }: Omit<Props, "type">) {
  const records = parseAlluvialRecords(dataset.rows, mapping).filter((record) => record.flow && record.axis && record.stratum && record.value > 0);
  const axes = alluvialAxisOrder(records);
  const flows = [...new Set(records.map((record) => record.flow))];
  const groups = colorMap(records.map((record) => record.group), colors);
  const groupLabels = mapping.group ? [...new Set(records.map((record) => record.group))] : [];
  const axisX = new Map(axes.map((axis, index) => [axis, frame.left + 35 + (frame.plotWidth - 70) * index / Math.max(1, axes.length - 1)]));
  const axisSpacing = axes.length > 1 ? (frame.plotWidth - 70) / (axes.length - 1) : frame.plotWidth - 70;
  const top = frame.top + 26; const available = frame.plotHeight - 48;
  const positions = new Map<string, { y: number; height: number }>();
  axes.forEach((axis) => {
    const strata = [...new Set(records.filter((record) => record.axis === axis).map((record) => record.stratum))];
    const totals = new Map(strata.map((stratum) => [stratum, records.filter((record) => record.axis === axis && record.stratum === stratum).reduce((sum, record) => sum + record.value, 0)]));
    const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
    const gap = Math.min(8, available * 0.14 / Math.max(1, strata.length - 1));
    const usable = available - gap * Math.max(0, strata.length - 1);
    let cursor = top;
    strata.forEach((stratum) => { const height = (totals.get(stratum) ?? 0) / Math.max(total, Number.EPSILON) * usable; positions.set(`${axis}\u0000${stratum}`, { y: cursor, height }); cursor += height + gap; });
  });
  const offsets = new Map<string, number>();
  const flowSegments: ReactNode[] = [];
  flows.forEach((flow) => {
    const entries = axes.map((axis) => records.find((record) => record.flow === flow && record.axis === axis)).filter(Boolean) as typeof records;
    for (let index = 0; index < entries.length - 1; index += 1) {
      const source = entries[index]; const target = entries[index + 1];
      const sourceBlock = positions.get(`${source.axis}\u0000${source.stratum}`)!; const targetBlock = positions.get(`${target.axis}\u0000${target.stratum}`)!;
      const sourceTotal = records.filter((record) => record.axis === source.axis && record.stratum === source.stratum).reduce((sum, record) => sum + record.value, 0);
      const targetTotal = records.filter((record) => record.axis === target.axis && record.stratum === target.stratum).reduce((sum, record) => sum + record.value, 0);
      const sourceBand = source.value / sourceTotal * sourceBlock.height; const targetBand = target.value / targetTotal * targetBlock.height;
      const skey = `${source.axis}\u0000${source.stratum}\u0000out`; const tkey = `${target.axis}\u0000${target.stratum}\u0000in`;
      const sy = sourceBlock.y + (offsets.get(skey) ?? 0) + sourceBand / 2; const ty = targetBlock.y + (offsets.get(tkey) ?? 0) + targetBand / 2;
      offsets.set(skey, (offsets.get(skey) ?? 0) + sourceBand); offsets.set(tkey, (offsets.get(tkey) ?? 0) + targetBand);
      const sx = axisX.get(source.axis)! + 5; const tx = axisX.get(target.axis)! - 5;
      flowSegments.push(<path key={`${flow}-${index}`} data-plot-element="alluvial-ribbon" data-flow={flow} d={`M ${sx} ${sy} C ${(sx + tx) / 2} ${sy}, ${(sx + tx) / 2} ${ty}, ${tx} ${ty}`} fill="none" stroke={groups.get(source.group)} strokeWidth={Math.max(0.8, Math.min(sourceBand, targetBand))} strokeOpacity={settings.opacity * 0.55} />);
    }
  });
  return <g data-plot-data data-plot-family="alluvial">{flowSegments}{axes.flatMap((axis) => {
    const strata = [...new Set(records.filter((record) => record.axis === axis).map((record) => record.stratum))]; const x = axisX.get(axis)!;
    const titleAvailable = Math.max(8, axisSpacing - 8); const stratumFont = Math.max(8, settings.tickSize - 1); const stratumAvailable = Math.max(0, axisSpacing / 2 - 12); const showStratumText = settings.showLabels && stratumAvailable >= approximateFlowTextWidth("…", stratumFont);
    return [<FlowLabel key={`${axis}-title`} element="alluvial-axis-label" label={axis} x={x} y={frame.top + 11} available={titleAvailable} settings={settings} weight={700} />, ...strata.map((stratum) => { const block = positions.get(`${axis}\u0000${stratum}`)!; const outwardLeft = x <= frame.left + frame.plotWidth / 2; return <g key={`${axis}-${stratum}`}><rect data-plot-element="alluvial-stratum" x={x - 5} y={block.y} width={10} height={Math.max(1, block.height)} rx={1.5} fill={groups.get(records.find((record) => record.axis === axis && record.stratum === stratum)?.group ?? "") ?? colors[0]} />{showStratumText ? <FlowLabel element="alluvial-stratum-label" label={stratum} x={x + (outwardLeft ? -8 : 8)} y={block.y + block.height / 2 + 3} anchor={outwardLeft ? "end" : "start"} available={stratumAvailable} settings={{ ...settings, tickSize: stratumFont }} /> : null}</g>; })];
  })}{groupLabels.map((group, index) => <g key={`alluvial-group-${group}`} data-no-clip="true"><rect data-no-clip="true" data-plot-element="alluvial-group-swatch" x={frame.left + index * Math.max(46, frame.plotWidth / 4)} y={frame.top + frame.plotHeight - 8} width={7} height={7} fill={groups.get(group)} /><FlowLabel noClip label={group} x={frame.left + 10 + index * Math.max(46, frame.plotWidth / 4)} y={frame.top + frame.plotHeight - 1} anchor="start" available={Math.max(30, frame.plotWidth / 4 - 12)} settings={{ ...settings, tickSize: Math.max(7, settings.tickSize - 2) }} /></g>)}</g>;
}

function Chord({ frame, dataset, mapping, settings, colors }: Omit<Props, "type">) {
  const edges = aggregateFlowEdges(dataset.rows, { ...mapping, group: "" }).filter((edge) => edge.value > 0);
  const cx = frame.left + frame.plotWidth / 2; const cy = frame.top + frame.plotHeight / 2; const radius = Math.min(frame.plotWidth, frame.plotHeight) * 0.37;
  const { nodes, totals, sectors } = chordSectorLayout(edges, radius); const attachmentCursors = new Map(nodes.map((node) => [node, sectors.get(node)!.start]));
  const colorsByNode = colorMap(nodes, colors); const maximum = Math.max(...edges.map((edge) => edge.value), 1);
  return <g data-plot-data data-plot-family="chord">
    {nodes.map((node) => { const sector = sectors.get(node)!; const mid = (sector.start + sector.end) / 2; const label = polar(cx, cy, radius + 16, mid); const anchor = Math.cos(mid) > 0.15 ? "start" as const : Math.cos(mid) < -0.15 ? "end" as const : "middle" as const; return <g key={node}><path data-plot-element="chord-sector" d={arcPath(cx, cy, radius, sector.start, sector.end)} fill="none" stroke={colorsByNode.get(node)} strokeWidth={12} />{settings.showLabels ? <FlowLabel label={node} x={label[0]} y={label[1] + 3} anchor={anchor} available={horizontalLabelRoom(label[0], anchor, frame.width)} settings={settings} /> : null}</g>; })}
    {edges.map((edge, index) => { const sourceSector = sectors.get(edge.source)!; const targetSector = sectors.get(edge.target)!; const sourceSpan = (sourceSector.end - sourceSector.start) * edge.value / Math.max(totals.get(edge.source) ?? 1, Number.EPSILON); const targetSpan = (targetSector.end - targetSector.start) * edge.value / Math.max(totals.get(edge.target) ?? 1, Number.EPSILON); const sa = (attachmentCursors.get(edge.source) ?? sourceSector.start) + sourceSpan / 2; const ta = (attachmentCursors.get(edge.target) ?? targetSector.start) + targetSpan / 2; attachmentCursors.set(edge.source, (attachmentCursors.get(edge.source) ?? sourceSector.start) + sourceSpan); attachmentCursors.set(edge.target, (attachmentCursors.get(edge.target) ?? targetSector.start) + targetSpan); const source = polar(cx, cy, radius - 7, sa); const target = polar(cx, cy, radius - 7, ta); return <path key={`${edge.source}-${edge.target}-${index}`} data-plot-element="chord-ribbon" data-weight={edge.value} d={`M ${source[0]} ${source[1]} Q ${cx} ${cy} ${target[0]} ${target[1]}`} fill="none" stroke={colorsByNode.get(edge.source)} strokeOpacity={settings.opacity * 0.55} strokeWidth={Math.max(1, edge.value / maximum * 9)} />; })}
  </g>;
}

function LigandReceptor({ frame, dataset, mapping, settings, colors }: Omit<Props, "type">) {
  const records = parseLigandReceptorRecords(dataset.rows, mapping).filter((record) => record.sourceCell && record.targetCell && record.ligand && record.receptor && record.value > 0);
  const layers = [
    [...new Set(records.map((record) => record.sourceCell))],
    [...new Set(records.map((record) => record.ligand))],
    [...new Set(records.map((record) => record.receptor))],
    [...new Set(records.map((record) => record.targetCell))],
  ];
  const headings = ["Sender", "Ligand", "Receptor", "Receiver"];
  const x = layers.map((_, index) => frame.left + 32 + (frame.plotWidth - 64) * index / 3);
  const positions = new Map<string, [number, number]>();
  layers.forEach((layer, layerIndex) => layer.forEach((label, index) => positions.set(`${layerIndex}\u0000${label}`, [x[layerIndex], frame.top + 28 + (frame.plotHeight - 74) * (index + 0.5) / layer.length])));
  const categoryColors = colorMap([...layers[0], ...layers[3]], colors);
  const segmentMap = new Map<string, { layer: number; source: string; target: string; value: number; evidences: Set<string>; senders: Set<string> }>();
  records.forEach((record) => [[record.sourceCell, record.ligand], [record.ligand, record.receptor], [record.receptor, record.targetCell]].forEach((pair, layer) => { const key = `${layer}\u0000${pair[0]}\u0000${pair[1]}`; const current = segmentMap.get(key) ?? { layer, source: pair[0], target: pair[1], value: 0, evidences: new Set<string>(), senders: new Set<string>() }; current.value += record.value; current.evidences.add(record.evidence); current.senders.add(record.sourceCell); segmentMap.set(key, current); }));
  const segments = [...segmentMap.values()]; const max = Math.max(...segments.map((segment) => segment.value), 1);
  const evidenceTypes = [...new Set(records.map((record) => record.evidence))];
  return <g data-plot-data data-plot-family="ligand-receptor">{segments.map((segment) => { const source = positions.get(`${segment.layer}\u0000${segment.source}`)!; const target = positions.get(`${segment.layer + 1}\u0000${segment.target}`)!; const evidence = [...segment.evidences].join(", "); const senders = [...segment.senders]; const stroke = senders.length === 1 ? categoryColors.get(senders[0]) : "#7C7E83"; return <path key={`${segment.layer}-${segment.source}-${segment.target}`} data-plot-element="ligand-receptor-edge" data-evidence={evidence} data-senders={senders.join(", ")} data-weight={segment.value} d={`M ${source[0] + 5} ${source[1]} C ${(source[0] + target[0]) / 2} ${source[1]}, ${(source[0] + target[0]) / 2} ${target[1]}, ${target[0] - 5} ${target[1]}`} fill="none" stroke={stroke} strokeWidth={Math.max(0.8, segment.value / max * 6)} strokeOpacity={settings.opacity * 0.5}><title>{`${segment.source} → ${segment.target} · summed weight ${segment.value} · sender(s) ${senders.join(", ")} · ${evidence}`}</title></path>; })}{layers.flatMap((layer, layerIndex) => [<FlowLabel key={`h-${layerIndex}`} label={headings[layerIndex]} x={x[layerIndex]} y={frame.top + 11} available={Math.max(42, frame.plotWidth / 4 - 8)} settings={{ ...settings, tickSize: Math.max(8, settings.tickSize - 1) }} weight={700} />, ...layer.map((label) => { const point = positions.get(`${layerIndex}\u0000${label}`)!; return <g key={`${layerIndex}-${label}`}><circle data-plot-element="ligand-receptor-node" cx={point[0]} cy={point[1]} r={4.2} fill={layerIndex === 0 || layerIndex === 3 ? categoryColors.get(label) : colors[(layerIndex + 1) % colors.length]} stroke="#FFFFFF" strokeWidth={1} />{settings.showLabels ? <FlowLabel label={label} x={point[0]} y={point[1] + (layerIndex % 2 ? -7 : 13)} available={Math.max(36, frame.plotWidth / 4 - 8)} settings={{ ...settings, tickSize: Math.max(7, settings.tickSize - 2) }} /> : null}</g>; })])}<FlowLabel label={`Width = summed weight · shared-sender paths = gray · Evidence: ${evidenceTypes.join("; ")}`} x={frame.left} y={frame.top + frame.plotHeight - 4} anchor="start" available={frame.plotWidth} settings={{ ...settings, tickSize: Math.max(7, settings.tickSize - 3) }} /></g>;
}

function Circos({ frame, dataset, mapping, settings, colors }: Omit<Props, "type">) {
  const records = parseCircosTrackRecords(dataset.rows, mapping);
  const coordinates = circosCoordinateSystem(records);
  const tracks = circosTrackOrder(records);
  const cx = frame.left + frame.plotWidth / 2; const cy = frame.top + frame.plotHeight / 2;
  const hasScatter = records.some((record) => record.type === "scatter");
  const radial = circosRadialLayout(frame.plotWidth, frame.plotHeight, tracks.length, settings.genomicTrackGap, settings.pointSize, hasScatter);
  const outer = radial.outer; const band = Math.max(1, radial.band);
  const radiusFor = (track: string) => Math.max(14, radial.radii[tracks.indexOf(track)] ?? outer - 17);
  const chromosomeColors = colorMap(coordinates.chromosomes, colors);
  const numericTracks = tracks.filter((track) => records.some((record) => record.track === track && ["bar", "heatmap", "scatter"].includes(record.type)));
  const scales = new Map(numericTracks.map((track) => { const trackRecords = records.filter((record) => record.track === track && ["bar", "heatmap", "scatter"].includes(record.type)); const values = trackRecords.map((record) => record.value); const isBar = trackRecords.every((record) => record.type === "bar"); const minimum = isBar ? 0 : Math.min(...values); const maximum = Math.max(...values); return [track, { minimum, maximum, type: trackRecords[0]?.type ?? "scatter" }]; }));
  const fraction = (track: string, value: number) => { const scale = scales.get(track) ?? { minimum: 0, maximum: 1 }; return Math.max(0, Math.min(1, scale.maximum === scale.minimum ? 1 : (value - scale.minimum) / (scale.maximum - scale.minimum))); };
  const hasCorrelation = records.some((record) => record.type === "correlation");
  const links = records.filter((record) => ["link", "fusion", "correlation"].includes(record.type) && !(record.type === "correlation" && record.value === 0));
  return <g data-plot-data data-plot-family="circos" data-coordinate-system="shared-genomic">
    {coordinates.chromosomes.map((chromosome) => { const sector = coordinates.sectors.get(chromosome)!; const mid = (sector.start + sector.end) / 2; const label = polar(cx, cy, outer + 13, mid); const anchor = Math.cos(mid) > 0.16 ? "start" as const : Math.cos(mid) < -0.16 ? "end" as const : "middle" as const; return <g key={chromosome}><path data-plot-element="circos-chromosome" d={arcPath(cx, cy, outer, sector.start, sector.end)} fill="none" stroke={chromosomeColors.get(chromosome)} strokeWidth={11} />{settings.showLabels ? <FlowLabel label={chromosome} x={label[0]} y={label[1] + 3} anchor={anchor} available={horizontalLabelRoom(label[0], anchor, frame.width)} settings={{ ...settings, tickSize: Math.max(8, settings.tickSize - 1) }} weight={700} /> : null}</g>; })}
    {tracks.map((track) => {
      const radius = radiusFor(track);
      return <g key={track} data-circos-track={track}>
        <path d={arcPath(cx, cy, radius, -Math.PI / 2, Math.PI * 1.499999)} fill="none" stroke="#ECE9E4" strokeWidth={band} />
        {records.filter((record) => record.track === track).map((record, index) => {
          const start = coordinates.angle(record.chromosome, record.start); const end = coordinates.angle(record.chromosome, record.end); const middle = (start + end) / 2;
          if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
          if (record.type === "bar") {
            const inner = radius - band / 2; const barFraction = (scales.get(track)?.maximum ?? 0) <= 0 ? 0 : fraction(track, record.value); const outerValue = inner + band * barFraction;
            if (outerValue <= inner + 1e-6) return null;
            return <path key={index} data-plot-element="circos-bar" data-inner-radius={inner} data-outer-radius={outerValue} d={annularSectorPath(cx, cy, inner, outerValue, start, end)} fill={chromosomeColors.get(record.chromosome)} fillOpacity={settings.opacity}><title>{`${track}: ${record.value}`}</title></path>;
          }
          if (record.type === "heatmap") return <path key={index} data-plot-element="circos-heatmap" d={arcPath(cx, cy, radius, start, end)} fill="none" stroke={interpolateColor(settings.continuousLow, settings.continuousHigh, fraction(track, record.value))} strokeWidth={band}><title>{`${track}: ${record.value}`}</title></path>;
          if (record.type === "scatter") { const pointRadius = Math.min(radial.scatterRadius, Math.max(0.8, band / 2 - 0.4)); const radialRoom = Math.max(0, band - pointRadius * 2); const point = polar(cx, cy, radius - band / 2 + pointRadius + fraction(track, record.value) * radialRoom, middle); return <circle key={index} data-plot-element="circos-scatter" cx={point[0]} cy={point[1]} r={pointRadius} fill={chromosomeColors.get(record.chromosome)} stroke="#FFFFFF" strokeWidth={0.7}><title>{`${track}: ${record.value}`}</title></circle>; }
          const point = polar(cx, cy, radius, middle);
          return settings.showLabels ? <FlowLabel key={index} label={record.label} x={point[0]} y={point[1] - 3} available={42} settings={{ ...settings, tickSize: Math.max(7, settings.tickSize - 3) }} /> : null;
        })}
      </g>;
    })}
    {links.map((record, index) => { const sourceAngle = coordinates.angle(record.chromosome, (record.start + record.end) / 2); const targetAngle = coordinates.angle(record.targetChromosome, (record.targetStart + record.targetEnd) / 2); const linkRadius = Math.max(16, radial.minimumRadius - 4); const source = polar(cx, cy, linkRadius, sourceAngle); const target = polar(cx, cy, linkRadius, targetAngle); const stroke = record.type === "fusion" ? colors[2 % colors.length] : record.type === "correlation" ? (record.value < 0 ? settings.continuousLow : settings.continuousHigh) : chromosomeColors.get(record.chromosome); return <path key={index} data-plot-element={`circos-${record.type}`} data-value={record.value} d={`M ${source[0]} ${source[1]} Q ${cx} ${cy} ${target[0]} ${target[1]}`} fill="none" stroke={stroke} strokeWidth={Math.max(0.8, Math.min(5, record.type === "correlation" ? Math.abs(record.value) * 4 : record.value))} strokeDasharray={record.type === "correlation" ? "3 2" : undefined} strokeOpacity={settings.opacity * 0.62}><title>{`${record.type}: ${record.value} · ${record.label}`}</title></path>; })}
    {numericTracks.length > 0 || hasCorrelation ? <g data-no-clip="true" data-plot-element="circos-scale-legend"><defs>{numericTracks.filter((track) => scales.get(track)?.type === "heatmap").map((track, index) => <linearGradient key={track} id={`circos-heat-legend-${index}`}><stop offset="0%" stopColor={settings.continuousLow} /><stop offset="100%" stopColor={settings.continuousHigh} /></linearGradient>)}</defs>{numericTracks.map((track, index) => { const scale = scales.get(track)!; const x = frame.left + (index % 2) * (frame.width / 2); const y = frame.top + frame.plotHeight + 12 + Math.floor(index / 2) * 10; const heatIndex = numericTracks.filter((candidate) => scales.get(candidate)?.type === "heatmap").indexOf(track); return <g key={track} data-plot-element="circos-scale-entry"><rect data-no-clip="true" data-plot-element={scale.type === "heatmap" ? "circos-heatmap-gradient" : "circos-value-swatch"} x={x} y={y - 6} width={24} height={5} rx={1} fill={scale.type === "heatmap" ? `url(#circos-heat-legend-${heatIndex})` : chromosomeColors.get(coordinates.chromosomes[0])} /><FlowLabel noClip label={`${track}: ${Number(scale.minimum.toPrecision(3))}–${Number(scale.maximum.toPrecision(3))}`} x={x + 28} y={y} anchor="start" available={frame.width / 2 - 46} settings={{ ...settings, tickSize: 7 }} /></g>; })}{hasCorrelation ? <g data-plot-element="circos-correlation-key"><rect data-no-clip="true" x={frame.left} y={frame.top + frame.plotHeight + 42} width={7} height={7} fill={settings.continuousLow} /><FlowLabel noClip label="r < 0" x={frame.left + 10} y={frame.top + frame.plotHeight + 49} anchor="start" available={34} settings={{ ...settings, tickSize: 7 }} /><rect data-no-clip="true" x={frame.left + 49} y={frame.top + frame.plotHeight + 42} width={7} height={7} fill={settings.continuousHigh} /><FlowLabel noClip label="r > 0 · dashed width = |r|" x={frame.left + 59} y={frame.top + frame.plotHeight + 49} anchor="start" available={frame.width - frame.left - 70} settings={{ ...settings, tickSize: 7 }} /></g> : null}</g> : null}
  </g>;
}

export function ScientificFlowCircularPlot(props: Props) {
  if (props.type === "sankey") return <Sankey {...props} />;
  if (props.type === "alluvial") return <Alluvial {...props} />;
  if (props.type === "chord") return <Chord {...props} />;
  if (props.type === "ligand-receptor") return <LigandReceptor {...props} />;
  return <Circos {...props} />;
}
