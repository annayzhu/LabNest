import { AlertTriangle, CheckSquare2, FileImage, FileText, Link2, Table2 } from "lucide-react";
import { ProtocolTimer } from "@/components/ProtocolTimer";
import { cn } from "@/lib/cn";
import type { ProtocolContentBlock, ProtocolDocument, ProtocolRichTextNode, ProtocolRichTextRun } from "@/lib/protocol-document";
import { checkResultTemplate, normalizeResultTemplate, resultTemplateCardinalityLabel, RESULT_VIEW_PRESETS } from "@/lib/result-templates";

function safeLink(value: string | undefined) {
  if (!value) return undefined;
  const trimmed = value.trim();
  return /^(https?:\/\/|mailto:|\/)/i.test(trimmed) ? trimmed : undefined;
}

function RichRun({ run }: { run: ProtocolRichTextRun }) {
  let content: React.ReactNode = run.text;
  if (run.code) content = <code className="rounded bg-stone px-1 py-0.5 font-mono text-[0.86em]">{content}</code>;
  if (run.bold) content = <strong>{content}</strong>;
  if (run.italic) content = <em>{content}</em>;
  if (run.underline) content = <u>{content}</u>;
  if (run.strike) content = <s>{content}</s>;
  const href = safeLink(run.link);
  if (href) content = <a href={href} className="font-medium text-moss underline decoration-moss/40 underline-offset-2">{content}</a>;
  return content;
}

function NodeContent({ node }: { node: ProtocolRichTextNode }) {
  return <>{node.content.map((run, index) => <RichRun key={index} run={run} />)}</>;
}

function RichTextContent({ nodes }: { nodes: ProtocolRichTextNode[] }) {
  const rendered: React.ReactNode[] = [];
  for (let index = 0; index < nodes.length;) {
    const node = nodes[index];
    if (node.type === "bullet" || node.type === "numbered") {
      const type = node.type;
      const items: ProtocolRichTextNode[] = [];
      while (nodes[index]?.type === type) { items.push(nodes[index]); index += 1; }
      const List = type === "bullet" ? "ul" : "ol";
      rendered.push(<List key={`list-${index}`} className={type === "bullet" ? "list-disc space-y-1 pl-6" : "list-decimal space-y-1 pl-6"}>{items.map((item, itemIndex) => <li key={itemIndex}><NodeContent node={item} /></li>)}</List>);
      continue;
    }
    if (node.type === "heading2") rendered.push(<h3 key={index} className="pt-2 font-serif text-xl font-medium text-ink"><NodeContent node={node} /></h3>);
    else if (node.type === "heading3") rendered.push(<h4 key={index} className="pt-1 text-base font-semibold text-ink"><NodeContent node={node} /></h4>);
    else if (node.type === "quote") rendered.push(<blockquote key={index} className="border-l-2 border-sage pl-4 italic text-muted"><NodeContent node={node} /></blockquote>);
    else rendered.push(<p key={index} className="whitespace-pre-wrap"><NodeContent node={node} /></p>);
    index += 1;
  }
  return <div className="space-y-3 text-sm leading-7 text-graphite">{rendered}</div>;
}

