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
    <header className={cn("page-header flex flex-col gap-2 md:min-h-8 md:flex-row md:items-center md:justify-between", className)}>
      <div className="min-w-0">
        <div className="page-header-copy flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {identifier ? <span className="page-header-identifier record-identifier text-[10px] font-medium text-muted">{identifier}</span> : null}
          <h1 className="page-header-title break-words font-serif text-[length:var(--ln-page-title-size)] font-medium leading-[1.25] tracking-[-0.012em] text-ink">
            {title}
          </h1>
        </div>
      </div>
      {actions ? <div className="page-actions flex flex-wrap gap-1.5">{actions}</div> : null}
    </header>
  );
}
