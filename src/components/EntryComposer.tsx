"use client";

import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Cloud,
  File,
  ImagePlus,
  Paperclip,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { DocumentCanvas } from "@/components/DocumentCanvas";
import { DocumentPrintButton } from "@/components/DocumentPrintButton";
import { formInputClass, formLabelClass, formTextareaClass } from "@/components/forms";
import { MarkdownRichTextEditor } from "@/components/MarkdownRichTextEditor";
import { TagFieldLabel } from "@/components/TagFieldLabel";
import { Button } from "@/components/ui/Button";
import { StatusRadioGroup } from "@/components/ui/StatusRadioGroup";
import { deleteEntryDraft, loadEntryDraft, saveEntryDraft, type StoredEntryDraft } from "@/lib/entry-draft-store";
import { MAX_ENTRY_FILES, MAX_ENTRY_TOTAL_BYTES } from "@/lib/attachment-limits";
import { cn } from "@/lib/cn";
import { experimentStatusOptions, recordStatusOptions } from "@/lib/status-options";

export type EntryComposerProject = { id: string; name: string };
export type EntryComposerResearchPlan = { id: string; title: string; code?: string; projectId: string; projectName: string };
export type EntryComposerProtocol = { id: string; label: string };
export type EntryComposerAttachment = { id: string; originalFilename: string; mimeType: string; size: number };

type EntryComposerFields = {
  title: string;
  contentMarkdown: string;
  occurredAt: string;
  projectId: string;
  researchPlanId: string;
  sourceType: string;
  recordStatus: string;
  moodStatus: string;
  tags: string;
  protocolVersionId: string;
  experimentTitle: string;
  experimentStatus: string;
  resultTitle: string;
  resultType: string;
  resultTextValue: string;
  resultNotes: string;
};

type ExistingMedia = EntryComposerAttachment & { kind: "existing"; previewUrl?: string };
type NewMedia = {
  kind: "new";
  id: string;
  file: File;
  originalFilename: string;
  mimeType: string;
  size: number;
  previewUrl?: string;
  status: "ready" | "uploading" | "error";
};
type ComposerMedia = ExistingMedia | NewMedia;

export type EntryComposerInitialEntry = {
  id: string;
  title: string;
  contentMarkdown: string;
  occurredAt: string;
  projectId?: string;
  researchPlanId?: string;
  sourceType: string;
  recordStatus: string;
  moodStatus?: string;
  tags: string[];
  attachments: EntryComposerAttachment[];
};

const maxFileBytes = 25 * 1024 * 1024;

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `file-${Date.now()}-${Math.random()}`;
}

function existingMedia(attachment: EntryComposerAttachment): ExistingMedia {
  return {
    ...attachment,
    kind: "existing",
    previewUrl: attachment.mimeType.startsWith("image/") ? `/api/attachments/${attachment.id}?inline=1` : undefined,
  };
}

function initialFields(defaultOccurredAt: string, defaultSource: string, defaultProtocolVersionId: string, entry?: EntryComposerInitialEntry): EntryComposerFields {
  return {
    title: entry?.title ?? "",
    contentMarkdown: entry?.contentMarkdown ?? "",
    occurredAt: entry?.occurredAt ?? defaultOccurredAt,
    projectId: entry?.projectId ?? "",
    researchPlanId: entry?.researchPlanId ?? "",
    sourceType: entry?.sourceType ?? defaultSource,
    recordStatus: entry?.recordStatus ?? "recorded",
    moodStatus: entry?.moodStatus ?? "",
    tags: entry?.tags.join(", ") ?? "",
    protocolVersionId: defaultProtocolVersionId,
    experimentTitle: "",
    experimentStatus: "running",
    resultTitle: "",
    resultType: "",
    resultTextValue: "",
    resultNotes: "",
  };
}

