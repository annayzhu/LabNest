"use client";

import { useEffect } from "react";
import { hydrateReferencedCustomFonts, hydrateTypographyPreferences } from "@/lib/custom-font-storage";
import { loadStoredLocalFontFamilies } from "@/lib/local-font-catalog";

export function TypographyBoot() {
  useEffect(() => {
    loadStoredLocalFontFamilies();
    let scheduled = false;
    const hydrate = () => void hydrateReferencedCustomFonts().catch(() => {
      // A missing local font falls back to the document's configured base face.
    });
    const scheduleHydration = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        hydrate();
      });
    };
    void hydrateTypographyPreferences().then(scheduleHydration).catch(() => {
      // IndexedDB may be disabled by the browser; preset fonts remain available.
    });
    const observer = new MutationObserver((records) => {
      const hasReferencedFont = records.some((record) => Array.from(record.addedNodes).some((node) => node instanceof HTMLElement
        && (node.matches('[data-labnest-font-family^="labnest-custom-"]') || Boolean(node.querySelector('[data-labnest-font-family^="labnest-custom-"]')))));
      if (hasReferencedFont) scheduleHydration();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
