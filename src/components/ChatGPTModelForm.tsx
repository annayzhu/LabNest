"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { refreshChatGPTModels, setChatGPTModel } from "@/app/settings/actions";
import type { ChatGPTEffort, ChatGPTModel } from "@/lib/chatgpt-auth";
import { formLabelClass } from "./forms";
import { useI18n } from "./I18nProvider";
import { Button } from "./ui/Button";
import { Select } from "./ui/Select";

const effortLabels: Record<ChatGPTEffort, string> = { none: "No reasoning", minimal: "Minimal reasoning", low: "Low reasoning", medium: "Medium reasoning", high: "High reasoning", xhigh: "Extra-high reasoning", max: "Maximum reasoning" };

/**
 * A ChatGPT subscription service's model and reasoning effort; the efforts offered are the chosen model's own. Each effort
 * also shows OpenAI's own name (low … max), as ChatGPT and Codex show it.
 */
export function ChatGPTModelForm({ providerId, models, model, effort }: { providerId: string; models: ChatGPTModel[]; model: string | null; effort: string | null }) {
  const { locale, t } = useI18n();
  const [slug, setSlug] = useState(model && models.some(entry => entry.slug === model) ? model : models[0].slug);
  const chosen = models.find(entry => entry.slug === slug) ?? models[0];
  const efforts = chosen.efforts ?? [];
  const [picked, setPicked] = useState(effort ?? "");
  const value = efforts.includes(picked as ChatGPTEffort) ? picked : "";
  const effortName = (level: ChatGPTEffort) => locale === "en" ? level : `${t(effortLabels[level])} · ${level}`;
  return <form action={setChatGPTModel} className="space-y-1">
    <input type="hidden" name="id" value={providerId} />
    <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto] sm:items-end">
      <label className="block min-w-0"><span className={formLabelClass}>Model</span><Select name="model" value={slug} onChange={event => setSlug(event.target.value)}>{models.map(entry => <option key={entry.slug} value={entry.slug}>{entry.displayName}</option>)}</Select></label>
      <label className="block min-w-0"><span className={formLabelClass}>Reasoning effort</span><Select name="effort" value={value} onChange={event => setPicked(event.target.value)} disabled={!efforts.length}>
        <option value="">{chosen.defaultEffort ? `${t("Model default")} · ${chosen.defaultEffort}` : t("Model default")}</option>
        {efforts.map(level => <option key={level} value={level}>{effortName(level)}</option>)}
      </Select></label>
      <Button type="submit" size="sm" className="sm:mb-px">Save</Button>
    </div>
    <button type="submit" formAction={refreshChatGPTModels} formNoValidate className="focus-ring inline-flex min-h-8 items-center gap-1 text-xs text-moss hover:underline"><RefreshCw className="h-3.5 w-3.5" aria-hidden />Refresh model list</button>
  </form>;
}
