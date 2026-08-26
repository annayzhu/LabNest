"use client";

import { useLayoutEffect, useRef } from "react";
import { Bold, CheckSquare, Heading2, Italic, Link2, List, ListOrdered, Quote, Redo2, RemoveFormatting, Strikethrough, Underline, Undo2, Unlink } from "lucide-react";
import { cn } from "@/lib/cn";
import { applyRichTextFontFamily, clearSelectedRichTextFormatting, normalizePastedRichTextTypography, parseRichTextFontFamily, parseRichTextFontFamilyLine, richTextFontFamilyPrefix, RICH_TEXT_FONT_FAMILIES } from "@/lib/rich-text-font-family";
import { LABNEST_FONT_SIZE_TOKEN_SOURCE, parseLabNestFontSizeToken, parseRichTextFontSizePt, RICH_TEXT_FONT_SIZES_PT, type RichTextFontSizePt } from "@/lib/rich-text-font-size";
import { applyRichTextLineHeight, parseRichTextLineHeight, parseRichTextLineHeightLine, richTextLineHeightPrefix, RICH_TEXT_LINE_HEIGHTS, type RichTextLineHeight } from "@/lib/rich-text-line-height";

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const inlinePattern = new RegExp(`(${LABNEST_FONT_SIZE_TOKEN_SOURCE}|\\*\\*[^*\\n]+\\*\\*|~~[^~\\n]+~~|\\+\\+[^+\\n]+\\+\\+|\`[^\`\\n]+\`|\\*[^*\\n]+\\*|\\[[^\\]\\n]+\\]\\(https?:\\/\\/[^)\\n]+\\))`, "g");

function inlineMarkdownToHtml(value: string): string {
  return value.split(inlinePattern).filter(Boolean).map((part) => {
    const sized = parseLabNestFontSizeToken(part);
    if (sized) return `<span data-labnest-size="${sized.size}" style="font-size:${sized.size}pt">${inlineMarkdownToHtml(sized.content)}</span>`;
    if (part.startsWith("**") && part.endsWith("**")) return `<strong>${inlineMarkdownToHtml(part.slice(2, -2))}</strong>`;
    if (part.startsWith("~~") && part.endsWith("~~")) return `<s>${inlineMarkdownToHtml(part.slice(2, -2))}</s>`;
    if (part.startsWith("++") && part.endsWith("++")) return `<u>${inlineMarkdownToHtml(part.slice(2, -2))}</u>`;
    if (part.startsWith("`") && part.endsWith("`")) return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
    if (part.startsWith("*") && part.endsWith("*")) return `<em>${inlineMarkdownToHtml(part.slice(1, -1))}</em>`;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (link) return `<a href="${escapeHtml(link[2])}">${inlineMarkdownToHtml(link[1])}</a>`;
    return escapeHtml(part);
  }).join("");
}

function markdownToHtml(value: string) {
  if (!value.trim()) return "";
  const chunks: string[] = [];
  const lines = value.replaceAll("\r\n", "\n").split("\n");
  let list: "ul" | "ol" | undefined;
  const closeList = () => {
    if (!list) return;
    chunks.push(`</${list}>`);
    list = undefined;
  };

  for (const rawLine of lines) {
    const parsedLine = parseRichTextLineHeightLine(rawLine);
    const parsedFontFamily = parseRichTextFontFamilyLine(parsedLine.content);
    const line = parsedFontFamily.content;
    const blockAttributes = `${parsedLine.lineHeight && parsedLine.lineHeight !== 1 ? ` data-labnest-line-height="${parsedLine.lineHeight}" style="line-height:${parsedLine.lineHeight}"` : ""}${parsedFontFamily.fontFamily ? ` data-labnest-font-family="${parsedFontFamily.fontFamily}"` : ""}`;
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const checklist = line.match(/^\s*-\s+\[([ xX])\]\s+(.+)$/);
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    const numbered = line.match(/^\s*\d+\.\s+(.+)$/);
    const quote = line.match(/^\s*>\s?(.+)$/);
    if (checklist || bullet || numbered) {
      const nextList = numbered ? "ol" : "ul";
      if (list !== nextList) {
        closeList();
        chunks.push(`<${nextList}>`);
        list = nextList;
      }
      if (checklist) chunks.push(`<li${blockAttributes} data-checklist="${checklist[1].toLowerCase() === "x" ? "true" : "false"}"><span data-check-marker contenteditable="false">${checklist[1].toLowerCase() === "x" ? "☑" : "☐"} </span>${inlineMarkdownToHtml(checklist[2])}</li>`);
      else chunks.push(`<li${blockAttributes}>${inlineMarkdownToHtml((bullet ?? numbered)?.[1] ?? "")}</li>`);
      continue;
    }
    closeList();
    if (!line.trim()) chunks.push(`<p${blockAttributes}><br></p>`);
    else if (heading) chunks.push(`<${heading[1].length === 1 ? "h2" : "h3"}${blockAttributes}>${inlineMarkdownToHtml(heading[2])}</${heading[1].length === 1 ? "h2" : "h3"}>`);
    else if (quote) chunks.push(`<blockquote${blockAttributes}>${inlineMarkdownToHtml(quote[1])}</blockquote>`);
    else chunks.push(`<p${blockAttributes}>${inlineMarkdownToHtml(line)}</p>`);
  }
  closeList();
  return chunks.join("");
}

function inlineHtmlToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof HTMLElement)) return "";
  if (node.hasAttribute("data-check-marker")) return "";
  const content = Array.from(node.childNodes).map(inlineHtmlToMarkdown).join("");
  const tag = node.tagName.toLowerCase();
  if (tag === "br") return "\n";
  const fontSizePt = parseRichTextFontSizePt(node.dataset.labnestSize);
  if (fontSizePt) return `<span data-labnest-size="${fontSizePt}">${content}</span>`;
  if (tag === "strong" || tag === "b") return `**${content}**`;
  if (tag === "em" || tag === "i") return `*${content}*`;
  if (tag === "u") return `++${content}++`;
  if (tag === "s" || tag === "strike") return `~~${content}~~`;
  if (tag === "code") return `\`${content}\``;
  if (tag === "a") {
    const href = node.getAttribute("href") ?? "";
    return /^https?:\/\//i.test(href) ? `[${content}](${href})` : content;
  }
  return content;
}

function wrappedListElement(element: HTMLElement): HTMLElement | null {
  let current = element;
  while (current.tagName.toLowerCase() === "p" || current.tagName.toLowerCase() === "div") {
    const meaningfulChildren = Array.from(current.childNodes).filter((node) => {
      if (node.nodeType === Node.TEXT_NODE) return Boolean(node.textContent?.trim());
      return !(node instanceof HTMLBRElement);
    });
    if (meaningfulChildren.length !== 1 || !(meaningfulChildren[0] instanceof HTMLElement)) return null;
    current = meaningfulChildren[0];
  }
  const tag = current.tagName.toLowerCase();
  return tag === "ul" || tag === "ol" ? current : null;
}

