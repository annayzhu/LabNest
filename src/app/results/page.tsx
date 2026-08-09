import Link from "next/link";
import { Download, Plus, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CollectionToolbar, collectionPrimaryActionClass, collectionSecondaryActionClass } from "@/components/CollectionToolbar";
import { PageHeader } from "@/components/PageHeader";
import { BadgeLink, StatusPill } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { filterHref, firstSearchParam, type PageSearchParams } from "@/lib/filters";

export const dynamic = "force-dynamic";

export default async function ResultsPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const params = searchParams ? await searchParams : undefined;
  const query = firstSearchParam(params, "q")?.trim();
  const type = firstSearchParam(params, "type");
  const record = firstSearchParam(params, "record");
  const quality = firstSearchParam(params, "quality");
  const validation = firstSearchParam(params, "validation");
  const sort = firstSearchParam(params, "sort") ?? "updated_desc";
  const orderBy = sort === "title_asc" ? { title: "asc" as const } : { updatedAt: "desc" as const };
  const where = {
    ...(type ? { resultType: type } : {}),
    ...(record ? { recordStatus: record as "draft" | "recorded" | "submitted" | "reviewed" } : {}),
    ...(quality ? { qualityStatus: quality as "not_assessed" | "pass" | "warning" | "fail" } : {}),
    ...(validation ? { validationStatus: validation as "not_applicable" | "incomplete" | "valid" | "warning" | "invalid" } : {}),
    ...(query ? { OR: [
      { title: { contains: query, mode: "insensitive" as const } },
      { resultType: { contains: query, mode: "insensitive" as const } },
      { templateKey: { contains: query, mode: "insensitive" as const } },
      { textValue: { contains: query, mode: "insensitive" as const } },
      { analysisMethod: { contains: query, mode: "insensitive" as const } },
    ] } : {}),
  };
  const [results, totalCount, typeRows] = await Promise.all([
    prisma.result.findMany({ where, include: { experiment: true, researchPlan: true, project: true, _count: { select: { datasets: true } } }, orderBy }),
    prisma.result.count(),
    prisma.result.findMany({ distinct: ["resultType"], select: { resultType: true }, orderBy: { resultType: "asc" } }),
  ]);
  const exportHref = filterHref("/results/export", { exportScope: "filtered", q: query, type, record, quality, validation, sort });
  return <AppShell><div className="space-y-4">
    <PageHeader title="Results" />
    <CollectionToolbar path="/results" query={query} searchPlaceholder="Search results, types, methods…" resultCount={results.length} totalCount={totalCount} sort={sort} defaultSort="updated_desc"
      filters={[
        { name: "type", label: "types", value: type, options: typeRows.map((row) => ({ value: row.resultType, label: row.resultType })) },
        { name: "record", label: "record status", value: record, options: ["draft", "recorded", "submitted", "reviewed"].map((value) => ({ value, label: value })) },
        { name: "quality", label: "QC", value: quality, options: ["not_assessed", "pass", "warning", "fail"].map((value) => ({ value, label: value.replaceAll("_", " ") })) },
        { name: "validation", label: "template validation", value: validation, options: ["not_applicable", "incomplete", "valid", "warning", "invalid"].map((value) => ({ value, label: value.replaceAll("_", " ") })) },
      ]}
      sortOptions={[{ value: "updated_desc", label: "Recently updated" }, { value: "title_asc", label: "Title A–Z" }]}
      actions={<><Link href="/results/import" className={collectionSecondaryActionClass}><Upload className="h-4 w-4" aria-hidden />Import</Link><Link href={exportHref} className={collectionSecondaryActionClass}><Download className="h-4 w-4" aria-hidden />Export…</Link><Link href="/results/new" className={collectionPrimaryActionClass}><Plus className="h-4 w-4" aria-hidden />New Result</Link></>}
    />
    <DataTable rows={results} getRowKey={(row) => row.id} emptyMessage="No Results match this view." selection={{ exportPath: "/results/export" }} columns={[
      { key: "result", header: "Result", render: (row) => <div><Link href={`/results/${row.id}`} className="font-semibold text-ink hover:text-moss">{row.title}</Link><p className="mt-1 text-xs text-muted">{row.project?.name ?? "No project"}{row.templateInstanceKey ? ` · ${row.templateInstanceLabel ?? row.templateInstanceKey}` : ""}</p></div> },
      { key: "type", header: "Type", render: (row) => <BadgeLink href={filterHref("/results", { type: row.resultType })} tone="sage">{row.resultType}</BadgeLink> },
      { key: "experiment", header: "Experiment", render: (row) => row.experiment ? <Link href={`/experiments/${row.experiment.id}`} className="text-moss hover:underline">{row.experiment.runCode ?? row.experiment.title}</Link> : "—" },
      { key: "plan", header: "Research Plan", render: (row) => row.researchPlan ? <Link href={`/research-plans/${row.researchPlan.id}`} className="text-moss hover:underline">{row.researchPlan.code ?? row.researchPlan.title}</Link> : "—" },
      { key: "data", header: "Datasets", render: (row) => row._count.datasets },
      { key: "quality", header: "QC", render: (row) => <StatusPill status={row.qualityStatus} href={filterHref("/results", { quality: row.qualityStatus })} /> },
      { key: "validation", header: "Template", render: (row) => <StatusPill status={row.validationStatus} href={filterHref("/results", { validation: row.validationStatus })} /> },
      { key: "record", header: "Record", render: (row) => <StatusPill status={row.recordStatus} href={filterHref("/results", { record: row.recordStatus })} /> },
    ]} />
  </div></AppShell>;
}
