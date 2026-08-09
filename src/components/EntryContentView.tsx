import type { ReactNode } from "react";

const inlinePattern = /(\*\*[^*\n]+\*\*|~~[^~\n]+~~|\+\+[^+\n]+\+\+|`[^`\n]+`|\*[^*\n]+\*|\[[^\]\n]+\]\(https?:\/\/[^)\n]+\))/g;

function inlineContent(text: string): ReactNode[] {
  return text.split(inlinePattern).filter(Boolean).map((part, index) => {
    const key = `${index}-${part.slice(0, 8)}`;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={key} className="font-semibold text-ink">{part.slice(2, -2)}</strong>;
    if (part.startsWith("~~") && part.endsWith("~~")) return <s key={key}>{part.slice(2, -2)}</s>;
    if (part.startsWith("++") && part.endsWith("++")) return <u key={key} className="decoration-moss/60 underline-offset-2">{part.slice(2, -2)}</u>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={key} className="rounded bg-stone px-1.5 py-0.5 font-mono text-[0.9em] text-ink">{part.slice(1, -1)}</code>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={key}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (link) return <a key={key} href={link[2]} target="_blank" rel="noreferrer" className="font-medium text-moss underline underline-offset-2">{link[1]}</a>;
    return part;
  });
}

export function EntryContentView({ markdown }: { markdown: string }) {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");

  return (
    <div className="space-y-2 text-[16px] leading-8 text-graphite">
      {lines.map((line, index) => {
        const key = `${index}-${line.slice(0, 12)}`;
        if (!line.trim()) return <div key={key} className="h-2" aria-hidden />;
        const heading = line.match(/^(#{1,3})\s+(.+)$/);
        if (heading) return <h2 key={key} className="pt-2 font-serif text-[1.35em] font-medium leading-snug text-ink">{inlineContent(heading[2])}</h2>;
        const checklist = line.match(/^\s*-\s+\[([ xX])\]\s+(.+)$/);
        if (checklist) return <div key={key} className="flex items-start gap-3"><input type="checkbox" checked={checklist[1].toLowerCase() === "x"} readOnly className="mt-2 h-4 w-4 accent-moss" /><span className={checklist[1].toLowerCase() === "x" ? "text-muted line-through" : ""}>{inlineContent(checklist[2])}</span></div>;
        const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
        if (bullet) return <div key={key} className="flex items-start gap-3 pl-1"><span className="mt-[13px] h-1.5 w-1.5 shrink-0 rounded-full bg-moss" /><span>{inlineContent(bullet[1])}</span></div>;
        const numbered = line.match(/^\s*(\d+)\.\s+(.+)$/);
        if (numbered) return <div key={key} className="flex items-start gap-3"><span className="min-w-6 font-mono text-sm text-moss">{numbered[1]}.</span><span>{inlineContent(numbered[2])}</span></div>;
        const quote = line.match(/^\s*>\s?(.+)$/);
        if (quote) return <blockquote key={key} className="border-l-2 border-moss/40 pl-4 italic text-muted">{inlineContent(quote[1])}</blockquote>;
        return <p key={key}>{inlineContent(line)}</p>;
      })}
    </div>
  );
}
