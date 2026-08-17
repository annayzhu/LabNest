"use client";

import { Check, Pencil, Plus, Settings2, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { manageResultTypeDefinition, type ResultTypeActionState, type ResultTypeDefinitionItem } from "@/app/results/result-type-actions";
import { formInputClass, formLabelClass } from "@/components/forms";
import { buttonStyles } from "@/components/ui/Button";

const saveTypeButtonClass = buttonStyles({
  variant: "primary",
  size: "md",
  className: "mt-[var(--ln-form-field-gap)] text-xs disabled:opacity-50",
});

export function ResultTypePicker({ initialTypes, value, onChange }: {
  initialTypes: ResultTypeDefinitionItem[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [types, setTypes] = useState(initialTypes);
  const [managing, setManaging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [state, setState] = useState<ResultTypeActionState>({});
  const [pending, startTransition] = useTransition();

  function beginCreate() {
    setEditingId(null);
    setLabel("");
    setDescription("");
    setState({});
  }

  function beginEdit(item: ResultTypeDefinitionItem) {
    setEditingId(item.id);
    setLabel(item.label);
    setDescription(item.description ?? "");
    setState({});
  }

  function save() {
    const formData = new FormData();
    formData.set("intent", editingId ? "edit" : "create");
    if (editingId) formData.set("id", editingId);
    formData.set("label", label);
    formData.set("description", description);
    const previousLabel = editingId ? types.find((item) => item.id === editingId)?.label : undefined;
    startTransition(async () => {
      const result = await manageResultTypeDefinition(formData);
      setState(result);
      if (!result.item) return;
      setTypes((current) => editingId
        ? current.map((item) => item.id === result.item!.id ? result.item! : item).sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
        : [...current, result.item!].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)));
      if (!editingId || value === previousLabel) onChange(result.item.label);
      beginCreate();
    });
  }

  function remove(item: ResultTypeDefinitionItem) {
    if (!window.confirm(`Delete the Result type “${item.label}”? Existing Results keep their saved type text.`)) return;
    const formData = new FormData();
    formData.set("intent", "delete");
    formData.set("id", item.id);
    startTransition(async () => {
      const result = await manageResultTypeDefinition(formData);
      setState(result);
      if (!result.deletedId) return;
      const remaining = types.filter((type) => type.id !== result.deletedId);
      setTypes(remaining);
      if (value === item.label) onChange(remaining[0]?.label ?? "");
      if (editingId === item.id) beginCreate();
    });
  }

  return <div className="md:col-span-2">
    <div className="flex items-center justify-between gap-3"><span className={formLabelClass}>Result type</span><button type="button" onClick={() => setManaging((current) => !current)} className="focus-ring inline-flex items-center gap-1 text-xs font-medium text-moss hover:underline"><Settings2 className="h-3.5 w-3.5" />{managing ? "Close type manager" : "Manage types"}</button></div>
    <select required name="resultType" value={value} onChange={(event) => onChange(event.target.value)} className={formInputClass}>
      <option value="" disabled>Select Result type…</option>
      {types.map((item) => <option key={item.id} value={item.label}>{item.label}</option>)}
    </select>
    {types.find((item) => item.label === value)?.description ? <span className="mt-1 block text-xs text-muted">{types.find((item) => item.label === value)?.description}</span> : null}

    {managing ? <div className="mt-3 space-y-3 rounded-[9px] border border-hairline bg-warm/70 p-3">
      <div className="flex items-center justify-between gap-3"><p className={formLabelClass}>Add, edit or delete types</p>{editingId ? <button type="button" onClick={beginCreate} className="focus-ring inline-flex items-center gap-1 text-xs text-muted hover:text-ink"><X className="h-3.5 w-3.5" />Cancel edit</button> : null}</div>
      <div className="grid gap-2 md:grid-cols-[0.7fr_1fr_auto]"><input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Type name" className={formInputClass} /><input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Short explanation (optional)" className={formInputClass} /><button type="button" onClick={save} disabled={pending || !label.trim()} className={saveTypeButtonClass}>{editingId ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}{pending ? "Saving…" : editingId ? "Save" : "Add"}</button></div>
      {state.error ? <p role="alert" className="text-xs text-error">{state.error}</p> : null}
      <div className="max-h-48 divide-y divide-hairline overflow-y-auto rounded-[7px] border border-hairline bg-surface">{types.map((item) => <div key={item.id} className="flex items-start justify-between gap-3 px-3 py-2"><span className="min-w-0"><strong className="block text-sm font-medium text-ink">{item.label}</strong>{item.description ? <span className="block truncate text-xs text-muted">{item.description}</span> : null}</span><span className="flex shrink-0 gap-1"><button type="button" onClick={() => beginEdit(item)} disabled={pending} aria-label={`Edit ${item.label}`} className="focus-ring rounded p-1 text-muted hover:bg-stone hover:text-ink"><Pencil className="h-3.5 w-3.5" /></button><button type="button" onClick={() => remove(item)} disabled={pending} aria-label={`Delete ${item.label}`} className="focus-ring rounded p-1 text-error hover:bg-error-surface"><Trash2 className="h-3.5 w-3.5" /></button></span></div>)}</div>
      <p className="text-xs leading-5 text-muted">Deleting or renaming an option does not alter the type text already saved in historical Results.</p>
    </div> : null}
  </div>;
}
