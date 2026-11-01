"use client";

import { useId, useMemo, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Download, FileCheck2, FileSearch, FileUp, LoaderCircle, Pencil, Plus, Sparkles, Trash2, Undo2 } from "lucide-react";
import { suggestImportColumns } from "@/app/inventory/import/actions";
import { Button } from "@/components/ui/Button";
import { ProtocolImportDecisionNotice } from "@/components/ProtocolImportDecisionNotice";
import { useI18n } from "@/components/I18nProvider";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { formInputClass, formLabelClass, formTextareaClass } from "@/components/forms";
import { cn } from "@/lib/cn";
import type { StructuredImportPreview } from "@/lib/structured-import";
import {
  editableImportFields,
  importFieldChoices,
  isDocumentSection,
  isTechnicalImportField,
  noImportEdits,
  tableImportFormats,
  type ImportRowEdits,
  type ImportRowOrigin,
} from "@/lib/structured-import-edits";
import { formatFromFilename, formatLabel, structuredModules, type StructuredFieldDefinition, type StructuredModuleKey } from "@/lib/structured-modules";
import { bilingual } from "@/lib/structured-template";

const acceptByFormat = {
  csv: ".csv,text/csv",
  tsv: ".tsv,text/tab-separated-values",
  xlsx: ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  json: ".json,application/json",
  md: ".md,text/markdown,text/plain",
  docx: ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const structuredTemplateVersion = "7";
const maxStructuredImportBytes = 25 * 1024 * 1024;

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type PreviewField = { label: string; value: string; key?: string };

const narrativePreviewKeys = new Set([
  "acceptanceCriteria",
  "analysis",
  "background",
  "conclusion",
  "constraints",
  "consumptionRules",
  "description",
  "design",
  "executiveSummary",
  "hypothesis",
  "interpretation",
  "limitationsNextSteps",
  "material",
  "materialMethods",
  "materials",
  "methods",
  "notes",
  "observations",
  "objective",
  "purpose",
  "qualityLimitations",
  "rationale",
  "references",
  "researchQuestion",
  "resultSummary",
  "resultTemplates",
  "results",
  "steps",
  "summary",
]);

const identityPreviewLabels = [
  "Protocol code",
  "Plan code",
  "Run code",
  "Project name",
  "Item name",
  "Title",
  "Protocol title",
  "English title",
  "Version",
];

function isTechnicalPreviewField(field: PreviewField) {
  return isTechnicalImportField(field.key ?? field.label);
}

function groupPreviewFields(module: StructuredModuleKey, values: Record<string, string>) {
  const fieldsByLabel = new Map(structuredModules[module].fields.map((field) => [field.label, field]));
  const entries = Object.entries(values).map(([label, value]) => {
    const field = fieldsByLabel.get(label);
    // A stored code reads as the name the app shows for it, as in the template.
    return { label, value: field?.optionLabels?.[value] ?? value, key: field?.key };
  });
  const technical = entries.filter(isTechnicalPreviewField);
  const narrative = entries.filter((field) => !isTechnicalPreviewField(field) && (narrativePreviewKeys.has(field.key ?? "") || field.value.length > 180 || field.value.includes("\n")));
  // Protocol source/final states are explicitly distinguished in the decision notice.
  const core = entries.filter((field) => !technical.includes(field) && !narrative.includes(field) && !(module === "protocols" && ["availability", "reviewStage"].includes(field.key ?? "")));
  return { core, narrative, technical };
}

function recordPreviewTitle(module: StructuredModuleKey, values: Record<string, string>, origin: ImportRowOrigin) {
  const fields = groupPreviewFields(module, values);
  const candidates = identityPreviewLabels
    .map((label) => fields.core.find((field) => field.label === label)?.value)
    .filter(Boolean);
  if (candidates.length) return candidates.slice(0, 2).join(" · ");
  return originLabel(origin);
}

function originLabel(origin: ImportRowOrigin) {
  return "added" in origin ? `New record ${origin.added}` : `Record ${origin.row}`;
}

function originKey(origin: ImportRowOrigin) {
  return "added" in origin ? `added-${origin.added}` : `row-${origin.row}`;
}

/** The record whose edit form is open: a file row, a row added in the preview, or a new one. */
type EditTarget = { kind: "row"; row: number } | { kind: "added"; at: number } | { kind: "new" };

function targetOf(origin: ImportRowOrigin): EditTarget {
  return "added" in origin ? { kind: "added", at: origin.added } : { kind: "row", row: origin.row };
}

function sameTarget(a: EditTarget | null, b: EditTarget) {
  return Boolean(a) && JSON.stringify(a) === JSON.stringify(b);
}

/**
 * `columnHelper`: the AI service that can suggest fields for columns the import did not recognise (inventory only);
 * `reason` says why it cannot when it is not ready.
 */
export function StructuredImportWorkspace({ module, columnHelper }: { module: StructuredModuleKey; columnHelper?: { ready: boolean; reason?: string } }) {
  const definition = structuredModules[module];
  const router = useRouter();
  const { locale } = useI18n();
  const fileInput = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const latestRequest = useRef(0);
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<StructuredImportPreview>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState<"preview" | "check" | "confirm">();
  const [dragActive, setDragActive] = useState(false);
  const [columnOverrides, setColumnOverrides] = useState<Record<string, string>>({});
  const [suggestion, setSuggestion] = useState<{ busy: boolean; note?: string }>({ busy: false });
  // Changes made in the preview (Q216–Q219). Nothing is written until the import is confirmed.
  const [edits, setEdits] = useState<ImportRowEdits>(noImportEdits);
  const [removedTitles, setRemovedTitles] = useState<Record<number, string>>({});
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const accept = useMemo(() => definition.importFormats.map((format) => acceptByFormat[format]).join(","), [definition.importFormats]);
  const controlledFields = definition.fields.filter((field) => field.allowedValues?.length);

  function chooseFile(nextFile?: File, source: "picker" | "drop" = "picker") {
    setPreview(undefined);
    setColumnOverrides({});
    setEdits(noImportEdits);
    setRemovedTitles({});
    setEditing(null);
    setError(undefined);
    setSuggestion({ busy: false });

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

  function requestData(overrides: Record<string, string>, nextEdits: ImportRowEdits) {
    const formData = new FormData();
    formData.set("file", file!);
    formData.set("mapping", JSON.stringify(overrides));
    formData.set("edits", JSON.stringify(nextEdits));
    return formData;
  }

  /**
   * Checks the file with the column choices and edits laid over it. A first preview starts empty; a check after a change
   * keeps the last preview on screen until the new one arrives, and only the latest request counts.
   */
  async function requestPreview({ overrides = columnOverrides, nextEdits = edits, fresh = false }: { overrides?: Record<string, string>; nextEdits?: ImportRowEdits; fresh?: boolean } = {}) {
    if (!file) { setError("Choose an import file first."); return; }
    const request = ++latestRequest.current;
    setPending(fresh ? "preview" : "check"); setError(undefined);
    if (fresh) setPreview(undefined);
    try {
      const response = await fetch(`/api/structured-import/${module}/preview`, { method: "POST", body: requestData(overrides, nextEdits) });
      const payload = await response.json() as { error?: string; preview?: StructuredImportPreview };
      if (request !== latestRequest.current) return;
      if (!response.ok || !payload.preview) throw new Error(payload.error ?? "The file could not be previewed.");
      setPreview(payload.preview);
    } catch (caught) {
      if (request !== latestRequest.current) return;
      setError(caught instanceof Error ? caught.message : "The file could not be previewed.");
      // The last preview stays to work from, but it no longer stands for what would be imported.
      setPreview((current) => current && { ...current, canImport: false, confirmationToken: undefined });
    } finally {
      if (request === latestRequest.current) setPending(undefined);
    }
  }

  function changeEdits(next: ImportRowEdits) {
    setEdits(next);
    setEditing(null);
    void requestPreview({ nextEdits: next });
  }

  function remapColumn(source: string, target: string) {
    const next = { ...columnOverrides, [source]: target };
    setColumnOverrides(next);
    void requestPreview({ overrides: next });
  }

  const editActions: EditActions = {
    open: setEditing,
    save(target, values, initial) {
      if (target.kind === "row") {
        const changed = { ...edits.changed[target.row] };
        for (const [key, value] of Object.entries(values)) if (value !== (initial[key] ?? "")) changed[key] = value;
        if (JSON.stringify(changed) === JSON.stringify(edits.changed[target.row] ?? {})) { setEditing(null); return; }
        changeEdits({ ...edits, changed: { ...edits.changed, [target.row]: changed } });
        return;
      }
      const filled = Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim()));
      if (target.kind === "added") changeEdits({ ...edits, added: edits.added.map((entry, index) => index === target.at - 1 ? filled : entry) });
      else changeEdits({ ...edits, added: [...edits.added, filled] });
    },
    remove(origin, title) {
      if ("added" in origin) { changeEdits({ ...edits, added: edits.added.filter((_, index) => index !== origin.added - 1) }); return; }
      setRemovedTitles((current) => ({ ...current, [origin.row]: title }));
      changeEdits({ ...edits, removed: [...edits.removed, origin.row] });
    },
    restore(row) { changeEdits({ ...edits, removed: edits.removed.filter((removed) => removed !== row) }); },
    revert(row) {
      const changed = { ...edits.changed };
      delete changed[row];
      changeEdits({ ...edits, changed });
    },
  };

  // The model only fills the column choices; the preview that follows checks the rows as for any other choice.
  async function suggestColumns() {
    if (!file) return;
    setSuggestion({ busy: true });
    const formData = new FormData(); formData.set("file", file); formData.set("mapping", JSON.stringify(columnOverrides));
    const result = await suggestImportColumns(formData);
    if (result.error) { setSuggestion({ busy: false, note: result.error }); return; }
    const suggested = Object.keys(result.overrides ?? {}).length;
    const next = { ...columnOverrides, ...result.overrides };
    setColumnOverrides(next);
    setSuggestion({ busy: false, note: suggested ? `AI matched ${suggested} more column${suggested === 1 ? "" : "s"}; check them under Column headers.` : "AI found no field for the remaining columns." });
    await requestPreview({ overrides: next });
  }

  async function confirmImport() {
    if (!file || !preview || !preview.canImport || editing) return;
    setPending("confirm"); setError(undefined);
    const formData = requestData(columnOverrides, edits);
    formData.set("checksum", preview.checksum);
    formData.set("confirmationToken", preview.confirmationToken ?? "");
    try {
      const response = await fetch(`/api/structured-import/${module}/confirm`, { method: "POST", body: formData });
      const payload = await response.json() as { error?: string; errorCode?: string; preview?: StructuredImportPreview; result?: { href: string } };
      if (payload.errorCode === "IMPORT_CONFIRMATION_CHANGED") throw new Error(locale === "zh" ? "文件、文件名或导入规则已变化，或预览已过期。请重新预览后再导入。" : payload.error);
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
        <CardHeader title={module === "protocols" ? "其他导入格式与模板（上传时自动识别格式）" : "Choose a structured format"} />
        <CardBody className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {definition.importFormats.map((format) => {
            const showCompactGuidance = (format === "csv" || format === "tsv") && controlledFields.length > 0;
            return (
              <div key={format} className="flex items-start justify-between gap-3 rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm px-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{formatLabel(format)}</p>
                  <p className="mt-1 text-xs text-muted">Structured {definition.singular} input</p>
                  {showCompactGuidance ? controlledFields.map((field) => (
                    <p key={field.key} className="mt-1 truncate text-xs text-muted">
                      <span>{field.label}</span>: {(field.optionLabels ? Object.values(field.optionLabels) : field.allowedValues ?? []).map((choice, index) => <span key={choice}>{index ? " · " : ""}<span>{choice}</span></span>)}
                    </p>
                  )) : null}
                </div>
                <a download href={`/api/structured-import/${module}/template?format=${format}&v=${structuredTemplateVersion}`} className="focus-ring inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[var(--ln-radius-control-sm)] border border-hairline bg-surface px-2 text-xs font-medium text-moss hover:bg-sage-surface">
                  <Download className="h-3.5 w-3.5" aria-hidden />Template
                </a>
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
              "rounded-[var(--ln-radius-panel-inner)] border border-dashed p-5 text-center transition-colors",
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
            <p className="mt-3 text-xs text-muted">Accepted: {definition.importFormats.map(formatLabel).join(" · ")} · Maximum 25 MB and 500 records</p>
            {file ? (
              <div className="mx-auto mt-4 flex max-w-xl items-center justify-center gap-2 rounded-[var(--ln-radius-control-md)] border border-moss/25 bg-sage-surface px-3 py-2 text-left" aria-live="polite">
                <FileCheck2 className="h-4 w-4 shrink-0 text-moss" aria-hidden />
                <span className="min-w-0 truncate text-xs font-medium text-ink">{file.name}</span>
                <span className="shrink-0 text-xs text-muted">{formatFileSize(file.size)}</span>
              </div>
            ) : null}
            <p className="mt-3 text-xs leading-5 text-muted">LabNest revalidates the original file at confirmation and keeps it with a SHA-256 checksum.</p>
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={() => requestPreview({ fresh: true })} disabled={!file || Boolean(pending)}>
              {pending === "preview" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <FileSearch className="h-4 w-4" aria-hidden />}
              Preview import
            </Button>
          </div>
          {error ? <p role="alert" className="rounded-[var(--ln-radius-control-lg)] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error">{error}</p> : null}
        </CardBody>
      </Card>

      {columnHelper && preview && preview.mapping.some((mapping) => !mapping.target) ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--ln-radius-panel)] border border-hairline bg-surface px-4 py-3 text-sm">
          <Button type="button" size="sm" variant={columnHelper.ready ? "ai" : "ai-off"} disabled={!columnHelper.ready || suggestion.busy || Boolean(pending)} onClick={suggestColumns}>
            {suggestion.busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}Suggest columns with AI
          </Button>
          <span className="text-graphite">{suggestion.note ?? (columnHelper.ready ? "Only the unrecognised column headers and their first five values are sent." : columnHelper.reason)}</span>
        </div>
      ) : null}
      {preview ? (
        <PreviewPanel
          preview={preview}
          edits={edits}
          editing={editing}
          removedTitles={removedTitles}
          checking={pending === "check"}
          pending={pending === "confirm"}
          columnOverrides={columnOverrides}
          actions={editActions}
          onConfirm={confirmImport}
          onRemap={tableImportFormats.includes(preview.format) ? remapColumn : undefined}
        />
      ) : null}
    </div>
  );
}

type PreviewRow = StructuredImportPreview["rows"][number];

type EditActions = {
  open: (target: EditTarget | null) => void;
  /** `initial` is what the form started from, so only the values a person changed count as edits. */
  save: (target: EditTarget, values: Record<string, string>, initial: Record<string, string>) => void;
  remove: (origin: ImportRowOrigin, title: string) => void;
  /** A file row left out of the import comes back. */
  restore: (row: number) => void;
  /** A file row's values go back to the file's. */
  revert: (row: number) => void;
};

function PreviewPanel({ preview, edits, editing, removedTitles, checking, pending, columnOverrides, actions, onConfirm, onRemap }: {
  preview: StructuredImportPreview;
  edits: ImportRowEdits;
  editing: EditTarget | null;
  removedTitles: Record<number, string>;
  checking: boolean;
  pending: boolean;
  columnOverrides: Record<string, string>;
  actions: EditActions;
  onConfirm: () => void;
  onRemap?: (source: string, target: string) => void;
}) {
  const mappedCount = preview.mapping.filter((mapping) => mapping.target).length;
  const ignoredCount = preview.mapping.length - mappedCount;
  const readyCount = preview.rows.filter((row) => !row.errors.length).length;
  const rowErrorCount = preview.rows.reduce((sum, row) => sum + row.errors.length, 0);
  const rowWarningCount = preview.rows.reduce((sum, row) => sum + row.warnings.length + (row.protocolDecision?.issues.length ?? 0), 0) + preview.warnings.length;
  const columns = new Set(preview.mapping.flatMap((mapping) => mapping.target ? [mapping.target] : []));
  const canAdd = tableImportFormats.includes(preview.format);
  // Left-out file rows stay in their place as one line each, so they can be brought back before importing; added rows
  // follow the file's. A failed check leaves the last preview, so rows the edits no longer hold are skipped.
  const fileItems = [
    ...preview.rows.flatMap((row) => "row" in row.origin && !edits.removed.includes(row.origin.row) ? [{ at: row.origin.row, row }] : []),
    ...edits.removed.map((removed) => ({ at: removed, row: undefined })),
  ].sort((a, b) => a.at - b.at);
  const addedRows = preview.rows.filter((row) => "added" in row.origin && row.origin.added <= edits.added.length);
  const record = (row: PreviewRow) => (
    <PreviewRecord
      key={originKey(row.origin)}
      module={preview.module}
      row={row}
      choices={preview.choices}
      columns={columns}
      editing={sameTarget(editing, targetOf(row.origin))}
      locked={Boolean(editing) || checking || pending}
      actions={actions}
    />
  );

  return (
    <Card>
      <CardHeader title={`Import preview · ${preview.rows.length} record${preview.rows.length === 1 ? "" : "s"}`} />
      <CardBody className="space-y-4">
        <div className="grid gap-2 md:grid-cols-4">
          <PreviewMetric label="Import status" value={preview.canImport ? "Ready" : "Needs correction"} tone={preview.canImport ? "success" : "error"} />
          <PreviewMetric label="Records ready" value={`${readyCount}/${preview.rows.length}`} />
          <PreviewMetric label="Columns recognised" value={`${mappedCount}/${preview.mapping.length}`} />
          <PreviewMetric label="Warnings / errors" value={`${rowWarningCount}/${rowErrorCount}`} tone={rowErrorCount ? "error" : rowWarningCount ? "warning" : "neutral"} />
        </div>

        {[...preview.errors, ...preview.warnings].map((message) => <p key={message} className="flex items-start gap-2 rounded-[var(--ln-radius-control-lg)] border border-warning/30 bg-warning-surface px-3 py-2 text-sm text-warning"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{message}</p>)}

        {preview.mapping.length ? (
          <details className="rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-warm/50">
            <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-3 rounded-[var(--ln-radius-panel-inner)] px-3 py-2 text-sm font-medium text-ink">
              <span>Column headers</span>
              <span className="text-xs font-normal text-muted">{`${mappedCount} recognised · ${ignoredCount} not imported`}</span>
            </summary>
            <div className="grid gap-2 border-t border-hairline p-3 md:grid-cols-2 xl:grid-cols-3">
              {preview.mapping.map((mapping) => (
                <div key={mapping.source} className="grid gap-1 rounded-[var(--ln-radius-control-md)] border border-hairline bg-surface px-3 py-2 text-xs">
                  <span className="text-xs text-muted">Column in the file</span>
                  <span className="truncate font-mono text-graphite" title={mapping.source}>{mapping.source}</span>
                  {onRemap ? (
                    <select aria-label={`Import column “${mapping.source}” as`} value={columnOverrides[mapping.source] ?? mapping.target ?? ""} disabled={checking || pending} className={cn(formInputClass, "mt-0 max-sm:h-11")} onChange={(event) => onRemap(mapping.source, event.target.value)}>
                      <option value="">Not imported</option>
                      {structuredModules[preview.module].fields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
                    </select>
                  ) : <span className={mapping.target ? "text-moss" : "text-warning"}>→ {mapping.targetLabel ?? "Not imported"}</span>}
                </div>
              ))}
            </div>
          </details>
        ) : null}

        <div className="space-y-3" aria-busy={checking}>
          {fileItems.map(({ at, row }) => row ? record(row) : (
            <div key={`removed-${at}`} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--ln-radius-panel-inner)] border border-dashed border-hairline px-3 py-2 text-sm text-muted">
              <span className="min-w-0 break-words"><span>{`Record ${at}`}</span>{removedTitles[at] ? <> · <span className="text-graphite">{removedTitles[at]}</span></> : null} · <span>Not imported</span></span>
              <Button type="button" size="sm" variant="ghost" disabled={Boolean(editing) || checking || pending} onClick={() => actions.restore(at)}><Undo2 className="h-3.5 w-3.5" aria-hidden />Restore</Button>
            </div>
          ))}
          {addedRows.map(record)}
          {editing?.kind === "new" ? (
            <section className="rounded-[var(--ln-radius-panel-inner)] border border-moss/30 bg-surface p-3">
              <h3 className="mb-3 text-sm font-semibold text-ink">{`New record ${edits.added.length + 1}`}</h3>
              <RecordForm module={preview.module} initial={{}} errors={[]} choices={preview.choices} columns={columns} onDone={(values) => actions.save({ kind: "new" }, values, {})} onCancel={() => actions.open(null)} />
            </section>
          ) : canAdd ? (
            <Button type="button" variant="ghost" disabled={Boolean(editing) || checking || pending} onClick={() => actions.open({ kind: "new" })}>
              <Plus className="h-4 w-4" aria-hidden />Add a record
            </Button>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 border-t border-hairline pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-muted">
            {editing ? "Finish or cancel the open record first." : checking ? "Checking the changes…" : "Nothing is saved until you import. The file is kept as the source, and each record notes what was changed here."}
          </p>
          <Button type="button" variant="primary" onClick={onConfirm} disabled={!preview.canImport || pending || checking || Boolean(editing)}>
            {pending || checking ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <FileUp className="h-4 w-4" aria-hidden />}
            {`Import ${preview.rows.length} record${preview.rows.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function PreviewMetric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "success" | "warning" | "error" }) {
  const toneClass = tone === "success" ? "text-moss" : tone === "warning" ? "text-warning" : tone === "error" ? "text-error" : "text-ink";
  return (
    <div className="rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-surface px-3 py-2">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function PreviewRecord({ module, row, choices, columns, editing, locked, actions }: {
  module: StructuredModuleKey;
  row: PreviewRow;
  choices?: Record<string, string[]>;
  columns: Set<string>;
  editing: boolean;
  locked: boolean;
  actions: EditActions;
}) {
  const grouped = groupPreviewFields(module, row.values);
  const title = recordPreviewTitle(module, row.values, row.origin);
  const fileRow = "row" in row.origin ? row.origin : undefined;
  const changed = new Set(fileRow?.changed);
  const isChanged = (field: PreviewField) => Boolean(field.key && changed.has(field.key));
  return (
    <section className={cn("rounded-[var(--ln-radius-panel-inner)] border", editing ? "border-moss/40 bg-surface" : row.errors.length ? "border-error/30 bg-error-surface/40" : "border-hairline bg-surface")}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-3 py-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">{originLabel(row.origin)}</p>
          <h3 className="mt-1 break-words text-sm font-semibold text-ink">{title}</h3>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {row.errors.length ? <span className="text-xs font-medium text-error">Needs correction</span> : <span className="flex items-center gap-1 text-xs font-medium text-moss"><Check className="h-3.5 w-3.5" aria-hidden />Ready to import</span>}
          {editing ? null : (
            <>
              <Button type="button" size="sm" variant="ghost" disabled={locked} onClick={() => actions.open(targetOf(row.origin))}><Pencil className="h-3.5 w-3.5" aria-hidden />Edit</Button>
              <Button type="button" size="sm" variant="ghost" disabled={locked} onClick={() => actions.remove(row.origin, title)}><Trash2 className="h-3.5 w-3.5" aria-hidden />Remove</Button>
            </>
          )}
        </div>
      </header>

      <div className="space-y-4 p-3">
        {row.protocolDecision ? <ProtocolImportDecisionNotice decision={row.protocolDecision} /> : null}
        {editing ? (
          <RecordForm module={module} initial={row.fields} errors={row.errors} choices={choices} columns={columns} onDone={(values) => actions.save(targetOf(row.origin), values, row.fields)} onCancel={() => actions.open(null)} />
        ) : grouped.core.length ? (
          <section>
            <h4 className="text-xs font-semibold text-ink">Basics</h4>
            <div className="mt-2 grid gap-x-5 gap-y-2 md:grid-cols-2 xl:grid-cols-3">
              {grouped.core.map((field) => <PreviewFieldValue key={field.label} field={field} changed={isChanged(field)} compact />)}
            </div>
          </section>
        ) : null}

        {grouped.narrative.length ? (
          <section>
            <h4 className="text-xs font-semibold text-ink">Document sections</h4>
            <div className="mt-2 grid gap-2 lg:grid-cols-2">
              {grouped.narrative.map((field) => <PreviewFieldValue key={field.label} field={field} changed={isChanged(field)} />)}
            </div>
          </section>
        ) : null}

        {grouped.technical.length && !editing ? (
          <details className="rounded-[var(--ln-radius-control-lg)] border border-hairline bg-warm/50">
            <summary className="focus-ring cursor-pointer list-none rounded-[var(--ln-radius-control-lg)] px-3 py-2 text-xs font-medium text-muted">{`Raw data · ${grouped.technical.length}`}</summary>
            <div className="grid gap-2 border-t border-hairline p-3 md:grid-cols-2">
              {grouped.technical.map((field) => <PreviewFieldValue key={field.label} field={field} />)}
            </div>
          </details>
        ) : null}

        {editing ? null : row.errors.map((message) => <p key={message} className="rounded-[var(--ln-radius-control-md)] bg-error-surface px-3 py-2 text-xs text-error">{message}</p>)}
        {row.warnings.map((message) => <p key={message} className="rounded-[var(--ln-radius-control-md)] bg-warning-surface px-3 py-2 text-xs text-warning">{message}</p>)}
        {!editing && fileRow && changed.size > 0 ? (
          <Button type="button" size="sm" variant="ghost" disabled={locked} onClick={() => actions.revert(fileRow.row)}><Undo2 className="h-3.5 w-3.5" aria-hidden />Restore the file’s values</Button>
        ) : null}
      </div>
    </section>
  );
}

function PreviewFieldValue({ field, changed = false, compact = false }: { field: PreviewField; changed?: boolean; compact?: boolean }) {
  return (
    <div className={cn("min-w-0 rounded-[var(--ln-radius-control-md)] border px-3 py-2", changed ? "border-moss/40 bg-sage-surface/60" : "border-hairline/70 bg-warm/35")}>
      <p className="flex flex-wrap items-center gap-x-2 text-xs font-medium text-muted"><span>{field.label}</span>{changed ? <span className="text-moss">Changed here</span> : null}</p>
      <p className={`mt-1 break-words text-xs leading-5 text-graphite ${compact ? "" : "max-h-28 overflow-auto pr-1 editorial-scrollbar"}`}>{field.value || "—"}</p>
    </div>
  );
}

const dateKeys = new Set(["date", "expiryDate", "periodStart", "periodEnd"]);
const numberKeys = new Set(["currentQuantity", "lowThreshold", "freezeThawCount", "quantity", "quotedAmount", "actualAmount", "numericValue"]);
const longTextKeys = new Set(["description", "objective", "hypothesis", "rationale", "notes", "purpose", "textValue"]);

/**
 * One record's fields as a form (Q216): required ones first, then those the file has a column or a value for; the rest
 * fold under “More fields”. Document sections stay read-only and are edited in the editor after importing.
 */
function RecordForm({ module, initial, errors, choices, columns, onDone, onCancel }: {
  module: StructuredModuleKey;
  initial: Record<string, string>;
  errors: string[];
  choices?: Record<string, string[]>;
  columns: Set<string>;
  onDone: (values: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(initial);
  const fields = editableImportFields(module);
  const shown = fields.filter((field) => field.required || columns.has(field.key) || initial[field.key]);
  const more = fields.filter((field) => !shown.includes(field));
  const hasDocument = structuredModules[module].fields.some((field) => isDocumentSection(module, field.key));
  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const input = (field: StructuredFieldDefinition) => <FieldInput key={field.key} module={module} field={field} value={values[field.key] ?? ""} original={initial[field.key] ?? ""} choices={choices} onChange={(value) => set(field.key, value)} />;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onDone(values);
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      {errors.length ? <ul className="space-y-1 rounded-[var(--ln-radius-control-md)] bg-error-surface px-3 py-2 text-xs text-error">{errors.map((message) => <li key={message}>{message}</li>)}</ul> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{shown.map(input)}</div>
      {more.length ? (
        <details className="rounded-[var(--ln-radius-control-lg)] border border-hairline">
          <summary className="focus-ring cursor-pointer list-none rounded-[var(--ln-radius-control-lg)] px-3 py-2 text-xs font-medium text-muted">{`More fields · ${more.length}`}</summary>
          <div className="grid gap-3 border-t border-hairline p-3 sm:grid-cols-2 xl:grid-cols-3">{more.map(input)}</div>
        </details>
      ) : null}
      {hasDocument ? <p className="text-xs text-muted">Document sections are edited in the editor after importing.</p> : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" className="max-sm:h-11" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" className="max-sm:h-11">Done</Button>
      </div>
    </form>
  );
}

function FieldInput({ module, field, value, original, choices, onChange }: {
  module: StructuredModuleKey;
  field: StructuredFieldDefinition;
  value: string;
  original: string;
  choices?: Record<string, string[]>;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const { locale } = useI18n();
  const missing = Boolean(field.required && !value.trim());
  // The app's input border rule sits outside the utility layer, so the missing-field colour needs !important.
  const boxClass = cn(formInputClass, "max-sm:h-11", missing && "!border-error");
  const options = importFieldChoices(module, field, choices);
  let box: ReactNode;
  if (options) {
    box = (
      <select id={id} aria-invalid={missing || undefined} value={value} onChange={(event) => onChange(event.target.value)} className={boxClass}>
        <option value="">—</option>
        {value && !options.some((option) => option.value === value) ? <option value={value}>{`${value} — not on the list`}</option> : null}
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    );
  } else if (field.choices === "suggest") {
    // Suggestions read as the template offers them; the import takes either half of “中文 / English”.
    box = (
      <>
        <input id={id} aria-invalid={missing || undefined} list={`${id}-choices`} value={value} onChange={(event) => onChange(event.target.value)} className={boxClass} />
        <datalist id={`${id}-choices`}>{(choices?.[field.key] ?? []).map((choice) => <option key={choice} value={locale === "zh" ? bilingual(choice) : choice} />)}</datalist>
      </>
    );
  } else if (dateKeys.has(field.key)) {
    const day = /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "";
    box = <input id={id} aria-invalid={missing || undefined} type="date" value={day} onChange={(event) => onChange(event.target.value)} className={boxClass} />;
  } else if (longTextKeys.has(field.key) || value.includes("\n")) {
    box = <textarea id={id} aria-invalid={missing || undefined} value={value} rows={3} onChange={(event) => onChange(event.target.value)} className={cn(formTextareaClass, "min-h-0", missing && "!border-error")} />;
  } else {
    box = <input id={id} aria-invalid={missing || undefined} value={value} inputMode={numberKeys.has(field.key) ? "decimal" : undefined} onChange={(event) => onChange(event.target.value)} className={boxClass} />;
  }
  // A date the file wrote in another form cannot show in a date box; the original stays visible until it is replaced.
  const unreadableDate = dateKeys.has(field.key) && value === original && original && !/^\d{4}-\d{2}-\d{2}/.test(original);
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={formLabelClass}><span>{field.label}</span>{field.required ? <span aria-hidden> *</span> : null}</label>
      {box}
      {unreadableDate ? <p className="mt-1 text-xs text-warning">{`The file says “${original}”.`}</p> : null}
    </div>
  );
}
