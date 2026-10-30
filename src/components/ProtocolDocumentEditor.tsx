"use client";
import type { MixProposal } from "@/lib/protocol-mix";

import { useActionState, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { DocumentCanvas } from "@/components/DocumentCanvas";
import { DocumentEditorWorkspace, type DocumentEditorWorkspaceTab } from "@/components/DocumentEditorWorkspace";
import { DocumentPageHeader } from "@/components/DocumentPageHeader";
import { DocumentPrintButton } from "@/components/DocumentPrintButton";
import { formInputClass, formLabelClass, formTextareaClass } from "@/components/forms";
import { ProtocolWysiwygEditor } from "@/components/ProtocolWysiwygEditor";
import type { ProtocolStockItem } from "@/components/protocol/ProtocolEditorContext";
import { ProtocolRelevantItemsEditor, type ProtocolRelevantItems } from "@/components/ProtocolRelevantItemsEditor";
import { RecordCodeField } from "@/components/RecordCodeField";
import { TagFieldLabel } from "@/components/TagFieldLabel";
import { Button } from "@/components/ui/Button";
import { Disclosure } from "@/components/ui/Disclosure";
import { StatusRadioGroup } from "@/components/ui/StatusRadioGroup";
import { hasLegacyFormulas, type ProtocolDocument } from "@/lib/protocol-document";
import { isLegacyProtocol } from "@/lib/protocol-conversion";
import { ProtocolSourcesEditor } from "./ProtocolSourcesEditor";
import { pruneUnusedChips } from "@/lib/protocol-chips";
import { protocolAvailabilityOptions, protocolReviewStageOptions } from "@/lib/status-options";
import type { ManualRelevantLink, RelevantCatalogItem } from "@/lib/protocol-relevant-items";
import { ProtocolImportHistory } from "@/components/ProtocolImportHistory";
import type { ProtocolImportHistoryEntry } from "@/lib/protocol-import-history";
import { PageActions } from "@/components/MobilePageMenu";

export type ProtocolEditorState = { error?: string };
export type ProtocolEditorAction = (
  previousState: ProtocolEditorState,
  formData: FormData,
) => Promise<ProtocolEditorState>;

type ProjectOption = { id: string; name: string };
type ResearchPlanOption = { id: string; code?: string | null; title: string; projectId: string; projectName: string };
const initialState: ProtocolEditorState = {};
const textareaClass = `${formTextareaClass} min-h-16 resize-y leading-[var(--ln-rich-text-default-line-height)]`;

export function ProtocolDocumentEditor({
  action,
  mode,
  mixProposals = [],
  dismissMixProposal,
  protocol,
  version,
  initialDocument,
  fromExperiments = [],
  suggestedDisplayVersion,
  projects,
  researchPlans,
  initialResearchPlanIds = [],
  initialPrimaryResearchPlanIds = [],
  relevantItems = {},
  relevantCatalog = [],
  initialManualRelevantLinks = [],
  importHistory = [],
  inventory = [],
}: {
  /** Bench-made mix cards offered from runs. */
  mixProposals?: MixProposal[];
  dismissMixProposal?: (protocolId: string, proposalId: string) => Promise<{ error?: string }>;
  action: ProtocolEditorAction;
  mode: "create" | "edit";
  protocol: { id?: string; humanCode?: string; suggestedCodeSuffix?: string; canonicalTitle: string; shortTitle?: string; englishTitle?: string; availability: string; tags: string[]; scope: "general" | "project"; projectId?: string; projectName?: string };
  version: { id?: string; expectedDocumentVersion?: string; displayVersion: string; reviewStage: string; changeSummary?: string };
  initialDocument: ProtocolDocument;
  /** 整理自实验: the run codes behind `contentJson.provenance`, resolved by the page. */
  fromExperiments?: string[];
  suggestedDisplayVersion?: string;
  projects: ProjectOption[];
  researchPlans: ResearchPlanOption[];
  initialResearchPlanIds?: string[];
  initialPrimaryResearchPlanIds?: string[];
  relevantItems?: ProtocolRelevantItems;
  relevantCatalog?: RelevantCatalogItem[];
  initialManualRelevantLinks?: ManualRelevantLink[];
  importHistory?: ProtocolImportHistoryEntry[];
  /** Stock a chip's material can be linked to, so the run deducts it. */
  inventory?: ProtocolStockItem[];
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
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<DocumentEditorWorkspaceTab>("document");
  const [displayVersion, setDisplayVersion] = useState(reviewed ? suggestedDisplayVersion ?? version.displayVersion : version.displayVersion);
  const [selectedPlanIds, setSelectedPlanIds] = useState(initialResearchPlanIds);
  const [primaryPlanIds, setPrimaryPlanIds] = useState(initialPrimaryResearchPlanIds);
  const [uploadDraftId] = useState(() => `protocol-upload-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`);
  // Chips the author deleted leave unreferenced parameters behind; only what the text still uses is saved.
  const serialized = useMemo(() => JSON.stringify(pruneUnusedChips(document)), [document]);
  const visiblePlans = useMemo(() => scope === "project" && projectId ? researchPlans.filter((plan) => plan.projectId === projectId) : researchPlans, [projectId, researchPlans, scope]);
  const project = projects.find((item) => item.id === projectId);
  const identifier = protocol.humanCode ?? (codeSuffix ? `PRT-${codeSuffix}` : "Draft Protocol");
  const docxExportHref = mode === "edit" && protocol.id && version.id
    ? `/api/protocols/${protocol.id}/versions/${version.id}/docx`
    : undefined;
  const saveLabel = mode === "create" ? "Create Protocol"
    : activeWorkspaceTab === "metadata" ? reviewed ? "Save metadata as new revision" : "Save metadata"
      : activeWorkspaceTab === "relations" ? reviewed ? "Save links as new revision" : "Save links"
        : reviewed ? "Save as new revision" : "Save Protocol";
  const saveHint = activeWorkspaceTab === "metadata" ? "Metadata and other unsaved edits are recorded together."
    : activeWorkspaceTab === "relations" ? "Links and other unsaved edits are recorded together."
      : "Unsaved changes are not recorded until you save.";

  const togglePlan = (planId: string, checked: boolean) => {
    setSelectedPlanIds((current) => checked ? [...new Set([...current, planId])] : current.filter((id) => id !== planId));
    if (!checked) setPrimaryPlanIds((current) => current.filter((id) => id !== planId));
  };
  const togglePrimary = (planId: string, checked: boolean) => {
    setPrimaryPlanIds((current) => checked ? [...new Set([...current, planId])] : current.filter((id) => id !== planId));
    if (checked) setSelectedPlanIds((current) => [...new Set([...current, planId])]);
  };

  return (
    <form inert={pending} aria-busy={pending} action={formAction} className="protocol-density-form">
      {protocol.id ? <input type="hidden" name="protocolId" value={protocol.id} /> : null}
      {version.id ? <><input type="hidden" name="versionId" value={version.id} /><input type="hidden" name="expectedDocumentVersion" value={version.expectedDocumentVersion ?? ""} /></> : null}
      <input type="hidden" name="contentJson" value={serialized} />
      <input type="hidden" name="uploadDraftId" value={uploadDraftId} />
      {mode === "edit" ? <><input type="hidden" name="protocolScope" value={protocol.scope} /><input type="hidden" name="projectId" value={protocol.projectId ?? ""} /></> : null}

      <DocumentEditorWorkspace
        outline={document.sections.filter((section) => section.key !== "consumption_rules" || hasLegacyFormulas(document)).map((section) => ({ id: `protocol-section-${section.key}`, label: section.title }))}
        onActiveTabChange={setActiveWorkspaceTab}
        actions={<><PageActions className="contents"><div id="protocol-document-actions" className="ln-document-actions-host" />{docxExportHref ? <a href={docxExportHref} className="focus-ring ln-document-action" title="Exports the saved version; save your changes first."><Download aria-hidden />Export Word</a> : null}<DocumentPrintButton /></PageActions><div className="protocol-workbench-save" data-active-tab={activeWorkspaceTab}><span className="sr-only" role="status" aria-live="polite">{pending ? "Saving changes" : saveHint}</span><Button type="submit" variant="primary" size="sm" disabled={pending} aria-busy={pending} className="protocol-density-primary-action"><span className="protocol-save-label-full">{pending ? "Saving…" : saveLabel}</span><span className="protocol-save-label-compact">{pending ? "Saving…" : "Save"}</span></Button></div></>}
        document={<DocumentCanvas label={canonicalTitle || "Protocol document editor"}>
          <DocumentPageHeader documentType="Protocol" identifier={identifier} title={canonicalTitle} titlePlaceholder="Untitled Protocol" titleEditor={<input required name="canonicalTitle" value={canonicalTitle} onChange={(event) => setCanonicalTitle(event.target.value)} className="document-page-title-input" placeholder="Untitled Protocol" aria-label="Protocol title" />} facts={[
            { label: "Version", value: displayVersion, mono: true },
            { label: "Scope", value: scope === "general" ? "General library" : "Project-adapted" },
            { label: "Project", value: scope === "project" ? project?.name ?? protocol.projectName ?? "Not selected" : null },
            { label: "Availability", value: availability.replaceAll("_", " ") },
            { label: "Review", value: reviewStage.replaceAll("_", " ") },
          ]} />
          {/* An old-format Protocol is converted as a whole into step blocks, previewed first and saved as a new draft. */}
          {isLegacyProtocol(document) ? <nav aria-label="旧格式步骤" className="mb-3 flex flex-wrap items-center gap-2 border-y border-hairline py-2 print:hidden">
            {protocol.id && version.id ? <a href={`/protocols/${protocol.id}/versions/${version.id}/convert`} className="focus-ring inline-flex min-h-9 items-center rounded-[var(--ln-radius-control-lg)] border border-hairline bg-surface px-3 text-sm font-medium text-moss hover:bg-warm">转换为步骤块</a> : null}
            <span className="text-xs text-muted">这份规程还是旧格式。转换后每步一块、数值成为参数块，可用配液卡、准备清单和体系调整；先预览，再存为新草稿。请先保存这里的改动。</span>
          </nav> : null}
          <ProtocolWysiwygEditor document={document} onChange={setDocument} inventory={inventory} actionsHostId="protocol-document-actions" uploadDraftId={uploadDraftId} mixProposals={mixProposals} onDismissMixProposal={dismissMixProposal && protocol.id ? proposalId => dismissMixProposal(protocol.id!, proposalId) : undefined} />
        </DocumentCanvas>}
        metadata={<section className="document-editor-properties-card protocol-metadata-card" aria-label="Protocol metadata">
          <header><h2>Protocol metadata</h2><Button type="submit" variant="primary" size="sm" disabled={pending} className="protocol-properties-save">{pending ? "Saving…" : saveLabel}</Button><span>Governance and revision details.</span></header>
          <div className="protocol-metadata-sections">
            {mode === "create" ? <div className="protocol-metadata-grid" style={{ padding: "0.65rem 1rem" }}>
              {mode === "create" ? <label><span className={formLabelClass}>Protocol scope</span><select name="protocolScope" value={scope} onChange={(event) => { const next = event.target.value as "general" | "project"; setScope(next); if (next === "general") setProjectId(""); }} className={formInputClass}><option value="general">General library</option><option value="project">Project-adapted</option></select></label> : <div className="protocol-metadata-readonly"><span className={formLabelClass}>Scope</span><strong>{protocol.scope}{protocol.projectName ? ` · ${protocol.projectName}` : ""}</strong><small>Use Adapt to project to preserve lineage.</small></div>}
              {mode === "create" ? <label><span className={formLabelClass}>Project {scope === "project" ? "· required" : ""}</span><select name="projectId" value={projectId} onChange={(event) => { setProjectId(event.target.value); setSelectedPlanIds([]); setPrimaryPlanIds([]); }} required={scope === "project"} disabled={scope === "general"} className={formInputClass}><option value="">None</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
            </div> : null}
            <Disclosure title="Names and ID" summary={identifier}><div className="protocol-metadata-grid">
              <RecordCodeField className="protocol-metadata-code-field" label="Protocol ID" prefix="PRT-" name="humanCodeSuffix" minimumDigits={6} placeholder="100001" value={codeSuffix} onValueChange={setCodeSuffix} existingCode={mode === "edit" ? protocol.humanCode : undefined} />
              <label><span className={formLabelClass}>Short title</span><input name="shortTitle" defaultValue={protocol.shortTitle} className={formInputClass} /></label>
              <label><span className={formLabelClass}>English title</span><input name="englishTitle" defaultValue={protocol.englishTitle} className={formInputClass} /></label>
            </div></Disclosure>
            <Disclosure title="Availability and review" summary={`${availability} · ${reviewStage}`}><div className="protocol-metadata-grid">
              <StatusRadioGroup label="Availability" name="availability" options={protocolAvailabilityOptions} value={availability} onValueChange={setAvailability} required density="compact" />
              <StatusRadioGroup label="Review stage" name="reviewStage" options={protocolReviewStageOptions} value={reviewStage} onValueChange={setReviewStage} required density="compact" />
              <label className="protocol-metadata-span-full"><TagFieldLabel /><input name="tags" defaultValue={protocol.tags.join(", ")} placeholder="cell-culture, qc" className={formInputClass} /></label>
            </div></Disclosure>
            <Disclosure title="Version" summary={displayVersion} defaultOpen={reviewed}><div className="protocol-metadata-grid">
              <label><span className={formLabelClass}>{reviewed ? "New version" : "Version"}</span><input required name="displayVersion" value={displayVersion} onChange={(event) => setDisplayVersion(event.target.value)} className={formInputClass} /></label>
              <label className="protocol-metadata-span-full"><span className={formLabelClass}>Change summary {reviewed ? "· required" : ""}</span><textarea required={reviewed} name="changeSummary" defaultValue={reviewed ? "" : version.changeSummary} className={textareaClass} placeholder={mode === "create" ? "Initial version." : "What changed and why?"} /></label>
            </div></Disclosure>
            <ProtocolSourcesEditor sources={document.sources ?? []} onChange={sources => setDocument(current => ({ ...current, sources }))} fromExperiments={fromExperiments} />
            <ProtocolImportHistory entries={importHistory} />
          </div>
        </section>}
        relations={<ProtocolRelevantItemsEditor
          plans={visiblePlans.map((plan) => ({ id: plan.id, type: "research_plan", label: `${plan.code ? `${plan.code} · ` : ""}${plan.title}`, meta: plan.projectName, projectId: plan.projectId, projectName: plan.projectName }))}
          catalog={relevantCatalog}
          relevantItems={relevantItems}
          selectedPlanIds={selectedPlanIds}
          primaryPlanIds={primaryPlanIds}
          onTogglePlan={togglePlan}
          onTogglePrimary={togglePrimary}
          initialManualLinks={initialManualRelevantLinks}
          researchPlanProjectId={scope === "project" ? projectId : undefined}
          saveControl={<Button type="submit" variant="primary" size="sm" disabled={pending} className="protocol-properties-save">{pending ? "Saving…" : saveLabel}</Button>}
        />}
      />

      {state.error ? <p role="alert" className="rounded-[var(--ln-radius-control-lg)] border border-error/30 bg-error-surface px-3 py-2 text-sm text-error">{state.error}</p> : null}
    </form>
  );
}
