"use client";

import { newClientMutationId } from "@/lib/client-mutation-id";

import { createPortal } from "react-dom";
import { Gauge, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { enqueueMobileMutation } from "@/lib/mobile-mutation-queue";

export function MobileMeasurementCapture({ experimentId, step }: { experimentId: string; step?: { id: string; title: string; order: number } }) {
  const router = useRouter();
  const trigger = useRef<HTMLButtonElement>(null);
  const formRef=useRef<HTMLFormElement>(null);
  const draftKey=`labnest.measurement-draft:${experimentId}:${step?.id ?? "none"}`;
  const valueInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [hasOpened,setHasOpened]=useState(false);
  const [observedAt, setObservedAt] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const frame=requestAnimationFrame(()=>{try {
      const draft=JSON.parse(sessionStorage.getItem(draftKey)??"null");
      if(draft && formRef.current)for(const [name,value] of Object.entries(draft)) {
        const input=formRef.current.elements.namedItem(name);
        if(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)input.value=String(value);
        if(name==="observedAt")setObservedAt(String(value));
      }
    } catch { setStatus("Draft storage unavailable. Keep this page open."); }
    valueInput.current?.focus();});
    const close = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) { setOpen(false); trigger.current?.focus(); } };
    window.addEventListener("keydown", close);
    return () => {cancelAnimationFrame(frame);window.removeEventListener("keydown", close);};
  }, [open,draftKey,saving]);

  function finishDraft(){
    try{sessionStorage.removeItem(draftKey);}catch{}
    formRef.current?.reset();setOpen(false);setHasOpened(false);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!step) return;
    setSaving(true); setStatus("");
    try {
    const data = new FormData(event.currentTarget);
    const optionalNumber = (key: string) => String(data.get(key) ?? "").trim() === "" ? undefined : Number(data.get(key));
    const payload = { experimentId, experimentStepId: step.id, value: Number(data.get("value")), unit: String(data.get("unit") ?? "").trim(), observedAt: new Date(String(data.get("observedAt"))).toISOString(), sampleLabel: String(data.get("sampleLabel") ?? "").trim() || undefined, expectedMin: optionalNumber("expectedMin"), expectedMax: optionalNumber("expectedMax"), notes: String(data.get("notes") ?? "").trim() || undefined };
    const clientMutationId = newClientMutationId();
    const deviceCreatedAt = new Date().toISOString();
      if (!navigator.onLine) {
        await enqueueMobileMutation({ clientMutationId, actionType: "measurement.create", deviceCreatedAt, state: "pending", retryCount: 0, payload });
        finishDraft();
        setStatus("Waiting to sync. The raw value is saved on this device.");
        return;
      }
      const response = await fetch("/api/mobile/measurements", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, clientMutationId, deviceCreatedAt }) });
      const result = await response.json() as { error?: string; validationStatus?: string };
      if (!response.ok) throw new Error(result.error ?? "Measurement could not be saved.");
      setStatus(result.validationStatus === "warning" ? "Saved · outside the expected range; review required." : "Saved and synced.");
      finishDraft();
      router.refresh();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Measurement could not be saved."); }
    finally { setSaving(false); }
  }

  return <>
    <button ref={trigger} type="button" disabled={!step} onClick={() => {
      const now = new Date();
      if(!hasOpened)setObservedAt(new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
      setHasOpened(true);setOpen(true);
    }} className="focus-ring flex min-h-14 flex-col items-center justify-center gap-1 rounded-[var(--ln-radius-control-lg)] border border-hairline bg-surface px-2 text-center text-xs font-semibold text-moss disabled:opacity-45"><Gauge className="h-5 w-5" aria-hidden />Measurement</button>
    {!open && status ? <p role="status" className="text-xs text-muted">{status}</p> : null}
    {hasOpened && step ? createPortal(<div hidden={!open} className="ln-modal-layer fixed inset-0 z-50 lg:hidden"><button type="button" aria-label="Close measurement" onClick={() => { if(saving)return;setOpen(false); trigger.current?.focus(); }} className="ln-modal-backdrop absolute inset-0 bg-ink/25" /><section role="dialog" aria-modal="true" aria-labelledby="measurement-title" className="ln-modal-card ln-modal-sheet absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-[var(--ln-radius-panel)] border-t border-hairline bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-soft">
      <div className="flex items-start justify-between gap-3"><div><h2 id="measurement-title" className="font-serif text-xl font-medium text-ink">Record measurement</h2><p className="mt-1 text-xs text-muted">Step {step.order} · {step.title}</p></div><button type="button" onClick={() => { if(saving)return;setOpen(false); trigger.current?.focus(); }} aria-label="Close measurement" className="focus-ring flex h-11 w-11 items-center justify-center rounded-full border border-hairline"><X className="h-4 w-4" /></button></div>
      <form ref={formRef} onInput={()=>{try{if(formRef.current)sessionStorage.setItem(draftKey,JSON.stringify(Object.fromEntries(new FormData(formRef.current))));}catch{setStatus("Draft could not be saved. Keep this page open.");}}} onSubmit={submit} className="mt-4 grid grid-cols-2 gap-3">
        <label><span className="text-xs font-semibold text-muted">Value *</span><input ref={valueInput} required name="value" type="number" step="any" className="focus-ring mt-1 h-12 w-full rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm px-3 text-base text-ink" /></label>
        <label><span className="text-xs font-semibold text-muted">Unit *</span><input required name="unit" maxLength={32} placeholder="ng/µL, %, fold…" className="focus-ring mt-1 h-12 w-full rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm px-3 text-base text-ink" /></label>
        <label className="col-span-2"><span className="text-xs font-semibold text-muted">Observed at *</span><input required name="observedAt" type="datetime-local" value={observedAt} onChange={(event) => setObservedAt(event.target.value)} className="focus-ring mt-1 h-12 w-full rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm px-3 text-sm text-ink" /></label>
        <label className="col-span-2"><span className="text-xs font-semibold text-muted">Sample · optional</span><input name="sampleLabel" maxLength={160} className="focus-ring mt-1 h-12 w-full rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm px-3 text-sm text-ink" /></label>
        <label><span className="text-xs font-semibold text-muted">Expected minimum</span><input name="expectedMin" type="number" step="any" className="focus-ring mt-1 h-11 w-full rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm px-3 text-sm text-ink" /></label>
        <label><span className="text-xs font-semibold text-muted">Expected maximum</span><input name="expectedMax" type="number" step="any" className="focus-ring mt-1 h-11 w-full rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm px-3 text-sm text-ink" /></label>
        <label className="col-span-2"><span className="text-xs font-semibold text-muted">Note · optional</span><textarea name="notes" maxLength={2000} className="focus-ring mt-1 min-h-20 w-full rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm px-3 py-2 text-sm text-ink" /></label>
        {status ? <p role="status" className="col-span-2 rounded-[var(--ln-radius-control-lg)] bg-warm px-3 py-2 text-sm text-graphite">{status}</p> : null}
        <button disabled={saving} className="focus-ring col-span-2 min-h-12 rounded-[var(--ln-radius-control-lg)] bg-action px-4 text-sm font-semibold text-white">{saving ? "Saving…" : "Save measurement"}</button>
      </form>
    </section></div>, document.body) : null}
  </>;
}
