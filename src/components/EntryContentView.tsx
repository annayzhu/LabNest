import type { ReactNode } from "react";
import { parseRichTextFontFamilyLine } from "@/lib/rich-text-font-family";
import { LABNEST_FONT_SIZE_TOKEN_SOURCE, parseLabNestFontSizeToken } from "@/lib/rich-text-font-size";
import { parseRichTextLineHeightLine } from "@/lib/rich-text-line-height";

const inlinePattern = new RegExp(`(${LABNEST_FONT_SIZE_TOKEN_SOURCE}|\\*\\*[^*\\n]+\\*\\*|~~[^~\\n]+~~|\\+\\+[^+\\n]+\\+\\+|\`[^\`\\n]+\`|\\*[^*\\n]+\\*|\\[[^\\]\\n]+\\]\\(https?:\\/\\/[^)\\n]+\\))`, "g");

function inlineContent(text: string): ReactNode[] {
  return text.split(inlinePattern).filter(Boolean).map((part, index) => {
    const key = `${index}-${part.slice(0, 8)}`;
    const sized = parseLabNestFontSizeToken(part);
    if (sized) return <span key={key} data-labnest-size={sized.size} style={{ fontSize: `${sized.size}pt` }}>{inlineContent(sized.content)}</span>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={key} className="font-semibold text-ink">{inlineContent(part.slice(2, -2))}</strong>;
    if (part.startsWith("~~") && part.endsWith("~~")) return <s key={key}>{inlineContent(part.slice(2, -2))}</s>;
    if (part.startsWith("++") && part.endsWith("++")) return <u key={key} className="decoration-moss/60 underline-offset-2">{inlineContent(part.slice(2, -2))}</u>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={key} className="rounded bg-stone px-1.5 py-0.5 font-mono text-[0.9em] text-ink">{part.slice(1, -1)}</code>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={key}>{inlineContent(part.slice(1, -1))}</em>;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (link) return <a key={key} href={link[2]} target="_blank" rel="noreferrer" className="font-medium text-moss underline underline-offset-2">{inlineContent(link[1])}</a>;
    return part;
  });
}

export function EntryContentView({ markdown, compact = false }: { markdown: string; compact?: boolean }) {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");

  return (
    <div className={`entry-content ${compact ? "space-y-0.5 text-sm leading-[var(--ln-rich-text-default-line-height)] text-graphite" : "space-y-1 text-[16px] leading-[var(--ln-rich-text-default-line-height)] text-graphite"}`}>
      {lines.map((rawLine, index) => {
        const parsedLine = parseRichTextLineHeightLine(rawLine);
        const parsedFontFamily = parseRichTextFontFamilyLine(parsedLine.content);
        const line = parsedFontFamily.content;
        const lineProps = { ...(parsedLine.lineHeight ? { "data-labnest-line-height": parsedLine.lineHeight, style: { lineHeight: parsedLine.lineHeight } } : {}), ...(parsedFontFamily.fontFamily ? { "data-labnest-font-family": parsedFontFamily.fontFamily } : {}) };
        const key = `${index}-${line.slice(0, 12)}`;
        if (!line.trim()) return <div key={key} {...lineProps} className="h-1" aria-hidden />;
        const heading = line.match(/^(#{1,3})\s+(.+)$/);
        if (heading) return <h2 key={key} {...lineProps} className="pt-1 font-serif text-[1.35em] font-medium text-ink">{inlineContent(heading[2])}</h2>;
        const checklist = line.match(/^\s*-\s+\[([ xX])\]\s+(.+)$/);
        if (checklist) return <div key={key} {...lineProps} className="flex items-start gap-3"><input type="checkbox" checked={checklist[1].toLowerCase() === "x"} readOnly className="mt-0.5 h-4 w-4 accent-moss" /><span className={checklist[1].toLowerCase() === "x" ? "text-muted line-through" : ""}>{inlineContent(checklist[2])}</span></div>;
        const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
        if (bullet) return <div key={key} {...lineProps} className="flex items-start gap-3 pl-1"><span className="mt-[0.45em] h-1.5 w-1.5 shrink-0 rounded-full bg-moss" /><span>{inlineContent(bullet[1])}</span></div>;
        const numbered = line.match(/^\s*(\d+)\.\s+(.+)$/);
        if (numbered) return <div key={key} {...lineProps} className="flex items-start gap-3"><span className="min-w-6 font-mono text-sm text-moss">{numbered[1]}.</span><span>{inlineContent(numbered[2])}</span></div>;
        const quote = line.match(/^\s*>\s?(.+)$/);
        if (quote) return <blockquote key={key} {...lineProps} className="border-l-2 border-moss/40 pl-4 italic text-muted">{inlineContent(quote[1])}</blockquote>;
        return <p key={key} {...lineProps}>{inlineContent(line)}</p>;
      })}
    </div>
  );
}
