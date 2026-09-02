"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { formInputClass, formLabelClass, formTextareaClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { FormAction, FormActionState } from "@/lib/form-actions";
import { sequenceCollectionTypes, sequenceLifecycleStatuses, type SequenceCollectionTypeValue } from "@/lib/sequence-registry";

const initialState: FormActionState = {};

type VersionOption = {
  id: string;
  sequenceId: string;
  label: string;
  moleculeType: string;
  designType: string;
};
type MemberDraft = { sequenceVersionId: string; role: string; note?: string };

export type SequenceCollectionInitial = {
  id?: string;
  name?: string;
  type?: SequenceCollectionTypeValue;
  status?: "draft" | "active" | "inactive" | "archived";
  description?: string | null;
  ownershipScope?: "library" | "project";
  projectId?: string | null;
  members?: MemberDraft[];
};

export function SequenceCollectionForm({
  action,
  projects,
  versions,
  initial = {},
}: {
  action: FormAction;
  projects: Array<{ id: string; name: string }>;
  versions: VersionOption[];
  initial?: SequenceCollectionInitial;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [ownershipScope, setOwnershipScope] = useState<"library" | "project">(initial.ownershipScope ?? (initial.projectId ? "project" : "library"));
  const [type, setType] = useState<SequenceCollectionTypeValue>(initial.type ?? "shrna_construct");
  const [members, setMembers] = useState<MemberDraft[]>(initial.members ?? []);
  const suggestedRoles = useMemo(() => sequenceCollectionTypes.find((item) => item.value === type)?.roles ?? ["member"], [type]);

  function addMember() {
    const usedRoles = new Set(members.map((member) => member.role));
    const nextRole = suggestedRoles.find((role) => !usedRoles.has(role)) ?? suggestedRoles[0] ?? "member";
    setMembers((current) => [...current, { sequenceVersionId: "", role: nextRole, note: "" }]);
  }

  return (
    <form action={formAction} className="space-y-4">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="membersJson" value={JSON.stringify(members)} />
      <Card>
        <CardHeader title="Collection identity" />
        <CardBody className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="md:col-span-2">
            <span className={formLabelClass}>Collection name *</span>
            <input required name="name" defaultValue={initial.name ?? ""} maxLength={180} className={formInputClass} placeholder="FBN2 qPCR primer pair" />
          </label>
          <label>
            <span className={formLabelClass}>Collection type *</span>
            <select name="type" value={type} onChange={(event) => setType(event.target.value as SequenceCollectionTypeValue)} className={formInputClass}>
              {sequenceCollectionTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label>
            <span className={formLabelClass}>Lifecycle status *</span>
            <select name="status" defaultValue={initial.status ?? "draft"} className={formInputClass}>
              {sequenceLifecycleStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label>
            <span className={formLabelClass}>Location *</span>
            <select name="ownershipScope" value={ownershipScope} onChange={(event) => setOwnershipScope(event.target.value as typeof ownershipScope)} className={formInputClass}><option value="library">Sequence library</option><option value="project">Project</option></select>
          </label>
          <label>
            <span className={formLabelClass}>Project{ownershipScope === "project" ? " *" : ""}</span>
            <select name="projectId" required={ownershipScope === "project"} disabled={ownershipScope !== "project"} defaultValue={initial.projectId ?? ""} className={formInputClass}>
              <option value="">Choose a Project…</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          <label className="md:col-span-2 xl:col-span-3">
            <span className={formLabelClass}>Description</span>
            <textarea name="description" defaultValue={initial.description ?? ""} maxLength={5000} className={`${formTextareaClass} min-h-20`} />
          </label>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Exact version members" action={<button type="button" onClick={addMember} className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-[var(--ln-radius-control-sm)] border border-hairline px-2.5 text-xs text-moss hover:bg-warm"><Plus className="h-3.5 w-3.5" aria-hidden />Add member</button>} />
        <CardBody className="space-y-2">
          <p className="text-xs text-muted">Collections pin exact versions. Updating a Sequence later does not silently rewrite a primer pair, duplex, or panel.</p>
          {members.length ? members.map((member, index) => (
            <div key={`member-${index}`} className="grid gap-2 rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm/50 p-2 md:grid-cols-[minmax(260px,1.6fr)_160px_1fr_34px]">
              <select aria-label="Sequence version" value={member.sequenceVersionId} onChange={(event) => setMembers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, sequenceVersionId: event.target.value } : item))} className={compactInputClass}>
                <option value="">Choose a sequence version…</option>
                {versions.map((version) => <option key={version.id} value={version.id}>{version.label}</option>)}
              </select>
              <input aria-label="Member role" value={member.role} onChange={(event) => setMembers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, role: event.target.value } : item))} list={`roles-${index}`} placeholder="role" className={compactInputClass} />
              <datalist id={`roles-${index}`}>{suggestedRoles.map((role) => <option key={role} value={role} />)}</datalist>
              <input aria-label="Member note" value={member.note ?? ""} onChange={(event) => setMembers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, note: event.target.value } : item))} placeholder="Member note" className={compactInputClass} />
              <button type="button" aria-label="Remove member" onClick={() => setMembers((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="focus-ring flex h-8 w-8 items-center justify-center rounded-[var(--ln-radius-control-sm)] text-error hover:bg-error-surface"><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>
            </div>
          )) : <p className="rounded-[var(--ln-radius-control-lg)] border border-dashed border-hairline px-3 py-4 text-sm text-muted">No sequence versions selected.</p>}
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {state.error ? <p role="alert" className="max-w-2xl rounded-[var(--ln-radius-control-lg)] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error">{state.error}</p> : null}
        <Button type="submit" variant="primary" size="md" disabled={pending} aria-busy={pending}>
          {pending ? "Saving…" : initial.id ? "Save Collection" : "Create Collection"}
        </Button>
      </div>
    </form>
  );
}

const compactInputClass = "focus-ring h-8 min-w-0 w-full rounded-[var(--ln-radius-control-sm)] border border-hairline bg-surface px-2 text-xs text-ink";
