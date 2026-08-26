import { FilePlus2 } from "lucide-react";
import Link from "next/link";
import { Button } from "./ui/Button";

export function EmptyState({
  title,
  body,
  actionLabel,
  actionHref,
}: {
  title: string;
  body: string;
  actionLabel: string;
  actionHref?: string;
}) {
  return (
    <div className="rounded-[var(--ln-radius-panel)] border border-dashed border-border-strong bg-surface p-7 text-center sm:p-9">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-[var(--ln-radius-panel-inner)] bg-action-surface text-moss">
        <FilePlus2 className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="mt-4 text-[17px] font-semibold tracking-[-0.015em] text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-graphite">{body}</p>
      {actionHref ? (
        <Link
          href={actionHref}
          className="focus-ring mt-5 inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-[var(--ln-radius-control-md)] border border-action bg-action px-3.5 text-[13px] font-medium text-white transition hover:border-action-hover hover:bg-action-hover active:translate-y-px"
        >
          {actionLabel}
        </Link>
      ) : (
        <Button className="mt-5" type="button" variant="primary">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
