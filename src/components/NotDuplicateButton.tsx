"use client";

import { useActionState } from "react";
import { setNotDuplicate } from "@/app/inventory/products/actions";
import { Button } from "@/components/ui/Button";
import type { FormActionState } from "@/lib/form-actions";

/** Marks these products or lots as not duplicates, so the duplicate check stops listing them together. */
export function NotDuplicateButton({ ids }: { ids: string[] }) {
  const [state, action, pending] = useActionState(setNotDuplicate, {} as FormActionState);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      {ids.map((id) => <input key={id} type="hidden" name="id" value={id} />)}
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>Not a duplicate</Button>
      {state.error ? <span role="alert" className="text-xs text-error">{state.error}</span> : null}
    </form>
  );
}
