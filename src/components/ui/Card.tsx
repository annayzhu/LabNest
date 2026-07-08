import type { ReactNode } from "react";
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
        "rounded-[12px] border border-hairline bg-surface shadow-paper",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  eyebrow,
  action,
  className,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-hairline/80 px-5 py-4", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">{eyebrow}</p> : null}
        <h2 className="mt-1 font-serif text-xl font-medium leading-tight text-ink">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

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
