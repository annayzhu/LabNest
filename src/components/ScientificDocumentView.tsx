import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { ScientificContentBlock, ScientificDocument } from "@/lib/scientific-document";

export function ScientificDocumentView({
  document,
  showEmptySections = false,
}: {
  document: ScientificDocument;
  showEmptySections?: boolean;
}) {
  const populatedSections = document.sections.filter((section) => section.blocks.length > 0);
  const displayedSections = showEmptySections ? document.sections : populatedSections;

  if (!displayedSections.length) {
    return (
      <Card>
        <CardHeader title="Structured record" eyebrow="Flexible content" />
        <CardBody className="py-4">
          <p className="text-sm text-muted">No structured sections have been recorded yet.</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {displayedSections.map((section) => (
        <Card key={section.key}>
          <CardHeader title={<span className={section.key === "constraints" ? "text-error" : undefined}>{section.title}</span>} eyebrow="Structured record" />
          <CardBody className="space-y-4">
            {section.blocks.length
              ? section.blocks.map((block) => <BlockView key={block.id} block={block} />)
              : <p className="text-sm text-muted">Not recorded.</p>}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function BlockView({ block }: { block: ScientificContentBlock }) {
  if (block.type === "heading") return <h3 className="font-serif text-xl font-medium text-ink">{block.text}</h3>;
  if (block.type === "text") return <p className="whitespace-pre-wrap text-sm leading-7 text-graphite">{block.text}</p>;
  if (block.type === "checklist") return <ul className="space-y-2">{block.items.filter(Boolean).map((item, index) => <li key={`${block.id}-${index}`} className="flex gap-2 text-sm leading-6 text-graphite"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-moss" />{item}</li>)}</ul>;
  if (block.type === "table") return <div className="overflow-x-auto"><table className="min-w-full border-collapse text-left text-sm"><caption className="mb-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-muted">{block.caption}</caption><tbody>{block.rows.map((row, rowIndex) => <tr key={`${block.id}-${rowIndex}`} className={rowIndex === 0 ? "bg-stone/70 font-semibold text-ink" : "border-t border-hairline text-graphite"}>{row.map((cell, cellIndex) => <td key={`${block.id}-${rowIndex}-${cellIndex}`} className="max-w-md whitespace-pre-wrap px-3 py-2 align-top">{cell}</td>)}</tr>)}</tbody></table></div>;
  if (block.type === "callout") return <div className={`rounded-[9px] border px-4 py-3 text-sm leading-6 ${block.tone === "critical" ? "border-error/30 bg-error-surface text-error" : block.tone === "warning" ? "border-warning/30 bg-warning-surface text-warning" : "border-hairline bg-sage-surface text-graphite"}`}>{block.text}</div>;
  if (block.type === "metric") return <div className="inline-flex min-w-40 flex-col border-l-2 border-moss pl-3"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{block.label}</span><span className="mt-1 font-serif text-2xl text-ink">{block.value} <small className="text-sm text-muted">{block.unit}</small></span></div>;
  if (block.type === "media") return <div className="rounded-[9px] border border-hairline bg-warm p-3"><div className="flex items-center gap-2"><Badge>{block.mediaType}</Badge><Link href={block.url || "#"} className="break-all text-sm font-medium text-moss hover:underline">{block.caption || block.url || "Media reference not set"}</Link></div></div>;
  return <Link href={`/api/results/datasets/${block.datasetId}`} className="text-sm font-medium text-moss hover:underline">Dataset: {block.label}</Link>;
}
