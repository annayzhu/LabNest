"use client";

import { useMemo } from "react";
import { CompactRichTextTiptapEditor } from "@/components/CompactRichTextTiptapEditor";
import type { WysiwygInsertAction } from "@/components/DocumentWysiwygToolbar";
import { markdownRichTextToTiptap, tiptapToMarkdownRichText } from "@/lib/scientific-tiptap";

/** Compatibility adapter for legacy fields that still persist LabNest Markdown. */
export function MarkdownRichTextEditor({
  value,
  onChange,
  placeholder = "Start writing…",
  minHeightClass = "min-h-48",
  autoFocus = false,
  toolbarHostId,
  insertActions,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeightClass?: string;
  autoFocus?: boolean;
  toolbarHostId?: string;
  insertActions?: WysiwygInsertAction[];
  className?: string;
}) {
  const content = useMemo(() => markdownRichTextToTiptap(value), [value]);
  return <CompactRichTextTiptapEditor
    content={content}
    onChange={(json) => onChange(tiptapToMarkdownRichText(json))}
    placeholder={placeholder}
    minHeightClass={minHeightClass}
    autoFocus={autoFocus}
    toolbarHostId={toolbarHostId}
    insertActions={insertActions}
    className={className}
  />;
}
