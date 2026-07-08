"use client";

import { FileUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function AttachmentUploadForm() {
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
    <form onSubmit={upload} className="grid gap-3 md:grid-cols-[1.2fr_0.6fr_0.8fr_auto]">
      <label className="block min-w-0">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">File</span>
        <input
          required
          name="file"
          type="file"
          className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-hairline bg-warm px-3 py-2 text-sm text-ink"
        />
      </label>
      <label className="block min-w-0">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Target type</span>
        <input
          name="targetType"
          placeholder="experiment"
          className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-hairline bg-warm px-3 text-sm text-ink"
        />
      </label>
      <label className="block min-w-0">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Target ID</span>
        <input
          name="targetId"
          placeholder="optional"
          className="focus-ring mt-2 h-11 w-full rounded-[8px] border border-hairline bg-warm px-3 text-sm text-ink"
        />
      </label>
      <div className="flex items-end">
        <Button type="submit" disabled={isUploading} variant="primary">
          <FileUp className="h-4 w-4" aria-hidden />
          Upload
        </Button>
      </div>
      {status ? <p className="text-sm text-graphite md:col-span-4">{status}</p> : null}
    </form>
  );
}
