"use client";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { newClientMutationId } from "@/lib/client-mutation-id";
import { kitBoxStatus, type KitComponentStates } from "@/lib/inventory";
import { labDateTime } from "@/lib/lab-time";
import { InventoryBatchIssue } from "./InventoryBatchIssue";
import { UsedUpCheckbox } from "./InventoryDetail";
import { useI18n } from "./I18nProvider";
import { QuantityInput } from "./QuantityInput";
import { formInputClass, formLabelClass, preventImplicitEnterSubmit } from "./forms";
import { Button } from "./ui/Button";
import { useModalDialog } from "./ui/ModalDialogProvider";

type Bottle = {
  id: string;
  label: string | null;
  state: string;
  holder: string | null;
  location: string | null;
  openedAt: string | null;
  componentStates: KitComponentStates | null;
  observations: { id: string; remaining: number; unit: string; quality: string; performedBy: string; createdAt: string }[];
  events: { id: string; action: string; createdAt: string; performedBy: string | null }[];
};
type KitComponent = { id: string; name: string; spec: string | null; storageCondition: string | null };

const actionLabels: Record<string, string> = {
  issue: "Take out",
  open: "Mark opened",
  transfer: "Hand over",
  return: "Return to store",
  empty: "Mark empty",
  observe: "Record remaining",
  edit: "Number and place",
  return_supplier: "Return to supplier",
  component: "Kit component",
};
const stateLabels: Record<string, string> = { warehouse: "In store", held: "In use", empty: "Empty", returned: "Returned to supplier" };
const componentStateLabels: Record<string, string> = { present: "Present", used_up: "Used up", missing: "Missing" };

