import { paragraphLayoutStyle } from "@/lib/document-paragraph-layout";
import { richTextFontFamilyCss } from "@/lib/rich-text-font-family";
import type { JSONContent } from "@tiptap/core";
import type { CSSProperties, ReactNode } from "react";
import { parseRichTextColor } from "@/lib/rich-text-color";
import { parseRichTextFontSizePt } from "@/lib/rich-text-font-size";
import { documentMediaFromMarkdown, documentMediaSchema } from "@/lib/document-media";
import { DocumentMediaView } from "./DocumentMediaView";

function safeHref(value: unknown) {
  if (typeof value !== "string") return undefined;
  return /^(https?:|mailto:|#|\/)/i.test(value) ? value : undefined;
}

function renderNode(node: JSONContent, key: string): ReactNode {
  if (node.type === "documentMedia") {
    const media = documentMediaSchema.safeParse(node.attrs?.block);
    return media.success ? <DocumentMediaView key={key} block={media.data} /> : null;
  }
  if (node.type === "hardBreak") return <br key={key} />;
  let content: ReactNode = node.text ?? node.content?.map((child, index) => renderNode(child, `${key}-${index}`)) ?? null;

  for (const [index, mark] of (node.marks ?? []).entries()) {
    const markKey = `${key}-mark-${index}`;
    if (mark.type === "bold") content = <strong key={markKey}>{content}</strong>;
    else if (mark.type === "italic") content = <em key={markKey}>{content}</em>;
    else if (mark.type === "underline") content = <u key={markKey}>{content}</u>;
    else if (mark.type === "strike") content = <s key={markKey}>{content}</s>;
    else if (mark.type === "code") content = <code key={markKey}>{content}</code>;
    else if (mark.type === "link") {
      const href = safeHref(mark.attrs?.href);
      content = href ? <a key={markKey} href={href} target="_blank" rel="noreferrer">{content}</a> : content;
    } else if (mark.type === "textStyle") {
      const fontSizePt = parseRichTextFontSizePt(typeof mark.attrs?.fontSize === "string" ? String(Number.parseFloat(mark.attrs.fontSize)) : undefined);
      const style: CSSProperties = { ...(fontSizePt ? {fontSize:`${fontSizePt}pt`} : {}), ...(typeof mark.attrs?.fontFamily === "string" ? {fontFamily:richTextFontFamilyCss(mark.attrs.fontFamily)} : {}) };
      content = <span key={markKey} className={parseRichTextColor(mark.attrs?.color) === "risk" ? "text-error" : undefined} style={style}>{content}</span>;
    }
  }

  const blockStyle = {...paragraphLayoutStyle(node.attrs ?? {}), ...(node.attrs?.documentLineHeight ? {lineHeight:node.attrs.documentLineHeight} : {})};
  if (node.type === "paragraph") return <div key={key} style={blockStyle}>{content}</div>;
  if (node.type === "heading") return <div key={key} style={blockStyle} className="font-semibold">{content}</div>;
  if (node.type === "blockquote") return <blockquote key={key}>{content}</blockquote>;
  if (node.type === "bulletList" || node.type === "taskList") return <ul key={key}>{content}</ul>;
  if (node.type === "orderedList") return <ol key={key}>{content}</ol>;
  if (node.type === "listItem" || node.type === "taskItem") return <li key={key}>{content}</li>;
  return <span key={key}>{content}</span>;
}

export function TiptapCellContentView({ content, fallback }: { content?: JSONContent[] | null; fallback: string }) {
  return content ? <>{content.map((node, index) => renderNode(node, `cell-${index}`))}</> : <>{fallback.split("\n").map((line, index) => {
    const media = documentMediaFromMarkdown(line);
    return media ? <DocumentMediaView key={index} block={media} /> : <span key={index}>{index ? "\n" : ""}{line}</span>;
  })}</>;
}
