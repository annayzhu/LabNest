"use client";

import { ArrowDown, ArrowUp, Check, ListX, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { DocumentCanvas } from "@/components/DocumentCanvas";
import { DocumentPageHeader, type DocumentPageHeaderFact } from "@/components/DocumentPageHeader";
import { DocumentPrintButton } from "@/components/DocumentPrintButton";
import { InlineTableEditor } from "@/components/InlineTableEditor";
import { MarkdownRichTextEditor } from "@/components/MarkdownRichTextEditor";
import { ScientificBlockView } from "@/components/ScientificBlockView";
import { isCellRenderShortcut, scientificBlockHasContent } from "@/lib/cell-editor";
import type { ScientificContentBlock, ScientificDocument } from "@/lib/scientific-document";

const inputClass = "focus-ring mt-1 h-10 w-full rounded-[7px] border border-hairline bg-surface px-3 text-sm text-ink";
const textareaClass = "focus-ring mt-1 max-h-80 w-full field-sizing-content resize-y overflow-y-auto rounded-[7px] border border-hairline bg-surface px-3 py-2 text-sm leading-6 text-ink";

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
  documentType,
  identifier,
  title,
  titlePlaceholder,
  subtitle,
  headerFacts,
  leadingContent,
  hiddenSectionKeys = [],
  allowedBlockTypes,
}: {
  initialDocument: ScientificDocument;
  name?: string;
  compact?: boolean;
  documentType?: string;
  identifier?: string | null;
  title?: string | null;
  titlePlaceholder?: string;
  subtitle?: string | null;
  headerFacts?: DocumentPageHeaderFact[];
  leadingContent?: ReactNode;
  hiddenSectionKeys?: string[];
  allowedBlockTypes?: readonly ScientificContentBlock["type"][];
}) {
  const [document, setDocument] = useState(initialDocument);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(() => (
    initialDocument.sections.flatMap((section) => section.blocks).find((block) => !scientificBlockHasContent(block))?.id ?? null
  ));
  const serialized = useMemo(() => JSON.stringify(document), [document]);

  function setBlockEditing(blockId: string, editing: boolean) {
    setEditingBlockId((current) => editing ? blockId : current === blockId ? null : current);
  }

  function updateBlock(sectionIndex: number, blockIndex: number, block: ScientificContentBlock) {
    setDocument((current) => ({
      ...current,
      sections: current.sections.map((section, index) => index === sectionIndex
        ? { ...section, blocks: section.blocks.map((item, itemIndex) => itemIndex === blockIndex ? block : item) }
        : section),
    }));
  }

  function addBlock(sectionIndex: number, type: ScientificContentBlock["type"]) {
    const block = createBlock(type);
    setEditingBlockId(block.id);
    setDocument((current) => ({
      ...current,
      sections: current.sections.map((section, index) => index === sectionIndex
        ? { ...section, blocks: [...section.blocks, block] }
        : section),
    }));
  }

  function removeBlock(sectionIndex: number, blockIndex: number) {
    const blockId = document.sections[sectionIndex]?.blocks[blockIndex]?.id;
    if (blockId) setEditingBlockId((current) => current === blockId ? null : current);
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
    <>
      <input type="hidden" name={name} value={serialized} />
      <DocumentCanvas
        label={title?.trim() || "Structured scientific document editor"}
        toolbar={<><span className="mr-auto hidden text-xs text-muted sm:inline">Edit on the page · the printed A4 keeps this layout</span><DocumentPrintButton /></>}
      >
        <DocumentPageHeader
          documentType={documentType}
          identifier={identifier}
          title={title}
          titlePlaceholder={titlePlaceholder}
          subtitle={subtitle}
          facts={headerFacts}
        />
        {leadingContent}
        {document.sections.map((section, sectionIndex) => hiddenSectionKeys.includes(section.key) ? null : (
          <section key={section.key} className="document-section">
            <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <h2 className="document-section-title font-serif font-medium text-ink">{section.title}</h2>
              <div className="flex flex-wrap justify-end gap-1" data-print-hidden>
                {(allowedBlockTypes ?? (["heading", "text", "checklist", "table", "metric", "callout", "media"] as const)).map((type) => (
                  <button key={type} type="button" onClick={() => addBlock(sectionIndex, type)} className="focus-ring inline-flex h-6 items-center gap-0.5 rounded-[5px] border border-hairline/70 bg-transparent px-1.5 text-[10.5px] font-normal capitalize text-muted transition-colors hover:border-hairline hover:bg-warm/55 hover:text-graphite">
                    <Plus className="h-3 w-3" strokeWidth={1.75} />{type}
                  </button>
                ))}
              </div>
            </header>
            <div>
              {section.blocks.length ? section.blocks.map((block, blockIndex) => (
                <BlockEditor
                  key={block.id}
                  block={block}
                  compact={compact}
                  editing={editingBlockId === block.id}
                  onEditingChange={(editing) => setBlockEditing(block.id, editing)}
                  onChange={(next) => updateBlock(sectionIndex, blockIndex, next)}
                  onRemove={() => removeBlock(sectionIndex, blockIndex)}
                  onMove={(direction) => moveBlock(sectionIndex, blockIndex, direction)}
                />
              )) : <p className="border-y border-dashed border-hairline px-3 py-3 text-center text-sm text-muted" data-print-hidden>No content blocks yet. Choose a content type above to begin.</p>}
            </div>
          </section>
        ))}
      </DocumentCanvas>
    </>
  );
}

