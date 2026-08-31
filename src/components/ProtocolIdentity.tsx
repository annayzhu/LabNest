import { cn } from "@/lib/cn";

export function ProtocolIdentity({
  title,
  code,
  version,
  meta,
  compact = false,
  className,
}: {
  title: string;
  code?: string | null;
  version?: string | null;
  meta?: string | null;
  compact?: boolean;
  className?: string;
}) {
  const secondary = [code, version ? `v${version.replace(/^v/i, "")}` : null, meta].filter(Boolean).join(" · ");
  return <span className={cn("block min-w-0", className)}>
    <span className={cn("block break-words font-semibold leading-snug", compact ? "text-xs" : "text-sm")}>{title}</span>
    {secondary ? <span className={cn("mt-0.5 block break-words font-mono font-normal text-muted", compact ? "text-[10px] leading-4" : "text-[11px] leading-4")}>{secondary}</span> : null}
  </span>;
}
