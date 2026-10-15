'use client';
import { readableError } from '@/lib/form-actions';
import { createContext, useRef, useState, useTransition, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Pause, Play, Square, Timer, X } from 'lucide-react';
import { convert, normalizeUnit, parseScalar, units } from '@/lib/calculators/quantities';
import { chipAmount, chipParameterIds, parameterLongName } from '@/lib/protocol-chips';
import { adoptableCalculation, calculationGroups, protocolCalculations } from '@/lib/protocol-calculations';
import { calculationReceiptMatches, previewProtocolCalculation, protocolCalculationFingerprint, resolveProtocolSystem, type ProtocolCalculation, type ResolvedProtocolParameter, type StepActualField } from '@/lib/structured-protocol';
import type { ProtocolSystems } from '@/lib/protocol-systems-schema';
import { formatStepTimer, remainingStepTimerSeconds } from '@/lib/step-timer';
import { newClientMutationId } from '@/lib/client-mutation-id';
import { useRunClock } from '../useRunClock';
import { useAnchoredPosition, useDismiss } from './popover';
import type { ExecutionPlan } from '@/lib/structured-run';

type Quantity = { value: number; unit: string };
/** One step's execution state as its chips need it on the Run page. */
export type RunChipStep = {
  experimentId: string; stepId: string; versionId: string; revision: number; editable: boolean; completed: boolean; blocked: boolean;
  systems: ProtocolSystems; selections: Record<string, string>; actualInputs: Record<string, Quantity>; receipts: Record<string, ProtocolCalculation>;
  actualValues: Record<string, Quantity & { recordedAt: string }>;
  fields: StepActualField[];
  timer: { durationSeconds: number | null; remainingSeconds: number | null; startedAt: string | null; pausedAt: string | null; parameterId?: string };
  /** This version's 本次数量 by label, the confirmed mix cards ("stepId:mixId") and their crossed-off lines. */
  quantities: Record<string, number>;
  mixes: ExecutionPlan['mixes'];
  strikes: Record<string, string[]>;
};
export const RunChipContext = createContext<RunChipStep | null>(null);
/** The step's chips as this run adopted them, with its measured inputs and confirmed calculations. */
export const stepResolution = (step: RunChipStep) => resolveProtocolSystem(step.systems, step.selections, step.actualInputs, step.receipts).parameters;

const isTime = (unit: string) => units[normalizeUnit(unit)]?.dimension === 'time';
const secondsLeft = (timer: RunChipStep['timer'], now: number) => remainingStepTimerSeconds({ remainingSeconds: timer.remainingSeconds ?? timer.durationSeconds ?? 0, startedAt: timer.startedAt ? new Date(timer.startedAt) : null, now: new Date(now) });

/** A chip on the Run page: a time chip counts down, any chip takes this run's actual value, a value filled at execution or a calculation is done in place. */
export function RunChipTrigger({ id, step, children }: { id: string; step: RunChipStep; children: ReactNode }) {
  // The open panel's anchor; null when closed.
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const clock = useRunClock();
  const ids = chipParameterIds(id, step.systems);
  const missing = ids.some(pid => step.fields.find(f => f.id === pid)?.required && !step.actualValues[pid]);
  const recorded = ids.filter(pid => step.actualValues[pid]);
  const running = step.timer.startedAt && step.timer.parameterId && ids.includes(step.timer.parameterId) ? secondsLeft(step.timer, clock.now) : undefined;
  return <>
    <button type="button" className="ln-run-chip focus-ring" data-missing={missing || undefined} data-running={running !== undefined || undefined} aria-haspopup="dialog" aria-expanded={Boolean(anchor)} onClick={event => { const target = event.currentTarget; setAnchor(current => current ? null : target); }}>
      {children}
      {running !== undefined ? <span className="ln-run-chip-timer" aria-label={`剩余 ${formatStepTimer(running)}`}><Timer aria-hidden />{formatStepTimer(running)}</span> : null}
      {recorded.length ? <span className="ln-run-chip-actual">实际 {recorded.map(pid => chipAmount(step.actualValues[pid].value, step.actualValues[pid].unit)).join(' · ')}</span> : missing ? <span className="ln-run-chip-required">待记录</span> : null}
    </button>
    {anchor ? <RunChipPanel id={id} ids={ids} step={step} anchor={anchor} onClose={() => setAnchor(null)} /> : null}
  </>;
}

