"use client";
import { useEffect } from "react";
import { inNativeApp, nativeTimers, postNative, type TimedStep } from "@/lib/native-bridge";

/**
 * In the iPhone app: this experiment's running and paused timers go to the lock screen and the Dynamic Island, with a
 * notification when one ends. The page sends them whenever it renders a new state, so a timer started on the watch appears
 * once the page refreshes. Nothing happens in a browser.
 */
export function NativeRunTimers({ experimentId, title, steps }: { experimentId: string; title: string; steps: TimedStep[] }) {
  useEffect(() => {
    if (!inNativeApp()) return;
    postNative({
      type: "timers", experimentId, experimentTitle: title,
      url: `${window.location.origin}/experiments/${encodeURIComponent(experimentId)}/run?view=bench`,
      timers: nativeTimers(steps, Date.now()),
    });
  }, [experimentId, title, steps]);
  return null;
}
