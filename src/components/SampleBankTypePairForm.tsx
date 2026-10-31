"use client";

import { useActionState } from "react";
import { saveSampleBankTypeMap } from "@/app/samples/bank/actions";
import { formInlineInputClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { FormActionState } from "@/lib/form-actions";

/** A bank type word LabNest did not recognise, and the sample type to remember for it (S27). */
export function SampleBankTypePairForm({ bankType, count, types }: { bankType: string; count: number; types: Array<{ id: string; label: string }> }) {
  const [state, action, pending] = useActionState<FormActionState, FormData>(saveSampleBankTypeMap, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 text-sm">
      <input type="hidden" name="bankType" value={bankType} />
      <span className="font-mono text-xs text-ink">{bankType}</span>
      <span className="text-xs text-muted tabular-nums">({count})</span>
      <span aria-hidden className="text-muted">→</span>
      <select name="typeId" aria-label={`Sample type for ${bankType}`} defaultValue="" className={cn(formInlineInputClass, "h-8 w-auto")}>
        <option value="" disabled>Choose a type</option>
        {types.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
      </select>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>Remember</Button>
      {state.error ? <span role="alert" className="text-error">{state.error}</span> : null}
    </form>
  );
}
