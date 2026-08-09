"use client";

import { useMemo, useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Download, FileCheck2, FileSearch, FileUp, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { StructuredImportPreview } from "@/lib/structured-import";
import { formatFromFilename, formatLabel, structuredModules, type StructuredModuleKey } from "@/lib/structured-modules";

const acceptByFormat = {
  csv: ".csv,text/csv",
  tsv: ".tsv,text/tab-separated-values",
  xlsx: ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  json: ".json,application/json",
  md: ".md,text/markdown,text/plain",
  docx: ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const structuredTemplateVersion = "5";
const maxStructuredImportBytes = 25 * 1024 * 1024;

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StructuredImportWorkspace({ module }: { module: StructuredModuleKey }) {
  const definition = structuredModules[module];
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<StructuredImportPreview>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState<"preview" | "confirm">();
  const [dragActive, setDragActive] = useState(false);
  const accept = useMemo(() => definition.importFormats.map((format) => acceptByFormat[format]).join(","), [definition.importFormats]);
  const controlledFields = definition.fields.filter((field) => field.allowedValues?.length);

  function chooseFile(nextFile?: File, source: "picker" | "drop" = "picker") {
    setPreview(undefined);
    setError(undefined);

    if (source === "drop" && fileInput.current) fileInput.current.value = "";
    if (!nextFile) { setFile(undefined); return; }

    const format = formatFromFilename(nextFile.name);
    if (!format || !definition.importFormats.includes(format)) {
      setFile(undefined);
      setError(`Use one of the supported formats: ${definition.importFormats.map(formatLabel).join(", ")}.`);
      return;
    }
    if (nextFile.size === 0) {
      setFile(undefined);
      setError("The selected file is empty.");
      return;
    }
    if (nextFile.size > maxStructuredImportBytes) {
      setFile(undefined);
      setError("The selected file exceeds the 25 MB upload limit.");
      return;
    }

    setFile(nextFile);
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (pending || !Array.from(event.dataTransfer.items).some((item) => item.kind === "file")) return;
    dragDepth.current += 1;
    setDragActive(true);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (pending) return;
    event.dataTransfer.dropEffect = "copy";
    setDragActive(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragActive(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = 0;
    setDragActive(false);
    if (pending) return;

    const droppedFiles = Array.from(event.dataTransfer.files);
    if (droppedFiles.length !== 1) {
      setFile(undefined);
      setPreview(undefined);
      setError("Drop one structured import file at a time.");
      return;
    }
    chooseFile(droppedFiles[0], "drop");
  }

  async function requestPreview() {
    if (!file) { setError("Choose an import file first."); return; }
    setPending("preview"); setError(undefined); setPreview(undefined);
    const formData = new FormData(); formData.set("file", file);
    try {
      const response = await fetch(`/api/structured-import/${module}/preview`, { method: "POST", body: formData });
      const payload = await response.json() as { error?: string; preview?: StructuredImportPreview };
      if (!response.ok || !payload.preview) throw new Error(payload.error ?? "The file could not be previewed.");
      setPreview(payload.preview);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The file could not be previewed.");
    } finally { setPending(undefined); }
  }

  async function confirmImport() {
    if (!file || !preview) return;
    setPending("confirm"); setError(undefined);
    const formData = new FormData(); formData.set("file", file); formData.set("checksum", preview.checksum);
    try {
      const response = await fetch(`/api/structured-import/${module}/confirm`, { method: "POST", body: formData });
      const payload = await response.json() as { error?: string; preview?: StructuredImportPreview; result?: { href: string } };
      if (payload.preview) setPreview(payload.preview);
      if (!response.ok || !payload.result) throw new Error(payload.error ?? "The import could not be completed.");
      router.push(payload.result.href);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The import could not be completed.");
    } finally { setPending(undefined); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Choose a structured format" />
        <CardBody className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {definition.importFormats.map((format) => {
            const showCompactGuidance = (format === "csv" || format === "tsv") && controlledFields.length > 0;
            return (
              <div key={format} className="flex items-start justify-between gap-3 rounded-[8px] border border-hairline bg-warm px-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{formatLabel(format)}</p>
                  <p className="mt-1 text-xs text-muted">Structured {definition.singular} input</p>
                  {showCompactGuidance ? controlledFields.map((field) => (
                    <p key={field.key} className="mt-1 truncate text-[11px] text-muted" title={`${field.label}: ${field.allowedValues?.join(", ")}`}>
                      {field.label}: {field.allowedValues?.join(" · ")}
                    </p>
                  )) : null}
                </div>
                <Link href={`/api/structured-import/${module}/template?format=${format}&v=${structuredTemplateVersion}`} className="focus-ring inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[6px] border border-hairline bg-surface px-2 text-xs font-medium text-moss hover:bg-sage-surface">
                  <Download className="h-3.5 w-3.5" aria-hidden />Template
                </Link>
              </div>
            );
          })}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Upload and preview" />
        <CardBody className="space-y-4">
          <div
            className={cn(
              "rounded-[9px] border border-dashed p-5 text-center transition-colors",
              dragActive ? "border-moss bg-sage-surface/70" : "border-border-strong bg-warm",
              pending && "cursor-not-allowed opacity-60",
            )}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInput}
              type="file"
              accept={accept}
              disabled={Boolean(pending)}
              onChange={(event) => chooseFile(event.target.files?.[0])}
              className="sr-only"
              aria-label={`Choose a ${definition.singular} import file`}
            />
            <FileUp className={cn("mx-auto h-7 w-7", dragActive ? "text-moss" : "text-muted")} aria-hidden />
            <p className="mt-3 text-sm font-semibold text-ink">{dragActive ? "Drop the file to add it" : "Drop a structured file here"}</p>
            <p className="mt-1 text-xs text-muted">or choose a file from your device</p>
            <Button type="button" variant="secondary" className="mt-3" onClick={() => fileInput.current?.click()} disabled={Boolean(pending)}>
              Browse files
            </Button>
            <p className="mt-3 text-[11px] text-muted">Accepted: {definition.importFormats.map(formatLabel).join(" · ")} · Maximum 25 MB and 500 records</p>
            {file ? (
              <div className="mx-auto mt-4 flex max-w-xl items-center justify-center gap-2 rounded-[7px] border border-moss/25 bg-sage-surface px-3 py-2 text-left" aria-live="polite">
                <FileCheck2 className="h-4 w-4 shrink-0 text-moss" aria-hidden />
                <span className="min-w-0 truncate text-xs font-medium text-ink">{file.name}</span>
                <span className="shrink-0 text-[11px] text-muted">{formatFileSize(file.size)}</span>
              </div>
            ) : null}
            <p className="mt-3 text-xs leading-5 text-muted">LabNest revalidates the original file at confirmation and keeps it with a SHA-256 checksum.</p>
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={requestPreview} disabled={!file || Boolean(pending)}>
              {pending === "preview" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <FileSearch className="h-4 w-4" aria-hidden />}
              Preview mapping
            </Button>
          </div>
          {error ? <p role="alert" className="rounded-[8px] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error">{error}</p> : null}
        </CardBody>
      </Card>

      {preview ? <PreviewPanel preview={preview} pending={pending === "confirm"} onConfirm={confirmImport} /> : null}
    </div>
  );
}

function PreviewPanel({ preview, pending, onConfirm }: { preview: StructuredImportPreview; pending: boolean; onConfirm: () => void }) {
  return (
    <Card>
      <CardHeader title={`Mapping preview · ${preview.rows.length} record${preview.rows.length === 1 ? "" : "s"}`} />
      <CardBody className="space-y-4">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {preview.mapping.map((mapping) => (
            <div key={mapping.source} className="flex items-center justify-between gap-2 rounded-[7px] border border-hairline px-3 py-2 text-xs">
              <span className="truncate font-mono text-graphite">{mapping.source}</span>
              <span className={mapping.target ? "text-moss" : "text-warning"}>→ {mapping.targetLabel ?? "not imported"}</span>
            </div>
          ))}
        </div>
        {[...preview.errors, ...preview.warnings].map((message) => <p key={message} className="flex items-start gap-2 rounded-[8px] border border-warning/30 bg-warning-surface px-3 py-2 text-sm text-warning"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{message}</p>)}
        <div className="max-h-[540px] space-y-3 overflow-auto pr-1 editorial-scrollbar">
          {preview.rows.map((row) => (
            <section key={row.index} className={`rounded-[9px] border p-3 ${row.errors.length ? "border-error/30 bg-error-surface/40" : "border-hairline bg-surface"}`}>
              <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-ink">Record {row.index}</h3>{row.errors.length ? <span className="text-xs font-medium text-error">Needs correction</span> : <span className="flex items-center gap-1 text-xs font-medium text-moss"><Check className="h-3.5 w-3.5" aria-hidden />Ready</span>}</div>
              <dl className="grid gap-x-5 gap-y-2 md:grid-cols-2 xl:grid-cols-3">{Object.entries(row.values).map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{label}</dt><dd className="mt-0.5 break-words text-xs leading-5 text-graphite">{value || "—"}</dd></div>)}</dl>
              {row.errors.map((message) => <p key={message} className="mt-2 text-xs text-error">{message}</p>)}
              {row.warnings.map((message) => <p key={message} className="mt-2 text-xs text-warning">{message}</p>)}
            </section>
          ))}
        </div>
        <div className="flex flex-col gap-3 border-t border-hairline pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-muted">Imported scientific records are validated again and the original source is linked to every created record. Template placeholders and ambiguous relationships are blocked.</p>
          <Button type="button" variant="primary" onClick={onConfirm} disabled={!preview.canImport || pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <FileUp className="h-4 w-4" aria-hidden />}
            Confirm import
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
