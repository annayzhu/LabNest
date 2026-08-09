"use client";

import { FileUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ResultTemplateArtifact } from "@/lib/types";

export function AttachmentUploadForm({
  targetType = "",
  targetId = "",
  hideTargetFields = false,
  expectedArtifacts = [],
  fileLabel = "File",
  accept,
  linkType = "attached_to",
}: {
  targetType?: string;
  targetId?: string;
  hideTargetFields?: boolean;
  expectedArtifacts?: ResultTemplateArtifact[];
  fileLabel?: string;
  accept?: string;
  linkType?: string;
}) {
  const [status, setStatus] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsUploading(true);
    setStatus("");

    try {
      const form = event.currentTarget;
      const response = await fetch("/api/attachments", {
        method: "POST",
        body: new FormData(form),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Upload failed.");
      }

      setStatus(`Uploaded ${data.attachment.originalFilename}.`);
      form.reset();
      window.setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form onSubmit={upload} className={`grid gap-3 ${hideTargetFields ? expectedArtifacts.length ? "md:grid-cols-[0.8fr_1.2fr_auto]" : "md:grid-cols-[1fr_auto]" : "md:grid-cols-[1.2fr_0.6fr_0.8fr_auto]"}`}>
      {hideTargetFields ? <><input type="hidden" name="targetType" value={targetType} /><input type="hidden" name="targetId" value={targetId} />{expectedArtifacts.length ? <label className="block min-w-0"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Template artifact slot</span><select name="linkType" className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-hairline bg-warm px-3 text-sm text-ink"><option value="attached_to">Additional evidence</option>{expectedArtifacts.map((artifact) => <option key={artifact.key} value={`template_artifact:${artifact.key}`}>{artifact.label}{artifact.required ? " · required" : ""}</option>)}</select></label> : <input type="hidden" name="linkType" value={linkType} />}<label className="block min-w-0"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{fileLabel}</span><input required name="file" type="file" accept={accept} className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-hairline bg-warm px-3 py-2 text-sm text-ink" /></label></> : <><label className="block min-w-0">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">File</span>
        <input
          required
          name="file"
          type="file"
          accept={accept}
          className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-hairline bg-warm px-3 py-2 text-sm text-ink"
        />
      </label>
      <label className="block min-w-0">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Target type</span>
        <input
          name="targetType"
          placeholder="experiment"
          defaultValue={targetType}
          className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-hairline bg-warm px-3 text-sm text-ink"
        />
      </label>
      <label className="block min-w-0">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Target ID</span>
        <input
          name="targetId"
          placeholder="optional"
          defaultValue={targetId}
          className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-hairline bg-warm px-3 text-sm text-ink"
        />
      </label></>}
      <div className="flex items-end">
        <Button type="submit" disabled={isUploading} variant="primary">
          <FileUp className="h-4 w-4" aria-hidden />
          Upload
        </Button>
      </div>
      {status ? <p className={`text-sm text-graphite ${hideTargetFields ? expectedArtifacts.length ? "md:col-span-3" : "md:col-span-2" : "md:col-span-4"}`}>{status}</p> : null}
    </form>
  );
}
