import { ScientificDocumentEditor } from "@/components/ScientificDocumentEditor";
import { formInputClass, formLabelClass, formTextareaClass } from "@/components/forms";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { ScientificDocument } from "@/lib/scientific-document";

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
    design?: string | null;
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
          <label><span className={formLabelClass}>Plan code</span><input name="code" defaultValue={initial.code ?? ""} placeholder="RP-001" className={formInputClass} /></label>
          <label><span className={formLabelClass}>Status</span><select name="status" defaultValue={initial.status ?? "draft"} className={formInputClass}><option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="archived">Archived</option></select></label>
          <label className="md:col-span-2 xl:col-span-3"><span className={formLabelClass}>Title</span><input required name="title" defaultValue={initial.title ?? ""} className={formInputClass} /></label>
          <label className="md:col-span-2 xl:col-span-3"><span className={formLabelClass}>Tags</span><input name="tags" defaultValue={(initial.tags ?? []).join(", ")} placeholder="comma, separated" className={formInputClass} /></label>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Scientific logic" eyebrow="Question → hypothesis → design" />
        <CardBody className="grid gap-4 md:grid-cols-2">
          <label><span className={formLabelClass}>Objective</span><textarea name="objective" defaultValue={initial.objective ?? ""} className={formTextareaClass} /></label>
          <label><span className={formLabelClass}>Hypothesis</span><textarea name="hypothesis" defaultValue={initial.hypothesis ?? ""} className={formTextareaClass} /></label>
          <label><span className={formLabelClass}>Rationale</span><textarea name="rationale" defaultValue={initial.rationale ?? ""} className={formTextareaClass} /></label>
          <label><span className={formLabelClass}>Design</span><textarea name="design" defaultValue={initial.design ?? ""} className={formTextareaClass} /></label>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Protocol set" eyebrow="General or project-adapted methods" />
        <CardBody className="space-y-4">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {protocols.map((protocol) => <label key={protocol.id} className="flex gap-3 rounded-[8px] border border-hairline bg-warm px-3 py-3 text-sm text-graphite"><input type="checkbox" name="protocolIds" value={protocol.id} defaultChecked={selected.has(protocol.id)} className="mt-1" /><span><strong className="block font-medium text-ink">{protocol.humanCode ?? protocol.title}</strong><span className="text-xs text-muted">{protocol.title} · {protocol.scope}</span></span></label>)}
          </div>
          <label className="block"><span className={formLabelClass}>Primary protocol</span><select name="primaryProtocolId" defaultValue={initial.primaryProtocolId ?? ""} className={formInputClass}><option value="">No primary protocol</option>{protocols.map((protocol) => <option key={protocol.id} value={protocol.id}>{protocol.humanCode ?? protocol.title} · {protocol.title}</option>)}</select></label>
        </CardBody>
      </Card>

      <ScientificDocumentEditor initialDocument={initial.document} />
      <div className="sticky bottom-4 z-20 flex justify-end"><button className="focus-ring h-11 rounded-[8px] border border-moss bg-moss px-5 text-sm font-medium text-warm shadow-soft">Save Research Plan</button></div>
    </form>
  );
}
