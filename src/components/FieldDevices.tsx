'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { Check, Copy, QrCode, Watch } from 'lucide-react';
import { connectWatchRun, disconnectWatchRun, watchRunConnection } from '@/app/experiments/[id]/run/actions';
import { fieldRunUrl, groupPairingCode, isLocalHost, lanOrigin } from '@/lib/field-mode';
import { Button } from './ui/Button';
import './field-devices.css';

/** Whether a watch can follow the run: ready, or why not (a Protocol not in step blocks, or a record that can no longer change). */
type WatchSupport = 'ready' | 'legacy' | 'locked';

const lanKey = 'labnest:lan-origin';

/** "其他设备": the same panel from the home page's 现场模式 list and from the run page. */
export function FieldDevices({ experimentId, title, watch }: { experimentId: string; title: string; watch: WatchSupport }) {
  const [open, setOpen] = useState(false);
  return <>
    <Button type="button" onClick={() => setOpen(true)} title="扫码在平板或手机上打开，或配对 Apple Watch"><QrCode className="h-4 w-4" aria-hidden />其他设备</Button>
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
      <div className="min-w-0"><h2 id="field-devices-title">在其他设备上继续</h2><p>{title}</p></div>
      <Button type="button" variant="ghost" onClick={onClose}>关闭</Button>
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
  if (saved && !editing) return <p className="ln-field-lan">局域网地址 <strong>{saved}</strong> <button type="button" className="text-moss underline" onClick={() => setEditing(true)}>更改</button></p>;
  const save = () => { const value = lanOrigin(draft); setInvalid(!value); if (value) { onSave(value); setEditing(false); } };
  return <form className="ln-field-lan is-asking" onSubmit={event => { event.preventDefault(); save(); }}>
    <p>这台电脑是用 localhost 打开的，平板、手机和手表需要电脑在局域网里的地址才能连上。</p>
    <label>局域网地址<input value={draft} onChange={event => { setDraft(event.target.value); setInvalid(false); }} placeholder="例如 http://192.168.0.102:3001" inputMode="url" autoComplete="off" aria-invalid={invalid || undefined} /></label>
    <Button type="submit" variant="primary">使用这个地址</Button>
    {invalid ? <p role="alert" className="text-error">地址无效：请填写电脑在局域网中的 IP 和端口，例如 192.168.0.102:3001。</p> : null}
  </form>;
}

function TabletCard({ origin, experimentId }: { origin?: string; experimentId: string }) {
  const url = origin ? fieldRunUrl(origin, experimentId) : undefined;
  const [copied, setCopied] = useState(false);
  const copy = async () => { if (!url) return; try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); } };
  return <section className="ln-field-card" aria-labelledby="field-tablet-title">
    <h3 id="field-tablet-title">平板或手机</h3>
    <p className="text-muted">用相机扫码，直接打开这次实验的现场模式。</p>
    {url ? <>
      <QrImage text={url} />
      <p className="ln-field-url" data-i18n-ignore>{url}</p>
      <Button type="button" onClick={() => void copy()}>{copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}{copied ? '已复制' : '复制链接'}</Button>
    </> : <p className="ln-field-wait">先在上方填写局域网地址。</p>}
  </section>;
}

/** The modules of the QR symbol drawn as one path: crisp at any size, no image service, nothing sent anywhere. */
function QrImage({ text }: { text: string }) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const quiet = 2, size = modules.size;
  let path = '';
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) if (modules.get(row, col)) path += `M${col + quiet} ${row + quiet}h1v1h-1z`;
  return <svg className="ln-field-qr" viewBox={`0 0 ${size + quiet * 2} ${size + quiet * 2}`} role="img" aria-label="现场模式二维码" shapeRendering="crispEdges"><rect width="100%" height="100%" fill="#fff" /><path d={path} fill="#111" /></svg>;
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
    if (result.code && result.expiresAt) { setPairing({ code: result.code, expiresAt: result.expiresAt }); setNow(Date.now()); } else setError(result.error ?? '配对码创建失败');
  };
  const disconnect = async () => {
    setBusy(true); setError('');
    const result = await disconnectWatchRun(experimentId);
    setBusy(false);
    if (result.error) setError(result.error); else { setPairing(undefined); setStatus({ connected: false }); }
  };
  return <section className="ln-field-card" aria-labelledby="field-watch-title">
    <h3 id="field-watch-title"><Watch className="h-4 w-4" aria-hidden />Apple Watch</h3>
    {watch === 'legacy' ? <p className="text-muted">这次实验用的是旧格式规程，手表暂不支持。规程转换为步骤块后，新建的实验就能在手表上执行。</p>
      : watch === 'locked' ? <p className="text-muted">实验已提交或已结束，不能再配对手表。</p>
      : status?.connected ? <>
        <p className="ln-field-connected" role="status"><Check className="h-4 w-4" aria-hidden />手表已连接{status?.since ? `（${new Date(status.since).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 起）` : ''}</p>
        <p className="text-muted">手表上可以看当前步骤和计时，逐行划掉配液卡。</p>
        <Button type="button" variant="ghost" disabled={busy} onClick={() => void disconnect()}>断开手表</Button>
      </> : <>
        <p className="text-muted">手表会跟着这次实验：看当前步骤和计时，逐行划掉配液卡。</p>
        {pairing && left > 0 ? <>
          <p className="ln-field-code" aria-label={`配对码 ${pairing.code}`} data-i18n-ignore>{groupPairingCode(pairing.code)}</p>
          <p className="ln-field-expiry" role="status">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')} 后失效 · 只能用一次</p>
          <ol className="ln-field-steps">
            <li>在手表上打开 LabNest，点「连接设置」。</li>
            <li>服务器地址填 {origin ? <strong data-i18n-ignore>{origin}</strong> : '电脑的局域网地址（先在上方填写）'}。</li>
            <li>配对码填上面的 12 位字符，点「配对本次实验」。</li>
          </ol>
        </> : <Button type="button" variant="primary" disabled={busy} onClick={() => void create()}>{pairing ? '配对码已失效，重新生成' : '生成配对码'}</Button>}
      </>}
    {error ? <p role="alert" className="text-error">{error}</p> : null}
  </section>;
}
