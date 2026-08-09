import { ChevronDown } from "lucide-react";
import { ScientificDocumentEditor } from "@/components/ScientificDocumentEditor";
import { RecordCodeField } from "@/components/RecordCodeField";
import { TagFieldLabel } from "@/components/TagFieldLabel";
import { formInputClass, formLabelClass, formTextareaClass } from "@/components/forms";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatusRadioGroup } from "@/components/ui/StatusRadioGroup";
import type { ScientificDocument } from "@/lib/scientific-document";
import { researchPlanStatusOptions } from "@/lib/status-options";

type ProjectOption = { id: string; name: string };
type ProtocolOption = { id: string; humanCode: string | null; title: string; scope: string; projectId: string | null };

export function ResearchPlanForm({
  action,
  projects,
  protocols,
  initial,
}: {
  action: (formData: FormData) => void | Promise<void>;
  projects: ProjectOption[];
  protocols: ProtocolOption[];
  initial: {
    id?: string;
    projectId?: string;
    code?: string | null;
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
  const selected = new Set(initial.selectedProtocolIds ?? []);
  return (
    <form action={action} className="space-y-5">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <Card>
        <CardHeader title="Plan identity" eyebrow="Project-level scientific design" />
        <CardBody className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label><span className={formLabelClass}>Project</span><select required name="projectId" defaultValue={initial.projectId ?? ""} className={formInputClass}><option value="" disabled>Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <RecordCodeField label="Plan code" prefix="RP-" name="codeSuffix" minimumDigits={3} placeholder="001" existingCode={initial.id ? initial.code : undefined} />
          <StatusRadioGroup label="Status" name="status" options={researchPlanStatusOptions} defaultValue={initial.status ?? "draft"} required />
          <label className="md:col-span-2 xl:col-span-3"><span className={formLabelClass}>Title</span><input required name="title" defaultValue={initial.title ?? ""} className={formInputClass} /></label>
          <label className="md:col-span-2 xl:col-span-3"><TagFieldLabel /><input name="tags" defaultValue={(initial.tags ?? []).join(", ")} placeholder="RNA, qPCR, imaging" className={formInputClass} /></label>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Scientific logic" eyebrow="Question → hypothesis → design" />
        <CardBody className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label><span className={formLabelClass}>Objective</span><textarea name="objective" defaultValue={initial.objective ?? ""} className={formTextareaClass} /></label>
          <label><span className={formLabelClass}>Hypothesis</span><textarea name="hypothesis" defaultValue={initial.hypothesis ?? ""} className={formTextareaClass} /></label>
          <label><span className={formLabelClass}>Rationale</span><textarea name="rationale" defaultValue={initial.rationale ?? ""} className={formTextareaClass} /></label>
        </CardBody>
      </Card>

      <details className="group rounded-[12px] border border-hairline bg-surface shadow-paper">
        <summary className="focus-ring flex h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-[12px] px-4 [&::-webkit-details-marker]:hidden">
          <h2 className="font-serif text-[17px] font-medium leading-tight text-ink">Protocol set</h2>
          <span className="flex items-center gap-2 text-xs font-medium text-muted"><span className="group-open:hidden">Expand</span><span className="hidden group-open:inline">Collapse</span><ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></span>
        </summary>
        <div className="space-y-3 border-t border-hairline/80 p-4">
          <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-4">
            {protocols.map((protocol) => <label key={protocol.id} className="flex min-h-10 items-start gap-2 rounded-[7px] border border-hairline bg-warm/70 px-2.5 py-2 text-xs text-graphite"><input type="checkbox" name="protocolIds" value={protocol.id} defaultChecked={selected.has(protocol.id)} className="mt-0.5" /><span className="min-w-0"><strong className="block truncate font-medium text-ink">{protocol.humanCode ?? protocol.title}</strong><span className="block truncate text-[11px] text-muted">{protocol.humanCode ? `${protocol.title} · ` : ""}{protocol.scope}</span></span></label>)}
          </div>
          <label className="block"><span className={formLabelClass}>Primary protocol</span><select name="primaryProtocolId" defaultValue={initial.primaryProtocolId ?? ""} className={formInputClass}><option value="">No primary protocol</option>{protocols.map((protocol) => <option key={protocol.id} value={protocol.id}>{protocol.humanCode ?? protocol.title} · {protocol.title}</option>)}</select></label>
        </div>
      </details>

      <ScientificDocumentEditor initialDocument={initial.document} />
      <div className="sticky bottom-4 z-20 flex justify-end"><button className="focus-ring h-11 rounded-[8px] border border-moss bg-moss px-5 text-sm font-medium text-warm shadow-soft">Save Research Plan</button></div>
    </form>
  );
}
