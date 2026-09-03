import Link from "next/link";
import { notFound } from "next/navigation";
import { PencilLine } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AttachmentUploadForm } from "@/components/AttachmentUploadForm";
import { AttachmentDeleteButton } from "@/components/AttachmentDeleteButton";
import { PageHeader } from "@/components/PageHeader";
import { DocumentPrintButton } from "@/components/DocumentPrintButton";
import { ProtocolDocumentView } from "@/components/ProtocolDocumentView";
import { ProtocolExportMenu } from "@/components/ProtocolExportMenu";
import { RecordLifecycleControl } from "@/components/RecordLifecycleControl";
import { RecycleBinWarning } from "@/components/RecycleBinWarning";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { prisma } from "@/lib/db";
import { firstSearchParam, type PageSearchParams } from "@/lib/filters";
import { normalizeProtocolDocument, protocolDocumentFromLegacy } from "@/lib/protocol-document";
import { protocolDeleteBlockers } from "@/lib/record-lifecycle";
import type { ConsumptionRule, ProtocolMaterial, ProtocolStep, ResultTemplate } from "@/lib/types";
import { archiveProtocol, deleteProtocol } from "../actions";

export const dynamic = "force-dynamic";

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

const primaryButton = buttonStyles({ variant: "primary", size: "md", className: "protocol-density-primary-action" });
const secondaryButton = buttonStyles({ size: "md", className: "bg-surface font-medium text-moss hover:bg-warm" });

