"use client";

import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { focusBelow } from "@/lib/editor-block-line";
import { createDocumentWidgetExtension } from "@/lib/tiptap-document-extensions";
import type { ToolOutputBlock } from "@/lib/tool-workflow";
import { ToolOutput } from "./ToolOutput";

function ToolNodeView({ node }: NodeViewProps) {
  return <NodeViewWrapper contentEditable={false}><ToolOutput block={node.attrs.block as ToolOutputBlock} /></NodeViewWrapper>;
}

/** A tool's saved output inside Markdown text (Entry), kept in the saved text as one line. */
export const DocumentToolNode = createDocumentWidgetExtension({ name: "documentTool", htmlAttribute: "data-document-tool", nodeView: ReactNodeViewRenderer(ToolNodeView) });

/** Puts a saved output where it belongs: over its earlier revision or the plate it came from, otherwise at the cursor. */
export function placeToolOutput(editor: Editor, block: ToolOutputBlock, replacePlateId?: string) {
  let found: { from: number; to: number } | undefined;
  editor.state.doc.descendants((node, pos) => {
    const id = node.attrs.block?.id;
    if ((node.type.name === "documentTool" && id === block.id) || (node.type.name === "documentPlate" && replacePlateId && id === replacePlateId)) found = { from: pos, to: pos + node.nodeSize };
  });
  const content = { type: "documentTool", attrs: { block } };
  if (found) { editor.chain().insertContentAt(found, content).run(); return; }
  editor.chain().focus().insertContent(content).run();
  focusBelow(editor, (node) => node.type.name === "documentTool" && node.attrs.block?.id === block.id);
}
