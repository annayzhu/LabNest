"use client";

import { Printer } from "lucide-react";

export function DocumentPrintButton({ label = "Print", showLabel = false }: { label?: string; showLabel?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      aria-label={label}
      title={label}
      className={`focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-[7px] border border-hairline bg-surface text-graphite hover:border-border-strong hover:text-ink ${showLabel ? "w-auto px-3" : "w-9 p-0"}`}
    >
      <Printer className="h-4 w-4" aria-hidden />
      <span className={showLabel ? "text-xs font-medium" : "sr-only"}>{label}</span>
    </button>
  );
}
