import { ArrowUpRight, Link2, Paperclip } from "lucide-react";
import Link from "next/link";
import type { Entry } from "@/lib/types";
import { formatEntryCardTimestamp } from "@/lib/entry-timeline";
import { filterHref } from "@/lib/filters";
import type { AppLocale } from "@/lib/i18n";
import { EntryMediaGrid } from "./EntryMediaGrid";
import { BadgeLink, StatusPill } from "./ui/Badge";

export function EntryCard({ entry, locale = "en" }: { entry: Entry; locale?: AppLocale }) {
  const entryHref = `/entries/${entry.id}`;
  const linkedItemCount = entry.linkedItemCount ?? entry.relevantItems.length;

  return (
    <article className="overflow-hidden rounded-[18px] border border-hairline bg-surface shadow-paper transition duration-300 hover:-translate-y-0.5 hover:shadow-soft">
      <EntryMediaGrid attachments={entry.attachments ?? []} entryHref={entryHref} />
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <time className="font-mono text-xs text-muted" dateTime={entry.occurredAt}>
              {formatEntryCardTimestamp(entry.occurredAt, locale)}
            </time>
            <h3 className="mt-2 font-serif text-[24px] font-medium leading-tight text-ink sm:text-[28px]">
              <Link href={entryHref} className="focus-ring rounded-[6px] transition hover:text-moss">
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
        <p className="mt-4 line-clamp-4 max-w-3xl whitespace-pre-line text-[15px] leading-7 text-graphite sm:text-base">
          {entry.body}
        </p>

        {entry.tags.length || entry.moodStatus ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {entry.tags.map((tag) => (
              <BadgeLink key={tag} href={filterHref("/entries", { tag })} title={`Filter entries by tag: ${tag}`}>
                {tag}
              </BadgeLink>
            ))}
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

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-hairline/80 pt-4 text-xs text-muted">
          {entry.projectId && entry.projectName ? (
            <Link
              href={filterHref("/entries", { project: entry.projectId })}
              className="focus-ring max-w-60 truncate rounded-[6px] font-medium text-moss hover:underline"
            >
              {entry.projectName}
            </Link>
          ) : (
            <span>Unassigned</span>
          )}
          {entry.researchPlanTitle ? <span className="max-w-64 truncate">{entry.researchPlanTitle}</span> : null}
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
          <Link href={entryHref} className="focus-ring inline-flex w-full items-center justify-end gap-1 rounded-[6px] font-semibold text-moss hover:underline sm:ml-auto sm:w-auto">
            View entry
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}
