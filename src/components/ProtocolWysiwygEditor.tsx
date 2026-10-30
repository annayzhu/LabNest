"use client";
import { documentScriptMarks } from "@/lib/tiptap-document-extensions";
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode, ResolvedPos } from '@tiptap/pm/model';
import { ProtocolParameterNode } from '@/lib/protocol-parameter-node';
import { ProtocolEditorIdentities } from '@/lib/protocol-editor-identities';
import { ProtocolStepNode } from '@/lib/protocol-step-node';
import { ProtocolDocumentNode } from '@/lib/protocol-document-node';
import { ProtocolChipInput, ProtocolConditionDecorations, ProtocolEditorHandlerStorage, ProtocolSlashMenu, setProtocolHandlers } from '@/lib/protocol-editor-extensions';
import { chipWithRangeEnd, parameterDisplayName, splitDimension, splitLookupSource, toolSpecs, type RecognizedQuantity } from '@/lib/protocol-chips';
import { blankProtocolSystems, type ProtocolSystems } from '@/lib/protocol-systems-schema';
import type { ProtocolSelection } from '@/lib/structured-protocol';
import { prefixedClientId as uid } from '@/lib/client-mutation-id';
import { protocolTableColumnIndex } from '@/lib/protocol-document';
import { executionBlockText } from '@/lib/protocol-execution';
import { ChipNodeView } from './protocol/ChipNodeView';
import { StepNodeView } from './protocol/StepNodeView';
import { ChipPopover } from './protocol/ChipPopover';
import { ConditionMenu } from './protocol/ConditionMenu';
import { InsertMenu, type InsertChoice } from './protocol/InsertMenu';
import { useSlashQuery, type EditorCommandMenuState } from './EditorCommandMenu';
import { EditorSurface, type BlockMenuItem } from './EditorSurface';
import { DocumentAttachmentsButton } from './DocumentAttachmentsButton';
import { BlockHandles } from '@/lib/editor-block-handle';
import { HeadingShortcuts, savedBlocksOnly } from '@/lib/editor-writing';
import { turnInto, type BlockUnit } from '@/lib/editor-blocks';
import { TableMap } from '@tiptap/pm/tables';
import { SplitPrompt, type SplitChoice, type SplitPromptState } from './protocol/SplitPrompt';
import { SystemsBar } from './protocol/SystemsBar';
import { ProgramEditor } from './protocol/ProgramCard';
import { defaultPcrProgram } from '@/lib/protocol-program';
import { newMix, recipeTableToMix, type MixProposal } from '@/lib/protocol-mix';
import { MixEditor, MixProposals } from './protocol/MixCard';
import { newCalculation } from '@/lib/protocol-calculations';
import { ProtocolEditorContext, type ChipTarget, type ConditionTarget, type ProtocolEditorApi, type ProtocolStockItem } from './protocol/ProtocolEditorContext';
import './protocol/protocol.css';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { findParentNodeClosestToPos, type Editor, type JSONContent } from "@tiptap/core";
import { EditorContent, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, type NodeViewProps } from "@tiptap/react";
import { DocumentMediaNode } from "./DocumentMediaNode";
import { chooseFiles, useDocumentMediaUploads } from "./DocumentMediaUploads";
import StarterKit from "@tiptap/starter-kit";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { AlertTriangle, Filter, ImagePlus, Wrench } from "lucide-react";
import { wysiwygWidgetInputClass } from "./widget-input";
import { InlineTableEditor } from "@/components/InlineTableEditor";
import { ProtocolContentBlockView } from "@/components/ProtocolDocumentView";
import { ResultTemplateConfigEditor } from "@/components/ResultTemplateConfigEditor";
import { cn } from "@/lib/cn";
import {
  protocolSectionLabels,
  type ProtocolContentBlock,
  type ProtocolDocument,
  type ProtocolSectionKey,
} from "@/lib/protocol-document";
import { protocolDocumentToTiptap, tiptapToProtocolDocument } from "@/lib/protocol-tiptap";
import { resultTemplateFieldsToRows } from "@/lib/result-templates";
import { emptyRecordTemplate, keepWrittenLines } from "@/lib/result-record-line";
import { RecordTemplateEditor } from "./protocol/RecordTemplate";
import { useI18n } from "@/components/I18nProvider";
import { resolveAppLocale, translateUiText } from "@/lib/i18n";
import { labToolManifest } from "@/lib/tool-manifest";
import { createDocumentBlockLineHeightExtension, createDocumentLegacyAttributesExtension, createDocumentSectionExtension, createDocumentWidgetExtension, createResizableDocumentTableExtension } from "@/lib/tiptap-document-extensions";

type WidgetBlock = Extract<ProtocolContentBlock, { type: "timer" | "callout" | "media" | "embedded_tool" | "table" | "program" | "mix" }>;

function uniqueBlockId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function embeddableToolUrl(value: string) {
  const trimmed = value.trim();
  return /^(https:\/\/|\/)/i.test(trimmed) ? trimmed : undefined;
}

/** What each opening section is for, shown on its empty line. */
const sectionPlaceholders: Partial<Record<ProtocolSectionKey, string>> = {
  description: 'One sentence on what this Protocol does and which samples it suits',
  purpose: 'What it should give, e.g. total RNA from cultured cells for qPCR',
  background: 'Principle, rationale or cautions; may stay empty',
};
/** Placeholders live inside the editable page, which the page translator leaves alone; the provider's locale is on <html>. */
const shownPlaceholder = (text: string) => translateUiText(text, resolveAppLocale(document.documentElement.dataset.locale));

