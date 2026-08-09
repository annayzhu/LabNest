import Link from "next/link";
import { Download, Play, Plus, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CollectionToolbar, collectionPrimaryActionClass, collectionSecondaryActionClass } from "@/components/CollectionToolbar";
import { PageHeader } from "@/components/PageHeader";
import { BadgeLink, StatusPill } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { filterHref, firstSearchParam, type PageSearchParams } from "@/lib/filters";

export const dynamic = "force-dynamic";

export default async function ExperimentsPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const query = firstSearchParam(params, "q")?.trim();
  const status = firstSearchParam(params, "status");
  const projectId = firstSearchParam(params, "project");
  const planId = firstSearchParam(params, "plan");
  const sort = firstSearchParam(params, "sort") ?? "date_desc";
  const orderBy = sort === "updated_desc" ? { updatedAt: "desc" as const }
    : sort === "title_asc" ? { title: "asc" as const }
      : { date: "desc" as const };
  const where = {
    ...(status ? { status: status as "planned" | "running" | "completed" | "failed" | "archived" } : {}),
    ...(projectId ? { projectId } : {}),
    ...(planId ? { researchPlanId: planId } : {}),
    ...(query ? { OR: [
      { runCode: { contains: query, mode: "insensitive" as const } },
      { title: { contains: query, mode: "insensitive" as const } },
      { purpose: { contains: query, mode: "insensitive" as const } },
    ] } : {}),
  };
  const [experiments, totalCount, projects, plans] = await Promise.all([
    prisma.experiment.findMany({ where, include: { project: true, researchPlan: true, primaryProtocolVersion: { include: { protocol: true } } }, orderBy }),
    prisma.experiment.count(),
    prisma.project.findMany({ where: { status: { not: "archived" } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.researchPlan.findMany({ where: projectId ? { projectId } : {}, select: { id: true, code: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  const exportHref = filterHref("/experiments/export", { exportScope: "filtered", q: query, status, project: projectId, plan: planId, sort });

  return (
    <AppShell><div className="space-y-4">
      <PageHeader title="Experiments" />
      <CollectionToolbar
        path="/experiments"
        query={query}
        searchPlaceholder="Search run code, title, purpose…"
        resultCount={experiments.length}
        totalCount={totalCount}
        sort={sort}
        defaultSort="date_desc"
        filters={[
          { name: "project", label: "projects", value: projectId, options: projects.map((project) => ({ value: project.id, label: project.name })) },
          { name: "plan", label: "plans", value: planId, options: plans.map((plan) => ({ value: plan.id, label: plan.code ? `${plan.code} · ${plan.title}` : plan.title })) },
          { name: "status", label: "status", value: status, options: ["planned", "running", "completed", "failed", "archived"].map((value) => ({ value, label: value })) },
        ]}
        sortOptions={[
          { value: "date_desc", label: "Experiment date" },
          { value: "updated_desc", label: "Recently updated" },
          { value: "title_asc", label: "Title A–Z" },
        ]}
        actions={<>
          <Link href="/protocol-run" className={collectionSecondaryActionClass}><Play className="h-4 w-4" aria-hidden />Run mode</Link>
          <Link href="/experiments/import" className={collectionSecondaryActionClass}><Upload className="h-4 w-4" aria-hidden />Import</Link>
          <Link href={exportHref} className={collectionSecondaryActionClass}><Download className="h-4 w-4" aria-hidden />Export…</Link>
          <Link href="/experiments/new" className={collectionPrimaryActionClass}><Plus className="h-4 w-4" aria-hidden />New Experiment</Link>
        </>}
      />
      <DataTable rows={experiments} getRowKey={(row) => row.id} emptyMessage="No Experiments match this view." selection={{ exportPath: "/experiments/export" }} columns={[
        { key: "experiment", header: "Experiment", render: (row) => <Link href={`/experiments/${row.id}`} className="font-semibold text-ink hover:text-moss">{row.runCode ? `${row.runCode} · ` : ""}{row.title}</Link> },
        { key: "project", header: "Project", render: (row) => row.project ? <Link href={`/projects/${row.project.id}`} className="text-moss hover:underline">{row.project.name}</Link> : "—" },
        { key: "plan", header: "Research Plan", render: (row) => row.researchPlan ? <BadgeLink href={filterHref("/experiments", { plan: row.researchPlan.id })}>{row.researchPlan.code ?? row.researchPlan.title}</BadgeLink> : <span className="text-warning">Unassigned</span> },
        { key: "protocol", header: "Primary Protocol", render: (row) => row.primaryProtocolVersion ? `${row.primaryProtocolVersion.protocol.humanCode ?? row.primaryProtocolVersion.protocol.title} · ${row.primaryProtocolVersion.displayVersion}` : "—" },
        { key: "status", header: "Status", render: (row) => <StatusPill status={row.status} href={filterHref("/experiments", { status: row.status })} /> },
        { key: "date", header: "Date", render: (row) => row.date.toLocaleDateString() },
      ]} />
    </div></AppShell>
  );
}
