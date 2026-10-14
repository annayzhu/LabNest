"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveAIProvider } from "@/app/settings/actions";
import { deepseekProviderPreset } from "@/lib/ai-provider-presets";
import { sameProviderTarget } from "@/lib/ai-provider-input";
import { formInputClass, formLabelClass } from "@/components/forms";
import { Select } from "./ui/Select";
import { Button } from "@/components/ui/Button";
import { AiProviderTestButton } from "./AiProviderTestButton";
import { defaultProviderBaseUrls, providerTypeLabels, type AIProviderType } from "@/lib/ai";

export type AiProviderFormValues = {
  id: string; revision: string; name: string; type: AIProviderType; baseUrl: string;
  defaultModel: string; enabled: boolean; hasStoredKey: boolean;
};
const typeOrder: AIProviderType[] = ["openai_compatible", "openai", "anthropic", "dify", "manual_copy_paste"];
const typeHelp: Record<AIProviderType, { protocol: string; baseUrl: string; model: string; key: string }> = {
  dify: { protocol: "连接已发布的 Dify 应用，例如相应的浙大 AIHub 应用。", baseUrl: "填写应用提供的 API 地址，例如 https://aihub.zju.edu.cn/v1。", model: "可选说明，不改变实际模型；模型由 Dify 应用配置决定。", key: "填写该应用 API 访问页颁发的 app-… 密钥。" },
  openai_compatible: { protocol: "服务方明确支持 Chat Completions 时选择；直连 DeepSeek 使用此项。", baseUrl: "填写公共地址前缀；保留服务方要求的 /v1 或自定义前缀，不填写 /chat/completions。", model: "填写精确模型 ID，例如 deepseek-flash 或 deepseek-v4-pro，实际可用性以账号权限及测试为准。", key: "填写服务平台颁发的调用凭据，不是聊天账户密码。" },
  openai: { protocol: "连接 OpenAI 官方 API。", baseUrl: `留空使用 ${defaultProviderBaseUrls.openai}。`, model: "填写服务方提供的精确模型 ID。", key: "填写 OpenAI API 密钥。" },
  anthropic: { protocol: "服务方提供 Anthropic Messages 格式时选择。", baseUrl: `官方默认地址为 ${defaultProviderBaseUrls.anthropic}；其他服务按其说明填写。`, model: "填写服务方提供的精确模型 ID。", key: "填写适用于该接口的 API 密钥。" },
  manual_copy_paste: { protocol: "生成提示词，手动到外部聊天工具运行；无需配置联网接口。", baseUrl: "无需填写。", model: "无需填写。", key: "无需填写。" },
};

