"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { dnaComplement } from "@/lib/sequence";
import { sequenceRows } from "@/lib/plasmid/layout";
import type { Segment, SequenceRecord } from "@/lib/plasmid/model";
import { featureColor } from "@/lib/plasmid/workbench";

type SequenceViewProps = {
  record: SequenceRecord;
  selection: Segment[];
  selectedFeature?: number;
  onSelectRange: (start: number, end: number) => void;
  onSelectFeature: (index: number) => void;
};

// Must match the CSS: an 18px line per strand and a 36px selection band (.ln-pw-sel).
const LINE = 18;
const LANE = 14;

function rowHeight(laneCount: number) {
  return LINE * 2 + laneCount * LANE + 14;
}

/**
 * Double-strand view (F03). Bases sit in `ch` columns of the mono font, so a pointer
 * position maps straight to a base; only the rows in view are rendered, which keeps a
 * 100 kb sequence usable (PRD §9).
 */
export function SequenceView({ record, selection, selectedFeature, onSelectRange, onSelectFeature }: SequenceViewProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(720);
  const [charWidth, setCharWidth] = useState(8.4);
  const [viewport, setViewport] = useState({ top: 0, height: 640 });
  const drag = useRef<{ anchor: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      if (probe.current) setCharWidth(probe.current.getBoundingClientRect().width / 10 || 8.4);
      if (scroller.current) {
        setWidth(scroller.current.clientWidth);
        setViewport({ top: scroller.current.scrollTop, height: scroller.current.clientHeight });
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (scroller.current) observer.observe(scroller.current);
    return () => observer.disconnect();
  }, []);

  // Whole tens of bases per row, from the width left after the two position columns.
  const basesPerRow = Math.max(10, Math.floor((width - 16 * charWidth - 24) / charWidth / 10) * 10);
  const rows = useMemo(() => sequenceRows(record.sequence.length, record.features, basesPerRow), [record, basesPerRow]);
  const offsets = useMemo(() => {
    const result = [0];
    for (const row of rows) result.push(result[result.length - 1] + rowHeight(row.laneCount));
    return result;
  }, [rows]);
  const complement = useMemo(() => [...record.sequence].map((base) => dnaComplement[base] ?? "N").join(""), [record.sequence]);

  useEffect(() => {
    // Bring the start of a new selection into view when it was made elsewhere (map, table).
    const first = selection[0];
    if (!first || !scroller.current || drag.current) return;
    const rowIndex = Math.floor(first.start / basesPerRow);
    const top = offsets[rowIndex] ?? 0;
    const view = scroller.current;
    if (top < view.scrollTop || top > view.scrollTop + view.clientHeight - 60) view.scrollTo({ top: Math.max(0, top - 40) });
  }, [selection, basesPerRow, offsets]);

  const rowAt = (y: number) => offsets.findIndex((_, index) => offsets[index + 1] > y);
  const first = Math.max(0, rowAt(viewport.top) - 2);
  let last = first;
  while (last < rows.length && offsets[last] < viewport.top + viewport.height + 200) last += 1;

  const baseAt = (event: PointerEvent<HTMLDivElement>, rowStart: number, rowEnd: number) => {
    const box = event.currentTarget.getBoundingClientRect();
    return Math.min(rowEnd, Math.max(rowStart, rowStart + Math.round((event.clientX - box.left) / charWidth)));
  };

  return (
    <div className="ln-pw-seq" ref={scroller} data-i18n-ignore onScroll={(event) => setViewport({ top: event.currentTarget.scrollTop, height: event.currentTarget.clientHeight })}>
      <span ref={probe} className="ln-pw-probe" aria-hidden>0000000000</span>
      <div style={{ height: offsets[offsets.length - 1], position: "relative" }}>
        {rows.slice(first, last).map((row, index) => {
          const rowIndex = first + index;
          return (
            <div key={row.start} className="ln-pw-row" style={{ top: offsets[rowIndex], height: rowHeight(row.laneCount) }}>
              <span className="ln-pw-pos">{(row.start + 1).toLocaleString("en-US")}</span>
              <div
                className="ln-pw-strands"
                style={{ width: `${basesPerRow}ch` }}
                onPointerDown={(event) => {
                  // A finger on the bases scrolls the page; selecting by dragging is for a mouse or pen.
                  if (event.pointerType === "touch" || (event.target as HTMLElement).closest(".ln-pw-bar")) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  const anchor = baseAt(event, row.start, row.end);
                  drag.current = { anchor };
                  onSelectRange(anchor, anchor);
                }}
                onPointerMove={(event) => {
                  if (!drag.current || !scroller.current) return;
                  // The pointer may be over another row by now: find it from the row offsets.
                  const view = scroller.current;
                  const y = event.clientY - view.getBoundingClientRect().top + view.scrollTop;
                  const over = rows[Math.max(0, rowAt(y))] ?? rows[rows.length - 1];
                  const target = baseAt(event, over.start, over.end);
                  onSelectRange(Math.min(drag.current.anchor, target), Math.max(drag.current.anchor, target));
                }}
                onPointerUp={() => {
                  drag.current = null;
                }}
                onPointerCancel={() => {
                  drag.current = null;
                }}
              >
                {selection.filter((segment) => segment.start < row.end && segment.end > row.start).map((segment, at) => {
                  const start = Math.max(segment.start, row.start) - row.start;
                  const end = Math.min(segment.end, row.end) - row.start;
                  return <span key={at} className="ln-pw-sel" style={{ left: `${start}ch`, width: `${Math.max(end - start, 0.15)}ch` }} />;
                })}
                <div className="ln-pw-top">{record.sequence.slice(row.start, row.end)}</div>
                <div className="ln-pw-bottom">{complement.slice(row.start, row.end)}</div>
                {row.pieces.map((piece, at) => {
                  const feature = record.features[piece.featureIndex];
                  const span = piece.end - piece.start;
                  return (
                    <button
                      key={at}
                      type="button"
                      className="ln-pw-bar"
                      data-strand={piece.strand}
                      data-arrow={piece.arrow || undefined}
                      data-selected={piece.featureIndex === selectedFeature || undefined}
                      style={{ left: `${piece.start - row.start}ch`, width: `${span}ch`, top: LINE * 2 + 6 + piece.lane * LANE, background: featureColor(feature) }}
                      title={`${feature.name} (${feature.type})`}
                      onClick={() => onSelectFeature(piece.featureIndex)}
                    >
                      {span >= feature.name.length + 2 ? feature.name : ""}
                    </button>
                  );
                })}
              </div>
              <span className="ln-pw-pos ln-pw-pos-end">{row.end.toLocaleString("en-US")}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
