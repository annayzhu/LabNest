"use client";
import { QuantityInput } from "./QuantityInput";
import { convert, parseScalar } from "@/lib/calculators/quantities";
import {newClientMutationId} from "@/lib/client-mutation-id";
import { createPortal } from "react-dom";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formInputClass, preventImplicitEnterSubmit } from "./forms";
import { Button } from "./ui/Button";
import { useI18n } from "./I18nProvider";
import { enqueueMobileMutation } from "@/lib/mobile-mutation-queue";
type Row = {
  id: string;
  name: string;
  expected: number | null;
  actual: number | null;
  unit: string;
  source: string;
  inventoryItemId: string | null;
  /** The stock as it is named now; the record keeps the name it was saved with (Q191). */
  inventoryItem?: { name: string } | null;
  containerId: string | null;
  status: string;
  error: string | null;
  correctionOfId: string | null;
};
type Stock = {
  id: string;
  name: string;
  unit: string;
  managementMode: string;
  lotNumber: string | null;
  containers: { id: string; holder: string | null }[];
};
export function RunMaterials({
  experimentId,
  rows,
  stock,
  editable,
}: {
  experimentId: string;
  rows: Row[];
  stock: Stock[];
  editable: boolean;
}) {
  const router = useRouter();
  // The phone layout shows column names from data-label, which the page translator does not reach.
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [review, setReview] = useState(false);
  const [sessionKey, setSessionKey] = useState('create');
  type Draft = {draftId:string|null;name:string;expected:string;actual:string;unit:string;source:string;inventory:string;container:string;correction:string|null};
  const drafts = useRef<Record<string,Draft>>({});
  const [dialogActive,setDialogActive] = useState(false);
  function applyDraft(d:Draft) {setDraftId(d.draftId);setName(d.name);setExpected(d.expected);setActual(d.actual);setUnit(d.unit);setSource(d.source);setInventory(d.inventory);setContainer(d.container);setCorrection(d.correction);}
  const blankDraft: Draft = {draftId:null,name:'',expected:'',actual:'',unit:'mL',source:'manual',inventory:'',container:'',correction:null};
  function rowDraft(row: Row, correcting=false): Draft {return {draftId:correcting?null:row.id,name:row.name,expected:row.expected===null?'':String(row.expected),actual:row.actual===null?'':String(row.actual),unit:row.unit,source:correcting?`correction:${row.id}`:row.source,inventory:row.inventoryItemId??'',container:correcting?'':row.containerId??'',correction:correcting?row.id:row.correctionOfId};}
  function openDialog(key='create', initial=blankDraft) {
    if (busy) return;
    if(key!==sessionKey) {
      drafts.current[sessionKey]={draftId,name,expected,actual,unit,source,inventory,container,correction};
      applyDraft(drafts.current[key] ?? initial);
      setSessionKey(key);
    }
    setDialogActive(true);setMounted(true);requestAnimationFrame(()=>dialogRef.current?.showModal());
  }
  function closeDialog() { setDialogActive(false); dialogRef.current?.close(); triggerRef.current?.focus(); }
  async function remove(id: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/experiments/${experimentId}/materials`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'delete',id})});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setStatus('Usage record deleted; stock unchanged.'); router.refresh();
    } catch(error) { setStatus(error instanceof Error ? error.message : 'Couldn’t delete. Try again'); }
    finally {setBusy(false);}
  }
  const [name, setName] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [unit, setUnit] = useState("mL");
  const [source, setSource] = useState("manual");
  const [inventory, setInventory] = useState("");
  const [container, setContainer] = useState("");
  const [correction, setCorrection] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  function adjustment(row: Row) {
    const original = rows.find(r=>r.id===row.correctionOfId);
    if (!original || original.actual===null || row.actual===null) return '';
    try {const prior=original.unit===row.unit?original.actual:convert(original.actual,original.unit,row.unit);const delta=Number((prior-row.actual).toPrecision(12));return `; book adjustment ${delta>0?'+':''}${delta} ${row.unit} (corrected use, not a physical return)`;} catch{return '; units are not compatible, cannot deduct';}
  }
  const selected = stock.find((s) => s.id === inventory);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    const id = draftId ?? newClientMutationId();
    setDraftId(id);
    const payload = {
      action: "save",
      id,
      name,
      expected: expected.trim() ? Number(expected) : null,
      actual: actual.trim() ? Number(actual) : null,
      unit,
      source,
      inventoryItemId: inventory || null,
      containerId: container || null,
      correctionOfId: correction,
    };
    try {
      if (!navigator.onLine) {
        await enqueueMobileMutation({
          actionType: "run.material",
          clientMutationId: id,
          deviceCreatedAt: new Date().toISOString(),
          state: "pending",
          retryCount: 0,
          payload: { experimentId, row: payload },
        });
        setStatus("Saved on this device, waiting to sync; stock not deducted yet.");
      } else {
        const r = await fetch(`/api/experiments/${experimentId}/materials`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const result = await r.json();
        if (!r.ok) throw new Error(result.error);
        setStatus("Usage record saved; stock not deducted yet.");
        router.refresh();
      }
      if ((event.nativeEvent as SubmitEvent).submitter?.getAttribute("data-continue") !== "true") closeDialog();
      setDraftId(null);
      setName("");
      setExpected("");
      setActual("");
      setCorrection(null);
      setInventory('');setContainer('');setSource('manual');
      delete drafts.current[sessionKey];setSessionKey('create');applyDraft(drafts.current.create ?? blankDraft);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Couldn’t save; your input is kept",
      );
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    setBusy(true);
    try {
      const r = await fetch(`/api/experiments/${experimentId}/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          ids: selection,
        }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      setStatus(
        result.some((r: { status: string }) => !["submitted","recorded"].includes(r.status))
          ? "Some deductions are still pending; the usage records are kept."
          : "Deduction confirmed.",
      );
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Couldn’t submit; you can try again");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="border-t border-hairline py-4">
      <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-base font-semibold">Reagents and consumables used in this run</h2>{editable ? <button ref={triggerRef} type="button" className="focus-ring min-h-11 px-3 text-moss" onClick={()=>openDialog()}>Add</button> : null}</div>
      {!rows.length ? <p className="text-sm text-muted">Nothing recorded yet</p> : null}
      <div className="overflow-x-auto" hidden={!rows.length}>
        <table className="ln-run-material-table w-full text-left text-sm">
          <thead>
            <tr>
              {["Reagent or consumable", "Expected use", "Actual use", "Stock handling", "Actions"].map((h) => (
                <th key={h} className="px-2 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-hairline">
                <td data-label={t("Reagent or consumable")} className="p-2">
                  {row.inventoryItem?.name ?? row.name}
                  {row.inventoryItem && row.inventoryItem.name !== row.name ? <span className="block text-xs text-muted"><span>Recorded as</span> {row.name}</span> : null}
                </td>
                <td data-label={t("Expected use")} className="p-2 text-right tabular-nums">
                  {row.expected ?? "not recorded"} {row.unit}
                </td>
                <td data-label={t("Actual use")} className="p-2 text-right tabular-nums">
                  {row.actual ?? "not confirmed"} {row.unit}
                </td>
                <td data-label={t("Source")} className="p-2">
                  {row.status === "pending" && editable ? <label className="flex gap-2"><input type="checkbox" aria-label={`Select ${row.name} for deduction`} checked={selection.includes(row.id)} onChange={event=>setSelection(old=>event.target.checked?[...old,row.id]:old.filter(id=>id!==row.id))}/>Deduction to confirm</label> : row.status === 'submitted' ? 'Deducted' : 'Recorded only'}
                  <details><summary className="cursor-pointer text-muted">Source and details</summary><p>{row.source === 'manual' ? 'Entered by hand' : row.source.startsWith('correction:') ? 'Correction' : 'From the Protocol'}</p>{row.source.startsWith('Consumption:') ? <p className="break-words">{row.source.split('|').slice(1).join('|') || row.source}</p> : null}<p>{stock.find(s=>s.id===row.inventoryItemId)?.name ?? 'Stock not managed'}</p>{row.containerId ? <><p>{`Container taken: ${row.containerId}`}</p><p>{`Holder: ${stock.find(s=>s.id===row.inventoryItemId)?.containers?.find(c=>c.id===row.containerId)?.holder ?? 'see the container record'}`}</p><a className="text-moss underline" href={`/inventory/${row.inventoryItemId}`}>View holder and remaining amount</a></> : null}{row.error ? <p role="alert" className="text-error">{row.error}</p> : null}</details>
                </td>
                <td data-label={t("Actions")} className="p-2">
                  {row.status !== "submitted" && editable ? <button type="button" className="focus-ring ml-2 min-h-11 text-moss" onClick={()=>openDialog(`edit:${row.id}`,rowDraft(row))}>Edit</button>:null}
                  {row.status !== "submitted" && editable ? <button type="button" disabled={busy} className="focus-ring ml-2 min-h-11 text-error" onClick={()=>remove(row.id)}>Delete</button>:null}
                  {row.status === "submitted" &&
                  editable &&
                  !rows.some((r) => r.correctionOfId === row.id) ? (
                    <button
                      type="button"
                      className="focus-ring ml-2 min-h-11 text-moss"
                      onClick={()=>openDialog(`correction:${row.id}`,rowDraft(row,true))}
                    >
                      Record a correction
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable ? (
        <>
          {mounted ? createPortal(<dialog ref={dialogRef} aria-label="Add consumable" className="ln-material-dialog bg-surface text-ink" onCancel={event=>{if(busy){event.preventDefault();return;}setDialogActive(false);triggerRef.current?.focus();}}>
          <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{correction ? 'Correct consumable record' : sessionKey.startsWith('edit:') ? 'Edit consumable' : 'Add consumable'}</h3><Button type="button" disabled={busy} onClick={closeDialog}>Close</Button></div>
          {status && dialogActive ? <p role="alert" className="my-2 text-sm">{status}</p> : null}
          <form
            onSubmit={save}
            onKeyDown={preventImplicitEnterSubmit}
            className="mt-4 flex flex-wrap items-end gap-3"
          >
            <fieldset disabled={busy} className="contents">
            <label className="text-sm">
              Name
              <input
                required
                className={formInputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <QuantityInput label="Expected use" name="expected" value={expected} unit={unit || "mL"} onChange={(next,nextUnit)=>{
              try {const nextActual=nextUnit!==unit && actual.trim()?String(Number(convert(parseScalar(actual),unit,nextUnit).toPrecision(14))):actual;setExpected(next);setActual(nextActual);setUnit(nextUnit);}
              catch {setStatus("Fill in the actual amount before switching units.");}
            }}/>
            <QuantityInput label="Actual use" name="actual" value={actual} unit={unit || "mL"} onChange={(next, nextUnit) => {
              try { const nextExpected = nextUnit !== unit && expected.trim() ? String(Number(convert(parseScalar(expected),unit,nextUnit).toPrecision(14))) : expected; setExpected(nextExpected); setActual(next); setUnit(nextUnit); }
              catch { setStatus("Fill in the expected amount before switching units."); }
            }} />
            <p className="w-full text-sm text-muted">{source === 'manual' ? 'Entered by hand' : correction ? 'Correcting a deducted record: after saving, confirm the stock adjustment explicitly.' : `From the Protocol: ${source.split('|').slice(1).join('|') || 'the saved version rule'}`}</p>
            <label className="text-sm">
              Stock source
              <select
                className={formInputClass}
                value={inventory}
                disabled={!!correction}
                onChange={(e) => {
                  setInventory(e.target.value);
                  setContainer("");
                }}
              >
                <option value="">Stock not managed</option>
                {stock.map((s) => (
                  <option key={s.id} value={s.id}>
                    {`${s.name} · ${s.lotNumber ?? "Lot not recorded"} · ${s.id.slice(-6)}`}
                  </option>
                ))}
              </select>
            </label>
            {selected?.managementMode === "package" ? (
              <label className="text-sm">
                Container used
                <select
                  required
                  className={formInputClass}
                  value={container}
                  onChange={(e) => setContainer(e.target.value)}
                >
                  <option value="">Choose a container you took out</option>
                  {selected.containers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {`${c.id} · ${c.holder ?? "Holder not recorded"}`}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <Button type="button" disabled={!expected.trim()} onClick={()=>setActual(expected)}>Use the expected amount as actual</Button>
            <Button type="submit" disabled={busy}>
              {correction ? "Save correction" : "Save usage record"}
            </Button>
            <Button type="submit" data-continue="true" disabled={busy}>Add and continue</Button>
          </fieldset></form></dialog>, document.body) : null}
          {selection.length ? (
            <Button
              type="button"
              className="mt-4"
              disabled={busy}
              onClick={()=>setReview(true)}
            >
              {`Review ${selection.length} selected deductions`}
            </Button>
          ) : null}
          {review ? <div className="mt-3 border-t border-hairline py-3"><p>Only the selected amounts below are deducted; saving a record never deducts stock.</p><ul>{rows.filter(r=>selection.includes(r.id)).map(r=><li key={r.id}>{`${r.inventoryItem?.name ?? r.name} — deduct ${r.actual ?? 'not confirmed'} ${r.unit}${adjustment(r)}`}</li>)}</ul><Button type="button" disabled={busy || !selection.length} onClick={async()=>{await confirm();setReview(false);setSelection([]);}}>Deduct the selected items</Button><Button type="button" onClick={()=>setReview(false)}>Cancel</Button></div> : null}
        </>
      ) : null}
      {status && !dialogActive ? (
        <p role="status" className="mt-3 text-sm">
          {status}
        </p>
      ) : null}
    </section>
  );
}
