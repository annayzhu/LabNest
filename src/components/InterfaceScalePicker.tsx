"use client";

import { Check } from "lucide-react";
import {useAppearance} from "./AppearanceProvider";
import { useI18n } from "@/components/I18nProvider";
import { uiScaleOptions, type UiScaleId } from "@/lib/ui-scale";

export function InterfaceScalePicker() {
  const { locale } = useI18n();
  const zh = locale === "zh";
  const {preferences,setAppearance}=useAppearance();
  const selected=preferences.uiScaleId;
  const choose=(uiScaleId:UiScaleId)=>setAppearance({uiScaleId});

  return (
    <fieldset className="interface-scale-picker">
      <legend>{zh ? "界面字号" : "Interface size"}</legend>
      <p>{zh ? "调整导航、搜索、表格和表单的字号；A4 文档与打印尺寸不会改变。" : "Adjust navigation, search, tables, and forms. A4 document and print sizing stays unchanged."}</p>
      <div className="interface-scale-options">
        {uiScaleOptions.map((option) => {
          const active = option.id === selected;
          return (
            <label key={option.id} data-selected={active ? "true" : undefined}>
              <input className="sr-only" type="radio" name="interface-scale" value={option.id} checked={active} onChange={() => choose(option.id)} />
              <span className="interface-scale-preview" data-scale-preview={option.id} aria-hidden>
                <span>LabNest</span><span>12 records</span><span />
              </span>
              <span className="min-w-0 flex-1">
                <strong>{zh ? option.name : option.nameEn}</strong>
                <small>{zh ? option.description : option.descriptionEn}</small>
              </span>
              {active ? <Check aria-hidden /> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
