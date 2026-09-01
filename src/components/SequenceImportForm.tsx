"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Download, Upload } from "lucide-react";
import { importSequences, type SequenceManageState } from "@/app/sequences/actions";
import { formInputClass, formLabelClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { sequenceDesignTypes } from "@/lib/sequence-registry";

const initialState: SequenceManageState = {};

export function SequenceImportForm({ projects }: { projects: Array<{ id: string; name: string }> }) {
  const [state, action, pending] = useActionState(importSequences, initialState);
  const [scope, setScope] = useState<"library" | "project">("library");
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <CardHeader title="Import sequence records" />
        <CardBody>
          <form action={action} className="space-y-4">
            <label className="block rounded-[10px] border border-dashed border-hairline bg-warm/50 p-5">
              <span className={formLabelClass}>FASTA, CSV, TSV, or XLSX file *</span>
              <input required type="file" name="file" accept=".fa,.fasta,.fna,.faa,.csv,.tsv,.xlsx,text/plain,text/csv" className="mt-3 block w-full text-sm text-graphite file:mr-3 file:rounded-[6px] file:border file:border-hairline file:bg-surface file:px-3 file:py-2 file:text-xs file:text-moss" />
              <span className="mt-2 block text-xs text-muted">Up to 500 records and 25 MB per import. The import is atomic: invalid rows prevent the entire file from being saved.</span>
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label>
                <span className={formLabelClass}>Default location</span>
                <select name="ownershipScope" value={scope} onChange={(event) => setScope(event.target.value as typeof scope)} className={formInputClass}><option value="library">Sequence library</option><option value="project">Project</option></select>
              </label>
              <label>
                <span className={formLabelClass}>Default Project{scope === "project" ? " *" : ""}</span>
                <select name="projectId" required={scope === "project"} disabled={scope !== "project"} className={formInputClass}><option value="">Choose a Project…</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
              </label>
              <label>
                <span className={formLabelClass}>Default design type</span>
                <select name="defaultDesignType" defaultValue="other" className={formInputClass}>
                  {sequenceDesignTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label>
                <span className={formLabelClass}>Default molecule type</span>
                <select name="defaultMoleculeType" defaultValue="DNA" className={formInputClass}><option value="DNA">DNA</option><option value="RNA">RNA</option><option value="Protein">Amino acid</option></select>
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
              <div>{state.error ? <p role="alert" className="text-sm text-error">{state.error}</p> : state.success ? <p role="status" className="text-sm text-success">{state.success} <Link href="/sequences" className="font-medium underline">Open sequence library</Link></p> : null}</div>
              <Button type="submit" variant="primary" size="md" disabled={pending}><Upload className="h-4 w-4" aria-hidden />{pending ? "Importing…" : "Import Sequences"}</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Templates and rules" />
        <CardBody className="space-y-4 text-sm text-graphite">
          <p>FASTA headers become record names. Choose default type values for fields that FASTA cannot carry.</p>
          <p>CSV/XLSX can provide per-row type, ownership, status, validation, target, organism, topology, Features, and modifications.</p>
          <p>A primer pair or siRNA duplex occupies one row with <span className="font-mono text-xs">pairType</span> and the two role-specific sequence columns.</p>
          <Link href="/api/sequences/template?format=xlsx" className="focus-ring inline-flex h-9 items-center gap-2 rounded-[7px] border border-hairline px-3 text-[13px] font-medium text-moss hover:bg-warm"><Download className="h-4 w-4" aria-hidden />Download XLSX template</Link>
          <Link href="/api/sequences/template?format=csv" className="focus-ring ml-2 inline-flex h-9 items-center gap-2 rounded-[7px] border border-hairline px-3 text-[13px] font-medium text-moss hover:bg-warm"><Download className="h-4 w-4" aria-hidden />CSV</Link>
          <div className="rounded-[8px] bg-warm p-3 text-xs leading-5 text-muted">
            <strong className="text-ink">Scientific safeguards</strong><br />Sequence alphabets are validated by molecule type. siRNA records may use one or two terminal T bases to represent a 3′ dT overhang. Feature coordinates use 1-based inclusive positions. Validation conclusions require a written summary.
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
