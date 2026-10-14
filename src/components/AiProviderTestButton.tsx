"use client";

import { PlugZap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AIConnectionResult } from "@/lib/ai";
import type { AIProviderInput } from "@/lib/ai-provider-input";
import { Button } from "@/components/ui/Button";
import { requestAI, useAISettings } from "./useAISettings";

type Props = {
  providerId?: string; revision?: string; draft?: AIProviderInput;
  enabled?: boolean; disabledReason?: string; epoch?: number;
  validate?: () => boolean; onInvalid?: (field: string) => void;
};

/** Both entry points use the same UI/request lifecycle; changing inputs destroys only the test state. */
export function AiProviderTestButton(props: Props) {
  const { saved, enabled, error } = useAISettings();
  const reason = props.disabledReason || error || (!saved ? "正在读取 AI 设置…" : !enabled ? "请先启用 AI，再测试连接。" : props.enabled === false ? "此服务已停用，请先启用。" : "");
  return <ConnectionTest key={`${props.epoch ?? 0}:${props.revision}:${saved?.revision}:${reason}`} {...props} disabledReason={reason} />;
}

function ConnectionTest({ providerId, revision, draft, disabledReason, validate, onInvalid }: Props) {
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
      setResult({ ...data, ok: response.ok && data.ok, message: data.message || "连接测试失败，请重试。" });
      if (data.field) onInvalid?.(data.field);
    } catch (error) {
      if (active.current) setResult({ ok: false, message: error instanceof Error && error.name === "TimeoutError" ? "LabNest 服务器测试超时，请稍后重试。" : error instanceof Error ? error.message : "连接测试失败，请重试。" });
    } finally {
      if (active.current) { inFlight.current = false; setBusy(false); }
    }
  }

  return <div className="min-w-0 space-y-1">
    <Button type="button" size="sm" onClick={test} disabled={busy || Boolean(disabledReason)} title={disabledReason}>
      <PlugZap className="h-4 w-4" aria-hidden />{busy ? "正在测试…" : "测试连接"}
    </Button>
    {disabledReason ? <p className="text-xs leading-5 text-muted">{disabledReason}</p> : null}
    <p className="text-xs leading-5 text-muted">将发送一条简短测试消息，可能产生少量 API 费用。</p>
    {result ? <p role={result.ok ? "status" : "alert"} className={`rounded-[var(--ln-radius-control-lg)] p-3 break-words text-sm leading-6 ${result.ok ? "bg-success-surface text-success" : "bg-error-surface text-error"}`}>
      {draft && result.ok ? result.message.replace("测试成功", "测试成功，配置尚未保存") : result.message}
      {result.latencyMs !== undefined ? ` · ${result.latencyMs} ms` : ""}{result.ok ? " · 仅代表本次测试" : ""}
    </p> : null}
  </div>;
}
