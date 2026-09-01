"use client";

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { TraditionalMotif, type TraditionalMotifName } from "@/components/TraditionalMotif";
import { isSystemThemeId, systemThemes, systemThemeStorageKey, type SystemThemeId } from "@/lib/system-theme";

export function SystemThemePicker() {
  const [selectedTheme, setSelectedTheme] = useState<SystemThemeId>("moon-dai");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(systemThemeStorageKey);
    if (isSystemThemeId(storedTheme)) queueMicrotask(() => setSelectedTheme(storedTheme));
  }, []);

  function selectTheme(themeId: SystemThemeId) {
    setSelectedTheme(themeId);
    document.documentElement.setAttribute("data-labnest-theme", themeId);
    window.localStorage.setItem(systemThemeStorageKey, themeId);
  }

  return (
    <fieldset>
      <legend className="sr-only">System style</legend>
      <div className="system-theme-grid">
        {systemThemes.map((theme) => {
          const selected = selectedTheme === theme.id;
          return (
            <label
              key={theme.id}
              className="system-theme-option"
              data-selected={selected ? "true" : undefined}
            >
              <input className="sr-only" type="radio" name="system-theme" value={theme.id} checked={selected} onChange={() => selectTheme(theme.id)} />
              <span className="system-theme-preview" aria-hidden>
                <span style={{ backgroundColor: theme.colors[0] }} />
                <span style={{ backgroundColor: theme.colors[1] }} />
                <span style={{ backgroundColor: theme.colors[2] }} />
                <TraditionalMotif motif={theme.motif as TraditionalMotifName} className="system-theme-preview-motif" />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                  {theme.name}
                  {selected ? <Check className="h-3.5 w-3.5 text-moss" aria-hidden /> : null}
                </span>
                <span className="mt-1 block text-[11px] leading-[1.45] text-muted">{theme.description}</span>
              </span>
            </label>
          );
        })}
      </div>
      <p className="mt-3 text-xs leading-5 text-muted">即时应用于整个系统，并保存在当前浏览器中；不会改变科研图表的配色方案。</p>
    </fieldset>
  );
}
