import type { ReactNode } from "react";
import Link from "next/link";
import Form from "next/form";
import { Filter, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { buttonStyles } from "./ui/Button";

export type CollectionFilterOption = { value: string; label: string };
export type CollectionFilter = {
  name: string;
  label: string;
  value?: string;
  options: readonly CollectionFilterOption[];
};

export type CollectionSortOption = { value: string; label: string };

export const collectionPrimaryActionClass =
  buttonStyles({ variant: "primary", size: "md", className: "font-medium" });
export const collectionSecondaryActionClass =
  buttonStyles({ variant: "secondary", size: "md", className: "bg-surface font-medium text-moss" });

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
              type="search"
              name="q"
              defaultValue={query ?? ""}
              placeholder={searchPlaceholder}
              className="focus-ring h-[var(--ln-control-height-md)] w-full rounded-[var(--ln-radius-control-md)] border border-hairline bg-warm pl-9 pr-[var(--ln-control-padding-x-md)] text-[length:var(--ln-ui-local-search-font-size)] text-ink placeholder:text-muted"
            />
          </label>
          {filters.map((filter) => (
            <label key={filter.name}>
              <span className="sr-only">{filter.label}</span>
              <select
                name={filter.name}
                defaultValue={filter.value ?? ""}
                className="focus-ring h-[var(--ln-control-height-md)] max-w-52 rounded-[var(--ln-radius-control-md)] border border-hairline bg-surface px-[var(--ln-control-padding-x-sm)] text-[length:var(--ln-control-font-size-sm)] text-graphite"
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
                className="focus-ring h-[var(--ln-control-height-md)] max-w-52 rounded-[var(--ln-radius-control-md)] border border-hairline bg-surface px-[var(--ln-control-padding-x-sm)] text-[length:var(--ln-control-font-size-sm)] text-graphite"
              >
                {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          ) : null}
          <button className={buttonStyles({ size: "md", className: "bg-surface font-medium text-graphite hover:bg-warm" })}>
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
          <Link href={path} className="focus-ring ml-auto inline-flex h-7 items-center gap-1 rounded-[var(--ln-radius-control-sm)] px-2 text-xs font-medium text-muted hover:bg-warm hover:text-ink">
            <X className="h-3.5 w-3.5" aria-hidden />
            Clear all
          </Link>
        </div>
      ) : null}
    </section>
  );
}
