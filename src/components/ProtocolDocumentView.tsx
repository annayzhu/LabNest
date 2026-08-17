import { AlertTriangle, CheckSquare2, FileCheck2, FileImage, FileText, Link2, Table2 } from "lucide-react";
import { DocumentCanvas } from "@/components/DocumentCanvas";
import { DocumentPrintButton } from "@/components/DocumentPrintButton";
import { ProtocolTimer } from "@/components/ProtocolTimer";
import { ResultDatasetSchemaView } from "@/components/ResultDatasetSchemaView";
import { ResizableTableFrame } from "@/components/ui/ResizableTableFrame";
import { cn } from "@/lib/cn";
import { richTextPlainText, type ProtocolContentBlock, type ProtocolDocument, type ProtocolRichTextNode, type ProtocolRichTextRun } from "@/lib/protocol-document";
import { checkResultTemplate, fieldDataType, fieldSemanticRole, normalizeResultTemplate, resultTemplateCardinalityLabel, type ResultTemplateCheck } from "@/lib/result-templates";
import type { ResultTemplate, ResultTemplateArtifact, ResultTemplateField } from "@/lib/types";

function safeLink(value: string | undefined) {
  if (!value) return undefined;
  const trimmed = value.trim();
  return /^(https?:\/\/|mailto:|\/)/i.test(trimmed) ? trimmed : undefined;
}

const resultFieldTypeLabel = {
  text: "文本",
  number: "数值",
  select: "选项",
  "attachment[]": "附件",
  boolean: "是/否",
  date: "日期",
  datetime: "日期时间",
} as const;

const resultSemanticRoleLabel = {
  identifier: "标识",
  design: "设计",
  group: "分组",
  label: "标签",
  measurement: "测量值",
  qc: "质控",
  annotation: "注释",
} as const;

const artifactKindLabel = {
  file: "文件",
  image: "图片",
  video: "视频",
} as const;

function requiredLabel(required: boolean | undefined) {
  return required ? "必填" : "可选";
}

function TemplateCheckBadge({ status }: { status: ResultTemplateCheck["status"] | undefined }) {
  return <span className={cn("rounded-full px-2 py-1 text-xs font-semibold", status === "complete" ? "bg-success-surface text-success" : status === "warning" ? "bg-warning-surface text-warning" : "bg-error-surface text-error")}>{status ?? "invalid"}</span>;
}

function ResultTemplateSummaryCard({ template, templateCheck }: { template: ResultTemplate; templateCheck: ResultTemplateCheck | undefined }) {
  return <div className="rounded-[8px] border border-sage/40 bg-sage-surface/50 p-3">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p className="text-sm font-semibold text-ink">{template.title ?? template.result_type}</p>
        <p className="mt-1 text-xs text-muted">{resultTemplateCardinalityLabel(template.cardinality)} · {template.fields.length} fields · {template.datasets?.length ?? 0} tables · {template.artifacts?.length ?? 0} files</p>
      </div>
      <TemplateCheckBadge status={templateCheck?.status} />
    </div>
    {template.description ? <p className="mt-2 text-xs leading-5 text-graphite">{template.description}</p> : null}
    {template.instructions?.length && richTextPlainText(template.instructions).trim() ? <div className="mt-3 border-t border-sage/30 pt-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">填写说明 / Instructions</p>
      <ProtocolRichTextContent nodes={template.instructions} />
    </div> : null}
    {templateCheck && (templateCheck.errors.length || templateCheck.warnings.length) ? <ul className="mt-2 list-disc pl-5 text-xs text-graphite">{[...templateCheck.errors, ...templateCheck.warnings].map((message) => <li key={message}>{message}</li>)}</ul> : null}
  </div>;
}

function ResultTemplateFieldsPreview({ fields }: { fields: ResultTemplateField[] }) {
  if (!fields.length) return null;
  return <section data-result-template-fields-preview className="rounded-[8px] border border-hairline bg-surface/70 p-[var(--ln-result-template-preview-section-padding)]">
    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"><Table2 className="h-4 w-4" aria-hidden />字段要求 / Fields</p>
    <div className="mt-2 grid gap-[var(--ln-result-template-preview-grid-gap)] md:grid-cols-2">
      {fields.map((field) => {
        const dataType = fieldDataType(field);
        const semanticRole = fieldSemanticRole(field);
        const label = field.label ?? field.name ?? field.key ?? "Field";
        const metadata = [field.key, resultFieldTypeLabel[dataType], field.unit, requiredLabel(field.required), resultSemanticRoleLabel[semanticRole]].filter(Boolean).join(" · ");
        const title = field.description ? `${label}\n${metadata}\n${field.description}` : `${label}\n${metadata}`;
        return <div key={field.key ?? label} title={title} className="flex min-w-0 items-center justify-between gap-[var(--ln-result-template-preview-field-meta-gap)] rounded-[7px] border border-hairline bg-warm/60 px-[var(--ln-result-template-preview-field-padding-x)] py-[var(--ln-result-template-preview-field-padding-y)]">
          <p data-result-template-field-name className="min-w-0 flex-1 truncate font-medium leading-tight text-ink">{label}</p>
          <p data-result-template-field-meta className="min-w-0 flex-[1.15] truncate text-right leading-tight text-muted">{field.key ? <span className="font-mono">{field.key}</span> : null}{field.key ? " · " : ""}{resultFieldTypeLabel[dataType]}{field.unit ? ` · ${field.unit}` : ""} · {requiredLabel(field.required)} · {resultSemanticRoleLabel[semanticRole]}</p>
        </div>;
      })}
    </div>
  </section>;
}

