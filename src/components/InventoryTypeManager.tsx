"use client";

import Link from "next/link";
import { AlertTriangle, Eye, EyeOff, GitMerge, Pencil, Plus, Power, Trash2, X } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { deleteInventoryType, mergeInventoryType, saveInventoryGroup, saveInventoryType, setInventoryTypeEnabled } from "@/app/inventory/types/actions";
import { useI18n } from "@/components/I18nProvider";
import { formInlineInputClass, formInputClass, formLabelClass } from "@/components/forms";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useModalDialog } from "@/components/ui/ModalDialogProvider";
import type { FormAction, FormActionState } from "@/lib/form-actions";
import { managementModeLabels } from "@/lib/inventory";
import { similarInventoryTypes, type InventoryFieldKind, type InventoryTypeDefaults, type InventoryTypeField } from "@/lib/inventory-types";

export type ManagedGroup = { key: string; name: string; label: string | null; builtInName: string; hidden: boolean; notSubdivided: number };
export type ManagedType = { id: string; label: string; groupKey: string; fields: InventoryTypeField[]; defaults: InventoryTypeDefaults; enabled: boolean; shared: boolean; products: number };

const kindLabels: Record<InventoryFieldKind, string> = { text: "Text", number: "Number", date: "Date", choice: "Choice" };
const iconButton = "focus-ring inline-flex h-8 w-8 items-center justify-center rounded-[var(--ln-radius-control-sm)] text-muted hover:bg-stone hover:text-ink disabled:opacity-50";

/** The fixed 大类 and the types under them; types are created, merged and removed only here. */
export function InventoryTypeManager({ groups, types, unclassified }: { groups: ManagedGroup[]; types: ManagedType[]; unclassified: number }) {
  const [editing, setEditing] = useState<{ groupKey: string; type?: ManagedType } | null>(null);

  return (
    <div className="space-y-4">
      {unclassified ? (
        <p className="flex items-center gap-2 rounded-[var(--ln-radius-panel)] border border-warning/30 bg-warning-surface px-4 py-2.5 text-sm text-graphite">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden />
          <span><span>Products to be classified:</span> <strong className="tabular-nums">{unclassified}</strong></span>
          <Link href="/inventory/products?group=none" className="ml-auto text-moss underline">Classify them</Link>
        </p>
      ) : null}
      {groups.map((group) => (
        <GroupSection key={group.key} group={group} groups={groups} types={types} editing={editing} setEditing={setEditing} />
      ))}
    </div>
  );
}

function GroupSection({ group, groups, types, editing, setEditing }: {
  group: ManagedGroup;
  groups: ManagedGroup[];
  types: ManagedType[];
  editing: { groupKey: string; type?: ManagedType } | null;
  setEditing: (value: { groupKey: string; type?: ManagedType } | null) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [state, save, saving] = useActionState(async (previous: FormActionState, formData: FormData) => {
    const result = await saveInventoryGroup(previous, formData);
    if (result.success) setRenaming(false);
    return result;
  }, {});
  const groupTypes = types.filter((type) => type.groupKey === group.key);
  const products = groupTypes.reduce((sum, type) => sum + type.products, 0) + group.notSubdivided;

  return (
    <section className="overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface" aria-label={group.name}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-hairline px-4 py-2.5">
        {renaming ? (
          <form action={save} className="flex flex-1 flex-wrap items-center gap-2">
            <input type="hidden" name="key" value={group.key} />
            <input type="hidden" name="hidden" value={String(group.hidden)} />
            <input name="label" defaultValue={group.label ?? ""} placeholder={group.builtInName} maxLength={60} aria-label="Group name" autoFocus className={`${formInlineInputClass} h-8 max-w-xs`} />
            <Button type="submit" size="sm" variant="primary" disabled={saving}>Save</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setRenaming(false)}>Cancel</Button>
            <span className="text-xs text-muted">Empty restores the built-in name.</span>
          </form>
        ) : (
          <>
            <h2 className="text-sm font-semibold text-ink">{group.name}</h2>
            {group.hidden ? <Badge>hidden</Badge> : null}
            <span className="text-xs text-muted"><span>Types</span> <span className="tabular-nums">{groupTypes.length}</span> · <span>Products</span> <span className="tabular-nums">{products}</span></span>
            {group.notSubdivided ? <Link href={`/inventory/products?group=${group.key}`} className="text-xs text-moss underline"><span>Not subdivided</span> <span className="tabular-nums">{group.notSubdivided}</span></Link> : null}
            <span className="ml-auto flex items-center gap-1">
              <button type="button" onClick={() => setRenaming(true)} aria-label="Rename group" title="Rename group" className={iconButton}><Pencil className="h-4 w-4" aria-hidden /></button>
              <form action={save}>
                <input type="hidden" name="key" value={group.key} />
                <input type="hidden" name="label" value={group.label ?? ""} />
                <input type="hidden" name="hidden" value={String(!group.hidden)} />
                <button type="submit" disabled={saving} aria-label={group.hidden ? "Show group" : "Hide group"} title={group.hidden ? "Show group" : "Hide group"} className={iconButton}>{group.hidden ? <Eye className="h-4 w-4" aria-hidden /> : <EyeOff className="h-4 w-4" aria-hidden />}</button>
              </form>
              <Button type="button" size="sm" onClick={() => setEditing({ groupKey: group.key })}><Plus className="h-3.5 w-3.5" aria-hidden />New type</Button>
            </span>
          </>
        )}
      </header>
      {state.error ? <p role="alert" className="border-b border-hairline px-4 py-2 text-sm text-error">{state.error}</p> : null}

      {editing?.groupKey === group.key && !editing.type ? <TypeEditor groupKey={group.key} groups={groups} types={types} onDone={() => setEditing(null)} /> : null}

      {groupTypes.length ? (
        <ul className="divide-y divide-hairline">
          {groupTypes.map((type) => editing?.type?.id === type.id
            ? <li key={type.id}><TypeEditor groupKey={group.key} groups={groups} types={types} type={type} onDone={() => setEditing(null)} /></li>
            : <TypeRow key={type.id} type={type} types={types} onEdit={() => setEditing({ groupKey: group.key, type })} />)}
        </ul>
      ) : <p className="px-4 py-3 text-sm text-muted">No types; products here stay not subdivided.</p>}
    </section>
  );
}

