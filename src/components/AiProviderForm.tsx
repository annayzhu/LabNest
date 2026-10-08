"use client";

import { useActionState, useState } from "react";
import { saveAIProvider } from "@/app/settings/actions";
import { formInputClass, formLabelClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { defaultProviderBaseUrls, providerTypeLabels, type AIProviderType } from "@/lib/ai";

export type AiProviderFormValues = {
  id: string;
  name: string;
  type: AIProviderType;
  baseUrl: string;
  defaultModel: string;
  enabled: boolean;
  hasStoredKey: boolean;
};

const typeOrder: AIProviderType[] = ["dify", "openai_compatible", "openai", "anthropic", "manual_copy_paste"];

const typeHelp: Record<AIProviderType, { baseUrl: string; model: string; key: string }> = {
  dify: {
    baseUrl: "The Dify API root of the app, e.g. https://aihub.zju.edu.cn/v1",
    model: "Optional label. The model is chosen inside the Dify app.",
    key: "The app-… API key issued by the Dify app's API access page.",
  },
  openai_compatible: {
    baseUrl: "Any /v1 root that speaks Chat Completions, e.g. https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "Model name as the endpoint expects it, e.g. qwen-plus.",
    key: "Bearer token for the endpoint.",
  },
  openai: { baseUrl: `Defaults to ${defaultProviderBaseUrls.openai}.`, model: "e.g. gpt-4.1-mini", key: "OpenAI API key." },
  anthropic: { baseUrl: `Defaults to ${defaultProviderBaseUrls.anthropic}.`, model: "e.g. claude-sonnet-5-5", key: "Anthropic API key." },
  manual_copy_paste: { baseUrl: "Not used.", model: "Not used.", key: "Not used. Prompts are copied to an external chat window." },
};

export function AiProviderForm({ provider }: { provider?: AiProviderFormValues }) {
  const [state, formAction, pending] = useActionState(saveAIProvider, {});
  const [type, setType] = useState<AIProviderType>(provider?.type ?? "dify");
  const help = typeHelp[type];
  const isManual = type === "manual_copy_paste";
  const editing = Boolean(provider);

  return (
    <form action={formAction} className="space-y-4" autoComplete="off">
      {provider ? <input type="hidden" name="id" value={provider.id} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className={formLabelClass}>Provider name</span>
          <input name="name" required defaultValue={provider?.name ?? ""} placeholder="ZJU aihub · lab notebook assistant" className={formInputClass} />
        </label>
        <label className="block">
          <span className={formLabelClass}>Type</span>
          <select name="type" value={type} onChange={(event) => setType(event.target.value as AIProviderType)} className={formInputClass}>
            {typeOrder.map((value) => (
              <option key={value} value={value}>{providerTypeLabels[value]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={formLabelClass}>Base URL</span>
          <input name="baseUrl" defaultValue={provider?.baseUrl ?? ""} disabled={isManual} placeholder={defaultProviderBaseUrls[type] ?? "https://…/v1"} className={formInputClass} />
          <span className="mt-1 block text-xs leading-5 text-muted">{help.baseUrl}</span>
        </label>
        <label className="block">
          <span className={formLabelClass}>Default model</span>
          <input name="defaultModel" defaultValue={provider?.defaultModel ?? ""} disabled={isManual} className={formInputClass} />
          <span className="mt-1 block text-xs leading-5 text-muted">{help.model}</span>
        </label>
        <label className="block md:col-span-2">
          <span className={formLabelClass}>API key</span>
          <input
            name="apiKey"
            type="password"
            autoComplete="new-password"
            disabled={isManual}
            placeholder={editing && provider?.hasStoredKey ? "Leave blank to keep the stored key" : "Required for connected providers"}
            className={formInputClass}
          />
          <span className="mt-1 block text-xs leading-5 text-muted">{help.key} Stored encrypted on the server; never shown again.</span>
        </label>
      </div>
      <label className="flex items-center gap-3 text-sm text-graphite">
        <input name="enabled" type="checkbox" defaultChecked={provider?.enabled ?? true} className="h-4 w-4 accent-[var(--moss)]" />
        Provider enabled
      </label>
      {state.error ? (
        <p role="alert" className="rounded-[var(--ln-radius-panel-inner)] border border-error/30 bg-error-surface p-3 text-sm text-ink">{state.error}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary" disabled={pending}>{editing ? "Save provider" : "Add provider"}</Button>
        {editing ? <a href="/settings#providers" className="focus-ring inline-flex h-10 items-center rounded-[var(--ln-radius-control-lg)] px-3 text-sm font-medium text-moss">Cancel</a> : null}
      </div>
    </form>
  );
}
