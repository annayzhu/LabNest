import type { CSSProperties } from "react";

export function StaggeredText({ text, className }: { text: string; className?: string }) {
  const segments = [...text];
  return (
    <span className={className} aria-label={text}>
      {segments.map((character, index) => (
        <span
          key={`${character}-${index}`}
          aria-hidden="true"
          className="ln-staggered-word"
          style={{ "--ln-stagger-index": index } as CSSProperties}
        >
          {character === " " ? "\u00a0" : character}
        </span>
      ))}
    </span>
  );
}
