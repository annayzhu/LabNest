"use client";

import { useActionState, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Download, ListX, Plus, Trash2 } from "lucide-react";
import { BlockDragHandle } from "@/components/BlockDragHandle";
import { DocumentCanvas } from "@/components/DocumentCanvas";
import { DocumentPageHeader } from "@/components/DocumentPageHeader";
import { DocumentPrintButton } from "@/components/DocumentPrintButton";
import { formInputClass, formLabelClass, formTextareaClass } from "@/components/forms";
import { InlineTableEditor } from "@/components/InlineTableEditor";
import { ProtocolContentBlockView } from "@/components/ProtocolDocumentView";
import { ProtocolRichTextEditor } from "@/components/ProtocolRichTextEditor";
import { RecordCodeField } from "@/components/RecordCodeField";
import { ResultTemplateConfigEditor } from "@/components/ResultTemplateConfigEditor";
import { TagFieldLabel } from "@/components/TagFieldLabel";
import { Button } from "@/components/ui/Button";
import { StatusRadioGroup } from "@/components/ui/StatusRadioGroup";
import { reorderBlocks, type BlockDropEdge } from "@/lib/block-reorder";
import {
  protocolSectionLabels,
  richTextFromPlainText,
  type ProtocolContentBlock,
  type ProtocolDocument,
  type ProtocolSectionKey,
} from "@/lib/protocol-document";
import { createDefaultResultTemplate, resultTemplateFieldsToRows } from "@/lib/result-templates";
import { protocolAvailabilityOptions, protocolReviewStageOptions } from "@/lib/status-options";

export type ProtocolEditorState = { error?: string };
export type ProtocolEditorAction = (
  previousState: ProtocolEditorState,
  formData: FormData,
) => Promise<ProtocolEditorState>;

type ProjectOption = { id: string; name: string };
type ResearchPlanOption = { id: string; code?: string | null; title: string; projectId: string; projectName: string };

const initialState: ProtocolEditorState = {};
const inputClass = formInputClass;
const textareaClass = `${formTextareaClass} min-h-16 resize-y leading-[var(--ln-rich-text-default-line-height)]`;

type ProtocolBlockLocation = { sectionKey: ProtocolSectionKey; blockIndex: number };
type ProtocolBlockDropTarget = ProtocolBlockLocation & { edge: BlockDropEdge };

