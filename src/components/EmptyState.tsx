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
    <div className="rounded-[12px] border border-dashed border-border-strong bg-warm p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[12px] bg-sage-surface text-moss">
        <FilePlus2 className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="mt-4 font-serif text-xl font-medium text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-graphite">{body}</p>
      {actionHref ? (
        <Link
          href={actionHref}
          className="focus-ring mt-5 inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-[8px] border border-moss bg-moss px-4 text-sm font-medium text-warm shadow-paper transition hover:brightness-95"
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
