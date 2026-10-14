"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import Link from 'next/link';
import { Button } from "@/components/ui/Button";
import { newClientMutationId } from "@/lib/client-mutation-id";

import { requestAI, useAISettings } from "./useAISettings";

type Outcome = { ok: boolean; message: string };

/** Sends this entry's text to the connected model and files the result as pending proposed actions. */
export function EntryAiProposeButton({ entryId, providerName }: { entryId: string; providerName?: string }) {
  const status = useAISettings();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>();
  const requestId = useRef<string | undefined>(undefined);
  const requesting = useRef(false);

  async function propose() {
    if (requesting.current) return;
    requesting.current = true;
    requestId.current ??= newClientMutationId();
    setBusy(true);
    setOutcome(undefined);
    try {
      const response = await requestAI("/api/ai/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entryId, persist: true, clientMutationId: requestId.current }),
      });
      const data = (await response.json()) as { count?: number; persisted?: number; error?: unknown };
      if (!response.ok) {
        if (response.status === 409) requestId.current = undefined;
        throw new Error(typeof data.error === "string" ? data.error : "The model request failed.");
      }
      const count = data.persisted ?? 0;
      requestId.current = undefined;
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
      requesting.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="primary" onClick={propose} disabled={busy || !status.connected} title={`Send this entry's text to ${status.saved?.availability.providerName ?? providerName ?? "the model"}`}>
        <Sparkles className="h-4 w-4" aria-hidden />
        {busy ? "Asking model…" : "Propose with AI"}
      </Button>
      {!status.connected ? <Link href="/ai" className="focus-ring text-xs text-moss underline">配置并启用 AI</Link> : null}
      {outcome ? (
        <span role="status" className={`max-w-xs text-right text-xs leading-5 ${outcome.ok ? "text-success" : "text-error"}`}>{outcome.message}</span>
      ) : null}
    </div>
  );
}
