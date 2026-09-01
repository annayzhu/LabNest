"use client";

import { useMemo } from "react";
import { CompactRichTextTiptapEditor } from "@/components/CompactRichTextTiptapEditor";
import { markdownRichTextToTiptap, tiptapToMarkdownRichText } from "@/lib/scientific-tiptap";

/** Compatibility adapter for legacy fields that still persist LabNest Markdown. */
export function MarkdownRichTextEditor({
  value,
  onChange,
  placeholder = "Start writing…",
  minHeightClass = "min-h-48",
  autoFocus = false,
  toolbarHostId,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeightClass?: string;
  autoFocus?: boolean;
  toolbarHostId?: string;
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
    className={className}
  />;
}
