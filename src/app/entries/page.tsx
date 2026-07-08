import { AppShell } from "@/components/AppShell";
import { ActiveFilterBar, type ActiveFilter } from "@/components/ActiveFilterBar";
import { EntryCard } from "@/components/EntryCard";
import { PageHeader } from "@/components/PageHeader";
import { RelevantItemsPanel } from "@/components/RelevantItemsPanel";
import { entries, relevantItems } from "@/lib/demo-data";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";

export default async function EntriesPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const tag = firstSearchParam(params, "tag");
  const source = firstSearchParam(params, "source");
  const status = firstSearchParam(params, "status");
  const mood = firstSearchParam(params, "mood");
  const project = firstSearchParam(params, "project");
  const projectLabel = entries.find((entry) => entry.projectId === project)?.projectName ?? project;

  const filteredEntries = entries.filter((entry) => {
    return (
      (!tag || entry.tags.includes(tag)) &&
      (!source || entry.sourceType === source) &&
      (!status || entry.recordStatus === status) &&
      (!mood || entry.moodStatus === mood) &&
      (!project || entry.projectId === project)
    );
  });
  const activeFilters: ActiveFilter[] = [];

  if (tag) activeFilters.push({ label: "tag", value: tag });
  if (source) activeFilters.push({ label: "source", value: source });
  if (status) activeFilters.push({ label: "status", value: status });
  if (mood) activeFilters.push({ label: "state", value: mood });
  if (project && projectLabel) activeFilters.push({ label: "project", value: projectLabel });

  return (
    <AppShell>
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <PageHeader
            eyebrow="Journal-like capture"
            title="Entries"
            description="Fast lab notes that can remain standalone or become experiment drafts, proposed actions, and backlinks after review."
          />
          <ActiveFilterBar
            filters={activeFilters}
            clearHref="/entries"
            resultCount={filteredEntries.length}
            totalCount={entries.length}
          />
          <section className="grid gap-4 md:grid-cols-2">
            {filteredEntries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </section>
        </div>
        <RelevantItemsPanel items={relevantItems} />
      </div>
    </AppShell>
  );
}
