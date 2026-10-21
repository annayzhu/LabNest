/** When to back up, which backups to keep, and when to warn. Pure: dates in, decisions out (local time). */

const DAILY_HOUR = 3;
const KEEP_DAYS = 7;
const KEEP_WEEKS = 4;
const RETRY_AFTER_MS = 60 * 60 * 1000;
const STALE_AFTER_MS = 36 * 60 * 60 * 1000;

export type Attempt = { at: Date; ok: boolean };

/**
 * Every backup from the last 7 days that have one, then the newest of each of the 4 weeks (Monday start) before those,
 * plus any ids in `protect` (a backup about to be restored). Counting days that have a backup, not calendar days,
 * means a machine that was off for months keeps its last good copies instead of deleting them all.
 */
export function snapshotsToKeep(snapshots: Array<{ id: string; createdAt: Date }>, protect: string[] = []) {
  const newestFirst = [...snapshots].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const keep = new Set<string>(protect);
  const days = new Set<string>();
  for (const snapshot of newestFirst) {
    const day = dayKey(snapshot.createdAt);
    if (!days.has(day) && days.size >= KEEP_DAYS) continue;
    days.add(day);
    keep.add(snapshot.id);
  }
  const weeks = new Set<string>();
  for (const snapshot of newestFirst) {
    if (days.has(dayKey(snapshot.createdAt))) continue;
    const week = weekKey(snapshot.createdAt);
    if (weeks.has(week) || weeks.size >= KEEP_WEEKS) continue;
    weeks.add(week);
    keep.add(snapshot.id);
  }
  return keep;
}

/** Due once a day after 03:00 (later the same day if the machine slept through it); a failed attempt is retried after an hour. */
export function isBackupDue(lastSuccessAt: Date | null, lastAttempt: Attempt | null, now: Date) {
  if (lastAttempt && !lastAttempt.ok && now.getTime() - lastAttempt.at.getTime() < RETRY_AFTER_MS) return false;
  if (!lastSuccessAt) return true;
  const slot = new Date(now);
  slot.setHours(DAILY_HOUR, 0, 0, 0);
  if (now < slot) slot.setDate(slot.getDate() - 1);
  return lastSuccessAt < slot;
}

/** "failed" when the latest attempt failed; "stale" when there has been no good backup for 36 hours (or ever). */
export function backupAlert(status: { lastSuccessAt: Date | null; lastAttempt: Attempt | null }, now: Date): "failed" | "stale" | null {
  if (status.lastAttempt && !status.lastAttempt.ok) return "failed";
  if (!status.lastSuccessAt || now.getTime() - status.lastSuccessAt.getTime() > STALE_AFTER_MS) return "stale";
  return null;
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function weekKey(date: Date) {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return dayKey(monday);
}
