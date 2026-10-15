"use client";

import { ListTree } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { readingSectionIndex, type DocumentOutlineItem } from "@/lib/document-outline";
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

  // A clicked item stays highlighted while the page glides to it, and until the reader scrolls on their own.
  const clicked = useRef<{ settled: boolean; timer: ReturnType<typeof setTimeout> } | null>(null);

  useEffect(() => {
    let frameId = 0;
    const updateActiveItem = () => {
      frameId = 0;
      if (clicked.current) return;
      const sections = itemsRef.current
        .map((item) => globalThis.document.getElementById(item.id))
        .filter((element): element is HTMLElement => Boolean(element));
      if (!sections.length) return;
      const scroller = globalThis.document.scrollingElement ?? globalThis.document.documentElement;
      const atPageEnd = globalThis.innerHeight + scroller.scrollTop >= scroller.scrollHeight - 2;
      const index = readingSectionIndex(sections.map((section) => section.getBoundingClientRect().top), globalThis.innerHeight * 0.22, globalThis.innerHeight, atPageEnd);
      setSelectedItemId(sections[Math.max(0, index)].id);
    };
    const scheduleUpdate = () => {
      if (!frameId) frameId = globalThis.requestAnimationFrame(updateActiveItem);
    };
    const release = () => {
      if (!clicked.current) return;
      globalThis.clearTimeout(clicked.current.timer);
      clicked.current = null;
      scheduleUpdate();
    };
    const settleLater = (delay: number) => {
      const lock = clicked.current;
      if (!lock) return;
      globalThis.clearTimeout(lock.timer);
      lock.timer = globalThis.setTimeout(() => { lock.settled = true; }, delay);
    };
    const onScroll = () => {
      const lock = clicked.current;
      if (!lock) { scheduleUpdate(); return; }
      // Scrolling after the glide has settled is the reader's own.
      if (lock.settled) release(); else settleLater(160);
    };
    const onKey = (event: KeyboardEvent) => { if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) release(); };
    const onPointer = (event: PointerEvent) => { if (event.target === globalThis.document.documentElement) release(); };
    const mutationObserver = new MutationObserver(scheduleUpdate);
    const workbench = outlineRef.current?.closest(".document-editor-workbench");
    if (workbench) mutationObserver.observe(workbench, { childList: true, subtree: true });
    globalThis.addEventListener("scroll", onScroll, { passive: true });
    globalThis.addEventListener("resize", scheduleUpdate);
    globalThis.addEventListener("wheel", release, { passive: true });
    globalThis.addEventListener("touchstart", release, { passive: true });
    globalThis.addEventListener("keydown", onKey);
    globalThis.addEventListener("pointerdown", onPointer);
    scheduleUpdate();
    return () => {
      if (frameId) globalThis.cancelAnimationFrame(frameId);
      if (clicked.current) globalThis.clearTimeout(clicked.current.timer);
      mutationObserver.disconnect();
      globalThis.removeEventListener("scroll", onScroll);
      globalThis.removeEventListener("resize", scheduleUpdate);
      globalThis.removeEventListener("wheel", release);
      globalThis.removeEventListener("touchstart", release);
      globalThis.removeEventListener("keydown", onKey);
      globalThis.removeEventListener("pointerdown", onPointer);
    };
  }, [itemIdSignature]);

  function openItem(id: string) {
    if (clicked.current) globalThis.clearTimeout(clicked.current.timer);
    // Settles after the glide, or soon if the page is already there and no scroll happens.
    clicked.current = { settled: false, timer: globalThis.setTimeout(() => { if (clicked.current) clicked.current.settled = true; }, 400) };
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
