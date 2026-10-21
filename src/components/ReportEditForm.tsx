"use client";

import { useActionState, useState } from "react";
import { ScientificDocumentEditor } from "@/components/ScientificDocumentEditor";
import { DocumentEditorLayout } from "@/components/DocumentEditorLayout";
import { formInputClass, formLabelClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Disclosure } from "@/components/ui/Disclosure";
import { StatusRadioGroup } from "@/components/ui/StatusRadioGroup";
import { TagFieldLabel } from "@/components/TagFieldLabel";
import type { ScientificDocument } from "@/lib/scientific-document";
import type { FormAction, FormActionState } from "@/lib/form-actions";
import { reportStatusOptions } from "@/lib/status-options";

const initialState: FormActionState = {};

export function ReportEditForm({ action, initial }: { action: FormAction; initial: { id: string; updatedAt?: Date | string; projectId: string; researchPlanId: string | null; projectName: string; researchPlanTitle?: string; title: string; status: string; periodStart: string; periodEnd: string; tags: string[]; document: ScientificDocument } }) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [title, setTitle] = useState(initial.title);
  const [status, setStatus] = useState(initial.status);
  const [periodStart, setPeriodStart] = useState(initial.periodStart);
  const [periodEnd, setPeriodEnd] = useState(initial.periodEnd);
  const scope = `${initial.projectName}${initial.researchPlanTitle ? ` · ${initial.researchPlanTitle}` : " · Entire Project"}`;
  const period = [periodStart, periodEnd].filter(Boolean).join(" – ") || "Not specified";
  return <form inert={pending} aria-busy={pending} action={formAction} className="space-y-5"><input type="hidden" name="id" value={initial.id} />{initial.updatedAt ? <input type="hidden" name="expectedUpdatedAt" value={new Date(initial.updatedAt).toISOString()} /> : null}<input type="hidden" name="projectId" value={initial.projectId} /><input type="hidden" name="researchPlanId" value={initial.researchPlanId ?? ""} />
    <DocumentEditorLayout><div className="document-editor-main"><ScientificDocumentEditor initialDocument={initial.document} documentType="Report" title={title} titlePlaceholder="Untitled Report" titleEditor={<input required value={title} onChange={(event) => setTitle(event.target.value)} className="document-page-title-input" placeholder="Untitled Report" aria-label="Report title" />} headerFacts={[
      { label: "Scope", value: scope },
      { label: "Status", value: status.replaceAll("_", " ") },
      { label: "Period", value: period },
    ]} /></div><aside className="document-editor-sidebar" data-document-metadata="true" aria-label="Report metadata"><Card><CardBody className="grid gap-4">
      <input type="hidden" name="title" value={title} />
      <label><span className={formLabelClass}>Scope</span><div className={`${formInputClass} flex items-center bg-stone/50`}>{scope}</div></label>
      <div className="grid grid-cols-2 gap-3"><label><span className={formLabelClass}>Period start</span><input name="periodStart" type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} className={formInputClass} /></label><label><span className={formLabelClass}>Period end</span><input name="periodEnd" type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} className={formInputClass} /></label></div>
    </CardBody></Card><Disclosure title="Status and tags" summary={status.replaceAll("_", " ")}>
      <StatusRadioGroup label="Status" name="status" options={reportStatusOptions} value={status} onValueChange={setStatus} required />
      <label><TagFieldLabel /><input name="tags" defaultValue={initial.tags.join(", ")} placeholder="monthly, internal-review" className={formInputClass} /></label>
    </Disclosure></aside></DocumentEditorLayout><div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-end gap-3">{state.error ? <p role="alert" className="max-w-xl rounded-[var(--ln-radius-control-lg)] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error shadow-soft">{state.error}</p> : null}<Button type="submit" variant="primary" size="lg" disabled={pending} aria-busy={pending} className="shadow-soft">{pending ? "Saving…" : "Save Report"}</Button></div>
  </form>;
}
