"use client";

import { useActionState, useState } from "react";
import { formInputClass, formLabelClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { TagFieldLabel } from "@/components/TagFieldLabel";
import type { FormAction, FormActionState } from "@/lib/form-actions";

type Project = { id: string; name: string };
type Plan = { id: string; projectId: string; code: string | null; title: string };
const initialState: FormActionState = {};

export function ReportCreateForm({ action, projects, plans }: { action: FormAction; projects: Project[]; plans: Plan[] }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const visiblePlans = plans.filter((plan) => plan.projectId === projectId);
  return <form action={formAction} className="space-y-5"><Card><CardHeader title="Report scope" eyebrow="Deterministic source snapshot; editable narrative" /><CardBody className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    <label><span className={formLabelClass}>Project</span><select required name="projectId" value={projectId} onChange={(event) => setProjectId(event.target.value)} className={formInputClass}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
    <label><span className={formLabelClass}>Research Plan scope</span><select name="researchPlanId" defaultValue="" className={formInputClass}><option value="">Entire Project</option>{visiblePlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.code ?? plan.title} · {plan.title}</option>)}</select></label>
    <label className="md:col-span-2"><span className={formLabelClass}>Title</span><input required name="title" placeholder="Project evidence report" className={formInputClass} /></label>
    <label><span className={formLabelClass}>Period start</span><input type="date" name="periodStart" className={formInputClass} /></label><label><span className={formLabelClass}>Period end</span><input type="date" name="periodEnd" className={formInputClass} /></label>
    <label className="md:col-span-2"><TagFieldLabel /><input name="tags" className={formInputClass} placeholder="monthly, internal-review" /></label>
  </CardBody></Card><div className="flex flex-wrap items-center justify-end gap-3">{state.error ? <p role="alert" className="max-w-xl rounded-[var(--ln-radius-control-lg)] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error">{state.error}</p> : null}<Button type="submit" variant="primary" size="lg" disabled={pending} aria-busy={pending}>{pending ? "Creating…" : "Create traceable draft"}</Button></div></form>;
}
