"use client";

import {useEffect,useState} from "react";
import { Check } from "lucide-react";
import {useAppearance} from "./AppearanceProvider";
import { TraditionalMotif, type TraditionalMotifName } from "@/components/TraditionalMotif";
import { systemThemes, resolvedThemeTokens, type SystemThemeId } from "@/lib/system-theme";

export function SystemThemePicker() {
  const {preferences,setAppearance}=useAppearance();
  const [systemDark,setSystemDark]=useState(false);
  useEffect(()=>{const media=matchMedia('(prefers-color-scheme: dark)');const update=()=>setSystemDark(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
  const mode=preferences.mode==='system'?(systemDark?'dark':'light'):preferences.mode;
  const selectedTheme=preferences.colorSchemeId;
  const selectTheme=(colorSchemeId:SystemThemeId)=>setAppearance({colorSchemeId});

  return (
    <fieldset>
      <legend className="sr-only">System style</legend>
      <div className="system-theme-grid">
        {systemThemes.map((theme) => {
          const tokens=resolvedThemeTokens(theme.id,mode);
          const selected = selectedTheme === theme.id;
          return (
            <label
              key={theme.id}
              className="system-theme-option"
              data-selected={selected ? "true" : undefined}
            >
              <input className="sr-only" type="radio" name="system-theme" value={theme.id} checked={selected} onChange={() => selectTheme(theme.id)} />
              <span className="system-theme-preview" data-preview-mode={mode} aria-hidden>
                <span style={{ backgroundColor: tokens['--paper'] }} />
                <span style={{ backgroundColor: tokens['--moss'] }} />
                <span style={{ backgroundColor: tokens['--nav-active-bg'] }} />
                <TraditionalMotif motif={theme.motif as TraditionalMotifName} className="system-theme-preview-motif" />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="system-theme-option-name flex items-center gap-2 text-[13px] font-semibold text-ink">
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
