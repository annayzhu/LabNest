"use client";

import { FileText, PanelRightClose, PanelRightOpen, SlidersHorizontal } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "@/components/I18nProvider";
import { cn } from "@/lib/cn";

export function DocumentEditorLayout({ children, className, storageKey = "labnest.document-editor.settings-open" }: {
  children: ReactNode;
  className?: string;
  storageKey?: string;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeView, setActiveView] = useState<"document" | "metadata">("document");
  const { t } = useI18n();

  useEffect(() => {
    if (window.localStorage.getItem(storageKey) === "true") {
      queueMicrotask(() => setSettingsOpen(true));
    }
  }, [storageKey]);

  useEffect(() => {
    if (!settingsOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") toggleSettings(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  // toggleSettings only closes local UI state and persists the same storage key.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen, storageKey]);

  function toggleSettings(force?: boolean) {
    setSettingsOpen((current) => {
      const next = force ?? !current;
      window.localStorage.setItem(storageKey, String(next));
      return next;
    });
  }

  const panelId = `${storageKey.replace(/[^a-z0-9-]/gi, "-")}-panel`;

  return (
    <div className={cn("document-editor-layout", className)} data-settings-open={settingsOpen ? "true" : "false"} data-active-view={activeView}>
      <nav className="document-editor-layout-tabs" aria-label={t("Document editor areas")} role="tablist" data-print-hidden>
        <button type="button" className="focus-ring document-editor-tab" data-active={activeView === "document" ? "true" : undefined} aria-selected={activeView === "document"} role="tab" onClick={() => setActiveView("document")}><FileText aria-hidden /><span>{t("Document")}</span></button>
        <button type="button" className="focus-ring document-editor-tab" data-active={activeView === "metadata" ? "true" : undefined} aria-selected={activeView === "metadata"} role="tab" onClick={() => { setActiveView("metadata"); toggleSettings(false); }}><SlidersHorizontal aria-hidden /><span>{t("Metadata")}</span></button>
      </nav>
      <div className="document-editor-settings-rail" data-print-hidden>
        <button type="button" className="focus-ring document-editor-settings-toggle" aria-expanded={settingsOpen} aria-controls={panelId} aria-label={t(settingsOpen ? "Hide information" : "Show information")} onClick={() => toggleSettings()} title={t(settingsOpen ? "Hide information" : "Show information")} hidden={activeView !== "document"}>
          {settingsOpen ? <PanelRightClose aria-hidden /> : <PanelRightOpen aria-hidden />}
          <span>{t(settingsOpen ? "Hide information" : "Information")}</span>
        </button>
      </div>
      <button type="button" className="document-editor-drawer-scrim" aria-label={t("Close information")} tabIndex={settingsOpen ? 0 : -1} onClick={() => toggleSettings(false)} data-print-hidden />
      <div id={panelId} className="contents">{children}</div>
    </div>
  );
}
