"use client";

import { useActionState, useState } from "react";
import { ScientificDocumentEditor } from "@/components/ScientificDocumentEditor";
import { RecordCodeField } from "@/components/RecordCodeField";
import { ResearchPlanPremiseView } from "@/components/ResearchPlanPremiseView";
import { ResearchPlanProtocolPicker } from "@/components/ResearchPlanProtocolPicker";
import { TagFieldLabel } from "@/components/TagFieldLabel";
import { formInputClass, formLabelClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatusRadioGroup } from "@/components/ui/StatusRadioGroup";
import type { ScientificDocument } from "@/lib/scientific-document";
import type { ResearchPlanProtocolOption } from "@/lib/research-plan-protocol-picker";
import { researchPlanStatusOptions } from "@/lib/status-options";

type ProjectOption = { id: string; name: string };
export type ResearchPlanFormState = { error?: string };
export type ResearchPlanFormAction = (
  previousState: ResearchPlanFormState,
  formData: FormData,
) => Promise<ResearchPlanFormState>;

const initialState: ResearchPlanFormState = {};

export function ResearchPlanForm({
  action,
  projects,
  protocols,
  initial,
}: {
  action: ResearchPlanFormAction;
  projects: ProjectOption[];
  protocols: ResearchPlanProtocolOption[];
  initial: {
    id?: string;
    projectId?: string;
    code?: string | null;
    suggestedCodeSuffix?: string;
    title?: string;
    objective?: string | null;
    hypothesis?: string | null;
    rationale?: string | null;
    status?: string;
    tags?: string[];
    selectedProtocolIds?: string[];
    primaryProtocolId?: string;
    document: ScientificDocument;
  };
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [title, setTitle] = useState(initial.title ?? "");
  const [projectId, setProjectId] = useState(initial.projectId ?? "");
  const [status, setStatus] = useState(initial.status ?? "draft");
  const [codeSuffix, setCodeSuffix] = useState(initial.suggestedCodeSuffix ?? "");
  const [objective, setObjective] = useState(initial.objective ?? "");
  const [hypothesis, setHypothesis] = useState(initial.hypothesis ?? "");
  const [rationale, setRationale] = useState(initial.rationale ?? "");
  const project = projects.find((item) => item.id === projectId);
  const identifier = initial.code ?? (codeSuffix ? `RP-${codeSuffix}` : "Draft Research Plan");

  return (
    <form action={formAction} className="space-y-5">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <div className="document-editor-layout">
        <div className="document-editor-main"><ScientificDocumentEditor initialDocument={initial.document} documentType="Research Plan" identifier={identifier} title={title} titlePlaceholder="Untitled Research Plan" headerFacts={[
          { label: "Project", value: project?.name ?? "Not selected" },
          { label: "Status", value: status.replaceAll("_", " ") },
        ]} leadingContent={<ResearchPlanPremiseEditor objective={objective} hypothesis={hypothesis} rationale={rationale} onObjectiveChange={setObjective} onHypothesisChange={setHypothesis} onRationaleChange={setRationale} />} /></div>
        <aside className="document-editor-sidebar" aria-label="Research Plan properties">
          <Card>
            <CardHeader title="Plan identity" eyebrow="Project-level scientific design" />
            <CardBody className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label><span className={formLabelClass}>Project</span><select required name="projectId" value={projectId} onChange={(event) => setProjectId(event.target.value)} className={formInputClass}><option value="" disabled>Select project</option>{projects.map((projectOption) => <option key={projectOption.id} value={projectOption.id}>{projectOption.name}</option>)}</select></label>
              <RecordCodeField label="Plan code" prefix="RP-" name="codeSuffix" minimumDigits={3} placeholder="001" value={codeSuffix} onValueChange={setCodeSuffix} existingCode={initial.id ? initial.code : undefined} />
              <StatusRadioGroup label="Status" name="status" options={researchPlanStatusOptions} value={status} onValueChange={setStatus} required />
              <label><span className={formLabelClass}>Title</span><input required name="title" value={title} onChange={(event) => setTitle(event.target.value)} className={formInputClass} /></label>
              <label><TagFieldLabel /><input name="tags" defaultValue={(initial.tags ?? []).join(", ")} placeholder="RNA, qPCR, imaging" className={formInputClass} /></label>
            </CardBody>
          </Card>
          <ResearchPlanProtocolPicker protocols={protocols} initialSelectedIds={initial.selectedProtocolIds} initialPrimaryProtocolId={initial.primaryProtocolId} />
        </aside>
      </div>
      <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-end gap-3">
        {state.error ? <p role="alert" className="max-w-xl rounded-[8px] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error shadow-soft">{state.error}</p> : null}
        <Button type="submit" variant="primary" size="lg" disabled={pending} className="shadow-soft">{pending ? "Saving…" : "Save Research Plan"}</Button>
      </div>
    </form>
  );
}

function ResearchPlanPremiseEditor({
  objective,
  hypothesis,
  rationale,
  onObjectiveChange,
  onHypothesisChange,
  onRationaleChange,
}: {
  objective: string;
  hypothesis: string;
  rationale: string;
  onObjectiveChange: (value: string) => void;
  onHypothesisChange: (value: string) => void;
  onRationaleChange: (value: string) => void;
}) {
  const fields = [
    { label: "Objective", name: "objective", value: objective, onChange: onObjectiveChange, placeholder: "What should this Research Plan establish?" },
    { label: "Hypothesis", name: "hypothesis", value: hypothesis, onChange: onHypothesisChange, placeholder: "State the testable expectation." },
    { label: "Rationale", name: "rationale", value: rationale, onChange: onRationaleChange, placeholder: "Why is this design appropriate?" },
  ];

  return (
    <>
      <section className="document-section research-plan-premise" data-print-hidden>
        <header className="mb-5"><h2 className="document-section-title font-serif font-medium text-ink">Scientific premise</h2></header>
        <div className="space-y-4">
          {fields.map((field) => (
            <label key={field.name} className="block">
              <span className="document-premise-label">{field.label}</span>
              <textarea name={field.name} value={field.value} onChange={(event) => field.onChange(event.target.value)} placeholder={field.placeholder} className="document-premise-editor focus-ring" />
            </label>
          ))}
        </div>
      </section>
      <div className="document-print-only"><ResearchPlanPremiseView objective={objective} hypothesis={hypothesis} rationale={rationale} /></div>
    </>
  );
}
