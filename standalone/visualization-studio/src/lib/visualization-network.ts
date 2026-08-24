import { estimateLegendTextWidth, formatTick, numericExtent, parseNumericValue, scaleLinear, type DelimitedRow, type VisualizationSettings } from "./visualization-studio";

export type NetworkPlotType = "network" | "ppi" | "cerna" | "mirna-target" | "cnet" | "enrichment-map";
export type NetworkDirection = "directed" | "undirected" | "bidirectional";
export type NetworkSign = "positive" | "negative" | "neutral";
export type NetworkNode = { id: string; group: string; nodeType: string; value: number | null; explicit: boolean };
export type NetworkEdge = { source: string; target: string; weight: number; direction: NetworkDirection; sign: NetworkSign; edgeType: string; group: string; index: number };
export type NetworkFrame = { width: number; height: number; left: number; right: number; top: number; bottom: number; plotWidth: number; plotHeight: number };

const defaults: Record<NetworkPlotType, { direction: NetworkDirection; edgeType: string }> = {
  network: { direction: "undirected", edgeType: "relationship" },
  ppi: { direction: "undirected", edgeType: "interaction" },
  cerna: { direction: "directed", edgeType: "regulation" },
  "mirna-target": { direction: "directed", edgeType: "target" },
  cnet: { direction: "undirected", edgeType: "membership" },
  "enrichment-map": { direction: "undirected", edgeType: "overlap" },
};

function normalizedDirection(value: string, fallback: NetworkDirection): NetworkDirection | null {
  const normalized = value.trim().toLowerCase().replace(/[ _-]+/g, "");
  if (!normalized) return fallback;
  if (["directed", "forward", "source2target", "sourcetotarget", "->"].includes(normalized)) return "directed";
  if (["undirected", "none", "symmetric", "--"].includes(normalized)) return "undirected";
  if (["bidirectional", "both", "reciprocal", "<->"].includes(normalized)) return "bidirectional";
  return null;
}

function normalizedSign(value: string): NetworkSign | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized || ["neutral", "unknown", "0", "unsigned"].includes(normalized)) return "neutral";
  if (["positive", "activation", "activates", "+", "1"].includes(normalized)) return "positive";
  if (["negative", "inhibition", "inhibits", "-", "-1"].includes(normalized)) return "negative";
  return null;
}

