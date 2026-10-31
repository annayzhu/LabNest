"use client";

import { FolderKanban, MapPin, Tag, Trash2, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { applySampleBulk, previewSampleBulk } from "@/app/samples/actions";
import { useI18n } from "@/components/I18nProvider";
import { formInlineInputClass } from "@/components/forms";
import { Button } from "@/components/ui/Button";
import { useModalDialog } from "@/components/ui/ModalDialogProvider";
import { cn } from "@/lib/cn";
import type { BulkEntry } from "@/lib/inventory-bulk";
import { sampleStatuses, sampleStatusLabels } from "@/lib/samples";

type Option = { value: string; label: string; grid?: boolean };
type Mode = "status" | "move" | "project";

const questions: Record<string, string> = {
  status: "Change the status of the selected samples?",
  move: "Move the selected samples?",
  project: "Change the project of the selected samples?",
};
const fieldClass = cn(formInlineInputClass, "h-8 w-auto max-w-56 text-sm");

/**
 * Actions for the samples checked in the list (S10). Every action is checked sample by sample and shown before anything is
 * written; a move into a box with a grid fills its free positions row by row from the chosen start.
 */
export function SampleBulkActions({ locations, projects }: { locations: Option[]; projects: Option[] }) {
  const { t, locale } = useI18n();
  const dialog = useModalDialog();
  const router = useRouter();
  const anchor = useRef<HTMLSpanElement>(null);
  const [count, setCount] = useState(0);
  const [mode, setMode] = useState<Mode | null>(null);
  const [value, setValue] = useState("");
  const [start, setStart] = useState("");
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
      ...subset.slice(0, 8).map((entry) => `· ${entry.name}${entry.reason ? ` — ${t(entry.reason)}` : ""}`),
      ...(subset.length > 8 ? [t(`…and ${subset.length - 8} more.`)] : []),
    ];
    const lines: string[] = [];
    if (of("change").length) lines.push(t(done ? `${of("change").length} changed.` : `${of("change").length} will be changed.`), ...(mode === "move" ? list(of("change")) : []));
    if (of("delete").length) lines.push(t(done ? `${of("delete").length} deleted.` : `${of("delete").length} will be deleted.`));
    if (of("skip").length) lines.push(t(done ? `${of("skip").length} skipped:` : `${of("skip").length} will be skipped:`), ...list(of("skip")));
    return lines.join("\n");
  }

  async function run(action: "status" | "move" | "project" | "delete", params: Record<string, string | null> = {}) {
    const ids = checked().map((box) => box.value);
    if (!ids.length || busy) return;
    setBusy(true);
    try {
      const input = { action, ids, ...params };
      const preview = await previewSampleBulk(input);
      if (preview.error) return await dialog.alert({ title: t("Not changed"), description: t(preview.error) });
      const planned = preview.entries ?? [];
      if (planned.every((entry) => entry.outcome === "skip")) return await dialog.alert({ title: t("Nothing to change"), description: describe(planned, false) });
      let confirmation: string | undefined;
      if (action === "delete") {
        const typed = await dialog.prompt({ title: t("Delete the selected samples?"), description: describe(planned, false), inputLabel: `${t("Type the number of selected records to confirm")}${colon}${ids.length}`, confirmLabel: t("Delete"), tone: "destructive" });
        if (typed === null) return;
        confirmation = typed;
      } else if (!await dialog.confirm({ title: t(questions[action]), description: describe(planned, false), confirmLabel: t("Apply") })) return;
      const result = await applySampleBulk({ ...input, confirmation });
      if (result.error) return await dialog.alert({ title: t("Not changed"), description: t(result.error) });
      const form = anchor.current?.closest("form");
      for (const box of checked()) box.checked = false;
      form?.dispatchEvent(new Event("change", { bubbles: true }));
      setMode(null);
      const outcomes = (entries: BulkEntry[] = []) => entries.map((entry) => `${entry.id}:${entry.outcome}`).join();
      if (outcomes(result.entries) !== outcomes(planned)) await dialog.alert({ title: t("Done"), description: describe(result.entries ?? [], true) });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function begin(next: Mode) {
    setMode(next);
    setStart("");
    setValue(next === "status" ? "available" : next === "move" ? locations[0]?.value ?? "" : "");
  }

  function apply() {
    if (mode === "status") return run("status", { status: value });
    if (mode === "move") return run("move", { locationId: value || null, ...(start.trim() ? { start: start.trim() } : {}) });
    if (mode === "project") return run("project", { projectId: value || null });
  }

  const box = locations.find((location) => location.value === value);
  return <>
    <span ref={anchor} className="mr-1 text-sm text-graphite"><span>Selected</span> <strong className="tabular-nums text-ink">{count}</strong></span>
    {mode ? <>
      <select aria-label={mode === "status" ? "Status" : mode === "move" ? "Move to" : "Project"} value={value} onChange={(event) => setValue(event.target.value)} className={fieldClass}>
        {mode === "status" ? sampleStatuses.map((status) => <option key={status} value={status}>{sampleStatusLabels[status]}</option>) : null}
        {mode === "move" ? <><option value="">Not placed</option>{locations.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</> : null}
        {mode === "project" ? <><option value="">No project</option>{projects.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</> : null}
      </select>
      {mode === "move" && box?.grid ? <input aria-label="Start position" value={start} maxLength={4} placeholder="A1" onChange={(event) => setStart(event.target.value)} className={cn(fieldClass, "w-20")} /> : null}
      <Button type="button" size="sm" variant="primary" disabled={busy} onClick={() => void apply()}>Apply</Button>
      <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setMode(null)}>Cancel</Button>
    </> : <>
      <BulkButton icon={Tag} label="Change status…" disabled={busy} onClick={() => begin("status")} />
      <BulkButton icon={MapPin} label="Move to a box…" disabled={busy} onClick={() => begin("move")} />
      <BulkButton icon={FolderKanban} label="Change project…" disabled={busy} onClick={() => begin("project")} />
    </>}
    <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void run("delete")} className="order-last ml-auto text-error hover:bg-error-surface hover:text-error"><Trash2 className="h-3.5 w-3.5" aria-hidden />Delete…</Button>
  </>;
}

function BulkButton({ icon: Icon, label, disabled, onClick }: { icon: LucideIcon; label: string; disabled: boolean; onClick: () => void }) {
  return <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={onClick}><Icon className="h-3.5 w-3.5" aria-hidden />{label}</Button>;
}
