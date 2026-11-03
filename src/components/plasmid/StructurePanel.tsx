"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { saveStructure } from "@/app/tools/plasmid/actions";
import { Button } from "@/components/ui/Button";
import { checkStructure, type CheckStatus, type StructureCheckItem } from "@/lib/plasmid/fusion";
import type { LibraryElement } from "@/lib/plasmid/feature-library";
import type { SequenceRecord } from "@/lib/plasmid/model";
import type { StoredStructureElement } from "@/lib/plasmid/structure.server";

export const itemLabels: Record<StructureCheckItem["id"], string> = { present: "Present anywhere", "in-frame": "In frame", order: "In order", gap: "Gap", "no-stop": "No stop before it", "junction-quality": "Junction quality" };
export const statusLabels: Record<CheckStatus, string> = { pass: "✓ Pass", fail: "✗ Fail", unknown: "? Unknown", "not-applicable": "— Not applicable" };

/**
 * 期望结构 (Q277, Q360, Q361): what the plasmid should encode on the left, what this sequence actually holds on the right;
 * the two never overwrite each other. The structure is kept on the plasmid product when there is one.
 */
export function StructurePanel({ record, quality, productId, initial, peptides, selectionPeptide }: {
  record: SequenceRecord;
  /** Phred values when the open item is a read, for the junction-quality items. */
  quality?: number[] | null;
  productId?: string;
  initial: StoredStructureElement[];
  /** Peptides to pick an element from: tags and coding entries of the library. */
  peptides: LibraryElement[];
  /** Translation of the selected CDS or bases, offered as an element. */
  selectionPeptide?: { name: string; protein: string };
}) {
  const [elements, setElements] = useState<StoredStructureElement[]>(initial);
  const [saved, setSaved] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const usable = elements.filter((element) => element.name.trim() && element.protein.some((value) => value.trim()));
  const check = useMemo(() => (usable.length ? checkStructure({ sequence: record.sequence, quality, elements: usable }) : undefined), [record.sequence, quality, usable]);

  const update = (index: number, change: Partial<StoredStructureElement>) => {
    setSaved(undefined);
    setElements((list) => list.map((element, at) => (at === index ? { ...element, ...change } : element)));
  };
  const move = (index: number, by: number) => setElements((list) => {
    const next = [...list];
    const [element] = next.splice(index, 1);
    next.splice(index + by, 0, element);
    return next;
  });
  const add = (element: StoredStructureElement) => {
    setSaved(undefined);
    setElements((list) => [...list, element]);
  };
  const save = () => startTransition(async () => {
    if (!productId) return;
    setError(undefined);
    const result = await saveStructure(productId, usable.map((element) => ({ ...element, protein: element.protein.map((value) => value.trim()).filter(Boolean) })));
    if (result.error) setError(result.error);
    else setSaved("Saved on the plasmid.");
  });

  return (
    <div className="ln-pw-structure">
      <section aria-label="Expected structure">
        <h3>Expected structure</h3>
        <p className="ln-pw-note">Elements from N to C. Each must be in the same reading frame as the first, in order, with no stop before it.</p>
        <ol className="ln-pw-elements">
          {elements.map((element, index) => (
            <li key={index}>
              <div className="ln-pw-element-head">
                <input className="ln-pw-input" value={element.name} aria-label="Element name" onChange={(event) => update(index, { name: event.target.value })} />
                <button type="button" className="ln-pw-icon" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp className="h-3.5 w-3.5" aria-hidden /></button>
                <button type="button" className="ln-pw-icon" aria-label="Move down" disabled={index === elements.length - 1} onClick={() => move(index, 1)}><ArrowDown className="h-3.5 w-3.5" aria-hidden /></button>
                <button type="button" className="ln-pw-icon" aria-label="Remove the element" onClick={() => setElements((list) => list.filter((_, at) => at !== index))}><X className="h-3.5 w-3.5" aria-hidden /></button>
              </div>
              <textarea
                className="ln-pw-input ln-pw-mono"
                rows={Math.min(4, Math.max(1, element.protein.length))}
                value={element.protein.join("\n")}
                aria-label="Peptides, one accepted form per line"
                data-i18n-ignore
                onChange={(event) => update(index, { protein: event.target.value.toUpperCase().split("\n") })}
              />
              {index > 0 ? (
                <label className="ln-pw-inline-field">
                  <span>Most amino acids after the previous element</span>
                  <input className="ln-pw-input" type="number" min={0} value={element.maxGapBefore ?? ""} placeholder="Any" onChange={(event) => update(index, { maxGapBefore: event.target.value === "" ? undefined : Math.max(0, Number(event.target.value)) })} />
                </label>
              ) : null}
            </li>
          ))}
        </ol>
        <div className="ln-pw-actions">
          <select className="ln-pw-input ln-pw-narrow" value="" aria-label="Add a tag or protein from the library" onChange={(event) => {
            const peptide = peptides.find((item) => item.id === event.target.value);
            if (peptide) add({ name: peptide.name, protein: [peptide.sequence] });
          }}>
            <option value="">Add from the library…</option>
            {peptides.map((peptide) => <option key={peptide.id} value={peptide.id}>{peptide.name}</option>)}
          </select>
          {selectionPeptide ? <Button type="button" variant="secondary" size="sm" onClick={() => add({ name: selectionPeptide.name, protein: [selectionPeptide.protein] })}><Plus className="h-3.5 w-3.5" aria-hidden />Add the translation of the selection</Button> : null}
          <Button type="button" variant="ghost" size="sm" onClick={() => add({ name: "", protein: [""] })}><Plus className="h-3.5 w-3.5" aria-hidden />Type an element</Button>
        </div>
        {productId ? (
          <div className="ln-pw-actions">
            <Button type="button" variant="primary" size="sm" disabled={pending} onClick={save}>{pending ? "Saving…" : "Save on the plasmid"}</Button>
            {saved ? <span className="ln-pw-ok" role="status">{saved}</span> : null}
            {error ? <span className="ln-pw-error" role="alert">{error}</span> : null}
          </div>
        ) : <p className="ln-pw-note">Save the sequence to a plasmid in inventory to keep this structure with it.</p>}
      </section>

      <section aria-label="What this sequence holds">
        <h3>What this sequence holds</h3>
        {!check ? <p className="ln-pw-note">Add elements to check them against this sequence.</p> : (
          <>
            <p className={check.arrangementFound ? "ln-pw-ok" : "ln-pw-error"}>{check.arrangementFound ? "✓ The expected arrangement is in this sequence." : "✗ The expected arrangement is not in this sequence."}</p>
            <ul className="ln-pw-checks">
              {usable.map((element) => (
                <li key={element.name}>
                  <strong data-i18n-ignore>{element.name}</strong>
                  <dl>
                    {check.items.filter((item) => item.element === element.name).map((item) => (
                      <div key={item.id} data-status={item.status}>
                        <dt>{itemLabels[item.id]}</dt>
                        <dd><span>{statusLabels[item.status]}</span>{item.detail ? <small>{item.detail}</small> : null}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
