"use client";

import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { deleteKitComponent, saveKitComponent } from "@/app/inventory/products/actions";
import { formInlineInputClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import type { FormActionState } from "@/lib/form-actions";

type Component = { id: string; name: string; spec: string | null; storageCondition: string | null };
const iconButton = "focus-ring inline-flex h-8 w-8 items-center justify-center rounded-[var(--ln-radius-control-sm)] text-muted hover:bg-stone hover:text-ink";

/** What every box of this kit should contain; each box then marks a component used up or missing. */
export function InventoryKitComponents({ productId, components }: { productId: string; components: Component[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const addForm = useRef<HTMLFormElement>(null);
  const [saveState, save, saving] = useActionState(async (previous: FormActionState, formData: FormData) => {
    const result = await saveKitComponent(previous, formData);
    if (result.success) {
      setEditing(null);
      if (!formData.get("id")) addForm.current?.reset();
    }
    return result;
  }, {});
  const [deleteState, remove, removing] = useActionState(deleteKitComponent, {} as FormActionState);

  const row = (component?: Component) => (
    <form key={component?.id ?? "new"} ref={component ? undefined : addForm} action={save} className="grid gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
      <input type="hidden" name="productId" value={productId} />
      {component ? <input type="hidden" name="id" value={component.id} /> : null}
      <input name="name" required maxLength={160} defaultValue={component?.name ?? ""} placeholder="Component" aria-label="Component" className={formInlineInputClass} />
      <input name="spec" maxLength={120} defaultValue={component?.spec ?? ""} placeholder="1 mL × 2" aria-label="Pack size" className={formInlineInputClass} />
      <input name="storageCondition" maxLength={120} defaultValue={component?.storageCondition ?? ""} placeholder="-20 °C" aria-label="Storage condition" className={formInlineInputClass} />
      <span className="flex justify-end gap-1">
        {component ? <>
          <button type="submit" disabled={saving} aria-label="Save component" title="Save component" className={iconButton}><Check className="h-4 w-4" aria-hidden /></button>
          <button type="button" onClick={() => setEditing(null)} aria-label="Cancel" title="Cancel" className={iconButton}><X className="h-4 w-4" aria-hidden /></button>
        </> : <Button type="submit" size="sm" disabled={saving}><Plus className="h-3.5 w-3.5" aria-hidden />Add</Button>}
      </span>
    </form>
  );

  return (
    <div className="space-y-2">
      <ul className="divide-y divide-hairline rounded-[var(--ln-radius-panel-inner)] border border-hairline">
        {components.map((component) => editing === component.id ? <li key={component.id} className="bg-warm">{row(component)}</li> : (
          <li key={component.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <span className="font-medium text-ink">{component.name}</span>
            <span className="hidden text-graphite sm:block">{component.spec ?? "—"}</span>
            <span className="hidden text-graphite sm:block">{component.storageCondition ?? "—"}</span>
            <span className="flex justify-end gap-1">
              <button type="button" onClick={() => setEditing(component.id)} aria-label="Edit component" title="Edit component" className={iconButton}><Pencil className="h-4 w-4" aria-hidden /></button>
              <form action={remove}>
                <input type="hidden" name="productId" value={productId} />
                <input type="hidden" name="id" value={component.id} />
                <button type="submit" disabled={removing} aria-label="Remove component" title="Remove component" className={`${iconButton} hover:bg-error-surface hover:text-error`}><Trash2 className="h-4 w-4" aria-hidden /></button>
              </form>
            </span>
          </li>
        ))}
        <li>{row()}</li>
      </ul>
      {saveState.error || deleteState.error ? <p role="alert" className="text-sm text-error">{saveState.error ?? deleteState.error}</p> : null}
    </div>
  );
}