function ResultTemplateArtifactPreview({ artifacts }: { artifacts: ResultTemplateArtifact[] | undefined }) {
  if (!artifacts?.length) return null;
  return <section className="rounded-[8px] border border-hairline bg-surface/70 p-3">
    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"><FileCheck2 className="h-4 w-4" aria-hidden />文件要求 / File requirements</p>
    <div className="mt-2 grid gap-2 md:grid-cols-2">
      {artifacts.map((artifact) => <div key={artifact.key} className="min-w-0 rounded-[7px] border border-hairline bg-warm/60 px-3 py-2">
        <p className="truncate text-sm font-medium text-ink">{artifact.label}</p>
        <p className="mt-1 text-xs text-muted"><span className="font-mono">{artifact.key}</span> · {artifactKindLabel[artifact.kind]} · {requiredLabel(artifact.required)}</p>
      </div>)}
    </div>
    <p className="mt-2 text-xs leading-5 text-muted">这里定义需要保留或上传的原始文件；实际文件在创建 / 打开 Result 记录后上传。</p>
  </section>;
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
  if (run.fontSizePt) content = <span data-labnest-size={run.fontSizePt} style={{ fontSize: `${run.fontSizePt}pt` }}>{content}</span>;
  return content;
}

function NodeContent({ node }: { node: ProtocolRichTextNode }) {
  return <>{node.content.map((run, index) => <RichRun key={index} run={run} />)}</>;
}

export function ProtocolRichTextContent({ nodes }: { nodes: ProtocolRichTextNode[] }) {
  const rendered: React.ReactNode[] = [];
  for (let index = 0; index < nodes.length;) {
    const node = nodes[index];
    if (node.type === "bullet" || node.type === "numbered") {
      const type = node.type;
      const items: ProtocolRichTextNode[] = [];
      while (nodes[index]?.type === type) { items.push(nodes[index]); index += 1; }
      const List = type === "bullet" ? "ul" : "ol";
      rendered.push(<List key={`list-${index}`} className={type === "bullet" ? "document-rich-list list-disc pl-6" : "document-rich-list list-decimal pl-6"}>{items.map((item, itemIndex) => <li key={itemIndex} data-labnest-line-height={item.lineHeight} data-labnest-font-family={item.fontFamily} style={item.lineHeight ? { lineHeight: item.lineHeight } : undefined}><NodeContent node={item} /></li>)}</List>);
      continue;
    }
    const lineProps = { ...(node.lineHeight ? { "data-labnest-line-height": node.lineHeight, style: { lineHeight: node.lineHeight } } : {}), ...(node.fontFamily ? { "data-labnest-font-family": node.fontFamily } : {}) };
    if (node.type === "heading2") rendered.push(<h3 key={index} {...lineProps} className="document-content-heading font-serif font-medium text-ink"><NodeContent node={node} /></h3>);
    else if (node.type === "heading3") rendered.push(<h4 key={index} {...lineProps} className="document-content-heading font-semibold text-ink"><NodeContent node={node} /></h4>);
    else if (node.type === "quote") rendered.push(<blockquote key={index} {...lineProps} className="border-l-2 border-sage pl-4 italic text-muted"><NodeContent node={node} /></blockquote>);
    else rendered.push(<p key={index} {...lineProps} className="whitespace-pre-wrap"><NodeContent node={node} /></p>);
    index += 1;
  }
  return <div className="document-copy document-rich-text-flow text-graphite">{rendered}</div>;
}

