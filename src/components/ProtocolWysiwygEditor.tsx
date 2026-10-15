"use client";
import { documentScriptMarks } from "@/lib/tiptap-document-extensions";
import { TextSelection } from '@tiptap/pm/state';
import type { ResolvedPos } from '@tiptap/pm/model';
import { ProtocolParameterNode } from '@/lib/protocol-parameter-node';
import { ProtocolEditorIdentities } from '@/lib/protocol-editor-identities';
import { ProtocolStepNode } from '@/lib/protocol-step-node';
import { ProtocolChipInput, ProtocolConditionDecorations, ProtocolEditorHandlerStorage, ProtocolSlashMenu, setProtocolHandlers } from '@/lib/protocol-editor-extensions';
import { parameterDisplayName, splitDimension, splitLookupSource, toolSpecs, type RecognizedQuantity } from '@/lib/protocol-chips';
import { blankProtocolSystems, type ProtocolSystems } from '@/lib/protocol-systems-schema';
import type { ProtocolSelection } from '@/lib/structured-protocol';
import { prefixedClientId as uid } from '@/lib/client-mutation-id';
import { protocolTableColumnIndex } from '@/lib/protocol-document';
import { executionBlockText } from '@/lib/protocol-execution';
import { ChipNodeView } from './protocol/ChipNodeView';
import { StepNodeView } from './protocol/StepNodeView';
import { ChipPopover } from './protocol/ChipPopover';
import { ConditionMenu } from './protocol/ConditionMenu';
import { InsertMenu, type InsertChoice, type InsertMenuState } from './protocol/InsertMenu';
import { SplitPrompt, type SplitChoice, type SplitPromptState } from './protocol/SplitPrompt';
import { SystemsBar } from './protocol/SystemsBar';
import { ProgramEditor } from './protocol/ProgramCard';
import { defaultPcrProgram } from '@/lib/protocol-program';
import { newCalculation } from '@/lib/protocol-calculations';
import { ProtocolEditorContext, type ChipTarget, type ConditionTarget, type ProtocolEditorApi } from './protocol/ProtocolEditorContext';
import './protocol/protocol.css';

import { useCallback, useEffect, useLayoutEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type Editor, type JSONContent } from "@tiptap/core";
import { EditorContent, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, type NodeViewProps } from "@tiptap/react";
import { DocumentMediaNode } from "./DocumentMediaNode";
import { documentMediaInsertActions, insertDocumentMediaFiles, useDocumentMediaUploads } from "./DocumentMediaUploads";
import StarterKit from "@tiptap/starter-kit";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import {
  AlertTriangle,
  FlaskConical,
  GripVertical,
  ImagePlus,
  Paperclip,
  Filter,
  Plus,
  Trash2,
  Wrench,
} from "lucide-react";
import { DocumentWysiwygToolbar, wysiwygWidgetInputClass } from "@/components/DocumentWysiwygToolbar";
import { DocumentToolbarTargetContext } from "@/components/DocumentToolbarTargetContext";
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
import { createDefaultResultTemplate, resultTemplateFieldsToRows } from "@/lib/result-templates";
import { labToolManifest } from "@/lib/tool-manifest";
import { createDocumentBlockLineHeightExtension, createDocumentLegacyAttributesExtension, createDocumentSectionExtension, createDocumentWidgetExtension, createResizableDocumentTableExtension } from "@/lib/tiptap-document-extensions";

type WidgetBlock = Extract<ProtocolContentBlock, { type: "timer" | "callout" | "media" | "embedded_tool" | "table" | "program" }>;

function uniqueBlockId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function embeddableToolUrl(value: string) {
  const trimmed = value.trim();
  return /^(https:\/\/|\/)/i.test(trimmed) ? trimmed : undefined;
}

function ProtocolSectionNodeView({ node }: NodeViewProps) {
  const sectionKey = node.attrs.sectionKey as ProtocolSectionKey;
  return <NodeViewWrapper as="section" id={`protocol-section-${sectionKey}`} className="ln-protocol-section" data-section-key={sectionKey}>
    <header className="ln-protocol-section-heading" contentEditable={false}>
      <span className="ln-protocol-section-rule" aria-hidden />
      <h2 style={node.attrs.titleFontSizePt ? {fontSize: `${node.attrs.titleFontSizePt}pt`} : undefined}>{protocolSectionLabels[sectionKey] ?? sectionKey}</h2>
    </header>
    <NodeViewContent as="div" className="ln-protocol-section-content" />
  </NodeViewWrapper>;
}

