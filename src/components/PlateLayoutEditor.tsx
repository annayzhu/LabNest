"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, Download, Eraser, Plus, TestTube, Trash2, Undo2, Upload } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useModalDialog } from "@/components/ui/ModalDialogProvider";
import {
  clearPlateWells, fillPlateInOrder, typePlateValue, isPlateSize, MAX_PLATE_FIELDS, newPlateId, PLANNER_PLATE_SIZES, PLATE_SIZES, plateColumnWells, plateLayoutsFromPlannerBackup, plateLayoutsToPlannerBackup,
  plateRowWells, plateSizeName, plateValueKey, plateValueText, plateWellIds, plateWellRange, plateWellsInRect, resizePlateLayout, setPlateValue,
  type PlateField, type PlateLayout, type PlateOrder, type PlateWellValue,
} from "@/lib/plate-layout";
import { sampleReferenceLabel, type RecordReference } from "@/lib/record-references";
import type { SampleChoice } from "@/lib/record-references.server";
import { PlateLayoutGrid, type PlateGridHandlers } from "./PlateLayoutGrid";
import { RecordReferenceTag } from "./RecordReference";
import { ReferencePicker } from "./ReferencePicker";
import "./plate-layout.css";

/** What a well value may hold (`plateWellValueSchema`); a longer one would make the whole plate fail to save. */
const MAX_WELL_TEXT = 200;
const isSampleField = (field: PlateField) => field.id === "sample" || /^(样本|samples?)$/i.test(field.name.trim());
const union = (a: Iterable<string>, b: Iterable<string>) => new Set([...a, ...b]);

/**
 * The plate editor "/板布局" opens (Q256): choose wells by click, drag, Shift range, row, column or all; give them values,
 * from the sample library too; fill a list in turn; rename and colour parameters; move layouts to and from the planner.
 * What is typed shows on the plate at once. Nothing reaches the document until Done; Cancel leaves it as it was.
 */
