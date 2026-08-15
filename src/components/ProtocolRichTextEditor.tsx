"use client";

import { useLayoutEffect, useRef } from "react";
import { Bold, Italic, Link2, List, ListOrdered, Quote, Redo2, RemoveFormatting, Strikethrough, Underline, Undo2, Unlink } from "lucide-react";
import type { ProtocolRichTextNode, ProtocolRichTextRun } from "@/lib/protocol-document";
import { applyRichTextFontFamily, clearSelectedRichTextFormatting, normalizePastedRichTextTypography, parseRichTextFontFamily, RICH_TEXT_FONT_FAMILIES } from "@/lib/rich-text-font-family";
import { parseRichTextFontSizePt, RICH_TEXT_FONT_SIZES_PT, type RichTextFontSizePt } from "@/lib/rich-text-font-size";
import { applyRichTextLineHeight, DEFAULT_RICH_TEXT_LINE_HEIGHT, parseRichTextLineHeight, RICH_TEXT_LINE_HEIGHTS, type RichTextLineHeight } from "@/lib/rich-text-line-height";

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
  if (run.fontSizePt) html = `<span data-labnest-size="${run.fontSizePt}" style="font-size:${run.fontSizePt}pt">${html}</span>`;
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
    const blockAttributes = `${node.lineHeight && node.lineHeight !== DEFAULT_RICH_TEXT_LINE_HEIGHT ? ` data-labnest-line-height="${node.lineHeight}" style="line-height:${node.lineHeight}"` : ""}${node.fontFamily ? ` data-labnest-font-family="${node.fontFamily}"` : ""}`;
    if (node.type === "bullet" || node.type === "numbered") {
      if (listType !== node.type) {
        closeList(); listType = node.type; chunks.push(node.type === "bullet" ? "<ul>" : "<ol>");
      }
      chunks.push(`<li${blockAttributes}>${content}</li>`);
      continue;
    }
    closeList();
    const tag = node.type === "heading2" ? "h2" : node.type === "heading3" ? "h3" : node.type === "quote" ? "blockquote" : "p";
    chunks.push(`<${tag}${blockAttributes}>${content}</${tag}>`);
  }
  closeList();
  return chunks.join("");
}

type Marks = Omit<ProtocolRichTextRun, "text">;

function sameMarks(left: Marks, right: Marks) {
  return left.bold === right.bold && left.italic === right.italic && left.underline === right.underline && left.strike === right.strike && left.code === right.code && left.link === right.link && left.fontSizePt === right.fontSizePt;
}

function inlineRuns(node: Node, inherited: Marks = {}): ProtocolRichTextRun[] {
  if (node.nodeType === Node.TEXT_NODE) return [{ text: node.textContent ?? "", ...inherited }];
  if (!(node instanceof HTMLElement)) return [];
  const tag = node.tagName.toLowerCase();
  if (tag === "br") return [{ text: "\n", ...inherited }];
  const fontSizePt = parseRichTextFontSizePt(node.dataset.labnestSize);
  const marks: Marks = {
    ...inherited,
    ...(tag === "strong" || tag === "b" ? { bold: true } : {}),
    ...(tag === "em" || tag === "i" ? { italic: true } : {}),
    ...(tag === "u" ? { underline: true } : {}),
    ...(tag === "s" || tag === "strike" ? { strike: true } : {}),
    ...(tag === "code" ? { code: true } : {}),
    ...(tag === "a" && safeLink(node.getAttribute("href") ?? undefined) ? { link: safeLink(node.getAttribute("href") ?? undefined) } : {}),
    ...(fontSizePt ? { fontSizePt } : {}),
  };
  return Array.from(node.childNodes).flatMap((child) => inlineRuns(child, marks));
}

