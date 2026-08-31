import { ArrowLeft, Camera, PackageMinus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AttachmentDeleteButton } from "@/components/AttachmentDeleteButton";
import { AttachmentUploadForm } from "@/components/AttachmentUploadForm";
import { ExperimentResultRecordingCard } from "@/components/ExperimentResultRecording";
import { formInputClass, formLabelClass } from "@/components/forms";
import { PageHeader } from "@/components/PageHeader";
import { ProtocolRunProgressForm } from "@/components/ProtocolRunProgressForm";
import { StatusPill } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { prisma } from "@/lib/db";
import { buildExperimentResultRecording } from "@/lib/experiment-results";
import { recordProtocolRunConsumption } from "./actions";

export const dynamic = "force-dynamic";

const secondaryButton = buttonStyles({ size: "md", className: "bg-surface font-medium text-moss hover:bg-warm" });
const primaryButton = buttonStyles({ variant: "primary", size: "md", className: "sm:col-span-2 font-medium" });
const fieldClass = `${formInputClass} bg-surface`;

export default async function ProtocolRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [experiment, attachmentLinks, inventoryItems, transactions] = await Promise.all([
    prisma.experiment.findUnique({
      where: { id },
      include: {
        project: true,
        researchPlan: true,
        primaryProtocolVersion: { include: { protocol: true } },
        protocolVersions: { orderBy: { order: "asc" }, include: { protocolVersion: { include: { protocol: true } } } },
        protocolRun: true,
        steps: { orderBy: [{ groupOrder: "asc" }, { order: "asc" }] },
        results: { orderBy: { updatedAt: "desc" }, take: 8 },
      },
    }),
    prisma.attachmentLink.findMany({
      where: { targetType: "experiment", targetId: id },
      include: { attachment: true },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    }),
    prisma.inventoryItem.findMany({
      where: { status: "active", currentQuantity: { gt: 0 } },
      include: { location: true },
      orderBy: { name: "asc" },
      take: 250,
    }),
    prisma.inventoryTransaction.findMany({
      where: { experimentId: id, type: "consume" },
      include: { inventoryItem: true },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);
  if (!experiment) notFound();

  const completed = experiment.steps.filter((step) => step.completed).length;
  const total = experiment.steps.length;
  const progress = total ? Math.round((completed / total) * 100) : 0;
  const lockedProtocol = experiment.primaryProtocolVersion;
  const editable = experiment.status !== "archived";
  const resultRecording = buildExperimentResultRecording(experiment.protocolVersions.map((link) => ({
    protocolVersionId: link.protocolVersionId,
    protocolCode: link.protocolVersion.protocol.humanCode,
    protocolTitle: link.protocolVersion.protocol.canonicalTitle ?? link.protocolVersion.protocol.title,
    displayVersion: link.protocolVersion.displayVersion,
    resultTemplatesJson: link.protocolVersion.resultTemplatesJson,
  })), experiment.results);

  return (
    <AppShell>
      <div className="space-y-4">
        <PageHeader
          identifier={experiment.runCode}
          title={experiment.title}
          actions={<>
            <Link href="/protocol-run" className={secondaryButton}><ArrowLeft className="h-4 w-4" aria-hidden />Runs</Link>
            <Link href={`/experiments/${experiment.id}`} className={secondaryButton}>Experiment record</Link>
          </>}
        />

        <section className="rounded-[12px] border border-hairline bg-surface px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2"><StatusPill status={experiment.status} /><StatusPill status={experiment.recordStatus} /></div>
              <p className="mt-2 text-sm text-graphite">{experiment.researchPlan?.code ?? "Unassigned plan"} · {experiment.project?.name ?? "Unassigned project"}</p>
              <p className="mt-1 text-xs text-muted">{lockedProtocol ? `${lockedProtocol.protocol.humanCode ?? lockedProtocol.protocol.title} · ${lockedProtocol.displayVersion}` : "No locked ProtocolVersion"}</p>
            </div>
            <div className="min-w-52">
              <div className="flex items-center justify-between text-xs text-muted"><span>Run progress</span><span>{completed}/{total}</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone"><div className="h-full rounded-full bg-moss transition-all" style={{ width: `${progress}%` }} /></div>
            </div>
          </div>
        </section>

        <ProtocolRunProgressForm experimentId={experiment.id} status={experiment.status} steps={experiment.steps} editable={editable} />

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-[12px] border border-hairline bg-surface p-4">
            <div className="mb-4 flex items-center gap-2"><Camera className="h-4 w-4 text-moss" aria-hidden /><h2 className="font-serif text-lg font-medium text-ink">Photos and files</h2></div>
            <AttachmentUploadForm targetType="experiment" targetId={experiment.id} hideTargetFields fileLabel="Photo or file" accept="image/*,video/*,.pdf,.csv,.tsv,.xlsx" linkType="run_evidence" />
            {attachmentLinks.length ? <ul className="mt-4 space-y-2 border-t border-hairline pt-4">{attachmentLinks.map((link) => <li key={link.id} className="flex items-center gap-2 text-sm"><Link href={`/api/attachments/${link.attachment.id}`} className="min-w-0 flex-1 truncate font-medium text-moss hover:underline">{link.attachment.originalFilename}</Link><span className="text-xs text-muted">{(link.attachment.size / 1024).toFixed(1)} KB</span><AttachmentDeleteButton attachmentId={link.attachment.id} linkId={link.id} filename={link.attachment.originalFilename} /></li>)}</ul> : <p className="mt-4 text-sm text-muted">No run evidence attached.</p>}
          </section>

          <section className="rounded-[12px] border border-hairline bg-surface p-4">
            <div className="mb-4 flex items-center gap-2"><PackageMinus className="h-4 w-4 text-moss" aria-hidden /><h2 className="font-serif text-lg font-medium text-ink">Inventory consumption</h2></div>
            {editable && inventoryItems.length ? (
              <form action={recordProtocolRunConsumption} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="experimentId" value={experiment.id} />
                <label className="sm:col-span-2"><span className={formLabelClass}>Inventory Item</span><select required name="inventoryItemId" className={fieldClass}><option value="">Select material…</option>{inventoryItems.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.currentQuantity} {item.unit}{item.location ? ` · ${item.location.name}` : ""}</option>)}</select></label>
                <label><span className={formLabelClass}>Quantity used</span><input required name="quantity" type="number" min="0.000001" step="any" className={fieldClass} /></label>
                <label><span className={formLabelClass}>Performed by</span><input name="performedBy" className={fieldClass} /></label>
                <label className="sm:col-span-2"><span className={formLabelClass}>Note</span><input name="notes" placeholder="Plate, sample or step context" className={fieldClass} /></label>
                <button className={primaryButton}><PackageMinus className="h-4 w-4" aria-hidden />Record consumption</button>
              </form>
            ) : <p className="text-sm text-muted">{editable ? "No active Inventory with available quantity." : "Archived runs cannot change Inventory."}</p>}
            {transactions.length ? <ul className="mt-4 space-y-2 border-t border-hairline pt-4">{transactions.map((transaction) => <li key={transaction.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{transaction.inventoryItem.name}</span><span className="font-mono text-xs text-muted">{transaction.quantityChange} {transaction.unit}</span></li>)}</ul> : null}
          </section>
        </div>

        <ExperimentResultRecordingCard experimentId={experiment.id} recording={resultRecording} />
      </div>
    </AppShell>
  );
}
