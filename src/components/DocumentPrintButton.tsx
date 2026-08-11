"use client";

import { Printer } from "lucide-react";

export function DocumentPrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      aria-label={label}
      title={label}
      className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-[7px] border border-hairline bg-surface p-0 text-graphite hover:border-border-strong hover:text-ink"
    >
      <Printer className="h-4 w-4" aria-hidden />
      <span className="sr-only">{label}</span>
    </button>
  );
}
