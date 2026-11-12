"use client";

import { DialogHeader } from "@/components/ui/DialogShell";
import { createContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Ellipsis } from "lucide-react";
import { useMediaQuery } from "@/lib/use-media-query";

/**
 * On a phone the top bar keeps ← title ···, Notion-style, and a page header's actions move into the sheet behind ···.
 * A tablet or computer shows them in the header as before. Either way there is one copy, so a button keeps its state.
 */

/** Inside the sheet a page's own "More actions" menu lays its items out flat instead of opening a second menu. */
export const InPageMenu = createContext(false);

/** A page header's actions. `className` lays them out in the header on a computer. */
export function PageActions({ children, className, menuClassName }: { children: ReactNode; className?: string; /** Added to the list in the phone sheet. */ menuClassName?: string }) {
  const phone = useMediaQuery("(max-width: 743.98px)");
  const { target } = useMenu();
  // A header the phone layout hides (e.g. the computer's half of the home page) adds nothing to ···.
  const probe = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!phone || !probe.current?.getClientRects().length) return;
    setShown(true);
    update({ count: state.count + 1 });
    return () => { setShown(false); update({ count: state.count - 1 }); };
  }, [phone]);
  if (phone) return <><span ref={probe} className="block h-0 w-0" aria-hidden />{shown && target ? createPortal(<InPageMenu.Provider value><div className={`ln-page-menu-items ${menuClassName ?? ""}`}>{children}</div></InPageMenu.Provider>, target) : null}</>;
  // Before the page knows it is on a phone, the header must not flash its buttons.
  return <div className={`${className ?? ""} max-tablet:hidden`}>{children}</div>;
}

export function PageMenuButton() {
  const { count, open } = useMenu();
  if (!count) return null;
  return (
    <button
      type="button"
      aria-label="Page actions"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => update({ open: true })}
      className="focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--ln-radius-control-lg)] text-moss"
    >
      <Ellipsis className="h-5 w-5" aria-hidden />
    </button>
  );
}

/** The sheet behind ···. It stays mounted while hidden, so the actions in it keep their state between openings. */
export function PageMenuSheet() {
  const { open } = useMenu();
  const pathname = usePathname();
  const [items, setItems] = useState<HTMLDivElement | null>(null);
  // The sheet lives at the end of the page, which only exists in the browser.
  const inBrowser = useSyncExternalStore(noChanges, () => true, () => false);
  useEffect(() => { update({ target: items }); return () => update({ target: null }); }, [items]);
  useEffect(() => { update({ open: false }); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") update({ open: false }); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKey); };
  }, [open]);
  if (!inBrowser) return null;
  const close = () => update({ open: false });
  return createPortal(
    <div className="ln-page-menu ln-modal-layer fixed inset-0 z-50 tablet:hidden" hidden={!open}>
      <button type="button" aria-label="Close page actions" onClick={close} className="ln-modal-backdrop absolute inset-0 bg-ink/25 backdrop-blur-[1px]" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="page-menu-title"
        data-form="sheet"
        className="ln-dialog absolute inset-x-0 bottom-0 max-h-[82dvh]"
      >
        <DialogHeader title="Page actions" titleId="page-menu-title" closeLabel="Close page actions" onClose={close} />
        {/* A link leaves the page; a button may open its own dialog, so the sheet stays until closed. */}
        <div ref={setItems} className="ln-dialog-body" onClick={(event) => { if ((event.target as HTMLElement).closest("a[href]")) close(); }} />
      </section>
    </div>,
    document.body,
  );
}

/** Shared by the headers, the ··· button and the sheet: where the actions go, whether the sheet is open, how many headers have actions. */
type MenuState = { target: HTMLElement | null; open: boolean; count: number };
const closed: MenuState = { target: null, open: false, count: 0 };
let state = closed;
const listeners = new Set<() => void>();
const update = (next: Partial<MenuState>) => { state = { ...state, ...next }; listeners.forEach((listener) => listener()); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const useMenu = () => useSyncExternalStore(subscribe, () => state, () => closed);
const noChanges = () => () => {};