export function parseNetworkRecords(type: NetworkPlotType, rows: DelimitedRow[], mapping: Record<string, string>) {
  const nodeMap = new Map<string, NetworkNode>();
  const edges: NetworkEdge[] = [];
  const invalidRecordTypes: number[] = [];
  const invalidDirections: number[] = [];
  const invalidSigns: number[] = [];
  const invalidWeights: number[] = [];
  const missingWeights: number[] = [];
  const invalidNodeValues: number[] = [];
  const missingNodeValues: number[] = [];
  const incompleteRows: number[] = [];
  const fallback = defaults[type];
  const addNode = (id: string, group = "Unspecified", nodeType = "Node", value: number | null = null, explicit = false) => {
    const trimmed = id.trim();
    if (!trimmed) return;
    const existing = nodeMap.get(trimmed);
    nodeMap.set(trimmed, {
      id: trimmed,
      group: explicit && group.trim() ? group.trim() : ((existing?.group ?? group.trim()) || "Unspecified"),
      nodeType: explicit && nodeType.trim() ? nodeType.trim() : ((existing?.nodeType ?? nodeType.trim()) || "Node"),
      value: explicit && value !== null ? value : existing?.value ?? value,
      explicit: Boolean(existing?.explicit || explicit),
    });
  };
  rows.forEach((row, index) => {
    const rawType = mapping.recordType ? row[mapping.recordType]?.trim().toLowerCase() : "";
    const inferredType = rawType || (mapping.node && row[mapping.node]?.trim() && !row[mapping.target]?.trim() ? "node" : "edge");
    if (!["node", "edge"].includes(inferredType)) { invalidRecordTypes.push(index + 2); return; }
    if (inferredType === "node") {
      const id = mapping.node ? row[mapping.node] ?? "" : row[mapping.source] ?? "";
      if (!id.trim()) { incompleteRows.push(index + 2); return; }
      const value = mapping.nodeValue ? parseNumericValue(row[mapping.nodeValue]) : null;
      if (mapping.nodeValue && !row[mapping.nodeValue]?.trim()) missingNodeValues.push(index + 2);
      else if (mapping.nodeValue && value === null) invalidNodeValues.push(index + 2);
      addNode(id, mapping.group ? row[mapping.group] ?? "" : "", mapping.nodeType ? row[mapping.nodeType] ?? "" : "", value, true);
      return;
    }
    const source = mapping.source ? row[mapping.source]?.trim() ?? "" : "";
    const target = mapping.target ? row[mapping.target]?.trim() ?? "" : "";
    if (!source || !target) { incompleteRows.push(index + 2); return; }
    const hasMappedWeight = Boolean(mapping.weight);
    const hasWeightValue = Boolean(mapping.weight && row[mapping.weight]?.trim());
    if (hasMappedWeight && !hasWeightValue) missingWeights.push(index + 2);
    const weight = hasWeightValue ? parseNumericValue(row[mapping.weight]) : 1;
    const direction = normalizedDirection(mapping.direction ? row[mapping.direction] ?? "" : "", fallback.direction);
    const sign = normalizedSign(mapping.sign ? row[mapping.sign] ?? "" : "");
    if (weight === null || weight < 0) invalidWeights.push(index + 2);
    if (!direction) invalidDirections.push(index + 2);
    if (!sign) invalidSigns.push(index + 2);
    addNode(source);
    addNode(target);
    if (weight !== null && weight >= 0 && direction && sign) edges.push({
      source,
      target,
      weight,
      direction,
      sign,
      edgeType: mapping.edgeType ? row[mapping.edgeType]?.trim() || fallback.edgeType : fallback.edgeType,
      group: mapping.group ? row[mapping.group]?.trim() || "Unspecified" : "Unspecified",
      index,
    });
  });
  return { nodes: [...nodeMap.values()], edges, invalidRecordTypes, invalidDirections, invalidSigns, invalidWeights, missingWeights, invalidNodeValues, missingNodeValues, incompleteRows };
}

