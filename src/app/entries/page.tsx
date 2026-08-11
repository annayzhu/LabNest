import Link from "next/link";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ActiveFilterBar, type ActiveFilter } from "@/components/ActiveFilterBar";
import { EntryCollectionNav } from "@/components/EntryCollectionNav";
import { EntryCard } from "@/components/EntryCard";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { groupEntriesByMonth, summarizeProjectCollections } from "@/lib/entry-timeline";
import { getEntryRecords } from "@/lib/entries";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";

export const dynamic = "force-dynamic";

export default async function EntriesPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const entries = await getEntryRecords();
  const tag = firstSearchParam(params, "tag");
  const source = firstSearchParam(params, "source");
  const status = firstSearchParam(params, "status");
  const mood = firstSearchParam(params, "mood");
  const project = firstSearchParam(params, "project");
  const projectLabel = project === "unassigned" ? "Unassigned" : entries.find((entry) => entry.projectId === project)?.projectName ?? project;

  const filteredEntries = entries.filter((entry) => {
    return (
      (!tag || entry.tags.includes(tag)) &&
      (!source || entry.sourceType === source) &&
      (!status || (status === "archived" ? Boolean(entry.archivedAt) : !entry.archivedAt && entry.recordStatus === status)) &&
      (!mood || entry.moodStatus === mood) &&
      (!project || (project === "unassigned" ? !entry.projectId : entry.projectId === project))
    );
  });
  const monthGroups = groupEntriesByMonth(filteredEntries);
  const projectCollections = summarizeProjectCollections(entries);
  const unassignedCount = entries.filter((entry) => !entry.projectId).length;
  const attachmentCount = entries.reduce((count, entry) => count + entry.attachmentCount, 0);
  const pendingActionCount = entries.reduce((count, entry) => count + entry.pendingActionCount, 0);
  const activeFilters: ActiveFilter[] = [];

  if (tag) activeFilters.push({ label: "tag", value: tag });
  if (source) activeFilters.push({ label: "source", value: source });
  if (status) activeFilters.push({ label: "status", value: status });
  if (mood) activeFilters.push({ label: "state", value: mood });
  if (project && projectLabel) activeFilters.push({ label: "project", value: projectLabel });

  return (
    <AppShell>
      <div className="mx-auto max-w-[1220px] space-y-7">
        <PageHeader
          eyebrow="Journal-like capture"
          title="Entries"
          description="A chronological lab journal for observations, decisions, deviations, media, and links to formal research records."
          actions={
            <Link
              href="/entries/new"
              className="focus-ring inline-flex h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] border border-moss bg-moss px-4 text-sm font-medium text-warm shadow-paper transition hover:brightness-95"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              New Entry
            </Link>
          }
        />

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)]">
          <EntryCollectionNav
            collections={projectCollections}
            activeProject={project}
            totalCount={entries.length}
            unassignedCount={unassignedCount}
            attachmentCount={attachmentCount}
            pendingActionCount={pendingActionCount}
            preservedFilters={{ tag, source, status, mood }}
          />

          <div className="min-w-0 space-y-7">
            <ActiveFilterBar
              filters={activeFilters}
              clearHref="/entries"
              resultCount={filteredEntries.length}
              totalCount={entries.length}
            />

            {monthGroups.length ? (
              <div className="space-y-9">
                {monthGroups.map((group) => (
                  <section key={group.key} aria-labelledby={`entries-${group.key}`}>
                    <div className="mb-4 flex items-end justify-between gap-4 border-b border-hairline pb-3">
                      <h2 id={`entries-${group.key}`} className="font-serif text-[24px] font-medium text-ink sm:text-[28px]">
                        {group.label}
                      </h2>
                      <span className="font-mono text-xs text-muted">
                        {group.entries.length} {group.entries.length === 1 ? "entry" : "entries"}
                      </span>
                    </div>
                    <div className="space-y-5">
                      {group.entries.map((entry) => (
                        <EntryCard key={entry.id} entry={entry} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No entries in this journal"
                body="Clear the active filters or create a new lab entry for this project."
                actionLabel="New Entry"
                actionHref="/entries/new"
              />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
