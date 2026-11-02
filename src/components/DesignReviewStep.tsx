'use client';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type { ProtocolChoice } from '@/lib/copilot/plan-design/prompts';
import { dimensionLabels, MAX_REVIEW_ROUNDS, type DesignRunView, type ReviewFinding } from '@/lib/copilot/plan-design/spec';
import { designRules, signBlockers } from '@/lib/copilot/plan-design/workflow';
import type { SignOff } from '@/lib/copilot/plan-design/write-back';
import { AiButton } from './AiAssistant';
import { DesignCardsStep } from './DesignCardsStep';
import { callApi, type StepProps } from './DesignWorkbench';
import { Button } from './ui/Button';

type Preview = SignOff & { blockers: string[]; version: number; planSeen: string; runSeen: string };
const severityNames = { critical: 'Severe', major: 'Major', minor: 'Minor' } as const;
const premiseNames = { objective: 'Objective', hypothesis: 'Hypothesis', rationale: 'Rationale' } as const;
const sectionNames: Record<string, string> = { design: 'Design', material_methods: 'Material & methods', acceptance_criteria: 'Acceptance criteria', constraints: 'Constraints & dependencies', references: 'References & working notes' };

/**
 * ⑥ Independent review and sign-off (Q308, Q309, Q310). The reviewer reads only the artifacts, by a fixed rubric, at most
 * twice. A critical finding or a serious rule stops signing until the card changes or the author says why it does not
 * apply. Signing shows what it will write first.
 */
