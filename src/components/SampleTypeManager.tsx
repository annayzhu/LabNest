"use client";

import Link from "next/link";
import { Pencil, Plus, Power, Trash2, X } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { deleteSampleType, saveSampleType, setSampleTypeEnabled } from "@/app/samples/types/actions";
import { useI18n } from "@/components/I18nProvider";
import { formInlineInputClass, formInputClass, formLabelClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { useModalDialog } from "@/components/ui/ModalDialogProvider";
import type { FormAction, FormActionState } from "@/lib/form-actions";
import type { InventoryFieldKind } from "@/lib/inventory-types";
import type { SampleTypeRef } from "@/lib/samples";

export type ManagedSampleType = SampleTypeRef & { enabled: boolean; samples: number };

const kindLabels: Record<InventoryFieldKind, string> = { text: "Text", number: "Number", date: "Date", choice: "Choice" };
const iconButton = "focus-ring inline-flex h-8 w-8 items-center justify-center rounded-[var(--ln-radius-control-sm)] text-muted hover:bg-stone hover:text-ink disabled:opacity-50";

/** Sample types (S6): name, code prefix, default units and the fields samples of the type record. */
export function SampleTypeManager({ types }: { types: ManagedSampleType[] }) {
  const [editing, setEditing] = useState<ManagedSampleType | "new" | null>(null);
  return (
    <section className="overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface" aria-label="Sample types">
      <header className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-2.5">
        <h2 className="text-sm font-semibold text-ink">Sample types</h2>
        <span className="text-xs text-muted"><span className="tabular-nums">{types.length}</span> <span>types</span></span>
        <Button type="button" size="sm" className="ml-auto" onClick={() => setEditing("new")}><Plus className="h-3.5 w-3.5" aria-hidden />New type</Button>
      </header>
      {editing === "new" ? <TypeEditor onDone={() => setEditing(null)} /> : null}
      <ul className="divide-y divide-hairline">
        {types.map((type) => editing !== "new" && editing?.id === type.id
          ? <li key={type.id}><TypeEditor type={type} onDone={() => setEditing(null)} /></li>
          : <TypeRow key={type.id} type={type} onEdit={() => setEditing(type)} />)}
      </ul>
    </section>
  );
}

function TypeRow({ type, onEdit }: { type: ManagedSampleType; onEdit: () => void }) {
  const { t } = useI18n();
  const dialog = useModalDialog();
  const [pending, startTransition] = useTransition();
  const run = (action: FormAction, fields: Record<string, string>) => startTransition(async () => {
    const formData = new FormData();
    Object.entries(fields).forEach(([key, value]) => formData.set(key, value));
    const result = await action({}, formData);
    if (result.error) await dialog.alert({ title: t("Not changed"), description: t(result.error) });
  });
  async function remove() {
    if (!await dialog.confirm({ title: t("Delete this type?"), description: t("This cannot be undone."), confirmLabel: t("Delete"), tone: "destructive" })) return;
    run(deleteSampleType, { id: type.id });
  }
  const units = [type.amountUnit, type.concentrationUnit].filter(Boolean).join(" · ");
  return (
    <li className={type.enabled ? undefined : "bg-warm/60"}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-2 text-sm md:grid-cols-[minmax(0,12rem)_5rem_minmax(0,1fr)_minmax(0,9rem)_4rem_auto]">
        <span className="min-w-0"><span className={`font-medium ${type.enabled ? "text-ink" : "text-muted"}`}>{type.label}</span>{!type.enabled ? <span className="ml-2 text-xs text-muted">Disabled</span> : null}</span>
        <span className="hidden font-mono text-xs text-graphite md:block">{type.prefix ?? "SMP"}-0001</span>
        <span className="hidden min-w-0 truncate text-xs text-graphite md:block">{type.fields.length ? type.fields.map((field) => field.label).join(" · ") : <span className="text-muted">No fields</span>}</span>
        <span className="hidden font-mono text-xs text-muted md:block">{units || "—"}</span>
        <Link href={`/samples?type=${type.id}`} className="hidden text-right text-xs tabular-nums text-moss hover:underline md:block">{type.samples}</Link>
        <span className="flex justify-end gap-0.5">
          <button type="button" onClick={onEdit} aria-label="Edit type" title="Edit type" className={iconButton}><Pencil className="h-4 w-4" aria-hidden /></button>
          <button type="button" disabled={pending} onClick={() => run(setSampleTypeEnabled, { id: type.id, enabled: String(!type.enabled) })} aria-label={type.enabled ? "Disable type" : "Enable type"} title={type.enabled ? "Disable type" : "Enable type"} className={iconButton}><Power className="h-4 w-4" aria-hidden /></button>
          <button type="button" disabled={pending} onClick={remove} aria-label="Delete type" title="Delete type" className={`${iconButton} hover:bg-error-surface hover:text-error`}><Trash2 className="h-4 w-4" aria-hidden /></button>
        </span>
      </div>
    </li>
  );
}

type FieldDraft = { key?: string; label: string; kind: InventoryFieldKind; options: string };

function TypeEditor({ type, onDone }: { type?: ManagedSampleType; onDone: () => void }) {
  const [state, save, saving] = useActionState(async (previous: FormActionState, formData: FormData) => {
    const result = await saveSampleType(previous, formData);
    if (result.success) onDone();
    return result;
  }, {});
  const [fields, setFields] = useState<FieldDraft[]>(type?.fields.map((field) => ({ key: field.key, label: field.label, kind: field.kind, options: field.options?.join(", ") ?? "" })) ?? []);
  const payload = JSON.stringify(fields.map((field) => ({ ...(field.key ? { key: field.key } : {}), label: field.label.trim(), kind: field.kind, ...(field.kind === "choice" ? { options: field.options.split(/[,，]/).map((option) => option.trim()).filter(Boolean) } : {}) })));
  const change = (index: number, patch: Partial<FieldDraft>) => setFields(fields.map((field, at) => (at === index ? { ...field, ...patch } : field)));
  return (
    <form action={save} className="space-y-3 border-b border-hairline bg-warm px-4 py-3">
      {type ? <input type="hidden" name="id" value={type.id} /> : null}
      <input type="hidden" name="fields" value={payload} />
      <div className="grid gap-3 md:grid-cols-4">
        <label><span className={formLabelClass}>Type name *</span><input name="label" required maxLength={60} defaultValue={type?.label ?? ""} autoFocus className={formInputClass} /></label>
        <label><span className={formLabelClass}>Code prefix</span><input name="prefix" maxLength={12} defaultValue={type?.prefix ?? ""} placeholder="RNA" className={`${formInputClass} font-mono uppercase`} /></label>
        <label><span className={formLabelClass}>Amount unit</span><input name="amountUnit" maxLength={32} defaultValue={type?.amountUnit ?? ""} placeholder="µL" className={formInputClass} /></label>
        <label><span className={formLabelClass}>Concentration unit</span><input name="concentrationUnit" maxLength={32} defaultValue={type?.concentrationUnit ?? ""} placeholder="ng/µL" className={formInputClass} /></label>
      </div>
      <fieldset className="space-y-2">
        <legend className={formLabelClass}>Fields</legend>
        {fields.map((field, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)_auto] sm:items-center">
            <input aria-label="Field name" required maxLength={60} value={field.label} onChange={(event) => change(index, { label: event.target.value })} placeholder="RIN" className={formInlineInputClass} />
            <select aria-label="Field kind" value={field.kind} onChange={(event) => change(index, { kind: event.target.value as InventoryFieldKind })} className={formInlineInputClass}>{Object.entries(kindLabels).map(([kind, name]) => <option key={kind} value={kind}>{name}</option>)}</select>
            {field.kind === "choice" ? <input aria-label="Options" required value={field.options} onChange={(event) => change(index, { options: event.target.value })} placeholder="Frozen, FFPE" className={formInlineInputClass} /> : <span className="hidden sm:block" />}
            <button type="button" onClick={() => setFields(fields.filter((_, at) => at !== index))} aria-label="Remove field" title="Remove field" className={iconButton}><X className="h-4 w-4" aria-hidden /></button>
          </div>
        ))}
        <Button type="button" size="sm" variant="ghost" onClick={() => setFields([...fields, { label: "", kind: "text", options: "" }])}><Plus className="h-3.5 w-3.5" aria-hidden />Add field</Button>
      </fieldset>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {state.error ? <p role="alert" className="mr-auto text-sm text-error">{state.error}</p> : null}
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={saving} aria-busy={saving}>{saving ? "Saving…" : type ? "Save type" : "Create type"}</Button>
      </div>
    </form>
  );
}
