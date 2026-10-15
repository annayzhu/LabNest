'use client';

import { useContext, useMemo, useState, useSyncExternalStore } from 'react';
import { paragraphLayoutStyle } from "@/lib/document-paragraph-layout";
import { resolveProtocolSystem, tableForSelection, targetApplicability, type ProtocolSelection, type ProtocolSystems } from '@/lib/structured-protocol';
import { optionMarks } from '@/lib/protocol-chips';
import { ChipRenderContext, ChipText } from './protocol/ChipText';
import { ConditionTags } from './protocol/ConditionTags';
import { SystemMark } from './protocol/SystemMark';
import { ProgramCard } from './protocol/ProgramCard';
import { LensPresets, LensRow } from './protocol/Lens';
import './protocol/protocol.css';
import { AlertTriangle, CheckSquare2, FileCheck2, Table2, Wrench } from "lucide-react";
import { DocumentMediaView } from "./DocumentMediaView";
import { documentMediaFromMarkdown } from "@/lib/document-media";
import { DocumentCanvas } from "@/components/DocumentCanvas";
import { separateLegacyImportWarnings } from "@/lib/protocol-import-state";
import { DocumentOutlineWorkbench } from "@/components/DocumentOutlinePanel";
import { ResultDatasetSchemaView } from "@/components/ResultDatasetSchemaView";
import { ResizableTableFrame } from "@/components/ui/ResizableTableFrame";
import { TiptapCellContentView } from "@/components/TiptapCellContentView";
import { cn } from "@/lib/cn";
import { richTextPlainText, type ProtocolContentBlock, type ProtocolDocument, type ProtocolRichTextNode, type ProtocolRichTextRun } from "@/lib/protocol-document";
import { richTextFontFamilyCss } from "@/lib/rich-text-font-family";
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
  return <div className="rounded-[var(--ln-radius-control-lg)] border border-sage/40 bg-sage-surface/50 p-3">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p className="text-sm font-semibold text-ink">{template.title ?? template.result_type}</p>
        <p className="mt-1 text-xs text-muted">{resultTemplateCardinalityLabel(template.cardinality)} · {template.fields.length} fields · {template.datasets?.length ?? 0} tables · {template.artifacts?.length ?? 0} files</p>
      </div>
      <TemplateCheckBadge status={templateCheck?.status} />
    </div>
    {template.description ? <p className="mt-2 text-xs leading-5 text-graphite">{template.description}</p> : null}
    {template.instructions?.length && richTextPlainText(template.instructions).trim() ? <div className="mt-3 border-t border-sage/30 pt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">填写说明 / Instructions</p>
      <ProtocolRichTextContent nodes={template.instructions} />
    </div> : null}
    {templateCheck && (templateCheck.errors.length || templateCheck.warnings.length) ? <ul className="mt-2 list-disc pl-5 text-xs text-graphite">{[...templateCheck.errors, ...templateCheck.warnings].map((message) => <li key={message}>{message}</li>)}</ul> : null}
  </div>;
}

