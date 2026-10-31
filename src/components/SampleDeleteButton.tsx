"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useRef } from "react";
import { deleteSample } from "@/app/samples/actions";
import { useI18n } from "@/components/I18nProvider";
import { Button } from "@/components/ui/Button";
import { useModalDialog } from "@/components/ui/ModalDialogProvider";
import type { FormActionState } from "@/lib/form-actions";

/** Deletes a sample nothing refers to after its code is typed; otherwise says what keeps it (S10). */
export function SampleDeleteButton({ id, code, blockers }: { id: string; code: string; blockers: string[] }) {
  const { t, locale } = useI18n();
  const dialog = useModalDialog();
  const form = useRef<HTMLFormElement>(null);
  const confirmation = useRef<HTMLInputElement>(null);
  const [state, action, pending] = useActionState<FormActionState, FormData>(deleteSample, {});
  const colon = locale === "zh" ? "：" : ": ";
  return (
    <form ref={form} action={action} className="contents">
      <input type="hidden" name="id" value={id} />
      <input ref={confirmation} type="hidden" name="confirmation" />
      <Button type="button" variant="ghost" disabled={pending} className="text-error hover:bg-error-surface hover:text-error" onClick={async () => {
        if (blockers.length) return dialog.alert({ title: t("This sample cannot be deleted"), description: t(`This sample has ${blockers.join(", ")}, so it cannot be deleted. Mark it as discarded instead.`) });
        const typed = await dialog.prompt({ title: t("Delete this sample?"), description: t("This cannot be undone."), inputLabel: `${t("Type the code to confirm")}${colon}${code}`, confirmLabel: t("Delete"), tone: "destructive" });
        if (typed === null || !confirmation.current) return;
        confirmation.current.value = typed;
        form.current?.requestSubmit();
      }}><Trash2 className="h-4 w-4" aria-hidden />Delete</Button>
      {state.error ? <p role="alert" className="basis-full text-sm text-error">{state.error}</p> : null}
    </form>
  );
}
