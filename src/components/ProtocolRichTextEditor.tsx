"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Bold, Italic, Link2, List, ListOrdered, Quote, Redo2, Strikethrough, Underline, Undo2, Unlink } from "lucide-react";
import type { ProtocolRichTextNode, ProtocolRichTextRun } from "@/lib/protocol-document";

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function safeLink(value: string | undefined) {
  if (!value) return undefined;
  const trimmed = value.trim();
  return /^(https?:\/\/|mailto:|\/)/i.test(trimmed) ? trimmed : undefined;
}

function runHtml(run: ProtocolRichTextRun) {
  let html = escapeHtml(run.text).replaceAll("\n", "<br>");
  if (run.code) html = `<code>${html}</code>`;
  if (run.bold) html = `<strong>${html}</strong>`;
  if (run.italic) html = `<em>${html}</em>`;
  if (run.underline) html = `<u>${html}</u>`;
  if (run.strike) html = `<s>${html}</s>`;
  const link = safeLink(run.link);
  if (link) html = `<a href="${escapeHtml(link)}">${html}</a>`;
  return html;
}

function nodesHtml(nodes: ProtocolRichTextNode[]) {
  const chunks: string[] = [];
  let listType: "bullet" | "numbered" | undefined;
  const closeList = () => {
    if (!listType) return;
    chunks.push(listType === "bullet" ? "</ul>" : "</ol>");
    listType = undefined;
  };
  for (const node of nodes) {
    const content = node.content.map(runHtml).join("") || "<br>";
    if (node.type === "bullet" || node.type === "numbered") {
      if (listType !== node.type) {
        closeList(); listType = node.type; chunks.push(node.type === "bullet" ? "<ul>" : "<ol>");
      }
      chunks.push(`<li>${content}</li>`);
      continue;
    }
    closeList();
    const tag = node.type === "heading2" ? "h2" : node.type === "heading3" ? "h3" : node.type === "quote" ? "blockquote" : "p";
    chunks.push(`<${tag}>${content}</${tag}>`);
  }
  closeList();
  return chunks.join("");
}

type Marks = Omit<ProtocolRichTextRun, "text">;

function sameMarks(left: Marks, right: Marks) {
  return left.bold === right.bold && left.italic === right.italic && left.underline === right.underline && left.strike === right.strike && left.code === right.code && left.link === right.link;
}

function inlineRuns(node: Node, inherited: Marks = {}): ProtocolRichTextRun[] {
  if (node.nodeType === Node.TEXT_NODE) return [{ text: node.textContent ?? "", ...inherited }];
  if (!(node instanceof HTMLElement)) return [];
  const tag = node.tagName.toLowerCase();
  if (tag === "br") return [{ text: "\n", ...inherited }];
  const marks: Marks = {
    ...inherited,
    ...(tag === "strong" || tag === "b" ? { bold: true } : {}),
    ...(tag === "em" || tag === "i" ? { italic: true } : {}),
    ...(tag === "u" ? { underline: true } : {}),
    ...(tag === "s" || tag === "strike" ? { strike: true } : {}),
    ...(tag === "code" ? { code: true } : {}),
    ...(tag === "a" && safeLink(node.getAttribute("href") ?? undefined) ? { link: safeLink(node.getAttribute("href") ?? undefined) } : {}),
  };
  return Array.from(node.childNodes).flatMap((child) => inlineRuns(child, marks));
}

function mergeRuns(runs: ProtocolRichTextRun[]) {
  const merged: ProtocolRichTextRun[] = [];
  for (const run of runs) {
    const marks: Marks = { bold: run.bold, italic: run.italic, underline: run.underline, strike: run.strike, code: run.code, link: run.link };
    const previous = merged[merged.length - 1];
    const previousMarks: Marks = previous ? { bold: previous.bold, italic: previous.italic, underline: previous.underline, strike: previous.strike, code: previous.code, link: previous.link } : {};
    if (previous && sameMarks(previousMarks, marks)) previous.text += run.text;
    else merged.push(run);
  }
  return merged.length ? merged : [{ text: "" }];
}