function ProtocolSectionNodeView({ node }: NodeViewProps) {
  const sectionKey = node.attrs.sectionKey as ProtocolSectionKey;
  // The page translator leaves the editable page alone, so the headings are translated here.
  const { t } = useI18n();
  return <NodeViewWrapper as="section" id={`protocol-section-${sectionKey}`} className="ln-protocol-section" data-section-key={sectionKey}>
    <header className="ln-protocol-section-heading" contentEditable={false}>
      <span className="ln-protocol-section-rule" aria-hidden />
      <h2 style={node.attrs.titleFontSizePt ? {fontSize: `${node.attrs.titleFontSizePt}pt`} : undefined}>{t(sectionKey === "consumption_rules" ? "Old formula table (reference only)" : protocolSectionLabels[sectionKey] ?? sectionKey)}</h2>
      {sectionKey === "consumption_rules" ? <small>{t("No longer used to calculate at run time: amounts come from the parameter blocks and mix cards in the steps. Converting to step blocks merges it into the materials table.")}</small> : null}
      {sectionKey === "steps" ? <details className="ln-writing-hint" data-print-hidden><summary>{t("How to write")}</summary>
        <p>{t("One step per paragraph; Enter starts the next step. Write values as they are, e.g. “50 µL”, “10 min”; when systems differ write “50/80 µL”. Start a step done on only some samples with “仅富脂样本：…” (lipid-rich samples only). Put results to record in the “Result template”: “记录：浓度 ng/µL、A260/280、胶图”.")}</p>
      </details> : null}
    </header>
    <NodeViewContent as="div" className="ln-protocol-section-content" />
  </NodeViewWrapper>;
}

function ProtocolWidgetNodeView({ node, updateAttributes, selected, getPos }: NodeViewProps) {
  const block = node.attrs.block as WidgetBlock;
  const updateBlock = (next: WidgetBlock) => updateAttributes({ block: next });
  const isResultTemplate = block.type === "table" && Boolean(block.resultTemplate);

  return <NodeViewWrapper className={cn("ln-protocol-widget", selected && "is-selected")} data-widget-type={block.type}>
    <div className="document-print-only"><ProtocolContentBlockView block={block} /></div>
    <div contentEditable={false} data-print-hidden>
      {/* Older timers are read-only: durations are written as time chips, and every Run step has its own timer. */}
      {block.type === "timer" ? <ProtocolContentBlockView block={block} /> : null}
      {block.type === "callout" ? <div className="ln-protocol-callout-editor">
        <AlertTriangle className="ln-protocol-widget-icon" aria-hidden />
        <select value={block.tone} onChange={(event) => updateBlock({ ...block, tone: event.target.value as typeof block.tone })} className={wysiwygWidgetInputClass} aria-label="Callout level"><option value="note">Note</option><option value="warning">Warning</option><option value="critical">Critical</option></select>
        <input value={block.text} onChange={(event) => updateBlock({ ...block, text: event.target.value })} className={wysiwygWidgetInputClass} placeholder="Important operation or risk" aria-label="Callout text" />
      </div> : null}
      {block.type === "media" ? <div className="ln-protocol-media-editor">
        <ImagePlus className="ln-protocol-widget-icon" aria-hidden />
        <input value={block.caption ?? ""} onChange={(event) => updateBlock({ ...block, caption: event.target.value })} className={wysiwygWidgetInputClass} placeholder="Caption" aria-label="Media caption" />
        <span className="ln-protocol-media-filename">{block.filename || block.mediaType}</span>
        {block.url ? <a href={block.url} target="_blank" rel="noreferrer" className="ln-protocol-widget-link">Open</a> : null}
      </div> : null}
      {block.type === "embedded_tool" ? <div className="ln-protocol-tool-editor">
        <Wrench className="ln-protocol-widget-icon" aria-hidden />
        <select value={block.sourceKind} onChange={(event) => {
          const sourceKind = event.target.value as typeof block.sourceKind;
          if (sourceKind === "manifest") {
            const tool = labToolManifest.find((item) => item.id === block.toolId) ?? labToolManifest[0];
            updateBlock({ ...block, sourceKind, toolId: tool?.id, label: tool?.name ?? "LabNest tool", url: tool?.launchUrl ?? "/tools" });
          } else updateBlock({ ...block, sourceKind, toolId: undefined });
        }} className={wysiwygWidgetInputClass} aria-label="Embedded tool source"><option value="manifest">Existing tool</option><option value="path">App path</option><option value="url">URL</option></select>
        {block.sourceKind === "manifest" ? <select value={block.toolId ?? ""} onChange={(event) => { const tool = labToolManifest.find((item) => item.id === event.target.value); if (tool) updateBlock({ ...block, toolId: tool.id, label: tool.name, url: tool.launchUrl ?? "/tools" }); }} className={wysiwygWidgetInputClass} aria-label="LabNest tool">{labToolManifest.map((tool) => <option key={tool.id} value={tool.id}>{tool.name}</option>)}</select> : <><input value={block.label} onChange={(event) => updateBlock({ ...block, label: event.target.value })} className={wysiwygWidgetInputClass} placeholder="Tool name" aria-label="Embedded tool name" /><input value={block.url} onChange={(event) => updateBlock({ ...block, url: event.target.value })} className={wysiwygWidgetInputClass} placeholder={block.sourceKind === "path" ? "/tools/..." : "https://..."} aria-label="Embedded tool location" /></>}
        {block.url ? <a href={block.url} target="_blank" rel="noreferrer" className="ln-protocol-widget-link">Open</a> : null}
      </div> : null}
      {block.type === "embedded_tool" && embeddableToolUrl(block.url) ? <details className="ln-protocol-tool-preview"><summary>Embedded preview</summary><iframe src={embeddableToolUrl(block.url)} title={block.label || "Embedded laboratory tool"} sandbox={block.url.startsWith("/") ? "allow-scripts allow-same-origin allow-forms allow-downloads allow-popups" : "allow-scripts allow-forms allow-downloads allow-popups"} loading="lazy" /></details> : null}
      {block.type === "program" ? <ProgramEditor program={block} onChange={updateBlock} /> : null}
      {block.type === "mix" ? <MixEditor mix={block} onChange={updateBlock} getPos={getPos} /> : null}
      {block.type === "table" && !isResultTemplate ? <InlineTableEditor rows={block.rows} onChange={(rows) => updateBlock({ ...block, rows })} caption={block.caption} onCaptionChange={(caption) => updateBlock({ ...block, caption })} /> : null}
      {block.type === "table" && isResultTemplate ? <RecordTemplateEditor block={block} onChange={updateBlock}
        advanced={<ResultTemplateConfigEditor block={block} onChange={next => updateBlock(keepWrittenLines(block, next))} />} /> : null}
    </div>
  </NodeViewWrapper>;
}

