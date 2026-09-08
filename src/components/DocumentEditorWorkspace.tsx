"use client";

import { ContextProperties, useContextProperties } from "./ContextProperties";
import { FileText, Link2, PanelRightClose, PanelRightOpen, SlidersHorizontal } from "lucide-react";
import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { useI18n } from "@/components/I18nProvider";
import { cn } from "@/lib/cn";
import { DocumentOutlinePanel } from "@/components/DocumentOutlinePanel";
import type { DocumentOutlineItem } from "@/lib/document-outline";
import { DocumentZoomControls, useDocumentViewport } from "@/components/DocumentEditorViewport";

export type DocumentEditorWorkspaceTab = "document" | "metadata" | "relations";

export function DocumentEditorWorkspace({
  document,
  metadata,
  relations,
  toolbar,
  actions,
  outline = [],
  inspectorHostId,
  onActiveTabChange,
  className,
}: {
  document: ReactNode;
  metadata: ReactNode;
  relations: ReactNode;
  toolbar?: ReactNode;
  actions?: ReactNode;
  outline?: DocumentOutlineItem[];
  inspectorHostId?: string;
  onActiveTabChange?: (tab: DocumentEditorWorkspaceTab) => void;
  className?: string;
}) {
  const properties = useContextProperties();
  const [metadataActivation, setMetadataActivation] = useState(0);
  const [activeTab, setActiveTab] = useState<DocumentEditorWorkspaceTab>("document");
  const [hasInspector, setHasInspector] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const { t } = useI18n();
  const { panelRef, stageRef, zoomMode, setZoomMode, zoomPercent, setZoomPercent, updateFitScale, viewStyle } = useDocumentViewport();
  const tabs: Array<{ id: DocumentEditorWorkspaceTab; label: string; icon: typeof FileText }> = [
    { id: "document", label: t("Document"), icon: FileText },
    { id: "metadata", label: t("Metadata"), icon: SlidersHorizontal },
    { id: "relations", label: t("Relevant items"), icon: Link2 },
  ];

  useEffect(() => {
    if (!inspectorHostId) return;
    let previous = false;
    const update = () => {
      const next = Boolean(globalThis.document.getElementById(inspectorHostId)?.firstElementChild);
      if (previous === next) return;
      previous = next;
      setHasInspector(next);
      setInspectorOpen(next);
    };
    const observer = new MutationObserver(update);
    observer.observe(globalThis.document.body, { childList: true, subtree: true });
    update();
    return () => observer.disconnect();
  }, [inspectorHostId]);

  useEffect(() => {
    if (!inspectorOpen) return;
    const close = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") setInspectorOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [inspectorOpen]);

  function selectTab(tab: DocumentEditorWorkspaceTab) {
    if (tab === "metadata") setMetadataActivation(n => n + 1);
    else properties?.select(null);
    setActiveTab(tab);
    onActiveTabChange?.(tab);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home" ? 0
      : event.key === "End" ? tabs.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    selectTab(nextTab.id);
    globalThis.document.getElementById(`document-editor-tab-${nextTab.id}`)?.focus();
  }

  return <div className={cn("document-editor-workspace", className)} data-active-tab={activeTab} data-zoom-mode={zoomMode}>
    <div className="document-editor-viewbar" data-print-hidden>
      <div className="document-editor-viewbar-inner">
        <nav className="document-editor-tabs" aria-label={t("Document editor areas")} role="tablist">
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            return <button key={tab.id} id={`document-editor-tab-${tab.id}`} type="button" className="focus-ring document-editor-tab" data-active={activeTab === tab.id ? "true" : undefined} aria-controls={`document-editor-panel-${tab.id}`} aria-selected={activeTab === tab.id} tabIndex={activeTab === tab.id ? 0 : -1} role="tab" onClick={() => selectTab(tab.id)} onKeyDown={(event) => handleTabKeyDown(event, index)}><Icon aria-hidden /><span>{tab.label}</span></button>;
          })}
        </nav>
        <div className="document-editor-viewbar-actions">
          {activeTab === "document" ? <DocumentZoomControls zoomMode={zoomMode} setZoomMode={setZoomMode} zoomPercent={zoomPercent} setZoomPercent={setZoomPercent} updateFitScale={updateFitScale} /> : null}
          {activeTab === "document" && hasInspector ? <button type="button" className="focus-ring document-context-toggle" aria-expanded={inspectorOpen} aria-controls={`${inspectorHostId}-drawer`} onClick={() => setInspectorOpen((current) => !current)} title={t(inspectorOpen ? "Hide block settings" : "Show block settings")}>
            {inspectorOpen ? <PanelRightClose aria-hidden /> : <PanelRightOpen aria-hidden />}<span>{t("Block settings")}</span>
          </button> : null}
          {actions}
        </div>
      </div>
      {activeTab === "document" && toolbar ? <div className="document-editor-toolbar-row document-canvas-toolbar">{toolbar}</div> : null}
    </div>

    <div className="document-editor-workbench" hidden={activeTab === "relations"}>
      <DocumentOutlinePanel items={outline} />
      <section id="document-editor-panel-document" aria-labelledby="document-editor-tab-document" ref={panelRef} className="document-editor-tab-panel document-editor-document-panel" role="tabpanel" style={viewStyle}>
        <div ref={stageRef} className="document-editor-document-stage">{document}</div>
      </section>
      {inspectorHostId ? <ContextProperties title={t("Selected block settings")} selected={inspectorOpen} trigger={false}><div id={inspectorHostId} /></ContextProperties> : null}
    </div>

    <ContextProperties title={t("Metadata")} activation={metadataActivation} trigger={false}><section id="document-editor-panel-metadata" aria-labelledby="document-editor-tab-metadata" className="document-editor-tab-panel document-editor-properties-panel" role="tabpanel">{metadata}</section></ContextProperties>
    <section id="document-editor-panel-relations" aria-labelledby="document-editor-tab-relations" className="document-editor-tab-panel document-editor-properties-panel" role="tabpanel" hidden={activeTab !== "relations"}>{relations}</section>
  </div>;
}
