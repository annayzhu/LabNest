import { format } from "date-fns";
import { ArrowLeft, Download, FileText, Link2, ListChecks, Paperclip, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { EntryMediaGrid } from "@/components/EntryMediaGrid";
import { EntryContentView } from "@/components/EntryContentView";
import { PageHeader } from "@/components/PageHeader";
import { Badge, BadgeLink, StatusPill } from "@/components/ui/Badge";
import { getEntryDetailRecord } from "@/lib/entries";
import { filterHref } from "@/lib/filters";

export const dynamic = "force-dynamic";

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function imageDimensions(metadata?: Record<string, unknown>) {
  const image = metadata?.image;
  if (!image || typeof image !== "object" || Array.isArray(image)) return undefined;
  const { width, height } = image as { width?: unknown; height?: unknown };
  return typeof width === "number" && typeof height === "number" ? `${width} × ${height}` : undefined;
}

const collectionHref: Record<string, (id: string) => string> = {
  entry: (id) => `/entries/${id}`,
  experiment: (id) => `/experiments/${id}`,
  protocol: (id) => `/protocols/${id}`,
  project: () => "/projects",
  research_plan: (id) => `/research-plans/${id}`,
  result: (id) => `/results/${id}`,
  attachment: (id) => `/api/attachments/${id}`,
};

export default async function EntryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = await getEntryDetailRecord(id);
  if (!entry) notFound();

  const imageAttachments = entry.attachments.filter((attachment) => attachment.mimeType.startsWith("image/"));

  return (
    <AppShell>
      <div className="mx-auto max-w-[1180px] space-y-6">
        <PageHeader
          eyebrow={format(new Date(entry.occurredAt), "EEEE, MMMM d, yyyy · HH:mm")}
          title={entry.title}
          description="A journal entry remains a lightweight source record until its observations or decisions are reviewed and formalized elsewhere."
          actions={<div className="flex flex-wrap gap-2">
            <Link href={`/entries/${entry.id}/edit`} className="focus-ring inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-[8px] border border-moss bg-moss px-4 text-sm font-medium text-warm shadow-paper transition hover:brightness-95"><Pencil className="h-4 w-4" aria-hidden />Edit Entry</Link>
            <Link href="/entries" className="focus-ring inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-[8px] border border-hairline bg-surface px-4 text-sm font-medium text-graphite shadow-paper transition hover:bg-sage-surface/60 hover:text-ink"><ArrowLeft className="h-4 w-4" aria-hidden />All Entries</Link>
          </div>}
        />

        {imageAttachments.length ? (
          <div className="overflow-hidden rounded-[18px] border border-hairline bg-surface shadow-paper">
            <EntryMediaGrid attachments={imageAttachments} detail />
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <main className="min-w-0 space-y-6">
            <article className="rounded-[18px] border border-hairline bg-surface p-6 shadow-paper sm:p-8">
              <EntryContentView markdown={entry.contentMarkdown ?? entry.body} />

              {entry.tags.length || entry.moodStatus ? (
                <div className="mt-7 flex flex-wrap gap-2 border-t border-hairline pt-5">
                  {entry.tags.map((tag) => (
                    <BadgeLink key={tag} href={filterHref("/entries", { tag })}>{tag}</BadgeLink>
                  ))}
                  {entry.moodStatus ? <Badge tone="warning">{entry.moodStatus}</Badge> : null}
                </div>
              ) : null}
            </article>

            <section className="rounded-[18px] border border-hairline bg-surface shadow-paper">
              <div className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-4 sm:px-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-moss">Source files</p>
                  <h2 className="mt-1 font-serif text-2xl font-medium text-ink">Attachments</h2>
                </div>
                <Badge tone="sage">{entry.attachmentCount}</Badge>
              </div>
              {entry.attachments.length ? (
                <div className="divide-y divide-hairline">
                  {entry.attachments.map((attachment) => (
                    <div key={attachment.id} className="flex items-center gap-3 px-5 py-4 sm:px-6">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-sage-surface text-moss">
                        {attachment.mimeType.startsWith("image/") ? <Paperclip className="h-4 w-4" aria-hidden /> : <FileText className="h-4 w-4" aria-hidden />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{attachment.originalFilename}</p>
                        <p className="mt-1 text-xs text-muted">
                          {[attachment.mimeType, formatBytes(attachment.size), imageDimensions(attachment.metadata)].filter(Boolean).join(" · ")}
                          {attachment.sha256 ? <span className="ml-1 font-mono" title={`SHA-256 ${attachment.sha256}`}>· SHA-256 {attachment.sha256.slice(0, 10)}…</span> : null}
                        </p>
                      </div>
                      <a
                        href={`/api/attachments/${attachment.id}`}
                        className="focus-ring inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-hairline bg-warm text-moss transition hover:bg-sage-surface"
                        title={`Download ${attachment.originalFilename}`}
                      >
                        <Download className="h-4 w-4" aria-hidden />
                        <span className="sr-only">Download {attachment.originalFilename}</span>
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-5 py-6 text-sm text-muted sm:px-6">No files are linked to this entry yet.</p>
              )}
            </section>

            <section className="rounded-[18px] border border-hairline bg-surface shadow-paper">
              <div className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-4 sm:px-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-moss">Backlinks</p>
                  <h2 className="mt-1 font-serif text-2xl font-medium text-ink">Linked records</h2>
                </div>
                <Badge tone="sage">{entry.itemLinks.length}</Badge>
              </div>
              {entry.itemLinks.length ? (
                <div className="divide-y divide-hairline">
                  {entry.itemLinks.map((item) => {
                    const href = collectionHref[item.counterpartType]?.(item.counterpartId);
                    const label = `${item.counterpartType.replaceAll("_", " ")} · ${item.counterpartId}`;
                    return (
                      <div key={item.id} className="flex items-start gap-3 px-5 py-4 sm:px-6">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-sage-surface text-moss">
                          <Link2 className="h-4 w-4" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          {href ? <Link href={href} className="break-all text-sm font-semibold text-ink hover:underline">{label}</Link> : <p className="break-all text-sm font-semibold text-ink">{label}</p>}
                          <p className="mt-1 text-xs text-muted">{item.direction} · {item.linkType} · {item.createdBy}</p>
                          {item.note ? <p className="mt-2 text-sm leading-6 text-graphite">{item.note}</p> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="px-5 py-6 text-sm text-muted sm:px-6">No formal records are linked to this entry yet.</p>
              )}
            </section>
          </main>

          <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <section className="rounded-[14px] border border-hairline bg-surface p-5 shadow-paper">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-moss">Entry context</p>
              <dl className="mt-4 space-y-4 text-sm">
                <div>
                  <dt className="text-xs text-muted">Project</dt>
                  <dd className="mt-1 font-medium text-ink">
                    {entry.projectId && entry.projectName ? <Link href={filterHref("/entries", { project: entry.projectId })} className="hover:underline">{entry.projectName}</Link> : "Unassigned"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Research plan</dt>
                  <dd className="mt-1 font-medium text-ink">
                    {entry.researchPlanId && entry.researchPlanTitle ? <Link href={`/research-plans/${entry.researchPlanId}`} className="hover:underline">{entry.researchPlanTitle}</Link> : "Not linked"}
                  </dd>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-xs text-muted">Source</dt>
                    <dd className="mt-1"><Badge tone={entry.sourceType === "photo" ? "info" : "sage"}>{entry.sourceType}</Badge></dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Record</dt>
                    <dd className="mt-1"><StatusPill status={entry.recordStatus} /></dd>
                  </div>
                </div>
              </dl>
            </section>

            <section className="rounded-[14px] border border-hairline bg-surface p-5 shadow-paper">
              <div className="flex items-center gap-2 text-moss">
                <ListChecks className="h-4 w-4" aria-hidden />
                <p className="text-xs font-semibold uppercase tracking-[0.1em]">Proposed actions</p>
              </div>
              {entry.pendingActions.length ? (
                <div className="mt-4 space-y-3">
                  {entry.pendingActions.map((action) => (
                    <div key={action.id} className="rounded-[10px] border border-hairline bg-warm p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={action.status === "pending" ? "warning" : "neutral"}>{action.status}</Badge>
                        <span className="text-xs font-semibold text-ink">{action.actionType.replaceAll("_", " ")}</span>
                      </div>
                      {action.reason ? <p className="mt-2 text-xs leading-5 text-graphite">{action.reason}</p> : null}
                    </div>
                  ))}
                  <Link href="/actions?status=pending" className="focus-ring inline-flex rounded-[6px] text-sm font-semibold text-moss hover:underline">Review actions</Link>
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 text-muted">No proposed actions originate from this entry.</p>
              )}
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