function ContentBlock({ block }: { block: ProtocolContentBlock }) {
  if (block.type === "heading") return <h3 className="pt-2 font-serif text-lg font-medium text-ink">{block.text}</h3>;
  if (block.type === "text") return <p className="whitespace-pre-wrap text-sm leading-7 text-graphite">{block.text}</p>;
  if (block.type === "rich_text") return <RichTextContent nodes={block.nodes} />;
  if (block.type === "checklist") {
    return <ul className="space-y-2">{block.items.filter(Boolean).map((item, index) => <li key={`${block.id}-${index}`} className="flex gap-3 text-sm leading-6 text-graphite"><CheckSquare2 className="mt-1 h-4 w-4 shrink-0 text-moss" aria-hidden /><span>{item}</span></li>)}</ul>;
  }
  if (block.type === "callout") {
    return <div className={cn("flex gap-3 rounded-[9px] border px-4 py-3 text-sm leading-6", block.tone === "critical" ? "border-error/40 bg-error-surface text-error" : block.tone === "warning" ? "border-warning/40 bg-warning-surface text-graphite" : "border-info/30 bg-info-surface text-graphite")}><AlertTriangle className="mt-1 h-4 w-4 shrink-0" aria-hidden /><span>{block.text}</span></div>;
  }
  if (block.type === "media") {
    const href = safeLink(block.url);
    return <div className="flex items-start gap-3 rounded-[9px] border border-hairline bg-warm px-4 py-3"><FileImage className="mt-0.5 h-4 w-4 text-moss" aria-hidden /><div><p className="text-sm font-medium capitalize text-ink">{block.caption || block.mediaType}</p>{href ? <a href={href} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-moss hover:underline"><Link2 className="h-3.5 w-3.5" />Open {block.mediaType}</a> : <p className="mt-1 text-xs text-error">Media URL is missing or unsupported.</p>}</div></div>;
  }
  if (block.type === "timer") return <ProtocolTimer label={block.label} durationMinutes={block.durationMinutes} notes={block.notes} />;

  const columnCount = Math.max(1, ...block.rows.map((row) => row.length));
  const template = block.resultTemplate ? normalizeResultTemplate(block.resultTemplate) : undefined;
  const templateCheck = template ? checkResultTemplate(template) : undefined;
  const preset = template ? RESULT_VIEW_PRESETS[template.view?.preset ?? "generic"] : undefined;
  return <figure className="space-y-2">
    {template ? <div className="rounded-[8px] border border-sage/40 bg-sage-surface/50 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold text-ink">{template.title ?? template.result_type}</p><p className="mt-1 text-xs text-muted">{template.templateKey} · {resultTemplateCardinalityLabel(template.cardinality)} · {preset?.label}</p></div><span className={`rounded-full px-2 py-1 text-xs font-semibold ${templateCheck?.status === "complete" ? "bg-success-surface text-success" : templateCheck?.status === "warning" ? "bg-warning-surface text-warning" : "bg-error-surface text-error"}`}>{templateCheck?.status}</span></div>{template.description ? <p className="mt-2 text-xs leading-5 text-graphite">{template.description}</p> : null}{templateCheck && (templateCheck.errors.length || templateCheck.warnings.length) ? <ul className="mt-2 list-disc pl-5 text-xs text-graphite">{[...templateCheck.errors, ...templateCheck.warnings].map((message) => <li key={message}>{message}</li>)}</ul> : null}</div> : null}
    {block.caption ? <figcaption className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted"><Table2 className="h-4 w-4" aria-hidden />{block.caption}</figcaption> : null}<div className="max-h-[480px] overflow-auto rounded-[9px] border border-hairline editorial-scrollbar"><table className="min-w-full border-collapse text-left text-sm"><tbody className="divide-y divide-hairline">{block.rows.map((row, rowIndex) => <tr key={`${block.id}-${rowIndex}`} className={rowIndex === 0 ? "sticky top-0 z-10 bg-stone text-ink" : "bg-surface even:bg-warm/70"}>{Array.from({ length: columnCount }).map((_, columnIndex) => { const Cell = rowIndex === 0 ? "th" : "td"; return <Cell key={columnIndex} className="min-w-36 border-r border-hairline px-3 py-2 align-top last:border-r-0">{row[columnIndex] ?? ""}</Cell>; })}</tr>)}</tbody></table></div>
  </figure>;
}

export function ProtocolDocumentView({ document }: { document: ProtocolDocument }) {
  return <div className="grid gap-6 xl:grid-cols-[190px_minmax(0,1fr)]">
    <nav aria-label="Protocol sections" className="hidden xl:block"><div className="sticky top-24 space-y-1 border-l border-hairline pl-3">{document.sections.map((section) => <a key={section.key} href={`#${section.key}`} className="focus-ring block rounded-[7px] px-2 py-1.5 text-sm text-muted hover:bg-warm hover:text-moss">{section.title}</a>)}</div></nav>
    <div className="min-w-0 space-y-5">
      {document.importWarnings.length ? <div className="rounded-[10px] border border-warning/40 bg-warning-surface p-4"><h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><AlertTriangle className="h-4 w-4 text-warning" aria-hidden />Import review required</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-graphite">{document.importWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}
      {document.sections.map((section) => <section key={section.key} id={section.key} className="scroll-mt-24 rounded-[12px] border border-hairline bg-surface shadow-paper"><header className="flex items-center gap-2 border-b border-hairline px-5 py-3"><FileText className="h-4 w-4 text-moss" aria-hidden /><h2 className="font-serif text-xl font-medium text-ink">{section.title}</h2></header><div className="space-y-4 p-5">{section.blocks.length ? section.blocks.map((block) => <ContentBlock key={block.id} block={block} />) : <p className="text-sm text-muted">Not recorded.</p>}</div></section>)}
    </div>
  </div>;
}