export function PlateLayoutEditor({ initial, experimentId, copied = false, onDone, onCancel, onOpenPlanner, onDuplicate }: {
  /** Offered inside a record the planner can save back to. */ onOpenPlanner?: (layout: PlateLayout) => void;
  /** Keeps this plate as edited, with any further plates an imported backup held, and goes on in a copy of it. */ onDuplicate?: (layout: PlateLayout, more: PlateLayout[]) => void;
  /** This plate is the copy just made from the one above it. */ copied?: boolean;
  initial: PlateLayout; experimentId?: string; onDone: (layout: PlateLayout, more: PlateLayout[]) => void; onCancel: () => void;
}) {
  const { t, locale } = useI18n();
  const zh = locale === "zh";
  const dialog = useModalDialog();
  const [history, setHistory] = useState<History>({ past: [], present: initial });
  const layout = history.present;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ text: string; tone?: "warning" } | null>(() => copied ? { text: zh ? "已复制。现在编辑的是副本，原来的板保存在它上方。" : "Copied. You are editing the copy; the original is just above it." } : null);
  const [more, setMore] = useState<PlateLayout[]>([]);
  const [picker, setPicker] = useState<{ anchor: HTMLElement; target: { field: string } | "fill" } | null>(null);
  const [fill, setFill] = useState<{ source: "experiment" | "picked" | "paste"; text: string; picked: RecordReference[]; order: PlateOrder; replicates: number; field: string }>(
    () => ({ source: experimentId ? "experiment" : "picked", text: "", picked: [], order: "N", replicates: 1, field: (initial.fields.find(isSampleField) ?? initial.fields[0]).id }));
  const [experimentSamples, setExperimentSamples] = useState<SampleChoice[] | null>(null);
  // Open at first for an empty plate; afterwards the person opens and closes it.
  const [fillOpen] = useState(() => !Object.keys(initial.wells).length);
  // A finger has no Shift or ⌘: tapping adds and removes wells.
  const [touch] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  const anchorWell = useRef<string | null>(null);
  const busy = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  // One run of typing in one field is one undo step.
  const typingField = useRef<string | null>(null);
  const changed = history.past.length > 0 || layout !== initial;

  const commit = (next: PlateLayout) => setHistory((current) => next === current.present ? current : { past: [...current.past.slice(-49), current.present], present: next });
  const edit = (patch: Partial<PlateLayout>) => setHistory((current) => ({ ...current, present: { ...current.present, ...patch } }));
  const undo = () => { typingField.current = null; setDrafts({}); setHistory(undoStep); };
  const selectedIds = useMemo(() => plateWellIds(layout.plateSize).filter((id) => selected.has(id)), [layout.plateSize, selected]);
  /** The field keeps the text as typed, spaces included; the wells take it trimmed, as it is typed. An input method's unfinished text stays in the field. */
  const typeValue = (fieldId: string, text: string, composing: boolean) => {
    setDrafts((current) => ({ ...current, [fieldId]: text }));
    if (composing) return;
    const sameRun = typingField.current === fieldId;
    typingField.current = fieldId;
    setHistory((current) => {
      const past = sameRun ? current.past : [...current.past.slice(-49), current.present];
      return { past, present: typePlateValue(past.at(-1)!, selectedIds, fieldId, text) };
    });
  };
  const endTyping = () => { typingField.current = null; setDrafts({}); };
  const select = (next: Set<string>) => { endTyping(); setSelected(next); };

  const cancel = async () => {
    if (busy.current) return;
    busy.current = true;
    const leave = !changed || await dialog.confirm({ title: t("Discard the changes to this plate?"), confirmLabel: t("Discard changes"), tone: "destructive" });
    busy.current = false;
    if (leave) onCancel();
  };
  const cancelRef = useRef(cancel);
  useEffect(() => { cancelRef.current = cancel; });
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      // The sample picker and the confirmations close themselves first.
      if (event.defaultPrevented || busy.current) return;
      if (event.key === "Escape") { event.preventDefault(); void cancelRef.current(); }
      const typing = event.target instanceof HTMLElement && event.target.closest("input, textarea, select");
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !event.shiftKey && !typing) { event.preventDefault(); typingField.current = null; setHistory(undoStep); }
    };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKey); };
  }, []);

  // Experiment samples for "fill in turn", asked for once the panel needs them.
  useEffect(() => {
    if (!experimentId || fill.source !== "experiment" || experimentSamples) return;
    const controller = new AbortController();
    fetch(`/api/references/search?${new URLSearchParams({ kind: "sample", experiment: experimentId })}`, { signal: controller.signal, cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(String(response.status))))
      .then((results: { experiment: SampleChoice[] }) => setExperimentSamples(results.experiment.filter((sample) => sample.role === "input")))
      .catch(() => { if (!controller.signal.aborted) setExperimentSamples([]); });
    return () => controller.abort();
  }, [experimentId, fill.source, experimentSamples]);

  const handlers: PlateGridHandlers = {
    selected,
    onWellDown: (id, event) => {
      // A finger taps wells in and out; a mouse drags a rectangle, Shift takes a range, ⌘/Ctrl adds.
      if (event.pointerType !== "mouse") {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id); else next.add(id);
        select(next);
        anchorWell.current = id;
        return;
      }
      if (event.button !== 0) return;
      event.preventDefault();
      const adding = event.metaKey || event.ctrlKey;
      if (event.shiftKey && anchorWell.current) {
        const range = plateWellRange(layout.plateSize, anchorWell.current, id);
        select(adding ? union(selected, range) : new Set(range));
        return;
      }
      if (adding && selected.has(id)) { const next = new Set(selected); next.delete(id); select(next); return; }
      const base = adding ? new Set(selected) : new Set<string>();
      anchorWell.current = id;
      select(union(base, [id]));
      // While dragging, only the rectangle changes.
      const move = (moveEvent: PointerEvent) => {
        const well = (document.elementFromPoint(moveEvent.clientX, moveEvent.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-well]")?.dataset.well;
        if (well) setSelected(union(base, plateWellsInRect(id, well)));
      };
      const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    onRow: (row, event) => { const ids = plateRowWells(layout.plateSize, row); select(event.shiftKey || event.metaKey || event.ctrlKey ? union(selected, ids) : new Set(ids)); },
    onColumn: (column, event) => { const ids = plateColumnWells(layout.plateSize, column); select(event.shiftKey || event.metaKey || event.ctrlKey ? union(selected, ids) : new Set(ids)); },
    onAll: () => select(selected.size === layout.plateSize ? new Set() : new Set(plateWellIds(layout.plateSize))),
  };

  const changeSize = async (value: string) => {
    const size = Number(value);
    if (!isPlateSize(size) || size === layout.plateSize) return;
    const { layout: next, dropped } = resizePlateLayout(layout, size);
    if (dropped) {
      busy.current = true;
      const ok = await dialog.confirm({ title: t("Change the plate size?"), description: zh ? `新板型没有其中 ${dropped} 个已填的孔，这些孔的内容会删除。` : `${dropped} filled wells are not on the new plate and will be cleared.`, confirmLabel: t("Change size"), tone: "destructive" });
      busy.current = false;
      if (!ok) return;
    }
    commit(layout.name.trim() === plateSizeName(layout.plateSize, zh) ? { ...next, name: plateSizeName(size, zh) } : next);
    select(new Set());
  };

  const fillValues = (): PlateWellValue[] => fill.source === "paste"
    ? fill.text.split("\n").map((line) => line.trim().slice(0, MAX_WELL_TEXT)).filter(Boolean)
    : fill.source === "picked" ? fill.picked.map((reference) => ({ sampleId: reference.id, label: reference.label }))
      : (experimentSamples ?? []).map((sample) => ({ sampleId: sample.id, label: sampleReferenceLabel(sample) }));
  const runFill = () => {
    const values = fillValues();
    if (!values.length) { setMessage({ text: zh ? "名单是空的。" : "The list is empty.", tone: "warning" }); return; }
    const targets = selectedIds.length ? selectedIds : plateWellIds(layout.plateSize);
    const result = fillPlateInOrder(layout, targets, fill.field, values, { order: fill.order, replicates: fill.replicates });
    commit(result.layout);
    endTyping();
    setMessage(result.leftover
      ? { text: zh ? `已填 ${result.filled} 孔；还有 ${result.leftover} 孔的内容放不下。` : `Filled ${result.filled} wells; ${result.leftover} more did not fit.`, tone: "warning" }
      : { text: zh ? `已填 ${result.filled} 孔。` : `Filled ${result.filled} wells.` });
  };

  const setField = (id: string, patch: Partial<PlateField>) => commit({ ...layout, fields: layout.fields.map((field) => field.id === id ? { ...field, ...patch } : field) });
  const removeField = (id: string) => {
    const fields = layout.fields.filter((field) => field.id !== id);
    const wells = Object.fromEntries(Object.entries(layout.wells).map(([well, values]) => { const rest = { ...values }; delete rest[id]; return [well, rest]; }).filter(([, values]) => Object.keys(values).length));
    commit({ ...layout, fields, wells, colorField: layout.colorField === id ? fields[0].id : layout.colorField });
    setDrafts((current) => { const others = { ...current }; delete others[id]; return others; });
    if (fill.field === id) setFill((current) => ({ ...current, field: fields[0].id }));
  };
  const addField = () => {
    let index = layout.fields.length + 1;
    while (layout.fields.some((field) => field.id === `field-${index}`)) index += 1;
    commit({ ...layout, fields: [...layout.fields, { id: `field-${index}`, name: zh ? `参数 ${index}` : `Parameter ${index}` }] });
  };

  const importBackup = async (file: File | undefined) => {
    if (!file) return;
    let plates: PlateLayout[] = [];
    try { plates = plateLayoutsFromPlannerBackup(JSON.parse(await file.text()), newPlateId); } catch { plates = []; }
    if (!plates.length) { setMessage({ text: zh ? "这个文件不是板布局规划器的项目备份。" : "This file is not a plate planner project backup.", tone: "warning" }); return; }
    if (Object.keys(layout.wells).length) {
      busy.current = true;
      const ok = await dialog.confirm({ title: t("Replace this plate with the imported one?"), confirmLabel: t("Replace"), tone: "destructive" });
      busy.current = false;
      if (!ok) return;
    }
    const [first, ...rest] = plates;
    commit({ ...first, id: layout.id, name: first.name || layout.name, caption: layout.caption });
    setMore(rest);
    select(new Set());
    setMessage({ text: rest.length ? (zh ? `已导入“${first.name}”；点完成后，另外 ${rest.length} 块板会接在这块板后面。` : `Imported “${first.name}”; the other ${rest.length} plates are added after this one when you click Done.`) : (zh ? `已导入“${first.name}”。` : `Imported “${first.name}”.`) });
  };
  const downloadBackup = () => {
    if (!PLANNER_PLATE_SIZES.includes(layout.plateSize)) { setMessage({ text: zh ? "板布局规划器没有 48 孔板，不能导出。" : "The plate planner has no 48-well plate.", tone: "warning" }); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify(plateLayoutsToPlannerBackup([layout], layout.name || "LabNest"), null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(layout.name || "plate").replace(/[\\/:*?"<>|]+/g, "_")}_workspace_backup.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const pickSamples = (references: RecordReference[]) => {
    const target = picker?.target;
    setPicker(null);
    if (!target || !references.length) return;
    if (target === "fill") { setFill((current) => ({ ...current, source: "picked", picked: references })); return; }
    commit(setPlateValue(layout, selectedIds, target.field, { sampleId: references[0].id, label: references[0].label }));
    endTyping();
  };

  const fillCount = fillValues().length * fill.replicates;
  return createPortal(<div className="ln-plate-editor-layer" role="presentation">
    <section className="ln-plate-editor" role="dialog" aria-modal="true" aria-label="Edit plate layout">
      <header>
        <input value={layout.name} onChange={(event) => edit({ name: event.target.value.slice(0, 80) })} aria-label="Plate name" placeholder="Plate name" />
        <select value={layout.plateSize} onChange={(event) => void changeSize(event.target.value)} aria-label="Plate size">
          {PLATE_SIZES.map((size) => <option key={size} value={size}>{plateSizeName(size, zh)}</option>)}
        </select>
        <button type="button" className="ln-plate-button focus-ring" disabled={!history.past.length} onClick={undo} aria-label="Undo"><Undo2 aria-hidden /></button>
        <button type="button" className="ln-plate-button focus-ring" onClick={() => void cancel()}>Cancel</button>
        {onOpenPlanner ? <button type="button" className="ln-plate-button focus-ring" onClick={() => onOpenPlanner({ ...layout, name: layout.name.trim() })}>{t("Open the plate planner")}</button> : null}
        {onDuplicate ? <button type="button" className="ln-plate-button focus-ring" onClick={() => onDuplicate({ ...layout, name: layout.name.trim() }, more)}><Copy aria-hidden />Duplicate plate</button> : null}
        <button type="button" className="ln-plate-button is-primary focus-ring" onClick={() => onDone({ ...layout, name: layout.name.trim() }, more)}>Done</button>
      </header>
      <div className="ln-plate-editor-body">
        <div className="ln-plate-editor-plate">
          <p className="ln-plate-editor-tools">
            <span>{zh ? <>已选 <strong>{selectedIds.length}</strong> 孔</> : <><strong>{selectedIds.length}</strong> wells selected</>}</span>
            <span>{touch
              ? (zh ? "轻点孔选中或取消；点行号或列号选整行整列。" : "Tap wells to add or remove them; row and column labels take the whole row or column.")
              : (zh ? "单击选孔，拖动框选，Shift 连选，⌘/Ctrl 加选；点行号或列号选整行整列。" : "Click a well, drag a rectangle, Shift for a range, ⌘/Ctrl to add; row and column labels take the whole row or column.")}</span>
          </p>
          <PlateLayoutGrid layout={layout} handlers={handlers} caption={false} />
          {layout.fields.length > 1 ? <div className="ln-plate-editor-row">
            <span>Colour by</span>
            <div className="ln-segmented" role="group" aria-label="Colour by">{layout.fields.map((field) => <button key={field.id} type="button" className="focus-ring" aria-pressed={layout.colorField === field.id} onClick={() => commit({ ...layout, colorField: field.id })} data-i18n-ignore>{field.name}</button>)}</div>
          </div> : null}
          {message ? <p className="ln-plate-editor-message" data-tone={message.tone} role="status">{message.text}</p> : null}
        </div>
        <aside className="ln-plate-editor-side">
          <section aria-label="Selected wells">
            <h3>{zh ? `所选的孔（${selectedIds.length}）` : `Selected wells (${selectedIds.length})`}</h3>
            {!selectedIds.length ? <p className="ln-plate-editor-hint">Select wells on the plate to give them values.</p> : null}
            {layout.fields.map((field) => { const shared = commonValue(layout, selectedIds, field.id); return <FieldInput key={field.id}
              field={field} common={shared.value} mixed={shared.mixed} draft={drafts[field.id]} disabled={!selectedIds.length} zh={zh}
              onType={(text, composing) => typeValue(field.id, text, composing)} onEnd={endTyping}
              onPickSample={isSampleField(field) ? (anchor) => setPicker({ anchor, target: { field: field.id } }) : undefined} />; })}
            <div className="ln-plate-editor-row">
              <button type="button" className="ln-plate-button focus-ring" disabled={!selectedIds.length} onClick={() => commit(clearPlateWells(layout, selectedIds))}><Eraser aria-hidden />Clear wells</button>
            </div>
          </section>
          <details open={fillOpen}>
            <summary>Fill in turn</summary>
            <div>
              <label><span>Names</span>
                <select value={fill.source} onChange={(event) => setFill((current) => ({ ...current, source: event.target.value as typeof fill.source }))}>
                  {experimentId ? <option value="experiment">This experiment&apos;s samples used</option> : null}
                  <option value="picked">Samples chosen from the library</option>
                  <option value="paste">A pasted list</option>
                </select>
              </label>
              {fill.source === "experiment" ? <p className="ln-plate-editor-hint">{experimentSamples === null ? "Loading…" : experimentSamples.length ? <span data-i18n-ignore>{experimentSamples.map((sample) => sample.code).join("、")}</span> : "This experiment has no samples used yet."}</p> : null}
              {fill.source === "picked" ? <div className="ln-plate-editor-row">
                <button type="button" className="ln-plate-button focus-ring" onClick={(event) => setPicker({ anchor: event.currentTarget, target: "fill" })}><TestTube aria-hidden />Choose samples…</button>
                {fill.picked.length ? <span data-i18n-ignore>{fill.picked.map((reference) => reference.label).join("、")}</span> : null}
              </div> : null}
              {fill.source === "paste" ? <label><span>One per line</span><textarea rows={4} value={fill.text} onChange={(event) => setFill((current) => ({ ...current, text: event.target.value }))} data-i18n-ignore /></label> : null}
              <div className="ln-plate-editor-row">
                <label><span>Parameter</span><select value={fill.field} onChange={(event) => setFill((current) => ({ ...current, field: event.target.value }))}>{layout.fields.map((field) => <option key={field.id} value={field.id}>{field.name}</option>)}</select></label>
                <label><span>Order</span><select value={fill.order} onChange={(event) => setFill((current) => ({ ...current, order: event.target.value as PlateOrder }))}><option value="N">N · down each column</option><option value="Z">Z · along each row</option></select></label>
                <label><span>Each repeated</span><select value={fill.replicates} onChange={(event) => setFill((current) => ({ ...current, replicates: Number(event.target.value) }))}>{[1, 2, 3, 4].map((count) => <option key={count} value={count}>{`× ${count}`}</option>)}</select></label>
              </div>
              <button type="button" className="ln-plate-button focus-ring" disabled={!fillCount} onClick={runFill}>
                {zh ? `填入${selectedIds.length ? "所选" : "整块板"}（${fillCount} 孔）` : `Fill ${selectedIds.length ? "the selected wells" : "the plate"} (${fillCount} wells)`}
              </button>
              {!fillCount && fill.source !== "experiment" ? <p className="ln-plate-editor-hint">{fill.source === "picked" ? "Choose samples first, then fill." : "Paste the names first, one per line, then fill."}</p> : null}
            </div>
          </details>
          <details>
            <summary>Parameters</summary>
            <div>
              {layout.fields.map((field) => <div key={field.id} className="ln-plate-editor-param">
                <input defaultValue={field.name} aria-label="Parameter name" maxLength={30} onBlur={(event) => { const name = event.target.value.trim(); if (name && name !== field.name) setField(field.id, { name }); }} />
                <input defaultValue={field.unit ?? ""} aria-label="Unit" placeholder="Unit" maxLength={16} onBlur={(event) => { const unit = event.target.value.trim(); if (unit !== (field.unit ?? "")) setField(field.id, { unit: unit || undefined }); }} />
                <button type="button" className="ln-plate-button focus-ring" disabled={layout.fields.length < 2} aria-label="Remove parameter" onClick={() => removeField(field.id)}><Trash2 aria-hidden /></button>
              </div>)}
              <button type="button" className="ln-plate-button focus-ring" disabled={layout.fields.length >= MAX_PLATE_FIELDS} onClick={addField}><Plus aria-hidden />Add parameter</button>
              {layout.fields.length < 2 ? <p className="ln-plate-editor-hint">A plate keeps at least one parameter.</p> : null}
              {layout.fields.length >= MAX_PLATE_FIELDS ? <p className="ln-plate-editor-hint">{zh ? `一块板最多 ${MAX_PLATE_FIELDS} 个参数，已达上限。` : `A plate holds at most ${MAX_PLATE_FIELDS} parameters.`}</p> : null}
            </div>
          </details>
          <details>
            <summary>Plate planner</summary>
            <div>
              <p className="ln-plate-editor-hint">Backup files for offline use of the plate planner.</p>
              <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={(event) => { void importBackup(event.target.files?.[0]); event.target.value = ""; }} />
              <div className="ln-plate-editor-row">
                <button type="button" className="ln-plate-button focus-ring" onClick={() => fileInput.current?.click()}><Upload aria-hidden />Import a backup…</button>
                <button type="button" className="ln-plate-button focus-ring" onClick={downloadBackup}><Download aria-hidden />Download as backup</button>
              </div>
            </div>
          </details>
          <label><span>Note</span><textarea rows={2} value={layout.caption ?? ""} onChange={(event) => edit({ caption: event.target.value.slice(0, 1000) || undefined })} data-i18n-ignore /></label>
        </aside>
      </div>
    </section>
    {picker ? <ReferencePicker kind="sample" anchor={picker.anchor} experimentId={experimentId} multiple={picker.target === "fill"} onInsert={pickSamples} onClose={() => setPicker(null)} /> : null}
  </div>, document.body);
}

/** The value the chosen wells share for one parameter, or that they differ. */
function commonValue(layout: PlateLayout, wellIds: string[], fieldId: string) {
  const values = wellIds.map((id) => layout.wells[id]?.[fieldId]);
  const keys = new Set(values.map((value) => value === undefined ? "" : plateValueKey(value)));
  return { value: keys.size === 1 ? values[0] : undefined, mixed: keys.size > 1 };
}

/** One parameter's value in the chosen wells: what is typed reaches them at once. */
function FieldInput({ field, common, mixed, draft, disabled, zh, onType, onEnd, onPickSample }: {
  field: PlateField; common: PlateWellValue | undefined; mixed: boolean; draft: string | undefined; disabled: boolean; zh: boolean;
  onType: (value: string, composing: boolean) => void; onEnd: () => void; onPickSample?: (anchor: HTMLElement) => void;
}) {
  return <label>
    <span>{field.name}{field.unit ? ` (${field.unit})` : ""}</span>
    {common && typeof common !== "string" && draft === undefined ? <span><RecordReferenceTag kind="sample" label={common.label} /></span> : null}
    <span className="ln-plate-editor-field">
      <input value={draft ?? plateValueText(common)} disabled={disabled} maxLength={MAX_WELL_TEXT} placeholder={mixed ? (zh ? "多个值" : "Several values") : ""}
        onChange={(event) => onType(event.target.value, (event.nativeEvent as InputEvent).isComposing)} onCompositionEnd={(event) => onType(event.currentTarget.value, false)}
        onBlur={onEnd} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); onEnd(); } }} />
      {onPickSample ? <button type="button" className="ln-plate-button focus-ring" disabled={disabled} onClick={(event) => onPickSample(event.currentTarget)}><TestTube aria-hidden />Samples…</button> : null}
    </span>
  </label>;
}

type History = { past: PlateLayout[]; present: PlateLayout };
const undoStep = (current: History): History => current.past.length ? { past: current.past.slice(0, -1), present: current.past.at(-1)! } : current;