export function AiProviderForm({ provider }: { provider?: AiProviderFormValues }) {
  const [original] = useState(provider);
  const [state, formAction, pending] = useActionState(saveAIProvider, {});
  const [type, setType] = useState<AIProviderType>(provider?.type ?? "dify");
  const [name, setName] = useState(provider?.name ?? "");
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? "");
  const [defaultModel, setDefaultModel] = useState(provider?.defaultModel ?? "");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(provider?.enabled ?? true);
  const [epoch, setEpoch] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [router]);
  const isManual = type === "manual_copy_paste", help = typeHelp[type];
  const stale = original?.revision !== provider?.revision;
  const reusableKey = Boolean(original?.hasStoredKey && sameProviderTarget({ type, baseUrl }, original));
  const inputClass = `${formInputClass} min-w-0`;
  return <form ref={form} action={formAction} className="space-y-4" autoComplete="off" onChangeCapture={() => setEpoch(value => value + 1)}>
    {original ? <><input type="hidden" name="id" value={original.id} /><input type="hidden" name="revision" value={original.revision} /></> : null}
    {!original ? <div><Button type="button" disabled={pending} onClick={() => { setType(deepseekProviderPreset.type); setName(deepseekProviderPreset.name); setBaseUrl(deepseekProviderPreset.baseUrl); setDefaultModel(deepseekProviderPreset.defaultModel); setApiKey(""); setEpoch(value => value + 1); }}>使用 DeepSeek</Button><p className="mt-1 text-xs leading-5 text-muted">填入官方地址和 deepseek-flash；使用 V4 Pro 时将模型 ID 改为 deepseek-v4-pro。</p></div> : null}
    <fieldset disabled={pending || stale} className="min-w-0 space-y-4">
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <label className="block min-w-0"><span className={formLabelClass}>服务名称</span><input name="name" required maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="例如 DeepSeek 官方" className={inputClass} /><span className="mt-1 block text-xs leading-5 text-muted">仅供自己识别，不决定服务商或协议。</span></label>
        <label className="block min-w-0"><span className={formLabelClass}>接口类型</span><Select name="type" value={type} onChange={event => { setType(event.target.value as AIProviderType); setApiKey(""); }}>{typeOrder.map(value => <option key={value} value={value}>{providerTypeLabels[value]}</option>)}</Select><span className="mt-1 block text-xs leading-5 text-muted">{help.protocol}</span></label>
        {!isManual ? <>
          <label className="block min-w-0 md:col-span-2"><span className={formLabelClass}>API 基础地址</span><input name="baseUrl" type="url" required={type === "openai_compatible" || type === "dify"} maxLength={300} value={baseUrl} onChange={event => { setBaseUrl(event.target.value); setApiKey(""); }} placeholder={defaultProviderBaseUrls[type] ?? "https://api.deepseek.com"} className={inputClass} /><span className="mt-1 block text-xs leading-5 text-muted">{help.baseUrl} 更换地址或接口类型后，需重新填写适用的密钥。</span></label>
          <label className="block min-w-0 md:col-span-2"><span className={formLabelClass}>{type === "dify" ? "模型说明（可选）" : "默认模型 / 模型 ID"}</span><input name="defaultModel" required={type !== "dify"} maxLength={120} value={defaultModel} onChange={event => setDefaultModel(event.target.value)} className={inputClass} /><span className="mt-1 block text-xs leading-5 text-muted">{help.model}</span></label>
          <div className="min-w-0 space-y-2 md:col-span-2"><label className="block"><span className={formLabelClass}>API 密钥</span><input name="apiKey" type="password" required={!reusableKey} maxLength={2000} value={apiKey} onChange={event => setApiKey(event.target.value)} autoComplete="new-password" placeholder={reusableKey ? "留空保留已保存的密钥" : "填写当前目标的 API 密钥"} className={inputClass} /><span className="mt-1 block text-xs leading-5 text-muted">{help.key} 密钥只在服务器加密保存，不回显。</span></label>
            <AiProviderTestButton epoch={epoch} revision={original?.revision} enabled={enabled} disabledReason={stale ? "服务已在其他页面修改，请重新加载后测试。" : original?.enabled === false ? "此服务已停用，请先保存启用此服务。" : pending ? "正在保存配置。" : undefined} draft={{ id: original?.id, revision: original?.revision, name, type, baseUrl, defaultModel, apiKey, enabled }} validate={() => form.current?.reportValidity() ?? false} onInvalid={field => { const input = form.current?.elements.namedItem(field); if (input instanceof HTMLElement) input.focus(); }} />
          </div>
        </> : null}
      </div>
      <label className="flex min-h-10 items-center gap-3 text-sm"><input name="enabled" type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} className="h-4 w-4 accent-[var(--ink)]" />启用此服务</label>
    </fieldset>
    {stale ? <p role="alert" className="rounded-[var(--ln-radius-control-lg)] bg-error-surface p-3 text-sm text-error">服务配置已在其他页面改变，本页草稿尚未保存。请先复制需要保留的内容，再<button type="button" onClick={() => window.location.reload()} className="focus-ring underline">重新加载</button>。</p> : null}
    {state.error ? <p role="alert" className="rounded-[var(--ln-radius-control-lg)] bg-error-surface p-3 text-sm text-error">{state.error}</p> : null}
    <div className="flex flex-wrap items-center gap-2"><Button type="submit" variant="primary" disabled={pending || stale}>{pending ? "正在保存…" : original ? "保存服务" : "添加服务"}</Button>{original ? <a href="/ai#providers" className="focus-ring inline-flex h-10 items-center px-3 text-sm font-medium text-moss">取消</a> : null}</div>
    <p className="text-xs leading-5 text-muted">测试不会保存。添加或保存服务后，还需在“默认使用的 AI 服务”中选择，并点击“保存功能设置”。</p>
  </form>;
}
