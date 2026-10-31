"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveAIProvider } from "@/app/settings/actions";
import { providerPresets } from "@/lib/ai-provider-presets";
import { sameProviderTarget } from "@/lib/ai-provider-input";
import { formInputClass, formLabelClass } from "@/components/forms";
import { Select } from "./ui/Select";
import { Button, buttonStyles } from "@/components/ui/Button";
import { AiProviderTestButton } from "./AiProviderTestButton";
import { useI18n } from "./I18nProvider";
import { defaultProviderBaseUrls, providerTypeLabels, type AIProviderType } from "@/lib/ai";

/** The interface types this form sets up; a ChatGPT subscription is set up by signing in instead. */
type FormProviderType = Exclude<AIProviderType, "chatgpt_subscription">;
export type AiProviderFormValues = {
  id: string; revision: string; name: string; type: FormProviderType; baseUrl: string;
  defaultModel: string; enabled: boolean; hasStoredKey: boolean;
};
const typeOrder: FormProviderType[] = ["openai_compatible", "openai", "anthropic", "dify", "manual_copy_paste"];
const typeHelp: Record<FormProviderType, { protocol: string; baseUrl: string; model: string; key: string }> = {
  dify: { protocol: "Connects a published Dify app, such as the matching ZJU AIHub app.", baseUrl: "Enter the API address the app provides, such as https://aihub.zju.edu.cn/v1.", model: "An optional note; it does not change the actual model, which the Dify app sets.", key: "Enter the app-… key issued on the app’s API access page." },
  openai_compatible: { protocol: "Choose this when the provider explicitly supports Chat Completions; use it to connect DeepSeek directly.", baseUrl: "Enter the public address prefix; keep the /v1 or custom prefix the provider requires, without /chat/completions.", model: "Enter the exact model ID, such as deepseek-flash or deepseek-v4-pro; what is actually available depends on account permissions and testing.", key: "Enter the API credential the platform issued, not a chat account password." },
  openai: { protocol: "Connects the official OpenAI API.", baseUrl: `Leave empty to use ${defaultProviderBaseUrls.openai}.`, model: "Enter the exact model ID the provider gives.", key: "Enter an OpenAI API key." },
  anthropic: { protocol: "Choose this when the provider offers the Anthropic Messages format.", baseUrl: `The official default address is ${defaultProviderBaseUrls.anthropic}; for other services, follow their instructions.`, model: "Enter the exact model ID the provider gives.", key: "Enter an API key that works with this interface." },
  manual_copy_paste: { protocol: "Generates a prompt to run by hand in an outside chat tool; no network interface to configure.", baseUrl: "Not needed.", model: "Not needed.", key: "Not needed." },
};

/** Sign in with ChatGPT: a link on this computer, else where to open the page instead (OpenAI returns only to 127.0.0.1). */
export type ChatGPTSignInEntry = { href: string } | { localUrl: string };

/** The API-key choices: the presets, then any service filled in by hand. Each shows only its own note. */
const keyChoices = [...providerPresets, { label: "other service", preset: undefined, note: "Fill in any service yourself and choose its interface type below.", keyPage: undefined }];
const blockClass = "space-y-3 rounded-[var(--ln-radius-panel-inner)] border border-hairline p-3";

