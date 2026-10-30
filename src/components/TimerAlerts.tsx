'use client';
import { useEffect, useRef, useState } from 'react';
import { inNativeApp } from '@/lib/native-bridge';
import { remainingStepTimerSeconds } from '@/lib/step-timer';
import { useRunClock } from './useRunClock';
import { useI18n } from './I18nProvider';

type TimedStep = { id: string; title: string; timerRemainingSeconds: number | null; timerDurationSeconds: number | null; timerStartedAt: Date | string | null };
const askedKey = 'labnest:timer-alerts-asked';
/** The browser can show alerts and has not been asked yet; the iPhone app alerts on its own. */
const askable = () => typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default' && !inNativeApp();

/**
 * While the run page is open, a timer that reaches zero shows a system alert when the browser allows it (the iPhone app
 * shows its own). Only a timer seen running on this page alerts, so reopening the page does not repeat old ones.
 */
export function RunTimerAlerts({ title, steps }: { title: string; steps: TimedStep[] }) {
  const clock = useRunClock();
  const { locale } = useI18n();
  const running = useRef(new Set<string>()), alerted = useRef(new Set<string>());
  useEffect(() => {
    if (!('Notification' in window) || inNativeApp()) return;
    for (const step of steps) {
      if (!step.timerStartedAt) continue;
      const key = `${step.id}:${new Date(step.timerStartedAt).toISOString()}`;
      const left = remainingStepTimerSeconds({ remainingSeconds: step.timerRemainingSeconds ?? step.timerDurationSeconds ?? 0, startedAt: new Date(step.timerStartedAt), now: new Date(clock.now) });
      if (left > 0) { running.current.add(key); continue; }
      if (!running.current.has(key) || alerted.current.has(key)) continue;
      alerted.current.add(key);
      // A system alert is outside the page, so it is written in the interface language here.
      if (Notification.permission === 'granted') new Notification(title, { body: `${locale === 'zh' ? '计时结束' : 'Time is up'} · ${step.title}`, tag: key });
    }
  }, [clock.now, steps, title, locale]);
  return null;
}

/** Once, under a running timer: the browser may alert when it ends, if asked. Gone after an answer or "Not now". */
export function TimerAlertPrompt() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => { try { setShow(askable() && !localStorage.getItem(askedKey)); } catch { setShow(askable()); } });
    return () => cancelAnimationFrame(frame);
  }, []);
  if (!show) return null;
  const done = () => { try { localStorage.setItem(askedKey, '1'); } catch {} setShow(false); };
  return <p className="ln-timer-alert-prompt" role="status">Alert me when time is up
    <button type="button" className="focus-ring" onClick={() => void Notification.requestPermission().finally(done)}>Turn on</button>
    <button type="button" className="focus-ring is-quiet" onClick={done}>Not now</button>
  </p>;
}
