"use client";

import Link from "next/link";
import { FileText, Wand2 } from "lucide-react";
import { useActionState, useState } from "react";
import { addProductDocument, setProductDocumentKind } from "@/app/inventory/products/actions";
import { formInlineInputClass } from "@/components/forms";
import type { FormActionState } from "@/lib/form-actions";
import { AttachmentDeleteButton } from "./AttachmentDeleteButton";
import { Button } from "./ui/Button";
import { FilePicker } from "./ui/FilePicker";
import { productDocumentKindNames, productDocumentKinds } from "@/lib/inventory";

export type ProductDocument = { attachmentId: string; linkId: string; filename: string; size: number; kind: string };
const selectClass = formInlineInputClass.replace("w-full", "w-auto");

/**
 * A product's manual, SDS and kit manual, seen by every lot. A kit manual opens in 整理说明书 to become a Protocol.
 */
export function InventoryDocuments({ productId, documents, manualQuery }: { productId: string; documents: ProductDocument[]; manualQuery: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [added, setAdded] = useState(0);
  const [addState, add, adding] = useActionState(async (previous: FormActionState, data: FormData) => {
    const result = await addProductDocument(productId, previous, data);
    if (result.success) { setFile(null); setAdded((count) => count + 1); }
    return result;
  }, {} as FormActionState);
  const [kindState, setKind] = useActionState(setProductDocumentKind, {} as FormActionState);

  return (
    <div className="space-y-3">
      {documents.length ? (
        <ul className="divide-y divide-hairline rounded-[var(--ln-radius-panel-inner)] border border-hairline">
          {documents.map((document) => (
            <li key={document.linkId} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              <a href={`/api/attachments/${document.attachmentId}`} target="_blank" rel="noreferrer" className="focus-ring min-w-0 flex-1 truncate text-moss hover:underline">{document.filename}</a>
              <span className="text-xs text-muted">{`${Math.max(1, Math.round(document.size / 1024))} KB`}</span>
              <form action={setKind}>
                <input type="hidden" name="linkId" value={document.linkId} />
                <select name="kind" aria-label="Document kind" defaultValue={document.kind} onChange={(event) => event.currentTarget.form?.requestSubmit()} className={`${selectClass} h-8 text-xs`}>
                  {productDocumentKinds.map((kind) => <option key={kind} value={kind}>{productDocumentKindNames[kind]}</option>)}
                </select>
              </form>
              {document.kind === "kit_manual" ? <Link href={`/protocols/import/recognize?manual=${encodeURIComponent(manualQuery)}`} className="focus-ring inline-flex items-center gap-1 text-xs text-moss hover:underline"><Wand2 className="h-3.5 w-3.5" aria-hidden />Organize into a Protocol</Link> : null}
              <AttachmentDeleteButton attachmentId={document.attachmentId} linkId={document.linkId} filename={document.filename} />
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted">No documents yet. Every lot of this product sees what is added here.</p>}
      <form action={add} className="flex flex-wrap items-center gap-2">
        <select name="kind" aria-label="Document kind" defaultValue="product_manual" className={`${selectClass} h-8 text-xs`}>
          {productDocumentKinds.map((kind) => <option key={kind} value={kind}>{productDocumentKindNames[kind]}</option>)}
        </select>
        <FilePicker key={added} name="file" accept=".pdf,.doc,.docx,.txt,.md" required aria-label="Document file" onFiles={(files) => setFile(files[0] ?? null)} />
        <Button type="submit" size="sm" variant={file ? "primary" : "secondary"} disabled={adding || !file} aria-busy={adding}>{adding ? "Adding…" : "Add document"}</Button>
      </form>
      {addState.error || kindState.error ? <p role="alert" className="text-xs text-error">{addState.error ?? kindState.error}</p> : null}
      {addState.success ? <p role="status" className="text-xs text-success">{addState.success}</p> : null}
    </div>
  );
}
