import { format } from "date-fns";
import { Link2, Paperclip } from "lucide-react";
import Link from "next/link";
import type { Entry } from "@/lib/types";
import { filterHref } from "@/lib/filters";
import { BadgeLink, StatusPill } from "./ui/Badge";

export function EntryCard({ entry }: { entry: Entry }) {
  return (
    <article className="rounded-[12px] border border-hairline bg-surface p-4 shadow-paper transition hover:-translate-y-0.5 hover:shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <time className="font-mono text-xs text-muted" dateTime={entry.occurredAt}>
            {format(new Date(entry.occurredAt), "MMM d, HH:mm")}
          </time>
          <h3 className="mt-2 font-serif text-xl font-medium leading-snug text-ink">{entry.title}</h3>
        </div>
        <BadgeLink
          href={filterHref("/entries", { source: entry.sourceType })}
          tone={entry.sourceType === "photo" ? "info" : "sage"}
          title={`Filter entries by source: ${entry.sourceType}`}
        >
          {entry.sourceType}
        </BadgeLink>
      </div>
      <p className="mt-3 line-clamp-3 text-[15px] leading-7 text-graphite">{entry.body}</p>
      <div className="mt-4 flex flex-wrap gap-2">
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
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-hairline/80 pt-3 text-xs text-muted">
        {entry.projectId && entry.projectName ? (
          <Link
            href={filterHref("/entries", { project: entry.projectId })}
            className="focus-ring rounded-[6px] text-moss hover:underline"
          >
            {entry.projectName}
          </Link>
        ) : (
          <span>{entry.projectName}</span>
        )}
        <span className="inline-flex items-center gap-1">
          <Paperclip className="h-3.5 w-3.5" aria-hidden />
          {entry.attachmentCount} attachments
        </span>
        <span className="inline-flex items-center gap-1">
          <Link2 className="h-3.5 w-3.5" aria-hidden />
          {entry.relevantItems.length} links
        </span>
        <StatusPill status={entry.recordStatus} href={filterHref("/entries", { status: entry.recordStatus })} />
        {entry.pendingActionCount ? (
          <BadgeLink href={filterHref("/actions", { status: "pending" })} tone="warning">
            {entry.pendingActionCount} pending action
          </BadgeLink>
        ) : null}
      </div>
    </article>
  );
}
