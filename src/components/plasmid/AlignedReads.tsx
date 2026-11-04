"use client";

import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AlignmentColumn, ReadAlignment } from "@/lib/plasmid/align";
import { alignedBlocks, alignedRuns, hiddenEnds, placedColumns, type PlacedColumns } from "@/lib/plasmid/aligned-rows";
import { sequenceRows, type SequenceRow } from "@/lib/plasmid/layout";
import type { SangerRead, SequenceFeature, SequenceRecord } from "@/lib/plasmid/model";
import { featureColor } from "@/lib/plasmid/workbench";
import type { Spot } from "./AlignmentView";

export type AlignedRead = { read: SangerRead; alignment?: ReadAlignment; doubles: Set<number> };
type Prepared = { name: string; index: number; reverse: boolean; placed: PlacedColumns; hidden?: (column: AlignmentColumn) => boolean; doubles: Set<number> };

/**
 * 整条比对: the whole reference in wrapped lines with its features, every read below it where it lies, and stretches no
 * read reaches folded into one row. A click on a base opens that place; its details (`detail`) open under that line, so
 * looking at a trace never loses the place. The page is the only vertical scroller.
 */
export function AlignedReads({ record, reads, minQuality, hideEnds, spot, jump, detail, onPick }: {
  record: SequenceRecord;
  reads: AlignedRead[];
  minQuality: number;
  hideEnds: boolean;
  spot?: Spot;
  /** Goes up when the place was changed from elsewhere, so the view scrolls to it. */
  jump: number;
  detail: ReactNode;
  onPick: (position: number, read?: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(0);
  const [charWidth, setCharWidth] = useState(7.8);
  const [opened, setOpened] = useState<number[]>([]);
  const length = record.sequence.length;

  useEffect(() => {
    const measure = () => {
      if (probe.current) setCharWidth(probe.current.getBoundingClientRect().width / 10 || 7.8);
      if (box.current) setWidth(box.current.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (box.current) observer.observe(box.current);
    return () => observer.disconnect();
  }, []);

  const nameWidth = width && width < 500 ? 84 : 144;
  const perLine = Math.max(10, Math.floor((width - nameWidth - 28) / charWidth / 10) * 10);
  const prepared = useMemo<Prepared[]>(() => reads.flatMap(({ read, alignment, doubles }, index) => (alignment
    ? [{ name: read.name, index, reverse: alignment.orientation === "reverse", placed: placedColumns(alignment), hidden: hideEnds ? hiddenEnds(read.quality, minQuality) : undefined, doubles }]
    : [])), [reads, hideEnds, minQuality]);
  // A GenBank "source" feature spans the whole record and says nothing on a line of bases.
  const features = useMemo(() => record.features.filter((feature) => feature.type !== "source"), [record.features]);
  const rows = useMemo(() => new Map(sequenceRows(length, features, perLine).map((row) => [row.start, row])), [length, features, perLine]);
  const covered = useMemo(() => {
    const here = new Uint8Array(length);
    for (const { placed } of prepared) for (const position of placed.columns.keys()) here[position] = 1;
    return here;
  }, [prepared, length]);
  const blocks = useMemo(() => alignedBlocks(
    length,
    perLine,
    (start, end) => covered.subarray(start, end).includes(1),
    (start, end) => Boolean(spot && spot.position >= start && spot.position < end) || opened.some((at) => at >= start && at < end),
  ), [length, perLine, covered, spot, opened]);

  useEffect(() => {
    if (jump) box.current?.querySelector("[data-spot-line]")?.scrollIntoView({ block: "center" });
    // Only a jump scrolls: a click on a base must leave the view where it is.
  }, [jump]);

  return (
    <div className="ln-pw-aligned" ref={box}>
      <span className="ln-pw-probe ln-pw-aligned-probe" ref={probe} aria-hidden>ACGTACGTAC</span>
      {width ? blocks.map((block) => {
        if (block.kind === "gap") {
          return <button key={block.start} type="button" className="ln-pw-aligned-gap" onClick={() => setOpened((current) => [...current, block.start])}>{`${(block.start + 1).toLocaleString("en-US")}–${block.end.toLocaleString("en-US")}: no read here (${(block.end - block.start).toLocaleString("en-US")} bp)`}</button>;
        }
        const hasSpot = spot !== undefined && spot.position >= block.start && spot.position < block.end;
        return (
          <div key={block.start} data-spot-line={hasSpot || undefined}>
            <AlignedLine
              sequence={record.sequence}
              features={features}
              row={rows.get(block.start)}
              start={block.start}
              end={block.end}
              reads={prepared}
              minQuality={minQuality}
              mark={hasSpot ? spot.position : undefined}
              charWidth={charWidth}
              nameWidth={nameWidth}
              onPick={onPick}
            />
            {hasSpot ? detail : null}
          </div>
        );
      }) : null}
    </div>
  );
}

const AlignedLine = memo(function AlignedLine({ sequence, features, row, start, end, reads, minQuality, mark, charWidth, nameWidth, onPick }: {
  sequence: string;
  features: SequenceFeature[];
  row?: SequenceRow;
  start: number;
  end: number;
  reads: Prepared[];
  minQuality: number;
  mark?: number;
  charWidth: number;
  nameWidth: number;
  onPick: (position: number, read?: number) => void;
}) {
  const at = (event: React.MouseEvent<HTMLElement>) => start + Math.floor((event.clientX - event.currentTarget.getBoundingClientRect().left) / charWidth);
  const reference = sequence.slice(start, end);
  const lanes = row?.laneCount ?? 0;
  return (
    <div className="ln-pw-aligned-line">
      {lanes ? (
        <div className="ln-pw-aligned-features" style={{ height: lanes * 14, marginLeft: nameWidth }}>
          {row!.pieces.map((piece, index) => {
            const feature = features[piece.featureIndex];
            const span = piece.end - piece.start;
            return (
              <button key={index} type="button" className="ln-pw-bar" data-strand={piece.strand} data-arrow={piece.arrow || undefined} style={{ background: featureColor(feature), left: (piece.start - start) * charWidth, top: piece.lane * 14, width: span * charWidth }} title={`${feature.name} (${feature.type})`} data-i18n-ignore onClick={() => onPick(piece.start)}>
                {span >= feature.name.length + 2 ? feature.name : ""}
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="ln-pw-bases-row">
        <span className="ln-pw-bases-name ln-pw-mono" style={{ flexBasis: nameWidth }}>{(start + 1).toLocaleString("en-US")}</span>
        <span className="ln-pw-bases-cells" data-i18n-ignore onClick={(event) => onPick(at(event))}>
          {mark === undefined ? reference : <>{reference.slice(0, mark - start)}<span data-mark>{reference[mark - start]}</span>{reference.slice(mark - start + 1)}</>}
        </span>
      </div>
      {reads.map((read) => {
        const runs = alignedRuns(read.placed, start, end, { minQuality, hidden: read.hidden, doubles: read.doubles, mark });
        if (!runs) return null;
        return (
          <div key={read.index} className="ln-pw-bases-row">
            <span className="ln-pw-bases-name" style={{ flexBasis: nameWidth }} data-i18n-ignore>{`${read.reverse ? "← " : "→ "}${read.name}`}</span>
            <span className="ln-pw-bases-cells" data-i18n-ignore onClick={(event) => onPick(at(event), read.index)}>
              {runs.map((run, index) => <span key={index} data-kind={run.kind} data-low={run.low || undefined} data-insert={run.insert || undefined} data-double={run.double || undefined} data-mark={run.mark || undefined}>{run.text}</span>)}
            </span>
          </div>
        );
      })}
    </div>
  );
});
