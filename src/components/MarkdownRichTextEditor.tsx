"use client";

import { useMemo, useState } from "react";
import type { Editor } from "@tiptap/core";
import { CompactRichTextTiptapEditor } from "@/components/CompactRichTextTiptapEditor";
import { markdownRichTextToTiptap, tiptapToMarkdownRichText } from "@/lib/scientific-tiptap";

/** Entry's page, kept as LabNest Markdown. */
export function MarkdownRichTextEditor({
  value,
  onChange,
  placeholder = "Start writing…",
  minHeightClass = "min-h-48",
  autoFocus = false,
  actionsHostId,
  className,
  registerEditor,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeightClass?: string;
  autoFocus?: boolean;
  actionsHostId?: string;
  className?: string;
  registerEditor?: (editor: Editor) => () => void;
}) {
  const [emittedMarkdown, setEmittedMarkdown] = useState<string>();
  const content = useMemo(() => markdownRichTextToTiptap(value), [value]);
  return <CompactRichTextTiptapEditor
    media
    page
    isLocalEcho={emittedMarkdown === value}
    registerEditor={registerEditor}
    content={content}
    onChange={(json) => { const markdown = tiptapToMarkdownRichText(json); setEmittedMarkdown(markdown); onChange(markdown); }}
    placeholder={placeholder}
    minHeightClass={minHeightClass}
    autoFocus={autoFocus}
    actionsHostId={actionsHostId}
    className={className}
  />;
}
