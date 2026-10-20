import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { backupAlert } from "@/lib/backup/policy";
import { asPolicyStatus, backupRoot, readStatus } from "@/lib/backup/store.server";
import "./backup.css";

/** On the overview: shown only when the latest backup failed or there has been no good backup for 36 hours. */
export async function BackupAlert() {
  const root = backupRoot();
  if (!root) return null;
  const alert = backupAlert(asPolicyStatus(await readStatus(root)), new Date());
  if (!alert) return null;
  return <Link href="/settings#local-backup" role="alert" className="backup-alert focus-ring">
    <AlertTriangle aria-hidden />
    <span>{alert === "failed" ? "The latest backup failed." : "No good backup for more than 36 hours."}</span>
    <span className="backup-alert-action">Open backup settings</span>
  </Link>;
}
