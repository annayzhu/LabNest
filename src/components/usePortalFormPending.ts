"use client";

import { useEffect, useState, type RefObject } from "react";

/** Native form ownership does not propagate inert to body portals. Mirror it
 * before a user can focus a stale control, and retain React's rendered state. */
export function usePortalFormPending(
  anchor: RefObject<HTMLElement | null>,
  portal: RefObject<HTMLElement | null>,
  mounted: boolean,
): boolean {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!mounted) return;
    const form = anchor.current?.closest("form"), element = portal.current;
    if (!form || !element) return;
    let active = true;
    const sync = () => {
      const busy = form.inert || form.getAttribute("aria-busy") === "true";
      element.inert = busy || element.getAttribute("aria-hidden") === "true";
      queueMicrotask(() => { if (active) setPending(busy); });
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(form, { attributes: true, attributeFilter: ["inert", "aria-busy"] });
    return () => { active = false; observer.disconnect(); };
  }, [anchor, portal, mounted]);
  return pending;
}
