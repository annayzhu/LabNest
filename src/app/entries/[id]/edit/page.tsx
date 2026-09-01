import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { EntryComposer } from "@/components/EntryComposer";
import { PageHeader } from "@/components/PageHeader";
import { prisma } from "@/lib/db";
import { getEntryDetailRecord } from "@/lib/entries";

export const dynamic = "force-dynamic";

export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [entry, projects, researchPlans] = await Promise.all([
    getEntryDetailRecord(id),
    prisma.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.researchPlan.findMany({ include: { project: { select: { name: true } } }, orderBy: [{ project: { name: "asc" } }, { title: "asc" }] }),
  ]);
  if (!entry) notFound();

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Edit entry"
          title={entry.title}
          description="Revise the structured note, add or reorder original media, and preserve removed originals in the attachment archive."
          actions={<Link href={`/entries/${entry.id}`} className="focus-ring inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-[var(--ln-radius-control-lg)] border border-hairline bg-surface px-4 text-sm font-medium text-graphite shadow-paper transition hover:bg-sage-surface/60 hover:text-ink"><ArrowLeft className="h-4 w-4" />Cancel</Link>}
        />
        <EntryComposer
          projects={projects}
          researchPlans={researchPlans.map((plan) => ({ id: plan.id, title: plan.title, code: plan.code ?? undefined, projectId: plan.projectId, projectName: plan.project.name }))}
          protocols={[]}
          defaultOccurredAt={format(new Date(entry.occurredAt), "yyyy-MM-dd'T'HH:mm")}
          entry={{
            id: entry.id,
            title: entry.title,
            contentMarkdown: entry.contentMarkdown ?? entry.body,
            occurredAt: format(new Date(entry.occurredAt), "yyyy-MM-dd'T'HH:mm"),
            projectId: entry.projectId,
            researchPlanId: entry.researchPlanId,
            sourceType: entry.sourceType,
            recordStatus: entry.recordStatus,
            moodStatus: entry.moodStatus,
            tags: entry.tags,
            attachments: entry.attachments,
          }}
        />
      </div>
    </AppShell>
  );
}
