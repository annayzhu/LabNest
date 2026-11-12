"use client";

import { DialogHeader } from "@/components/ui/DialogShell";
import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link2, RotateCcw, Trash2 } from "lucide-react";
import { purgeTrashRecord, restoreTrashRecord } from "@/app/trash/actions";
import { useI18n } from "@/components/I18nProvider";
import { formInputClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import type { FormActionState } from "@/lib/form-actions";

const initialState: FormActionState = {};

export function RecycleBinActions({ id, identifier, title, associationsPreserved = false }: { id: string; identifier: string; title: string; associationsPreserved?: boolean }) {
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
        <Button type="submit" size="sm" variant="secondary" disabled={restoring || purging}><RotateCcw className="h-3.5 w-3.5" aria-hidden />{restoring ? locale === "zh" ? "恢复中…" : "Restoring…" : locale === "zh" ? "恢复" : "Restore"}</Button>
      </form>
      {associationsPreserved ? <span className="inline-flex min-h-8 items-center gap-1.5 px-1 text-xs text-muted"><Link2 className="h-3.5 w-3.5" aria-hidden />{locale === "zh" ? "关联保留中，不可永久删除" : "Protected while linked"}</span> : <Button type="button" size="sm" variant="ghost" className="text-error hover:bg-error-surface hover:text-error" disabled={restoring || purging} onClick={() => setOpen(true)}><Trash2 className="h-3.5 w-3.5" aria-hidden />{locale === "zh" ? "永久删除" : "Delete forever"}</Button>}
      {restoreState.error ? <p role="alert" className="w-full text-right text-xs text-error">{restoreState.error}</p> : null}

      {open && !associationsPreserved ? createPortal(
        <div role="presentation" className="ln-modal-layer fixed inset-0 z-50 flex items-center justify-center p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !purging) setOpen(false); }}>
          <div className="ln-modal-backdrop pointer-events-none absolute inset-0 bg-ink/35 backdrop-blur-[2px]" aria-hidden />
          <section role="dialog" aria-modal="true" aria-labelledby={`purge-${id}`} className="ln-dialog relative w-full max-w-lg">
            <DialogHeader title={locale === "zh" ? "从回收站永久删除？" : "Delete from the Recycle Bin forever?"} titleId={`purge-${id}`} subtitle={locale === "zh" ? "不可撤销" : "Irreversible"} closeLabel="Close permanent deletion dialog" onClose={() => setOpen(false)} closeDisabled={purging} /><div className="ln-dialog-body">
            <div className="rounded-[var(--ln-radius-control-lg)] border border-error/25 bg-error-surface px-3 py-3"><p className="font-medium text-error">{identifier} · {title}</p><p className="mt-1 text-sm leading-6 text-graphite">{locale === "zh" ? "这会删除最后一份恢复快照，之后无法找回。" : "This removes the final recovery snapshot and cannot be undone."}</p></div>
            <form action={purgeAction} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={id} />
              <label className="block"><span className="text-xs font-semibold text-graphite">{locale === "zh" ? "输入" : "Enter"} <strong className="record-identifier text-error">{identifier}</strong> {locale === "zh" ? "以确认" : "to confirm"}</span><input autoFocus required autoComplete="off" name="confirmation" className={formInputClass} /></label>
              {purgeState.error ? <p role="alert" className="rounded-[var(--ln-radius-control-lg)] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error">{purgeState.error}</p> : null}
              <div className="flex justify-end gap-2 border-t border-hairline pt-4"><Button type="button" disabled={purging} onClick={() => setOpen(false)}>{locale === "zh" ? "取消" : "Cancel"}</Button><Button type="submit" variant="destructive" disabled={purging}><Trash2 className="h-4 w-4" aria-hidden />{purging ? locale === "zh" ? "删除中…" : "Deleting…" : locale === "zh" ? "永久删除" : "Delete forever"}</Button></div>
            </form>
          </div></section>
        </div>
      , document.body) : null}
    </div>
  );
}
