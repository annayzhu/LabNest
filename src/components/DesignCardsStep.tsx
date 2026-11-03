'use client';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ProtocolChoice } from '@/lib/copilot/plan-design/prompts';
import type { RuleFinding } from '@/lib/copilot/plan-design/rules';
import { planSampleSize } from '@/lib/copilot/plan-design/sample-size';
import { assays, controlKinds, manipulationKinds, nCounts, requiredBlocks, sampleSizeBases, sampleSizeOf, stepCalls, type DesignCard, type SampleSize } from '@/lib/copilot/plan-design/spec';
import { powerDesigns } from '@/lib/stats/power';
import { designRules } from '@/lib/copilot/plan-design/workflow';
import { AiButton } from './AiAssistant';
import type { StepProps } from './DesignWorkbench';
import { useI18n } from './I18nProvider';
import { Button } from './ui/Button';

/**
 * ④ Design cards (Q304): one per required block, folded to a one-line summary. Nothing is cut to fit; the rule checks
 * run in the page on every change, so a missing NC or wells counted as n show before anything is saved.
 */
export function DesignCardsStep({ run, busy, act, step, protocols, draftAll, embedded = false }: StepProps & { protocols: ProtocolChoice[]; draftAll?: () => Promise<void>; embedded?: boolean }) {
  const chain = run.state.chain?.draft, tier = run.state.chain?.tier;
  if (!chain || !tier) return null;
  const required = requiredBlocks(chain, tier);
  const cards = run.state.cards?.items ?? [];
  const missing = required.filter(block => !cards.some(card => card.blockId === block.id));
  const findings = designRules(run.state);
  const rivals = chain.alternatives.filter(item => item.exclude && item.id).map(item => ({ id: item.id!, text: item.text }));
  const whole = findings.filter(finding => !finding.blockId);
  return <div className="ln-dw-step">
    {whole.length ? <div className="ln-dw-callout is-warn">{whole.map(finding => <p key={finding.key} className="ln-dw-rule" data-severity={finding.severity}>{`${severityNames[finding.severity]} · Rule ${finding.rule}: ${finding.text}`}</p>)}</div> : null}
    {!embedded ? <div className="ln-dw-actions">
      {missing.length && draftAll ? <AiButton type="button" disabled={Boolean(busy)} onClick={() => void draftAll()}>{busy === 'cards' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}{missing.length === required.length ? 'Draft the design cards' : `Draft the ${missing.length} missing cards`}</AiButton> : null}
      <span className="ln-dw-note">{`About ${stepCalls('cards', missing.length || required.length)} model calls, one per card · common practice, no literature`}</span>
    </div> : null}
    {required.map(block => {
      const card = cards.find(item => item.blockId === block.id);
      return card
        ? <CardEditor key={card.blockId} card={card} findings={findings.filter(finding => finding.blockId === card.blockId)} protocols={protocols} busy={busy} chainTitles={new Map(chain.blocks.map(item => [item.id, item.title]))} rivals={rivals}
          onSave={next => act({ kind: 'card', card: next })} onRedraft={() => step(card.blockId)} />
        : <div key={block.id} className="ln-dw-card is-empty"><strong>{block.title}</strong><AiButton type="button" variant="ai" disabled={Boolean(busy)} onClick={() => void step(block.id)}>{busy === `card:${block.id}` ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}Draft this card</AiButton></div>;
    })}
    {!embedded ? <div className="ln-dw-actions">
      <Button type="button" variant="primary" disabled={Boolean(busy) || missing.length > 0} onClick={() => void act({ kind: 'confirm' })}>Confirm the design cards</Button>
      <span className="ln-dw-note">{`${findings.filter(finding => finding.severity === 'serious').length} serious rule findings: they stop the sign-off until fixed or waived with a reason.`}</span>
    </div> : null}
  </div>;
}

const severityNames = { serious: 'Serious', important: 'Important', minor: 'Minor' } as const;
const lines = (value: string) => value.split('\n').map(line => line.trim()).filter(Boolean);

