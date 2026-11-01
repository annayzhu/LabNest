"use client";

import { createContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Package, Search, TestTube } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { lotReferenceLabel, sampleReferenceLabel, type RecordReference } from "@/lib/record-references";
import type { LotChoice, ProductChoice, SampleChoice } from "@/lib/record-references.server";
import { sampleStatusLabels } from "@/lib/samples";
import { useAnchoredPosition, useDismiss, type PopoverAnchor } from "./protocol/popover";
import "./editor-command-menu.css";
import "./record-references.css";

/** The record a document belongs to, so "/样本" can offer that experiment's samples first (Q251). */
export const ReferenceScope = createContext<{ experimentId?: string }>({});

export type ReferencePickerKind = "sample" | "inventory";
type Row =
  | { type: "header"; key: string; label: string }
  | { type: "choice"; key: string; reference: RecordReference; choice: SampleChoice | ProductChoice | LotChoice; nested?: boolean };
type SampleResults = { experiment: SampleChoice[]; others: SampleChoice[]; types: Array<{ id: string; label: string }> };
type InventoryResults = { products: ProductChoice[]; lots: LotChoice[] };

/**
 * What "/样本" and "/库存物品" open in place of the "/" menu: search, then click or Enter to insert one; tick rows (or
 * Shift+Enter) to insert several at once, joined by "、". Nothing is created here (Q251).
 */