function RunChipPanel({ id, ids, step, anchor, onClose }: { id: string; ids: string[]; step: RunChipStep; anchor: HTMLElement; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const style = useAnchoredPosition(anchor, panel, [step]);
  useDismiss(panel, anchor, onClose);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const parameters = ids.flatMap(pid => step.systems.parameters.find(p => p.id === pid) ?? []);
  const resolution = stepResolution(step);
  const calculated = parameters.find(p => p.source.kind === 'calculator');
  const act = (run: () => Promise<{ error?: string }>) => startTransition(async () => { setError(''); const result = await run(); if (result.error) setError(readableError(result.error)); else router.refresh(); });
  const locked = !step.editable || step.completed;
  return createPortal(<div ref={panel} className="ln-chip-popover" style={style} role="dialog" aria-label="本次执行" onMouseDown={event => event.stopPropagation()}>
    <header className="ln-chip-popover-header"><strong>{parameters.length === 1 ? parameterLongName(parameters[0], step.systems) : step.systems.tools?.find(t => t.id === id)?.method || '本次执行'}</strong><span className="flex-1" /><button type="button" className="focus-ring ln-chip-icon-button" aria-label="关闭" onClick={onClose}><X aria-hidden /></button></header>
    <div className="ln-chip-popover-body">
      {calculated ? <StepCalculation parameter={calculated} step={step} disabled={locked || pending} onConfirm={(ids, inputs) => act(async () => { const { updateStepInputs } = await import('@/app/experiments/[id]/run/actions'); return updateStepInputs({ experimentId: step.experimentId, versionId: step.versionId, expectedRevision: step.revision, actualInputs: inputs, confirmCalculations: ids }); })} />
        : parameters.map(parameter => <ParameterRow key={parameter.id} label={ids.length > 1 ? parameterLongName(parameter, step.systems) : undefined} parameter={parameter} resolved={resolution[parameter.id]} step={step} disabled={locked || pending}
          onInput={value => act(async () => { const { updateStepInputs } = await import('@/app/experiments/[id]/run/actions'); return updateStepInputs({ experimentId: step.experimentId, versionId: step.versionId, expectedRevision: step.revision, actualInputs: { [parameter.id]: { value, unit: parameter.unit } } }); })}
          onActual={value => act(async () => { const { saveStructuredStepRecord } = await import('@/app/experiments/[id]/run/actions'); const form = new FormData(); form.set('experimentId', step.experimentId); form.set('stepId', step.stepId); form.set('executionPlanRevision', String(step.revision)); form.set('clientMutationId', newClientMutationId()); form.set('intent', 'actual'); form.set('values', JSON.stringify({ [parameter.id]: { value, unit: parameter.unit } })); return saveStructuredStepRecord({}, form); })}
          onTimer={intent => act(async () => { const { updateStepTimer } = await import('@/app/experiments/[id]/run/actions'); const form = new FormData(); form.set('experimentId', step.experimentId); form.set('stepId', step.stepId); form.set('timerIntent', intent); form.set('executionPlanRevision', String(step.revision)); form.set('parameterId', parameter.id); return updateStepTimer({}, form); })} />)}
      {locked && step.editable ? <p className="ln-chip-note">此步骤已完成，记录不再修改。</p> : null}
      {error ? <p role="alert" className="ln-chip-error">{error}</p> : null}
    </div>
  </div>, document.body);
}

function ParameterRow({ label, parameter, resolved, step, disabled, onInput, onActual, onTimer }: {
  label?: string; parameter: ProtocolSystems['parameters'][number]; resolved?: ResolvedProtocolParameter; step: RunChipStep; disabled: boolean;
  onInput: (value: number) => void; onActual: (value: number) => void; onTimer: (intent: 'start' | 'pause' | 'reset' | 'finish') => void;
}) {
  const clock = useRunClock();
  const actual = step.actualValues[parameter.id];
  const planned = resolved?.status === 'resolved' ? chipAmount(resolved.value!, resolved.unit, parameter.source.kind === 'calculator') : undefined;
  const [text, setText] = useState(actual ? String(actual.value) : parameter.source.kind === 'actual' && resolved?.status === 'resolved' ? String(resolved.value) : '');
  let value: number | undefined; try { value = text.trim() ? parseScalar(text.replace(/,/g, '')) : undefined; } catch { value = undefined; }
  const field = step.fields.find(f => f.id === parameter.id);
  const ownTimer = step.timer.parameterId === parameter.id;
  const remaining = ownTimer ? secondsLeft(step.timer, clock.now) : undefined;
  const running = ownTimer && Boolean(step.timer.startedAt) && (remaining ?? 0) > 0;
  const otherRunning = Boolean(step.timer.startedAt) && !ownTimer;
  return <div className="ln-run-chip-row">
    {label ? <span className="ln-chip-field-label">{label}</span> : null}
    {parameter.source.kind === 'actual'
      ? <label className="ln-run-chip-input">本次数值<span><input className="ln-chip-input is-number" inputMode="decimal" value={text} disabled={disabled} onChange={event => setText(event.target.value)} autoFocus /><span className="ln-chip-note">{parameter.unit}</span></span></label>
      : <p className="ln-run-chip-planned">规定 <strong>{planned ?? '待确定'}</strong></p>}
    {parameter.source.kind === 'actual'
      ? <button type="button" className="focus-ring ln-chip-done" disabled={disabled || value === undefined} onClick={() => value !== undefined && onInput(value)}>保存</button>
      : field ? <label className="ln-run-chip-input">实际{field.required ? '（必填）' : ''}<span><input className="ln-chip-input is-number" inputMode="decimal" placeholder={resolved?.status === 'resolved' ? String(Number(resolved.value!.toPrecision(6))) : '—'} value={text} disabled={disabled || step.blocked} onChange={event => setText(event.target.value)} /><span className="ln-chip-note">{parameter.unit}</span><button type="button" className="focus-ring ln-chip-done" disabled={disabled || step.blocked || value === undefined || value === actual?.value} onClick={() => value !== undefined && onActual(value)}>记录</button></span></label> : null}
    {isTime(parameter.unit) && resolved?.status === 'resolved' && parameter.source.kind !== 'actual' ? <div className="ln-run-chip-countdown" data-running={running || undefined}>
      <span className="ln-run-chip-clock">{formatStepTimer(remaining ?? Math.round(convert(resolved.value!, resolved.unit, 's')))}</span>
      {running ? <button type="button" className="focus-ring" disabled={disabled} onClick={() => onTimer('pause')}><Pause aria-hidden />暂停</button>
        : <button type="button" className="focus-ring is-primary" disabled={disabled || step.blocked || otherRunning || remaining === 0} onClick={() => onTimer('start')}><Play aria-hidden />{ownTimer && step.timer.pausedAt && remaining ? '继续' : '开始倒计时'}</button>}
      {ownTimer && (step.timer.startedAt || step.timer.pausedAt) ? <button type="button" className="focus-ring" disabled={disabled} onClick={() => onTimer('finish')}><Square aria-hidden />结束</button> : null}
      {ownTimer && remaining === 0 ? <button type="button" className="focus-ring" disabled={disabled} onClick={() => onTimer('reset')}>重新计时</button> : null}
      {otherRunning ? <p className="ln-chip-note">这一步正在进行另一个计时。</p> : null}
      {remaining === 0 ? <p className="ln-chip-note" role="status">计时已到，步骤仍需勾选完成。</p> : null}
    </div> : null}
  </div>;
}

/** A calculation confirmed where it is used: its inputs (measured ones filled here), the result preview, one confirmation for every result computed together. */
function StepCalculation({ parameter, step, disabled, onConfirm }: { parameter: ProtocolSystems['parameters'][number]; step: RunChipStep; disabled: boolean; onConfirm: (ids: string[], inputs: Record<string, Quantity>) => void }) {
  const group = calculationGroups(step.systems.parameters).find(item => item.results.some(result => result.id === parameter.id));
  const [inputs, setInputs] = useState<Record<string, string>>({});
  if (!group) return null;
  const spec = protocolCalculations[group.source.calculatorId];
  const typed = Object.fromEntries(Object.entries(inputs).flatMap(([id, text]) => { try { return text.trim() ? [[id, { value: parseScalar(text), unit: step.systems.parameters.find(p => p.id === id)!.unit }]] : []; } catch { return []; } })) as Record<string, Quantity>;
  const resolution = resolveProtocolSystem(step.systems, step.selections, { ...step.actualInputs, ...typed }, step.receipts);
  const rows = group.results.map(result => {
    const receipt = step.receipts[result.id];
    try {
      const current = Boolean(receipt?.confirmedAt && adoptableCalculation(receipt.snapshot) && calculationReceiptMatches(receipt.fingerprint, protocolCalculationFingerprint(result, resolution.parameters)));
      return { result, current, preview: current ? receipt : previewProtocolCalculation(result, resolution.parameters) };
    } catch (cause) { return { result, current: false, error: cause instanceof Error ? cause.message : '计算失败' }; }
  });
  const pending = rows.filter(row => row.preview && !row.current).map(row => row.result.id);
  const shown = rows.find(row => row.preview)?.preview;
  return <section className="ln-run-calc" aria-label={`${spec.label}计算`}>
    <p className="ln-chip-note">{spec.label} · {spec.note}</p>
    <dl className="ln-run-calc-inputs">{spec.inputs.map(input => {
      const id = group.source.inputs[input.key] ?? '', source = step.systems.parameters.find(p => p.id === id), value = resolution.parameters[id];
      return <div key={input.key}><dt>{input.label}</dt><dd>{source?.source.kind === 'actual'
        ? <span className="ln-run-chip-input"><input className="ln-chip-input is-number" inputMode="decimal" aria-label={input.label} disabled={disabled} value={inputs[id] ?? (step.actualInputs[id] ? String(step.actualInputs[id].value) : '')} onChange={event => setInputs(current => ({ ...current, [id]: event.target.value }))} /><span className="ln-chip-note">{source.unit}</span></span>
        : value?.status === 'resolved' ? chipAmount(value.value!, value.unit) : input.optional ? '—' : '待填写'}</dd></div>;
    })}</dl>
    <ul className="ln-run-calc-results">{rows.map(row => <li key={row.result.id}><span>{parameterLongName(row.result, step.systems)}</span><strong>{row.preview ? chipAmount(row.preview.value, row.preview.unit, true) : '—'}</strong><small>{row.current ? '已采用' : row.preview ? '预览，尚未采用' : row.error}</small></li>)}</ul>
    {shown?.snapshot.warnings.length ? <ul className="ln-chip-error">{shown.snapshot.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul> : null}
    {shown ? <p className="ln-chip-note">方法版本 {shown.snapshot.methodVersion}{rows.every(row => row.current) && step.receipts[parameter.id] ? ` · 确认于 ${new Date(step.receipts[parameter.id].confirmedAt).toLocaleString('zh-CN', { hour12: false })}` : ''}</p> : null}
    <button type="button" className="focus-ring ln-chip-done" disabled={disabled || !pending.length} onClick={() => onConfirm(pending, typed)}>{pending.length ? '计算并确认采用' : '已确认'}</button>
  </section>;
}