function CardEditor({ card, findings, protocols, busy, chainTitles, rivals, onSave, onRedraft }: { card: DesignCard; findings: RuleFinding[]; protocols: ProtocolChoice[]; busy?: string; chainTitles: Map<string, string>; rivals: { id: string; text: string }[]; onSave: (card: DesignCard) => Promise<void>; onRedraft: () => Promise<void> }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(card);
  const [seen, setSeen] = useState(card);
  // The saved card replaces the draft only when it changed: a ledger edit elsewhere keeps unsaved changes here.
  if (JSON.stringify(card) !== JSON.stringify(seen)) { setSeen(card); setDraft(card); }
  const dirty = JSON.stringify(draft) !== JSON.stringify(card);
  const set = (patch: Partial<DesignCard>) => setDraft({ ...draft, ...patch });
  const at = (field: string) => findings.filter(finding => finding.field === field).map(finding => <p key={finding.key} className="ln-dw-rule" data-severity={finding.severity}>{`${severityNames[finding.severity]} · Rule ${finding.rule}: ${finding.text}`}</p>);
  const summary = [`${draft.groups.length} groups`, `${draft.controls.length} controls`, `${draft.readouts.length} readouts`, `n = ${planSampleSize(draft).enrolled ?? sampleSizeOf(draft).n ?? draft.replicates.biological ?? '?'}`, `${draft.criteria.length} criteria`].join(' · ');
  return <details className="ln-dw-card">
    <summary>
      <strong>{draft.title}</strong><span className="ln-dw-note">{summary}</span>
      {findings.length ? <span className="ln-dw-badge" data-tone={findings.some(finding => finding.severity === 'serious') ? 'serious' : 'warn'}>{`${findings.length} rule findings`}</span> : <span className="ln-dw-badge" data-tone="ok">Rules pass</span>}
      {draft.protocol.id ? <span className="ln-dw-badge">{protocols.find(item => item.id === draft.protocol.id)?.code ?? 'Protocol'}</span> : <span className="ln-dw-badge" data-tone="warn">Needs a Protocol</span>}
    </summary>
    <div className="ln-dw-card-body">
      {draft.drift.length ? <div className="ln-dw-callout is-warn"><strong>The model would change an earlier step</strong><ul>{draft.drift.map(item => <li key={item}>{item}</li>)}</ul></div> : null}
      <div className="ln-dw-fields">
        <label><span>Experimental unit</span><input value={draft.unit.experimental} onChange={event => set({ unit: { ...draft.unit, experimental: event.target.value } })} /></label>
        <label><span>Unit of analysis</span><input value={draft.unit.analysis} onChange={event => set({ unit: { ...draft.unit, analysis: event.target.value } })} /></label>
        <label><span>n counts</span><select value={draft.unit.nCounts} onChange={event => set({ unit: { ...draft.unit, nCounts: event.target.value as DesignCard['unit']['nCounts'] } })}>{nCounts.map(value => <option key={value} value={value}>{nCountNames[value]}</option>)}</select></label>
      </div>
      {at('unit')}{at('factors')}
      <Rows title="Groups" hint="Group names become the planned experiment's groups." rows={draft.groups} onChange={groups => set({ groups })} blank={{ name: '', treatment: '', control: false }}
        render={(group, change) => <><input aria-label="Group" value={group.name} onChange={event => change({ name: event.target.value })} /><input aria-label="Treatment" className="is-grow" value={group.treatment} onChange={event => change({ treatment: event.target.value })} placeholder="Treatment" /><label className="ln-dw-check"><input type="checkbox" checked={group.control} onChange={event => change({ control: event.target.checked })} />Control</label></>} />
      {at('groups')}
      <Rows title="Controls" hint="Each control says which explanation it rules out." rows={draft.controls} onChange={controls => set({ controls })} blank={{ name: '', kind: 'negative' as const, excludes: '', concurrent: true, addresses: [] }}
        render={(control, change) => <><input aria-label="Control" value={control.name} onChange={event => change({ name: event.target.value })} /><select aria-label="Kind" value={control.kind} onChange={event => change({ kind: event.target.value as typeof control.kind })}>{controlKinds.map(kind => <option key={kind} value={kind}>{controlNames[kind]}</option>)}</select><input aria-label="Rules out" className="is-grow" value={control.excludes} onChange={event => change({ excludes: event.target.value })} placeholder="Rules out" />
          {rivals.length ? <select aria-label="Counter-explanation it rules out" value={control.addresses?.[0] ?? ''} onChange={event => change({ addresses: event.target.value ? [event.target.value] : [] })}><option value="">No counter-explanation</option>{rivals.map(rival => <option key={rival.id} value={rival.id}>{rival.text}</option>)}</select> : null}
          <label className="ln-dw-check"><input type="checkbox" checked={control.concurrent} onChange={event => change({ concurrent: event.target.checked })} />Concurrent</label></>} />
      {at('controls')}
      <div className="ln-dw-fields">
        <label><span>Manipulation</span><select value={draft.manipulation.kind} onChange={event => set({ manipulation: { ...draft.manipulation, kind: event.target.value as DesignCard['manipulation']['kind'] } })}>{manipulationKinds.map(kind => <option key={kind} value={kind}>{manipulationNames[kind]}</option>)}</select></label>
        <label><span>Independent reagents (siRNAs, constructs)</span><input type="number" min={0} value={draft.manipulation.independentReagents ?? ''} onChange={event => set({ manipulation: { ...draft.manipulation, independentReagents: event.target.value === '' ? null : Number(event.target.value) } })} /></label>
        <label><span>Efficiency check in this experiment</span><input value={draft.manipulation.efficiencyCheck} onChange={event => set({ manipulation: { ...draft.manipulation, efficiencyCheck: event.target.value } })} /></label>
      </div>
      {at('manipulation')}{at('dependsOn')}
      <div className="ln-dw-fields">
        <label><span>Biological replicates per group</span><input type="number" min={0} value={draft.replicates.biological ?? ''} onChange={event => set({ replicates: { ...draft.replicates, biological: event.target.value === '' ? null : Number(event.target.value) } })} /></label>
        <label><span>Technical replicates</span><input type="number" min={0} value={draft.replicates.technical ?? ''} onChange={event => set({ replicates: { ...draft.replicates, technical: event.target.value === '' ? null : Number(event.target.value) } })} /></label>
      </div>
      {at('replicates')}
      <SampleSizePanel card={draft} onChange={sampleSize => set({ sampleSize })} />
      {at('sampleSize')}
      <Rows title="Readouts" rows={draft.readouts} onChange={readouts => set({ readouts })} blank={{ name: '', method: '', timepoint: '', assay: 'other' as const }}
        render={(readout, change) => <><input aria-label="Readout" value={readout.name} onChange={event => change({ name: event.target.value })} /><input aria-label="How it is measured" className="is-grow" value={readout.method} onChange={event => change({ method: event.target.value })} placeholder="How it is measured" /><input aria-label="Time point" value={readout.timepoint} onChange={event => change({ timepoint: event.target.value })} placeholder="Time point" /><select aria-label="Assay" value={readout.assay} onChange={event => change({ assay: event.target.value as typeof readout.assay })}>{assays.map(assay => <option key={assay} value={assay}>{assayNames[assay]}</option>)}</select></>} />
      <div className="ln-dw-fields">
        <label><span>qPCR reference genes (one per line)</span><textarea rows={2} value={draft.referenceGenes.join('\n')} onChange={event => set({ referenceGenes: lines(event.target.value) })} /></label>
        <label><span>Loading control</span><input value={draft.loadingControl} onChange={event => set({ loadingControl: event.target.value })} /></label>
        <label><span>Normalization</span><input value={draft.normalization} onChange={event => set({ normalization: event.target.value })} /></label>
      </div>
      {at('referenceGenes')}{at('loadingControl')}
      <div className="ln-dw-fields">
        <label><span>Randomization</span><textarea rows={2} value={draft.randomization} onChange={event => set({ randomization: event.target.value })} /></label>
        <label><span>Blinding</span><textarea rows={2} value={draft.blinding} onChange={event => set({ blinding: event.target.value })} /></label>
        <label><span>Batches</span><textarea rows={2} value={draft.batch} onChange={event => set({ batch: event.target.value })} /></label>
      </div>
      {at('randomization')}{at('batch')}{at('blinding')}
      <div className="ln-dw-fields">
        <label><span>Statistical test</span><input value={draft.analysis.test} onChange={event => set({ analysis: { ...draft.analysis, test: event.target.value } })} /></label>
        <label><span>Primary comparison</span><input value={draft.analysis.primaryComparison} onChange={event => set({ analysis: { ...draft.analysis, primaryComparison: event.target.value } })} /></label>
        <label><span>Multiple-comparison correction</span><input value={draft.analysis.multipleComparison} onChange={event => set({ analysis: { ...draft.analysis, multipleComparison: event.target.value } })} /></label>
        <label><span>Exclusion rules</span><input value={draft.analysis.exclusion} onChange={event => set({ analysis: { ...draft.analysis, exclusion: event.target.value } })} /></label>
      </div>
      {at('analysis')}
      <label className="ln-dw-wide"><span>Decision criteria, written before the experiment (one per line)</span><textarea rows={3} value={draft.criteria.join('\n')} onChange={event => set({ criteria: lines(event.target.value) })} /></label>
      {at('criteria')}
      <div className="ln-dw-fields">
        <label><span>Protocol</span><select value={draft.protocol.id} onChange={event => set({ protocol: { id: event.target.value, title: protocols.find(item => item.id === event.target.value)?.title ?? draft.protocol.title, needed: !event.target.value } })}><option value="">Needs a Protocol</option>{protocols.map(item => <option key={item.id} value={item.id}>{item.code} {item.title}</option>)}</select></label>
        {!draft.protocol.id ? <label><span>Protocol needed</span><input value={draft.protocol.title} onChange={event => set({ protocol: { ...draft.protocol, title: event.target.value } })} /></label> : null}
        <label className="is-wide"><span>Method notes</span><textarea rows={2} value={draft.methodNote} onChange={event => set({ methodNote: event.target.value })} /></label>
      </div>
      {draft.dependsOn.length ? <p className="ln-dw-note">{`Runs after ${draft.dependsOn.map(id => chainTitles.get(id) ?? id).join(', ')}`}</p> : null}
      <div className="ln-dw-actions">
        <Button type="button" variant="primary" disabled={Boolean(busy) || !dirty} onClick={() => void onSave(draft)}>Save the card</Button>
        <AiButton type="button" variant="ai" disabled={Boolean(busy)} onClick={() => { if (!dirty || window.confirm(t('Redraft this card? Your unsaved changes are lost.'))) void onRedraft(); }}>{busy === `card:${card.blockId}` ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}Redraft the card</AiButton>
      </div>
    </div>
  </details>;
}