const ProtocolSection = createDocumentSectionExtension({ name: "protocolSection", tag: "section[data-protocol-section]", attributes: { sectionKey: { default: "description", htmlAttribute: "data-protocol-section" }, titleFontSizePt: { default: null, htmlAttribute: "data-title-size" } }, nodeView: ReactNodeViewRenderer(ProtocolSectionNodeView), content: "(block | protocolStep)*" });
const EditableChip = ProtocolParameterNode.extend({ addNodeView: () => ReactNodeViewRenderer(ChipNodeView, { as: "span" }) });
const EditableStep = ProtocolStepNode.extend({ addNodeView: () => ReactNodeViewRenderer(StepNodeView) });

/** Material-table names offered when naming a chip; the row identity links them. */
function protocolMaterials(document: ProtocolDocument) {
  return (document.sections.find(section => section.key === "material")?.blocks ?? []).flatMap(block => {
    if (block.type !== "table" || block.resultTemplate) return [];
    const nameIndex = protocolTableColumnIndex(block.rows[0] ?? [], ["name", "material", "reagent", "名称", "材料", "试剂"], 0);
    return block.rows.slice(1).flatMap((row, index) => row[nameIndex]?.trim() ? [{ name: row[nameIndex].trim(), ...(block.rowIds?.[index + 1] ? { rowId: block.rowIds[index + 1] } : {}) }] : []);
  });
}

/** The caret is inside the Steps section, the only place a step block executes. */
function inStepsSection($pos: ResolvedPos) {
  for (let depth = $pos.depth; depth > 0; depth -= 1) if ($pos.node(depth).type.name === 'protocolSection') return $pos.node(depth).attrs.sectionKey === 'steps';
  return false;
}

/** Steps may be added when the Steps section already uses step blocks or holds no unconverted legacy content. */
function stepsAllowedIn(document: ProtocolDocument) {
  const blocks = document.sections.find(section => section.key === "steps")?.blocks ?? [];
  return blocks.some(block => block.execution?.format === "block")
    || blocks.every(block => !block.execution && (block.type === "rich_text" || block.type === "text") && !executionBlockText(block).trim() && !(block.type === "rich_text" && block.nodes.some(node => node.childContent?.length)));
}
const ProtocolWidget = createDocumentWidgetExtension({ name: "protocolWidget", htmlAttribute: "data-protocol-widget", nodeView: ReactNodeViewRenderer(ProtocolWidgetNodeView) });
const ProtocolLegacyAttributes = createDocumentLegacyAttributesExtension({ name: "protocolLegacyAttributes", attributes: [
  { name: "protocolBlockId", htmlAttribute: "data-protocol-block-id" },
  { name: "protocolBlockType", htmlAttribute: "data-protocol-block-type" },
  { name: "protocolExecution", htmlAttribute: "data-protocol-execution" },
  { name: "protocolRichChild", htmlAttribute: "data-protocol-rich-child" },
  { name: "protocolLineHeight", htmlAttribute: "data-labnest-line-height" },
  { name: "protocolFontFamily", htmlAttribute: "data-labnest-font-family" },
  { name: "protocolCaption", htmlAttribute: "data-protocol-caption" },
] });

function protocolEditorExtensions() {
  return [
      StarterKit.configure({ document: false, link: { openOnClick: false, autolink: false }, trailingNode: false, ...savedBlocksOnly }),
      ProtocolDocumentNode,
      HeadingShortcuts,
      TextStyleKit.configure({ backgroundColor: false }),
      createDocumentBlockLineHeightExtension(),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      createResizableDocumentTableExtension(),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ includeChildren: true, placeholder: ({ editor: current, node, pos }) => {
        if (node.type.name !== 'paragraph') return '';
        const $pos = current.state.doc.resolve(pos);
        for (let depth = $pos.depth; depth > 0; depth -= 1) {
          const ancestor = $pos.node(depth);
          if (ancestor.type.name === 'protocolStep') {
            // The first step of an empty section shows how a step reads; later ones only say how to go on.
            const section = $pos.node(depth - 1);
            return shownPlaceholder(section.childCount === 1 && !section.textContent.trim() ? 'Write the first step, e.g. Add 50 µL Proteinase K and mix. Enter starts the next step' : 'Write this step. Enter starts the next one, Shift+Enter breaks the line');
          }
          if (ancestor.type.name === 'protocolSection') return shownPlaceholder(sectionPlaceholders[ancestor.attrs.sectionKey as ProtocolSectionKey] ?? 'Type / to insert a parameter, tool or content');
        }
        return shownPlaceholder('Type / to insert a parameter, tool or content');
      } }),
      // "1/2" must stay a split value, never become "½".
      Typography.configure({ oneHalf: false, oneQuarter: false, threeQuarters: false }),
      ProtocolLegacyAttributes,
      ProtocolEditorIdentities,
      EditableChip,
      ProtocolEditorHandlerStorage,
      EditableStep,
      ProtocolChipInput,
      ProtocolSlashMenu,
      BlockHandles,
      ProtocolConditionDecorations,
      ...documentScriptMarks,
      ProtocolSection,
      ProtocolWidget,
      DocumentMediaNode,
  ];
}

