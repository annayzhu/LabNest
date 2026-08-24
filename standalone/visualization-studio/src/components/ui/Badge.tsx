import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "sage";

const toneClass: Record<BadgeTone, string> = {
  neutral: "border-hairline bg-stone text-graphite",
  success: "border-hairline bg-success-surface text-success",
  warning: "border-hairline bg-warning-surface text-warning",
  danger: "border-hairline bg-error-surface text-error",
  info: "border-hairline bg-info-surface text-info",
  sage: "border-hairline bg-sage-surface text-moss",
};

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: BadgeTone; className?: string }) {
  return <span className={cn("inline-flex min-h-6 items-center rounded-[var(--ln-radius-control-sm)] border px-2 py-0.5 text-[11px] font-medium leading-5", toneClass[tone], className)}>{children}</span>;
}