function uniqueBlockId(sectionKey: ProtocolSectionKey) {
  return `${sectionKey}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function BlockEditor({
  block,
  sectionKey,
  onChange,
  onMove,
  onRemove,
  dragging,
  dropEdge,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  block: ProtocolContentBlock;
  sectionKey: ProtocolSectionKey;
  onChange: (block: ProtocolContentBlock) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  dragging: boolean;
  dropEdge?: BlockDropEdge;
  onDragStart: (event: React.DragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      className="document-block document-editor-control rounded-[7px] border border-transparent px-1 py-0.5"
      data-dragging={dragging ? "true" : undefined}
      data-drop-edge={dropEdge}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="document-print-only"><ProtocolContentBlockView block={block} /></div>
      <div data-print-hidden>
      <div className="mb-0.5 flex items-center justify-end gap-1">
        <div className="flex gap-1">
          <BlockDragHandle onDragStart={onDragStart} onDragEnd={onDragEnd} />
          <button type="button" onClick={() => onMove(-1)} aria-label="Move block up" className="focus-ring rounded-[5px] p-1 text-muted hover:bg-stone"><ChevronUp className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => onMove(1)} aria-label="Move block down" className="focus-ring rounded-[5px] p-1 text-muted hover:bg-stone"><ChevronDown className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={onRemove} aria-label="Remove block" className="focus-ring rounded-[5px] p-1 text-error hover:bg-error-surface"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {block.type === "heading" ? <input value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} className={inputClass} /> : null}
      {block.type === "text" ? <textarea value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} className={textareaClass} /> : null}
      {block.type === "rich_text" ? <ProtocolRichTextEditor nodes={block.nodes} onChange={(nodes) => onChange({ ...block, nodes })} /> : null}
      {block.type === "checklist" ? <div><div className="flex justify-end"><button type="button" onClick={() => onChange({ id: block.id, type: "rich_text", nodes: richTextFromPlainText(block.items.join("\n")) })} className="focus-ring inline-flex h-7 items-center gap-1 rounded-[6px] border border-hairline px-2 text-[11px] font-normal text-muted hover:bg-stone hover:text-graphite"><ListX className="h-3.5 w-3.5" />Remove bullets</button></div><textarea value={block.items.join("\n")} onChange={(event) => onChange({ ...block, items: event.target.value.split("\n") })} className={textareaClass} placeholder="One checklist item per line" /></div> : null}
      {block.type === "callout" ? (
        <div className="grid gap-3 md:grid-cols-[160px_1fr]">
          <select value={block.tone} onChange={(event) => onChange({ ...block, tone: event.target.value as "note" | "warning" | "critical" })} className={inputClass}><option value="note">Note</option><option value="warning">Warning</option><option value="critical">Critical</option></select>
          <textarea value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} className={textareaClass} />
        </div>
      ) : null}
      {block.type === "table" && sectionKey === "result_templates" ? <ResultTemplateConfigEditor block={block} onChange={onChange} /> : null}
      {block.type === "table" && sectionKey !== "result_templates" ? (
        <InlineTableEditor rows={block.rows} onChange={(rows) => onChange({ ...block, rows })} caption={block.caption} onCaptionChange={(caption) => onChange({ ...block, caption })} />
      ) : null}
      {block.type === "media" ? (
        <div className="grid gap-3 md:grid-cols-[150px_1fr]">
          <select value={block.mediaType} onChange={(event) => onChange({ ...block, mediaType: event.target.value as "image" | "video" | "file" })} className={inputClass}><option value="image">Image</option><option value="video">Video</option><option value="file">File link</option></select>
          <input value={block.url} onChange={(event) => onChange({ ...block, url: event.target.value })} className={inputClass} placeholder="https://… or /api/attachments/…" />
          <input value={block.caption ?? ""} onChange={(event) => onChange({ ...block, caption: event.target.value })} className={`${inputClass} md:col-span-2`} placeholder="Caption" />
        </div>
      ) : null}
      {block.type === "timer" ? (
        <div className="grid gap-3 md:grid-cols-[1fr_180px]">
          <input value={block.label} onChange={(event) => onChange({ ...block, label: event.target.value })} className={inputClass} placeholder="Incubation timer" />
          <input type="number" min="0.1" step="0.1" value={block.durationMinutes} onChange={(event) => onChange({ ...block, durationMinutes: Number(event.target.value) || 0.1 })} className={inputClass} aria-label="Duration in minutes" />
          <textarea value={block.notes ?? ""} onChange={(event) => onChange({ ...block, notes: event.target.value })} className={`${textareaClass} md:col-span-2`} placeholder="Timer notes" />
        </div>
      ) : null}
      </div>
    </div>
  );
}

export function ProtocolDocumentEditor({
  action,
  mode,
  protocol,
  version,
  initialDocument,
  suggestedDisplayVersion,
  projects,
  researchPlans,
  initialResearchPlanIds = [],
  initialPrimaryResearchPlanIds = [],
}: {
  action: ProtocolEditorAction;
  mode: "create" | "edit";
  protocol: { id?: string; humanCode?: string; suggestedCodeSuffix?: string; canonicalTitle: string; shortTitle?: string; englishTitle?: string; availability: string; tags: string[]; scope: "general" | "project"; projectId?: string; projectName?: string };
  version: { id?: string; displayVersion: string; reviewStage: string; changeSummary?: string };
  initialDocument: ProtocolDocument;
  suggestedDisplayVersion?: string;
  projects: ProjectOption[];
  researchPlans: ResearchPlanOption[];
  initialResearchPlanIds?: string[];
  initialPrimaryResearchPlanIds?: string[];
}) {
  const reviewed = mode === "edit" && version.reviewStage === "reviewed";
  const [document, setDocument] = useState(initialDocument);
  const [canonicalTitle, setCanonicalTitle] = useState(protocol.canonicalTitle);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [scope, setScope] = useState(protocol.scope);
  const [projectId, setProjectId] = useState(protocol.projectId ?? "");
  const [codeSuffix, setCodeSuffix] = useState(protocol.suggestedCodeSuffix ?? "");
  const [availability, setAvailability] = useState(protocol.availability);
  const [reviewStage, setReviewStage] = useState(reviewed ? "draft" : version.reviewStage);
  const [displayVersion, setDisplayVersion] = useState(reviewed ? suggestedDisplayVersion ?? version.displayVersion : version.displayVersion);
  const [selectedPlanIds, setSelectedPlanIds] = useState(initialResearchPlanIds);
  const [primaryPlanIds, setPrimaryPlanIds] = useState(initialPrimaryResearchPlanIds);
  const [draggedBlock, setDraggedBlock] = useState<ProtocolBlockLocation | null>(null);
  const [dropTarget, setDropTarget] = useState<ProtocolBlockDropTarget | null>(null);
  const serialized = useMemo(() => JSON.stringify(document), [document]);
  const visiblePlans = useMemo(() => scope === "project" && projectId ? researchPlans.filter((plan) => plan.projectId === projectId) : researchPlans, [projectId, researchPlans, scope]);
  const project = projects.find((item) => item.id === projectId);
  const identifier = protocol.humanCode ?? (codeSuffix ? `PRT-${codeSuffix}` : "Draft Protocol");
  const docxExportHref = mode === "edit" && protocol.id && version.id
    ? `/api/protocols/${protocol.id}/versions/${version.id}/docx`
    : undefined;

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
  const reorderBlock = (sectionKey: ProtocolSectionKey, sourceIndex: number, targetIndex: number, edge: BlockDropEdge) => {
    setDocument((current) => ({
      ...current,
      sections: current.sections.map((section) => section.key === sectionKey
        ? { ...section, blocks: reorderBlocks(section.blocks, sourceIndex, targetIndex, edge) }
        : section),
    }));
  };
  const startBlockDrag = (event: React.DragEvent<HTMLButtonElement>, location: ProtocolBlockLocation, blockId: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", blockId);
    setDraggedBlock(location);
    setDropTarget(null);
  };
  const dragBlockOver = (event: React.DragEvent<HTMLDivElement>, location: ProtocolBlockLocation) => {
    if (!draggedBlock || draggedBlock.sectionKey !== location.sectionKey) {
      setDropTarget(null);
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const bounds = event.currentTarget.getBoundingClientRect();
    const edge: BlockDropEdge = event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
    setDropTarget({ ...location, edge });
  };
  const dropBlock = (event: React.DragEvent<HTMLDivElement>, location: ProtocolBlockLocation) => {
    if (!draggedBlock || draggedBlock.sectionKey !== location.sectionKey) return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    const edge: BlockDropEdge = event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
    reorderBlock(location.sectionKey, draggedBlock.blockIndex, location.blockIndex, edge);
    setDraggedBlock(null);
    setDropTarget(null);
  };
  const finishBlockDrag = () => {
    setDraggedBlock(null);
    setDropTarget(null);
  };
  const removeBlock = (sectionKey: ProtocolSectionKey, index: number) => {
    setDocument((current) => ({ ...current, sections: current.sections.map((section) => section.key === sectionKey ? { ...section, blocks: section.blocks.filter((_, itemIndex) => itemIndex !== index) } : section) }));
  };
  const addBlock = (sectionKey: ProtocolSectionKey, type: ProtocolContentBlock["type"]) => {
    const id = uniqueBlockId(sectionKey);
    const resultTemplate = sectionKey === "result_templates" && type === "table" ? createDefaultResultTemplate("measurement") : undefined;
    const block: ProtocolContentBlock = type === "heading" ? { id, type, text: "New subsection" }
      : type === "text" ? { id, type, text: "" }
        : type === "rich_text" ? { id, type, nodes: richTextFromPlainText("") }
          : type === "checklist" ? { id, type, items: [""] }
            : type === "table" ? resultTemplate
              ? { id, type, caption: resultTemplate.result_type, rows: resultTemplateFieldsToRows(resultTemplate), resultTemplate }
              : { id, type, caption: "", rows: [["Column 1", "Column 2"], ["", ""]] }
              : type === "media" ? { id, type, mediaType: "image", url: "", caption: "" }
                : type === "timer" ? { id, type, label: "Timer", durationMinutes: 5, notes: "" }
                  : { id, type: "callout", tone: "warning", text: "" };
    setDocument((current) => ({ ...current, sections: current.sections.map((section) => section.key === sectionKey ? { ...section, blocks: [...section.blocks, block] } : section) }));
  };

  const togglePlan = (planId: string, checked: boolean) => {
    setSelectedPlanIds((current) => checked ? [...new Set([...current, planId])] : current.filter((id) => id !== planId));
    if (!checked) setPrimaryPlanIds((current) => current.filter((id) => id !== planId));
  };
  const togglePrimary = (planId: string, checked: boolean) => {
    setPrimaryPlanIds((current) => checked ? [...new Set([...current, planId])] : current.filter((id) => id !== planId));
    if (checked) setSelectedPlanIds((current) => [...new Set([...current, planId])]);
  };

  return (
    <form action={formAction} className="space-y-5">
      {protocol.id ? <input type="hidden" name="protocolId" value={protocol.id} /> : null}
      {version.id ? <input type="hidden" name="versionId" value={version.id} /> : null}
      <input type="hidden" name="contentJson" value={serialized} />
      {mode === "edit" ? <><input type="hidden" name="protocolScope" value={protocol.scope} /><input type="hidden" name="projectId" value={protocol.projectId ?? ""} /></> : null}

      <div className="document-editor-layout">
      <aside className="document-editor-sidebar" aria-label="Protocol properties">
      <section className="rounded-[12px] border border-hairline bg-surface shadow-paper">
        <header className="border-b border-hairline px-5 py-4"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Identity and governance</p><h2 className="mt-1 font-serif text-xl font-medium text-ink">Protocol record</h2></header>
        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
          <RecordCodeField label="Protocol ID" prefix="PRT-" name="humanCodeSuffix" minimumDigits={6} placeholder="100001" value={codeSuffix} onValueChange={setCodeSuffix} existingCode={mode === "edit" ? protocol.humanCode : undefined} />
          <label className="md:col-span-2"><span className={formLabelClass}>Protocol title</span><input required name="canonicalTitle" value={canonicalTitle} onChange={(event) => setCanonicalTitle(event.target.value)} className={formInputClass} /></label>
          <label><span className={formLabelClass}>Short title</span><input name="shortTitle" defaultValue={protocol.shortTitle} className={formInputClass} /></label>
          <label><span className={formLabelClass}>English title</span><input name="englishTitle" defaultValue={protocol.englishTitle} className={formInputClass} /></label>
          {mode === "create" ? <label><span className={formLabelClass}>Protocol scope</span><select name="protocolScope" value={scope} onChange={(event) => { const next = event.target.value as "general" | "project"; setScope(next); if (next === "general") setProjectId(""); }} className={formInputClass}><option value="general">General library</option><option value="project">Project-adapted</option></select></label> : <div><span className={formLabelClass}>Scope</span><p className="mt-2 text-sm font-medium capitalize text-ink">{protocol.scope}{protocol.projectName ? ` · ${protocol.projectName}` : ""}</p><p className="mt-1 text-xs text-muted">Use “Adapt to project” to preserve General → Project lineage.</p></div>}
          {mode === "create" ? <label><span className={formLabelClass}>Project {scope === "project" ? "· required" : ""}</span><select name="projectId" value={projectId} onChange={(event) => { setProjectId(event.target.value); setSelectedPlanIds([]); setPrimaryPlanIds([]); }} required={scope === "project"} disabled={scope === "general"} className={formInputClass}><option value="">None</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
          <StatusRadioGroup label="Availability" name="availability" options={protocolAvailabilityOptions} value={availability} onValueChange={setAvailability} required className="md:col-span-2" />
          <StatusRadioGroup label="Review stage" name="reviewStage" options={protocolReviewStageOptions} value={reviewStage} onValueChange={setReviewStage} required className="md:col-span-2" />
          <label><span className={formLabelClass}>{reviewed ? "New version" : "Version"}</span><input required name="displayVersion" value={displayVersion} onChange={(event) => setDisplayVersion(event.target.value)} className={formInputClass} /></label>
          <label className="md:col-span-2"><TagFieldLabel /><input name="tags" defaultValue={protocol.tags.join(", ")} placeholder="cell-culture, qc" className={formInputClass} /></label>
          <label className="md:col-span-2 xl:col-span-3"><span className={formLabelClass}>Change summary {reviewed ? "· required" : ""}</span><textarea required={reviewed} name="changeSummary" defaultValue={reviewed ? "" : version.changeSummary} className={textareaClass} placeholder={mode === "create" ? "Initial version." : "What changed and why?"} /></label>
        </div>
      </section>

      <section className="rounded-[12px] border border-hairline bg-surface shadow-paper">
        <header className="border-b border-hairline px-5 py-4"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Workflow relationship</p><h2 className="mt-1 font-serif text-xl font-medium text-ink">Research plans</h2><p className="mt-1 text-sm text-muted">A Protocol can support multiple Research Plans. Mark the principal method for each relevant plan.</p></header>
        <div className="max-h-72 overflow-auto p-3 editorial-scrollbar">
          {visiblePlans.length ? visiblePlans.map((plan) => {
            const checked = selectedPlanIds.includes(plan.id);
            const primary = primaryPlanIds.includes(plan.id);
            return <div key={plan.id} className="grid items-center gap-3 border-b border-hairline px-2 py-2.5 last:border-b-0 sm:grid-cols-[1fr_auto_auto]">
              <label className="flex min-w-0 items-start gap-3"><input type="checkbox" name="researchPlanIds" value={plan.id} checked={checked} onChange={(event) => togglePlan(plan.id, event.target.checked)} className="mt-1" /><span className="min-w-0"><span className="block truncate text-sm font-medium text-ink">{plan.code ? `${plan.code} · ` : ""}{plan.title}</span><span className="block truncate text-xs text-muted">{plan.projectName}</span></span></label>
              <label className="flex items-center gap-2 text-xs font-medium text-muted"><input type="checkbox" name="primaryResearchPlanIds" value={plan.id} checked={primary} onChange={(event) => togglePrimary(plan.id, event.target.checked)} />Primary</label>
            </div>;
          }) : <p className="px-3 py-6 text-center text-sm text-muted">No Research Plans are available for this scope.</p>}
        </div>
      </section>
      </aside>

      <div className="document-editor-main">
      <DocumentCanvas label={canonicalTitle || "Protocol document editor"} toolbar={<><span className="mr-auto hidden text-xs text-muted sm:inline">Edit on the page · the printed A4 keeps this layout</span>{docxExportHref ? <a href={docxExportHref} className="focus-ring inline-flex h-9 items-center gap-2 rounded-[8px] border border-hairline bg-surface px-3 text-xs font-medium text-muted transition-colors hover:bg-stone hover:text-ink" title="Exports the currently saved version. Save first if you changed this page."><Download className="h-4 w-4" />Export DOCX</a> : null}<DocumentPrintButton /></>}>
        <DocumentPageHeader documentType="Protocol" identifier={identifier} title={canonicalTitle} titlePlaceholder="Untitled Protocol" facts={[
          { label: "Version", value: displayVersion, mono: true },
          { label: "Scope", value: scope === "general" ? "General library" : "Project-adapted" },
          { label: "Project", value: scope === "project" ? project?.name ?? protocol.projectName ?? "Not selected" : null },
          { label: "Availability", value: availability.replaceAll("_", " ") },
          { label: "Review", value: reviewStage.replaceAll("_", " ") },
        ]} />
        {document.sections.map((section) => (
          <section key={section.key} className="document-section">
            <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <h2 className="document-section-title font-serif font-medium text-ink">{protocolSectionLabels[section.key]}</h2>
              <div className="flex flex-wrap justify-end gap-1" data-print-hidden>
                {section.key === "result_templates"
                  ? <button type="button" onClick={() => addBlock(section.key, "table")} className="focus-ring inline-flex h-6 items-center gap-1 rounded-[5px] border border-hairline bg-surface px-1.5 text-[10.5px] font-medium text-moss transition-colors hover:bg-sage-surface"><Plus className="h-3 w-3" strokeWidth={1.75} />Result Template</button>
                  : (["rich_text", "heading", "checklist", "table", "callout", "media", "timer"] as const).map((type) => <button key={type} type="button" onClick={() => addBlock(section.key, type)} className="focus-ring inline-flex h-6 items-center gap-0.5 rounded-[5px] border border-hairline/70 bg-transparent px-1.5 text-[10.5px] font-normal capitalize text-muted transition-colors hover:border-hairline hover:bg-warm/55 hover:text-graphite"><Plus className="h-3 w-3" strokeWidth={1.75} />{type.replaceAll("_", " ")}</button>)}
              </div>
            </header>
            <div>
              {section.blocks.length ? section.blocks.map((block, index) => <BlockEditor
                key={block.id}
                block={block}
                sectionKey={section.key}
                dragging={draggedBlock?.sectionKey === section.key && draggedBlock.blockIndex === index}
                dropEdge={dropTarget?.sectionKey === section.key && dropTarget.blockIndex === index ? dropTarget.edge : undefined}
                onChange={(next) => updateBlock(section.key, index, next)}
                onMove={(direction) => moveBlock(section.key, index, direction)}
                onRemove={() => removeBlock(section.key, index)}
                onDragStart={(event) => startBlockDrag(event, { sectionKey: section.key, blockIndex: index }, block.id)}
                onDragEnd={finishBlockDrag}
                onDragOver={(event) => dragBlockOver(event, { sectionKey: section.key, blockIndex: index })}
                onDrop={(event) => dropBlock(event, { sectionKey: section.key, blockIndex: index })}
              />) : <p className="border-y border-dashed border-hairline px-3 py-3 text-center text-sm text-muted" data-print-hidden>{section.key === "result_templates" ? "No Result Templates. Use + Result Template to add one." : "No blocks. Add rich text, a checklist, a table, a callout, media, or a timer."}</p>}
            </div>
          </section>
        ))}
      </DocumentCanvas>
      </div>
      </div>

      {state.error ? <p role="alert" className="rounded-[8px] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error">{state.error}</p> : null}
      <div className="sticky bottom-4 z-20 flex justify-end"><Button type="submit" variant="primary" size="lg" disabled={pending} className="shadow-soft">{pending ? "Saving…" : mode === "create" ? "Create Protocol" : reviewed ? "Save as new revision" : "Save Protocol"}</Button></div>
    </form>
  );
}
