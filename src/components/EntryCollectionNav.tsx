import { BookOpenText, FolderClosed, Link2, ListChecks, Paperclip } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { filterHref } from "@/lib/filters";
import type { EntryProjectCollection } from "@/lib/entry-timeline";

type PreservedFilters = {
  tag?: string;
  source?: string;
  status?: string;
  mood?: string;
};

export function EntryCollectionNav({
  collections,
  activeProject,
  totalCount,
  unassignedCount,
  attachmentCount,
  pendingActionCount,
  preservedFilters,
}: {
  collections: EntryProjectCollection[];
  activeProject?: string;
  totalCount: number;
  unassignedCount: number;
  attachmentCount: number;
  pendingActionCount: number;
  preservedFilters: PreservedFilters;
}) {
  const itemClass = (active: boolean) =>
    cn(
      "focus-ring flex shrink-0 items-center gap-2 rounded-[var(--ln-radius-panel-inner)] px-3 py-2 text-[13px] transition lg:w-full",
      active ? "bg-action-surface/55 font-medium text-moss" : "bg-transparent text-muted hover:bg-stone/75 hover:text-ink",
    );
  const collectionHref = (project?: string) => filterHref("/entries", { ...preservedFilters, project });

  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <section className="rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-4">
        <div className="flex items-center gap-2 text-moss">
          <BookOpenText className="h-4 w-4" aria-hidden />
          <p className="text-[13px] font-semibold tracking-[-0.01em] text-ink">Project journals</p>
        </div>
        <nav aria-label="Entry project collections" className="editorial-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          <Link href={collectionHref()} className={itemClass(!activeProject)}>
            <BookOpenText className="h-4 w-4 shrink-0" aria-hidden />
            <span className="whitespace-nowrap">All entries</span>
            <span className="ml-auto font-mono text-[11px] text-muted">{totalCount}</span>
          </Link>
          {collections.map((collection) => (
            <Link key={collection.id} href={collectionHref(collection.id)} className={itemClass(activeProject === collection.id)}>
              <FolderClosed className="h-4 w-4 shrink-0" aria-hidden />
              <span className="max-w-44 truncate whitespace-nowrap">{collection.name}</span>
              <span className="ml-auto font-mono text-[11px] text-muted">{collection.count}</span>
            </Link>
          ))}
          {unassignedCount ? (
            <Link href={collectionHref("unassigned")} className={itemClass(activeProject === "unassigned")}>
              <Link2 className="h-4 w-4 shrink-0" aria-hidden />
              <span className="whitespace-nowrap">Unassigned</span>
              <span className="ml-auto font-mono text-[11px] text-muted">{unassignedCount}</span>
            </Link>
          ) : null}
        </nav>

        <div className="mt-4 hidden grid-cols-3 gap-2 border-t border-hairline pt-4 lg:grid">
          <div>
            <Paperclip className="h-3.5 w-3.5 text-moss" aria-hidden />
            <span className="mt-1 block font-mono text-sm text-ink">{attachmentCount}</span>
            <span className="text-[11px] text-muted">files</span>
          </div>
          <div>
            <FolderClosed className="h-3.5 w-3.5 text-moss" aria-hidden />
            <span className="mt-1 block font-mono text-sm text-ink">{collections.length}</span>
            <span className="text-[11px] text-muted">projects</span>
          </div>
          <div>
            <ListChecks className="h-3.5 w-3.5 text-moss" aria-hidden />
            <span className="mt-1 block font-mono text-sm text-ink">{pendingActionCount}</span>
            <span className="text-[11px] text-muted">pending</span>
          </div>
        </div>
      </section>
    </aside>
  );
}
