"use client";

import { useActionState, useMemo, useState } from "react";
import { formInputClass, formLabelClass, formMonoTextareaClass, formTextareaClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { FormAction, FormActionState } from "@/lib/form-actions";
import { sequenceLifecycleStatuses, sequenceValidationStatuses } from "@/lib/sequence-registry";
import { sequencePairRoles, type SequencePairTypeValue } from "@/lib/sequence-entry";
import { estimatedMeltingTemperature, gcPercent, sequenceLength } from "@/lib/sequence";

const initialState: FormActionState = {};

export function SequencePairForm({
  action,
  projects,
  pairType,
  initialProjectId,
}: {
  action: FormAction;
  projects: Array<{ id: string; name: string }>;
  pairType: SequencePairTypeValue;
  initialProjectId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const roles = sequencePairRoles(pairType);
  const moleculeType = pairType === "primer_pair" ? "DNA" : "RNA";
  const [ownershipScope, setOwnershipScope] = useState<"library" | "project">(initialProjectId ? "project" : "library");
  const [sequences, setSequences] = useState<Record<string, string>>(Object.fromEntries(roles.map((role) => [role, ""])));
  const metrics = useMemo(() => Object.fromEntries(roles.map((role) => [role, {
    length: sequenceLength(sequences[role] ?? ""),
    gc: gcPercent(sequences[role] ?? ""),
    tm: estimatedMeltingTemperature(sequences[role] ?? "", moleculeType),
  }])), [moleculeType, roles, sequences]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="pairType" value={pairType} />
      <Card>
        <CardHeader title={pairType === "primer_pair" ? "Primer pair" : "siRNA duplex"} />
        <CardBody className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="md:col-span-2">
            <span className={formLabelClass}>Pair name *</span>
            <input required name="name" maxLength={180} className={formInputClass} placeholder={pairType === "primer_pair" ? "FBN2 qPCR primer pair" : "FBN2 siRNA duplex 1"} />
          </label>
          <label>
            <span className={formLabelClass}>Location *</span>
            <select name="ownershipScope" value={ownershipScope} onChange={(event) => setOwnershipScope(event.target.value as typeof ownershipScope)} className={formInputClass}>
              <option value="library">Sequence library</option>
              <option value="project">Project</option>
            </select>
          </label>
          <label>
            <span className={formLabelClass}>Project{ownershipScope === "project" ? " *" : ""}</span>
            <select name="projectId" required={ownershipScope === "project"} disabled={ownershipScope !== "project"} defaultValue={initialProjectId ?? ""} className={formInputClass}>
              <option value="">Choose a Project…</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          <label>
            <span className={formLabelClass}>Target / gene</span>
            <input name="targetName" maxLength={180} className={formInputClass} placeholder="FBN2" />
          </label>
          <label>
            <span className={formLabelClass}>Organism</span>
            <input name="organism" maxLength={180} className={formInputClass} placeholder="Homo sapiens" />
          </label>
          <label>
            <span className={formLabelClass}>Lifecycle *</span>
            <select name="status" defaultValue="draft" className={formInputClass}>{sequenceLifecycleStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          </label>
          <label>
            <span className={formLabelClass}>Validation *</span>
            <select name="validationStatus" defaultValue="unverified" className={formInputClass}>{sequenceValidationStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
          </label>
          <label className="md:col-span-2">
            <span className={formLabelClass}>Description</span>
            <textarea name="description" maxLength={5000} className={`${formTextareaClass} min-h-20`} />
          </label>
          <label className="md:col-span-2">
            <span className={formLabelClass}>Validation summary</span>
            <textarea name="validationSummary" maxLength={5000} className={`${formTextareaClass} min-h-20`} placeholder="Evidence, conditions, limitations, and decision…" />
          </label>
        </CardBody>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        {roles.map((role) => (
          <Card key={role}>
            <CardHeader title={roleLabel(role)} action={<span className="font-mono text-[11px] text-muted">5′ → 3′ · {moleculeType}</span>} />
            <CardBody className="space-y-3">
              <textarea
                required
                name={`sequence_${role}`}
                value={sequences[role] ?? ""}
                onChange={(event) => setSequences((current) => ({ ...current, [role]: event.target.value }))}
                spellCheck={false}
                data-i18n-ignore
                className={`${formMonoTextareaClass} min-h-36`}
                placeholder={moleculeType === "RNA" ? "AUGCUU…TT" : "ATGCTT…"}
              />
              <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-hairline pt-2 font-mono text-xs text-muted">
                <span>Length <strong className="text-ink">{metrics[role]?.length ?? 0} nt</strong></span>
                <span>GC <strong className="text-ink">{metrics[role]?.gc ?? 0}%</strong></span>
                {metrics[role]?.tm === undefined ? null : <span>Approx. Tm <strong className="text-ink">{metrics[role].tm} °C</strong></span>}
              </div>
            </CardBody>
          </Card>
        ))}
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {state.error ? <p role="alert" className="max-w-2xl rounded-[8px] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error">{state.error}</p> : null}
        <Button type="submit" variant="primary" size="md" disabled={pending}>{pending ? "Creating pair…" : "Create paired entry"}</Button>
      </div>
    </form>
  );
}

function roleLabel(role: string) {
  if (role === "forward") return "Forward primer";
  if (role === "reverse") return "Reverse primer";
  if (role === "sense") return "Sense strand";
  if (role === "antisense") return "Antisense strand";
  return role;
}
