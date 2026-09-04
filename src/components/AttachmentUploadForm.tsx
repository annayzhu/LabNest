"use client";

import { FileUp } from "lucide-react";
import { useState } from "react";
import { formFileInputClass, formInputClass, formLabelClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import type { ResultTemplateArtifact } from "@/lib/types";
import { enqueueMobileMutation } from "@/lib/mobile-mutation-queue";

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
      const formData = new FormData(form);
      const file = formData.get("file");
      const clientMutationId = crypto.randomUUID();
      const deviceCreatedAt = new Date().toISOString();
      if (!(file instanceof File)) throw new Error("Choose a photo or file first.");
      formData.set("clientMutationId", clientMutationId);
      formData.set("deviceCreatedAt", deviceCreatedAt);
      if (!navigator.onLine) {
        await enqueueMobileMutation({
          clientMutationId,
          actionType: "attachment.upload",
          deviceCreatedAt,
          state: "pending",
          retryCount: 0,
          payload: {
            file,
            targetType: String(formData.get("targetType") ?? ""),
            targetId: String(formData.get("targetId") ?? ""),
            linkType: String(formData.get("linkType") ?? "attached_to"),
            order: String(formData.get("order") ?? "") || undefined,
          },
        });
        setStatus(`${file.name} saved on this device · waiting to sync.`);
        form.reset();
        return;
      }
      const response = await fetch("/api/attachments", {
        method: "POST",
        body: formData,
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
      {hideTargetFields ? <><input type="hidden" name="targetType" value={targetType} /><input type="hidden" name="targetId" value={targetId} />{expectedArtifacts.length ? <label className="block min-w-0"><span className={formLabelClass}>Expected file</span><select name="linkType" className={formInputClass}><option value="attached_to">Additional file</option>{expectedArtifacts.map((artifact) => <option key={artifact.key} value={`template_artifact:${artifact.key}`}>{artifact.label}{artifact.required ? " · required" : ""}</option>)}</select></label> : <input type="hidden" name="linkType" value={linkType} />}<label className="block min-w-0"><span className={formLabelClass}>{fileLabel}</span><input required name="file" type="file" accept={accept} className={formFileInputClass} /></label></> : <><label className="block min-w-0">
        <span className={formLabelClass}>File</span>
        <input
          required
          name="file"
          type="file"
          accept={accept}
          className={formFileInputClass}
        />
      </label>
      <label className="block min-w-0">
        <span className={formLabelClass}>Target type</span>
        <input
          name="targetType"
          placeholder="experiment"
          defaultValue={targetType}
          className={formInputClass}
        />
      </label>
      <label className="block min-w-0">
        <span className={formLabelClass}>Target ID</span>
        <input
          name="targetId"
          placeholder="optional"
          defaultValue={targetId}
          className={formInputClass}
        />
      </label></>}
      <div className="flex items-end">
        <Button type="submit" disabled={isUploading} aria-busy={isUploading} variant="primary">
          <FileUp className="h-4 w-4" aria-hidden />
          Upload
        </Button>
      </div>
      {status ? <p className={`text-sm text-graphite ${hideTargetFields ? expectedArtifacts.length ? "md:col-span-3" : "md:col-span-2" : "md:col-span-4"}`}>{status}</p> : null}
    </form>
  );
}
