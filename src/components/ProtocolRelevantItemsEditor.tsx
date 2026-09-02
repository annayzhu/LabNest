"use client";

import { Link2, LockKeyhole, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  researchPlanProjectId,
  saveControl,
}: {
  plans: PlanOption[];
  catalog: RelevantCatalogItem[];
  relevantItems: ProtocolRelevantItems;
  selectedPlanIds: string[];
  primaryPlanIds: string[];
  onTogglePlan: (id: string, checked: boolean) => void;
  onTogglePrimary: (id: string, checked: boolean) => void;
  initialManualLinks?: ManualRelevantLink[];
  researchPlanProjectId?: string;
  saveControl?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<RelevantCatalogType | "all">("all");
  const [manualLinks, setManualLinks] = useState<ManualRelevantLink[]>(initialManualLinks);
  const [remoteResults, setRemoteResults] = useState<RelevantCatalogItem[]>([]);
  const [searching, setSearching] = useState(false);
  const searchNeedle = query.trim();
  const hasSearchQuery = searchNeedle.length >= 2;
  useEffect(() => {
    const needle = query.trim();
    if (needle.length < 2) return;
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ q: needle, type });
        if (researchPlanProjectId) params.set("projectId", researchPlanProjectId);
        const response = await fetch(`/api/protocols/relevant-items?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search failed");
        const payload = await response.json() as { items?: RelevantCatalogItem[] };
        setRemoteResults(payload.items ?? []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setRemoteResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 180);
    return () => { globalThis.clearTimeout(timeout); controller.abort(); };
  }, [query, researchPlanProjectId, type]);
  const combinedCatalog = useMemo(() => {
    const unique = new Map<string, RelevantCatalogItem>();
    for (const item of [...plans, ...catalog, ...(hasSearchQuery ? remoteResults : [])]) unique.set(`${item.type}:${item.id}`, item);
    return [...unique.values()];
  }, [catalog, hasSearchQuery, plans, remoteResults]);
  const planMap = useMemo(() => new Map(combinedCatalog.filter((item): item is PlanOption => item.type === "research_plan" && Boolean(item.projectId && item.projectName)).map((item) => [item.id, item])), [combinedCatalog]);
  const catalogMap = useMemo(() => new Map(combinedCatalog.map((item) => [`${item.type}:${item.id}`, item])), [combinedCatalog]);
  const filtered = useMemo(() => hasSearchQuery ? filterRelevantItemCatalog(combinedCatalog, query, type) : [], [combinedCatalog, hasSearchQuery, query, type]);
  const selectedManualKeys = new Set(manualLinks.map((item) => `${item.type}:${item.id}`));
  const systemGroups = (["projects", "experiments", "results", "attachments", "versions"] as const)
    .map((group) => ({ group, items: relevantItems[group] ?? [] }))
    .filter(({ items }) => items.length > 0);
  const systemLinkCount = systemGroups.reduce((total, { items }) => total + items.length, 0);

  const addManual = (item: RelevantCatalogItem) => {
    if (item.type === "research_plan" || item.type === "version") return;
    const link = { type: item.type, id: item.id } as ManualRelevantLink;
    setManualLinks((current) => current.some((candidate) => candidate.type === link.type && candidate.id === link.id) ? current : [...current, link]);
  };
  const removeManual = (typeToRemove: ManualRelevantLink["type"], id: string) => setManualLinks((current) => current.filter((item) => item.type !== typeToRemove || item.id !== id));

  return <section className="document-editor-properties-card" aria-label="Protocol related records">
    <input type="hidden" name="relevantItemLinksJson" value={JSON.stringify(manualLinks)} />
    <header><h2>Related records</h2>{saveControl}<span>Search, select, and review the records connected to this protocol.</span></header>
    <div className="document-editor-relevant-search">
      <label><Search aria-hidden /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search plans, experiments, results, or files…" aria-label="Search relevant items" /></label>
      <select value={type} onChange={(event) => setType(event.target.value as typeof type)} aria-label="Relevant item type">{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
    </div>

    {hasSearchQuery ? <div className="document-editor-relation-results" aria-live="polite">
      <h3>Search results <span className={searching ? "ln-inline-loading" : undefined}>{searching ? "Searching…" : filtered.length}</span></h3>
      {filtered.map((item) => {
        const selected = item.type === "research_plan" ? selectedPlanIds.includes(item.id) : selectedManualKeys.has(`${item.type}:${item.id}`);
        const locked = item.type === "version";
        return <div key={`${item.type}:${item.id}`} className={cn("document-editor-relation-result", selected && "is-selected")}><span><strong>{item.label}</strong><small>{typeLabels[item.type]}{item.meta ? ` · ${item.meta}` : ""}</small></span>{locked ? <span className="document-editor-system-lock"><LockKeyhole aria-hidden />History</span> : <button type="button" disabled={selected} onClick={() => item.type === "research_plan" ? onTogglePlan(item.id, true) : addManual(item)}><Plus aria-hidden />{selected ? "Linked" : "Link"}</button>}</div>;
      })}
      {!filtered.length && !searching ? <p className="document-editor-relevant-empty-message">No matching records.</p> : null}
    </div> : <p className="document-editor-relevant-search-hint">{searchNeedle ? "Type at least 2 characters to search." : "Search by name or code to add a related item."}</p>}

    <div className="document-editor-linked-items">
      <h3>Selected links <span>{selectedPlanIds.length + manualLinks.length}</span></h3>
      {!selectedPlanIds.length && !manualLinks.length ? <p className="document-editor-relevant-empty-message">No editable links selected.</p> : null}
      {selectedPlanIds.map((id) => {
        const item = planMap.get(id);
        if (!item) return null;
        return <div key={`research_plan:${id}`} className="document-editor-linked-row"><span><strong title={item.label}>{item.label}</strong><small>{item.projectName}</small></span><label className="document-editor-primary-toggle"><input type="checkbox" name="primaryResearchPlanIds" value={id} checked={primaryPlanIds.includes(id)} onChange={(event) => onTogglePrimary(id, event.target.checked)} />Primary</label><button type="button" onClick={() => onTogglePlan(id, false)} aria-label={`Unlink ${item.label}`}><X aria-hidden /></button><input type="hidden" name="researchPlanIds" value={id} /></div>;
      })}
      {manualLinks.map((link) => {
        const item = catalogMap.get(`${link.type}:${link.id}`);
        return <div key={`${link.type}:${link.id}`} className="document-editor-linked-row"><span><strong title={item?.label ?? link.id}>{item?.label ?? link.id}</strong><small>{typeLabels[link.type]}{item?.meta ? ` · ${item.meta}` : ""}</small></span><button type="button" onClick={() => removeManual(link.type, link.id)} aria-label={`Unlink ${item?.label ?? link.id}`}><X aria-hidden /></button></div>;
      })}
    </div>

    {systemGroups.length ? <div className="document-editor-relevant-groups"><h3>System links <span>{systemLinkCount}</span></h3>
      {systemGroups.map(({ group, items }) => <SystemRelevantGroup key={group} label={group === "versions" ? "Version history" : typeLabels[group === "projects" ? "project" : group === "experiments" ? "experiment" : group === "results" ? "result" : group === "attachments" ? "attachment" : "version"]} items={items} />)}
    </div> : null}
  </section>;
}

function SystemRelevantGroup({ label, items }: { label: string; items: ProtocolRelevantLink[] }) {
  return <details className="document-editor-relevant-group" open={items.length <= 3 ? true : undefined}>
    <summary><span>{label}</span><span className="document-editor-relevant-count">{items.length}</span></summary>
    <div className="document-editor-relevant-group-body">{items.map((item) => <Link key={item.id} href={item.href} className="document-editor-relevant-row"><Link2 aria-hidden /><span className="min-w-0 flex-1 truncate font-medium text-ink" title={item.label}>{item.label}</span>{item.meta ? <span className="document-editor-relevant-meta" title={item.meta}>{item.meta}</span> : null}<LockKeyhole className="shrink-0" aria-label="System provenance" /></Link>)}</div>
  </details>;
}
