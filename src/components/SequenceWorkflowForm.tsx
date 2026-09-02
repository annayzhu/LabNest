"use client";

import { useActionState } from "react";
import { formInputClass, formLabelClass, formTextareaClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { FormAction, FormActionState } from "@/lib/form-actions";
import { sequenceLifecycleStatuses } from "@/lib/sequence-registry";
import { sequenceWorkflowLabel } from "@/lib/sequence-entry";

const initialState: FormActionState = {};
const methodOptions = {
  alignment: [{ value: "pairwise", label: "Pairwise alignment" }, { value: "multiple", label: "Multiple alignment" }],
  assembly: [{ value: "gibson", label: "Gibson" }, { value: "golden_gate", label: "Golden Gate" }, { value: "homology", label: "Homology assembly" }, { value: "concatenation", label: "Concatenation" }],
  crispr: [{ value: "manual_design", label: "Manual guide design" }, { value: "external_import", label: "External design import" }],
} as const;

export function SequenceWorkflowForm({ action, type, projects, versions, initialProjectId }: {
  action: FormAction;
  type: "alignment" | "assembly" | "crispr";
  projects: Array<{ id: string; name: string }>;
  versions: Array<{ id: string; label: string; detail: string }>;
  initialProjectId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <input type="hidden" name="type" value={type} />
      <Card>
        <CardHeader title={`${sequenceWorkflowLabel(type)} setup`} />
        <CardBody className="grid gap-3 md:grid-cols-2">
          <label className="md:col-span-2"><span className={formLabelClass}>Name *</span><input required name="name" maxLength={180} className={formInputClass} placeholder={`${sequenceWorkflowLabel(type)} for…`} /></label>
          <label><span className={formLabelClass}>Project *</span><select required name="projectId" defaultValue={initialProjectId ?? ""} className={formInputClass}><option value="">Choose a Project…</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <label><span className={formLabelClass}>Method *</span><select required name="method" defaultValue={methodOptions[type][0].value} className={formInputClass}>{methodOptions[type].map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label><span className={formLabelClass}>Lifecycle *</span><select name="status" defaultValue="draft" className={formInputClass}>{sequenceLifecycleStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          {type === "crispr" ? <><label><span className={formLabelClass}>Reference genome / transcript / source *</span><input required name="reference" maxLength={500} className={formInputClass} placeholder="GRCh38 · NM_… · external source" /></label><label><span className={formLabelClass}>PAM</span><input name="pam" maxLength={80} className={formInputClass} placeholder="NGG" /></label></> : null}
          <label className="md:col-span-2"><span className={formLabelClass}>Description</span><textarea name="description" maxLength={5000} className={`${formTextareaClass} min-h-28`} /></label>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={type === "crispr" ? "Exact Sequence inputs · optional" : "Exact Sequence inputs"} />
        <CardBody className="space-y-3">
          <div className="max-h-[440px] space-y-1 overflow-y-auto rounded-[8px] border border-hairline p-2">
            {versions.map((version) => <label key={version.id} className="flex items-start gap-2 rounded-[6px] px-2 py-2 hover:bg-warm"><input type="checkbox" name="sequenceVersionId" value={version.id} className="mt-0.5 h-4 w-4 accent-moss" /><span className="min-w-0 text-xs"><strong className="block truncate font-medium text-ink">{version.label}</strong><span className="text-muted">{version.detail}</span></span></label>)}
            {!versions.length ? <p className="p-2 text-sm text-muted">No Sequence versions are available yet.</p> : null}
          </div>
          <p className="text-xs leading-5 text-muted">Inputs are pinned to exact versions. CRISPR scores are not fabricated: this first workflow records manual or external designs and their provenance only.</p>
          {state.error ? <p role="alert" className="rounded-[8px] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error">{state.error}</p> : null}
          <Button type="submit" variant="primary" size="md" disabled={pending} aria-busy={pending} className="w-full">{pending ? "Creating…" : `Create ${sequenceWorkflowLabel(type)}`}</Button>
        </CardBody>
      </Card>
    </form>
  );
}
