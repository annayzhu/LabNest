"use client";

import {
  deterministicNetworkLayout,
  hierarchyEndpointInset,
  networkEncodingLegendEntries,
  networkEdgeGeometries,
  networkLegendMetrics,
  networkNodeLabelBoxes,
  networkNodeRadii,
  parseHierarchyRecords,
  parseNetworkRecords,
  type NetworkPlotType,
  type NetworkSign,
} from "@/lib/visualization-network";
import {
  categoricalColorForIndex,
  compactLegendLabel,
  formatTick,
  numericExtent,
  scaleLinear,
  type ParsedDataset,
  type PlotType,
  type VisualizationSettings,
} from "@/lib/visualization-studio";

export type RelationshipPlotType = NetworkPlotType | "tree" | "dendrogram";
type Frame = { width: number; height: number; left: number; right: number; top: number; bottom: number; plotWidth: number; plotHeight: number };
type Props = { type: RelationshipPlotType; frame: Frame; dataset: ParsedDataset; mapping: Record<string, string>; settings: VisualizationSettings; colors: string[] };
const TEXT = "#23242A";
const signColors: Record<NetworkSign, string> = { positive: "#327A64", negative: "#B65448", neutral: "#6E7078" };

export function isRelationshipPlotType(type: PlotType): type is RelationshipPlotType {
  return ["network", "ppi", "cerna", "mirna-target", "cnet", "enrichment-map", "tree", "dendrogram"].includes(type);
}

function edgeDash(index: number) {
  return [undefined, "6 3", "2 3", "8 3 2 3"][index % 4];
}

function NetworkLegend({ frame, settings, groups, edgeTypes, signs = [], directions = [], encodings = [], colors }: { frame: Frame; settings: VisualizationSettings; groups: string[]; edgeTypes: string[]; signs?: NetworkSign[]; directions?: string[]; encodings?: Array<{ kind: "node-size" | "edge-width"; label: string }>; colors: string[] }) {
  if (settings.legendPosition === "none") return null;
  const entries = [
    ...groups.slice(0, 8).map((label, index) => ({ kind: "node" as const, label: `Group: ${label}`, color: categoricalColorForIndex(index, colors), dash: undefined })),
    ...edgeTypes.slice(0, 4).map((label, index) => ({ kind: "edge" as const, label: `Type: ${label}`, color: TEXT, dash: edgeDash(index) })),
    ...signs.slice(0, 3).map((sign) => ({ kind: "sign" as const, label: `Sign: ${sign}`, color: signColors[sign], dash: undefined })),
    ...directions.slice(0, 3).map((direction) => ({ kind: "direction" as const, label: `Direction: ${direction}`, color: TEXT, dash: undefined })),
    ...encodings.map((entry) => ({ kind: entry.kind, label: entry.label, color: TEXT, dash: undefined })),
  ];
  const metrics = networkLegendMetrics(settings, groups.length, edgeTypes.length, signs.length, directions.length, encodings.length, encodings.map((entry) => entry.label));
  const startX = settings.legendPosition === "right" ? frame.left + frame.plotWidth + 12 : frame.left;
  const startY = settings.legendPosition === "right" ? frame.top + 4 : frame.height - 12 - metrics.requiredHeight;
  const columns = metrics.columns;
  const cellWidth = settings.legendPosition === "right" ? Math.max(72, frame.width - startX - 4) : frame.plotWidth / columns;
  return <g data-plot-element="network-legend" transform={`translate(${startX} ${startY})`}>{entries.map((entry, index) => { const x = settings.legendPosition === "right" ? 0 : index % columns * cellWidth; const y = settings.legendPosition === "right" ? index * (settings.legendSize + 7) : Math.floor(index / columns) * (settings.legendSize + 7); const scaleEntry = entry.kind === "node-size" || entry.kind === "edge-width"; return <g key={`${entry.kind}-${entry.label}`} data-legend-kind={entry.kind} data-direction-kind={entry.kind === "direction" ? entry.label.replace("Direction: ", "") : undefined} transform={`translate(${x} ${y})`}>{entry.kind === "node" ? <circle cx={4} cy={-3} r={4} fill={entry.color} /> : entry.kind === "direction" ? <><line x1={0} x2={10} y1={-3} y2={-3} stroke={entry.color} strokeWidth={1.5} /><path d="M7,-6 L11,-3 L7,0 Z" fill={entry.color} visibility={entry.label.endsWith("undirected") ? "hidden" : undefined} />{entry.label.endsWith("bidirectional") ? <path d="M4,-6 L0,-3 L4,0 Z" fill={entry.color} /> : null}</> : entry.kind === "node-size" ? <><circle cx={3} cy={-3} r={2} fill={TEXT} /><circle cx={9} cy={-3} r={4} fill="none" stroke={TEXT} /></> : <line x1={0} x2={10} y1={-3} y2={-3} stroke={entry.color} strokeWidth={entry.kind === "edge-width" ? 2.8 : 1.8} strokeDasharray={entry.dash} />}<text data-full-label={entry.label} x={14} y={0} fill={TEXT} fontSize={settings.legendSize}><title>{entry.label}</title>{scaleEntry ? entry.label : compactLegendLabel(entry.label, settings.legendSize, cellWidth - 18, 18)}</text></g>; })}</g>;
}

