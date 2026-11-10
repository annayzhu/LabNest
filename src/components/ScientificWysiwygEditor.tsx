"use client";

import { ToolOutput, ToolEditContext } from "./ToolOutput";
import { toolInserts } from "./toolInserts";
import { KeepLineAfterBlocks, focusBelow } from "@/lib/editor-block-line";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/components/I18nProvider";
import { newClientMutationId } from "@/lib/client-mutation-id";
import { DocumentMediaNode } from "./DocumentMediaNode";
import { DocumentPlateNode } from "./DocumentPlateNode";
import { DocumentToolNode } from "./DocumentToolNode";
import { RecordReferenceNode } from "./RecordReference";
import { chooseFiles, useDocumentMediaUploads } from "./DocumentMediaUploads";
import { type Editor, type JSONContent } from "@tiptap/core";
import { EditorContent, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, type NodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { AlertTriangle, BarChart3, Database, ImagePlus } from "lucide-react";
import { wysiwygWidgetInputClass } from "./widget-input";
import { SlashCommandTrigger } from "@/lib/editor-slash";
import { BlockHandles } from "@/lib/editor-block-handle";
import { HeadingShortcuts, savedBlocksOnly, writingPlaceholder } from "@/lib/editor-writing";
import { useCommandMenu } from "./EditorCommandMenu";
import { EditorSurface } from "./EditorSurface";
import { WritingCommandMenu, type WritingInsert } from "./WritingCommandMenu";
import { DocumentAttachmentsButton } from "./DocumentAttachmentsButton";
import { insertActionIdsForProfile, type DocumentInsertProfile } from "@/lib/document-editor-workbench";
import { ScientificBlockView } from "@/components/ScientificBlockView";
import { cn } from "@/lib/cn";
import type { ScientificContentBlock, ScientificDocument } from "@/lib/scientific-document";
import { scientificSectionAnchorId } from "@/lib/document-outline";
import { ScientificDocumentNode } from "@/lib/scientific-document-node";
import { scientificDocumentToTiptap, tiptapToScientificDocument } from "@/lib/scientific-tiptap";
import { createDocumentBlockLineHeightExtension, createDocumentLegacyAttributesExtension, createDocumentSectionExtension, createDocumentWidgetExtension, createResizableDocumentTableExtension } from "@/lib/tiptap-document-extensions";

type ScientificWidgetBlock = Extract<ScientificContentBlock, { type: "callout" | "metric" | "media" | "dataset" | "tool_output" }>;

function uniqueBlockId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Read-only content shown at the top of a section, e.g. the Protocol steps inside 执行记录. Never part of the saved document. */
export const ScientificSectionAddons = createContext<Record<string, ReactNode>>({});

function ScientificSectionNodeView({ node }: NodeViewProps) {
  const { t } = useI18n();
  const addon = useContext(ScientificSectionAddons)[node.attrs.sectionKey];
  // Section titles are stored in English; the page translator skips editable content, so translate here.
  return <NodeViewWrapper as="section" id={scientificSectionAnchorId(node.attrs.sectionKey)} className="ln-protocol-section ln-scientific-section" data-section-key={node.attrs.sectionKey}>
    <header className="ln-protocol-section-heading" contentEditable={false}>
      <span className="ln-protocol-section-rule" aria-hidden />
      <h2 style={node.attrs.titleFontSizePt ? {fontSize: `${node.attrs.titleFontSizePt}pt`} : undefined}>{t(node.attrs.sectionTitle)}</h2>
      {node.attrs.sectionKey === "quality_limitations" ? <small>{t("Only record deviations, failed QC, missing data, or limits that change interpretation.")}</small> : null}
    </header>
    {addon ? <div className="ln-scientific-section-addon" contentEditable={false}>{addon}</div> : null}
    <NodeViewContent as="div" className="ln-protocol-section-content" />
  </NodeViewWrapper>;
}

function ScientificWidgetNodeView({ node, updateAttributes, selected }: NodeViewProps) {
  const block = node.attrs.block as ScientificWidgetBlock;
  if (block.type === "tool_output") return <NodeViewWrapper contentEditable={false}><ToolOutput block={block} /></NodeViewWrapper>;
  const updateBlock = (next: ScientificWidgetBlock) => updateAttributes({ block: next });
  return <NodeViewWrapper className={cn("ln-protocol-widget ln-scientific-widget", selected && "is-selected")} data-widget-type={block.type}>
    <div className="document-print-only"><ScientificBlockView block={block} /></div>
    <div contentEditable={false} data-print-hidden>
      {block.type === "callout" ? <div className="ln-protocol-callout-editor">
        <AlertTriangle className="ln-protocol-widget-icon" aria-hidden />
        <select value={block.tone} onChange={(event) => updateBlock({ ...block, tone: event.target.value as typeof block.tone })} className={wysiwygWidgetInputClass} aria-label="Callout level"><option value="note">Note</option><option value="warning">Warning</option><option value="critical">Critical</option></select>
        <input value={block.text} onChange={(event) => updateBlock({ ...block, text: event.target.value })} className={wysiwygWidgetInputClass} placeholder="Important qualification or risk" aria-label="Callout text" />
      </div> : null}
      {block.type === "metric" ? <div className="ln-scientific-metric-editor">
        <BarChart3 className="ln-protocol-widget-icon" aria-hidden />
        <input value={block.label} onChange={(event) => updateBlock({ ...block, label: event.target.value })} className={wysiwygWidgetInputClass} placeholder="Metric" aria-label="Metric name" />
        <input value={block.value} onChange={(event) => updateBlock({ ...block, value: event.target.value })} className={wysiwygWidgetInputClass} placeholder="Value" aria-label="Metric value" />
        <input value={block.unit ?? ""} onChange={(event) => updateBlock({ ...block, unit: event.target.value })} className={wysiwygWidgetInputClass} placeholder="Unit" aria-label="Metric unit" />
      </div> : null}
      {block.type === "media" ? <div className="ln-protocol-media-editor">
        <ImagePlus className="ln-protocol-widget-icon" aria-hidden />
        <select value={block.mediaType} onChange={(event) => updateBlock({ ...block, mediaType: event.target.value as typeof block.mediaType })} className={wysiwygWidgetInputClass} aria-label="Media type"><option value="image">Image</option><option value="video">Video</option><option value="file">File</option></select>
        <input value={block.caption ?? ""} onChange={(event) => updateBlock({ ...block, caption: event.target.value })} className={wysiwygWidgetInputClass} placeholder="Caption" aria-label="Media caption" />
        <input value={block.url} onChange={(event) => updateBlock({ ...block, url: event.target.value })} className={wysiwygWidgetInputClass} placeholder="URL or attachment path" aria-label="Media URL" />
      </div> : null}
      {block.type === "dataset" ? <div className="ln-scientific-dataset-editor">
        <Database className="ln-protocol-widget-icon" aria-hidden />
        <input value={block.label} onChange={(event) => updateBlock({ ...block, label: event.target.value })} className={wysiwygWidgetInputClass} placeholder="Dataset label" aria-label="Dataset label" />
        <input value={block.datasetId} onChange={(event) => updateBlock({ ...block, datasetId: event.target.value })} className={wysiwygWidgetInputClass} placeholder="Dataset ID" aria-label="Dataset ID" />
      </div> : null}
    </div>
  </NodeViewWrapper>;
}

const ScientificSection = createDocumentSectionExtension({ name: "scientificSection", tag: "section[data-scientific-section]", attributes: {
  sectionKey: { default: "section", htmlAttribute: "data-scientific-section" },
  sectionTitle: { default: "Section", htmlAttribute: "data-section-title" },
  titleFontSizePt: { default: null, htmlAttribute: "data-title-size" },
}, nodeView: ReactNodeViewRenderer(ScientificSectionNodeView) });
const ScientificWidget = createDocumentWidgetExtension({ name: "scientificWidget", htmlAttribute: "data-scientific-widget", nodeView: ReactNodeViewRenderer(ScientificWidgetNodeView) });
const ScientificLegacyAttributes = createDocumentLegacyAttributesExtension({ name: "scientificLegacyAttributes", attributes: [
  { name: "scientificBlockId", htmlAttribute: "data-scientific-block-id" },
  { name: "scientificBlockType", htmlAttribute: "data-scientific-block-type" },
  { name: "scientificLineHeight", htmlAttribute: "data-labnest-line-height" },
  { name: "scientificFontFamily", htmlAttribute: "data-labnest-font-family" },
  { name: "scientificCaption", htmlAttribute: "data-scientific-caption" },
] });

function insertWidget(editor: Editor, block: ScientificWidgetBlock) {
  editor.chain().focus().insertContent({ type: "scientificWidget", attrs: { block } }).run();
}

/** What an experiment record, result, plan or report adds to "/" → Insert, by its insert profile. */
function scientificInserts(profile: DocumentInsertProfile): WritingInsert[] {
  const allowed = new Set(insertActionIdsForProfile(profile));
  const inserts: WritingInsert[] = [
    { id: "metric", label: "Metric", hint: "Value with unit", keywords: "zhibiao zb metric value shuzhi", icon: BarChart3, insert: (editor) => insertWidget(editor, { id: uniqueBlockId("metric"), type: "metric", label: "Metric", value: "", unit: "" }) },
    { id: "callout", label: "Tip", hint: "Qualifier, caution or risk", keywords: "tishi ts callout warning zhuyi", icon: AlertTriangle, insert: (editor) => insertWidget(editor, { id: uniqueBlockId("callout"), type: "callout", tone: "note", text: "" }) },
    { id: "dataset", label: "Dataset", hint: "Reference structured data", keywords: "shujuji sjj dataset data", icon: Database, insert: (editor) => insertWidget(editor, { id: uniqueBlockId("dataset"), type: "dataset", datasetId: "", label: "" }) },
  ];
  return inserts.filter((insert) => allowed.has(insert.id));
}

/** An experiment record, result, research plan or report, written Notion-style: "/" to insert, ＋ and ⋮⋮ beside each block, a bubble over selected text. */
const toolOutputIdsIn = (editor: Editor) => {
  const ids = new Set<string>();
  editor.state.doc.descendants((node) => { if (node.attrs.block?.type === "tool_output") ids.add(node.attrs.block.id); });
  return ids;
};

/** Opens a tool where the cursor is: paragraphs split at that line, so what it saves lands right there. */
function openToolAtCursor(editor: Editor, original: ScientificDocument, open: (anchorId: string | undefined, sectionKey: string) => void) {
 const { $from } = editor.state.selection;
    let depth = $from.depth;
    while (depth > 0 && $from.node(depth).type.name !== "scientificSection") depth--;
    if (!depth) return;
    const sectionKey = $from.node(depth).attrs.sectionKey;
    const childIndex = $from.index(depth);
    // Split paragraph groups at the insertion line so the saved block stays here.
    const transaction = editor.state.tr;
    const selectedSection = $from.node(depth);
    const selectedNode = selectedSection.child(childIndex);
    const groupId = selectedNode.attrs.scientificBlockId;
    const anchorGroupId = groupId || uniqueBlockId("text");
    const followingGroupId = uniqueBlockId("text");
    let groupStart = childIndex;
    let groupEnd = childIndex;
    const sameGroup = (index: number) => {
      const node = selectedSection.child(index);
      return "scientificBlockId" in node.attrs && node.attrs.scientificBlockId === groupId;
    };
    while (groupStart > 0 && sameGroup(groupStart - 1)) groupStart--;
    while (groupEnd + 1 < selectedSection.childCount && sameGroup(groupEnd + 1)) groupEnd++;
    selectedSection.forEach((node, offset, index) => {
      if (index < groupStart || index > groupEnd || !("scientificBlockId" in node.attrs)) return;
      const id = index <= childIndex ? anchorGroupId : followingGroupId;
      if (node.attrs.scientificBlockId !== id) transaction.setNodeMarkup($from.start(depth) + offset, undefined, { ...node.attrs, scientificBlockId: id });
    });
    editor.view.dispatch(transaction);
    const prefix = editor.getJSON();
    const section = prefix.content?.find(node => node.attrs?.sectionKey === sectionKey);
    if (section) section.content = section.content?.slice(0, childIndex + 1);
    const anchorId = tiptapToScientificDocument(prefix, original).sections.find(section => section.key === sectionKey)?.blocks.at(-1)?.id;
      open(anchorId, sectionKey);
}


export function ScientificWysiwygEditor({ document, actionsHostId, hiddenSectionKeys = [], insertProfile = "scientific-full", checklist = true, onChange }: {
  document: ScientificDocument;
  /** Where the page header shows this document's actions. */
  actionsHostId?: string;
  hiddenSectionKeys?: string[];
  insertProfile?: DocumentInsertProfile;
  checklist?: boolean;
  onChange: (document: ScientificDocument) => void;
}) {
  const [initialContent] = useState(() => scientificDocumentToTiptap(document, hiddenSectionKeys));
  const [mediaDraftId] = useState(newClientMutationId);
  const originalRef = useRef(document);
  const lastEmittedDocument = useRef<ScientificDocument | null>(null);
  const hiddenSectionKeysRef = useRef(hiddenSectionKeys);
  const hiddenSectionSignature = hiddenSectionKeys.join("\u0000");
  const previousHiddenSectionSignatureRef = useRef(hiddenSectionSignature);
  const onChangeRef = useRef(onChange);
  const openTool = useContext(ToolEditContext);
  const inserts: WritingInsert[] = [...scientificInserts(insertProfile), ...(openTool ? toolInserts((editor, toolId) => openToolAtCursor(editor, originalRef.current, (anchorId, sectionKey) => openTool(undefined, anchorId, sectionKey, toolId))) : [])];
  useEffect(() => { originalRef.current = document; }, [document]);
  useEffect(() => { hiddenSectionKeysRef.current = hiddenSectionKeys; }, [hiddenSectionSignature, hiddenSectionKeys]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const editor = useEditor({
    immediatelyRender: false,
    content: initialContent as JSONContent,
    extensions: [
      StarterKit.configure({ document: false, link: { openOnClick: false, autolink: false }, trailingNode: false, ...savedBlocksOnly }),
      ScientificDocumentNode,
      HeadingShortcuts,
      TextStyleKit.configure({ backgroundColor: false }),
      createDocumentBlockLineHeightExtension(),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      createResizableDocumentTableExtension(),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: writingPlaceholder("Write directly in the document…") }),
      Typography,
      ScientificLegacyAttributes,
      ScientificSection,
      ScientificWidget,
      DocumentMediaNode,
      DocumentPlateNode,
      DocumentToolNode,
      RecordReferenceNode,
      SlashCommandTrigger,
      BlockHandles,
      KeepLineAfterBlocks,
    ],
    editorProps: {
      attributes: { class: "ln-protocol-tiptap ln-scientific-tiptap", spellcheck: "true", "aria-label": "Scientific document body" },
    },
    onUpdate: ({ editor: nextEditor }) => {
      const nextDocument = tiptapToScientificDocument(nextEditor.getJSON(), originalRef.current);
      lastEmittedDocument.current = nextDocument;
      onChangeRef.current(nextDocument);
    },
  });
  useEffect(() => {
    // Local typing already lives in the editor; resetting it would move the caret.
    if (document === lastEmittedDocument.current) return;
    if (editor && JSON.stringify(tiptapToScientificDocument(editor.getJSON(),document)) !== JSON.stringify(document)) { let active=true; queueMicrotask(()=>{if(active&&!editor.isDestroyed){const known=toolOutputIdsIn(editor);editor.commands.setContent(scientificDocumentToTiptap(document,hiddenSectionKeysRef.current),{emitUpdate:false});focusBelow(editor,(node)=>node.attrs.block?.type==="tool_output"&&!known.has(node.attrs.block.id));}}); return ()=>{active=false;}; }
  }, [document,editor]);
  useDocumentMediaUploads(editor, mediaDraftId);
  const commands = useCommandMenu(editor);

  useEffect(() => {
    if (!editor || previousHiddenSectionSignatureRef.current === hiddenSectionSignature) return;
    previousHiddenSectionSignatureRef.current = hiddenSectionSignature;
    let active = true;
    queueMicrotask(() => {
      // Not an undo step: undoing it would bring back sections that are hidden now, which keepSections refuses.
      if (active && !editor.isDestroyed) editor.chain().command(({ tr }) => { tr.setMeta("addToHistory", false); return true; }).setContent(scientificDocumentToTiptap(originalRef.current, hiddenSectionKeysRef.current), { emitUpdate: false }).run();
    });
    return () => { active = false; };
  }, [editor, hiddenSectionSignature]);

  if (!editor) return <div className="ln-wysiwyg-loading">Loading document editor…</div>;
  return <section className="ln-wysiwyg-editor ln-scientific-wysiwyg-editor">
    <input type="hidden" name="mediaDraftId" value={mediaDraftId} />
    <EditorSurface editor={editor} kinds={checklist ? undefined : ["paragraph", "heading", "subheading", "quote", "bullet", "ordered"]} openCommands={commands.openSearch} insertImage={() => chooseFiles(editor, mediaDraftId, "image/*")}><EditorContent editor={editor} /></EditorSurface>
    {commands.menu ? <WritingCommandMenu editor={editor} state={commands.menu} draftId={mediaDraftId} keyRef={commands.keyRef} onClose={commands.close} checklist={checklist} inserts={inserts} references /> : null}
    {actionsHostId ? <DocumentAttachmentsButton editor={editor} hostId={actionsHostId} /> : null}
  </section>;
}
