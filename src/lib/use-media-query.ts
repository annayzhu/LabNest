"use client";

import { useSyncExternalStore } from "react";

/** Whether a CSS media query matches, kept current as the window changes. False on the server. */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => { const list = window.matchMedia(query); list.addEventListener("change", onChange); return () => list.removeEventListener("change", onChange); },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
