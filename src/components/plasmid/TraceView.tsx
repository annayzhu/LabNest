"use client";

import type { ReadAlignment } from "@/lib/plasmid/align";
import type { Channel, SangerRead } from "@/lib/plasmid/model";
import { traceWindow } from "@/lib/plasmid/trace";

const channelOrder: Channel[] = ["A", "C", "G", "T"];
const height = 120;
const top = 30;

/**
 * 峰图 (F06, Q366): the four channels around a stretch of the reference, in the sequencer's colours (A green, C blue,
 * G black, T red) with letters, so colour is never the only cue. Each called peak carries its base and quality;
 * `mark` puts a band on one reference position, and `mixed` (original base indices) marks double peaks.
 */
export function TraceView({ read, alignment, start, end, view, zoom, mark, mixed }: {
  read: SangerRead;
  alignment: ReadAlignment;
  start: number;
  end: number;
  view: "aligned" | "original";
  zoom: number;
  mark?: number;
  mixed: Set<number>;
}) {
  const window = traceWindow(read, alignment, start, end, view);
  if (!window) return <p className="ln-pw-note">This read has no chromatogram here.</p>;
  const scans = window.scanEnd - window.scanStart;
  const peak = Math.max(1, ...channelOrder.flatMap((channel) => Array.from(window.channels[channel])));
  const x = (scan: number) => (scan - window.scanStart) * zoom;
  const y = (value: number) => top + height - (value / peak) * height;
  const calls = window.calls.map((call) => {
    const column = alignment.columns.find((item) => item.referencePosition === call.referencePosition && item.kind === call.kind);
    return { ...call, mixed: column?.originalIndex !== null && column?.originalIndex !== undefined && mixed.has(column.originalIndex) };
  });
  return (
    <div className="ln-pw-trace">
      <p className="ln-pw-trace-legend" aria-hidden>
        {channelOrder.map((channel) => <span key={channel} data-channel={channel}>{channel}</span>)}
      </p>
      <div className="ln-pw-trace-scroll">
        <svg width={Math.max(1, scans * zoom)} height={top + height + 8} role="img" aria-label={`Chromatogram of ${read.name}, ${view === "aligned" ? "in the reference direction" : "as recorded"}`}>
          {calls.filter((call) => call.referencePosition === mark).map((call) => <rect key={`mark-${call.scan}`} className="ln-pw-trace-mark" x={x(call.scan) - 5 * zoom} width={10 * zoom} y={0} height={top + height} />)}
          {channelOrder.map((channel) => (
            <polyline key={channel} data-channel={channel} points={Array.from(window.channels[channel], (value, index) => `${(index * zoom).toFixed(1)},${y(value).toFixed(1)}`).join(" ")} />
          ))}
          {calls.map((call) => (
            <g key={call.scan} className="ln-pw-trace-call" data-low={call.quality !== null && call.quality < 20 ? true : undefined} data-mixed={call.mixed || undefined}>
              <text x={x(call.scan)} y={12} textAnchor="middle" data-channel={call.base}>{call.base}</text>
              <text x={x(call.scan)} y={24} textAnchor="middle" className="ln-pw-trace-q">{call.quality ?? "–"}</text>
              {call.mixed ? <text x={x(call.scan) + 6} y={12} className="ln-pw-trace-flag">◆</text> : null}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
