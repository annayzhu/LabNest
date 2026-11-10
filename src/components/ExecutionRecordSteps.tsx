'use client';
import { readableError } from '@/lib/form-actions';
import { createContext, useContext, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Check, ChevronRight } from 'lucide-react';
import { newClientMutationId } from '@/lib/client-mutation-id';
import { deviationTypeLabel, deviationTypeOptions, executionSegments } from '@/lib/experiment-document';
import { dayRunLabel, dayStatusLabel, type DayStatus } from '@/lib/experiment-days';
import { ScientificBlockView } from './ScientificBlockView';
import { DayMethodButtons, DayPartMenu } from './ExperimentDayControls';
import { useI18n } from './I18nProvider';
import type { ScientificContentBlock } from '@/lib/scientific-document';
import './execution-record.css';

type Execution = NonNullable<ScientificContentBlock['execution']>;
type Controls = { experimentId: string; revision?: number; editable: boolean };
type Deviation = { type: string; note: string; impact?: string; author?: string };

/** Present on the record and edit pages: steps in 执行记录 become checkable and take deviations. Without it they read as a report. */
const ExecutionRecordControls = createContext<Controls | null>(null);
export function ExecutionRecordProvider({ value, children }: { value: Controls; children: ReactNode }) {
  return <ExecutionRecordControls.Provider value={value}>{children}</ExecutionRecordControls.Provider>;
}

/**
 * A day of 执行记录 (Q426): "第 2 天 · 11/10 周二" (or a run of empty days) and how far it is, in the interface's language, with the
 * ways to fill it (Q428). The steps placed on no day, and writing on no day, come last under their own headings.
 */
export function ExecutionDayHeading({ execution }: { execution: Execution }) {
  const { locale } = useI18n();
  const zh = locale === 'zh';
  if (execution.index === undefined || !execution.meta) {
    const unassigned = execution.status === 'unassigned';
    return <div className="ln-execution-day" id={unassigned ? 'execution-day-unassigned' : 'execution-day-unscheduled'} data-status={execution.status}>
      <h3 data-i18n-ignore>{unassigned ? (zh ? '未分天的记录' : 'Notes on no day') : (zh ? '未安排的步骤' : 'Steps on no day')}</h3>
    </div>;
  }
  const status = (['unplanned', 'todo', 'active', 'done'].includes(execution.status ?? '') ? execution.status : 'todo') as DayStatus;
  // A run of empty days carries "<first day>/<last day>".
  const [firstKey, lastKey] = execution.meta.split('/');
  return <div className="ln-execution-day" id={`execution-day-${execution.index}`} data-status={status}>
    <h3 data-i18n-ignore>{dayRunLabel({ index: execution.index, dayKey: firstKey }, { index: execution.number ?? execution.index, dayKey: lastKey ?? firstKey }, zh)}</h3>
    <span className="ln-execution-day-status" data-i18n-ignore>{dayStatusLabel(status, zh)}</span>
    <DayMethodButtons dayKey={execution.dayKey ?? firstKey} parts={execution.parts ?? 0} />
  </div>;
}

/** A part of the run (a Protocol, or custom steps): its number, name and progress, and its menu where the record can change (Q431). */
export function ExecutionPartHeading({ execution }: { execution: Execution }) {
  return <div className="ln-execution-protocol-heading document-execution-group"><span className="ln-execution-protocol-index" aria-hidden>{execution.index}</span><h3>{execution.title}</h3>{execution.meta ? <span className="ln-execution-protocol-meta">{execution.meta}</span> : null}{execution.groupKey ? <DayPartMenu groupKey={execution.groupKey} dayKey={execution.dayKey} /> : null}</div>;
}

/**
 * One step of 执行记录: its check, number, authored title and state; deviations are written here and listed in 偏差与事件.
 * Keyed by its saved state, so fresh data from the server resets the optimistic check and any open form.
 */
export function ExecutionStepLine({ execution, children }: { execution: Execution; children?: ReactNode }) {
  return <StepLine key={`${execution.stepId}:${execution.completed}:${execution.deviationNote ?? ''}`} execution={execution}>{children}</StepLine>;
}

