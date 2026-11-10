'use client';

import { createContext, useContext, useEffect, useId, useRef, useState, useTransition, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { CalendarPlus, MoreHorizontal, Plus, X } from 'lucide-react';
import { useI18n } from './I18nProvider';
import { ExperimentProtocolPicker, type ExperimentProtocolVersionOption } from './ExperimentProtocolPicker';
import { useModalDialog } from './ui/ModalDialogProvider';
import { buttonStyles } from './ui/Button';
import { formInputClass, formLabelClass, formTextareaClass } from './forms';
import { dayLabel } from '@/lib/experiment-days';
import { readableError } from '@/lib/form-actions';
import type { DayActionResult } from '@/app/experiments/[id]/day-actions';

/** A part of the run as its menu needs it (Q431): what it is, where its steps are, and why it cannot be removed (null: it can). */
export type DayPart = {
  kind: 'protocol' | 'custom'; title: string; protocolId?: string; versionId?: string; lines?: string; blocker: string | null;
  steps: Array<{ ref: string; order: number; completed: boolean; dayKey: string | null }>;
};
export type DayControlsData = { experimentId: string; days: Array<{ index: number; dayKey: string }>; parts: Record<string, DayPart>; canAddDay: boolean };

const DayControls = createContext<DayControlsData | null>(null);
export function DayControlsProvider({ value, children }: { value: DayControlsData | undefined; children: ReactNode }) {
  return <DayControls.Provider value={value ?? null}>{children}</DayControls.Provider>;
}
export const useDayControls = () => useContext(DayControls);

const actions = () => import('@/app/experiments/[id]/day-actions');
type Mode = 'protocol' | 'custom';
type Dialog =
  | { kind: 'add'; dayKey: string; mode: Mode }
  | { kind: 'replace'; groupKey: string; part: DayPart }
  | { kind: 'move'; groupKey: string; part: DayPart; fromDayKey: string | null };

/** The choices a day heading offers (Q428): an empty day shows both ways to fill it; a day with something on it, one quiet "＋ 加一份". */
export function DayMethodButtons({ dayKey, parts }: { dayKey: string; parts: number }) {
  const controls = useDayControls();
  const { locale } = useI18n();
  const zh = locale === 'zh';
  const [dialog, setDialog] = useState<Dialog | null>(null);
  if (!controls) return null;
  const open = (mode: Mode) => setDialog({ kind: 'add', dayKey, mode });
  return <>
    {parts ? <button type="button" className="ln-execution-day-add focus-ring" onClick={() => open('protocol')} data-i18n-ignore><Plus aria-hidden />{zh ? '加一份' : 'Add a part'}</button>
      : <span className="ln-execution-day-methods" data-i18n-ignore>
        <button type="button" className="focus-ring" onClick={() => open('protocol')}>{zh ? '按规程执行' : 'Follow a Protocol'}</button>
        <button type="button" className="focus-ring" onClick={() => open('custom')}>{zh ? '自定义步骤' : 'Custom steps'}</button>
      </span>}
    {dialog ? <DayDialog dialog={dialog} controls={controls} onClose={() => setDialog(null)} /> : null}
  </>;
}

/** ⋯ beside a part on a day (Q429, Q431): move it (from a chosen step on), change its version or rewrite its steps, or remove it. */
export function DayPartMenu({ groupKey, dayKey }: { groupKey: string; dayKey?: string }) {
  const controls = useDayControls();
  const { locale } = useI18n();
  const zh = locale === 'zh';
  const router = useRouter();
  const { confirm } = useModalDialog();
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => { if (event instanceof KeyboardEvent ? event.key === 'Escape' : !menuRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  const part = controls?.parts[groupKey];
  if (!controls || !part) return null;
  const fromDayKey = dayKey === 'unscheduled' ? null : dayKey ?? null;
  const canMove = Boolean(dayKey) && controls.days.length > 1 || dayKey === 'unscheduled';
  // Said on click, beside the heading: once a run is under way most parts have records, so this is the common case.
  const blocked = (text: string) => { setOpen(false); setMessage(text); };
  const remove = async () => {
    setOpen(false);
    if (part.blocker) { blocked(part.blocker); return; }
    const ok = await confirm({ title: zh ? `移除「${part.title}」？` : `Remove “${part.title}”?`, description: zh ? `它的 ${part.steps.length} 步和日程里的位置一起移除。` : `Its ${part.steps.length} steps and their place on the schedule go with it.`, confirmLabel: zh ? '移除' : 'Remove', tone: 'destructive' });
    if (!ok) return;
    startTransition(async () => {
      const result = await (await actions()).removeDayPartAction({ experimentId: controls.experimentId, groupKey });
      if (result.ok) { setMessage(''); router.refresh(); } else setMessage(readableError(result.error));
    });
  };
  return <span className="ln-day-part-menu" ref={menuRef} data-i18n-ignore>
    <button type="button" className="ln-day-part-menu-button focus-ring" aria-haspopup="menu" aria-expanded={open} aria-label={zh ? `${part.title}：移动、修改或移除` : `${part.title}: move, change or remove`} disabled={pending} onClick={() => { setMessage(''); setOpen(value => !value); }}><MoreHorizontal aria-hidden /></button>
    {open ? <span className="ln-day-part-menu-list" role="menu">
      {canMove ? <button type="button" role="menuitem" onClick={() => { setOpen(false); setDialog({ kind: 'move', groupKey, part, fromDayKey }); }}>{fromDayKey ? (zh ? '移到另一天…' : 'Move to another day…') : (zh ? '安排到…' : 'Place on a day…')}</button> : null}
      <button type="button" role="menuitem" onClick={() => { if (part.blocker) blocked(part.blocker); else { setOpen(false); setDialog({ kind: 'replace', groupKey, part }); } }}>{part.kind === 'protocol' ? (zh ? '换版本…' : 'Change version…') : (zh ? '编辑步骤…' : 'Edit steps…')}</button>
      <button type="button" role="menuitem" className="is-danger" onClick={remove}>{zh ? '移除' : 'Remove'}</button>
    </span> : null}
    {message ? <span className="ln-day-part-message" role="status">{message}<button type="button" className="focus-ring" aria-label={zh ? '关闭' : 'Close'} onClick={() => setMessage('')}><X aria-hidden /></button></span> : null}
    {dialog ? <DayDialog dialog={dialog} controls={controls} onClose={() => setDialog(null)} /> : null}
  </span>;
}

/** ＋ 加一天 after the last day (Q433): the schedule's own "加一天". */
export function AddDayButton() {
  const controls = useDayControls();
  const { locale } = useI18n();
  const zh = locale === 'zh';
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  if (!controls) return null;
  return <div className="ln-execution-add-day" data-i18n-ignore>
    <button type="button" className="focus-ring" disabled={pending || !controls.canAddDay} onClick={() => startTransition(async () => {
      const result = await (await actions()).addDayAction(controls.experimentId);
      if (result.ok) { setError(''); router.refresh(); } else setError(readableError(result.error));
    })}><CalendarPlus aria-hidden />{pending ? (zh ? '正在加…' : 'Adding…') : zh ? '加一天' : 'Add a day'}</button>
    {!controls.canAddDay ? <span>{zh ? '日程最长 60 天。' : 'A schedule spans 60 days at most.'}</span> : null}
    {error ? <span role="alert">{error}</span> : null}
  </div>;
}

/** The method chooser of a day, the same one a new experiment starts with (方法来源); also 换版本 / 编辑步骤 and 移到…. */
function DayDialog({ dialog, controls, onClose }: { dialog: Dialog; controls: DayControlsData; onClose: () => void }) {
  const { locale } = useI18n();
  const zh = locale === 'zh';
  const router = useRouter();
  const titleId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [mode, setMode] = useState<Mode>(dialog.kind === 'add' ? dialog.mode : dialog.kind === 'replace' ? dialog.part.kind : 'protocol');
  const [dayKey, setDayKey] = useState(dialog.kind === 'add' ? dialog.dayKey : controls.days.find(day => dialog.kind === 'move' && day.dayKey !== dialog.fromDayKey)?.dayKey ?? '');
  const [versions, setVersions] = useState<ExperimentProtocolVersionOption[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState(dialog.kind === 'replace' && dialog.part.kind === 'custom' ? dialog.part.title : '');
  const [lines, setLines] = useState(dialog.kind === 'replace' ? dialog.part.lines ?? '' : '');
  const chunk = dialog.kind === 'move' ? dialog.part.steps.filter(step => step.dayKey === dialog.fromDayKey) : [];
  const [fromStep, setFromStep] = useState(chunk.find(step => !step.completed)?.ref ?? chunk[0]?.ref ?? '');
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cardRef.current?.querySelector<HTMLElement>('select, input, textarea, button')?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKey); };
  }, [onClose]);
  useEffect(() => {
    if (dialog.kind === 'move' || mode !== 'protocol' || versions) return;
    let active = true;
    actions().then(loaded => loaded.protocolVersionChoices()).then(list => { if (active) setVersions(list); }).catch(() => { if (active) setError(zh ? '规程列表没有载入，请重试。' : 'The Protocol list did not load; try again.'); });
    return () => { active = false; };
  }, [dialog.kind, mode, versions, zh]);

  // 换版本 offers the other versions of the same Protocol.
  const choices = versions && dialog.kind === 'replace' ? versions.filter(version => version.protocol.id === dialog.part.protocolId && version.id !== dialog.part.versionId) : versions;
  const label = (day: { index: number; dayKey: string }) => dayLabel(day, zh);
  const submit = () => {
    setError('');
    const method = mode === 'protocol' ? { kind: 'protocol' as const, protocolVersionIds: selected } : { kind: 'custom' as const, title: title.trim() || undefined, steps: lines };
    if (dialog.kind !== 'move' && mode === 'protocol' && !selected.length) { setError(zh ? '先选一份规程。' : 'Choose a Protocol first.'); return; }
    // As the new-experiment form checks: a version whose steps are not confirmed cannot be fixed into a run.
    const unconfirmed = dialog.kind !== 'move' && mode === 'protocol' ? choices?.find(version => selected.includes(version.id) && (version.execution?.executionNeedsReview || !version.execution?.steps.length)) : undefined;
    if (unconfirmed) { setError(zh ? `「${unconfirmed.protocol.title}」v${unconfirmed.displayVersion} 的执行步骤还没有确认：先在规程里整理并保存步骤，或选另一个版本。` : `The steps of “${unconfirmed.protocol.title}” v${unconfirmed.displayVersion} are not confirmed: tidy and save them in the Protocol first, or choose another version.`); return; }
    if (dialog.kind !== 'move' && mode === 'custom' && !lines.trim()) { setError(zh ? '写下至少一步：每行一步。' : 'Write at least one step, one per line.'); return; }
    startTransition(async () => {
      const server = await actions();
      const result: DayActionResult = dialog.kind === 'add' ? await server.addMethodToDay({ experimentId: controls.experimentId, dayKey, method })
        : dialog.kind === 'replace' ? await server.replaceDayPartAction({ experimentId: controls.experimentId, groupKey: dialog.groupKey, method })
        : await server.moveDayPartAction({ experimentId: controls.experimentId, groupKey: dialog.groupKey, fromDayKey: dialog.fromDayKey, toDayKey: dayKey, ...(fromStep && fromStep !== chunk[0]?.ref ? { fromStepRef: fromStep } : {}) });
      if (result.ok) { onClose(); router.refresh(); } else setError(readableError(result.error));
    });
  };
  const heading = dialog.kind === 'add' ? (zh ? '这一天按什么执行' : 'How this day is done')
    : dialog.kind === 'replace' ? (dialog.part.kind === 'protocol' ? (zh ? `换版本 · ${dialog.part.title}` : `Change version · ${dialog.part.title}`) : (zh ? `编辑步骤 · ${dialog.part.title}` : `Edit steps · ${dialog.part.title}`))
    : dialog.fromDayKey ? (zh ? `移到另一天 · ${dialog.part.title}` : `Move to another day · ${dialog.part.title}`) : (zh ? `安排到 · ${dialog.part.title}` : `Place on a day · ${dialog.part.title}`);

  return createPortal(<div className="ln-modal-layer fixed inset-0 z-[90] grid place-items-center p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !pending) onClose(); }}>
    <div className="ln-modal-backdrop pointer-events-none absolute inset-0 bg-ink/35" aria-hidden />
    <section ref={cardRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={pending || undefined} className="ln-modal-card ln-day-dialog relative z-10 w-full overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface shadow-soft" data-kind={dialog.kind}>
      <header className="flex items-start justify-between gap-4 border-b border-hairline px-4 py-3">
        <h2 id={titleId} className="min-w-0 text-base font-semibold leading-snug text-ink" data-i18n-ignore>{heading}</h2>
        <button type="button" onClick={onClose} disabled={pending} className="focus-ring flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--ln-radius-control-sm)] text-muted hover:bg-stone hover:text-ink" aria-label={zh ? '关闭' : 'Close'}><X className="h-4 w-4" aria-hidden /></button>
      </header>
      <div className="ln-day-dialog-body">
        {dialog.kind !== 'replace' ? <label className="block" data-i18n-ignore><span className={formLabelClass}>{dialog.kind === 'move' ? dialog.fromDayKey ? (zh ? '移到' : 'Move to') : (zh ? '安排到' : 'Place on') : (zh ? '加到' : 'Add to')}</span>
          <select className={formInputClass} value={dayKey} onChange={event => setDayKey(event.target.value)}>{controls.days.filter(day => dialog.kind !== 'move' || day.dayKey !== dialog.fromDayKey).map(day => <option key={day.dayKey} value={day.dayKey}>{label(day)}</option>)}</select></label> : null}
        {dialog.kind === 'move' ? chunk.length > 1 ? <label className="block" data-i18n-ignore><span className={formLabelClass}>{zh ? '从这一步起' : 'From this step on'}</span>
          <select className={formInputClass} value={fromStep} onChange={event => setFromStep(event.target.value)}>{chunk.map(step => <option key={step.ref} value={step.ref} disabled={step.completed}>{zh ? `第 ${step.order} 步${step.completed ? '（已完成）' : ''}` : `Step ${step.order}${step.completed ? ' (done)' : ''}`}</option>)}</select></label> : null
          : <>
            {dialog.kind === 'add' ? <div className="ln-segmented" role="group" aria-label={zh ? '方法来源' : 'Method source'} data-i18n-ignore>
              <button type="button" aria-pressed={mode === 'protocol'} onClick={() => setMode('protocol')} className="focus-ring">{zh ? '按规程执行' : 'Follow a Protocol'}</button>
              <button type="button" aria-pressed={mode === 'custom'} onClick={() => setMode('custom')} className="focus-ring">{zh ? '自定义步骤' : 'Custom steps'}</button>
            </div> : null}
            {mode === 'protocol' ? choices ? choices.length ? <ExperimentProtocolPicker versions={choices} onSelectionChange={setSelected} /> : <p className="text-sm text-muted" data-i18n-ignore>{zh ? '这份规程没有其他版本。' : 'This Protocol has no other version.'}</p>
              : <p className="text-sm text-muted" data-i18n-ignore>{zh ? '正在载入规程…' : 'Loading Protocols…'}</p>
              : <div className="space-y-3" data-i18n-ignore>
                <label className="block"><span className={formLabelClass}>{zh ? '名称 · 可不填' : 'Name · optional'}</span><input className={formInputClass} value={title} onChange={event => setTitle(event.target.value)} placeholder={zh ? '例如：收样' : 'e.g. Harvest'} /></label>
                <label className="block"><span className={formLabelClass}>{zh ? '步骤 · 每行一步' : 'Steps · one per line'}</span><textarea className={`${formTextareaClass} min-h-32`} value={lines} onChange={event => setLines(event.target.value)} placeholder={zh ? '收集上清 | 1500 g 离心 5 min\n提取 RNA' : 'Collect supernatant | spin 1500 g, 5 min\nExtract RNA'} /><span className="mt-1 block text-xs leading-5 text-muted">{zh ? '竖线后写这一步的说明。' : 'After a vertical bar, add a note for that step.'}</span></label>
              </div>}
          </>}
        {error ? <p role="alert" className="ln-day-dialog-error">{error}</p> : null}
      </div>
      <footer className="flex flex-wrap justify-end gap-2 border-t border-hairline px-4 py-3" data-i18n-ignore>
        <button type="button" className={buttonStyles({ size: 'md' })} onClick={onClose} disabled={pending}>{zh ? '取消' : 'Cancel'}</button>
        <button type="button" className={buttonStyles({ variant: 'primary', size: 'md' })} onClick={submit} disabled={pending || (dialog.kind === 'move' && !dayKey)}>{pending ? (zh ? '正在保存…' : 'Saving…') : dialog.kind === 'add' ? (zh ? '加入这一天' : 'Add to this day') : dialog.kind === 'replace' ? (zh ? '保存' : 'Save') : (zh ? '移动' : 'Move')}</button>
      </footer>
    </section>
  </div>, document.body);
}
