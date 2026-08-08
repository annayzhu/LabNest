import { AlertTriangle, CheckSquare2, FileText, Table2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ProtocolContentBlock, ProtocolDocument } from "@/lib/protocol-document";

function ContentBlock({ block }: { block: ProtocolContentBlock }) {
  if (block.type === "heading") {
    return <h3 className="pt-2 font-serif text-lg font-medium text-ink">{block.text}</h3>;
  }
  if (block.type === "text") {
    return <p className="whitespace-pre-wrap text-sm leading-7 text-graphite">{block.text}</p>;
  }
  if (block.type === "checklist") {
    return (
      <ul className="space-y-2">
        {block.items.map((item, index) => (
          <li key={`${block.id}-${index}`} className="flex gap-3 text-sm leading-6 text-graphite">
            <CheckSquare2 className="mt-1 h-4 w-4 shrink-0 text-moss" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (block.type === "callout") {
    return (
      <div className={cn(
        "flex gap-3 rounded-[9px] border px-4 py-3 text-sm leading-6",
        block.tone === "critical" ? "border-error/40 bg-error-surface text-error" :
          block.tone === "warning" ? "border-warning/40 bg-warning-surface text-graphite" :
            "border-info/30 bg-info-surface text-graphite",
      )}>
        <AlertTriangle className="mt-1 h-4 w-4 shrink-0" aria-hidden />
        <span>{block.text}</span>
      </div>
    );
  }

  const columnCount = Math.max(1, ...block.rows.map((row) => row.length));
  return (
    <figure className="space-y-2">
      {block.caption ? <figcaption className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted"><Table2 className="h-4 w-4" aria-hidden />{block.caption}</figcaption> : null}
      <div className="max-h-[480px] overflow-auto rounded-[9px] border border-hairline editorial-scrollbar">
        <table className="min-w-full border-collapse text-left text-sm">
          <tbody className="divide-y divide-hairline">
            {block.rows.map((row, rowIndex) => (
              <tr key={`${block.id}-${rowIndex}`} className={rowIndex === 0 ? "sticky top-0 z-10 bg-stone text-ink" : "bg-surface even:bg-warm/70"}>
                {Array.from({ length: columnCount }).map((_, columnIndex) => {
                  const Cell = rowIndex === 0 ? "th" : "td";
                  return <Cell key={columnIndex} className="min-w-36 border-r border-hairline px-3 py-2 align-top last:border-r-0">{row[columnIndex] ?? ""}</Cell>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

export function ProtocolDocumentView({ document }: { document: ProtocolDocument }) {
  return (
    <div className="grid gap-6 xl:grid-cols-[190px_minmax(0,1fr)]">
      <nav aria-label="Protocol sections" className="hidden xl:block">
        <div className="sticky top-24 space-y-1 border-l border-hairline pl-3">
          {document.sections.map((section) => (
            <a key={section.key} href={`#${section.key}`} className="focus-ring block rounded-[7px] px-2 py-1.5 text-sm text-muted hover:bg-warm hover:text-moss">{section.title}</a>
          ))}
        </div>
      </nav>
      <div className="min-w-0 space-y-5">
        {document.importWarnings.length ? (
          <div className="rounded-[10px] border border-warning/40 bg-warning-surface p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><AlertTriangle className="h-4 w-4 text-warning" aria-hidden />Import review required</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-graphite">{document.importWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          </div>
        ) : null}
        {document.sections.map((section) => (
          <section key={section.key} id={section.key} className="scroll-mt-24 rounded-[12px] border border-hairline bg-surface shadow-paper">
            <header className="flex items-center gap-2 border-b border-hairline px-5 py-3">
              <FileText className="h-4 w-4 text-moss" aria-hidden />
              <h2 className="font-serif text-xl font-medium text-ink">{section.title}</h2>
            </header>
            <div className="space-y-4 p-5">
              {section.blocks.length ? section.blocks.map((block) => <ContentBlock key={block.id} block={block} />) : <p className="text-sm text-muted">Not recorded.</p>}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
