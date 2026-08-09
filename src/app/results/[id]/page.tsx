import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AttachmentUploadForm } from "@/components/AttachmentUploadForm";
import { DatasetUploadForm } from "@/components/DatasetUploadForm";
import { PageHeader } from "@/components/PageHeader";
import { ResultTemplateView } from "@/components/ResultTemplateView";
import { ScientificDocumentView } from "@/components/ScientificDocumentView";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { prisma } from "@/lib/db";
import { normalizeResultTemplate } from "@/lib/result-templates";
import { normalizeScientificDocument, resultSections } from "@/lib/scientific-document";

export const dynamic = "force-dynamic";
const primaryButton = "focus-ring inline-flex h-10 items-center justify-center rounded-[8px] border border-moss bg-moss px-4 text-sm font-medium text-warm";
const secondaryButton = "focus-ring inline-flex h-10 items-center justify-center rounded-[8px] border border-hairline bg-surface px-4 text-sm font-medium text-ink";

export default async function ResultDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [result, attachmentLinks] = await Promise.all([
    prisma.result.findUnique({
      where: { id },
      include: {
        project: true,
        researchPlan: true,
        protocolVersion: { include: { protocol: true } },
        experiment: { include: { primaryProtocolVersion: { include: { protocol: true } } } },
        entity: true,
        datasets: { orderBy: { createdAt: "desc" } },
        reportSources: { include: { report: true } },
      },
    }),
    prisma.attachmentLink.findMany({ where: { targetType: "result", targetId: id }, include: { attachment: true }, orderBy: [{ order: "asc" }, { createdAt: "desc" }] }),
  ]);
  if (!result) notFound();
  const document = normalizeScientificDocument(result.contentJson, resultSections);
  const hasTemplate = result.templateKey && result.templateSnapshotJson && typeof result.templateSnapshotJson === "object" && !Array.isArray(result.templateSnapshotJson) && Object.keys(result.templateSnapshotJson as object).length;
  const template = hasTemplate ? normalizeResultTemplate(result.templateSnapshotJson) : undefined;
  const protocolVersion = result.protocolVersion ?? result.experiment?.primaryProtocolVersion;

  return <AppShell><div className="space-y-6">
    <PageHeader eyebrow={`${result.resultType} · ${result.sourceType.replaceAll("_", " ")}`} title={result.title} description={result.textValue ?? result.notes ?? "Structured Result record."} actions={<>{template && result.experimentId && ["per_sample", "per_timepoint", "repeatable"].includes(template.cardinality ?? "per_run") ? <Link href={`/results/new?experiment=${encodeURIComponent(result.experimentId)}&template=${encodeURIComponent(template.templateKey ?? "")}`} className={secondaryButton}>New template instance</Link> : null}<Link href={`/results/${result.id}/edit`} className={primaryButton}>Edit Result</Link></>} />

    <Card><CardHeader title="Evidence control" eyebrow="Provenance and quality" action={<div className="flex flex-wrap gap-2"><StatusPill status={result.recordStatus} /><StatusPill status={result.qualityStatus} /><StatusPill status={result.validationStatus} /></div>} /><CardBody className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <Control label="Experiment">{result.experiment ? <Link href={`/experiments/${result.experiment.id}`} className="text-moss hover:underline">{result.experiment.runCode ?? result.experiment.title}</Link> : "—"}</Control>
      <Control label="Research Plan">{result.researchPlan ? <Link href={`/research-plans/${result.researchPlan.id}`} className="text-moss hover:underline">{result.researchPlan.code ?? result.researchPlan.title}</Link> : "—"}</Control>
      <Control label="Project">{result.project?.name ?? "—"}</Control>
      <Control label="Datasets">{result.datasets.length}</Control>
      <Control label="Attachments">{attachmentLinks.length}</Control>
      <Control label={result.templateInstanceKey ? "Template instance" : "Reports"}>{result.templateInstanceKey ? result.templateInstanceLabel ? `${result.templateInstanceLabel} · ${result.templateInstanceKey}` : result.templateInstanceKey : result.reportSources.length}</Control>
      <div className="sm:col-span-2 xl:col-span-6 flex flex-wrap gap-2 border-t border-hairline pt-3"><Badge>{result.sourceType.replaceAll("_", " ")}</Badge>{result.templateKey ? <Badge tone="sage">template · {result.templateKey}</Badge> : null}{result.analysisMethod ? <Badge tone="info">{result.analysisMethod}</Badge> : null}{protocolVersion ? <Link href={`/protocols/${protocolVersion.protocolId}?version=${protocolVersion.id}`} className="text-xs font-medium text-moss hover:underline">Protocol source: {protocolVersion.protocol.humanCode ?? protocolVersion.protocol.title} · {protocolVersion.displayVersion}</Link> : null}</div>
    </CardBody></Card>

    {template ? <ResultTemplateView template={template} values={result.valuesJson} validationStatus={result.validationStatus} validation={result.validationJson} datasets={result.datasets} attachments={attachmentLinks} /> : null}

    {(result.numericValue !== null || result.textValue || result.notes) ? <div className="grid gap-4 md:grid-cols-3">{result.numericValue !== null ? <Card><CardHeader title="Key summary" /><CardBody><p className="font-serif text-3xl text-ink">{result.numericValue} <span className="text-base text-muted">{result.unit}</span></p></CardBody></Card> : null}{result.textValue ? <Card className="md:col-span-2"><CardHeader title="Short summary" /><CardBody><p className="whitespace-pre-wrap text-sm leading-7 text-graphite">{result.textValue}</p></CardBody></Card> : null}{result.notes ? <Card className="md:col-span-3"><CardHeader title="Notes" /><CardBody><p className="whitespace-pre-wrap text-sm leading-7 text-graphite">{result.notes}</p></CardBody></Card> : null}</div> : null}

    <ScientificDocumentView document={document} />

    <Card><CardHeader title="Datasets" eyebrow="Original file or external location + bounded browser preview" /><CardBody className="space-y-5"><DatasetUploadForm resultId={result.id} expectedDatasets={template?.datasets} />
      {result.datasets.map((dataset) => {
        const columns = Array.isArray(dataset.columnsJson) ? dataset.columnsJson as Array<{ name?: string }> : [];
        const rows = Array.isArray(dataset.previewJson) ? dataset.previewJson as unknown[][] : [];
        const validation = dataset.validationJson && typeof dataset.validationJson === "object" ? dataset.validationJson as { errors?: string[]; warnings?: string[] } : {};
        return <section key={dataset.id} className="border-t border-hairline pt-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-ink">{dataset.name}</h3><StatusPill status={dataset.validationStatus} />{dataset.templateDatasetKey ? <Badge tone="sage">{dataset.templateDatasetKey}</Badge> : null}</div><p className="mt-1 text-xs text-muted">{dataset.rowCount.toLocaleString()} rows · {dataset.columnCount.toLocaleString()} columns · {dataset.storageMode.replaceAll("_", " ")}</p></div>{dataset.storageMode === "managed_file" ? <Link href={`/api/results/datasets/${dataset.id}`} className="text-sm font-medium text-moss hover:underline">Download original</Link> : <span className="break-all font-mono text-xs text-moss">{dataset.externalUri}</span>}</div>
          {validation.errors?.length || validation.warnings?.length ? <ul className="mt-3 list-disc space-y-1 rounded-[8px] border border-warning/30 bg-warning-surface px-8 py-3 text-xs text-graphite">{[...(validation.errors ?? []), ...(validation.warnings ?? [])].map((message) => <li key={message}>{message}</li>)}</ul> : null}
          {rows.length ? <div className="mt-3 max-h-80 overflow-auto rounded-[8px] border border-hairline"><table className="min-w-full whitespace-nowrap text-left text-xs"><thead className="sticky top-0 bg-stone text-ink"><tr>{columns.map((column, index) => <th key={`${dataset.id}-h-${index}`} className="px-3 py-2 font-semibold">{column.name ?? `Column ${index + 1}`}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={`${dataset.id}-r-${rowIndex}`} className="border-t border-hairline text-graphite">{row.map((cell, cellIndex) => <td key={`${dataset.id}-${rowIndex}-${cellIndex}`} className="max-w-64 overflow-hidden text-ellipsis px-3 py-2">{String(cell ?? "")}</td>)}</tr>)}</tbody></table></div> : <p className="mt-3 text-sm text-muted">Preview unavailable; the original data remains external.</p>}
        </section>;
      })}
    </CardBody></Card>

    <Card><CardHeader title="Attachments" eyebrow="Images, video and supporting files" /><CardBody className="space-y-4"><AttachmentUploadForm targetType="result" targetId={result.id} hideTargetFields expectedArtifacts={template?.artifacts} />{attachmentLinks.length ? <ul className="space-y-2 border-t border-hairline pt-4">{attachmentLinks.map((link) => <li key={link.id} className="flex flex-wrap items-center gap-2"><Link href={`/api/attachments/${link.attachment.id}`} className="text-sm font-medium text-moss hover:underline">{link.attachment.originalFilename}</Link>{link.linkType.startsWith("template_artifact:") ? <Badge tone="sage">{link.linkType.slice("template_artifact:".length)}</Badge> : null}</li>)}</ul> : null}</CardBody></Card>

    {result.reportSources.length ? <Card><CardHeader title="Used in Reports" eyebrow="Downstream synthesis" /><CardBody><DataTable rows={result.reportSources} getRowKey={(row) => row.id} columns={[{ key: "report", header: "Report", render: (row) => <Link href={`/reports/${row.report.id}`} className="font-medium text-moss hover:underline">{row.report.title}</Link> }, { key: "status", header: "Status", render: (row) => <StatusPill status={row.report.status} /> }]} /></CardBody></Card> : null}
  </div></AppShell>;
}

function Control({ label, children }: { label: string; children: React.ReactNode }) { return <div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</p><div className="mt-1 text-sm text-ink">{children}</div></div>; }
