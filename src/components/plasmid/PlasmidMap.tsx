"use client";

import { useMemo } from "react";
import { angleOf, arcPath, circularLabels, pointAt, stackFeatures, type FeaturePiece } from "@/lib/plasmid/layout";
import { featureLength, type Segment, type SequenceRecord } from "@/lib/plasmid/model";
import { featureColor } from "@/lib/plasmid/workbench";

type MapProps = {
  record: SequenceRecord;
  shape: "circular" | "linear";
  selection: Segment[];
  selectedFeature?: number;
  /** Features from this index on were found by the library; they are drawn dashed. */
  autoFrom?: number;
  onSelectFeature: (index: number) => void;
};

/** Labels beyond this many crowd the ring; the feature table still lists every one (F03). */
const MAX_LABELS = 32;

/** Both maps carry `data-i18n-ignore`: feature names are data (an "Insert" must not read 插入). */
export function PlasmidMap(props: MapProps) {
  return props.shape === "circular" ? <CircularMap {...props} /> : <LinearMap {...props} />;
}

function CircularMap({ record, selection, selectedFeature, autoFrom = Number.POSITIVE_INFINITY, onSelectFeature }: MapProps) {
  const length = record.sequence.length;
  const { pieces, laneCount } = useMemo(() => stackFeatures(record.features, length), [record.features, length]);
  const shown = useMemo(() => labelled(record), [record]);
  const radius = 150;
  const laneWidth = 10;
  const inner = (lane: number) => radius + 7 + lane * (laneWidth + 3);
  const labelRadius = inner(laneCount) + 10;
  const labels = useMemo(() => {
    const indexes = [...shown];
    return circularLabels(indexes.map((index) => record.features[index]), length, labelRadius, 13)
      .map((label) => ({ ...label, featureIndex: indexes[label.featureIndex] }));
  }, [record.features, shown, length, labelRadius]);
  const laneOf = new Map(pieces.map((piece) => [piece.featureIndex, piece.lane]));
  const reach = Math.max(labelRadius + 12, ...labels.map((label) => Math.abs(label.y) + 12));
  const side = labelRadius + (labels.length ? 130 : 12);
  return (
    <svg className="ln-pw-map-svg" data-i18n-ignore viewBox={`${-side} ${-reach} ${side * 2} ${reach * 2}`} role="img" aria-label={`${record.name}, circular map, ${length} bp`}>
      <circle r={radius} className="ln-pw-backbone" />
      <circle r={radius - 3} className="ln-pw-backbone-inner" />
      {ticks(length).map((position) => {
        const angle = angleOf(position, length);
        const outer = pointAt(angle, radius - 3);
        const tickEnd = pointAt(angle, radius - 9);
        const text = pointAt(angle, radius - 19);
        return (
          <g key={position} className="ln-pw-tick">
            <line x1={outer.x} y1={outer.y} x2={tickEnd.x} y2={tickEnd.y} />
            <text x={text.x} y={text.y} textAnchor="middle" dominantBaseline="middle">{(position + 1).toLocaleString("en-US")}</text>
          </g>
        );
      })}
      {selection.map((segment, index) => (
        <path key={`selection-${index}`} className="ln-pw-map-selection" d={arcPath({ start: segment.start, end: segment.end, strand: 0, arrow: false }, length, radius - 6, radius + 4)} />
      ))}
      {pieces.map((piece, index) => {
        const feature = record.features[piece.featureIndex];
        return (
          <path
            key={`piece-${index}`}
            d={arcPath(piece, length, inner(piece.lane), inner(piece.lane) + laneWidth)}
            fill={featureColor(feature)}
            className="ln-pw-feature"
            data-selected={piece.featureIndex === selectedFeature || undefined}
            data-auto={piece.featureIndex >= autoFrom || undefined}
            onClick={() => onSelectFeature(piece.featureIndex)}
          >
            <title>{`${feature.name} (${feature.type})`}</title>
          </path>
        );
      })}
      {labels.map((label) => {
        const feature = record.features[label.featureIndex];
        const from = pointAt(label.anchor, inner(laneOf.get(label.featureIndex) ?? 0) + laneWidth);
        const elbow = { x: label.x - (label.side === "right" ? 6 : -6), y: label.y };
        return (
          <g key={`label-${label.featureIndex}`} className="ln-pw-label" data-selected={label.featureIndex === selectedFeature || undefined} onClick={() => onSelectFeature(label.featureIndex)}>
            <polyline points={`${from.x},${from.y} ${elbow.x},${elbow.y} ${label.x},${label.y}`} />
            <text x={label.x + (label.side === "right" ? 3 : -3)} y={label.y} textAnchor={label.side === "right" ? "start" : "end"} dominantBaseline="middle">{shortName(feature.name)}</text>
            <title>{feature.name}</title>
          </g>
        );
      })}
      <text y={-8} textAnchor="middle" className="ln-pw-map-name">{record.name}</text>
      <text y={12} textAnchor="middle" className="ln-pw-map-length">{`${length.toLocaleString("en-US")} bp`}</text>
    </svg>
  );
}