const percent = (value: number) => `${Math.round(value * 100)}%`;
const numberOrNull = (value: string) => value.trim() === '' || !Number.isFinite(Number(value)) ? null : Number(value);

/**
 * The sample size (Q305, K-Dense statistical-power): choose where the effect comes from, and the program works out n
 * per group, how n changes with the effect, and the smallest effect the planned replicates can detect. n is never typed
 * in for a computed basis; a convention keeps the author's n and shows what it can detect.
 */
function SampleSizePanel({ card, onChange }: { card: DesignCard; onChange: (sampleSize: SampleSize) => void }) {
  const input = sampleSizeOf(card);
  const plan = planSampleSize(card);
  const set = (patch: Partial<SampleSize>) => onChange({ ...input, ...patch });
  const symbol = input.design === 'anova' ? 'f' : 'd';
  const computed = input.basis === 'minimum_effect' || input.basis === 'pilot';
  return <fieldset className="ln-dw-rows ln-dw-power"><legend>Sample size</legend>
    <div className="ln-dw-fields">
      <label><span>Where the effect comes from</span><select value={input.basis} onChange={event => set({ basis: event.target.value as SampleSize['basis'] })}>{sampleSizeBases.map(basis => <option key={basis} value={basis}>{basisNames[basis]}</option>)}</select></label>
      <label><span>Groups compared</span><select value={input.design} onChange={event => set({ design: event.target.value as SampleSize['design'] })}>{powerDesigns.map(design => <option key={design} value={design}>{designNames[design]}</option>)}</select></label>
      {computed ? <>
        <label><span>Smallest difference worth finding</span><input type="number" step="any" value={input.difference ?? ''} onChange={event => set({ difference: numberOrNull(event.target.value) })} placeholder="In the readout's units" /></label>
        <label><span>{input.design === 'paired' ? 'SD of the paired differences' : 'SD within a group'}</span><input type="number" step="any" min={0} value={input.sd ?? ''} onChange={event => set({ sd: numberOrNull(event.target.value) })} /></label>
        <label><span>{`Or the effect size ${symbol} itself`}</span><input type="number" step="any" min={0} value={input.effect ?? ''} onChange={event => set({ effect: numberOrNull(event.target.value) })} /></label>
        <label><span>α (two-sided)</span><input type="number" step="0.005" min={0.001} max={0.2} value={input.alpha} onChange={event => set({ alpha: numberOrNull(event.target.value) ?? 0.05 })} /></label>
        <label><span>Power</span><input type="number" step="0.05" min={0.5} max={0.99} value={input.power} onChange={event => set({ power: numberOrNull(event.target.value) ?? 0.8 })} /></label>
        <label><span>Comparisons sharing α</span><input type="number" min={1} max={50} value={input.comparisons} onChange={event => set({ comparisons: Math.max(1, Math.round(numberOrNull(event.target.value) ?? 1)) })} /></label>
        <label><span>Replicates expected to be lost</span><select value={input.attrition} onChange={event => set({ attrition: Number(event.target.value) })}>{[0, 0.1, 0.2, 0.3].map(value => <option key={value} value={value}>{percent(value)}</option>)}</select></label>
      </> : null}
      {input.basis === 'convention' ? <label><span>n per group, by convention</span><input type="number" min={0} value={input.n ?? ''} onChange={event => set({ n: numberOrNull(event.target.value) })} /></label> : null}
      {input.basis !== 'pending' ? <label className="is-wide"><span>Where the numbers come from</span><input value={input.source} onChange={event => set({ source: event.target.value })} placeholder="A pilot experiment, an earlier result, a paper in the ledger" /></label> : null}
    </div>
    <div className="ln-dw-power-result" aria-live="polite">
      {input.basis === 'pending' ? <p>Needs a pilot experiment: n stays open, and no number is made up.</p> : null}
      {plan.missing === 'groups' ? <p>One-way ANOVA needs at least three groups on this card.</p> : null}
      {computed && plan.missing === 'effect' ? <p>Give the difference and its SD, or the effect size, to work out n.</p> : null}
      {computed && plan.effect ? <>
        <p><strong>{plan.analysed ? `n = ${plan.analysed} per group` : 'More than 10,000 per group'}</strong>{plan.enrolled && plan.enrolled !== plan.analysed ? ` · ${plan.enrolled} with the expected losses` : ''}{` · ${symbol} = ${plan.effect.toFixed(2)}`}{input.comparisons > 1 ? ` · α = ${input.alpha}/${input.comparisons}` : ''}</p>
        <table className="ln-dw-sensitivity"><thead><tr><th>{`Effect ${symbol}`}</th>{plan.sensitivity.map(item => <th key={item.scale}>{item.effect.toFixed(2)}</th>)}</tr></thead>
          <tbody><tr><td>n per group</td>{plan.sensitivity.map(item => <td key={item.scale}>{item.n ?? '>10000'}</td>)}</tr></tbody></table>
        {input.basis === 'pilot' ? <p className="ln-dw-note">A pilot effect is usually larger than the true one, so the range looks at smaller effects.</p> : null}
      </> : null}
      {plan.planned && plan.detectable ? <p className="ln-dw-note">{`With ${plan.planned} biological replicates per group, the smallest effect found with ${percent(input.power)} power is ${symbol} ≈ ${plan.detectable.toFixed(2)}${input.design === 'anova' ? '' : ` (a difference of about ${plan.detectable.toFixed(1)} SDs)`}.`}</p> : null}
      <p className="ln-dw-note">Worked out by LabNest (two-sided t-test or one-way ANOVA, as in statsmodels), never by the AI.</p>
    </div>
  </fieldset>;
}

