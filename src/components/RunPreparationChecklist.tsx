'use client';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, StickyNote } from 'lucide-react';
import { readableError } from '@/lib/form-actions';
import { preparationChecklist, preparationKindLabels, preparationProgress, type PreparationItem, type PreparationKind, type PreparationState, type PreparationStock } from '@/lib/run-preparation';
import type { StructuredRunView } from '@/lib/structured-run';
import { PlateLayoutView, type PlateAttachment } from './PlateLayoutView';
import './run-bench.css';


/**
 * 实验准备清单: what to have ready before the bench, derived from the frozen Protocols, the confirmed plan and 本次数量.
 * Ticks are a bench aid saved per item without touching progress; the list itself is never stored, so it follows every change.
 */
export function RunPreparationChecklist({ experimentId, view, editable, plates = [], stock = [], recorded = [] }: {
  experimentId: string; view: StructuredRunView; editable: boolean; plates?: PlateAttachment[]; stock?: PreparationStock[]; recorded?: Array<{ source: string }>;
}) {
  const router = useRouter();
  const list = useMemo(() => preparationChecklist(view, { plates: plates.map(plate => ({ id: plate.id, name: plate.originalFilename })), stock, recorded }), [view, plates, stock, recorded]);
  const [ticks, setTicks] = useState<Record<string, PreparationState | undefined>>(view.plan.preparation);
  const [seen, setSeen] = useState(view.plan.preparation);
  if (seen !== view.plan.preparation) { setSeen(view.plan.preparation); setTicks(view.plan.preparation); }
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const progress = preparationProgress(list.items, ticks as Record<string, PreparationState>);
  const write = (key: string, patch: { done: boolean; note?: string }) => startTransition(async () => {
    const previous = ticks;
    setTicks(current => ({ ...current, [key]: { ...current[key], done: patch.done, ...(patch.note !== undefined ? { note: patch.note || undefined } : {}) } }));
    const { setRunPreparationItem } = await import('@/app/experiments/[id]/run/actions');
    const result = await setRunPreparationItem({ experimentId, key, ...patch });
    if (result.error) { setTicks(previous); setMessage(readableError(result.error)); return; }
    setMessage('');
    router.refresh();
  });
  const kinds = (Object.keys(preparationKindLabels) as PreparationKind[]).filter(kind => list.items.some(item => item.kind === kind));
  return <section id="run-preparation" className="ln-prep" aria-label="Run preparation checklist">
    <header className="ln-prep-head">
      <h3>Preparation checklist</h3>
      <span className="ln-prep-progress" role="status">{list.items.length ? `Ready ${progress.done}/${progress.total}` : 'Awaiting system confirmation'}</span>
    </header>
    {list.warnings.length ? <ul className="ln-prep-warnings" role="status" aria-label="Checks before running">{list.warnings.map(warning => <li key={warning}><AlertTriangle aria-hidden />{warning}</li>)}</ul> : null}
    {kinds.map(kind => <div key={kind} className="ln-prep-group">
      <h4>{preparationKindLabels[kind]}</h4>
      <ul>{list.items.filter(item => item.kind === kind).map(item => <ChecklistItem key={item.key} item={item} state={ticks[item.key]} editable={editable && !pending} onChange={patch => write(item.key, patch)}>
        {kind === 'plate' ? <PlateLayoutView attachment={plates.find(plate => `plate:${plate.id}` === item.key)!} /> : null}
      </ChecklistItem>)}</ul>
    </div>)}
    {!list.items.length ? <p className="ln-prep-empty">Once the systems are confirmed and the run quantities filled in, the materials, mixes, plates, equipment and timers to prepare are listed here.</p> : null}
    {list.reminders.length ? <p className="ln-prep-reminders">{list.reminders.join('; ')}</p> : null}
    {message ? <p role="alert" className="ln-prep-error">{message}</p> : null}
  </section>;
}

function ChecklistItem({ item, state, editable, onChange, children }: { item: PreparationItem; state: PreparationState | undefined; editable: boolean; onChange: (patch: { done: boolean; note?: string }) => void; children?: React.ReactNode }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [draft, setDraft] = useState(state?.note ?? '');
  const saveNote = () => { setNoteOpen(false); if (draft.trim() !== (state?.note ?? '')) onChange({ done: Boolean(state?.done), note: draft.trim() }); };
  return <li className="ln-prep-item" data-done={state?.done || undefined} data-warning={item.warning ? '' : undefined}>
    <label className="ln-prep-row">
      <input type="checkbox" checked={Boolean(state?.done)} disabled={!editable} onChange={event => onChange({ done: event.target.checked })} aria-describedby={item.detail ? `${item.key}-detail` : undefined} />
      <span className="ln-prep-text">
        <span className="ln-prep-label">{item.label}{item.badge ? <span className="ln-prep-badge">{item.badge}</span> : null}</span>
        {item.detail ? <span id={`${item.key}-detail`} className="ln-prep-detail">{item.detail}</span> : null}
        {item.warning ? <span className="ln-prep-warning"><AlertTriangle aria-hidden />{item.warning}</span> : null}
        {state?.note && !noteOpen ? <span className="ln-prep-note">{state.note}</span> : null}
      </span>
    </label>
    {editable ? <button type="button" className="focus-ring ln-prep-note-toggle" aria-label={`Note for ${item.label}`} aria-expanded={noteOpen} onClick={() => { setDraft(state?.note ?? ''); setNoteOpen(open => !open); }}><StickyNote aria-hidden /></button> : null}
    {noteOpen ? <input className="ln-prep-note-input" autoFocus value={draft} placeholder="Note, e.g. lot number or where it is" aria-label={`Note for ${item.label}`} onChange={event => setDraft(event.target.value)} onBlur={saveNote} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); saveNote(); } if (event.key === 'Escape') { event.preventDefault(); setNoteOpen(false); } }} /> : null}
    {children}
  </li>;
}