function editorToMarkdown(root: HTMLElement) {
  const lines: string[] = [];
  const prefix = (element: HTMLElement) => `${richTextLineHeightPrefix(parseRichTextLineHeight(element.dataset.labnestLineHeight))}${richTextFontFamilyPrefix(parseRichTextFontFamily(element.dataset.labnestFontFamily))}`;
  const withPrefix = (element: HTMLElement, value: string) => value
    .split("\n")
    .map((line) => `${prefix(element)}${line}`)
    .join("\n");
  const appendList = (listElement: HTMLElement) => {
    const tag = listElement.tagName.toLowerCase();
    Array.from(listElement.children).forEach((item, index) => {
      const checked = item.getAttribute("data-checklist");
      const itemPrefix = checked !== null ? `- [${checked === "true" ? "x" : ""}] ` : tag === "ol" ? `${index + 1}. ` : "- ";
      lines.push(withPrefix(item as HTMLElement, `${itemPrefix}${inlineHtmlToMarkdown(item).trim()}`));
    });
  };
  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (child.textContent) lines.push(child.textContent);
      continue;
    }
    if (!(child instanceof HTMLElement)) continue;
    const tag = child.tagName.toLowerCase();
    const wrappedList = wrappedListElement(child);
    // Chromium can leave execCommand-created lists inside a paragraph. Treat the
    // wrapper as a list so its individual items survive the Markdown round trip.
    if (tag === "ul" || tag === "ol") appendList(child);
    else if (wrappedList) appendList(wrappedList);
    else if (tag === "h1" || tag === "h2") lines.push(withPrefix(child, `# ${inlineHtmlToMarkdown(child).trim()}`));
    else if (tag === "h3") lines.push(withPrefix(child, `## ${inlineHtmlToMarkdown(child).trim()}`));
    else if (tag === "blockquote") lines.push(withPrefix(child, `> ${inlineHtmlToMarkdown(child).trim()}`));
    else if (child.hasAttribute("data-checklist")) lines.push(withPrefix(child, `- [${child.getAttribute("data-checklist") === "true" ? "x" : ""}] ${inlineHtmlToMarkdown(child).trim()}`));
    else lines.push(withPrefix(child, inlineHtmlToMarkdown(child).replace(/\n+$/, "")));
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function MarkdownRichTextEditor({
  value,
  onChange,
  placeholder = "Start writing…",
  minHeightClass = "min-h-48",
  autoFocus = false,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeightClass?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef(value);
  const selectionRef = useRef<Range | null>(null);

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const initialized = editor.dataset.initialized === "true";
    const isExternalChange = value !== lastValueRef.current;
    if (!initialized || (isExternalChange && document.activeElement !== editor)) {
      editor.innerHTML = markdownToHtml(value);
      editor.dataset.initialized = "true";
    }
    lastValueRef.current = value;
    if (autoFocus && !initialized) editor.focus();
  }, [autoFocus, value]);

  const sync = () => {
    if (!editorRef.current) return;
    const next = editorToMarkdown(editorRef.current);
    lastValueRef.current = next;
    onChange(next);
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
  const command = (name: string, commandValue?: string) => {
    restoreSelection();
    document.execCommand(name, false, commandValue);
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
    const href = window.prompt("Link URL (https://)");
    if (href && /^https?:\/\//i.test(href)) command("createLink", href);
  };
  const addChecklist = () => command("insertHTML", '<ul><li data-checklist="false"><span data-check-marker contenteditable="false">☐ </span>Checklist item</li></ul>');

  return <div className={cn("overflow-hidden rounded-[8px] border border-transparent bg-surface transition focus-within:border-border-strong hover:border-hairline", className)}>
    <div className="editorial-scrollbar flex items-center gap-0.5 overflow-x-auto whitespace-nowrap border-b border-hairline bg-stone/55 px-1.5 py-1" aria-label="Formatting toolbar" data-print-hidden>
      <Toolbar label="Bold" onClick={() => command("bold")}><Bold /></Toolbar>
      <Toolbar label="Italic" onClick={() => command("italic")}><Italic /></Toolbar>
      <Toolbar label="Underline" onClick={() => command("underline")}><Underline /></Toolbar>
      <Toolbar label="Strikethrough" onClick={() => command("strikeThrough")}><Strikethrough /></Toolbar>
      <span className="mx-0.5 h-4 w-px shrink-0 bg-hairline" />
      <select aria-label="Font family" defaultValue="" onMouseDown={rememberSelection} onChange={(event) => { applyFontFamily(event.target.value); event.currentTarget.value = ""; }} className="focus-ring h-6 shrink-0 rounded-[5px] border border-hairline bg-surface px-1.5 text-[11px] text-graphite"><option value="" disabled>Font</option>{RICH_TEXT_FONT_FAMILIES.map((fontFamily) => <option key={fontFamily} value={fontFamily}>{fontFamily === "sans" ? "Sans" : fontFamily === "serif" ? "Serif" : "Mono"}</option>)}</select>
      <select aria-label="Font size" defaultValue="" onMouseDown={rememberSelection} onChange={(event) => { const fontSizePt = parseRichTextFontSizePt(event.target.value); if (fontSizePt) applyFontSize(fontSizePt); event.currentTarget.value = ""; }} className="focus-ring h-6 shrink-0 rounded-[5px] border border-hairline bg-surface px-1.5 text-[11px] text-graphite"><option value="" disabled>Size</option>{RICH_TEXT_FONT_SIZES_PT.map((size) => <option key={size} value={size}>{size} pt</option>)}</select>
      <select aria-label="Line spacing" defaultValue="" onMouseDown={rememberSelection} onChange={(event) => { const lineHeight = parseRichTextLineHeight(event.target.value); if (lineHeight) applyLineHeight(lineHeight); event.currentTarget.value = ""; }} className="focus-ring h-6 shrink-0 rounded-[5px] border border-hairline bg-surface px-1.5 text-[11px] text-graphite"><option value="" disabled>Line</option>{RICH_TEXT_LINE_HEIGHTS.map((value) => <option key={value} value={value}>{value}×</option>)}</select>
      <Toolbar label="Heading" onClick={() => command("formatBlock", "h2")}><Heading2 /></Toolbar>
      <Toolbar label="Bulleted list" onClick={() => command("insertUnorderedList")}><List /></Toolbar>
      <Toolbar label="Numbered list" onClick={() => command("insertOrderedList")}><ListOrdered /></Toolbar>
      <Toolbar label="Checklist" onClick={addChecklist}><CheckSquare /></Toolbar>
      <Toolbar label="Quote" onClick={() => command("formatBlock", "blockquote")}><Quote /></Toolbar>
      <span className="mx-0.5 h-4 w-px shrink-0 bg-hairline" />
      <Toolbar label="Add link" onClick={addLink}><Link2 /></Toolbar>
      <Toolbar label="Remove link" onClick={() => command("unlink")}><Unlink /></Toolbar>
      <Toolbar label="Undo" onClick={() => command("undo")}><Undo2 /></Toolbar>
      <Toolbar label="Redo" onClick={() => command("redo")}><Redo2 /></Toolbar>
      <Toolbar label="Clear formatting" onClick={clearFormatting}><RemoveFormatting /></Toolbar>
    </div>
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onInput={sync}
      onBlur={sync}
      onSelect={rememberSelection}
      onKeyUp={rememberSelection}
      onMouseUp={rememberSelection}
      onPaste={normalizePaste}
      className={cn("protocol-rich-editor wysiwyg-placeholder px-2 py-2 text-[15px] leading-[var(--ln-rich-text-default-line-height)] text-graphite outline-none", minHeightClass)}
    />
  </div>;
}

function Toolbar({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactElement<{ className?: string }> }) {
  return <button type="button" title={label} aria-label={label} onMouseDown={(event) => event.preventDefault()} onClick={onClick} className="focus-ring flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] text-muted hover:bg-surface hover:text-ink"><span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{children}</span></button>;
}