function ProtocolWidgetNodeView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const block = node.attrs.block as WidgetBlock;
  const updateBlock = (next: WidgetBlock) => updateAttributes({ block: next });
  const isResultTemplate = block.type === "table" && Boolean(block.resultTemplate);
  const resultTemplate = block.type === "table" ? block.resultTemplate : undefined;

  return <NodeViewWrapper className={cn("ln-protocol-widget", selected && "is-selected")} data-widget-type={block.type}>
    <div className="document-print-only"><ProtocolContentBlockView block={block} /></div>
    <div contentEditable={false} data-print-hidden>
      <div className="ln-protocol-widget-rail" data-print-hidden>
        <button type="button" className="ln-protocol-widget-grip" data-drag-handle aria-label="Move block"><GripVertical aria-hidden /></button>
        <button type="button" className="ln-protocol-widget-delete" onClick={deleteNode} aria-label="Remove block"><Trash2 aria-hidden /></button>
      </div>
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
      {block.type === "table" && !isResultTemplate ? <InlineTableEditor rows={block.rows} onChange={(rows) => updateBlock({ ...block, rows })} caption={block.caption} onCaptionChange={(caption) => updateBlock({ ...block, caption })} /> : null}
      {block.type === "table" && isResultTemplate ? <details className="ln-protocol-result-template-editor">
        <summary><span><FlaskConical aria-hidden /><strong>{resultTemplate?.title ?? resultTemplate?.result_type ?? "Result template"}</strong></span><small>{resultTemplate?.fields.length ?? 0} fields · {resultTemplate?.datasets?.length ?? 0} data tables · {resultTemplate?.artifacts?.length ?? 0} files</small><em>Edit</em></summary>
        <div className="ln-protocol-result-template-editor-body"><ResultTemplateConfigEditor block={block} onChange={updateBlock} /></div>
      </details> : null}
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
      StarterKit.configure({ link: { openOnClick: false, autolink: false }, trailingNode: false }),
      TextStyleKit.configure({ backgroundColor: false }),
      createDocumentBlockLineHeightExtension(),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      createResizableDocumentTableExtension(),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ includeChildren: true, placeholder: ({ editor: current, node, pos }) => {
        if (node.type.name !== 'paragraph') return '';
        const $pos = current.state.doc.resolve(pos);
        for (let depth = $pos.depth; depth > 0; depth -= 1) if ($pos.node(depth).type.name === 'protocolStep') return '写下这一步。回车新建下一步，Shift+回车换行';
        return '输入 / 插入参数、工具或内容';
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
      ProtocolConditionDecorations,
      ...documentScriptMarks,
      ProtocolSection,
      ProtocolWidget,
      DocumentMediaNode,
  ];
}