export function DesignReviewStep(props: StepProps & { protocols: ProtocolChoice[]; base: string; onSigned: (run: DesignRunView, experimentIds: string[]) => void }) {
  const { run, busy, act, step, readiness, base, onSigned } = props;
  const rounds = run.state.review?.rounds ?? [];
  const round = rounds.at(-1);
  const rules = designRules(run.state);
  const blockers = signBlockers(run.state);
  const [preview, setPreview] = useState<Preview>();
  const [choices, setChoices] = useState<{ premise: string[]; keepPrevious: boolean; experiments: string[] }>();
  const [signing, setSigning] = useState<string>();
  const [signError, setSignError] = useState<string>();
  const open = async () => {
    setSigning('preview'); setSignError(undefined);
    try {
      const next = await callApi<Preview>(`${base}/sign`, 'GET');
      setPreview(next);
      setChoices({ premise: next.premise.filter(change => change.apply).map(change => change.field), keepPrevious: false, experiments: next.experiments.map(item => item.blockId) });
    } catch (failure) { setSignError(failure instanceof Error ? failure.message : 'Could not preview'); } finally { setSigning(undefined); }
  };
  const sign = async () => {
    if (!preview || !choices) return;
    setSigning('sign'); setSignError(undefined);
    try {
      const result = await callApi<{ run: DesignRunView; experimentIds: string[] }>(`${base}/sign`, 'POST', { ...choices, planSeen: preview.planSeen, runSeen: preview.runSeen });
      onSigned(result.run, result.experimentIds);
    } catch (failure) { setSignError(failure instanceof Error ? failure.message : 'Could not sign'); } finally { setSigning(undefined); }
  };
  const toggle = (list: string[], value: string, on: boolean) => on ? [...new Set([...list, value])] : list.filter(item => item !== value);

  return <div className="ln-dw-step">
    <div className="ln-dw-box">
      <h3>Independent review</h3>
      <p className="ln-dw-note">{`Reviewer: ${readiness.reviewProviderName ?? 'the default service'}. It sees the context card, the chain, the cards and the rule findings, never the drafting conversation.`}</p>
      {readiness.selfReview ? <p className="ln-dw-warn">The same service drafted and reviews this design, so the review is less independent. Choose a review service on the <Link href="/ai" className="underline">AI page</Link></p> : null}
      <div className="ln-dw-actions">
        <AiButton type="button" disabled={Boolean(busy) || rounds.length >= MAX_REVIEW_ROUNDS} onClick={() => { setPreview(undefined); void step(); }}>{busy === 'step' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}{rounds.length >= MAX_REVIEW_ROUNDS ? 'Both review rounds are done' : rounds.length ? `Run review round ${rounds.length + 1}` : 'Run the review'}</AiButton>
        <span className="ln-dw-note">{`${rounds.length} of ${MAX_REVIEW_ROUNDS} rounds · about 1 model call. What is left after two rounds goes into the limitations.`}</span>
      </div>
      {round ? <>
        <p className="ln-dw-verdict" data-verdict={round.verdict}>{`Round ${rounds.length}: ${verdictNames[round.verdict]} · ${round.provider}${round.model ? ` (${round.model})` : ''}`}</p>
        {round.dimensions.length ? <ul className="ln-dw-dimensions">{round.dimensions.map(item => <li key={item.key} data-verdict={item.verdict}><strong>{dimensionLabels[item.key]}</strong><span>{dimensionVerdicts[item.verdict]}</span>{item.note ? <small>{item.note}</small> : null}</li>)}</ul> : null}
        <ul className="ln-dw-findings">{round.findings.map(finding => <Finding key={finding.id} finding={finding} busy={busy} chainTitle={run.state.chain?.draft?.blocks.find(block => block.id === finding.blockId)?.title}
          onDecide={(status, reason) => act({ kind: 'finding', findingId: finding.id, status, reason })} />)}</ul>
        {!round.findings.length ? <p className="ln-dw-note">No findings beyond the rule checks.</p> : null}
      </> : null}
    </div>
    {rules.length ? <div className="ln-dw-box"><h3>Rule checks</h3><ul className="ln-dw-findings">{rules.map(finding => <RuleRow key={finding.key} text={`Rule ${finding.rule} · ${run.state.chain?.draft?.blocks.find(block => block.id === finding.blockId)?.title ?? finding.blockId}: ${finding.text}`} severity={finding.severity}
      reason={run.state.waivers?.[finding.key]} busy={busy} onWaive={reason => act({ kind: 'waive', key: finding.key, reason })} />)}</ul></div> : null}
    <details className="ln-dw-box"><summary>Revise the design cards</summary><DesignCardsStep {...props} embedded /></details>
    <div className="ln-dw-box">
      <h3>Sign the design</h3>
      {blockers.length ? <ul className="ln-dw-blockers">{blockers.map(item => <li key={item}>{item}</li>)}</ul> : null}
      {!preview ? <div className="ln-dw-actions"><Button type="button" variant="primary" disabled={Boolean(busy) || Boolean(signing) || blockers.length > 0} onClick={() => void open()}>{signing === 'preview' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}Preview what signing writes</Button></div> : null}
      {preview && choices ? <div className="ln-dw-preview">
        <p className="ln-dw-note">{`Signing writes this into the plan once, as design v${preview.version}, and makes the planned experiments you tick.`}</p>
        {preview.premise.length ? <fieldset className="ln-dw-records"><legend>Premise</legend>{preview.premise.map(change => <label key={change.field} className="ln-dw-check ln-dw-diff">
          <input type="checkbox" checked={choices.premise.includes(change.field)} onChange={event => setChoices({ ...choices, premise: toggle(choices.premise, change.field, event.target.checked) })} />
          <span><strong>{premiseNames[change.field]}</strong><del>{change.before || '(empty)'}</del><ins>{change.after}</ins></span>
        </label>)}</fieldset> : null}
        <fieldset className="ln-dw-records"><legend>Plan sections</legend><ul className="ln-dw-list">{preview.sections.map(section => <li key={section.key}><strong>{sectionNames[section.key] ?? section.key}</strong><span className="ln-dw-note">{`${section.blocks.length} blocks added${section.replaced ? `, ${section.replaced} from the last signed design replaced` : ''}`}</span></li>)}</ul>
          {preview.sections.some(section => section.replaced) ? <label className="ln-dw-check"><input type="checkbox" checked={choices.keepPrevious} onChange={event => setChoices({ ...choices, keepPrevious: event.target.checked })} />Keep the last signed design as well</label> : null}
        </fieldset>
        <fieldset className="ln-dw-records"><legend>Planned experiments</legend>{preview.experiments.map(item => <label key={item.blockId} className="ln-dw-check">
          <input type="checkbox" checked={choices.experiments.includes(item.blockId)} onChange={event => setChoices({ ...choices, experiments: toggle(choices.experiments, item.blockId, event.target.checked) })} />
          <span><strong>{item.title}</strong><small>{item.protocolId ? 'With its Protocol and a first day plan' : `Needs a Protocol: ${item.protocolNeeded}`}</small><small>{`Groups: ${item.groups.join(', ') || 'none'}`}</small></span>
        </label>)}
          {preview.optional.length ? <p className="ln-dw-note">{`Optional, kept in the plan without an experiment: ${preview.optional.join(', ')}`}</p> : null}
          {preview.experiments.some(item => !item.protocolId) ? <p className="ln-dw-note">For a missing Protocol, use <Link href="/protocols/import/recognize" className="underline">Recognize a manual</Link> or <Link href="/protocols/design" className="underline">Design from a goal</Link></p> : null}
        </fieldset>
        <div className="ln-dw-actions">
          <Button type="button" variant="primary" disabled={Boolean(signing) || preview.blockers.length > 0} onClick={() => void sign()}>{signing === 'sign' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}Sign and write into the plan</Button>
          <Button type="button" onClick={() => setPreview(undefined)}>Cancel</Button>
        </div>
      </div> : null}
      {signError ? <p role="alert" className="ln-dw-error">{signError}</p> : null}
    </div>
  </div>;
}

