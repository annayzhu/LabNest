"use client";

import { useEffect, useRef, useState } from "react";
import { Extension, mergeAttributes, Node, type Editor, type JSONContent } from "@tiptap/core";
import { EditorContent, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, type NodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import {
  AlarmClock,
  AlertTriangle,
  FlaskConical,
  GripVertical,
  ImagePlus,
  Table2,
  Trash2,
} from "lucide-react";
import { DocumentWysiwygToolbar, wysiwygWidgetInputClass, type WysiwygInsertAction } from "@/components/DocumentWysiwygToolbar";
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

type WidgetBlock = Extract<ProtocolContentBlock, { type: "timer" | "callout" | "media" | "table" }>;

function uniqueBlockId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ProtocolSectionNodeView({ node }: NodeViewProps) {
  const sectionKey = node.attrs.sectionKey as ProtocolSectionKey;
  return <NodeViewWrapper as="section" className="ln-protocol-section" data-section-key={sectionKey}>
    <header className="ln-protocol-section-heading" contentEditable={false}>
      <span className="ln-protocol-section-rule" aria-hidden />
      <h2>{protocolSectionLabels[sectionKey] ?? sectionKey}</h2>
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
      {block.type === "timer" ? <div className="ln-protocol-timer-editor">
        <AlarmClock className="ln-protocol-widget-icon" aria-hidden />
        <input value={block.label} onChange={(event) => updateBlock({ ...block, label: event.target.value })} className={wysiwygWidgetInputClass} placeholder="Incubation or centrifugation" aria-label="Timer name" />
        <label className="ln-protocol-timer-duration"><input type="number" min="0.1" step="0.1" value={block.durationMinutes} onChange={(event) => updateBlock({ ...block, durationMinutes: Number(event.target.value) || 0.1 })} className={wysiwygWidgetInputClass} aria-label="Timer duration" /><span>min</span></label>
        <details className="ln-protocol-widget-details"><summary>Notes</summary><input value={block.notes ?? ""} onChange={(event) => updateBlock({ ...block, notes: event.target.value })} className={wysiwygWidgetInputClass} placeholder="Optional note" aria-label="Timer note" /></details>
      </div> : null}
      {block.type === "callout" ? <div className="ln-protocol-callout-editor">
        <AlertTriangle className="ln-protocol-widget-icon" aria-hidden />
        <select value={block.tone} onChange={(event) => updateBlock({ ...block, tone: event.target.value as typeof block.tone })} className={wysiwygWidgetInputClass} aria-label="Callout level"><option value="note">Note</option><option value="warning">Warning</option><option value="critical">Critical</option></select>
        <input value={block.text} onChange={(event) => updateBlock({ ...block, text: event.target.value })} className={wysiwygWidgetInputClass} placeholder="Important operation or risk" aria-label="Callout text" />
      </div> : null}
      {block.type === "media" ? <div className="ln-protocol-media-editor">
        <ImagePlus className="ln-protocol-widget-icon" aria-hidden />
        <select value={block.mediaType} onChange={(event) => updateBlock({ ...block, mediaType: event.target.value as typeof block.mediaType })} className={wysiwygWidgetInputClass} aria-label="Media type"><option value="image">Image</option><option value="video">Video</option><option value="file">Link / file</option></select>
        <input value={block.caption ?? ""} onChange={(event) => updateBlock({ ...block, caption: event.target.value })} className={wysiwygWidgetInputClass} placeholder="Caption" aria-label="Media caption" />
        <input value={block.url} onChange={(event) => updateBlock({ ...block, url: event.target.value })} className={wysiwygWidgetInputClass} placeholder="URL or attachment path" aria-label="Media URL" />
        {block.url ? <a href={block.url} target="_blank" rel="noreferrer" className="ln-protocol-widget-link">Open</a> : null}
      </div> : null}
      {block.type === "table" && !isResultTemplate ? <InlineTableEditor rows={block.rows} onChange={(rows) => updateBlock({ ...block, rows })} caption={block.caption} onCaptionChange={(caption) => updateBlock({ ...block, caption })} /> : null}
      {block.type === "table" && isResultTemplate ? <details className="ln-protocol-result-template-editor">
        <summary><span><FlaskConical aria-hidden /><strong>{resultTemplate?.title ?? resultTemplate?.result_type ?? "Result template"}</strong></span><small>{resultTemplate?.fields.length ?? 0} fields · {resultTemplate?.datasets?.length ?? 0} data tables · {resultTemplate?.artifacts?.length ?? 0} files</small><em>Edit</em></summary>
        <div className="ln-protocol-result-template-editor-body"><ResultTemplateConfigEditor block={block} onChange={updateBlock} /></div>
      </details> : null}
    </div>
  </NodeViewWrapper>;
}

const ProtocolSection = Node.create({
  name: "protocolSection",
  group: "block",
  content: "block*",
  defining: true,
  isolating: true,
  addAttributes() {
    return { sectionKey: { default: "description" } };
  },
  parseHTML() {
    return [{ tag: "section[data-protocol-section]", getAttrs: (element) => ({ sectionKey: (element as HTMLElement).dataset.protocolSection }) }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["section", mergeAttributes(HTMLAttributes, { "data-protocol-section": HTMLAttributes.sectionKey }), 0];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ProtocolSectionNodeView);
  },
});

const ProtocolWidget = Node.create({
  name: "protocolWidget",
  group: "block",
  atom: true,
  draggable: true,
  isolating: true,
  addAttributes() {
    return { block: { default: null } };
  },
  parseHTML() {
    return [{
      tag: "div[data-protocol-widget]",
      getAttrs: (element) => {
        try { return { block: JSON.parse((element as HTMLElement).dataset.protocolWidget ?? "null") }; }
        catch { return { block: null }; }
      },
    }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", { "data-protocol-widget": JSON.stringify(HTMLAttributes.block) }];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ProtocolWidgetNodeView);
  },
});

const ProtocolLegacyAttributes = Extension.create({
  name: "protocolLegacyAttributes",
  addGlobalAttributes() {
    return [{
      types: ["paragraph", "heading", "blockquote", "bulletList", "orderedList", "taskList", "table"],
      attributes: {
        protocolBlockId: {
          default: null,
          parseHTML: (element) => element.getAttribute("data-protocol-block-id"),
          renderHTML: (attributes) => attributes.protocolBlockId ? { "data-protocol-block-id": attributes.protocolBlockId } : {},
        },
        protocolBlockType: {
          default: null,
          parseHTML: (element) => element.getAttribute("data-protocol-block-type"),
          renderHTML: (attributes) => attributes.protocolBlockType ? { "data-protocol-block-type": attributes.protocolBlockType } : {},
        },
        protocolLineHeight: {
          default: null,
          parseHTML: (element) => element.getAttribute("data-labnest-line-height"),
          renderHTML: (attributes) => attributes.protocolLineHeight ? { "data-labnest-line-height": attributes.protocolLineHeight } : {},
        },
        protocolFontFamily: {
          default: null,
          parseHTML: (element) => element.getAttribute("data-labnest-font-family"),
          renderHTML: (attributes) => attributes.protocolFontFamily ? { "data-labnest-font-family": attributes.protocolFontFamily } : {},
        },
        protocolCaption: {
          default: null,
          parseHTML: (element) => element.getAttribute("data-protocol-caption"),
          renderHTML: (attributes) => attributes.protocolCaption ? { "data-protocol-caption": attributes.protocolCaption } : {},
        },
      },
    }];
  },
});

function insertWidget(editor: Editor, block: WidgetBlock) {
  editor.chain().focus().insertContent({ type: "protocolWidget", attrs: { block } }).run();
}

function protocolInsertActions(): WysiwygInsertAction[] {
  return [
    { id: "table", icon: <Table2 aria-hidden />, label: "Table", description: "Editable and resizable", run: (editor) => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { id: "timer", icon: <AlarmClock aria-hidden />, label: "Timer", description: "Duration shown with unit", run: (editor) => insertWidget(editor, { id: uniqueBlockId("timer"), type: "timer", label: "Timer", durationMinutes: 5, notes: "" }) },
    { id: "callout", icon: <AlertTriangle aria-hidden />, label: "Callout", description: "Operation or risk", run: (editor) => insertWidget(editor, { id: uniqueBlockId("callout"), type: "callout", tone: "warning", text: "" }) },
    { id: "media", icon: <ImagePlus aria-hidden />, label: "Media", description: "Image, video, or file", run: (editor) => insertWidget(editor, { id: uniqueBlockId("media"), type: "media", mediaType: "image", url: "", caption: "" }) },
    { id: "result-template", icon: <FlaskConical aria-hidden />, label: "Result template", description: "Fields, dataset, and files", run: (editor) => {
      const resultTemplate = createDefaultResultTemplate("measurement");
      insertWidget(editor, { id: uniqueBlockId("result-template"), type: "table", caption: resultTemplate.result_type, rows: resultTemplateFieldsToRows(resultTemplate), resultTemplate });
    } },
    { id: "plate-map", icon: <FlaskConical aria-hidden />, label: "Plate Map Planner", description: "Persistent link to the tool", run: (editor) => insertWidget(editor, { id: uniqueBlockId("plate-map"), type: "media", mediaType: "file", url: "/tools/free-plate-layout/index.html?v=20260826-2", caption: "Plate Map Planner" }) },
  ];
}

export function ProtocolWysiwygEditor({ document, onChange }: { document: ProtocolDocument; onChange: (document: ProtocolDocument) => void }) {
  const [initialContent] = useState(() => protocolDocumentToTiptap(document)); // The form owns one document for the lifetime of this editor.
  const onChangeRef = useRef(onChange);
  const importWarningsRef = useRef(document.importWarnings);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const editor = useEditor({
    immediatelyRender: false,
    content: initialContent as JSONContent,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: false }, trailingNode: false }),
      TextStyleKit.configure({ backgroundColor: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TableKit.configure({ table: { resizable: true, cellMinWidth: 54, allowTableNodeSelection: true } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: "Write the protocol here…" }),
      Typography,
      ProtocolLegacyAttributes,
      ProtocolSection,
      ProtocolWidget,
    ],
    editorProps: {
      attributes: {
        class: "ln-protocol-tiptap",
        spellcheck: "true",
        "aria-label": "Protocol document body",
      },
    },
    onUpdate: ({ editor: nextEditor }) => {
      onChangeRef.current(tiptapToProtocolDocument(nextEditor.getJSON(), importWarningsRef.current));
    },
  });

  if (!editor) return <div className="ln-wysiwyg-loading">Loading document editor…</div>;
  return <section className="ln-wysiwyg-editor" data-print-hidden={undefined}>
    <div className="ln-wysiwyg-toolbar-sticky" data-print-hidden><DocumentWysiwygToolbar editor={editor} ariaLabel="Protocol formatting" insertActions={protocolInsertActions()} /></div>
    <EditorContent editor={editor} />
  </section>;
}
