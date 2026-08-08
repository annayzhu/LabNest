"use client";

import { useState } from "react";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formInputClass, formLabelClass } from "@/components/forms";

export function DatasetUploadForm({ resultId }: { resultId: string }) {
  const [mode, setMode] = useState<"managed_file" | "external_reference">("managed_file");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setStatus("");
    try {
      const response = await fetch(`/api/results/${resultId}/datasets`, { method: "POST", body: new FormData(event.currentTarget) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Dataset registration failed.");
      setStatus(`Registered ${data.dataset.name}.`); event.currentTarget.reset(); window.setTimeout(() => window.location.reload(), 500);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Dataset registration failed."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="grid gap-3 md:grid-cols-2 xl:grid-cols-[0.5fr_0.8fr_1.4fr_auto]">
    <label><span className={formLabelClass}>Storage</span><select name="storageMode" value={mode} onChange={(event) => setMode(event.target.value as typeof mode)} className={formInputClass}><option value="managed_file">Managed file</option><option value="external_reference">External reference</option></select></label>
    <label><span className={formLabelClass}>Dataset name</span><input required name="name" className={formInputClass} placeholder="Normalized Cq table" /></label>
    {mode === "managed_file" ? <label><span className={formLabelClass}>CSV / TSV / TXT / XLSX · max 25 MB</span><input required name="file" type="file" accept=".csv,.tsv,.txt,.xlsx" className={`${formInputClass} py-2`} /></label> : <label><span className={formLabelClass}>External URI or server path</span><input required name="externalUri" className={formInputClass} placeholder="s3://…, smb://…, /data/…" /></label>}
    <div className="flex items-end"><Button type="submit" variant="primary" disabled={busy}><FileUp className="h-4 w-4" />{busy ? "Registering…" : "Register"}</Button></div>
    {status ? <p className="text-sm text-graphite md:col-span-2 xl:col-span-4">{status}</p> : null}
  </form>;
}
