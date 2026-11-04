import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { CollectionBulkActivity, CollectionBulkActivityLabel } from "@/components/CollectionBulkActivity";
import type { BulkMessage, BulkValues } from "@/lib/collection-bulk";

type ActivityRow = { id: string; action: string; createdAt: Date; metadataJson: unknown };

/** Plain names for the actions a record page shows most; any other action falls back to its stored name (Q328). */
const actionLabels: Record<string, string> = {
  update: "Edited", create: "Created", delete: "Deleted", archive: "Archived", structured_import: "Imported",
  bulk_edit: "Edited", bulk_restore: "Restored", bulk_skip: "Skipped", bulk_noop: "No change", recycle: "Moved to Recycle Bin",
  protocol_run_start: "Run started", protocol_run_save: "Run saved", protocol_run_complete: "Run completed",
  protocol_recognized: "Recognized from a document", protocol_recognition_saved: "Recognized from a document",
  repair_draft_execution: "Execution record repaired", confirm_execution_structure: "Execution structure confirmed",
  experiment_step_recorded: "Step recorded", merge_protocol_ranges: "Ranges merged", fix_protocol_range: "Range corrected",
  create_revision: "Revision created", unlink_attachment: "Attachment removed", entry_assign: "Filed", entry_tidied: "AI-tidied draft adopted",
};
const actionLabel = (action: string) => actionLabels[action] ?? `${action.charAt(0).toUpperCase()}${action.slice(1).replaceAll("_", " ")}`;

/** Reads the existing ActivityLog; status moves and reopen reasons are shown, stored revisions stay in metadata. */
export function ActivityHistory({ logs }: { logs: ActivityRow[] }) {
  if (!logs.length) return null;
  return <Card><CardHeader title="Activity" eyebrow="Audit trail" /><CardBody><ul className="divide-y divide-hairline">{logs.map((log) => {
    const meta = (log.metadataJson ?? {}) as { from?: string; to?: string; reason?: string | BulkMessage; previous?: unknown; batchId?: string; before?: BulkValues; after?: BulkValues };
    return <li key={log.id} className="space-y-1 py-2 text-sm">
      <span className="font-medium text-ink">{meta.batchId ? <CollectionBulkActivityLabel action={log.action} /> : actionLabel(log.action)}</span>
      {meta.from && meta.to ? <span className="ml-1.5 font-mono text-xs text-muted">{meta.from} → {meta.to}</span> : null}
      {meta.previous ? <span className="ml-1.5 text-xs text-muted">· revision kept</span> : null}
      {typeof meta.reason === "string" ? <p className="whitespace-pre-wrap text-xs leading-5 text-graphite">{meta.reason}</p> : null}
      {meta.batchId ? <CollectionBulkActivity batchId={meta.batchId} before={meta.before} after={meta.after} reason={typeof meta.reason === "object" ? meta.reason : undefined} /> : null}
      <time className="block text-xs text-muted" dateTime={log.createdAt.toISOString()}>{log.createdAt.toLocaleString()}</time>
    </li>;
  })}</ul></CardBody></Card>;
}
