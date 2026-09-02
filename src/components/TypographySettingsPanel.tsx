"use client";

import { Check, ChevronDown, RotateCcw, Search, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import {
  CustomFontImportError,
  deleteCustomFont,
  hydrateTypographyPreferences,
  importCustomFont,
} from "@/lib/custom-font-storage";
import {
  applyTypographySettings,
  defaultTypographySettings,
  maxCustomFontCount,
  settingsWithoutCustomFont,
  typographyPresets,
  typographyRoleGroups,
  type CustomFontRecord,
  type FontSelection,
  type TypographyRole,
  type TypographySettings,
  validateCustomFontFile,
} from "@/lib/typography-settings";

const roleCopy: Record<TypographyRole, { zh: string; en: string; noteZh: string; noteEn: string }> = {
  cjkUi: { zh: "中文界面", en: "Chinese interface", noteZh: "导航、按钮与表单中的中文", noteEn: "Chinese in navigation, buttons, and forms" },
  cjkDocumentBody: { zh: "中文正文", en: "Chinese document body", noteZh: "实验记录与长文中的中文", noteEn: "Chinese in records and long-form documents" },
  cjkDocumentHeading: { zh: "中文标题", en: "Chinese headings", noteZh: "页面与文档标题中的中文", noteEn: "Chinese page and document headings" },
  latinUi: { zh: "英文界面", en: "English interface", noteZh: "导航、按钮与表单中的英文", noteEn: "English in navigation, buttons, and forms" },
  latinDocumentBody: { zh: "英文正文", en: "English document body", noteZh: "实验记录与长文中的英文", noteEn: "English in records and long-form documents" },
  latinDocumentHeading: { zh: "英文标题", en: "English headings", noteZh: "页面与文档标题中的英文", noteEn: "English page and document headings" },
};

const groupCopy = {
  cjk: {
    zh: "中文字体",
    en: "Chinese fonts",
    noteZh: "中文按界面、正文和标题分别设置；英文字符不会再沿用宋体。",
    noteEn: "Choose Chinese fonts separately for interface, body, and headings. Latin text no longer inherits a Chinese serif.",
  },
  latin: {
    zh: "英文字体",
    en: "English fonts",
    noteZh: "默认仅提供 Arial 与 Times New Roman；其他英文字体可从下方导入。",
    noteEn: "Arial and Times New Roman are the built-in defaults. Import any additional Latin fonts below.",
  },
} as const;

function selectionValue(selection: FontSelection) {
  return `${selection.kind}:${selection.id}`;
}

function formatFileSize(size: number) {
  return size >= 1_000_000 ? `${(size / 1_000_000).toFixed(1)} MB` : `${Math.ceil(size / 1_000)} KB`;
}

function TypographyFontPicker({
  role,
  selection,
  customFonts,
  loading,
  zh,
  onSelect,
}: {
  role: TypographyRole;
  selection: FontSelection;
  customFonts: CustomFontRecord[];
  loading: boolean;
  zh: boolean;
  onSelect: (value: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedValue = selectionValue(selection);
  const presets = typographyPresets[role];
  const selectedLabel = selection.kind === "custom"
    ? selection.name
    : (() => {
        const preset = presets.find((item) => item.id === selection.id);
        return preset ? zh ? preset.name : preset.nameEn : zh ? "默认" : "Default";
      })();
  const needle = query.trim().toLocaleLowerCase();
  const filteredPresets = useMemo(() => presets.filter((preset) => !needle || [preset.name, preset.nameEn, preset.description, preset.descriptionEn].some((value) => value.toLocaleLowerCase().includes(needle))), [needle, presets]);
  const filteredCustomFonts = useMemo(() => customFonts.filter((font) => !needle || `${font.name} ${font.fileName}`.toLocaleLowerCase().includes(needle)), [customFonts, needle]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    searchRef.current?.focus();
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  function choose(value: string) {
    onSelect(value);
    setOpen(false);
    setQuery("");
  }

  return <div ref={rootRef} className="typography-font-picker" data-open={open ? "true" : undefined} onKeyDown={(event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    setOpen(false);
  }}>
    <button type="button" className="focus-ring typography-role-select" data-typography-role={role} data-font-value={selectedValue} disabled={loading} aria-haspopup="listbox" aria-expanded={open} aria-label={zh ? `选择${roleCopy[role].zh}字体` : `Choose ${roleCopy[role].en} font`} onClick={() => { setOpen((current) => !current); setQuery(""); }}>
      <span>{selectedLabel}</span><ChevronDown aria-hidden />
    </button>
    {open ? <div className="typography-font-menu">
      <label className="typography-font-search"><Search aria-hidden /><input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={zh ? "搜索字体" : "Search fonts"} aria-label={zh ? "搜索字体" : "Search fonts"} /></label>
      <div className="typography-font-options" role="listbox" aria-label={zh ? roleCopy[role].zh : roleCopy[role].en}>
        {filteredPresets.length ? <div className="typography-font-option-group"><p>{zh ? "预设字体" : "Preset fonts"}</p>{filteredPresets.map((preset) => {
          const value = `preset:${preset.id}`;
          return <button key={preset.id} type="button" role="option" aria-selected={selectedValue === value} data-font-option={value} onClick={() => choose(value)}><Check aria-hidden /><span><strong>{zh ? preset.name : preset.nameEn}</strong><small>{zh ? preset.description : preset.descriptionEn}</small></span></button>;
        })}</div> : null}
        {filteredCustomFonts.length ? <div className="typography-font-option-group"><p>{zh ? "我的字体" : "My fonts"}</p>{filteredCustomFonts.map((font) => {
          const value = `custom:${font.id}`;
          return <button key={font.id} type="button" role="option" aria-selected={selectedValue === value} data-font-option={value} onClick={() => choose(value)}><Check aria-hidden /><span><strong>{font.name}</strong><small>{font.fileName}</small></span></button>;
        })}</div> : null}
        {!filteredPresets.length && !filteredCustomFonts.length ? <p className="typography-font-empty">{zh ? "没有匹配的字体" : "No matching fonts"}</p> : null}
      </div>
    </div> : null}
  </div>;
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
      try {
        const record = await importCustomFont(file);
        setCustomFonts((fonts) => [record, ...fonts]);
        setMessage(copy(`“${record.name}”已导入，可在上方中英文选项中使用。`, `“${record.name}” was imported and is now available in the Chinese and English selectors.`));
      } catch (error) {
        const stage = error instanceof CustomFontImportError ? error.stage : "persist";
        if (stage === "read") {
          setError(copy("无法读取这个字体文件，请重新下载后再试。", "This font file could not be read. Download it again and retry."));
        } else if (stage === "parse") {
          setError(copy("浏览器无法解析这个字体，请尝试该字体的 WOFF2 版本或其他字体文件。", "This browser could not parse the font. Try a WOFF2 build or another font file."));
        } else {
          setError(copy("无法将字体保存到当前浏览器，请检查浏览器存储权限后重试。", "The font could not be saved in this browser. Check browser storage permissions and retry."));
        }
        return;
      }
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
      <div className="typography-language-groups">
        {(Object.keys(typographyRoleGroups) as Array<keyof typeof typographyRoleGroups>).map((group) => (
          <fieldset key={group} className="typography-language-group" data-typography-script={group}>
            <legend>{zh ? groupCopy[group].zh : groupCopy[group].en}</legend>
            <p className="typography-language-note">{zh ? groupCopy[group].noteZh : groupCopy[group].noteEn}</p>
            <div className="typography-role-grid">
              {typographyRoleGroups[group].map((role) => (
                <div key={role} className="typography-role-field">
                  <span className="typography-role-label">{zh ? roleCopy[role].zh : roleCopy[role].en}</span>
                  <span className="typography-role-note">{zh ? roleCopy[role].noteZh : roleCopy[role].noteEn}</span>
                  <TypographyFontPicker role={role} selection={settings[role]} customFonts={customFonts} loading={loadingFonts} zh={zh} onSelect={(value) => selectFont(role, value)} />
                </div>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="typography-preview" aria-label={copy("字体预览", "Font preview")}>
        <div className="typography-preview-samples">
          <div className="typography-preview-copy" data-typography-preview="cjk" lang="zh-CN">
            <p className="typography-preview-heading">细胞增殖实验记录</p>
            <p className="typography-preview-body">今日完成 CCK-8 检测，实验条件与原始观察均已记录。</p>
          </div>
          <div className="typography-preview-copy" data-typography-preview="latin" lang="en">
            <p className="typography-preview-heading">Cell proliferation record</p>
            <p className="typography-preview-body">The quick brown fox jumps over 13 wells.</p>
          </div>
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
        <label className="focus-ring typography-import-button" data-busy={importing ? "true" : undefined} aria-disabled={importing || customFonts.length >= maxCustomFontCount}>
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
                <span className="block truncate text-sm text-ink" style={{ fontFamily: `"${font.family} Latin", "${font.family} CJK"` }}>{font.name}</span>
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
