"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type Editor, type JSONContent } from "@tiptap/core";
import { EditorContent, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, type NodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import {
  AlertTriangle,
  BarChart3,
  Database,
  GripVertical,
  ImagePlus,
  Table2,
  Trash2,
} from "lucide-react";
import { DocumentWysiwygToolbar, wysiwygWidgetInputClass, type WysiwygInsertAction } from "@/components/DocumentWysiwygToolbar";
import { ScientificBlockView } from "@/components/ScientificBlockView";
import { cn } from "@/lib/cn";
import type { ScientificContentBlock, ScientificDocument } from "@/lib/scientific-document";
import { scientificDocumentToTiptap, tiptapToScientificDocument } from "@/lib/scientific-tiptap";
import { createDocumentLegacyAttributesExtension, createDocumentSectionExtension, createDocumentWidgetExtension, createResizableDocumentTableExtension } from "@/lib/tiptap-document-extensions";

type ScientificWidgetBlock = Extract<ScientificContentBlock, { type: "callout" | "metric" | "media" | "dataset" }>;

function uniqueBlockId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ScientificSectionNodeView({ node }: NodeViewProps) {
  return <NodeViewWrapper as="section" className="ln-protocol-section ln-scientific-section" data-section-key={node.attrs.sectionKey}>
    <header className="ln-protocol-section-heading" contentEditable={false}>
      <span className="ln-protocol-section-rule" aria-hidden />
      <h2>{node.attrs.sectionTitle}</h2>
      {node.attrs.sectionKey === "quality_limitations" ? <small>Only record deviations, failed QC, missing data, or limits that change interpretation.</small> : null}
    </header>
    <NodeViewContent as="div" className="ln-protocol-section-content" />
  </NodeViewWrapper>;
}

function ScientificWidgetNodeView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const block = node.attrs.block as ScientificWidgetBlock;
  const updateBlock = (next: ScientificWidgetBlock) => updateAttributes({ block: next });
  return <NodeViewWrapper className={cn("ln-protocol-widget ln-scientific-widget", selected && "is-selected")} data-widget-type={block.type}>
    <div className="document-print-only"><ScientificBlockView block={block} /></div>
    <div contentEditable={false} data-print-hidden>
      <div className="ln-protocol-widget-rail">
        <button type="button" className="ln-protocol-widget-grip" data-drag-handle aria-label="Move block"><GripVertical aria-hidden /></button>
        <button type="button" className="ln-protocol-widget-delete" onClick={deleteNode} aria-label="Remove block"><Trash2 aria-hidden /></button>
      </div>
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

function scientificInsertActions(allowedBlockTypes?: readonly ScientificContentBlock["type"][]): WysiwygInsertAction[] {
  const allowed = new Set(allowedBlockTypes ?? ["heading", "text", "checklist", "table", "metric", "callout", "media", "dataset"]);
  const actions: WysiwygInsertAction[] = [
    {
      id: "table",
      label: "Table",
      description: "Editable, resizable, paste from Excel",
      icon: <Table2 aria-hidden />,
      run: (editor) => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    {
      id: "metric",
      label: "Metric",
      description: "Value with explicit unit",
      icon: <BarChart3 aria-hidden />,
      run: (editor) => insertWidget(editor, { id: uniqueBlockId("metric"), type: "metric", label: "Metric", value: "", unit: "" }),
    },
    {
      id: "callout",
      label: "Callout",
      description: "Qualification, warning, or risk",
      icon: <AlertTriangle aria-hidden />,
      run: (editor) => insertWidget(editor, { id: uniqueBlockId("callout"), type: "callout", tone: "note", text: "" }),
    },
    {
      id: "media",
      label: "Media",
      description: "Image, video, or file",
      icon: <ImagePlus aria-hidden />,
      run: (editor) => insertWidget(editor, { id: uniqueBlockId("media"), type: "media", mediaType: "image", url: "", caption: "" }),
    },
    {
      id: "dataset",
      label: "Dataset",
      description: "Reference a structured dataset",
      icon: <Database aria-hidden />,
      run: (editor) => insertWidget(editor, { id: uniqueBlockId("dataset"), type: "dataset", datasetId: "", label: "" }),
    },
  ];
  return actions.filter((action) => allowed.has(action.id as ScientificContentBlock["type"]));
}

export function ScientificWysiwygEditor({ document, toolbarHostId, hiddenSectionKeys = [], allowedBlockTypes, onChange }: {
  document: ScientificDocument;
  toolbarHostId?: string;
  hiddenSectionKeys?: string[];
  allowedBlockTypes?: readonly ScientificContentBlock["type"][];
  onChange: (document: ScientificDocument) => void;
}) {
  const [initialContent] = useState(() => scientificDocumentToTiptap(document, hiddenSectionKeys));
  const originalRef = useRef(document);
  const onChangeRef = useRef(onChange);
  const [toolbarHost, setToolbarHost] = useState<HTMLElement | null>(null);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => {
    setToolbarHost(toolbarHostId ? globalThis.document.getElementById(toolbarHostId) : null);
  }, [toolbarHostId]);

  const editor = useEditor({
    immediatelyRender: false,
    content: initialContent as JSONContent,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: false }, trailingNode: false }),
      TextStyleKit.configure({ backgroundColor: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      createResizableDocumentTableExtension(),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: "Write directly in the document…" }),
      Typography,
      ScientificLegacyAttributes,
      ScientificSection,
      ScientificWidget,
    ],
    editorProps: {
      attributes: { class: "ln-protocol-tiptap ln-scientific-tiptap", spellcheck: "true", "aria-label": "Scientific document body" },
    },
    onUpdate: ({ editor: nextEditor }) => onChangeRef.current(tiptapToScientificDocument(nextEditor.getJSON(), originalRef.current)),
  });

  if (!editor) return <div className="ln-wysiwyg-loading">Loading document editor…</div>;
  const toolbar = <div className="ln-wysiwyg-toolbar-sticky" data-print-hidden>
    <DocumentWysiwygToolbar
      editor={editor}
      ariaLabel="Scientific document formatting"
      checklist={!allowedBlockTypes || allowedBlockTypes.includes("checklist")}
      insertActions={scientificInsertActions(allowedBlockTypes)}
    />
  </div>;
  return <section className="ln-wysiwyg-editor ln-scientific-wysiwyg-editor">
    {toolbarHost ? createPortal(toolbar, toolbarHost) : toolbar}
    <EditorContent editor={editor} />
  </section>;
}
