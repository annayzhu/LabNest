"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** Copies a value, such as a sequence, and says so for a moment. */
export function CopyTextButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* the browser refused; the text stays selectable */ }
  }
  return (
    <button type="button" onClick={() => void copy()} className="focus-ring inline-flex h-7 items-center gap-1.5 rounded-[var(--ln-radius-control-sm)] px-2 text-xs font-medium text-moss hover:bg-sage-surface/60">
      {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}<span>{copied ? "Copied" : label}</span>
    </button>
  );
}
