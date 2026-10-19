"use client";

import { useRef, useState } from "react";
import Link from 'next/link';
import type { AISettingsChange } from "@/lib/ai-settings";
import { formLabelClass } from "./forms";
import { Select } from "./ui/Select";
import { Button } from "./ui/Button";
import { useAiStatus } from "./AiAssistant";
import { notifyAISettingsChanged } from "./useAISettings";
import type { AiState } from "@/lib/ai-readiness";

const stateLabels: Record<AiState, string> = { checking: "正在读取设置…", error: "设置读取失败", off: "已关闭", incomplete: "已开启 · 待配置", ready: "已开启 · 配置齐备" };

export function AISettingsPanel({ providers }: { providers: { id: string; name: string }[] }) {
  const { saved, error, refresh, accept, state } = useAiStatus();
  const [editedDraft, setDraft] = useState<{ defaultProviderId: string; attachmentsEnabled: boolean }>();
  const draft = editedDraft ?? { defaultProviderId: saved?.defaultProviderId ?? "", attachmentsEnabled: saved?.attachmentsEnabled ?? false };
  const dirty = editedDraft !== undefined;
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  async function save(kind: "enabled" | "configuration") {
    if (!saved || error || submitting.current) return;
    submitting.current = true; setBusy(true); setFailure(undefined); setMessage("");
    const change: AISettingsChange = kind === "enabled"
      ? { kind, revision: saved.revision, enabled: !saved.enabled }
      : { kind, revision: saved.revision, defaultProviderId: draft.defaultProviderId || null, attachmentsEnabled: draft.attachmentsEnabled };
    try {
      const response = await fetch("/api/ai/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(change) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "保存失败，请重试。");
      accept(result);
      if (kind === "configuration") setDraft(undefined);
      setMessage(kind === "enabled" ? "开关已保存" : "功能设置已保存");
      notifyAISettingsChanged();
    } catch (caught) { setFailure(caught instanceof Error ? caught.message : "保存失败，开关保留上次成功保存的状态。请重新读取确认。"); }
    finally { submitting.current = false; setBusy(false); }
  }
  const stateLabel = saved ? stateLabels[state] : stateLabels.checking;
  return <section className="space-y-4" aria-label="AI 功能设置">
    <div id="ai-access" className="rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor="ai-enabled" className="cursor-pointer text-base font-semibold text-ink">启用 AI</label>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs text-muted" role="status" data-ai-state>{stateLabel}</span>
          <button id="ai-enabled" type="button" role="switch" aria-checked={Boolean(saved?.enabled)} aria-label="启用 AI" aria-describedby="ai-switch-help" disabled={busy || !saved || Boolean(error)} onClick={() => save("enabled")} className={`focus-ring relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border disabled:cursor-wait disabled:opacity-50 ${saved?.enabled ? "border-ai bg-ai" : "border-hairline bg-stone"}`}>
            <span className={`h-5 w-5 rounded-full ${saved?.enabled ? "ml-6 bg-ai-fg" : "ml-1 bg-surface"}`} />
          </button>
        </div>
      </div>
      <p id="ai-switch-help" className="mt-2 text-xs leading-5 text-muted">{saved && !saved.enabled ? "已关闭 AI，现有记录保持不变。" : "仅按你的操作使用 AI；开启不会扫描或处理历史记录。"}</p>
      <p className="mt-1 text-xs leading-5 text-muted">作用于当前 LabNest 工作空间，与原设置范围一致；Visualization Studio 使用自己的设置。</p>
      {saved && !error ? <p className="mt-3 text-sm font-medium" role="status">{!providers.length ? '下一步：添加一个模型服务，再选择为默认服务。' : !saved.defaultProviderId ? '下一步：在下方选择默认服务，点击“保存功能设置”。服务卡片的启用状态不会替你完成这一步。' : !saved.enabled ? '下一步：打开上方“启用 AI”总开关。默认服务已保留。' : !saved.availability.connected ? saved.availability.reason : '已准备好。选择下方一个入口，主动发起 AI 操作。'}</p> : null}
      {failure || error ? <div role="alert" className="mt-2 text-sm text-error">{failure || error} <button type="button" className="focus-ring underline" onClick={() => { setFailure(undefined); void refresh(); }}>重新读取</button></div> : null}
      {message ? <p role="status" className="mt-2 text-xs text-muted">{message}</p> : null}
    </div>
    {saved?.enabled && !saved.availability.connected && !error ? <p className="text-sm text-warning">{saved.availability.reason} <a href={saved.defaultProviderId ? "#providers" : "#default-provider"} className="focus-ring underline">补充配置</a></p> : null}
    <form onSubmit={event => { event.preventDefault(); void save("configuration"); }} className="space-y-3">
      <h2 className="text-sm font-semibold text-ink">功能设置</h2>
      <div className="grid items-end gap-3 sm:grid-cols-2">
        <label className="block"><span className={formLabelClass}>默认使用的 AI 服务</span><Select id="default-provider" name="defaultProviderId" disabled={busy || !saved || Boolean(error)} value={draft.defaultProviderId} onChange={event => { setDraft({ ...draft, defaultProviderId: event.target.value }); setMessage(""); }}><option value="">未选择</option>{providers.map(provider => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</Select></label>
        <label className="flex min-h-10 items-center gap-2 text-sm"><input name="attachmentsEnabled" type="checkbox" disabled={busy || !saved || Boolean(error)} checked={draft.attachmentsEnabled} onChange={event => { setDraft({ ...draft, attachmentsEnabled: event.target.checked }); setMessage(""); }} className="h-4 w-4 accent-[var(--ink)]" />允许用户明确选择的附件</label>
      </div>
      <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={busy || !saved || Boolean(error)} size="sm">保存功能设置</Button><span className="text-xs text-muted">{dirty ? "有未保存的修改；总开关不会提交这些修改。" : "只发送明确选择的上下文，不授权整个项目上传。"}</span></div>
    </form>
    <nav aria-label="使用 AI" className="space-y-2 border-t border-hairline pt-4">
      <h2 className="text-base font-semibold">使用 AI</h2>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm"><Link prefetch={false} className="focus-ring inline-flex min-h-11 items-center font-medium text-moss underline" href="/actions/manual">打开 AI 工作台</Link><Link prefetch={false} className="focus-ring inline-flex min-h-11 items-center text-moss underline" href="/entries">从记录生成建议</Link><Link prefetch={false} className="focus-ring inline-flex min-h-11 items-center text-moss underline" href="/protocols/import">导入规程并提取参数</Link></div>
      <p className="text-xs text-muted">AI 建议需要人工核对；开启不会处理历史记录。规程体系、普通计算和实验执行均可在 AI 关闭时使用。</p>
    </nav>
  </section>;
}