function mergeRuns(runs: ProtocolRichTextRun[]) {
  const merged: ProtocolRichTextRun[] = [];
  for (const run of runs) {
    const marks: Marks = { bold: run.bold, italic: run.italic, underline: run.underline, strike: run.strike, code: run.code, link: run.link, fontSizePt: run.fontSizePt };
    const previous = merged[merged.length - 1];
    const previousMarks: Marks = previous ? { bold: previous.bold, italic: previous.italic, underline: previous.underline, strike: previous.strike, code: previous.code, link: previous.link, fontSizePt: previous.fontSizePt } : {};
    if (previous && sameMarks(previousMarks, marks)) previous.text += run.text;
    else merged.push(run);
  }
  return merged.length ? merged : [{ text: "" }];
}

function serializeEditor(root: HTMLElement): ProtocolRichTextNode[] {
  const nodes: ProtocolRichTextNode[] = [];
  const add = (type: ProtocolRichTextNode["type"], element: Node) => {
    const lineHeight = element instanceof HTMLElement ? parseRichTextLineHeight(element.dataset.labnestLineHeight) : undefined;
    const fontFamily = element instanceof HTMLElement ? parseRichTextFontFamily(element.dataset.labnestFontFamily) : undefined;
    nodes.push({ type, content: mergeRuns(inlineRuns(element)), ...(lineHeight && lineHeight !== DEFAULT_RICH_TEXT_LINE_HEIGHT ? { lineHeight } : {}), ...(fontFamily ? { fontFamily } : {}) });
  };
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
  const selectionRef = useRef<Range | null>(null);
  useLayoutEffect(() => {
    if (!editorRef.current || editorRef.current.childNodes.length) return;
    editorRef.current.innerHTML = nodesHtml(nodes);
  }, [nodes]);
  const sync = () => {
    if (!editorRef.current) return nodes;
    const next = serializeEditor(editorRef.current);
    onChange(next);
    return next;
  };
  const rememberSelection = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) selectionRef.current = range.cloneRange();
  };
  const restoreSelection = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const range = selectionRef.current;
    if (!range) return;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };
  const command = (name: string, value?: string) => {
    restoreSelection();
    document.execCommand(name, false, value);
    sync();
    rememberSelection();
  };
  const applyFontSize = (fontSizePt: RichTextFontSizePt) => {
    restoreSelection();
    document.execCommand("fontSize", false, "7");
    editorRef.current?.querySelectorAll<HTMLFontElement>('font[size="7"]').forEach((element) => {
      element.removeAttribute("size");
      element.dataset.labnestSize = String(fontSizePt);
      element.style.fontSize = `${fontSizePt}pt`;
    });
    sync();
    rememberSelection();
  };
  const applyLineHeight = (lineHeight: RichTextLineHeight) => {
    restoreSelection();
    if (editorRef.current) applyRichTextLineHeight(editorRef.current, lineHeight);
    sync();
    rememberSelection();
  };
  const applyFontFamily = (fontFamily: string) => {
    const parsed = parseRichTextFontFamily(fontFamily);
    restoreSelection();
    if (editorRef.current && parsed) applyRichTextFontFamily(editorRef.current, parsed);
    sync();
    rememberSelection();
  };
  const clearFormatting = () => {
    restoreSelection();
    if (editorRef.current) clearSelectedRichTextFormatting(editorRef.current);
    sync();
    rememberSelection();
  };
  const normalizePaste = () => {
    window.requestAnimationFrame(() => {
      if (!editorRef.current) return;
      normalizePastedRichTextTypography(editorRef.current);
      sync();
      rememberSelection();
    });
  };
  const addLink = () => {
    const value = window.prompt("Link URL (https://, mailto:, or /path)");
    if (value && safeLink(value)) command("createLink", value);
  };

  return <div className="mt-1 overflow-hidden rounded-[8px] border border-transparent bg-surface transition focus-within:border-border-strong hover:border-hairline">
    <div className="editorial-scrollbar flex items-center gap-0.5 overflow-x-auto whitespace-nowrap border-b border-hairline bg-stone/60 px-1.5 py-1" aria-label="Formatting toolbar" data-print-hidden>
      <Toolbar label="Bold" onClick={() => command("bold")}><Bold /></Toolbar><Toolbar label="Italic" onClick={() => command("italic")}><Italic /></Toolbar><Toolbar label="Underline" onClick={() => command("underline")}><Underline /></Toolbar><Toolbar label="Strikethrough" onClick={() => command("strikeThrough")}><Strikethrough /></Toolbar>
      <span className="mx-0.5 h-4 border-l border-hairline" />
      <select aria-label="Font family" defaultValue="" onMouseDown={rememberSelection} onChange={(event) => { applyFontFamily(event.target.value); event.currentTarget.value = ""; }} className="focus-ring h-6 shrink-0 rounded-[5px] border border-hairline bg-surface px-1.5 text-[11px] text-graphite"><option value="" disabled>Font</option>{RICH_TEXT_FONT_FAMILIES.map((fontFamily) => <option key={fontFamily} value={fontFamily}>{fontFamily === "sans" ? "Sans" : fontFamily === "serif" ? "Serif" : "Mono"}</option>)}</select>
      <select aria-label="Font size" defaultValue="" onMouseDown={rememberSelection} onChange={(event) => { const fontSizePt = parseRichTextFontSizePt(event.target.value); if (fontSizePt) applyFontSize(fontSizePt); event.currentTarget.value = ""; }} className="focus-ring h-6 shrink-0 rounded-[5px] border border-hairline bg-surface px-1.5 text-[11px] text-graphite"><option value="" disabled>Size</option>{RICH_TEXT_FONT_SIZES_PT.map((size) => <option key={size} value={size}>{size} pt</option>)}</select>
      <select aria-label="Line spacing" defaultValue="" onMouseDown={rememberSelection} onChange={(event) => { const lineHeight = parseRichTextLineHeight(event.target.value); if (lineHeight) applyLineHeight(lineHeight); event.currentTarget.value = ""; }} className="focus-ring h-6 shrink-0 rounded-[5px] border border-hairline bg-surface px-1.5 text-[11px] text-graphite"><option value="" disabled>Line</option>{RICH_TEXT_LINE_HEIGHTS.map((value) => <option key={value} value={value}>{value}×</option>)}</select>
      <select aria-label="Block style" defaultValue="p" onMouseDown={rememberSelection} onChange={(event) => command("formatBlock", event.target.value)} className="focus-ring h-6 shrink-0 rounded-[5px] border border-hairline bg-surface px-1.5 text-[11px] text-graphite"><option value="p">Paragraph</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="blockquote">Quote</option></select>
      <Toolbar label="Bullet list" onClick={() => command("insertUnorderedList")}><List /></Toolbar><Toolbar label="Numbered list" onClick={() => command("insertOrderedList")}><ListOrdered /></Toolbar><Toolbar label="Quote" onClick={() => command("formatBlock", "blockquote")}><Quote /></Toolbar>
      <span className="mx-0.5 h-4 border-l border-hairline" />
      <Toolbar label="Add link" onClick={addLink}><Link2 /></Toolbar><Toolbar label="Remove link" onClick={() => command("unlink")}><Unlink /></Toolbar><Toolbar label="Undo" onClick={() => command("undo")}><Undo2 /></Toolbar><Toolbar label="Redo" onClick={() => command("redo")}><Redo2 /></Toolbar><Toolbar label="Clear formatting" onClick={clearFormatting}><RemoveFormatting /></Toolbar>
    </div>
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      onInput={sync}
      onBlur={sync}
      onSelect={rememberSelection}
      onKeyUp={rememberSelection}
      onMouseUp={rememberSelection}
      onPaste={normalizePaste}
      className="protocol-rich-editor min-h-16 px-2 py-2 text-sm leading-[1.3] text-graphite outline-none"
    />
  </div>;
}

function Toolbar({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactElement<{ className?: string }> }) {
  return <button type="button" title={label} aria-label={label} onMouseDown={(event) => event.preventDefault()} onClick={onClick} className="focus-ring flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] text-muted hover:bg-surface hover:text-ink">{children && <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{children}</span>}</button>;
}
