"use client";

import { MoreHorizontal } from "lucide-react";
import { useContext, type ReactNode } from "react";
import { InPageMenu } from "./MobilePageMenu";
import { anchoredPopoverStyle, useAnchoredPopover } from "@/components/ui/useAnchoredPopover";

/**
 * Secondary page actions behind one button. A native popover escapes the horizontally scrolling
 * action bar and stays mounted while closed, so dialogs opened from it (portaled) keep their state.
 */
export function PageActionsMenu({ children, label = "More actions" }: { children: ReactNode; label?: string }) {
  if (useContext(InPageMenu)) return <div className="ln-actions-menu ln-actions-menu-inline">{children}</div>;
  return <PopoverActionsMenu label={label}>{children}</PopoverActionsMenu>;
}

function PopoverActionsMenu({ children, label }: { children: ReactNode; label: string }) {
  const { id, button, panel, close } = useAnchoredPopover();

  return <span className="contents">
    <button ref={button} type="button" popoverTarget={id} aria-label={label} title={label} className="focus-ring inline-flex w-9 shrink-0 items-center justify-center rounded-[var(--ln-radius-control-md)] border border-hairline bg-surface px-0 text-graphite hover:border-border-strong hover:bg-warm hover:text-ink">
      <MoreHorizontal className="h-4 w-4" aria-hidden />
    </button>
    <div ref={panel} id={id} popover="auto" onClick={close} style={anchoredPopoverStyle} className="ln-actions-menu min-w-52 rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-surface p-1 shadow-soft">
      {children}
    </div>
  </span>;
}
