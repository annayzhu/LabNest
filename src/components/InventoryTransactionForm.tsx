import { formInputClass, formLabelClass, formTextareaClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";

type ExperimentOption = { id: string; title: string; project: { name: string } | null };
type PurchaseOption = { id: string; title: string; status: string };

export function InventoryTransactionForm({
  action,
  unit,
  experiments,
  purchases,
}: {
  action: (formData: FormData) => void | Promise<void>;
  unit: string;
  experiments: ExperimentOption[];
  purchases: PurchaseOption[];
}) {
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
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
    </form>
  );
}
