"use client";

import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export function DocumentEditorLayout({ children, className, storageKey = "labnest.document-editor.settings-open" }: {
  children: ReactNode;
  className?: string;
  storageKey?: string;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(storageKey) === "true") {
      queueMicrotask(() => setSettingsOpen(true));
    }
  }, [storageKey]);

  function toggleSettings() {
    setSettingsOpen((current) => {
      const next = !current;
      window.localStorage.setItem(storageKey, String(next));
      return next;
    });
  }

  const panelId = `${storageKey.replace(/[^a-z0-9-]/gi, "-")}-panel`;

  return (
    <div className={cn("document-editor-layout", className)} data-settings-open={settingsOpen ? "true" : "false"}>
      <div className="document-editor-settings-rail" data-print-hidden>
        <button type="button" className="focus-ring document-editor-settings-toggle" aria-expanded={settingsOpen} aria-controls={panelId} onClick={toggleSettings} title={settingsOpen ? "Hide settings" : "Show settings"}>
          {settingsOpen ? <PanelRightClose aria-hidden /> : <PanelRightOpen aria-hidden />}
          <span>{settingsOpen ? "Hide settings" : "Settings"}</span>
        </button>
      </div>
      <div id={panelId} className="contents">{children}</div>
    </div>
  );
}
