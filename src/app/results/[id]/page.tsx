import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AttachmentUploadForm } from "@/components/AttachmentUploadForm";
import { AttachmentDeleteButton } from "@/components/AttachmentDeleteButton";
import { DatasetUploadForm } from "@/components/DatasetUploadForm";
import { DatasetDeleteButton } from "@/components/DatasetDeleteButton";
import { PageHeader } from "@/components/PageHeader";
import { ResultTemplateView } from "@/components/ResultTemplateView";
import { RecordLifecycleControl } from "@/components/RecordLifecycleControl";
import { RecycleBinWarning } from "@/components/RecycleBinWarning";
import { ScientificDocumentView } from "@/components/ScientificDocumentView";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { ResizableTableFrame } from "@/components/ui/ResizableTableFrame";
import { prisma } from "@/lib/db";
import { EXPERIMENT_RESULT_REPORT_KEY } from "@/lib/experiment-results";
import { normalizeResultTemplate } from "@/lib/result-templates";
import { normalizeResultDocument } from "@/lib/scientific-document";
import { resultDeleteBlockers } from "@/lib/record-lifecycle";
import { archiveResult, deleteResult, restoreResult } from "../actions";

export const dynamic = "force-dynamic";
const primaryButton = buttonStyles({ variant: "primary", size: "md" });
const secondaryButton = buttonStyles({ size: "md", className: "bg-surface font-medium text-ink hover:bg-warm" });

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
  const document = normalizeResultDocument(result.contentJson);
  const resultNotes = result.notes === "Template registered; no measurement has been entered." ? null : result.notes;
  const hasTemplate = result.templateKey && result.templateSnapshotJson && typeof result.templateSnapshotJson === "object" && !Array.isArray(result.templateSnapshotJson) && Object.keys(result.templateSnapshotJson as object).length;
  const template = hasTemplate ? normalizeResultTemplate(result.templateSnapshotJson) : undefined;
  const isExperimentReport = result.templateKey === EXPERIMENT_RESULT_REPORT_KEY;
  const protocolVersion = result.protocolVersion ?? (isExperimentReport ? undefined : result.experiment?.primaryProtocolVersion);
  const recycleConditions = [
    { targetType: "result", targetId: result.id },
    ...(result.researchPlanId ? [{ targetType: "research_plan", targetId: result.researchPlanId }] : []),
    ...(protocolVersion ? [{ targetType: "protocol", targetId: protocolVersion.protocolId }] : []),
  ];
  const [inboundLinks, recycledRecords] = await Promise.all([
    prisma.itemLink.count({ where: { targetType: "result", targetId: result.id } }),
    prisma.deletedRecord.findMany({ where: { restoredAt: null, OR: recycleConditions }, select: { targetType: true, targetId: true } }),
  ]);
  const recycledKeys = new Set(recycledRecords.map((row) => `${row.targetType}:${row.targetId}`));
  const deletionBlockers = resultDeleteBlockers(result.recordStatus, {
    datasets: result.datasets.length,
    attachments: attachmentLinks.length,
    reportSources: result.reportSources.length,
    inboundLinks,
  });

  return <AppShell><div className="space-y-6">
    <PageHeader eyebrow={isExperimentReport ? undefined : `${result.resultType} · ${result.sourceType.replaceAll("_", " ")}`} title={result.title} description={isExperimentReport ? undefined : result.textValue ?? resultNotes ?? "Structured Result record."} actions={recycledKeys.has(`result:${result.id}`) ? <Link href="/trash" className={primaryButton}>Restore from Recycle Bin</Link> : <>{template && result.experimentId && ["per_sample", "per_timepoint", "repeatable"].includes(template.cardinality ?? "per_run") ? <Link href={`/results/new?experiment=${encodeURIComponent(result.experimentId)}&template=${encodeURIComponent(template.templateKey ?? "")}${result.protocolVersionId ? `&protocolVersionId=${encodeURIComponent(result.protocolVersionId)}` : ""}`} className={secondaryButton}>New template instance</Link> : null}<Link href={`/results/${result.id}/edit`} className={primaryButton}>Edit Result</Link><RecordLifecycleControl id={result.id} identifier={result.title} title={result.resultType} recordLabel="Result" recordLabelZh="结果" blockers={deletionBlockers} archived={result.status === "archived"} deleteAction={deleteResult} archiveAction={archiveResult} restoreAction={restoreResult} allowLinkedRecycle /></>} />
    {recycledKeys.has(`result:${result.id}`) ? <RecycleBinWarning kind="self" label="Result" labelZh="结果" /> : null}
    {result.researchPlanId && recycledKeys.has(`research_plan:${result.researchPlanId}`) ? <RecycleBinWarning label="Research Plan" labelZh="研究方案" /> : null}
    {protocolVersion && recycledKeys.has(`protocol:${protocolVersion.protocolId}`) ? <RecycleBinWarning label="Protocol" labelZh="实验规程" /> : null}

    <div className="document-editor-layout">
      <main className="document-editor-main space-y-6">
        {template ? <ResultTemplateView template={template} values={result.valuesJson} validationStatus={result.validationStatus} validation={result.validationJson} datasets={result.datasets} /> : null}

        {(result.numericValue !== null || result.textValue || resultNotes) ? <div className="grid gap-4 md:grid-cols-3">{result.numericValue !== null ? <Card><CardHeader title="Primary numeric outcome" /><CardBody><p className="font-serif text-3xl text-ink">{result.numericValue} <span className="text-base text-muted">{result.unit}</span></p></CardBody></Card> : null}{result.textValue ? <Card className="md:col-span-2"><CardHeader title="Short summary" /><CardBody><p className="whitespace-pre-wrap text-sm leading-7 text-graphite">{result.textValue}</p></CardBody></Card> : null}{resultNotes ? <Card className="md:col-span-3"><CardHeader title="Notes" /><CardBody><p className="whitespace-pre-wrap text-sm leading-7 text-graphite">{resultNotes}</p></CardBody></Card> : null}</div> : null}

        <ScientificDocumentView document={document} title={result.title} subtitle={isExperimentReport ? result.qualityStatus.replaceAll("_", " ") : `${result.resultType} · ${result.qualityStatus.replaceAll("_", " ")}`} />

        <Card className="scroll-mt-24" ><div id="result-files" className="scroll-mt-24" /><CardHeader title="Data files" eyebrow="Fixed upload fields for original CSV, XLSX or external data" /><CardBody className="space-y-5">{!recycledKeys.has(`result:${result.id}`) ? <DatasetUploadForm resultId={result.id} expectedDatasets={template?.datasets} /> : null}
          {result.datasets.map((dataset) => {
            const columns = Array.isArray(dataset.columnsJson) ? dataset.columnsJson as Array<{ name?: string }> : [];
            const rows = Array.isArray(dataset.previewJson) ? dataset.previewJson as unknown[][] : [];
            const validation = dataset.validationJson && typeof dataset.validationJson === "object" ? dataset.validationJson as { errors?: string[]; warnings?: string[] } : {};
            return <section key={dataset.id} className="border-t border-hairline pt-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-ink">{dataset.name}</h3><StatusPill status={dataset.validationStatus} />{dataset.templateDatasetKey ? <Badge tone="sage">{dataset.templateDatasetKey}</Badge> : null}</div><p className="mt-1 text-xs text-muted">{dataset.rowCount.toLocaleString()} rows · {dataset.columnCount.toLocaleString()} columns · {dataset.storageMode.replaceAll("_", " ")}</p></div><div className="flex items-center gap-2">{dataset.storageMode === "managed_file" ? <Link href={`/api/results/datasets/${dataset.id}`} className="text-sm font-medium text-moss hover:underline">Download original</Link> : <span className="break-all font-mono text-xs text-moss">{dataset.externalUri}</span>}<DatasetDeleteButton datasetId={dataset.id} name={dataset.name} /></div></div>
              {validation.errors?.length || validation.warnings?.length ? <ul className="mt-3 list-disc space-y-1 rounded-[8px] border border-warning/30 bg-warning-surface px-8 py-3 text-xs text-graphite">{[...(validation.errors ?? []), ...(validation.warnings ?? [])].map((message) => <li key={message}>{message}</li>)}</ul> : null}
              {rows.length ? <ResizableTableFrame storageKey={`uploaded-dataset-preview:${dataset.id}`} className="mt-3 max-h-80 overflow-auto rounded-[8px] border border-hairline"><table className="min-w-full table-fixed whitespace-nowrap text-left text-xs"><colgroup>{columns.map((column, index) => <col key={`${dataset.id}-col-${index}`} data-resizable-column-index={index} style={{ width: "var(--ln-document-table-col-width)" }} />)}</colgroup><thead className="sticky top-0 bg-stone text-ink"><tr>{columns.map((column, index) => <th key={`${dataset.id}-h-${index}`} data-resizable-column-cell={index} className="px-[var(--ln-document-table-cell-padding-x)] py-[var(--ln-document-table-cell-padding-y)] pr-4 font-semibold">{column.name ?? `Column ${index + 1}`}<span data-column-resize-handle={index} data-min-width="var(--ln-document-table-min-col-width)" aria-hidden /></th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={`${dataset.id}-r-${rowIndex}`} className="border-t border-hairline text-graphite">{columns.map((_, cellIndex) => <td key={`${dataset.id}-${rowIndex}-${cellIndex}`} className="max-w-52 overflow-hidden text-ellipsis px-[var(--ln-document-table-cell-padding-x)] py-[var(--ln-document-table-cell-padding-y)]">{String(row[cellIndex] ?? "")}</td>)}</tr>)}</tbody></table></ResizableTableFrame> : <p className="mt-3 text-sm text-muted">Preview unavailable; the original data remains external.</p>}
            </section>;
          })}
        </CardBody></Card>
      </main>

      <aside className="document-editor-sidebar" aria-label="Result controls and supporting files">
        <Card><CardHeader title="Evidence control" eyebrow="Provenance and quality" /><CardBody className="space-y-4">
          <div className="flex flex-wrap gap-2"><StatusPill status={result.status} /><StatusPill status={result.recordStatus} /><StatusPill status={result.qualityStatus} /><StatusPill status={result.validationStatus} /></div>
          <div className="grid gap-4 border-t border-hairline pt-4 sm:grid-cols-2">
            <Control label="Experiment">{result.experiment ? <Link href={`/experiments/${result.experiment.id}`} className="text-moss hover:underline">{result.experiment.runCode ?? result.experiment.title}</Link> : "—"}</Control>
            <Control label="Research Plan">{result.researchPlan ? <Link href={`/research-plans/${result.researchPlan.id}`} className="text-moss hover:underline">{result.researchPlan.code ?? result.researchPlan.title}</Link> : "—"}</Control>
            <Control label="Project">{result.project?.name ?? "—"}</Control>
            <Control label="Datasets">{result.datasets.length}</Control>
            <Control label="Attachments">{attachmentLinks.length}</Control>
            <Control label={result.templateInstanceKey ? "Template instance" : "Reports"}>{result.templateInstanceKey ? result.templateInstanceLabel ? `${result.templateInstanceLabel} · ${result.templateInstanceKey}` : result.templateInstanceKey : result.reportSources.length}</Control>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-hairline pt-3"><Badge>{result.sourceType.replaceAll("_", " ")}</Badge>{isExperimentReport ? <Badge tone="sage">experiment report</Badge> : result.templateKey ? <Badge tone="sage">template · {result.templateKey}</Badge> : null}{result.analysisMethod ? <Badge tone="info">{result.analysisMethod}</Badge> : null}{protocolVersion ? <Link href={`/protocols/${protocolVersion.protocolId}?version=${protocolVersion.id}`} className="text-xs font-medium text-moss hover:underline">Protocol source: {protocolVersion.protocol.humanCode ?? protocolVersion.protocol.title} · {protocolVersion.displayVersion}</Link> : null}</div>
        </CardBody></Card>

        <Card><CardHeader title="Attachments" eyebrow="Images, video and supporting files" /><CardBody className="space-y-4">{!recycledKeys.has(`result:${result.id}`) ? <AttachmentUploadForm targetType="result" targetId={result.id} hideTargetFields expectedArtifacts={template?.artifacts} /> : null}{attachmentLinks.length ? <ul className="space-y-2 border-t border-hairline pt-4">{attachmentLinks.map((link) => <li key={link.id} className="flex items-center gap-2"><Link href={`/api/attachments/${link.attachment.id}`} className="min-w-0 flex-1 break-all text-sm font-medium text-moss hover:underline">{link.attachment.originalFilename}</Link>{link.linkType.startsWith("template_artifact:") ? <Badge tone="sage">{link.linkType.slice("template_artifact:".length)}</Badge> : null}<AttachmentDeleteButton attachmentId={link.attachment.id} linkId={link.id} filename={link.attachment.originalFilename} /></li>)}</ul> : <p className="border-t border-hairline pt-4 text-sm text-muted">No supporting files attached.</p>}</CardBody></Card>

        {result.reportSources.length ? <Card><CardHeader title="Used in Reports" eyebrow="Downstream synthesis" /><CardBody><DataTable rows={result.reportSources} getRowKey={(row) => row.id} columns={[{ key: "report", header: "Report", render: (row) => <Link href={`/reports/${row.report.id}`} className="font-medium text-moss hover:underline">{row.report.title}</Link> }, { key: "status", header: "Status", render: (row) => <StatusPill status={row.report.status} /> }]} /></CardBody></Card> : null}
      </aside>
    </div>
  </div></AppShell>;
}

function Control({ label, children }: { label: string; children: React.ReactNode }) { return <div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</p><div className="mt-1 text-sm text-ink">{children}</div></div>; }
