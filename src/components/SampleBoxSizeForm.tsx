"use client";

import { useActionState } from "react";
import { setBoxGrid } from "@/app/samples/actions";
import { formInlineInputClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { FormActionState } from "@/lib/form-actions";

const presets = [[9, 9], [10, 10], [8, 12], [16, 24], [5, 5]] as const;

/** A box's rows and columns (S7); refused while a sample would sit outside them. */
export function SampleBoxSizeForm({ locationId, rows, columns }: { locationId: string; rows: number | null; columns: number | null }) {
  const [state, action, pending] = useActionState<FormActionState, FormData>(setBoxGrid, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 text-sm">
      <input type="hidden" name="locationId" value={locationId} />
      <span className="text-muted">Box size</span>
      <input name="rows" aria-label="Rows" inputMode="numeric" defaultValue={rows ?? ""} placeholder="9" className={cn(formInlineInputClass, "h-8 w-16")} />
      <span aria-hidden>×</span>
      <input name="columns" aria-label="Columns" inputMode="numeric" defaultValue={columns ?? ""} placeholder="9" className={cn(formInlineInputClass, "h-8 w-16")} />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>Save</Button>
      <span className="text-xs text-muted">{presets.map(([r, c]) => `${r}×${c}`).join(" · ")}</span>
      {state.error ? <p role="alert" className="basis-full text-error">{state.error}</p> : state.success ? <p role="status" className="basis-full text-moss">{state.success}</p> : null}
    </form>
  );
}