export function ProtocolContentBlockView({ block }: { block: ProtocolContentBlock }) {
  if (block.type === "heading") return <h3 className="document-content-heading font-serif font-medium text-ink">{block.text}</h3>;
  if (block.type === "text") return <p className="document-copy whitespace-pre-wrap leading-7 text-graphite">{block.text}</p>;
  if (block.type === "rich_text") return <ProtocolRichTextContent nodes={block.nodes} />;
  if (block.type === "checklist") {
    return <ul className="document-checklist">{block.items.filter(Boolean).map((item, index) => <li key={`${block.id}-${index}`} className="document-checklist-item text-sm text-graphite"><CheckSquare2 className="document-checklist-icon h-4 w-4 text-moss" aria-hidden /><span>{item}</span></li>)}</ul>;
  }
  if (block.type === "callout") {
    return <div className={cn("flex gap-3 rounded-[9px] border px-4 py-3 text-sm leading-6", block.tone === "critical" ? "border-error/40 bg-error-surface text-error" : block.tone === "warning" ? "border-warning/40 bg-warning-surface text-graphite" : "border-info/30 bg-info-surface text-graphite")}><AlertTriangle className="mt-1 h-4 w-4 shrink-0" aria-hidden /><span>{block.text}</span></div>;
  }
  if (block.type === "media") {
    const href = safeLink(block.url);
    return <div className="flex items-start gap-3 rounded-[9px] border border-hairline bg-warm px-4 py-3"><FileImage className="mt-0.5 h-4 w-4 text-moss" aria-hidden /><div><p className="text-sm font-medium capitalize text-ink">{block.caption || block.mediaType}</p>{href ? <a href={href} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-moss hover:underline"><Link2 className="h-3.5 w-3.5" />Open {block.mediaType}</a> : <p className="mt-1 text-xs text-error">Media URL is missing or unsupported.</p>}</div></div>;
  }
  if (block.type === "timer") return <ProtocolTimer label={block.label} durationMinutes={block.durationMinutes} notes={block.notes} />;

  const template = block.resultTemplate ? normalizeResultTemplate(block.resultTemplate) : undefined;
  const templateCheck = template ? checkResultTemplate(template) : undefined;
  if (template) {
    return <figure className="space-y-2">
      <ResultTemplateSummaryCard template={template} templateCheck={templateCheck} />
      <ResultTemplateFieldsPreview fields={template.fields} />
      <ResultTemplateArtifactPreview artifacts={template.artifacts} />
      {template.datasets?.length ? <ResultDatasetSchemaView datasets={template.datasets} /> : null}
    </figure>;
  }

  const columnCount = Math.max(1, ...block.rows.map((row) => row.length));
  const [headerRow = [], ...bodyRows] = block.rows;
  return <figure className="space-y-2">
    {block.caption ? <figcaption className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted"><Table2 className="h-4 w-4" aria-hidden />{block.caption}</figcaption> : null}<ResizableTableFrame storageKey={`protocol-block:${block.id}`} className="max-h-[480px] overflow-auto editorial-scrollbar"><table className="document-three-line-table min-w-full table-fixed text-left text-sm"><colgroup>{Array.from({ length: columnCount }).map((_, columnIndex) => <col key={columnIndex} data-resizable-column-index={columnIndex} style={{ width: "var(--ln-document-table-col-width)" }} />)}</colgroup>{headerRow.length ? <thead><tr>{Array.from({ length: columnCount }).map((_, columnIndex) => <th key={columnIndex} data-resizable-column-cell={columnIndex} scope="col" className="min-w-[var(--ln-document-table-min-col-width)] px-[var(--ln-document-table-cell-padding-x)] py-[var(--ln-document-table-cell-padding-y)] pr-4 align-top font-semibold">{headerRow[columnIndex] ?? ""}<span data-column-resize-handle={columnIndex} data-min-width="var(--ln-document-table-min-col-width)" aria-hidden /></th>)}</tr></thead> : null}<tbody>{bodyRows.map((row, rowIndex) => <tr key={`${block.id}-${rowIndex + 1}`}>{Array.from({ length: columnCount }).map((_, columnIndex) => <td key={columnIndex} className="min-w-[var(--ln-document-table-min-col-width)] px-[var(--ln-document-table-cell-padding-x)] py-[var(--ln-document-table-cell-padding-y)] align-top">{row[columnIndex] ?? ""}</td>)}</tr>)}</tbody></table></ResizableTableFrame>
  </figure>;
}

export function ProtocolDocumentView({ document, title, identifier, version }: { document: ProtocolDocument; title?: string; identifier?: string | null; version?: string | null }) {
  return <DocumentCanvas toolbar={<DocumentPrintButton />} label={title ?? "Protocol document"}>
    {title ? <header className="document-page-header">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted">{[identifier, version].filter(Boolean).join(" · ")}</p>
      <h1 className="document-page-title mt-2 font-serif font-medium leading-tight text-ink">{title}</h1>
    </header> : null}
    <div className="min-w-0">
      {document.importWarnings.length ? <div className="rounded-[10px] border border-warning/40 bg-warning-surface p-4"><h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><AlertTriangle className="h-4 w-4 text-warning" aria-hidden />Import review required</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-graphite">{document.importWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}
      {document.sections.map((section) => <section key={section.key} id={section.key} className="document-section scroll-mt-24"><header className="mb-5 flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-moss" aria-hidden /><h2 className="document-section-title font-serif font-medium text-ink">{section.title}</h2></header><div>{section.blocks.length ? section.blocks.map((block) => <div key={block.id} className="document-block"><ProtocolContentBlockView block={block} /></div>) : <p className="text-sm italic text-muted">Not recorded.</p>}</div></section>)}
    </div>
  </DocumentCanvas>;
}
