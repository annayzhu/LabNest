import { isBackupDue } from "./policy";
import { runBackup } from "./engine.server";
import { asPolicyStatus, backupRoot, readStatus } from "./store.server";

const CHECK_EVERY_MS = 10 * 60 * 1000;
const scheduled = globalThis as unknown as { labnestBackupTimer?: ReturnType<typeof setInterval> };

/**
 * Checks every ten minutes whether today's backup is due (see isBackupDue) and runs it. A machine asleep at 03:00
 * catches up on the first check after it wakes. Does nothing unless LABNEST_BACKUP_ROOT is set.
 */
export function startBackupSchedule() {
  if (!backupRoot() || scheduled.labnestBackupTimer) return;
  const check = async () => {
    const root = backupRoot();
    if (!root) return;
    const { lastSuccessAt, lastAttempt } = asPolicyStatus(await readStatus(root));
    if (!isBackupDue(lastSuccessAt, lastAttempt, new Date())) return;
    await runBackup("daily").catch((error) => console.error("[LabNest] Daily backup failed:", error));
  };
  scheduled.labnestBackupTimer = setInterval(() => void check(), CHECK_EVERY_MS);
  scheduled.labnestBackupTimer.unref?.();
  setTimeout(() => void check(), 60 * 1000).unref?.();
}
