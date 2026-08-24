"use client";

import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";

export function LanguageToggle() {
  const { locale, setLocale } = useI18n();
  const router = useRouter();
  const selectLocale = (nextLocale: "en" | "zh") => {
    setLocale(nextLocale);
    router.refresh();
  };
  return <div className="flex h-9 shrink-0 items-center rounded-[var(--ln-radius-control-lg)] border border-hairline bg-surface p-1" role="group" aria-label="Switch language">
    <Languages className="mx-1 h-4 w-4 text-muted" aria-hidden />
    <button type="button" onClick={() => selectLocale("zh")} aria-pressed={locale === "zh"} className={`focus-ring h-7 rounded-[var(--ln-radius-control-sm)] px-2 text-[11px]! font-normal tracking-[-0.005em] transition ${locale === "zh" ? "bg-action-surface text-moss" : "text-muted hover:bg-stone/70 hover:text-ink"}`}>中文</button>
    <button type="button" onClick={() => selectLocale("en")} aria-pressed={locale === "en"} className={`focus-ring h-7 rounded-[var(--ln-radius-control-sm)] px-2 text-[11px]! font-normal tracking-[-0.005em] transition ${locale === "en" ? "bg-action-surface text-moss" : "text-muted hover:bg-stone/70 hover:text-ink"}`}>EN</button>
  </div>;
}
