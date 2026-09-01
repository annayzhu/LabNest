"use client";

import { useEffect } from "react";
import { hydrateTypographyPreferences } from "@/lib/custom-font-storage";

export function TypographyBoot() {
  useEffect(() => {
    void hydrateTypographyPreferences().catch(() => {
      // IndexedDB may be disabled by the browser; preset fonts remain available.
    });
  }, []);

  return null;
}
