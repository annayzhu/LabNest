"use client";

import { startTransition, useActionState } from "react";
import { mergeInventoryProducts } from "@/app/inventory/products/actions";
import { useI18n } from "@/components/I18nProvider";
import { QuantityText } from "@/components/InventoryDetail";
import { formLabelClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { useModalDialog } from "@/components/ui/ModalDialogProvider";
import type { FormActionState } from "@/lib/form-actions";

/** Confirms merging `otherId` into `keepId`; when both set a different safety stock, someone picks the one that stays. */
type Stock = { quantity: number; unit: string | null };

export function ProductMergeForm({ keepId, otherId, safetyStocks }: { keepId: string; otherId: string; safetyStocks: { keep: Stock; other: Stock } | null }) {
  const { t } = useI18n();
  const dialog = useModalDialog();
  const [state, action, pending] = useActionState(mergeInventoryProducts, {} as FormActionState);

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const confirmed = await dialog.confirm({ title: t("Merge these products?"), description: t("The other product is removed once its lots, documents and kit components have moved over. This cannot be undone."), confirmLabel: t("Merge") });
        if (confirmed) startTransition(() => action(data));
      }}
      className="space-y-3 rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-4"
    >
      <input type="hidden" name="keepId" value={keepId} />
      <input type="hidden" name="otherId" value={otherId} />
      {safetyStocks ? (
        <fieldset className="space-y-1.5">
          <legend className={formLabelClass}>Both set a safety stock. Keep</legend>
          {(["keep", "other"] as const).map((side) => (
            <label key={side} className="flex items-center gap-2 text-sm text-graphite">
              <input type="radio" name="safetyStock" value={side} defaultChecked={side === "keep"} className="h-4 w-4 accent-[var(--action)]" />
              <QuantityText quantity={safetyStocks[side].quantity} unit={safetyStocks[side].unit} />
              <span className="text-muted">· {side === "keep" ? "kept product" : "merged product"}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      <p className="text-sm text-graphite">Lots, documents, kit components and control levels move to the kept product. Its own values stay; empty ones are filled from the other product, which is then removed.</p>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {state.error ? <p role="alert" className="mr-auto text-sm text-error">{state.error}</p> : null}
        <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}>{pending ? "Merging…" : "Merge"}</Button>
      </div>
    </form>
  );
}
