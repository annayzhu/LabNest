import Link from "next/link";
import { X } from "lucide-react";
import { Badge } from "./ui/Badge";

export type ActiveFilter = {
  label: string;
  value: string;
};

export function ActiveFilterBar({
  filters,
  clearHref,
  resultCount,
  totalCount,
}: {
  filters: ActiveFilter[];
  clearHref: string;
  resultCount: number;
  totalCount: number;
}) {
  if (!filters.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-warm px-3 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Filtered</span>
        {filters.map((filter) => (
          <Badge key={`${filter.label}-${filter.value}`} tone="sage">
            {filter.label}: {filter.value}
          </Badge>
        ))}
        <span className="text-xs text-muted">
          {resultCount} of {totalCount}
        </span>
      </div>
      <Link
        href={clearHref}
        className="focus-ring inline-flex h-8 shrink-0 items-center gap-1 rounded-[var(--ln-radius-control-lg)] border border-hairline bg-surface px-2 text-xs font-medium text-graphite transition hover:border-border-strong hover:bg-sage-surface/60 hover:text-ink"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
        Clear
      </Link>
    </div>
  );
}

