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
  const navigationTargetRef = useRef<string | null>(null);
  const itemsRef = useRef(items);
  const itemIdSignature = items.map((item) => item.id).join("\u0000");
  useEffect(() => { itemsRef.current = items; }, [items]);

  useEffect(() => {
    let frameId = 0;
    const workbench = outlineRef.current?.closest(".document-editor-workbench");
    const findSection = (id: string) => workbench?.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`);
    const updateActiveItem = () => {
      frameId = 0;
      const sections = itemsRef.current
        .map((item) => findSection(item.id))
        .filter((element): element is HTMLElement => Boolean(element?.getClientRects().length));
      if (!sections.length) return;
      const target = navigationTargetRef.current && findSection(navigationTargetRef.current);
      // Short final sections cannot reach the top. Keep the clicked destination
      // selected until the reader scrolls, rather than bouncing to its neighbour.
      if (target && target.getBoundingClientRect().bottom > 0 && target.getBoundingClientRect().top < globalThis.innerHeight) return;
      navigationTargetRef.current = null;
      const readingLine = (parseFloat(getComputedStyle(sections[0]).scrollMarginTop) || globalThis.innerHeight * 0.22) + 4;
      const activeSection = sections.reduce((active, section) => section.getBoundingClientRect().top <= readingLine ? section : active, sections[0]);
      setSelectedItemId(activeSection.id);
    };
    const scheduleUpdate = () => {
      if (!frameId) frameId = globalThis.requestAnimationFrame(updateActiveItem);
    };
    const resumeTracking = () => { navigationTargetRef.current = null; scheduleUpdate(); };
    const handleKey = (event: KeyboardEvent) => {
      if (["PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown", " "].includes(event.key) && !(event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]'))) resumeTracking();
    };
    const mutationObserver = new MutationObserver(scheduleUpdate);
    const content = workbench?.querySelector(".document-editor-document-panel");
    if (content) mutationObserver.observe(content, { childList: true, subtree: true });
    globalThis.addEventListener("scroll", scheduleUpdate, { passive: true });
    globalThis.addEventListener("resize", scheduleUpdate);
    globalThis.addEventListener("wheel", resumeTracking, { passive: true });
    globalThis.addEventListener("touchmove", resumeTracking, { passive: true });
    globalThis.addEventListener("keydown", handleKey);
    scheduleUpdate();
    return () => {
      if (frameId) globalThis.cancelAnimationFrame(frameId);
      mutationObserver.disconnect();
      globalThis.removeEventListener("scroll", scheduleUpdate);
      globalThis.removeEventListener("resize", scheduleUpdate);
      globalThis.removeEventListener("wheel", resumeTracking);
      globalThis.removeEventListener("touchmove", resumeTracking);
      globalThis.removeEventListener("keydown", handleKey);
    };
  }, [itemIdSignature]);

  function openItem(id: string) {
    const section = outlineRef.current?.closest(".document-editor-workbench")?.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`);
    if (!section) return;
    navigationTargetRef.current = id;
    setSelectedItemId(id);
    section.scrollIntoView({ behavior: "instant", block: "start", inline: "nearest" });
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
