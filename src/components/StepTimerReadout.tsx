"use client";

import { useEffect, useState } from "react";
import { formatStepTimer, remainingStepTimerSeconds } from "@/lib/step-timer";

export function StepTimerReadout({ remainingSeconds, startedAt }: { remainingSeconds: number; startedAt: string }) {
  const [clock, setClock] = useState(() => Date.now());
  const remaining = remainingStepTimerSeconds({ remainingSeconds, startedAt: new Date(startedAt), now: new Date(clock) });

  useEffect(() => {
    if (remaining <= 0) return;
    const interval = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [remaining]);

  return <span className="font-mono text-sm font-semibold tabular-nums text-info">{formatStepTimer(remaining)}</span>;
}
