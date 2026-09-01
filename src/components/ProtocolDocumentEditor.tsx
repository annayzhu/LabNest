"use client";

import { useActionState, useMemo, useState } from "react";
import { Download } from "lucide-react";
import Link from "next/link";
import { DocumentCanvas } from "@/components/DocumentCanvas";
import { DocumentEditorWorkspace } from "@/components/DocumentEditorWorkspace";
import { DocumentPageHeader } from "@/components/DocumentPageHeader";
import { DocumentPrintButton } from "@/components/DocumentPrintButton";
import { formInputClass, formLabelClass, formTextareaClass } from "@/components/forms";
import { ProtocolWysiwygEditor } from "@/components/ProtocolWysiwygEditor";
import { RecordCodeField } from "@/components/RecordCodeField";
import { TagFieldLabel } from "@/components/TagFieldLabel";
import { Button } from "@/components/ui/Button";
import { StatusRadioGroup } from "@/components/ui/StatusRadioGroup";
import type { ProtocolDocument } from "@/lib/protocol-document";
import { protocolAvailabilityOptions, protocolReviewStageOptions } from "@/lib/status-options";
import { labToolManifest } from "@/lib/tool-manifest";

export type ProtocolEditorState = { error?: string };
export type ProtocolEditorAction = (
  previousState: ProtocolEditorState,
  formData: FormData,
) => Promise<ProtocolEditorState>;

type ProjectOption = { id: string; name: string };
type ResearchPlanOption = { id: string; code?: string | null; title: string; projectId: string; projectName: string };
type RelevantLink = { id: string; label: string; meta?: string; href: string };
type ProtocolRelevantItems = {
  projects?: RelevantLink[];
  experiments?: RelevantLink[];
  results?: RelevantLink[];
  attachments?: RelevantLink[];
  versions?: RelevantLink[];
};

