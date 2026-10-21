'use client';
import { ArrowDown, ArrowUp, Camera, RotateCcw, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { shrinkPhoto } from '@/lib/photo-resize';
import { joinTranscripts, MAX_PHOTOS, unclearCount } from '@/lib/protocol-photo';
import { AiButton, useAiStatus } from './AiAssistant';
import { Button } from './ui/Button';
import './recognition-photos.css';

type Photo = { id: string; file: File; url: string; status: 'ready' | 'working' | 'done' | 'failed'; text: string; error?: string };
const PARALLEL = 3;

/**
 * 上传图片: pictures of a manual, up to 50, chosen from the camera or the photo library (the phone's own picker offers
 * both). Each is shrunk in the browser and read by the photo service, three at a time; a failed one can be tried again.
 * The pictures are never stored: they stay on this page, and the text read from them goes on as pasted text.
 */
export function RecognitionPhotos({ onText, disabled }: { onText: (text: string, count: number) => void; disabled?: boolean }) {
  const ai = useAiStatus();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [note, setNote] = useState<string>();
  const [working, setWorking] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const live = useRef<Photo[]>([]);
  useEffect(() => { live.current = photos; });
  // Set when a reading starts: once every picture has its text, the text goes on without another click.
  const goOn = useRef(false);
  useEffect(() => {
    if (goOn.current && photos.length && photos.every(photo => photo.status === 'done')) { goOn.current = false; onText(joinTranscripts(photos), photos.length); }
  }, [photos, onText]);
  // The preview links die with the page; nothing outlives it.
  useEffect(() => () => live.current.forEach(photo => URL.revokeObjectURL(photo.url)), []);

  const change = (id: string, patch: Partial<Photo>) => setPhotos(current => current.map(photo => photo.id === id ? { ...photo, ...patch } : photo));
  const add = (files: FileList | null) => {
    const chosen = [...(files ?? [])].filter(file => file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name));
    const room = MAX_PHOTOS - photos.length;
    const taken = chosen.slice(0, Math.max(0, room));
    setNote(chosen.length > taken.length ? `At most ${MAX_PHOTOS} pictures; ${chosen.length - taken.length} extra ignored.` : chosen.length < (files?.length ?? 0) ? 'Some files are not pictures and were ignored.' : undefined);
    setPhotos(current => [...current, ...taken.map(file => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file), status: 'ready' as const, text: '' }))]);
    if (picker.current) picker.current.value = '';
  };
  const remove = (id: string) => setPhotos(current => { const gone = current.find(photo => photo.id === id); if (gone) URL.revokeObjectURL(gone.url); return current.filter(photo => photo.id !== id); });
  const move = (id: string, step: -1 | 1) => setPhotos(current => {
    const from = current.findIndex(photo => photo.id === id), to = from + step;
    if (from < 0 || to < 0 || to >= current.length) return current;
    const next = [...current]; [next[from], next[to]] = [next[to], next[from]]; return next;
  });

  async function read(photo: Photo) {
    goOn.current = true;
    change(photo.id, { status: 'working', error: undefined });
    try {
      const body = new FormData();
      body.set('image', await shrinkPhoto(photo.file), 'photo.jpg');
      const response = await fetch('/api/protocols/recognize/photo', { method: 'POST', body });
      const payload = await response.json() as { text?: string; error?: string };
      if (!response.ok || payload.text === undefined) throw new Error(payload.error ?? 'No text was read');
      change(photo.id, { status: 'done', text: payload.text });
    } catch (error) { change(photo.id, { status: 'failed', error: error instanceof Error ? error.message : 'No text was read' }); }
  }
  async function run() {
    const queue = live.current.filter(photo => photo.status === 'ready' || photo.status === 'failed');
    if (!queue.length) return;
    setWorking(true); setNote(undefined);
    await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => { for (let photo = queue.shift(); photo; photo = queue.shift()) await read(photo); }));
    setWorking(false);
  }

  const done = photos.filter(photo => photo.status === 'done').length;
  const failed = photos.filter(photo => photo.status === 'failed').length;
  const todo = photos.filter(photo => photo.status === 'ready' || photo.status === 'failed').length;
  const unclear = unclearCount(joinTranscripts(photos));
  return <div className="ln-photos" aria-label="Upload pictures">
    <div className="ln-photos-head">
      <Button type="button" disabled={disabled || working || photos.length >= MAX_PHOTOS} onClick={() => picker.current?.click()}><Camera className="h-4 w-4" aria-hidden />Upload pictures</Button>
      <input ref={picker} type="file" accept="image/*" multiple hidden onChange={event => add(event.target.files)} aria-label="Choose pictures" />
      <span className="ln-design-note">{`On a phone or iPad you can take photos or choose from the library; up to ${MAX_PHOTOS}. Pictures stay on this page and are not archived after reading.`}</span>
    </div>
    {note ? <p role="status" className="text-sm text-warning">{note}</p> : null}
    {photos.length ? <>
      <ol className="ln-photo-list">{photos.map((photo, index) => <li key={photo.id} className="ln-photo" data-status={photo.status}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a local preview link, not a site image */}
        <img src={photo.url} alt={`Picture ${index + 1}`} className="ln-photo-thumb" />
        <div className="ln-photo-body">
          <p className="ln-photo-title"><span>{`Picture ${index + 1}`}</span> · <span>{photo.status === 'ready' ? 'Waiting' : photo.status === 'working' ? 'Reading…' : photo.status === 'done' ? `Read · ${photo.text.length} characters` : 'Could not read'}</span></p>
          {photo.error ? <p role="alert" className="text-xs text-error">{photo.error}</p> : null}
          {photo.status === 'done' ? <details><summary>View and edit the text read</summary>
            <textarea rows={6} aria-label={`Text read from picture ${index + 1}`} value={photo.text} onChange={event => change(photo.id, { text: event.target.value })} />
          </details> : null}
        </div>
        <div className="ln-photo-tools">
          <button type="button" className="ln-photo-tool focus-ring" aria-label={`Move picture ${index + 1} up`} disabled={working || index === 0} onClick={() => move(photo.id, -1)}><ArrowUp className="h-4 w-4" aria-hidden /></button>
          <button type="button" className="ln-photo-tool focus-ring" aria-label={`Move picture ${index + 1} down`} disabled={working || index === photos.length - 1} onClick={() => move(photo.id, 1)}><ArrowDown className="h-4 w-4" aria-hidden /></button>
          {photo.status === 'failed' ? <button type="button" className="ln-photo-tool focus-ring" aria-label={`Retry picture ${index + 1}`} disabled={working} onClick={() => { void read(photo); }}><RotateCcw className="h-4 w-4" aria-hidden /></button> : null}
          <button type="button" className="ln-photo-tool focus-ring" aria-label={`Delete picture ${index + 1}`} disabled={working} onClick={() => remove(photo.id)}><X className="h-4 w-4" aria-hidden /></button>
        </div>
      </li>)}</ol>
      <div className="ln-photos-head">
        <AiButton needs="vision" type="button" aria-busy={working} disabled={disabled || working || !todo} onClick={() => { void run(); }}><Sparkles className="h-4 w-4" aria-hidden />{working ? `Reading… ${done} / ${photos.length}` : failed ? `Try the ${failed} that failed again` : `Read pictures (${todo})`}</AiButton>
        {done === photos.length && !working ? <Button type="button" onClick={() => onText(joinTranscripts(photos), photos.length)}>Read these texts again</Button> : null}
        <span className="ln-design-note">{ai.vision ? `Sending ${todo || photos.length} pictures to “${ai.saved?.vision.providerName ?? 'the picture service'}”, one at a time.` : 'Reading pictures needs a service that can read them, chosen in AI settings.'}</span>
      </div>
      {unclear ? <p className="text-sm text-warning">{`The text has ${unclear} “【看不清】” marks: check them against the pictures, or edit the text and click “Read these texts again”.`}</p> : null}
    </> : null}
  </div>;
}
