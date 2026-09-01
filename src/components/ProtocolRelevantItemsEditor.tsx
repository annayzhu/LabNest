"use client";

import { Link2, LockKeyhole, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import {
  filterRelevantItemCatalog,
  type ManualRelevantLink,
  type RelevantCatalogItem,
  type RelevantCatalogType,
} from "@/lib/protocol-relevant-items";

export type ProtocolRelevantLink = { id: string; label: string; meta?: string; href: string };
export type ProtocolRelevantItems = {
  projects?: ProtocolRelevantLink[];
  experiments?: ProtocolRelevantLink[];
  results?: ProtocolRelevantLink[];
  attachments?: ProtocolRelevantLink[];
  versions?: ProtocolRelevantLink[];
};

type PlanOption = RelevantCatalogItem & { type: "research_plan"; projectId: string; projectName: string };

const typeLabels: Record<RelevantCatalogType | "all", string> = {
  all: "All types",
  research_plan: "Research plans",
  project: "Projects",
  experiment: "Experiments",
  result: "Results",
  attachment: "Attachments",
  version: "Versions",
};

export function ProtocolRelevantItemsEditor({
  plans,
  catalog,
  relevantItems,
  selectedPlanIds,
  primaryPlanIds,
  onTogglePlan,
  onTogglePrimary,
  initialManualLinks = [],
}: {
  plans: PlanOption[];
  catalog: RelevantCatalogItem[];
  relevantItems: ProtocolRelevantItems;
  selectedPlanIds: string[];
  primaryPlanIds: string[];
  onTogglePlan: (id: string, checked: boolean) => void;
  onTogglePrimary: (id: string, checked: boolean) => void;
  initialManualLinks?: ManualRelevantLink[];
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<RelevantCatalogType | "all">("all");
  const [manualLinks, setManualLinks] = useState<ManualRelevantLink[]>(initialManualLinks);
  const planMap = useMemo(() => new Map(plans.map((item) => [item.id, item])), [plans]);
  const catalogMap = useMemo(() => new Map(catalog.map((item) => [`${item.type}:${item.id}`, item])), [catalog]);
  const filtered = useMemo(() => filterRelevantItemCatalog([...plans, ...catalog], query, type), [catalog, plans, query, type]);
  const selectedManualKeys = new Set(manualLinks.map((item) => `${item.type}:${item.id}`));

  const addManual = (item: RelevantCatalogItem) => {
    if (item.type === "research_plan" || item.type === "version") return;
    const link = { type: item.type, id: item.id } as ManualRelevantLink;
    setManualLinks((current) => current.some((candidate) => candidate.type === link.type && candidate.id === link.id) ? current : [...current, link]);
  };
  const removeManual = (typeToRemove: ManualRelevantLink["type"], id: string) => setManualLinks((current) => current.filter((item) => item.type !== typeToRemove || item.id !== id));

  return <section className="document-editor-properties-card" aria-label="Protocol relevant items">
    <input type="hidden" name="relevantItemLinksJson" value={JSON.stringify(manualLinks)} />
    <header><p>Workflow relationship</p><h2>Relevant items</h2><span>Search and link records without deleting their source data. System provenance stays locked.</span></header>
    <div className="document-editor-relevant-search">
      <label><Search aria-hidden /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search plans, experiments, results, or files…" aria-label="Search relevant items" /></label>
      <select value={type} onChange={(event) => setType(event.target.value as typeof type)} aria-label="Relevant item type">{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
    </div>

    <div className="document-editor-linked-items">
      <h3>Linked <span>{selectedPlanIds.length + manualLinks.length}</span></h3>
      {!selectedPlanIds.length && !manualLinks.length ? <p className="document-editor-relevant-empty-message">No user-managed links yet.</p> : null}
      {selectedPlanIds.map((id) => {
        const item = planMap.get(id);
        if (!item) return null;
        return <div key={`research_plan:${id}`} className="document-editor-linked-row"><span><strong>{item.label}</strong><small>{item.projectName}</small></span><label className="document-editor-primary-toggle"><input type="checkbox" name="primaryResearchPlanIds" value={id} checked={primaryPlanIds.includes(id)} onChange={(event) => onTogglePrimary(id, event.target.checked)} />Primary</label><button type="button" onClick={() => onTogglePlan(id, false)} aria-label={`Unlink ${item.label}`}><X aria-hidden /></button><input type="hidden" name="researchPlanIds" value={id} /></div>;
      })}
      {manualLinks.map((link) => {
        const item = catalogMap.get(`${link.type}:${link.id}`);
        return <div key={`${link.type}:${link.id}`} className="document-editor-linked-row"><span><strong>{item?.label ?? link.id}</strong><small>{typeLabels[link.type]}{item?.meta ? ` · ${item.meta}` : ""}</small></span><button type="button" onClick={() => removeManual(link.type, link.id)} aria-label={`Unlink ${item?.label ?? link.id}`}><X aria-hidden /></button></div>;
      })}
    </div>

    <div className="document-editor-relation-results" aria-live="polite">
      <h3>{query ? "Search results" : "Available items"}<span>{filtered.length}</span></h3>
      {filtered.map((item) => {
        const selected = item.type === "research_plan" ? selectedPlanIds.includes(item.id) : selectedManualKeys.has(`${item.type}:${item.id}`);
        const locked = item.type === "version";
        return <div key={`${item.type}:${item.id}`} className={cn("document-editor-relation-result", selected && "is-selected")}><span><strong>{item.label}</strong><small>{typeLabels[item.type]}{item.meta ? ` · ${item.meta}` : ""}</small></span>{locked ? <span className="document-editor-system-lock"><LockKeyhole aria-hidden />History</span> : <button type="button" disabled={selected} onClick={() => item.type === "research_plan" ? onTogglePlan(item.id, true) : addManual(item)}><Plus aria-hidden />{selected ? "Linked" : "Link"}</button>}</div>;
      })}
      {!filtered.length ? <p className="document-editor-relevant-empty-message">No matching records.</p> : null}
    </div>

    <div className="document-editor-relevant-groups">
      {(["projects", "experiments", "results", "attachments", "versions"] as const).map((group) => <SystemRelevantGroup key={group} label={group === "versions" ? "Version history" : typeLabels[group === "projects" ? "project" : group === "experiments" ? "experiment" : group === "results" ? "result" : group === "attachments" ? "attachment" : "version"]} items={relevantItems[group] ?? []} />)}
    </div>
  </section>;
}

function SystemRelevantGroup({ label, items }: { label: string; items: ProtocolRelevantLink[] }) {
  return <details className="document-editor-relevant-group" open={items.length > 0 && items.length <= 3 ? true : undefined}>
    <summary><span>{label}</span><span className="document-editor-relevant-count">{items.length}</span></summary>
    <div className="document-editor-relevant-group-body">{items.length ? items.map((item) => <Link key={item.id} href={item.href} className="document-editor-relevant-row"><Link2 aria-hidden /><span className="min-w-0 flex-1 truncate font-medium text-ink">{item.label}</span>{item.meta ? <span className="document-editor-relevant-meta">{item.meta}</span> : null}<LockKeyhole aria-label="System provenance" /></Link>) : <p className="document-editor-relevant-row document-editor-relevant-empty">None linked</p>}</div>
  </details>;
}
