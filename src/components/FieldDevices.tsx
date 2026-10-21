'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { Check, Copy, QrCode, Watch } from 'lucide-react';
import { connectWatchRun, disconnectWatchRun, watchRunConnection } from '@/app/experiments/[id]/run/actions';
import { fieldRunUrl, isLocalHost, lanOrigin, watchPairingLink } from '@/lib/field-mode';
import { Button } from './ui/Button';
import './field-devices.css';

/** Whether a watch can follow the run: ready, or why not (a Protocol not in step blocks, or a record that can no longer change). */
type WatchSupport = 'ready' | 'legacy' | 'locked';

const lanKey = 'labnest:lan-origin';

/** "Other devices": the same panel from the run mode list and from the run page. */
export function FieldDevices({ experimentId, title, watch }: { experimentId: string; title: string; watch: WatchSupport }) {
  const [open, setOpen] = useState(false);
  return <>
    <Button type="button" onClick={() => setOpen(true)} title="Scan to open on a tablet or phone, or pair an Apple Watch"><QrCode className="h-4 w-4" aria-hidden />Other devices</Button>
    {open ? <FieldDevicesDialog experimentId={experimentId} title={title} watch={watch} onClose={() => setOpen(false)} /> : null}
  </>;
}

function FieldDevicesDialog({ experimentId, title, watch, onClose }: { experimentId: string; title: string; watch: WatchSupport; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; if (element && !element.open) element.showModal(); return () => element?.close(); }, []);
  // Only mounted after a click, so the browser's own address and storage are available here.
  const [local] = useState(() => isLocalHost(window.location.hostname));
  const [saved, setSaved] = useState(() => { try { return lanOrigin(localStorage.getItem(lanKey) ?? ''); } catch { return undefined; } });
  const origin = local ? saved : window.location.origin;
  const remember = (value: string) => { try { localStorage.setItem(lanKey, value); } catch {} setSaved(value); };
  return createPortal(<dialog ref={dialog} aria-labelledby="field-devices-title" className="ln-field-devices bg-surface text-ink" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header>
      <div className="min-w-0"><h2 id="field-devices-title">Continue on another device</h2><p>{title}</p></div>
      <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
    </header>
    {local ? <LanAddress saved={saved} onSave={remember} /> : null}
    <div className="ln-field-devices-cards">
      <TabletCard origin={origin} experimentId={experimentId} />
      <WatchCard origin={origin} experimentId={experimentId} watch={watch} />
    </div>
  </dialog>, document.body);
}

/** Opened as localhost, the computer cannot tell other devices its own address; asked once and remembered on this computer. */
function LanAddress({ saved, onSave }: { saved?: string; onSave: (value: string) => void }) {
  const [editing, setEditing] = useState(!saved);
  const [draft, setDraft] = useState(saved ?? '');
  const [invalid, setInvalid] = useState(false);
  if (saved && !editing) return <p className="ln-field-lan">LAN address <strong>{saved}</strong> <button type="button" className="text-moss underline" onClick={() => setEditing(true)}>Change</button></p>;
  const save = () => { const value = lanOrigin(draft); setInvalid(!value); if (value) { onSave(value); setEditing(false); } };
  return <form className="ln-field-lan is-asking" onSubmit={event => { event.preventDefault(); save(); }}>
    <p>This computer opened LabNest as localhost. Tablets, phones and watches need the computer’s LAN address to connect.</p>
    <label>LAN address<input value={draft} onChange={event => { setDraft(event.target.value); setInvalid(false); }} placeholder="e.g. http://192.168.0.102:3001" inputMode="url" autoComplete="off" aria-invalid={invalid || undefined} /></label>
    <Button type="submit" variant="primary">Use this address</Button>
    {invalid ? <p role="alert" className="text-error">Invalid address: enter the computer’s LAN IP and port, e.g. 192.168.0.102:3001.</p> : null}
  </form>;
}

function TabletCard({ origin, experimentId }: { origin?: string; experimentId: string }) {
  const url = origin ? fieldRunUrl(origin, experimentId) : undefined;
  const [copied, setCopied] = useState(false);
  const copy = async () => { if (!url) return; try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); } };
  return <section className="ln-field-card" aria-labelledby="field-tablet-title">
    <h3 id="field-tablet-title">Tablet or phone</h3>
    <p className="text-muted">Scan with the camera to open this experiment in run mode.</p>
    {url ? <>
      <QrImage text={url} />
      <p className="ln-field-url" data-i18n-ignore>{url}</p>
      <Button type="button" onClick={() => void copy()}>{copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}{copied ? 'Copied' : 'Copy link'}</Button>
    </> : <p className="ln-field-wait">Enter the LAN address above first.</p>}
  </section>;
}

