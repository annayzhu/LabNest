"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { AlertTriangle, Archive, RotateCcw, Trash2, X } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { formInputClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import type { FormAction, FormActionState } from "@/lib/form-actions";
import type { RecordLifecycleBlocker } from "@/lib/record-lifecycle";

const initialState: FormActionState = {};

export function RecordLifecycleControl({
  id,
  identifier,
  title,
  recordLabel,
  recordLabelZh,
  blockers,
  archived = false,
  deleteAction,
  archiveAction,
  restoreAction,
  editHref,
  allowLinkedRecycle = false,
}: {
  id: string;
  identifier: string;
  title: string;
  recordLabel: string;
  recordLabelZh: string;
  blockers: RecordLifecycleBlocker[];
  archived?: boolean;
  deleteAction: FormAction;
  archiveAction?: FormAction;
  restoreAction?: FormAction;
  editHref?: string;
  allowLinkedRecycle?: boolean;
}) {
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [deleteState, deleteFormAction, deleting] = useActionState(deleteAction, initialState);
  const [archiveState, archiveFormAction, archiving] = useActionState(archiveAction ?? passthroughAction, initialState);
  const [restoreState, restoreFormAction, restoring] = useActionState(restoreAction ?? passthroughAction, initialState);
  const pending = deleting || archiving || restoring;
  const label = locale === "zh" ? recordLabelZh : recordLabel;

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open, pending]);

  return (
    <>
      <Button type="button" size="lg" variant="destructive" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" aria-hidden />
        {locale === "zh" ? "删除 / 归档" : "Delete / archive"}
      </Button>
      {open ? (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pending) setOpen(false);
          }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby={`record-lifecycle-${id}`} className="w-full max-w-lg rounded-[12px] border border-hairline bg-surface p-5 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-error">
                  {locale === "zh" ? "记录生命周期" : "Record lifecycle"}
                </p>
                <h2 id={`record-lifecycle-${id}`} className="mt-1 font-serif text-xl font-medium text-ink">
                  {locale === "zh" ? `移入回收站或归档${label}` : `Recycle or archive this ${label}?`}
                </h2>
              </div>
              <button type="button" aria-label="Close record lifecycle dialog" disabled={pending} onClick={() => setOpen(false)} className="focus-ring rounded-[6px] p-1.5 text-muted hover:bg-stone hover:text-ink"><X className="h-4 w-4" /></button>
            </div>

            <div className="mt-4 rounded-[8px] border border-error/25 bg-error-surface px-3 py-3">
              <p className="font-medium text-error">{identifier} · {title}</p>
              <p className="mt-1 text-sm leading-6 text-graphite">
                {locale === "zh"
                  ? "删除后记录会进入回收站，可以恢复；操作事件仍会保留在活动日志中。归档不会破坏关联科研记录。"
                  : "Deletion moves the record to the Recycle Bin, where it can be restored. Its audit event remains in Activity."}
              </p>
            </div>

            {blockers.length ? (
              <div className="mt-4">
                <p className="flex items-start gap-2 text-sm font-medium text-warning"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{allowLinkedRecycle ? locale === "zh" ? "以下状态或关联会被处理，但仍可移入回收站。" : "The following state or associations will be handled, but this record can still be recycled." : locale === "zh" ? `该${label}不能移入回收站。` : `This ${label} cannot be moved to the Recycle Bin.`}</p>
                <ul className="mt-2 space-y-1 pl-6 text-sm text-graphite">
                  {blockers.map((blocker) => (
                    <li key={blocker.key} className="list-disc">
                      {locale === "zh" ? blocker.labelZh : blocker.label}
                      {blocker.count !== undefined ? `：${blocker.count}` : !allowLinkedRecycle && (blocker.detail || blocker.detailZh) ? ` — ${locale === "zh" ? blocker.detailZh : blocker.detail}` : ""}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm leading-6 text-muted">
                  {allowLinkedRecycle
                    ? locale === "zh" ? "有关联时将保留一个隐藏的可恢复记录；原关联位置会显示“来源在回收站”警告。" : "When links exist, a hidden recoverable record is retained and linked pages show a Recycle Bin warning."
                    : archived
                    ? locale === "zh" ? "该记录已归档，关联链路仍被保留。" : "This record is already archived and its linked provenance remains preserved."
                    : locale === "zh" ? "请归档记录，而不是破坏已有的科研关联链路。" : "Archive the record instead of breaking its existing scientific provenance."}
                </p>
              </div>
            ) : null}

            {!blockers.length || allowLinkedRecycle ? (
              <form action={deleteFormAction} className="mt-4 space-y-4">
                <input type="hidden" name="id" value={id} />
                <label className="block">
                  <span className="text-xs font-semibold text-graphite">{locale === "zh" ? "输入" : "Enter"} <strong className="font-mono text-error">{identifier}</strong> {locale === "zh" ? "以确认移入回收站" : "to confirm moving it to the Recycle Bin"}</span>
                  <input autoFocus required autoComplete="off" name="confirmation" className={formInputClass} />
                </label>
                {deleteState.error ? <ErrorMessage message={deleteState.error} /> : null}
                <div className="flex justify-end gap-2 border-t border-hairline pt-4">
                  <Button type="button" disabled={pending} onClick={() => setOpen(false)}>{locale === "zh" ? "取消" : "Cancel"}</Button>
                  <Button type="submit" variant="destructive" disabled={pending}><Trash2 className="h-4 w-4" aria-hidden />{deleting ? locale === "zh" ? "处理中…" : "Moving…" : locale === "zh" ? "移入回收站" : "Move to Recycle Bin"}</Button>
                </div>
              </form>
            ) : null}

            <div className={`${blockers.length ? "mt-5" : "mt-3"} flex flex-wrap justify-end gap-2`}>
              {restoreAction && archived ? (
                <form action={restoreFormAction}>
                  <input type="hidden" name="id" value={id} />
                  <Button type="submit" disabled={pending}><RotateCcw className="h-4 w-4" aria-hidden />{restoring ? locale === "zh" ? "恢复中…" : "Restoring…" : locale === "zh" ? "恢复记录" : "Restore record"}</Button>
                </form>
              ) : null}
              {archiveAction && !archived ? (
                <form action={archiveFormAction}>
                  <input type="hidden" name="id" value={id} />
                  <Button type="submit" variant="primary" disabled={pending}><Archive className="h-4 w-4" aria-hidden />{archiving ? locale === "zh" ? "归档中…" : "Archiving…" : locale === "zh" ? "归档记录" : "Archive record"}</Button>
                </form>
              ) : null}
              {archived && editHref && !restoreAction ? <Link href={editHref} className="focus-ring inline-flex h-9 items-center justify-center rounded-[7px] border border-moss bg-moss px-3 text-[13px] text-warm">{locale === "zh" ? "修改状态" : "Change status"}</Link> : null}
            </div>
            {archiveState.error ? <ErrorMessage message={archiveState.error} /> : null}
            {restoreState.error ? <ErrorMessage message={restoreState.error} /> : null}
          </section>
        </div>
      ) : null}
    </>
  );
}

async function passthroughAction(previousState: FormActionState) {
  return previousState;
}

function ErrorMessage({ message }: { message: string }) {
  return <p role="alert" className="mt-3 rounded-[8px] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error">{message}</p>;
}