export function ProtocolWysiwygEditor({ document, onChange, actionsHostId, uploadDraftId, mixProposals, onDismissMixProposal, inventory = [] }: { document: ProtocolDocument; onChange: (document: ProtocolDocument) => void; actionsHostId?: string; uploadDraftId: string; mixProposals: MixProposal[]; onDismissMixProposal?: (proposalId: string) => Promise<{ error?: string }>; inventory?: ProtocolStockItem[] }) {
  const [initialContent] = useState(() => protocolDocumentToTiptap(document)); // The form owns one document for the lifetime of this editor.
  const onChangeRef = useRef(onChange);
  const importWarningsRef = useRef(document.importWarnings);
  // Authoring metadata can change without rebuilding the editor or its selection.
  const documentRef = useRef(document);
  // Chips create parameters inside an editor transaction: serialization must already see them.
  const systemsRef = useRef<ProtocolSystems | undefined>(document.systems);
  useLayoutEffect(() => { documentRef.current = document; systemsRef.current = document.systems; }, [document]);
  const [lens, setLensState] = useState<ProtocolSelection>({});
  const lensRef = useRef(lens);
  const [chipTarget, setChipTarget] = useState<ChipTarget | null>(null);
  const [conditionTarget, setConditionTarget] = useState<ConditionTarget | null>(null);
  const [conversionError, setConversionError] = useState('');
  const [insertMenu, setInsertMenu] = useState<EditorCommandMenuState | null>(null);
  const insertMenuRef = useRef(insertMenu);
  const insertKeyRef = useRef<((event: KeyboardEvent) => boolean) | null>(null);
  const [splitPrompt, setSplitPrompt] = useState<SplitPromptState | null>(null);
  const splitKeyRef = useRef<((event: KeyboardEvent) => boolean) | null>(null);
  const editorRef = useRef<Editor | null>(null);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { insertMenuRef.current = insertMenu; }, [insertMenu]);

  // Sources and provenance live beside the text, not in it: they ride along unchanged through every edit.
  const serialize = useCallback((json: JSONContent, systems = systemsRef.current) => ({ ...tiptapToProtocolDocument(json, importWarningsRef.current, documentRef.current.executionConfirmed, systems), sources: documentRef.current.sources ?? [], ...(documentRef.current.provenance ? { provenance: documentRef.current.provenance } : {}) }), []);
  const setLens = useCallback((next: ProtocolSelection) => {
    lensRef.current = next;
    setLensState(next);
    const current = editorRef.current;
    if (current && !current.isDestroyed) current.view.dispatch(current.state.tr.setMeta('protocolLens', next).setMeta('addToHistory', false));
  }, []);
  const updateSystems = useCallback((update: (current: ProtocolSystems) => ProtocolSystems) => {
    const next = update(systemsRef.current ?? blankProtocolSystems());
    systemsRef.current = next;
    const exists = (dimensionId: string, optionId: string) => next.dimensions.some(d => d.id === dimensionId && d.options.some(o => o.id === optionId));
    // A deleted option leaves no recipe column or lens pointing at it.
    const editor = editorRef.current;
    if (editor && !editor.isDestroyed) {
      const tr = editor.state.tr;
      editor.state.doc.descendants((node, pos) => {
        const [dimensionId, optionId] = typeof node.attrs.protocolColumn === 'string' ? node.attrs.protocolColumn.split(':') : [];
        if (dimensionId && !exists(dimensionId, optionId)) tr.setNodeMarkup(pos, undefined, { ...node.attrs, protocolColumn: null });
      });
      if (tr.docChanged) editor.view.dispatch(tr.setMeta('addToHistory', false));
    }
    const lens = lensRef.current;
    if (Object.entries(lens).some(([dimensionId, optionId]) => !exists(dimensionId, optionId))) setLens(Object.fromEntries(Object.entries(lens).filter(([dimensionId, optionId]) => exists(dimensionId, optionId))));
    onChangeRef.current(editor ? serialize(editor.getJSON(), next) : { ...documentRef.current, systems: next });
  }, [serialize, setLens]);

  const openChipAt = useCallback((pos: number, focus?: ChipTarget['focus']) => {
    const editor = editorRef.current;
    const node = editor?.state.doc.nodeAt(pos);
    const anchor = editor?.view.nodeDOM(pos);
    if (node?.type.name === 'protocolParameter' && anchor instanceof HTMLElement) setChipTarget({ pos, id: node.attrs.parameterId, anchor, focus });
  }, []);

  /**
   * A typed quantity becomes a parameter: one value is fixed; "50/80 µL" follows the only system with that many options,
   * or the author's remembered answer. Otherwise the text stays as typed and the author is asked beside it.
   */
  const createChip = useCallback((quantity: RecognizedQuantity, pos: number) => {
    const systems = systemsRef.current ?? blankProtocolSystems();
    const id = uid('p');
    // A range keeps the source's two ends; the author adopts one value within it in the chip.
    let source: ProtocolSystems['parameters'][number]['source'] = { kind: 'fixed', value: quantity.range ? null : quantity.values[0], unit: quantity.unit };
    if (quantity.values.length > 1) {
      const match = splitDimension(quantity.values.length, systems);
      const dimension = 'dimensionId' in match ? systems.dimensions.find(d => d.id === match.dimensionId) : undefined;
      if (!dimension) {
        // After the typed character is in the document: ask beside the values, never pick for the author.
        requestAnimationFrame(() => {
          const editor = editorRef.current;
          if (!editor || editor.isDestroyed || editor.state.doc.textBetween(pos, Math.min(pos + quantity.source.length, editor.state.doc.content.size), undefined, '￼') !== quantity.source) return;
          const { top, left, bottom } = editor.view.coordsAtPos(pos);
          setSplitPrompt({ from: pos, source: quantity.source, values: quantity.values, unit: quantity.unit, anchor: { top, left, bottom } });
        });
        return null;
      }
      source = splitLookupSource(quantity.values, quantity.unit, dimension, () => uid('value'));
    }
    const created = { id, label: '', unit: quantity.unit, origin: 'chip' as const, source, ...(quantity.range ? { range: quantity.range } : {}) };
    systemsRef.current = { ...systems, parameters: [...systems.parameters, created] };
    // The chip carries its final display attributes so no follow-up transaction breaks ⌘Z/Backspace undo of the input rule.
    return { parameterId: id, label: parameterDisplayName(created), unit: created.unit };
  }, []);

  /** "20 min" then " - 30 min": the chip keeps its identity and becomes the range; the author adopts a value in it. */
  const extendChipToRange = useCallback((pos: number, max: { value: number; unit: string }) => {
    const id = editorRef.current?.state.doc.nodeAt(pos)?.attrs.parameterId, systems = systemsRef.current;
    const parameter = systems?.parameters.find(item => item.id === id);
    const next = parameter && chipWithRangeEnd(parameter, max);
    if (!systems || !next) return null;
    systemsRef.current = { ...systems, parameters: systems.parameters.map(item => item.id === next.id ? next : item) };
    // The text can end exactly as it was (the second end replaced by the chip), and then the editor reports no update.
    queueMicrotask(() => { const current = editorRef.current; if (current && !current.isDestroyed) onChangeRef.current(serialize(current.getJSON())); });
    return { parameterId: next.id, label: parameterDisplayName(next), unit: next.unit };
  }, [serialize]);

  /** The author's answer for "50/80 µL": the chip replaces exactly the text that was typed. */
  const chooseSplit = useCallback((choice: SplitChoice) => {
    const prompt = splitPrompt, editor = editorRef.current;
    setSplitPrompt(null);
    if (!prompt || !editor || editor.isDestroyed) return;
    const { from, source: typed, values, unit } = prompt;
    if (editor.state.doc.textBetween(from, from + typed.length, undefined, '￼') !== typed) return;
    let systems = systemsRef.current ?? blankProtocolSystems();
    let dimension = 'dimensionId' in choice ? systems.dimensions.find(d => d.id === choice.dimensionId) : undefined;
    if ('create' in choice) {
      dimension = { id: uid('dimension'), label: systems.dimensions.some(d => d.label === '体系') ? `体系 ${systems.dimensions.length + 1}` : '体系', kind: 'system', options: values.map((_, index) => ({ id: uid('option'), label: String.fromCharCode(65 + index) })) };
      systems = { ...systems, dimensions: [...systems.dimensions, dimension] };
    }
    if (!dimension) return;
    const created = { id: uid('p'), label: '', unit, origin: 'chip' as const, source: splitLookupSource(values, unit, dimension, () => uid('value')) };
    systemsRef.current = { ...systems, parameters: [...systems.parameters, created],
      ...('remember' in choice && choice.remember ? { splitChoices: { ...systems.splitChoices, [values.length]: dimension.id } } : {}) };
    const marks = editor.state.doc.resolve(from).marks();
    editor.view.dispatch(editor.state.tr.replaceWith(from, from + typed.length, editor.schema.nodes.protocolParameter.create({ parameterId: created.id, label: parameterDisplayName(created), unit }, null, marks)));
    editor.view.focus();
  }, [splitPrompt]);
  const closeSplit = useCallback(() => { setSplitPrompt(null); editorRef.current?.view.focus(); }, []);

  const [extensions] = useState(protocolEditorExtensions);

  const editor = useEditor({
    immediatelyRender: false,
    content: initialContent as JSONContent,
    extensions,
    editorProps: {
      // Clicking media inside a template must not select the enclosing Protocol widget.
      handleDOMEvents: {
        // Nested instruction editors own their selection; the outer view must not select the whole template.
        mousedown: (view, event) => event.target instanceof Element && event.target.closest('[contenteditable="true"]') !== view.dom,
      },
      attributes: {
        class: "ln-protocol-tiptap",
        spellcheck: "true",
        "aria-label": "Protocol document body",
      },
    },
    onUpdate: ({ editor: nextEditor }) => {
      onChangeRef.current(serialize(nextEditor.getJSON()));
    },
  });
  useLayoutEffect(() => { editorRef.current = editor; }, [editor]);
  useDocumentMediaUploads(editor, uploadDraftId);

  useLayoutEffect(() => {
    if (!editor) return;
    setProtocolHandlers(editor, {
      createChip, extendChipToRange, openChip: pos => openChipAt(pos, 'value'),
      // "/" opens the grouped menu at the caret; the typed query follows the text after it.
      openMenu: from => { const coords = editor.view.coordsAtPos(from); setInsertMenu({ mode: 'slash', from, query: '', anchor: { top: coords.top, left: coords.left, bottom: coords.bottom } }); },
      menuKey: event => insertKeyRef.current?.(event) ?? splitKeyRef.current?.(event) ?? false,
      menuOpen: () => Boolean(insertMenuRef.current || splitKeyRef.current),
      systems: () => systemsRef.current,
      lens: () => lensRef.current,
      stepsAllowed: () => stepsAllowedIn(documentRef.current),
    });
  });
  useSlashQuery(editor, insertMenu, setInsertMenu);

  // The typed values may move while the author keeps writing; the question follows them or closes when they change.
  useEffect(() => {
    if (!editor || !splitPrompt) return;
    const follow = ({ transaction }: { transaction: import('@tiptap/pm/state').Transaction }) => {
      if (!transaction.docChanged) return;
      const from = transaction.mapping.map(splitPrompt.from), { doc } = editor.state;
      setSplitPrompt(doc.textBetween(from, Math.min(from + splitPrompt.source.length, doc.content.size), undefined, '￼') === splitPrompt.source ? { ...splitPrompt, from } : null);
    };
    editor.on('transaction', follow);
    return () => { editor.off('transaction', follow); };
  }, [editor, splitPrompt]);
  // Condition tags follow systems edited outside the editor too.
  useEffect(() => { if (editor && !editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta('protocolSystems', true).setMeta('addToHistory', false)); }, [editor, document.systems]);

  // Organizer and parameter changes update attributes in place. The editor, selection,
  // undo history and scroll host remain mounted while these panels are used.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const blocks = new Map(document.sections.flatMap(section => section.blocks.map(block => [block.id, block] as const)));
    const tr = editor.state.tr;
    // First-time organization may split an unmarked rich/list block into explicit
    // source fragments. Replace only that section in one transaction; never remount.
    const desired = protocolDocumentToTiptap(document).content?.find(node => node.attrs?.sectionKey === 'steps');
    let replacedSteps = false;
    editor.state.doc.descendants((section, position) => {
      if (section.type.name !== 'protocolSection' || section.attrs.sectionKey !== 'steps' || !desired) return;
      let needsStructure = false;
      section.forEach(node => { const id = node.attrs.protocolBlockId ?? node.attrs.block?.id; if (id && !blocks.has(id) && [...blocks.keys()].some(nextId => nextId.startsWith(`${id}:`))) needsStructure = true; });
      if (!needsStructure) return false;
      const replacement = editor.schema.nodeFromJSON(desired);
      const { from, to } = editor.state.selection;
      tr.replaceWith(position + 1, position + section.nodeSize - 1, replacement.content);
      if (from > position && to < position + section.nodeSize) {
        const maximum = position + replacement.nodeSize - 2;
        tr.setSelection(TextSelection.between(tr.doc.resolve(Math.min(from, maximum)), tr.doc.resolve(Math.min(to, maximum))));
      }
      replacedSteps = true;
      return false;
    });
    if (replacedSteps) { editor.view.dispatch(tr); return; }
    editor.state.doc.descendants((node, position, parent) => {
      if (node.type.name === 'protocolParameter') {
        const parameter = document.systems?.parameters.find(item => item.id === node.attrs.parameterId);
        const label = parameter ? parameterDisplayName(parameter) : '参数已删除', unit = parameter?.unit ?? '';
        if (node.attrs.label !== label || node.attrs.unit !== unit) tr.setNodeMarkup(position, undefined, { ...node.attrs, label, unit });
        return;
      }
      // Inside a step block, ownership belongs to the step; children carry no marks.
      if (parent?.type.name === 'protocolStep') return;
      const id = node.attrs.protocolBlockId ?? node.attrs.block?.id;
      const block = blocks.get(id);
      if (!block) return;
      if ('protocolExecution' in node.attrs && JSON.stringify(node.attrs.protocolExecution ?? null) !== JSON.stringify(block.execution ?? null)) {
        tr.setNodeMarkup(position, undefined, { ...node.attrs, protocolExecution: block.execution ?? null });
      } else if (node.attrs.block && JSON.stringify(node.attrs.block.execution ?? null) !== JSON.stringify(block.execution ?? null)) {
        tr.setNodeMarkup(position, undefined, { ...node.attrs, block: { ...node.attrs.block, execution: block.execution } });
      }
    });
    if (tr.docChanged) editor.view.dispatch(tr.setMeta('addToHistory', false));
  }, [document, editor]);

  const insertChipAfter = useCallback((pos: number, parameterId: string) => {
    const current = editorRef.current, parameter = systemsRef.current?.parameters.find(item => item.id === parameterId);
    if (!current || !parameter || current.state.doc.nodeAt(pos)?.type.name !== 'protocolParameter') return null;
    current.chain().insertContentAt(pos + 1, [{ type: 'text', text: ' ' }, { type: 'protocolParameter', attrs: { parameterId, label: parameterDisplayName(parameter), unit: parameter.unit } }]).run();
    return pos + 2;
  }, []);
  const revealParameter = useCallback((parameterIds: string[]) => {
    const current = editorRef.current;
    if (!current || current.isDestroyed) return;
    let found = -1;
    current.state.doc.descendants((node, pos) => { if (found < 0 && node.type.name === 'protocolParameter' && parameterIds.includes(node.attrs.parameterId)) found = pos; return found < 0; });
    if (found < 0) return;
    current.view.dispatch(current.state.tr.setSelection(NodeSelection.create(current.state.doc, found)));
    const chip = current.view.nodeDOM(found);
    if (chip instanceof HTMLElement) chip.scrollIntoView({ block: 'center' });
    requestAnimationFrame(() => openChipAt(found, 'value'));
  }, [openChipAt]);
  // A stock item linked from a chip joins the materials table, so the list of materials stays whole.
  const addMaterial = useCallback((name: string) => {
    const current = editorRef.current;
    if (!current || current.isDestroyed) return undefined;
    let table: { pos: number; node: ProseMirrorNode } | undefined;
    current.state.doc.descendants((node, pos) => {
      if (table) return false;
      if (node.type.name === 'protocolSection') return node.attrs.sectionKey === 'material';
      if (node.type.name === 'table') { table = { pos, node }; return false; }
      return true;
    });
    const header = table?.node.firstChild;
    if (!table || !header) return undefined;
    const headers: string[] = [];
    header.forEach(cell => { headers.push(cell.textContent); });
    const nameIndex = protocolTableColumnIndex(headers, ["name", "material", "reagent", "名称", "材料", "试剂"], 0), rowId = `row-${uid('material')}`;
    const { schema } = current.state, cells: ProseMirrorNode[] = [];
    header.forEach((_cell, _offset, index) => { cells.push(schema.nodes.tableCell.create(null, schema.nodes.paragraph.create(null, index === nameIndex ? schema.text(name) : null))); });
    current.view.dispatch(current.state.tr.insert(table.pos + table.node.nodeSize - 1, schema.nodes.tableRow.create({ protocolRowId: rowId }, cells)));
    return rowId;
  }, []);
  const stepsAllowed = stepsAllowedIn(document);
  const api = useMemo<ProtocolEditorApi>(() => ({
    systems: document.systems, updateSystems, lens, setLens, materials: protocolMaterials(document), inventory, addMaterial,
    openChip: setChipTarget, revealParameter, insertChipAfter, stepsAllowed,
  }), [document, updateSystems, lens, setLens, inventory, addMaterial, revealParameter, insertChipAfter, stepsAllowed]);

  /** Insert from "/" or "＋": chips open their editor at once so the value is typed next. */
  const insertChoice = useCallback((choice: InsertChoice) => {
    const current = editorRef.current, menu = insertMenuRef.current;
    if (!current) return;
    setInsertMenu(null);
    const chain = current.chain().focus();
    if (menu?.mode === 'slash') chain.deleteRange({ from: menu.from, to: current.state.selection.from });
    if (choice.type === 'block') { turnInto(current, chain, choice.kind).run(); return; }
    if (choice.type === 'table') { chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); return; }
    if (choice.type === 'image') { chain.run(); chooseFiles(current, uploadDraftId, 'image/*'); return; }
    if (choice.type === 'file') { chain.run(); chooseFiles(current, uploadDraftId); return; }
    if (choice.type === 'result-template') {
      const resultTemplate = emptyRecordTemplate();
      chain.insertContent({ type: 'protocolWidget', attrs: { block: { id: uniqueBlockId('result-template'), type: 'table', caption: resultTemplate.title, rows: resultTemplateFieldsToRows(resultTemplate), resultTemplate } } }).run();
      return;
    }
    if (choice.type === 'embedded-tool') {
      const tool = labToolManifest.find(item => item.id === 'free-plate-layout') ?? labToolManifest[0];
      chain.insertContent({ type: 'protocolWidget', attrs: { block: { id: uniqueBlockId('embedded-tool'), type: 'embedded_tool', sourceKind: 'manifest', toolId: tool?.id, label: tool?.name ?? 'Plate Map Planner', url: tool?.launchUrl ?? '/tools' } } }).run();
      return;
    }
    if (choice.type === 'program') { chain.insertContent({ type: 'protocolWidget', attrs: { block: defaultPcrProgram(uid) } }).run(); return; }
    if (choice.type === 'mix') { const created = newMix(uid); updateSystems(systems => ({ ...systems, parameters: [...systems.parameters, ...created.parameters] })); chain.insertContent({ type: 'protocolWidget', attrs: { block: created.block } }).run(); return; }
    if (choice.type === 'callout') { chain.insertContent({ type: 'protocolWidget', attrs: { block: { id: uniqueBlockId('callout'), type: 'callout', tone: 'warning', text: '' } } }).run(); return; }
    if (choice.type === 'step') {
      chain.run();
      const { state } = current, { $from } = state.selection;
      if (!inStepsSection(state.selection.$from)) return;
      let insertAt = -1;
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        if ($from.node(depth).type.name === 'protocolStep' || $from.node(depth - 1)?.type.name === 'protocolSection') { insertAt = $from.after(depth); break; }
      }
      if (insertAt < 0) return;
      const empty = $from.parent.type.name === 'paragraph' && !$from.parent.content.size && $from.node($from.depth - 1).type.name === 'protocolSection';
      const step = state.schema.nodes.protocolStep.create({ stepId: null }, state.schema.nodes.paragraph.create());
      const tr = empty ? state.tr.replaceWith($from.before(), $from.after(), step) : state.tr.insert(insertAt, step);
      const at = empty ? $from.before() + 2 : insertAt + 2;
      current.view.dispatch(tr.setSelection(TextSelection.create(tr.doc, at)).scrollIntoView());
      return;
    }
    const pos = current.state.selection.from - (menu?.mode === 'slash' ? current.state.selection.from - menu.from : 0);
    if (choice.type === 'parameter') {
      const parameter = systemsRef.current?.parameters.find(item => item.id === choice.id);
      if (parameter) chain.insertContent([{ type: 'protocolParameter', attrs: { parameterId: parameter.id, label: parameterDisplayName(parameter), unit: parameter.unit } }, { type: 'text', text: ' ' }]).run();
      return;
    }
    let id: string;
    if (choice.type === 'calculation') {
      // Inputs start as chips of their own (measured ones are filled in the Run); the first result goes into the text.
      const systems = systemsRef.current ?? blankProtocolSystems();
      const created = newCalculation(choice.calculator, systems, uid);
      id = created.resultId;
      systemsRef.current = { ...systems, parameters: [...systems.parameters, ...created.parameters] };
    } else if (choice.type === 'quantity' || choice.type === 'stock') {
      id = uid('p');
      const unit = choice.type === 'stock' ? 'µL' : choice.unit;
      systemsRef.current = { ...(systemsRef.current ?? blankProtocolSystems()), parameters: [...(systemsRef.current?.parameters ?? []), { id, label: '', unit, origin: 'chip', source: { kind: 'fixed', value: null, unit } }] };
    } else {
      id = uid('tool');
      const spec = toolSpecs[choice.tool];
      const fields = spec.fields.filter(field => !field.optional).map(field => ({ key: field.key, parameterId: uid('p'), unit: field.units[0] }));
      const systems = systemsRef.current ?? blankProtocolSystems();
      systemsRef.current = { ...systems, parameters: [...systems.parameters, ...fields.map(field => ({ id: field.parameterId, label: '', unit: field.unit, ownerToolId: id, source: { kind: 'fixed' as const, value: null, unit: field.unit } }))],
        tools: [...(systems.tools ?? []), { id, kind: choice.tool, fields: fields.map(({ key, parameterId }) => ({ key, parameterId })) }] };
    }
    chain.insertContent([{ type: 'protocolParameter', attrs: { parameterId: id, label: '', unit: '' } }, { type: 'text', text: ' ' }]).run();
    // A stock material is named first (from stock), then given its amount.
    requestAnimationFrame(() => openChipAt(pos, choice.type === 'stock' ? 'stock' : 'value'));
  }, [openChipAt, uploadDraftId, updateSystems]);

  // A recipe table becomes a mix card: names from the first column, amounts (and per-system columns) as chips.
  const tableToMix = useCallback(() => {
    const current = editorRef.current;
    if (!current) return;
    const table = findParentNodeClosestToPos(current.state.selection.$from, node => node.type.name === 'table');
    if (!table) return;
    const parsed = tiptapToProtocolDocument({ type: 'doc', content: [{ type: 'protocolSection', attrs: { sectionKey: 'material' }, content: [table.node.toJSON()] }] });
    const block = parsed.sections.flatMap(section => section.blocks).find(item => item.type === 'table');
    if (!block || block.type !== 'table' || block.rows.length < 2) return;
    setConversionError('');
    try {
      const created = recipeTableToMix(block, uid, systemsRef.current);
      if (!created.block.components.length) return;
      updateSystems(systems => ({ ...systems, parameters: [...systems.parameters, ...created.parameters] }));
      current.view.dispatch(current.state.tr.replaceWith(table.pos, table.pos + table.node.nodeSize, current.schema.nodes.protocolWidget.create({ block: created.block })));
    } catch (error) { setConversionError(error instanceof Error ? error.message : String(error)); }
  }, [updateSystems]);
  // A bench-made mix card goes to the end of the step it was made in (or where the caret is). Saving keeps it.
  const addProposedMix = useCallback((proposal: MixProposal) => {
    const current = editorRef.current;
    if (!current) return;
    let at = -1;
    current.state.doc.descendants((node, pos) => { if (at < 0 && node.type.name === 'protocolStep' && node.attrs.stepId === proposal.stepRef) at = pos + node.nodeSize - 1; });
    const widget = current.schema.nodes.protocolWidget.create({ block: proposal.mix });
    current.view.dispatch(at >= 0 ? current.state.tr.insert(at, widget) : current.state.tr.replaceSelectionWith(widget));
    current.view.focus();
  }, []);
  const closeChip = useCallback(() => {
    const target = chipTarget, current = editorRef.current;
    setChipTarget(null);
    if (!target || !current || current.isDestroyed) return;
    // Back to writing right after the chip, without waiting a frame for the editor's own focus.
    const node = current.state.doc.nodeAt(target.pos);
    if (node?.type.name === 'protocolParameter') current.view.dispatch(current.state.tr.setSelection(TextSelection.create(current.state.doc, target.pos + 1)));
    current.view.focus();
  }, [chipTarget]);
  const deleteChip = useCallback(() => {
    const target = chipTarget, current = editorRef.current;
    setChipTarget(null);
    if (!target || !current) return;
    const node = current.state.doc.nodeAt(target.pos);
    if (node?.type.name === 'protocolParameter' && node.attrs.parameterId === target.id) current.chain().focus().deleteRange({ from: target.pos, to: target.pos + 1 }).run();
  }, [chipTarget]);
  // A block deleted with ⋮⋮ takes its 适用范围 with it, so no rule is left pointing at nothing.
  const forgetRules = useCallback((unit: BlockUnit) => {
    const ids = new Set<string>();
    const own = (node: BlockUnit['node']) => { const id = node.attrs.stepId ?? node.attrs.protocolBlockId ?? node.attrs.block?.id; if (typeof id === 'string') ids.add(id); };
    own(unit.node);
    unit.node.descendants(node => { own(node); });
    if (ids.size) updateSystems(systems => ({ ...systems, rules: systems.rules.filter(rule => !ids.has(rule.targetId)) }));
  }, [updateSystems]);

  if (!editor) return <div className="ln-wysiwyg-loading">Loading document editor…</div>;
  /** ⋮⋮ of a step or block: its 适用范围 (and, for a step, whether it is optional). */
  const blockItems = (unit: BlockUnit): BlockMenuItem[] => {
    const step = unit.node.type.name === 'protocolStep' ? unit.node.attrs.stepId as string | null : null;
    const id = step ?? unit.node.attrs.protocolBlockId ?? unit.node.attrs.block?.id;
    if (typeof id !== 'string') return [];
    return [{ id: 'scope', label: step ? 'Applies to & optional…' : 'Applies to…', icon: Filter, run: (target, anchor) => setConditionTarget({ kind: step ? 'step' : 'block', id, anchor, pos: target.pos }) }];
  };
  /** A recipe column's 适用范围 is set on its header cell, wherever the caret is in the column. */
  const columnScope = () => {
    const { $from } = editor.state.selection;
    const table = findParentNodeClosestToPos($from, node => node.type.name === 'table');
    const cell = findParentNodeClosestToPos($from, node => ['tableCell', 'tableHeader'].includes(node.type.name));
    if (!table || !cell || cell.depth <= table.depth) return;
    const map = TableMap.get(table.node), pos = table.start + map.map[map.colCount(cell.pos - table.start)];
    const { top, left, bottom } = editor.view.coordsAtPos($from.pos);
    setConditionTarget({ kind: 'column', id: editor.state.doc.nodeAt(pos)?.attrs.protocolColumn ?? '', anchor: { top, left, bottom }, pos });
  };
  const tableItems = () => [
    { id: 'column-scope', label: 'Column applies to…', run: columnScope },
    { id: 'to-mix', label: 'Turn into mix card', run: tableToMix },
  ];
  return <ProtocolEditorContext.Provider value={api}><>
    <section className="ln-wysiwyg-editor" data-lens={Object.keys(lens).length ? '' : undefined}>
    <SystemsBar />
    {conversionError ? <p role="alert" className="ln-chip-error">{conversionError}</p> : null}
    <MixProposals proposals={mixProposals} onAdd={addProposedMix} onDismiss={onDismissMixProposal} />
    <EditorSurface editor={editor} kinds={['paragraph', 'heading', 'subheading', 'quote', 'bullet', 'ordered']} openCommands={anchor => setInsertMenu({ mode: 'button', query: '', anchor })} insertImage={() => chooseFiles(editor, uploadDraftId, 'image/*')} blockItems={blockItems} tableItems={tableItems} afterDelete={forgetRules}><EditorContent editor={editor} /></EditorSurface>
    </section>
    {chipTarget ? <ChipPopover key={`${chipTarget.pos}:${chipTarget.id}`} target={chipTarget} onDelete={deleteChip} onClose={closeChip} /> : null}
    {splitPrompt ? <SplitPrompt prompt={splitPrompt} systems={document.systems} keyRef={splitKeyRef} onChoose={chooseSplit} onClose={closeSplit} /> : null}
    {conditionTarget ? <ConditionMenu key={`${conditionTarget.kind}:${conditionTarget.pos}`} target={conditionTarget} onColumn={value => { const cell = editor.state.doc.nodeAt(conditionTarget.pos); if (cell) editor.view.dispatch(editor.state.tr.setNodeMarkup(conditionTarget.pos, undefined, { ...cell.attrs, protocolColumn: value })); setConditionTarget({ ...conditionTarget, id: value ?? '' }); }} onClose={() => { setConditionTarget(null); editor.view.focus(); }} /> : null}
    {insertMenu ? <InsertMenu editor={editor} state={insertMenu} stepsAllowed={stepsAllowed && inStepsSection(editor.state.selection.$from)} systems={document.systems} keyRef={insertKeyRef} onChoose={insertChoice} onClose={() => { setInsertMenu(null); editor.view.focus(); }} /> : null}
    {actionsHostId ? <DocumentAttachmentsButton editor={editor} hostId={actionsHostId} /> : null}
  </></ProtocolEditorContext.Provider>;
}
