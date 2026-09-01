import { ArrowUpRight, Link2, Paperclip } from "lucide-react";
import Link from "next/link";
import type { Entry } from "@/lib/types";
import { formatEntryCardTimestamp, type EntryCardLayout } from "@/lib/entry-timeline";
import { filterHref } from "@/lib/filters";
import type { AppLocale } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { EntryMediaGrid } from "./EntryMediaGrid";
import { Badge, BadgeLink, StatusPill } from "./ui/Badge";

export function EntryCard({ entry, locale = "en", layout = "standard" }: { entry: Entry; locale?: AppLocale; layout?: EntryCardLayout }) {
  const entryHref = `/entries/${entry.id}`;
  const linkedItemCount = entry.linkedItemCount ?? entry.relevantItems.length;
  const featured = layout === "featured";
  const visibleTagCount = featured ? 5 : 3;
  const visibleTags = entry.tags.slice(0, visibleTagCount);
  const remainingTagCount = entry.tags.length - visibleTags.length;

  return (
    <article className={cn(
      "flex h-full min-h-[248px] flex-col overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface transition duration-200 hover:-translate-y-px hover:border-border-strong hover:shadow-[var(--ln-shadow-panel)]",
      featured && "md:col-span-2 2xl:col-span-2",
    )}>
      <EntryMediaGrid attachments={entry.attachments ?? []} entryHref={entryHref} compact={!featured} />
      <div className={cn("flex flex-1 flex-col", featured ? "p-5 sm:p-6" : "p-4 sm:p-5")}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <time className="font-mono text-xs text-muted" dateTime={entry.occurredAt}>
              {formatEntryCardTimestamp(entry.occurredAt, locale)}
            </time>
            <h3 className={cn("mt-2 line-clamp-2 font-semibold leading-snug tracking-[-0.02em] text-ink", featured ? "text-[20px] sm:text-[22px]" : "text-[16px] sm:text-[17px]")}>
              <Link href={entryHref} className="focus-ring rounded-[var(--ln-radius-control-sm)] transition hover:text-moss">
                {entry.title}
              </Link>
            </h3>
          </div>
          <BadgeLink
            href={filterHref("/entries", { source: entry.sourceType })}
            tone={entry.sourceType === "photo" ? "info" : "sage"}
            title={`Filter entries by source: ${entry.sourceType}`}
          >
            {entry.sourceType}
          </BadgeLink>
        </div>
        <p className={cn("mt-3 max-w-3xl whitespace-pre-line text-graphite", featured ? "line-clamp-4 text-[15px] leading-7" : "line-clamp-3 text-sm leading-6")}>
          {entry.body}
        </p>

        {entry.tags.length || entry.moodStatus ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {visibleTags.map((tag) => (
              <BadgeLink key={tag} href={filterHref("/entries", { tag })} title={`Filter entries by tag: ${tag}`}>
                {tag}
              </BadgeLink>
            ))}
            {remainingTagCount > 0 ? <Badge>+{remainingTagCount}</Badge> : null}
            {entry.moodStatus ? (
              <BadgeLink
                href={filterHref("/entries", { mood: entry.moodStatus })}
                tone="warning"
                title={`Filter entries by note state: ${entry.moodStatus}`}
              >
                {entry.moodStatus}
              </BadgeLink>
            ) : null}
          </div>
        ) : null}

        <div className="min-h-4 flex-1" aria-hidden />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-hairline/80 pt-4 text-xs text-muted">
          {entry.projectId && entry.projectName ? (
            <Link
              href={filterHref("/entries", { project: entry.projectId })}
              className="focus-ring max-w-60 truncate rounded-[var(--ln-radius-control-sm)] font-medium text-moss hover:underline"
            >
              {entry.projectName}
            </Link>
          ) : (
            <span>Unassigned</span>
          )}
          {entry.researchPlanTitle ? <span className={cn("truncate", featured ? "max-w-64" : "max-w-44")}>{entry.researchPlanTitle}</span> : null}
          <span className="inline-flex items-center gap-1">
            <Paperclip className="h-3.5 w-3.5" aria-hidden />
            {entry.attachmentCount} {entry.attachmentCount === 1 ? "attachment" : "attachments"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            {linkedItemCount} {linkedItemCount === 1 ? "link" : "links"}
          </span>
          <StatusPill status={entry.archivedAt ? "archived" : entry.recordStatus} href={filterHref("/entries", { status: entry.archivedAt ? "archived" : entry.recordStatus })} />
          {entry.pendingActionCount ? (
            <BadgeLink href={filterHref("/actions", { status: "pending" })} tone="warning">
              {entry.pendingActionCount} pending {entry.pendingActionCount === 1 ? "action" : "actions"}
            </BadgeLink>
          ) : null}
          <Link href={entryHref} className="focus-ring ml-auto inline-flex items-center justify-end gap-1 rounded-[var(--ln-radius-control-sm)] font-medium text-moss hover:underline">
            View
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}
