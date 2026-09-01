"use client";

import { useEffect } from "react";
import { listCustomFonts, loadCustomFont } from "@/lib/custom-font-storage";
import {
  applyTypographySettings,
  parseTypographySettings,
  settingsWithoutCustomFont,
  typographySettingsStorageKey,
} from "@/lib/typography-settings";

export function TypographyBoot() {
  useEffect(() => {
    let active = true;
    const settings = parseTypographySettings(window.localStorage.getItem(typographySettingsStorageKey));
    applyTypographySettings(settings);

    void listCustomFonts().then(async (fonts) => {
      if (!active) return;
      const availableIds = new Set(fonts.map((font) => font.id));
      let resolvedSettings = settings;
      Object.values(settings).forEach((selection) => {
        if (selection.kind === "custom" && !availableIds.has(selection.id)) {
          resolvedSettings = settingsWithoutCustomFont(resolvedSettings, selection.id);
        }
      });
      if (resolvedSettings !== settings) applyTypographySettings(resolvedSettings);
      const selectedIds = new Set(Object.values(resolvedSettings).flatMap((selection) => selection.kind === "custom" ? [selection.id] : []));
      await Promise.allSettled(fonts.filter((font) => selectedIds.has(font.id)).map(loadCustomFont));
    }).catch(() => {
      // IndexedDB may be disabled by the browser; preset fonts remain available.
    });

    return () => { active = false; };
  }, []);

  return null;
}
