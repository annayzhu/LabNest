"use client";

import Link from "next/link";
import { Fragment, useActionState, useMemo, useRef, useState } from "react";
import { undoSampleBatch } from "@/app/samples/actions";
import { importSampleBankRecords, type BankImportState } from "@/app/samples/bank/actions";
import { useI18n } from "@/components/I18nProvider";
import { formInlineInputClass } from "@/components/forms";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useModalDialog } from "@/components/ui/ModalDialogProvider";
import { cn } from "@/lib/cn";
import type { FormActionState } from "@/lib/form-actions";

export type BankResultRow = {
  id: string; externalId: string; name: string; code: string | null;
  bankType: string; typeId: string; typeLabel: string; typeMatched: boolean;
  origin: string; collectedAt: string; amount: string; concentration: string; location: string; attributes: string;
  status: "new" | "changed" | "unchanged";
  changes: Array<{ label: string; from: string; to: string }>;
  sample: { id: string; code: string; amount: string; concentration: string } | null;
  parentId: string | null;
};

const PAGE = 500;
const statusTone = { new: "success", changed: "warning", unchanged: "neutral" } as const;
const statusLabel = { new: "New sample", changed: "Imported, changed", unchanged: "Imported, unchanged" } as const;
const field = cn(formInlineInputClass, "h-8 w-auto text-sm");

/**
 * A search's records against LabNest (S22): filter them, choose a page or every result, import (S23–S25), undo (S26).
 * Choosing a record also chooses its parent when the parent came in the same search; it can be unchosen again.
 */
