"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { useActionState } from "react";
import { addInventoryManual, type ManualUploadState } from "@/app/inventory/manual-actions";
import { AttachmentDeleteButton } from "./AttachmentDeleteButton";
import { Button } from "./ui/Button";

export type InventoryManual = { attachmentId: string; linkId: string; filename: string; size: number };

/** 说明书 of a product, kept on its inventory item: open, remove, or add one. 按产品查找说明书 finds them from here. */
export function InventoryManuals({ itemId, manuals }: { itemId: string; manuals: InventoryManual[] }) {
  const [state, action, pending] = useActionState(addInventoryManual.bind(null, itemId), {} as ManualUploadState);
  return <div className="space-y-3">
    {manuals.length ? <ul className="space-y-1">{manuals.map(manual => <li key={manual.linkId} className="flex items-center gap-2 text-sm">
      <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      <a href={`/api/attachments/${manual.attachmentId}`} target="_blank" rel="noreferrer" className="focus-ring min-w-0 flex-1 truncate text-moss hover:underline">{manual.filename}</a>
      <span className="text-xs text-muted">{`${Math.max(1, Math.round(manual.size / 1024))} KB`}</span>
      <AttachmentDeleteButton attachmentId={manual.attachmentId} linkId={manual.linkId} filename={manual.filename} />
    </li>)}</ul> : <p className="text-sm text-muted">No manual is kept on this item.</p>}
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input name="file" type="file" accept=".pdf,.doc,.docx,.txt,.md" required aria-label="Manual file" className="min-w-0 text-xs" />
      <Button type="submit" size="sm" disabled={pending} aria-busy={pending}>{pending ? "Adding…" : "Add manual"}</Button>
    </form>
    {state.error ? <p role="alert" className="text-xs text-error">{state.error}</p> : null}
    {state.message ? <p role="status" className="text-xs text-success">{state.message}</p> : null}
    <p className="text-xs text-muted">A manual kept here is found by 按产品查找说明书, and can be organized into a Protocol from there. <Link href="/protocols/import/recognize" className="focus-ring text-moss underline">Find a manual</Link></p>
  </div>;
}
