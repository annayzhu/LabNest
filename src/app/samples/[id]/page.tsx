import Link from "next/link";
import { notFound } from "next/navigation";
import { GitBranchPlus, Pencil } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { SamplePlace, SampleQuantity, SampleStatusBadge } from "@/components/SampleBits";
import { SampleDeleteButton } from "@/components/SampleDeleteButton";
import { SampleNav } from "@/components/SampleNav";
import { buttonStyles } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { prisma } from "@/lib/db";
import { ancestorsOf, sampleDeleteBlockers, sampleTypeRef } from "@/lib/samples";
import { sampleLocationOptions, sampleReferenceCounts } from "@/lib/samples.server";

export const dynamic = "force-dynamic";
const secondary = buttonStyles({ size: "md", className: "bg-surface font-medium text-moss hover:bg-warm" });

const historyLabels: Record<string, string> = {
  create_batch: "Created", update: "Edited", use: "Amount taken", aliquot: "Aliquoted", set_grid: "Box size set", delete: "Deleted",
};
const changedLabels: Record<string, string> = {
  code: "Code", name: "Name", typeId: "Type", origin: "Origin", parentId: "Parent sample", projectId: "Project", locationId: "Box", position: "Position",
  amount: "Amount", amountUnit: "Amount unit", concentration: "Concentration", concentrationUnit: "Concentration unit", status: "Status",
  biosafetyLevel: "Biosafety level", collectedAt: "Date", notes: "Notes", fieldValues: "Fields",
};

