"use client";

import { useActionState, useState } from "react";
import { ScientificDocumentEditor } from "@/components/ScientificDocumentEditor";
import { DocumentEditorLayout } from "@/components/DocumentEditorLayout";
import { formInputClass, formLabelClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatusRadioGroup } from "@/components/ui/StatusRadioGroup";
import { TagFieldLabel } from "@/components/TagFieldLabel";
import type { ScientificDocument } from "@/lib/scientific-document";
import type { FormAction, FormActionState } from "@/lib/form-actions";
import { reportStatusOptions } from "@/lib/status-options";

const initialState: FormActionState = {};

export function ReportEditForm({ action, initial }: { action: FormAction; initial: { id: string; projectId: string; researchPlanId: string | null; projectName: string; researchPlanTitle?: string; title: string; status: string; periodStart: string; periodEnd: string; tags: string[]; document: ScientificDocument } }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [title, setTitle] = useState(initial.title);
  const [status, setStatus] = useState(initial.status);
  const [periodStart, setPeriodStart] = useState(initial.periodStart);
  const [periodEnd, setPeriodEnd] = useState(initial.periodEnd);
  const scope = `${initial.projectName}${initial.researchPlanTitle ? ` · ${initial.researchPlanTitle}` : " · Entire Project"}`;
  const period = [periodStart, periodEnd].filter(Boolean).join(" – ") || "Not specified";
  return <form action={formAction} className="space-y-5"><input type="hidden" name="id" value={initial.id} /><input type="hidden" name="projectId" value={initial.projectId} /><input type="hidden" name="researchPlanId" value={initial.researchPlanId ?? ""} />
    <DocumentEditorLayout storageKey="labnest.report.settings-open"><div className="document-editor-main"><ScientificDocumentEditor initialDocument={initial.document} documentType="Report" title={title} titlePlaceholder="Untitled Report" headerFacts={[
      { label: "Scope", value: scope },
      { label: "Status", value: status.replaceAll("_", " ") },
      { label: "Period", value: period },
    ]} /></div><aside className="document-editor-sidebar" aria-label="Report properties"><Card><CardHeader title="Report control" eyebrow="Scope is locked; narrative remains editable" /><CardBody className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="md:col-span-2"><span className={formLabelClass}>Scope</span><div className={`${formInputClass} flex items-center bg-stone/50`}>{scope}</div></label>
      <label className="md:col-span-2"><span className={formLabelClass}>Title</span><input required name="title" value={title} onChange={(event) => setTitle(event.target.value)} className={formInputClass} /></label>
      <StatusRadioGroup label="Status" name="status" options={reportStatusOptions} value={status} onValueChange={setStatus} required className="md:col-span-2" />
      <label><span className={formLabelClass}>Period start</span><input name="periodStart" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} className={formInputClass} /></label><label><span className={formLabelClass}>Period end</span><input name="periodEnd" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} className={formInputClass} /></label>
      <label><TagFieldLabel /><input name="tags" defaultValue={initial.tags.join(", ")} placeholder="monthly, internal-review" className={formInputClass} /></label>
    </CardBody></Card></aside></DocumentEditorLayout><div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-end gap-3">{state.error ? <p role="alert" className="max-w-xl rounded-[var(--ln-radius-control-lg)] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error shadow-soft">{state.error}</p> : null}<Button type="submit" variant="primary" size="lg" disabled={pending} className="shadow-soft">{pending ? "Saving…" : "Save Report"}</Button></div>
  </form>;
}