function seededHash(value: string, seed: number) {
  let hash = (2166136261 ^ Math.trunc(seed)) >>> 0;
  for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

export function deterministicNetworkLayout(
  nodes: NetworkNode[],
  edges: NetworkEdge[],
  frame: { left: number; top: number; plotWidth: number; plotHeight: number },
  layout: VisualizationSettings["networkLayout"],
  seed: number,
) {
  const ordered = [...nodes].sort((left, right) => left.group.localeCompare(right.group, undefined, { numeric: true }) || seededHash(left.id, seed) - seededHash(right.id, seed) || left.id.localeCompare(right.id, undefined, { numeric: true }));
  const positions = new Map<string, { x: number; y: number }>();
  const cx = frame.left + frame.plotWidth / 2;
  const cy = frame.top + frame.plotHeight / 2;
  if (layout === "layered") {
    const groups = [...new Set(ordered.map((node) => node.group))];
    groups.forEach((group, groupIndex) => {
      const members = ordered.filter((node) => node.group === group);
      members.forEach((node, index) => positions.set(node.id, {
        x: frame.left + (groupIndex + 0.5) * frame.plotWidth / Math.max(1, groups.length),
        y: frame.top + (index + 1) * frame.plotHeight / (members.length + 1),
      }));
    });
  } else if (layout === "radial") {
    const degree = new Map(nodes.map((node) => [node.id, 0]));
    edges.forEach((edge) => { degree.set(edge.source, (degree.get(edge.source) ?? 0) + edge.weight); degree.set(edge.target, (degree.get(edge.target) ?? 0) + edge.weight); });
    const hub = [...ordered].sort((left, right) => (degree.get(right.id) ?? 0) - (degree.get(left.id) ?? 0) || left.id.localeCompare(right.id))[0];
    if (hub) positions.set(hub.id, { x: cx, y: cy });
    const outer = ordered.filter((node) => node.id !== hub?.id);
    const radius = Math.max(18, Math.min(frame.plotWidth, frame.plotHeight) * 0.39);
    outer.forEach((node, index) => { const angle = -Math.PI / 2 + index * Math.PI * 2 / Math.max(1, outer.length); positions.set(node.id, { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius }); });
  } else {
    const radius = Math.max(18, Math.min(frame.plotWidth, frame.plotHeight) * 0.41);
    const rotation = seededHash("rotation", seed) / 0xffffffff * Math.PI * 2;
    ordered.forEach((node, index) => { const angle = rotation - Math.PI / 2 + index * Math.PI * 2 / Math.max(1, ordered.length); positions.set(node.id, { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius }); });
  }
  return { positions, ordered };
}

export function networkFrameMetrics(settings: VisualizationSettings): NetworkFrame {
  const right = 22 + (settings.legendPosition === "right" ? 145 : 0);
  const bottom = settings.legendPosition === "bottom" ? 90 : 58;
  const left = 14;
  const top = settings.title ? 48 : 24;
  return { width: settings.width, height: settings.height, left, right, top, bottom, plotWidth: Math.max(100, settings.width - left - right), plotHeight: Math.max(90, settings.height - top - bottom) };
}

export function networkNodeRadii(nodes: NetworkNode[], edges: NetworkEdge[], mappedNodeValue: boolean) {
  const degree = new Map(nodes.map((node) => [node.id, 0]));
  edges.forEach((edge) => { degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1); degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1); });
  const completeValues = mappedNodeValue && nodes.length > 0 && nodes.every((node) => node.value !== null);
  const valueExtent = numericExtent(nodes.flatMap((node) => node.value === null ? [] : [node.value]), true);
  const mode = completeValues ? "value" as const : mappedNodeValue ? "fixed" as const : "degree" as const;
  const radii = new Map(nodes.map((node) => [node.id, mode === "value" ? scaleLinear(node.value!, valueExtent, [4, 10]) : mode === "degree" ? Math.min(9, 4 + Math.sqrt(degree.get(node.id) ?? 0)) : 5]));
  const dataValues = mode === "value" ? nodes.map((node) => node.value!) : mode === "degree" ? nodes.map((node) => degree.get(node.id) ?? 0) : [];
  const domain = dataValues.length > 0 ? [Math.min(...dataValues), Math.max(...dataValues)] as [number, number] : null;
  const radiusValues = [...radii.values()];
  const radiusExtent = [Math.min(...radiusValues), Math.max(...radiusValues)] as [number, number];
  return { radii, mode, domain, radiusExtent };
}

