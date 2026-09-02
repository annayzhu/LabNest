"use client";

import { Maximize2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { DocumentCanvas } from "@/components/DocumentCanvas";
import { DocumentOutlinePanel } from "@/components/DocumentOutlinePanel";
import { cn } from "@/lib/cn";
import type { DocumentOutlineItem } from "@/lib/document-outline";
import { documentFitScale } from "@/lib/document-editor-workbench";

export type DocumentZoomMode = "100" | "110" | "fit";

const A4_WIDTH_CSS_PX = (210 / 25.4) * 96;

export function useDocumentViewport() {
  const [zoomMode, setZoomMode] = useState<DocumentZoomMode>("100");
  const [fitScale, setFitScale] = useState(1);
  const [documentHeight, setDocumentHeight] = useState(0);
  const panelRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const updateFitScale = useCallback(() => {
    const panelWidth = panelRef.current?.clientWidth ?? 0;
    if (panelWidth) setFitScale(documentFitScale(panelWidth, A4_WIDTH_CSS_PX));
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const observer = new ResizeObserver(updateFitScale);
    observer.observe(panel);
    updateFitScale();
    return () => observer.disconnect();
  }, [updateFitScale]);

  useEffect(() => {
    const paperScroll = stageRef.current?.querySelector<HTMLElement>(".document-canvas-paper-scroll");
    if (!paperScroll) return;
    const updateDocumentHeight = () => setDocumentHeight(paperScroll.offsetHeight);
    const observer = new ResizeObserver(updateDocumentHeight);
    observer.observe(paperScroll);
    updateDocumentHeight();
    return () => observer.disconnect();
  }, []);

  const viewScale = zoomMode === "110" ? 1.1 : zoomMode === "fit" ? fitScale : 1;
  const viewStyle = {
    "--ln-document-view-scale": String(viewScale),
    "--ln-document-view-height": documentHeight ? `${documentHeight * viewScale}px` : undefined,
    overflowX: zoomMode === "fit" ? "hidden" : undefined,
  } as CSSProperties;

  return { panelRef, stageRef, zoomMode, setZoomMode, updateFitScale, viewStyle };
}

export function DocumentZoomControls({ zoomMode, setZoomMode, updateFitScale }: Pick<ReturnType<typeof useDocumentViewport>, "zoomMode" | "setZoomMode" | "updateFitScale">) {
  return <div className="document-editor-zoom" role="group" aria-label="Document view zoom">
    {(["100", "110"] as const).map((mode) => <button key={mode} type="button" className="focus-ring" data-active={zoomMode === mode ? "true" : undefined} aria-pressed={zoomMode === mode} onClick={() => setZoomMode(mode)}>{mode}%</button>)}
    <button type="button" className="focus-ring" data-active={zoomMode === "fit" ? "true" : undefined} aria-pressed={zoomMode === "fit"} onClick={() => { updateFitScale(); setZoomMode("fit"); }}><Maximize2 aria-hidden /><span>Fit</span></button>
  </div>;
}

export function StandaloneDocumentEditorViewport({ children, toolbar, label, outline, className, paperClassName }: { children: ReactNode; toolbar: ReactNode; label: string; outline?: DocumentOutlineItem[]; className?: string; paperClassName?: string }) {
  const { panelRef, stageRef, zoomMode, setZoomMode, updateFitScale, viewStyle } = useDocumentViewport();
  return <section className={cn("standalone-document-editor-viewport", className)} data-zoom-mode={zoomMode}>
    <div className="document-canvas-toolbar standalone-document-editor-toolbar" data-print-hidden>
      {toolbar}
      <DocumentZoomControls zoomMode={zoomMode} setZoomMode={setZoomMode} updateFitScale={updateFitScale} />
    </div>
    <div className="document-editor-workbench">
      <DocumentOutlinePanel items={outline ?? []} />
      <section ref={panelRef} className="document-editor-document-panel" style={viewStyle}>
        <div ref={stageRef} className="document-editor-document-stage">
          <DocumentCanvas label={label} paperClassName={paperClassName}>{children}</DocumentCanvas>
        </div>
      </section>
    </div>
  </section>;
}
