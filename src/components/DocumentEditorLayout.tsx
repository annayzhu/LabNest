"use client";

import { ContextProperties, useContextProperties } from "./ContextProperties";
import { FileText, SlidersHorizontal } from "lucide-react";
import { Children, useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { useI18n } from "@/components/I18nProvider";
import { cn } from "@/lib/cn";

export function DocumentEditorLayout({ children, className }: {
  children: ReactNode;
  className?: string;
}) {
  const [activeView, setActiveView] = useState<"document" | "metadata">("document");
  const [activation, setActivation] = useState(0);
  const { t } = useI18n();
  const id = useId();
  const panels = Children.toArray(children);
  const properties = useContextProperties();
  const activateView = (view: "document" | "metadata") => {
    setActiveView(view);
    if (view === "metadata") setActivation(n => n + 1);
    else properties?.select(null);
  };
  const selectAdjacentTab = (event: KeyboardEvent<HTMLButtonElement>) => {
    const order = ["document", "metadata"] as const;
    const current = order.indexOf(activeView);
    const next = event.key === "Home" ? 0 : event.key === "End" ? order.length - 1 : event.key === "ArrowRight" ? (current + 1) % order.length : event.key === "ArrowLeft" ? (current - 1 + order.length) % order.length : -1;
    if (next < 0) return;
    event.preventDefault();
    activateView(order[next]);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };

  return (
    <div className={cn("document-editor-layout", className)} data-active-view="document">
      <nav className="document-editor-layout-tabs" aria-label={t("Document editor areas")} role="tablist" data-print-hidden>
        <button id={`${id}-tab-document`} type="button" className="focus-ring document-editor-tab" data-active={activeView === "document" ? "true" : undefined} aria-controls={`${id}-panel-document`} aria-selected={activeView === "document"} tabIndex={activeView === "document" ? 0 : -1} role="tab" onClick={() => activateView("document")} onKeyDown={selectAdjacentTab}><FileText aria-hidden /><span>{t("Document")}</span></button>
        <button id={`${id}-tab-metadata`} type="button" className="focus-ring document-editor-tab" data-active={activeView === "metadata" ? "true" : undefined} aria-controls={`${id}-panel-metadata`} aria-selected={activeView === "metadata"} tabIndex={activeView === "metadata" ? 0 : -1} role="tab" onClick={() => activateView("metadata")} onKeyDown={selectAdjacentTab}><SlidersHorizontal aria-hidden /><span>{t("Metadata")}</span></button>
      </nav>
      <section id={`${id}-panel-document`} className="contents" role="tabpanel" aria-labelledby={`${id}-tab-document`} aria-hidden={false}>{panels[0]}</section>
      <ContextProperties title={t("Metadata")} trigger={false} activation={activation}><section id={`${id}-panel-metadata`} role="tabpanel" aria-labelledby={`${id}-tab-metadata`}>{panels[1]}</section></ContextProperties>
    </div>
  );
}
