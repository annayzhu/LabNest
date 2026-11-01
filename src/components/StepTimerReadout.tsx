"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { formatStepTimer, remainingStepTimerSeconds } from "@/lib/step-timer";

export function StepTimerReadout({ remainingSeconds, startedAt }: { remainingSeconds: number; startedAt: string }) {
  const { locale } = useI18n();
  const [clock, setClock] = useState(() => Date.now());
  const remaining = remainingStepTimerSeconds({ remainingSeconds, startedAt: new Date(startedAt), now: new Date(clock) });

  useEffect(() => {
    if (remaining <= 0) return;
    const interval = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [remaining]);

  return <span className="font-mono text-sm font-semibold tabular-nums text-info" data-i18n-ignore>{formatStepTimer(remaining, locale === "zh")}</span>;
}