function serializeEditor(root: HTMLElement): ProtocolRichTextNode[] {
  const nodes: ProtocolRichTextNode[] = [];
  const add = (type: ProtocolRichTextNode["type"], element: Node) => nodes.push({ type, content: mergeRuns(inlineRuns(element)) });
  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) { if (child.textContent) add("paragraph", child); continue; }
    if (!(child instanceof HTMLElement)) continue;
    const tag = child.tagName.toLowerCase();
    if (tag === "ul" || tag === "ol") {
      Array.from(child.children).filter((item) => item.tagName.toLowerCase() === "li").forEach((item) => add(tag === "ul" ? "bullet" : "numbered", item));
    } else if (tag === "h2") add("heading2", child);
    else if (tag === "h3") add("heading3", child);
    else if (tag === "blockquote") add("quote", child);
    else add("paragraph", child);
  }
  return nodes.length ? nodes : [{ type: "paragraph", content: [{ text: "" }] }];
}

export function ProtocolRichTextEditor({ nodes, onChange }: { nodes: ProtocolRichTextNode[]; onChange: (nodes: ProtocolRichTextNode[]) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [initialHtml] = useState(() => nodesHtml(nodes));
  useLayoutEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = initialHtml;
  }, [initialHtml]);
  const sync = () => { if (editorRef.current) onChange(serializeEditor(editorRef.current)); };
  const command = (name: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(name, false, value);
    sync();
  };
  const addLink = () => {
    const value = window.prompt("Link URL (https://, mailto:, or /path)");
    if (value && safeLink(value)) command("createLink", value);
  };
  return <div className="mt-2 overflow-hidden rounded-[8px] border border-hairline bg-surface">
    <div className="flex flex-wrap items-center gap-1 border-b border-hairline bg-stone/60 px-2 py-1.5">
      <Toolbar label="Bold" onClick={() => command("bold")}><Bold /></Toolbar><Toolbar label="Italic" onClick={() => command("italic")}><Italic /></Toolbar><Toolbar label="Underline" onClick={() => command("underline")}><Underline /></Toolbar><Toolbar label="Strikethrough" onClick={() => command("strikeThrough")}><Strikethrough /></Toolbar>
      <span className="mx-1 h-5 border-l border-hairline" />
      <select aria-label="Block style" defaultValue="p" onMouseDown={(event) => event.stopPropagation()} onChange={(event) => command("formatBlock", event.target.value)} className="focus-ring h-8 rounded-[6px] border border-hairline bg-surface px-2 text-xs text-graphite"><option value="p">Paragraph</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="blockquote">Quote</option></select>
      <Toolbar label="Bullet list" onClick={() => command("insertUnorderedList")}><List /></Toolbar><Toolbar label="Numbered list" onClick={() => command("insertOrderedList")}><ListOrdered /></Toolbar><Toolbar label="Quote" onClick={() => command("formatBlock", "blockquote")}><Quote /></Toolbar>
      <span className="mx-1 h-5 border-l border-hairline" />
      <Toolbar label="Add link" onClick={addLink}><Link2 /></Toolbar><Toolbar label="Remove link" onClick={() => command("unlink")}><Unlink /></Toolbar><Toolbar label="Undo" onClick={() => command("undo")}><Undo2 /></Toolbar><Toolbar label="Redo" onClick={() => command("redo")}><Redo2 /></Toolbar>
    </div>
    <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={sync} onBlur={sync} className="protocol-rich-editor min-h-36 px-4 py-3 text-sm leading-7 text-graphite outline-none" />
  </div>;
}

function Toolbar({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactElement<{ className?: string }> }) {
  return <button type="button" title={label} aria-label={label} onMouseDown={(event) => event.preventDefault()} onClick={onClick} className="focus-ring flex h-8 w-8 items-center justify-center rounded-[6px] text-muted hover:bg-surface hover:text-ink">{children && <span className="[&>svg]:h-4 [&>svg]:w-4">{children}</span>}</button>;
}