export function networkEncodingLegendEntries(nodes: NetworkNode[], edges: NetworkEdge[], mappedNodeValue: boolean, mappedWeight: boolean, settings: VisualizationSettings) {
  const { mode, domain, radiusExtent } = networkNodeRadii(nodes, edges, mappedNodeValue);
  const compactNumber = (value: number) => value !== 0 && (Math.abs(value) < 0.01 || Math.abs(value) >= 10_000) ? value.toExponential(1).replace(".0e", "e").replace("e+", "e") : formatTick(value);
  const compactRange = (range: [number, number]) => range[0] === range[1] ? compactNumber(range[0]) : `${compactNumber(range[0])}–${compactNumber(range[1])}`;
  const entries: Array<{ kind: "node-size" | "edge-width"; label: string }> = [
    { kind: "node-size", label: mode === "fixed" || !domain ? "Node size: constant" : `${mode === "value" ? "Node value" : "Degree"}: ${compactRange(domain)}` },
    { kind: "node-size", label: `Radius: ${compactRange(radiusExtent)} px` },
  ];
  if (mappedWeight && edges.length > 0) {
    const weights = edges.map((edge) => edge.weight);
    const weightDomain = [Math.min(...weights), Math.max(...weights)] as [number, number];
    entries.push({ kind: "edge-width", label: `Weight: ${compactRange(weightDomain)}` });
  }
  const scaleRange = [0.8, Math.max(1.8, settings.dataLineWidth * 1.8)] as [number, number];
  const weightExtent = numericExtent(edges.map((edge) => edge.weight), true);
  const observedWidths = edges.map((edge) => mappedWeight ? scaleLinear(edge.weight, weightExtent, scaleRange) : settings.dataLineWidth);
  const widthExtent = [Math.min(...observedWidths), Math.max(...observedWidths)] as [number, number];
  entries.push({ kind: "edge-width", label: `Width: ${compactRange(widthExtent)} px` });
  return entries;
}

type LabelBox = { id: string; left: number; right: number; top: number; bottom: number; text: string };

export function networkNodeLabelBoxes(nodes: NetworkNode[], positions: Map<string, { x: number; y: number }>, radii: Map<string, number>, frame: NetworkFrame, fontSize: number) {
  const boxes: LabelBox[] = [];
  nodes.forEach((node) => {
    const point = positions.get(node.id);
    if (!point) return;
    const radius = radii.get(node.id) ?? 5;
    const onLeft = point.x > frame.left + frame.plotWidth * 0.62;
    const available = Math.max(0, onLeft ? point.x - radius - frame.left - 4 : frame.left + frame.plotWidth - point.x - radius - 4);
    const capacity = Math.max(1, Math.min(14, Math.floor(available / Math.max(1, fontSize))));
    const text = node.id.length <= capacity ? node.id : capacity === 1 ? "…" : `${node.id.slice(0, capacity - 1)}…`;
    const width = Math.min(available, Math.max(fontSize, text.length * fontSize));
    const anchorX = point.x + (onLeft ? -radius - 3 : radius + 3);
    boxes.push({ id: node.id, left: onLeft ? anchorX - width : anchorX, right: onLeft ? anchorX : anchorX + width, top: point.y - fontSize * 0.75, bottom: point.y + fontSize * 0.25, text });
  });
  return boxes;
}

export type NetworkEdgeGeometry = { d: string; points: Array<{ x: number; y: number }> };