function TypeRow({ type, types, onEdit }: { type: ManagedType; types: ManagedType[]; onEdit: () => void }) {
  const { t } = useI18n();
  const dialog = useModalDialog();
  const [pending, startTransition] = useTransition();
  const [merging, setMerging] = useState(false);
  const [mergeState, merge, mergePending] = useActionState(mergeInventoryType, {} as FormActionState);
  const targets = types.filter((candidate) => candidate.id !== type.id && candidate.enabled);

  const run = (action: FormAction, fields: Record<string, string>) => startTransition(async () => {
    const formData = new FormData();
    Object.entries(fields).forEach(([key, value]) => formData.set(key, value));
    const result = await action({}, formData);
    if (result.error) await dialog.alert({ title: t("Not changed"), description: t(result.error) });
  });

  async function remove() {
    if (!await dialog.confirm({ title: t("Delete this type?"), description: type.shared ? t("It stays in the sequence library and leaves inventory.") : t("This cannot be undone."), confirmLabel: t("Delete"), tone: "destructive" })) return;
    run(deleteInventoryType, { id: type.id });
  }

  return (
    <li className={type.enabled ? undefined : "bg-warm/60"}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-2 text-sm md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_minmax(0,14rem)_4rem_auto]">
        <span className="min-w-0">
          <span className={`font-medium ${type.enabled ? "text-ink" : "text-muted"}`}>{type.label}</span>
          {!type.enabled ? <span className="ml-2 text-xs text-muted">Disabled</span> : null}
        </span>
        <span className="hidden min-w-0 truncate text-xs text-graphite md:block">{type.fields.length ? type.fields.map((field, index) => <span key={field.key}>{index ? " · " : ""}<span>{field.label}</span></span>) : <span className="text-muted">No fields</span>}</span>
        <span className="hidden text-xs text-muted md:block"><span>{managementModeLabels[type.defaults.managementMode]}</span>{type.defaults.unit ? <> · <span className="font-mono">{type.defaults.unit}</span></> : null}</span>
        <span className="hidden text-right text-xs tabular-nums text-graphite md:block">{type.products}</span>
        <span className="flex justify-end gap-0.5">
          <button type="button" onClick={onEdit} aria-label="Edit type" title="Edit type" className={iconButton}><Pencil className="h-4 w-4" aria-hidden /></button>
          <button type="button" onClick={() => setMerging(!merging)} aria-label="Merge into another type" title="Merge into another type" className={iconButton}><GitMerge className="h-4 w-4" aria-hidden /></button>
          <button type="button" disabled={pending} onClick={() => run(setInventoryTypeEnabled, { id: type.id, enabled: String(!type.enabled) })} aria-label={type.enabled ? "Disable type" : "Enable type"} title={type.enabled ? "Disable type" : "Enable type"} className={iconButton}><Power className="h-4 w-4" aria-hidden /></button>
          <button type="button" disabled={pending} onClick={remove} aria-label="Delete type" title="Delete type" className={`${iconButton} hover:bg-error-surface hover:text-error`}><Trash2 className="h-4 w-4" aria-hidden /></button>
        </span>
      </div>
      {merging ? (
        <form action={merge} className="flex flex-wrap items-center gap-2 border-t border-hairline/70 bg-warm px-4 py-2">
          <input type="hidden" name="id" value={type.id} />
          <span className="text-sm text-graphite"><span>Move its</span> <strong className="tabular-nums">{type.products}</strong> <span>products to</span></span>
          <select name="targetId" required defaultValue="" aria-label="Merge into" className={`${formInlineInputClass} h-8 w-auto`}>
            <option value="" disabled>Choose a type…</option>
            {targets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
          </select>
          <Button type="submit" size="sm" variant="primary" disabled={mergePending}>Merge</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setMerging(false)}>Cancel</Button>
          {mergeState.error ? <span role="alert" className="text-sm text-error">{mergeState.error}</span> : null}
        </form>
      ) : null}
    </li>
  );
}

