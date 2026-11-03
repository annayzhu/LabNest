import { featureLength, type Segment, type SequenceFeature, type Strand } from "./model";

/**
 * Geometry for the workbench views (F03). Pure functions: the map and the sequence view
 * draw what these return, so both use the same coordinates (0-based, half-open).
 */

export type FeaturePiece = {
  featureIndex: number;
  start: number;
  end: number;
  strand: Strand | 0;
  /** The piece holds the feature's 3' end (where the arrowhead goes). */
  arrow: boolean;
  lane: number;
};

/**
 * Splits features into pieces and stacks overlapping pieces into lanes, longest first
 * so big features sit nearest the backbone. One feature keeps one lane.
 */
export function stackFeatures(features: Array<Pick<SequenceFeature, "segments" | "strand">>, length: number) {
  const order = features
    .map((feature, index) => ({ index, size: featureLength(feature) }))
    .sort((left, right) => right.size - left.size || left.index - right.index);
  const lanes: Array<Array<{ start: number; end: number }>> = [];
  const laneOf = new Map<number, number>();
  for (const { index } of order) {
    const spans = features[index].segments.map((segment) => ({ start: segment.start, end: Math.max(segment.end, segment.start + 1) }));
    let lane = lanes.findIndex((taken) => spans.every((span) => taken.every((other) => span.end <= other.start || span.start >= other.end)));
    if (lane < 0) {
      lanes.push([]);
      lane = lanes.length - 1;
    }
    lanes[lane].push(...spans);
    laneOf.set(index, lane);
  }
  const pieces: FeaturePiece[] = [];
  features.forEach((feature, featureIndex) => {
    // Segments run 5'→3', so the last one holds the 3' end and the arrowhead.
    const arrowSegment = feature.segments.length - 1;
    feature.segments.forEach((segment, segmentIndex) => {
      if (segment.end <= segment.start || segment.end > length) return;
      pieces.push({ featureIndex, start: segment.start, end: segment.end, strand: feature.strand, arrow: segmentIndex === arrowSegment, lane: laneOf.get(featureIndex) ?? 0 });
    });
  });
  return { pieces, laneCount: lanes.length };
}

/** Angle in radians with 0 bp at 12 o'clock, clockwise. */
export function angleOf(position: number, length: number) {
  return (position / length) * 2 * Math.PI - Math.PI / 2;
}

