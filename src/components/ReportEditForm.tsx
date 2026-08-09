import { ScientificDocumentEditor } from "@/components/ScientificDocumentEditor";
import { formInputClass, formLabelClass } from "@/components/forms";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatusRadioGroup } from "@/components/ui/StatusRadioGroup";
import { TagFieldLabel } from "@/components/TagFieldLabel";
import type { ScientificDocument } from "@/lib/scientific-document";
import { reportStatusOptions } from "@/lib/status-options";

export function ReportEditForm({ action, initial }: { action: (formData: FormData) => void | Promise<void>; initial: { id: string; projectId: string; researchPlanId: string | null; projectName: string; researchPlanTitle?: string; title: string; status: string; periodStart: string; periodEnd: string; tags: string[]; document: ScientificDocument } }) {
  return <form action={action} className="space-y-5"><input type="hidden" name="id" value={initial.id} /><input type="hidden" name="projectId" value={initial.projectId} /><input type="hidden" name="researchPlanId" value={initial.researchPlanId ?? ""} />
    <Card><CardHeader title="Report control" eyebrow="Scope is locked; narrative remains editable" /><CardBody className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="md:col-span-2"><span className={formLabelClass}>Scope</span><div className={`${formInputClass} flex items-center bg-stone/50`}>{initial.projectName}{initial.researchPlanTitle ? ` · ${initial.researchPlanTitle}` : " · Entire Project"}</div></label>
      <label className="md:col-span-2"><span className={formLabelClass}>Title</span><input required name="title" defaultValue={initial.title} className={formInputClass} /></label>
      <StatusRadioGroup label="Status" name="status" options={reportStatusOptions} defaultValue={initial.status} required className="md:col-span-2" />
      <label><span className={formLabelClass}>Period start</span><input name="periodStart" type="date" defaultValue={initial.periodStart} className={formInputClass} /></label><label><span className={formLabelClass}>Period end</span><input name="periodEnd" type="date" defaultValue={initial.periodEnd} className={formInputClass} /></label>
      <label><TagFieldLabel /><input name="tags" defaultValue={initial.tags.join(", ")} placeholder="monthly, internal-review" className={formInputClass} /></label>
    </CardBody></Card><ScientificDocumentEditor initialDocument={initial.document} /><div className="sticky bottom-4 z-20 flex justify-end"><button className="focus-ring h-11 rounded-[8px] border border-moss bg-moss px-5 text-sm font-medium text-warm shadow-soft">Save Report</button></div>
  </form>;
}