export function ReferencePicker({ kind, anchor, experimentId, multiple = true, onInsert, onClose }: {
  kind: ReferencePickerKind; anchor: PopoverAnchor; experimentId?: string; multiple?: boolean;
  onInsert: (references: RecordReference[]) => void; onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [typeId, setTypeId] = useState("");
  const [inStorage, setInStorage] = useState(false);
  const [active, setActive] = useState(0);
  const [checked, setChecked] = useState<Map<string, RecordReference>>(new Map());
  const { results, error, loading } = useSearch(kind, query, typeId, inStorage, experimentId);
  const panel = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [sheet] = useState(() => window.matchMedia("(max-width: 639px)").matches);
  // As tall as the larger room above or below the caret allows, so the footer is never off-screen.
  const [maxHeight] = useState(() => {
    const rect = anchor instanceof HTMLElement ? anchor.getBoundingClientRect() : anchor;
    return Math.min(480, Math.max(220, window.innerHeight - rect.bottom - 16, rect.top - 16));
  });
  const lotWord = t("Lot number");

  const rows = useMemo<Row[]>(() => {
    if (!results) return [];
    if (kind === "sample") {
      const { experiment, others } = results as SampleResults;
      const sampleRow = (sample: SampleChoice): Row => ({ type: "choice", key: `sample:${sample.id}`, choice: sample, reference: { kind: "sample", id: sample.id, label: sampleReferenceLabel(sample) } });
      return [
        ...(experiment.length ? [{ type: "header" as const, key: "h-experiment", label: "This experiment" }, ...experiment.map(sampleRow)] : []),
        ...(others.length ? [{ type: "header" as const, key: "h-others", label: experiment.length ? "Other samples" : "Samples" }, ...others.map(sampleRow)] : []),
      ];
    }
    const { products, lots } = results as InventoryResults;
    const lotRow = (lot: LotChoice, nested: boolean): Row => ({ type: "choice", key: `lot:${lot.id}`, choice: lot, nested, reference: { kind: "lot", id: lot.id, label: lotReferenceLabel(lot, lotWord) } });
    return [
      ...products.flatMap((product): Row[] => [{ type: "choice", key: `product:${product.id}`, choice: product, reference: { kind: "product", id: product.id, label: product.name } }, ...product.lots.map((lot) => lotRow(lot, true))]),
      ...(lots.length ? [{ type: "header" as const, key: "h-loose", label: "Stock without a product" }, ...lots.map((lot) => lotRow(lot, false))] : []),
    ];
  }, [results, kind, lotWord]);
  const choices = rows.filter((row): row is Extract<Row, { type: "choice" }> => row.type === "choice");
  const [seenRows, setSeenRows] = useState(rows);
  if (seenRows !== rows) { setSeenRows(rows); setActive(0); }

  const style = useAnchoredPosition(sheet ? null : anchor, panel, [rows.length, checked.size]);
  useDismiss(panel, null, onClose);
  // The panel is hidden until placed, and a hidden field cannot take focus; the search field takes it once the panel shows.
  const shown = sheet || style.visibility === "visible";
  useEffect(() => { if (shown) input.current?.focus(); }, [shown]);
  useEffect(() => { list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active]);

  const toggle = (reference: RecordReference) => setChecked((current) => {
    const next = new Map(current), key = `${reference.kind}:${reference.id}`;
    if (next.has(key)) next.delete(key); else next.set(key, reference);
    return next;
  });
  const choose = (reference: RecordReference) => {
    if (multiple && checked.size) toggle(reference);
    else onInsert([reference]);
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && choices.length) {
      event.preventDefault();
      setActive((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + choices.length) % choices.length);
    } else if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      const current = choices[active]?.reference;
      if (event.shiftKey && multiple && current) toggle(current);
      else if (checked.size) onInsert([...checked.values()]);
      else if (current) onInsert([current]);
    }
  };

  const empty = kind === "sample" ? "No matching samples" : "No matching stock";
  const registerHref = kind === "sample" ? "/samples/new" : "/inventory/new";
  let index = -1;
  return createPortal(<div ref={panel} className="ln-reference-picker" data-sheet={sheet ? "" : undefined} style={sheet ? undefined : { ...style, maxHeight }} role="dialog" aria-label={kind === "sample" ? "Insert a sample" : "Insert an inventory item"}>
    <div className="ln-reference-picker-search">
      <Search aria-hidden />
      <input ref={input} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onKeyDown} aria-label="Search"
        placeholder={kind === "sample" ? "Code, name or origin" : "Name, brand, catalog or lot number"} />
    </div>
    {kind === "sample" && results ? <div className="ln-reference-picker-filters">
      <select aria-label="Sample type" value={typeId} onChange={(event) => setTypeId(event.target.value)}>
        <option value="">All types</option>
        {(results as SampleResults).types.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
      </select>
      <label><input type="checkbox" checked={inStorage} onChange={(event) => setInStorage(event.target.checked)} /> In storage only</label>
    </div> : null}
    <div ref={list} className="ln-reference-picker-list" role="listbox" aria-label={kind === "sample" ? "Samples" : "Inventory"} aria-multiselectable={multiple}>
      {rows.map((row) => {
        if (row.type === "header") return <p key={row.key} className="ln-insert-group">{row.label}</p>;
        index += 1;
        const rowIndex = index, isChecked = checked.has(row.key);
        return <div key={row.key} className="ln-reference-row" data-nested={row.nested ? "" : undefined} data-index={rowIndex} aria-selected={rowIndex === active} role="option" onMouseEnter={() => setActive(rowIndex)}>
          {multiple ? <button type="button" className="ln-reference-check focus-ring" role="checkbox" aria-checked={isChecked} aria-label="Select" onMouseDown={(event) => event.preventDefault()} onClick={() => toggle(row.reference)}>{isChecked ? <Check aria-hidden /> : null}</button> : null}
          <button type="button" className="ln-reference-choice focus-ring" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(row.reference)}><ChoiceText choice={row.choice} nested={row.nested} /></button>
        </div>;
      })}
      {!rows.length && !loading ? <p className="ln-insert-empty">{error === "offline" ? "Searching needs a connection to LabNest." : error ? "The search failed. Try again." : <>{empty} · <a href={registerHref} target="_blank" rel="noreferrer">{kind === "sample" ? "Register samples" : "Add stock"}</a></>}</p> : null}
      {!rows.length && loading ? <p className="ln-insert-empty">Searching…</p> : null}
    </div>
    <div className="ln-reference-picker-foot">
      {checked.size ? <><button type="button" className="focus-ring" onMouseDown={(event) => event.preventDefault()} onClick={() => setChecked(new Map())}>Clear</button>
        <button type="button" className="focus-ring is-primary" onMouseDown={(event) => event.preventDefault()} onClick={() => onInsert([...checked.values()])}>{locale === "zh" ? `插入 ${checked.size} 个` : `Insert ${checked.size}`}</button></>
        : <p className="ln-insert-keys" aria-hidden><span><kbd>↵</kbd>Insert</span>{multiple ? <span><kbd>⇧</kbd><kbd>↵</kbd>Select several</span> : null}<span><kbd>Esc</kbd>Close</span></p>}
    </div>
  </div>, document.body);
}

