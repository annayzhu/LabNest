'use client';
import { useSyncExternalStore } from 'react';
let snapshot = { now: 0, calibrated: false, uncertain: false, online: true };
let anchor: { server: number; monotonic: number; wall: number } | undefined;
let active = false;
const listeners = new Set<() => void>();
function publish() {
  const wall = Date.now(), monotonic = performance.now();
  const drift = anchor ? Math.abs((wall - anchor.wall) - (monotonic - anchor.monotonic)) > 5000 : false;
  snapshot = { now: anchor ? anchor.server + monotonic - anchor.monotonic : wall, calibrated: Boolean(anchor), uncertain: drift || !anchor, online: navigator.onLine };
  listeners.forEach(listener => listener());
}
async function calibrate() {
  if (active || !navigator.onLine) return;
  active = true;
  const started = performance.now();
  try {
    const response = await fetch('/api/clock', { cache: 'no-store' });
    const data = await response.json();
    const end = performance.now();
    if (!response.ok || !Number.isFinite(data.serverTime) || end - started > 5000) throw new Error('Unreliable calibration');
    anchor = { server: data.serverTime + (end - started) / 2, monotonic: end, wall: Date.now() };
    publish();
  } catch { publish(); } finally { active = false; }
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) start();
  return () => { listeners.delete(listener); if (!listeners.size) stop?.(); };
}
let stop: (() => void) | undefined;
function start() {
  const foreground = () => { if (document.visibilityState === 'visible') { publish(); void calibrate(); } };
  publish(); void calibrate();
  const interval = window.setInterval(publish, 1000);
  window.addEventListener('offline', publish); window.addEventListener('focus', foreground); window.addEventListener('online', foreground); document.addEventListener('visibilitychange', foreground);
  stop = () => { window.clearInterval(interval); window.removeEventListener('offline', publish); window.removeEventListener('focus', foreground); window.removeEventListener('online', foreground); document.removeEventListener('visibilitychange', foreground); };
}
const serverSnapshot = { now: 0, calibrated: false, uncertain: false, online: true };
export function useRunClock() { return useSyncExternalStore(subscribe, () => snapshot, () => serverSnapshot); }
