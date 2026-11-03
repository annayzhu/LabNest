"use client";

import { FolderOpen, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { addSequencingFile, savePlasmidSequence, saveSequencingReads, startSequencingFolder, type PlasmidSaveResult } from "@/app/tools/plasmid/actions";
import { Button } from "@/components/ui/Button";
import { MAX_ATTACHMENT_BYTES } from "@/lib/attachment-limits";
import { labDate } from "@/lib/lab-time";
import { groupReadEvidence, type ImportedSource, type SourceFile } from "@/lib/plasmid/files";
import { PLASMID_PARSER_VERSION, type Completeness, type ReadableFormat, type SequenceRecord } from "@/lib/plasmid/model";
import { sha256Hex } from "@/lib/plasmid/sha256";
import type { PlasmidChoice, SavedFolder } from "@/lib/plasmid/store.server";
import { completenessLabels, topologyLabels } from "@/lib/plasmid/workbench";

function baseName(path: string) {
  return path.split("/").pop()!;
}

function fileFrom(source: SourceFile) {
  return new File([source.bytes as Uint8Array<ArrayBuffer>], baseName(source.path));
}

/** 保存到库存 (F10): a new plasmid, or a new version of one; the original file goes with the version. */
export function SaveToInventory({ record, completeness, format, original, plasmids, defaultProductId }: {
  record: SequenceRecord;
  completeness: Completeness;
  format?: ReadableFormat;
  original?: SourceFile;
  plasmids: PlasmidChoice[];
  defaultProductId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"new" | "existing">(defaultProductId ? "existing" : "new");
  const [name, setName] = useState(record.name);
  const [productId, setProductId] = useState(defaultProductId ?? plasmids[0]?.id ?? "");
  const [created, setCreated] = useState<PlasmidChoice[]>([]);
  const [result, setResult] = useState<PlasmidSaveResult>();
  const [pending, startTransition] = useTransition();
  const choices = [...plasmids, ...created.filter((item) => !plasmids.some((plasmid) => plasmid.id === item.id))];

  // The upload limit is 25 MB a file; a bigger original (a large ZIP) stays out, and the result says so.
  const keepOriginal = original && original.bytes.length <= MAX_ATTACHMENT_BYTES ? original : undefined;
  const save = () => startTransition(async () => {
    const data = new FormData();
    data.set("payload", JSON.stringify({
      target: mode === "new" ? { kind: "new", name } : { kind: "existing", productId },
      record: { sequence: record.sequence, topology: record.topology, features: record.features },
      completeness,
      ...(format ? { sourceFormat: format } : {}),
      ...(original ? { sourceFileName: baseName(original.path) } : {}),
    }));
    if (keepOriginal) data.set("file", fileFrom(keepOriginal));
    const saved = await savePlasmidSequence(data);
    setResult(original && !keepOriginal && saved.productId && !saved.unchanged ? { ...saved, warning: "The original file is over 25 MB, so it was not kept." } : saved);
    if (!saved.productId) return;
    // The next save of this sequence goes to the plasmid it now lives on.
    if (mode === "new") setCreated((list) => [...list, { id: saved.productId!, name }]);
    setMode("existing");
    setProductId(saved.productId);
    router.refresh();
  });

  if (!open) return <Button type="button" variant="primary" size="sm" onClick={() => { setOpen(true); setResult(undefined); }}><Save className="h-3.5 w-3.5" aria-hidden />Save to inventory</Button>;
  return (
    <div className="ln-pw-save" role="dialog" aria-label="Save to inventory">
      <fieldset>
        <legend>Save as</legend>
        <label className="ln-pw-choice">
          <input type="radio" checked={mode === "new"} onChange={() => setMode("new")} />
          <span>A new plasmid</span>
        </label>
        {mode === "new" ? <input className="ln-pw-input" value={name} onChange={(event) => setName(event.target.value)} aria-label="Plasmid name" /> : null}
        <label className="ln-pw-choice">
          <input type="radio" checked={mode === "existing"} disabled={!choices.length} onChange={() => setMode("existing")} />
          <span>{choices.length ? "A new version of" : "A new version of a plasmid (none in inventory yet)"}</span>
        </label>
        {mode === "existing" ? (
          <select className="ln-pw-input" value={productId} onChange={(event) => setProductId(event.target.value)} aria-label="Plasmid">
            {choices.map((plasmid) => <option key={plasmid.id} value={plasmid.id}>{plasmid.name}</option>)}
          </select>
        ) : null}
      </fieldset>
      <p className="ln-pw-note">
        {`${record.sequence.length.toLocaleString("en-US")} bp · ${topologyLabels[record.topology]} · ${completenessLabels[completeness]} · ${record.features.length} features`}
        {original ? <><br /><span className="ln-pw-path" data-i18n-ignore>{original.path}</span></> : null}
      </p>
      {result?.error ? <p className="ln-pw-error" role="alert">{result.error}</p> : null}
      {result && !result.error ? (
        <p className="ln-pw-ok" role="status">
          {result.unchanged ? `Nothing changed; ${result.versionLabel} stays current.` : `Saved as ${result.versionLabel}.`}{" "}
          <Link href={`/inventory/products/${result.productId}`} className="ln-pw-link">Open the plasmid</Link>
        </p>
      ) : null}
      {result?.warning ? <p className="ln-pw-note" role="status">{result.warning}</p> : null}
      <div className="ln-pw-actions">
        <Button type="button" variant="primary" size="sm" disabled={pending || (mode === "new" ? !name.trim() : !productId)} onClick={save}>{pending ? "Saving…" : "Save"}</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Close</Button>
      </div>
    </div>
  );
}

/**
 * 测序资料夹 (Q273): keeps every original once (copies point at the first), then records
 * each read with its quality or 未提供, its source path and its evidence group. A save that
 * stops on a file goes on from that file into the same folder when saved again.
 */
export function SaveFolder({ sources, files, plasmids }: { sources: ImportedSource[]; files: SourceFile[]; plasmids: PlasmidChoice[] }) {
  const router = useRouter();
  const firstFolder = files[0]?.path.includes("/") ? files[0].path.split("/")[0] : "";
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(firstFolder || `Sequencing ${labDate(new Date())}`);
  const [productId, setProductId] = useState("");
  const [folderId, setFolderId] = useState<string>();
  const kept = useRef(new Map<string, string>());
  const [progress, setProgress] = useState<string>();
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();
  const [pending, startTransition] = useTransition();

  const save = () => startTransition(async () => {
    setError(undefined);
    setDone(undefined);
    let id = folderId;
    if (!id) {
      const started = await startSequencingFolder(name, productId);
      if (!started.folderId) {
        setError(started.error);
        return;
      }
      id = started.folderId;
      setFolderId(id);
    }
    const tooLarge: string[] = [];
    const topLevel = sources.filter((source) => !source.container);
    for (const [index, source] of topLevel.entries()) {
      if (kept.current.has(source.path)) continue;
      setProgress(`Keeping file ${index + 1} of ${topLevel.length}…`);
      const file = files.find((item) => item.path === source.path);
      if (!file) continue;
      if (source.duplicateOf && kept.current.has(source.duplicateOf)) {
        kept.current.set(source.path, kept.current.get(source.duplicateOf)!);
        continue;
      }
      if (file.bytes.length > MAX_ATTACHMENT_BYTES) {
        tooLarge.push(source.path);
        continue;
      }
      const data = new FormData();
      data.set("file", fileFrom(file));
      data.set("meta", JSON.stringify({
        relativePath: source.path,
        format: source.format,
        status: source.status,
        parser: source.parser,
        unsupported: source.unsupported.map((item) => item.message),
        warnings: [...source.warnings.map((item) => item.message), ...(source.error ? [source.error.message] : [])],
      }));
      const result = await addSequencingFile(id, data);
      if (!result.attachmentId) {
        setProgress(undefined);
        setError(result.error);
        return;
      }
      kept.current.set(source.path, result.attachmentId);
    }
    setProgress("Recording the reads…");
    const { reads } = groupReadEvidence(sources);
    const payload = await Promise.all(reads.map(async ({ source, read, group }) => {
      const container = source.container ?? source.path;
      return {
        attachmentId: kept.current.get(container) ?? null,
        relativePath: container,
        memberPath: source.container ? source.path.slice(`${source.container}::`.length) : null,
        format: source.format,
        name: read.name,
        bases: read.bases,
        quality: read.quality,
        peaks: read.peaks,
        fileSha256: source.sha256,
        basesSha256: await sha256Hex(new TextEncoder().encode(read.bases)),
        evidenceGroup: group,
        metadata: read.metadata,
        warnings: source.warnings.map((item) => item.message),
        parserVersion: PLASMID_PARSER_VERSION,
      };
    }));
    const saved = await saveSequencingReads(id, payload);
    setProgress(undefined);
    if (saved.error) setError(saved.error);
    else {
      const keptFiles = new Set(kept.current.values()).size;
      setDone(tooLarge.length ? `Saved ${saved.saved} reads and ${keptFiles} files; ${tooLarge.length} file(s) over 25 MB were not kept.` : `Saved ${saved.saved} reads and ${keptFiles} files.`);
      router.refresh();
    }
  });

  if (!open) return <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}><FolderOpen className="h-3.5 w-3.5" aria-hidden />Save as a sequencing folder</Button>;
  return (
    <div className="ln-pw-save" role="dialog" aria-label="Save as a sequencing folder">
      <label className="ln-pw-field">
        <span>Folder name</span>
        <input className="ln-pw-input" value={name} disabled={Boolean(folderId)} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="ln-pw-field">
        <span>About which plasmid (optional)</span>
        <select className="ln-pw-input" value={productId} disabled={Boolean(folderId)} onChange={(event) => setProductId(event.target.value)}>
          <option value="">Not chosen yet</option>
          {plasmids.map((plasmid) => <option key={plasmid.id} value={plasmid.id}>{plasmid.name}</option>)}
        </select>
      </label>
      <p className="ln-pw-note">Every original file is kept once, with its path inside the folder; identical copies are not stored twice.</p>
      {progress ? <p className="ln-pw-note" aria-live="polite">{progress}</p> : null}
      {error ? <p className="ln-pw-error" role="alert">{error}</p> : null}
      {error && folderId ? <p className="ln-pw-note">Press Save folder again to go on from this file.</p> : null}
      {done ? <p className="ln-pw-ok" role="status">{done}</p> : null}
      <div className="ln-pw-actions">
        <Button type="button" variant="primary" size="sm" disabled={pending || !name.trim() || Boolean(done)} onClick={save}>{pending ? "Saving…" : "Save folder"}</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Close</Button>
      </div>
    </div>
  );
}

/** Saved folders open by reading their original files again, so the view matches a fresh import. */
export function SavedFolders({ folders, onOpen }: { folders: SavedFolder[]; onOpen: (files: SourceFile[]) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  if (!folders.length) return null;
  const openFolder = async (folder: SavedFolder) => {
    setLoading(true);
    setError(undefined);
    try {
      const files = await Promise.all(folder.files.map(async (file) => {
        const response = await fetch(`/api/attachments/${file.attachmentId}`);
        if (!response.ok) throw new Error(`${file.path} could not be fetched.`);
        return { path: file.path, bytes: new Uint8Array(await response.arrayBuffer()) };
      }));
      onOpen(files.sort((left, right) => left.path.localeCompare(right.path)));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setLoading(false);
    }
  };
  return (
    <section>
      <h2>Saved sequencing folders</h2>
      <ul>
        {folders.map((folder) => (
          <li key={folder.id}>
            <button type="button" disabled={loading} onClick={() => openFolder(folder)}>
              <span data-i18n-ignore>{folder.name}</span>
              <small>{`${folder.reads} reads · ${folder.files.length} files · ${labDate(folder.createdAt)}${folder.plasmid ? ` · ${folder.plasmid}` : ""}`}</small>
            </button>
          </li>
        ))}
      </ul>
      {loading ? <p className="ln-pw-note">Opening…</p> : null}
      {error ? <p className="ln-pw-error" role="alert">{error}</p> : null}
    </section>
  );
}