/** A card field as the card editor labels it. */
const cardFieldNames: Record<string, string> = {
  unit: 'Experimental unit', factors: 'Factors', groups: 'Groups', controls: 'Controls', manipulation: 'Manipulation', replicates: 'Biological replicates', sampleSize: 'Sample size n',
  randomization: 'Randomization', blinding: 'Blinding', batch: 'Batches', readouts: 'Readouts', referenceGenes: 'qPCR reference genes (one per line)', loadingControl: 'Loading control',
  normalization: 'Normalization', analysis: 'Statistical test', criteria: 'Decision criteria, written before the experiment (one per line)', dependsOn: 'Runs after', protocol: 'Protocol', methodNote: 'Method notes',
};
const verdictNames = { ready: 'Ready to sign', revise: 'Revise', rethink: 'Rethink the claim or the chain' } as const;
const dimensionVerdicts = { ok: 'No concern', concern: 'Concern', not_applicable: 'Not applicable' } as const;

function Finding({ finding, busy, chainTitle, onDecide }: { finding: ReviewFinding; busy?: string; chainTitle?: string; onDecide: (status: ReviewFinding['status'], reason?: string) => Promise<void> }) {
  const [reason, setReason] = useState(finding.reason ?? '');
  return <li data-severity={finding.severity} data-status={finding.status}>
    <p><strong>{severityNames[finding.severity]}</strong> · <span>{dimensionLabels[finding.dimension]}</span>{chainTitle ? <> · <span>{chainTitle}</span></> : null}{finding.field ? <> · <span>{cardFieldNames[finding.field] ?? finding.field}</span></> : null}</p>
    <p>{finding.problem}</p>
    {finding.suggestion ? <p className="ln-dw-note">{`Suggestion: ${finding.suggestion}`}</p> : null}
    {finding.status === 'open' ? <div className="ln-dw-actions">
      <Button type="button" size="sm" disabled={Boolean(busy)} onClick={() => void onDecide('resolved')}>Fixed in the card</Button>
      <input aria-label="Why it does not apply" value={reason} onChange={event => setReason(event.target.value)} placeholder="Why it does not apply" />
      <Button type="button" size="sm" disabled={Boolean(busy) || !reason.trim()} onClick={() => void onDecide('waived', reason)}>Waive</Button>
    </div> : <p className="ln-dw-note"><span>{finding.status === 'resolved' ? 'Fixed' : `Waived: ${finding.reason}`}</span> <button type="button" className="ln-dw-link" disabled={Boolean(busy)} onClick={() => void onDecide('open')}>Undo</button></p>}
  </li>;
}

function RuleRow({ text, severity, reason, busy, onWaive }: { text: string; severity: string; reason?: string; busy?: string; onWaive: (reason: string) => Promise<void> }) {
  const [value, setValue] = useState(reason ?? '');
  return <li data-severity={severity === 'serious' ? 'critical' : severity === 'important' ? 'major' : 'minor'} data-status={reason ? 'waived' : 'open'}>
    <p>{text}</p>
    {severity === 'serious' ? <div className="ln-dw-actions">
      <input aria-label="Why the rule does not apply" value={value} onChange={event => setValue(event.target.value)} placeholder="Why the rule does not apply" />
      <Button type="button" size="sm" disabled={Boolean(busy) || value.trim() === (reason ?? '')} onClick={() => void onWaive(value)}>{value.trim() ? 'Waive' : 'Clear'}</Button>
    </div> : null}
  </li>;
}