export function pointAt(angle: number, radius: number) {
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

/**
 * SVG path for one feature piece on a circular map: an annular sector, with an arrowhead
 * at the 3' end when the piece is long enough to show one.
 */
export function arcPath(piece: Pick<FeaturePiece, "start" | "end" | "strand" | "arrow">, length: number, inner: number, outer: number) {
  const startAngle = angleOf(piece.start, length);
  const endAngle = angleOf(piece.end, length);
  const sweep = endAngle - startAngle;
  const middle = (inner + outer) / 2;
  const head = Math.min(Math.abs(sweep) * 0.5, (outer - inner) / middle);
  const large = sweep > Math.PI ? 1 : 0;
  const point = (angle: number, radius: number) => {
    const { x, y } = pointAt(angle, radius);
    return `${x.toFixed(2)} ${y.toFixed(2)}`;
  };
  if (!piece.arrow || piece.strand === 0 || head <= 0) {
    return `M ${point(startAngle, outer)} A ${outer} ${outer} 0 ${large} 1 ${point(endAngle, outer)} L ${point(endAngle, inner)} A ${inner} ${inner} 0 ${large} 0 ${point(startAngle, inner)} Z`;
  }
  if (piece.strand === 1) {
    const neck = endAngle - head;
    const largeBody = neck - startAngle > Math.PI ? 1 : 0;
    return `M ${point(startAngle, outer)} A ${outer} ${outer} 0 ${largeBody} 1 ${point(neck, outer)} L ${point(endAngle, middle)} L ${point(neck, inner)} A ${inner} ${inner} 0 ${largeBody} 0 ${point(startAngle, inner)} Z`;
  }
  const neck = startAngle + head;
  const largeBody = endAngle - neck > Math.PI ? 1 : 0;
  return `M ${point(startAngle, middle)} L ${point(neck, outer)} A ${outer} ${outer} 0 ${largeBody} 1 ${point(endAngle, outer)} L ${point(endAngle, inner)} A ${inner} ${inner} 0 ${largeBody} 0 ${point(neck, inner)} Z`;
}

export type MapLabel = { featureIndex: number; anchor: number; x: number; y: number; side: "left" | "right" };

/**
 * Places feature labels outside the ring at each feature's middle, then pushes labels on
 * the same side apart so they never overlap; a leader line joins label and feature.
 */
export function circularLabels(features: Array<Pick<SequenceFeature, "segments">>, length: number, radius: number, lineHeight: number) {
  const labels: MapLabel[] = features.map((feature, featureIndex) => {
    const biggest = [...feature.segments].sort((left, right) => (right.end - right.start) - (left.end - left.start))[0];
    const anchor = angleOf((biggest.start + biggest.end) / 2, length);
    const { x, y } = pointAt(anchor, radius);
    return { featureIndex, anchor, x, y, side: x >= 0 ? "right" : "left" };
  });
  for (const side of ["left", "right"] as const) {
    const column = labels.filter((label) => label.side === side).sort((left, right) => left.y - right.y);
    for (let index = 1; index < column.length; index += 1) {
      if (column[index].y - column[index - 1].y < lineHeight) column[index].y = column[index - 1].y + lineHeight;
    }
    // Pull the stack back up if it ran past the bottom of the circle.
    const overflow = column.length ? column[column.length - 1].y - (radius + lineHeight) : 0;
    if (overflow > 0) {
      for (let index = column.length - 1; index >= 0; index -= 1) {
        const limit = index === column.length - 1 ? column[index].y - overflow : column[index + 1].y - lineHeight;
        column[index].y = Math.min(column[index].y, limit);
      }
    }
    for (const label of column) label.x = (side === "right" ? 1 : -1) * Math.max(Math.abs(label.x), Math.sqrt(Math.max(0, radius * radius - label.y * label.y)) + 8);
  }
  return labels;
}

export type SequenceRow = { start: number; end: number; pieces: FeaturePiece[]; laneCount: number };

/** Rows of the double-strand sequence view, each with the feature pieces that fall in it. */
export function sequenceRows(length: number, features: Array<Pick<SequenceFeature, "segments" | "strand">>, basesPerRow: number): SequenceRow[] {
  const { pieces } = stackFeatures(features, length);
  const rows: SequenceRow[] = [];
  for (let start = 0; start < length; start += basesPerRow) {
    const end = Math.min(length, start + basesPerRow);
    const inside = pieces
      .filter((piece) => piece.start < end && piece.end > start)
      .map((piece) => ({ ...piece, start: Math.max(piece.start, start), end: Math.min(piece.end, end), arrow: piece.arrow && (piece.strand === -1 ? piece.start >= start : piece.end <= end) }));
    const lanes = [...new Set(inside.map((piece) => piece.lane))].sort((left, right) => left - right);
    rows.push({ start, end, pieces: inside.map((piece) => ({ ...piece, lane: lanes.indexOf(piece.lane) })), laneCount: lanes.length });
  }
  return rows;
}

/**
 * A clockwise selection from `start` to `end`. On a circular molecule `start > end` runs
 * across the origin and is split like a feature; on a linear one the ends are swapped.
 */
export function selectionSegments(start: number, end: number, length: number, circular: boolean): Segment[] {
  if (start === end) return [];
  if (start < end || !circular) return [{ start: Math.min(start, end), end: Math.max(start, end) }];
  return [{ start, end: length }, { start: 0, end }];
}

/** A stretch of an origin-extended (doubled) sequence, folded back onto a molecule of `length`: two segments when it crosses the origin. */
export function foldSegments(start: number, end: number, length: number): Segment[] {
  if (end <= length) return [{ start, end }];
  if (start >= length) return [{ start: start - length, end: end - length }];
  return [{ start, end: length }, { start: 0, end: end - length }];
}

/** Segments in top-strand (clockwise) order, as people read a location and as copied bases run. */
export function clockwiseSegments(feature: Pick<SequenceFeature, "segments" | "strand">) {
  return feature.strand === -1 ? [...feature.segments].reverse() : feature.segments;
}

/** 1-based closed display of 0-based half-open segments, e.g. "2,950–3,000 + 1–52". */
export function formatSegments(segments: Segment[]) {
  const number = (value: number) => value.toLocaleString("en-US");
  return segments.map((segment) => (segment.end - segment.start === 1 ? number(segment.start + 1) : `${number(segment.start + 1)}–${number(segment.end)}`)).join(" + ");
}
