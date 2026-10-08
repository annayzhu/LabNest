"use client";

import { PlugZap } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

type TestResult = { ok: boolean; message: string; latencyMs?: number };

export function AiProviderTestButton({ providerId }: { providerId: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TestResult>();

  async function test() {
    setBusy(true);
    setResult(undefined);
    try {
      const response = await fetch(`/api/ai/providers/${providerId}/test`, { method: "POST" });
      const data = (await response.json()) as TestResult;
      setResult({ ok: Boolean(data.ok), message: data.message ?? (response.ok ? "Connected." : "Connection failed."), latencyMs: data.latencyMs });
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : "Connection failed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button size="sm" onClick={test} disabled={busy}>
        <PlugZap className="h-4 w-4" aria-hidden />
        {busy ? "Testing…" : "Test"}
      </Button>
      {result ? (
        <span role="status" className={`max-w-xs text-xs leading-5 ${result.ok ? "text-success" : "text-error"}`}>
          {result.message}
          {result.latencyMs !== undefined ? ` (${result.latencyMs} ms)` : ""}
        </span>
      ) : null}
    </div>
  );
}
