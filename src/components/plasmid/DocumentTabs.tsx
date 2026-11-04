"use client";

import { Activity, Dna, MoreHorizontal, Plus, X } from "lucide-react";
import { useRef } from "react";

export type OpenDocument = { key: string; name: string; kind: "record" | "read"; title?: string };

/**
 * One tab per open sequence or read, across the top of the workbench. Opening more files adds tabs; a tab keeps its own
 * view and selection, can be dragged to another place, and closes on its own. The list at the end reaches every tab when
 * they no longer fit.
 */
export function DocumentTabs({ documents, activeKey, onChoose, onClose, onCloseAll, onOpenFiles, onMove }: {
  documents: OpenDocument[];
  activeKey?: string;
  onChoose: (key: string) => void;
  onClose: (keys: string[]) => void;
  onCloseAll: () => void;
  onOpenFiles: () => void;
  /** Puts `key` where `before` is now. */
  onMove: (key: string, before: string) => void;
}) {
  const dragged = useRef<string | undefined>(undefined);
  const menu = useRef<HTMLDetailsElement>(null);
  const closeMenu = () => menu.current?.removeAttribute("open");
  return (
    <nav className="ln-pw-doc-tabs" aria-label="Open files">
      <div className="ln-pw-doc-strip" role="tablist" aria-label="Open files">
        {documents.map((document) => {
          const Icon = document.kind === "read" ? Activity : Dna;
          return (
            <div
              key={document.key}
              className="ln-pw-doc-tab"
              data-active={document.key === activeKey || undefined}
              draggable
              onDragStart={() => { dragged.current = document.key; }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (dragged.current && dragged.current !== document.key) onMove(dragged.current, document.key);
                dragged.current = undefined;
              }}
              onAuxClick={(event) => { if (event.button === 1) onClose([document.key]); }}
            >
              <button type="button" role="tab" aria-selected={document.key === activeKey} title={document.title ?? document.name} onClick={() => onChoose(document.key)}>
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span data-i18n-ignore>{document.name}</span>
              </button>
              <button type="button" className="ln-pw-doc-close" aria-label="Close tab" onClick={() => onClose([document.key])}><X className="h-3 w-3" aria-hidden /></button>
            </div>
          );
        })}
      </div>
      <button type="button" className="ln-pw-doc-open" onClick={onOpenFiles}><Plus className="h-3.5 w-3.5" aria-hidden />Open files</button>
      {documents.length ? (
        <details className="ln-pw-doc-menu" ref={menu}>
          <summary aria-label="All open files"><MoreHorizontal className="h-4 w-4" aria-hidden /></summary>
          <div>
            {documents.map((document) => <button key={document.key} type="button" data-active={document.key === activeKey || undefined} data-i18n-ignore onClick={() => { onChoose(document.key); closeMenu(); }}>{document.name}</button>)}
            {activeKey && documents.length > 1 ? <button type="button" onClick={() => { onClose(documents.filter((document) => document.key !== activeKey).map((document) => document.key)); closeMenu(); }}>Close the other tabs</button> : null}
            <button type="button" onClick={() => { onCloseAll(); closeMenu(); }}>Close all tabs</button>
          </div>
        </details>
      ) : null}
    </nav>
  );
}
