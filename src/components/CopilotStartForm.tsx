'use client';
import { Bot } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { clampBudget, copilotLimits, estimateModelCalls, type CopilotBudget } from '@/lib/copilot/types';
import { AiButton } from './AiAssistant';
import { useI18n } from './I18nProvider';
import './research-plan-copilot.css';

export type CopilotReadiness = { europePmc: boolean; toolsOk: boolean; providerName?: string };
export type CopilotStartValues = { purpose: string; inputs: { sample: string; conditions: string }; budget: CopilotBudget; autoContinue: boolean };

/**
 * Where a Copilot run starts: one question and one button. What the run may spend, what the author already has and
 * whether to stop between stages are tucked under "More settings", with defaults that work.
 */
export function CopilotStartForm({ readiness, mode, busy, lead, onStart }: { readiness: CopilotReadiness; mode: 'new' | 'adjust'; busy: boolean; lead?: ReactNode; onStart: (values: CopilotStartValues) => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState({ purpose: '', sample: '', conditions: '', maxPapers: Number(copilotLimits.maxPapers), maxFullText: Number(copilotLimits.maxFullText), stepwise: false });
  const budget = clampBudget({ maxPapers: form.maxPapers, maxFullText: form.maxFullText });
  const blocked = !readiness.toolsOk ? 'tools' : !readiness.europePmc ? 'literature' : undefined;
  const ready = form.purpose.trim().length >= 4 && !blocked && !busy;
  return <form className="ln-copilot-form" aria-label="Start a Copilot run" onSubmit={event => { event.preventDefault(); if (ready) onStart({ purpose: form.purpose, inputs: { sample: form.sample, conditions: form.conditions }, budget, autoContinue: !form.stepwise }); }}>
    <label>{mode === 'adjust' ? 'What should change, or be checked?' : 'Research purpose'}
      <textarea rows={3} value={form.purpose} onChange={event => setForm({ ...form, purpose: event.target.value })}
        placeholder={mode === 'adjust' ? 'e.g. The plan only covers proliferation; add what is needed to show through which pathway' : 'e.g. Show that CHMP2A knockdown inhibits growth and invasion of esophageal squamous cell carcinoma cells, and find out through which pathway'} /></label>
    <details className="ln-copilot-more"><summary>More settings</summary>
      <div className="ln-copilot-pair">
        <label>Sample or model<input value={form.sample} onChange={event => setForm({ ...form, sample: event.target.value })} placeholder="e.g. KYSE150 and KYSE30 cells" /></label>
        <label>What you already have<input value={form.conditions} onChange={event => setForm({ ...form, conditions: event.target.value })} placeholder="e.g. qPCR and Western blot are set up" /></label>
        <label>Papers to read<input type="number" min={1} max={copilotLimits.maxPapers} value={form.maxPapers} onChange={event => setForm({ ...form, maxPapers: Number(event.target.value) })} /></label>
        <label>Of them, full texts<input type="number" min={0} max={copilotLimits.maxFullText} value={form.maxFullText} onChange={event => setForm({ ...form, maxFullText: Number(event.target.value) })} /></label>
      </div>
      <label className="ln-copilot-check"><input type="checkbox" checked={form.stepwise} onChange={event => setForm({ ...form, stepwise: event.target.checked })} />Stop after each stage so I can look</label>
    </details>
    {blocked === 'tools' ? <p role="status" className="ln-copilot-warn">The default AI service cannot work with tools. Choose a ChatGPT subscription, DeepSeek, OpenAI, Anthropic, Qwen or Gemini as the default service in AI settings.</p> : null}
    {blocked === 'literature' ? <p role="status" className="ln-copilot-warn">Searching Europe PMC is off. Turn on outside method search and tick Europe PMC in the search settings of <Link href="/protocols/design" className="underline">Design from a goal</Link></p> : null}
    <div className="ln-copilot-footer">
      {lead}
      <AiButton type="submit" disabled={!ready}><Bot className="h-4 w-4" aria-hidden />Start</AiButton>
      <p className="ln-copilot-note">{t(`Starting sends your purpose and its keywords to the AI service and Europe PMC, about ${estimateModelCalls(budget)} model calls. You can stop at any time.`)}</p>
    </div>
  </form>;
}
