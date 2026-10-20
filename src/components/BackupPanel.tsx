import { Download } from "lucide-react";
import { backupRunning } from "@/lib/backup/engine.server";
import { backupAlert } from "@/lib/backup/policy";
import { asPolicyStatus, backupLocation, backupRoot, folderSize, listSnapshots, readStatus, type BackupKind } from "@/lib/backup/store.server";
import { BackupNowButton } from "./BackupNowButton";
import { Badge } from "./ui/Badge";
import { Card, CardBody, CardHeader } from "./ui/Card";
import "./backup.css";

const kindLabels: Record<BackupKind, string> = { daily: "Daily", manual: "Manual", "pre-restore": "Before restore", "pre-release": "Before release" };

/** Settings → Backup: where backups go, how recent the last good one is, every kept backup, and how to restore. */
export async function BackupPanel() {
  const root = backupRoot();
  if (!root) {
    return <Card><CardHeader title="Backup" /><CardBody><p className="text-sm text-muted">Backups are not set up on this server (LABNEST_BACKUP_ROOT is not set).</p></CardBody></Card>;
  }
  const [status, snapshots, used] = await Promise.all([readStatus(root), listSnapshots(root), folderSize(root)]);
  const alert = backupAlert(asPolicyStatus(status), new Date());
  const failed = status.lastAttempt && !status.lastAttempt.ok ? status.lastAttempt : null;
  return <Card>
    <CardHeader title="Backup" action={<BackupNowButton disabled={backupRunning()} />} />
    <CardBody className="backup-panel">
      <dl className="backup-facts">
        <div><dt>Last good backup</dt><dd>{status.lastSuccess ? <time data-i18n-ignore dateTime={status.lastSuccess.at}>{stamp(status.lastSuccess.at)}</time> : <span className="text-warning">None yet</span>}</dd></div>
        <div><dt>Location</dt><dd><code data-i18n-ignore>{backupLocation()}</code></dd></div>
        <div><dt>Space used</dt><dd data-i18n-ignore>{size(used)}</dd></div>
        <div><dt>Schedule</dt><dd>Every day at 03:00; if the computer is asleep then, after it wakes</dd></div>
      </dl>
      {failed ? <p className="backup-warning text-error">The latest backup failed: {failed.error}{failed.detail ? <span className="backup-detail" data-i18n-ignore>{failed.detail}</span> : null}</p>
        : alert === "stale" ? <p className="backup-warning text-warning">No good backup for more than 36 hours.</p> : null}
      {snapshots.length ? <table className="backup-list">
        <thead><tr><th scope="col">Backup</th><th scope="col">Kind</th><th scope="col">Database</th><th scope="col">Attachments</th><th scope="col">Verification</th><th scope="col"><span className="sr-only">Download</span></th></tr></thead>
        <tbody>{snapshots.map((snapshot) => <tr key={snapshot.id}>
          <td><time data-i18n-ignore dateTime={snapshot.createdAt}>{stamp(snapshot.createdAt)}</time></td>
          <td>{kindLabels[snapshot.kind]}</td>
          <td data-i18n-ignore>{size(snapshot.database.size)}</td>
          <td data-i18n-ignore>{snapshot.files.length} · {size(snapshot.files.reduce((total, file) => total + file.size, 0))}</td>
          <td>{snapshot.verified?.ok ? <Badge tone="success">Checked</Badge> : <Badge tone="danger">Check failed</Badge>}</td>
          <td><a className="focus-ring backup-download" href={`/api/backups/${snapshot.id}`} download aria-label={`Download backup ${snapshot.id}`}><Download aria-hidden />.zip</a></td>
        </tr>)}</tbody>
      </table> : null}
      <p className="text-sm text-muted">Keeps every backup from the last 7 days and one a week for the 4 weeks before. Attachment files are stored once and shared by all backups. Each backup is checked by restoring it into a scratch database.</p>
      <details className="backup-help">
        <summary>How to restore</summary>
        <p>Restoring replaces the whole database, so it is done from the command line; the current state is backed up first.</p>
        <pre data-i18n-ignore>docker exec -it labnest-app npx tsx scripts/restore-backup.ts{"\n"}docker exec -it labnest-app npx tsx scripts/restore-backup.ts &lt;backup&gt; --yes</pre>
        <p>The first command lists backups; the second restores one. A downloaded .zip has the same layout as this folder.</p>
        <p>Not in backups: AI keys (enter them again in AI settings after restoring on another computer), and what lives only in this browser: calculator recipes and calculation records, pinned tasks, appearance settings and unsaved Entry drafts.</p>
      </details>
    </CardBody>
  </Card>;
}

function stamp(iso: string) {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function size(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
