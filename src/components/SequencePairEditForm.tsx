"use client";

import { useActionState, useState } from "react";
import { formInputClass, formLabelClass, formTextareaClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import type { FormAction, FormActionState } from "@/lib/form-actions";
import { sequenceLifecycleStatuses } from "@/lib/sequence-registry";
import { sequencePairMetadataFields, type SequencePairTypeValue } from "@/lib/sequence-entry";

const initialState: FormActionState = {};

export function SequencePairEditForm({ action, projects, initial }: {
  action: FormAction;
  projects: Array<{ id: string; name: string }>;
  initial: {
    id: string;
    pairType: SequencePairTypeValue;
    name: string;
    organism?: string | null;
    ownershipScope: "library" | "project";
    projectId?: string | null;
    status: "draft" | "active" | "inactive" | "archived";
    description?: string | null;
    metadata: Record<string, unknown>;
  };
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [ownershipScope, setOwnershipScope] = useState(initial.ownershipScope);
  const fields = sequencePairMetadataFields(initial.pairType);
  const primaryField = fields.find((field) => field.key === "application");
  return <form action={formAction} className="space-y-3">
    <input type="hidden" name="id" value={initial.id} />
    <input type="hidden" name="pairType" value={initial.pairType} />
    <Card><CardBody className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 sm:p-5">
      <label><span className={formLabelClass}>{initial.pairType === "primer_pair" ? "Gene name *" : "Target gene *"}</span><input required name="geneName" defaultValue={initial.name} maxLength={180} className={formInputClass} /></label>
      <label><span className={formLabelClass}>{initial.pairType === "primer_pair" ? "Species" : "Target species"}</span><input name="organism" defaultValue={initial.organism ?? ""} maxLength={180} className={formInputClass} /></label>
      {primaryField ? <MetadataInput field={primaryField} value={initial.metadata[primaryField.key]} /> : null}
      {fields.filter((field) => field.key !== primaryField?.key).map((field) => <MetadataInput key={field.key} field={field} value={initial.metadata[field.key]} />)}
      <label><span className={formLabelClass}>Location *</span><select name="ownershipScope" value={ownershipScope} onChange={(event) => setOwnershipScope(event.target.value as typeof ownershipScope)} className={formInputClass}><option value="library">Sequence library</option><option value="project">Project</option></select></label>
      <label><span className={formLabelClass}>Project{ownershipScope === "project" ? " *" : ""}</span><select name="projectId" required={ownershipScope === "project"} disabled={ownershipScope !== "project"} defaultValue={initial.projectId ?? ""} className={formInputClass}><option value="">Choose a Project…</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      <label><span className={formLabelClass}>Lifecycle</span><select name="status" defaultValue={initial.status} className={formInputClass}>{sequenceLifecycleStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label className="sm:col-span-2 lg:col-span-3"><span className={formLabelClass}>Description</span><textarea name="description" defaultValue={initial.description ?? ""} maxLength={5000} className={`${formTextareaClass} min-h-24`} /></label>
    </CardBody></Card>
    <div className="flex flex-wrap items-center justify-end gap-3">{state.error ? <p role="alert" className="rounded-[8px] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error">{state.error}</p> : null}<Button type="submit" variant="primary" disabled={pending}>{pending ? "Saving…" : "Save paired entry"}</Button></div>
  </form>;
}

function MetadataInput({ field, value }: { field: ReturnType<typeof sequencePairMetadataFields>[number]; value: unknown }) {
  return <label><span className={formLabelClass}>{field.label}</span><input name={`meta_${field.key}`} type={field.type === "number" ? "number" : "text"} min={field.min} step={field.type === "number" ? "1" : undefined} maxLength={field.type === "number" ? undefined : 180} defaultValue={String(value ?? "")} className={formInputClass} placeholder={field.placeholder} /></label>;
}