export default async function SamplePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sample = await prisma.sample.findUnique({
    where: { id },
    include: {
      type: true,
      project: { select: { id: true, name: true } },
      children: { select: { id: true, code: true, name: true, status: true, type: { select: { label: true } } }, orderBy: { code: "asc" } },
      experiments: { include: { experiment: { select: { id: true, runCode: true, title: true } }, group: { select: { label: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!sample) notFound();
  const [lineage, locations, counts, logs] = await Promise.all([
    prisma.sample.findMany({ select: { id: true, parentId: true, code: true, name: true } }),
    sampleLocationOptions(prisma),
    sampleReferenceCounts(prisma, [id]),
    prisma.activityLog.findMany({ where: { OR: [{ targetType: "sample", targetId: id }, ...(sample.batchId ? [{ targetType: "sample_batch", targetId: sample.batchId }] : [])] }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const byId = new Map(lineage.map((row) => [row.id, row]));
  const ancestors = ancestorsOf(byId.get(id)!, byId).reverse();
  const location = sample.locationId ? locations.find((option) => option.id === sample.locationId) : undefined;
  const type = sampleTypeRef(sample.type);
  const fieldValues = (sample.fieldValues && typeof sample.fieldValues === "object" ? sample.fieldValues : {}) as Record<string, string>;
  const produced = sample.experiments.filter((link) => link.role === "output");
  const used = sample.experiments.filter((link) => link.role === "input");

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader identifier={sample.code} title={sample.name} actions={<>
          <Link href={`/samples/${id}/edit`} className={secondary}><Pencil className="h-4 w-4" aria-hidden />Edit</Link>
          <Link href={`/samples/new?aliquot=${id}`} className={secondary}><GitBranchPlus className="h-4 w-4" aria-hidden />Aliquot…</Link>
          <SampleDeleteButton id={id} code={sample.code} blockers={sampleDeleteBlockers(counts.get(id)!)} />
        </>} />
        <SampleNav current="samples" />

        <section className="grid gap-px overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-hairline sm:grid-cols-2 xl:grid-cols-4">
          <Fact label="Type">{sample.type.label}</Fact>
          <Fact label="Status"><SampleStatusBadge status={sample.status} /></Fact>
          <Fact label="Place">{location ? <Link href={`/samples/boxes?location=${location.id}`} className="hover:text-moss"><SamplePlace location={location.label} position={sample.position} /></Link> : <SamplePlace location={null} position={null} />}</Fact>
          <Fact label="Origin">{sample.origin ?? <span className="text-muted">—</span>}</Fact>
          <Fact label="Amount"><SampleQuantity value={sample.amount} unit={sample.amountUnit} /></Fact>
          <Fact label="Concentration"><SampleQuantity value={sample.concentration} unit={sample.concentrationUnit} /></Fact>
          <Fact label="Date">{sample.collectedAt ? sample.collectedAt.toISOString().slice(0, 10) : <span className="text-muted">—</span>}</Fact>
          <Fact label="Project">{sample.project ? <Link href={`/projects/${sample.project.id}`} className="text-moss hover:underline">{sample.project.name}</Link> : <span className="text-muted">—</span>}</Fact>
          {sample.biosafetyLevel ? <Fact label="Biosafety level">{sample.biosafetyLevel}</Fact> : null}
          {type.fields.filter((field) => fieldValues[field.key]).map((field) => <Fact key={field.key} label={field.label}>{fieldValues[field.key]}</Fact>)}
          {sample.externalSource ? <Fact label="External sample bank"><span className="record-identifier">{sample.externalSource} · {sample.externalId}</span></Fact> : null}
        </section>
        {sample.notes ? <p className="whitespace-pre-wrap rounded-[var(--ln-radius-panel)] border border-hairline bg-surface px-4 py-3 text-sm leading-6 text-graphite">{sample.notes}</p> : null}

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader title="Lineage" />
            <CardBody className="space-y-3 text-sm">
              <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {ancestors.map((ancestor) => <li key={ancestor.id} className="flex items-center gap-2"><Link href={`/samples/${ancestor.id}`} className="text-moss hover:underline"><span className="record-identifier">{ancestor.code}</span> <span className="text-muted">{ancestor.name}</span></Link><span aria-hidden className="text-muted">→</span></li>)}
                <li className="font-medium text-ink"><span className="record-identifier">{sample.code}</span> {sample.name}</li>
              </ol>
              {sample.children.length ? (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted">Derived samples</p>
                  <ul className="divide-y divide-hairline">
                    {sample.children.map((child) => <li key={child.id} className="flex flex-wrap items-center gap-2 py-1.5"><Link href={`/samples/${child.id}`} className="text-moss hover:underline"><span className="record-identifier">{child.code}</span> {child.name}</Link><span className="text-xs text-muted">{child.type.label}</span><span className="ml-auto"><SampleStatusBadge status={child.status} /></span></li>)}
                  </ul>
                </div>
              ) : <p className="text-xs text-muted">No samples derived from this one yet.</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Experiments" />
            <CardBody className="space-y-3 text-sm">
              {produced.map((link) => <p key={link.id}><span className="text-muted">Produced by</span> <Link href={`/experiments/${link.experiment.id}`} className="text-moss hover:underline"><span className="record-identifier">{link.experiment.runCode}</span> {link.experiment.title}</Link></p>)}
              {used.length ? (
                <ul className="divide-y divide-hairline">
                  {used.map((link) => <li key={link.id} className="flex flex-wrap items-center gap-2 py-1.5">
                    <Link href={`/experiments/${link.experiment.id}`} className="text-moss hover:underline"><span className="record-identifier">{link.experiment.runCode}</span> {link.experiment.title}</Link>
                    {link.group ? <span className="text-xs text-muted">{link.group.label}</span> : null}
                    {link.usedAmount !== null ? <span className="ml-auto text-xs text-graphite"><span>Took</span> <SampleQuantity value={link.usedAmount} unit={link.usedUnit} /></span> : null}
                  </li>)}
                </ul>
              ) : !produced.length ? <p className="text-xs text-muted">Not in any experiment yet.</p> : null}
            </CardBody>
          </Card>
        </div>

        {logs.length ? (
          <Card>
            <CardHeader title="History" />
            <CardBody>
              <ul className="divide-y divide-hairline">
                {logs.map((log) => {
                  const meta = (log.metadataJson ?? {}) as { previous?: Record<string, unknown>; next?: Record<string, unknown>; used?: string | null; experimentId?: string; amountBefore?: number | null; amountAfter?: number | null };
                  const changed = Object.keys(meta.next ?? meta.previous ?? {}).filter((key) => changedLabels[key]);
                  return <li key={log.id} className="space-y-0.5 py-2 text-sm">
                    <span className="font-medium text-ink">{historyLabels[log.action] ?? log.action.replaceAll("_", " ")}</span>
                    {changed.length ? <span className="ml-1.5 text-xs text-muted">{changed.map((key) => changedLabels[key]).join(" · ")}</span> : null}
                    {log.action === "use" ? <span className="ml-1.5 font-mono text-xs text-muted">{meta.used ?? "—"} · {meta.amountBefore ?? "—"} → {meta.amountAfter ?? "—"} {sample.amountUnit}</span> : null}
                    <time className="block text-xs text-muted" dateTime={log.createdAt.toISOString()}>{log.createdAt.toLocaleString()}</time>
                  </li>;
                })}
              </ul>
            </CardBody>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0 bg-surface px-4 py-3"><p className="text-xs font-medium text-muted">{label}</p><div className="mt-1 min-w-0 break-words text-sm font-medium text-ink">{children}</div></div>;
}