function NetworkPlot({ type, frame, dataset, mapping, settings, colors }: Omit<Props, "type"> & { type: NetworkPlotType }) {
  const parsed = parseNetworkRecords(type, dataset.rows, mapping);
  const visibleNodes = settings.networkShowIsolates ? parsed.nodes : parsed.nodes.filter((node) => parsed.edges.some((edge) => edge.source === node.id || edge.target === node.id));
  const nodeIds = new Set(visibleNodes.map((node) => node.id));
  const edges = parsed.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
  const { positions, ordered } = deterministicNetworkLayout(visibleNodes, edges, frame, settings.networkLayout, settings.networkSeed);
  const groups = [...new Set(ordered.map((node) => node.group))];
  const edgeTypes = [...new Set(edges.map((edge) => edge.edgeType))];
  const signs = [...new Set(edges.map((edge) => edge.sign))];
  const directions = [...new Set(edges.map((edge) => edge.direction))];
  const groupColors = new Map(groups.map((group, index) => [group, categoricalColorForIndex(index, colors)]));
  const edgeTypeIndex = new Map(edgeTypes.map((edgeType, index) => [edgeType, index]));
  const weightExtent = numericExtent(edges.map((edge) => edge.weight), true);
  const { radii } = networkNodeRadii(visibleNodes, edges, Boolean(mapping.nodeValue));
  const labelBoxes = networkNodeLabelBoxes(visibleNodes, positions, radii, frame, settings.tickSize);
  const labelByNode = new Map(labelBoxes.map((box) => [box.id, box]));
  const edgeGeometries = networkEdgeGeometries(edges, positions, radii, frame);
  const edgeScaleRange = [0.8, Math.max(1.8, settings.dataLineWidth * 1.8)] as [number, number];
  const strokeWidthFor = (weight: number) => mapping.weight ? scaleLinear(weight, weightExtent, edgeScaleRange) : settings.dataLineWidth;
  const encodings = networkEncodingLegendEntries(visibleNodes, edges, Boolean(mapping.nodeValue), Boolean(mapping.weight), settings);
  const markerId = `network-arrow-${type}`;
  const reverseMarkerId = `network-arrow-reverse-${type}`;
  return <><defs><marker id={markerId} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L7,3.5 L0,7 Z" fill="context-stroke" /></marker><marker id={reverseMarkerId} markerWidth="7" markerHeight="7" refX="1" refY="3.5" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M7,0 L0,3.5 L7,7 Z" fill="context-stroke" /></marker></defs><g data-plot-data data-plot-family={type}>{edges.map((edge) => { const strokeWidth = strokeWidthFor(edge.weight); return <g key={`${edge.index}-${edge.source}-${edge.target}`} data-plot-element="network-edge" data-direction={edge.direction} data-sign={edge.sign} data-edge-type={edge.edgeType} data-edge-group={edge.group}><path d={edgeGeometries.get(edge.index)?.d ?? ""} fill="none" stroke={signColors[edge.sign]} strokeWidth={strokeWidth} strokeOpacity={settings.networkEdgeOpacity} strokeDasharray={edgeDash(edgeTypeIndex.get(edge.edgeType) ?? 0)} strokeLinecap="round" markerEnd={edge.direction !== "undirected" ? `url(#${markerId})` : undefined} markerStart={edge.direction === "bidirectional" ? `url(#${reverseMarkerId})` : undefined}><title>{`${edge.source} → ${edge.target}; weight=${formatTick(edge.weight)}; direction=${edge.direction}; sign=${edge.sign}; type=${edge.edgeType}; group=${edge.group}`}</title></path></g>; })}{ordered.map((node) => { const point = positions.get(node.id)!; const radius = radii.get(node.id) ?? 5; const label = labelByNode.get(node.id); const labelOnLeft = Boolean(label && label.right <= point.x); return <g key={node.id} data-plot-element="network-node" data-node-id={node.id} data-explicit-node={node.explicit ? "true" : "false"}><circle cx={point.x} cy={point.y} r={radius} fill={groupColors.get(node.group)} fillOpacity={settings.opacity} stroke="#FFFFFF" strokeWidth={1.1}><title>{`${node.id}; group=${node.group}; type=${node.nodeType}${node.value === null ? "" : `; value=${formatTick(node.value)}`}`}</title></circle>{settings.showLabels && label ? <text data-plot-label data-full-label={node.id} x={labelOnLeft ? label.right : label.left} y={point.y + 3} textAnchor={labelOnLeft ? "end" : "start"} fill={TEXT} fontSize={settings.tickSize}><title>{node.id}</title>{label.text}</text> : null}</g>; })}</g><NetworkLegend frame={frame} settings={settings} groups={groups} edgeTypes={edgeTypes} signs={signs} directions={directions} encodings={encodings} colors={colors} /></>;
}

