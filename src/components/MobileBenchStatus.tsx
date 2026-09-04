"use client";

import { AlertTriangle, Cloud, CloudOff, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { countEntryDrafts } from "@/lib/entry-draft-store";
import { listMobileMutations, mobileMutationStatusLabel, mobileQueueChangedEvent, removeMobileMutation, requestMobileMutationSync, type MobileMutation, updateMobileMutation } from "@/lib/mobile-mutation-queue";

const actionLabels: Record<MobileMutation["actionType"], string> = {
  "entry.create": "Observation",
  "inventory.transaction": "Inventory change",
  "measurement.create": "Measurement",
  "step.complete": "Step completion",
};

export function MobileBenchStatus() {
  const [online, setOnline] = useState(true);
  const [drafts, setDrafts] = useState(0);
  const [items, setItems] = useState<MobileMutation[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const reviewTrigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const refresh = () => setOnline(navigator.onLine);
    refresh();
    const readLocalState = () => {
      countEntryDrafts().then(setDrafts).catch(() => undefined);
      listMobileMutations().then(setItems).catch(() => undefined);
    };
    readLocalState();
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    window.addEventListener(mobileQueueChangedEvent, readLocalState);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      window.removeEventListener(mobileQueueChangedEvent, readLocalState);
    };
  }, []);

  useEffect(() => {
    if (!reviewOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setReviewOpen(false);
        reviewTrigger.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [reviewOpen]);

  const pending = items.filter((item) => item.state !== "conflict").length;
  const conflicts = items.filter((item) => item.state === "conflict");

  async function retry(item: MobileMutation) {
    await updateMobileMutation({ ...item, state: "pending", lastError: undefined });
    requestMobileMutationSync();
  }

  async function discard(item: MobileMutation) {
    await removeMobileMutation(item.clientMutationId);
  }

  if (online && drafts === 0 && pending === 0 && conflicts.length === 0) return null;
  return (
    <>
    <section aria-label="Save and sync status" className="rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-4 lg:hidden">
      <div className="flex items-center gap-2">
        {online ? <Cloud className="h-4 w-4 text-moss" aria-hidden /> : <CloudOff className="h-4 w-4 text-warning" aria-hidden />}
        <h2 className="text-sm font-semibold text-ink">Save & sync</h2>
      </div>
      <div className="mt-3 space-y-2 text-sm text-graphite">
        {!online ? <p className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />Offline. Captures remain on this device until you reconnect and save them.</p> : null}
        {drafts ? <p>{drafts} recoverable local {drafts === 1 ? "draft" : "drafts"} on this device.</p> : null}
        {pending ? <p>{pending} {mobileMutationStatusLabel("pending").toLowerCase()}.</p> : null}
        {conflicts.length ? <p className="text-error">{conflicts.length} {mobileMutationStatusLabel("conflict").toLowerCase()} requiring review.</p> : null}
      </div>
      {conflicts.length ? <button ref={reviewTrigger} type="button" onClick={() => setReviewOpen(true)} className="focus-ring mt-3 min-h-11 w-full rounded-[var(--ln-radius-control-lg)] border border-error/30 bg-error-surface px-3 text-sm font-semibold text-error">Review sync issues</button> : null}
    </section>
    {reviewOpen ? <div className="ln-modal-layer fixed inset-0 z-50 lg:hidden">
      <button type="button" aria-label="Close sync review" onClick={() => { setReviewOpen(false); reviewTrigger.current?.focus(); }} className="ln-modal-backdrop absolute inset-0 bg-ink/25" />
      <section role="dialog" aria-modal="true" aria-labelledby="sync-review-title" className="ln-modal-card ln-modal-sheet absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto rounded-t-[var(--ln-radius-panel)] border-t border-hairline bg-surface pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-soft">
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-hairline bg-surface/95 px-4 py-3 backdrop-blur">
          <div><h2 id="sync-review-title" className="font-serif text-xl font-medium text-ink">Review sync issues</h2><p className="mt-1 text-xs text-muted">Your local record is kept until you retry or discard it.</p></div>
          <button type="button" aria-label="Close sync review" onClick={() => { setReviewOpen(false); reviewTrigger.current?.focus(); }} className="focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hairline"><X className="h-4 w-4" /></button>
        </div>
        <ul className="divide-y divide-hairline">
          {conflicts.map((item) => <li key={item.clientMutationId} className="p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-ink">{actionLabels[item.actionType]}</p><p className="mt-1 text-xs text-muted">Recorded {new Date(item.deviceCreatedAt).toLocaleString()} · retry {item.retryCount}</p></div><span className="rounded-full bg-error-surface px-2 py-1 text-[11px] font-semibold text-error">Needs review</span></div>
            <p className="mt-3 rounded-[var(--ln-radius-control-lg)] bg-warm px-3 py-2 text-sm leading-5 text-graphite">{item.lastError ?? "The server could not accept this record."}</p>
            <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => void retry(item)} className="focus-ring flex min-h-11 items-center justify-center gap-2 rounded-[var(--ln-radius-control-lg)] bg-action px-3 text-sm font-semibold text-white"><RefreshCw className="h-4 w-4" />Retry</button><button type="button" onClick={() => void discard(item)} className="focus-ring flex min-h-11 items-center justify-center gap-2 rounded-[var(--ln-radius-control-lg)] border border-error/30 px-3 text-sm font-semibold text-error"><Trash2 className="h-4 w-4" />Discard local copy</button></div>
          </li>)}
        </ul>
      </section>
    </div> : null}
    </>
  );
}
