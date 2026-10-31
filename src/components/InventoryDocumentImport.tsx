"use client";

import { FileUp, LoaderCircle, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { importInventoryDraft, readInventoryDocuments } from "@/app/inventory/import/actions";
import { formInlineInputClass, formInputClass, formLabelClass, formTextareaClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import type { DraftLine } from "@/lib/inventory-recognition.server";
import { isPdf } from "@/lib/inventory-recognition";
import { shrinkPhotoFile } from "@/lib/photo-resize";

type Service = { ready: boolean; reason?: string };
type Line = DraftLine & { location: string; exactId: string };

const cell = `${formInlineInputClass} h-8 min-w-0 px-2 text-sm`;

/**
 * Invoices, delivery notes, labels (pictures or PDFs) or pasted text read into a draft of arriving stock. Every line
 * is checked and can be changed before anything is imported; the import itself is the ordinary inventory import.
 */
export function InventoryDocumentImport({ source, pictures, text, locations }: { source: "documents" | "text"; pictures: Service; text: Service; locations: string[] }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState<"read" | "import">();
  const [problems, setProblems] = useState<string[]>([]);
  const [draft, setDraft] = useState<{ supplier: string; invoiceNumber: string; lines: Line[] }>();

  const needsPictures = files.some((file) => !isPdf(file));
  const needsText = source === "text" || files.some(isPdf);
  const blocked = (needsPictures && !pictures.ready) || (needsText && !text.ready);
  const reasons = [...new Set([needsPictures && !pictures.ready ? pictures.reason : undefined, needsText && !text.ready ? text.reason : undefined].filter(Boolean))];

  async function choose(list: FileList | null) {
    setDraft(undefined);
    setProblems([]);
    // Pictures go up as JPEG of at most 2000 px, the size the reading service takes.
    const chosen = await Promise.all([...(list ?? [])].slice(0, 10).map(async (file) => isPdf(file) ? file : shrinkPhotoFile(file)));
    setFiles(chosen);
  }

  function sources() {
    const data = new FormData();
    if (source === "text") data.set("text", pasted);
    else files.forEach((file) => data.append("file", file));
    return data;
  }

  async function read() {
    setBusy("read");
    setProblems([]);
    const reading = await readInventoryDocuments(sources());
    setBusy(undefined);
    if (reading.error) { setProblems([reading.error]); return; }
    setProblems(reading.warnings);
    setDraft({
      supplier: reading.supplier ?? "",
      invoiceNumber: reading.invoiceNumber ?? "",
      lines: reading.lines.map((line) => ({ ...line, location: "", exactId: line.productId })),
    });
  }

  async function submit() {
    if (!draft) return;
    setBusy("import");
    const data = sources();
    data.set("draft", JSON.stringify({
      supplier: draft.supplier.trim() || null,
      invoiceNumber: draft.invoiceNumber.trim() || null,
      rows: draft.lines.map(({ name, brand, catalogNumber, packSize, quantity, unit, lotNumber, expiryDate, location, productId }) => ({ name, brand, catalogNumber, packSize, quantity, unit, lotNumber, expiryDate, location, productId })),
    }));
    const result = await importInventoryDraft(data);
    setBusy(undefined);
    if (result.href) { router.push(result.href); router.refresh(); return; }
    setProblems(result.problems ?? [result.error ?? "The draft could not be imported."]);
  }

  const change = (index: number, patch: Partial<Line>) => setDraft((current) => current && { ...current, lines: current.lines.map((line, at) => at === index ? { ...line, ...patch } : line) });
  const field = (index: number, key: keyof Line, label: string, type = "text") => (
    <input aria-label={label} type={type} value={String(draft!.lines[index][key] ?? "")} onChange={(event) => change(index, { [key]: event.target.value })} className={cell} />
  );

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-4">
        {source === "documents" ? (
          <label className="block">
            <span className={formLabelClass}>Invoices, delivery notes or labels (pictures or PDF, up to 10)</span>
            <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" onChange={(event) => void choose(event.target.files)} className={`${formInputClass} py-1.5`} />
          </label>
        ) : (
          <label className="block">
            <span className={formLabelClass}>Text of an order, invoice or email</span>
            <textarea value={pasted} onChange={(event) => { setPasted(event.target.value); setDraft(undefined); }} rows={6} maxLength={40_000} className={formTextareaClass} placeholder="Sodium azide, Sigma-Aldrich S2002, 100 g × 2, lot MKCQ1234, exp 2027-06" />
          </label>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant={blocked ? "ai-off" : "ai"} disabled={blocked || Boolean(busy) || (source === "text" ? !pasted.trim() : !files.length)} onClick={read}>
            {busy === "read" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}{busy === "read" ? "Reading…" : "Read with AI"}
          </Button>
          <span className="text-sm text-graphite">{reasons.length ? reasons.join(" ") : "Pictures go to the service that reads pictures; PDF text and pasted text to the default service."}</span>
        </div>
      </section>

      {problems.length ? <ul role="alert" className="space-y-1 rounded-[var(--ln-radius-control-lg)] border border-warning/30 bg-warning-surface px-3 py-2 text-sm text-graphite">{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul> : null}

      {draft ? (
        <section aria-label="Draft" className="space-y-3 rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className={formLabelClass}>Supplier</span><input value={draft.supplier} onChange={(event) => setDraft({ ...draft, supplier: event.target.value })} className={formInputClass} /></label>
            <label><span className={formLabelClass}>Invoice number</span><input value={draft.invoiceNumber} onChange={(event) => setDraft({ ...draft, invoiceNumber: event.target.value })} className={formInputClass} /></label>
          </div>
          {draft.lines.length ? (
            <div className="overflow-x-auto editorial-scrollbar">
              <table className="w-full min-w-[960px] border-separate border-spacing-y-1 text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr>{["Product", "Name", "Brand", "Catalog number", "Pack size", "Quantity", "Unit", "Lot number", "Expiry date", "Location", ""].map((header) => <th key={header} className="px-1 font-medium">{header}</th>)}</tr>
                </thead>
                <tbody>
                  {draft.lines.map((line, index) => (
                    <tr key={index} className="align-top">
                      <td className="w-48 px-1">
                        <select aria-label="Product" value={line.productId} onChange={(event) => change(index, { productId: event.target.value })} className={cell}>
                          <option value="">New product</option>
                          {line.exactId ? <option value={line.exactId}>Existing: same brand and catalogue number</option> : null}
                          {line.candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{[candidate.name, candidate.brand, candidate.catalogNumber].filter(Boolean).join(" · ")}</option>)}
                        </select>
                      </td>
                      <td className="px-1">{field(index, "name", "Name")}</td>
                      <td className="w-28 px-1">{field(index, "brand", "Brand")}</td>
                      <td className="w-28 px-1">{field(index, "catalogNumber", "Catalog number")}</td>
                      <td className="w-24 px-1">{field(index, "packSize", "Pack size")}</td>
                      <td className="w-20 px-1">{field(index, "quantity", "Quantity", "number")}</td>
                      <td className="w-20 px-1">{field(index, "unit", "Unit")}</td>
                      <td className="w-28 px-1">{field(index, "lotNumber", "Lot number")}</td>
                      <td className="w-36 px-1">{field(index, "expiryDate", "Expiry date", "date")}</td>
                      <td className="w-36 px-1">
                        <select aria-label="Location" value={line.location} onChange={(event) => change(index, { location: event.target.value })} className={cell}>
                          <option value="">Unassigned</option>
                          {locations.map((location) => <option key={location} value={location}>{location}</option>)}
                        </select>
                      </td>
                      <td className="px-1">
                        <button type="button" aria-label="Remove line" title="Remove line" onClick={() => setDraft({ ...draft, lines: draft.lines.filter((_, at) => at !== index) })} className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-[var(--ln-radius-control-sm)] text-muted hover:bg-stone hover:text-ink"><X className="h-4 w-4" aria-hidden /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-muted">No items were read.</p>}
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-hairline pt-3">
            <p className="mr-auto text-xs text-muted">Each line arrives as stock with a receive movement. A line without a chosen product finds one by brand and catalogue number, or becomes a new product to classify.</p>
            <Button type="button" variant="primary" disabled={!draft.lines.length || Boolean(busy)} onClick={submit}>
              {busy === "import" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <FileUp className="h-4 w-4" aria-hidden />}{busy === "import" ? "Importing…" : `Import ${draft.lines.length} line${draft.lines.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
