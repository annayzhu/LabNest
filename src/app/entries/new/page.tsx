import { format } from "date-fns";
import { AppShell } from "@/components/AppShell";
import { EntryComposer } from "@/components/EntryComposer";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { entrySourceTypes } from "@/lib/entry-mutations";

export const dynamic = "force-dynamic";

export default async function NewEntryPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const requestedSource = firstSearchParam(params, "source");
  const protocolVersionId = firstSearchParam(params, "protocolVersionId") ?? "";
  const defaultSource = entrySourceTypes.includes(requestedSource as (typeof entrySourceTypes)[number]) ? requestedSource : "text";
  const [projects, researchPlans, protocols] = await Promise.all([
    prisma.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.researchPlan.findMany({ include: { project: { select: { name: true } } }, orderBy: [{ project: { name: "asc" } }, { title: "asc" }] }),
    prisma.protocol.findMany({ include: { versions: { orderBy: { revision: "desc" } } }, orderBy: { title: "asc" } }),
  ]);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1180px] space-y-6">
        <PageHeader
          eyebrow="New entry"
          title="Add Entry"
          description="Write a structured lab note and keep original photos or files together in one recoverable Journal-style draft."
        />
        <EntryComposer
          projects={projects}
          researchPlans={researchPlans.map((plan) => ({ id: plan.id, title: plan.title, code: plan.code ?? undefined, projectId: plan.projectId, projectName: plan.project.name }))}
          protocols={protocols.flatMap((protocol) => protocol.versions.map((version) => ({ id: version.id, label: `${protocol.humanCode ?? protocol.title} / ${version.displayVersion} / ${version.reviewStage}` })))}
          defaultOccurredAt={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
          defaultSource={defaultSource}
          defaultProtocolVersionId={protocolVersionId}
        />
      </div>
    </AppShell>
  );
}
