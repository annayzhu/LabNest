import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[var(--ln-radius-panel)] border border-hairline bg-surface",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  action,
  className,
}: {
  title: ReactNode;
  // Accepted for compatibility; cards use a single, content-oriented heading.
  eyebrow?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-11 items-center justify-between gap-3 border-b border-hairline/70 px-4 py-2.5", className)}>
      <div className="min-w-0">
        <h2 className="text-[14px] font-semibold leading-snug tracking-[-0.01em] text-ink">{title}</h2>
      </div>
      {action ? <div className="card-action">{action}</div> : null}
    </div>
  );
}

export const CardBody = forwardRef<HTMLDivElement, {
  children: ReactNode;
  className?: string;
}>(({ children, className }, ref) => <div ref={ref} className={cn("p-4", className)}>{children}</div>);
CardBody.displayName = "CardBody";

export function SectionPanel({
  title,
  children,
  action,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader title={title} action={action} />
      <CardBody>{children}</CardBody>
    </Card>
  );
}
