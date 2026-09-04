"use client";

import { useState } from "react";
import { formInputClass, formLabelClass, formTextareaClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { enqueueMobileMutation } from "@/lib/mobile-mutation-queue";

type ExperimentOption = { id: string; title: string; project: { name: string } | null };
type PurchaseOption = { id: string; title: string; status: string };

export function InventoryTransactionForm({
  action,
  unit,
  experiments,
  purchases,
  inventoryItemId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  unit: string;
  experiments: ExperimentOption[];
  purchases: PurchaseOption[];
  inventoryItemId: string;
}) {
  const [localStatus, setLocalStatus] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (navigator.onLine) return;
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const clientMutationId = crypto.randomUUID();
    await enqueueMobileMutation({
      clientMutationId,
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
    form.reset();
    setLocalStatus("Waiting to sync. Stock has not been changed yet.");
  }
  return (
    <form action={action} onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
      <label>
        <span className={formLabelClass}>Movement *</span>
        <select required name="type" defaultValue="consume" className={formInputClass}>
          <option value="consume">Use / consume</option>
          <option value="receive">Receive into stock</option>
          <option value="return">Return to stock</option>
          <option value="discard">Discard</option>
        </select>
      </label>
      <label>
        <span className={formLabelClass}>Amount ({unit}) *</span>
        <input required type="number" min="0.000001" step="any" name="quantity" className={formInputClass} />
      </label>
      <label>
        <span className={formLabelClass}>Used by / handled by</span>
        <input name="performedBy" maxLength={120} className={formInputClass} />
      </label>
      <label>
        <span className={formLabelClass}>Experiment link</span>
        <select name="experimentId" defaultValue="" className={formInputClass}>
          <option value="">No experiment link</option>
          {experiments.map((experiment) => (
            <option key={experiment.id} value={experiment.id}>
              {experiment.project?.name ? `${experiment.project.name} · ` : ""}{experiment.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className={formLabelClass}>Purchase link</span>
        <select name="purchaseId" defaultValue="" className={formInputClass}>
          <option value="">No purchase link</option>
          {purchases.map((purchase) => (
            <option key={purchase.id} value={purchase.id}>{purchase.title} · {purchase.status}</option>
          ))}
        </select>
      </label>
      <label className="md:col-span-2">
        <span className={formLabelClass}>Movement note</span>
        <textarea name="notes" maxLength={2000} className={formTextareaClass} placeholder="Purpose, acceptance note, deviation, or disposal reason…" />
      </label>
      <div className="flex justify-end md:col-span-2">
        <Button type="submit" variant="primary" size="lg">Record Movement</Button>
      </div>
      {localStatus ? <p role="status" className="rounded-[var(--ln-radius-control-lg)] border border-warning/30 bg-warning-surface px-3 py-2 text-sm text-graphite md:col-span-2">{localStatus}</p> : null}
    </form>
  );
}
