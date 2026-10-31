"use client";

import { Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { reverseInventoryTransaction } from "@/app/inventory/actions";
import { useI18n } from "@/components/I18nProvider";
import { useModalDialog } from "@/components/ui/ModalDialogProvider";

/** Undo a mistaken movement by booking the opposite quantity; the reason is optional and goes on the reversal. */
export function ReverseMovementButton({ id }: { id: string }) {
  const { t } = useI18n();
  const dialog = useModalDialog();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function reverse() {
    const reason = await dialog.prompt({ title: t("Reverse this movement?"), description: t("The movement stays as recorded; a reversal with the opposite amount is added and the balance goes back."), inputLabel: t("Reason (optional)"), confirmLabel: t("Reverse") });
    if (reason === null) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("reason", reason.trim());
      const result = await reverseInventoryTransaction({}, formData);
      if (result.error) await dialog.alert({ title: t("Not reversed"), description: t(result.error) });
      else router.refresh();
    });
  }

  return <button type="button" onClick={reverse} disabled={pending} aria-label="Reverse movement" title="Reverse movement" className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-[var(--ln-radius-control-sm)] text-muted hover:bg-stone hover:text-ink disabled:opacity-50"><Undo2 className="h-4 w-4" aria-hidden /></button>;
}
