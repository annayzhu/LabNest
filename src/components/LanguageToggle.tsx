"use client";

import { Languages } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";

export function LanguageToggle() {
  const { locale, setLocale } = useI18n();
  const selectLocale = (nextLocale: "en" | "zh") => {
    setLocale(nextLocale);
  };
  return <div className="flex h-9 shrink-0 items-center rounded-[var(--ln-radius-control-lg)] border border-hairline bg-stone/45 p-1" role="group" aria-label="Switch language">
    <Languages className="mx-1 h-4 w-4 text-muted" aria-hidden />
    <button type="button" onClick={() => selectLocale("zh")} aria-pressed={locale === "zh"} className={`focus-ring h-7 rounded-[var(--ln-radius-control-sm)] px-2 text-[11px]! font-normal tracking-[-0.005em] transition ${locale === "zh" ? "bg-surface font-semibold text-moss shadow-[inset_0_-2px_0_var(--action)]" : "text-muted hover:bg-surface/70 hover:text-ink"}`}>中文</button>
    <button type="button" onClick={() => selectLocale("en")} aria-pressed={locale === "en"} className={`focus-ring h-7 rounded-[var(--ln-radius-control-sm)] px-2 text-[11px]! font-normal tracking-[-0.005em] transition ${locale === "en" ? "bg-surface font-semibold text-moss shadow-[inset_0_-2px_0_var(--action)]" : "text-muted hover:bg-surface/70 hover:text-ink"}`}>EN</button>
  </div>;
}
