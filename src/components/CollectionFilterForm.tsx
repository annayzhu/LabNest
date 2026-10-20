"use client";

import Form from "next/form";
import { Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef } from "react";
import type { CollectionFilter, CollectionSortOption } from "@/components/CollectionToolbar";
import { formLabelClass } from "@/components/forms";
import { anchoredPopoverStyle, useAnchoredPopover } from "@/components/ui/useAnchoredPopover";

const selectClass = "focus-ring h-[var(--ln-control-height-md)] rounded-[var(--ln-radius-control-md)] border border-hairline bg-surface px-[var(--ln-control-padding-x-sm)] text-[length:var(--ln-control-font-size-sm)] text-graphite";

/** One row: search applies on Enter, every select applies as soon as it changes, so no Apply button. */
export function CollectionFilterForm({ path, query, searchPlaceholder, filters, sort, sortOptions, defaultSort }: {
  path: string;
  query?: string;
  searchPlaceholder: string;
  filters: CollectionFilter[];
  sort?: string;
  sortOptions: CollectionSortOption[];
  defaultSort?: string;
}) {
  const search = useRef<HTMLLabelElement>(null);
  const { id, button, panel } = useAnchoredPopover();
  const activeCount = filters.filter((filter) => filter.value).length;

  useEffect(() => {
    const form = search.current?.closest("form");
    // Native listener: fires for every committed select change, including programmatic ones React's onChange skips.
    const apply = (event: Event) => { if (event.target instanceof HTMLSelectElement) form?.requestSubmit(); };
    form?.addEventListener("change", apply);
    return () => { form?.removeEventListener("change", apply); };
  }, []);

  return <Form action={path} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
    <label ref={search} className="relative min-w-[200px] flex-1 xl:max-w-sm">
      <span className="sr-only">Search</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      <input type="search" name="q" defaultValue={query ?? ""} placeholder={searchPlaceholder} className="focus-ring h-[var(--ln-control-height-md)] w-full rounded-[var(--ln-radius-control-md)] border border-hairline bg-warm pl-9 pr-[var(--ln-control-padding-x-md)] text-[length:var(--ln-ui-local-search-font-size)] text-ink placeholder:text-muted" />
    </label>
    {filters.length ? <div>
      <button ref={button} type="button" popoverTarget={id} aria-expanded={false} className={`${selectClass} flex cursor-pointer items-center gap-1.5 font-medium ${activeCount ? "border-action-border text-moss" : ""}`}>
        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />Filters{activeCount ? <span className="rounded-full bg-action-surface px-1.5 text-xs leading-5">{activeCount}</span> : null}
      </button>
      <div ref={panel} id={id} popover="auto" style={anchoredPopoverStyle} className="w-64 rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-surface p-3 shadow-soft">
        {filters.map((filter) => <label key={filter.name} className="mb-3 grid gap-1 last:mb-0">
          <span className={`${formLabelClass} first-letter:uppercase`}>{filter.label}</span>
          <select name={filter.name} defaultValue={filter.value ?? ""} className={`${selectClass} w-full`}>
            <option value="">{`All ${filter.label}`}</option>
            {filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>)}
      </div>
    </div> : null}
    {sortOptions.length ? <label>
      <span className="sr-only">Sort</span>
      <select name="sort" defaultValue={sort ?? defaultSort ?? sortOptions[0]?.value} className={`${selectClass} max-w-52`}>
        {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label> : null}
  </Form>;
}
