"use client";

import { useActionState, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  FlaskConical,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Snowflake,
  Trash2,
} from "lucide-react";
import { formInputClass, formLabelClass, formTextareaClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import type { FormAction } from "@/lib/form-actions";
import type { InventoryBenchActionType } from "@/lib/inventory";
import { cn } from "@/lib/cn";

type ExperimentOption = { id: string; title: string; project: { name: string } | null };
type PurchaseOption = { id: string; title: string; status: string };
type LocationOption = { id: string; name: string; temperature: string | null; status: "active" | "inactive" | "archived" };

const actions = [
  { type: "consume", label: "Use", detail: "Consume for work", icon: ArrowUpFromLine },
  { type: "receive", label: "Receive", detail: "Add stock", icon: ArrowDownToLine },
  { type: "return", label: "Return", detail: "Put stock back", icon: RotateCcw },
  { type: "transfer", label: "Move", detail: "Change location", icon: MapPin },
  { type: "aliquot", label: "Aliquot", detail: "Create child stock", icon: Boxes },
  { type: "thaw", label: "Thaw", detail: "Record handling", icon: Snowflake },
  { type: "refreeze", label: "Refreeze", detail: "Record return", icon: RotateCcw },
  { type: "qc", label: "QC", detail: "Record assessment", icon: ShieldCheck },
  { type: "discard", label: "Discard", detail: "Remove with reason", icon: Trash2 },
] satisfies Array<{ type: InventoryBenchActionType; label: string; detail: string; icon: typeof FlaskConical }>;

const quantityActions: InventoryBenchActionType[] = ["consume", "receive", "return", "aliquot", "discard"];
const outboundActions: InventoryBenchActionType[] = ["consume", "aliquot", "discard"];

export function InventoryBenchActionForm({
  action,
  item,
  locations,
  experiments,
  purchases,
}: {
  action: FormAction;
  item: {
    currentQuantity: number;
    unit: string;
    locationId: string | null;
    positionCode: string | null;
    freezeThawCount: number;
  };
  locations: LocationOption[];
  experiments: ExperimentOption[];
  purchases: PurchaseOption[];
}) {
  const [actionType, setActionType] = useState<InventoryBenchActionType>("consume");
  const [state, formAction, pending] = useActionState(action, {});
  const needsQuantity = quantityActions.includes(actionType);
  const quantityOptional = actionType === "thaw";
  const quantityMax = outboundActions.includes(actionType) || actionType === "thaw" ? item.currentQuantity : undefined;
  const showsDestination = actionType === "transfer" || actionType === "aliquot";
  const currentLocationIsActive = locations.some((location) => location.id === item.locationId && location.status === "active");

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="type" value={actionType} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {actions.map((itemAction) => {
          const Icon = itemAction.icon;
          const selected = itemAction.type === actionType;
          return (
            <button
              key={itemAction.type}
              type="button"
              aria-pressed={selected}
              onClick={() => setActionType(itemAction.type)}
              className={cn(
                "focus-ring flex min-h-20 flex-col items-start rounded-[9px] border px-3 py-2.5 text-left transition",
                selected ? "border-moss bg-sage-surface text-moss" : "border-hairline bg-warm/55 text-graphite hover:border-sage hover:bg-sage-surface/35",
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4" aria-hidden />{itemAction.label}</span>
              <span className="mt-1 text-[11px] leading-4 text-muted">{itemAction.detail}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {needsQuantity || quantityOptional ? (
          <label>
            <span className={formLabelClass}>{quantityOptional ? "Amount removed (optional)" : `Amount (${item.unit}) *`}</span>
            <input
              key={`${actionType}-quantity`}
              required={needsQuantity}
              type="number"
              min="0.000001"
              max={quantityMax}
              step="any"
              name="quantity"
              className={formInputClass}
              placeholder={quantityOptional ? `0 ${item.unit} keeps stock unchanged` : undefined}
            />
            {quantityOptional ? <span className="mt-1 block text-xs text-muted">Thaw always increments the handling count; enter an amount only when material leaves stock.</span> : null}
          </label>
        ) : null}

        {showsDestination ? (
          <>
            <label>
              <span className={formLabelClass}>{actionType === "transfer" ? "Destination" : "Child location"}</span>
              <select
                key={`${actionType}-location`}
                name="targetLocationId"
                defaultValue={currentLocationIsActive ? item.locationId! : "__unassigned__"}
                className={formInputClass}
              >
                <option value="__unassigned__">Unassigned</option>
                {locations.map((location) => <option key={location.id} value={location.id} disabled={location.status !== "active"}>{location.name}{location.temperature ? ` · ${location.temperature}` : ""}{location.status !== "active" ? ` · ${location.status}` : ""}</option>)}
              </select>
            </label>
            <label>
              <span className={formLabelClass}>{actionType === "transfer" ? "Destination position" : "Child position"}</span>
              <input
                key={`${actionType}-position`}
                name="targetPositionCode"
                defaultValue={actionType === "transfer" ? item.positionCode ?? "" : ""}
                maxLength={120}
                className={formInputClass}
                placeholder="Rack 2 / Box B / A01"
              />
            </label>
          </>
        ) : null}

        {actionType === "aliquot" ? (
          <>
            <label>
              <span className={formLabelClass}>Child container name *</span>
              <input required name="childName" maxLength={180} className={formInputClass} placeholder="Anti-CD3 aliquot 01" />
            </label>
            <label>
              <span className={formLabelClass}>Child aliquot code *</span>
              <input required name="childAliquotCode" maxLength={160} className={formInputClass} placeholder="CD3-LOT01-A01" />
            </label>
          </>
        ) : null}

        {actionType === "qc" ? (
          <>
            <label>
              <span className={formLabelClass}>QC result *</span>
              <select required name="qcResult" defaultValue="" className={formInputClass}>
                <option value="" disabled>Select result</option>
                <option value="pass">Pass</option>
                <option value="fail">Fail</option>
                <option value="inconclusive">Inconclusive</option>
              </select>
            </label>
            <label>
              <span className={formLabelClass}>QC method</span>
              <input name="qcMethod" maxLength={180} className={formInputClass} placeholder="Mycoplasma PCR, concentration check…" />
            </label>
          </>
        ) : null}

        <label>
          <span className={formLabelClass}>Used by / handled by</span>
          <input name="performedBy" maxLength={120} className={formInputClass} />
        </label>
        <label>
          <span className={formLabelClass}>Experiment link</span>
          <select name="experimentId" defaultValue="" className={formInputClass}>
            <option value="">No experiment link</option>
            {experiments.map((experiment) => (
              <option key={experiment.id} value={experiment.id}>{experiment.project?.name ? `${experiment.project.name} · ` : ""}{experiment.title}</option>
            ))}
          </select>
        </label>

        {actionType === "receive" || actionType === "return" ? (
          <label>
            <span className={formLabelClass}>Purchase link</span>
            <select name="purchaseId" defaultValue="" className={formInputClass}>
              <option value="">No purchase link</option>
              {purchases.map((purchase) => <option key={purchase.id} value={purchase.id}>{purchase.title} · {purchase.status}</option>)}
            </select>
          </label>
        ) : null}

        <label className="md:col-span-2">
          <span className={formLabelClass}>{actionType === "discard" ? "Disposal reason / note" : "Action note"}</span>
          <textarea
            required={actionType === "discard"}
            name="notes"
            maxLength={2000}
            className={formTextareaClass}
            placeholder="Purpose, acceptance note, deviation, QC evidence, or disposal reason…"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
        <p className="text-xs leading-5 text-muted">
          Current stock: <strong className="font-mono text-ink">{item.currentQuantity} {item.unit}</strong>
          {actionType === "thaw" ? ` · freeze-thaw count ${item.freezeThawCount}` : ""}
        </p>
        <div className="flex items-center gap-3">
          {state.error ? <p role="alert" className="max-w-md text-sm text-error">{state.error}</p> : null}
          {state.message ? <p role="status" className="max-w-md text-sm text-success">{state.message}</p> : null}
          <Button type="submit" variant="primary" size="lg" disabled={pending}>{pending ? "Recording…" : `Record ${actions.find((entry) => entry.type === actionType)?.label}`}</Button>
        </div>
      </div>
    </form>
  );
}