function ResultTemplateFieldsPreview({ fields }: { fields: ResultTemplateField[] }) {
  if (!fields.length) return null;
  return <section data-result-template-fields-preview className="rounded-[var(--ln-radius-control-lg)] border border-hairline bg-surface/70 p-[var(--ln-result-template-preview-section-padding)]">
    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted"><Table2 className="h-4 w-4" aria-hidden />字段要求 / Fields</p>
    <div className="mt-2 grid gap-[var(--ln-result-template-preview-grid-gap)] md:grid-cols-2">
      {fields.map((field) => {
        const dataType = fieldDataType(field);
        const semanticRole = fieldSemanticRole(field);
        const label = field.label ?? field.name ?? field.key ?? "Field";
        const metadata = [field.key, resultFieldTypeLabel[dataType], field.unit, requiredLabel(field.required), resultSemanticRoleLabel[semanticRole]].filter(Boolean).join(" · ");
        const title = field.description ? `${label}\n${metadata}\n${field.description}` : `${label}\n${metadata}`;
        return <div key={field.key ?? label} title={title} className="flex min-w-0 items-center justify-between gap-[var(--ln-result-template-preview-field-meta-gap)] rounded-[var(--ln-radius-control-md)] border border-hairline bg-warm/60 px-[var(--ln-result-template-preview-field-padding-x)] py-[var(--ln-result-template-preview-field-padding-y)]">
          <p data-result-template-field-name className="min-w-0 flex-1 truncate font-medium leading-tight text-ink">{label}</p>
          <p data-result-template-field-meta className="min-w-0 flex-[1.15] truncate text-right leading-tight text-muted">{field.key ? <span className="font-mono">{field.key}</span> : null}{field.key ? " · " : ""}{resultFieldTypeLabel[dataType]}{field.unit ? ` · ${field.unit}` : ""} · {requiredLabel(field.required)} · {resultSemanticRoleLabel[semanticRole]}</p>
        </div>;
      })}
    </div>
  </section>;
}

function ResultTemplateArtifactPreview({ artifacts }: { artifacts: ResultTemplateArtifact[] | undefined }) {
  if (!artifacts?.length) return null;
  return <section className="rounded-[var(--ln-radius-control-lg)] border border-hairline bg-surface/70 p-3">
    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted"><FileCheck2 className="h-4 w-4" aria-hidden />文件要求 / File requirements</p>
    <div className="mt-2 grid gap-2 md:grid-cols-2">
      {artifacts.map((artifact) => <div key={artifact.key} className="min-w-0 rounded-[var(--ln-radius-control-md)] border border-hairline bg-warm/60 px-3 py-2">
        <p className="truncate text-sm font-medium text-ink">{artifact.label}</p>
        <p className="mt-1 text-xs text-muted"><span className="font-mono">{artifact.key}</span> · {artifactKindLabel[artifact.kind]} · {requiredLabel(artifact.required)}</p>
      </div>)}
    </div>
    <p className="mt-2 text-xs leading-5 text-muted">这里定义需要保留或上传的原始文件；实际文件在创建 / 打开 Result 记录后上传。</p>
  </section>;
}

function RichRun({ run }: { run: ProtocolRichTextRun }) {
  let content: React.ReactNode = run.text.includes("{{") ? <ChipText text={run.text} /> : run.text;
  if (run.code) content = <code className="rounded bg-stone px-1 py-0.5 font-mono text-[0.86em]">{content}</code>;
  if (run.bold) content = <strong>{content}</strong>;
  if (run.italic) content = <em>{content}</em>;
  if (run.underline) content = <u>{content}</u>;
  if (run.strike) content = <s>{content}</s>;
  if (run.subscript) content=<sub>{content}</sub>;
  if (run.superscript) content=<sup>{content}</sup>;
  const href = safeLink(run.link);
  if (href) content = <a href={href} className="font-medium text-moss underline decoration-moss/40 underline-offset-2">{content}</a>;
  if (run.fontSizePt) content = <span data-labnest-size={run.fontSizePt} style={{ fontSize: `${run.fontSizePt}pt` }}>{content}</span>;
  if (run.fontFamily) content = <span data-labnest-font-family={run.fontFamily} style={{ fontFamily: richTextFontFamilyCss(run.fontFamily) }}>{content}</span>;
  if (run.color === "risk") content = <span data-labnest-color="risk" className="text-error">{content}</span>;
  return content;
}

function NodeContent({ node }: { node: ProtocolRichTextNode }) {
  return <>{node.content.map((run, index) => <RichRun key={index} run={run} />)}</>;
}

