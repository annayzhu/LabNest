"use client";

import { newClientMutationId } from "@/lib/client-mutation-id";

import { useActionState, useEffect, useRef, useState } from "react";
import { formInputClass, formLabelClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import type { FormAction } from "@/lib/form-actions";
import { quantityStep } from "@/lib/inventory";
import { enqueueMobileMutation } from "@/lib/mobile-mutation-queue";

type ExperimentOption = { id: string; title: string; project: { name: string } | null };
type PurchaseOption = { id: string; title: string; status: string };

/**
 * Use, receive, return or discard an amount of precisely recorded stock. Offline, the movement waits on the device.
 * Strictly controlled stock needs who handled it and the purpose.
 */
export function InventoryTransactionForm({
  action,
  unit,
  experiments,
  purchases,
  inventoryItemId,
  strict = false,
}: {
  action: FormAction;
  unit: string;
  experiments: ExperimentOption[];
  purchases: PurchaseOption[];
  inventoryItemId: string;
  strict?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [localStatus, setLocalStatus] = useState("");
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) form.current?.reset();
  }, [state]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (navigator.onLine) return;
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      await enqueueMobileMutation({
        clientMutationId: newClientMutationId(),
        actionType: "inventory.transaction",
        deviceCreatedAt: new Date().toISOString(),
        state: "pending",
        retryCount: 0,
        payload: {
          inventoryItemId,
          type: String(formData.get("type")) as "receive" | "consume" | "discard" | "return",
          quantity: Number(formData.get("quantity")),
          performedBy: String(formData.get("performedBy") || "") || undefined,
          experimentId: String(formData.get("experimentId") || "") || undefined,
          purchaseId: String(formData.get("purchaseId") || "") || undefined,
          notes: String(formData.get("notes") || "") || undefined,
        },
      });
      form.current?.reset();
      setLocalStatus("Waiting to sync. Stock has not been changed yet.");
    } catch (error) {
      setLocalStatus(error instanceof Error ? error.message : "Stock change could not be saved on this device.");
    }
  }

  // Whole bottles, mL to 0.001: the browser refuses finer amounts before anything is sent (Q172).
  const step = quantityStep(unit);

  return (
    <form ref={form} action={formAction} onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-3">
      <label>
        <span className={formLabelClass}>Movement</span>
        <select required name="type" defaultValue="consume" className={formInputClass}>
          <option value="consume">Use / consume</option>
          <option value="receive">Receive into stock</option>
          <option value="return">Return to stock</option>
          <option value="discard">Discard</option>
        </select>
      </label>
      <label>
        <span className={formLabelClass}>Amount</span>
        <span className="relative block">
          <input required type="number" min={step} step={step} name="quantity" className={`${formInputClass} pr-12`} />
          <span className="pointer-events-none absolute bottom-0 right-3 flex h-[var(--ln-control-height-lg)] items-center text-xs text-muted">{unit}</span>
        </span>
      </label>
      <label>
        <span className={formLabelClass}>{strict ? "Handled by *" : "Handled by"}</span>
        <input name="performedBy" required={strict} maxLength={120} className={formInputClass} />
      </label>
      <label className="sm:col-span-3">
        <span className={formLabelClass}>{strict ? "Purpose *" : "Note"}</span>
        <input name="notes" required={strict} maxLength={2000} className={formInputClass} placeholder="Purpose, acceptance note, or disposal reason" />
      </label>
      <label>
        <span className={formLabelClass}>Experiment</span>
        <select name="experimentId" defaultValue="" className={formInputClass}>
          <option value="">None</option>
          {experiments.map((experiment) => (
            <option key={experiment.id} value={experiment.id}>
              {experiment.project?.name ? `${experiment.project.name} · ` : ""}{experiment.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className={formLabelClass}>Purchase</span>
        <select name="purchaseId" defaultValue="" className={formInputClass}>
          <option value="">None</option>
          {purchases.map((purchase) => (
            <option key={purchase.id} value={purchase.id}>{purchase.title} · {purchase.status}</option>
          ))}
        </select>
      </label>
      <div className="flex items-end justify-end">
        <Button type="submit" variant="primary" size="lg" disabled={pending} aria-busy={pending}>{pending ? "Recording…" : "Record movement"}</Button>
      </div>
      {state.error ? <p role="alert" className="rounded-[var(--ln-radius-control-lg)] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error sm:col-span-3">{state.error}</p> : null}
      {state.success ? <p role="status" className="text-sm text-success sm:col-span-3">{state.success}</p> : null}
      {localStatus ? <p role="status" className="rounded-[var(--ln-radius-control-lg)] border border-warning/30 bg-warning-surface px-3 py-2 text-sm text-graphite sm:col-span-3">{localStatus}</p> : null}
    </form>
  );
}
