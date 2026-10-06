import { Card, CardBody, CardHeader } from "@/components/ui/Card";

type ActivityRow = { id: string; action: string; createdAt: Date; metadataJson: unknown };

/** Reads the existing ActivityLog; status moves and reopen reasons are shown, stored revisions stay in metadata. */
export function ActivityHistory({ logs }: { logs: ActivityRow[] }) {
  if (!logs.length) return null;
  return <Card><CardHeader title="Activity" eyebrow="Audit trail" /><CardBody><ul className="divide-y divide-hairline">{logs.map((log) => {
    const meta = (log.metadataJson ?? {}) as { from?: string; to?: string; reason?: string; previous?: unknown };
    return <li key={log.id} className="space-y-1 py-2 text-sm">
      <span className="font-medium capitalize text-ink">{log.action.replaceAll("_", " ")}</span>
      {meta.from && meta.to ? <span className="ml-1.5 font-mono text-xs text-muted">{meta.from} → {meta.to}</span> : null}
      {meta.previous ? <span className="ml-1.5 text-xs text-muted">· revision kept</span> : null}
      {meta.reason ? <p className="whitespace-pre-wrap text-xs leading-5 text-graphite">{meta.reason}</p> : null}
      <time className="block text-xs text-muted" dateTime={log.createdAt.toISOString()}>{log.createdAt.toLocaleString()}</time>
    </li>;
  })}</ul></CardBody></Card>;
}
