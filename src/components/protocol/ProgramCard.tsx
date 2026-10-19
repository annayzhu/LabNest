'use client';
import { useState } from 'react';
import { Plus, Thermometer, X } from 'lucide-react';
import { formatQuantity } from '@/lib/calculators/quantity-format';
import { formatProgramDuration, parseProgramDuration, type ProtocolProgram } from '@/lib/protocol-program';
import { prefixedClientId as uid } from '@/lib/client-mutation-id';
import { useI18n } from '../I18nProvider';

/** A thermocycler program read as stages: cycles, then each temperature and its time. */
export function ProgramCard({ program }: { program: ProtocolProgram }) {
  const { t } = useI18n();
  return <figure className="ln-program-card">
    <figcaption><Thermometer aria-hidden />{program.label || t('Thermal cycling program')}</figcaption>
    <ol className="ln-program-stages">{program.stages.map(stage => <li key={stage.id} data-cycled={stage.cycles > 1 ? '' : undefined}>
      <span className="ln-program-cycles">{stage.cycles > 1 ? t(`${stage.cycles} cycles`) : ''}</span>
      <span className="ln-program-steps">{stage.steps.map(step => <span key={step.id} className="ln-program-step">
        {step.label ? <span className="ln-program-step-label">{step.label}</span> : null}
        <span className="ln-program-value">{formatQuantity(step.temperatureC)} °C</span>
        <span className="ln-program-value">{step.seconds === null ? t('Hold') : formatProgramDuration(step.seconds)}</span>
      </span>)}</span>
    </li>)}</ol>
  </figure>;
}

function DurationField({ seconds, onChange, label }: { seconds: number | null; onChange: (seconds: number | null) => void; label: string }) {
  const { t, locale } = useI18n();
  // "hold" and 保持 both parse back to a hold.
  const [text, setText] = useState(seconds === null ? (locale === 'zh' ? '保持' : 'hold') : formatProgramDuration(seconds));
  const [invalid, setInvalid] = useState(false);
  return <span className="ln-program-duration">
    <input aria-label={label} className="ln-program-input is-duration" value={text} aria-invalid={invalid || undefined} placeholder="15 s"
      onChange={event => { setText(event.target.value); const parsed = parseProgramDuration(event.target.value); setInvalid(parsed === undefined); if (parsed !== undefined) onChange(parsed); }} />
    {invalid ? <small role="alert" className="ln-chip-error">{t('Write 15 s, 3 min or hold')}</small> : null}
  </span>;
}

/** Edit a program in place: cycles per stage, then temperature and time per step ("15 s", "3 min", "保持"). */
export function ProgramEditor({ program, onChange }: { program: ProtocolProgram; onChange: (program: ProtocolProgram) => void }) {
  const { t } = useI18n();
  type Stage = ProtocolProgram['stages'][number];
  const setStage = (stage: Stage) => onChange({ ...program, stages: program.stages.map(s => s.id === stage.id ? stage : s) });
  return <div className="ln-program-editor">
    <label className="ln-program-title"><Thermometer aria-hidden /><input aria-label={t('Program name')} className="ln-program-input is-title" value={program.label} onChange={event => onChange({ ...program, label: event.target.value })} placeholder={t('PCR program')} /></label>
    {program.stages.map((stage, stageIndex) => <fieldset key={stage.id} className="ln-program-stage">
      <legend><label>{t('Cycles')}<input aria-label={t(`Cycles in stage ${stageIndex + 1}`)} className="ln-program-input is-cycles" inputMode="numeric" value={stage.cycles} onChange={event => { const cycles = Math.max(1, Math.round(Number(event.target.value) || 1)); setStage({ ...stage, cycles }); }} />{t('times')}</label>
        <button type="button" className="focus-ring ln-chip-icon-button" aria-label={t(`Delete stage ${stageIndex + 1}`)} disabled={program.stages.length < 2} onClick={() => onChange({ ...program, stages: program.stages.filter(s => s.id !== stage.id) })}><X aria-hidden /></button></legend>
      {stage.steps.map((step, stepIndex) => <div key={step.id} className="ln-program-row">
        <input aria-label={t('Program step name')} className="ln-program-input is-label" value={step.label ?? ''} placeholder={t('Denature')} onChange={event => setStage({ ...stage, steps: stage.steps.map(s => s.id === step.id ? { ...s, label: event.target.value || undefined } : s) })} />
        <span className="ln-program-unit-field"><input aria-label={t('Temperature')} className="ln-program-input is-number" inputMode="decimal" value={step.temperatureC} onChange={event => { const temperatureC = Number(event.target.value); if (Number.isFinite(temperatureC)) setStage({ ...stage, steps: stage.steps.map(s => s.id === step.id ? { ...s, temperatureC } : s) }); }} /><span>°C</span></span>
        <DurationField label={t('Time')} seconds={step.seconds} onChange={seconds => setStage({ ...stage, steps: stage.steps.map(s => s.id === step.id ? { ...s, seconds } : s) })} />
        <button type="button" className="focus-ring ln-chip-icon-button" aria-label={t(`Delete program step ${stepIndex + 1}`)} disabled={stage.steps.length < 2} onClick={() => setStage({ ...stage, steps: stage.steps.filter(s => s.id !== step.id) })}><X aria-hidden /></button>
      </div>)}
      <button type="button" className="focus-ring ln-chip-link is-add" onClick={() => setStage({ ...stage, steps: [...stage.steps, { id: uid('program-step'), temperatureC: 72, seconds: 30 }] })}><Plus aria-hidden />{t('Temperature step')}</button>
    </fieldset>)}
    <button type="button" className="focus-ring ln-chip-link is-add" onClick={() => onChange({ ...program, stages: [...program.stages, { id: uid('stage'), cycles: 1, steps: [{ id: uid('program-step'), temperatureC: 72, seconds: 300 }] }] })}><Plus aria-hidden />{t('Program stage')}</button>
  </div>;
}