const initialState: ProtocolEditorState = {};
const textareaClass = `${formTextareaClass} min-h-16 resize-y leading-[var(--ln-rich-text-default-line-height)]`;

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
  relevantItems = {},
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
  relevantItems?: ProtocolRelevantItems;
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
  const serialized = useMemo(() => JSON.stringify(document), [document]);
  const visiblePlans = useMemo(() => scope === "project" && projectId ? researchPlans.filter((plan) => plan.projectId === projectId) : researchPlans, [projectId, researchPlans, scope]);
  const project = projects.find((item) => item.id === projectId);
  const identifier = protocol.humanCode ?? (codeSuffix ? `PRT-${codeSuffix}` : "Draft Protocol");
  const docxExportHref = mode === "edit" && protocol.id && version.id
    ? `/api/protocols/${protocol.id}/versions/${version.id}/docx`
    : undefined;

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

      <DocumentEditorWorkspace
        document={<DocumentCanvas label={canonicalTitle || "Protocol document editor"} toolbar={<><span className="mr-auto hidden text-xs text-muted sm:inline">One continuous document · formatting and scientific inserts stay in one toolbar</span>{docxExportHref ? <a href={docxExportHref} className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-hairline bg-surface px-2.5 text-[11px] font-medium text-muted transition-colors hover:bg-stone hover:text-ink" title="Exports the currently saved version. Save first if you changed this page."><Download className="h-3.5 w-3.5" />Export DOCX</a> : null}<DocumentPrintButton /></>}>
          <DocumentPageHeader documentType="Protocol" identifier={identifier} title={canonicalTitle} titlePlaceholder="Untitled Protocol" facts={[
            { label: "Version", value: displayVersion, mono: true },
            { label: "Scope", value: scope === "general" ? "General library" : "Project-adapted" },
            { label: "Project", value: scope === "project" ? project?.name ?? protocol.projectName ?? "Not selected" : null },
            { label: "Availability", value: availability.replaceAll("_", " ") },
            { label: "Review", value: reviewStage.replaceAll("_", " ") },
          ]} />
          <ProtocolWysiwygEditor document={initialDocument} onChange={setDocument} />
        </DocumentCanvas>}
        metadata={<section className="document-editor-properties-card" aria-label="Protocol metadata">
          <header><p>Identity and governance</p><h2>Protocol record</h2></header>
          <div className="document-editor-properties-grid">
            <RecordCodeField label="Protocol ID" prefix="PRT-" name="humanCodeSuffix" minimumDigits={6} placeholder="100001" value={codeSuffix} onValueChange={setCodeSuffix} existingCode={mode === "edit" ? protocol.humanCode : undefined} />
            <label className="md:col-span-2"><span className={formLabelClass}>Protocol title</span><input required name="canonicalTitle" value={canonicalTitle} onChange={(event) => setCanonicalTitle(event.target.value)} className={formInputClass} /></label>
            <label><span className={formLabelClass}>Short title</span><input name="shortTitle" defaultValue={protocol.shortTitle} className={formInputClass} /></label>
            <label><span className={formLabelClass}>English title</span><input name="englishTitle" defaultValue={protocol.englishTitle} className={formInputClass} /></label>
            {mode === "create" ? <label><span className={formLabelClass}>Protocol scope</span><select name="protocolScope" value={scope} onChange={(event) => { const next = event.target.value as "general" | "project"; setScope(next); if (next === "general") setProjectId(""); }} className={formInputClass}><option value="general">General library</option><option value="project">Project-adapted</option></select></label> : <div><span className={formLabelClass}>Scope</span><p className="mt-1 text-sm font-medium capitalize text-ink">{protocol.scope}{protocol.projectName ? ` · ${protocol.projectName}` : ""}</p><p className="mt-0.5 text-xs text-muted">Use “Adapt to project” to preserve General → Project lineage.</p></div>}
            {mode === "create" ? <label><span className={formLabelClass}>Project {scope === "project" ? "· required" : ""}</span><select name="projectId" value={projectId} onChange={(event) => { setProjectId(event.target.value); setSelectedPlanIds([]); setPrimaryPlanIds([]); }} required={scope === "project"} disabled={scope === "general"} className={formInputClass}><option value="">None</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
            <StatusRadioGroup label="Availability" name="availability" options={protocolAvailabilityOptions} value={availability} onValueChange={setAvailability} required className="md:col-span-2" />
            <StatusRadioGroup label="Review stage" name="reviewStage" options={protocolReviewStageOptions} value={reviewStage} onValueChange={setReviewStage} required className="md:col-span-2" />
            <label><span className={formLabelClass}>{reviewed ? "New version" : "Version"}</span><input required name="displayVersion" value={displayVersion} onChange={(event) => setDisplayVersion(event.target.value)} className={formInputClass} /></label>
            <label className="md:col-span-2"><TagFieldLabel /><input name="tags" defaultValue={protocol.tags.join(", ")} placeholder="cell-culture, qc" className={formInputClass} /></label>
            <label className="md:col-span-2 xl:col-span-3"><span className={formLabelClass}>Change summary {reviewed ? "· required" : ""}</span><textarea required={reviewed} name="changeSummary" defaultValue={reviewed ? "" : version.changeSummary} className={textareaClass} placeholder={mode === "create" ? "Initial version." : "What changed and why?"} /></label>
          </div>
        </section>}
        relations={<section className="document-editor-properties-card" aria-label="Protocol relevant items">
          <header><p>Workflow relationship</p><h2>Relevant items</h2><span>Manage plans here; linked records remain compact, traceable, and one click away.</span></header>
          <div className="border-b border-hairline px-3 py-2"><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Research plans</p></div>
          <div className="document-editor-relation-list editorial-scrollbar">
            {visiblePlans.length ? visiblePlans.map((plan) => {
              const checked = selectedPlanIds.includes(plan.id);
              const primary = primaryPlanIds.includes(plan.id);
              return <div key={plan.id} className="document-editor-relation-row">
                <label><input type="checkbox" name="researchPlanIds" value={plan.id} checked={checked} onChange={(event) => togglePlan(plan.id, event.target.checked)} /><span><strong>{plan.code ? `${plan.code} · ` : ""}{plan.title}</strong><small>{plan.projectName}</small></span></label>
                <label className="document-editor-primary-toggle"><input type="checkbox" name="primaryResearchPlanIds" value={plan.id} checked={primary} onChange={(event) => togglePrimary(plan.id, event.target.checked)} />Primary</label>
              </div>;
            }) : <p className="px-3 py-6 text-center text-sm text-muted">No Research Plans are available for this scope.</p>}
          </div>
          <div className="grid gap-1.5 border-t border-hairline p-2.5">
            {(["projects", "experiments", "results", "attachments", "versions"] as const).map((group) => <ProtocolRelevantLinkGroup key={group} label={group === "versions" ? "Version history" : group[0].toUpperCase() + group.slice(1)} items={relevantItems[group] ?? []} />)}
            <ProtocolRelevantLinkGroup label="Tools" items={[{ id: "plate-planner", label: "Plate Map Planner", meta: "Open planning tool", href: plateMapPlannerUrl }]} />
          </div>
        </section>}
      />

      {state.error ? <p role="alert" className="rounded-[8px] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error">{state.error}</p> : null}
      <div className="sticky bottom-4 z-20 flex justify-end"><Button type="submit" variant="primary" size="lg" disabled={pending} className="shadow-soft">{pending ? "Saving…" : mode === "create" ? "Create Protocol" : reviewed ? "Save as new revision" : "Save Protocol"}</Button></div>
    </form>
  );
}

const plateMapPlannerUrl = labToolManifest.find((tool) => tool.id === "free-plate-layout")?.launchUrl ?? "/tools";

function ProtocolRelevantLinkGroup({ label, items }: { label: string; items: RelevantLink[] }) {
  return <details className="rounded-[7px] border border-hairline bg-warm/35" open={items.length > 0 && items.length <= 3 ? true : undefined}>
    <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-1.5 text-xs font-medium text-graphite marker:hidden"><span>{label}</span><span className="ml-auto font-mono text-[10px] text-muted">{items.length}</span></summary>
    <div className="grid gap-px border-t border-hairline bg-hairline">{items.length ? items.map((item) => <Link key={item.id} href={item.href} className="flex min-w-0 items-center gap-2 bg-surface px-2.5 py-1.5 text-xs hover:bg-stone"><span className="min-w-0 flex-1 truncate font-medium text-ink">{item.label}</span>{item.meta ? <span className="shrink-0 text-[10px] text-muted">{item.meta}</span> : null}</Link>) : <p className="bg-surface px-2.5 py-1.5 text-[11px] text-muted">None linked</p>}</div>
  </details>;
}
