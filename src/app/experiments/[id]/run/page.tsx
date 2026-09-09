import { runConsumptionSources } from "@/lib/run-consumption";
import {RunMaterials} from "@/components/RunMaterials";
import {RunParameterEditor} from "@/components/RunParameterEditor";
import {runParameterKeys} from "@/lib/run-parameters";
import { runStepContent,runOfflineImagePaths } from "@/lib/run-step-content";
import { ArrowLeft, Camera, FilePlus2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AttachmentDeleteButton } from "@/components/AttachmentDeleteButton";
import { AttachmentUploadForm } from "@/components/AttachmentUploadForm";
import { ExperimentResultRecordingCard } from "@/components/ExperimentResultRecording";
import { PageHeader } from "@/components/PageHeader";
import { ProtocolRunProgressForm } from "@/components/ProtocolRunProgressForm";
import { MobileMeasurementCapture } from "@/components/MobileMeasurementCapture";
import { StatusPill } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { prisma } from "@/lib/db";
import { buildExperimentResultRecording } from "@/lib/experiment-results";


export const dynamic = "force-dynamic";

const secondaryButton = buttonStyles({ size: "md", className: "bg-surface font-medium text-moss hover:bg-warm" });

export default async function ProtocolRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [experiment, attachmentLinks, inventoryItems, transactions] = await Promise.all([
    prisma.experiment.findUnique({
      where: { id },
      include: {
        materialUses: {orderBy:{createdAt:"asc"}},
        project: true,
        researchPlan: true,
        primaryProtocolVersion: { include: { protocol: true } },
        protocolVersions: { orderBy: { order: "asc" }, include: { protocolVersion: { include: { protocol: true } } } },
        protocolRun: true,
        steps: { orderBy: [{ groupOrder: "asc" }, { order: "asc" }], include: { _count: { select: { entries: true, results: true, inventoryTransactions: true } } } },
        results: { orderBy: { updatedAt: "desc" }, take: 8 },
      },
    }),
    prisma.attachmentLink.findMany({
      where: { OR: [{ targetType: "experiment", targetId: id }, { targetType: "experiment_step", targetId: { in: (await prisma.experimentStep.findMany({ where: { experimentId: id }, select: { id: true } })).map((step) => step.id) } }] },
      include: { attachment: true },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    }),
    prisma.inventoryItem.findMany({
      where: { status: "active" },
      include: { location: true, containers:{where:{state:"held"},select:{id:true,holder:true}} },
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
  const currentStep = experiment.steps.find((step) => !step.completed);
  const editable = experiment.status !== "archived";
  const evidenceByStep = Object.fromEntries(experiment.steps.map((step) => [step.id, {
    observations: step._count.entries,
    measurements: step._count.results,
    files: attachmentLinks.filter((link) => link.targetType === "experiment_step" && link.targetId === step.id).length,
    consumptions: step._count.inventoryTransactions,
  }]));
  const resultRecording = buildExperimentResultRecording(experiment.protocolVersions.map((link) => ({
    protocolVersionId: link.protocolVersionId,
    protocolCode: link.protocolVersion.protocol.humanCode,
    protocolTitle: link.protocolVersion.protocol.canonicalTitle ?? link.protocolVersion.protocol.title,
    displayVersion: link.protocolVersion.displayVersion,
    resultTemplatesJson: link.protocolVersion.resultTemplatesJson,
  })), experiment.results);

  return (
    <AppShell>
      {runOfflineImagePaths(experiment.protocolSnapshotJson).map(path=><meta key={path} name="labnest-offline-image" content={path}/>)}
      <div className="space-y-4">
        <PageHeader
          identifier={experiment.runCode}
          title={experiment.title}
          actions={<>
            <Link href="/protocol-run" className={secondaryButton}><ArrowLeft className="h-4 w-4" aria-hidden />Runs</Link>
            <Link href={`/experiments/${experiment.id}`} className={secondaryButton}>Experiment record</Link>
          </>}
        />

        <section className="rounded-[var(--ln-radius-panel)] border border-hairline bg-surface px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2"><StatusPill status={experiment.status} /><StatusPill status={experiment.recordStatus} /></div>
              <p className="mt-2 text-sm text-graphite">{experiment.researchPlan?.code ?? "Unassigned plan"} · {experiment.project?.name ?? "Unassigned project"}</p>
              <p className="mt-1 text-xs text-muted">{lockedProtocol ? `${lockedProtocol.protocol.canonicalTitle ?? lockedProtocol.protocol.title} · ${lockedProtocol.protocol.humanCode ?? "Uncoded"} · ${lockedProtocol.displayVersion}` : "No locked ProtocolVersion"}</p>
            </div>
            <div className="min-w-52">
              <div className="flex items-center justify-between text-xs text-muted"><span>Run progress</span><span>{completed}/{total}</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone"><div className="h-full rounded-full bg-moss transition-all" style={{ width: `${progress}%` }} /></div>
            </div>
          </div>
        </section>

        <RunParameterEditor experimentId={experiment.id} keys={runParameterKeys(experiment.protocolSnapshotJson)} values={(experiment.protocolRun?.parametersJson??{}) as Record<string,unknown>} editable={editable&&experiment.status!=="completed"}/>

        <ProtocolRunProgressForm
          key={experiment.steps.map((step) => `${step.id}:${step.completed ? 1 : 0}:${step.deviationNote ?? ""}`).join("|")}
          experimentId={experiment.id}
          status={experiment.status}
          steps={experiment.steps.map(step=>({...step,richContent:runStepContent(experiment.protocolSnapshotJson,step,(experiment.protocolRun?.parametersJson??{}) as Record<string,string|number|boolean>)}))}
          editable={editable}
          evidenceByStep={evidenceByStep}
        />

        <section aria-label="Current run capture actions" className="grid grid-cols-3 gap-2 lg:hidden">
          <Link href={`/entries/new?mode=capture&experiment=${experiment.id}${currentStep ? `&step=${currentStep.id}` : ""}`} className="focus-ring flex min-h-14 flex-col items-center justify-center gap-1 rounded-[var(--ln-radius-control-lg)] border border-hairline bg-surface px-2 text-center text-xs font-semibold text-moss"><Camera className="h-5 w-5" aria-hidden />Observe</Link>
          <MobileMeasurementCapture experimentId={experiment.id} step={currentStep ? { id: currentStep.id, title: currentStep.title, order: currentStep.order } : undefined} />
          <a href="#result-recording" className="focus-ring flex min-h-14 flex-col items-center justify-center gap-1 rounded-[var(--ln-radius-control-lg)] border border-hairline bg-surface px-2 text-center text-xs font-semibold text-moss"><FilePlus2 className="h-5 w-5" aria-hidden />Result</a>
        </section>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-4">
            <div className="mb-4 flex items-center gap-2"><Camera className="h-4 w-4 text-moss" aria-hidden /><h2 className="font-serif text-lg font-medium text-ink">Photos and files</h2></div>
            {currentStep ? <div className="lg:hidden"><p className="mb-2 text-xs text-muted">Linked to Step {currentStep.order} · {currentStep.title}</p><AttachmentUploadForm targetType="experiment_step" targetId={currentStep.id} hideTargetFields fileLabel="Photo or file" accept="image/*,video/*,.pdf,.csv,.tsv,.xlsx" linkType="step_evidence" /></div> : null}
            <div className="hidden lg:block"><AttachmentUploadForm targetType="experiment" targetId={experiment.id} hideTargetFields fileLabel="Photo or file" accept="image/*,video/*,.pdf,.csv,.tsv,.xlsx" linkType="run_evidence" /></div>
            {attachmentLinks.length ? <ul className="mt-4 space-y-2 border-t border-hairline pt-4">{attachmentLinks.map((link) => <li key={link.id} className="flex items-center gap-2 text-sm"><Link href={`/api/attachments/${link.attachment.id}`} className="min-w-0 flex-1 truncate font-medium text-moss hover:underline">{link.attachment.originalFilename}</Link><span className="text-xs text-muted">{(link.attachment.size / 1024).toFixed(1)} KB</span><AttachmentDeleteButton attachmentId={link.attachment.id} linkId={link.id} filename={link.attachment.originalFilename} /></li>)}</ul> : <p className="mt-4 text-sm text-muted">No run evidence attached.</p>}
          </section>

          <RunMaterials consumptionSources={runConsumptionSources(experiment.protocolSnapshotJson)} parameterValues={(experiment.protocolRun?.parametersJson??{}) as Record<string,string|number|boolean>} experimentId={id} rows={JSON.parse(JSON.stringify(experiment.materialUses))} stock={inventoryItems} editable={editable} planned={Array.isArray(experiment.protocolRun?.calculatedConsumptionJson)?experiment.protocolRun.calculatedConsumptionJson as unknown as {materialName:string;quantity:number;unit:string;formula?:string}[]:[]}/>

        </div>

        {transactions.length?<section className="border-t border-hairline py-3"><h2 className="font-semibold">已执行库存交易</h2><ul>{transactions.map(t=><li key={t.id} className="py-2 text-sm">{t.inventoryItem.name} · {t.quantityChange} {t.unit}</li>)}</ul></section>:null}
        <ExperimentResultRecordingCard experimentId={experiment.id} recording={resultRecording} />
      </div>
    </AppShell>
  );
}