/** The modules of the QR symbol drawn as one path: crisp at any size, no image service, nothing sent anywhere. */
function QrImage({ text, label = 'Run mode QR code' }: { text: string; label?: string }) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const quiet = 4, size = modules.size;
  let path = '';
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) if (modules.get(row, col)) path += `M${col + quiet} ${row + quiet}h1v1h-1z`;
  return <svg className="ln-field-qr" viewBox={`0 0 ${size + quiet * 2} ${size + quiet * 2}`} role="img" aria-label={label} shapeRendering="crispEdges"><rect width="100%" height="100%" fill="#fff" /><path d={path} fill="#111" /></svg>;
}

function WatchCard({ origin, experimentId, watch }: { origin?: string; experimentId: string; watch: WatchSupport }) {
  const [pairing, setPairing] = useState<{ code: string; expiresAt: string }>();
  const [status, setStatus] = useState<{ connected: boolean; since?: string }>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const ready = watch === 'ready';
  // While the panel is open: notice the watch connecting (after it takes the code) without reloading.
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    const check = () => watchRunConnection(experimentId).then(next => { if (alive) setStatus(next); }, () => {});
    void check();
    const timer = window.setInterval(() => void check(), 3000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [experimentId, ready]);
  useEffect(() => {
    if (!pairing) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [pairing]);
  const left = pairing ? Math.max(0, Math.round((Date.parse(pairing.expiresAt) - now) / 1000)) : 0;
  const create = async () => {
    setBusy(true); setError('');
    const result = await connectWatchRun(experimentId);
    setBusy(false);
    if (result.code && result.expiresAt) { setPairing({ code: result.code, expiresAt: result.expiresAt }); setNow(Date.now()); } else setError(result.error ?? 'Could not create a pairing code');
  };
  const disconnect = async () => {
    setBusy(true); setError('');
    const result = await disconnectWatchRun(experimentId);
    setBusy(false);
    if (result.error) setError(result.error); else { setPairing(undefined); setStatus({ connected: false }); }
  };
  const phoneLink = origin && pairing ? watchPairingLink(origin, pairing.code) : undefined;
  return <section className="ln-field-card" aria-labelledby="field-watch-title">
    <h3 id="field-watch-title"><Watch className="h-4 w-4" aria-hidden />Apple Watch</h3>
    {watch === 'legacy' ? <p className="text-muted">This experiment has not adopted a structured Protocol, so Apple Watch cannot connect. Tablets and phones can still open it. To use the watch, create an experiment from a Protocol with step blocks.</p>
      : watch === 'locked' ? <p className="text-muted">The experiment is submitted or finished, so a watch can no longer be paired.</p>
      : status?.connected ? <>
        <p className="ln-field-connected" role="status"><Check className="h-4 w-4" aria-hidden />{status?.since ? `Watch connected since ${new Date(status.since).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'Watch connected'}</p>
        <p className="text-muted">The watch shows the current step and timers; tick off the mix card line by line.</p>
        <Button type="button" variant="ghost" disabled={busy} onClick={() => void disconnect()}>Disconnect watch</Button>
      </> : <>
        <p className="text-muted">The watch follows this experiment: the current step and timers, and the mix card ticked off line by line.</p>
        {pairing && left > 0 ? <>
          {phoneLink ? <>
            <QrImage text={phoneLink} label="iPhone 连接 Apple Watch 二维码" />
            <p className="text-muted">已安装 iPhone 和手表 App：用 iPhone 相机扫码，在手机确认连接。手表上的 LabNest 请保持打开。</p>
            <a className="text-moss underline" href={phoneLink}>在此 iPhone 的 LabNest App 中连接</a>
          </> : null}
          <p className="ln-field-code" aria-label={`Pairing code ${pairing.code}`} data-i18n-ignore>{pairing.code}</p>
          <p className="ln-field-expiry" role="status">{`Expires in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} · single use`}</p>
          <p className="text-muted">也可以在手表上手动输入：</p>
          <ol className="ln-field-steps">
            <li>On the watch, open LabNest and tap “连接设置” (connection settings).</li>
            <li>Server address: {origin ? <strong data-i18n-ignore>{origin}</strong> : 'the computer’s LAN address (enter it above first)'}</li>
            <li>Pairing code: the 4 digits above, then tap “配对本次实验” (pair this experiment).</li>
          </ol>
        </> : <Button type="button" variant="primary" disabled={busy} onClick={() => void create()}>{pairing ? 'Code expired. Generate a new one' : 'Generate pairing code'}</Button>}
      </>}
    {error ? <p role="alert" className="text-error">{error}</p> : null}
  </section>;
}
