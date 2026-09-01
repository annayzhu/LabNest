"use client";

import { useMemo } from "react";
import { CompactRichTextTiptapEditor } from "@/components/CompactRichTextTiptapEditor";
import type { ProtocolRichTextNode } from "@/lib/protocol-document";
import { protocolRichTextToTiptap, tiptapToProtocolRichText } from "@/lib/protocol-tiptap";

/** Tiptap adapter for result-template instructions stored as Protocol rich-text nodes. */
export function ProtocolRichTextEditor({ nodes, onChange, showToolbar = true }: { nodes: ProtocolRichTextNode[]; onChange: (nodes: ProtocolRichTextNode[]) => void; showToolbar?: boolean }) {
  const content = useMemo(() => protocolRichTextToTiptap(nodes), [nodes]);
  return <CompactRichTextTiptapEditor
    content={content}
    onChange={(json) => onChange(tiptapToProtocolRichText(json))}
    placeholder="How should this result be recorded?"
    minHeightClass="min-h-20"
    showToolbar={showToolbar}
  />;
}
