'use client';
import { X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { CopilotRunView } from '@/lib/copilot/types';
import { CopilotStartForm, type CopilotReadiness, type CopilotStartValues } from './CopilotStartForm';
import { useI18n } from './I18nProvider';
import './research-plan-copilot.css';

type Option = { id: string; label: string };

/**
 * The Copilot on the research plans overview: write a purpose and get a new draft plan with a run on it, or pick a
 * plan and let the Copilot work on what it lacks. Both end on the plan's page, where the run goes on.
 */
export function CopilotLauncher({ projects, plans, defaultProjectId, readiness, closeHref }: { projects: Option[]; plans: Option[]; defaultProjectId?: string; readiness: CopilotReadiness; closeHref: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [mode, setMode] = useState<'new' | 'adjust'>(projects.length || !plans.length ? 'new' : 'adjust');
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? '');
  const [planId, setPlanId] = useState(plans[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function start(values: CopilotStartValues) {
    setBusy(true); setError(undefined);
    try {
      const response = mode === 'new'
        ? await fetch('/api/research-plans/copilot', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...values, projectId }) })
        : await fetch(`/api/research-plans/${planId}/copilot`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...values, inputs: { ...values.inputs, mode: 'adjust' } }) });
      const payload = await response.json() as { run?: CopilotRunView; planId?: string; error?: string };
      if (!response.ok || !payload.run) throw new Error(payload.error ?? 'The run did not start');
      router.push(`/research-plans/${payload.planId ?? planId}?autostart=${payload.run.id}`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The run did not start'); setBusy(false); }
  }

  return <section className="ln-copilot ln-copilot-launcher" aria-label="Copilot">
    <header>
      <span className="ln-ai-tag">AI</span><strong>Copilot</strong>
      {projects.length && plans.length ? <div role="group" aria-label="What to do" className="ln-copilot-tabs">
        <button type="button" aria-pressed={mode === 'new'} onClick={() => setMode('new')}>Design a new plan</button>
        <button type="button" aria-pressed={mode === 'adjust'} onClick={() => setMode('adjust')}>Adjust a plan</button>
      </div> : null}
      <Link href={closeHref} className="ln-copilot-close focus-ring" aria-label={t('Close')}><X className="h-4 w-4" aria-hidden /></Link>
    </header>
    <div className="ln-copilot-body" key={mode}>
      {mode === 'new' && !projects.length ? <p className="ln-copilot-note">A plan belongs to a project. <Link href="/projects" className="underline">Create a project first</Link></p> : <CopilotStartForm readiness={readiness} mode={mode} busy={busy} onStart={values => { void start(values); }}
        lead={mode === 'new'
          ? <label className="ln-copilot-lead">In project<select value={projectId} onChange={event => setProjectId(event.target.value)}>{projects.map(project => <option key={project.id} value={project.id}>{project.label}</option>)}</select></label>
          : <label className="ln-copilot-lead">Plan to adjust<select value={planId} onChange={event => setPlanId(event.target.value)}>{plans.map(plan => <option key={plan.id} value={plan.id}>{plan.label}</option>)}</select></label>} />}
      {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
    </div>
  </section>;
}