/** The bottles, boxes or cylinders of package-managed stock: what is where, who has it, what is left. */
export function InventoryContainers({ itemId, unit, containers, observationUnits, kitComponents, places }: {
  itemId: string;
  /** Storage location paths, offered as suggestions wherever a container's place is typed. */
  places: string[];
  unit: string;
  containers: Bottle[];
  observationUnits: string[];
  kitComponents: KitComponent[];
}) {
  const router = useRouter();
  const dialog = useModalDialog();
  const { t } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);
  const [action, setAction] = useState("issue");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  // Per-bottle form values survive selection changes; a submit retains its original target.
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [mutationKey, setMutationKey] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ count: string; label: string; location: string; key: string } | null>(null);
  const [batch, setBatch] = useState(false);
  const bottle = containers.find((c) => c.id === selected);
  const draft = selected ? (drafts[selected] ?? {}) : {};
  const count = (state: string) => containers.filter((c) => c.state === state).length;
  const status = (c: Bottle) => kitBoxStatus(kitComponents, c.componentStates ?? {});
  const completeBoxes = kitComponents.length ? containers.filter((c) => (c.state === "warehouse" || c.state === "held") && status(c).complete).length : 0;

  function change(name: string, value: string) {
    if (selected) setDrafts((current) => ({ ...current, [selected]: { ...current[selected], [name]: value } }));
    setMutationKey(null);
  }

  async function post(body: Record<string, unknown>) {
    const response = await fetch(`/api/inventory/${itemId}/containers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const target = selected;
    setBusy(true);
    setMessage("");
    const key = mutationKey ?? newClientMutationId();
    setMutationKey(key);
    try {
      await post({
        action,
        containerId: target,
        clientMutationId: key,
        ...(draft.holder ? { holder: draft.holder } : {}),
        ...(draft.location !== undefined && ["issue", "transfer", "return", "edit"].includes(action) ? { location: draft.location } : {}),
        ...(action === "edit" ? { label: draft.label ?? bottle?.label ?? "" } : {}),
        ...(draft.openedAt ? { openedAt: draft.openedAt } : {}),
        ...(action === "observe" ? {
          remaining: draft.remaining === "" || draft.remaining === undefined ? undefined : Number(draft.remaining),
          unit: draft.unit ?? observationUnits[0],
          quality: draft.quality ?? "estimated",
          ...(draft.experimentId ? { experimentId: draft.experimentId } : {}),
        } : {}),
        ...(action === "component" ? { componentId: draft.componentId ?? kitComponents[0]?.id, componentState: draft.componentState ?? "missing", ...(draft.componentLocation ? { componentLocation: draft.componentLocation } : {}) } : {}),
        ...(draft.performedBy ? { performedBy: draft.performedBy } : {}),
        ...(action === "issue" && draft.usedUp === "true" ? { usedUp: true } : {}),
      });
      setMutationKey(null);
      setMessage("Saved");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Not saved; try again");
    } finally {
      setBusy(false);
    }
  }

  async function addContainers(event: React.FormEvent) {
    event.preventDefault();
    if (!adding) return;
    setBusy(true);
    setMessage("");
    try {
      await post({ action: "add", count: Number(adding.count), label: adding.label || undefined, location: adding.location || undefined, clientMutationId: adding.key });
      setAdding(null);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Not saved; try again");
    } finally {
      setBusy(false);
    }
  }

  async function remove(body: Record<string, unknown>, title: string) {
    if (!await dialog.confirm({ title: t(title), description: t("This cannot be undone."), confirmLabel: t("Delete"), tone: "destructive" })) return;
    setBusy(true);
    try {
      await post(body);
      if (body.action === "delete") setSelected(null);
      router.refresh();
    } catch (error) {
      await dialog.alert({ title: t("Not deleted"), description: t(error instanceof Error ? error.message : "Not deleted") });
    } finally {
      setBusy(false);
    }
  }

  const placesList = `places-${itemId}`;
  const field = (name: string, label: string, type = "text", required = false) => (
    <label className="min-w-0">
      <span className={formLabelClass}>{label}</span>
      <input aria-label={label} type={type} list={name === "location" || name === "componentLocation" ? placesList : undefined} className={formInputClass} value={draft[name] ?? (name === "label" ? bottle?.label ?? "" : name === "location" && action === "edit" ? bottle?.location ?? "" : "")} onChange={(e) => change(name, e.target.value)} required={required} />
    </label>
  );
  const offered = (key: string) => {
    if (!bottle) return false;
    if (bottle.state === "empty") return ["observe", "edit", "return_supplier"].includes(key);
    if (key === "component") return kitComponents.length > 0;
    if (key === "open") return !bottle.openedAt;
    if (key === "issue") return bottle.state === "warehouse";
    if (key === "transfer" || key === "return") return bottle.state === "held";
    if (key === "return_supplier") return bottle.state === "warehouse";
    return true;
  };

  return (
    <div className="space-y-3">
      <datalist id={placesList}>{places.map((place) => <option key={place} value={place} />)}</datalist>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-graphite">
          <span><span>In store</span> <strong className="tabular-nums">{count("warehouse")}</strong></span>
          <span><span>In use</span> <strong className="tabular-nums">{count("held")}</strong></span>
          <span><span>Empty</span> <strong className="tabular-nums">{count("empty")}</strong></span>
          {count("returned") ? <span><span>Returned to supplier</span> <strong className="tabular-nums">{count("returned")}</strong></span> : null}
          {kitComponents.length ? <span><span>Complete kits</span> <strong className="tabular-nums">{completeBoxes}</strong></span> : null}
        </p>
        <span className="flex gap-2">
          {count("warehouse") > 1 ? <Button type="button" size="sm" variant="ghost" aria-expanded={batch} onClick={() => setBatch(!batch)}>Take out several</Button> : null}
          <Button type="button" size="sm" disabled={busy} aria-expanded={!!adding} onClick={() => setAdding(adding ? null : { count: "1", label: "", location: "", key: newClientMutationId() })}><Plus className="h-3.5 w-3.5" aria-hidden />Add containers</Button>
        </span>
      </div>

      {adding ? (
        <form onSubmit={addContainers} onKeyDown={preventImplicitEnterSubmit} className="grid gap-3 rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-warm p-3 sm:grid-cols-[6rem_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <label><span className={formLabelClass}>How many</span><input aria-label="How many" type="number" min={1} max={1000} step={1} required className={formInputClass} value={adding.count} onChange={(e) => setAdding({ ...adding, count: e.target.value })} /></label>
          <label><span className={formLabelClass}>Container number</span><input aria-label="Container number" maxLength={80} placeholder="CO2-07" className={formInputClass} value={adding.label} onChange={(e) => setAdding({ ...adding, label: e.target.value })} /></label>
          <label><span className={formLabelClass}>Place</span><input aria-label="Place" list={placesList} maxLength={240} className={formInputClass} value={adding.location} onChange={(e) => setAdding({ ...adding, location: e.target.value })} /></label>
          <Button type="submit" variant="primary" disabled={busy}>Add</Button>
        </form>
      ) : null}

      {batch && count("warehouse") ? <InventoryBatchIssue itemId={itemId} placesList={placesList} available={containers.filter((c) => c.state === "warehouse").map((c) => c.id)} /> : null}

      {/* Rows divided by hairlines, not a box inside the panel (Q198). */}
      <ul className="divide-y divide-hairline border-y border-hairline">
        {containers.length ? containers.map((c, index) => {
          const kit = kitComponents.length ? status(c) : null;
          const reading = c.observations[0];
          return (
            <li key={c.id} className={selected === c.id ? "bg-warm" : undefined}>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setSelected(selected === c.id ? null : c.id);
                  setAction(c.state === "warehouse" ? "issue" : c.state === "empty" ? "return_supplier" : "observe");
                  setMessage("");
                  setMutationKey(null);
                }}
                aria-expanded={selected === c.id}
                className="focus-ring flex w-full flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2 text-left text-sm"
              >
                <span className="w-20 shrink-0 font-mono text-xs text-ink">{c.label ?? `#${index + 1}`}</span>
                <span className="min-w-0 flex-1 text-graphite">
                  <span>{stateLabels[c.state] ?? c.state}</span>
                  {c.holder ? <span> · {c.holder}</span> : null}
                  {c.location ? <span> · {c.location}</span> : null}
                  {c.openedAt ? <span> · <span>Opened</span> <span className="tabular-nums">{c.openedAt.slice(0, 10)}</span></span> : null}
                  {kit && !kit.complete ? <span className="text-warning"> · <span>Incomplete</span> · {kit.unavailable.map((entry) => entry.name).join(" / ")}</span> : null}
                </span>
                <span className="ml-auto shrink-0 whitespace-nowrap text-right text-xs text-muted">
                  {reading ? <><span>{reading.quality === "estimated" ? "Approx." : "Measured"}</span> <span className="tabular-nums">{reading.remaining} {reading.unit}</span></> : <span>No reading</span>}
                </span>
              </button>

              {selected === c.id && bottle ? (
                <div className="space-y-3 border-t border-hairline px-3 pb-3 pt-3">
                  {bottle.state !== "returned" ? (
                    <form onSubmit={submit} onKeyDown={preventImplicitEnterSubmit} className="grid gap-3 sm:grid-cols-3 sm:items-end">
                      <label>
                        <span className={formLabelClass}>Action</span>
                        <select aria-label="Container action" className={formInputClass} value={action} onChange={(e) => { setAction(e.target.value); setMutationKey(null); }}>
                          {Object.entries(actionLabels).filter(([key]) => offered(key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                        </select>
                      </label>
                      {action === "issue" || action === "transfer" ? field("holder", "Recipient", "text", true) : null}
                      {action === "issue" || action === "transfer" || action === "return" ? field("location", "Put at (optional)") : null}
                      {action === "issue" ? <UsedUpCheckbox className="sm:col-span-3" checked={draft.usedUp === "true"} onChange={(checked) => change("usedUp", String(checked))} /> : null}
                      {action === "edit" ? <>{field("label", "Container number")}{field("location", "Place")}</> : null}
                      {action === "open" ? field("openedAt", "Opened on", "date", true) : null}
                      {action === "observe" ? <>
                        <QuantityInput label={t("Remaining")} name="remaining" required value={draft.remaining ?? ""} unit={draft.unit ?? observationUnits[0]} options={observationUnits} checkPrecision onChange={(remaining, nextUnit) => { if (selected) setDrafts((current) => ({ ...current, [selected]: { ...current[selected], remaining, unit: nextUnit } })); setMutationKey(null); }} />
                        <label><span className={formLabelClass}>Estimate or measure</span><select aria-label="Estimate or measure" className={formInputClass} value={draft.quality ?? "estimated"} onChange={(e) => change("quality", e.target.value)}><option value="estimated">Estimated</option><option value="measured">Measured</option></select></label>
                        {field("performedBy", "Recorded by", "text", true)}
                      </> : null}
                      {action === "component" ? <>
                        <label><span className={formLabelClass}>Component</span><select aria-label="Component" className={formInputClass} value={draft.componentId ?? kitComponents[0]?.id} onChange={(e) => change("componentId", e.target.value)}>{kitComponents.map((component) => <option key={component.id} value={component.id}>{component.name}{component.spec ? ` · ${component.spec}` : ""}</option>)}</select></label>
                        <label><span className={formLabelClass}>Component state</span><select aria-label="Component state" className={formInputClass} value={draft.componentState ?? "missing"} onChange={(e) => change("componentState", e.target.value)}>{Object.entries(componentStateLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                        {field("componentLocation", "Kept at")}
                      </> : null}
                      <div className="flex items-end sm:col-start-3 sm:justify-end">
                        <Button type="submit" variant="primary" disabled={busy}>{busy ? "Saving…" : actionLabels[action]}</Button>
                      </div>
                    </form>
                  ) : <p className="text-sm text-muted">Returned to the supplier; its history is kept.</p>}
                  {message ? <p role="status" className="text-sm text-graphite">{message}</p> : null}

                  {kitComponents.length ? (
                    <ul className="flex flex-wrap gap-1.5 text-xs">
                      {kitComponents.map((component) => {
                        const state = bottle.componentStates?.[component.id];
                        const missing = kit?.unavailable.some((entry) => entry.id === component.id);
                        return <li key={component.id} className={`rounded-[var(--ln-radius-control-sm)] border px-2 py-0.5 ${missing ? "border-warning/40 bg-warning-surface text-warning" : "border-hairline text-graphite"}`}><span>{component.name}</span> · <span>{componentStateLabels[state?.state ?? "present"]}</span>{state?.location ? <span> · {state.location}</span> : null}</li>;
                      })}
                    </ul>
                  ) : null}

                  <details>
                    <summary className="focus-ring cursor-pointer py-1 text-xs font-medium text-muted">History</summary>
                    <ul className="mt-1 space-y-1 text-xs text-graphite">
                      {bottle.events.map((e) => <li key={e.id}><span className="tabular-nums">{labDateTime(e.createdAt)}</span> · <span>{actionLabels[e.action] ?? e.action}</span> · {e.performedBy ?? "—"}</li>)}
                      {bottle.observations.map((o) => (
                        <li key={o.id} className="flex items-center gap-2">
                          <span><span className="tabular-nums">{labDateTime(o.createdAt)}</span> · <span>{o.quality === "estimated" ? "Estimated" : "Measured"}</span> <span className="tabular-nums">{o.remaining} {o.unit}</span> · {o.performedBy}</span>
                          <button type="button" disabled={busy} onClick={() => remove({ action: "delete_observation", observationId: o.id }, "Delete this reading?")} aria-label="Delete reading" title="Delete reading" className="focus-ring inline-flex h-6 w-6 items-center justify-center rounded-[var(--ln-radius-control-sm)] text-muted hover:bg-error-surface hover:text-error"><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>
                        </li>
                      ))}
                      {!bottle.events.length && !bottle.observations.length ? <li className="text-muted">Nothing recorded yet.</li> : null}
                    </ul>
                  </details>

                  {!bottle.events.length && !bottle.observations.length ? (
                    <button type="button" disabled={busy} onClick={() => remove({ action: "delete", containerId: bottle.id }, "Delete this container?")} className="focus-ring inline-flex items-center gap-1.5 text-xs text-error hover:underline"><Trash2 className="h-3.5 w-3.5" aria-hidden />Delete this container (registered by mistake)</button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        }) : <li className="px-3 py-4 text-sm text-muted"><span>No containers yet.</span> <span>Add the ones in store, counted in</span> <span>{unit}</span>.</li>}
      </ul>
    </div>
  );
}
