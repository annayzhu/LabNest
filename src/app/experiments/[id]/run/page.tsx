import { ArrowLeft, Camera, CheckCircle2, Circle, FlaskConical, PackageMinus, Play, Save } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AttachmentUploadForm } from "@/components/AttachmentUploadForm";
import { PageHeader } from "@/components/PageHeader";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { prisma } from "@/lib/db";
import { recordProtocolRunConsumption, saveProtocolRunProgress } from "./actions";

export const dynamic = "force-dynamic";

const secondaryButton = "focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-hairline bg-surface px-4 text-sm font-medium text-moss hover:bg-warm";
const fieldClass = "focus-ring mt-2 w-full rounded-[8px] border border-hairline bg-surface px-3 py-2 text-sm text-ink";
const labelClass = "text-xs font-semibold uppercase tracking-[0.08em] text-muted";

export default async function ProtocolRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [experiment, attachmentLinks, inventoryItems, transactions] = await Promise.all([
    prisma.experiment.findUnique({
      where: { id },
      include: {
        project: true,
        researchPlan: true,
        primaryProtocolVersion: { include: { protocol: true } },
        protocolRun: true,
        steps: { orderBy: { order: "asc" } },
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

        <form action={saveProtocolRunProgress} className="space-y-4">
          <input type="hidden" name="experimentId" value={experiment.id} />
          <section className="overflow-hidden rounded-[12px] border border-hairline bg-surface">
            <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
              <h2 className="font-serif text-lg font-medium text-ink">Protocol steps</h2>
              <span className="text-xs text-muted">Changes save to the Experiment record</span>
            </div>
            {experiment.steps.length ? (
              <div className="divide-y divide-hairline">
                {experiment.steps.map((step) => (
                  <div key={step.id} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.45fr)]">
                    <label className="flex min-w-0 cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        name="completedStepIds"
                        value={step.id}
                        defaultChecked={step.completed}
                        disabled={!editable}
                        className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--moss)]"
                      />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-muted">Step {step.order}</span>
                          {step.completed ? <CheckCircle2 className="h-4 w-4 text-success" aria-hidden /> : <Circle className="h-4 w-4 text-muted" aria-hidden />}
                        </span>
                        <strong className="mt-1 block font-medium text-ink">{step.title}</strong>
                        <span className="mt-1 block whitespace-pre-wrap text-sm leading-6 text-graphite">{step.description}</span>
                      </span>
                    </label>
                    <label>
                      <span className={labelClass}>Deviation or incident</span>
                      <textarea
                        name={`deviation:${step.id}`}
                        defaultValue={step.deviationNote ?? ""}
                        disabled={!editable}
                        placeholder="Only record what differed from the locked ProtocolVersion"
                        className={`${fieldClass} min-h-20 resize-y`}
                      />
                    </label>
                  </div>
                ))}
              </div>
            ) : <p className="px-4 py-8 text-center text-sm text-muted">The locked ProtocolVersion has no executable steps.</p>}
          </section>

          <section className="rounded-[12px] border border-hairline bg-surface p-4">
            <label>
              <span className={labelClass}>Quick observation</span>
              <textarea
                name="quickNote"
                disabled={!editable}
                placeholder="What happened just now? This is appended with a timestamp and never replaces earlier observations."
                className={`${fieldClass} min-h-24 resize-y`}
              />
            </label>
          </section>

          {editable ? (
            <div className="sticky bottom-20 z-30 flex flex-wrap justify-end gap-2 rounded-[12px] border border-hairline bg-surface/95 p-3 shadow-soft backdrop-blur md:bottom-4">
              {experiment.status === "planned" || experiment.status === "failed" ? <button name="intent" value="start" className={secondaryButton}><Play className="h-4 w-4" aria-hidden />{experiment.status === "failed" ? "Resume run" : "Start run"}</button> : null}
              <button name="intent" value="save" className={secondaryButton}><Save className="h-4 w-4" aria-hidden />Save progress</button>
              <button name="intent" value="complete" className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-moss bg-moss px-4 text-sm font-medium text-warm"><CheckCircle2 className="h-4 w-4" aria-hidden />Complete run</button>
            </div>
          ) : null}
        </form>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-[12px] border border-hairline bg-surface p-4">
            <div className="mb-4 flex items-center gap-2"><Camera className="h-4 w-4 text-moss" aria-hidden /><h2 className="font-serif text-lg font-medium text-ink">Photos and files</h2></div>
            <AttachmentUploadForm targetType="experiment" targetId={experiment.id} hideTargetFields fileLabel="Photo or file" accept="image/*,video/*,.pdf,.csv,.tsv,.xlsx" linkType="run_evidence" />
            {attachmentLinks.length ? <ul className="mt-4 space-y-2 border-t border-hairline pt-4">{attachmentLinks.map((link) => <li key={link.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><Link href={`/api/attachments/${link.attachment.id}`} className="min-w-0 truncate font-medium text-moss hover:underline">{link.attachment.originalFilename}</Link><span className="text-xs text-muted">{(link.attachment.size / 1024).toFixed(1)} KB</span></li>)}</ul> : <p className="mt-4 text-sm text-muted">No run evidence attached.</p>}
          </section>

          <section className="rounded-[12px] border border-hairline bg-surface p-4">
            <div className="mb-4 flex items-center gap-2"><PackageMinus className="h-4 w-4 text-moss" aria-hidden /><h2 className="font-serif text-lg font-medium text-ink">Inventory consumption</h2></div>
            {editable && inventoryItems.length ? (
              <form action={recordProtocolRunConsumption} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="experimentId" value={experiment.id} />
                <label className="sm:col-span-2"><span className={labelClass}>Inventory Item</span><select required name="inventoryItemId" className={`${fieldClass} h-11`}><option value="">Select material…</option>{inventoryItems.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.currentQuantity} {item.unit}{item.location ? ` · ${item.location.name}` : ""}</option>)}</select></label>
                <label><span className={labelClass}>Quantity used</span><input required name="quantity" type="number" min="0.000001" step="any" className={`${fieldClass} h-11`} /></label>
                <label><span className={labelClass}>Performed by</span><input name="performedBy" className={`${fieldClass} h-11`} /></label>
                <label className="sm:col-span-2"><span className={labelClass}>Note</span><input name="notes" placeholder="Plate, sample or step context" className={`${fieldClass} h-11`} /></label>
                <button className="focus-ring sm:col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-moss bg-moss px-4 text-sm font-medium text-warm"><PackageMinus className="h-4 w-4" aria-hidden />Record consumption</button>
              </form>
            ) : <p className="text-sm text-muted">{editable ? "No active Inventory with available quantity." : "Archived runs cannot change Inventory."}</p>}
            {transactions.length ? <ul className="mt-4 space-y-2 border-t border-hairline pt-4">{transactions.map((transaction) => <li key={transaction.id} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{transaction.inventoryItem.name}</span><span className="font-mono text-xs text-muted">{transaction.quantityChange} {transaction.unit}</span></li>)}</ul> : null}
          </section>
        </div>

        <section className="rounded-[12px] border border-hairline bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2"><FlaskConical className="h-4 w-4 text-moss" aria-hidden /><h2 className="font-serif text-lg font-medium text-ink">Results</h2></div>
            <Link href={`/results/new?experiment=${experiment.id}`} className={secondaryButton}>Add Result</Link>
          </div>
          {experiment.results.length ? <ul className="mt-4 divide-y divide-hairline border-t border-hairline">{experiment.results.map((result) => <li key={result.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><Link href={`/results/${result.id}`} className="font-medium text-moss hover:underline">{result.title}</Link><div className="flex gap-2"><Badge>{result.resultType}</Badge><StatusPill status={result.recordStatus} /></div></li>)}</ul> : <p className="mt-4 text-sm text-muted">No Results recorded yet.</p>}
        </section>
      </div>
    </AppShell>
  );
}
