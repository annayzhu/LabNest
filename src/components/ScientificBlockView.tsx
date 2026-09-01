import Link from "next/link";
import { EntryContentView } from "@/components/EntryContentView";
import { Badge } from "@/components/ui/Badge";
import { ResizableTableFrame } from "@/components/ui/ResizableTableFrame";
import { TiptapCellContentView } from "@/components/TiptapCellContentView";
import { cn } from "@/lib/cn";
import type { ScientificContentBlock } from "@/lib/scientific-document";

export function ScientificBlockView({ block }: { block: ScientificContentBlock }) {
  if (block.type === "heading") return <h3 className="document-content-heading font-serif font-medium text-ink">{block.text}</h3>;
  if (block.type === "text") return <EntryContentView markdown={block.text} compact />;
  if (block.type === "checklist") return <ul className="document-checklist">{block.items.filter(Boolean).map((item, index) => <li key={`${block.id}-${index}`} className="document-checklist-item text-sm text-graphite"><span className="document-checklist-icon h-1.5 w-1.5 rounded-full bg-moss" />{item}</li>)}</ul>;
  if (block.type === "table") {
    const [headerRow = [], ...bodyRows] = block.rows;
    const columnCount = Math.max(1, headerRow.length, ...bodyRows.map((row) => row.length));
    return <ResizableTableFrame storageKey={`scientific-block:${block.id}`} className="overflow-x-auto">
      <table className="document-three-line-table min-w-full table-fixed text-left text-sm">
        <colgroup>{Array.from({ length: columnCount }).map((_, columnIndex) => <col key={columnIndex} data-resizable-column-index={columnIndex} style={{ width: block.columnWidths?.[columnIndex] ? `${block.columnWidths[columnIndex]}px` : "var(--ln-document-table-col-width)" }} />)}</colgroup>
        <caption className="mb-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-muted">{block.caption}</caption>
        {headerRow.length ? <thead><tr>{Array.from({ length: columnCount }).map((_, cellIndex) => <th key={`${block.id}-header-${cellIndex}`} data-resizable-column-cell={cellIndex} scope="col" className={cn("max-w-sm whitespace-pre-wrap px-[var(--ln-document-table-cell-padding-x)] py-[var(--ln-document-table-cell-padding-y)] pr-4 align-top font-semibold", block.cellColors?.[0]?.[cellIndex] === "risk" && "text-error")} style={block.cellFontSizesPt?.[0]?.[cellIndex] ? { fontSize: `${block.cellFontSizesPt[0][cellIndex]}pt` } : undefined}><TiptapCellContentView content={block.cellRichContent?.[0]?.[cellIndex]} fallback={headerRow[cellIndex] ?? ""} /><span data-column-resize-handle={cellIndex} data-min-width="var(--ln-document-table-min-col-width)" aria-hidden /></th>)}</tr></thead> : null}
        <tbody>{bodyRows.map((row, rowIndex) => <tr key={`${block.id}-${rowIndex + 1}`} className="text-graphite">{Array.from({ length: columnCount }).map((_, cellIndex) => <td key={`${block.id}-${rowIndex + 1}-${cellIndex}`} className={cn("max-w-sm whitespace-pre-wrap px-[var(--ln-document-table-cell-padding-x)] py-[var(--ln-document-table-cell-padding-y)] align-top", block.cellColors?.[rowIndex + 1]?.[cellIndex] === "risk" && "text-error")} style={block.cellFontSizesPt?.[rowIndex + 1]?.[cellIndex] ? { fontSize: `${block.cellFontSizesPt[rowIndex + 1][cellIndex]}pt` } : undefined}><TiptapCellContentView content={block.cellRichContent?.[rowIndex + 1]?.[cellIndex]} fallback={row[cellIndex] ?? ""} /></td>)}</tr>)}</tbody>
      </table>
    </ResizableTableFrame>;
  }
  if (block.type === "callout") return <div className={`rounded-[9px] border px-4 py-3 ${block.tone === "critical" ? "border-error/30 bg-error-surface text-error" : block.tone === "warning" ? "border-warning/30 bg-warning-surface text-warning" : "border-hairline bg-sage-surface text-graphite"}`}><EntryContentView markdown={block.text} compact /></div>;
  if (block.type === "metric") return <div className="inline-flex min-w-40 flex-col border-l-2 border-moss pl-3"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{block.label}</span><span className="mt-1 font-serif text-2xl text-ink">{block.value} <small className="text-sm text-muted">{block.unit}</small></span></div>;
  if (block.type === "media") return <div className="rounded-[9px] border border-hairline bg-warm p-3"><div className="flex items-center gap-2"><Badge>{block.mediaType}</Badge><Link href={block.url || "#"} className="break-all text-sm font-medium text-moss hover:underline">{block.caption || block.url || "Media reference not set"}</Link></div></div>;
  return <Link href={`/api/results/datasets/${block.datasetId}`} className="text-sm font-medium text-moss hover:underline">Dataset: {block.label}</Link>;
}
