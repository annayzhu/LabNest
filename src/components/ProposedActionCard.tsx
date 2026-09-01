import type { ProposedAction } from "@/lib/types";
import { filterHref } from "@/lib/filters";
import { BadgeLink, StatusPill } from "./ui/Badge";

export function ProposedActionCard({ action }: { action: ProposedAction }) {
  return (
    <article className="rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-4 shadow-paper">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <BadgeLink href={filterHref("/actions", { type: action.actionType })} tone="sage">
              {action.actionType.replaceAll("_", " ")}
            </BadgeLink>
            <StatusPill status={action.status} href={filterHref("/actions", { status: action.status })} />
            {action.confidence !== undefined ? (
              <span className="font-mono text-xs text-muted">
                confidence {(action.confidence * 100).toFixed(0)}%
              </span>
            ) : null}
          </div>
          <h3 className="mt-3 font-serif text-xl font-medium text-ink">{action.affectedItem ?? action.sourceLabel}</h3>
          <p className="mt-2 text-sm leading-6 text-graphite">{action.reason}</p>
        </div>
      </div>
      <div className="mt-4 rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-warm p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Payload summary</p>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-mono text-xs leading-5 text-graphite">
          {JSON.stringify(action.payload, null, 2)}
        </pre>
      </div>
    </article>
  );
}
