"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { updateSample } from "@/app/samples/actions";
import { formInputClass, formLabelClass } from "@/components/forms";
import { Button, buttonStyles } from "@/components/ui/Button";
import type { FormActionState } from "@/lib/form-actions";
import { biosafetyLevels, sampleStatuses, sampleStatusLabels, type SampleStatusValue, type SampleTypeRef } from "@/lib/samples";

type Initial = {
  id: string; code: string; name: string; typeId: string; origin: string; parentCode: string; projectId: string; status: SampleStatusValue;
  locationId: string; position: string; amount: string; amountUnit: string; concentration: string; concentrationUnit: string;
  collectedAt: string; biosafetyLevel: string; notes: string; fields: Record<string, string>;
};

/** One sample's record (S10). A sample out of storage has no place; saving such a status frees its position. */
export function SampleForm({ initial, types, locations, projects }: {
  initial: Initial; types: SampleTypeRef[]; locations: Array<{ id: string; label: string; grid: string | null }>; projects: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState<FormActionState, FormData>(updateSample, {});
  const [typeId, setTypeId] = useState(initial.typeId);
  const [status, setStatus] = useState(initial.status);
  const type = types.find((candidate) => candidate.id === typeId);
  const label = (text: string, input: React.ReactNode, wide = false) => <label className={wide ? "md:col-span-2" : undefined}><span className={formLabelClass}>{text}</span>{input}</label>;
  return (
    <form action={action} className="space-y-4 rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-4">
      <input type="hidden" name="id" value={initial.id} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {label("Name", <input name="name" required maxLength={200} defaultValue={initial.name} className={formInputClass} />)}
        {label("Code", <input name="code" required maxLength={80} defaultValue={initial.code} className={`${formInputClass} font-mono`} />)}
        {label("Type", <select name="typeId" value={typeId} onChange={(event) => setTypeId(event.target.value)} className={formInputClass}>{types.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select>)}
        {label("Status", <select name="status" value={status} onChange={(event) => setStatus(event.target.value as SampleStatusValue)} className={formInputClass}>{sampleStatuses.map((value) => <option key={value} value={value}>{sampleStatusLabels[value]}</option>)}</select>)}
        {label("Origin", <input name="origin" maxLength={500} defaultValue={initial.origin} placeholder="Patient P-01 · A549 siFBN2" className={formInputClass} />)}
        {label("Parent sample", <input name="parentCode" maxLength={80} defaultValue={initial.parentCode} placeholder="Code" className={`${formInputClass} font-mono`} />)}
        {label("Project", <select name="projectId" defaultValue={initial.projectId} className={formInputClass}><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>)}
        {label("Date", <input name="collectedAt" defaultValue={initial.collectedAt} placeholder="2026-10-31" className={formInputClass} />)}
      </div>
      {status === "available" ? (
        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {label("Box", <select name="locationId" defaultValue={initial.locationId} className={formInputClass}><option value="">Not placed</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.label}{location.grid ? ` · ${location.grid}` : ""}</option>)}</select>)}
          {label("Position", <input name="position" maxLength={40} defaultValue={initial.position} placeholder="A1" className={`${formInputClass} font-mono`} />)}
        </div>
      ) : <p className="text-sm text-muted">A sample that is not in storage has no place; saving frees its position.</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {label("Amount", <input name="amount" inputMode="decimal" defaultValue={initial.amount} className={formInputClass} />)}
        {label("Unit", <input name="amountUnit" maxLength={40} defaultValue={initial.amountUnit} placeholder={type?.amountUnit || "µL"} className={formInputClass} />)}
        {label("Concentration", <input name="concentration" inputMode="decimal" defaultValue={initial.concentration} className={formInputClass} />)}
        {label("Unit", <input name="concentrationUnit" maxLength={40} defaultValue={initial.concentrationUnit} placeholder={type?.concentrationUnit || "ng/µL"} className={formInputClass} />)}
        {label("Biosafety level", <select name="biosafetyLevel" defaultValue={initial.biosafetyLevel} className={formInputClass}><option value="">—</option>{biosafetyLevels.map((level) => <option key={level} value={level}>{level}</option>)}</select>)}
      </div>
      {type?.fields.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {type.fields.map((field) => label(field.label, field.kind === "choice" && field.options
            ? <select key={`${typeId}:${field.key}`} name={`field:${field.key}`} defaultValue={initial.fields[field.key] ?? ""} className={formInputClass}><option value="">—</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
            : <input key={`${typeId}:${field.key}`} name={`field:${field.key}`} type={field.kind === "date" ? "date" : "text"} inputMode={field.kind === "number" ? "decimal" : undefined} defaultValue={initial.fields[field.key] ?? ""} className={formInputClass} />))}
        </div>
      ) : null}
      {label("Notes", <textarea name="notes" rows={3} maxLength={5000} defaultValue={initial.notes} className={formInputClass} />, true)}
      {state.error ? <p role="alert" className="text-sm text-error">{state.error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        <Link href={`/samples/${initial.id}`} className={buttonStyles({ variant: "ghost" })}>Cancel</Link>
      </div>
    </form>
  );
}
