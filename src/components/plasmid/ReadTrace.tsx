"use client";

import { Minus, Plus } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { DEFAULT_MIN_QUALITY, type Channel, type SangerRead } from "@/lib/plasmid/model";
import { orientRead } from "@/lib/plasmid/trace";

const channelOrder: Channel[] = ["A", "C", "G", "T"];
const height = 120;
const top = 30;
// Only what is near the view is drawn: a whole read is over 10,000 scans.
const margin = 1_500;

/** 峰图: a whole Sanger read on its own, before any reference is involved, in the direction recorded or flipped. */
export function ReadTrace({ read }: { read: SangerRead }) {
  const [flipped, setFlipped] = useState(false);
  const [zoom, setZoom] = useState(2);
  const [left, setLeft] = useState(0);
  const [base, setBase] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const shown = useMemo(() => (flipped ? orientRead(read, "reverse") : read), [read, flipped]);
  const { traces, peaks } = shown;
  if (!traces || !peaks) return <p className="ln-pw-note">This file holds bases but no chromatogram, as a .seq or FASTA file does. Open the .ab1 to see the peaks.</p>;

  const scans = traces.A.length;
  const first = Math.max(0, Math.floor(left / zoom) - margin);
  const last = Math.min(scans, Math.floor(left / zoom) + margin * 2);
  const peak = Math.max(1, ...channelOrder.flatMap((channel) => Array.from(traces[channel].subarray(first, last))));
  const y = (value: number) => top + height - (value / peak) * height;
  const marked = Number(base) - 1;
  const goTo = (value: string) => {
    setBase(value);
    const scan = peaks[Number(value) - 1];
    if (scan !== undefined && box.current) box.current.scrollTo({ left: scan * zoom - box.current.clientWidth / 2 });
  };
  return (
    <div className="ln-pw-trace ln-pw-read-trace">
      <div className="ln-pw-actions">
        <span className="ln-pw-shape">
          <button type="button" aria-pressed={!flipped} onClick={() => setFlipped(false)}>As recorded</button>
          <button type="button" aria-pressed={flipped} onClick={() => setFlipped(true)}>Reverse complement</button>
        </span>
        <button type="button" className="ln-pw-icon" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(1, value - 1))}><Minus className="h-3.5 w-3.5" aria-hidden /></button>
        <button type="button" className="ln-pw-icon" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(6, value + 1))}><Plus className="h-3.5 w-3.5" aria-hidden /></button>
        <label className="ln-pw-inline-field"><span>Go to base</span><input className="ln-pw-input ln-pw-narrow" type="number" min={1} max={peaks.length} value={base} onChange={(event) => goTo(event.target.value)} /></label>
        <p className="ln-pw-trace-legend" aria-hidden>{channelOrder.map((channel) => <span key={channel} data-channel={channel}>{channel}</span>)}</p>
      </div>
      <div className="ln-pw-trace-scroll" ref={box} onScroll={(event) => setLeft(event.currentTarget.scrollLeft)}>
        <div style={{ height: top + height + 22, position: "relative", width: scans * zoom }}>
          <svg style={{ left: first * zoom, position: "absolute", top: 0 }} width={Math.max(1, (last - first) * zoom)} height={top + height + 22} role="img" aria-label={`Chromatogram of ${read.name}`}>
            {channelOrder.map((channel) => (
              <polyline key={channel} data-channel={channel} points={Array.from(traces[channel].subarray(first, last), (value, index) => `${index * zoom},${y(value).toFixed(1)}`).join(" ")} />
            ))}
            {Array.from(peaks, (scan, index) => ({ scan, index })).filter(({ scan }) => scan >= first && scan < last).map(({ scan, index }) => {
              const x = (scan - first) * zoom;
              const quality = shown.quality?.[index] ?? null;
              return (
                <g key={index} className="ln-pw-trace-call" data-low={quality !== null && quality < DEFAULT_MIN_QUALITY ? true : undefined}>
                  {index === marked ? <rect className="ln-pw-trace-mark" x={x - 5 * zoom} width={10 * zoom} y={0} height={top + height} /> : null}
                  <text x={x} y={12} textAnchor="middle" data-channel={shown.bases[index]}>{shown.bases[index]}</text>
                  <text x={x} y={24} textAnchor="middle" className="ln-pw-trace-q">{quality ?? "–"}</text>
                  {(index + 1) % 10 === 0 ? <text x={x} y={top + height + 16} textAnchor="middle" className="ln-pw-trace-q">{index + 1}</text> : null}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
