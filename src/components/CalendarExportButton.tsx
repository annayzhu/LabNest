"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarPlus, X } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";

/**
 * Exports planned experiments as an .ics file for the phone's calendar. `scope` is the export
 * query (`plan=<id>`, `experiment=<id>` or `month=YYYY-MM`). The dialog asks the server how many
 * experiments the file would hold first, so an empty export never reaches the download.
 */
export function CalendarExportButton({ scope, iconOnly = false }: { scope: string; iconOnly?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const label = t("Export to calendar");
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label={label} title={label}
      className={iconOnly ? "focus-ring flex h-11 w-11 items-center justify-center rounded-[var(--ln-radius-control-md)] text-muted transition hover:bg-stone/70 hover:text-ink sm:h-8 sm:w-8" : undefined}>
      {iconOnly ? <CalendarPlus className="h-4 w-4" aria-hidden /> : label}
    </button>
    {open ? createPortal(<ExportDialog scope={scope} onClose={() => setOpen(false)} />, document.body) : null}
  </>;
}

function ExportDialog({ scope, onClose }: { scope: string; onClose: () => void }) {
  const { t, locale } = useI18n();
  const zh = locale === "zh";
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const [remind, setRemind] = useState(true);
  const [remindStart, setRemindStart] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [events, setEvents] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/calendar/export?${scope}&count=1`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { count: number; events?: number }) => { if (live) { setCount(data.count); setEvents(data.events ?? data.count); } })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [scope]);

  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLElement>("input")?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); trigger?.focus(); };
  }, [onClose]);

  const href = `/api/calendar/export?${scope}${remind ? "" : "&remind=0"}${remindStart ? "&start=1" : ""}${zh ? "" : "&lang=en"}`;
  // Q267: an experiment with a schedule becomes one event per block; one without stays a single all-day event.
  const summary = failed
    ? t("Could not read the planned experiments. Try again.")
    : count === null
      ? t("Counting planned experiments…")
      : count === 0
        ? t("No planned experiments to export.")
        : events === count
          ? zh ? `将导出 ${count} 个待做实验，每个实验为当天的全天事件。` : `${count} planned ${count === 1 ? "experiment" : "experiments"} will be added as all-day events.`
          : zh ? `将导出 ${count} 个待做实验的 ${events} 个事件：有日程的实验每段一个事件，其余为当天的全天事件。` : `${events} events from ${count} planned ${count === 1 ? "experiment" : "experiments"}: one per schedule block, and an all-day event for an experiment without a schedule.`;

  return <div className="ln-modal-layer fixed inset-0 z-[90] grid place-items-center p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="ln-modal-backdrop pointer-events-none absolute inset-0 bg-ink/35 backdrop-blur-[2px]" aria-hidden />
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="ln-modal-card relative z-10 w-full max-w-md overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface shadow-soft">
      <div className="flex items-start justify-between gap-4 border-b border-hairline px-4 py-3.5">
        <h2 id={titleId} className="text-lg font-semibold leading-tight text-ink">{t("Export to calendar")}</h2>
        <button type="button" onClick={onClose} className="focus-ring flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--ln-radius-control-sm)] text-muted hover:bg-stone hover:text-ink" aria-label={t("Close dialog")}><X className="h-4 w-4" aria-hidden /></button>
      </div>
      <div className="space-y-3 p-4 text-sm leading-6 text-graphite">
        <p role="status" data-i18n-ignore>{summary}</p>
        <label className="flex min-h-11 items-center gap-2.5 text-ink">
          <input type="checkbox" checked={remind} onChange={(event) => setRemind(event.target.checked)} className="h-4 w-4 accent-[var(--action)]" />
          {t("Remind me at 20:00 the evening before")}
        </label>
        {events !== (count ?? 0) ? <label className="flex min-h-11 items-center gap-2.5 text-ink">
          <input type="checkbox" checked={remindStart} onChange={(event) => setRemindStart(event.target.checked)} className="h-4 w-4 accent-[var(--action)]" />
          {t("Remind me 15 minutes before a block with a time")}
        </label> : null}
        <p className="text-xs leading-5 text-muted">{t("On iPhone, open the file and tap Add All. Later changes in LabNest do not reach the calendar: export again after a change, and delete the old events if they appear twice.")}</p>
        <div className="flex justify-end gap-2 border-t border-hairline pt-3">
          <button type="button" onClick={onClose} className="focus-ring inline-flex h-9 items-center rounded-[var(--ln-radius-control-lg)] border border-hairline bg-surface px-3 text-sm font-medium text-graphite hover:border-border-strong hover:text-ink">{t("Cancel")}</button>
          {count ? <a href={href} onClick={() => setTimeout(onClose, 300)} className="ln-key-action focus-ring inline-flex h-9 items-center gap-1.5 rounded-[var(--ln-radius-control-lg)] border px-4 text-sm font-semibold">
            <CalendarPlus className="h-4 w-4" aria-hidden />{t("Download calendar file")}
          </a> : <span aria-disabled="true" className="inline-flex h-9 items-center gap-1.5 rounded-[var(--ln-radius-control-lg)] bg-stone px-4 text-sm font-semibold text-muted">
            <CalendarPlus className="h-4 w-4" aria-hidden />{t("Download calendar file")}
          </span>}
        </div>
      </div>
    </section>
  </div>;
}
