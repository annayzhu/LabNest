"use client";

import { AlertTriangle, Cloud, CloudOff } from "lucide-react";
import { useEffect, useState } from "react";
import { countEntryDrafts } from "@/lib/entry-draft-store";
import { listMobileMutations, mobileMutationStatusLabel, mobileQueueChangedEvent } from "@/lib/mobile-mutation-queue";

export function MobileBenchStatus() {
  const [online, setOnline] = useState(true);
  const [drafts, setDrafts] = useState(0);
  const [queued, setQueued] = useState({ pending: 0, conflicts: 0 });

  useEffect(() => {
    const refresh = () => setOnline(navigator.onLine);
    refresh();
    const readLocalState = () => {
      countEntryDrafts().then(setDrafts).catch(() => undefined);
      listMobileMutations().then((items) => setQueued({ pending: items.filter((item) => item.state !== "conflict").length, conflicts: items.filter((item) => item.state === "conflict").length })).catch(() => undefined);
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

  if (online && drafts === 0 && queued.pending === 0 && queued.conflicts === 0) return null;
  return (
    <section aria-label="Save and sync status" className="rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-4 lg:hidden">
      <div className="flex items-center gap-2">
        {online ? <Cloud className="h-4 w-4 text-moss" aria-hidden /> : <CloudOff className="h-4 w-4 text-warning" aria-hidden />}
        <h2 className="text-sm font-semibold text-ink">Save & sync</h2>
      </div>
      <div className="mt-3 space-y-2 text-sm text-graphite">
        {!online ? <p className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />Offline. Captures remain on this device until you reconnect and save them.</p> : null}
        {drafts ? <p>{drafts} recoverable local {drafts === 1 ? "draft" : "drafts"} on this device.</p> : null}
        {queued.pending ? <p>{queued.pending} {mobileMutationStatusLabel("pending").toLowerCase()}.</p> : null}
        {queued.conflicts ? <p className="text-error">{queued.conflicts} {mobileMutationStatusLabel("conflict").toLowerCase()} requiring review.</p> : null}
      </div>
    </section>
  );
}
