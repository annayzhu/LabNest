import Link from "next/link";
import { EntryContentView } from "@/components/EntryContentView";
import { DocumentMediaView } from "@/components/DocumentMediaView";
import { ScientificTableView } from "./ScientificTableView";
import type { ScientificContentBlock } from "@/lib/scientific-document";

export function ScientificBlockView({ block }: { block: ScientificContentBlock }) {
  if (block.execution) {
    const execution=block.execution;
    if(execution.role==="group")return <h3 className="document-execution-group font-semibold">{execution.title}</h3>;
    return <div className="document-execution-step" data-execution-role={execution.role}>
      <p className="flex items-start gap-2"><span aria-label={execution.completed?"Completed":"Not completed"} className="shrink-0">{execution.completed?"☑":"☐"}</span><span>{execution.title}</span></p>
      {execution.deviationNote ? <div className="mt-1 text-sm"><span className="mr-2 inline-block rounded border border-error px-1 text-xs text-error">{execution.deviationLabel}</span><span className="whitespace-pre-wrap text-error">{execution.deviationNote}</span>
        {execution.impact?<p className="mt-1 whitespace-pre-wrap text-graphite">影响评估：{execution.impact}</p>:null}
        {execution.author?<p className="mt-1 text-muted">记录人：{execution.author}</p>:null}
      </div>:null}
    </div>;
  }

  if (block.type === "heading") return <h3 className="document-content-heading font-serif font-medium text-ink">{block.text}</h3>;
  if (block.type === "text") return <EntryContentView markdown={block.text} compact />;
  if (block.type === "checklist") return <ul className="document-checklist">{block.items.filter(Boolean).map((item, index) => <li key={`${block.id}-${index}`} className="document-checklist-item text-sm text-graphite"><span className="document-checklist-icon h-1.5 w-1.5 rounded-full bg-moss" />{item}</li>)}</ul>;
  if (block.type === "table") return <ScientificTableView block={block} />;
  if (block.type === "callout") return <div className={`rounded-[var(--ln-radius-panel-inner)] border px-4 py-3 ${block.tone === "critical" ? "border-error/30 bg-error-surface text-error" : block.tone === "warning" ? "border-warning/30 bg-warning-surface text-warning" : "border-hairline bg-sage-surface text-graphite"}`}><EntryContentView markdown={block.text} compact /></div>;
  if (block.type === "metric") return <div className="inline-flex min-w-40 flex-col border-l-2 border-moss pl-3"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{block.label}</span><span className="mt-1 font-serif text-2xl text-ink">{block.value} <small className="text-sm text-muted">{block.unit}</small></span></div>;
  if (block.type === "media") return <DocumentMediaView block={block} />;
  return <Link href={`/api/results/datasets/${block.datasetId}`} className="text-sm font-medium text-moss hover:underline">Dataset: {block.label}</Link>;
}