type FieldDraft = { key?: string; label: string; kind: InventoryFieldKind; options: string };

function TypeEditor({ groupKey, groups, types, type, onDone }: { groupKey: string; groups: ManagedGroup[]; types: ManagedType[]; type?: ManagedType; onDone: () => void }) {
  const [state, save, saving] = useActionState(async (previous: FormActionState, formData: FormData) => {
    const result = await saveInventoryType(previous, formData);
    if (result.success) onDone();
    return result;
  }, {});
  const [label, setLabel] = useState(type?.label ?? "");
  const [fields, setFields] = useState<FieldDraft[]>(type?.fields.map((field) => ({ key: field.key, label: field.label, kind: field.kind, options: field.options?.join(", ") ?? "" })) ?? []);
  const similar = type ? [] : similarInventoryTypes({ label, fields: fields.map((field) => field.label) }, types);
  const payload = JSON.stringify(fields.map((field) => ({ ...(field.key ? { key: field.key } : {}), label: field.label.trim(), kind: field.kind, ...(field.kind === "choice" ? { options: field.options.split(/[,，]/).map((option) => option.trim()).filter(Boolean) } : {}) })));
  const change = (index: number, patch: Partial<FieldDraft>) => setFields(fields.map((field, at) => at === index ? { ...field, ...patch } : field));

  return (
    <form action={save} className="space-y-3 border-b border-hairline bg-warm px-4 py-3">
      {type ? <input type="hidden" name="id" value={type.id} /> : null}
      <input type="hidden" name="fields" value={payload} />
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <label><span className={formLabelClass}>Type name *</span><input name="label" required maxLength={60} value={label} onChange={(event) => setLabel(event.target.value)} autoFocus className={formInputClass} /></label>
        <label><span className={formLabelClass}>Inventory group</span><select name="groupKey" defaultValue={type?.groupKey ?? groupKey} className={formInputClass}>{groups.map((group) => <option key={group.key} value={group.key}>{group.name}</option>)}</select></label>
      </div>
      {similar.length ? (
        <p role="status" className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[var(--ln-radius-control-lg)] border border-warning/30 bg-warning-surface px-3 py-2 text-sm text-graphite">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden />
          <span>Similar types already exist:</span>
          {similar.map((entry) => <strong key={entry.id}>{entry.label}</strong>)}
          <span className="text-muted">A field on an existing type may be enough.</span>
        </p>
      ) : null}
      <fieldset className="space-y-2">
        <legend className={formLabelClass}>Fields</legend>
        {fields.map((field, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)_auto] sm:items-center">
            <input aria-label="Field name" required maxLength={60} value={field.label} onChange={(event) => change(index, { label: event.target.value })} placeholder="Clone" className={formInlineInputClass} />
            <select aria-label="Field kind" value={field.kind} onChange={(event) => change(index, { kind: event.target.value as InventoryFieldKind })} className={formInlineInputClass}>{Object.entries(kindLabels).map(([kind, name]) => <option key={kind} value={kind}>{name}</option>)}</select>
            {field.kind === "choice" ? <input aria-label="Options" required value={field.options} onChange={(event) => change(index, { options: event.target.value })} placeholder="Primary, Secondary" className={formInlineInputClass} /> : <span className="hidden sm:block" />}
            <button type="button" onClick={() => setFields(fields.filter((_, at) => at !== index))} aria-label="Remove field" title="Remove field" className={iconButton}><X className="h-4 w-4" aria-hidden /></button>
          </div>
        ))}
        <Button type="button" size="sm" variant="ghost" onClick={() => setFields([...fields, { label: "", kind: "text", options: "" }])}><Plus className="h-3.5 w-3.5" aria-hidden />Add field</Button>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto_auto] sm:items-end">
        <label><span className={formLabelClass}>New stock is kept</span><select name="managementMode" defaultValue={type?.defaults.managementMode ?? "information"} className={formInputClass}>{Object.entries(managementModeLabels).map(([mode, name]) => <option key={mode} value={mode}>{name}</option>)}</select></label>
        <label><span className={formLabelClass}>Unit</span><input name="unit" maxLength={32} defaultValue={type?.defaults.unit ?? ""} placeholder="mL" className={formInputClass} /></label>
        <label className="inline-flex min-h-10 items-center gap-2 text-sm text-graphite"><input type="checkbox" name="tracksLot" defaultChecked={type?.defaults.tracksLot ?? true} className="h-4 w-4 accent-[var(--action)]" />Lot number</label>
        <label className="inline-flex min-h-10 items-center gap-2 text-sm text-graphite"><input type="checkbox" name="tracksExpiry" defaultChecked={type?.defaults.tracksExpiry ?? true} className="h-4 w-4 accent-[var(--action)]" />Expiry date</label>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {state.error ? <p role="alert" className="mr-auto text-sm text-error">{state.error}</p> : null}
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={saving} aria-busy={saving}>{saving ? "Saving…" : type ? "Save type" : "Create type"}</Button>
      </div>
    </form>
  );
}
