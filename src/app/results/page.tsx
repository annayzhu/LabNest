import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ActiveFilterBar, type ActiveFilter } from "@/components/ActiveFilterBar";
import { PageHeader } from "@/components/PageHeader";
import { BadgeLink, StatusPill } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { filterHref, firstSearchParam, type PageSearchParams } from "@/lib/filters";

export const dynamic = "force-dynamic";
export default async function ResultsPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const type = firstSearchParam(params, "type"); const record = firstSearchParam(params, "record"); const quality = firstSearchParam(params, "quality");
  const results = await prisma.result.findMany({ where: { ...(type ? { resultType: type } : {}), ...(record ? { recordStatus: record as "draft" | "recorded" | "submitted" | "reviewed" } : {}), ...(quality ? { qualityStatus: quality as "not_assessed" | "pass" | "warning" | "fail" } : {}) }, include: { experiment: true, researchPlan: true, project: true, _count: { select: { datasets: true } } }, orderBy: { updatedAt: "desc" } });
  const activeFilters: ActiveFilter[] = [];
  if (type) activeFilters.push({ label: "type", value: type }); if (record) activeFilters.push({ label: "record", value: record }); if (quality) activeFilters.push({ label: "QC", value: quality });
  return <AppShell><div className="space-y-6"><PageHeader eyebrow="Structured evidence" title="Results" description="Each Result keeps its Experiment provenance while allowing narrative, metrics, media, small tables and independently stored large Datasets." actions={<Link href="/results/new" className="focus-ring inline-flex h-10 items-center rounded-[8px] border border-moss bg-moss px-4 text-sm font-medium text-warm">New Result</Link>} />
    <Card><CardHeader title="Result index" eyebrow="Traceable and export-ready" /><CardBody><ActiveFilterBar filters={activeFilters} clearHref="/results" resultCount={results.length} totalCount={results.length} /><DataTable rows={results} getRowKey={(row) => row.id} className="mt-4" columns={[
      { key: "result", header: "Result", render: (row) => <div><Link href={`/results/${row.id}`} className="font-semibold text-ink hover:text-moss">{row.title}</Link><p className="mt-1 text-xs text-muted">{row.project?.name ?? "No project"}</p></div> },
      { key: "type", header: "Type", render: (row) => <BadgeLink href={filterHref("/results", { type: row.resultType })} tone="sage">{row.resultType}</BadgeLink> },
      { key: "experiment", header: "Experiment", render: (row) => row.experiment ? <Link href={`/experiments/${row.experiment.id}`} className="text-moss hover:underline">{row.experiment.runCode ?? row.experiment.title}</Link> : "—" },
      { key: "plan", header: "Research Plan", render: (row) => row.researchPlan ? <Link href={`/research-plans/${row.researchPlan.id}`} className="text-moss hover:underline">{row.researchPlan.code ?? row.researchPlan.title}</Link> : "—" },
      { key: "data", header: "Datasets", render: (row) => row._count.datasets },
      { key: "quality", header: "QC", render: (row) => <StatusPill status={row.qualityStatus} href={filterHref("/results", { quality: row.qualityStatus })} /> },
      { key: "record", header: "Record", render: (row) => <StatusPill status={row.recordStatus} href={filterHref("/results", { record: row.recordStatus })} /> },
    ]} /></CardBody></Card></div></AppShell>;
}
