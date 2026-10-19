'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Maximize2, Minimize2, Sun, TabletSmartphone } from 'lucide-react';
import { Button } from './ui/Button';
import './run-bench.css';

const preferenceKey = 'labnest:run-view';
const none = { wake: false, fullscreen: false };
let detected: typeof none | undefined;
/** Read once per page: the snapshot must stay the same object between reads. */
const detect = () => detected ??= { wake: 'wakeLock' in navigator, fullscreen: Boolean(document.documentElement.requestFullscreen || (document.documentElement as Root).webkitRequestFullscreen) };
type WakeLock = { release: () => Promise<void>; addEventListener: (type: 'release', listener: () => void) => void };
type Doc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
type Root = HTMLElement & { webkitRequestFullscreen?: () => void };

/**
 * 现场模式: chosen by hand and remembered on this device, never sniffed from the device. While on, the screen can be kept
 * awake and the page taken full screen. The run itself is the same page with the same actions; only the layout changes.
 */
export function RunBenchControls({ bench }: { bench: boolean }) {
  const router = useRouter(), pathname = usePathname();
  // Browser capabilities, read on the client only: the server renders the controls without them.
  const features = useSyncExternalStore(() => () => {}, detect, () => none);
  const [awake, setAwake] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const wanted = useRef(false);
  const lock = useRef<WakeLock | null>(null);
  useEffect(() => {
    // Opening the run on the device that chose 现场模式 keeps it, unless the address says otherwise.
    try { if (!bench && localStorage.getItem(preferenceKey) === 'bench' && !new URLSearchParams(window.location.search).has('view')) router.replace(`${pathname}?view=bench`); } catch {}
  }, [bench, pathname, router]);
  const request = async () => {
    try {
      const sentinel = await (navigator as Navigator & { wakeLock: { request: (type: 'screen') => Promise<WakeLock> } }).wakeLock.request('screen');
      lock.current = sentinel; setAwake(true);
      sentinel.addEventListener('release', () => { lock.current = null; setAwake(false); });
    } catch { setAwake(false); }
  };
  // The lock is released whenever the tab is hidden; take it again when the bench comes back.
  useEffect(() => {
    const visible = () => { if (wanted.current && !lock.current && document.visibilityState === 'visible') void request(); };
    document.addEventListener('visibilitychange', visible);
    return () => { document.removeEventListener('visibilitychange', visible); void lock.current?.release(); };
  }, []);
  useEffect(() => {
    const change = () => setFullscreen(Boolean(document.fullscreenElement || (document as Doc).webkitFullscreenElement));
    document.addEventListener('fullscreenchange', change); document.addEventListener('webkitfullscreenchange', change);
    return () => { document.removeEventListener('fullscreenchange', change); document.removeEventListener('webkitfullscreenchange', change); };
  }, []);
  const choose = (view: 'bench' | 'list') => { try { localStorage.setItem(preferenceKey, view); } catch {} router.push(view === 'bench' ? `${pathname}?view=bench` : pathname); };
  const toggleWake = () => { wanted.current = !awake; if (awake) void lock.current?.release(); else void request(); };
  const toggleFullscreen = () => {
    const root = document.documentElement as Root, doc = document as Doc;
    if (fullscreen) void (document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
    else void (root.requestFullscreen?.() ?? root.webkitRequestFullscreen?.());
  };
  if (!bench) return <Button type="button" onClick={() => choose('bench')} title="For a tablet on the bench: steps, mix cards, plates and timers side by side"><TabletSmartphone className="h-4 w-4" aria-hidden />Enter run mode</Button>;
  return <div className="ln-bench-controls" role="group" aria-label="Run mode">
    {features.wake ? <Button type="button" aria-pressed={awake} onClick={toggleWake} title="Keeps the screen awake while you work; restored when you leave the page"><Sun className="h-4 w-4" aria-hidden />{awake ? 'Screen stays on' : 'Keep screen on'}</Button> : null}
    {features.fullscreen ? <Button type="button" aria-pressed={fullscreen} onClick={toggleFullscreen}>{fullscreen ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}{fullscreen ? 'Exit full screen' : 'Full screen'}</Button> : null}
    <Button type="button" onClick={() => choose('list')}>Exit run mode</Button>
  </div>;
}
