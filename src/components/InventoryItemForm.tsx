"use client";

import { useActionState } from "react";
import { formInputClass, formLabelClass, formTextareaClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { FormAction, FormActionState } from "@/lib/form-actions";
import { inventoryCategories } from "@/lib/inventory";

const initialState: FormActionState = {};

type LocationOption = { id: string; name: string; temperature?: string | null; status?: "active" | "inactive" | "archived" };
type EntityOption = { id: string; name: string; type: string; code?: string | null };
type InventoryItemInitial = {
  id?: string;
  entityId?: string | null;
  name?: string;
  englishName?: string | null;
  category?: string | null;
  brand?: string | null;
  principalInvestigator?: string | null;
  vendor?: string | null;
  catalogNumber?: string | null;
  casNumber?: string | null;
  lotNumber?: string | null;
  containerType?: string | null;
  barcode?: string | null;
  aliquotCode?: string | null;
  currentQuantity?: number;
  unit?: string;
  lowThreshold?: number | null;
  concentration?: string | null;
  locationId?: string | null;
  positionCode?: string | null;
  expiryDate?: Date | string | null;
  storageCondition?: string | null;
  notes?: string | null;
};

export function InventoryItemForm({
  action,
  locations,
  entities,
  initial = {},
}: {
  action: FormAction;
  locations: LocationOption[];
  entities: EntityOption[];
  initial?: InventoryItemInitial;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const expiryDate = initial.expiryDate
    ? new Date(initial.expiryDate).toISOString().slice(0, 10)
    : "";

  return (
    <form action={formAction} className="space-y-5">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <Card>
        <CardHeader title="Material identity" />
        <CardBody className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="md:col-span-2">
            <span className={formLabelClass}>Item name *</span>
            <input required name="name" defaultValue={initial.name ?? ""} maxLength={180} className={formInputClass} placeholder="Anti-CD3 antibody" />
          </label>
          <label>
            <span className={formLabelClass}>English name</span>
            <input name="englishName" defaultValue={initial.englishName ?? ""} maxLength={180} className={formInputClass} />
          </label>
          <label>
            <span className={formLabelClass}>Category</span>
            <select name="category" defaultValue={initial.category ?? "reagent"} className={formInputClass}>
              {inventoryCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
            </select>
          </label>
          <label>
            <span className={formLabelClass}>Scientific Entity / design</span>
            <select name="entityId" defaultValue={initial.entityId ?? ""} className={formInputClass}>
              <option value="">Not linked</option>
              {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name} · {entity.type}{entity.code ? ` · ${entity.code}` : ""}</option>)}
            </select>
            <span className="mt-1 block text-xs text-muted">Link physical stock to the design object that carries exact Sequence versions.</span>
          </label>
          <label>
            <span className={formLabelClass}>Principal investigator (PI)</span>
            <input name="principalInvestigator" defaultValue={initial.principalInvestigator ?? ""} maxLength={120} className={formInputClass} placeholder="Prof. Zhang / Zhang Lab" />
          </label>
          <label>
            <span className={formLabelClass}>Brand</span>
            <input name="brand" defaultValue={initial.brand ?? ""} maxLength={120} className={formInputClass} placeholder="BioLegend" />
          </label>
          <label>
            <span className={formLabelClass}>Supplier</span>
            <input name="vendor" defaultValue={initial.vendor ?? ""} maxLength={180} className={formInputClass} />
          </label>
          <label>
            <span className={formLabelClass}>Catalog number</span>
            <input name="catalogNumber" defaultValue={initial.catalogNumber ?? ""} maxLength={120} className={formInputClass} />
          </label>
          <label>
            <span className={formLabelClass}>CAS number</span>
            <input name="casNumber" defaultValue={initial.casNumber ?? ""} maxLength={64} className={formInputClass} />
          </label>
          <label>
            <span className={formLabelClass}>Lot number</span>
            <input name="lotNumber" defaultValue={initial.lotNumber ?? ""} maxLength={120} className={formInputClass} />
          </label>
          <label>
            <span className={formLabelClass}>Container type</span>
            <input name="containerType" defaultValue={initial.containerType ?? ""} maxLength={80} className={formInputClass} placeholder="bottle, tube, box…" />
          </label>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Stock and storage" />
        <CardBody className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label>
            <span className={formLabelClass}>{initial.id ? "Current quantity *" : "Opening quantity *"}</span>
            <input required type="number" min="0" step="any" name="currentQuantity" defaultValue={initial.currentQuantity ?? 0} className={formInputClass} />
            {initial.id ? <span className="mt-1 block text-xs text-muted">A changed value is recorded as an adjustment movement.</span> : null}
          </label>
          <label>
            <span className={formLabelClass}>Unit *</span>
            <input required name="unit" defaultValue={initial.unit ?? ""} maxLength={32} className={formInputClass} placeholder="µL, mL, g, vial…" />
          </label>
          <label>
            <span className={formLabelClass}>Safety stock</span>
            <input type="number" min="0" step="any" name="lowThreshold" defaultValue={initial.lowThreshold ?? ""} className={formInputClass} />
          </label>
          <label>
            <span className={formLabelClass}>Location</span>
            <select name="locationId" defaultValue={initial.locationId ?? ""} className={formInputClass}>
              <option value="">Unassigned</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}{location.temperature ? ` · ${location.temperature}` : ""}
                  {location.status === "archived" ? " · archived" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={formLabelClass}>Position</span>
            <input name="positionCode" defaultValue={initial.positionCode ?? ""} maxLength={120} className={formInputClass} placeholder="Shelf 2 / Box A / A01" />
          </label>
          <label>
            <span className={formLabelClass}>Storage condition</span>
            <input name="storageCondition" defaultValue={initial.storageCondition ?? ""} maxLength={240} className={formInputClass} placeholder="4 °C, protect from light" />
          </label>
          <label>
            <span className={formLabelClass}>Expiry date</span>
            <input type="date" name="expiryDate" defaultValue={expiryDate} className={formInputClass} />
          </label>
          <label>
            <span className={formLabelClass}>Concentration</span>
            <input name="concentration" defaultValue={initial.concentration ?? ""} maxLength={120} className={formInputClass} placeholder="1 mg/mL" />
          </label>
          <label>
            <span className={formLabelClass}>Barcode</span>
            <input name="barcode" defaultValue={initial.barcode ?? ""} maxLength={160} className={formInputClass} />
          </label>
          <label>
            <span className={formLabelClass}>Aliquot code</span>
            <input name="aliquotCode" defaultValue={initial.aliquotCode ?? ""} maxLength={160} className={formInputClass} />
          </label>
          <label className="md:col-span-2 xl:col-span-3">
            <span className={formLabelClass}>Notes</span>
            <textarea name="notes" defaultValue={initial.notes ?? ""} maxLength={5000} className={formTextareaClass} />
          </label>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {state.error ? <p role="alert" className="max-w-xl rounded-[8px] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error">{state.error}</p> : null}
        <Button type="submit" variant="primary" size="md" disabled={pending}>
          {pending ? "Saving…" : initial.id ? "Save Item" : "Register Item"}
        </Button>
      </div>
    </form>
  );
}
