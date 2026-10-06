"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { newClientMutationId } from "@/lib/client-mutation-id";
import { formInputClass } from "./forms";

type Target = { type: string; id: string; title: string; invalid: boolean };
type Options = {
  experiments: { id: string; title: string; runCode: string; researchPlan: { title: string } | null }[];
  results: { id: string; title: string; experimentId: string }[];
  expectedTarget: string | null;
  currentTarget: Target | null;
};

export function EntryAssignmentControl({ id, target, initialOpen = false }: { id: string; target: Target | null; initialOpen?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [activeTarget, setActiveTarget] = useState(target);
  const [options, setOptions] = useState<Options>();
  const [kind, setKind] = useState<"experiment" | "result">("experiment");
  const [search, setSearch] = useState("");
  const [experimentId, setExperimentId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const attempt = useRef<{ signature: string; id: string } | undefined>(undefined);
  const pending = useRef(false);
  const opened = useRef(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/entries/${id}/assignment`, { cache: "no-store" });
    if (!response.ok) throw new Error("目标列表加载失败");
    const data: Options = await response.json();
    setOptions(data);
    setActiveTarget(data.currentTarget);
    return data;
  }, [id]);

  const open = useCallback(async () => {
    setMessage("");
    setOptions(undefined);
    dialog.current?.showModal();
    try {
      setNewTitle(""); setSearch("");
      const data = await load();
      const current = data.currentTarget;
      setKind(current?.type === "result" ? "result" : "experiment");
      setTargetId(current && !current.invalid ? current.id : "");
      setExperimentId(data.results.find(result => result.id === current?.id)?.experimentId ?? "");
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  }, [load]);

  useEffect(() => {
    if (initialOpen && !opened.current) { opened.current = true; void open(); }
  }, [initialOpen, open]);

  async function save(type: "experiment" | "result" | "none") {
    if (pending.current || !options) return;
    pending.current = true; setBusy(true); setMessage("");
    const payload = {
      type, expectedTarget: options.expectedTarget,
      ...(type !== "none" ? { ...(targetId ? { targetId } : { newTitle }), ...(type === "result" ? { experimentId } : {}) } : {}),
    };
    const signature = JSON.stringify(payload);
    if (attempt.current?.signature !== signature) attempt.current = { signature, id: newClientMutationId() };
    let committed = false;
    try {
      const response = await fetch(`/api/entries/${id}/assignment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, mutationId: attempt.current.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      committed = true;
      // Read the committed relationship without a late router refresh that can cancel target navigation.
      await load();
      setMessage(type === "none" ? "已取消归入，原始记录保留" : "已归入，原始记录和时间保留");
      dialog.current?.close();
    } catch (error) {
      setMessage(committed ? "归入已提交，但回读失败。请刷新核对当前归属。" : error instanceof Error ? error.message : String(error));
    } finally { setBusy(false); pending.current = false; }
  }

  const experiments = options?.experiments.filter(item => `${item.title} ${item.runCode} ${item.researchPlan?.title ?? ""}`.toLowerCase().includes(search.toLowerCase())) ?? [];
  const results = options?.results.filter(item => item.experimentId === experimentId && item.title.toLowerCase().includes(search.toLowerCase())) ?? [];
  return <div className="flex flex-wrap items-center gap-2 text-sm" data-print-hidden>
    {activeTarget ? activeTarget.invalid ? <span className="text-warning">原归属已失效</span> : <Link href={`/${activeTarget.type === "result" ? "results" : "experiments"}/${activeTarget.id}`} className="text-moss underline">{activeTarget.title}</Link> : <span className="text-muted">未归入</span>}
    {activeTarget ? <details className="relative"><summary aria-label="更多归属操作" className="min-h-10 cursor-pointer list-none rounded-[var(--ln-radius-control-md)] border border-hairline px-3 py-2">⋯</summary><div className="absolute right-0 z-20 min-w-40 rounded-[var(--ln-radius-control-md)] border border-hairline bg-surface p-1 shadow-paper"><button type="button" onClick={() => void open()} className="min-h-11 w-full px-3 text-left text-moss">更改或取消归属…</button></div></details> : <button type="button" onClick={() => void open()} className="min-h-10 rounded-[var(--ln-radius-control-md)] border border-hairline px-3 text-moss">归入…</button>}
    {message ? <span role="status">{message}</span> : null}
    <dialog aria-label="整理快速记录" ref={dialog} className="m-auto w-[min(32rem,calc(100%-24px))] max-h-[calc(100dvh-24px)] overflow-y-auto rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-5 text-ink backdrop:bg-black/30">
      <h2 className="text-lg font-semibold">整理快速记录</h2><p className="mt-1 text-sm text-muted">引用同一条原始记录，保留正文、图片和原记录时间。</p>
      <fieldset disabled={!options || busy}><label className="mt-4 block">归入类型<select aria-label="归入类型" className={formInputClass} value={kind} onChange={event => { setKind(event.target.value as typeof kind); setTargetId(""); setNewTitle(""); setSearch(""); }}><option value="experiment">实验</option><option value="result">实验结果</option></select></label>
      {kind === "result" ? <label className="mt-3 block">所属实验<select aria-label="所属实验" className={formInputClass} value={experimentId} onChange={event => { setExperimentId(event.target.value); setTargetId(""); }}><option value="">选择实验</option>{options?.experiments.map(item => <option key={item.id} value={item.id}>{item.runCode} · {item.title}</option>)}</select></label> : null}
      <label className="mt-3 block">搜索<input aria-label="搜索归属目标" className={formInputClass} value={search} onChange={event => setSearch(event.target.value)} /></label>
      <label className="mt-3 block">已有目标<select aria-label="已有归属目标" className={formInputClass} value={targetId} onChange={event => { setTargetId(event.target.value); setNewTitle(""); }}><option value="">选择已有目标</option>{(kind === "experiment" ? experiments : results).map(item => <option key={item.id} value={item.id}>{"runCode" in item ? `${item.runCode} · ` : ""}{item.title}{"researchPlan" in item && item.researchPlan ? ` · ${item.researchPlan.title}` : ""}</option>)}</select></label>
      <label className="mt-3 block">或新建{kind === "experiment" ? "实验" : "结果"}并归入<input aria-label="新目标名称" className={formInputClass} value={newTitle} onChange={event => { setNewTitle(event.target.value); setTargetId(""); }} placeholder="目标名称" /></label>
      </fieldset>
      {message ? <p role="alert" className="mt-3 text-error">{message}</p> : null}
      <div className="mt-5 flex flex-wrap gap-2"><button type="button" disabled={busy || !options || (!targetId && !newTitle) || (kind === "result" && !experimentId)} onClick={() => void save(kind)} className="min-h-11 rounded-[var(--ln-radius-control-md)] bg-moss px-4 text-white disabled:opacity-40">{busy ? "处理中…" : "确认归入"}</button><button type="button" disabled={busy} onClick={() => dialog.current?.close()} className="min-h-11 px-3">取消</button>{activeTarget ? <button type="button" disabled={busy || !options} onClick={() => void save("none")} className="min-h-11 px-3 text-error">取消归入</button> : null}</div>
    </dialog>
  </div>;
}
