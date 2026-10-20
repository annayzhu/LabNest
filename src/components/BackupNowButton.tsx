"use client";

import { useActionState } from "react";
import { backUpNow, type BackupNowState } from "@/app/settings/backup-actions";

/** "Back up now": waits for the whole backup, including the check by restoring it, then reports the result in place. */
export function BackupNowButton({ disabled }: { disabled?: boolean }) {
  const [state, action, pending] = useActionState<BackupNowState>(backUpNow, null);
  return <form action={action} className="backup-now">
    <button type="submit" disabled={disabled || pending} className="focus-ring inline-flex h-10 items-center rounded-[var(--ln-radius-control-lg)] border border-hairline bg-surface px-4 text-sm font-medium text-moss transition hover:bg-warm disabled:text-muted">
      {pending ? "Backing up…" : "Back up now"}
    </button>
    <p role="status" className={state && !state.ok ? "text-error" : "text-muted"}>
      {pending ? "Exporting the database, copying new files and checking the backup by restoring it." : state ? state.message : null}
      {state?.detail ? <span className="backup-detail" data-i18n-ignore>{state.detail}</span> : null}
    </p>
  </form>;
}
