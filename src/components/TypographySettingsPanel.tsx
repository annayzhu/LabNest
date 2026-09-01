"use client";

import { RotateCcw, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  createCustomFontRecord,
  deleteCustomFont,
  listCustomFonts,
  loadCustomFont,
  saveCustomFont,
} from "@/lib/custom-font-storage";
import {
  applyTypographySettings,
  defaultTypographySettings,
  maxCustomFontCount,
  parseTypographySettings,
  settingsWithoutCustomFont,
  typographyPresets,
  typographySettingsStorageKey,
  type CustomFontRecord,
  type FontSelection,
  type TypographyRole,
  type TypographySettings,
  validateCustomFontFile,
} from "@/lib/typography-settings";

const roleCopy: Record<TypographyRole, { label: string; note: string }> = {
  ui: { label: "界面字体", note: "导航、按钮与表单" },
  documentBody: { label: "文档正文", note: "实验记录与长文阅读" },
  documentHeading: { label: "标题字体", note: "页面与文档标题" },
};

function selectionValue(selection: FontSelection) {
  return `${selection.kind}:${selection.id}`;
}

function formatFileSize(size: number) {
  return size >= 1_000_000 ? `${(size / 1_000_000).toFixed(1)} MB` : `${Math.ceil(size / 1_000)} KB`;
}

export function TypographySettingsPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<TypographySettings>(defaultTypographySettings);
  const [customFonts, setCustomFonts] = useState<CustomFontRecord[]>([]);
  const [loadingFonts, setLoadingFonts] = useState(true);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const storedSettings = parseTypographySettings(window.localStorage.getItem(typographySettingsStorageKey));
    queueMicrotask(() => setSettings(storedSettings));
    applyTypographySettings(storedSettings);
    void listCustomFonts()
      .then(async (fonts) => {
        const availableIds = new Set(fonts.map((font) => font.id));
        let resolvedSettings = storedSettings;
        Object.values(storedSettings).forEach((selection) => {
          if (selection.kind === "custom" && !availableIds.has(selection.id)) {
            resolvedSettings = settingsWithoutCustomFont(resolvedSettings, selection.id);
          }
        });
        if (resolvedSettings !== storedSettings) {
          setSettings(resolvedSettings);
          applyTypographySettings(resolvedSettings);
        }
        setCustomFonts(fonts);
        await Promise.allSettled(fonts.map(loadCustomFont));
      })
      .catch(() => setError("当前浏览器无法访问本地字体库，仍可使用预设字体。"))
      .finally(() => setLoadingFonts(false));
  }, []);

  function updateSettings(next: TypographySettings, confirmation = "字体设置已应用。") {
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
    const validationError = validateCustomFontFile(file);
    if (validationError) {
      setError(validationError);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (customFonts.length >= maxCustomFontCount) {
      setError(`当前浏览器最多保存 ${maxCustomFontCount} 个自定义字体，请先删除不再使用的字体。`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setImporting(true);
    try {
      const record = await createCustomFontRecord(file);
      await loadCustomFont(record);
      await saveCustomFont(record);
      setCustomFonts((fonts) => [record, ...fonts]);
      setMessage(`“${record.name}”已导入，可在上方三个字体选项中使用。`);
    } catch {
      setError("无法读取这个字体文件。请确认文件完整且为有效的 WOFF2、TTF 或 OTF 字体。");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeFont(font: CustomFontRecord) {
    if (!window.confirm(`删除本地字体“${font.name}”？使用它的排版角色将恢复默认字体。`)) return;
    setMessage("");
    setError("");
    try {
      await deleteCustomFont(font.id);
      setCustomFonts((fonts) => fonts.filter((item) => item.id !== font.id));
      updateSettings(settingsWithoutCustomFont(settings, font.id), `“${font.name}”已从当前浏览器删除。`);
    } catch {
      setError("未能删除这个字体，请刷新页面后重试。");
    }
  }

  return (
    <div className="typography-settings-panel">
      <div className="typography-role-grid">
        {(Object.keys(roleCopy) as TypographyRole[]).map((role) => (
          <label key={role} className="typography-role-field">
            <span className="typography-role-label">{roleCopy[role].label}</span>
            <span className="typography-role-note">{roleCopy[role].note}</span>
            <select
              className="focus-ring typography-role-select"
              value={selectionValue(settings[role])}
              onChange={(event) => selectFont(role, event.target.value)}
            >
              <optgroup label="预设字体">
                {typographyPresets[role].map((preset) => <option key={preset.id} value={`preset:${preset.id}`}>{preset.name} · {preset.description}</option>)}
              </optgroup>
              {customFonts.length ? (
                <optgroup label="我的字体">
                  {customFonts.map((font) => <option key={font.id} value={`custom:${font.id}`}>{font.name}</option>)}
                </optgroup>
              ) : null}
            </select>
          </label>
        ))}
      </div>

      <div className="typography-preview" aria-label="字体预览">
        <div className="typography-preview-copy">
          <p className="typography-preview-heading">细胞增殖实验记录</p>
          <p className="typography-preview-body">今日完成 CCK-8 检测，实验条件与原始观察均已记录。The quick brown fox jumps over 13 wells.</p>
        </div>
        <button type="button" className="focus-ring typography-reset-button" onClick={() => updateSettings(defaultTypographySettings, "已恢复默认字体。") }>
          <RotateCcw aria-hidden />恢复默认
        </button>
      </div>

      <div className="typography-import-row">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">我的字体</p>
          <p className="mt-0.5 text-[11px] leading-5 text-muted">仅保存在当前浏览器；支持 WOFF2、TTF、OTF，单个不超过 10 MB，最多 {maxCustomFontCount} 个。</p>
        </div>
        <label className="focus-ring typography-import-button" aria-disabled={importing || customFonts.length >= maxCustomFontCount}>
          <Upload aria-hidden />{importing ? "正在导入…" : "导入字体"}
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

      {loadingFonts ? <p className="mt-2 text-xs text-muted">正在读取当前浏览器的字体…</p> : null}
      {customFonts.length ? (
        <ul className="typography-custom-font-list" aria-label="已导入字体">
          {customFonts.map((font) => (
            <li key={font.id}>
              <span className="min-w-0">
                <span className="block truncate text-sm text-ink" style={{ fontFamily: `"${font.family}"` }}>{font.name}</span>
                <span className="block truncate text-[10px] text-muted">{font.fileName} · {formatFileSize(font.size)}</span>
              </span>
              <button type="button" className="focus-ring" onClick={() => void removeFont(font)} aria-label={`删除字体 ${font.name}`}>
                <Trash2 aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="typography-portability-note">
        网页显示与浏览器打印会使用所选字体。导出 DOCX 后，其他设备仍需安装该字体，否则会自动回退；请仅导入你有权使用的字体文件。
      </div>
      <p className={error ? "mt-2 text-xs text-error" : "mt-2 text-xs text-success"} role="status" aria-live="polite">{error || message}</p>
    </div>
  );
}
