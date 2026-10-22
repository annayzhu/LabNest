import { RunNotificationStatus } from '@/components/RunNotificationStatus';
import { FieldDevices } from '@/components/FieldDevices';
import { NativeRunTimers } from '@/components/NativeRunTimers';
import { normalizeProtocolDocument } from "@/lib/protocol-document";
import { runStepNotes, structuredRunView } from '@/lib/structured-run';
import { formatQuantity } from '@/lib/calculators/quantity-format';
import { RunSystemPreparation } from '@/components/RunSystemPreparation';
import { RunBenchControls } from "@/components/RunBenchControls";
import { consumptionRecorded, runConsumption } from "@/lib/run-consumption";
import { ProtocolContentBlockView } from '@/components/ProtocolDocumentView';
import { ProtocolSystemChoice } from '@/components/ProtocolSystemLabels';
import {RunMaterials} from "@/components/RunMaterials";
import {RunParameterEditor} from "@/components/RunParameterEditor";
import {runParameterKeys} from "@/lib/run-parameters";
import { runStepContent,runOfflineImagePaths } from "@/lib/run-step-content";
import { ArrowLeft, Camera } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AttachmentDeleteButton } from "@/components/AttachmentDeleteButton";
import { RunStepSelectionProvider, RunStepAttachmentUpload } from "@/components/RunStepSelection";
import { AttachmentUploadForm } from "@/components/AttachmentUploadForm";
import { ExperimentResultRecordingCard } from "@/components/ExperimentResultRecording";
import { PageHeader } from "@/components/PageHeader";
import { ProtocolRunProgressForm } from "@/components/ProtocolRunProgressForm";
import { StatusPill } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { prisma } from "@/lib/db";
import { buildExperimentResultRecording } from "@/lib/experiment-results";
import { isRecordLocked } from "@/lib/record-lifecycle";


export const dynamic = "force-dynamic";

const secondaryButton = buttonStyles({ size: "md", className: "bg-surface font-medium text-moss hover:bg-warm" });

