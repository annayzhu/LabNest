"use client";

import { QuantityInput } from "./QuantityInput";
import { useActionState, useMemo, useState } from "react";
import { formInputClass, formLabelClass, formTextareaClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { Disclosure } from "@/components/ui/Disclosure";
import type { FormAction, FormActionState } from "@/lib/form-actions";
import { stockUnits } from "@/lib/inventory";
import type { InventoryTypeDefaults } from "@/lib/inventory-types";

const initialState: FormActionState = {};
const NEW_PRODUCT = "__new";

type LocationOption = { id: string; name: string; temperature?: string | null; status?: "active" | "inactive" | "archived" };
export type ProductOption = { id: string; name: string; brand: string | null; catalogNumber: string | null; typeId: string | null; groupKey: string | null; strict: boolean; status: string };
export type TypeOption = { id: string; label: string; groupKey: string; groupName: string; defaults: InventoryTypeDefaults; enabled: boolean };
export type GroupOption = { key: string; name: string; hidden: boolean };
type InventoryItemInitial = {
  id?: string;
  productId?: string | null;
  principalInvestigator?: string | null;
  vendor?: string | null;
  lotNumber?: string | null;
  containerType?: string | null;
  barcode?: string | null;
  aliquotCode?: string | null;
  currentQuantity?: number;
  quantityRecorded?: boolean;
  managementMode?: string;
  unit?: string;
  concentration?: string | null;
  locationId?: string | null;
  positionCode?: string | null;
  expiryDate?: Date | string | null;
  storageCondition?: string | null;
  notes?: string | null;
  /** Shown as the new product when stock saved before products has none yet. */
  name?: string;
  brand?: string | null;
  catalogNumber?: string | null;
};

const modeOptions = [
  { value: "information", label: "Record only · amount optional" },
  { value: "package", label: "By container · bottles, boxes, cylinders" },
  { value: "precise", label: "Precise use" },
];

/** Stock is a lot of a product: choose the product (or type a new one), then how much and where; the rest is folded away. */
export function InventoryItemForm({ action, locations, products, types, groups, initial = {} }: {
  action: FormAction;
  locations: LocationOption[];
  products: ProductOption[];
  types: TypeOption[];
  groups: GroupOption[];
  initial?: InventoryItemInitial;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [productId, setProductId] = useState(initial.productId ?? (initial.id ? NEW_PRODUCT : ""));
  const [newTypeId, setNewTypeId] = useState("");
  const product = products.find((entry) => entry.id === productId);
  const type = types.find((entry) => entry.id === (product ? product.typeId : newTypeId));
  const defaults = type?.defaults;
  const [managementMode, setManagementMode] = useState(initial.managementMode ?? defaults?.managementMode ?? "information");
  const strict = product?.strict ?? false;
  const mode = strict ? "precise" : managementMode;
  const tracksLot = !defaults || defaults.tracksLot || !!initial.lotNumber;
  const tracksExpiry = !defaults || defaults.tracksExpiry || !!initial.expiryDate;
  const expiryDate = initial.expiryDate ? new Date(initial.expiryDate).toISOString().slice(0, 10) : "";
  const choosable = useMemo(() => {
    const byGroup = new Map<string, ProductOption[]>();
    for (const entry of products) {
      if (entry.status === "archived" && entry.id !== initial.productId) continue;
      const label = types.find((candidate) => candidate.id === entry.typeId)?.groupName ?? groups.find((group) => group.key === entry.groupKey)?.name ?? "To be classified";
      byGroup.set(label, [...(byGroup.get(label) ?? []), entry]);
    }
    return [...byGroup];
  }, [products, types, groups, initial.productId]);

  // A new lot takes its type's way of keeping stock; an existing lot keeps what it has.
  function adoptDefaults(typeId: string | null | undefined) {
    const next = types.find((entry) => entry.id === typeId)?.defaults;
    if (!initial.id && next) setManagementMode(next.managementMode);
  }

  return (
    <form action={formAction} className="overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="productId" value={productId === NEW_PRODUCT ? "" : productId} />

      <section className="grid gap-4 border-b border-hairline p-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="md:col-span-2 xl:col-span-1">
          <span className={formLabelClass}>Product *</span>
          <select required aria-label="Product" value={productId} onChange={(event) => { setProductId(event.target.value); adoptDefaults(products.find((entry) => entry.id === event.target.value)?.typeId); }} className={formInputClass}>
            <option value="" disabled>Choose a product…</option>
            <option value={NEW_PRODUCT}>New product…</option>
            {choosable.map(([group, entries]) => (
              <optgroup key={group} label={group}>
                {entries.map((entry) => <option key={entry.id} value={entry.id}>{[entry.name, entry.brand, entry.catalogNumber].filter(Boolean).join(" · ")}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        {productId === NEW_PRODUCT ? <>
          <label>
            <span className={formLabelClass}>Product name *</span>
            <input required name="productName" defaultValue={initial.name ?? ""} maxLength={180} className={formInputClass} placeholder="Anti-CD3 antibody" />
          </label>
          <label>
            <span className={formLabelClass}>Type</span>
            <select name="productTypeId" value={newTypeId} onChange={(event) => { setNewTypeId(event.target.value); adoptDefaults(event.target.value); }} className={formInputClass}>
              <option value="">Not subdivided</option>
              {groups.filter((group) => !group.hidden).map((group) => {
                const groupTypes = types.filter((entry) => entry.groupKey === group.key && entry.enabled);
                return groupTypes.length ? <optgroup key={group.key} label={group.name}>{groupTypes.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</optgroup> : null;
              })}
            </select>
          </label>
          {!newTypeId ? (
            <label>
              <span className={formLabelClass}>Inventory group</span>
              <select name="productGroupKey" defaultValue="" className={formInputClass}>
                <option value="">To be classified</option>
                {groups.filter((group) => !group.hidden).map((group) => <option key={group.key} value={group.key}>{group.name}</option>)}
              </select>
            </label>
          ) : null}
          <label>
            <span className={formLabelClass}>Brand</span>
            <input name="productBrand" defaultValue={initial.brand ?? ""} maxLength={120} className={formInputClass} placeholder="BioLegend" />
          </label>
          <label>
            <span className={formLabelClass}>Catalog number</span>
            <input name="productCatalogNumber" defaultValue={initial.catalogNumber ?? ""} maxLength={120} className={formInputClass} />
          </label>
        </> : null}
      </section>

      {initial.quantityRecorded === false ? (
        <fieldset className="grid gap-4 border-b border-hairline p-4 sm:grid-cols-3">
          <legend className="sr-only">Opening count</legend>
          <p className="text-sm text-graphite sm:col-span-3">Entering an amount for the first time records an opening count.</p>
          <label><span className={formLabelClass}>Counted on</span><input name="countedAt" type="date" required={mode !== "information"} className={formInputClass} /></label>
          <label><span className={formLabelClass}>Counted by</span><input name="countedBy" required={mode !== "information"} className={formInputClass} /></label>
          <label><span className={formLabelClass}>Count source</span><input name="countSource" required={mode !== "information"} placeholder="Physical count sheet" className={formInputClass} /></label>
        </fieldset>
      ) : null}

      <section className="grid gap-4 border-b border-hairline p-4 md:grid-cols-2 xl:grid-cols-3">
        <label>
          <span className={formLabelClass}>Management</span>
          <select aria-label="Management" name="managementMode" value={mode} disabled={strict} onChange={(event) => setManagementMode(event.target.value)} className={formInputClass}>
            {modeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          {strict ? <><input type="hidden" name="managementMode" value="precise" /><span className="mt-1 block text-xs text-muted">Highly toxic and drug-precursor stock is recorded with precise use.</span></> : null}
        </label>
        <QuantityInput
          key={`${type?.id ?? "none"}-${mode}`}
          label={initial.id ? "Current quantity" : mode === "package" ? "Containers in store" : "Opening quantity"}
          name="currentQuantity"
          required={mode !== "information"}
          initialValue={initial.quantityRecorded === false ? "" : String(initial.currentQuantity ?? "")}
          initialUnit={initial.unit || defaults?.unit || "mL"}
          storageUnit={initial.id && initial.quantityRecorded !== false ? initial.unit : undefined}
          options={stockUnits}
        />
        <label>
          <span className={formLabelClass}>Location</span>
          <select name="locationId" defaultValue={initial.locationId ?? ""} className={formInputClass}>
            <option value="">Unassigned</option>
            {locations.map((location) => <option key={location.id} value={location.id}>{location.name}{location.temperature ? ` · ${location.temperature}` : ""}{location.status === "archived" ? " · archived" : ""}</option>)}
          </select>
        </label>
        <label>
          <span className={formLabelClass}>Position</span>
          <input name="positionCode" defaultValue={initial.positionCode ?? ""} maxLength={120} className={formInputClass} placeholder="Shelf 2 / Box A / A01" />
        </label>
        {tracksLot ? (
          <label>
            <span className={formLabelClass}>Lot number</span>
            <input name="lotNumber" defaultValue={initial.lotNumber ?? ""} maxLength={120} className={formInputClass} />
          </label>
        ) : null}
        {tracksExpiry ? (
          <label>
            <span className={formLabelClass}>Expiry date</span>
            <input type="date" name="expiryDate" defaultValue={expiryDate} className={formInputClass} />
          </label>
        ) : null}
      </section>

      <Disclosure title="More about this stock" summary={[initial.vendor, initial.principalInvestigator, initial.storageCondition].filter(Boolean).join(" · ")} defaultOpen={!!(initial.vendor || initial.principalInvestigator || initial.notes)}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label><span className={formLabelClass}>Supplier</span><input name="vendor" defaultValue={initial.vendor ?? ""} maxLength={180} className={formInputClass} /></label>
          <label><span className={formLabelClass}>Principal investigator (PI)</span><input name="principalInvestigator" defaultValue={initial.principalInvestigator ?? ""} maxLength={120} className={formInputClass} placeholder="Prof. Zhang / Zhang Lab" /></label>
          <label><span className={formLabelClass}>Storage condition</span><input name="storageCondition" defaultValue={initial.storageCondition ?? ""} maxLength={240} className={formInputClass} placeholder="4 °C, protect from light" /></label>
          <label><span className={formLabelClass}>Container type</span><input name="containerType" defaultValue={initial.containerType ?? ""} maxLength={80} className={formInputClass} placeholder="bottle, tube, box…" /></label>
          <label><span className={formLabelClass}>Concentration</span><input name="concentration" defaultValue={initial.concentration ?? ""} maxLength={120} className={formInputClass} placeholder="1 mg/mL" /></label>
          <label><span className={formLabelClass}>Barcode</span><input name="barcode" defaultValue={initial.barcode ?? ""} maxLength={160} className={formInputClass} /></label>
          <label><span className={formLabelClass}>Aliquot code</span><input name="aliquotCode" defaultValue={initial.aliquotCode ?? ""} maxLength={160} className={formInputClass} /></label>
          {!tracksLot ? <label><span className={formLabelClass}>Lot number</span><input name="lotNumber" defaultValue="" maxLength={120} className={formInputClass} /></label> : null}
          {!tracksExpiry ? <label><span className={formLabelClass}>Expiry date</span><input type="date" name="expiryDate" defaultValue="" className={formInputClass} /></label> : null}
          <label className="md:col-span-2 xl:col-span-3"><span className={formLabelClass}>Notes</span><textarea name="notes" defaultValue={initial.notes ?? ""} maxLength={5000} className={formTextareaClass} /></label>
        </div>
      </Disclosure>

      <div className="flex flex-wrap items-center justify-end gap-3 p-4">
        {state.error ? <p role="alert" className="max-w-xl rounded-[var(--ln-radius-control-lg)] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error">{state.error}</p> : null}
        <Button type="submit" variant="primary" size="md" disabled={pending} aria-busy={pending}>
          {pending ? "Saving…" : initial.id ? "Save" : "Register stock"}
        </Button>
      </div>
    </form>
  );
}
