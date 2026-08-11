import type { ProtocolRichTextNode } from "@/lib/protocol-document";
import type { ScientificContentBlock } from "@/lib/scientific-document";

export function isCellRenderShortcut(event: { key: string; metaKey: boolean; ctrlKey: boolean }) {
  return event.key === "Enter" && (event.metaKey || event.ctrlKey);
}

export function scientificBlockHasContent(block: ScientificContentBlock) {
  if (block.type === "heading" || block.type === "text" || block.type === "callout") return Boolean(block.text.trim());
  if (block.type === "checklist") return block.items.some((item) => item.trim());
  if (block.type === "table") return Boolean(block.caption?.trim()) || block.rows.some((row) => row.some((cell) => cell.trim()));
  if (block.type === "metric") return Boolean(block.label.trim() || block.value.trim() || block.unit?.trim());
  if (block.type === "media") return Boolean(block.url.trim() || block.caption?.trim());
  return Boolean(block.datasetId.trim() || block.label.trim());
}

export function protocolRichTextHasContent(nodes: ProtocolRichTextNode[]) {
  return nodes.some((node) => node.content.some((run) => run.text.trim()));
}
