"use client";

import { useEffect, useMemo, useRef } from "react";
import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { TextStyleKit } from "@tiptap/extension-text-style";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { DocumentWysiwygToolbar } from "@/components/DocumentWysiwygToolbar";
import { cn } from "@/lib/cn";

export function CompactRichTextTiptapEditor({ content, onChange, placeholder = "Start writing…", minHeightClass = "min-h-24", autoFocus = false, showToolbar = true, className }: {
  content: JSONContent;
  onChange: (content: JSONContent) => void;
  placeholder?: string;
  minHeightClass?: string;
  autoFocus?: boolean;
  showToolbar?: boolean;
  className?: string;
}) {
  const onChangeRef = useRef(onChange);
  const contentHash = useMemo(() => JSON.stringify(content), [content]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  const editor = useEditor({
    immediatelyRender: false,
    content,
    autofocus: autoFocus ? "end" : false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false, autolink: false }, trailingNode: false }),
      TextStyleKit.configure({ backgroundColor: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
      Typography,
    ],
    editorProps: { attributes: { class: cn("ln-protocol-tiptap ln-compact-rich-tiptap", minHeightClass), spellcheck: "true" } },
    onUpdate: ({ editor: nextEditor }) => onChangeRef.current(nextEditor.getJSON()),
  });
  useEffect(() => {
    if (!editor || editor.isFocused || JSON.stringify(editor.getJSON()) === contentHash) return;
    editor.commands.setContent(content);
  }, [content, contentHash, editor]);

  if (!editor) return <div className="ln-wysiwyg-loading">Loading editor…</div>;
  return <div className={cn("ln-compact-rich-editor", className)}>
    {showToolbar ? <DocumentWysiwygToolbar editor={editor} ariaLabel="Rich text formatting" className="ln-compact-rich-toolbar" /> : null}
    <EditorContent editor={editor} />
  </div>;
}
