"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Pin, X } from "lucide-react";

type PanelState = { active: string | null; pinned: boolean; select: (id: string | null) => void; togglePin: () => void };
const Context = createContext<PanelState | null>(null);

export function useContextProperties() { return useContext(Context); }

export function ContextPropertiesProvider({ children }: { children: ReactNode }) {
  const [active, select] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  const togglePin = useCallback(() => setPinned(value => !value), []);
  const value = useMemo(() => ({ active, pinned, select, togglePin }), [active, pinned, togglePin]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Fields stay mounted inside their owning form: selection never retargets a draft or its submit. */
export function ContextProperties({ title, children, selected = false, trigger = true, activation = 0, triggerLabel }: {
  title: string; children: ReactNode; selected?: boolean; trigger?: boolean; activation?: number; triggerLabel?: string;
}) {
  const context = useContext(Context);
  const id = useId();
  const panel = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const select = context?.select;
  useEffect(() => { if (selected || activation > 0) select?.(id); }, [selected, activation, id, select]);
  const open = context?.active === id;
  function close() { context?.select(null); triggerRef.current?.focus(); }
  useEffect(() => {
    if (!open) return;
    const handle = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key === "Tab" && window.matchMedia("(max-width: 639px)").matches && panel.current) {
        const fields = [...panel.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([type="hidden"]):not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]')].filter(e => e.getClientRects().length);
        const first = fields[0], last = fields.at(-1);
        if (event.shiftKey && (document.activeElement === first || !panel.current.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !panel.current.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
      }
      if (event.key === "Escape") { event.preventDefault(); select?.(null); triggerRef.current?.focus(); }
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [open, select]);
  if (!context) return <section aria-label={title}>{children}</section>;
  return <>
    {trigger ? <button ref={triggerRef} type="button" className="focus-ring min-h-11 px-2 text-sm text-moss" aria-expanded={open} aria-controls={id} onClick={() => context.select(id)}>{triggerLabel ?? title}</button> : null}
    <aside ref={panel} id={id} aria-label={title} hidden={!open} className="context-properties" data-pinned={context.pinned} data-print-hidden onInvalidCapture={event => { event.preventDefault(); context.select(id); const input = event.target as HTMLElement; setTimeout(() => input.focus(),0); }} onClick={event => event.stopPropagation()}>
      <header className="context-properties-header"><h2 className="min-w-0 flex-1 font-semibold">{title}</h2><button type="button" aria-label={context.pinned ? "取消固定" : "固定展开"} aria-pressed={context.pinned} className="focus-ring min-h-11 min-w-11" onClick={context.togglePin}><Pin className="mx-auto h-4 w-4" /></button><button type="button" aria-label="收起属性" className="focus-ring min-h-11 min-w-11" onClick={close}><X className="mx-auto h-4 w-4" /></button></header>
      <div className="context-properties-body">{children}</div>
    </aside>
  </>;
}
