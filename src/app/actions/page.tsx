import { AppShell } from "@/components/AppShell";
import { ActiveFilterBar, type ActiveFilter } from "@/components/ActiveFilterBar";
import { PageHeader } from "@/components/PageHeader";
import { ProposedActionCard } from "@/components/ProposedActionCard";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { getProposedActionRecords } from "@/lib/live-data";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ActionsPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const proposedActions = await getProposedActionRecords();
  const status = firstSearchParam(params, "status");
  const type = firstSearchParam(params, "type");
  const filteredActions = proposedActions.filter((action) => {
    return (!status || action.status === status) && (!type || action.actionType === type);
  });
  const activeFilters: ActiveFilter[] = [];

  if (status) activeFilters.push({ label: "status", value: status });
  if (type) activeFilters.push({ label: "type", value: type.replaceAll("_", " ") });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Review inbox"
          title="Proposed Actions"
          description="Protocol calculations, imports, manual review, and future AI tasks can propose actions. Nothing mutates core records until the user confirms execution."
          actions={
            <Link
              href="/actions/manual"
              className="focus-ring inline-flex h-10 items-center justify-center rounded-[var(--ln-radius-control-lg)] border border-hairline bg-surface px-4 text-sm font-medium text-moss shadow-paper transition hover:bg-sage-surface"
            >
              Manual AI
            </Link>
          }
        />
        <ActiveFilterBar
          filters={activeFilters}
          clearHref="/actions"
          resultCount={filteredActions.length}
          totalCount={proposedActions.length}
        />
        <section className="grid gap-4">
          {filteredActions.map((action) => (
            <ProposedActionCard key={action.id} action={action} />
          ))}
          {filteredActions.length === 0 ? (
            <div className="rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-6 text-sm text-muted shadow-paper">
              No proposed actions match the current filters.
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
