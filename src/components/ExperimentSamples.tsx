"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Grid3x3, ListChecks, PackagePlus, Tags, Trash2, X } from "lucide-react";
import { findSamples, type FoundSample } from "@/app/samples/actions";
import {
  addExperimentSamples, assignExperimentGroups, moveExperimentSample, removeExperimentSample, saveExperimentSampleGroups, setExperimentSampleGroup,
  setExperimentSampleUse, type ExperimentSampleState,
} from "@/app/experiments/[id]/sample-actions";
import { AttachmentUploadForm } from "@/components/AttachmentUploadForm";
import { useI18n } from "@/components/I18nProvider";
import { parsePlateLayouts, PlateLayoutView, type PlateAttachment } from "@/components/PlateLayoutView";
import { formInlineInputClass } from "@/components/forms";
import { Button, buttonStyles } from "@/components/ui/Button";
import { useModalDialog } from "@/components/ui/ModalDialogProvider";
import { cn } from "@/lib/cn";
import { wellsBySample } from "@/lib/experiment-samples";

export type ExperimentSampleRow = {
  linkId: string; sampleId: string; code: string; name: string; type: string; groupId: string | null; place: string | null; placePath: string | null;
  usedAmount: number | null; usedUnit: string | null; amountUnit: string | null; parentCode: string | null;
};
type Option = { value: string; label: string };
type Panel = "choose" | "groups" | "plates" | null;

const field = cn(formInlineInputClass, "h-8 text-sm");
const iconButton = "focus-ring inline-flex h-6 w-6 items-center justify-center rounded-[var(--ln-radius-control-sm)] text-muted hover:bg-stone hover:text-ink disabled:opacity-40";

/**
 * 实验设置与样本 (S11–S14): the samples this experiment takes and produces, their design groups, what was taken from each,
 * and the plate layouts they were laid out on. Locked records only show it.
 */