function Rows<T>({ title, hint, rows, blank, onChange, render }: { title: string; hint?: string; rows: T[]; blank: T; onChange: (rows: T[]) => void; render: (row: T, change: (patch: Partial<T>) => void) => React.ReactNode }) {
  return <fieldset className="ln-dw-rows"><legend>{title}</legend>{hint ? <p className="ln-dw-note">{hint}</p> : null}
    {rows.map((row, index) => <div key={index} className="ln-dw-row">{render(row, patch => onChange(rows.map((item, at) => at === index ? { ...item, ...patch } : item)))}<button type="button" className="ln-dw-icon" aria-label="Remove row" onClick={() => onChange(rows.filter((_, at) => at !== index))}><Trash2 className="h-4 w-4" aria-hidden /></button></div>)}
    <button type="button" className="ln-dw-link" onClick={() => onChange([...rows, blank])}><Plus className="h-3.5 w-3.5" aria-hidden />Add</button>
  </fieldset>;
}

const nCountNames = { biological: 'Independent biological replicates', technical: 'Technical replicates', wells: 'Wells', animals: 'Animals', other: 'Other' } as const;
const controlNames = { negative: 'Negative', positive: 'Positive', vehicle: 'Vehicle', empty_vector: 'Empty vector', isotype: 'Isotype / IgG', loading: 'Loading', reference_gene: 'Reference gene', other: 'Other' } as const;
const manipulationNames = { none: 'None', knockdown: 'Knockdown', knockout: 'Knockout', overexpression: 'Overexpression', drug: 'Drug or treatment', other: 'Other' } as const;
const basisNames = { minimum_effect: 'Smallest effect worth finding', pilot: 'Pilot experiment', convention: 'Convention (n not calculated)', pending: 'Needs a pilot experiment' } as const;
const designNames = { two_groups: 'Two independent groups', paired: 'Paired samples', anova: 'Several groups (one-way ANOVA)' } as const;
const assayNames = { qpcr: 'qPCR', western_blot: 'Western blot', imaging: 'Imaging', flow: 'Flow cytometry', viability: 'Viability', migration: 'Migration', elisa: 'ELISA', co_ip: 'Co-IP', sequencing: 'Sequencing', other: 'Other' } as const;
