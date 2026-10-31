"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from 'next/link';
import { useRouter } from "next/navigation";
import type { AISettingsChange } from "@/lib/ai-settings";
import { formLabelClass } from "./forms";
import { Select } from "./ui/Select";
import { Button } from "./ui/Button";
import { useAiStatus } from "./AiAssistant";
import { notifyAISettingsChanged } from "./useAISettings";
import type { AiState } from "@/lib/ai-readiness";

const stateLabels: Record<AiState, string> = { checking: "Reading settings…", error: "Settings could not be read", off: "Off", incomplete: "On · setup incomplete", ready: "On · fully set up" };

/** The AI page in order: the switch, the model services (`services`, rendered by the page), feature settings, then where to use AI. */
export function AISettingsPanel({ providers, services }: { providers: { id: string; name: string }[]; services?: ReactNode }) {
  const { saved, error, refresh, accept, state } = useAiStatus();
  const router = useRouter();
  const [editedDraft, setDraft] = useState<{ defaultProviderId: string; visionProviderId: string; attachmentsEnabled: boolean }>();
  const draft = editedDraft ?? { defaultProviderId: saved?.defaultProviderId ?? "", visionProviderId: saved?.visionProviderId ?? "", attachmentsEnabled: saved?.attachmentsEnabled ?? false };
  const dirty = editedDraft !== undefined;
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  async function save(kind: "enabled" | "configuration") {
    if (!saved || error || submitting.current) return;
    submitting.current = true; setBusy(true); setFailure(undefined); setMessage("");
    const change: AISettingsChange = kind === "enabled"
      ? { kind, revision: saved.revision, enabled: !saved.enabled }
      : { kind, revision: saved.revision, defaultProviderId: draft.defaultProviderId || null, visionProviderId: draft.visionProviderId || null, attachmentsEnabled: draft.attachmentsEnabled };
    try {
      const response = await fetch("/api/ai/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(change) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Saving failed; try again.");
      accept(result);
      // The service cards mark the default service and the one that reads pictures.
      if (kind === "configuration") { setDraft(undefined); router.refresh(); }
      setMessage(kind === "enabled" ? "Switch saved" : "Feature settings saved");
      notifyAISettingsChanged();
    } catch (caught) { setFailure(caught instanceof Error ? caught.message : "Saving failed; the switch keeps its last saved state. Read the settings again to check."); }
    finally { submitting.current = false; setBusy(false); }
  }
  const stateLabel = saved ? stateLabels[state] : stateLabels.checking;
  return <section className="space-y-4" aria-label="AI feature settings">
    <div id="ai-access" className="rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor="ai-enabled" className="cursor-pointer text-base font-semibold text-ink">Enable AI</label>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs text-muted" role="status" data-ai-state>{stateLabel}</span>
          <button id="ai-enabled" type="button" role="switch" aria-checked={Boolean(saved?.enabled)} aria-label="Enable AI" aria-describedby="ai-switch-help" disabled={busy || !saved || Boolean(error)} onClick={() => save("enabled")} className={`focus-ring relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border disabled:cursor-wait disabled:opacity-50 ${saved?.enabled ? "border-ai bg-ai" : "border-hairline bg-stone"}`}>
            <span className={`h-5 w-5 rounded-full ${saved?.enabled ? "ml-6 bg-ai-fg" : "ml-1 bg-surface"}`} />
          </button>
        </div>
      </div>
      <p id="ai-switch-help" className="mt-2 text-xs leading-5 text-muted">{saved && !saved.enabled ? "AI is off; existing records stay as they are." : "AI is used only when you act; turning it on does not scan or process past records."}</p>
      <p className="mt-1 text-xs leading-5 text-muted">Applies to this LabNest workspace, the same scope as before; Visualization Studio uses its own settings.</p>
      {saved && !error ? <p className="mt-3 text-sm font-medium" role="status">{!providers.length ? 'Next: add a model service, then choose it as the default service.' : !saved.defaultProviderId ? 'Next: choose the default service below and click “Save feature settings”. A service card being enabled does not do this step for you.' : !saved.enabled ? 'Next: turn on the “Enable AI” switch above. The default service is kept.' : !saved.availability.connected ? saved.availability.reason : 'Ready. Choose one of the entry points below to start an AI action yourself.'}</p> : null}
      {failure || error ? <div role="alert" className="mt-2 text-sm text-error">{failure || error} <button type="button" className="focus-ring underline" onClick={() => { setFailure(undefined); void refresh(); }}>Read again</button></div> : null}
      {message ? <p role="status" className="mt-2 text-xs text-muted">{message}</p> : null}
    </div>
    {saved?.enabled && !saved.availability.connected && !error ? <p className="text-sm text-warning">{saved.availability.reason} <a href={saved.defaultProviderId ? "#providers" : "#default-provider"} className="focus-ring underline">Complete the setup</a></p> : null}
    {services}
    <form onSubmit={event => { event.preventDefault(); void save("configuration"); }} className="space-y-3 border-t border-hairline pt-4">
      <h2 className="text-base font-semibold text-ink">Feature settings</h2>
      <div className="grid items-start gap-3 sm:grid-cols-2">
        <label className="block"><span className={formLabelClass}>Default AI service</span><Select id="default-provider" name="defaultProviderId" disabled={busy || !saved || Boolean(error)} value={draft.defaultProviderId} onChange={event => { setDraft({ ...draft, defaultProviderId: event.target.value }); setMessage(""); }}><option value="">None chosen</option>{providers.map(provider => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</Select><span className="mt-1 block text-xs leading-5 text-muted">AI actions use this service; reading pictures can use another one.</span></label>
        <label className="block"><span className={formLabelClass}>Service that reads photos</span><Select id="vision-provider" name="visionProviderId" disabled={busy || !saved || Boolean(error)} value={draft.visionProviderId} onChange={event => { setDraft({ ...draft, visionProviderId: event.target.value }); setMessage(""); }}><option value="">Same as the default service (OpenAI, Anthropic and ChatGPT subscription only)</option>{providers.map(provider => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</Select><span className="mt-1 block text-xs leading-5 text-muted">Reads pictures of manuals and labels; its model must be able to see.</span>{saved?.vision && !saved.vision.ready && saved.enabled && saved.vision.reason ? <span className="mt-1 block text-xs leading-5 text-warning">{saved.vision.reason}</span> : null}</label>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex min-h-10 items-center gap-2 text-sm"><input name="attachmentsEnabled" type="checkbox" disabled={busy || !saved || Boolean(error)} checked={draft.attachmentsEnabled} onChange={event => { setDraft({ ...draft, attachmentsEnabled: event.target.checked }); setMessage(""); }} className="h-4 w-4 accent-[var(--ink)]" />Allow attachments the user explicitly chooses</label>
        <Button type="submit" disabled={busy || !saved || Boolean(error)} size="sm">Save feature settings</Button><span className="text-xs text-muted">{dirty ? "Unsaved changes; the main switch does not submit them." : "Only explicitly chosen context is sent; it does not authorize uploading the whole project."}</span></div>
    </form>
    <nav aria-label="Use AI" className="space-y-2 border-t border-hairline pt-4">
      <h2 className="text-base font-semibold">Use AI</h2>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm"><Link prefetch={false} className="focus-ring inline-flex min-h-11 items-center font-medium text-moss underline" href="/actions/manual">Open the AI workbench</Link><Link prefetch={false} className="focus-ring inline-flex min-h-11 items-center text-moss underline" href="/entries">Generate suggestions from entries</Link><Link prefetch={false} className="focus-ring inline-flex min-h-11 items-center text-moss underline" href="/protocols/import">Import a protocol and extract parameters</Link></div>
      <p className="text-xs text-muted">AI suggestions need a human check; turning AI on does not process past records. Protocol systems, ordinary calculations and runs all work with AI off.</p>
    </nav>
  </section>;
}
