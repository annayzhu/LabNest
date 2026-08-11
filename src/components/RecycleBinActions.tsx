"use client";

import { useActionState, useEffect, useState } from "react";
import { RotateCcw, Trash2, X } from "lucide-react";
import { purgeTrashRecord, restoreTrashRecord } from "@/app/trash/actions";
import { useI18n } from "@/components/I18nProvider";
import { formInputClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import type { FormActionState } from "@/lib/form-actions";

const initialState: FormActionState = {};

export function RecycleBinActions({ id, identifier, title }: { id: string; identifier: string; title: string }) {
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [restoreState, restoreAction, restoring] = useActionState(restoreTrashRecord, initialState);
  const [purgeState, purgeAction, purging] = useActionState(purgeTrashRecord, initialState);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !purging) setOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open, purging]);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <form action={restoreAction}>
        <input type="hidden" name="id" value={id} />
        <Button type="submit" variant="primary" disabled={restoring || purging}><RotateCcw className="h-4 w-4" aria-hidden />{restoring ? locale === "zh" ? "恢复中…" : "Restoring…" : locale === "zh" ? "恢复" : "Restore"}</Button>
      </form>
      <Button type="button" variant="destructive" disabled={restoring || purging} onClick={() => setOpen(true)}><Trash2 className="h-4 w-4" aria-hidden />{locale === "zh" ? "永久删除" : "Delete forever"}</Button>
      {restoreState.error ? <p role="alert" className="w-full text-right text-xs text-error">{restoreState.error}</p> : null}

      {open ? (
        <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget && !purging) setOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby={`purge-${id}`} className="w-full max-w-lg rounded-[12px] border border-hairline bg-surface p-5 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-error">{locale === "zh" ? "不可撤销" : "Irreversible"}</p><h2 id={`purge-${id}`} className="mt-1 font-serif text-xl font-medium text-ink">{locale === "zh" ? "从回收站永久删除？" : "Delete from the Recycle Bin forever?"}</h2></div>
              <button type="button" aria-label="Close permanent deletion dialog" disabled={purging} onClick={() => setOpen(false)} className="focus-ring rounded-[6px] p-1.5 text-muted hover:bg-stone hover:text-ink"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 rounded-[8px] border border-error/25 bg-error-surface px-3 py-3"><p className="font-medium text-error">{identifier} · {title}</p><p className="mt-1 text-sm leading-6 text-graphite">{locale === "zh" ? "这会删除最后一份恢复快照，之后无法找回。" : "This removes the final recovery snapshot and cannot be undone."}</p></div>
            <form action={purgeAction} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={id} />
              <label className="block"><span className="text-xs font-semibold text-graphite">{locale === "zh" ? "输入" : "Enter"} <strong className="font-mono text-error">{identifier}</strong> {locale === "zh" ? "以确认" : "to confirm"}</span><input autoFocus required autoComplete="off" name="confirmation" className={formInputClass} /></label>
              {purgeState.error ? <p role="alert" className="rounded-[8px] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error">{purgeState.error}</p> : null}
              <div className="flex justify-end gap-2 border-t border-hairline pt-4"><Button type="button" disabled={purging} onClick={() => setOpen(false)}>{locale === "zh" ? "取消" : "Cancel"}</Button><Button type="submit" variant="destructive" disabled={purging}><Trash2 className="h-4 w-4" aria-hidden />{purging ? locale === "zh" ? "删除中…" : "Deleting…" : locale === "zh" ? "永久删除" : "Delete forever"}</Button></div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
