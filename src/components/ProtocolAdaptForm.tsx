"use client";

import { useActionState, useState } from "react";
import { adaptProtocolToProject, type ProtocolAdaptState } from "@/app/protocols/[id]/adapt/actions";
import { formInputClass, formLabelClass, formTextareaClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";

const initialState: ProtocolAdaptState = {};

export function ProtocolAdaptForm({
  protocolId,
  sourceVersionId,
  sourceTitle,
  projects,
  researchPlans,
}: {
  protocolId: string;
  sourceVersionId: string;
  sourceTitle: string;
  projects: { id: string; name: string }[];
  researchPlans: { id: string; projectId: string; code?: string; title: string }[];
}) {
  const [state, action, pending] = useActionState(adaptProtocolToProject, initialState);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const availablePlans = researchPlans.filter((plan) => plan.projectId === projectId);

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="protocolId" value={protocolId} />
      <input type="hidden" name="sourceVersionId" value={sourceVersionId} />
      <label className="md:col-span-2"><span className={formLabelClass}>Adapted Protocol title</span><input required name="canonicalTitle" defaultValue={`${sourceTitle} — Project adaptation`} className={formInputClass} /></label>
      <label><span className={formLabelClass}>Project</span><select required name="projectId" value={projectId} onChange={(event) => setProjectId(event.target.value)} className={formInputClass}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      <label><span className={formLabelClass}>Research Plan</span><select required name="researchPlanId" className={formInputClass}><option value="">Select a plan</option>{availablePlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.code ? `${plan.code} · ` : ""}{plan.title}</option>)}</select></label>
      <label><span className={formLabelClass}>Initial version</span><input required name="displayVersion" defaultValue="0.1" className={formInputClass} /></label>
      <label className="md:col-span-2"><span className={formLabelClass}>Adaptation rationale</span><textarea required name="adaptationRationale" className={`${formTextareaClass} min-h-28 resize-y`} placeholder="State the project objective and exactly why the General Protocol needs adaptation." /></label>
      {state.error ? <p role="alert" className="md:col-span-2 rounded-[8px] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error">{state.error}</p> : null}
      <div className="md:col-span-2 flex justify-end"><Button type="submit" variant="primary" size="lg" disabled={pending || !projects.length}>{pending ? "Creating…" : "Create project Protocol"}</Button></div>
    </form>
  );
}
