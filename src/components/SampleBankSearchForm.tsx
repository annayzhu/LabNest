"use client";

import { useActionState } from "react";
import { startSampleBankSearch } from "@/app/samples/bank/actions";
import { formInputClass, formLabelClass, formTextareaClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import type { FormActionState } from "@/lib/form-actions";

/** The search sent to the sample bank (S20): any of keywords, types, disease, collection dates and name = value lines. */
export function SampleBankSearchForm({ bankName, types }: { bankName: string; types: Array<{ key: string; label: string }> }) {
  const [state, action, pending] = useActionState<FormActionState, FormData>(startSampleBankSearch, {});
  return (
    <form action={action} className="space-y-3 rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-4">
      <h2 className="text-base font-semibold text-ink"><span>Search</span> {bankName}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2"><span className={formLabelClass}>Keywords</span><input name="text" maxLength={200} placeholder="ESCC, P001…" className={formInputClass} /></label>
        <fieldset className="text-sm sm:col-span-2">
          <legend className={formLabelClass}>Sample types</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {types.map((type) => (
              <label key={type.key} className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-2.5 py-1 text-sm">
                <input type="checkbox" name="sampleTypes" value={type.key} /><span>{type.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="text-sm"><span className={formLabelClass}>Disease</span><input name="disease" maxLength={200} className={formInputClass} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm"><span className={formLabelClass}>Collected from</span><input type="date" name="collectedFrom" className={formInputClass} /></label>
          <label className="text-sm"><span className={formLabelClass}>Collected until</span><input type="date" name="collectedTo" className={formInputClass} /></label>
        </div>
        <label className="text-sm sm:col-span-2">
          <span className={formLabelClass}>Extra conditions</span>
          <textarea name="attributes" rows={3} placeholder={"病理 = 鳞癌\nstage = IIIA"} className={formTextareaClass} />
          <span className="mt-1 block text-xs text-muted">One per line, written name = value.</span>
        </label>
        <label className="text-sm"><span className={formLabelClass}>At most</span><input name="limit" type="number" min={1} max={5000} defaultValue={500} className={formInputClass} /><span className="mt-1 block text-xs text-muted">records, up to 5000</span></label>
        <label className="text-sm"><span className={formLabelClass}>Requested by</span><input name="requestedBy" maxLength={120} className={formInputClass} /></label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>Send search</Button>
        {state.error ? <p role="alert" className="text-sm text-error">{state.error}</p> : null}
      </div>
    </form>
  );
}
