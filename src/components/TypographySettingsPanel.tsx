"use client";

import { RotateCcw, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import {
  createCustomFontRecord,
  deleteCustomFont,
  hydrateTypographyPreferences,
  loadCustomFont,
  saveCustomFont,
} from "@/lib/custom-font-storage";
import {
  applyTypographySettings,
  defaultTypographySettings,
  maxCustomFontCount,
  settingsWithoutCustomFont,
  typographyPresets,
  type CustomFontRecord,
  type FontSelection,
  type TypographyRole,
  type TypographySettings,
  validateCustomFontFile,
} from "@/lib/typography-settings";

const roleCopy: Record<TypographyRole, { zh: string; en: string; noteZh: string; noteEn: string }> = {
  ui: { zh: "界面字体", en: "Interface", noteZh: "导航、按钮与表单", noteEn: "Navigation, buttons, and forms" },
  documentBody: { zh: "文档正文", en: "Document body", noteZh: "实验记录与长文阅读", noteEn: "Experiment records and long reading" },
  documentHeading: { zh: "标题字体", en: "Headings", noteZh: "页面与文档标题", noteEn: "Page and document headings" },
};

function selectionValue(selection: FontSelection) {
  return `${selection.kind}:${selection.id}`;
}

function formatFileSize(size: number) {
  return size >= 1_000_000 ? `${(size / 1_000_000).toFixed(1)} MB` : `${Math.ceil(size / 1_000)} KB`;
}

export function TypographySettingsPanel() {
  const { locale } = useI18n();
  const zh = locale === "zh";
  const copy = useCallback((zhText: string, enText: string) => zh ? zhText : enText, [zh]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<TypographySettings>(defaultTypographySettings);
  const [customFonts, setCustomFonts] = useState<CustomFontRecord[]>([]);
  const [loadingFonts, setLoadingFonts] = useState(true);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void hydrateTypographyPreferences({ loadAllFonts: true })
      .then(({ settings: resolvedSettings, fonts }) => {
        setSettings(resolvedSettings);
        setCustomFonts(fonts);
      })
      .catch(() => setError(copy("当前浏览器无法访问本地字体库，仍可使用预设字体。", "This browser cannot access the local font library. Preset fonts remain available.")))
      .finally(() => setLoadingFonts(false));
  }, [copy]);

  function updateSettings(next: TypographySettings, confirmation = copy("字体设置已应用。", "Typography settings applied.")) {
    setSettings(next);
    applyTypographySettings(next);
    setError("");
    setMessage(confirmation);
  }

  function selectFont(role: TypographyRole, value: string) {
    const [kind, id] = value.split(":", 2);
    let selection: FontSelection | undefined;
    if (kind === "preset") {
      const preset = typographyPresets[role].find((item) => item.id === id);
      if (preset) selection = { kind: "preset", id: preset.id };
    } else if (kind === "custom") {
      const font = customFonts.find((item) => item.id === id);
      if (font) selection = { kind: "custom", id: font.id, family: font.family, name: font.name };
    }
    if (selection) updateSettings({ ...settings, [role]: selection });
  }

  async function importFont(file: File | undefined) {
    if (!file) return;
    setMessage("");
    setError("");
    const validationError = validateCustomFontFile(file, locale);
    if (validationError) {
      setError(validationError);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (customFonts.length >= maxCustomFontCount) {
      setError(copy(`当前浏览器最多保存 ${maxCustomFontCount} 个自定义字体，请先删除不再使用的字体。`, `This browser can store up to ${maxCustomFontCount} custom fonts. Delete an unused font first.`));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setImporting(true);
    try {
      const record = await createCustomFontRecord(file);
      await loadCustomFont(record);
      await saveCustomFont(record);
      setCustomFonts((fonts) => [record, ...fonts]);
      setMessage(copy(`“${record.name}”已导入，可在上方三个字体选项中使用。`, `“${record.name}” was imported and is now available in all three selectors.`));
    } catch {
      setError(copy("无法读取这个字体文件。请确认文件完整且为有效的 WOFF2、TTF 或 OTF 字体。", "This font could not be read. Confirm it is a complete, valid WOFF2, TTF, or OTF file."));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeFont(font: CustomFontRecord) {
    if (!window.confirm(copy(`删除本地字体“${font.name}”？使用它的排版角色将恢复默认字体。`, `Delete the local font “${font.name}”? Roles using it will return to their defaults.`))) return;
    setMessage("");
    setError("");
    try {
      await deleteCustomFont(font.id);
      setCustomFonts((fonts) => fonts.filter((item) => item.id !== font.id));
      updateSettings(settingsWithoutCustomFont(settings, font.id), copy(`“${font.name}”已从当前浏览器删除。`, `“${font.name}” was removed from this browser.`));
    } catch {
      setError(copy("未能删除这个字体，请刷新页面后重试。", "This font could not be deleted. Refresh and try again."));
    }
  }

  return (
    <div className="typography-settings-panel">
      <div className="typography-role-grid">
        {(Object.keys(roleCopy) as TypographyRole[]).map((role) => (
          <label key={role} className="typography-role-field">
            <span className="typography-role-label">{zh ? roleCopy[role].zh : roleCopy[role].en}</span>
            <span className="typography-role-note">{zh ? roleCopy[role].noteZh : roleCopy[role].noteEn}</span>
            <select
              className="focus-ring typography-role-select"
              value={selectionValue(settings[role])}
              onChange={(event) => selectFont(role, event.target.value)}
            >
              <optgroup label={copy("预设字体", "Preset fonts")}>
                {typographyPresets[role].map((preset) => <option key={preset.id} value={`preset:${preset.id}`}>{zh ? preset.name : preset.nameEn} · {zh ? preset.description : preset.descriptionEn}</option>)}
              </optgroup>
              {customFonts.length ? (
                <optgroup label={copy("我的字体", "My fonts")}>
                  {customFonts.map((font) => <option key={font.id} value={`custom:${font.id}`}>{font.name}</option>)}
                </optgroup>
              ) : null}
            </select>
          </label>
        ))}
      </div>

      <div className="typography-preview" aria-label={copy("字体预览", "Font preview")}>
        <div className="typography-preview-copy">
          <p className="typography-preview-heading">{copy("细胞增殖实验记录", "Cell proliferation record")}</p>
          <p className="typography-preview-body">{copy("今日完成 CCK-8 检测，实验条件与原始观察均已记录。The quick brown fox jumps over 13 wells.", "CCK-8 detection completed. Conditions and raw observations were recorded. 细胞增殖实验。")}</p>
        </div>
        <button type="button" className="focus-ring typography-reset-button" onClick={() => updateSettings(defaultTypographySettings, copy("已恢复默认字体。", "Default typography restored."))}>
          <RotateCcw aria-hidden />{copy("恢复默认", "Reset")}
        </button>
      </div>

      <div className="typography-import-row">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{copy("我的字体", "My fonts")}</p>
          <p className="mt-0.5 text-[11px] leading-5 text-muted">{copy(`仅保存在当前浏览器；支持 WOFF2、TTF、OTF，单个不超过 10 MB，最多 ${maxCustomFontCount} 个。`, `Stored only in this browser. WOFF2, TTF, and OTF; 10 MB each; up to ${maxCustomFontCount}.`)}</p>
        </div>
        <label className="focus-ring typography-import-button" aria-disabled={importing || customFonts.length >= maxCustomFontCount}>
          <Upload aria-hidden />{importing ? copy("正在导入…", "Importing…") : copy("导入字体", "Import font")}
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept=".woff2,.ttf,.otf,font/woff2,font/ttf,font/otf"
            disabled={importing || customFonts.length >= maxCustomFontCount}
            onChange={(event) => void importFont(event.target.files?.[0])}
          />
        </label>
      </div>

      {loadingFonts ? <p className="mt-2 text-xs text-muted">{copy("正在读取当前浏览器的字体…", "Reading fonts stored in this browser…")}</p> : null}
      {customFonts.length ? (
        <ul className="typography-custom-font-list" aria-label={copy("已导入字体", "Imported fonts")}>
          {customFonts.map((font) => (
            <li key={font.id}>
              <span className="min-w-0">
                <span className="block truncate text-sm text-ink" style={{ fontFamily: `"${font.family}"` }}>{font.name}</span>
                <span className="block truncate text-[10px] text-muted">{font.fileName} · {formatFileSize(font.size)}</span>
              </span>
              <button type="button" className="focus-ring" onClick={() => void removeFont(font)} aria-label={copy(`删除字体 ${font.name}`, `Delete font ${font.name}`)}>
                <Trash2 aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="typography-portability-note">
        {copy("网页显示与浏览器打印会使用所选字体。导出 DOCX 后，其他设备仍需安装该字体，否则会自动回退；请仅导入你有权使用的字体文件。", "The selected font is used on screen and in browser printing. DOCX recipients still need the font installed or it will fall back. Import only fonts you are licensed to use.")}
      </div>
      {error || message ? <p className="typography-feedback" data-tone={error ? "error" : "success"} role={error ? "alert" : "status"} aria-live={error ? "assertive" : "polite"}>{error || message}</p> : null}
    </div>
  );
}
