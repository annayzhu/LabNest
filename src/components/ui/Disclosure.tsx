"use client";

import { ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A group of optional fields behind one line: its title and a short summary of what it holds now ("RP-003 · Draft"),
 * so a panel shows what matters and the rest is one click away. A required field inside opens it when the browser
 * rejects the form, so a closed group never blocks saving without saying why.
 */
export function Disclosure({ title, summary, defaultOpen = false, className, children }: { title: ReactNode; summary?: ReactNode; defaultOpen?: boolean; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details className={cn("ln-section ln-disclosure group border-b border-hairline", className)} open={open} onToggle={(event) => setOpen(event.currentTarget.open)} onInvalidCapture={() => setOpen(true)}>
      <summary className="focus-ring flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-90" aria-hidden />
        <span className="text-sm font-semibold text-ink">{title}</span>
        {summary ? <span className="min-w-0 flex-1 truncate text-right text-xs text-muted group-open:hidden">{summary}</span> : null}
      </summary>
      <div className="grid gap-4 border-t border-hairline/70 px-4 py-3">{children}</div>
    </details>
  );
}
