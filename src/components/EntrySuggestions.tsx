"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { decideEntrySuggestion } from "@/app/entries/suggestion-actions";
import { canAccept, suggestedExperimentId, suggestedExperimentTitle, suggestionLabel, suggestionSubject } from "@/lib/ai-suggestion";
import type { EntrySuggestionRecord } from "@/lib/entries";
import { formInputClass } from "./forms";
import { Button } from "./ui/Button";

type Options = { experiments: { id: string; title: string; runCode: string }[]; expectedTarget: string | null; currentTarget: { title: string } | null };
type Outcome = { text: string; href?: string } | { error: string };

/**
 * AI 建议 on the entry they came from. 采纳 asks for the one thing the model may have got wrong (the experiment's
 * name, or which experiment) and then runs the entry's own 归入; 忽略 only closes the suggestion.
 */
export function EntrySuggestions({ entryId, suggestions, locked }: { entryId: string; suggestions: EntrySuggestionRecord[]; locked: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<string>();
  const [options, setOptions] = useState<Options>();
  const [title, setTitle] = useState("");
  const [experimentId, setExperimentId] = useState("");
  const [outcome, setOutcome] = useState<Outcome>();
  const [pending, start] = useTransition();

  // The assignment options are read when 采纳 opens, so the expected current target is fresh.
  const accept = (suggestion: EntrySuggestionRecord) => start(async () => {
    setOutcome(undefined);
    let data: Options & { error?: string };
    try {
      const response = await fetch(`/api/entries/${entryId}/assignment`);
      data = await response.json();
      if (!response.ok) throw new Error(data.error);
    } catch (error) {
      setOutcome({ error: error instanceof Error && error.message ? error.message : "读取实验列表失败，请重试" });
      return;
    }
    setOptions(data);
    setTitle(suggestedExperimentTitle(suggestion.payload, suggestion.reason));
    setExperimentId(suggestedExperimentId(suggestion.payload, data.experiments) ?? "");
    setOpen(suggestion.id);
  });
  const decide = (suggestion: EntrySuggestionRecord, accepted: boolean) => start(async () => {
    const result = await decideEntrySuggestion(entryId, suggestion.id, accepted
      ? { accept: true, expectedTarget: options?.expectedTarget ?? null, ...(suggestion.actionType === "create_experiment" ? { newTitle: title } : { experimentId }) }
      : { accept: false });
    if (result.error) { setOutcome({ error: result.error }); return; }
    setOpen(undefined);
    setOutcome(accepted ? { text: suggestion.actionType === "create_experiment" ? "已新建实验并归入。" : "已归入所选实验。", href: result.experimentId ? `/experiments/${result.experimentId}` : undefined } : { text: "已忽略这条建议。" });
    router.refresh();
  });

  // Shown only while there is something to decide, or the outcome of the last decision.
  if (!suggestions.length && !outcome) return null;
  return <section id="ai-suggestions" aria-label="AI 建议" className="scroll-mt-20 rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-5 shadow-paper">
    <h2 className="flex items-center gap-2 text-base font-semibold text-ink"><span className="ln-ai-tag">AI</span>建议{suggestions.length ? <span className="text-sm font-normal text-muted">{suggestions.length} 条待确认</span> : null}</h2>
    <p className="mt-1 text-xs leading-5 text-muted">AI 读这条记录后提出的后续操作。采纳后才会修改记录，忽略只是关掉建议。</p>
    {outcome ? <p role={"error" in outcome ? "alert" : "status"} className={`mt-3 text-sm ${"error" in outcome ? "text-error" : "text-success"}`}>{"error" in outcome ? outcome.error : outcome.text}{"href" in outcome && outcome.href ? <> <Link href={outcome.href} className="focus-ring font-medium text-moss underline">查看实验</Link></> : null}</p> : null}
    {suggestions.length ? <ul className="mt-4 space-y-3">
      {suggestions.map(suggestion => <li key={suggestion.id} className="rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-warm p-3">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-ink"><span>{suggestionLabel(suggestion.actionType)}{suggestionSubject(suggestion.payload) ? `：${suggestionSubject(suggestion.payload)}` : ""}</span>{suggestion.confidence !== undefined ? <span className="text-xs font-normal text-muted">把握 {Math.round(suggestion.confidence * 100)}%</span> : null}</p>
        {suggestion.reason ? <p className="mt-1 text-xs leading-5 text-graphite">{suggestion.reason}</p> : null}
        {!locked && open === suggestion.id && options ? <div className="mt-3 space-y-2 border-t border-hairline pt-3 text-xs leading-5 text-graphite">
          {suggestion.actionType === "create_experiment"
            ? <label className="block">新实验名称<input className={formInputClass} value={title} onChange={event => setTitle(event.target.value)} /></label>
            : <label className="block">归入哪个实验<select className={formInputClass} value={experimentId} onChange={event => setExperimentId(event.target.value)}><option value="">请选择实验</option>{options.experiments.map(experiment => <option key={experiment.id} value={experiment.id}>{experiment.runCode} · {experiment.title}</option>)}</select></label>}
          <p>{suggestion.actionType === "create_experiment" ? "将新建一个计划中的实验，并把这条记录归入它。" : "这条记录连同它的图片和附件会归入所选实验。"}{options.currentTarget ? ` 这条记录现在归入“${options.currentTarget.title}”，采纳后改为新的归属。` : ""}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="primary" disabled={pending || (suggestion.actionType === "create_experiment" ? !title.trim() : !experimentId)} onClick={() => decide(suggestion, true)}>{suggestion.actionType === "create_experiment" ? "新建实验并归入" : "归入这个实验"}</Button>
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setOpen(undefined)}>取消</Button>
          </div>
        </div> : <div className="mt-3 flex flex-wrap items-center gap-2">
          {locked ? <span className="text-xs text-muted">记录已提交，重新打开后才能采纳。</span>
            : canAccept(suggestion.actionType) ? <Button type="button" size="sm" disabled={pending} onClick={() => accept(suggestion)}>采纳</Button>
            : <span className="text-xs text-muted">这类建议还不能直接采纳，请按建议手动处理。</span>}
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => decide(suggestion, false)}>忽略</Button>
        </div>}
      </li>)}
    </ul> : null}
  </section>;
}