export function ProtocolWysiwygEditor({ document, onChange, toolbarHostId, uploadDraftId }: { document: ProtocolDocument; onChange: (document: ProtocolDocument) => void; toolbarHostId?: string; uploadDraftId: string }) {
  const [initialContent] = useState(() => protocolDocumentToTiptap(document)); // The form owns one document for the lifetime of this editor.
  const onChangeRef = useRef(onChange);
  const importWarningsRef = useRef(document.importWarnings);
  // Authoring metadata can change without rebuilding the editor or its selection.
  const documentRef = useRef(document);
  // Chips create parameters inside an editor transaction: serialization must already see them.
  const systemsRef = useRef<ProtocolSystems | undefined>(document.systems);
  useLayoutEffect(() => { documentRef.current = document; systemsRef.current = document.systems; }, [document]);
  const inputPrefix = useId();
  const imageInputId = `${inputPrefix}-protocol-images`;
  const fileInputId = `${inputPrefix}-protocol-files`;
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [lens, setLensState] = useState<ProtocolSelection>({});
  const lensRef = useRef(lens);
  const [chipTarget, setChipTarget] = useState<ChipTarget | null>(null);
  const [conditionTarget, setConditionTarget] = useState<ConditionTarget | null>(null);
  const [insertMenu, setInsertMenu] = useState<InsertMenuState | null>(null);
  const insertMenuRef = useRef(insertMenu);
  const insertKeyRef = useRef<((event: KeyboardEvent) => boolean) | null>(null);
  const [splitPrompt, setSplitPrompt] = useState<SplitPromptState | null>(null);
  const splitKeyRef = useRef<((event: KeyboardEvent) => boolean) | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const openImagePicker = useCallback(() => globalThis.document.getElementById(imageInputId)?.click(), [imageInputId]);
  const openFilePicker = useCallback(() => globalThis.document.getElementById(fileInputId)?.click(), [fileInputId]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { insertMenuRef.current = insertMenu; }, [insertMenu]);

  const serialize = useCallback((json: JSONContent, systems = systemsRef.current) => tiptapToProtocolDocument(json, importWarningsRef.current, documentRef.current.executionConfirmed, systems), []);
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
    let source: ProtocolSystems['parameters'][number]['source'] = { kind: 'fixed', value: quantity.values[0], unit: quantity.unit };
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
    const created = { id, label: '', unit: quantity.unit, origin: 'chip' as const, source };
    systemsRef.current = { ...systems, parameters: [...systems.parameters, created] };
    // The chip carries its final display attributes so no follow-up transaction breaks ⌘Z/Backspace undo of the input rule.
    return { parameterId: id, label: parameterDisplayName(created), unit: created.unit };
  }, []);

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
      createChip, openChip: pos => openChipAt(pos, 'value'),
      // "/" opens the grouped menu at the caret; the typed query follows the text after it.
      openMenu: from => { const coords = editor.view.coordsAtPos(from); setInsertMenu({ mode: 'slash', from, query: '', anchor: { top: coords.top, left: coords.left, bottom: coords.bottom } }); },
      menuKey: event => insertKeyRef.current?.(event) ?? splitKeyRef.current?.(event) ?? false,
      menuOpen: () => Boolean(insertMenuRef.current || splitKeyRef.current),
      systems: () => systemsRef.current,
      lens: () => lensRef.current,
      stepsAllowed: () => stepsAllowedIn(documentRef.current),
    });
  });
  useEffect(() => {
    if (!editor || insertMenu?.mode !== 'slash') return;
    const track = () => {
      const { from } = insertMenu, cursor = editor.state.selection.from;
      const text = cursor > from ? editor.state.doc.textBetween(from, cursor, '\n', '￼') : '';
      if (!/^[/、／]/.test(text) ||/[\s\n￼]/.test(text) || text.length > 24 || !editor.state.selection.empty) setInsertMenu(null);
      else if (text.slice(1) !== insertMenu.query) setInsertMenu({ ...insertMenu, query: text.slice(1) });
    };
    editor.on('transaction', track);
    return () => { editor.off('transaction', track); };
  }, [editor, insertMenu]);

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


  const [toolbarEditor, setToolbarEditor] = useState<Editor | null>(null);
  const activateToolbarEditor = useCallback((target: Editor) => setToolbarEditor(target), []);
  const releaseToolbarEditor = useCallback((target: Editor) => setToolbarEditor((current) => current === target ? editor : current), [editor]);
  const toolbarTarget = useMemo(() => ({ activate: activateToolbarEditor, release: releaseToolbarEditor }), [activateToolbarEditor, releaseToolbarEditor]);

  const addFiles = useCallback((files: File[]) => {
    if (!editor || !files.length) return;
    insertDocumentMediaFiles(editor, files, uploadDraftId);
  }, [editor, uploadDraftId]);

  const insertChipAfter = useCallback((pos: number, parameterId: string) => {
    const current = editorRef.current, parameter = systemsRef.current?.parameters.find(item => item.id === parameterId);
    if (!current || !parameter || current.state.doc.nodeAt(pos)?.type.name !== 'protocolParameter') return null;
    current.chain().insertContentAt(pos + 1, [{ type: 'text', text: ' ' }, { type: 'protocolParameter', attrs: { parameterId, label: parameterDisplayName(parameter), unit: parameter.unit } }]).run();
    return pos + 2;
  }, []);
  const stepsAllowed = stepsAllowedIn(document);
  const api = useMemo<ProtocolEditorApi>(() => ({
    systems: document.systems, updateSystems, lens, setLens, materials: protocolMaterials(document),
    openChip: setChipTarget, insertChipAfter, openConditions: setConditionTarget, stepsAllowed,
  }), [document, updateSystems, lens, setLens, insertChipAfter, stepsAllowed]);

  /** Insert from "/" or "＋": chips open their editor at once so the value is typed next. */
  const insertChoice = useCallback((choice: InsertChoice) => {
    const current = editorRef.current, menu = insertMenuRef.current;
    if (!current) return;
    setInsertMenu(null);
    const chain = current.chain().focus();
    if (menu?.mode === 'slash') chain.deleteRange({ from: menu.from, to: current.state.selection.from });
    if (choice.type === 'table') { chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); return; }
    if (choice.type === 'image') { chain.run(); openImagePicker(); return; }
    if (choice.type === 'file') { chain.run(); openFilePicker(); return; }
    if (choice.type === 'result-template') {
      const resultTemplate = createDefaultResultTemplate("measurement");
      chain.insertContent({ type: 'protocolWidget', attrs: { block: { id: uniqueBlockId('result-template'), type: 'table', caption: resultTemplate.result_type, rows: resultTemplateFieldsToRows(resultTemplate), resultTemplate } } }).run();
      return;
    }
    if (choice.type === 'embedded-tool') {
      const tool = labToolManifest.find(item => item.id === 'free-plate-layout') ?? labToolManifest[0];
      chain.insertContent({ type: 'protocolWidget', attrs: { block: { id: uniqueBlockId('embedded-tool'), type: 'embedded_tool', sourceKind: 'manifest', toolId: tool?.id, label: tool?.name ?? 'Plate Map Planner', url: tool?.launchUrl ?? '/tools' } } }).run();
      return;
    }
    if (choice.type === 'program') { chain.insertContent({ type: 'protocolWidget', attrs: { block: defaultPcrProgram(uid) } }).run(); return; }
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
    } else if (choice.type === 'quantity') {
      id = uid('p');
      systemsRef.current = { ...(systemsRef.current ?? blankProtocolSystems()), parameters: [...(systemsRef.current?.parameters ?? []), { id, label: '', unit: choice.unit, origin: 'chip', source: { kind: 'fixed', value: null, unit: choice.unit } }] };
    } else {
      id = uid('tool');
      const spec = toolSpecs[choice.tool];
      const fields = spec.fields.filter(field => !field.optional).map(field => ({ key: field.key, parameterId: uid('p'), unit: field.units[0] }));
      const systems = systemsRef.current ?? blankProtocolSystems();
      systemsRef.current = { ...systems, parameters: [...systems.parameters, ...fields.map(field => ({ id: field.parameterId, label: '', unit: field.unit, ownerToolId: id, source: { kind: 'fixed' as const, value: null, unit: field.unit } }))],
        tools: [...(systems.tools ?? []), { id, kind: choice.tool, fields: fields.map(({ key, parameterId }) => ({ key, parameterId })) }] };
    }
    chain.insertContent([{ type: 'protocolParameter', attrs: { parameterId: id, label: '', unit: '' } }, { type: 'text', text: ' ' }]).run();
    requestAnimationFrame(() => openChipAt(pos, 'value'));
  }, [openChipAt, openImagePicker, openFilePicker]);

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
  const deleteStep = useCallback(() => {
    const target = conditionTarget, current = editorRef.current;
    setConditionTarget(null);
    if (!target || !current) return;
    const node = current.state.doc.nodeAt(target.pos);
    if (node?.type.name !== 'protocolStep') return;
    const section = current.state.doc.resolve(target.pos).parent;
    const tr = current.state.tr.delete(target.pos, target.pos + node.nodeSize);
    // A section never becomes empty: keep one empty step to write into.
    if (section.childCount === 1) tr.insert(target.pos, current.schema.nodes.protocolStep.create({ stepId: null }, current.schema.nodes.paragraph.create()));
    current.view.dispatch(tr.scrollIntoView());
    updateSystems(systems => ({ ...systems, rules: systems.rules.filter(rule => !(rule.target === 'step' && rule.targetId === target.id)) }));
  }, [conditionTarget, updateSystems]);

  if (!editor) return <div className="ln-wysiwyg-loading">Loading document editor…</div>;
  const openInsertMenu = (event: React.MouseEvent<HTMLButtonElement>) => { const rect = event.currentTarget.getBoundingClientRect(); setInsertMenu({ mode: 'button', query: '', anchor: { top: rect.top, left: rect.left, bottom: rect.bottom } }); };
  /** "仅…" for the block holding the cursor; a step's first block speaks for the whole step. */
  const openScope = (event: React.MouseEvent<HTMLButtonElement>) => {
    const { $from } = editor.state.selection;
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      const parent = $from.node(depth - 1), node = $from.node(depth);
      // In a table's first row the scope belongs to the column: a recipe column for one system.
      if ((node.type.name === 'tableHeader' || node.type.name === 'tableCell') && $from.index(depth - 2) === 0) { setConditionTarget({ kind: 'column', id: node.attrs.protocolColumn ?? '', anchor: event.currentTarget, pos: $from.before(depth) }); return; }
      if (parent.type.name === 'protocolStep' && $from.index(depth - 1) === 0 && parent.attrs.stepId) { setConditionTarget({ kind: 'step', id: parent.attrs.stepId, anchor: event.currentTarget, pos: $from.before(depth - 1) }); return; }
      if (parent.type.name === 'protocolStep' || parent.type.name === 'protocolSection') {
        const id = node.attrs.protocolBlockId ?? node.attrs.block?.id;
        if (id) setConditionTarget({ kind: 'block', id, anchor: event.currentTarget, pos: $from.before(depth) });
        return;
      }
    }
  };
  const toolbar = <div className="ln-wysiwyg-toolbar-sticky ln-protocol-toolbar" data-print-hidden>
    <button type="button" className="focus-ring ln-insert-plus" aria-label="插入步骤、参数、工具或内容" title="插入步骤、参数、工具或内容（也可输入 /）" onMouseDown={event => event.preventDefault()} onClick={openInsertMenu}><Plus aria-hidden /><span>插入</span></button>
    <button type="button" className="focus-ring ln-insert-plus is-quiet" aria-label="设置光标所在内容的适用范围" title="这段内容仅适用于某个体系或条件" onMouseDown={event => event.preventDefault()} onClick={openScope}><Filter aria-hidden /><span>仅…</span></button>
    <DocumentWysiwygToolbar documentEditor={editor} editor={toolbarEditor ?? editor} ariaLabel="Protocol formatting" checklist={false} insertActions={toolbarEditor && toolbarEditor !== editor ? documentMediaInsertActions(uploadDraftId) : []} />
  </div>;
  const toolbarHost = toolbarHostId ? globalThis.document?.getElementById(toolbarHostId) : null;
  return <ProtocolEditorContext.Provider value={api}><DocumentToolbarTargetContext.Provider value={toolbarTarget}><>
    <section className={cn("ln-wysiwyg-editor", draggingFiles && "is-dragging-files")} data-print-hidden={undefined} data-lens={Object.keys(lens).length ? '' : undefined}>
    {toolbarHost ? createPortal(toolbar, toolbarHost) : toolbar}
    <SystemsBar />
    <input id={imageInputId} type="file" accept="image/*" multiple hidden onChange={(event) => { void addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
    <input id={fileInputId} type="file" multiple hidden onChange={(event) => { void addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
    <div
      className="ln-protocol-editor-drop-zone"
      onDragEnter={(event) => { if (Array.from(event.dataTransfer.types).includes("Files")) { event.preventDefault(); setDraggingFiles(true); } }}
      onDragOver={(event) => { if (Array.from(event.dataTransfer.types).includes("Files")) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; } }}
      onDragLeave={(event) => { const target = event.relatedTarget; if (!target || !(target instanceof Node) || !event.currentTarget.contains(target)) setDraggingFiles(false); }}
      onDrop={(event) => { if (!event.dataTransfer.files.length) return; event.preventDefault(); event.stopPropagation(); setDraggingFiles(false); void addFiles(Array.from(event.dataTransfer.files)); }}
      onFocusCapture={(event) => { if (!(event.target as HTMLElement).closest(".ln-compact-rich-editor")) activateToolbarEditor(editor); }}
    ><EditorContent editor={editor} />{draggingFiles ? <div className="ln-protocol-drop-overlay"><Paperclip aria-hidden />Drop images or files into the Protocol</div> : null}</div>
    </section>
    {chipTarget ? <ChipPopover key={`${chipTarget.pos}:${chipTarget.id}`} target={chipTarget} onDelete={deleteChip} onClose={closeChip} /> : null}
    {splitPrompt ? <SplitPrompt prompt={splitPrompt} systems={document.systems} keyRef={splitKeyRef} onChoose={chooseSplit} onClose={closeSplit} /> : null}
    {conditionTarget ? <ConditionMenu key={`${conditionTarget.kind}:${conditionTarget.pos}`} target={conditionTarget} onDeleteStep={deleteStep} onColumn={value => { const cell = editor.state.doc.nodeAt(conditionTarget.pos); if (cell) editor.view.dispatch(editor.state.tr.setNodeMarkup(conditionTarget.pos, undefined, { ...cell.attrs, protocolColumn: value })); setConditionTarget({ ...conditionTarget, id: value ?? '' }); }} onClose={() => { setConditionTarget(null); editor.view.focus(); }} /> : null}
    {insertMenu ? <InsertMenu state={insertMenu} stepsAllowed={stepsAllowed && inStepsSection(editor.state.selection.$from)} systems={document.systems} keyRef={insertKeyRef} onChoose={insertChoice} onClose={() => setInsertMenu(null)} /> : null}
  </></DocumentToolbarTargetContext.Provider></ProtocolEditorContext.Provider>;
}
