"use client";

import { Archive, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useI18n } from "@/components/I18nProvider";
import { useModalDialog } from "@/components/ui/ModalDialogProvider";
import type { FormAction } from "@/lib/form-actions";

/**
 * Archive / restore and delete for a stock item or product, as rows of the page's ⋯ menu. Deleting needs the
 * name typed; when something still refers to the record, the menu says what and offers archiving instead.
 */
export function InventoryLifecycleMenu({ id, name, archived, blockers, archiveAction, deleteAction }: {
  id: string;
  name: string;
  archived: boolean;
  /** What still refers to the record ("2 stock movements"); empty when it can be deleted. */
  blockers: string[];
  archiveAction: FormAction;
  deleteAction: FormAction;
}) {
  const { t, locale } = useI18n();
  const [colon, comma, stop] = locale === "zh" ? ["：", "、", "。"] : [": ", ", ", ". "];
  const referring = `${t("Still referring to it")}${colon}${blockers.map(t).join(comma)}${stop}`;
  const dialog = useModalDialog();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (action: FormAction, fields: Record<string, string>) => startTransition(async () => {
    const formData = new FormData();
    Object.entries(fields).forEach(([key, value]) => formData.set(key, value));
    const result = await action({}, formData);
    if (result?.error) await dialog.alert({ title: t("Not changed"), description: t(result.error) });
    else router.refresh();
  });

  async function remove() {
    if (blockers.length) {
      const archiveInstead = !archived && await dialog.confirm({
        title: t("This record cannot be deleted"),
        description: `${referring}${t("Archive it instead; its history is kept and it can be restored.")}`,
        confirmLabel: t("Archive"),
      });
      if (archiveInstead) run(archiveAction, { id, archived: "true" });
      if (archived) await dialog.alert({ title: t("This record cannot be deleted"), description: referring.trim() });
      return;
    }
    const typed = await dialog.prompt({ title: t("Delete permanently?"), description: t("This cannot be undone."), inputLabel: `${t("Type the name to confirm")}${colon}${name}`, confirmLabel: t("Delete"), tone: "destructive" });
    if (typed !== null) run(deleteAction, { id, confirmation: typed.trim() });
  }

  return <>
    <button type="button" disabled={pending} onClick={() => run(archiveAction, { id, archived: archived ? "false" : "true" })}>
      {archived ? <RotateCcw className="h-4 w-4" aria-hidden /> : <Archive className="h-4 w-4" aria-hidden />}{archived ? "Restore" : "Archive"}
    </button>
    <button type="button" className="ln-menu-danger" disabled={pending} onClick={remove}><Trash2 className="h-4 w-4" aria-hidden />Delete…</button>
  </>;
}
