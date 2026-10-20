"use client";

import { useEffect, useId, useRef } from "react";

/** Keep floating controls in the top layer without detaching inputs from their form. */
export function useAnchoredPopover() {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = panel.current;
    const trigger = button.current;
    if (!element || !trigger) return;
    const place = () => {
      if (!element.matches(":popover-open") || !button.current) return;
      const viewport = window.visualViewport;
      const left = (viewport?.offsetLeft ?? 0) + 8;
      const top = (viewport?.offsetTop ?? 0) + 8;
      const right = left + (viewport?.width ?? window.innerWidth) - 16;
      const bottom = top + (viewport?.height ?? window.innerHeight) - 16;
      const anchor = button.current.getBoundingClientRect();
      if (anchor.bottom < top || anchor.top > bottom) {
        element.hidePopover();
        return;
      }
      element.style.maxWidth = `${right - left}px`;
      element.style.maxHeight = `${bottom - top}px`;
      const height = element.offsetHeight;
      const below = Math.max(0, bottom - anchor.bottom - 6);
      const above = Math.max(0, anchor.top - top - 6);
      const upward = height > below && above > below;
      element.style.maxHeight = `${upward ? above : below}px`;
      element.style.left = `${Math.max(left, Math.min(anchor.right - element.offsetWidth, right - element.offsetWidth))}px`;
      element.style.top = `${upward ? anchor.top - element.offsetHeight - 6 : anchor.bottom + 6}px`;
    };
    const toggle = () => {
      trigger.setAttribute("aria-expanded", String(element.matches(":popover-open")));
      place();
    };
    const openFromTrigger = (event: MouseEvent) => {
      // The native toggle event is queued. Position synchronously before the first visible frame.
      event.preventDefault();
      element.togglePopover();
      toggle();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !element.matches(":popover-open")) return;
      event.preventDefault();
      element.hidePopover();
      trigger.focus({ preventScroll: true });
    };
    trigger.addEventListener("click", openFromTrigger);
    element.addEventListener("toggle", toggle);
    window.addEventListener("keydown", escape);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { capture: true, passive: true });
    window.visualViewport?.addEventListener("resize", place);
    window.visualViewport?.addEventListener("scroll", place);
    return () => {
      element.removeEventListener("toggle", toggle);
      trigger.removeEventListener("click", openFromTrigger);
      window.removeEventListener("keydown", escape);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.visualViewport?.removeEventListener("resize", place);
      window.visualViewport?.removeEventListener("scroll", place);
    };
  }, []);

  const close = () => {
    if (panel.current?.matches(":popover-open")) panel.current.hidePopover();
  };
  return { id, button, panel, close };
}

export const anchoredPopoverStyle = {
  animation: "none",
  position: "fixed",
  inset: "auto",
  margin: 0,
  overflowY: "auto",
} as const;
