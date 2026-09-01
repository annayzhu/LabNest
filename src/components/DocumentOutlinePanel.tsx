"use client";

import { ListTree } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { DocumentOutlineItem } from "@/lib/document-outline";
import { cn } from "@/lib/cn";

export function DocumentOutlinePanel({ items, ariaLabel = "Document outline" }: {
  items: DocumentOutlineItem[];
  ariaLabel?: string;
}) {
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id ?? "");
  const activeItemId = items.some((item) => item.id === selectedItemId) ? selectedItemId : items[0]?.id ?? "";
  const outlineRef = useRef<HTMLElement>(null);
  const itemsRef = useRef(items);
  const itemIdSignature = items.map((item) => item.id).join("\u0000");
  useEffect(() => { itemsRef.current = items; }, [items]);

  useEffect(() => {
    let frameId = 0;
    const updateActiveItem = () => {
      frameId = 0;
      const sections = itemsRef.current
        .map((item) => globalThis.document.getElementById(item.id))
        .filter((element): element is HTMLElement => Boolean(element));
      if (!sections.length) return;
      const readingLine = globalThis.innerHeight * 0.22;
      const activeSection = sections.reduce((active, section) => section.getBoundingClientRect().top <= readingLine ? section : active, sections[0]);
      setSelectedItemId(activeSection.id);
    };
    const scheduleUpdate = () => {
      if (!frameId) frameId = globalThis.requestAnimationFrame(updateActiveItem);
    };
    const mutationObserver = new MutationObserver(scheduleUpdate);
    const workbench = outlineRef.current?.closest(".document-editor-workbench");
    if (workbench) mutationObserver.observe(workbench, { childList: true, subtree: true });
    globalThis.addEventListener("scroll", scheduleUpdate, { passive: true });
    globalThis.addEventListener("resize", scheduleUpdate);
    scheduleUpdate();
    return () => {
      if (frameId) globalThis.cancelAnimationFrame(frameId);
      mutationObserver.disconnect();
      globalThis.removeEventListener("scroll", scheduleUpdate);
      globalThis.removeEventListener("resize", scheduleUpdate);
    };
  }, [itemIdSignature]);

  function openItem(id: string) {
    setSelectedItemId(id);
    globalThis.document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return <aside ref={outlineRef} className="document-editor-outline" aria-label={ariaLabel} data-print-hidden>
    <div className="document-editor-outline-heading"><ListTree aria-hidden /><span>Outline</span></div>
    <nav>
      {items.map((item) => <button key={item.id} type="button" className="focus-ring" data-active={activeItemId === item.id ? "true" : undefined} aria-controls={item.id} aria-current={activeItemId === item.id ? "location" : undefined} onClick={() => openItem(item.id)}>{item.label}</button>)}
    </nav>
  </aside>;
}

export function DocumentOutlineWorkbench({ items, children, className }: {
  items: DocumentOutlineItem[];
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("document-editor-workbench", className)}>
    <DocumentOutlinePanel items={items} />
    <section className="document-editor-document-panel">
      <div className="document-editor-document-stage">{children}</div>
    </section>
  </div>;
}