export default async function ProtocolDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: PageSearchParams;
}) {
  const { id } = await params;
  const query = searchParams ? await searchParams : undefined;
  const selectedVersionId = firstSearchParam(query, "version");
  const protocol = await prisma.protocol.findUnique({
    where: { id },
    include: {
      project: true,
      projectAssociations: true,
      researchPlans: { include: { researchPlan: { include: { project: true } } } },
      versions: {
        orderBy: { revision: "desc" },
        include: {
          derivedFromVersion: { include: { protocol: true } },
          previousVersion: true,
          _count: { select: { primaryExperiments: true, experimentLinks: true, protocolRuns: true, results: true } },
        },
      },
    },
  });
  if (!protocol) notFound();
  const version = protocol.versions.find((item) => item.id === selectedVersionId) ?? protocol.versions[0];
  if (!version) notFound();
  const versionIds = protocol.versions.map((item) => item.id);
  const [derivedVersions, reportSourceReferences, recycleEntry] = await Promise.all([
    prisma.protocolVersion.count({ where: { protocolId: { not: protocol.id }, derivedFromVersion: { protocolId: protocol.id } } }),
    prisma.reportSource.count({ where: { OR: [{ sourceType: "protocol", sourceId: protocol.id }, { sourceType: "protocol_version", sourceId: { in: versionIds } }] } }),
    prisma.deletedRecord.findFirst({ where: { targetType: "protocol", targetId: protocol.id, restoredAt: null }, select: { id: true } }),
  ]);
  const deletionBlockers = protocolDeleteBlockers(protocol.availability, protocol.recordStatus, {
    projects: protocol.projectAssociations.length,
    researchPlans: protocol.researchPlans.length,
    experiments: protocol.versions.reduce((count, item) => count + item._count.experimentLinks, 0),
    results: protocol.versions.reduce((count, item) => count + item._count.results, 0),
    nonDraftVersions: protocol.versions.filter((item) => item.recordStatus !== "draft" || item.reviewStage !== "draft").length,
    derivedVersions,
    reportSourceReferences,
  });

  const document = normalizeProtocolDocument(version.contentJson) ?? protocolDocumentFromLegacy({
    description: protocol.description,
    purpose: version.purpose,
    background: version.background,
    materials: asArray<ProtocolMaterial>(version.materialsJson),
    equipment: asArray<ProtocolMaterial>(version.equipmentJson),
    steps: asArray<ProtocolStep>(version.stepsJson),
    resultTemplates: asArray<ResultTemplate>(version.resultTemplatesJson),
    consumptionRules: asArray<ConsumptionRule>(version.consumptionRulesJson),
  });
  const [attachmentLinks, activityLogs] = await Promise.all([
    prisma.attachmentLink.findMany({
      where: { targetType: "protocol_version", targetId: version.id },
      include: { attachment: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.activityLog.findMany({
      where: { targetType: "protocol", targetId: protocol.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);
  const editHref = `/protocols/${protocol.id}/versions/${version.id}/edit`;

  return (
    <AppShell>
      <div className="protocol-density-slice" data-density-slice="protocol">
        <PageHeader
          identifier={`${protocol.humanCode ?? "Uncoded"} · v${version.displayVersion}`}
          title={protocol.canonicalTitle ?? protocol.title}
          description={protocol.englishTitle ?? protocol.description ?? undefined}
          actions={<><DocumentPrintButton />{
            recycleEntry ? <Link href="/trash" className={primaryButton}>Restore from Recycle Bin</Link> : <>
              <Link href={editHref} className={primaryButton}><PencilLine className="h-4 w-4" aria-hidden />Edit Protocol</Link>
              {protocol.researchPlans.length ? <Link href={`/experiments/new?protocolVersionId=${version.id}`} className={secondaryButton}>Use in experiment</Link> : <Link href={editHref} className={secondaryButton}>Link Research Plan</Link>}
              {protocol.scope === "general" ? <Link href={`/protocols/${protocol.id}/adapt?version=${version.id}`} className={secondaryButton}>Adapt to project</Link> : null}
              <ProtocolExportMenu docxHref={`/api/protocols/${protocol.id}/versions/${version.id}/docx`} jsonHref={`/api/protocols/${protocol.id}/versions/${version.id}/json`} />
              <RecordLifecycleControl id={protocol.id} identifier={protocol.humanCode} title={protocol.canonicalTitle ?? protocol.title} recordLabel="Protocol" recordLabelZh="实验规程" blockers={deletionBlockers} archived={protocol.availability === "archived"} deleteAction={deleteProtocol} archiveAction={archiveProtocol} editHref={editHref} allowLinkedRecycle triggerSize="md" />
            </>
          }</>}
        />

        {recycleEntry ? <RecycleBinWarning kind="self" label="Protocol" labelZh="实验规程" /> : null}

        <div className="document-preview-layout">
          <main className="document-preview-main">
            <ProtocolDocumentView document={document} title={protocol.canonicalTitle ?? protocol.title} identifier={protocol.humanCode} version={version.displayVersion} />
          </main>

          <aside className="document-preview-sidebar" aria-label="Protocol controls and history">
            <Card>
              <CardHeader title="Protocol control" eyebrow="Identity and provenance" />
              <CardBody className="grid gap-4 sm:grid-cols-2">
                <Control label="Availability"><StatusPill status={protocol.availability} /></Control>
                <Control label="Review stage"><StatusPill status={version.reviewStage} /></Control>
                <Control label="Scope"><Badge tone={protocol.scope === "general" ? "info" : "sage"}>{protocol.scope}</Badge></Control>
                <Control label="Source"><Badge>{version.sourceType.replaceAll("_", " ")}</Badge></Control>
                <Control label="Usage">{version._count.primaryExperiments} primary runs</Control>
                <Control label="Updated">{protocol.updatedAt.toLocaleDateString()}</Control>
                <div className="sm:col-span-2 flex flex-wrap gap-2 border-t border-hairline pt-3">
                  {protocol.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
                  {version.derivedFromVersion ? <Link href={`/protocols/${version.derivedFromVersion.protocol.id}?version=${version.derivedFromVersion.id}`} className="text-xs font-medium text-moss hover:underline">Derived from {version.derivedFromVersion.protocol.canonicalTitle ?? version.derivedFromVersion.protocol.title} · {version.derivedFromVersion.protocol.humanCode ?? "Uncoded"} · {version.derivedFromVersion.displayVersion}</Link> : null}
                  {version.previousVersion ? <Link href={`/protocols/${protocol.id}?version=${version.previousVersion.id}`} className="text-xs font-medium text-moss hover:underline">Previous revision {version.previousVersion.displayVersion}</Link> : null}
                  {version.sourceFileName ? <span className="break-all font-mono text-xs text-muted">Source: {version.sourceFileName}</span> : null}
                  {protocol.researchPlans.map((link) => <Link key={link.researchPlanId} href={`/research-plans/${link.researchPlanId}`} className="text-xs font-medium text-moss hover:underline">{link.isPrimary ? "Primary · " : ""}{link.researchPlan.code} · {link.researchPlan.title}</Link>)}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Attachments" eyebrow="Version-specific files" />
              <CardBody className="space-y-4">
                {!recycleEntry ? <AttachmentUploadForm targetType="protocol_version" targetId={version.id} hideTargetFields /> : null}
                {attachmentLinks.length ? <ul className="space-y-2 border-t border-hairline pt-4">{attachmentLinks.map((link) => <li key={link.id} className="flex items-center gap-2"><Link href={`/api/attachments/${link.attachment.id}`} className="min-w-0 flex-1 break-all text-sm font-medium text-moss hover:underline">{link.attachment.originalFilename}</Link><span className="text-xs text-muted">{(link.attachment.size / 1024).toFixed(1)} KB</span><AttachmentDeleteButton attachmentId={link.attachment.id} linkId={link.id} filename={link.attachment.originalFilename} /></li>)}</ul> : <p className="border-t border-hairline pt-4 text-sm text-muted">No files attached to this exact version.</p>}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Version history" eyebrow="Immutable lineage" />
              <CardBody>
                <ul className="divide-y divide-hairline">
                  {protocol.versions.map((row) => <li key={row.id} className="space-y-2 py-4 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/protocols/${protocol.id}?version=${row.id}`} className="record-identifier font-semibold text-moss hover:underline">{row.displayVersion}</Link>
                      <StatusPill status={row.reviewStage} />
                    </div>
                    <p className="text-xs text-muted">{row.sourceType.replaceAll("_", " ")} · {row.createdAt.toLocaleDateString()}</p>
                    <p className="text-sm leading-6 text-graphite">{row.changeSummary ?? "No change summary."}</p>
                    <Link href={`/protocols/${protocol.id}/versions/${row.id}/edit`} className="focus-ring inline-flex min-h-8 items-center gap-1.5 rounded-[var(--ln-radius-control-md)] border border-hairline bg-surface px-2.5 py-1.5 text-xs font-medium text-moss hover:bg-warm"><PencilLine className="h-3.5 w-3.5" aria-hidden />{row.reviewStage === "reviewed" ? "Edit as new revision" : "Edit version"}</Link>
                  </li>)}
                </ul>
              </CardBody>
            </Card>

            {activityLogs.length ? <Card><CardHeader title="Activity" eyebrow="Audit trail" /><CardBody><ul className="divide-y divide-hairline">{activityLogs.map((log) => <li key={log.id} className="space-y-1 py-2 text-sm"><span className="font-medium capitalize text-ink">{log.action.replaceAll("_", " ")}</span><time className="block text-xs text-muted">{log.createdAt.toLocaleString()}</time></li>)}</ul></CardBody></Card> : null}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{label}</p><div className="mt-2 text-sm font-medium text-ink">{children}</div></div>;
}
