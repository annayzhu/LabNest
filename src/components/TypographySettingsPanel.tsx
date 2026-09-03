"use client";

import { Check, ChevronDown, Laptop, RotateCcw, Search, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { useModalDialog } from "@/components/ui/ModalDialogProvider";
import {
  CustomFontImportError,
  deleteCustomFont,
  hydrateTypographyPreferences,
  importCustomFontFamily,
  inferCustomFontFace,
  validateCustomFontFamily,
} from "@/lib/custom-font-storage";
import {
  canDiscoverLocalFonts,
  discoverLocalFontFamilies,
  loadStoredLocalFontFamilies,
  type LocalFontFamilyRecord,
} from "@/lib/local-font-catalog";
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
    noteZh: "可为界面、正文和标题使用完整的英文字体目录，也可扫描本机字体或导入字体族。",
    noteEn: "Use the complete Latin catalog for interface, body, and headings, or discover/import additional families.",
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
  localFonts,
  loading,
  zh,
  onSelect,
}: {
  role: TypographyRole;
  selection: FontSelection;
  customFonts: CustomFontRecord[];
  localFonts: LocalFontFamilyRecord[];
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
  const selectedLabel = selection.kind === "custom" || selection.kind === "local"
    ? selection.name
    : (() => {
        const preset = presets.find((item) => item.id === selection.id);
        return preset ? zh ? preset.name : preset.nameEn : zh ? "默认" : "Default";
      })();
  const needle = query.trim().toLocaleLowerCase();
  const filteredPresets = useMemo(() => presets.filter((preset) => !needle || [preset.name, preset.nameEn, preset.description, preset.descriptionEn].some((value) => value.toLocaleLowerCase().includes(needle))), [needle, presets]);
  const filteredCustomFonts = useMemo(() => customFonts.filter((font) => !needle || `${font.name} ${font.fileName}`.toLocaleLowerCase().includes(needle)), [customFonts, needle]);
  const filteredLocalFonts = useMemo(() => localFonts.filter((font) => !needle || `${font.name} ${font.styles.join(" ")}`.toLocaleLowerCase().includes(needle)), [localFonts, needle]);

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
        {filteredLocalFonts.length ? <div className="typography-font-option-group"><p>{zh ? "本机字体" : "Device fonts"}</p>{filteredLocalFonts.map((font) => {
          const value = `local:${font.id}`;
          return <button key={font.id} type="button" role="option" aria-selected={selectedValue === value} data-font-option={value} onClick={() => choose(value)}><Check aria-hidden /><span><strong style={{ fontFamily: font.name }}>{font.name}</strong><small>{font.styles.length ? font.styles.join(" · ") : zh ? "系统字体" : "System font"}</small></span></button>;
        })}</div> : null}
        {!filteredPresets.length && !filteredCustomFonts.length && !filteredLocalFonts.length ? <p className="typography-font-empty">{zh ? "没有匹配的字体" : "No matching fonts"}</p> : null}
      </div>
    </div> : null}
  </div>;
}

