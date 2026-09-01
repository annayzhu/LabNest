"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DatasetDeleteButton({ datasetId, name }: { datasetId: string; name: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    if (!window.confirm(`Remove ${name}?`)) return;
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/results/datasets/${datasetId}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Dataset could not be removed.");
      if (Array.isArray(payload.cleanupWarnings) && payload.cleanupWarnings.length) window.alert(`The Dataset record was removed, but cleanup needs attention:\n\n${payload.cleanupWarnings.join("\n")}`);
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Dataset could not be removed."); }
    finally { setPending(false); }
  }
  return <span className="inline-flex items-center gap-1"><button type="button" onClick={remove} disabled={pending} className="focus-ring inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-error hover:bg-error-surface disabled:opacity-50" aria-label={`Remove ${name}`}><Trash2 className="h-3.5 w-3.5" /></button>{error ? <span role="alert" className="text-[11px] text-error">{error}</span> : null}</span>;
}
