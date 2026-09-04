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
  const captureMode = firstSearchParam(params, "mode") === "capture";
  const experimentId = firstSearchParam(params, "experiment") ?? "";
  const experimentStepId = firstSearchParam(params, "step") ?? "";
  const defaultSource = entrySourceTypes.includes(requestedSource as (typeof entrySourceTypes)[number]) ? requestedSource : "text";
  const [projects, researchPlans, protocols, experiment] = await Promise.all([
    prisma.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.researchPlan.findMany({ include: { project: { select: { name: true } } }, orderBy: [{ project: { name: "asc" } }, { title: "asc" }] }),
    prisma.protocol.findMany({ include: { versions: { orderBy: { revision: "desc" } } }, orderBy: { title: "asc" } }),
    experimentId ? prisma.experiment.findUnique({ where: { id: experimentId }, select: { id: true, title: true, projectId: true, researchPlanId: true, steps: experimentStepId ? { where: { id: experimentStepId }, select: { id: true, title: true, order: true } } : false } }) : null,
  ]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className={captureMode ? "hidden lg:block" : undefined}>
          <PageHeader
            eyebrow="New entry"
            title="Add Entry"
            description="Write a structured lab note and keep original photos or files together in one recoverable Journal-style draft."
          />
        </div>
        <EntryComposer
          projects={projects}
          researchPlans={researchPlans.map((plan) => ({ id: plan.id, title: plan.title, code: plan.code ?? undefined, projectId: plan.projectId, projectName: plan.project.name }))}
          protocols={protocols.flatMap((protocol) => protocol.versions.map((version) => ({ id: version.id, label: `${protocol.canonicalTitle ?? protocol.title}${protocol.humanCode ? ` / ${protocol.humanCode}` : ""} / ${version.displayVersion} / ${version.reviewStage}` })))}
          defaultOccurredAt={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
          defaultSource={defaultSource}
          defaultProtocolVersionId={protocolVersionId}
          defaultExperimentId={experiment?.id ?? ""}
          defaultExperimentStepId={experiment?.steps?.[0]?.id ?? ""}
          defaultExperimentLabel={experiment?.title}
          defaultStepLabel={experiment?.steps?.[0] ? `${experiment.steps[0].order}. ${experiment.steps[0].title}` : undefined}
          mode={captureMode ? "capture" : "document"}
        />
      </div>
    </AppShell>
  );
}
