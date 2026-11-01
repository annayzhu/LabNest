import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type SectionTab = { key: string; href: string; label: string; icon: LucideIcon; count?: number };

/**
 * A module's pages, or a page's parts, as one row of tabs under the title. The selected tab has a moss label, an
 * underline and a low tint; a tab with a count shows how many records it lists (Q179).
 */
export function SectionTabs({ name, tabs, current }: { name: string; tabs: readonly SectionTab[]; current: string }) {
  return (
    <nav aria-label={name} className="editorial-scrollbar flex gap-1 overflow-x-auto border-b border-hairline">
      {tabs.map(({ key, href, label, icon: Icon, count }) => {
        const active = key === current;
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "focus-ring -mb-px inline-flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors",
              active ? "border-moss bg-sage-surface/60 text-moss" : "border-transparent text-graphite hover:bg-warm hover:text-ink",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span>{label}</span>
            {count !== undefined ? <span className={cn("rounded-full px-1.5 text-xs font-semibold leading-5 tabular-nums", active ? "bg-surface text-moss" : "bg-stone text-muted")}>{count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