export function ProtocolRichTextContent({ nodes }: { nodes: ProtocolRichTextNode[] }) {
  const rendered: React.ReactNode[] = [];
  for (let index = 0; index < nodes.length;) {
    const node = nodes[index];
    const media = documentMediaFromMarkdown(node.content.map(run => run.text).join(""));
    if (media) { rendered.push(<DocumentMediaView key={index} block={media} />); index += 1; continue; }
    if (node.type === "bullet" || node.type === "numbered") {
      const type = node.type;
      const items: ProtocolRichTextNode[] = [];
      while (nodes[index]?.type === type) { items.push(nodes[index]); index += 1; }
      const List = type === "bullet" ? "ul" : "ol";
      rendered.push(<List key={`list-${index}`} className={type === "bullet" ? "document-rich-list list-disc pl-6" : "document-rich-list list-decimal pl-6"}>{items.map((item, itemIndex) => <li key={itemIndex} data-labnest-line-height={item.lineHeight} data-labnest-font-family={item.fontFamily} style={{ ...paragraphLayoutStyle(item), ...(item.lineHeight ? { lineHeight: item.lineHeight } : {}), ...(item.fontFamily ? { fontFamily: richTextFontFamilyCss(item.fontFamily) } : {}) }}><NodeContent node={item} />{item.childContent?.length ? <TiptapCellContentView content={item.childContent} fallback=""/>:null}</li>)}</List>);
      continue;
    }
    const lineProps = { ...(node.lineHeight ? { "data-labnest-line-height": node.lineHeight } : {}), ...(node.fontFamily ? { "data-labnest-font-family": node.fontFamily } : {}), style: { ...paragraphLayoutStyle(node), ...(node.lineHeight ? { lineHeight: node.lineHeight } : {}), ...(node.fontFamily ? { fontFamily: richTextFontFamilyCss(node.fontFamily) } : {}) } };
    if (node.type === "heading2") rendered.push(<h3 key={index} {...lineProps} className="document-content-heading font-serif font-medium text-ink"><NodeContent node={node} /></h3>);
    else if (node.type === "heading3") rendered.push(<h4 key={index} {...lineProps} className="document-content-heading font-semibold text-ink"><NodeContent node={node} /></h4>);
    else if (node.type === "quote") rendered.push(<blockquote key={index} {...lineProps} className="border-l-2 border-sage pl-4 italic text-muted"><NodeContent node={node} /></blockquote>);
    else rendered.push(<p key={index} {...lineProps} className="whitespace-pre-wrap"><NodeContent node={node} /></p>);
    if(node.childContent?.length)rendered.push(<TiptapCellContentView key={`children-${index}`} content={node.childContent} fallback=""/>);
    index += 1;
  }
  return <div className="document-copy document-rich-text-flow text-graphite">{rendered}</div>;
}

/** "仅 ▲ 350 µL" above a recipe column header that belongs to one system option. */
function ColumnTag({ systems, column }: { systems: ProtocolSystems; column: { dimensionId: string; optionId: string } }) {
  const mark = optionMarks(systems).get(`${column.dimensionId}:${column.optionId}`);
  return mark ? <span className="ln-column-tag" data-tone={mark.tone}>仅 {mark.symbol ? <SystemMark mark={mark} /> : null}{mark.label}</span> : null;
}

