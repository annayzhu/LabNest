"use client";

import { useActionState, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { saveProtocolDocument, type ProtocolEditorState } from "@/app/protocols/[id]/versions/[versionId]/edit/actions";
import {
  protocolSectionLabels,
  type ProtocolContentBlock,
  type ProtocolDocument,
  type ProtocolSectionKey,
} from "@/lib/protocol-document";

const initialState: ProtocolEditorState = {};
const inputClass = "focus-ring mt-2 h-10 w-full rounded-[8px] border border-hairline bg-warm px-3 text-sm text-ink";
const textareaClass = "focus-ring mt-2 min-h-24 w-full resize-y rounded-[8px] border border-hairline bg-warm p-3 text-sm leading-6 text-ink";

function uniqueBlockId(sectionKey: ProtocolSectionKey) {
  return `${sectionKey}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function tsvToRows(value: string) {
  return value.split("\n").map((line) => line.split("\t"));
}

function BlockEditor({
  block,
  onChange,
  onMove,
  onRemove,
}: {
  block: ProtocolContentBlock;
  onChange: (block: ProtocolContentBlock) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-[9px] border border-hairline bg-surface p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{block.type}</span>
        <div className="flex gap-1">
          <button type="button" onClick={() => onMove(-1)} aria-label="Move block up" className="focus-ring rounded-[6px] p-1.5 text-muted hover:bg-stone"><ChevronUp className="h-4 w-4" /></button>
          <button type="button" onClick={() => onMove(1)} aria-label="Move block down" className="focus-ring rounded-[6px] p-1.5 text-muted hover:bg-stone"><ChevronDown className="h-4 w-4" /></button>
          <button type="button" onClick={onRemove} aria-label="Remove block" className="focus-ring rounded-[6px] p-1.5 text-error hover:bg-error-surface"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>

      {block.type === "heading" ? <input value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} className={inputClass} /> : null}
      {block.type === "text" ? <textarea value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} className={textareaClass} /> : null}
      {block.type === "checklist" ? <textarea value={block.items.join("\n")} onChange={(event) => onChange({ ...block, items: event.target.value.split("\n") })} className={textareaClass} placeholder="One checklist item per line" /> : null}
      {block.type === "callout" ? (
        <div className="grid gap-3 md:grid-cols-[160px_1fr]">
          <select value={block.tone} onChange={(event) => onChange({ ...block, tone: event.target.value as "note" | "warning" | "critical" })} className={inputClass}><option value="note">Note</option><option value="warning">Warning</option><option value="critical">Critical</option></select>
          <textarea value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} className={textareaClass} />
        </div>
      ) : null}
      {block.type === "table" ? (
        <div className="space-y-2">
          <input value={block.caption ?? ""} onChange={(event) => onChange({ ...block, caption: event.target.value })} className={inputClass} placeholder="Table caption" />
          <textarea value={block.rows.map((row) => row.join("\t")).join("\n")} onChange={(event) => onChange({ ...block, rows: tsvToRows(event.target.value) })} className={`${textareaClass} min-h-40 font-mono text-xs`} placeholder="Paste tab-separated cells; one row per line" />
        </div>
      ) : null}
    </div>
  );
}

export function ProtocolDocumentEditor({
  protocol,
  version,
  initialDocument,
  suggestedDisplayVersion,
}: {
  protocol: { id: string; canonicalTitle: string; shortTitle?: string; englishTitle?: string; availability: string; tags: string[] };
  version: { id: string; displayVersion: string; reviewStage: string; changeSummary?: string };
  initialDocument: ProtocolDocument;
  suggestedDisplayVersion: string;
}) {
  const [document, setDocument] = useState(initialDocument);
  const [state, action, pending] = useActionState(saveProtocolDocument, initialState);
  const reviewed = version.reviewStage === "reviewed";
  const serialized = useMemo(() => JSON.stringify(document), [document]);

  const updateBlock = (sectionKey: ProtocolSectionKey, index: number, block: ProtocolContentBlock) => {
    setDocument((current) => ({
      ...current,
      sections: current.sections.map((section) => section.key === sectionKey
        ? { ...section, blocks: section.blocks.map((item, itemIndex) => itemIndex === index ? block : item) }
        : section),
    }));
  };
  const moveBlock = (sectionKey: ProtocolSectionKey, index: number, direction: -1 | 1) => {
    setDocument((current) => ({
      ...current,
      sections: current.sections.map((section) => {
        if (section.key !== sectionKey) return section;
        const target = index + direction;
        if (target < 0 || target >= section.blocks.length) return section;
        const blocks = [...section.blocks];
        [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
        return { ...section, blocks };
      }),
    }));
  };
  const removeBlock = (sectionKey: ProtocolSectionKey, index: number) => {
    setDocument((current) => ({ ...current, sections: current.sections.map((section) => section.key === sectionKey ? { ...section, blocks: section.blocks.filter((_, itemIndex) => itemIndex !== index) } : section) }));
  };
  const addBlock = (sectionKey: ProtocolSectionKey, type: ProtocolContentBlock["type"]) => {
    const id = uniqueBlockId(sectionKey);
    const block: ProtocolContentBlock = type === "heading" ? { id, type, text: "New subsection" }
      : type === "text" ? { id, type, text: "" }
        : type === "checklist" ? { id, type, items: [""] }
          : type === "table" ? { id, type, caption: "", rows: [["Column 1", "Column 2"], ["", ""]] }
            : { id, type, tone: "warning", text: "" };
    setDocument((current) => ({ ...current, sections: current.sections.map((section) => section.key === sectionKey ? { ...section, blocks: [...section.blocks, block] } : section) }));
  };

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="protocolId" value={protocol.id} />
      <input type="hidden" name="versionId" value={version.id} />
      <input type="hidden" name="contentJson" value={serialized} />

      <section className="rounded-[12px] border border-hairline bg-surface shadow-paper">
        <header className="border-b border-hairline px-5 py-4"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Identity and governance</p><h2 className="mt-1 font-serif text-xl font-medium text-ink">Protocol record</h2></header>
        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
          <label className="md:col-span-2"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Canonical title</span><input required name="canonicalTitle" defaultValue={protocol.canonicalTitle} className={inputClass} /></label>
          <label><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Short title</span><input name="shortTitle" defaultValue={protocol.shortTitle} className={inputClass} /></label>
          <label><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">English title</span><input name="englishTitle" defaultValue={protocol.englishTitle} className={inputClass} /></label>
          <label><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Availability</span><select name="availability" defaultValue={protocol.availability} className={inputClass}><option value="draft">Draft</option><option value="active">Active</option><option value="retired">Retired</option><option value="archived">Archived</option></select></label>
          <label><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Review stage</span><select name="reviewStage" defaultValue={reviewed ? "draft" : version.reviewStage} className={inputClass}><option value="draft">Draft</option><option value="ready_for_review">Ready for review</option><option value="reviewed">Reviewed</option></select></label>
          <label><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{reviewed ? "New version" : "Version"}</span><input required name="displayVersion" defaultValue={reviewed ? suggestedDisplayVersion : version.displayVersion} className={inputClass} /></label>
          <label className="md:col-span-2"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Tags</span><input name="tags" defaultValue={protocol.tags.join(", ")} className={inputClass} /></label>
          <label className="md:col-span-2 xl:col-span-3"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Change summary {reviewed ? "· required" : ""}</span><textarea required={reviewed} name="changeSummary" defaultValue={reviewed ? "" : version.changeSummary} className={textareaClass} /></label>
        </div>
      </section>

      {document.sections.map((section) => (
        <section key={section.key} className="rounded-[12px] border border-hairline bg-warm/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Fixed section</p><h2 className="font-serif text-xl font-medium text-ink">{protocolSectionLabels[section.key]}</h2></div>
            <div className="flex flex-wrap gap-1">
              {(["text", "heading", "checklist", "table", "callout"] as const).map((type) => <button key={type} type="button" onClick={() => addBlock(section.key, type)} className="focus-ring inline-flex h-8 items-center gap-1 rounded-[7px] border border-hairline bg-surface px-2 text-xs font-medium text-graphite hover:border-border-strong"><Plus className="h-3.5 w-3.5" />{type}</button>)}
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {section.blocks.length ? section.blocks.map((block, index) => <BlockEditor key={block.id} block={block} onChange={(next) => updateBlock(section.key, index, next)} onMove={(direction) => moveBlock(section.key, index, direction)} onRemove={() => removeBlock(section.key, index)} />) : <p className="rounded-[8px] border border-dashed border-hairline bg-surface px-3 py-5 text-center text-sm text-muted">No blocks. Add text, a checklist, a table, or a callout.</p>}
          </div>
        </section>
      ))}

      {state.error ? <p role="alert" className="rounded-[8px] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error">{state.error}</p> : null}
      <div className="sticky bottom-4 z-20 flex justify-end"><button disabled={pending} className="focus-ring h-11 rounded-[8px] border border-moss bg-moss px-5 text-sm font-medium text-warm shadow-soft disabled:cursor-wait disabled:opacity-60">{pending ? "Saving…" : reviewed ? "Create revision" : "Save draft"}</button></div>
    </form>
  );
}
