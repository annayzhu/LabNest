"use client";

import { useActionState, useRef } from "react";
import { undoSampleBatch } from "@/app/samples/actions";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { useModalDialog } from "@/components/ui/ModalDialogProvider";
import type { FormActionState } from "@/lib/form-actions";

/** Shown over a batch just saved (S8): its size and, while none of it is used, a way to take the whole batch back. */
export function SampleBatchBanner({ batchId, count, undoable }: { batchId: string; count: number; undoable: boolean }) {
  const { t } = useI18n();
  const dialog = useModalDialog();
  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<FormActionState, FormData>(undoSampleBatch, {});
  if (state.success) return <p role="status" className="rounded-[var(--ln-radius-panel)] border border-hairline bg-surface px-3 py-2 text-sm text-graphite">{state.success}</p>;
  return (
    <form ref={form} action={action} className="flex flex-wrap items-center gap-2 rounded-[var(--ln-radius-panel)] border border-hairline bg-sage-surface px-3 py-2 text-sm">
      <input type="hidden" name="batchId" value={batchId} />
      <span className="text-moss"><span>Batch saved</span> · <span className="tabular-nums">{count}</span> <span>samples</span></span>
      {undoable ? (
        <Button type="button" size="sm" variant="ghost" disabled={pending} className="ml-auto text-error hover:bg-error-surface hover:text-error" onClick={async () => {
          if (await dialog.confirm({ title: t("Undo this batch?"), description: t(`${count} samples will be removed.`), confirmLabel: t("Undo"), tone: "destructive" })) form.current?.requestSubmit();
        }}>Undo this batch</Button>
      ) : <span className="ml-auto text-xs text-muted">Some of these samples are already used, so the batch can no longer be undone.</span>}
      {state.error ? <p role="alert" className="basis-full text-error">{state.error}</p> : null}
    </form>
  );
}