export function ProtocolContentBlockView({ block, executionContext=false }: { block: ProtocolContentBlock; executionContext?:boolean }) {
  const systems = useContext(ChipRenderContext)?.systems;
  if ((block.type==="heading" || block.type==="text") && block.nodes) return <ProtocolRichTextContent nodes={block.nodes}/>;
  if (block.type==="checklist" && block.itemNodes) return <ul className="document-rich-list pl-4">{block.items.map((item,index)=><li key={index}><ProtocolRichTextContent nodes={block.itemNodes?.[index]??[{type:"paragraph",content:[{text:item}]}]}/></li>)}</ul>;
  if (block.type === "heading") return <h3 className="document-content-heading font-serif font-medium text-ink"><ChipText text={block.text} /></h3>;
  if (block.type === "text") return <p className="document-copy whitespace-pre-wrap leading-7 text-graphite"><ChipText text={block.text} /></p>;
  if (block.type === "rich_text") return <ProtocolRichTextContent nodes={block.nodes} />;
  if (block.type === "checklist") {
    return <ul className="document-checklist">{block.items.filter(Boolean).map((item, index) => <li key={`${block.id}-${index}`} className="document-checklist-item text-sm text-graphite">{executionContext?<span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-moss"/>:<CheckSquare2 className="document-checklist-icon h-4 w-4 text-moss" aria-hidden />}<span><ChipText text={item} /></span></li>)}</ul>;
  }
  if (block.type === "callout") {
    return <div className={cn("flex gap-3 rounded-[var(--ln-radius-panel-inner)] border px-4 py-3 text-sm leading-6", block.tone === "critical" ? "border-error/40 bg-error-surface text-error" : block.tone === "warning" ? "border-warning/40 bg-warning-surface text-graphite" : "border-info/30 bg-info-surface text-graphite")}><AlertTriangle className="mt-1 h-4 w-4 shrink-0" aria-hidden /><span><ChipText text={block.text} /></span></div>;
  }
  if (block.type === "media") return <DocumentMediaView block={block} />;
  if (block.type === "embedded_tool") {
    const href = safeLink(block.url);
    return <div className="ln-protocol-tool-card"><Wrench aria-hidden /><div><p>{block.label || "Embedded tool"}</p><small>{block.sourceKind === "manifest" ? "LabNest tool" : block.sourceKind === "path" ? "Application path" : "External URL"}</small></div>{href ? <a href={href} target="_blank" rel="noreferrer">Open tool</a> : <span>Invalid location</span>}</div>;
  }
  if (block.type === "program") return <ProgramCard program={block} />;
  // Older timer blocks read as their duration; countdowns belong to each Run step.
  if (block.type === "timer") return <p className="text-sm text-muted">{block.label} · {block.durationMinutes} min{block.notes ? ` · ${block.notes}` : ""}</p>;

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
  const column = (index: number) => systems && block.columnConditions?.[index] ? <ColumnTag systems={systems} column={block.columnConditions[index]!} /> : null;
  const rowRules = (index: number) => systems ? scopedRules(systems, "row", block.rowIds?.[index] ?? "") : [];
  return <figure className="space-y-2">
    <p className="text-xs text-muted">Scroll sideways for all columns</p>
    {block.caption ? <figcaption className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted"><Table2 className="h-4 w-4" aria-hidden />{block.caption}</figcaption> : null}
    <ResizableTableFrame storageKey={`protocol-block:${block.id}`} className="max-h-[480px] overflow-auto editorial-scrollbar">
      <table className="document-three-line-table min-w-full table-fixed text-left text-sm">
        <colgroup>{Array.from({ length: columnCount }).map((_, columnIndex) => <col key={columnIndex} data-resizable-column-index={columnIndex} style={{ width: block.columnWidths?.[columnIndex] ? `${block.columnWidths[columnIndex]}px` : "var(--ln-document-table-col-width)" }} />)}</colgroup>
        {headerRow.length ? <thead><tr>{Array.from({ length: columnCount }).map((_, columnIndex) => <th key={columnIndex} data-resizable-column-cell={columnIndex} scope="col" className={cn("min-w-[var(--ln-document-table-min-col-width)] px-[var(--ln-document-table-cell-padding-x)] py-[var(--ln-document-table-cell-padding-y)] pr-4 align-top font-semibold", !block.cellRichContent?.[0]?.[columnIndex] && block.cellColors?.[0]?.[columnIndex] === "risk" && "text-error")} style={!block.cellRichContent?.[0]?.[columnIndex] && block.cellFontSizesPt?.[0]?.[columnIndex] ? { fontSize: `${block.cellFontSizesPt[0][columnIndex]}pt` } : undefined}>{column(columnIndex)}<TiptapCellContentView content={block.cellRichContent?.[0]?.[columnIndex]} fallback={headerRow[columnIndex] ?? ""} /><span data-column-resize-handle={columnIndex} data-min-width="var(--ln-document-table-min-col-width)" aria-hidden /></th>)}</tr></thead> : null}
        <tbody>{bodyRows.map((row, rowIndex) => <tr key={`${block.id}-${rowIndex + 1}`}>{Array.from({ length: columnCount }).map((_, columnIndex) => <td key={columnIndex} className={cn("min-w-[var(--ln-document-table-min-col-width)] px-[var(--ln-document-table-cell-padding-x)] py-[var(--ln-document-table-cell-padding-y)] align-top", !block.cellRichContent?.[rowIndex + 1]?.[columnIndex] && block.cellColors?.[rowIndex + 1]?.[columnIndex] === "risk" && "text-error")} style={!block.cellRichContent?.[rowIndex + 1]?.[columnIndex] && block.cellFontSizesPt?.[rowIndex + 1]?.[columnIndex] ? { fontSize: `${block.cellFontSizesPt[rowIndex + 1][columnIndex]}pt` } : undefined}>{columnIndex === 0 && systems && rowRules(rowIndex + 1).length ? <span className="ln-row-tag"><ConditionTags rules={rowRules(rowIndex + 1)} systems={systems} /></span> : null}<TiptapCellContentView content={block.cellRichContent?.[rowIndex + 1]?.[columnIndex]} fallback={row[columnIndex] ?? ""} /></td>)}</tr>)}</tbody>
      </table>
    </ResizableTableFrame>
  </figure>;
}

const lensEvent = "labnest:protocol-lens";
const readLens = (key: string) => { try { return localStorage.getItem(`labnest.protocol-lens:${key}`); } catch { return null; } };
const subscribeLens = (notify: () => void) => { window.addEventListener(lensEvent, notify); window.addEventListener("storage", notify); return () => { window.removeEventListener(lensEvent, notify); window.removeEventListener("storage", notify); }; };

/** The preview lens is a reading aid remembered only in this browser; it never changes an Experiment. */
function useRememberedLens(key: string | undefined, systems: ProtocolSystems | undefined) {
  const [unsaved, setUnsaved] = useState<ProtocolSelection | null>(null);
  const saved = useSyncExternalStore(subscribeLens, () => key ? readLens(key) : null, () => null);
  const lens = useMemo(() => {
    if (unsaved) return unsaved;
    try {
      const parsed = JSON.parse(saved ?? "null") as ProtocolSelection | null;
      return parsed && typeof parsed === "object" && systems ? Object.fromEntries(Object.entries(parsed).filter(([dimension, option]) => systems.dimensions.some(d => d.id === dimension && d.options.some(o => o.id === option)))) : {};
    } catch { return {}; }
  }, [saved, systems, unsaved]);
  const update = (next: ProtocolSelection) => {
    try { if (!key) throw new Error("no key"); localStorage.setItem(`labnest.protocol-lens:${key}`, JSON.stringify(next)); setUnsaved(null); window.dispatchEvent(new Event(lensEvent)); }
    catch { setUnsaved(next); /* Storage unavailable: keep the choice for this page only. */ }
  };
  return [lens, update] as const;
}

function PreviewLens({ systems, lens, onChange }: { systems: ProtocolSystems; lens: ProtocolSelection; onChange: (lens: ProtocolSelection) => void }) {
  const marks = optionMarks(systems);
  return <section className="ln-systems-bar" aria-label="体系图例与预览">
    {systems.dimensions.map(dimension => <LensRow key={dimension.id} dimension={dimension} marks={marks} lens={lens} onChange={onChange} label={`预览：${dimension.label}`} optionTitle={option => `按${option.label}阅读：其余内容折叠`} />)}
    <div className="ln-systems-footer" data-print-hidden>
      <LensPresets systems={systems} lens={lens} onChange={onChange} />
      <span className="ln-systems-spacer" /><span className="text-xs text-muted">预览只改变阅读，不改变任何实验</span>
    </div>
  </section>;
}

type Rule = ProtocolSystems["rules"][number];
const scopedRules = (systems: ProtocolSystems | undefined, target: "step" | "block" | "row", id: string): Rule[] => (systems?.rules ?? []).filter(rule => rule.target === target && rule.targetId === id && [rule.when.all, rule.when.any, rule.when.not].some(p => p?.length));

/** Content another system needs: folded in a lens preview, one click away. */
function Folded({ systems, rules, children }: { systems: ProtocolSystems; rules: Rule[]; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <div className="ln-protocol-folded" data-open={open ? "" : undefined}>
    <button type="button" className="focus-ring ln-protocol-folded-toggle" aria-expanded={open} onClick={() => setOpen(value => !value)}><ConditionTags rules={rules} systems={systems} /><span>{open ? "收起" : "不适用于当前预览 · 展开"}</span></button>
    {open ? <div className="ln-protocol-folded-body">{children}</div> : null}
  </div>;
}

export function ProtocolDocumentView({ document, title, identifier, version }: { document: ProtocolDocument; title?: string; identifier?: string | null; version?: string | null }) {
  const systems = document.systems;
  const [lens, setLens] = useRememberedLens([identifier, version].filter(Boolean).join("@") || undefined, systems);
  const lensActive = Object.keys(lens).length > 0;
  const resolution = useMemo(() => systems && lensActive ? resolveProtocolSystem(systems, lens) : undefined, [systems, lens, lensActive]);
  const state = targetApplicability(systems, resolution?.rules ?? {});
  const chipContext = useMemo(() => ({ systems, resolution: resolution?.parameters, lens, preview: true }), [systems, resolution, lens]);
  const { contentWarnings } = separateLegacyImportWarnings(document.importWarnings);
  const readable = (block: ProtocolContentBlock) => block.type === "table" && lensActive ? tableForSelection(block, state, lens) : block;
  const blockView = (block: ProtocolContentBlock) => {
    const rules = scopedRules(systems, "block", block.id);
    const view = <div key={block.id} className="document-block">{rules.length && systems ? <p className="ln-protocol-block-scope"><ConditionTags rules={rules} systems={systems} /></p> : null}<ProtocolContentBlockView block={readable(block)} /></div>;
    return rules.length && systems && state("block", block.id) === "not-applicable" ? <Folded key={block.id} systems={systems} rules={rules}>{view}</Folded> : view;
  };
  /** A step's own blocks: the block that starts it, then its details in order. */
  const ownedFrom = (blocks: ProtocolContentBlock[], start: number) => {
    const stepId = blocks[start].execution?.stepId ?? blocks[start].id, owned = [blocks[start]];
    for (let index = start + 1; blocks[index]?.execution?.role === "detail" && blocks[index].execution?.stepId === stepId; index += 1) owned.push(blocks[index]);
    return { stepId, owned };
  };
  const sectionContent = (section: ProtocolDocument["sections"][number]) => {
    const nodes: React.ReactNode[] = [];
    // One number sequence per section, continuing after notes between steps.
    let number = 0;
    for (let index = 0; index < section.blocks.length;) {
      const block = section.blocks[index];
      if (block.execution?.role === "step" && block.execution.format !== "block") {
        // An older, organized step: its scope shows above it and it folds with its details under a lens.
        const { stepId, owned } = ownedFrom(section.blocks, index);
        index += owned.length;
        const rules = scopedRules(systems, "step", stepId);
        const body = <div key={stepId} className="ln-protocol-legacy-step">{rules.length && systems ? <p className="ln-protocol-block-scope"><ConditionTags rules={rules} systems={systems} /></p> : null}{owned.map(blockView)}</div>;
        nodes.push(rules.length && systems && state("step", stepId) === "not-applicable" ? <Folded key={stepId} systems={systems} rules={rules}>{body}</Folded> : body);
        continue;
      }
      if (block.execution?.role !== "step") { nodes.push(blockView(block)); index += 1; continue; }
      const steps: React.ReactNode[] = [], first = number + 1;
      while (section.blocks[index]?.execution?.role === "step" && section.blocks[index].execution?.format === "block") {
        const { stepId, owned } = ownedFrom(section.blocks, index);
        index += owned.length;
        number += 1;
        const rules = scopedRules(systems, "step", stepId);
        const optional = systems?.rules.some(rule => rule.target === "step" && rule.targetId === stepId && rule.optional);
        const body = <div className="ln-protocol-step-body">{owned.map((child, order) => order ? blockView(child) : <div key={child.id} className="document-block"><ProtocolContentBlockView block={readable(child)} /></div>)}</div>;
        const folded = systems && rules.length && (state("step", stepId) === "not-applicable" || state("block", owned[0].id) === "not-applicable");
        steps.push(<li key={stepId} className="ln-protocol-step" data-step-id={stepId}>
          <span className="ln-protocol-step-gutter" aria-hidden><span className="ln-protocol-step-number is-static" /></span>
          {folded ? <div className="ln-protocol-step-body"><Folded systems={systems!} rules={rules}>{body}</Folded></div> : body}
          {!folded && (rules.length || optional) ? <span className="ln-protocol-step-tags">{systems && rules.length ? <ConditionTags rules={rules} systems={systems} /> : null}{optional ? <span className="ln-condition-tag is-optional">可选</span> : null}</span> : null}
        </li>);
      }
      nodes.push(<ol key={`steps-${index}`} className="ln-protocol-document-steps" start={first} style={{ counterReset: `ln-step ${first - 1}` }}>{steps}</ol>);
    }
    return nodes;
  };
  const canvas = <DocumentCanvas label={title ?? "Protocol document"}>
    {title ? <header className="document-page-header">
      <p className="record-identifier text-xs font-semibold uppercase text-muted">{[identifier, version].filter(Boolean).join(" · ")}</p>
      <h1 className="document-page-title mt-2 font-serif font-medium leading-tight text-ink">{title}</h1>
    </header> : null}
    <div className="min-w-0">
      {systems?.dimensions.length ? <PreviewLens systems={systems} lens={lens} onChange={setLens} /> : null}
      {resolution?.issues.filter(issue => !issue.code.startsWith("parameter-")).length ? <p role="status" className="text-sm text-warning">{resolution.issues.filter(issue => !issue.code.startsWith("parameter-")).map(issue => issue.message).join("；")}</p> : null}
      {contentWarnings.length ? <div className="rounded-[var(--ln-radius-panel-inner)] border border-warning/40 bg-warning-surface p-4"><h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><AlertTriangle className="h-4 w-4 text-warning" aria-hidden />Import review required</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-graphite">{contentWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}
      <ChipRenderContext.Provider value={chipContext}>
        {document.sections.map((section) => <section key={section.key} id={`section-${section.key}`} className="document-section"><header className="mb-5"><h2 style={section.titleFontSizePt ? {fontSize: `${section.titleFontSizePt}pt`} : undefined} className="document-section-title font-serif font-medium text-ink">{section.title}</h2></header><div>{section.blocks.length ? sectionContent(section) : <p className="text-sm italic text-muted">Not recorded.</p>}</div></section>)}
      </ChipRenderContext.Provider>
    </div>
  </DocumentCanvas>;
  return <DocumentOutlineWorkbench items={document.sections.map((section) => ({ id: `section-${section.key}`, label: section.title }))} className="document-preview-workbench">{canvas}</DocumentOutlineWorkbench>;
}
