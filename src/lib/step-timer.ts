export function remainingStepTimerSeconds({
  remainingSeconds,
  startedAt,
  now,
}: {
  remainingSeconds: number;
  startedAt: Date | null;
  now: Date;
}) {
  if (!startedAt) return Math.max(0, remainingSeconds);
  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));
  return Math.max(0, remainingSeconds - elapsedSeconds);
}

/** "04:59" under an hour; "5 h 20 min" / "5 小时 20 分" from an hour, "2 d 3 h" / "2 天 3 小时" from a day (Q269). */
export function formatStepTimer(seconds: number, zh = false) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  if (safeSeconds >= 3600) {
    const days = Math.floor(safeSeconds / 86400), hours = Math.floor((safeSeconds % 86400) / 3600), minutes = Math.floor((safeSeconds % 3600) / 60);
    if (days) return zh ? `${days} 天 ${hours} 小时` : `${days} d ${hours} h`;
    return zh ? `${hours} 小时 ${minutes} 分` : `${hours} h ${minutes} min`;
  }
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}