/** Adding a service: sign in with a subscription, or add one with an API key. Editing shows only the key form. */
export function AiProviderForm({ provider, chatGPT }: { provider?: AiProviderFormValues; chatGPT?: ChatGPTSignInEntry }) {
  // One sentence wraps a button; its spacing and full stop follow the language.
  const { locale, t } = useI18n();
  const [original] = useState(provider);
  const [state, formAction, pending] = useActionState(saveAIProvider, {});
  const [type, setType] = useState<FormProviderType>(provider?.type ?? "dify");
  const [name, setName] = useState(provider?.name ?? "");
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? "");
  const [defaultModel, setDefaultModel] = useState(provider?.defaultModel ?? "");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(provider?.enabled ?? true);
  const [epoch, setEpoch] = useState(0);
  const [choice, setChoice] = useState<string>();
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
  const chosenNote = keyChoices.find(entry => entry.label === choice)?.note;
  return <div className="space-y-3">
    {!original && chatGPT ? <section aria-label="Sign in with a subscription" className={blockClass}>
      <h4 className="text-sm font-semibold text-ink">Sign in with a subscription</h4>
      {"href" in chatGPT
        ? <a href={chatGPT.href} className={buttonStyles({ variant: "primary" })}>Sign in with ChatGPT</a>
        : <p className="text-xs leading-5 text-muted">{t("To use a ChatGPT subscription, open this page on the computer that runs LabNest and sign in there:")}{locale === "en" ? " " : null}<a href={chatGPT.localUrl} className="focus-ring break-all font-mono text-moss underline">{chatGPT.localUrl}</a><button type="button" onClick={() => void navigator.clipboard?.writeText(chatGPT.localUrl)} className="focus-ring ml-2 text-moss underline">{t("Copy link")}</button></p>}
      <p className="text-xs leading-5 text-muted">Sign in with ChatGPT uses your Plus or Pro plan instead of an API key; usage counts toward the plan’s limits.</p>
    </section> : null}
  <form ref={form} action={formAction} className={original ? "space-y-4" : `${blockClass} space-y-4`} autoComplete="off" onChangeCapture={() => setEpoch(value => value + 1)}>
    {original ? <><input type="hidden" name="id" value={original.id} /><input type="hidden" name="revision" value={original.revision} /></> : null}
    {!original ? <div className="space-y-2">
      <h4 className="text-sm font-semibold text-ink">Add with an API key</h4>
      <div role="group" aria-label="Add with an API key" className="flex flex-wrap gap-2">{keyChoices.map(({ label, preset, keyPage }) => <Button key={label} type="button" variant={choice === label ? "primary" : "secondary"} aria-pressed={choice === label} disabled={pending} onClick={() => {
        setChoice(label); setApiKey(""); setEpoch(value => value + 1);
        if (preset) { setType(preset.type); setName(preset.name); setBaseUrl(preset.baseUrl); setDefaultModel(preset.defaultModel); }
        else { setType("openai_compatible"); setName(""); setBaseUrl(""); setDefaultModel(""); }
        if (keyPage) window.open(keyPage, "_blank", "noopener,noreferrer");
      }}>{`Use ${label}`}</Button>)}</div>
      {chosenNote ? <p className="text-xs leading-5 text-muted">{chosenNote}</p> : null}
    </div> : null}
    <fieldset disabled={pending || stale} className="min-w-0 space-y-4">
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <label className="block min-w-0"><span className={formLabelClass}>Service name</span><input name="name" required maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="Such as DeepSeek official" className={inputClass} /><span className="mt-1 block text-xs leading-5 text-muted">Only for you to recognize it; it does not set the provider or protocol.</span></label>
        <label className="block min-w-0"><span className={formLabelClass}>Interface type</span><Select name="type" value={type} onChange={event => { setType(event.target.value as FormProviderType); setApiKey(""); }}>{typeOrder.map(value => <option key={value} value={value}>{providerTypeLabels[value]}</option>)}</Select><span className="mt-1 block text-xs leading-5 text-muted">{help.protocol}</span></label>
        {!isManual ? <>
          <label className="block min-w-0 md:col-span-2"><span className={formLabelClass}>API base URL</span><input name="baseUrl" type="url" required={type === "openai_compatible" || type === "dify"} maxLength={300} value={baseUrl} onChange={event => { setBaseUrl(event.target.value); setApiKey(""); }} placeholder={defaultProviderBaseUrls[type] ?? "https://api.deepseek.com"} className={inputClass} /><span className="mt-1 block text-xs leading-5 text-muted">{`${help.baseUrl} After changing the address or interface type, enter a key that works with them again.`}</span></label>
          <label className="block min-w-0 md:col-span-2"><span className={formLabelClass}>{type === "dify" ? "Model note (optional)" : "Default model / model ID"}</span><input name="defaultModel" required={type !== "dify"} maxLength={120} value={defaultModel} onChange={event => setDefaultModel(event.target.value)} className={inputClass} /><span className="mt-1 block text-xs leading-5 text-muted">{help.model}</span></label>
          <div className="min-w-0 space-y-2 md:col-span-2"><label className="block"><span className={formLabelClass}>API key</span><input name="apiKey" type="password" required={!reusableKey} maxLength={2000} value={apiKey} onChange={event => setApiKey(event.target.value)} autoComplete="new-password" placeholder={reusableKey ? "Leave empty to keep the saved key" : "Enter the API key for this target"} className={inputClass} /><span className="mt-1 block text-xs leading-5 text-muted">{`${help.key} The key is stored only encrypted on the server and never shown again.`}</span></label>
            <AiProviderTestButton epoch={epoch} revision={original?.revision} enabled={enabled} disabledReason={stale ? "The service was changed on another page; reload before testing." : original?.enabled === false ? "This service is disabled; save it enabled first." : pending ? "Saving the setup." : undefined} draft={{ id: original?.id, revision: original?.revision, name, type, baseUrl, defaultModel, apiKey, enabled }} validate={() => form.current?.reportValidity() ?? false} onInvalid={field => { const input = form.current?.elements.namedItem(field); if (input instanceof HTMLElement) input.focus(); }} />
          </div>
        </> : null}
      </div>
      <label className="flex min-h-10 items-center gap-3 text-sm"><input name="enabled" type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} className="h-4 w-4 accent-[var(--ink)]" />Enable this service</label>
    </fieldset>
    {stale ? <p role="alert" className="rounded-[var(--ln-radius-control-lg)] bg-error-surface p-3 text-sm text-error">{t("The service setup changed on another page and this draft is not saved. Copy what you want to keep first, then")}{locale === "en" ? " " : null}<button type="button" onClick={() => window.location.reload()} className="focus-ring underline">{t("reload")}</button>{locale === "en" ? "." : t("(full stop)")}</p> : null}
    {state.error ? <p role="alert" className="rounded-[var(--ln-radius-control-lg)] bg-error-surface p-3 text-sm text-error">{state.error}</p> : null}
    <div className="flex flex-wrap items-center gap-2"><Button type="submit" variant="primary" disabled={pending || stale}>{pending ? "Saving the service…" : original ? "Save service" : "Add service"}</Button>{original ? <a href="/ai#providers" className="focus-ring inline-flex h-10 items-center px-3 text-sm font-medium text-moss">Cancel</a> : null}</div>
    <p className="text-xs leading-5 text-muted">Testing does not save. After adding or saving a service, choose it under “Default AI service” and click “Save feature settings”.</p>
  </form>
  </div>;
}