export default async function ProtocolRunPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  // 现场模式: a layout the user switches on; the run and its actions are the same.
  const bench = (await searchParams)?.view === 'bench';
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

  const lockedProtocol = experiment.primaryProtocolVersion;
  const structured = structuredRunView(experiment.protocolSnapshotJson, experiment.protocolRun?.executionPlanJson, experiment.steps);
  const currentStep = experiment.steps.find((step) => !step.completed && !structured.steps[step.id]?.blocked);
  // What this run uses, from mix cards and material-linked chips; offered for deduction at completion.
  const consumption = runConsumption(structured);
  const locked = isRecordLocked(experiment.recordStatus);
  const editable = experiment.status !== "archived" && !locked && !(structured.hasSystems && experiment.status === 'completed');
  const evidenceByStep = Object.fromEntries(experiment.steps.map((step) => [step.id, {
    observations: step._count.entries,
    measurements: step._count.results,
    files: attachmentLinks.filter((link) => link.targetType === "experiment_step" && link.targetId === step.id).length,
    consumptions: step._count.inventoryTransactions,
  }]));
  const frozenReferenceTitles:Record<string,string>={};
  const frozenReferences: Record<string, ReturnType<typeof runStepContent>["reference"]> = {};
  const groupOrder = (stepId: string) => structured.plan.stepGroups[stepId] === 'shared' ? -1 : structured.plan.groups.findIndex(group => group.id === structured.plan.stepGroups[stepId]);
  const notes = runStepNotes(structured);
  const renderedSteps=[...experiment.steps].sort((a,b) => a.groupOrder-b.groupOrder || groupOrder(a.id)-groupOrder(b.id) || a.order-b.order).map(step=>{
    const {reference,...richContent}=runStepContent(experiment.protocolSnapshotJson,step,(experiment.protocolRun?.parametersJson??{}) as Record<string,string|number|boolean>);
    frozenReferences[step.groupKey] ??= reference;
    const resolved = structured.steps[step.id];
    return resolved ? { ...step, timerDurationSeconds: step.timerDurationSeconds ?? resolved.timerDurationSeconds ?? null, title: resolved.title, groupTitle: resolved.groupLabel ? `${resolved.groupLabel} · ${step.groupTitle}` : step.groupTitle, description: resolved.description, richContent: { ...richContent, blocks: resolved.source_blocks ?? resolved.content_blocks ?? [], notesBefore: notes.before[step.id] ?? [], notesAfter: notes.after[step.id] ?? [], ...(resolved.title_source === 'derived' ? { derivedTitle: true } : {}), chipVersion: resolved.versionId } } : {...step,richContent};
  }).filter(step => structured.steps[step.id]?.applicability !== 'not-applicable');
  for(const version of (experiment.protocolSnapshotJson as {versions?:{protocolVersionId:string;contentJson?:unknown;protocolTitle?:string;displayVersion?:string}[]}).versions??[]) {
    frozenReferenceTitles[version.protocolVersionId]=`${version.protocolTitle??"Captured Protocol"} · v${version.displayVersion??"unknown"}`;
    frozenReferences[version.protocolVersionId]??=normalizeProtocolDocument(version.contentJson)?.sections??[];
  }
  const resultRecording = buildExperimentResultRecording(experiment.protocolVersions.map((link) => ({
    protocolVersionId: link.protocolVersionId,
    protocolCode: link.protocolVersion.protocol.humanCode,
    protocolTitle: link.protocolVersion.protocol.canonicalTitle ?? link.protocolVersion.protocol.title,
    displayVersion: link.protocolVersion.displayVersion,
    resultTemplatesJson: link.protocolVersion.resultTemplatesJson,
  })), experiment.results);

  return (
    <AppShell>
      <RunStepSelectionProvider key={experiment.id} initialStepId={currentStep?.id ?? renderedSteps[0]?.id ?? ""}>
      {runOfflineImagePaths(experiment.protocolSnapshotJson).map(path=><meta key={path} name="labnest-offline-image" content={path}/>)}
      <div className={bench ? "ln-bench space-y-4" : "space-y-4"}>
        <NativeRunTimers experimentId={experiment.id} title={experiment.title} steps={renderedSteps.map(({ id, title, timerRemainingSeconds, timerStartedAt, timerPausedAt }) => ({ id, title, timerRemainingSeconds, timerStartedAt, timerPausedAt }))} />
        <PageHeader
          identifier={experiment.runCode}
          title={experiment.title}
          actions={<>
            <RunBenchControls bench={bench} />
            <FieldDevices experimentId={experiment.id} title={experiment.title} watch={!structured.hasSystems ? "legacy" : editable ? "ready" : "locked"} />
            {/* A phone has 现场模式 in its bottom bar. */}
            <Link href="/protocol-run" className={`${secondaryButton} max-lg:hidden`}><ArrowLeft className="h-4 w-4" aria-hidden />Run mode</Link>
            <Link href={`/experiments/${experiment.id}`} className={secondaryButton}>Experiment record</Link>
          </>}
        />

        <details className="rounded-[var(--ln-radius-panel)] border border-hairline bg-surface px-3 py-2">
          <summary className="focus-ring cursor-pointer text-sm font-medium text-moss">Experiment information</summary>
          <section className="mt-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2"><StatusPill status={experiment.status} /><StatusPill status={experiment.recordStatus} /></div>
              <p className="mt-2 text-sm text-graphite">{experiment.researchPlan?.code ?? "Research plan not assigned"} · {experiment.project?.name ?? "Project not assigned"}</p>
              <p className="mt-1 text-xs text-muted">{lockedProtocol ? `${lockedProtocol.protocol.canonicalTitle ?? lockedProtocol.protocol.title} · ${lockedProtocol.protocol.humanCode ?? "Uncoded"} · ${lockedProtocol.displayVersion}` : "No locked ProtocolVersion"}</p>
            </div>

          </div>
        </section>

        <RunParameterEditor experimentId={experiment.id} keys={runParameterKeys(experiment.protocolSnapshotJson).filter(key => !structured.versions.some(v => v.document.systems?.parameters.some(p => p.id === key)))} values={(experiment.protocolRun?.parametersJson??{}) as Record<string,unknown>} editable={editable&&experiment.status!=="completed"}/>
        </details>

        {locked ? <p role="status" className="rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm px-3 py-2 text-sm text-graphite">This run is submitted or reviewed and read-only. Reopen it from the experiment record to change steps or deviations.</p> : null}
        <RunSystemPreparation experimentId={id} runLabel={experiment.runCode ?? experiment.title} view={structured} editable={editable} plates={attachmentLinks.filter(link => link.linkType === 'plate_layout').map(link => ({ id: link.attachment.id, originalFilename: link.attachment.originalFilename, mimeType: link.attachment.mimeType }))} stock={inventoryItems.map(item => ({ name: item.name, unit: item.unit, currentQuantity: item.currentQuantity, quantityRecorded: item.quantityRecorded }))} recorded={experiment.materialUses.map(row => ({ source: row.source }))}/>
        {structured.hasSystems ? <div className="protocol-system-context" aria-label="Systems in this run"><strong>{`Systems adopted · ${experiment.runCode}`}</strong>{structured.versions.map(v => <div key={v.id} className="protocol-system-legend"><span>{v.groupLabel ?? v.title}</span>{Object.entries(structured.plan.versions[v.id]?.selections ?? {}).map(([dimensionId, optionId]) => <ProtocolSystemChoice key={`${v.id}:${dimensionId}`} systems={v.document.systems!} dimensionId={dimensionId} optionId={optionId}/>)}</div>)}</div> : null}
        <RunNotificationStatus/>
        <ProtocolRunProgressForm
          key={`${structured.plan.revision}:${experiment.steps.map((step) => `${step.id}:${step.completed ? 1 : 0}:${step.deviationNote ?? ""}`).join("|")}`}
          structured={structured.hasSystems ? { plan: structured.plan, steps: structured.steps } : undefined}
          experimentId={experiment.id}
          status={experiment.status}
          steps={renderedSteps}
          frozenReferences={frozenReferences}
          frozenReferenceTitles={frozenReferenceTitles}
          protocolBased={(experiment.protocolSnapshotJson as {methodMode?:string}).methodMode==="protocol"}
          // The reference panel reads each captured Protocol across all systems; a step reads its group's adopted values.
          chipContexts={Object.fromEntries([...structured.versions.map(version => [version.sourceVersionId, { systems: version.document.systems }] as const), ...structured.versions.map(version => [version.id, { systems: version.document.systems, resolution: version.parameters }] as const)])}
          editable={editable}
          bench={bench}
          evidenceByStep={evidenceByStep}
          consumption={consumption.filter(line => !consumptionRecorded(line, experiment.materialUses))}
          stock={inventoryItems.map(item => ({ id: item.id, name: item.name, managementMode: item.managementMode, lotNumber: item.lotNumber }))}
        />
        {Object.values(structured.steps).some(step => step.applicability === 'not-applicable') ? <details className="rounded border border-hairline p-3" data-not-applicable><summary>Show other systems’ content (not applicable, not counted in this run’s progress)</summary>{Object.values(structured.steps).filter(step => step.applicability === 'not-applicable').map(step => <section key={`${step.versionId}:${step.source_ref}`} className="mt-3"><h3>{step.title} · not applicable</h3>{step.content_blocks?.map(block => <ProtocolContentBlockView key={block.id} block={block} executionContext/>)}</section>)}</details> : null}



        <details className="rounded-[var(--ln-radius-panel)] border border-hairline px-3 py-2"><summary className="focus-ring cursor-pointer text-sm font-medium text-moss">Files, materials and results</summary>
        <div className="mt-3 grid gap-4 xl:grid-cols-2">
          <section className="rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-4">
            <div className="mb-4 flex items-center gap-2"><Camera className="h-4 w-4 text-moss" aria-hidden /><h2 className="text-lg font-semibold text-ink">Photos and files</h2></div>
            <RunStepAttachmentUpload steps={renderedSteps.map(s=>({id:s.id,title:s.title,order:s.order}))}/>
            <div className="hidden lg:block"><AttachmentUploadForm targetType="experiment" targetId={experiment.id} hideTargetFields fileLabel="Photo or file" accept="image/*,video/*,.pdf,.csv,.tsv,.xlsx" linkType="run_evidence" /></div>
            {attachmentLinks.length ? <ul className="mt-4 space-y-2 border-t border-hairline pt-4">{attachmentLinks.map((link) => <li key={link.id} className="flex items-center gap-2 text-sm"><Link href={`/api/attachments/${link.attachment.id}`} className="min-w-0 flex-1 truncate font-medium text-moss hover:underline">{link.attachment.originalFilename}</Link><span className="text-xs text-muted">{(link.attachment.size / 1024).toFixed(1)} KB</span><AttachmentDeleteButton attachmentId={link.attachment.id} linkId={link.id} filename={link.attachment.originalFilename} /></li>)}</ul> : <p className="mt-4 text-sm text-muted">No run evidence attached.</p>}
          </section>

          <RunMaterials experimentId={id} rows={JSON.parse(JSON.stringify(experiment.materialUses))} stock={inventoryItems} editable={editable}/>

        </div>

        {transactions.length?<section className="border-t border-hairline py-3"><h2 className="font-semibold">Inventory transactions made</h2><ul>{transactions.map(t=><li key={t.id} className="py-2 text-sm">{t.inventoryItem.name} · {formatQuantity(t.quantityChange)} {t.unit}</li>)}</ul></section>:null}
        </details>
        <ExperimentResultRecordingCard experimentId={experiment.id} recording={resultRecording} />
      </div>
      </RunStepSelectionProvider>
    </AppShell>
  );
}
