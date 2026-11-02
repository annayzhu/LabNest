import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DesignWorkbench } from "@/components/DesignWorkbench";
import { PageHeader } from "@/components/PageHeader";
import { buttonStyles } from "@/components/ui/Button";
import { protocolChoices } from "@/lib/copilot/plan-design/context.server";
import { designReadiness } from "@/lib/copilot/plan-design/deps.server";
import { listDesignRuns } from "@/lib/copilot/plan-design/runs.server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
const secondaryButton = buttonStyles({ size: "md", className: "bg-surface font-medium text-moss hover:bg-warm" });

/** 设计工作台 (Q300): the research plan's design, one confirmed step at a time, ending in a signed version. */
export default async function ResearchPlanDesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const plan = await prisma.researchPlan.findUnique({ where: { id }, select: { id: true, code: true, title: true, objective: true, status: true, project: { select: { name: true } } } });
  if (!plan) notFound();
  const [runs, readiness, oldRuns] = await Promise.all([
    listDesignRuns(plan.id), designReadiness(),
    prisma.researchPlanCopilotRun.findMany({ where: { researchPlanId: plan.id }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, purpose: true, status: true, createdAt: true, suggestionsJson: true } }),
  ]);
  const current = runs.find(run => run.status !== "signed") ?? runs[0];
  const protocols = await protocolChoices(plan.id, current?.purpose ?? plan.objective ?? plan.title);
  const experiments = await prisma.experiment.findMany({ where: { id: { in: runs.flatMap(run => run.state.signed?.experimentIds ?? []) } }, select: { id: true, runCode: true, title: true, date: true, primaryProtocolVersionId: true } });
  return <AppShell><div className="space-y-4">
    <PageHeader identifier={plan.code} eyebrow={plan.project.name} title="Design workbench" description={plan.title}
      actions={<Link href={`/research-plans/${plan.id}`} className={secondaryButton}><ArrowLeft className="h-4 w-4" aria-hidden />Back to the plan</Link>} />
    <DesignWorkbench planId={plan.id} defaultPurpose={plan.objective ?? ""} archived={plan.status === "archived"} initialRuns={runs} readiness={readiness} protocols={protocols}
      experiments={experiments.map(row => ({ id: row.id, label: `${row.runCode ?? ""} ${row.title}`.trim(), day: row.date.toISOString().slice(0, 10), hasProtocol: Boolean(row.primaryProtocolVersionId) }))}
      oldRuns={oldRuns.map(row => ({ id: row.id, purpose: row.purpose, status: row.status, at: row.createdAt.toISOString().slice(0, 10), suggestions: Array.isArray(row.suggestionsJson) ? (row.suggestionsJson as { title?: string; status?: string }[]).map(item => `${item.title ?? ""}${item.status && item.status !== "pending" ? ` (${item.status})` : ""}`) : [] }))} />
  </div></AppShell>;
}
