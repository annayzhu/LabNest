"use client";

import { Archive, Dna, MapPin, PackageMinus, RotateCcw, ShieldMinus, ShieldPlus, Tags, Trash2, UserRound, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { applyProductBulk, applyStockBulk, previewProductBulk, previewStockBulk } from "@/app/inventory/bulk-actions";
import { useI18n } from "@/components/I18nProvider";
import { formInlineInputClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { useModalDialog } from "@/components/ui/ModalDialogProvider";
import { inventoryControlLevels } from "@/lib/inventory";
import type { BulkEntry } from "@/lib/inventory-bulk";

type Option = { value: string; label: string };
type Mode = "move" | "pi" | "takeOut" | "classify" | "addControl" | "removeControl" | "sequences";

const questions: Record<string, string> = {
  archive: "Archive the selected records?",
  restore: "Restore the selected records?",
  move: "Move the selected stock?",
  pi: "Change the PI of the selected stock?",
  takeOut: "Take containers out of the selected stock?",
  classify: "Change the type of the selected products?",
  addControl: "Add this control level to the selected products?",
  removeControl: "Remove this control level from the selected products?",
};
const controlOptions: Option[] = inventoryControlLevels.map((level) => ({ value: level.key, label: level.label }));
const fieldClass = `${formInlineInputClass} h-8 w-auto max-w-56 text-sm`;

/**
 * Actions for the rows checked in the stock or product list. Every action is checked record by record and shown before
 * anything is written; deleting asks for the number of selected records, and what is still referred to is archived.
 */
export function InventoryBulkActions({ kind, locations = [], classes = [] }: {
  kind: "stock" | "product";
  locations?: Option[];
  /** Types by 大类 (`type:<id>`), and each 大类 without a type (`group:<key>`). */
  classes?: { label: string; options: Option[] }[];
}) {
  const { t, locale } = useI18n();
  const dialog = useModalDialog();
  const router = useRouter();
  const anchor = useRef<HTMLSpanElement>(null);
  const [count, setCount] = useState(0);
  const [mode, setMode] = useState<Mode | null>(null);
  const [value, setValue] = useState("");
  const [takeOut, setTakeOut] = useState({ count: "1", holder: "", place: "" });
  const [busy, setBusy] = useState(false);
  const colon = locale === "zh" ? "：" : ": ";

  const checked = () => [...(anchor.current?.closest("form")?.querySelectorAll<HTMLInputElement>("input.selection-checkbox:checked") ?? [])];

  useEffect(() => {
    const form = anchor.current?.closest("form");
    if (!form) return;
    const sync = () => setCount(form.querySelectorAll("input.selection-checkbox:checked").length);
    form.addEventListener("change", sync);
    return () => form.removeEventListener("change", sync);
  }, []);

  function describe(entries: BulkEntry[], done: boolean) {
    const of = (outcome: BulkEntry["outcome"]) => entries.filter((entry) => entry.outcome === outcome);
    const list = (subset: BulkEntry[]) => [
      ...subset.slice(0, 6).map((entry) => `· ${entry.name}${entry.reason ? ` — ${t(entry.reason)}` : ""}`),
      ...(subset.length > 6 ? [t(`…and ${subset.length - 6} more.`)] : []),
    ];
    const lines: string[] = [];
    if (of("change").length) lines.push(t(done ? `${of("change").length} changed.` : `${of("change").length} will be changed.`));
    if (of("delete").length) lines.push(t(done ? `${of("delete").length} deleted.` : `${of("delete").length} will be deleted.`));
    if (of("archive").length) lines.push(t(done ? `${of("archive").length} archived instead:` : `${of("archive").length} will be archived instead:`), ...list(of("archive")));
    if (of("skip").length) lines.push(t(done ? `${of("skip").length} skipped:` : `${of("skip").length} will be skipped:`), ...list(of("skip")));
    return lines.join("\n");
  }

  async function run(action: string, params: Record<string, string | number | null> = {}) {
    const ids = checked().map((box) => box.value);
    if (!ids.length || busy) return;
    setBusy(true);
    try {
      const input = { action, ids, ...params };
      const preview = kind === "stock" ? await previewStockBulk(input) : await previewProductBulk(input);
      if (preview.error) return await dialog.alert({ title: t("Not changed"), description: t(preview.error) });
      const planned = preview.entries ?? [];
      if (planned.every((entry) => entry.outcome === "skip")) return await dialog.alert({ title: t("Nothing to change"), description: describe(planned, false) });
      let confirmation: string | undefined;
      if (action === "delete") {
        const typed = await dialog.prompt({ title: t("Delete the selected records?"), description: describe(planned, false), inputLabel: `${t("Type the number of selected records to confirm")}${colon}${ids.length}`, confirmLabel: t("Delete"), tone: "destructive" });
        if (typed === null) return;
        confirmation = typed;
      } else if (!await dialog.confirm({ title: t(questions[action]), description: describe(planned, false), confirmLabel: t("Apply") })) return;
      const result = kind === "stock" ? await applyStockBulk({ ...input, confirmation }) : await applyProductBulk({ ...input, confirmation });
      if (result.error) return await dialog.alert({ title: t("Not changed"), description: t(result.error) });
      const form = anchor.current?.closest("form");
      for (const box of checked()) box.checked = false;
      form?.dispatchEvent(new Event("change", { bubbles: true }));
      setMode(null);
      // The list itself shows the new state; a result only needs saying when it differs from the preview.
      const outcomes = (entries: BulkEntry[] = []) => entries.map((entry) => `${entry.id}:${entry.outcome}`).join();
      if (outcomes(result.entries) !== outcomes(planned)) await dialog.alert({ title: t("Done"), description: describe(result.entries ?? [], true) });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function start(next: Mode) {
    setMode(next);
    if (next === "move") setValue(locations[0]?.value ?? "");
    else if (next === "classify") setValue(classes[0]?.options[0]?.value ?? "none");
    else if (next === "pi") setValue("");
    else if (next === "sequences") setValue("fasta");
    else setValue(controlOptions[0].value);
  }

  const applyOnEnter = (event: KeyboardEvent<HTMLInputElement>) => { if (event.key === "Enter") { event.preventDefault(); void apply(); } };
  function apply() {
    // Sequences are a download, not a change: the selected products' strands as FASTA or CSV.
    if (mode === "sequences") {
      const ids = checked().map((box) => box.value);
      if (ids.length) window.location.href = `/api/inventory/products/sequences?ids=${encodeURIComponent(ids.join(","))}&format=${value}`;
      return setMode(null);
    }
    if (mode === "move") return run("move", { locationId: value || null });
    if (mode === "pi") return run("pi", { principalInvestigator: value.trim() || null });
    if (mode === "takeOut") {
      if (!takeOut.holder.trim()) return dialog.alert({ title: t("Not changed"), description: t("Enter who takes them.") });
      return run("takeOut", { count: Math.max(1, Math.floor(Number(takeOut.count)) || 1), holder: takeOut.holder.trim(), place: takeOut.place.trim() });
    }
    if (mode === "classify") {
      const [scope, key] = value.split(":");
      return run("classify", scope === "type" ? { typeId: key } : scope === "group" ? { groupKey: key } : {});
    }
    if (mode) return run(mode, { level: value });
  }

  return <>
    <span ref={anchor} className="mr-1 text-sm text-graphite"><span>Selected</span> <strong className="tabular-nums text-ink">{count}</strong></span>
    {mode ? <>
      {mode === "takeOut" ? <>
        <label className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm text-graphite"><span>Each</span><input aria-label="Containers from each" type="number" min={1} max={100} step={1} value={takeOut.count} onChange={(event) => setTakeOut({ ...takeOut, count: event.target.value })} onKeyDown={applyOnEnter} className={`${fieldClass} w-16`} /></label>
        <input aria-label="Recipient" required value={takeOut.holder} maxLength={120} placeholder="Recipient" onChange={(event) => setTakeOut({ ...takeOut, holder: event.target.value })} onKeyDown={applyOnEnter} className={fieldClass} />
        <input aria-label="Put at (optional)" list="bulk-take-out-places" value={takeOut.place} maxLength={240} placeholder="Put at (optional)" onChange={(event) => setTakeOut({ ...takeOut, place: event.target.value })} onKeyDown={applyOnEnter} className={fieldClass} />
        <datalist id="bulk-take-out-places">{locations.map((option) => <option key={option.value} value={option.label} />)}</datalist>
      </> : mode === "pi" ? (
        <input aria-label="New PI" value={value} maxLength={120} placeholder="Zhang Lab" onChange={(event) => setValue(event.target.value)} onKeyDown={applyOnEnter} className={fieldClass} />
      ) : (
        <select aria-label={mode === "move" ? "Move to" : mode === "classify" ? "Type" : mode === "sequences" ? "File format" : "Control level"} value={value} onChange={(event) => setValue(event.target.value)} className={fieldClass}>
          {mode === "move" ? <><option value="">Unassigned</option>{locations.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</> : null}
          {mode === "classify" ? <><option value="none">To be classified</option>{classes.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {/* A closed select shows only the option, so a 大类 without a type names its 大类. */}
              {group.options.map((option) => <option key={option.value} value={option.value}>{option.value.startsWith("group:") ? `${t(group.label)} · ${t(option.label)}` : option.label}</option>)}
            </optgroup>
          ))}</> : null}
          {mode === "addControl" || mode === "removeControl" ? controlOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>) : null}
          {mode === "sequences" ? <><option value="fasta">FASTA</option><option value="csv">CSV</option></> : null}
        </select>
      )}
      <Button type="button" size="sm" variant="primary" disabled={busy} onClick={() => void apply()}>Apply</Button>
      <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setMode(null)}>Cancel</Button>
    </> : kind === "stock" ? <>
      <BulkButton icon={MapPin} label="Move…" disabled={busy} onClick={() => start("move")} />
      <BulkButton icon={PackageMinus} label="Take out…" disabled={busy} onClick={() => start("takeOut")} />
      <BulkButton icon={UserRound} label="Change PI…" disabled={busy} onClick={() => start("pi")} />
      <BulkButton icon={Archive} label="Archive" disabled={busy} onClick={() => void run("archive")} />
      <BulkButton icon={RotateCcw} label="Restore" disabled={busy} onClick={() => void run("restore")} />
    </> : <>
      <BulkButton icon={Tags} label="Change type…" disabled={busy} onClick={() => start("classify")} />
      <BulkButton icon={Dna} label="Export sequences…" disabled={busy} onClick={() => start("sequences")} />
      <BulkButton icon={ShieldPlus} label="Add control level…" disabled={busy} onClick={() => start("addControl")} />
      <BulkButton icon={ShieldMinus} label="Remove control level…" disabled={busy} onClick={() => start("removeControl")} />
      <BulkButton icon={Archive} label="Archive" disabled={busy} onClick={() => void run("archive")} />
      <BulkButton icon={RotateCcw} label="Restore" disabled={busy} onClick={() => void run("restore")} />
    </>}
    {/* Deleting is destructive, so it sits last, after the export. */}
    <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void run("delete")} className="order-last ml-auto text-error hover:bg-error-surface hover:text-error"><Trash2 className="h-3.5 w-3.5" aria-hidden />Delete…</Button>
  </>;
}

function BulkButton({ icon: Icon, label, disabled, onClick }: { icon: LucideIcon; label: string; disabled: boolean; onClick: () => void }) {
  return <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={onClick}><Icon className="h-3.5 w-3.5" aria-hidden />{label}</Button>;
}
