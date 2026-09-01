"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ClipboardPaste, Download, FileSpreadsheet, Upload } from "lucide-react";
import { importPastedSequences, importSequences, type SequenceManageState } from "@/app/sequences/actions";
import { formInputClass, formLabelClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { sequenceDesignTypes } from "@/lib/sequence-registry";
import { parseSequencePaste, type SequencePasteMode } from "@/lib/sequence-paste";
import type { MoleculeType } from "@/lib/sequence";

const initialState: SequenceManageState = {};

const pasteModes: Array<{ value: SequencePasteMode; label: string; help: string }> = [
  { value: "primer_pair", label: "Primer pairs", help: "Paste one row with Forward/Reverse columns, or two rows named F/R." },
  { value: "sirna_duplex", label: "siRNA duplexes", help: "Paste one row per duplex with sense and antisense sequences." },
  { value: "single", label: "Single sequences", help: "Paste one row per independent DNA, RNA, or amino-acid sequence." },
];
const singleDesignTypes = sequenceDesignTypes.filter((item) => item.value !== "primer" && item.value !== "siRNA");

function ResultMessage({ state }: { state: SequenceManageState }) {
  if (state.error) return <p role="alert" className="text-sm text-error">{state.error}</p>;
  if (state.success) return <p role="status" className="text-sm text-success">{state.success} <Link href="/sequences" className="font-medium underline">Open sequence library</Link></p>;
  return null;
}

export function SequenceImportForm({ projects }: { projects: Array<{ id: string; name: string }> }) {
  const [pasteState, pasteAction, pastePending] = useActionState(importPastedSequences, initialState);
  const [fileState, fileAction, filePending] = useActionState(importSequences, initialState);
  const [scope, setScope] = useState<"library" | "project">("library");
  const [pasteMode, setPasteMode] = useState<SequencePasteMode>("primer_pair");
  const [pastedData, setPastedData] = useState("");
  const [moleculeType, setMoleculeType] = useState<MoleculeType>("DNA");
  const preview = useMemo(() => parseSequencePaste(pastedData, pasteMode, moleculeType), [pastedData, pasteMode, moleculeType]);
  const hasPastedData = pastedData.trim().length > 0;
  const canImport = hasPastedData && preview.entries.length > 0 && preview.errors.length === 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Paste from Excel" />
        <CardBody>
          <form action={pasteAction} className="space-y-4">
            <input type="hidden" name="pasteMode" value={pasteMode} />
            <input type="hidden" name="pastedData" value={pastedData} />
            {pasteMode !== "single" ? <input type="hidden" name="defaultMoleculeType" value={pasteMode === "primer_pair" ? "DNA" : "RNA"} /> : null}
            {pasteMode !== "single" ? <input type="hidden" name="defaultDesignType" value={pasteMode === "primer_pair" ? "primer" : "siRNA"} /> : null}

            <div>
              <span className={formLabelClass}>What are you importing?</span>
              <div className="grid grid-cols-3 gap-2">
                {pasteModes.map((mode) => (
                  <button
                    key={mode.value}
                    type="button"
                    aria-pressed={pasteMode === mode.value}
                    onClick={() => {
                      setPasteMode(mode.value);
                      if (mode.value === "primer_pair") setMoleculeType("DNA");
                      if (mode.value === "sirna_duplex") setMoleculeType("RNA");
                    }}
                    className={`focus-ring rounded-[var(--ln-radius-control-lg)] border p-2.5 text-left transition md:p-3 ${pasteMode === mode.value ? "border-moss bg-moss/5" : "border-hairline bg-surface hover:bg-warm/50"}`}
                  >
                    <span className="block text-[13px] font-semibold text-ink">{mode.label}</span>
                    <span className="mt-1 hidden text-xs leading-4 text-muted md:block">{mode.help}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs leading-4 text-muted md:hidden">{pasteModes.find((mode) => mode.value === pasteMode)?.help}</p>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <label className="block">
                <span className={formLabelClass}>Cells copied from Excel *</span>
                <textarea
                  value={pastedData}
                  onChange={(event) => setPastedData(event.target.value)}
                  rows={11}
                  spellCheck={false}
                  placeholder={pasteMode === "primer_pair" ? "Paste Primer name + Sequence rows here…" : pasteMode === "sirna_duplex" ? "Paste Gene name + sense + antisense rows here…" : "Paste Name + Sequence rows here…"}
                  className={`${formInputClass} min-h-56 resize-y font-mono text-xs leading-5`}
                />
                <span className="mt-1.5 block text-xs text-muted">Headers are optional. Extra purchasing, price, tube, purification, and shipping columns are ignored.</span>
              </label>

              <section aria-label="Import preview" className="rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-warm/35 p-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[13px] font-semibold text-ink">Preview</h3>
                  {canImport ? <span className="inline-flex items-center gap-1 text-xs font-medium text-success"><CheckCircle2 className="h-3.5 w-3.5" />Ready · {preview.entries.length}</span> : <span className="text-xs text-muted">{hasPastedData ? `${preview.entries.length} complete` : "Waiting for paste"}</span>}
                </div>
                {!hasPastedData ? (
                  <div className="mt-6 text-center text-xs leading-5 text-muted"><ClipboardPaste className="mx-auto mb-2 h-5 w-5" />Copy cells in Excel, then paste them into the box.</div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {preview.errors.slice(0, 4).map((error) => <p key={error} className="rounded-[var(--ln-radius-control-md)] bg-error/5 px-2.5 py-2 text-xs leading-4 text-error">{error}</p>)}
                    {preview.entries.slice(0, 6).map((entry) => (
                      <div key={`${entry.sourceRows.join("-")}-${entry.name}`} className="rounded-[var(--ln-radius-control-md)] border border-hairline bg-surface px-2.5 py-2">
                        <div className="flex items-start justify-between gap-2"><span className="truncate text-xs font-medium text-ink">{entry.name}</span><span className="shrink-0 text-[10px] text-muted">row {entry.sourceRows.join("+")}</span></div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted">{entry.members.map((member) => <span key={member.role}>{member.role} · {member.sequence.length} {entry.kind === "pair" && entry.pairType === "sirna_duplex" ? "nt" : pasteMode === "single" && moleculeType === "Protein" ? "aa" : "nt"}</span>)}</div>
                      </div>
                    ))}
                    {preview.entries.length > 6 ? <p className="text-center text-[11px] text-muted">+ {preview.entries.length - 6} more entries</p> : null}
                    {preview.warnings.map((warning) => <p key={warning} className="text-[11px] leading-4 text-muted">{warning}</p>)}
                  </div>
                )}
              </section>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label>
                <span className={formLabelClass}>Location</span>
                <select name="ownershipScope" value={scope} onChange={(event) => setScope(event.target.value as typeof scope)} className={formInputClass}><option value="library">Sequence library</option><option value="project">Project</option></select>
              </label>
              <label>
                <span className={formLabelClass}>Project{scope === "project" ? " *" : ""}</span>
                <select name="projectId" required={scope === "project"} disabled={scope !== "project"} className={formInputClass}><option value="">Choose a Project…</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
              </label>
              <label>
                <span className={formLabelClass}>Default organism</span>
                <input name="defaultOrganism" placeholder="e.g. Homo sapiens" className={formInputClass} />
              </label>
              {pasteMode === "single" ? (
                <div className="grid grid-cols-2 gap-2">
                  <label><span className={formLabelClass}>Molecule</span><select name="defaultMoleculeType" value={moleculeType} onChange={(event) => setMoleculeType(event.target.value as MoleculeType)} className={formInputClass}><option value="DNA">DNA</option><option value="RNA">RNA</option><option value="Protein">Amino acid</option></select></label>
                  <label><span className={formLabelClass}>Type</span><select name="defaultDesignType" defaultValue="fragment" className={formInputClass}>{singleDesignTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                </div>
              ) : <div className="rounded-[var(--ln-radius-control-lg)] border border-hairline px-3 py-2 text-xs leading-5 text-muted"><span className="block font-medium text-ink">Created as one entry</span>{pasteMode === "primer_pair" ? "Forward + Reverse primer" : "sense + antisense siRNA"}</div>}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
              <ResultMessage state={pasteState} />
              <Button type="submit" variant="primary" size="md" disabled={pastePending || !canImport}><ClipboardPaste className="h-4 w-4" aria-hidden />{pastePending ? "Importing…" : `Confirm import${preview.entries.length ? ` · ${preview.entries.length}` : ""}`}</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <details>
            <summary className="focus-ring flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[13px] font-semibold text-ink"><FileSpreadsheet className="h-4 w-4 text-muted" />Advanced file upload</summary>
            <CardBody className="border-t border-hairline">
              <form action={fileAction} className="space-y-4">
                <label className="block rounded-[var(--ln-radius-panel-inner)] border border-dashed border-hairline bg-warm/50 p-4">
                  <span className={formLabelClass}>FASTA, CSV, TSV, or XLSX file *</span>
                  <input required type="file" name="file" accept=".fa,.fasta,.fna,.faa,.csv,.tsv,.xlsx,text/plain,text/csv" className="mt-3 block w-full text-sm text-graphite file:mr-3 file:rounded-[var(--ln-radius-control-sm)] file:border file:border-hairline file:bg-surface file:px-3 file:py-2 file:text-xs file:text-moss" />
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <label><span className={formLabelClass}>Default location</span><select name="ownershipScope" defaultValue="library" className={formInputClass}><option value="library">Sequence library</option><option value="project">Project</option></select></label>
                  <label><span className={formLabelClass}>Default Project</span><select name="projectId" className={formInputClass}><option value="">Choose a Project…</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
                  <label><span className={formLabelClass}>Default design type</span><select name="defaultDesignType" defaultValue="other" className={formInputClass}>{sequenceDesignTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                  <label><span className={formLabelClass}>Default molecule type</span><select name="defaultMoleculeType" defaultValue="DNA" className={formInputClass}><option value="DNA">DNA</option><option value="RNA">RNA</option><option value="Protein">Amino acid</option></select></label>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3"><ResultMessage state={fileState} /><Button type="submit" variant="secondary" size="md" disabled={filePending}><Upload className="h-4 w-4" aria-hidden />{filePending ? "Importing…" : "Import file"}</Button></div>
              </form>
            </CardBody>
          </details>
        </Card>

        <Card>
          <CardHeader title="Templates" />
          <CardBody className="space-y-3 text-sm text-graphite">
            <p className="text-xs leading-5 text-muted">The workbook contains compact sheets for primer pairs, siRNA duplexes, and single sequences. You can fill it, upload it, or copy its cells into the box above.</p>
            <div className="flex flex-wrap gap-2">
              <Link href="/api/sequences/template?format=xlsx" className="focus-ring inline-flex h-9 items-center gap-2 rounded-[var(--ln-radius-control-md)] border border-hairline px-3 text-[13px] font-medium text-moss hover:bg-warm"><Download className="h-4 w-4" aria-hidden />Download XLSX template</Link>
              <Link href="/api/sequences/template?format=csv&type=primer_pair" className="focus-ring inline-flex h-9 items-center gap-2 rounded-[var(--ln-radius-control-md)] border border-hairline px-3 text-[13px] font-medium text-moss hover:bg-warm"><Download className="h-4 w-4" aria-hidden />Primer CSV</Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
