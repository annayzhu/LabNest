"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor, JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { DocumentWysiwygToolbar, type WysiwygInsertAction } from "@/components/DocumentWysiwygToolbar";
import { useDocumentToolbarTarget } from "@/components/DocumentToolbarTargetContext";
import { cn } from "@/lib/cn";
import { newClientMutationId } from "@/lib/client-mutation-id";
import TextAlign from "@tiptap/extension-text-align";
import { createDocumentBlockLineHeightExtension, createResizableDocumentTableExtension, createDocumentLegacyAttributesExtension } from "@/lib/tiptap-document-extensions";
import { DocumentMediaNode } from "./DocumentMediaNode";
import { documentMediaInsertActions, useDocumentMediaUploads } from "./DocumentMediaUploads";

export function CompactRichTextTiptapEditor({ content, onChange, placeholder = "Start writing…", minHeightClass = "min-h-24", autoFocus = false, showToolbar = true, toolbarHostId, insertActions = [], media = false, registerEditor, className }: {
  content: JSONContent;
  onChange: (content: JSONContent) => void;
  placeholder?: string;
  minHeightClass?: string;
  autoFocus?: boolean;
  showToolbar?: boolean;
  toolbarHostId?: string;
  insertActions?: WysiwygInsertAction[];
  className?: string;
  media?: boolean;
  registerEditor?: (editor: Editor) => () => void;
}) {
  const onChangeRef = useRef(onChange);
  const [mediaDraftId] = useState(newClientMutationId);
  const toolbarTarget = useDocumentToolbarTarget();
  const [toolbarHost, setToolbarHost] = useState<HTMLElement | null>(null);
  const contentHash = useMemo(() => JSON.stringify(content), [content]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setToolbarHost(toolbarHostId ? globalThis.document.getElementById(toolbarHostId) : null);
    });
    return () => { active = false; };
  }, [toolbarHostId]);
  const editor = useEditor({
    immediatelyRender: false,
    content,
    autofocus: autoFocus ? "end" : false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: false }, trailingNode: false }),
      createResizableDocumentTableExtension(),
      createDocumentLegacyAttributesExtension({name:"compactDocumentIdentity",attributes:[{name:"scientificBlockId",htmlAttribute:"data-scientific-block-id"}]}),
      TextStyleKit.configure({ backgroundColor: false }),
      createDocumentBlockLineHeightExtension(),
      TextAlign.configure({types:["paragraph","heading"]}),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
      Typography,
      ...(media ? [DocumentMediaNode] : []),
    ],
    editorProps: { attributes: { class: cn("ln-protocol-tiptap ln-compact-rich-tiptap", minHeightClass), spellcheck: "true" } },
    onUpdate: ({ editor: nextEditor }) => onChangeRef.current(nextEditor.getJSON()),
  });
  useDocumentMediaUploads(media ? editor : null, mediaDraftId);
  useEffect(() => { if (editor && registerEditor) return registerEditor(editor); }, [editor, registerEditor]);
  useEffect(() => {
    if (!editor || editor.isFocused || JSON.stringify(editor.getJSON()) === contentHash) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled && !editor.isDestroyed && !editor.isFocused) editor.commands.setContent(content, { emitUpdate: false });
    });
    return () => { cancelled = true; };
  }, [content, contentHash, editor]);
  useEffect(() => {
    if (!editor || !toolbarTarget) return;
    return () => toolbarTarget.release(editor);
  }, [editor, toolbarTarget]);

  if (!editor) return <div className="ln-wysiwyg-loading">Loading editor…</div>;
  const toolbar = <DocumentWysiwygToolbar editor={editor} ariaLabel="Rich text formatting" insertActions={media ? [...(!insertActions.some(action=>action.id==="table")?[{id:"table",label:"Table",icon:null,description:"Insert an editable table",run:(target:Editor)=>target.chain().focus().insertTable({rows:3,cols:3,withHeaderRow:true}).run()}]:[]),...insertActions.filter(action => !["media", "attachment"].includes(action.id)), ...documentMediaInsertActions(mediaDraftId)] : insertActions} className="ln-compact-rich-toolbar" />;
  return <div className={cn("ln-compact-rich-editor", className)} onFocusCapture={() => toolbarTarget?.activate(editor)}>
    {showToolbar ? (toolbarHost ? createPortal(toolbar, toolbarHost) : toolbar) : null}
    <EditorContent editor={editor} />
  </div>;
}