export function SampleBankResults({ searchId, rows, types, projects }: { searchId: string; rows: BankResultRow[]; types: Array<{ id: string; label: string }>; projects: Array<{ id: string; name: string }> }) {
  const { t } = useI18n();
  const dialog = useModalDialog();
  const [status, setStatus] = useState<"" | BankResultRow["status"]>("");
  const [typeId, setTypeId] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [projectId, setProjectId] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [imported, importAction, importing] = useActionState<BankImportState, FormData>(importSampleBankRecords, {});
  const [undone, undoAction, undoing] = useActionState<FormActionState, FormData>(undoSampleBatch, {});
  const importForm = useRef<HTMLFormElement>(null);
  const undoForm = useRef<HTMLFormElement>(null);
  const byId = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows]);
  const counts = useMemo(() => ({ new: rows.filter((row) => row.status === "new").length, changed: rows.filter((row) => row.status === "changed").length, unchanged: rows.filter((row) => row.status === "unchanged").length }), [rows]);
  const filtered = useMemo(() => {
    const words = query.trim().toLowerCase();
    return rows.filter((row) => (!status || row.status === status) && (!typeId || row.typeId === typeId)
      && (!words || [row.name, row.externalId, row.code ?? "", row.origin, row.attributes, row.location].some((value) => value.toLowerCase().includes(words))));
  }, [rows, status, typeId, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages - 1);
  const shown = filtered.slice(current * PAGE, (current + 1) * PAGE);
  const shownChosen = shown.length > 0 && shown.every((row) => chosen.has(row.id));

  function choose(ids: string[], on: boolean) {
    setChosen((before) => {
      const next = new Set(before);
      for (const id of ids) {
        if (!on) next.delete(id);
        // A record brings its parents along, up the chain, while they are in this search.
        else for (let row = byId.get(id); row && !next.has(row.id); row = row.parentId ? byId.get(row.parentId) : undefined) next.add(row.id);
      }
      return next;
    });
  }

  async function confirmImport() {
    const picked = [...chosen].map((id) => byId.get(id)).filter((row): row is BankResultRow => Boolean(row));
    const fresh = picked.filter((row) => row.status === "new").length;
    const changed = picked.filter((row) => row.status === "changed").length;
    if (await dialog.confirm({ title: t("Import the chosen records?"), description: t(`${fresh} new, ${changed} updated, ${picked.length - fresh - changed} unchanged.`), confirmLabel: t("Import") })) importForm.current?.requestSubmit();
  }

  return (
    <div className="space-y-3">
      {imported.batchId ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--ln-radius-panel)] border border-hairline bg-sage-surface px-3 py-2 text-sm">
          <span className="text-moss"><span>Imported</span> · <span>{imported.success}</span></span>
          {imported.created ? <Link href={`/samples?batch=${imported.batchId}`} className="font-medium text-moss hover:underline">View this batch</Link> : null}
          {undone.success ? <span className="ml-auto text-graphite">{undone.success}</span> : imported.created || imported.updated ? (
            <form ref={undoForm} action={undoAction} className="ml-auto">
              <input type="hidden" name="batchId" value={imported.batchId} />
              <Button type="button" size="sm" variant="ghost" disabled={undoing} className="text-error hover:bg-error-surface hover:text-error" onClick={async () => {
                if (await dialog.confirm({ title: t("Undo this import?"), description: t(`${imported.created ?? 0} samples will be removed; ${imported.updated ?? 0} put back as they were.`), confirmLabel: t("Undo"), tone: "destructive" })) undoForm.current?.requestSubmit();
              }}>Undo this import</Button>
            </form>
          ) : null}
          {undone.error ? <p role="alert" className="basis-full text-error">{undone.error}</p> : null}
        </div>
      ) : null}
      {imported.error ? <p role="alert" className="rounded-[var(--ln-radius-panel)] border border-error/40 bg-error-surface px-3 py-2 text-sm text-error">{imported.error}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Comparison" value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(0); }} className={field}>
          <option value="">{`Every record (${rows.length})`}</option>
          <option value="new">{`New samples (${counts.new})`}</option>
          <option value="changed">{`Imported, changed (${counts.changed})`}</option>
          <option value="unchanged">{`Imported, unchanged (${counts.unchanged})`}</option>
        </select>
        <select aria-label="Type" value={typeId} onChange={(event) => { setTypeId(event.target.value); setPage(0); }} className={field}>
          <option value="">All types</option>
          {types.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
        </select>
        <input aria-label="Search records" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Name, bank ID, origin…" className={cn(field, "w-56")} />
        <span className="ml-auto text-sm text-graphite"><span className="tabular-nums">{chosen.size}</span> <span>chosen</span></span>
        <Button type="button" size="sm" variant="secondary" disabled={!filtered.length} onClick={() => choose(filtered.map((row) => row.id), true)}><span>Choose all results</span> <span className="tabular-nums">({filtered.length})</span></Button>
        <Button type="button" size="sm" variant="ghost" disabled={!chosen.size} onClick={() => setChosen(new Set())}>Clear</Button>
      </div>

      <form ref={importForm} action={(formData) => { importAction(formData); setChosen(new Set()); }} className="flex flex-wrap items-center gap-2 rounded-[var(--ln-radius-panel)] border border-hairline bg-surface px-3 py-2 text-sm">
        <input type="hidden" name="searchId" value={searchId} />
        <input type="hidden" name="recordIds" value={JSON.stringify([...chosen])} />
        <label className="flex items-center gap-2"><span className="text-graphite">Project for new samples</span>
          <select name="projectId" value={projectId} onChange={(event) => setProjectId(event.target.value)} className={field}>
            <option value="">No project</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>
        <Button type="button" className="ml-auto" disabled={!chosen.size || importing} onClick={() => void confirmImport()}><span>Import chosen</span> <span className="tabular-nums">({chosen.size})</span></Button>
      </form>

      <div className="relative min-w-0 max-w-full overflow-x-auto rounded-[var(--ln-radius-panel)] border border-hairline bg-surface [contain:inline-size]">
        <table className="w-full min-w-[1180px] text-sm">
          <thead className="border-b border-hairline text-left text-xs text-muted">
            <tr>
              <th className="w-9 px-3 py-2"><input type="checkbox" aria-label="Choose this page" checked={shownChosen} onChange={(event) => choose(shown.map((row) => row.id), event.target.checked)} /></th>
              <th className="min-w-[132px] px-2 py-2 font-medium">Compared with LabNest</th>
              <th className="min-w-[180px] px-2 py-2 font-medium">Sample</th>
              <th className="min-w-[96px] px-2 py-2 font-medium">Type</th>
              <th className="min-w-[96px] px-2 py-2 font-medium">Origin</th>
              <th className="min-w-[96px] px-2 py-2 font-medium">Collected</th>
              <th className="min-w-[80px] px-2 py-2 font-medium">Amount</th>
              <th className="min-w-[96px] px-2 py-2 font-medium">Concentration</th>
              <th className="min-w-[160px] px-2 py-2 font-medium">Location in the bank</th>
              <th className="min-w-[180px] px-2 py-2 font-medium">Other attributes</th>
              <th className="min-w-[120px] px-2 py-2 font-medium">In LabNest</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {shown.length ? shown.map((row) => (
              <Fragment key={row.id}>
                <tr className={chosen.has(row.id) ? "bg-sage-surface/40" : undefined}>
                  <td className="px-3 py-2 align-top"><input type="checkbox" aria-label={`Choose record ${row.name}`} checked={chosen.has(row.id)} onChange={(event) => choose([row.id], event.target.checked)} /></td>
                  <td className="px-2 py-2 align-top">
                    <Badge tone={statusTone[row.status]}>{statusLabel[row.status]}</Badge>
                    {row.changes.length ? <button type="button" className="mt-1 block text-xs font-medium text-moss hover:underline" onClick={() => setOpen(open === row.id ? null : row.id)}>{open === row.id ? "Hide changes" : `${row.changes.length} changes`}</button> : null}
                  </td>
                  <td className="px-2 py-2 align-top"><p className="font-medium text-ink">{row.name}</p><p className="record-identifier mt-0.5 text-xs text-muted">{row.externalId}{row.code ? ` · ${row.code}` : ""}</p></td>
                  <td className="px-2 py-2 align-top">{row.typeMatched ? row.typeLabel : <span className="rounded bg-warning-surface px-1 text-warning" title={row.bankType}>{row.typeLabel} <span className="text-xs">({row.bankType})</span></span>}</td>
                  <td className="px-2 py-2 align-top">{row.origin || <span className="text-muted">—</span>}</td>
                  <td className="whitespace-nowrap px-2 py-2 align-top tabular-nums">{row.collectedAt || <span className="text-muted">—</span>}</td>
                  <td className="whitespace-nowrap px-2 py-2 align-top tabular-nums">{row.amount || <span className="text-muted">—</span>}</td>
                  <td className="whitespace-nowrap px-2 py-2 align-top tabular-nums">{row.concentration || <span className="text-muted">—</span>}</td>
                  <td className="px-2 py-2 align-top text-xs text-graphite">{row.location || <span className="text-muted">—</span>}</td>
                  <td className="px-2 py-2 align-top text-xs text-graphite">{row.attributes || <span className="text-muted">—</span>}</td>
                  <td className="px-2 py-2 align-top text-xs">
                    {row.sample ? <><Link href={`/samples/${row.sample.id}`} className="record-identifier font-medium text-moss hover:underline">{row.sample.code}</Link>{row.sample.amount || row.sample.concentration ? <p className="mt-0.5 text-muted">{[row.sample.amount, row.sample.concentration].filter(Boolean).join(" · ")}</p> : null}</> : <span className="text-muted">—</span>}
                  </td>
                </tr>
                {open === row.id && row.changes.length ? (
                  <tr className="bg-warm/40"><td />
                    <td colSpan={10} className="px-2 py-2 text-xs">
                      <p className="mb-1 text-muted">Importing again updates these values from the bank; place, amount, concentration and status stay as LabNest has them.</p>
                      <ul className="space-y-0.5">{row.changes.map((change) => <li key={change.label}><span className="font-medium text-ink">{change.label}</span>: <span className="text-graphite">{change.from || "—"}</span> → <span className="text-ink">{change.to || "—"}</span></li>)}</ul>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )) : <tr><td colSpan={11} className="px-3 py-6 text-center text-muted">{rows.length ? "No record matches." : "No records have arrived yet."}</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <nav aria-label="Result pages" className="flex items-center justify-end gap-2 text-sm">
          <Button type="button" size="sm" variant="ghost" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</Button>
          <span className="tabular-nums text-graphite">{current + 1} / {pages}</span>
          <Button type="button" size="sm" variant="ghost" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</Button>
        </nav>
      ) : null}
    </div>
  );
}
