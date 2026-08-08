"use client";

import { useActionState, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { ProtocolRichTextEditor } from "@/components/ProtocolRichTextEditor";
import {
  protocolSectionLabels,
  richTextFromPlainText,
  type ProtocolContentBlock,
  type ProtocolDocument,
  type ProtocolSectionKey,
} from "@/lib/protocol-document";

export type ProtocolEditorState = { error?: string };
export type ProtocolEditorAction = (
  previousState: ProtocolEditorState,
  formData: FormData,
) => Promise<ProtocolEditorState>;

type ProjectOption = { id: string; name: string };
type ResearchPlanOption = { id: string; code?: string | null; title: string; projectId: string; projectName: string };

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
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{block.type.replaceAll("_", " ")}</span>
        <div className="flex gap-1">
          <button type="button" onClick={() => onMove(-1)} aria-label="Move block up" className="focus-ring rounded-[6px] p-1.5 text-muted hover:bg-stone"><ChevronUp className="h-4 w-4" /></button>
          <button type="button" onClick={() => onMove(1)} aria-label="Move block down" className="focus-ring rounded-[6px] p-1.5 text-muted hover:bg-stone"><ChevronDown className="h-4 w-4" /></button>
          <button type="button" onClick={onRemove} aria-label="Remove block" className="focus-ring rounded-[6px] p-1.5 text-error hover:bg-error-surface"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>

      {block.type === "heading" ? <input value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} className={inputClass} /> : null}
      {block.type === "text" ? <textarea value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} className={textareaClass} /> : null}
      {block.type === "rich_text" ? <ProtocolRichTextEditor nodes={block.nodes} onChange={(nodes) => onChange({ ...block, nodes })} /> : null}
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
          <p className="text-xs leading-5 text-muted">Large tables remain scrollable in the Protocol. Paste cells directly from Excel using tab-separated columns.</p>
        </div>
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
  protocol: { id?: string; humanCode?: string; canonicalTitle: string; shortTitle?: string; englishTitle?: string; availability: string; tags: string[]; scope: "general" | "project"; projectId?: string; projectName?: string };
  version: { id?: string; displayVersion: string; reviewStage: string; changeSummary?: string };
  initialDocument: ProtocolDocument;
  suggestedDisplayVersion?: string;
  projects: ProjectOption[];
  researchPlans: ResearchPlanOption[];
  initialResearchPlanIds?: string[];
  initialPrimaryResearchPlanIds?: string[];
}) {
  const [document, setDocument] = useState(initialDocument);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [scope, setScope] = useState(protocol.scope);
  const [projectId, setProjectId] = useState(protocol.projectId ?? "");
  const [selectedPlanIds, setSelectedPlanIds] = useState(initialResearchPlanIds);
  const [primaryPlanIds, setPrimaryPlanIds] = useState(initialPrimaryResearchPlanIds);
  const reviewed = mode === "edit" && version.reviewStage === "reviewed";
  const serialized = useMemo(() => JSON.stringify(document), [document]);
  const visiblePlans = useMemo(() => scope === "project" && projectId ? researchPlans.filter((plan) => plan.projectId === projectId) : researchPlans, [projectId, researchPlans, scope]);

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
        : type === "rich_text" ? { id, type, nodes: richTextFromPlainText("") }
          : type === "checklist" ? { id, type, items: [""] }
            : type === "table" ? { id, type, caption: "", rows: [["Column 1", "Column 2"], ["", ""]] }
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

      <section className="rounded-[12px] border border-hairline bg-surface shadow-paper">
        <header className="border-b border-hairline px-5 py-4"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Identity and governance</p><h2 className="mt-1 font-serif text-xl font-medium text-ink">Protocol record</h2></header>
        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
          {protocol.humanCode ? <div><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Protocol ID</span><p className="mt-2 font-mono text-sm font-semibold text-ink">{protocol.humanCode}</p></div> : null}
          <label className="md:col-span-2"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Protocol title</span><input required name="canonicalTitle" defaultValue={protocol.canonicalTitle} className={inputClass} /></label>
          <label><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Short title</span><input name="shortTitle" defaultValue={protocol.shortTitle} className={inputClass} /></label>
          <label><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">English title</span><input name="englishTitle" defaultValue={protocol.englishTitle} className={inputClass} /></label>
          {mode === "create" ? <label><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Protocol scope</span><select name="protocolScope" value={scope} onChange={(event) => { const next = event.target.value as "general" | "project"; setScope(next); if (next === "general") setProjectId(""); }} className={inputClass}><option value="general">General library</option><option value="project">Project-adapted</option></select></label> : <div><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Scope</span><p className="mt-2 text-sm font-medium capitalize text-ink">{protocol.scope}{protocol.projectName ? ` · ${protocol.projectName}` : ""}</p><p className="mt-1 text-xs text-muted">Use “Adapt to project” to preserve General → Project lineage.</p></div>}
          {mode === "create" ? <label><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Project {scope === "project" ? "· required" : ""}</span><select name="projectId" value={projectId} onChange={(event) => { setProjectId(event.target.value); setSelectedPlanIds([]); setPrimaryPlanIds([]); }} required={scope === "project"} disabled={scope === "general"} className={inputClass}><option value="">None</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
          <label><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Availability</span><select name="availability" defaultValue={protocol.availability} className={inputClass}><option value="draft">Draft</option><option value="active">Active</option><option value="retired">Retired</option><option value="archived">Archived</option></select></label>
          <label><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Review stage</span><select name="reviewStage" defaultValue={reviewed ? "draft" : version.reviewStage} className={inputClass}><option value="draft">Draft</option><option value="ready_for_review">Ready for review</option><option value="reviewed">Reviewed</option></select></label>
          <label><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{reviewed ? "New version" : "Version"}</span><input required name="displayVersion" defaultValue={reviewed ? suggestedDisplayVersion : version.displayVersion} className={inputClass} /></label>
          <label className="md:col-span-2"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Tags</span><input name="tags" defaultValue={protocol.tags.join(", ")} placeholder="cell-culture, qc" className={inputClass} /></label>
          <label className="md:col-span-2 xl:col-span-3"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Change summary {reviewed ? "· required" : ""}</span><textarea required={reviewed} name="changeSummary" defaultValue={reviewed ? "" : version.changeSummary} className={textareaClass} placeholder={mode === "create" ? "Initial version." : "What changed and why?"} /></label>
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

      {document.sections.map((section) => (
        <section key={section.key} className="rounded-[12px] border border-hairline bg-warm/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Fixed section</p><h2 className="font-serif text-xl font-medium text-ink">{protocolSectionLabels[section.key]}</h2></div>
            <div className="flex flex-wrap gap-1">
              {(["rich_text", "heading", "checklist", "table", "callout", "media", "timer"] as const).map((type) => <button key={type} type="button" onClick={() => addBlock(section.key, type)} className="focus-ring inline-flex h-8 items-center gap-1 rounded-[7px] border border-hairline bg-surface px-2 text-xs font-medium text-graphite hover:border-border-strong"><Plus className="h-3.5 w-3.5" />{type.replaceAll("_", " ")}</button>)}
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {section.blocks.length ? section.blocks.map((block, index) => <BlockEditor key={block.id} block={block} onChange={(next) => updateBlock(section.key, index, next)} onMove={(direction) => moveBlock(section.key, index, direction)} onRemove={() => removeBlock(section.key, index)} />) : <p className="rounded-[8px] border border-dashed border-hairline bg-surface px-3 py-5 text-center text-sm text-muted">No blocks. Add rich text, a checklist, a table, a callout, media, or a timer.</p>}
          </div>
        </section>
      ))}

      {state.error ? <p role="alert" className="rounded-[8px] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error">{state.error}</p> : null}
      <div className="sticky bottom-4 z-20 flex justify-end"><button disabled={pending} className="focus-ring h-11 rounded-[8px] border border-moss bg-moss px-5 text-sm font-medium text-warm shadow-soft disabled:cursor-wait disabled:opacity-60">{pending ? "Saving…" : mode === "create" ? "Create Protocol" : reviewed ? "Create revision" : "Save Protocol"}</button></div>
    </form>
  );
}
