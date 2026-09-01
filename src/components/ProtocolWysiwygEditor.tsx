"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
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
  AlarmClock,
  AlertTriangle,
  Columns3,
  FlaskConical,
  GripVertical,
  ImagePlus,
  Paperclip,
  Rows3,
  Table2,
  Trash2,
  X,
  Wrench,
} from "lucide-react";
import { DocumentWysiwygToolbar, wysiwygWidgetInputClass, type WysiwygInsertAction } from "@/components/DocumentWysiwygToolbar";
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
import { createDocumentLegacyAttributesExtension, createDocumentSectionExtension, createDocumentWidgetExtension, createResizableDocumentTableExtension } from "@/lib/tiptap-document-extensions";

type WidgetBlock = Extract<ProtocolContentBlock, { type: "timer" | "callout" | "media" | "embedded_tool" | "table" }>;

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
      {block.type === "table" && !isResultTemplate ? <InlineTableEditor rows={block.rows} onChange={(rows) => updateBlock({ ...block, rows })} caption={block.caption} onCaptionChange={(caption) => updateBlock({ ...block, caption })} /> : null}
      {block.type === "table" && isResultTemplate ? <details className="ln-protocol-result-template-editor">
        <summary><span><FlaskConical aria-hidden /><strong>{resultTemplate?.title ?? resultTemplate?.result_type ?? "Result template"}</strong></span><small>{resultTemplate?.fields.length ?? 0} fields · {resultTemplate?.datasets?.length ?? 0} data tables · {resultTemplate?.artifacts?.length ?? 0} files</small><em>Edit</em></summary>
        <div className="ln-protocol-result-template-editor-body"><ResultTemplateConfigEditor block={block} onChange={updateBlock} /></div>
      </details> : null}
    </div>
  </NodeViewWrapper>;
}

const ProtocolSection = createDocumentSectionExtension({ name: "protocolSection", tag: "section[data-protocol-section]", attributes: { sectionKey: { default: "description", htmlAttribute: "data-protocol-section" } }, nodeView: ReactNodeViewRenderer(ProtocolSectionNodeView) });
const ProtocolWidget = createDocumentWidgetExtension({ name: "protocolWidget", htmlAttribute: "data-protocol-widget", nodeView: ReactNodeViewRenderer(ProtocolWidgetNodeView) });
const ProtocolLegacyAttributes = createDocumentLegacyAttributesExtension({ name: "protocolLegacyAttributes", attributes: [
  { name: "protocolBlockId", htmlAttribute: "data-protocol-block-id" },
  { name: "protocolBlockType", htmlAttribute: "data-protocol-block-type" },
  { name: "protocolLineHeight", htmlAttribute: "data-labnest-line-height" },
  { name: "protocolFontFamily", htmlAttribute: "data-labnest-font-family" },
  { name: "protocolCaption", htmlAttribute: "data-protocol-caption" },
] });

const plateMapPlannerUrl = labToolManifest.find((tool) => tool.id === "free-plate-layout")?.launchUrl ?? "/tools";

function insertWidget(editor: Editor, block: WidgetBlock) {
  editor.chain().focus().insertContent({ type: "protocolWidget", attrs: { block } }).run();
}