function HierarchyPlot({ type, frame, dataset, mapping, settings, colors }: Omit<Props, "type"> & { type: "tree" | "dendrogram" }) {
  const rows = parseHierarchyRecords(dataset.rows, mapping);
  const byId = new Map(rows.map((row) => [row.id, { ...row, children: [] as string[] }]));
  rows.forEach((row) => { if (row.parent && byId.has(row.parent)) byId.get(row.parent)!.children.push(row.id); });
  const root = rows.find((row) => !row.parent);
  if (!root) return null;
  const leaves: string[] = [];
  const depth = new Map<string, number>();
  const visit = (id: string, level: number) => { depth.set(id, level); const node = byId.get(id)!; if (!node.children.length) leaves.push(id); else node.children.forEach((child) => visit(child, level + 1)); };
  visit(root.id, 0);
  const maximumDepth = Math.max(1, ...depth.values());
  const observedMaximumHeight = Math.max(...rows.map((row) => row.height));
  const maximumHeight = type === "dendrogram" && observedMaximumHeight > 0 ? observedMaximumHeight : Number.EPSILON;
  const endpointInset = hierarchyEndpointInset(settings);
  const verticalDepthSpan = Math.max(1, frame.plotHeight - endpointInset * 2);
  const xById = new Map<string, number>();
  leaves.forEach((id, index) => xById.set(id, frame.left + (index + 0.5) * frame.plotWidth / Math.max(1, leaves.length)));
  const placeInternal = (id: string): number => { const node = byId.get(id)!; if (!node.children.length) return xById.get(id)!; const positions = node.children.map(placeInternal); const x = positions.reduce((sum, value) => sum + value, 0) / positions.length; xById.set(id, x); return x; };
  placeInternal(root.id);
  const yById = new Map(rows.map((row) => [row.id, frame.top + endpointInset + (type === "dendrogram" ? 1 - row.height / maximumHeight : (depth.get(row.id) ?? 0) / maximumDepth) * verticalDepthSpan]));
  const groups = [...new Set(rows.filter((row) => !byId.get(row.id)!.children.length).map((row) => row.group))];
  const groupColors = new Map(groups.map((group, index) => [group, categoricalColorForIndex(index, colors)]));
  const transform = (x: number, y: number) => settings.treeOrientation === "vertical" ? { x, y } : { x: frame.left + endpointInset + (y - frame.top - endpointInset) / verticalDepthSpan * Math.max(1, frame.plotWidth - endpointInset * 2), y: frame.top + (x - frame.left) / Math.max(1, frame.plotWidth) * frame.plotHeight };
  return <><g data-plot-data data-plot-family={type}>{rows.filter((row) => row.parent).map((row) => { const parent = byId.get(row.parent)!; const childPoint = transform(xById.get(row.id)!, yById.get(row.id)!); const parentPoint = transform(xById.get(parent.id)!, yById.get(parent.id)!); const d = settings.treeOrientation === "vertical" ? `M ${childPoint.x} ${childPoint.y} V ${parentPoint.y} H ${parentPoint.x}` : `M ${childPoint.x} ${childPoint.y} H ${parentPoint.x} V ${parentPoint.y}`; return <path key={`${row.parent}-${row.id}`} data-plot-element={`${type}-branch`} d={d} fill="none" stroke={TEXT} strokeWidth={settings.dataLineWidth * 0.72}><title>{`${row.parent} → ${row.id}${type === "dendrogram" ? `; merge height=${formatTick(parent.height)}` : ""}`}</title></path>; })}{rows.map((row) => { const point = transform(xById.get(row.id)!, yById.get(row.id)!); const leaf = !byId.get(row.id)!.children.length; const vertical = settings.treeOrientation === "vertical"; const labelX = vertical ? point.x : point.x - 6; const labelY = vertical ? point.y + settings.tickSize + 7 : point.y + 3; const labelWidth = vertical ? Math.min(72, frame.plotWidth / Math.max(1, leaves.length) * 0.9) : Math.min(82, frame.plotWidth * 0.4); return <g key={row.id} data-plot-element={`${type}-node`} data-node-id={row.id}><circle cx={point.x} cy={point.y} r={leaf ? Math.max(2.5, settings.pointSize * 0.55) : 2.2} fill={leaf ? groupColors.get(row.group) : "#FFFFFF"} stroke={TEXT} strokeWidth={0.9} />{settings.showLabels && leaf ? <text data-plot-element={`${type}-label`} data-full-label={row.label} x={labelX} y={labelY} textAnchor={vertical ? "middle" : "end"} fill={TEXT} fontSize={settings.tickSize} transform={vertical && leaves.length > 12 ? `rotate(-35 ${labelX} ${labelY})` : undefined}><title>{row.label}</title>{compactLegendLabel(row.label, settings.tickSize, Math.max(12, labelWidth), 16)}</text> : null}</g>; })}</g>{type === "dendrogram" ? <text x={frame.left} y={frame.top - 7} fill={TEXT} fontSize={Math.max(8, settings.tickSize - 1)}>Merge height: {formatTick(maximumHeight)}</text> : null}<NetworkLegend frame={frame} settings={settings} groups={groups} edgeTypes={[]} colors={colors} /></>;
}

export function ScientificRelationshipPlot(props: Props) {
  if (props.type === "tree" || props.type === "dendrogram") return <HierarchyPlot {...props} type={props.type} />;
  return <NetworkPlot {...props} type={props.type} />;
}
