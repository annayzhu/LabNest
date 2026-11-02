"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { adoptEntryTidy, decideEntryAssignment, ignoreEntryTidy } from "@/app/entries/tidy-actions";
import { ignoreReasonLabels, pickableReasons } from "@/lib/copilot/suggestions";
import type { TidyDraft } from "@/lib/entry-tidy";
import { AiButton, useAiStatus } from "./AiAssistant";
import { EntryContentView } from "./EntryContentView";
import { formInputClass } from "./forms";
import { Disclosure } from "./ui/Disclosure";
import { Button } from "./ui/Button";
import { requestAI } from "./useAISettings";

type Tidy = { busy: boolean; draft?: TidyDraft; error?: string; notice?: string; start: () => void; close: (notice?: string) => void };
const TidyContext = createContext<Tidy | undefined>(undefined);
const useTidy = () => useContext(TidyContext)!;

/** One tidy at a time on a record page (Q337–Q340): the header button asks for it, the panel below shows the draft. */
export function EntryTidyProvider({ entryId, children }: { entryId: string; children: ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<TidyDraft>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const start = async () => {
    if (busy) return;
    setBusy(true); setError(undefined); setNotice(undefined);
    try {
      const response = await requestAI(`/api/entries/${entryId}/tidy`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const data = (await response.json()) as { draft?: TidyDraft; error?: string };
      if (!response.ok || !data.draft) throw new Error(data.error || "The record could not be tidied");
      setDraft(data.draft);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The record could not be tidied"); } finally { setBusy(false); }
  };
  return <TidyContext.Provider value={{ busy, draft, error, notice, start, close: next => { setDraft(undefined); setNotice(next); } }}>{children}</TidyContext.Provider>;
}

/** 整理, among the record's header actions. */
export function EntryTidyButton() {
  const tidy = useTidy();
  const ai = useAiStatus();
  return <AiButton size="sm" aria-busy={tidy.busy} disabled={tidy.busy} onClick={tidy.start} title={`Sends this record’s words to ${ai.saved?.availability.providerName ?? "the model"}; nothing changes until you adopt the draft`}>
    <Sparkles className="h-4 w-4" aria-hidden />{tidy.busy ? "Tidying…" : "Tidy up"}
  </AiButton>;
}

/** The draft, the problems the program found in it, and the record's words as they are now. */
export function EntryTidyPanel({ entryId, original }: { entryId: string; original: string }) {
  const tidy = useTidy();
  if (tidy.error) return <p role="alert" className="rounded-[var(--ln-radius-panel-inner)] bg-error-surface p-3 text-sm text-error">{tidy.error}</p>;
  if (tidy.notice) return <p role="status" className="text-sm text-success">{tidy.notice}</p>;
  return tidy.draft ? <DraftForm key={tidy.draft.requestKey} entryId={entryId} draft={tidy.draft} original={original} onClose={tidy.close} /> : null;
}

function DraftForm({ entryId, draft, original, onClose }: { entryId: string; draft: TidyDraft; original: string; onClose: (notice?: string) => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(draft.title);
  const [markdown, setMarkdown] = useState(draft.markdown);
  const [asking, setAsking] = useState(false);
  const [assignment, setAssignment] = useState<"open" | "filed" | "declined">(draft.experiment ? "open" : "declined");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const run = (action: () => Promise<{ error?: string }>, after: () => void) => start(async () => {
    setError(undefined);
    const result = await action();
    if (result.error) { setError(result.error); return; }
    after();
    router.refresh();
  });
  const adopt = () => run(() => adoptEntryTidy(entryId, { requestKey: draft.requestKey, title, markdown }), () => onClose("Adopted. The words as they were are kept under “Original words”."));
  const ignore = (reason: string) => run(() => ignoreEntryTidy(entryId, draft.requestKey, reason), () => onClose("The draft was set aside; the record is unchanged."));
  const assign = (adopt: boolean) => run(() => decideEntryAssignment(entryId, draft.experiment!.id, adopt), () => setAssignment(adopt ? "filed" : "declined"));

  return <section id="entry-tidy" aria-label="Tidied draft" className="scroll-mt-20 space-y-3 rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-5 shadow-paper">
    <div>
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink"><span className="ln-ai-tag">AI</span>Tidied draft</h2>
      <p className="mt-1 text-xs leading-5 text-muted">{`From ${draft.provider}${draft.model ? ` (${draft.model})` : ""}. Nothing on the record changes until you adopt it; the words as they are now stay under “Original words”.`}</p>
    </div>
    {draft.unsupported.length ? <p role="note" className="rounded-[var(--ln-radius-control-lg)] bg-warning-surface p-2 text-xs leading-5 text-warning">{`Not in your words: ${draft.unsupported.join(", ")}. Check them before adopting.`}</p> : null}
    <label className="block text-xs font-medium text-graphite">Title<input className={formInputClass} value={title} maxLength={160} onChange={event => setTitle(event.target.value)} /></label>
    <label className="block text-xs font-medium text-graphite">Body text<textarea className={`${formInputClass} min-h-40 font-[inherit] leading-6`} rows={Math.min(18, markdown.split("\n").length + 2)} value={markdown} onChange={event => setMarkdown(event.target.value)} /></label>
    <Disclosure title="Original words" className="rounded-[var(--ln-radius-panel-inner)] border border-hairline"><EntryContentView markdown={original} /></Disclosure>
    {draft.experiment && assignment === "open" ? <div className="flex flex-wrap items-center gap-2 rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-warm p-3 text-xs text-graphite">
      <span className="min-w-0 flex-1">{`Your words name ${draft.experiment.label}. File this record under it?`}</span>
      <Button type="button" size="sm" disabled={pending} onClick={() => assign(true)}>File under it</Button>
      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => assign(false)}>Not now</Button>
    </div> : null}
    {assignment === "filed" ? <p role="status" className="text-xs text-success">{`Filed under ${draft.experiment?.label}.`}</p> : null}
    {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="primary" disabled={pending || !title.trim() || !markdown.trim()} onClick={adopt}>Use this draft</Button>
      {asking ? <>
        <span className="text-xs text-muted">Why set it aside?</span>
        {pickableReasons.map(reason => <Button key={reason} type="button" size="sm" variant="ghost" disabled={pending} onClick={() => ignore(reason)}>{ignoreReasonLabels[reason]}</Button>)}
      </> : <Button type="button" variant="ghost" disabled={pending} onClick={() => setAsking(true)}>Set aside</Button>}
    </div>
  </section>;
}
