import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function DocumentCanvas({
  children,
  toolbar,
  className,
  paperClassName,
  label = "Scientific document",
}: {
  children: ReactNode;
  toolbar?: ReactNode;
  className?: string;
  paperClassName?: string;
  label?: string;
}) {
  return (
    <section className={cn("document-workspace document-print-root", className)} aria-label={label}>
      {toolbar ? <div className="document-canvas-toolbar" data-print-hidden>{toolbar}</div> : null}
      <article className={cn("document-a4-paper", paperClassName)}>{children}</article>
    </section>
  );
}
