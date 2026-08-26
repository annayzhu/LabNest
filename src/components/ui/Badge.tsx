import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { StatusTone } from "@/lib/types";

const toneClass: Record<StatusTone, string> = {
  neutral: "bg-stone text-graphite border-hairline",
  success: "bg-success-surface text-success border-hairline",
  warning: "bg-warning-surface text-warning border-hairline",
  danger: "bg-error-surface text-error border-hairline",
  info: "bg-info-surface text-info border-hairline",
  sage: "bg-sage-surface text-moss border-hairline",
};

const badgeClass =
  "inline-flex min-h-6 items-center rounded-[var(--ln-radius-control-sm)] border px-2 py-0.5 text-[11px] font-medium leading-5 tracking-[-0.005em]";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        badgeClass,
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function BadgeLink({
  children,
  href,
  tone = "neutral",
  className,
  title,
}: {
  children: ReactNode;
  href: string;
  tone?: StatusTone;
  className?: string;
  title?: string;
}) {
  return (
    <Link
      href={href}
      title={title}
      className={cn(
        badgeClass,
        "focus-ring transition hover:-translate-y-px hover:border-border-strong hover:bg-sage-surface/70 hover:text-ink",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </Link>
  );
}

const statusTone: Record<string, StatusTone> = {
  active: "success",
  running: "info",
  planned: "warning",
  pending: "warning",
  accepted: "info",
  executed: "success",
  completed: "success",
  failed: "danger",
  fail: "danger",
  pass: "success",
  valid: "success",
  warning: "warning",
  incomplete: "warning",
  invalid: "danger",
  not_applicable: "neutral",
  not_assessed: "neutral",
  rejected: "danger",
  archived: "neutral",
  draft: "sage",
  recorded: "info",
  submitted: "warning",
  reviewed: "success",
  ready_for_review: "warning",
  final: "success",
  quoted: "info",
  selected: "success",
  converted: "success",
  candidate: "info",
  not_selected: "neutral",
  expired: "neutral",
  duplicate: "neutral",
  future_candidate: "sage",
  ordered: "info",
  received: "success",
  stocked: "success",
  registered: "info",
  prepared: "sage",
  in_use: "warning",
  depleted: "neutral",
  discarded: "danger",
  inactive: "neutral",
  unverified: "neutral",
  validation_in_progress: "warning",
  validated_recommended: "success",
  validated_limited: "warning",
  validated_not_recommended: "danger",
  inconclusive: "warning",
};

export function StatusPill({ status, href }: { status: string; href?: string }) {
  const label = status.replaceAll("_", " ");
  const tone = statusTone[status] ?? "neutral";

  if (href) {
    return (
      <BadgeLink href={href} tone={tone} title={`Filter by ${label}`}>
        {label}
      </BadgeLink>
    );
  }

  return <Badge tone={tone}>{label}</Badge>;
}
