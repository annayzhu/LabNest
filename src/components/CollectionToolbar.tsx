import type { ReactNode } from "react";
import Link from "next/link";
import Form from "next/form";
import { Filter, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type CollectionFilterOption = { value: string; label: string };
export type CollectionFilter = {
  name: string;
  label: string;
  value?: string;
  options: readonly CollectionFilterOption[];
};

export type CollectionSortOption = { value: string; label: string };

export const collectionPrimaryActionClass =
  "focus-ring inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[7px] border border-moss bg-moss px-3 text-[13px] font-medium text-warm transition hover:brightness-95";
export const collectionSecondaryActionClass =
  "focus-ring inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[7px] border border-hairline bg-surface px-3 text-[13px] font-medium text-moss transition hover:border-border-strong hover:bg-warm";

export function CollectionToolbar({
  path,
  query,
  searchPlaceholder,
  filters = [],
  sort,
  sortOptions = [],
  defaultSort,
  resultCount,
  totalCount,
  actions,
  className,
}: {
  path: string;
  query?: string;
  searchPlaceholder: string;
  filters?: CollectionFilter[];
  sort?: string;
  sortOptions?: CollectionSortOption[];
  defaultSort?: string;
  resultCount: number;
  totalCount: number;
  actions?: ReactNode;
  className?: string;
}) {
  const activeFilters = [
    ...(query ? [{ label: "search", value: query }] : []),
    ...filters.flatMap((filter) => {
      if (!filter.value) return [];
      return [{
        label: filter.label,
        value: filter.options.find((option) => option.value === filter.value)?.label ?? filter.value,
      }];
    }),
  ];
  const hasNonDefaultSort = Boolean(sort && sort !== defaultSort);

  return (
    <section className={cn("border-y border-hairline bg-surface", className)} aria-label="Collection tools">
      <div className="flex flex-col gap-3 px-3 py-3 xl:flex-row xl:items-center xl:justify-between">
        <Form action={path} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <label className="relative min-w-[220px] flex-1 xl:max-w-sm">
            <span className="sr-only">Search</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              name="q"
              defaultValue={query ?? ""}
              placeholder={searchPlaceholder}
              className="focus-ring h-9 w-full rounded-[7px] border border-hairline bg-warm pl-9 pr-3 text-sm text-ink placeholder:text-muted"
            />
          </label>
          {filters.map((filter) => (
            <label key={filter.name}>
              <span className="sr-only">{filter.label}</span>
              <select
                name={filter.name}
                defaultValue={filter.value ?? ""}
                className="focus-ring h-9 max-w-52 rounded-[7px] border border-hairline bg-surface px-2 text-[13px] text-graphite"
              >
                <option value="">{`All ${filter.label}`}</option>
                {filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          ))}
          {sortOptions.length ? (
            <label>
              <span className="sr-only">Sort</span>
              <select
                name="sort"
                defaultValue={sort ?? defaultSort ?? sortOptions[0]?.value}
                className="focus-ring h-9 max-w-52 rounded-[7px] border border-hairline bg-surface px-2 text-[13px] text-graphite"
              >
                {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          ) : null}
          <button className="focus-ring inline-flex h-9 items-center gap-2 rounded-[7px] border border-hairline bg-surface px-3 text-[13px] font-medium text-graphite hover:bg-warm">
            <Filter className="h-3.5 w-3.5" aria-hidden />
            Apply
          </button>
        </Form>

        <div className="flex flex-wrap items-center justify-between gap-3 xl:justify-end">
          <span className="whitespace-nowrap font-mono text-xs text-muted">
            {resultCount === totalCount ? `${totalCount} records` : `${resultCount} of ${totalCount}`}
          </span>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </div>

      {activeFilters.length || hasNonDefaultSort ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-hairline/80 px-3 py-2">
          {activeFilters.map((filter) => (
            <span key={`${filter.label}-${filter.value}`} className="rounded-full bg-sage-surface px-2.5 py-1 text-xs text-moss">
              {filter.label}: {filter.value}
            </span>
          ))}
          {hasNonDefaultSort ? <span className="rounded-full bg-stone px-2.5 py-1 text-xs text-graphite">sorted: {sortOptions.find((option) => option.value === sort)?.label ?? sort}</span> : null}
          <Link href={path} className="focus-ring ml-auto inline-flex h-7 items-center gap-1 rounded-[6px] px-2 text-xs font-medium text-muted hover:bg-warm hover:text-ink">
            <X className="h-3.5 w-3.5" aria-hidden />
            Clear all
          </Link>
        </div>
      ) : null}
    </section>
  );
}
