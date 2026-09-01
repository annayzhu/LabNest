"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AttachmentDeleteButton({ attachmentId, linkId, filename }: { attachmentId: string; linkId?: string; filename: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (!window.confirm(`Remove ${filename}?`)) return;
    setPending(true);
    setError("");
    try {
      const query = linkId ? `?linkId=${encodeURIComponent(linkId)}` : "";
      const response = await fetch(`/api/attachments/${attachmentId}${query}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "File could not be removed.");
      if (Array.isArray(payload.cleanupWarnings) && payload.cleanupWarnings.length) window.alert(`The file record was removed, but cleanup needs attention:\n\n${payload.cleanupWarnings.join("\n")}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "File could not be removed.");
    } finally {
      setPending(false);
    }
  }

  return <span className="inline-flex items-center gap-1">
    <button type="button" onClick={remove} disabled={pending} className="focus-ring inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--ln-radius-control-sm)] text-error hover:bg-error-surface disabled:opacity-50" aria-label={`Remove ${filename}`} title="Remove file"><Trash2 className="h-3.5 w-3.5" /></button>
    {error ? <span role="alert" className="max-w-44 text-[11px] leading-4 text-error">{error}</span> : null}
  </span>;
}
