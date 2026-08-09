import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageHeader({
  identifier,
  title,
  actions,
  className,
}: {
  identifier?: string;
  // Kept for call-site compatibility; page headers intentionally render one level only.
  eyebrow?: string;
  title: string;
  // Long module explanations are intentionally omitted from the working surface.
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-2 md:min-h-10 md:flex-row md:items-center md:justify-between", className)}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {identifier ? <span className="font-mono text-xs font-normal tracking-[0.03em] text-muted">{identifier}</span> : null}
          <h1 className="break-words font-serif text-[22px] font-medium leading-tight text-ink md:text-[26px]">
            {title}
          </h1>
        </div>
      </div>
      {actions ? <div className="page-actions flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