function protocolInsertActions({ openImagePicker, openFilePicker }: { openImagePicker: () => void; openFilePicker: () => void }): WysiwygInsertAction[] {
  const defaultTool = labToolManifest.find((tool) => tool.id === "free-plate-layout") ?? labToolManifest[0];
  return [
    { id: "table", icon: <Table2 aria-hidden />, label: "Table", description: "Editable and resizable", run: (editor) => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { id: "timer", icon: <AlarmClock aria-hidden />, label: "Timer", description: "Duration shown with unit", run: (editor) => insertWidget(editor, { id: uniqueBlockId("timer"), type: "timer", label: "Timer", durationMinutes: 5, notes: "" }) },
    { id: "callout", icon: <AlertTriangle aria-hidden />, label: "Callout", description: "Operation or risk", run: (editor) => insertWidget(editor, { id: uniqueBlockId("callout"), type: "callout", tone: "warning", text: "" }) },
    { id: "image", icon: <ImagePlus aria-hidden />, label: "Image", description: "Choose or drag an image", run: openImagePicker },
    { id: "file", icon: <Paperclip aria-hidden />, label: "File", description: "Choose or drag a file", run: openFilePicker },
    { id: "result-template", icon: <FlaskConical aria-hidden />, label: "Result template", description: "Fields, dataset, and files", run: (editor) => {
      const resultTemplate = createDefaultResultTemplate("measurement");
      insertWidget(editor, { id: uniqueBlockId("result-template"), type: "table", caption: resultTemplate.result_type, rows: resultTemplateFieldsToRows(resultTemplate), resultTemplate });
    } },
    { id: "embedded-tool", icon: <Wrench aria-hidden />, label: "Embedded tool", description: "Existing tool, URL, or app path", run: (editor) => insertWidget(editor, { id: uniqueBlockId("embedded-tool"), type: "embedded_tool", sourceKind: "manifest", toolId: defaultTool?.id, label: defaultTool?.name ?? "Plate Map Planner", url: defaultTool?.launchUrl ?? plateMapPlannerUrl }) },
  ];
}

type InspectorTarget =
  | { kind: "widget"; position: number; nodeSize: number; block: WidgetBlock }
  | { kind: "table" };

function findInspectorTarget(editor: Editor): InspectorTarget | null {
  const { selection } = editor.state;
  const selectedNode = (selection as typeof selection & { node?: { type: { name: string }; attrs: Record<string, unknown>; nodeSize: number } }).node;
  if (selectedNode?.type.name === "protocolWidget") {
    return { kind: "widget", position: selection.from, nodeSize: selectedNode.nodeSize, block: selectedNode.attrs.block as WidgetBlock };
  }

  for (let depth = selection.$from.depth; depth > 0; depth -= 1) {
    const node = selection.$from.node(depth);
    if (node.type.name === "protocolWidget") {
      return { kind: "widget", position: selection.$from.before(depth), nodeSize: node.nodeSize, block: node.attrs.block as WidgetBlock };
    }
    if (node.type.name === "table") return { kind: "table" };
  }
  return null;
}

function ProtocolContextInspector({ editor, target, onClose }: { editor: Editor; target: InspectorTarget; onClose: () => void }) {
  if (target.kind === "table") {
    return <section className="document-editor-context-card" aria-label="Table settings">
      <header><div><p>Selected block</p><h2>Table settings</h2></div><button type="button" onClick={onClose} aria-label="Close selected block settings"><X aria-hidden /></button></header>
      <div className="document-editor-context-body">
        <p className="document-editor-context-note">Adjust the selected table without leaving the document.</p>
        <div className="document-editor-context-actions">
          <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()}><Rows3 aria-hidden />Add row</button>
          <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()}><Columns3 aria-hidden />Add column</button>
          <button type="button" className="is-danger" onClick={() => editor.chain().focus().deleteTable().run()}><Trash2 aria-hidden />Delete table</button>
        </div>
      </div>
    </section>;
  }

  const block = target.block;
  const updateWidget = (nextBlock: WidgetBlock) => {
    const node = editor.state.doc.nodeAt(target.position);
    if (!node || node.type.name !== "protocolWidget") return;
    editor.view.dispatch(editor.state.tr.setNodeMarkup(target.position, undefined, { ...node.attrs, block: nextBlock }));
  };
  const deleteWidget = () => {
    editor.chain().focus().setNodeSelection(target.position).deleteSelection().run();
  };

  const title = block.type === "media"
      ? block.mediaType === "image" ? "Image settings" : "File settings"
      : block.type === "embedded_tool"
        ? "Tool settings"
        : block.type === "callout"
          ? "Callout settings"
          : block.type === "timer"
            ? "Timer settings"
            : block.resultTemplate ? "Result template" : "Table settings";

  return <section className="document-editor-context-card" aria-label={title}>
    <header><div><p>Selected block</p><h2>{title}</h2></div><button type="button" onClick={onClose} aria-label="Close selected block settings"><X aria-hidden /></button></header>
    <div className="document-editor-context-body">
      {block.type === "media" ? <>
        <label><span>Caption</span><input value={block.caption ?? ""} onChange={(event) => updateWidget({ ...block, caption: event.target.value })} /></label>
        <p className="document-editor-context-note">{block.filename ?? block.mediaType}</p>
      </> : null}
      {block.type === "timer" ? <>
        <label><span>Timer name</span><input value={block.label} onChange={(event) => updateWidget({ ...block, label: event.target.value })} /></label>
        <label><span>Duration · minutes</span><input type="number" min="0.1" step="0.1" value={block.durationMinutes} onChange={(event) => updateWidget({ ...block, durationMinutes: Number(event.target.value) || 0.1 })} /></label>
        <label><span>Notes</span><textarea value={block.notes ?? ""} onChange={(event) => updateWidget({ ...block, notes: event.target.value })} /></label>
      </> : null}
      {block.type === "callout" ? <>
        <label><span>Level</span><select value={block.tone} onChange={(event) => updateWidget({ ...block, tone: event.target.value as typeof block.tone })}><option value="note">Note</option><option value="warning">Warning</option><option value="critical">Critical</option></select></label>
        <label><span>Message</span><textarea value={block.text} onChange={(event) => updateWidget({ ...block, text: event.target.value })} /></label>
      </> : null}
      {block.type === "embedded_tool" ? <>
        <label><span>Tool name</span><input value={block.label} onChange={(event) => updateWidget({ ...block, label: event.target.value })} /></label>
        <label><span>Location</span><input value={block.url} onChange={(event) => updateWidget({ ...block, url: event.target.value })} /></label>
      </> : null}
      {block.type === "table" ? <>
        <label><span>Caption</span><input value={block.caption ?? ""} onChange={(event) => updateWidget({ ...block, caption: event.target.value })} /></label>
        <p className="document-editor-context-note">{block.rows.length} rows · {Math.max(0, ...block.rows.map((row) => row.length))} columns</p>
      </> : null}
      <button type="button" className="document-editor-context-delete" onClick={deleteWidget}><Trash2 aria-hidden />Remove block</button>
    </div>
  </section>;
}