export function EntryComposer({
  projects,
  researchPlans,
  protocols,
  defaultOccurredAt,
  defaultSource = "text",
  defaultProtocolVersionId = "",
  entry,
}: {
  projects: EntryComposerProject[];
  researchPlans: EntryComposerResearchPlan[];
  protocols: EntryComposerProtocol[];
  defaultOccurredAt: string;
  defaultSource?: string;
  defaultProtocolVersionId?: string;
  entry?: EntryComposerInitialEntry;
}) {
  const router = useRouter();
  const mediaInputPrefix = useId();
  const imageInputId = `${mediaInputPrefix}-photos`;
  const cameraInputId = `${mediaInputPrefix}-camera`;
  const fileInputId = `${mediaInputPrefix}-files`;
  const previewUrls = useRef(new Set<string>());
  const baselineFields = useMemo(
    () => initialFields(defaultOccurredAt, defaultSource, defaultProtocolVersionId, entry),
    [defaultOccurredAt, defaultProtocolVersionId, defaultSource, entry],
  );
  const baselineMedia = useMemo(() => entry?.attachments.map(existingMedia) ?? [], [entry]);
  const [fields, setFields] = useState<EntryComposerFields>(baselineFields);
  const [media, setMedia] = useState<ComposerMedia[]>(baselineMedia);
  const [hydrated, setHydrated] = useState(false);
  const [draftStatus, setDraftStatus] = useState("");
  const [submitStatus, setSubmitStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [draggedMediaId, setDraggedMediaId] = useState<string>();
  const draftKey = `entry-composer:${entry?.id ?? "new"}`;

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadEntryDraft<EntryComposerFields>(draftKey)
      .then((draft) => {
        if (cancelled || !draft) return;
        const existingMap = new Map(baselineMedia.map((item) => [item.id, item]));
        const newMap = new Map(draft.newFiles.map(({ id, file }) => {
          const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
          if (previewUrl) previewUrls.current.add(previewUrl);
          return [id, {
            kind: "new" as const,
            id,
            file,
            originalFilename: file.name,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
            previewUrl,
            status: "ready" as const,
          }];
        }));
        const restoredMedia = draft.mediaOrder.flatMap((token) => {
          const item = token.kind === "existing" ? existingMap.get(token.id) : newMap.get(token.id);
          return item ? [item] : [];
        });
        setFields(draft.fields);
        setMedia(restoredMedia);
        setDraftStatus(`Recovered local draft from ${new Date(draft.savedAt).toLocaleString()}.`);
      })
      .catch(() => setDraftStatus("Local draft recovery is unavailable in this browser."))
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => { cancelled = true; };
  }, [baselineMedia, draftKey]);

  useEffect(() => {
    if (!hydrated || isSubmitting) return;
    const timer = window.setTimeout(() => {
      const draft: StoredEntryDraft<EntryComposerFields> = {
        fields,
        newFiles: media.flatMap((item) => item.kind === "new" ? [{ id: item.id, file: item.file }] : []),
        mediaOrder: media.map((item) => ({ kind: item.kind, id: item.id })),
        savedAt: new Date().toISOString(),
      };
      saveEntryDraft(draftKey, draft)
        .then(() => setDraftStatus("Draft saved locally, including selected files."))
        .catch(() => setDraftStatus("Draft could not be saved locally."));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [draftKey, fields, hydrated, isSubmitting, media]);

  const availablePlans = fields.projectId ? researchPlans.filter((plan) => plan.projectId === fields.projectId) : researchPlans;
  const totalBytes = media.reduce((total, item) => total + item.size, 0);
  const selectedProject = projects.find((project) => project.id === fields.projectId);
  const selectedPlan = researchPlans.find((plan) => plan.id === fields.researchPlanId);
  const selectedProtocol = protocols.find((protocol) => protocol.id === fields.protocolVersionId);

  function updateField<K extends keyof EntryComposerFields>(key: K, value: EntryComposerFields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    setSubmitStatus("");
    if (!files.length) return;
    if (media.length + files.length > MAX_ENTRY_FILES) {
      setSubmitStatus(`An Entry can contain at most ${MAX_ENTRY_FILES} files.`);
      return;
    }
    const invalid = files.find((file) => file.size === 0 || file.size > maxFileBytes);
    if (invalid) {
      setSubmitStatus(`${invalid.name} is empty or exceeds the 25 MB per-file limit.`);
      return;
    }
    const nextTotal = totalBytes + files.reduce((sum, file) => sum + file.size, 0);
    if (nextTotal > MAX_ENTRY_TOTAL_BYTES) {
      setSubmitStatus("Combined Entry attachments cannot exceed 100 MB.");
      return;
    }

    const next = files.map<NewMedia>((file) => {
      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
      if (previewUrl) previewUrls.current.add(previewUrl);
      return {
        kind: "new",
        id: newId(),
        file,
        originalFilename: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        previewUrl,
        status: "ready",
      };
    });
    setMedia((current) => [...current, ...next]);
    if (fields.sourceType === "text") updateField("sourceType", files.some((file) => file.type.startsWith("image/")) ? "photo" : "file");
  }

  function containsDraggedFiles(event: React.DragEvent<HTMLElement>) {
    return Array.from(event.dataTransfer.types).includes("Files");
  }

  function handleMediaDragEnter(event: React.DragEvent<HTMLElement>) {
    if (!containsDraggedFiles(event)) return;
    event.preventDefault();
    setIsDraggingFiles(true);
  }

  function handleMediaDragOver(event: React.DragEvent<HTMLElement>) {
    if (!containsDraggedFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleMediaDragLeave(event: React.DragEvent<HTMLElement>) {
    const nextTarget = event.relatedTarget;
    if (!nextTarget || !(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
      setIsDraggingFiles(false);
    }
  }

  function handleMediaDrop(event: React.DragEvent<HTMLElement>) {
    if (!containsDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingFiles(false);
    if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
  }

  function removeMedia(id: string) {
    setMedia((current) => {
      const removed = current.find((item) => item.id === id);
      if (removed?.kind === "new" && removed.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
        previewUrls.current.delete(removed.previewUrl);
      }
      return current.filter((item) => item.id !== id);
    });
  }

  function moveMedia(id: string, direction: -1 | 1) {
    setMedia((current) => {
      const index = current.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function moveMediaBefore(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    setMedia((current) => {
      const sourceIndex = current.findIndex((item) => item.id === sourceId);
      const targetIndex = current.findIndex((item) => item.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      const [source] = next.splice(sourceIndex, 1);
      next.splice(sourceIndex < targetIndex ? targetIndex - 1 : targetIndex, 0, source);
      return next;
    });
  }

  async function discardDraft() {
    await deleteEntryDraft(draftKey).catch(() => undefined);
    media.forEach((item) => {
      if (item.kind === "new" && item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
        previewUrls.current.delete(item.previewUrl);
      }
    });
    setFields(baselineFields);
    setMedia(baselineMedia);
    setDraftStatus("Local draft discarded.");
    setSubmitStatus("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitStatus("");
    if (!fields.title.trim() || !fields.contentMarkdown.trim()) {
      setSubmitStatus("Title and body are required.");
      return;
    }

    setIsSubmitting(true);
    setMedia((current) => current.map((item) => item.kind === "new" ? { ...item, status: "uploading" } : item));
    try {
      const formData = new FormData();
      Object.entries(fields).forEach(([key, value]) => formData.set(key, value));
      const newItems = media.filter((item): item is NewMedia => item.kind === "new");
      newItems.forEach((item) => formData.append("files", item.file, item.file.name));
      formData.set("newFileIds", JSON.stringify(newItems.map((item) => item.id)));
      formData.set("mediaOrder", JSON.stringify(media.map((item) => ({ kind: item.kind, id: item.id }))));

      const response = await fetch(entry ? `/api/entries/${entry.id}` : "/api/entries", {
        method: entry ? "PATCH" : "POST",
        body: formData,
      });
      const result = await response.json() as { entryId?: string; error?: string };
      if (!response.ok || !result.entryId) throw new Error(result.error ?? "Entry could not be saved.");

      await deleteEntryDraft(draftKey).catch(() => undefined);
      router.push(`/entries/${result.entryId}`);
      router.refresh();
    } catch (error) {
      setMedia((current) => current.map((item) => item.kind === "new" ? { ...item, status: "error" } : item));
      setSubmitStatus(`${error instanceof Error ? error.message : "Entry could not be saved."} Your draft and selected files are still available; choose Try again.`);
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="entry-editor-layout">
      <section className="entry-editor-draft overflow-hidden rounded-[12px] border border-hairline bg-surface shadow-paper" data-print-hidden>
        <div className="flex flex-col gap-3 border-b border-hairline bg-warm/55 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted">
            <Cloud className="h-4 w-4 shrink-0 text-moss" aria-hidden />
            <span className="truncate">{draftStatus || "Draft recovery will start after the editor loads."}</span>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={discardDraft} disabled={isSubmitting}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Discard local draft
          </Button>
        </div>

      </section>

      <DocumentCanvas className="entry-editor-document" label={fields.title || "Entry editor"} toolbar={<><span className="mr-auto hidden text-xs text-muted sm:inline">Write directly in the final layout</span><DocumentPrintButton /></>}>
        <header className="document-page-header">
          <p className="document-page-kicker">Entry</p>
          <input
            required
            value={fields.title}
            onChange={(event) => updateField("title", event.target.value)}
            className="document-page-title focus-ring w-full border-0 bg-transparent p-0 font-serif font-medium leading-tight text-ink outline-none placeholder:text-muted"
            placeholder="Untitled Entry"
            aria-label="Entry title"
          />
          <dl className="document-page-facts">
            <div><dt>Occurred</dt><dd><input required type="datetime-local" value={fields.occurredAt} onChange={(event) => updateField("occurredAt", event.target.value)} className="focus-ring w-full rounded-[4px] border border-transparent bg-transparent p-0 text-graphite hover:border-hairline" /></dd></div>
            <div><dt>Project</dt><dd>{selectedProject?.name ?? "Unassigned"}</dd></div>
            <div><dt>Research Plan</dt><dd>{selectedPlan ? selectedPlan.code ?? selectedPlan.title : "Unassigned"}</dd></div>
            <div><dt>Source</dt><dd>{fields.sourceType.replaceAll("_", " ")}</dd></div>
            <div><dt>Record</dt><dd>{fields.recordStatus.replaceAll("_", " ")}</dd></div>
            {selectedProtocol ? <div><dt>Protocol</dt><dd>{selectedProtocol.label}</dd></div> : null}
          </dl>
        </header>
        <MarkdownRichTextEditor
          value={fields.contentMarkdown}
          onChange={(value) => updateField("contentMarkdown", value)}
          placeholder="Observation, decision, deviation, or follow-up…"
          minHeightClass="min-h-[420px]"
        />
      </DocumentCanvas>

      <section
        className={cn(
          "entry-editor-media rounded-[18px] border bg-surface p-4 shadow-paper transition sm:p-6",
          isDraggingFiles ? "border-moss ring-2 ring-moss/15" : "border-hairline",
        )}
        onDragEnter={handleMediaDragEnter}
        onDragOver={handleMediaDragOver}
        onDragLeave={handleMediaDragLeave}
        onDrop={handleMediaDrop}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-moss">Photos and files</p>
            <h2 className="mt-1 font-serif text-2xl font-medium text-ink">Entry media</h2>
            <p className="mt-1 text-sm text-muted">Up to 14 files, 25 MB each and 100 MB combined. Originals are preserved.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <MediaPickerLabel htmlFor={imageInputId} disabled={isSubmitting}><ImagePlus className="h-4 w-4" />Add photos</MediaPickerLabel>
            <MediaPickerLabel htmlFor={cameraInputId} disabled={isSubmitting}><Camera className="h-4 w-4" />Take photo</MediaPickerLabel>
            <MediaPickerLabel htmlFor={fileInputId} disabled={isSubmitting}><Paperclip className="h-4 w-4" />Add files</MediaPickerLabel>
          </div>
        </div>
        <input id={imageInputId} className="sr-only" disabled={isSubmitting} type="file" accept="image/*" multiple onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} />
        <input id={cameraInputId} className="sr-only" disabled={isSubmitting} type="file" accept="image/*" capture="environment" onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} />
        <input id={fileInputId} className="sr-only" disabled={isSubmitting} type="file" multiple onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} />

        <label
          htmlFor={fileInputId}
          className={cn(
            "focus-ring mt-5 block cursor-pointer rounded-[14px] border border-dashed px-4 py-7 text-center transition",
            isDraggingFiles ? "border-moss bg-sage-surface/70" : "border-hairline bg-warm/45",
            isSubmitting && "pointer-events-none cursor-not-allowed opacity-55",
          )}
        >
          <ImagePlus className="mx-auto h-6 w-6 text-moss" aria-hidden />
          <p className="mt-2 text-sm font-semibold text-ink">Drop experiment photos or files here</p>
          <p className="mt-1 text-xs text-muted">Drop anywhere in this panel or click here to browse. Nothing is uploaded until Save Entry.</p>
        </label>

        {media.length ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {media.map((item, index) => (
              <article
                key={item.id}
                draggable
                onDragStart={() => setDraggedMediaId(item.id)}
                onDragEnd={() => setDraggedMediaId(undefined)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (draggedMediaId) moveMediaBefore(draggedMediaId, item.id);
                }}
                className={cn("overflow-hidden rounded-[12px] border bg-warm", item.kind === "new" && item.status === "error" ? "border-error/50" : "border-hairline")}
              >
                <div className="relative flex h-36 items-center justify-center overflow-hidden bg-stone">
                  {item.previewUrl ? (
                    <Image src={item.previewUrl} alt={item.originalFilename} fill unoptimized className="object-cover" />
                  ) : (
                    <File className="h-10 w-10 text-muted" aria-hidden />
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-ink/75 px-2 py-1 font-mono text-[10px] text-white">{index + 1}</span>
                  {item.kind === "new" ? (
                    <span className={cn("absolute bottom-2 right-2 rounded-full px-2 py-1 text-[10px] font-semibold", item.status === "error" ? "bg-error text-white" : item.status === "uploading" ? "bg-info text-white" : "bg-surface/90 text-moss")}>{item.status}</span>
                  ) : null}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-semibold text-ink" title={item.originalFilename}>{item.originalFilename}</p>
                  <p className="mt-1 text-xs text-muted">{formatBytes(item.size)} · {item.kind === "existing" ? "saved original" : "local original"}</p>
                  <div className="mt-3 flex items-center justify-end gap-1">
                    <Button type="button" size="icon" variant="ghost" disabled={index === 0 || isSubmitting} title="Move earlier" aria-label={`Move ${item.originalFilename} earlier`} onClick={() => moveMedia(item.id, -1)}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button type="button" size="icon" variant="ghost" disabled={index === media.length - 1 || isSubmitting} title="Move later" aria-label={`Move ${item.originalFilename} later`} onClick={() => moveMedia(item.id, 1)}><ChevronRight className="h-4 w-4" /></Button>
                    <Button type="button" size="icon" variant="destructive" disabled={isSubmitting} title="Remove from Entry" aria-label={`Remove ${item.originalFilename}`} onClick={() => removeMedia(item.id)}><X className="h-4 w-4" /></Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
        <p className="mt-4 text-xs text-muted">{media.length} / {MAX_ENTRY_FILES} files · {formatBytes(totalBytes)} combined</p>
      </section>

      <section className="entry-editor-context rounded-[18px] border border-hairline bg-surface p-4 shadow-paper sm:p-6">
        <h2 className="font-serif text-xl font-medium text-ink">Research context</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <ComposerSelect label="Project" value={fields.projectId} onChange={(value) => {
            updateField("projectId", value);
            const selectedPlan = researchPlans.find((plan) => plan.id === fields.researchPlanId);
            if (selectedPlan && value && selectedPlan.projectId !== value) updateField("researchPlanId", "");
          }} options={[{ value: "", label: "No project" }, ...projects.map((project) => ({ value: project.id, label: project.name }))]} />
          <ComposerSelect label="Research plan" value={fields.researchPlanId} onChange={(value) => {
            updateField("researchPlanId", value);
            const plan = researchPlans.find((candidate) => candidate.id === value);
            if (plan) updateField("projectId", plan.projectId);
          }} options={[{ value: "", label: "Unassigned" }, ...availablePlans.map((plan) => ({ value: plan.id, label: `${plan.projectName} · ${plan.code ?? plan.title}` }))]} />
          <ComposerSelect label="Source" value={fields.sourceType} onChange={(value) => updateField("sourceType", value)} options={["text", "photo", "file", "voice", "manual"].map((value) => ({ value, label: value }))} />
          <ComposerInput label="State" value={fields.moodStatus} onChange={(value) => updateField("moodStatus", value)} placeholder="needs follow-up" />
          <StatusRadioGroup label="Record status" value={fields.recordStatus} onValueChange={(value) => updateField("recordStatus", value)} options={recordStatusOptions} className="md:col-span-2 xl:col-span-5" />
        </div>
        <div className="mt-4">
          <label className="block">
            <TagFieldLabel />
            <input value={fields.tags} onChange={(event) => updateField("tags", event.target.value)} placeholder="transfection, observation" className={formInputClass} />
          </label>
        </div>
      </section>

      {!entry ? (
        <details className="entry-editor-experiment rounded-[18px] border border-hairline bg-surface p-4 shadow-paper sm:p-6">
          <summary className="cursor-pointer font-serif text-xl font-medium text-ink">Protocol-Based Experiment <span className="ml-2 font-sans text-xs font-normal text-muted">optional</span></summary>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2"><ComposerSelect label="Protocol version" value={fields.protocolVersionId} onChange={(value) => updateField("protocolVersionId", value)} options={[{ value: "", label: "Standalone entry" }, ...protocols.map((protocol) => ({ value: protocol.id, label: protocol.label }))]} /></div>
            <ComposerInput label="Experiment title" value={fields.experimentTitle} onChange={(value) => updateField("experimentTitle", value)} placeholder="Defaults to Entry title" />
            <StatusRadioGroup label="Experiment status" value={fields.experimentStatus} onValueChange={(value) => updateField("experimentStatus", value)} options={experimentStatusOptions} className="md:col-span-2" />
            <ComposerInput label="Result title" value={fields.resultTitle} onChange={(value) => updateField("resultTitle", value)} placeholder="Optional first result" />
            <ComposerInput label="Result type" value={fields.resultType} onChange={(value) => updateField("resultType", value)} placeholder="fluorescence_expression" />
            <div className="md:col-span-2"><ComposerTextarea label="Initial result text" value={fields.resultTextValue} onChange={(value) => updateField("resultTextValue", value)} /></div>
            <div className="md:col-span-2"><ComposerTextarea label="Result notes" value={fields.resultNotes} onChange={(value) => updateField("resultNotes", value)} /></div>
          </div>
        </details>
      ) : null}
      </div>

      {submitStatus ? <div role="alert" className="rounded-[12px] border border-error/35 bg-error-surface px-4 py-3 text-sm leading-6 text-error">{submitStatus}</div> : null}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        {submitStatus && !isSubmitting ? <Button type="submit" size="lg"><RotateCcw className="h-4 w-4" />Try again</Button> : null}
        <Button type="submit" size="lg" variant="primary" disabled={isSubmitting}>
          <Save className="h-4 w-4" />
          {isSubmitting ? "Saving originals…" : entry ? "Save changes" : "Save Entry"}
        </Button>
      </div>
    </form>
  );
}

function ComposerInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="block"><span className={formLabelClass}>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={formInputClass} /></label>;
}

function ComposerTextarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className={formLabelClass}>{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} className={`${formTextareaClass} resize-y`} /></label>;
}

function ComposerSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <label className="block"><span className={formLabelClass}>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className={formInputClass}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function MediaPickerLabel({ htmlFor, disabled, children }: { htmlFor: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onKeyDown={(event) => {
        if (disabled || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        document.getElementById(htmlFor)?.click();
      }}
      className={cn(
        "focus-ring inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[7px] border border-hairline bg-transparent px-3 text-[13px] font-normal tracking-[0.005em] text-ink transition hover:border-border-strong hover:bg-warm",
        disabled && "pointer-events-none cursor-not-allowed opacity-55",
      )}
    >
      {children}
    </label>
  );
}
