"use client";

import { Maximize2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { DocumentCanvas } from "@/components/DocumentCanvas";
import { DocumentOutlinePanel } from "@/components/DocumentOutlinePanel";
import { useI18n } from "@/components/I18nProvider";
import { cn } from "@/lib/cn";
import type { DocumentOutlineItem } from "@/lib/document-outline";
import { DOCUMENT_ZOOM_MAX, DOCUMENT_ZOOM_MIN, documentFitScale, normalizeDocumentZoom } from "@/lib/document-editor-workbench";

export type DocumentZoomMode = "custom" | "fit";

const A4_WIDTH_CSS_PX = (210 / 25.4) * 96;
const DOCUMENT_ZOOM_STORAGE_KEY = "labnest.document-editor.zoom";

export function useDocumentViewport() {
  const [zoomMode, setZoomMode] = useState<DocumentZoomMode>("custom");
  const [zoomPercent, setZoomPercentState] = useState(100);
  const [fitScale, setFitScale] = useState(1);
  const [documentHeight, setDocumentHeight] = useState(0);
  const panelRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(DOCUMENT_ZOOM_STORAGE_KEY);
    if (stored) queueMicrotask(() => setZoomPercentState(normalizeDocumentZoom(stored)));
  }, []);

  const setZoomPercent = useCallback((value: unknown) => {
    const next = normalizeDocumentZoom(value, zoomPercent);
    setZoomPercentState(next);
    setZoomMode("custom");
    window.localStorage.setItem(DOCUMENT_ZOOM_STORAGE_KEY, String(next));
  }, [zoomPercent]);

  const updateFitScale = useCallback(() => {
    const panel = panelRef.current;
    const panelWidth = panel?.clientWidth ?? 0;
    if (!panelWidth) return;
    const configuredInset = panel
      ? Number.parseFloat(getComputedStyle(panel).getPropertyValue("--ln-document-fit-inline-inset"))
      : Number.NaN;
    const next = documentFitScale(panelWidth, A4_WIDTH_CSS_PX, Number.isFinite(configuredInset) ? configuredInset : 0);
    setFitScale((current) => Math.abs(current - next) < 0.001 ? current : next);
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

  const requestedScale = zoomPercent / 100;
  const isWidthConstrained = fitScale < 1;
  const viewScale = zoomMode === "fit"
    ? fitScale
    : isWidthConstrained
      ? Math.min(requestedScale, fitScale)
      : requestedScale;
  const viewStyle = {
    "--ln-document-view-scale": String(viewScale),
    "--ln-document-view-height": documentHeight ? `${documentHeight * viewScale}px` : undefined,
    overflowX: zoomMode === "fit" || isWidthConstrained ? "hidden" : undefined,
  } as CSSProperties;

  return { panelRef, stageRef, zoomMode, setZoomMode, zoomPercent, setZoomPercent, updateFitScale, viewStyle };
}

export function DocumentZoomControls({ zoomMode, setZoomMode, zoomPercent, setZoomPercent, updateFitScale }: Pick<ReturnType<typeof useDocumentViewport>, "zoomMode" | "setZoomMode" | "zoomPercent" | "setZoomPercent" | "updateFitScale">) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(String(zoomPercent));
  const [editing, setEditing] = useState(false);
  const commit = () => { const next = normalizeDocumentZoom(draft, zoomPercent); setDraft(String(next)); setEditing(false); setZoomPercent(next); };
  return <div className="document-editor-zoom" role="group" aria-label={t("Document view zoom")}>
    <label className="document-editor-zoom-input" data-active={zoomMode === "custom" ? "true" : undefined}>
      <input type="number" min={DOCUMENT_ZOOM_MIN} max={DOCUMENT_ZOOM_MAX} step="5" value={editing ? draft : String(zoomPercent)} aria-label={t("Zoom percentage")} onFocus={() => { setDraft(String(zoomPercent)); setEditing(true); }} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }} />
      <span aria-hidden>%</span>
    </label>
    <button type="button" className="focus-ring" data-active={zoomMode === "fit" ? "true" : undefined} aria-pressed={zoomMode === "fit"} onClick={() => { updateFitScale(); setZoomMode("fit"); }} title={t("Fit document to available width")}><Maximize2 aria-hidden /><span>{t("Fit")}</span></button>
  </div>;
}

export function StandaloneDocumentEditorViewport({ children, toolbar, label, outline, className, paperClassName }: { children: ReactNode; toolbar: ReactNode; label: string; outline?: DocumentOutlineItem[]; className?: string; paperClassName?: string }) {
  const { panelRef, stageRef, zoomMode, setZoomMode, zoomPercent, setZoomPercent, updateFitScale, viewStyle } = useDocumentViewport();
  return <section className={cn("standalone-document-editor-viewport", className)} data-zoom-mode={zoomMode}>
    <div className="document-canvas-toolbar standalone-document-editor-toolbar" data-print-hidden>
      <div className="document-editor-toolbar-format">{toolbar}</div>
      <DocumentZoomControls zoomMode={zoomMode} setZoomMode={setZoomMode} zoomPercent={zoomPercent} setZoomPercent={setZoomPercent} updateFitScale={updateFitScale} />
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
