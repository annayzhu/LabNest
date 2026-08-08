import { ScientificDocumentEditor } from "@/components/ScientificDocumentEditor";
import { formInputClass, formLabelClass, formTextareaClass } from "@/components/forms";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { ScientificDocument } from "@/lib/scientific-document";

type ExperimentOption = { id: string; runCode: string | null; title: string; researchPlan: { code: string | null; title: string } | null; project: { name: string } | null };
export function ResultForm({ action, experiments, initial, lockedExperiment = false }: {
  action: (formData: FormData) => void | Promise<void>; experiments: ExperimentOption[]; lockedExperiment?: boolean;
  initial: { id?: string; experimentId?: string | null; title?: string; resultType?: string; recordStatus?: string; sourceType?: string; qualityStatus?: string; textValue?: string | null; numericValue?: number | null; unit?: string | null; analysisMethod?: string | null; notes?: string | null; document: ScientificDocument };
}) {
  const experiment = experiments.find((item) => item.id === initial.experimentId);
  return <form action={action} className="space-y-5">
    {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
    {lockedExperiment ? <input type="hidden" name="experimentId" value={initial.experimentId ?? ""} /> : null}
    <Card><CardHeader title="Result identity" eyebrow="Evidence from one Experiment" /><CardBody className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="md:col-span-2 xl:col-span-4"><span className={formLabelClass}>Experiment</span>{lockedExperiment ? <div className={`${formInputClass} flex items-center bg-stone/50`}>{experiment?.project?.name} · {experiment?.researchPlan?.code ?? experiment?.researchPlan?.title} · {experiment?.runCode ?? experiment?.title}</div> : <select required name="experimentId" defaultValue={initial.experimentId ?? ""} className={formInputClass}><option value="" disabled>Select Experiment</option>{experiments.map((item) => <option key={item.id} value={item.id}>{item.project?.name} · {item.researchPlan?.code ?? item.researchPlan?.title ?? "No plan"} · {item.runCode ?? item.title}</option>)}</select>}</label>
      <label className="md:col-span-2"><span className={formLabelClass}>Title</span><input required name="title" defaultValue={initial.title ?? ""} className={formInputClass} /></label>
      <label><span className={formLabelClass}>Result type</span><input required name="resultType" defaultValue={initial.resultType ?? "observation"} placeholder="qPCR, microscopy, cell count…" className={formInputClass} /></label>
      <label><span className={formLabelClass}>Source</span><select name="sourceType" defaultValue={initial.sourceType ?? "manual"} className={formInputClass}><option value="manual">Manual</option><option value="protocol_template">Protocol template</option><option value="file_import">File import</option><option value="tool">External tool</option><option value="analysis">Analysis</option></select></label>
      <label><span className={formLabelClass}>Record status</span><select name="recordStatus" defaultValue={initial.recordStatus ?? "draft"} className={formInputClass}><option value="draft">Draft</option><option value="recorded">Recorded</option><option value="submitted">Submitted</option><option value="reviewed">Reviewed</option></select></label>
      <label><span className={formLabelClass}>QC status</span><select name="qualityStatus" defaultValue={initial.qualityStatus ?? "not_assessed"} className={formInputClass}><option value="not_assessed">Not assessed</option><option value="pass">Pass</option><option value="warning">Warning</option><option value="fail">Fail</option></select></label>
      <label className="md:col-span-2"><span className={formLabelClass}>Analysis method / software</span><input name="analysisMethod" defaultValue={initial.analysisMethod ?? ""} placeholder="Method, version, parameters or tool" className={formInputClass} /></label>
      <label><span className={formLabelClass}>Key numeric value</span><input name="numericValue" type="number" step="any" defaultValue={initial.numericValue ?? ""} className={formInputClass} /></label>
      <label><span className={formLabelClass}>Unit</span><input name="unit" defaultValue={initial.unit ?? ""} className={formInputClass} /></label>
      <label className="md:col-span-2"><span className={formLabelClass}>Short text value</span><textarea name="textValue" defaultValue={initial.textValue ?? ""} className={formTextareaClass} /></label>
      <label className="md:col-span-2"><span className={formLabelClass}>Notes</span><textarea name="notes" defaultValue={initial.notes ?? ""} className={formTextareaClass} /></label>
    </CardBody></Card>
    <ScientificDocumentEditor initialDocument={initial.document} />
    <div className="sticky bottom-4 z-20 flex justify-end"><button className="focus-ring h-11 rounded-[8px] border border-moss bg-moss px-5 text-sm font-medium text-warm shadow-soft">Save Result</button></div>
  </form>;
}
