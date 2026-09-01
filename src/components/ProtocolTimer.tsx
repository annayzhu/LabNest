"use client";

import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw, Timer } from "lucide-react";

export function ProtocolTimer({ label, durationMinutes, notes }: { label: string; durationMinutes: number; notes?: string }) {
  const initial = Math.max(1, Math.round(durationMinutes * 60));
  const [remaining, setRemaining] = useState(initial);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!running || remaining <= 0) return;
    const id = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(id);
  }, [running, remaining]);
  const minutes = Math.floor(remaining / 60); const seconds = remaining % 60;
  return <div className="flex flex-wrap items-center gap-3 rounded-[var(--ln-radius-panel-inner)] border border-info/30 bg-info-surface px-4 py-3"><Timer className="h-4 w-4 text-info" /><div className="min-w-40"><p className="text-sm font-semibold text-ink">{label}</p>{notes ? <p className="text-xs text-muted">{notes}</p> : null}</div><span className="font-mono text-lg font-semibold text-ink">{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}</span><button type="button" onClick={() => { if (remaining === 0) setRemaining(initial); setRunning((value) => !value); }} className="focus-ring rounded-[var(--ln-radius-control-sm)] border border-hairline bg-surface p-2 text-moss">{running && remaining > 0 ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button><button type="button" onClick={() => { setRunning(false); setRemaining(initial); }} className="focus-ring rounded-[var(--ln-radius-control-sm)] border border-hairline bg-surface p-2 text-muted"><RotateCcw className="h-4 w-4" /></button></div>;
}
