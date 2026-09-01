"use client";

import { Printer } from "lucide-react";

export function DocumentPrintButton({ label = "Print", showLabel = false }: { label?: string; showLabel?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      aria-label={label}
      title={label}
      className={`focus-ring inline-flex h-7 items-center justify-center gap-1.5 rounded-[var(--ln-radius-control-sm)] border border-hairline bg-surface text-graphite hover:border-border-strong hover:text-ink ${showLabel ? "w-auto px-2" : "w-7 p-0"}`}
    >
      <Printer className="h-3.5 w-3.5" aria-hidden />
      <span className={showLabel ? "text-[11px] font-medium" : "sr-only"}>{label}</span>
    </button>
  );
}
