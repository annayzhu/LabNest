'use client';
import { Bot, Check, Circle, Loader2, Square, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { copilotStages, stageLabels, type Clarification, type CopilotRunView, type Suggestion } from '@/lib/copilot/types';
import { AiButton } from './AiAssistant';
import { CopilotStartForm, type CopilotReadiness, type CopilotStartValues } from './CopilotStartForm';
import { useI18n } from './I18nProvider';
import { Button } from './ui/Button';
import './research-plan-copilot.css';

async function call<T>(path: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
  const response = await fetch(path, { method, headers: { 'content-type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : method === 'DELETE' ? { body: '{}' } : {}) });
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? 'Something went wrong; try again');
  return payload;
}

/**
 * Copilot for a research plan: from a research purpose to a design of experiments after confirming the research question. It works like an
 * agent (it decides what to look up), but writes nothing into the plan: every change is a suggestion the author adopts.
 */
export function ResearchPlanCopilot({ planId, initialRuns, readiness, startOpen, mode, autoStartRunId }: { planId: string; initialRuns: CopilotRunView[]; readiness: CopilotReadiness; startOpen: boolean; mode: 'new' | 'adjust'; autoStartRunId?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const base = `/api/research-plans/${planId}/copilot`;
  const [run, setRun] = useState<CopilotRunView | undefined>(initialRuns[0]);
  const [driving, setDriving] = useState(false);
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState(startOpen);
  const stop = useRef(false);

  /** Steps until the run is done, paused between stages or failed; "stop" ends the loop after the step in progress. */
  async function drive(id: string) {
    setDriving(true); stop.current = false; setError(undefined);
    try {
      for (;;) {
        const { run: next } = await call<{ run: CopilotRunView }>(`${base}/runs/${id}/advance`, 'POST', {});
        setRun(next);
        if (next.status !== 'ready' || stop.current) break;
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'This step did not finish'); }
    finally { setDriving(false); router.refresh(); }
  }
  async function begin(values: CopilotStartValues) {
    setError(undefined);
    try {
      const { run: created } = await call<{ run: CopilotRunView }>(base, 'POST', { ...values, inputs: { ...values.inputs, mode } });
      setRun(created);
      void drive(created.id);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The run did not start'); }
  }
  async function edit(patch: object) {
    if (!run) return;
    try { setRun((await call<{ run: CopilotRunView }>(`${base}/runs/${run.id}`, 'PATCH', patch)).run); setError(undefined); return true; }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'The change was not saved'); return false; }
  }
  async function decide(suggestion: Suggestion, decision: 'adopt' | 'ignore') {
    if (!run) return;
    try {
      const result = await call<{ run: CopilotRunView }>(`${base}/runs/${run.id}/suggestions/${suggestion.id}`, 'POST', { decision });
      setRun(result.run); setError(undefined); router.refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The suggestion was not handled'); }
  }
  async function clear() {
    if (!run || !window.confirm(t('Remove this run, its log and its suggestions? What you adopted stays in the plan.'))) return;
    try { await call(`${base}/runs/${run.id}`, 'DELETE'); setRun(undefined); setError(undefined); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'The run was not removed'); }
  }

  // A plan made by the Copilot from the overview arrives with its first run waiting: start it once, then drop the link's mark.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoStartRunId || autoStarted.current) return;
    autoStarted.current = true;
    router.replace(pathname);
    if (run?.id === autoStartRunId && run.status === 'ready') setTimeout(() => { void drive(autoStartRunId); }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);

  const state = run?.state;
  const idle = run && !driving && run.status !== 'working';
  return <details className="ln-copilot" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><Bot className="h-4 w-4" aria-hidden /><span className="ln-ai-tag">AI</span><strong>Copilot for this plan</strong><span className="ln-copilot-hint">From a research purpose to a design of experiments</span></summary>
    <div className="ln-copilot-body">
      {!run ? <CopilotStartForm readiness={readiness} mode={mode} busy={driving} onStart={values => { void begin(values); }} /> : <>
        <p className="ln-copilot-purpose"><strong>Purpose</strong> {run.purpose}</p>
        <ol className="ln-copilot-stages" aria-label="Stages">{copilotStages.filter(stage => stage !== 'clarify' || state?.clarification || run.stage === 'clarify').map(stage => {
          const finished = state?.done.includes(stage), current = run.stage === stage && run.status !== 'done';
          return <li key={stage} data-state={finished ? 'done' : current ? 'current' : 'todo'}>{finished ? <Check className="h-3.5 w-3.5" aria-hidden /> : current && (driving || run.status === 'working') ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Circle className="h-3.5 w-3.5" aria-hidden />}{stageLabels[stage]}</li>;
        })}</ol>
        <div className="ln-copilot-controls">
          {driving ? <Button type="button" onClick={() => { stop.current = true; }}><Square className="h-4 w-4" aria-hidden />Stop after this step</Button> : null}
          {idle && run.status === 'paused' && run.stage !== 'clarify' ? <AiButton type="button" onClick={() => { void edit({ resume: true }).then(saved => { if (saved) void drive(run.id); }); }}>Continue with the next stage</AiButton> : null}
          {idle && run.status === 'ready' ? <AiButton type="button" onClick={() => { void drive(run.id); }}>Continue</AiButton> : null}
          {idle && run.status === 'failed' ? <AiButton type="button" onClick={() => { if (run.stage === 'clarify') void drive(run.id); else void edit({ resume: true }).then(saved => { if (saved) void drive(run.id); }); }}>Try this step again</AiButton> : null}
          {idle ? <Button type="button" variant="ghost" onClick={() => { void clear(); }}><Trash2 className="h-4 w-4" aria-hidden />Remove this run</Button> : null}
          <span className="ln-design-note">{`Model calls so far: ${run.modelCalls}${run.model ? ` · ${run.model}` : ''}`}</span>
        </div>
        {run.error ? <p role="alert" className="text-sm text-error">{run.error}</p> : null}
        {run.status === 'failed' ? <p role="status" className="ln-copilot-warn">本阶段未完成，后续阶段没有执行。</p> : null}
        {state?.clarification ? <ClarificationForm key={run.id + (state.clarification.confirmedAt ?? '')} value={state.clarification} busy={!idle} onConfirm={async value => { if (await edit({ clarification: value })) void drive(run.id); }} /> : null}
        {state?.subQuestions ? <details className="ln-copilot-part" open><summary>{`Questions (${state.subQuestions.length})`}</summary>
          <ol>{state.subQuestions.map(question => <li key={question.id}>
            <input aria-label={`Question ${question.id}`} defaultValue={question.question} disabled={!idle} onBlur={event => { const text = event.target.value.trim(); if (text && text !== question.question) void edit({ subQuestions: state.subQuestions!.map(item => item.id === question.id ? { ...item, question: text } : item) }); }} />
            {question.why ? <span className="ln-design-note">{question.why}</span> : null}
          </li>)}</ol></details> : null}
        {state?.papers ? <details className="ln-copilot-part"><summary>{`Papers (${state.papers.length})`}</summary>
          <ul>{state.papers.map(paper => <li key={paper.key}>
            <span>{paper.url ? <a href={paper.url} target="_blank" rel="noreferrer" className="underline">{paper.title}</a> : paper.title}<span className="ln-design-note">{[paper.authors?.split(',')[0], paper.year, paper.venue].filter(Boolean).join(' · ')}<span className="ln-copilot-badge">{paper.source === 'pubmed' ? 'PubMed' : 'Europe PMC'}</span>{paper.openAccess ? <span className="ln-copilot-badge">open access</span> : null}{paper.basis ? <span className="ln-copilot-badge">{paper.basis === 'fulltext' ? 'read: full text' : 'read: abstract only'}</span> : null}</span>{paper.why ? <span className="ln-design-note">{paper.why}</span> : null}</span>
            {idle && (state.extractIndex ?? 0) === 0 ? <button type="button" className="ln-copilot-x focus-ring" aria-label={`Do not read ${paper.title}`} onClick={() => { void edit({ removePaperKeys: [paper.key] }); }}>×</button> : null}
          </li>)}</ul></details> : null}
        {state?.extractions?.length ? <details className="ln-copilot-part"><summary>{`Experiments found in the papers (${state.extractions.reduce((total, item) => total + item.experiments.length, 0)})`}</summary>
          <ul>{state.extractions.map(extraction => {
            const paper = state.papers?.find(item => item.key === extraction.paperKey);
            return <li key={extraction.paperKey}><span><strong>{paper?.title ?? extraction.paperKey}</strong>{extraction.error ? <span className="text-error">{extraction.error}</span> : null}
              {extraction.experiments.map(item => <span key={item.name} className="ln-design-note">{`${item.name}${item.approach ? ` (${item.approach})` : ''}`}{item.verified ? null : <><span className="ln-copilot-badge is-warn">Unverified</span>{item.problem}</>}</span>)}</span></li>;
          })}</ul></details> : null}
        {state?.design ? <details className="ln-copilot-part"><summary>Design</summary>
          {state.design.summary ? <p>{state.design.summary}</p> : null}
          {state.design.items.map(item => <div key={item.subQuestionId}><p className="ln-copilot-q">{`${item.subQuestionId}：${state.subQuestions?.find(question => question.id === item.subQuestionId)?.question ?? ''}`}</p>
            <ul>{item.experiments.map(experiment => <li key={experiment.name}><span><strong><span className={`ln-copilot-badge${experiment.priority === 'must' ? ' is-must' : ''}`}>{experiment.priority === 'must' ? 'Must' : 'Optional'}</span>{experiment.name}</strong>{experiment.purpose ? <span className="ln-design-note">{experiment.purpose}</span> : null}{experiment.comparison ? <span className="ln-design-note">比较：{experiment.comparison}</span> : null}<span className="ln-design-note">方法：{experiment.approach || '待定'}；读出：{experiment.readouts.join('、') || '待定'}；对照：{experiment.controls.join('、') || '待定'}</span>{experiment.decisionCriteria?.map((text, index) => <span className="ln-design-note" key={index}>判定：{text}</span>)}{experiment.verified ? null : <span className="ln-design-note"><span className="ln-copilot-badge is-warn">Unverified</span>{experiment.problem}</span>}</span></li>)}</ul></div>)}</details> : null}
        {run.suggestions.length ? <section className="ln-copilot-suggestions" aria-label="Suggestions">
          <h3>Suggestions</h3>
          <p className="ln-design-note">Nothing is written into the plan until you adopt it.</p>
          <ul>{run.suggestions.map(suggestion => <li key={suggestion.id} data-status={suggestion.status}>
            <div><strong>{suggestion.title}</strong>
              {suggestion.kind === 'experiment' ? <span className="ln-design-note">{suggestion.note}{suggestion.verified ? null : <span className="ln-copilot-badge is-warn">Unverified</span>}</span> : <details><summary>Preview</summary>{(suggestion.kind === 'design' && suggestion.sections ? suggestion.sections : [{ key: suggestion.kind, title: '', blocks: suggestion.blocks }]).map(section => <section key={section.key}>{section.title ? <h4>填入：{section.title}</h4> : null}{section.blocks.map((block, index) => block.type === 'heading' ? <p key={index} className="ln-copilot-q">{block.text}</p> : <p key={index} className="ln-design-note">{block.text}</p>)}</section>)}</details>}
            </div>
            {suggestion.status === 'pending' ? <span className="ln-copilot-decide"><Button type="button" size="sm" onClick={() => { void decide(suggestion, 'adopt'); }}>Adopt</Button><Button type="button" size="sm" variant="ghost" onClick={() => { void decide(suggestion, 'ignore'); }}>Ignore</Button></span>
              : <span className="ln-design-note"><span>{suggestion.status === 'adopted' ? 'Adopted' : 'Ignored'}</span>{suggestion.kind === 'experiment' && suggestion.adoptedExperimentId ? <Link href={`/experiments/${suggestion.adoptedExperimentId}`} className="ml-2 underline">Open experiment</Link> : null}</span>}
          </li>)}</ul></section> : null}
        {run.log.length ? <details className="ln-copilot-part"><summary>{`Run log (${run.log.length})`}</summary>
          <ol className="ln-copilot-log">{run.log.map((event, index) => <li key={index} data-kind={event.kind}><time>{event.at.slice(11, 19)}</time><span>{event.text}</span></li>)}</ol></details> : null}
      </>}
      {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
    </div>
  </details>;
}


function ClarificationForm({ value, busy, onConfirm }: { value: Clarification & { questions: string[]; confirmedAt?: string }; busy: boolean; onConfirm: (value: Clarification) => Promise<void> }) {
  const [draft, setDraft] = useState<Clarification>({ method: value.method, subject: value.subject, sample: value.sample, objective: value.objective });
  const fields = [['method', '方法与术语'], ['subject', '研究对象与候选分子'], ['sample', '样本与模型'], ['objective', '本轮目标']] as const;
  if (value.confirmedAt) return <details className="ln-copilot-part"><summary>已确认的研究信息</summary>{fields.map(([key, label]) => <p key={key}><strong>{label}：</strong>{value[key]}</p>)}</details>;
  return <form className="ln-copilot-form ln-copilot-part" onSubmit={event => { event.preventDefault(); void onConfirm(draft); }}>
    <h3>先确认研究信息</h3><p className="ln-design-note">下面是 AI 的理解，请核对术语和对象。尚未确定的内容请写“待定”，不会自动补成已知条件。</p>
    {value.questions.length ? <ul>{value.questions.map((question, index) => <li key={index}>{question}</li>)}</ul> : null}
    {fields.map(([key, label]) => <label key={key}>{label}<textarea required minLength={2} maxLength={key === 'method' ? 200 : key === 'objective' ? 500 : 400} rows={2} value={draft[key]} disabled={busy} onChange={event => setDraft({ ...draft, [key]: event.target.value })} /></label>)}
    <AiButton type="submit" disabled={busy || fields.some(([key]) => draft[key].trim().length < 2)}>确认信息，开始文献检索</AiButton>
  </form>;
}
