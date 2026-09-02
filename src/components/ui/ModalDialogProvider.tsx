"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formInputClass } from "@/components/forms";

type DialogTone = "default" | "destructive";
type ConfirmOptions = { title: string; description?: string; confirmLabel?: string; cancelLabel?: string; tone?: DialogTone };
type PromptOptions = ConfirmOptions & { defaultValue?: string; inputLabel?: string };
type DialogRequest =
  | ({ kind: "confirm" } & ConfirmOptions & { resolve: (value: boolean) => void })
  | ({ kind: "prompt" } & PromptOptions & { resolve: (value: string | null) => void })
  | ({ kind: "alert" } & Omit<ConfirmOptions, "cancelLabel"> & { resolve: () => void });

type ModalDialogApi = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
  alert: (options: Omit<ConfirmOptions, "cancelLabel">) => Promise<void>;
};

const ModalDialogContext = createContext<ModalDialogApi | null>(null);

export function useModalDialog() {
  const value = useContext(ModalDialogContext);
  if (!value) throw new Error("useModalDialog must be used inside ModalDialogProvider");
  return value;
}

export function ModalDialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => setRequest({ kind: "confirm", ...options, resolve })), []);
  const prompt = useCallback((options: PromptOptions) => new Promise<string | null>((resolve) => setRequest({ kind: "prompt", ...options, resolve })), []);
  const alert = useCallback((options: Omit<ConfirmOptions, "cancelLabel">) => new Promise<void>((resolve) => setRequest({ kind: "alert", ...options, resolve })), []);

  return <ModalDialogContext.Provider value={{ confirm, prompt, alert }}>{children}{request ? <ModalDialog request={request} onDone={() => setRequest(null)} /> : null}</ModalDialogContext.Provider>;
}

function ModalDialog({ request, onDone }: { request: DialogRequest; onDone: () => void }) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [value, setValue] = useState(request.kind === "prompt" ? request.defaultValue ?? "" : "");
  const valueRef = useRef(value);

  const close = useCallback((accepted: boolean) => {
    if (request.kind === "confirm") request.resolve(accepted);
    else if (request.kind === "prompt") request.resolve(accepted ? valueRef.current : null);
    else request.resolve();
    onDone();
    queueMicrotask(() => triggerRef.current?.focus());
  }, [onDone, request]);

  useEffect(() => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("input, button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(false);
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>("input, button:not([disabled])")];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [close]);

  return <div className="ln-modal-layer fixed inset-0 z-[90] grid place-items-center p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(false); }}>
    <div className="ln-modal-backdrop pointer-events-none absolute inset-0 bg-ink/35 backdrop-blur-[2px]" aria-hidden />
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="ln-modal-card relative z-10 w-full max-w-md overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface shadow-soft">
      <div className="flex items-start justify-between gap-4 border-b border-hairline px-4 py-3.5">
        <div className="min-w-0">
          {request.tone === "destructive" ? <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-error"><AlertTriangle className="h-3 w-3" aria-hidden />Irreversible</p> : null}
          <h2 id={titleId} className="font-serif text-lg font-medium leading-tight text-ink">{request.title}</h2>
        </div>
        <button type="button" onClick={() => close(false)} className="focus-ring flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--ln-radius-control-sm)] text-muted hover:bg-stone hover:text-ink" aria-label="Close dialog"><X className="h-4 w-4" aria-hidden /></button>
      </div>
      <form className="p-4" onSubmit={(event) => { event.preventDefault(); close(true); }}>
        {request.description ? <p className="whitespace-pre-line text-sm leading-6 text-graphite">{request.description}</p> : null}
        {request.kind === "prompt" ? <label className="mt-3 block"><span className="mb-1 block text-xs font-semibold text-graphite">{request.inputLabel ?? "Value"}</span><input className={formInputClass} value={value} onChange={(event) => { valueRef.current = event.target.value; setValue(event.target.value); }} autoFocus /></label> : null}
        <div className="mt-4 flex justify-end gap-2 border-t border-hairline pt-3">
          {request.kind !== "alert" ? <Button type="button" onClick={() => close(false)}>{request.cancelLabel ?? "Cancel"}</Button> : null}
          <Button type="submit" variant={request.tone === "destructive" ? "destructive" : "primary"}>{request.confirmLabel ?? (request.kind === "alert" ? "OK" : "Confirm")}</Button>
        </div>
      </form>
    </section>
  </div>;
}
