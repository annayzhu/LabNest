"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Archive, MapPin, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import {
  archiveInventoryLocation,
  createInventoryLocation,
  deleteInventoryLocation,
  restoreInventoryLocation,
  updateInventoryLocation,
  type InventoryLocationActionState,
} from "@/app/inventory/locations/actions";
import { formInputClass, formLabelClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { inventoryLocationDeleteBlockers, inventoryLocationTypes, readLocationTemperature, temperatureLabel } from "@/lib/inventory-location-lifecycle";

const initialState: InventoryLocationActionState = {};

export type InventoryLocationManagerRecord = {
  id: string;
  name: string;
  type: (typeof inventoryLocationTypes)[number];
  status: "active" | "inactive" | "archived";
  parentLocationId: string | null;
  path: string;
  temperature: string | null;
  description: string | null;
  counts: {
    items: number;
    itemsFrom: number;
    itemsTo: number;
    samples: number;
    childLocations: number;
  };
};

export function InventoryLocationManager({ locations }: { locations: InventoryLocationManagerRecord[] }) {
  const [state, formAction, pending] = useActionState(createInventoryLocation, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const activeLocations = locations.filter((location) => location.status === "active");

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-hairline px-4 py-2.5">
          <h2 className="text-sm font-semibold text-ink">Add location</h2>
          <p className="text-xs text-muted">Locations can sit inside one another, such as room, fridge, shelf, box. Add the fridge first, then its shelves inside it.</p>
        </div>
        <form ref={formRef} action={formAction} className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_9rem_12rem_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
          <label>
            <span className={formLabelClass}>Location name *</span>
            <input required name="name" maxLength={120} className={formInputClass} placeholder="Freezer B / Shelf 3" />
          </label>
          <LocationTypeField />
          <TemperatureField />
          <ParentLocationField locations={activeLocations} />
          <label>
            <span className={formLabelClass}>Description</span>
            <input name="description" maxLength={1000} className={formInputClass} placeholder="Room, access notes…" />
          </label>
          <Button type="submit" variant="primary" disabled={pending} aria-busy={pending}><MapPin className="h-4 w-4" />{pending ? "Adding…" : "Add"}</Button>
          <ActionMessage state={state} className="md:col-span-2 xl:col-span-6" />
        </form>
      </section>

      <section className="overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface">
        <h2 className="flex items-center gap-2 border-b border-hairline px-4 py-2.5 text-sm font-semibold text-ink"><span>Locations</span> <span className="text-xs font-normal tabular-nums text-muted">{locations.length}</span></h2>
        {locations.length ? <ul className="divide-y divide-hairline">{locations.map((location) => (
          <InventoryLocationEditor key={location.id} location={location} locations={activeLocations} />
        ))}</ul> : <p className="px-4 py-6 text-center text-sm text-muted">No inventory locations have been created.</p>}
      </section>
    </div>
  );
}

const iconButton = "focus-ring inline-flex h-8 w-8 items-center justify-center rounded-[var(--ln-radius-control-sm)] text-muted hover:bg-stone hover:text-ink disabled:opacity-40";

function InventoryLocationEditor({ location, locations }: { location: InventoryLocationManagerRecord; locations: InventoryLocationManagerRecord[] }) {
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [updateState, updateAction, updating] = useActionState(async (previous: InventoryLocationActionState, formData: FormData) => {
    const result = await updateInventoryLocation(previous, formData);
    if (result.success) setEditing(false);
    return result;
  }, initialState);
  const [archiveState, archiveAction, archiving] = useActionState(archiveInventoryLocation, initialState);
  const [restoreState, restoreAction, restoring] = useActionState(restoreInventoryLocation, initialState);
  const [deleteState, deleteAction, deleting] = useActionState(deleteInventoryLocation, initialState);
  const blockers = inventoryLocationDeleteBlockers(location.counts);
  const movementReferences = location.counts.itemsFrom + location.counts.itemsTo;
  const pending = updating || archiving || restoring || deleting;

  return (
    <li className={location.status === "active" ? undefined : "bg-warm/60"}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-2 text-sm md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,11rem)_auto]">
        <span className="min-w-0">
          <span className={`font-medium ${location.status === "active" ? "text-ink" : "text-muted"}`}>{location.path}</span>
          <span className="ml-2 text-xs text-muted">{location.type}</span>
          {location.status !== "active" ? <span className="ml-2 text-xs text-muted">Archived</span> : null}
        </span>
        <span className="hidden min-w-0 truncate text-xs text-muted md:block">
          {[temperatureLabel(location.temperature), location.description].filter(Boolean).map((part, index) => <span key={part}>{index ? " · " : ""}{part}</span>)}
        </span>
        <span className="hidden text-xs text-muted md:block"><span className="tabular-nums">{location.counts.items}</span> <span>stock items</span> · <span className="tabular-nums">{movementReferences}</span> <span>stock movements</span>{location.counts.samples ? <> · <Link href={`/samples?location=${location.id}`} className="text-moss hover:underline"><span className="tabular-nums">{location.counts.samples}</span> <span>samples</span></Link></> : null}</span>
        <span className="flex justify-end gap-0.5">
          <button type="button" onClick={() => setEditing((value) => !value)} disabled={pending} aria-label="Edit location" title="Edit location" className={iconButton}><Pencil className="h-4 w-4" /></button>
          {location.status === "active" ? (
            <form action={archiveAction}><input type="hidden" name="id" value={location.id} /><button type="submit" disabled={pending} aria-label="Archive location" title="Archive location" className={iconButton}><Archive className="h-4 w-4" /></button></form>
          ) : (
            <form action={restoreAction}><input type="hidden" name="id" value={location.id} /><button type="submit" disabled={pending} aria-label="Restore location" title="Restore location" className={iconButton}><RotateCcw className="h-4 w-4" /></button></form>
          )}
          <button type="button" onClick={() => setDeleteOpen(true)} disabled={pending || blockers.length > 0} aria-label="Delete location" title={blockers.length ? `Archive instead: ${blockers.join(", ")}.` : "Delete location"} className={`${iconButton} hover:bg-error-surface hover:text-error`}><Trash2 className="h-4 w-4" /></button>
        </span>
      </div>
      <ActionMessage state={archiveState.error ? archiveState : restoreState.error ? restoreState : location.status === "active" ? restoreState : archiveState} className="mx-4 mb-2" />

      {editing ? (
        <form action={updateAction} className="grid gap-3 border-t border-hairline/70 bg-warm px-4 py-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_9rem_12rem_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
          <input type="hidden" name="id" value={location.id} />
          <label><span className={formLabelClass}>Location name *</span><input required name="name" defaultValue={location.name} maxLength={120} className={formInputClass} /></label>
          <LocationTypeField defaultValue={location.type} />
          <TemperatureField stored={location.temperature} />
          <ParentLocationField locations={locations.filter((candidate) => candidate.id !== location.id)} defaultValue={location.parentLocationId} />
          <label><span className={formLabelClass}>Description</span><input name="description" defaultValue={location.description ?? ""} maxLength={1000} className={formInputClass} /></label>
          <div className="flex gap-2"><Button type="button" onClick={() => setEditing(false)} disabled={updating}>Cancel</Button><Button type="submit" variant="primary" disabled={updating} aria-busy={updating}>{updating ? "Saving…" : "Save"}</Button></div>
          <ActionMessage state={updateState} className="md:col-span-2 xl:col-span-6" />
        </form>
      ) : null}

      {deleteOpen ? (
        <div role="presentation" className="ln-modal-layer fixed inset-0 z-50 flex items-center justify-center p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setDeleteOpen(false); }}>
          <div className="ln-modal-backdrop pointer-events-none absolute inset-0 bg-ink/35 backdrop-blur-[2px]" aria-hidden />
          <section role="dialog" aria-modal="true" aria-labelledby={`delete-location-${location.id}`} className="ln-modal-card relative w-full max-w-lg rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-5 shadow-soft">
            <div className="flex items-start justify-between gap-4"><h2 id={`delete-location-${location.id}`} className="text-lg font-semibold text-ink">Delete unused location forever?</h2><button type="button" aria-label="Close" disabled={deleting} onClick={() => setDeleteOpen(false)} className="focus-ring rounded-[var(--ln-radius-control-sm)] p-1.5 text-muted hover:bg-stone"><X className="h-4 w-4" /></button></div>
            <p className="mt-3 text-sm leading-6 text-graphite"><span>This location has no inventory or historical references. Enter the name to confirm permanent deletion:</span> <strong className="font-mono text-error">{location.name}</strong></p>
            <form action={deleteAction} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={location.id} />
              <input required autoFocus autoComplete="off" name="confirmation" className={formInputClass} />
              <ActionMessage state={deleteState} />
              <div className="flex justify-end gap-2 border-t border-hairline pt-4"><Button type="button" disabled={deleting} onClick={() => setDeleteOpen(false)}>Cancel</Button><Button type="submit" variant="destructive" disabled={deleting}><Trash2 className="h-4 w-4" />{deleting ? "Deleting…" : "Delete forever"}</Button></div>
            </form>
          </section>
        </div>
      ) : null}
    </li>
  );
}

