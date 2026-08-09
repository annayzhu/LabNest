"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { ScientificContentBlock, ScientificDocument } from "@/lib/scientific-document";

const inputClass = "focus-ring mt-1 h-10 w-full rounded-[7px] border border-hairline bg-surface px-3 text-sm text-ink";
const textareaClass = "focus-ring mt-1 min-h-24 w-full rounded-[7px] border border-hairline bg-surface px-3 py-2 text-sm leading-6 text-ink";

function newId(type: string) {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createBlock(type: ScientificContentBlock["type"]): ScientificContentBlock {
  if (type === "heading") return { id: newId(type), type, text: "" };
  if (type === "text") return { id: newId(type), type, text: "" };
  if (type === "checklist") return { id: newId(type), type, items: [""] };
  if (type === "table") return { id: newId(type), type, caption: "", rows: [["Column 1", "Column 2"], ["", ""]] };
  if (type === "callout") return { id: newId(type), type, tone: "note", text: "" };
  if (type === "metric") return { id: newId(type), type, label: "", value: "", unit: "" };
  if (type === "media") return { id: newId(type), type, mediaType: "image", url: "", caption: "" };
  return { id: newId(type), type, datasetId: "", label: "" };
}

export function ScientificDocumentEditor({
  initialDocument,
  name = "contentJson",
  compact = false,
}: {
  initialDocument: ScientificDocument;
  name?: string;
  compact?: boolean;
}) {
  const [document, setDocument] = useState(initialDocument);
  const serialized = useMemo(() => JSON.stringify(document), [document]);

  function updateBlock(sectionIndex: number, blockIndex: number, block: ScientificContentBlock) {
    setDocument((current) => ({
      ...current,
      sections: current.sections.map((section, index) => index === sectionIndex
        ? { ...section, blocks: section.blocks.map((item, itemIndex) => itemIndex === blockIndex ? block : item) }
        : section),
    }));
  }

  function addBlock(sectionIndex: number, type: ScientificContentBlock["type"]) {
    setDocument((current) => ({
      ...current,
      sections: current.sections.map((section, index) => index === sectionIndex
        ? { ...section, blocks: [...section.blocks, createBlock(type)] }
        : section),
    }));
  }

  function removeBlock(sectionIndex: number, blockIndex: number) {
    setDocument((current) => ({
      ...current,
      sections: current.sections.map((section, index) => index === sectionIndex
        ? { ...section, blocks: section.blocks.filter((_, itemIndex) => itemIndex !== blockIndex) }
        : section),
    }));
  }

  function moveBlock(sectionIndex: number, blockIndex: number, direction: -1 | 1) {
    setDocument((current) => ({
      ...current,
      sections: current.sections.map((section, index) => {
        if (index !== sectionIndex) return section;
        const target = blockIndex + direction;
        if (target < 0 || target >= section.blocks.length) return section;
        const blocks = [...section.blocks];
        [blocks[blockIndex], blocks[target]] = [blocks[target], blocks[blockIndex]];
        return { ...section, blocks };
      }),
    }));
  }

  return (
    <div className="space-y-4">
      <input type="hidden" name={name} value={serialized} />
      {document.sections.map((section, sectionIndex) => (
        <section key={section.key} className="rounded-[11px] border border-hairline bg-warm/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted">Structured section</p>
              <h3 className="mt-1 font-serif text-lg font-medium text-ink">{section.title}</h3>
            </div>
            <div className="flex flex-wrap gap-1">
              {(["heading", "text", "checklist", "table", "metric", "callout", "media"] as const).map((type) => (
                <button key={type} type="button" onClick={() => addBlock(sectionIndex, type)} className="focus-ring inline-flex h-8 items-center gap-1 rounded-[7px] border border-hairline bg-surface px-2 text-xs font-medium text-graphite hover:border-border-strong">
                  <Plus className="h-3.5 w-3.5" />{type}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 space-y-3">
            {section.blocks.length ? section.blocks.map((block, blockIndex) => (
              <BlockEditor
                key={block.id}
                block={block}
                compact={compact}
                onChange={(next) => updateBlock(sectionIndex, blockIndex, next)}
                onRemove={() => removeBlock(sectionIndex, blockIndex)}
                onMove={(direction) => moveBlock(sectionIndex, blockIndex, direction)}
              />
            )) : <p className="rounded-[8px] border border-dashed border-hairline bg-surface px-3 py-4 text-center text-sm text-muted">No content blocks yet.</p>}
          </div>
        </section>
      ))}
    </div>
  );
}

function BlockEditor({ block, compact, onChange, onRemove, onMove }: {
  block: ScientificContentBlock;
  compact: boolean;
  onChange: (block: ScientificContentBlock) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <div className="rounded-[9px] border border-hairline bg-surface p-3 shadow-paper">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase text-muted">{block.type}</span>
        <div className="flex gap-1">
          <button type="button" aria-label="Move up" onClick={() => onMove(-1)} className="focus-ring rounded p-1 text-muted hover:bg-stone"><ArrowUp className="h-3.5 w-3.5" /></button>
          <button type="button" aria-label="Move down" onClick={() => onMove(1)} className="focus-ring rounded p-1 text-muted hover:bg-stone"><ArrowDown className="h-3.5 w-3.5" /></button>
          <button type="button" aria-label="Remove block" onClick={onRemove} className="focus-ring rounded p-1 text-error hover:bg-error-surface"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      {(block.type === "heading" || block.type === "text") ? <textarea value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} className={compact ? `${textareaClass} min-h-16` : textareaClass} placeholder={block.type === "heading" ? "Section subheading" : "Record narrative, interpretation, or context…"} /> : null}
      {block.type === "checklist" ? <textarea value={block.items.join("\n")} onChange={(event) => onChange({ ...block, items: event.target.value.split("\n") })} className={textareaClass} placeholder="One item per line" /> : null}
      {block.type === "table" ? <div className="grid gap-2 md:grid-cols-[0.35fr_1fr]"><input value={block.caption ?? ""} onChange={(event) => onChange({ ...block, caption: event.target.value })} className={inputClass} placeholder="Table caption" /><textarea value={block.rows.map((row) => row.join("\t")).join("\n")} onChange={(event) => onChange({ ...block, rows: event.target.value.split("\n").map((row) => row.split("\t")) })} className={textareaClass} placeholder="Tab-separated cells; one row per line" /></div> : null}
      {block.type === "callout" ? <div className="grid gap-2 md:grid-cols-[0.25fr_1fr]"><select value={block.tone} onChange={(event) => onChange({ ...block, tone: event.target.value as typeof block.tone })} className={inputClass}><option value="note">Note</option><option value="warning">Warning</option><option value="critical">Critical</option></select><textarea value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} className={textareaClass} placeholder="Important qualification or warning" /></div> : null}
      {block.type === "metric" ? <div className="grid gap-2 md:grid-cols-[1fr_0.6fr_0.35fr]"><input value={block.label} onChange={(event) => onChange({ ...block, label: event.target.value })} className={inputClass} placeholder="Metric" /><input value={block.value} onChange={(event) => onChange({ ...block, value: event.target.value })} className={inputClass} placeholder="Value" /><input value={block.unit ?? ""} onChange={(event) => onChange({ ...block, unit: event.target.value })} className={inputClass} placeholder="Unit" /></div> : null}
      {block.type === "media" ? <div className="grid gap-2 md:grid-cols-[0.25fr_1fr_0.8fr]"><select value={block.mediaType} onChange={(event) => onChange({ ...block, mediaType: event.target.value as typeof block.mediaType })} className={inputClass}><option value="image">Image</option><option value="video">Video</option><option value="file">File</option></select><input value={block.url} onChange={(event) => onChange({ ...block, url: event.target.value })} className={inputClass} placeholder="Attachment or external URL" /><input value={block.caption ?? ""} onChange={(event) => onChange({ ...block, caption: event.target.value })} className={inputClass} placeholder="Caption" /></div> : null}
      {block.type === "dataset" ? <div className="grid gap-2 md:grid-cols-2"><input value={block.datasetId} onChange={(event) => onChange({ ...block, datasetId: event.target.value })} className={inputClass} placeholder="Dataset ID" /><input value={block.label} onChange={(event) => onChange({ ...block, label: event.target.value })} className={inputClass} placeholder="Label" /></div> : null}
    </div>
  );
}
