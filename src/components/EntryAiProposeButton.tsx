"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

type Outcome = { ok: boolean; message: string };

/** Sends this entry's text to the connected model and files the result as pending proposed actions. */
export function EntryAiProposeButton({ entryId, providerName }: { entryId: string; providerName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>();

  async function propose() {
    setBusy(true);
    setOutcome(undefined);
    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entryId, persist: true }),
      });
      const data = (await response.json()) as { count?: number; persisted?: number; error?: unknown };
      if (!response.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "The model request failed.");
      }
      const count = data.persisted ?? 0;
      setOutcome({
        ok: true,
        message: count
          ? `${count} proposed action${count === 1 ? "" : "s"} added for review. Nothing was executed.`
          : "The model found nothing actionable in this entry.",
      });
      router.refresh();
    } catch (error) {
      setOutcome({ ok: false, message: error instanceof Error ? error.message : "The model request failed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="primary" onClick={propose} disabled={busy} title={`Send this entry's text to ${providerName}`}>
        <Sparkles className="h-4 w-4" aria-hidden />
        {busy ? "Asking model…" : "Propose with AI"}
      </Button>
      {outcome ? (
        <span role="status" className={`max-w-xs text-right text-xs leading-5 ${outcome.ok ? "text-success" : "text-error"}`}>{outcome.message}</span>
      ) : null}
    </div>
  );
}
