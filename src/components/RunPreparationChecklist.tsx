'use client';
import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ChevronDown, StickyNote } from 'lucide-react';
import { readableError } from '@/lib/form-actions';
import { preparationKindLabels, preparationProgress, type PreparationChecklist, type PreparationItem, type PreparationKind, type PreparationState } from '@/lib/run-preparation';
import type { StructuredRunView } from '@/lib/structured-run';
import { PlateLayoutView, type PlateAttachment } from './PlateLayoutView';
import { PlateLayoutGrid } from './PlateLayoutGrid';
import type { PlateLayout } from '@/lib/plate-layout';
import './run-bench.css';

/** The bar's short names for what is listed: "Materials 4 · Mix cards 2". */
const kindCounts: Record<PreparationKind, string> = { sample: 'Samples', material: 'Materials', mix: 'Mix cards', plate: 'Plates', equipment: 'Equipment' };

/**
 * 实验准备: one quiet bar above the steps that opens into the groups' quantities and systems (`children`), what still
 * needs attention, and what to have ready. Ticks are a bench aid saved per item without touching progress; the list itself
 * is derived, never stored, so it follows every change. It opens by itself only while something must be entered first.
 */
export function RunPreparationChecklist({ experimentId, view, list, editable, plates = [], documentPlates = [], startOpen, children, footer }: {
  experimentId: string; view: StructuredRunView; list: PreparationChecklist; editable: boolean; plates?: PlateAttachment[]; documentPlates?: PlateLayout[]; startOpen: boolean; children?: ReactNode; footer?: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(startOpen);
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
  return <details id="run-preparation" className="ln-prep" open={open} onToggle={event => setOpen(event.currentTarget.open)} aria-label="Run preparation">
    <summary className="ln-prep-bar focus-ring">
      <strong>Preparation</strong>
      {list.items.length ? <span className="ln-prep-progress" role="status">{`Ready ${progress.done}/${progress.total}`}</span> : null}
      {kinds.length ? <span className="ln-prep-counts">{kinds.map(kind => `${kindCounts[kind]} ${list.items.filter(item => item.kind === kind).length}`).join(' · ')}</span> : null}
      {list.warnings.length ? <span className="ln-prep-alert" aria-label={`${list.warnings.length} to check`}><AlertTriangle aria-hidden />{list.warnings.length}</span> : null}
      <ChevronDown aria-hidden className="ln-prep-chevron" />
    </summary>
    <div className="ln-prep-body">
      {children}
      {list.warnings.length ? <ul className="ln-prep-warnings" role="status" aria-label="Checks before running">{list.warnings.map(warning => <li key={warning}><AlertTriangle aria-hidden />{warning}</li>)}</ul> : null}
      {kinds.length ? <div className="ln-prep-modules">{kinds.map(kind => <section key={kind} className="ln-prep-group" aria-label={preparationKindLabels[kind]}>
        <h4>{preparationKindLabels[kind]}</h4>
        <ul>{list.items.filter(item => item.kind === kind).map(item => <ChecklistItem key={item.key} item={item} state={ticks[item.key]} editable={editable && !pending} onChange={patch => write(item.key, patch)}>
          {kind === 'plate' ? <PlateItem itemKey={item.key} plates={plates} documentPlates={documentPlates} /> : null}
        </ChecklistItem>)}</ul>
      </section>)}</div> : <p className="ln-prep-empty">Materials, mix cards, plates and equipment to have ready are listed here once the run quantities are filled in.</p>}
      {footer ? <div className="ln-prep-footer">{footer}</div> : null}
      {message ? <p role="alert" className="ln-prep-error">{message}</p> : null}
    </div>
  </details>;
}

function ChecklistItem({ item, state, editable, onChange, children }: { item: PreparationItem; state: PreparationState | undefined; editable: boolean; onChange: (patch: { done: boolean; note?: string }) => void; children?: ReactNode }) {
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

/** A plate to have ready: the layout written in the record, or the planner file attached before plates could be written there. */
function PlateItem({ itemKey, plates, documentPlates }: { itemKey: string; plates: PlateAttachment[]; documentPlates: PlateLayout[] }) {
  const layout = documentPlates.find(plate => `plate:layout-${plate.id}` === itemKey);
  if (layout) return <PlateLayoutGrid layout={layout} caption={false} />;
  const attachment = plates.find(plate => `plate:${plate.id}` === itemKey);
  return attachment ? <PlateLayoutView attachment={attachment} /> : null;
}
