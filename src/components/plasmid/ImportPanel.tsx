"use client";

import { FileUp, FolderOpen, RefreshCw } from "lucide-react";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { ImportedSource, SourceFile } from "@/lib/plasmid/files";

async function bytesOf(file: File, path: string): Promise<SourceFile> {
  return { path, bytes: new Uint8Array(await file.arrayBuffer()) };
}

/** Folders dropped from Finder arrive as directory entries; walk them and keep relative paths (Q273). */
async function readDroppedItems(items: DataTransferItemList) {
  const files: SourceFile[] = [];
  const walk = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
    if (entry.name === ".DS_Store") return;
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
      files.push(await bytesOf(file, `${prefix}${file.name}`));
      return;
    }
    if (!entry.isDirectory) return;
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
      if (!batch.length) break;
      for (const child of batch) await walk(child, `${prefix}${entry.name}/`);
    }
  };
  const entries = [...items].map((item) => item.webkitGetAsEntry?.()).filter((entry): entry is FileSystemEntry => Boolean(entry));
  for (const entry of entries) await walk(entry, "");
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

async function readPickedFiles(list: FileList | null) {
  const files = [...(list ?? [])].filter((file) => file.name !== ".DS_Store");
  return (await Promise.all(files.map((file) => bytesOf(file, file.webkitRelativePath || file.name)))).sort((left, right) => left.path.localeCompare(right.path));
}

/** `progress` is set while files are being read. */
export function ImportDropZone({ progress, error, onFiles }: { progress?: { done: number; total: number }; error?: string; onFiles: (files: SourceFile[]) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const [active, setActive] = useState(false);
  const busy = Boolean(progress);
  const pick = async (event: ChangeEvent<HTMLInputElement>) => {
    onFiles(await readPickedFiles(event.target.files));
    event.target.value = "";
  };

  const drop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    depth.current = 0;
    setActive(false);
    if (busy) return;
    const { items, files } = event.dataTransfer;
    // Some drags (and some browsers) carry plain files without directory entries.
    const walked = await readDroppedItems(items);
    onFiles(walked.length ? walked : await readPickedFiles(files));
  };

  return (
    <div
      className={cn("ln-pw-drop", active && "is-active", busy && "is-busy")}
      onDragEnter={(event) => {
        event.preventDefault();
        depth.current += 1;
        setActive(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (!depth.current) setActive(false);
      }}
      onDrop={drop}
    >
      <FileUp className="ln-pw-drop-icon" aria-hidden />
      <p className="ln-pw-drop-title">{active ? "Drop to open" : "Drop sequence files, a folder or a ZIP here"}</p>
      <p className="ln-pw-note">FASTA, GenBank, SnapGene .dna, Sanger .ab1 and .seq. Files are read in this browser; nothing is saved until you choose to.</p>
      <div className="ln-pw-actions">
        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => fileInput.current?.click()}><FileUp className="h-3.5 w-3.5" aria-hidden />Choose files</Button>
        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => folderInput.current?.click()}><FolderOpen className="h-3.5 w-3.5" aria-hidden />Choose a folder</Button>
      </div>
      {progress ? <p className="ln-pw-note" aria-live="polite">{`Reading ${progress.done} of ${progress.total} files…`}</p> : null}
      {error ? <p className="ln-pw-error" role="alert">{error}</p> : null}
      <input ref={fileInput} type="file" multiple className="sr-only" onChange={pick} />
      <input
        ref={(element) => {
          folderInput.current = element;
          if (element) element.webkitdirectory = true;
        }}
        type="file"
        className="sr-only"
        onChange={pick}
      />
    </div>
  );
}

const statusLabels: Record<ImportedSource["status"], string> = { parsed: "Read", attachment: "Kept as a file", failed: "Could not read", skipped: "Not opened" };

/** The import list (F01): every file with its result, copies marked, failures with the reason and a retry. */
export function ImportResults({ sources, onRetry }: { sources: ImportedSource[]; onRetry: (path: string, file: SourceFile) => void }) {
  const retryInput = useRef<HTMLInputElement>(null);
  const [retrying, setRetrying] = useState<string>();
  const failed = sources.filter((source) => source.status === "failed");
  const counts = {
    files: sources.filter((source) => !source.container).length,
    sequences: sources.reduce((total, source) => total + source.records.length + source.reads.length, 0),
    copies: sources.filter((source) => source.duplicateOf).length,
    kept: sources.filter((source) => source.status === "attachment").length,
  };
  return (
    <div className="ln-pw-results">
      <p className="ln-pw-summary">
        <span>{`${counts.files} files`}</span>
        <span>{`${counts.sequences} sequences and reads`}</span>
        {counts.copies ? <span>{`${counts.copies} identical copies`}</span> : null}
        {counts.kept ? <span>{`${counts.kept} kept as files only`}</span> : null}
        <span data-state={failed.length ? "warn" : undefined}>{`${failed.length} could not be read`}</span>
      </p>
      {failed.length ? (
        <ul className="ln-pw-failures">
          {failed.map((source) => (
            <li key={source.path}>
              <span className="ln-pw-path" data-i18n-ignore>{source.path}</span>
              <span className="ln-pw-reason">{source.error?.message}</span>
              <button type="button" className="ln-pw-link" onClick={() => { setRetrying(source.path); retryInput.current?.click(); }}>
                <RefreshCw className="h-3 w-3" aria-hidden />Replace and retry
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <details className="ln-pw-all-files">
        <summary>All files</summary>
        <ul>
          {sources.map((source) => (
            <li key={source.path} data-status={source.status}>
              <span className="ln-pw-path" data-i18n-ignore>{source.path}</span>
              <span>{source.duplicateOf ? "Identical copy" : statusLabels[source.status]}</span>
              {source.unsupported.length ? <span className="ln-pw-reason">{`${source.unsupported.length} part(s) not read`}</span> : null}
            </li>
          ))}
        </ul>
      </details>
      <input
        ref={retryInput}
        type="file"
        className="sr-only"
        onChange={async (event) => {
          const [file] = await readPickedFiles(event.target.files);
          if (file && retrying) onRetry(retrying, { path: retrying, bytes: file.bytes });
          event.target.value = "";
        }}
      />
    </div>
  );
}