function LocationTypeField({ defaultValue = "other" }: { defaultValue?: string }) {
  return <label><span className={formLabelClass}>Type *</span><select required name="type" defaultValue={defaultValue} className={formInputClass}>{inventoryLocationTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>;
}

/** The number in °C, or room temperature; older text that is not one number is shown so it is not lost unseen. */
function TemperatureField({ stored }: { stored?: string | null }) {
  const read = readLocationTemperature(stored);
  const [room, setRoom] = useState(read?.room ?? false);
  return (
    <div>
      <span className={formLabelClass}>Temperature</span>
      <div className="flex items-center gap-2">
        <span className="relative min-w-0 flex-1">
          <input aria-label="Temperature" name="temperature" type="number" step="any" min={-273} max={300} defaultValue={read?.degrees ?? ""} disabled={room} placeholder={read ? "-80" : stored ?? ""} className={`${formInputClass} pr-9 tabular-nums`} />
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">°C</span>
        </span>
        <label className="flex shrink-0 items-center gap-1.5 text-xs text-graphite"><input type="checkbox" name="roomTemperature" checked={room} onChange={(event) => setRoom(event.target.checked)} />Room temperature</label>
      </div>
    </div>
  );
}

function ParentLocationField({ locations, defaultValue }: { locations: InventoryLocationManagerRecord[]; defaultValue?: string | null }) {
  return <label><span className={formLabelClass}>Inside location (optional)</span><select name="parentLocationId" defaultValue={defaultValue ?? ""} className={formInputClass}><option value="">None (top level)</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.path}</option>)}</select></label>;
}

function ActionMessage({ state, className = "" }: { state: InventoryLocationActionState; className?: string }) {
  if (!state.error && !state.success) return null;
  return <p role={state.error ? "alert" : "status"} className={`${className} rounded-[var(--ln-radius-control-md)] border px-3 py-2 text-sm ${state.error ? "border-error/30 bg-error-surface text-error" : "border-success/25 bg-success-surface text-success"}`}>{state.error ?? state.success}</p>;
}
