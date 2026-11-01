"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { ExternalLink, Package, TestTube } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { lotReferenceLabel, recordReferenceHref, sampleReferenceLabel, type RecordReference, type RecordReferenceKind } from "@/lib/record-references";
import type { ReferenceDetails } from "@/lib/record-references.server";
import { sampleStatusLabels } from "@/lib/samples";
import { useAnchoredPosition } from "./protocol/popover";
import { useRecordReferenceDetails } from "./useRecordReferenceDetails";
import "./record-references.css";

const kinds = new Set<RecordReferenceKind>(["sample", "product", "lot"]);
const openLabels: Record<RecordReferenceKind, string> = { sample: "Open sample", product: "Open product", lot: "Open lot" };
const objectStatus: Record<string, string> = { active: "Active", inactive: "Inactive", archived: "Archived" };

/** The tag itself: an icon for its kind and the label written when it was inserted. Deleted records read struck through (Q252). */
export function RecordReferenceTag({ kind, label, missing }: { kind: RecordReferenceKind; label: string; missing?: boolean }) {
  const Icon = kind === "sample" ? TestTube : Package;
  return <span className="ln-record-ref" data-kind={kind} data-missing={missing ? "" : undefined}><Icon aria-hidden /><span data-i18n-ignore>{label}</span></span>;
}

/** The label the record would get now, to show a rename. */
function currentLabel(details: ReferenceDetails, lotWord: string) {
  if (details.kind === "sample") return sampleReferenceLabel(details);
  if (details.kind === "product") return details.name;
  return lotReferenceLabel(details, lotWord);
}

function Facts({ details }: { details: ReferenceDetails }) {
  const row = (label: string, value: string | null | undefined) => value ? <p><span>{label}</span> <span data-i18n-ignore>{value}</span></p> : null;
  if (details.kind === "sample") return <>
    <p><span data-i18n-ignore>{details.type}</span> · <span>{sampleStatusLabels[details.status as keyof typeof sampleStatusLabels] ?? details.status}</span></p>
    {row("Place", details.place)}{row("Amount", details.amount)}{row("Concentration", details.concentration)}{row("Origin", details.origin)}{row("Parent sample", details.parentCode)}
  </>;
  if (details.kind === "product") return <>
    {details.brand || details.catalogNumber ? <p data-i18n-ignore>{[details.brand, details.catalogNumber].filter(Boolean).join(" · ")}</p> : null}
    {row("Stock", details.stock ?? "—")}
    <p><span>Active lots</span> <span>{details.lots}</span></p>
    {details.status !== "active" ? <p><span>{objectStatus[details.status] ?? details.status}</span></p> : null}
  </>;
  return <>
    {row("Lot number", details.lotNumber)}{row("Place", details.place)}{row("Stock", details.quantity)}{row("Expiry date", details.expiry)}
    {details.usedUp ? <p><span>Used up</span></p> : null}
    {details.status !== "active" ? <p><span>{objectStatus[details.status] ?? details.status}</span></p> : null}
  </>;
}

/** The card a tag opens: the record as it stands now, a rename, or that it was deleted. Links open in a new tab, so the page being written stays. */
export function RecordReferenceCard({ reference, anchor, onPointerEnter, onPointerLeave }: { reference: RecordReference; anchor: HTMLElement; onPointerEnter?: () => void; onPointerLeave?: () => void }) {
  const { t } = useI18n();
  const panel = useRef<HTMLDivElement>(null);
  // Opening the card asks again once the page's answer is a minute old.
  const { loading, details, missing } = useRecordReferenceDetails(reference.kind, reference.id);
  const style = useAnchoredPosition(anchor, panel, [loading, missing]);
  const now = details ? currentLabel(details, t("Lot number")) : undefined;
  return createPortal(<div ref={panel} className="ln-record-ref-card" style={style} role="dialog" aria-label={reference.label} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
    <strong data-i18n-ignore>{now ?? reference.label}</strong>
    {now && now !== reference.label ? <p className="ln-record-ref-renamed"><span>Written as</span> <span data-i18n-ignore>{reference.label}</span></p> : null}
    {missing ? <p className="ln-record-ref-gone">This record was deleted.</p> : details ? <Facts details={details} /> : loading ? <p>Loading…</p> : <p>The current details could not be loaded.</p>}
    {missing ? null : <a className="focus-ring" href={recordReferenceHref(reference.kind, reference.id)} target="_blank" rel="noreferrer">{openLabels[reference.kind]}<ExternalLink aria-hidden /></a>}
  </div>, document.body);
}

