"use client";

import Link from "next/link";
import { FileText, FlaskConical, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

export type ResearchPlanRelationItem = {
  id: string;
  href: string;
  title: string;
  meta?: string;
  primary?: boolean;
};

function RelationDialog({ title, count, items, icon, loading, error, hasMore, onLoadMore, onRetry, onClose }: { title: string; count: number; items: ResearchPlanRelationItem[]; icon: ReactNode; loading: boolean; error: string | null; hasMore: boolean; onLoadMore: () => void; onRetry: () => void; onClose: () => void }) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const closingRef = useRef(false);
  const [closing, setClosing] = useState(false);
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(onClose, 180);
  }, [onClose]);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("button, a")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        requestClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panelRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", keydown);
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
  }, [requestClose]);
  return <div className="ln-modal-layer fixed inset-0 z-[100] grid place-items-center p-4" data-closing={closing || undefined} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
    <div className="ln-modal-backdrop pointer-events-none absolute inset-0 bg-ink/35 backdrop-blur-[2px]" aria-hidden />
    <section ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="ln-modal-card relative z-10 w-full max-w-2xl overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface shadow-soft">
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <h2 id={titleId} className="flex items-center gap-2 text-sm font-semibold text-ink">{icon}{title}<span className="font-mono text-xs font-normal text-muted">{count}</span></h2>
        <button type="button" onClick={requestClose} className="focus-ring grid h-7 w-7 place-items-center rounded-[var(--ln-radius-control-sm)] text-muted hover:bg-stone hover:text-ink" aria-label="Close dialog"><X className="h-4 w-4" aria-hidden /></button>
      </header>
      <div className="max-h-[65dvh] overflow-y-auto p-2">
        {items.length ? <ul className="divide-y divide-hairline">{items.map((item) => <li key={item.id}><Link href={item.href} className="focus-ring flex items-start justify-between gap-3 rounded-[var(--ln-radius-control-sm)] px-2 py-2 hover:bg-warm" onClick={requestClose}><span className="min-w-0"><strong className="block break-words text-xs font-semibold text-ink">{item.title}</strong>{item.meta ? <small className="mt-0.5 block text-[10px] text-muted">{item.meta}</small> : null}</span>{item.primary ? <span className="rounded-full bg-sage-surface px-2 py-0.5 text-[9px] font-semibold text-moss">Primary</span> : null}</Link></li>)}</ul> : null}
        {error ? <div role="alert" className="grid justify-items-center gap-2 px-3 py-6 text-center text-xs text-error"><p>{error}</p><button type="button" className="focus-ring rounded-[var(--ln-radius-control-sm)] border border-hairline px-3 py-1.5 font-medium text-moss hover:bg-sage-surface" onClick={onRetry}>Retry</button></div> : null}
        {!loading && !error && !items.length ? <p className="px-3 py-8 text-center text-xs text-muted">No linked records.</p> : null}
        {loading ? <p role="status" className="px-3 py-5 text-center text-xs text-muted">Loading linked records…</p> : null}
        {hasMore && !loading ? <button type="button" className="focus-ring mt-2 w-full rounded-[var(--ln-radius-control-sm)] border border-hairline px-3 py-2 text-xs font-medium text-moss hover:bg-sage-surface" onClick={onLoadMore}>Load more</button> : null}
      </div>
    </section>
  </div>;
}

export function ResearchPlanRelationCounts({ planId, kind, count }: { planId: string; kind: "protocols" | "records"; count: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ResearchPlanRelationItem[]>([]);
  const [page, setPage] = useState(-1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeDialog = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);
  const loadPage = useCallback(async (nextPage: number) => {
    setPage(nextPage);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/research-plans/${planId}/relations?kind=${kind}&page=${nextPage}`);
      if (!response.ok) throw new Error("Linked records could not be loaded.");
      const payload = await response.json() as { items?: ResearchPlanRelationItem[]; hasMore?: boolean };
      setItems((current) => nextPage === 0 ? payload.items ?? [] : [...current, ...(payload.items ?? []).filter((item) => !current.some((existing) => existing.id === item.id))]);
      setHasMore(Boolean(payload.hasMore));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Linked records could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [kind, planId]);
  const countButton = "focus-ring inline-flex min-w-8 items-center justify-center rounded-[var(--ln-radius-control-sm)] border border-hairline bg-surface px-2 py-1 font-mono text-xs font-semibold text-moss hover:border-moss hover:bg-sage-surface";
  return <>
    <button ref={triggerRef} type="button" className={countButton} aria-label={`View ${count} linked ${kind}`} onClick={() => { setOpen(true); if (page < 0) void loadPage(0); }}>{count}</button>
    {open ? <RelationDialog title={kind === "protocols" ? "Linked protocols" : "Experiments and entries"} count={count} items={items} icon={kind === "protocols" ? <FileText className="h-4 w-4" aria-hidden /> : <FlaskConical className="h-4 w-4" aria-hidden />} loading={loading} error={error} hasMore={hasMore} onLoadMore={() => void loadPage(page + 1)} onRetry={() => void loadPage(Math.max(0, page))} onClose={closeDialog} /> : null}
  </>;
}