function LinearMap({ record, selection, selectedFeature, autoFrom = Number.POSITIVE_INFINITY, onSelectFeature }: MapProps) {
  const length = record.sequence.length;
  const { pieces, laneCount } = useMemo(() => stackFeatures(record.features, length), [record.features, length]);
  const shown = useMemo(() => labelled(record), [record]);
  const width = 1000;
  const x = (position: number) => 12 + (position / Math.max(1, length)) * (width - 24);
  const backbone = 34;
  const laneTop = (lane: number) => backbone + 22 + lane * 26;
  const height = laneTop(laneCount) + 8;
  return (
    <svg className="ln-pw-map-svg" data-i18n-ignore viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${record.name}, linear map, ${length} bp`}>
      <line x1={x(0)} x2={x(length)} y1={backbone} y2={backbone} className="ln-pw-backbone-line" />
      {ticks(length).map((position) => (
        <g key={position} className="ln-pw-tick">
          <line x1={x(position)} x2={x(position)} y1={backbone - 5} y2={backbone} />
          <text x={x(position)} y={backbone - 10} textAnchor="middle">{(position + 1).toLocaleString("en-US")}</text>
        </g>
      ))}
      {selection.map((segment, index) => (
        <rect key={`selection-${index}`} className="ln-pw-map-selection" x={x(segment.start)} width={Math.max(1, x(segment.end) - x(segment.start))} y={backbone - 4} height={8} />
      ))}
      {pieces.map((piece, index) => {
        const feature = record.features[piece.featureIndex];
        const top = laneTop(piece.lane);
        const fits = shown.has(piece.featureIndex) && piece.arrow && x(piece.end) - x(piece.start) > feature.name.length * 6.5;
        return (
          <g key={`piece-${index}`} className="ln-pw-feature" data-selected={piece.featureIndex === selectedFeature || undefined} data-auto={piece.featureIndex >= autoFrom || undefined} onClick={() => onSelectFeature(piece.featureIndex)}>
            <polygon points={arrow(piece, x, top, 10)} fill={featureColor(feature)} />
            {fits ? <text x={(x(piece.start) + x(piece.end)) / 2} y={top - 3} textAnchor="middle" className="ln-pw-linear-label">{feature.name}</text> : null}
            <title>{`${feature.name} (${feature.type})`}</title>
          </g>
        );
      })}
    </svg>
  );
}

/** Map labels stop at a fixed length; the tooltip and the feature table keep the full name. */
function shortName(name: string) {
  return name.length > 24 ? `${name.slice(0, 23)}…` : name;
}

function tickStep(length: number) {
  const raw = Math.max(1, length / 8);
  const power = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((factor) => factor * power).find((step) => raw <= step) ?? 10 * power;
}

/** Base 1, then round 1-based numbers (500, 1,000, …); returned as 0-based positions. */
function ticks(length: number) {
  const step = tickStep(length);
  const positions = [0];
  for (let base = step; base < length - step / 3; base += step) positions.push(base - 1);
  return positions;
}

function labelled(record: SequenceRecord) {
  return new Set(record.features
    .map((feature, index) => ({ index, size: featureLength(feature) }))
    .sort((left, right) => right.size - left.size)
    .slice(0, MAX_LABELS)
    .map((item) => item.index));
}

function arrow(piece: FeaturePiece, x: (position: number) => number, top: number, height: number) {
  const left = x(piece.start);
  const right = Math.max(x(piece.end), left + 1);
  const head = piece.arrow && piece.strand !== 0 ? Math.min(7, (right - left) / 2) : 0;
  const middle = top + height / 2;
  if (!head) return `${left},${top} ${right},${top} ${right},${top + height} ${left},${top + height}`;
  if (piece.strand === 1) return `${left},${top} ${right - head},${top} ${right},${middle} ${right - head},${top + height} ${left},${top + height}`;
  return `${left + head},${top} ${right},${top} ${right},${top + height} ${left + head},${top + height} ${left},${middle}`;
}
