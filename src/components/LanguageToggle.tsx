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
  return <div className="flex h-9 shrink-0 items-center rounded-[8px] border border-hairline bg-surface p-1 shadow-paper" role="group" aria-label="Switch language">
    <Languages className="mx-1 h-4 w-4 text-muted" aria-hidden />
    <button type="button" onClick={() => selectLocale("zh")} aria-pressed={locale === "zh"} className={`focus-ring h-7 rounded-[6px] px-2 text-[11px]! font-normal tracking-[0.01em] ${locale === "zh" ? "bg-sage-surface text-moss" : "text-muted hover:text-ink"}`}>中文</button>
    <button type="button" onClick={() => selectLocale("en")} aria-pressed={locale === "en"} className={`focus-ring h-7 rounded-[6px] px-2 text-[11px]! font-normal tracking-[0.01em] ${locale === "en" ? "bg-sage-surface text-moss" : "text-muted hover:text-ink"}`}>EN</button>
  </div>;
}
