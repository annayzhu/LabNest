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

export function formatStepTimer(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}