export function ExperimentSamples({ experimentId, editable, inputs, outputs, groups, plates, types, locations }: {
  experimentId: string; editable: boolean; inputs: ExperimentSampleRow[]; outputs: ExperimentSampleRow[];
  groups: Array<{ id: string; label: string }>; plates: PlateAttachment[]; types: Option[]; locations: Option[];
}) {
  const { t } = useI18n();
  const dialog = useModalDialog();
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [wells, setWells] = useState<Map<string, string[]>>(new Map());
  const groupName = useMemo(() => new Map(groups.map((group) => [group.id, group.label])), [groups]);
  const layoutIds = plates.filter((plate) => !plate.mimeType.startsWith("image/")).map((plate) => plate.id).join(",");
  const inputSamples = useMemo(() => inputs.map((row) => ({ id: row.sampleId, code: row.code, name: row.name })), [inputs]);

  // Which wells of the attached planner layouts each input sits in (S14). The planner is given the inputs, and an
  // output often shares its input's name, so only the inputs are matched.
  useEffect(() => {
    let cancelled = false;
    if (!layoutIds || !inputSamples.length) return;
    Promise.all(layoutIds.split(",").map((id) => fetch(`/api/attachments/${id}`).then((response) => response.json()).then(parsePlateLayouts).catch(() => [])))
      .then((parsed) => { if (!cancelled) setWells(wellsBySample(parsed.flat(), inputSamples)); });
    return () => { cancelled = true; };
  }, [layoutIds, inputSamples]);

  const act = (work: () => Promise<ExperimentSampleState>, after?: () => void) => startTransition(async () => {
    const result = await work();
    if (result.error) { await dialog.alert({ title: t("Not changed"), description: t(result.error) }); return; }
    const unmatched = [...(result.missing ?? []).map((token) => `${t("Not found")}: ${token}`), ...(result.ambiguous ?? []).map((token) => `${t("Several samples have this name; use its code")}: ${token}`)];
    setNotice([result.success ? t(result.success) : "", ...unmatched].filter(Boolean).join("\n") || null);
    after?.();
    router.refresh();
  });

  const toggle = (linkId: string) => setChecked((current) => { const next = new Set(current); if (next.has(linkId)) next.delete(linkId); else next.add(linkId); return next; });
  const selected = inputs.filter((row) => checked.has(row.linkId)).map((row) => row.linkId);

  return (
    <div className="ln-experiment-samples mb-5 space-y-3 rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-warm/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-graphite"><span>Samples used</span> <strong className="tabular-nums text-ink">{inputs.length}</strong> · <span>Samples produced</span> <strong className="tabular-nums text-ink">{outputs.length}</strong>{groups.length ? <> · <span>Groups</span> <strong className="tabular-nums text-ink">{groups.length}</strong></> : null}</p>
        {editable ? (
          <div className="ml-auto flex flex-wrap gap-1 print:hidden">
            <Button type="button" size="sm" variant={panel === "choose" ? "secondary" : "ghost"} onClick={() => setPanel(panel === "choose" ? null : "choose")}><ListChecks className="h-3.5 w-3.5" aria-hidden />Choose samples…</Button>
            <Button type="button" size="sm" variant={panel === "groups" ? "secondary" : "ghost"} onClick={() => setPanel(panel === "groups" ? null : "groups")}><Tags className="h-3.5 w-3.5" aria-hidden />Groups…</Button>
            <Button type="button" size="sm" variant={panel === "plates" ? "secondary" : "ghost"} onClick={() => setPanel(panel === "plates" ? null : "plates")}><Grid3x3 className="h-3.5 w-3.5" aria-hidden />Plate layout…</Button>
            <Link href={`/samples/new?experiment=${experimentId}`} className={buttonStyles({ size: "sm", variant: "secondary" })}><PackagePlus className="h-3.5 w-3.5" aria-hidden />Register outputs</Link>
          </div>
        ) : null}
      </div>
      {notice ? <p role="status" className="whitespace-pre-wrap text-xs text-moss">{notice}</p> : null}

      {panel === "choose" ? <ChoosePanel types={types} locations={locations} pending={pending} onAdd={(input) => act(() => addExperimentSamples({ experimentId, ...input }))} /> : null}
      {panel === "groups" ? <GroupsPanel key={groups.map((group) => `${group.id}:${group.label}`).join("|")} groups={groups} pending={pending} onSave={(list) => act(() => saveExperimentSampleGroups({ experimentId, groups: list }), () => setPanel(null))} onPaste={(text) => act(() => assignExperimentGroups({ experimentId, text }))} /> : null}
      {panel === "plates" ? (
        <div className="space-y-3 rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-surface p-3 text-sm print:hidden">
          <p className="text-xs text-muted">The plate planner opens with this experiment’s samples, grouped and in order. Back up the project there and attach the file here; wells that name a sample show beside it.</p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/tools/qpcr-plate-layout?experiment=${experimentId}`} className={buttonStyles({ size: "sm", variant: "secondary" })}>qPCR plate planner</Link>
            <Link href={`/tools/cnv-plate-layout?experiment=${experimentId}`} className={buttonStyles({ size: "sm", variant: "ghost" })}>CNV plate planner</Link>
          </div>
          <AttachmentUploadForm targetType="experiment" targetId={experimentId} hideTargetFields fileLabel="Plate layout file" accept=".json,.svg,image/*" linkType="plate_layout" />
        </div>
      ) : null}

      {inputs.length ? (
        <div className="space-y-2">
          {editable && selected.length ? (
            <div className="flex flex-wrap items-center gap-2 rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-surface px-2 py-1.5 text-sm print:hidden">
              <span className="text-graphite"><span>Selected</span> <strong className="tabular-nums text-ink">{selected.length}</strong></span>
              <select aria-label="Set group" value="" disabled={pending} onChange={async (event) => {
                const value = event.target.value;
                if (!value) return;
                if (value === "__new") {
                  const label = await dialog.prompt({ title: t("New group"), inputLabel: t("Group name"), confirmLabel: t("Apply") });
                  if (label?.trim()) act(() => setExperimentSampleGroup({ experimentId, linkIds: selected, newGroup: label.trim() }), () => setChecked(new Set()));
                } else act(() => setExperimentSampleGroup({ experimentId, linkIds: selected, groupId: value === "__none" ? null : value }), () => setChecked(new Set()));
              }} className={cn(field, "w-auto")}>
                <option value="">Set group…</option>
                {groups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
                <option value="__new">New group…</option>
                <option value="__none">No group</option>
              </select>
              <Button type="button" size="sm" variant="ghost" disabled={pending} className="ml-auto text-error hover:bg-error-surface hover:text-error" onClick={async () => {
                if (await dialog.confirm({ title: t("Remove the selected samples from this experiment?"), description: t("What their use took is given back to them."), confirmLabel: t("Remove"), tone: "destructive" })) act(() => removeExperimentSample({ experimentId, linkIds: selected }), () => setChecked(new Set()));
              }}><Trash2 className="h-3.5 w-3.5" aria-hidden />Remove</Button>
            </div>
          ) : null}
          <div className="relative min-w-0 max-w-full overflow-x-auto editorial-scrollbar [contain:inline-size]">
            <table className="w-full min-w-[480px] text-sm">
              <caption className="pb-1 text-left text-xs font-medium text-muted">Samples used</caption>
              <thead className="text-left text-xs text-muted"><tr>
                {editable ? <th className="w-8 py-1 print:hidden"><input type="checkbox" aria-label="Select all" checked={selected.length === inputs.length} onChange={(event) => setChecked(event.target.checked ? new Set(inputs.map((row) => row.linkId)) : new Set())} /></th> : null}
                <th className="w-8 py-1">#</th><th className="py-1">Sample</th><th className="py-1">Group</th><th className="py-1">Place</th>{wells.size ? <th className="py-1">Wells</th> : null}<th className="py-1">Used</th>
                {editable ? <th className="w-16 py-1 print:hidden"><span className="sr-only">Order</span></th> : null}
              </tr></thead>
              <tbody className="divide-y divide-hairline border-t border-hairline">
                {inputs.map((row, index) => (
                  <tr key={row.linkId} className="align-middle">
                    {editable ? <td className="py-1.5 print:hidden"><input type="checkbox" aria-label={`Select sample ${row.code}`} checked={checked.has(row.linkId)} onChange={() => toggle(row.linkId)} /></td> : null}
                    <td className="py-1.5 text-xs tabular-nums text-muted">{index + 1}</td>
                    <td className="py-1.5"><SampleCell row={row} /></td>
                    <td className="py-1.5">{row.groupId ? groupName.get(row.groupId) : <span className="text-muted">—</span>}</td>
                    <td className="whitespace-nowrap py-1.5 pr-2 text-xs text-graphite" title={row.placePath ?? undefined}>{row.place ?? <span className="text-muted">Not placed</span>}</td>
                    {wells.size ? <td className="py-1.5 font-mono text-xs">{wells.get(row.sampleId)?.join(", ") ?? <span className="text-muted">—</span>}</td> : null}
                    <td className="py-1.5">{editable ? <UseInput key={`${row.linkId}:${row.usedAmount}:${row.usedUnit}`} row={row} pending={pending} onSave={(amount, unit) => act(() => setExperimentSampleUse({ experimentId, linkId: row.linkId, amount, unit }))} /> : row.usedAmount !== null ? <span className="font-mono text-xs">{row.usedAmount} {row.usedUnit}</span> : <span className="text-muted">—</span>}</td>
                    {editable ? <td className="py-1.5 print:hidden"><span className="flex gap-0.5">
                      <button type="button" aria-label="Move up" title="Move up" disabled={pending || index === 0} onClick={() => act(() => moveExperimentSample({ experimentId, linkId: row.linkId, direction: -1 }))} className={iconButton}><ArrowUp className="h-3.5 w-3.5" aria-hidden /></button>
                      <button type="button" aria-label="Move down" title="Move down" disabled={pending || index === inputs.length - 1} onClick={() => act(() => moveExperimentSample({ experimentId, linkId: row.linkId, direction: 1 }))} className={iconButton}><ArrowDown className="h-3.5 w-3.5" aria-hidden /></button>
                    </span></td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : <p className="text-sm text-muted">No samples chosen yet.{editable ? " Choose them from the sample list, by pasting codes, or a whole box." : ""}</p>}

      {outputs.length ? (
        <div className="relative min-w-0 max-w-full overflow-x-auto editorial-scrollbar [contain:inline-size]">
          <table className="w-full min-w-[440px] text-sm">
            <caption className="pb-1 text-left text-xs font-medium text-muted">Samples produced</caption>
            <thead className="text-left text-xs text-muted"><tr><th className="w-8 py-1">#</th><th className="py-1">Sample</th><th className="py-1">Parent sample</th><th className="py-1">Group</th><th className="py-1">Place</th></tr></thead>
            <tbody className="divide-y divide-hairline border-t border-hairline">
              {outputs.map((row, index) => (
                <tr key={row.linkId}>
                  <td className="py-1.5 text-xs tabular-nums text-muted">{index + 1}</td>
                  <td className="py-1.5"><SampleCell row={row} /></td>
                  <td className="py-1.5 record-identifier text-xs">{row.parentCode ?? <span className="text-muted">—</span>}</td>
                  <td className="py-1.5">{row.groupId ? groupName.get(row.groupId) : <span className="text-muted">—</span>}</td>
                  <td className="whitespace-nowrap py-1.5 pr-2 text-xs text-graphite" title={row.placePath ?? undefined}>{row.place ?? <span className="text-muted">Not placed</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {plates.length ? <div className="space-y-2"><p className="text-xs font-medium text-muted">Plate layouts</p>{plates.map((plate) => <PlateLayoutView key={plate.id} attachment={plate} />)}</div> : null}
    </div>
  );
}

function SampleCell({ row }: { row: ExperimentSampleRow }) {
  return <span className="block min-w-0"><Link href={`/samples/${row.sampleId}`} className="font-medium text-ink hover:text-moss">{row.name}</Link><span className="block text-xs text-muted"><span className="record-identifier">{row.code}</span> · {row.type}</span></span>;
}

/** What was taken from an input; saved when the field is left (S12). */
function UseInput({ row, pending, onSave }: { row: ExperimentSampleRow; pending: boolean; onSave: (amount: string, unit: string) => void }) {
  const [amount, setAmount] = useState(row.usedAmount === null ? "" : String(row.usedAmount));
  const [unit, setUnit] = useState(row.usedUnit ?? row.amountUnit ?? "µL");
  const save = () => {
    if (amount.trim() === (row.usedAmount === null ? "" : String(row.usedAmount)) && (unit === (row.usedUnit ?? row.amountUnit ?? "µL") || !amount.trim())) return;
    onSave(amount, unit);
  };
  return <span className="inline-flex items-center gap-1">
    <input aria-label={`Amount taken from ${row.code}`} inputMode="decimal" value={amount} placeholder="—" disabled={pending} onChange={(event) => setAmount(event.target.value)} onBlur={save} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} className={cn(field, "h-7 w-14 px-1.5 text-xs")} />
    <input aria-label={`Unit for ${row.code}`} value={unit} disabled={pending} onChange={(event) => setUnit(event.target.value)} onBlur={save} className={cn(field, "h-7 w-11 px-1.5 text-xs")} />
  </span>;
}

function ChoosePanel({ types, locations, pending, onAdd }: { types: Option[]; locations: Option[]; pending: boolean; onAdd: (input: { sampleIds?: string[]; list?: string }) => void }) {
  const [mode, setMode] = useState<"search" | "paste" | "box">("search");
  const [query, setQuery] = useState("");
  const [typeId, setTypeId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [results, setResults] = useState<FoundSample[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [list, setList] = useState("");
  const [searching, startSearch] = useTransition();
  const search = (box = false) => startSearch(async () => {
    const found = await findSamples({ query: box ? undefined : query, typeId: box ? undefined : typeId || undefined, locationId: locationId || undefined, inStorage: box });
    setResults(found.samples ?? []);
    setPicked(box ? new Set((found.samples ?? []).map((sample) => sample.id)) : new Set());
  });
  return (
    <div className="space-y-2 rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-surface p-3 text-sm print:hidden">
      <div role="tablist" className="flex gap-4 border-b border-hairline text-[13px]">
        {([["search", "Search"], ["paste", "Paste codes"], ["box", "Whole box"]] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={mode === key} onClick={() => { setMode(key); setResults(null); }} className={`focus-ring -mb-px border-b-2 pb-1.5 ${mode === key ? "border-moss text-moss" : "border-transparent text-muted hover:text-ink"}`}>{label}</button>)}
      </div>
      {mode === "paste" ? <>
        <textarea aria-label="Codes or names" value={list} onChange={(event) => setList(event.target.value)} rows={4} placeholder="RNA-0001&#10;RNA-0002&#10;A549-siFBN2-975" className={cn(formInlineInputClass, "w-full font-mono text-xs")} />
        <div className="flex items-center gap-2"><Button type="button" size="sm" variant="primary" disabled={pending || !list.trim()} onClick={() => { onAdd({ list }); setList(""); }}>Add</Button><span className="text-xs text-muted">One code or name per line, or separated by commas. A name several samples share needs its code.</span></div>
      </> : <>
        <div className="flex flex-wrap items-center gap-2">
          {mode === "search" ? <>
            <input aria-label="Search samples" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); search(); } }} placeholder="Code, name, origin…" className={cn(field, "w-56")} />
            <select aria-label="Type" value={typeId} onChange={(event) => setTypeId(event.target.value)} className={cn(field, "w-auto")}><option value="">All types</option>{types.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select>
          </> : null}
          <select aria-label="Box" value={locationId} onChange={(event) => setLocationId(event.target.value)} className={cn(field, "w-auto max-w-80")}><option value="">{mode === "box" ? "Choose a box…" : "All places"}</option>{locations.map((location) => <option key={location.value} value={location.value}>{location.label}</option>)}</select>
          <Button type="button" size="sm" variant="secondary" disabled={searching || (mode === "box" && !locationId)} onClick={() => search(mode === "box")}>{mode === "box" ? "Show the box" : "Search"}</Button>
        </div>
        {results ? (results.length ? <>
          <ul className="max-h-72 divide-y divide-hairline overflow-y-auto rounded-[var(--ln-radius-panel-inner)] border border-hairline">
            {results.map((sample) => <li key={sample.id}><label className="flex cursor-pointer flex-wrap items-center gap-2 px-2 py-1.5 hover:bg-warm">
              <input type="checkbox" checked={picked.has(sample.id)} onChange={() => setPicked((current) => { const next = new Set(current); if (next.has(sample.id)) next.delete(sample.id); else next.add(sample.id); return next; })} />
              <span className="font-medium text-ink">{sample.name}</span><span className="record-identifier text-xs text-muted">{sample.code}</span><span className="text-xs text-graphite">{sample.type}</span>
              <span className="ml-auto text-xs text-muted">{sample.place ?? ""}{sample.status !== "available" ? <> · <span>{sample.status === "depleted" ? "Used up" : sample.status === "discarded" ? "Discarded" : "Sent out"}</span></> : null}</span>
            </label></li>)}
          </ul>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="primary" disabled={pending || !picked.size} onClick={() => { onAdd({ sampleIds: results.filter((sample) => picked.has(sample.id)).map((sample) => sample.id) }); setPicked(new Set()); }}>Add selected</Button>
            <span className="text-xs text-muted"><span className="tabular-nums">{picked.size}</span> / <span className="tabular-nums">{results.length}</span></span>
          </div>
        </> : <p className="text-xs text-muted">No samples found.</p>) : null}
      </>}
    </div>
  );
}

function GroupsPanel({ groups, pending, onSave, onPaste }: { groups: Array<{ id: string; label: string }>; pending: boolean; onSave: (groups: Array<{ id?: string; label: string }>) => void; onPaste: (text: string) => void }) {
  const [draft, setDraft] = useState<Array<{ id?: string; label: string; key: string }>>(() => groups.length ? groups.map((group) => ({ ...group, key: group.id })) : [{ label: "", key: "new-1" }]);
  const [text, setText] = useState("");
  const move = (index: number, by: number) => setDraft((current) => { const next = [...current]; const [item] = next.splice(index, 1); next.splice(index + by, 0, item); return next; });
  return (
    <div className="grid gap-3 rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-surface p-3 text-sm md:grid-cols-2 print:hidden">
      <div className="space-y-2">
        <p className="text-xs text-muted">Design groups (control / treated, tumour / normal). They do not split the Protocol’s steps; a run that needs different systems per group sets that up in its preparation.</p>
        {draft.map((group, index) => (
          <div key={group.key} className="flex items-center gap-1">
            <input aria-label={`Group ${index + 1}`} value={group.label} maxLength={60} placeholder={`Group ${index + 1}`} onChange={(event) => setDraft(draft.map((item) => (item.key === group.key ? { ...item, label: event.target.value } : item)))} className={cn(field, "flex-1")} />
            <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)} className={iconButton}><ArrowUp className="h-3.5 w-3.5" aria-hidden /></button>
            <button type="button" aria-label="Move down" disabled={index === draft.length - 1} onClick={() => move(index, 1)} className={iconButton}><ArrowDown className="h-3.5 w-3.5" aria-hidden /></button>
            <button type="button" aria-label="Remove group" onClick={() => setDraft(draft.filter((item) => item.key !== group.key))} className={iconButton}><X className="h-3.5 w-3.5" aria-hidden /></button>
          </div>
        ))}
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setDraft([...draft, { label: "", key: `new-${Date.now()}` }])}>Add group</Button>
          <Button type="button" size="sm" variant="primary" disabled={pending} onClick={() => onSave(draft.filter((group) => group.label.trim()).map((group) => ({ ...(group.id ? { id: group.id } : {}), label: group.label.trim() })))}>Save groups</Button>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs text-muted">Or paste two columns from Excel: sample (code or name) and group. Groups are created as named.</p>
        <textarea aria-label="Sample and group" value={text} onChange={(event) => setText(event.target.value)} rows={5} placeholder={"RNA-0001\tControl\nRNA-0002\tsiFBN2"} className={cn(formInlineInputClass, "w-full font-mono text-xs")} />
        <Button type="button" size="sm" variant="secondary" disabled={pending || !text.trim()} onClick={() => { onPaste(text); setText(""); }}>Assign groups</Button>
      </div>
    </div>
  );
}
