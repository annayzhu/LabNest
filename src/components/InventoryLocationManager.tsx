"use client";

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
import { formInputClass, formLabelClass, formTextareaClass } from "@/components/forms";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { inventoryLocationDeleteBlockers, inventoryLocationTypes } from "@/lib/inventory-location-lifecycle";

const initialState: InventoryLocationActionState = {};

export type InventoryLocationManagerRecord = {
  id: string;
  name: string;
  type: (typeof inventoryLocationTypes)[number];
  status: "active" | "inactive" | "archived";
  parentLocationId: string | null;
  parentLocationName: string | null;
  temperature: string | null;
  description: string | null;
  counts: {
    items: number;
    itemsFrom: number;
    itemsTo: number;
    sampleEventsFrom: number;
    sampleEventsTo: number;
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
    <div className="space-y-5">
      <Card>
        <CardHeader title="Add inventory location" />
        <CardBody>
          <form ref={formRef} action={formAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="xl:col-span-2">
              <span className={formLabelClass}>Location name *</span>
              <input required name="name" maxLength={120} className={formInputClass} placeholder="Freezer B / Shelf 3" />
            </label>
            <LocationTypeField />
            <label>
              <span className={formLabelClass}>Temperature</span>
              <input name="temperature" maxLength={60} className={formInputClass} placeholder="-80 °C" />
            </label>
            <ParentLocationField locations={activeLocations} />
            <label className="md:col-span-2 xl:col-span-4">
              <span className={formLabelClass}>Description</span>
              <textarea name="description" maxLength={1000} className={formTextareaClass} placeholder="Room, access notes, shelf scope…" />
            </label>
            <div className="flex items-end justify-end">
              <Button type="submit" size="lg" variant="primary" disabled={pending}><MapPin className="h-4 w-4" />{pending ? "Adding…" : "Add location"}</Button>
            </div>
            <ActionMessage state={state} className="md:col-span-2 xl:col-span-5" />
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Managed locations" action={<Badge tone="neutral">{locations.length} locations</Badge>} />
        <CardBody className="space-y-3">
          {locations.length ? locations.map((location) => (
            <InventoryLocationEditor key={location.id} location={location} locations={activeLocations} />
          )) : <p className="rounded-[var(--ln-radius-control-lg)] border border-dashed border-hairline px-4 py-8 text-center text-sm text-muted">No inventory locations have been created.</p>}
        </CardBody>
      </Card>
    </div>
  );
}

function InventoryLocationEditor({ location, locations }: { location: InventoryLocationManagerRecord; locations: InventoryLocationManagerRecord[] }) {
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [updateState, updateAction, updating] = useActionState(updateInventoryLocation, initialState);
  const [archiveState, archiveAction, archiving] = useActionState(archiveInventoryLocation, initialState);
  const [restoreState, restoreAction, restoring] = useActionState(restoreInventoryLocation, initialState);
  const [deleteState, deleteAction, deleting] = useActionState(deleteInventoryLocation, initialState);
  const blockers = inventoryLocationDeleteBlockers(location.counts);
  const movementReferences = location.counts.itemsFrom + location.counts.itemsTo;
  const sampleReferences = location.counts.sampleEventsFrom + location.counts.sampleEventsTo;
  const pending = updating || archiving || restoring || deleting;

  return (
    <section className="rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-warm/35 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-ink">{location.name}</h3>
            <Badge tone="sage">{location.type}</Badge>
            <Badge tone={location.status === "active" ? "success" : "neutral"}>{location.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            {[location.parentLocationName ? `Under ${location.parentLocationName}` : "Top level", location.temperature, location.description].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span>{location.counts.items} assigned items</span>
            <span>{movementReferences} movement references</span>
            <span>{sampleReferences} sample references</span>
            <span>{location.counts.childLocations} child locations</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setEditing((value) => !value)} disabled={pending}><Pencil className="h-4 w-4" />Rename / edit</Button>
          {location.status === "active" ? (
            <form action={archiveAction}><input type="hidden" name="id" value={location.id} /><Button type="submit" disabled={pending}><Archive className="h-4 w-4" />{archiving ? "Archiving…" : "Archive"}</Button></form>
          ) : (
            <form action={restoreAction}><input type="hidden" name="id" value={location.id} /><Button type="submit" disabled={pending}><RotateCcw className="h-4 w-4" />{restoring ? "Restoring…" : "Restore"}</Button></form>
          )}
          <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)} disabled={pending || blockers.length > 0} title={blockers.length ? `Archive instead: ${blockers.join(", ")}.` : "Permanently delete unused location"}><Trash2 className="h-4 w-4" />Delete</Button>
        </div>
      </div>

      {blockers.length ? <p className="mt-3 rounded-[var(--ln-radius-control-md)] border border-warning/25 bg-warning-surface px-3 py-2 text-xs leading-5 text-graphite">Permanent deletion is blocked by {blockers.join(", ")}. Archive the location to remove it from new selections while preserving history.</p> : null}
      <ActionMessage state={archiveState.error || archiveState.success ? archiveState : restoreState} />

      {editing ? (
        <form action={updateAction} className="mt-4 grid gap-4 border-t border-hairline pt-4 md:grid-cols-2 xl:grid-cols-5">
          <input type="hidden" name="id" value={location.id} />
          <label className="xl:col-span-2"><span className={formLabelClass}>Location name *</span><input required name="name" defaultValue={location.name} maxLength={120} className={formInputClass} /></label>
          <LocationTypeField defaultValue={location.type} />
          <label><span className={formLabelClass}>Temperature</span><input name="temperature" defaultValue={location.temperature ?? ""} maxLength={60} className={formInputClass} /></label>
          <ParentLocationField locations={locations.filter((candidate) => candidate.id !== location.id)} defaultValue={location.parentLocationId} />
          <label className="md:col-span-2 xl:col-span-4"><span className={formLabelClass}>Description</span><textarea name="description" defaultValue={location.description ?? ""} maxLength={1000} className={formTextareaClass} /></label>
          <div className="flex items-end justify-end gap-2"><Button type="button" onClick={() => setEditing(false)} disabled={updating}>Cancel</Button><Button type="submit" variant="primary" disabled={updating}>{updating ? "Saving…" : "Save changes"}</Button></div>
          <ActionMessage state={updateState} className="md:col-span-2 xl:col-span-5" />
        </form>
      ) : null}

      {deleteOpen ? (
        <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setDeleteOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby={`delete-location-${location.id}`} className="w-full max-w-lg rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-5 shadow-soft">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-error">Irreversible</p><h2 id={`delete-location-${location.id}`} className="mt-1 font-serif text-xl font-medium text-ink">Delete unused location forever?</h2></div><button type="button" aria-label="Close" disabled={deleting} onClick={() => setDeleteOpen(false)} className="focus-ring rounded-[var(--ln-radius-control-sm)] p-1.5 text-muted hover:bg-stone"><X className="h-4 w-4" /></button></div>
            <p className="mt-4 text-sm leading-6 text-graphite">This location has no inventory or historical references. Enter <strong className="font-mono text-error">{location.name}</strong> to confirm permanent deletion.</p>
            <form action={deleteAction} className="mt-4 space-y-4">
              <input type="hidden" name="id" value={location.id} />
              <input required autoFocus autoComplete="off" name="confirmation" className={formInputClass} />
              <ActionMessage state={deleteState} />
              <div className="flex justify-end gap-2 border-t border-hairline pt-4"><Button type="button" disabled={deleting} onClick={() => setDeleteOpen(false)}>Cancel</Button><Button type="submit" variant="destructive" disabled={deleting}><Trash2 className="h-4 w-4" />{deleting ? "Deleting…" : "Delete forever"}</Button></div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function LocationTypeField({ defaultValue = "other" }: { defaultValue?: string }) {
  return <label><span className={formLabelClass}>Type *</span><select required name="type" defaultValue={defaultValue} className={formInputClass}>{inventoryLocationTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>;
}

function ParentLocationField({ locations, defaultValue }: { locations: InventoryLocationManagerRecord[]; defaultValue?: string | null }) {
  return <label><span className={formLabelClass}>Parent location</span><select name="parentLocationId" defaultValue={defaultValue ?? ""} className={formInputClass}><option value="">Top level</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>;
}

function ActionMessage({ state, className = "" }: { state: InventoryLocationActionState; className?: string }) {
  if (!state.error && !state.success) return null;
  return <p role={state.error ? "alert" : "status"} className={`${className} rounded-[var(--ln-radius-control-md)] border px-3 py-2 text-sm ${state.error ? "border-error/30 bg-error-surface text-error" : "border-success/25 bg-success-surface text-success"}`}>{state.error ?? state.success}</p>;
}