export function ProtocolWysiwygEditor({ document, onChange, toolbarHostId, inspectorHostId, uploadDraftId }: { document: ProtocolDocument; onChange: (document: ProtocolDocument) => void; toolbarHostId?: string; inspectorHostId?: string; uploadDraftId: string }) {
  const [initialContent] = useState(() => protocolDocumentToTiptap(document)); // The form owns one document for the lifetime of this editor.
  const onChangeRef = useRef(onChange);
  const importWarningsRef = useRef(document.importWarnings);
  const inputPrefix = useId();
  const imageInputId = `${inputPrefix}-protocol-images`;
  const fileInputId = `${inputPrefix}-protocol-files`;
  const [uploadStatus, setUploadStatus] = useState("");
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [inspectorTarget, setInspectorTarget] = useState<InspectorTarget | null>(null);
  const openImagePicker = useCallback(() => globalThis.document.getElementById(imageInputId)?.click(), [imageInputId]);
  const openFilePicker = useCallback(() => globalThis.document.getElementById(fileInputId)?.click(), [fileInputId]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

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

  const [toolbarEditor, setToolbarEditor] = useState<Editor | null>(null);
  const activateToolbarEditor = useCallback((target: Editor) => setToolbarEditor(target), []);
  const releaseToolbarEditor = useCallback((target: Editor) => setToolbarEditor((current) => current === target ? editor : current), [editor]);
  const toolbarTarget = useMemo(() => ({ activate: activateToolbarEditor, release: releaseToolbarEditor }), [activateToolbarEditor, releaseToolbarEditor]);

  useEffect(() => {
    if (!editor) return;
    const syncInspector = () => setInspectorTarget(findInspectorTarget(editor));
    editor.on("selectionUpdate", syncInspector);
    editor.on("transaction", syncInspector);
    return () => {
      editor.off("selectionUpdate", syncInspector);
      editor.off("transaction", syncInspector);
    };
  }, [editor]);

  const addFiles = useCallback(async (files: File[]) => {
    if (!editor || !files.length) return;
    setUploadStatus(`Uploading ${files.length} file${files.length === 1 ? "" : "s"}…`);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.set("file", file, file.name);
        formData.set("targetType", "protocol_upload_draft");
        formData.set("targetId", uploadDraftId);
        formData.set("linkType", "embedded_protocol_media");
        const response = await fetch("/api/attachments", { method: "POST", body: formData });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? `Could not upload ${file.name}.`);
        const attachment = payload.attachment as { id: string; originalFilename: string; mimeType: string; size: number };
        const mediaType = attachment.mimeType.startsWith("image/") ? "image" as const : attachment.mimeType.startsWith("video/") ? "video" as const : "file" as const;
        insertWidget(editor, {
          id: uniqueBlockId(mediaType),
          type: "media",
          mediaType,
          attachmentId: attachment.id,
          filename: attachment.originalFilename,
          mimeType: attachment.mimeType,
          size: attachment.size,
          url: `/api/attachments/${attachment.id}${mediaType === "image" ? "?inline=1" : ""}`,
          caption: attachment.originalFilename,
        });
      }
      setUploadStatus("File added. Save the Protocol to keep the attachment link.");
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : "Upload failed.");
    }
  }, [editor, uploadDraftId]);

  if (!editor) return <div className="ln-wysiwyg-loading">Loading document editor…</div>;
  const toolbar = <div className="ln-wysiwyg-toolbar-sticky" data-print-hidden><DocumentWysiwygToolbar editor={toolbarEditor ?? editor} ariaLabel="Protocol formatting" insertActions={toolbarEditor && toolbarEditor !== editor ? [] : protocolInsertActions({ openImagePicker, openFilePicker })} /></div>;
  const toolbarHost = toolbarHostId ? globalThis.document?.getElementById(toolbarHostId) : null;
  const inspectorHost = inspectorHostId ? globalThis.document?.getElementById(inspectorHostId) : null;
  return <DocumentToolbarTargetContext.Provider value={toolbarTarget}><>
    <section className={cn("ln-wysiwyg-editor", draggingFiles && "is-dragging-files")} data-print-hidden={undefined}>
    {toolbarHost ? createPortal(toolbar, toolbarHost) : toolbar}
    <input id={imageInputId} type="file" accept="image/*" multiple hidden onChange={(event) => { void addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
    <input id={fileInputId} type="file" multiple hidden onChange={(event) => { void addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
    {uploadStatus ? <p className="ln-protocol-upload-status" role="status">{uploadStatus}</p> : null}
    <div
      className="ln-protocol-editor-drop-zone"
      onDragEnter={(event) => { if (Array.from(event.dataTransfer.types).includes("Files")) { event.preventDefault(); setDraggingFiles(true); } }}
      onDragOver={(event) => { if (Array.from(event.dataTransfer.types).includes("Files")) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; } }}
      onDragLeave={(event) => { const target = event.relatedTarget; if (!target || !(target instanceof Node) || !event.currentTarget.contains(target)) setDraggingFiles(false); }}
      onDrop={(event) => { if (!event.dataTransfer.files.length) return; event.preventDefault(); event.stopPropagation(); setDraggingFiles(false); void addFiles(Array.from(event.dataTransfer.files)); }}
      onFocusCapture={(event) => { if (!(event.target as HTMLElement).closest(".ln-compact-rich-editor")) activateToolbarEditor(editor); }}
    ><EditorContent editor={editor} />{draggingFiles ? <div className="ln-protocol-drop-overlay"><Paperclip aria-hidden />Drop images or files into the Protocol</div> : null}</div>
    </section>
    {inspectorHost && inspectorTarget ? createPortal(<ProtocolContextInspector editor={editor} target={inspectorTarget} onClose={() => {
      setInspectorTarget(null);
      editor.chain().setTextSelection(1).blur().run();
    }} />, inspectorHost) : null}
  </></DocumentToolbarTargetContext.Provider>;
}
