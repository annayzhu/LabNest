"use client";

import { PlugZap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AIConnectionResult } from "@/lib/ai";
import type { AIProviderInput } from "@/lib/ai-provider-input";
import { Button } from "@/components/ui/Button";
import { useAiStatus } from "./AiAssistant";
import { requestAI } from "./useAISettings";

type Props = {
  providerId?: string; revision?: string; draft?: AIProviderInput;
  enabled?: boolean; disabledReason?: string; epoch?: number;
  validate?: () => boolean; onInvalid?: (field: string) => void;
  /** What the test spends, when it is not API usage (a ChatGPT plan). */
  usageNote?: string;
  /** In a service card's button row: the note becomes the tooltip, and messages take their own line below the row. */
  inline?: boolean;
};

/** Both entry points use the same UI/request lifecycle; changing inputs destroys only the test state. */
export function AiProviderTestButton(props: Props) {
  const { saved, state, error } = useAiStatus();
  const reason = props.disabledReason || error || (state === "checking" ? "Reading AI settings…" : state === "off" ? "Enable AI first, then test the connection." : props.enabled === false ? "This service is disabled; enable it first." : "");
  return <ConnectionTest key={`${props.epoch ?? 0}:${props.revision}:${saved?.revision}:${reason}`} {...props} disabledReason={reason} />;
}

function ConnectionTest({ providerId, revision, draft, disabledReason, validate, onInvalid, usageNote, inline }: Props) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AIConnectionResult>();
  const active = useRef(true);
  const inFlight = useRef(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; abort.current?.abort(); }; }, []);

  async function test() {
    if (inFlight.current || disabledReason || (validate && !validate())) return;
    inFlight.current = true; setBusy(true); setResult(undefined);
    const controller = new AbortController(); abort.current = controller;
    try {
      const response = await requestAI(draft ? "/api/ai/providers/test" : `/api/ai/providers/${providerId}/test`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(draft ?? { revision }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(65_000)]),
      }, false);
      const data = await response.json() as AIConnectionResult & { field?: string };
      if (!active.current) return;
      setResult({ ...data, ok: response.ok && data.ok, message: data.message || "Connection test failed; try again." });
      if (data.field) onInvalid?.(data.field);
    } catch (error) {
      if (active.current) setResult({ ok: false, message: error instanceof Error && error.name === "TimeoutError" ? "The LabNest server test timed out; try again later." : error instanceof Error ? error.message : "Connection test failed; try again." });
    } finally {
      if (active.current) { inFlight.current = false; setBusy(false); }
    }
  }

  const note = usageNote ?? "Sends one short test message, which may cost a little API usage.";
  // Inline, the messages are flex items of the card's row that wrap to a full-width line after the buttons.
  const below = inline ? "order-last basis-full" : "";
  return <div className={inline ? "contents" : "min-w-0 space-y-1"}>
    <Button type="button" size="sm" onClick={test} disabled={busy || Boolean(disabledReason)} title={disabledReason || (inline ? note : undefined)}>
      <PlugZap className="h-4 w-4" aria-hidden />{busy ? "Testing…" : "Test connection"}
    </Button>
    {disabledReason ? <p className={`text-xs leading-5 text-muted ${below}`}>{disabledReason}</p> : null}
    {inline ? null : <p className="text-xs leading-5 text-muted">{note}</p>}
    {result ? <p role={result.ok ? "status" : "alert"} className={`rounded-[var(--ln-radius-control-lg)] p-3 break-words text-sm leading-6 ${below} ${result.ok ? "bg-success-surface text-success" : "bg-error-surface text-error"}`}>
      {draft && result.ok ? result.message.replace(/([Tt])est succeeded/, "$1est succeeded, settings not saved yet") : result.message}
      {result.latencyMs !== undefined ? ` · ${result.latencyMs} ms` : ""}{result.ok ? " · this test only" : ""}
    </p> : null}
  </div>;
}
