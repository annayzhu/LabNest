"use client";

import { FileText, Link2, ListTree, Maximize2, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type WorkspaceTab = "document" | "metadata" | "relations";
type ZoomMode = "100" | "110" | "fit";

const A4_WIDTH_CSS_PX = (210 / 25.4) * 96;

export function DocumentEditorWorkspace({
  document,
  metadata,
  relations,
  outline = [],
  inspectorHostId,
  className,
}: {
  document: ReactNode;
  metadata: ReactNode;
  relations: ReactNode;
  outline?: Array<{ id: string; label: string }>;
  inspectorHostId?: string;
  className?: string;
}) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("document");
  const [activeOutlineId, setActiveOutlineId] = useState(outline[0]?.id ?? "");
  const [zoomMode, setZoomMode] = useState<ZoomMode>("100");
  const [fitScale, setFitScale] = useState(1);
  const documentPanelRef = useRef<HTMLElement>(null);
  const tabs: Array<{ id: WorkspaceTab; label: string; icon: typeof FileText }> = [
    { id: "document", label: "Document", icon: FileText },
    { id: "metadata", label: "Metadata", icon: SlidersHorizontal },
    { id: "relations", label: "Relevant items", icon: Link2 },
  ];

  const updateFitScale = useCallback(() => {
    const panelWidth = documentPanelRef.current?.clientWidth ?? 0;
    if (!panelWidth) return;
    const reservedInspectorSpace = window.matchMedia("(min-width: 1280px)").matches ? 252 : 0;
    const availableWidth = Math.max(320, panelWidth - reservedInspectorSpace);
    setFitScale(Math.min(1.2, Math.max(0.72, availableWidth / A4_WIDTH_CSS_PX)));
  }, []);

  useEffect(() => {
    const panel = documentPanelRef.current;
    if (!panel) return;
    const observer = new ResizeObserver(updateFitScale);
    observer.observe(panel);
    updateFitScale();
    return () => observer.disconnect();
  }, [updateFitScale]);

  useEffect(() => {
    if (activeTab !== "document" || !outline.length) return;
    const sections = outline
      .map((item) => globalThis.document.getElementById(item.id))
      .filter((element): element is HTMLElement => Boolean(element));
    if (!sections.length) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible?.target.id) setActiveOutlineId(visible.target.id);
    }, { rootMargin: "-18% 0px -68% 0px", threshold: 0 });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [activeTab, outline]);

  const viewScale = zoomMode === "110" ? 1.1 : zoomMode === "fit" ? fitScale : 1;
  const viewStyle = { "--ln-document-view-scale": String(viewScale) } as CSSProperties;

  function openOutlineItem(id: string) {
    setActiveOutlineId(id);
    globalThis.document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return <div className={cn("document-editor-workspace", className)} data-active-tab={activeTab} data-zoom-mode={zoomMode}>
    <div className="document-editor-viewbar" data-print-hidden>
      <nav className="document-editor-tabs" aria-label="Protocol editor areas" role="tablist">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return <button key={tab.id} type="button" className="document-editor-tab" data-active={activeTab === tab.id ? "true" : undefined} aria-selected={activeTab === tab.id} role="tab" onClick={() => setActiveTab(tab.id)}><Icon aria-hidden /><span>{tab.label}</span></button>;
        })}
      </nav>
      {activeTab === "document" ? <div className="document-editor-zoom" role="group" aria-label="Document view zoom">
        {(["100", "110"] as const).map((mode) => <button key={mode} type="button" data-active={zoomMode === mode ? "true" : undefined} aria-pressed={zoomMode === mode} onClick={() => setZoomMode(mode)}>{mode}%</button>)}
        <button type="button" data-active={zoomMode === "fit" ? "true" : undefined} aria-pressed={zoomMode === "fit"} onClick={() => { updateFitScale(); setZoomMode("fit"); }}><Maximize2 aria-hidden /><span>Fit</span></button>
      </div> : null}
    </div>

    <div className="document-editor-workbench" hidden={activeTab !== "document"}>
      <aside className="document-editor-outline" aria-label="Document outline" data-print-hidden>
        <div className="document-editor-outline-heading"><ListTree aria-hidden /><span>Outline</span></div>
        <nav>
          {outline.map((item) => <button key={item.id} type="button" data-active={activeOutlineId === item.id ? "true" : undefined} aria-current={activeOutlineId === item.id ? "location" : undefined} onClick={() => openOutlineItem(item.id)}>{item.label}</button>)}
        </nav>
      </aside>
      <section ref={documentPanelRef} className="document-editor-tab-panel document-editor-document-panel" role="tabpanel" style={viewStyle}>
        <div className="document-editor-document-stage">{document}</div>
      </section>
      {inspectorHostId ? <aside className="document-editor-context-rail" aria-label="Selected block settings" data-print-hidden><div id={inspectorHostId} /></aside> : null}
    </div>

    <section className="document-editor-tab-panel document-editor-properties-panel" role="tabpanel" hidden={activeTab !== "metadata"}>{metadata}</section>
    <section className="document-editor-tab-panel document-editor-properties-panel" role="tabpanel" hidden={activeTab !== "relations"}>{relations}</section>
  </div>;
}
