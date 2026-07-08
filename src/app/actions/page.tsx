import { AppShell } from "@/components/AppShell";
import { ActiveFilterBar, type ActiveFilter } from "@/components/ActiveFilterBar";
import { PageHeader } from "@/components/PageHeader";
import { ProposedActionCard } from "@/components/ProposedActionCard";
import { proposedActions } from "@/lib/demo-data";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import Link from "next/link";

export default async function ActionsPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
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
              className="focus-ring inline-flex h-10 items-center justify-center rounded-[8px] border border-hairline bg-surface px-4 text-sm font-medium text-moss shadow-paper transition hover:bg-sage-surface"
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
        </section>
      </div>
    </AppShell>
  );
}