function ChoiceText({ choice, nested }: { choice: SampleChoice | ProductChoice | LotChoice; nested?: boolean }) {
  if (choice.kind === "sample") return <>
    <TestTube aria-hidden />
    <span><strong data-i18n-ignore><span className="ln-reference-code">{choice.code}</span> {choice.name !== choice.code ? choice.name : ""}</strong>
      <small><span data-i18n-ignore>{[choice.type, choice.place].filter(Boolean).join(" · ")}</span>{choice.status !== "available" ? <em>{sampleStatusLabels[choice.status as keyof typeof sampleStatusLabels] ?? choice.status}</em> : null}{choice.role ? <em>{choice.role === "input" ? "Used here" : "Produced here"}</em> : null}</small></span>
  </>;
  if (choice.kind === "product") return <>
    <Package aria-hidden />
    <span><strong data-i18n-ignore>{choice.name}</strong>
      <small><span data-i18n-ignore>{[choice.brand, choice.catalogNumber].filter(Boolean).join(" · ")}</span>{choice.stock ? <span data-i18n-ignore>{choice.stock}</span> : <em>No stock</em>}</small></span>
  </>;
  // A lot under its product names only itself; stock without a product names what it is.
  return <>
    {nested ? <span className="ln-reference-lot-mark" aria-hidden /> : <Package aria-hidden />}
    <span><strong>{nested ? null : <span data-i18n-ignore>{`${choice.productName} · `}</span>}{choice.lotNumber ? <><span>Lot number</span> <span data-i18n-ignore>{choice.lotNumber}</span></> : <span>No lot number</span>}</strong>
      <small><span data-i18n-ignore>{[choice.place, choice.quantity, choice.expiry].filter(Boolean).join(" · ")}</span>{choice.usedUp ? <em>Used up</em> : null}</small></span>
  </>;
}

/** The picker's search, asked of the server a moment after typing stops; an older answer never replaces a newer one. */
function useSearch(kind: ReferencePickerKind, query: string, typeId: string, inStorage: boolean, experimentId?: string) {
  const [state, setState] = useState<{ results?: SampleResults | InventoryResults; error?: "offline" | "failed"; loading: boolean }>({ loading: true });
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ kind, q: query.trim(), ...(kind === "sample" ? { type: typeId, inStorage: inStorage ? "1" : "", experiment: experimentId ?? "" } : {}) });
    // Typing waits a moment so each letter does not search on its own.
    const timer = setTimeout(() => {
      setState((current) => ({ ...current, loading: true }));
      fetch(`/api/references/search?${params}`, { signal: controller.signal, cache: "no-store" })
        .then((response) => response.ok ? response.json() : Promise.reject(new Error(String(response.status))))
        .then((results) => setState({ results, loading: false }))
        .catch(() => { if (!controller.signal.aborted) setState({ error: navigator.onLine === false ? "offline" : "failed", loading: false }); });
    }, query ? 180 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [kind, query, typeId, inStorage, experimentId]);
  return state;
}
