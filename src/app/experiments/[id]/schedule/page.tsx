import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CalendarExportButton } from "@/components/CalendarExportButton";
import { ExperimentScheduleBoard } from "@/components/ExperimentScheduleBoard";
import { PageHeader } from "@/components/PageHeader";
import { buttonStyles } from "@/components/ui/Button";
import { isExportableExperiment } from "@/lib/calendar-export";
import { prisma } from "@/lib/db";
import { addDays, labDayKey, labInstant, nextWorkMoment, sortBlocks } from "@/lib/experiment-schedule";
import { blockView, scheduledBlocks, scheduleSteps, scheduleToken } from "@/lib/experiment-schedule.server";
import { isRecordLocked } from "@/lib/record-lifecycle";

export const dynamic = "force-dynamic";
const secondaryButton = buttonStyles({ size: "md", className: "bg-surface font-medium text-moss hover:bg-warm" });

/** 日程 (Q259–Q270): the experiment's days as a flowchart, drafted from its Protocols' waits and moved by hand. */
export default async function ExperimentSchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const experiment = await prisma.experiment.findUnique({ where: { id }, include: {
    protocolRun: { select: { executionPlanJson: true } }, scheduleBlocks: true, researchPlan: { select: { code: true } },
    steps: { orderBy: [{ groupOrder: "asc" }, { order: "asc" }], select: { id: true, protocolStepRef: true, groupKey: true, groupTitle: true, groupOrder: true, order: true, title: true, description: true, completed: true, timerDurationSeconds: true } },
  } });
  if (!experiment) notFound();
  const steps = scheduleSteps(experiment);
  const blocks = sortBlocks(experiment.scheduleBlocks.map(blockView));
  const now = new Date();
  // Other experiments' blocks around this one, so a clash at the same time shows (Q268).
  const firstDay = blocks[0] ? labDayKey(blocks[0].startAt) : labDayKey(experiment.date);
  const from = new Date(labInstant(addDays(firstDay < labDayKey(now) ? firstDay : labDayKey(now), -1), 0));
  const others = (await scheduledBlocks({ from, to: new Date(Date.parse(labInstant(firstDay, 0)) + 60 * 86_400_000) }))
    .filter(block => block.experimentId !== experiment.id)
    .map(block => ({ id: block.id, label: `${block.runCode} · ${block.title}`, startAt: block.startAt, estimatedMinutes: block.estimatedMinutes, allDay: block.allDay }));
  // A draft starts on the experiment's day at 09:30, or when that has passed at the next half hour of working time.
  const planned = labInstant(labDayKey(experiment.date), 9 * 60 + 30);
  const halfHour = 30 * 60_000;
  const suggestedStart = Date.parse(planned) > now.getTime() ? planned : nextWorkMoment(new Date(Math.ceil(now.getTime() / halfHour) * halfHour).toISOString());
  const editable = experiment.status !== "archived" && !isRecordLocked(experiment.recordStatus);
  // Day 1 is the experiment's date (Q315); an experiment not yet planned whose date has passed starts on the draft's day.
  const dateDay = labDayKey(experiment.date);
  const startDay = blocks.length ? (firstDay < dateDay ? firstDay : dateDay) : dateDay < labDayKey(now) ? labDayKey(suggestedStart) : dateDay;
  return <AppShell><div className="space-y-4">
    <PageHeader identifier={experiment.runCode} eyebrow={experiment.researchPlan?.code ?? undefined} title={`Schedule · ${experiment.title}`} description="Each day’s work, drafted from the waits in its Protocols. Drag a block to another day; what waits for it moves along."
      actions={<><Link href={`/experiments/${experiment.id}`} className={secondaryButton}><ArrowLeft className="h-4 w-4" aria-hidden />Experiment record</Link>{isExportableExperiment(experiment) && blocks.length ? <CalendarExportButton scope={`experiment=${experiment.id}`} /> : null}</>} />
    <ExperimentScheduleBoard experiment={{ id: experiment.id, runCode: experiment.runCode, status: experiment.status }} editable={editable} steps={steps} blocks={blocks}
      token={scheduleToken(experiment.scheduleBlocks)} others={others} suggestedStart={suggestedStart} todayKey={labDayKey(now)}
      startDay={startDay} savedDays={experiment.scheduleDays} />
  </div></AppShell>;
}