export function networkEdgeGeometries(edges: NetworkEdge[], positions: Map<string, { x: number; y: number }>, radii: Map<string, number>, frame: NetworkFrame) {
  const pairKey = (source: string, target: string) => [source, target].sort((left, right) => left.localeCompare(right, undefined, { numeric: true })).join("\u0000");
  const parallel = new Map<string, NetworkEdge[]>();
  edges.forEach((edge) => { const key = pairKey(edge.source, edge.target); parallel.set(key, [...(parallel.get(key) ?? []), edge]); });
  const geometries = new Map<number, NetworkEdgeGeometry>();
  parallel.forEach((unsortedSiblings) => {
    const siblings = [...unsortedSiblings].sort((left, right) => left.index - right.index);
    siblings.forEach((edge, siblingIndex) => {
      const source = positions.get(edge.source)!;
      const target = positions.get(edge.target)!;
      const sourceRadius = radii.get(edge.source) ?? 5;
      const targetRadius = radii.get(edge.target) ?? 5;
      if (edge.source === edge.target) {
        const centerDx = frame.left + frame.plotWidth / 2 - source.x;
        const centerDy = frame.top + frame.plotHeight / 2 - source.y;
        const centerLength = Math.hypot(centerDx, centerDy);
        const inwardX = centerLength < 1 ? 0 : centerDx / centerLength;
        const inwardY = centerLength < 1 ? -1 : centerDy / centerLength;
        const perpendicularX = -inwardY;
        const perpendicularY = inwardX;
        const loopScale = 1 + siblingIndex * 0.42;
        const start = { x: source.x + perpendicularX * sourceRadius * 0.68 + inwardX * sourceRadius * 0.25, y: source.y + perpendicularY * sourceRadius * 0.68 + inwardY * sourceRadius * 0.25 };
        const control1 = { x: source.x + perpendicularX * sourceRadius * 2.6 * loopScale + inwardX * sourceRadius * 2.7 * loopScale, y: source.y + perpendicularY * sourceRadius * 2.6 * loopScale + inwardY * sourceRadius * 2.7 * loopScale };
        const control2 = { x: source.x - perpendicularX * sourceRadius * 2.6 * loopScale + inwardX * sourceRadius * 2.7 * loopScale, y: source.y - perpendicularY * sourceRadius * 2.6 * loopScale + inwardY * sourceRadius * 2.7 * loopScale };
        const end = { x: source.x - perpendicularX * sourceRadius * 0.68 + inwardX * sourceRadius * 0.25, y: source.y - perpendicularY * sourceRadius * 0.68 + inwardY * sourceRadius * 0.25 };
        geometries.set(edge.index, { d: `M ${start.x} ${start.y} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${end.x} ${end.y}`, points: [start, control1, control2, end] });
        return;
      }
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      const start = { x: source.x + dx / length * sourceRadius, y: source.y + dy / length * sourceRadius };
      const end = { x: target.x - dx / length * targetRadius, y: target.y - dy / length * targetRadius };
      if (siblings.length === 1) {
        geometries.set(edge.index, { d: `M ${start.x} ${start.y} L ${end.x} ${end.y}`, points: [start, end] });
        return;
      }
      const [canonicalSourceId, canonicalTargetId] = [edge.source, edge.target].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
      const canonicalSource = positions.get(canonicalSourceId)!;
      const canonicalTarget = positions.get(canonicalTargetId)!;
      const canonicalDx = canonicalTarget.x - canonicalSource.x;
      const canonicalDy = canonicalTarget.y - canonicalSource.y;
      const canonicalLength = Math.max(1, Math.hypot(canonicalDx, canonicalDy));
      const perpendicularX = -canonicalDy / canonicalLength;
      const perpendicularY = canonicalDx / canonicalLength;
      const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      const towardCenter = (frame.left + frame.plotWidth / 2 - midpoint.x) * perpendicularX + (frame.top + frame.plotHeight / 2 - midpoint.y) * perpendicularY;
      const offset = (siblingIndex + 1) * 8 * (towardCenter >= 0 ? 1 : -1);
      const control = { x: midpoint.x + perpendicularX * offset, y: midpoint.y + perpendicularY * offset };
      geometries.set(edge.index, { d: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`, points: [start, control, end] });
    });
  });
  return geometries;
}

function boxesOverlap(left: LabelBox, right: LabelBox, gap = 0) {
  return left.left < right.right + gap && left.right + gap > right.left && left.top < right.bottom + gap && left.bottom + gap > right.top;
}

export function networkLayoutMetrics(settings: VisualizationSettings, nodes: NetworkNode[], edges: NetworkEdge[], mappedNodeValue: boolean, mappedWeight = true) {
  const frame = networkFrameMetrics(settings);
  const { positions } = deterministicNetworkLayout(nodes, edges, frame, settings.networkLayout, settings.networkSeed);
  const { radii } = networkNodeRadii(nodes, edges, mappedNodeValue);
  const nodesOutsidePlot = nodes.filter((node) => {
    const point = positions.get(node.id)!;
    const radius = radii.get(node.id) ?? 5;
    return point.x - radius < frame.left || point.x + radius > frame.left + frame.plotWidth || point.y - radius < frame.top || point.y + radius > frame.top + frame.plotHeight;
  }).length;
  let minimumCenterDistance = Number.POSITIVE_INFINITY;
  let nodeCollisionCount = 0;
  for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
    const left = nodes[leftIndex];
    const leftPoint = positions.get(left.id)!;
    for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
      const right = nodes[rightIndex];
      const rightPoint = positions.get(right.id)!;
      const distance = Math.hypot(rightPoint.x - leftPoint.x, rightPoint.y - leftPoint.y);
      minimumCenterDistance = Math.min(minimumCenterDistance, distance);
      if (distance < (radii.get(left.id) ?? 5) + (radii.get(right.id) ?? 5) + 2) nodeCollisionCount += 1;
    }
  }
  const labels = settings.showLabels ? networkNodeLabelBoxes(nodes, positions, radii, frame, settings.tickSize) : [];
  let labelCollisionCount = 0;
  for (let leftIndex = 0; leftIndex < labels.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < labels.length; rightIndex += 1) {
      if (boxesOverlap(labels[leftIndex], labels[rightIndex])) labelCollisionCount += 1;
    }
  }
  let labelNodeCollisionCount = 0;
  labels.forEach((box) => {
    nodes.forEach((node) => {
      if (node.id === box.id) return;
      const point = positions.get(node.id)!;
      const radius = radii.get(node.id) ?? 5;
      const closestX = Math.max(box.left, Math.min(point.x, box.right));
      const closestY = Math.max(box.top, Math.min(point.y, box.bottom));
      if (Math.hypot(point.x - closestX, point.y - closestY) < radius + 1) labelNodeCollisionCount += 1;
    });
  });
  const labelsOutsidePlot = labels.filter((box) => box.left < frame.left || box.right > frame.left + frame.plotWidth || box.top < frame.top || box.bottom > frame.top + frame.plotHeight).length;
  const edgeGeometries = networkEdgeGeometries(edges, positions, radii, frame);
  const edgeWeightExtent = numericExtent(edges.map((edge) => edge.weight), true);
  const maximumStrokeWidth = Math.max(...edges.map((edge) => mappedWeight ? scaleLinear(edge.weight, edgeWeightExtent, [0.8, Math.max(1.8, settings.dataLineWidth * 1.8)]) : settings.dataLineWidth));
  const edgeBoundaryMargin = Math.max(2, maximumStrokeWidth / 2 + 1, edges.some((edge) => edge.direction !== "undirected") ? 4.5 : 0);
  const edgeBoundaryIssues = [...edgeGeometries.values()].filter((geometry) => geometry.points.some((point) => point.x < frame.left + edgeBoundaryMargin || point.x > frame.left + frame.plotWidth - edgeBoundaryMargin || point.y < frame.top + edgeBoundaryMargin || point.y > frame.top + frame.plotHeight - edgeBoundaryMargin)).length;
  const duplicateEdgePaths = edgeGeometries.size - new Set([...edgeGeometries.values()].map((geometry) => geometry.d)).size;
  const density = edges.length / Math.max(1, nodes.length);
  return {
    ...frame,
    density,
    minimumCenterDistance: Number.isFinite(minimumCenterDistance) ? minimumCenterDistance : Number.POSITIVE_INFINITY,
    nodeCollisionCount,
    nodesOutsidePlot,
    labelCollisionCount,
    labelNodeCollisionCount,
    labelsOutsidePlot,
    edgeBoundaryIssues,
    edgeBoundaryMargin,
    duplicateEdgePaths,
    fits: nodes.length <= 120 && edges.length <= 400 && nodeCollisionCount === 0 && nodesOutsidePlot === 0 && labelCollisionCount === 0 && labelNodeCollisionCount === 0 && labelsOutsidePlot === 0 && edgeBoundaryIssues === 0 && duplicateEdgePaths === 0,
  };
}

export function networkLegendMetrics(settings: VisualizationSettings, groupCount: number, edgeTypeCount: number, signCount = 0, directionCount = 0, encodingCount = 0, labels: string[] = []) {
  if (settings.legendPosition === "none") return { entryCount: 0, columns: 0, rows: 0, requiredHeight: 0, availableHeight: Number.POSITIVE_INFINITY, cellWidth: Number.POSITIVE_INFINITY, requiredCellWidth: 0, widthFits: true, fits: true };
  const entryCount = Math.min(8, groupCount) + Math.min(4, edgeTypeCount) + Math.min(3, signCount) + Math.min(3, directionCount) + encodingCount;
  const plotWidth = Math.max(1, settings.width - 36);
  const columns = settings.legendPosition === "right" ? 1 : Math.max(2, Math.min(4, Math.floor(plotWidth / 72)));
  const rows = Math.ceil(entryCount / columns);
  const requiredHeight = rows * (settings.legendSize + 7);
  const availableHeight = settings.legendPosition === "right" ? Math.max(1, settings.height - (settings.title ? 48 : 24) - 12) : 78;
  const frame = networkFrameMetrics(settings);
  const startX = frame.left + frame.plotWidth + 12;
  const cellWidth = settings.legendPosition === "right" ? Math.max(1, settings.width - startX - 4) : frame.plotWidth / columns;
  const requiredCellWidth = labels.length > 0 ? Math.max(...labels.map((label) => 18 + estimateLegendTextWidth(label, settings.legendSize))) : 0;
  const widthFits = requiredCellWidth <= cellWidth;
  return { entryCount, columns, rows, requiredHeight, availableHeight, cellWidth, requiredCellWidth, widthFits, fits: requiredHeight <= availableHeight && widthFits };
}

export type HierarchyRecord = { id: string; parent: string; label: string; group: string; height: number; index: number };

export function parseHierarchyRecords(rows: DelimitedRow[], mapping: Record<string, string>) {
  return rows.map((row, index) => ({
    id: row[mapping.node]?.trim() ?? "",
    parent: mapping.parent ? row[mapping.parent]?.trim() ?? "" : "",
    label: mapping.label ? row[mapping.label]?.trim() || row[mapping.node]?.trim() || "" : row[mapping.node]?.trim() ?? "",
    group: mapping.group ? row[mapping.group]?.trim() || "Unspecified" : "Unspecified",
    height: mapping.height && row[mapping.height]?.trim() ? parseNumericValue(row[mapping.height]) ?? Number.NaN : 0,
    index,
  }));
}

export function hierarchyLayoutMetrics(settings: VisualizationSettings, leafCount: number, depth: number, showLabels: boolean) {
  const frame = networkFrameMetrics(settings);
  const { plotWidth, plotHeight } = frame;
  const leafSpan = settings.treeOrientation === "vertical" ? plotWidth : plotHeight;
  const endpointInset = hierarchyEndpointInset(settings);
  const depthSpan = Math.max(0, (settings.treeOrientation === "vertical" ? plotHeight : plotWidth) - endpointInset * 2);
  const leafSpacing = leafSpan / Math.max(1, leafCount);
  const depthSpacing = depthSpan / Math.max(1, depth);
  const nodeSpacing = Math.max(2.2, Math.max(2.5, settings.pointSize * 0.55)) * 2 + 2;
  const labelSpacing = settings.treeOrientation === "vertical" ? settings.tickSize * 1.4 : settings.tickSize + 2;
  return { ...frame, endpointInset, leafSpacing, depthSpacing, nodeSpacing, labelSpacing, fits: leafCount <= 120 && depth <= 30 && depthSpan > 0 && leafSpacing >= nodeSpacing && (!showLabels || leafSpacing >= labelSpacing) && depthSpacing >= nodeSpacing };
}

export function hierarchyEndpointInset(settings: VisualizationSettings) {
  const maximumNodeRadius = Math.max(2.2, Math.max(2.5, settings.pointSize * 0.55));
  return maximumNodeRadius + 1.6;
}
