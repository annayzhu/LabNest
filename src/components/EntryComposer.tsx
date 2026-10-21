"use client";
import { editedEventPrecision, recoveredDraftVersion } from "@/lib/entry-lifecycle";

import { entryTypes, entryTypeLabels } from "@/lib/entry-assignment";
import { collectDocumentMedia, documentMediaAttachmentId } from "@/lib/document-media";
import { newClientMutationId } from "@/lib/client-mutation-id";

import {
  Camera,
  ChevronRight,
  Cloud,
  Download,
  File,
  RotateCcw,
  Save,
  X,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { documentMediaDraftId, insertDocumentMediaFiles } from "./DocumentMediaUploads";
import { StandaloneDocumentEditorViewport } from "@/components/DocumentEditorViewport";
import { DocumentEditorLayout } from "@/components/DocumentEditorLayout";
import { DocumentPrintButton } from "@/components/DocumentPrintButton";
import { formInputClass } from "@/components/forms";
import { useI18n } from "@/components/I18nProvider";
import { MarkdownRichTextEditor } from "@/components/MarkdownRichTextEditor";
import { TagFieldLabel } from "@/components/TagFieldLabel";
import { Button } from "@/components/ui/Button";
import { Disclosure } from "@/components/ui/Disclosure";
import { StatusRadioGroup } from "@/components/ui/StatusRadioGroup";
import { deleteEntryDraft, loadEntryDraft, saveEntryDraft, type StoredEntryDraft } from "@/lib/entry-draft-store";
import { migrateEntryDraftFields } from "@/lib/entry-draft-migration";
import { entryDraftKey, entryDraftMatchesContext } from "@/lib/entry-draft-context";
import { cn } from "@/lib/cn";
import type { DocumentOutlineItem } from "@/lib/document-outline";
import { experimentStatusOptions, recordStatusOptions } from "@/lib/status-options";
import { enqueueMobileMutation } from "@/lib/mobile-mutation-queue";

export type EntryComposerProject = { id: string; name: string };
export type EntryComposerResearchPlan = { id: string; title: string; code?: string; projectId: string; projectName: string };
export type EntryComposerProtocol = { id: string; label: string };
export type EntryComposerAttachment = { id: string; originalFilename: string; mimeType: string; size: number };

type EntryComposerFields = {
  entryType: string;
  eventTimePrecision: string;
  expectedUpdatedAt: string;
  title: string;
  contentMarkdown: string;
  occurredAt: string;
  projectId: string;
  researchPlanId: string;
  experimentId: string;
  experimentStepId: string;
  sourceType: string;
  recordStatus: string;
  moodStatus: string;
  tags: string;
  protocolVersionId: string;
  experimentTitle: string;
  experimentStatus: string;
  createInitialResult: string;
  resultTitle: string;
  resultType: string;
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
  entryType?: string;
  eventTimePrecision?: string;
  updatedAt?: string;
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

const entryDocumentOutline: DocumentOutlineItem[] = [
  { id: "entry-document-overview", label: "Entry details" },
  { id: "entry-document-content", label: "Record content" },
];

/**
 * Files from a button outside the page go to its end, above an empty line that takes the caret, so writing continues
 * under them (the inserted picture itself stays unselected, so typing never replaces it).
 */
function appendToPage(editor: Editor, files: File[]) {
  const last = editor.state.doc.lastChild;
  if (last?.type.name !== "paragraph" || last.content.size) editor.commands.insertContentAt(editor.state.doc.content.size, { type: "paragraph" });
  const doc = editor.state.doc;
  insertDocumentMediaFiles(editor, files, documentMediaDraftId(editor), doc.content.size - doc.lastChild!.nodeSize);
  editor.chain().setTextSelection(editor.state.doc.content.size - 1).scrollIntoView().run();
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function newId() {
  return newClientMutationId();
}

function existingMedia(attachment: EntryComposerAttachment): ExistingMedia {
  return {
    ...attachment,
    kind: "existing",
    previewUrl: attachment.mimeType.startsWith("image/") ? `/api/attachments/${attachment.id}?inline=1` : undefined,
  };
}

function initialFields(defaultOccurredAt: string, defaultSource: string, defaultProtocolVersionId: string, defaultExperimentId: string, defaultExperimentStepId: string, entry?: EntryComposerInitialEntry): EntryComposerFields {
  return {
    entryType: entry?.entryType ?? "unclassified",
    eventTimePrecision: entry?.eventTimePrecision ?? "unknown",
    expectedUpdatedAt: entry?.updatedAt ?? "",
    title: entry?.title ?? "",
    contentMarkdown: entry?.contentMarkdown ?? "",
    occurredAt: entry?.eventTimePrecision === "date" ? entry.occurredAt.slice(0,10) : entry?.eventTimePrecision === "datetime" ? entry.occurredAt : "",
    projectId: entry?.projectId ?? "",
    researchPlanId: entry?.researchPlanId ?? "",
    experimentId: defaultExperimentId,
    experimentStepId: defaultExperimentStepId,
    sourceType: entry?.sourceType ?? defaultSource,
    recordStatus: entry?.recordStatus ?? "recorded",
    moodStatus: entry?.moodStatus ?? "",
    tags: entry?.tags.join(", ") ?? "",
    protocolVersionId: defaultProtocolVersionId,
    experimentTitle: "",
    experimentStatus: "running",
    createInitialResult: "false",
    resultTitle: "",
    resultType: "",
  };
}

export function EntryComposer({
  projects,
  researchPlans,
  protocols,
  defaultOccurredAt,
  defaultSource = "text",
  defaultProtocolVersionId = "",
  defaultExperimentId = "",
  defaultExperimentStepId = "",
  defaultExperimentLabel,
  defaultStepLabel,
  mode = "document",
  entry,
}: {
  projects: EntryComposerProject[];
  researchPlans: EntryComposerResearchPlan[];
  protocols: EntryComposerProtocol[];
  defaultOccurredAt: string;
  defaultSource?: string;
  defaultProtocolVersionId?: string;
  defaultExperimentId?: string;
  defaultExperimentStepId?: string;
  defaultExperimentLabel?: string;
  defaultStepLabel?: string;
  mode?: "capture" | "document";
  entry?: EntryComposerInitialEntry;
}) {
  const router = useRouter();
  const saveAttempt = useRef<{signature:string;id:string} | undefined>(undefined);
  const submitting = useRef(false);
  const fileAfterSave = useRef(false);
  const [deviceCreatedAt] = useState(() => new Date().toISOString());
  const { t } = useI18n();
  const mediaInputPrefix = useId();
  const actionsHostId = `${mediaInputPrefix}-document-actions`;
  const cameraInputId = `${mediaInputPrefix}-camera`;
  const previewUrls = useRef(new Set<string>());
  const bodyEditors = useRef(new Set<Editor>());
  const registerBodyEditor = useCallback((editor: Editor) => { bodyEditors.current.add(editor); return () => { bodyEditors.current.delete(editor); }; }, []);
  const baselineFields = useMemo(
    () => initialFields(defaultOccurredAt, defaultSource, defaultProtocolVersionId, defaultExperimentId, defaultExperimentStepId, entry),
    [defaultOccurredAt, defaultProtocolVersionId, defaultSource, defaultExperimentId, defaultExperimentStepId, entry],
  );
  const baselineMedia = useMemo(() => {
    const inline = new Set(collectDocumentMedia(entry?.contentMarkdown).map(documentMediaAttachmentId));
    return entry?.attachments.filter(file => !inline.has(file.id)).map(existingMedia) ?? [];
  }, [entry]);
  const [fields, setFields] = useState<EntryComposerFields>(baselineFields);
  const [media, setMedia] = useState<ComposerMedia[]>(baselineMedia);
  const [hydrated, setHydrated] = useState(false);
  const [draftStatus, setDraftStatus] = useState("");
  const [submitStatus, setSubmitStatus] = useState("");
  const [conflict, setConflict] = useState<{title:string; contentMarkdown:string; updatedAt:string} | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const draftKey = entryDraftKey(entry?.id, baselineFields);

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadEntryDraft<EntryComposerFields>(draftKey)
      .then(async (draft) => {
        if (draft || entry || cancelled) return draft;
        const legacy = await loadEntryDraft<EntryComposerFields>("entry-composer:new");
        if (!legacy || cancelled) return undefined;
        if (!entryDraftMatchesContext(baselineFields, legacy.fields)) {
          setDraftStatus("A draft from a different Experiment or Step is retained. Open its original context to recover it.");
          return undefined;
        }
        // Move legacy drafts only after the scoped copy is durably committed.
        await saveEntryDraft(draftKey, legacy);
        await deleteEntryDraft("entry-composer:new");
        return legacy;
      })
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
        const restored = migrateEntryDraftFields(baselineFields, draft.fields);
        restored.fields.expectedUpdatedAt = recoveredDraftVersion(Boolean(entry), draft.fields.expectedUpdatedAt, baselineFields.expectedUpdatedAt);
        setFields(restored.fields);
        setMedia(restoredMedia);
        setDraftStatus(restored.migratedLegacyResult ? t("Recovered legacy initial Result fields into the rich document.") : `Recovered local draft from ${new Date(draft.savedAt).toLocaleString()}.`);
      })
      .catch(() => setDraftStatus("Local draft recovery is unavailable in this browser."))
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => { cancelled = true; };
  }, [baselineFields, baselineMedia, draftKey, entry, t]);

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
        .then(() => setDraftStatus("Draft saved locally. Unfinished inline uploads may need the file reselected after reload."))
        .catch(() => setDraftStatus("Draft could not be saved locally."));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [draftKey, fields, hydrated, isSubmitting, media]);

  const availablePlans = fields.projectId ? researchPlans.filter((plan) => plan.projectId === fields.projectId) : researchPlans;
  const selectedProject = projects.find((project) => project.id === fields.projectId);
  const selectedPlan = researchPlans.find((plan) => plan.id === fields.researchPlanId);
  const selectedProtocol = protocols.find((protocol) => protocol.id === fields.protocolVersionId);
  const captureMode = mode === "capture" && !entry;

  function updateField<K extends keyof EntryComposerFields>(key: K, value: EntryComposerFields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  /** The camera button sits outside the page, so its photo goes into the page at its end, like everything else added to an Entry. */
  function addFiles(fileList: FileList | File[]) {
    const live = [...bodyEditors.current].filter(editor => !editor.isDestroyed);
    const bodyEditor = live.find(editor => editor.view.dom.getClientRects().length > 0) ?? live[0];
    if (!bodyEditor) { setSubmitStatus("The page is still loading; try again."); return; }
    setSubmitStatus("");
    appendToPage(bodyEditor, Array.from(fileList));
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
    if (!fields.contentMarkdown.trim()) {
      setSubmitStatus(captureMode ? "Record an observation before saving." : "Title and body are required.");
      return;
    }

    const generatedTitle = fields.title.trim() || `${fields.contentMarkdown.trim().split(/\r?\n/)[0].slice(0, 72)} · ${new Date(fields.occurredAt || defaultOccurredAt).toLocaleDateString()}`;

    if (submitting.current) return;
    submitting.current = true;
    setIsSubmitting(true);
    setMedia((current) => current.map((item) => item.kind === "new" ? { ...item, status: "uploading" } : item));
    try {
      const formData = new FormData();
      Object.entries({ ...fields, title: generatedTitle }).forEach(([key, value]) => formData.set(key, value));
      const newItems = media.filter((item): item is NewMedia => item.kind === "new");
      newItems.forEach((item) => formData.append("files", item.file, item.file.name));
      formData.set("newFileIds", JSON.stringify(newItems.map((item) => item.id)));
      formData.set("mediaOrder", JSON.stringify(media.map((item) => ({ kind: item.kind, id: item.id }))));

      const signature = JSON.stringify([fields,media.map(item=>item.id)]);
      if (saveAttempt.current?.signature !== signature) saveAttempt.current = {signature,id:newId()};
      const clientMutationId = saveAttempt.current.id;
      formData.set("clientMutationId", clientMutationId);
      formData.set("deviceCreatedAt", deviceCreatedAt);
      // The version belongs to the recovered draft, not the latest page load.
      if (fields.expectedUpdatedAt) formData.set("expectedUpdatedAt",fields.expectedUpdatedAt);
      if (captureMode && !navigator.onLine) {
        await enqueueMobileMutation({
          clientMutationId,
          actionType: "entry.create",
          deviceCreatedAt: new Date().toISOString(),
          state: "pending",
          retryCount: 0,
          payload: {
            fields: Object.fromEntries(Object.entries({ ...fields, title: generatedTitle })),
            newFileIds: String(formData.get("newFileIds") ?? "[]"),
            mediaOrder: String(formData.get("mediaOrder") ?? "[]"),
            files: newItems.map((item) => ({ name: item.file.name, file: item.file })),
          },
        });
        await deleteEntryDraft(draftKey).catch(() => undefined);
        router.push("/?queued=1");
        router.refresh();
        return;
      }

      const response = await fetch(entry ? `/api/entries/${entry.id}` : "/api/entries", {
        method: entry ? "PATCH" : "POST",
        body: formData,
      });
      const result = await response.json() as { entryId?: string; error?: string };
      if (!response.ok || !result.entryId) {
        if (entry) {
          const latest = await fetch(`/api/entries/${entry.id}`, {cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null);
          if (latest?.entry?.updatedAt && latest.entry.updatedAt !== fields.expectedUpdatedAt) {
            setConflict({title:latest.entry.title,contentMarkdown:latest.entry.contentMarkdown,updatedAt:latest.entry.updatedAt});
          }
        }
        throw new Error(result.error ?? "Entry could not be saved.");
      }

      await deleteEntryDraft(draftKey).catch(() => undefined);
      router.push(`/entries/${result.entryId}${fileAfterSave.current ? "?assign=1" : ""}`);
      router.refresh();
    } catch (error) {
      setMedia((current) => current.map((item) => item.kind === "new" ? { ...item, status: "error" } : item));
      setSubmitStatus(`${error instanceof Error ? error.message : "Entry could not be saved."} Your draft and selected files are still available; choose Try again.`);
      setIsSubmitting(false);
      submitting.current = false;
    }
  }

  return (
    <form inert={isSubmitting} aria-busy={isSubmitting} onSubmit={submit} className="space-y-5">
      <input id={cameraInputId} className="sr-only" disabled={isSubmitting} type="file" accept="image/*" capture="environment" onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} />
      {captureMode ? (
        <section className="space-y-5 lg:hidden">
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.02em] text-ink">Quick capture</h1>
            <p className="mt-1 text-sm leading-6 text-muted">Record what happened now. You can organize the document later.</p>
          </div>

          <div className="overflow-hidden rounded-[var(--ln-radius-panel)] border border-hairline bg-surface">
            <div className="space-y-4 p-4">
              <input
                value={fields.title}
                onChange={(event) => updateField("title", event.target.value)}
                className="focus-ring h-12 w-full rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm px-3 text-base font-semibold text-ink placeholder:text-muted"
                placeholder="Title is generated automatically · optional"
                aria-label="Entry title"
              />
              <MarkdownRichTextEditor
                registerEditor={registerBodyEditor}
                value={fields.contentMarkdown}
                onChange={(value) => updateField("contentMarkdown", value)}
                placeholder="What did you observe?"
              />
            </div>

            <div className="flex flex-col gap-1 border-t border-hairline p-3">
              <MediaPickerLabel htmlFor={cameraInputId} disabled={isSubmitting} spacious><Camera className="h-5 w-5" />Take photo</MediaPickerLabel>
              <span className="text-center text-xs text-muted">Added at the end of the page</span>
            </div>
            {media.length ? (
              <ul className="divide-y divide-hairline border-t border-hairline">
                {media.map((item) => <li key={`capture-${item.id}`} className="flex min-h-12 items-center gap-3 px-4 py-2 text-sm">
                  <File className="h-4 w-4 shrink-0 text-moss" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-graphite">{item.originalFilename}</span>
                  <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${item.originalFilename}`} onClick={() => removeMedia(item.id)}><X className="h-4 w-4" /></Button>
                </li>)}
              </ul>
            ) : null}
          </div>

          <details className="group rounded-[var(--ln-radius-panel)] border border-hairline bg-surface">
            <summary className="focus-ring flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-sm font-semibold text-moss [&::-webkit-details-marker]:hidden">
              Add research context
              <ChevronRight className="h-4 w-4 transition-transform duration-200 group-open:rotate-90 motion-reduce:transition-none" aria-hidden />
            </summary>
            <div className="grid gap-4 border-t border-hairline p-4">
              {defaultExperimentLabel ? <div className="rounded-[var(--ln-radius-control-lg)] bg-action-surface px-3 py-2"><p className="text-xs font-semibold text-ink">{defaultExperimentLabel}</p>{defaultStepLabel ? <p className="mt-1 text-xs text-muted">Current step · {defaultStepLabel}</p> : null}<p className="mt-1 text-xs text-muted">This capture will retain the Experiment and Step association.</p></div> : null}
              <ComposerSelect label="Project" value={fields.projectId} onChange={(value) => updateField("projectId", value)} options={[{ value: "", label: "No project" }, ...projects.map((project) => ({ value: project.id, label: project.name }))]} />
              <ComposerSelect label="Research plan" value={fields.researchPlanId} onChange={(value) => {
                updateField("researchPlanId", value);
                const plan = researchPlans.find((candidate) => candidate.id === value);
                if (plan) updateField("projectId", plan.projectId);
              }} options={[{ value: "", label: "Unassigned" }, ...availablePlans.map((plan) => ({ value: plan.id, label: `${plan.projectName} · ${plan.code ?? plan.title}` }))]} />
            </div>
          </details>

          <p className="flex items-center gap-2 text-xs leading-5 text-muted"><Cloud className="h-4 w-4 shrink-0 text-moss" aria-hidden />{draftStatus || "This capture will be kept as a recoverable local draft."}</p>
        </section>
      ) : null}

      <div className={captureMode ? "hidden lg:block" : undefined}>
      <DocumentEditorLayout className="entry-editor-layout">
      <div className="entry-editor-main-column">
      <StandaloneDocumentEditorViewport
        label={fields.title || "Entry editor"}
        outline={entryDocumentOutline}
        className="entry-editor-document"
        toolbar={
          <>
            <div id={actionsHostId} className="ln-document-actions-host" />
            <DocumentPrintButton />
          </>
        }
      >
        <header id="entry-document-overview" className="document-page-header">
          <input
            required={!captureMode}
            value={fields.title}
            onChange={(event) => updateField("title", event.target.value)}
            className="document-page-title focus-ring w-full border-0 bg-transparent p-0 font-serif font-medium leading-tight text-ink outline-none placeholder:text-muted"
            placeholder="Untitled Entry"
            aria-label="Entry title"
          />
          <dl className="document-page-facts">
            <div><dt>Experiment / observation time (optional)</dt><dd><input type={fields.eventTimePrecision === "date" ? "date" : "datetime-local"} value={fields.occurredAt} onChange={(event) => { updateField("occurredAt", event.target.value); updateField("eventTimePrecision", editedEventPrecision(fields.eventTimePrecision, event.target.value)); }} className="focus-ring w-full rounded-[4px] border border-transparent bg-transparent p-0 text-graphite hover:border-hairline" /></dd></div>
            <div><dt>Project</dt><dd>{selectedProject?.name ?? "Unassigned"}</dd></div>
            <div><dt>Research Plan</dt><dd>{selectedPlan ? selectedPlan.code ?? selectedPlan.title : "Unassigned"}</dd></div>
            <div><dt>Source</dt><dd>{fields.sourceType.replaceAll("_", " ")}</dd></div>
            <div><dt>Record</dt><dd>{fields.recordStatus.replaceAll("_", " ")}</dd></div>
            {selectedProtocol ? <div><dt>Protocol</dt><dd>{selectedProtocol.label}</dd></div> : null}
          </dl>
        </header>
        <div id="entry-document-content">
          <MarkdownRichTextEditor
            registerEditor={registerBodyEditor}
            value={fields.contentMarkdown}
            onChange={(value) => updateField("contentMarkdown", value)}
            placeholder="Observation, decision, deviation, or follow-up…"
            minHeightClass="min-h-[var(--ln-entry-editor-body-min-height)]"
            actionsHostId={actionsHostId}
          />
        </div>
      </StandaloneDocumentEditorViewport>

      {/* On a touch screen a photo goes straight into the page; elsewhere "/", paste and drop do that inside it. */}
      <div className="entry-camera" data-print-hidden>
        <MediaPickerLabel htmlFor={cameraInputId} disabled={isSubmitting} spacious><Camera className="h-5 w-5" />Take photo</MediaPickerLabel>
        <span className="text-xs text-muted">Added at the end of the page</span>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-muted" data-print-hidden>
        <span className="flex min-w-0 items-center gap-1.5"><Cloud className="h-3.5 w-3.5 shrink-0" aria-hidden /><span>{draftStatus || "Draft recovery is ready"}</span></span>
        <Button type="button" size="sm" variant="ghost" onClick={discardDraft} disabled={isSubmitting}><RotateCcw className="h-3.5 w-3.5" aria-hidden />Discard draft</Button>
      </div>

      {media.length ? (
        <section className="entry-editor-media rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-4" aria-labelledby={`${mediaInputPrefix}-attachments`}>
          <h2 id={`${mediaInputPrefix}-attachments`} className="text-[14px] font-semibold tracking-[-0.01em] text-ink">Attachments</h2>
          <p className="mt-0.5 text-xs text-muted">Files kept beside the page. New pictures and files go into the page: type / there, paste, or drop them on it.</p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {media.map((item) => (
              <li key={item.id} className={cn("overflow-hidden rounded-[var(--ln-radius-panel)] border bg-warm", item.kind === "new" && item.status === "error" ? "border-error/50" : "border-hairline")}>
                <div className="relative flex h-36 items-center justify-center overflow-hidden bg-stone">
                  {item.previewUrl ? (
                    <Image src={item.previewUrl} alt={item.originalFilename} fill unoptimized className="object-cover" />
                  ) : (
                    <File className="h-10 w-10 text-muted" aria-hidden />
                  )}
                  {item.kind === "new" ? (
                    <span className={cn("absolute bottom-2 right-2 rounded-full px-2 py-1 text-xs font-semibold", item.status === "error" ? "bg-error text-white" : item.status === "uploading" ? "bg-info text-white" : "bg-surface/90 text-moss")}>{item.status}</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink" title={item.originalFilename}>{item.originalFilename}</p>
                    <p className="mt-1 text-xs text-muted">{formatBytes(item.size)}</p>
                  </div>
                  {item.kind === "existing" ? (
                    <a href={`/api/attachments/${item.id}`} download={item.originalFilename} title="Download" aria-label={`Download ${item.originalFilename}`} className="focus-ring inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ln-radius-control-lg)] text-moss transition hover:bg-stone/70"><Download className="h-4 w-4" aria-hidden /></a>
                  ) : null}
                  <Button type="button" size="icon" variant="destructive" disabled={isSubmitting} title="Remove from Entry" aria-label={`Remove ${item.originalFilename}`} onClick={() => removeMedia(item.id)}><X className="h-4 w-4" /></Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      </div>

      <div className="entry-editor-sidebar-column" role="region" data-document-metadata="true" aria-label={t("Entry metadata")}>
      <section className="entry-editor-context">
        <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-ink">{t("Entry metadata")}</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-2">
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
        </div>
      </section>
      <Disclosure title={t("Type, source and status")} summary={`${entryTypeLabels[fields.entryType as keyof typeof entryTypeLabels] ?? fields.entryType} · ${fields.recordStatus}`}>
        <div className="grid gap-3 md:grid-cols-2">
          <ComposerSelect label="Entry type" value={fields.entryType} onChange={(value) => updateField("entryType", value)} options={entryTypes.map(value=>({value,label:entryTypeLabels[value]}))} />
          <ComposerSelect label="Source" value={fields.sourceType} onChange={(value) => updateField("sourceType", value)} options={["text", "photo", "file", "voice", "manual"].map((value) => ({ value, label: value }))} />
          <ComposerInput label="State" value={fields.moodStatus} onChange={(value) => updateField("moodStatus", value)} placeholder="needs follow-up" />
          <StatusRadioGroup label="Record status" value={fields.recordStatus} onValueChange={(value) => updateField("recordStatus", value)} options={recordStatusOptions} density="compact" className="md:col-span-2 " />
        </div>
        <div>
          <label className="block">
            <TagFieldLabel />
            <input value={fields.tags} onChange={(event) => updateField("tags", event.target.value)} placeholder="transfection, observation" className={formInputClass} />
          </label>
        </div>
      </Disclosure>

      {!entry && !fields.experimentId ? (
        <Disclosure title={t("Protocol-based experiment")} summary={t("Optional")} className="entry-editor-experiment">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2"><ComposerSelect label="Protocol version" value={fields.protocolVersionId} onChange={(value) => setFields((current) => value ? { ...current, protocolVersionId: value } : { ...current, protocolVersionId: "", createInitialResult: "false", resultTitle: "", resultType: "" })} options={[{ value: "", label: "Standalone entry" }, ...protocols.map((protocol) => ({ value: protocol.id, label: protocol.label }))]} /></div>
            <ComposerInput label="Experiment title" value={fields.experimentTitle} onChange={(value) => updateField("experimentTitle", value)} placeholder="Defaults to Entry title" />
            <StatusRadioGroup label="Experiment status" value={fields.experimentStatus} onValueChange={(value) => updateField("experimentStatus", value)} options={experimentStatusOptions} density="compact" className="md:col-span-2" />
            <label className="md:col-span-2 flex items-start gap-2 border-t border-hairline pt-3 text-xs text-graphite"><input type="checkbox" disabled={!fields.protocolVersionId} checked={fields.createInitialResult === "true"} onChange={(event) => setFields((current) => event.target.checked ? { ...current, createInitialResult: "true" } : { ...current, createInitialResult: "false", resultTitle: "", resultType: "" })} className="mt-0.5 h-3.5 w-3.5 accent-moss disabled:cursor-not-allowed disabled:opacity-45" /><span><strong className="font-medium text-ink">{t("Create an initial Result from this Entry")}</strong><span className="mt-0.5 block leading-5 text-muted">{t(fields.protocolVersionId ? "The rich Entry content becomes the Result summary; tables, media, and datasets remain editable in the Result document." : "Choose a Protocol version first; a Result must belong to an Experiment.")}</span></span></label>
            {fields.createInitialResult === "true" ? <><ComposerInput label="Result title" value={fields.resultTitle} onChange={(value) => updateField("resultTitle", value)} placeholder="Defaults to Experiment title" /><ComposerInput label="Result type" value={fields.resultType} onChange={(value) => updateField("resultType", value)} placeholder="manual_result" /></> : null}
          </div>
        </Disclosure>
      ) : null}
      </div>
      </DocumentEditorLayout>
      </div>

      {conflict ? <section aria-label="Compare the conflicting texts" className="space-y-3 rounded-xl border border-warning p-4">
        <h2 className="font-semibold">Another window saved a newer version; neither was overwritten</h2>
        <p className="text-sm">{`This draft is based on ${fields.expectedUpdatedAt}; the server version is ${conflict.updatedAt}. Copy the paragraphs you want to keep, then open the server record to compare. Nothing is retried here with the new version number.`}</p>
        <div className="grid gap-3 md:grid-cols-2">
          <label>This draft<textarea readOnly aria-label="This draft, for comparison" value={fields.contentMarkdown} className="mt-2 h-64 w-full rounded-lg border border-hairline bg-surface p-3 text-sm" /></label>
          <label>Server text<textarea readOnly aria-label="Server text, for comparison" value={conflict.contentMarkdown} className="mt-2 h-64 w-full rounded-lg border border-hairline bg-surface p-3 text-sm" /></label>
        </div>
        <p className="text-sm">{`This title: ${fields.title} · Server title: ${conflict.title}. Files added here stay in the editor; check them too.`}</p>
        <a className="inline-flex min-h-11 items-center text-moss underline" href={`/entries/${entry?.id}`} target="_blank" rel="noreferrer">Open the server record</a>
      </section> : null}
      {submitStatus ? <div role="alert" className="rounded-[var(--ln-radius-panel)] border border-error/35 bg-error-surface px-4 py-3 text-sm leading-6 text-error">{submitStatus}</div> : null}
      <div className="entry-editor-save-bar pointer-events-none sticky bottom-3 z-30 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end [&>button]:pointer-events-auto">
        {submitStatus && !isSubmitting ? <Button type="submit" size="lg"><RotateCcw className="h-4 w-4" />Try again</Button> : null}
        <Button type="submit" size="lg" variant="secondary" disabled={isSubmitting} onClick={() => { fileAfterSave.current = true; }}>Save and file…</Button>
        <Button type="submit" size="lg" variant="primary" disabled={isSubmitting}>
          <Save className="h-4 w-4" />
          {isSubmitting ? "Saving originals…" : entry ? "Save changes" : "Save Entry"}
        </Button>
      </div>
    </form>
  );
}

function ComposerInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="block"><span className="text-xs font-medium text-muted">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="focus-ring mt-1 h-8 w-full rounded-[var(--ln-radius-control-md)] border border-hairline bg-warm px-2 text-xs text-ink" /></label>;
}

function ComposerSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <label className="block"><span className="text-xs font-medium text-muted">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="focus-ring mt-1 h-8 w-full rounded-[var(--ln-radius-control-md)] border border-hairline bg-warm px-2 text-xs text-ink">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function MediaPickerLabel({ htmlFor, disabled, spacious = false, children }: { htmlFor: string; disabled?: boolean; spacious?: boolean; children: React.ReactNode }) {
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
        "focus-ring inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--ln-radius-control-md)] border border-hairline bg-surface px-2.5 text-xs font-medium tracking-[-0.005em] text-graphite transition hover:border-border-strong hover:bg-warm hover:text-ink",
        spacious ? "h-12" : "h-8",
        disabled && "pointer-events-none cursor-not-allowed opacity-55",
      )}
    >
      {children}
    </label>
  );
}