function StepLine({ execution, children }: { execution: Execution; children?: ReactNode }) {
  const controls = useContext(ExecutionRecordControls);
  // Inside the editable page the translator does not reach; server reasons may come in English.
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [editing, setEditing] = useState(false);
  const stepId = execution.stepId;
  const completed = optimistic ?? Boolean(execution.completed);
  const interactive = Boolean(controls?.editable && stepId);
  const blocked = !completed && Boolean(execution.blockedReason);
  const save = (change: { completed?: boolean; deviation?: Deviation | null }, after?: () => void) => {
    if (!controls || !stepId) return;
    setError('');
    if (change.completed !== undefined) setOptimistic(change.completed);
    startTransition(async () => {
      // Loaded on use: read-only documents render these lines without the server action.
      const { recordExecutionStep } = await import('@/app/experiments/[id]/run/actions');
      const result = await recordExecutionStep({ experimentId: controls.experimentId, stepId, clientMutationId: newClientMutationId(), expectedRevision: controls.revision, ...change });
      if (result.error) { setOptimistic(null); setError(result.error); } else after?.();
    });
  };
  return <div className="ln-execution-step-line" id={stepId ? `execution-step-${stepId}` : undefined} data-completed={completed || undefined} data-blocked={blocked || undefined} aria-busy={pending || undefined}>
    {interactive
      ? <button type="button" role="checkbox" aria-checked={completed} aria-label={`第 ${execution.number ?? ''} 步${completed ? '已完成' : '未完成'}`} title={blocked ? readableError(execution.blockedReason!) : undefined} disabled={pending || blocked} onClick={() => save({ completed: !completed })} className="ln-execution-check focus-ring">{completed ? <Check aria-hidden /> : null}</button>
      : <span className="ln-execution-check" data-static role="img" aria-label={completed ? '已完成' : '未完成'}>{completed ? <Check aria-hidden /> : null}</span>}
    <span className="ln-execution-step-number">{execution.number}.</span>
    <div className="ln-execution-step-main">
      {execution.title || execution.status || execution.deviationNote ? <p className="ln-execution-step-head">
        {execution.title ? <span className="ln-execution-step-title">{execution.title}</span> : null}
        {execution.status ? <span className="ln-execution-tag">{execution.status}</span> : null}
        {execution.deviationNote ? <a className="ln-execution-tag is-deviation" href={stepId ? `#deviation-${stepId}` : undefined}>{execution.deviationLabel ?? '偏差'}</a> : null}
      </p> : null}
      {children ? <div className="ln-execution-step-body">{children}</div> : null}
      {interactive && blocked ? <p className="ln-execution-hint">{readableError(execution.blockedReason!)}{controls ? <> · <Link href={`/experiments/${controls.experimentId}/run#step-${stepId}`}>去执行页</Link></> : null}</p> : null}
      {editing ? <DeviationForm execution={execution} pending={pending} onCancel={() => setEditing(false)} onSave={deviation => save({ deviation }, () => setEditing(false))} /> : null}
      {error ? <p role="alert" className="ln-execution-error">{t(readableError(error))}</p> : null}
    </div>
    <span className="ln-execution-step-end">
      {execution.completedAt && completed ? <time dateTime={execution.completedAt} suppressHydrationWarning>{format(new Date(execution.completedAt), 'MM-dd HH:mm')}</time> : null}
      {interactive && execution.allowsDeviation !== false ? <button type="button" className="ln-execution-action focus-ring" aria-expanded={editing} onClick={() => setEditing(open => !open)}>{execution.deviationNote ? '修改偏差' : '记录偏差'}</button> : null}
    </span>
  </div>;
}

function DeviationForm({ execution, pending, onSave, onCancel }: { execution: Execution; pending: boolean; onSave: (deviation: Deviation | null) => void; onCancel: () => void }) {
  const [type, setType] = useState(execution.deviationType ?? 'method');
  const [note, setNote] = useState(execution.deviationNote ?? '');
  const [impact, setImpact] = useState(execution.impact ?? '');
  const [author, setAuthor] = useState(execution.author ?? '');
  // Not a <form>: it can sit inside the Experiment editor's own form.
  return <div className="ln-deviation-form" role="group" aria-label={`第 ${execution.number ?? ''} 步的偏差`}>
    <div className="ln-deviation-form-row">
      <label>类型<select value={type} onChange={event => setType(event.target.value)} disabled={pending}>{deviationTypeOptions.map(option => <option key={option} value={option}>{deviationTypeLabel(option)}</option>)}</select></label>
      <label>记录人<input value={author} onChange={event => setAuthor(event.target.value)} disabled={pending} placeholder="可不填" /></label>
    </div>
    <label>与计划不同之处<textarea value={note} onChange={event => setNote(event.target.value)} disabled={pending} rows={2} placeholder="只写实际怎么做的，例如：实际离心 15 min" autoFocus /></label>
    <label>影响<input value={impact} onChange={event => setImpact(event.target.value)} disabled={pending} placeholder="对样本或结果的影响；未知可不填" /></label>
    <div className="ln-deviation-form-actions">
      <button type="button" className="focus-ring is-primary" disabled={pending || !note.trim()} onClick={() => onSave({ type, note: note.trim(), ...(impact.trim() ? { impact: impact.trim() } : {}), ...(author.trim() ? { author: author.trim() } : {}) })}>{pending ? '正在保存…' : '保存'}</button>
      <button type="button" className="focus-ring" disabled={pending} onClick={onCancel}>取消</button>
      {execution.deviationNote ? <button type="button" className="focus-ring is-danger" disabled={pending} onClick={() => onSave(null)}>清除偏差</button> : null}
    </div>
  </div>;
}

/** 执行记录 or 偏差与事件 inside the Experiment editor: run-derived blocks with folded groups (buttons, not <details>, inside the editable page). */
export function ExecutionRecordBlocks({ blocks }: { blocks: readonly ScientificContentBlock[] }) {
  return <div className="ln-execution-record">{executionSegments(blocks).map(segment => segment.kind === 'block'
    ? <div key={segment.block.id} className="document-block"><ScientificBlockView block={segment.block} /></div>
    : segment.kind === 'step'
      ? <div key={segment.block.id} className="document-block"><ExecutionStepLine execution={segment.block.execution!}>{segment.details.map(block => <div key={block.id} className="document-block"><ScientificBlockView block={{ ...block, execution: undefined }} /></div>)}</ExecutionStepLine></div>
      : <Fold key={segment.blocks[0].id} label={segment.label} blocks={segment.blocks} />)}</div>;
}

function Fold({ label, blocks }: { label: string; blocks: readonly ScientificContentBlock[] }) {
  const [open, setOpen] = useState(false);
  return <div className="document-block ln-execution-fold" data-open={open || undefined}>
    <button type="button" className="ln-execution-disclosure focus-ring" aria-expanded={open} onClick={() => setOpen(value => !value)}><ChevronRight aria-hidden data-open={open || undefined} />{label}</button>
    {open ? blocks.map(block => <div key={block.id} className="document-block"><ScientificBlockView block={block} /></div>) : null}
  </div>;
}
