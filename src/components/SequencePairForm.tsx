"use client";

import { useActionState, useState } from "react";
import { ChevronDown } from "lucide-react";
import { formInputClass, formLabelClass, formMonoTextareaClass, formTextareaClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import type { FormAction, FormActionState } from "@/lib/form-actions";
import { sequenceLifecycleStatuses, sequenceValidationStatuses } from "@/lib/sequence-registry";
import { sequencePairDefinition, type SequencePairTypeValue } from "@/lib/sequence-entry";
import { estimatedMeltingTemperature, gcPercent, sequenceLength } from "@/lib/sequence";

const initialState: FormActionState = {};

export function SequencePairForm({ action, projects, pairType, initialProjectId }: {
  action: FormAction;
  projects: Array<{ id: string; name: string }>;
  pairType: SequencePairTypeValue;
  initialProjectId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const definition = sequencePairDefinition(pairType);
  const roles = definition.roles;
  const moleculeType = definition.moleculeType;
  const [ownershipScope, setOwnershipScope] = useState<"library" | "project">(initialProjectId ? "project" : "library");
  const [sequences, setSequences] = useState<Record<string, string>>(Object.fromEntries(roles.map((role) => [role, ""])));
  const metrics = Object.fromEntries(roles.map((role) => [role, {
    length: sequenceLength(sequences[role] ?? ""),
    gc: gcPercent(sequences[role] ?? ""),
    tm: estimatedMeltingTemperature(sequences[role] ?? "", moleculeType),
  }]));

  return (
    <form action={formAction} className="space-y-3 pb-20 md:pb-0">
      <input type="hidden" name="pairType" value={pairType} />
      <Card>
        <CardBody className="space-y-5 p-4 sm:p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span className={formLabelClass}>Gene / target name *</span>
              <input required name="geneName" maxLength={180} className={formInputClass} placeholder="FBN2" autoFocus />
            </label>
            <label>
              <span className={formLabelClass}>Species</span>
              <input name="organism" maxLength={180} className={formInputClass} placeholder="Homo sapiens" />
            </label>
          </div>

          <section className="grid gap-3 lg:grid-cols-2" aria-label={`${definition.label} sequences`}>
            {roles.map((role) => (
              <label key={role} className="rounded-[9px] border border-hairline bg-warm/35 p-3">
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-ink">{roleLabel(role)}</span>
                  <span className="font-mono text-[10px] text-muted">5′ → 3′ · {moleculeType}</span>
                </span>
                <textarea
                  required
                  name={`sequence_${role}`}
                  value={sequences[role] ?? ""}
                  onChange={(event) => setSequences((current) => ({ ...current, [role]: event.target.value }))}
                  spellCheck={false}
                  data-i18n-ignore
                  className={`${formMonoTextareaClass} mt-2 min-h-28`}
                  placeholder={moleculeType === "RNA" ? "AUGCUU…TT" : "ATGCTT…"}
                />
                <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-hairline pt-2 font-mono text-[11px] text-muted">
                  <span>{metrics[role]?.length ?? 0} nt</span>
                  <span>GC {metrics[role]?.gc ?? 0}%</span>
                  {metrics[role]?.tm === undefined ? null : <span>Tm ≈ {metrics[role].tm} °C</span>}
                </span>
              </label>
            ))}
          </section>

          <details className="group rounded-[9px] border border-hairline">
            <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium text-graphite">
              More details
              <ChevronDown className="h-4 w-4 text-muted transition group-open:rotate-180" aria-hidden />
            </summary>
            <div className="grid gap-3 border-t border-hairline p-3 md:grid-cols-2 xl:grid-cols-4">
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
                <span className={formLabelClass}>Lifecycle</span>
                <select name="status" defaultValue="draft" className={formInputClass}>{sequenceLifecycleStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
              </label>
              <label>
                <span className={formLabelClass}>Validation</span>
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
            </div>
          </details>
        </CardBody>
      </Card>

      <div className="sticky bottom-16 z-20 flex flex-wrap items-center justify-end gap-3 bg-canvas/95 py-2 backdrop-blur md:static md:bg-transparent md:py-0 md:backdrop-blur-none">
        {state.error ? <p role="alert" className="max-w-2xl rounded-[8px] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error">{state.error}</p> : null}
        <Button type="submit" variant="primary" size="md" className="w-full sm:w-auto" disabled={pending}>{pending ? "Creating…" : `Create ${definition.label.toLowerCase()}`}</Button>
      </div>
    </form>
  );
}

function roleLabel(role: string) {
  if (role === "forward") return "Forward primer sequence (upstream)";
  if (role === "reverse") return "Reverse primer sequence (downstream)";
  if (role === "sense") return "Sense strand sequence";
  if (role === "antisense") return "Antisense strand sequence";
  return role;
}
