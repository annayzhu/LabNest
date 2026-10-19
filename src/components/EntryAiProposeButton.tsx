"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AiButton, useAiStatus } from "@/components/AiAssistant";
import { newClientMutationId } from "@/lib/client-mutation-id";

import { requestAI } from "./useAISettings";

type Outcome = { ok: boolean; message: string };

/** Sends this entry's text to the connected model; the suggestions appear under the entry and run only once taken. */
export function EntryAiProposeButton({ entryId }: { entryId: string }) {
  const ai = useAiStatus();
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
          ? `已在下方“AI 建议”列出 ${count} 条，采纳后才会执行。`
          : "模型没有在这条记录里找到可执行的建议。",
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
      <AiButton size="sm" aria-busy={busy} onClick={propose} disabled={busy} title={`Send this entry's text to ${ai.saved?.availability.providerName ?? "the model"}`}>
        <Sparkles className="h-4 w-4" aria-hidden />
        {busy ? "Asking model…" : "Propose with AI"}
      </AiButton>
      {outcome ? (
        <span role="status" className={`max-w-xs text-right text-xs leading-5 ${outcome.ok ? "text-success" : "text-error"}`}>{outcome.message}</span>
      ) : null}
    </div>
  );
}
