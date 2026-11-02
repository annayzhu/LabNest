'use client';
import { Loader2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useI18n } from './I18nProvider';
import { Button } from './ui/Button';
import './research-plan-copilot.css';

type Option = { id: string; label: string };

/**
 * The Copilot on the research plans overview: write a purpose and get a new draft plan with a design started on it, or
 * pick a plan to design. Both open the plan's design workbench (Q300); no model is called before its first step.
 */
export function CopilotLauncher({ projects, plans, defaultProjectId, closeHref }: { projects: Option[]; plans: Option[]; defaultProjectId?: string; closeHref: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [mode, setMode] = useState<'new' | 'existing'>(projects.length || !plans.length ? 'new' : 'existing');
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? '');
  const [planId, setPlanId] = useState(plans[0]?.id ?? '');
  const [purpose, setPurpose] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function start() {
    if (mode === 'existing') { router.push(`/research-plans/${planId}/design`); return; }
    setBusy(true); setError(undefined);
    try {
      const response = await fetch('/api/research-plans/design', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId, purpose }) });
      const payload = await response.json() as { planId?: string; error?: string };
      if (!response.ok || !payload.planId) throw new Error(payload.error ?? 'The design did not start');
      router.push(`/research-plans/${payload.planId}/design`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'The design did not start'); setBusy(false); }
  }

  return <section className="ln-copilot ln-copilot-launcher" aria-label="Copilot">
    <header>
      <span className="ln-ai-tag">AI</span><strong>Copilot</strong>
      {projects.length && plans.length ? <div role="group" aria-label="What to do" className="ln-copilot-tabs">
        <button type="button" aria-pressed={mode === 'new'} onClick={() => setMode('new')}>Design a new plan</button>
        <button type="button" aria-pressed={mode === 'existing'} onClick={() => setMode('existing')}>Design an existing plan</button>
      </div> : null}
      <Link href={closeHref} className="ln-copilot-close focus-ring" aria-label={t('Close')}><X className="h-4 w-4" aria-hidden /></Link>
    </header>
    <div className="ln-copilot-body">
      {mode === 'new' && !projects.length ? <p className="ln-copilot-note">A plan belongs to a project. <Link href="/projects" className="underline">Create a project first</Link></p> : <form className="ln-copilot-form" onSubmit={event => { event.preventDefault(); void start(); }}>
        {mode === 'new' ? <label>Research purpose<textarea rows={3} value={purpose} onChange={event => setPurpose(event.target.value)} placeholder="e.g. Show that SRGN knockdown inhibits migration of KYSE150 cells" /></label> : null}
        <div className="ln-copilot-footer">
          {mode === 'new'
            ? <label className="ln-copilot-lead">In project<select value={projectId} onChange={event => setProjectId(event.target.value)}>{projects.map(project => <option key={project.id} value={project.id}>{project.label}</option>)}</select></label>
            : <label className="ln-copilot-lead">Plan<select value={planId} onChange={event => setPlanId(event.target.value)}>{plans.map(plan => <option key={plan.id} value={plan.id}>{plan.label}</option>)}</select></label>}
          <Button type="submit" variant="primary" disabled={busy || (mode === 'new' ? purpose.trim().length < 4 || !projectId : !planId)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}Open the design workbench</Button>
          <p className="ln-copilot-note">Context card, evidence chain, design cards, then an independent review. Each step waits for you to confirm it.</p>
        </div>
      </form>}
      {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
    </div>
  </section>;
}
