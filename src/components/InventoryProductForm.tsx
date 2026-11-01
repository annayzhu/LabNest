"use client";

import { useActionState, useState } from "react";
import { QuantityInput } from "./QuantityInput";
import { formInputClass, formLabelClass, formTextareaClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { Disclosure } from "@/components/ui/Disclosure";
import type { FormAction, FormActionState } from "@/lib/form-actions";
import { inventoryBiosafetyLevels, inventoryControlLevels, stockUnits } from "@/lib/inventory";
import type { InventoryTypeField } from "@/lib/inventory-types";
import { sequenceKind } from "@/lib/product-sequences";
import type { GroupOption, TypeOption } from "./InventoryItemForm";

export type ProductInitial = {
  id?: string;
  name?: string;
  englishName?: string | null;
  brand?: string | null;
  catalogNumber?: string | null;
  casNumber?: string | null;
  typeId?: string | null;
  groupKey?: string | null;
  entityId?: string | null;
  fieldValues?: Record<string, string>;
  /** The product's strands by role (forward, reverse, sense, antisense, primary). */
  sequences?: Record<string, string>;
  controlLevels?: string[];
  lowThreshold?: number | null;
  lowThresholdUnit?: string | null;
  notes?: string | null;
};
export type EntityOption = { id: string; name: string; type: string; code: string | null };
export type ProductTypeOption = TypeOption & { key: string; fields: InventoryTypeField[] };
export type ProductFieldsProps = { types: ProductTypeOption[]; groups: GroupOption[]; entities: EntityOption[]; initial?: ProductInitial };

/** A product: what it is (type and 大类), its catalogue identity, its type's fields, control levels and safety stock. */
export function InventoryProductForm({ action, ...fields }: ProductFieldsProps & { action: FormAction }) {
  const [state, formAction, pending] = useActionState(action, {} as FormActionState);
  return (
    <form action={formAction} className="overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface">
      <ProductFields {...fields} />
      <div className="flex flex-wrap items-center justify-end gap-3 p-4">
        {state.error ? <p role="alert" className="max-w-xl rounded-[var(--ln-radius-control-lg)] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error">{state.error}</p> : null}
        <Button type="submit" variant="primary" size="md" disabled={pending} aria-busy={pending}>{pending ? "Saving…" : fields.initial?.id ? "Save" : "Create product"}</Button>
      </div>
    </form>
  );
}

/**
 * The product's fields without a form of their own. The lot edit page puts them above the lot's fields with the
 * prefix `product.`, so a lot and its product are edited in one place (Q192).
 */
export function ProductFields({ types, groups, entities, initial = {}, prefix = "" }: ProductFieldsProps & { prefix?: string }) {
  const [typeId, setTypeId] = useState(initial.typeId ?? "");
  const [groupKey, setGroupKey] = useState(initial.groupKey ?? "");
  const type = types.find((entry) => entry.id === typeId);
  const kind = sequenceKind(type?.key);
  const group = type?.groupKey ?? groupKey;
  const biological = group === "biological" || group === "sample";
  const levels = new Set(initial.controlLevels ?? []);
  const biosafety = inventoryBiosafetyLevels.find((level) => levels.has(level.key))?.key ?? "";
  const name = (field: string) => prefix + field;

  return (
    <>
      {initial.id ? <input type="hidden" name={name("id")} value={initial.id} /> : null}
      <section className="grid gap-4 border-b border-hairline p-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="md:col-span-2 xl:col-span-1">
          <span className={formLabelClass}>Product name *</span>
          <input required name={name("name")} defaultValue={initial.name ?? ""} maxLength={180} className={formInputClass} placeholder="Anti-CD3 antibody" />
        </label>
        <label>
          <span className={formLabelClass}>Type</span>
          <select name={name("typeId")} value={typeId} onChange={(event) => setTypeId(event.target.value)} className={formInputClass}>
            <option value="">Not subdivided</option>
            {groups.map((entry) => {
              // Hidden 大类 and disabled types are not offered, except what this product already has.
              const groupTypes = types.filter((candidate) => candidate.groupKey === entry.key && ((candidate.enabled && !entry.hidden) || candidate.id === initial.typeId));
              return groupTypes.length ? <optgroup key={entry.key} label={entry.name}>{groupTypes.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}</optgroup> : null;
            })}
          </select>
        </label>
        {type ? (
          <p className="self-end pb-2.5 text-sm text-muted"><span>Inventory group</span> · <span>{type.groupName}</span></p>
        ) : (
          <label>
            <span className={formLabelClass}>Inventory group</span>
            <select name={name("groupKey")} value={groupKey} onChange={(event) => setGroupKey(event.target.value)} className={formInputClass}>
              <option value="">To be classified</option>
              {groups.filter((entry) => !entry.hidden || entry.key === initial.groupKey).map((entry) => <option key={entry.key} value={entry.key}>{entry.name}</option>)}
            </select>
          </label>
        )}
        <label>
          <span className={formLabelClass}>Brand</span>
          <input name={name("brand")} defaultValue={initial.brand ?? ""} maxLength={120} className={formInputClass} placeholder="BioLegend" />
        </label>
        <label>
          <span className={formLabelClass}>Catalog number</span>
          <input name={name("catalogNumber")} defaultValue={initial.catalogNumber ?? ""} maxLength={120} className={formInputClass} />
        </label>
        <StockReminderField key={type?.id ?? "none"} name={name} lowThreshold={initial.lowThreshold} unit={initial.lowThresholdUnit ?? type?.defaults.unit ?? "mL"} />
      </section>

      {type?.fields.length ? (
        <section className="grid gap-4 border-b border-hairline p-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Type fields">
          {type.fields.map((field) => (
            <label key={field.key}>
              <span className={formLabelClass}>{field.label}</span>
              {field.kind === "choice" ? (
                <select name={name(`field:${field.key}`)} defaultValue={initial.fieldValues?.[field.key] ?? ""} className={formInputClass}>
                  <option value="">—</option>
                  {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : (
                <input name={name(`field:${field.key}`)} type={field.kind === "date" ? "date" : "text"} inputMode={field.kind === "number" ? "decimal" : undefined} defaultValue={initial.fieldValues?.[field.key] ?? ""} maxLength={240} className={formInputClass} />
              )}
            </label>
          ))}
        </section>
      ) : null}

      {kind ? (
        <section className="grid gap-4 border-b border-hairline p-4 md:grid-cols-2" aria-label="Sequences">
          {kind.strands.map((strand) => (
            <label key={strand.role} className={kind.strands.length === 1 ? "md:col-span-2" : undefined}>
              <span className={formLabelClass}>{strand.label}</span>
              <textarea
                name={name(`sequence:${strand.role}`)}
                defaultValue={initial.sequences?.[strand.role] ?? ""}
                rows={kind.design === "plasmid" || kind.design === "protein" ? 5 : 2}
                spellCheck={false}
                autoCapitalize="characters"
                placeholder={kind.molecule === "Protein" ? "MKTAYIAKQR…" : kind.molecule === "RNA" ? "GCAGAAUGCUGAAGUGAAATT" : "GTCTCCTCTGACTTCAACAGCG"}
                className={`${formTextareaClass} font-mono text-sm tracking-wide`}
              />
            </label>
          ))}
          <p className="text-xs text-muted md:col-span-2">{kind.molecule === "Protein" ? "N- to C-terminus." : "5′ to 3′. Spaces and line breaks are ignored; a changed sequence keeps its earlier version."}</p>
        </section>
      ) : null}

      <section className="space-y-3 border-b border-hairline p-4">
        <fieldset>
          <legend className={formLabelClass}>Control level</legend>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {inventoryControlLevels.map((level) => (
              <label key={level.key} className="inline-flex min-h-8 items-center gap-2 text-sm text-graphite">
                <input type="checkbox" name={name("controlLevel")} value={level.key} defaultChecked={levels.has(level.key)} className="h-4 w-4 accent-[var(--action)]" />
                <span>{level.label}</span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">Highly toxic and drug-precursor stock is recorded with precise use, who took it and why, and needs an SDS.</p>
        </fieldset>
        {biological ? (
          <label className="block max-w-xs">
            <span className={formLabelClass}>Biosafety level</span>
            <select name={name("biosafety")} defaultValue={biosafety} className={formInputClass}>
              <option value="">Not set</option>
              {inventoryBiosafetyLevels.map((level) => <option key={level.key} value={level.key}>{level.label}</option>)}
            </select>
          </label>
        ) : null}
      </section>

      <Disclosure title="More about this product" summary={[initial.englishName, initial.casNumber].filter(Boolean).join(" · ")} defaultOpen={!!(initial.englishName || initial.casNumber || initial.entityId || initial.notes)}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label><span className={formLabelClass}>English name</span><input name={name("englishName")} defaultValue={initial.englishName ?? ""} maxLength={180} className={formInputClass} /></label>
          <label><span className={formLabelClass}>CAS number</span><input name={name("casNumber")} defaultValue={initial.casNumber ?? ""} maxLength={64} className={formInputClass} /></label>
          {kind ? null : <label>
            <span className={formLabelClass}>Made from</span>
            <select name={name("entityId")} defaultValue={initial.entityId ?? ""} className={formInputClass}>
              <option value="">Not linked</option>
              {entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name} · {entity.type}{entity.code ? ` · ${entity.code}` : ""}</option>)}
            </select>
          </label>}
          <label className="md:col-span-2 xl:col-span-3"><span className={formLabelClass}>Notes</span><textarea name={name("notes")} defaultValue={initial.notes ?? ""} maxLength={5000} className={formTextareaClass} /></label>
        </div>
      </Disclosure>
    </>
  );
}

/**
 * The product's stock reminder (Q241): none, when it is used up (a safety stock of 0), or at or below an amount. Only a
 * product with one ever shows as low or out of stock.
 */
function StockReminderField({ name, lowThreshold, unit }: { name: (field: string) => string; lowThreshold?: number | null; unit: string }) {
  const [mode, setMode] = useState(lowThreshold == null ? "none" : lowThreshold === 0 ? "usedUp" : "below");
  return (
    <div className="min-w-0 space-y-2">
      <label className="block">
        <span className={formLabelClass}>Stock reminder</span>
        <select value={mode} onChange={(event) => setMode(event.target.value)} className={formInputClass}>
          <option value="none">No reminder</option>
          <option value="usedUp">When it is used up</option>
          <option value="below">When it falls to an amount</option>
        </select>
      </label>
      {mode === "below" ? (
        <QuantityInput label="Remind at or below" name={name("lowThreshold")} unitName={name("lowThresholdUnit")} initialValue={lowThreshold ? String(lowThreshold) : ""} initialUnit={unit} options={stockUnits} required checkPrecision />
      ) : (
        <>
          <input type="hidden" name={name("lowThreshold")} value={mode === "usedUp" ? "0" : ""} />
          <input type="hidden" name={name("lowThresholdUnit")} value={mode === "usedUp" ? unit : ""} />
        </>
      )}
    </div>
  );
}