/** Hover (or keyboard focus, or a tap that selects the tag) opens the card; leaving the tag and the card closes it. */
function useCardHover() {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedule = (next: boolean, delay: number) => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(next), delay); };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return {
    open,
    enter: (event?: React.PointerEvent) => { if (!event || event.pointerType === "mouse") schedule(true, 350); },
    leave: () => schedule(false, 200),
    keep: () => { if (timer.current) clearTimeout(timer.current); },
  };
}

/** A tag in a read-only page: a link to the record, struck through once the record is deleted. */
export function RecordReferenceLink({ kind, id, label }: RecordReference) {
  const { missing } = useRecordReferenceDetails(kind, id);
  const [anchor, setAnchor] = useState<HTMLAnchorElement | null>(null);
  const hover = useCardHover();
  return <>
    <a ref={setAnchor} href={recordReferenceHref(kind, id)} className="ln-record-ref-link focus-ring" data-record-reference="" data-kind={kind} data-id={id} onPointerEnter={hover.enter} onPointerLeave={hover.leave} onFocus={() => hover.enter()} onBlur={hover.leave}>
      <RecordReferenceTag kind={kind} label={label} missing={missing} />
    </a>
    {hover.open && anchor ? <RecordReferenceCard reference={{ kind, id, label }} anchor={anchor} onPointerEnter={hover.keep} onPointerLeave={hover.leave} /> : null}
  </>;
}

function ReferenceNodeView({ node, selected }: NodeViewProps) {
  const reference = { kind: node.attrs.kind as RecordReferenceKind, id: String(node.attrs.id ?? ""), label: String(node.attrs.label ?? "") };
  const { missing } = useRecordReferenceDetails(reference.kind, reference.id);
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null);
  const hover = useCardHover();
  return <NodeViewWrapper as="span" className="ln-record-ref-node" data-selected={selected ? "" : undefined}>
    <span ref={setAnchor} onPointerEnter={hover.enter} onPointerLeave={hover.leave}><RecordReferenceTag kind={reference.kind} label={reference.label} missing={missing} /></span>
    {(hover.open || selected) && anchor ? <RecordReferenceCard reference={reference} anchor={anchor} onPointerEnter={hover.keep} onPointerLeave={hover.leave} /> : null}
  </NodeViewWrapper>;
}

/** "/样本" and "/库存物品" insert this: one unit, deleted with one backspace, saved as a Markdown link (Q249). */
export const RecordReferenceNode = Node.create({
  name: "recordReference",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,
  marks: "",
  addAttributes() {
    // Written by renderHTML below; as plain attributes "id" would collide with the page's element IDs.
    return {
      kind: { default: "sample", rendered: false, parseHTML: (element) => kinds.has(element.getAttribute("data-kind") as RecordReferenceKind) ? element.getAttribute("data-kind") : "sample" },
      id: { default: "", rendered: false, parseHTML: (element) => element.getAttribute("data-id") ?? "" },
      label: { default: "", rendered: false, parseHTML: (element) => element.textContent?.trim() ?? "" },
    };
  },
  // Copied tags, from an editor or a read-only page, paste as tags rather than links.
  parseHTML() { return [{ tag: "a[data-record-reference]", priority: 100 }]; },
  renderHTML({ node, HTMLAttributes }) {
    return ["a", mergeAttributes(HTMLAttributes, { "data-record-reference": "", "data-kind": node.attrs.kind, "data-id": node.attrs.id, href: recordReferenceHref(node.attrs.kind, node.attrs.id) }), node.attrs.label];
  },
  renderText({ node }) { return String(node.attrs.label ?? ""); },
  addNodeView() { return ReactNodeViewRenderer(ReferenceNodeView, { as: "span" }); },
});
