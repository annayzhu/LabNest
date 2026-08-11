import Link from "next/link";
import { EntryContentView } from "@/components/EntryContentView";
import { Badge } from "@/components/ui/Badge";
import type { ScientificContentBlock } from "@/lib/scientific-document";

export function ScientificBlockView({ block }: { block: ScientificContentBlock }) {
  if (block.type === "heading") return <h3 className="document-content-heading font-serif font-medium text-ink">{block.text}</h3>;
  if (block.type === "text") return <EntryContentView markdown={block.text} compact />;
  if (block.type === "checklist") return <ul className="space-y-2">{block.items.filter(Boolean).map((item, index) => <li key={`${block.id}-${index}`} className="flex gap-2 text-sm leading-6 text-graphite"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-moss" />{item}</li>)}</ul>;
  if (block.type === "table") {
    const [headerRow = [], ...bodyRows] = block.rows;
    return <div className="overflow-x-auto"><table className="document-three-line-table min-w-full text-left text-sm"><caption className="mb-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-muted">{block.caption}</caption>{headerRow.length ? <thead><tr>{headerRow.map((cell, cellIndex) => <th key={`${block.id}-header-${cellIndex}`} scope="col" className="max-w-md whitespace-pre-wrap px-3 py-2 align-top font-semibold">{cell}</th>)}</tr></thead> : null}<tbody>{bodyRows.map((row, rowIndex) => <tr key={`${block.id}-${rowIndex + 1}`} className="text-graphite">{row.map((cell, cellIndex) => <td key={`${block.id}-${rowIndex + 1}-${cellIndex}`} className="max-w-md whitespace-pre-wrap px-3 py-2 align-top">{cell}</td>)}</tr>)}</tbody></table></div>;
  }
  if (block.type === "callout") return <div className={`rounded-[9px] border px-4 py-3 ${block.tone === "critical" ? "border-error/30 bg-error-surface text-error" : block.tone === "warning" ? "border-warning/30 bg-warning-surface text-warning" : "border-hairline bg-sage-surface text-graphite"}`}><EntryContentView markdown={block.text} compact /></div>;
  if (block.type === "metric") return <div className="inline-flex min-w-40 flex-col border-l-2 border-moss pl-3"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{block.label}</span><span className="mt-1 font-serif text-2xl text-ink">{block.value} <small className="text-sm text-muted">{block.unit}</small></span></div>;
  if (block.type === "media") return <div className="rounded-[9px] border border-hairline bg-warm p-3"><div className="flex items-center gap-2"><Badge>{block.mediaType}</Badge><Link href={block.url || "#"} className="break-all text-sm font-medium text-moss hover:underline">{block.caption || block.url || "Media reference not set"}</Link></div></div>;
  return <Link href={`/api/results/datasets/${block.datasetId}`} className="text-sm font-medium text-moss hover:underline">Dataset: {block.label}</Link>;
}
