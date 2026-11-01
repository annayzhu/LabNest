"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Editor, JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import TextAlign from "@tiptap/extension-text-align";
import { cn } from "@/lib/cn";
import { newClientMutationId } from "@/lib/client-mutation-id";
import { createDocumentBlockLineHeightExtension, createResizableDocumentTableExtension, createDocumentLegacyAttributesExtension } from "@/lib/tiptap-document-extensions";
import { SlashCommandTrigger } from "@/lib/editor-slash";
import { BlockHandles } from "@/lib/editor-block-handle";
import { HeadingShortcuts, savedBlocksOnly, writingPlaceholder } from "@/lib/editor-writing";
import { DocumentMediaNode } from "./DocumentMediaNode";
import { DocumentPlateNode } from "./DocumentPlateNode";
import { RecordReferenceNode } from "./RecordReference";
import { chooseFiles, useDocumentMediaUploads } from "./DocumentMediaUploads";
import { useCommandMenu } from "./EditorCommandMenu";
import { EditorSurface } from "./EditorSurface";
import { WritingCommandMenu } from "./WritingCommandMenu";
import { DocumentAttachmentsButton } from "./DocumentAttachmentsButton";

/** A rich-text field written Notion-style: "/" to insert and a bubble over selected text; as a page of its own (Entry), ＋ and ⋮⋮ beside each block. */
export function CompactRichTextTiptapEditor({ content, onChange, placeholder = "Start writing…", minHeightClass = "min-h-24", autoFocus = false, page = false, actionsHostId, media = false, references = false, registerEditor, className, isLocalEcho }: {
  content: JSONContent;
  onChange: (content: JSONContent) => void;
  placeholder?: string;
  minHeightClass?: string;
  autoFocus?: boolean;
  /** A page of its own (Entry): block handles, and a hint on empty lines. */
  page?: boolean;
  /** Where the page header shows this document's actions. */
  actionsHostId?: string;
  className?: string;
  media?: boolean;
  /** "/" offers samples, stock and plate layouts (Entry). */
  references?: boolean;
  registerEditor?: (editor: Editor) => () => void;
  isLocalEcho?: boolean;
}) {
  const onChangeRef = useRef(onChange);
  const [mediaDraftId] = useState(newClientMutationId);
  const lastEmitted = useRef<string | undefined>(undefined);
  const contentHash = useMemo(() => JSON.stringify(content), [content]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  const editor = useEditor({
    immediatelyRender: false,
    content,
    autofocus: autoFocus ? "end" : false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: false }, trailingNode: false, ...savedBlocksOnly }),
      HeadingShortcuts,
      createResizableDocumentTableExtension(),
      createDocumentLegacyAttributesExtension({name:"compactDocumentIdentity",attributes:[{name:"scientificBlockId",htmlAttribute:"data-scientific-block-id"}]}),
      TextStyleKit.configure({ backgroundColor: false }),
      createDocumentBlockLineHeightExtension(),
      TextAlign.configure({types:["paragraph","heading"]}),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: page ? writingPlaceholder(placeholder) : placeholder }),
      // Lab notes write ratios like 1/2 and 1/4; keep them as typed instead of ½ and ¼.
      Typography.configure({ oneHalf: false, oneQuarter: false, threeQuarters: false }),
      SlashCommandTrigger,
      BlockHandles,
      ...(media ? [DocumentMediaNode] : []),
      // Always known, so text holding a tag or a plate never loses it, whatever "/" offers here.
      DocumentPlateNode,
      RecordReferenceNode,
    ],
    editorProps: { attributes: { class: cn("ln-protocol-tiptap ln-compact-rich-tiptap", minHeightClass), spellcheck: "true" } },
    onUpdate: ({ editor: nextEditor }) => { const json = nextEditor.getJSON(); lastEmitted.current = JSON.stringify(json); onChangeRef.current(json); },
  });
  useDocumentMediaUploads(media ? editor : null, mediaDraftId);
  const commands = useCommandMenu(editor);
  useEffect(() => { if (editor && registerEditor) return registerEditor(editor); }, [editor, registerEditor]);
  useEffect(() => {
    if (!editor || isLocalEcho || editor.isFocused || JSON.stringify(editor.getJSON()) === contentHash || lastEmitted.current === contentHash) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled && !editor.isDestroyed && !editor.isFocused) editor.commands.setContent(content, { emitUpdate: false });
    });
    return () => { cancelled = true; };
  }, [content, contentHash, editor, isLocalEcho]);

  if (!editor) return <div className="ln-wysiwyg-loading">Loading editor…</div>;
  return <div className={cn("ln-compact-rich-editor", className)}>
    <EditorSurface editor={editor} handles={page} openCommands={commands.openSearch} insertImage={media ? () => chooseFiles(editor, mediaDraftId, "image/*") : undefined}><EditorContent editor={editor} /></EditorSurface>
    {commands.menu ? <WritingCommandMenu editor={editor} state={commands.menu} draftId={mediaDraftId} keyRef={commands.keyRef} onClose={commands.close} media={media} references={references} /> : null}
    {actionsHostId ? <DocumentAttachmentsButton editor={editor} hostId={actionsHostId} /> : null}
  </div>;
}
