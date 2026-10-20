"use client";

import type { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { anchoredPopoverStyle, useAnchoredPopover } from "./useAnchoredPopover";

/** Server-rendered filter forms stay in their original DOM and submit normally. */
export function FilterPopover({ children, count }: { children: ReactNode; count: number }) {
  const { id, button, panel } = useAnchoredPopover();
  return <div className="md:hidden">
    <button ref={button} type="button" popoverTarget={id} aria-expanded={false}
      className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-[var(--ln-radius-control-md)] border border-hairline bg-surface px-3 text-sm text-graphite">
      <SlidersHorizontal className="h-4 w-4" aria-hidden />Filters
      {count ? <span className="text-moss">{count}</span> : null}
    </button>
    <div ref={panel} id={id} popover="auto" style={anchoredPopoverStyle}
      className="w-80 rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-surface p-3 shadow-soft">
      {children}
    </div>
  </div>;
}
