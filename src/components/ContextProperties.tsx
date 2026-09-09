"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Pin, X } from "lucide-react";

type PanelState = { active: string | null; pinned: boolean; select: (id: string | null) => void; togglePin: () => void; dismiss: (id: string) => void };
const Context = createContext<PanelState | null>(null);

export function useContextProperties() { return useContext(Context); }

export function ContextPropertiesProvider({ children }: { children: ReactNode }) {
  const [active, select] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  const dismiss = useCallback((id: string) => select(current => current === id ? null : current), []);
  const togglePin = useCallback(() => setPinned(value => !value), []);
  const value = useMemo(() => ({ active, pinned, select, togglePin, dismiss }), [active, pinned, togglePin, dismiss]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Fields stay mounted with explicit native form ownership; the portal escapes document zoom transforms. */
export function ContextProperties({ title, children, selected = false, trigger = true, activation = 0, triggerLabel, autoDismiss = false }: {
  title: string; children: ReactNode; selected?: boolean; trigger?: boolean; activation?: number; triggerLabel?: string; autoDismiss?: boolean;
}) {
  const context = useContext(Context);
  const id = useId();
  const panel = useRef<HTMLElement>(null);
  const anchorNode = useRef<HTMLSpanElement | null>(null);
  const ownerForm = useRef<HTMLFormElement | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const anchor = useCallback((node: HTMLSpanElement | null) => {
    if (!node) return;
    anchorNode.current = node;
    ownerForm.current = node.closest('form');
    if (ownerForm.current && !ownerForm.current.getAttribute("id")) ownerForm.current.setAttribute("id", `properties-form-${id}`);
    setPortalTarget(node.ownerDocument.body);
  }, [id]);
  useEffect(() => {
    const element = panel.current, form = ownerForm.current;
    if (!element || !form) return;
    const associate = () => element.querySelectorAll('input,select,textarea,button').forEach(control => { if (!control.hasAttribute('form')) control.setAttribute('form',form.getAttribute('id')!); });
    associate();
    const observer = new MutationObserver(associate); observer.observe(element,{childList:true,subtree:true});
    return () => observer.disconnect();
  }, [portalTarget]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const select = context?.select, dismiss = context?.dismiss;
  const previousSelection = useRef(false);
  useEffect(() => {
    if (selected || activation > 0) select?.(id);
    else if (previousSelection.current) dismiss?.(id);
    previousSelection.current = selected;
  }, [selected, activation, id, select, dismiss]);
  const open = context?.active === id;
  useEffect(() => {
    if (!open || !window.matchMedia('(max-width: 639px)').matches) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {document.body.style.overflow = previous;};
  }, [open]);
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
  useEffect(() => {
    if (!open || !autoDismiss || context?.pinned) return;
    const outside = (event: Event) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !anchorNode.current?.parentElement?.contains(target)) dismiss?.(id);
    };
    document.addEventListener('pointerdown',outside); document.addEventListener('focusin',outside);
    return () => { document.removeEventListener('pointerdown',outside); document.removeEventListener('focusin',outside); };
  }, [open, autoDismiss, context?.pinned, dismiss, id]);
  if (!context) return <section aria-label={title}>{children}</section>;
  return <>
    <span ref={anchor} hidden />
    {trigger ? <button ref={triggerRef} type="button" className="focus-ring min-h-11 px-2 text-sm text-moss" aria-expanded={open} aria-controls={id} onClick={() => context.select(id)}>{triggerLabel ?? title}</button> : null}
    {portalTarget ? createPortal(<aside ref={panel} id={id} aria-label={title} aria-hidden={!open} inert={!open} hidden={!open} className="context-properties" data-pinned={context.pinned} data-print-hidden onInvalidCapture={event => { event.preventDefault(); context.select(id); const input = event.target as HTMLElement; setTimeout(() => input.focus(),0); }} onClick={event => event.stopPropagation()}>
      <header className="context-properties-header"><h2 className="min-w-0 flex-1 font-semibold">{title}</h2><button type="button" aria-label={context.pinned ? "取消固定" : "固定展开"} aria-pressed={context.pinned} className="focus-ring min-h-11 min-w-11" onClick={context.togglePin}><Pin className="mx-auto h-4 w-4" /></button><button type="button" aria-label="收起属性" className="focus-ring min-h-11 min-w-11" onClick={close}><X className="mx-auto h-4 w-4" /></button></header>
      <div className="context-properties-body">{children}</div><footer className="border-t border-hairline px-4 py-2"><button type="button" className="focus-ring min-h-11 text-moss" onClick={close}>返回主界面继续填写或保存</button></footer>
    </aside>, portalTarget) : null}
  </>;
}
