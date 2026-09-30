"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Secondary page actions behind one button. A native popover escapes the horizontally scrolling
 * action bar and stays mounted while closed, so dialogs opened from it (portaled) keep their state.
 */
export function PageActionsMenu({ children, label = "More actions" }: { children: ReactNode; label?: string }) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = panel.current;
    if (!element) return;
    const close = () => { if (element.matches(":popover-open")) element.hidePopover(); };
    const onToggle = (event: Event) => {
      if ((event as ToggleEvent).newState !== "open") return window.removeEventListener("scroll", close);
      const anchor = button.current!.getBoundingClientRect();
      element.style.top = `${anchor.bottom + 6}px`;
      element.style.left = `${Math.max(8, Math.min(anchor.right - element.offsetWidth, window.innerWidth - element.offsetWidth - 8))}px`;
      // Fixed to the viewport, so a scroll would detach it from its button.
      window.addEventListener("scroll", close, { once: true, passive: true });
    };
    element.addEventListener("toggle", onToggle);
    return () => { element.removeEventListener("toggle", onToggle); window.removeEventListener("scroll", close); };
  }, []);

  return <span className="contents">
    <button ref={button} type="button" popoverTarget={id} aria-label={label} title={label} className="focus-ring inline-flex w-9 shrink-0 items-center justify-center rounded-[var(--ln-radius-control-md)] border border-hairline bg-surface px-0 text-graphite hover:border-border-strong hover:bg-warm hover:text-ink">
      <MoreHorizontal className="h-4 w-4" aria-hidden />
    </button>
    <div ref={panel} id={id} popover="auto" onClick={() => { if (panel.current?.matches(":popover-open")) panel.current.hidePopover(); }} className="ln-actions-menu min-w-52 rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-surface p-1 shadow-soft">
      {children}
    </div>
  </span>;
}
