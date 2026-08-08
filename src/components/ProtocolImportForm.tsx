"use client";

import { useActionState } from "react";
import { FileUp } from "lucide-react";
import { importProtocolDocx, type ProtocolImportState } from "@/app/protocols/import/actions";

const initialState: ProtocolImportState = {};

export function ProtocolImportForm() {
  const [state, action, pending] = useActionState(importProtocolDocx, initialState);

  return (
    <form action={action} className="space-y-5">
      <label className="block rounded-[10px] border border-dashed border-border-strong bg-warm p-5">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          <FileUp className="h-4 w-4 text-moss" aria-hidden />
          Protocol DOCX
        </span>
        <input
          required
          type="file"
          name="docx"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="mt-4 block w-full text-sm text-graphite file:mr-4 file:rounded-[8px] file:border file:border-hairline file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink"
        />
        <span className="mt-3 block text-xs leading-5 text-muted">Maximum 20 MB. The original file is read for structure and checksum; LabNest does not overwrite an existing Protocol code.</span>
      </label>
      {state.error ? <p role="alert" className="rounded-[8px] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error">{state.error}</p> : null}
      <div className="flex justify-end">
        <button disabled={pending} className="focus-ring h-10 rounded-[8px] border border-moss bg-moss px-4 text-sm font-medium text-warm disabled:cursor-wait disabled:opacity-60">
          {pending ? "Reading document…" : "Import Protocol"}
        </button>
      </div>
    </form>
  );
}