function BlockEditor({ block, compact, editing, onEditingChange, onChange, onRemove, onMove }: {
  block: ScientificContentBlock;
  compact: boolean;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onChange: (block: ScientificContentBlock) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  function handleEditorKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!isCellRenderShortcut(event)) return;
    event.preventDefault();
    event.stopPropagation();
    onEditingChange(false);
  }

  return (
    <div className="group document-block document-editor-control rounded-[7px] border border-transparent px-1 py-0.5">
      <div className="document-print-only">
        {scientificBlockHasContent(block) ? <ScientificBlockView block={block} /> : null}
      </div>
      {editing ? (
        <div onKeyDown={handleEditorKeyDown} data-print-hidden>
          <div className="mb-0.5 flex items-center justify-end gap-1">
            <BlockActions editing onEditingChange={onEditingChange} onRemove={onRemove} onMove={onMove} />
          </div>
          {block.type === "heading" ? <input autoFocus value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} onKeyDown={(event) => { if (event.key !== "Enter") return; event.preventDefault(); event.stopPropagation(); onEditingChange(false); }} className={inputClass} placeholder="Section subheading" /> : null}
          {block.type === "text" ? <MarkdownRichTextEditor autoFocus value={block.text} onChange={(text) => onChange({ ...block, text })} minHeightClass={compact ? "min-h-16" : "min-h-24"} placeholder="Record narrative, interpretation, or context…" /> : null}
          {block.type === "checklist" ? <div><div className="mb-1 flex justify-end"><button type="button" onClick={() => onChange({ id: block.id, type: "text", text: block.items.join("\n") })} className="focus-ring inline-flex h-7 items-center gap-1 rounded-[6px] border border-hairline px-2 text-[11px] font-normal text-muted hover:bg-stone hover:text-graphite"><ListX className="h-3.5 w-3.5" />Remove bullets</button></div><textarea autoFocus value={block.items.join("\n")} onChange={(event) => onChange({ ...block, items: event.target.value.split("\n") })} className={`${textareaClass} min-h-16`} placeholder="One item per line" /></div> : null}
          {block.type === "table" ? <InlineTableEditor rows={block.rows} onChange={(rows) => onChange({ ...block, rows })} caption={block.caption} onCaptionChange={(caption) => onChange({ ...block, caption })} /> : null}
          {block.type === "callout" ? <div className="grid gap-2 md:grid-cols-[0.25fr_1fr]"><select autoFocus value={block.tone} onChange={(event) => onChange({ ...block, tone: event.target.value as typeof block.tone })} className={inputClass}><option value="note">Note</option><option value="warning">Warning</option><option value="critical">Critical</option></select><textarea value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} className={`${textareaClass} min-h-16`} placeholder="Important qualification or warning" /></div> : null}
          {block.type === "metric" ? <div className="grid gap-2 md:grid-cols-[1fr_0.6fr_0.35fr]"><input autoFocus value={block.label} onChange={(event) => onChange({ ...block, label: event.target.value })} className={inputClass} placeholder="Metric" /><input value={block.value} onChange={(event) => onChange({ ...block, value: event.target.value })} className={inputClass} placeholder="Value" /><input value={block.unit ?? ""} onChange={(event) => onChange({ ...block, unit: event.target.value })} className={inputClass} placeholder="Unit" /></div> : null}
          {block.type === "media" ? <div className="grid gap-2 md:grid-cols-[0.25fr_1fr_0.8fr]"><select autoFocus value={block.mediaType} onChange={(event) => onChange({ ...block, mediaType: event.target.value as typeof block.mediaType })} className={inputClass}><option value="image">Image</option><option value="video">Video</option><option value="file">File</option></select><input value={block.url} onChange={(event) => onChange({ ...block, url: event.target.value })} className={inputClass} placeholder="Attachment or external URL" /><input value={block.caption ?? ""} onChange={(event) => onChange({ ...block, caption: event.target.value })} className={inputClass} placeholder="Caption" /></div> : null}
          {block.type === "dataset" ? <div className="grid gap-2 md:grid-cols-2"><input autoFocus value={block.datasetId} onChange={(event) => onChange({ ...block, datasetId: event.target.value })} className={inputClass} placeholder="Dataset ID" /><input value={block.label} onChange={(event) => onChange({ ...block, label: event.target.value })} className={inputClass} placeholder="Label" /></div> : null}
          {block.type !== "heading" ? <p className="mt-1 text-right text-[10.5px] text-muted">⌘ / Ctrl + Enter to render</p> : null}
        </div>
      ) : (
        <div className="relative min-w-0" data-print-hidden>
          <div className="mb-1 flex justify-end md:pointer-events-none md:absolute md:left-[calc(100%-0.25rem)] md:top-0 md:z-10 md:mb-0 md:rounded-[7px] md:border md:border-hairline md:bg-surface/95 md:p-1 md:opacity-0 md:shadow-paper md:backdrop-blur-sm md:transition-opacity md:group-hover:pointer-events-auto md:group-hover:opacity-100 md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100 md:[&_.block-action-label]:hidden md:[&>div]:flex-col md:[&>div]:gap-0.5">
            <BlockActions editing={false} onEditingChange={onEditingChange} onRemove={onRemove} onMove={onMove} />
          </div>
          <div onDoubleClick={() => onEditingChange(true)} className={`min-w-0 cursor-text rounded-[7px] px-1 outline-none transition hover:bg-warm/70 ${block.type === "heading" ? "min-h-7 py-0.5" : "min-h-8 py-1"}`} title="Double-click to edit">
            {scientificBlockHasContent(block) ? <ScientificBlockView block={block} /> : <p className="py-1.5 text-sm italic text-muted">Empty block — double-click to edit</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function BlockActions({ editing, onEditingChange, onRemove, onMove }: {
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <div className="flex shrink-0 gap-1">
      {editing ? (
        <button type="button" title="Render block (Command/Ctrl + Enter)" onClick={() => onEditingChange(false)} className="focus-ring inline-flex h-6 items-center gap-1 rounded-[5px] border border-hairline px-1.5 text-[10.5px] font-medium text-moss hover:bg-sage-surface"><Check className="h-3.5 w-3.5" /><span className="block-action-label">Render</span></button>
      ) : (
        <button type="button" title="Edit block" onClick={() => onEditingChange(true)} className="focus-ring inline-flex h-6 items-center gap-1 rounded-[5px] border border-hairline px-1.5 text-[10.5px] font-medium text-graphite hover:bg-stone"><Pencil className="h-3.5 w-3.5" /><span className="block-action-label">Edit</span></button>
      )}
      <button type="button" aria-label="Move up" onClick={() => onMove(-1)} className="focus-ring rounded p-1 text-muted hover:bg-stone"><ArrowUp className="h-3.5 w-3.5" /></button>
      <button type="button" aria-label="Move down" onClick={() => onMove(1)} className="focus-ring rounded p-1 text-muted hover:bg-stone"><ArrowDown className="h-3.5 w-3.5" /></button>
      <button type="button" aria-label="Remove block" onClick={onRemove} className="focus-ring rounded p-1 text-error hover:bg-error-surface"><Trash2 className="h-3.5 w-3.5" /></button>
    </div>
  );
}
