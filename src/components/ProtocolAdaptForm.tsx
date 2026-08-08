"use client";

import { useActionState, useState } from "react";
import { adaptProtocolToProject, type ProtocolAdaptState } from "@/app/protocols/[id]/adapt/actions";

const initialState: ProtocolAdaptState = {};
const inputClass = "focus-ring mt-2 h-11 w-full rounded-[8px] border border-hairline bg-warm px-3 text-sm text-ink";
const textareaClass = "focus-ring mt-2 min-h-28 w-full resize-y rounded-[8px] border border-hairline bg-warm p-3 text-sm leading-6 text-ink";

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
      <label className="md:col-span-2"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Adapted Protocol title</span><input required name="canonicalTitle" defaultValue={`${sourceTitle} — Project adaptation`} className={inputClass} /></label>
      <label><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Project</span><select required name="projectId" value={projectId} onChange={(event) => setProjectId(event.target.value)} className={inputClass}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      <label><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Research Plan</span><select required name="researchPlanId" className={inputClass}><option value="">Select a plan</option>{availablePlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.code ? `${plan.code} · ` : ""}{plan.title}</option>)}</select></label>
      <label><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Initial version</span><input required name="displayVersion" defaultValue="0.1" className={inputClass} /></label>
      <label className="md:col-span-2"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Adaptation rationale</span><textarea required name="adaptationRationale" className={textareaClass} placeholder="State the project objective and exactly why the General Protocol needs adaptation." /></label>
      {state.error ? <p role="alert" className="md:col-span-2 rounded-[8px] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error">{state.error}</p> : null}
      <div className="md:col-span-2 flex justify-end"><button disabled={pending || !projects.length} className="focus-ring h-10 rounded-[8px] border border-moss bg-moss px-4 text-sm font-medium text-warm disabled:opacity-60">{pending ? "Creating…" : "Create project Protocol"}</button></div>
    </form>
  );
}