export function TypographySettingsPanel() {
  const { locale } = useI18n();
  const zh = locale === "zh";
  const copy = useCallback((zhText: string, enText: string) => zh ? zhText : enText, [zh]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialog = useModalDialog();
  const [settings, setSettings] = useState<TypographySettings>(defaultTypographySettings);
  const [customFonts, setCustomFonts] = useState<CustomFontRecord[]>([]);
  const [localFonts, setLocalFonts] = useState<LocalFontFamilyRecord[]>(() => typeof window === "undefined" ? [] : loadStoredLocalFontFamilies());
  const [loadingFonts, setLoadingFonts] = useState(true);
  const [discoveringFonts, setDiscoveringFonts] = useState(false);
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
    } else if (kind === "local") {
      const font = localFonts.find((item) => item.id === id);
      if (font) selection = { kind: "local", id: font.id, name: font.name };
    }
    if (selection) updateSettings({ ...settings, [role]: selection });
  }

  async function discoverFonts() {
    setMessage("");
    setError("");
    if (!canDiscoverLocalFonts()) {
      setError(copy("当前浏览器不支持读取本机字体；仍可使用内置字体或导入字体族。建议使用最新版 Chrome 或 Edge，并通过 HTTPS 或 localhost 打开。", "This browser cannot enumerate device fonts. Built-in and imported families remain available. Use current Chrome or Edge over HTTPS or localhost."));
      return;
    }
    setDiscoveringFonts(true);
    try {
      const families = await discoverLocalFontFamilies();
      setLocalFonts(families);
      setMessage(copy(`已发现 ${families.length} 个本机字体族，可用于界面、正文和标题。`, `Found ${families.length} device font families for interface, body, and headings.`));
    } catch (error) {
      setError(error instanceof DOMException && error.name === "NotAllowedError"
        ? copy("未获得本机字体访问权限。你可以重新点击并允许访问，或继续使用内置/导入字体。", "Device-font access was not granted. Retry and allow access, or keep using built-in/imported fonts.")
        : copy("无法读取本机字体；内置和已导入字体仍可正常使用。", "Device fonts could not be read. Built-in and imported fonts remain available."));
    } finally {
      setDiscoveringFonts(false);
    }
  }

  async function importFont(files: FileList | null) {
    const selectedFiles = Array.from(files ?? []);
    if (!selectedFiles.length) return;
    setMessage("");
    setError("");
    const validationError = selectedFiles.map((file) => validateCustomFontFile(file, locale)).find(Boolean);
    if (validationError) {
      setError(validationError);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const familyValidationError = validateCustomFontFamily(selectedFiles, locale);
    if (familyValidationError) {
      setError(familyValidationError);
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
        const proposedFamily = inferCustomFontFace(selectedFiles[0].name).familyName;
        const familyName = (await dialog.prompt({
          title: copy("确认字体族", "Confirm font family"),
          description: copy("可以在导入前修正自动识别的字体族名称。", "Correct the detected family name before importing if needed."),
          inputLabel: copy("字体族名称", "Font family name"),
          defaultValue: proposedFamily,
          confirmLabel: copy("继续", "Continue"),
        }))?.trim();
        if (!familyName) return;
        const mapping = selectedFiles.map((file) => {
          const face = inferCustomFontFace(file.name);
          return `${file.name}: ${face.weight} / ${face.style}`;
        }).join("\n");
        if (!await dialog.confirm({
          title: copy("确认字体字形映射", "Confirm font face mappings"),
          description: mapping,
          confirmLabel: copy("导入字体族", "Import family"),
          cancelLabel: copy("取消", "Cancel"),
        })) return;
        const record = await importCustomFontFamily(selectedFiles, { familyName });
        setCustomFonts((fonts) => [record, ...fonts]);
        setMessage(copy(`“${record.name}”字体族（${selectedFiles.length} 个字形）已导入。`, `“${record.name}” (${selectedFiles.length} faces) was imported.`));
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
    if (!await dialog.confirm({
      title: copy(`删除“${font.name}”？`, `Delete “${font.name}”?`),
      description: copy("使用它的排版角色将恢复默认字体。", "Roles using it will return to their default fonts."),
      confirmLabel: copy("删除字体", "Delete font"),
      cancelLabel: copy("取消", "Cancel"),
      tone: "destructive",
    })) return;
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
                  <TypographyFontPicker role={role} selection={settings[role]} customFonts={customFonts} localFonts={localFonts} loading={loadingFonts} zh={zh} onSelect={(value) => selectFont(role, value)} />
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
          <p className="text-sm font-medium text-ink">{copy("本机字体", "Device fonts")}</p>
          <p className="mt-0.5 text-[11px] leading-5 text-muted">{copy("经浏览器授权后读取可用字体族；字体文件不会上传。发现的字体可用于中文或英文的界面、正文和标题。", "With browser permission, discover installed families without uploading font files. Use them for Chinese or English interface, body, and headings.")}</p>
        </div>
        <button type="button" className="focus-ring typography-import-button" disabled={discoveringFonts} onClick={() => void discoverFonts()}>
          <Laptop aria-hidden />{discoveringFonts ? copy("正在读取…", "Discovering…") : localFonts.length ? copy("重新扫描", "Scan again") : copy("扫描本机字体", "Find device fonts")}
        </button>
      </div>

      <div className="typography-import-row">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{copy("我的字体", "My fonts")}</p>
          <p className="mt-0.5 text-[11px] leading-5 text-muted">{copy(`按字体族同时选择 Regular、Bold、Italic 等文件；单个文件不超过 10 MB，最多 ${maxCustomFontCount} 个字体族。`, `Select Regular, Bold, Italic, and other faces together; 10 MB per file and up to ${maxCustomFontCount} families.`)}</p>
        </div>
        <label className="focus-ring typography-import-button" data-busy={importing ? "true" : undefined} aria-disabled={importing || customFonts.length >= maxCustomFontCount}>
          <Upload aria-hidden />{importing ? copy("正在导入…", "Importing…") : copy("导入字体族", "Import family")}
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            multiple
            accept=".woff2,.ttf,.otf,font/woff2,font/ttf,font/otf"
            disabled={importing || customFonts.length >= maxCustomFontCount}
            onChange={(event) => void importFont(event.target.files)}
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
                <span className="block truncate text-[10px] text-muted">{font.faces?.length ?? 1} faces · {font.fileName} · {formatFileSize(font.size)}</span>
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
