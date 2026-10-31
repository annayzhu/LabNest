"use client";

import { FileUp, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { importSequenceProducts } from "@/app/inventory/import/sequence-actions";
import { useI18n } from "@/components/I18nProvider";
import { formInputClass, formLabelClass, formTextareaClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { sequenceKinds } from "@/lib/product-sequences";
import { parseSpreadsheetClipboard } from "@/lib/result-dataset-paste";
import { parseFasta } from "@/lib/sequence";
import { parseSequencePaste, type SequencePasteEntry, type SequencePasteMode } from "@/lib/sequence-paste";

// Single sequences become products of one of these types; pairs and duplexes are always Primer and siRNA.
const singleTypes = [
  { key: "probe", label: "Probe" },
  { key: "grna", label: "gRNA" },
  { key: "plasmid", label: "Plasmid" },
  { key: "protein", label: "Protein" },
];
const modes: { value: SequencePasteMode; label: string; help: string }[] = [
  { value: "primer_pair", label: "Primer pairs", help: "One row with forward and reverse columns, or two rows named -F and -R." },
  { value: "sirna_duplex", label: "siRNA duplexes", help: "One row per duplex with its sense and antisense strands." },
  { value: "single", label: "Single sequences", help: "One row per sequence, or a FASTA file." },
];

/** Primer pairs, siRNA duplexes and single sequences pasted from a spreadsheet or read from FASTA, CSV or XLSX, imported as products (Q186). */
export function SequenceProductImport() {
  const { t } = useI18n();
  const [mode, setMode] = useState<SequencePasteMode>("primer_pair");
  const [singleType, setSingleType] = useState("probe");
  const [text, setText] = useState("");
  const [fasta, setFasta] = useState<SequencePasteEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created?: number; skipped?: string[]; error?: string } | null>(null);
  const typeKey = mode === "primer_pair" ? "primer" : mode === "sirna_duplex" ? "sirna" : singleType;
  const molecule = sequenceKinds[typeKey].molecule;
  const preview = useMemo(() => fasta ? { entries: fasta, errors: [], warnings: [] } : text.trim() ? parseSequencePaste(text, mode, molecule) : null, [fasta, text, mode, molecule]);

  async function read(file: File | undefined) {
    if (!file) return;
    setResult(null);
    const lower = file.name.toLowerCase();
    if (/\.(fa|fasta|fna|faa)$/.test(lower) || (await file.slice(0, 1).text()) === ">") {
      setMode("single");
      setFasta(parseFasta(await file.text()).map((record, index) => ({ name: record.name, sourceRows: [index + 1], members: [{ role: "sequence", sequence: record.sequence }] })));
      setText("");
      return;
    }
    // A spreadsheet is read as the rows a paste from Excel would give.
    const rows = lower.endsWith(".xlsx")
      ? (await (await import("read-excel-file/browser")).readSheet(file)).map((row) => row.map((value) => value == null ? "" : String(value)))
      : parseSpreadsheetClipboard(await file.text(), /\.(tsv|txt)$/.test(lower) ? "\t" : ",");
    setFasta(null);
    setText(rows.map((row) => row.join("\t")).join("\n"));
  }

  async function submit() {
    if (!preview?.entries.length) return;
    setBusy(true);
    setResult(await importSequenceProducts({ typeKey, entries: preview.entries.map(({ name, targetName, organism, description, members }) => ({ name, targetName, organism, description, members })) }));
    setBusy(false);
  }

  const ready = !!preview?.entries.length && !preview.errors.length && !busy;
  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <fieldset>
            <legend className={formLabelClass}>What are you importing?</legend>
            <div className="mt-1 grid gap-2 sm:grid-cols-3">
              {modes.map((entry) => (
                <button key={entry.value} type="button" aria-pressed={mode === entry.value} onClick={() => { setMode(entry.value); setFasta(null); setResult(null); }}
                  className={`focus-ring rounded-[var(--ln-radius-control-lg)] border px-3 py-2 text-left text-sm ${mode === entry.value ? "border-moss bg-sage-surface/60 text-moss" : "border-hairline bg-surface text-graphite hover:border-border-strong hover:text-ink"}`}>
                  <span className="block font-medium">{entry.label}</span>
                  <span className="mt-0.5 block text-xs text-muted">{entry.help}</span>
                </button>
              ))}
            </div>
          </fieldset>
          {mode === "single" ? (
            <label className="self-end">
              <span className={formLabelClass}>Product type</span>
              <select value={singleType} onChange={(event) => setSingleType(event.target.value)} className={formInputClass}>
                {singleTypes.map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}
              </select>
            </label>
          ) : null}
        </div>
        <label className="block">
          <span className={formLabelClass}>Rows copied from Excel</span>
          <textarea value={text} onChange={(event) => { setText(event.target.value); setFasta(null); setResult(null); }} rows={6} spellCheck={false} className={`${formTextareaClass} font-mono text-sm`} placeholder={"Name\tForward\tReverse\nhGAPDH\tAAGGTCATCCCTGAGCTGAA\tTGACAAAGTGGTCGTTGAGG"} />
        </label>
        <label className="block">
          <span className={formLabelClass}>Or a file: FASTA, CSV, TSV or XLSX</span>
          <input type="file" accept=".fa,.fasta,.fna,.faa,.txt,.csv,.tsv,.xlsx" onChange={(event) => { void read(event.target.files?.[0]); event.target.value = ""; }} className={`${formInputClass} py-1.5`} />
        </label>
      </section>

      {preview ? (
        <section aria-label="Preview" className="space-y-3 rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-4">
          {preview.errors.length ? <ul role="alert" className="space-y-1 rounded-[var(--ln-radius-control-lg)] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error">{preview.errors.map((error) => <li key={error}>{t(error)}</li>)}</ul> : null}
          {preview.warnings.length ? <ul className="space-y-1 text-sm text-warning">{preview.warnings.map((warning) => <li key={warning}>{t(warning)}</li>)}</ul> : null}
          {preview.entries.length ? (
            <ul className="divide-y divide-hairline text-sm">
              {preview.entries.slice(0, 50).map((entry) => (
                <li key={entry.sourceRows.join("-") + entry.name} className="py-2">
                  <p className="font-medium text-ink">{entry.name}{entry.organism ? <span className="ml-2 text-xs font-normal text-muted">{entry.organism}</span> : null}</p>
                  {entry.members.map((member) => <p key={member.role} className="break-all font-mono text-xs text-graphite"><span className="font-sans text-muted">{member.role === "sequence" ? "" : `${t(sequenceKinds[typeKey].strands.find((strand) => strand.role === member.role)?.label ?? member.role)} · `}</span>{member.sequence}</p>)}
                </li>
              ))}
            </ul>
          ) : null}
          {preview.entries.length > 50 ? <p className="text-xs text-muted">{t(`…and ${preview.entries.length - 50} more.`)}</p> : null}
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-hairline pt-3">
            <p className="mr-auto text-xs text-muted">Each entry becomes a product with its sequences; one with the same name and type is skipped.</p>
            <Button type="button" variant="primary" disabled={!ready} onClick={() => void submit()}>
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <FileUp className="h-4 w-4" aria-hidden />}{t(`Import ${preview.entries.length} product${preview.entries.length === 1 ? "" : "s"}`)}
            </Button>
          </div>
        </section>
      ) : null}

      {result ? (
        <p role={result.error ? "alert" : "status"} className={`text-sm ${result.error ? "text-error" : "text-success"}`}>
          {result.error ? t(result.error) : <>
            <span>{t(`Imported ${result.created} product${result.created === 1 ? "" : "s"}.`)}</span>
            {result.skipped?.length ? <span className="text-graphite"> {t(`Skipped, already there: ${result.skipped.join(", ")}.`)}</span> : null}
            {" "}<Link href="/inventory/products?flag=sequences" className="font-medium underline">Open products with sequences</Link>
          </>}
        </p>
      ) : null}
    </div>
  );
}
