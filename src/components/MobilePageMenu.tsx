"use client";

import { createContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Ellipsis, X } from "lucide-react";

/**
 * On a phone the top bar keeps ← title ···, Notion-style, and a page header's actions move into the sheet behind ···.
 * A computer shows them in the header as before. Either way there is one copy, so a button keeps its state.
 */

/** Inside the sheet a page's own "More actions" menu lays its items out flat instead of opening a second menu. */
export const InPageMenu = createContext(false);

/** A page header's actions. `className` lays them out in the header on a computer. */
export function PageActions({ children, className }: { children: ReactNode; className?: string }) {
  const phone = usePhone();
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
  if (phone) return <><span ref={probe} className="block h-0 w-0" aria-hidden />{shown && target ? createPortal(<InPageMenu.Provider value><div className="ln-page-menu-items">{children}</div></InPageMenu.Provider>, target) : null}</>;
  // Before the page knows it is on a phone, the header must not flash its buttons.
  return <div className={`${className ?? ""} max-lg:hidden`}>{children}</div>;
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
    <div className="ln-page-menu ln-modal-layer fixed inset-0 z-50 lg:hidden" hidden={!open}>
      <button type="button" aria-label="Close page actions" onClick={close} className="ln-modal-backdrop absolute inset-0 bg-ink/25 backdrop-blur-[1px]" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="page-menu-title"
        className="ln-modal-card ln-modal-sheet absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto rounded-t-[var(--ln-radius-panel)] border-t border-hairline bg-surface px-4 pt-3 shadow-soft pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 id="page-menu-title" className="text-sm font-semibold text-muted">Page actions</h2>
          <button type="button" onClick={close} aria-label="Close page actions" className="focus-ring flex h-11 w-11 items-center justify-center rounded-full text-muted">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {/* A link leaves the page; a button may open its own dialog, so the sheet stays until closed. */}
        <div ref={setItems} onClick={(event) => { if ((event.target as HTMLElement).closest("a[href]")) close(); }} />
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

const phoneQuery = "(max-width: 1023.98px)";
function usePhone() {
  return useSyncExternalStore(
    (onChange) => { const query = window.matchMedia(phoneQuery); query.addEventListener("change", onChange); return () => query.removeEventListener("change", onChange); },
    () => window.matchMedia(phoneQuery).matches,
    () => false,
  );
}
