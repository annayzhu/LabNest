"use client";

import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { formInputClass, formLabelClass } from "@/components/forms";
import { ProtocolIdentity } from "@/components/ProtocolIdentity";

export type ExperimentProtocolVersionOption = {
  id: string;
  revision: number;
  displayVersion: string;
  versionTitle: string;
  reviewStage: string;
  stepCount: number;
  protocol: {
    id: string;
    humanCode: string;
    title: string;
    scope: string;
    projectName: string | null;
  };
};

type ProtocolVersionGroup = {
  history: ExperimentProtocolVersionOption[];
  latest: ExperimentProtocolVersionOption;
  primary?: ExperimentProtocolVersionOption;
  protocolId: string;
  searchMode: boolean;
};

function normalizeForCompare(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[\s·._\-–—|()（）/]/g, "");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function optionSearchText(option: ExperimentProtocolVersionOption) {
  return [
    option.protocol.humanCode,
    option.protocol.title,
    option.versionTitle,
    option.displayVersion,
    option.reviewStage,
    option.protocol.projectName,
  ].filter(Boolean).join(" ").toLowerCase();
}

function compareProtocolVersionOptions(a: ExperimentProtocolVersionOption, b: ExperimentProtocolVersionOption) {
  return b.revision - a.revision || b.displayVersion.localeCompare(a.displayVersion, undefined, { numeric: true, sensitivity: "base" });
}

function versionTitleIsRedundant(version: ExperimentProtocolVersionOption) {
  const raw = version.versionTitle?.trim();
  if (!raw) return true;
  const displayPattern = new RegExp(`\\bv?${escapeRegExp(version.displayVersion)}\\b`, "gi");
  const withoutVersion = raw.replace(displayPattern, "").trim();
  const normalizedVersionTitle = normalizeForCompare(withoutVersion);
  const normalizedProtocolTitle = normalizeForCompare(version.protocol.title);
  return !normalizedVersionTitle || normalizedVersionTitle === normalizedProtocolTitle;
}

function protocolVersionMeta(version: ExperimentProtocolVersionOption) {
  const titlePart = versionTitleIsRedundant(version) ? "" : `${version.versionTitle} · `;
  return `${titlePart}v${version.displayVersion} · ${version.reviewStage}${version.protocol.projectName ? ` · ${version.protocol.projectName}` : " · Protocol library"} · imports ${version.stepCount} step${version.stepCount === 1 ? "" : "s"}`;
}

function ProtocolVersionAddButton({ latestId, onAdd, version }: { latestId: string; onAdd: (id: string) => void; version: ExperimentProtocolVersionOption }) {
  const isLatest = version.id === latestId;
  return <button type="button" onClick={() => onAdd(version.id)} className="focus-ring grid w-full gap-2 px-[var(--ln-experiment-protocol-picker-row-padding-x)] py-[var(--ln-experiment-protocol-picker-row-padding-y)] text-left hover:bg-sage-surface sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
    <span className="min-w-0">
      <span className="flex min-w-0 items-start gap-1.5">
        <ProtocolIdentity className="min-w-0 flex-1 text-ink" compact title={version.protocol.title} code={version.protocol.humanCode} />
        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[length:var(--ln-experiment-protocol-picker-badge-size)] font-semibold ${isLatest ? "bg-success-surface text-success" : "bg-stone text-muted"}`}>{isLatest ? "最新版本" : "历史版本"}</span>
      </span>
      <span className="mt-1 block truncate text-[length:var(--ln-experiment-protocol-picker-meta-size)] leading-tight text-muted">{protocolVersionMeta(version)}</span>
    </span>
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-moss"><Plus className="h-3.5 w-3.5" />添加</span>
  </button>;
}

function buildProtocolVersionGroups(versions: ExperimentProtocolVersionOption[], selectedIds: string[], normalizedQuery: string): ProtocolVersionGroup[] {
  const selectedSet = new Set(selectedIds);
  const byProtocol = new Map<string, ExperimentProtocolVersionOption[]>();
  versions.forEach((version) => {
    const group = byProtocol.get(version.protocol.id) ?? [];
    group.push(version);
    byProtocol.set(version.protocol.id, group);
  });
  return [...byProtocol.entries()].flatMap(([protocolId, groupVersions]) => {
    const sorted = [...groupVersions].sort(compareProtocolVersionOptions);
    const latest = sorted[0];
    if (!latest) return [];
    if (normalizedQuery) {
      const matched = sorted.filter((version) => !selectedSet.has(version.id) && optionSearchText(version).includes(normalizedQuery));
      if (!matched.length) return [];
      return [{ protocolId, latest, primary: matched[0], history: matched.slice(1), searchMode: true }];
    }
    const history = sorted.slice(1).filter((version) => !selectedSet.has(version.id));
    const primary = selectedSet.has(latest.id) ? undefined : latest;
    if (!primary && !history.length) return [];
    return [{ protocolId, latest, primary, history, searchMode: false }];
  }).sort((a, b) => `${a.latest.protocol.title} ${a.latest.protocol.humanCode}`.localeCompare(`${b.latest.protocol.title} ${b.latest.protocol.humanCode}`, undefined, { numeric: true, sensitivity: "base" }));
}

export function ExperimentProtocolPicker({
  versions,
  initialSelectedIds = [],
  onSelectionChange,
}: {
  versions: ExperimentProtocolVersionOption[];
  initialSelectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
}) {
  const versionMap = useMemo(() => new Map(versions.map((version) => [version.id, version])), [versions]);
  const [selectedIds, setSelectedIds] = useState(() => initialSelectedIds.filter((id) => versionMap.has(id)));
  const [query, setQuery] = useState("");
  const [expandedProtocolIds, setExpandedProtocolIds] = useState<Set<string>>(() => new Set());
  const normalizedQuery = query.trim().toLowerCase();
  const selectedSet = new Set(selectedIds);
  const protocolGroups = useMemo(() => buildProtocolVersionGroups(versions, selectedIds, normalizedQuery), [versions, selectedIds, normalizedQuery]);

  function commit(next: string[]) {
    setSelectedIds(next);
    onSelectionChange?.(next);
  }

  function add(id: string) {
    if (selectedSet.has(id)) return;
    commit([...selectedIds, id]);
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= selectedIds.length) return;
    const next = [...selectedIds];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  }

  function toggleHistory(protocolId: string) {
    setExpandedProtocolIds((current) => {
      const next = new Set(current);
      if (next.has(protocolId)) next.delete(protocolId);
      else next.add(protocolId);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {selectedIds.map((id) => <input key={id} type="hidden" name="protocolVersionIds" value={id} />)}
      <div>
        <p className={formLabelClass}>Selected ProtocolVersions · execution order</p>
        {selectedIds.length ? <ol className="mt-2 space-y-2">
          {selectedIds.map((id, index) => {
            const version = versionMap.get(id)!;
            return <li key={id} className="grid gap-3 rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-warm/70 px-3 py-3 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-moss font-mono text-xs font-semibold text-warm">{index + 1}</span>
              <span className="min-w-0">
                <ProtocolIdentity title={version.protocol.title} code={version.protocol.humanCode} />
                <span className="mt-0.5 block text-xs text-muted">{protocolVersionMeta(version)} · checkable</span>
              </span>
              <span className="flex items-center justify-end gap-1">
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move ProtocolVersion earlier" className="focus-ring rounded p-1.5 text-muted hover:bg-stone disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" onClick={() => move(index, 1)} disabled={index === selectedIds.length - 1} aria-label="Move ProtocolVersion later" className="focus-ring rounded p-1.5 text-muted hover:bg-stone disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                <button type="button" onClick={() => commit(selectedIds.filter((item) => item !== id))} aria-label={`Remove ${version.protocol.title} ${version.versionTitle}`} className="focus-ring rounded p-1.5 text-error hover:bg-error-surface"><X className="h-4 w-4" /></button>
              </span>
            </li>;
          })}
        </ol> : <p className="mt-2 rounded-[var(--ln-radius-control-lg)] border border-dashed border-hairline px-3 py-4 text-sm text-muted">No ProtocolVersion selected. Add versions below in the order you will perform them; their Steps will become the on-bench checklist.</p>}
      </div>

      <div>
        <label><span className={formLabelClass}>Add from the complete Protocol library</span><span className="relative block"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Protocol title, version or code…" className={`${formInputClass} pl-9`} /></span></label>
        <div className="mt-2 max-h-72 divide-y divide-hairline overflow-y-auto rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-surface">
          {protocolGroups.length ? protocolGroups.map((group) => {
            const expanded = group.searchMode || expandedProtocolIds.has(group.protocolId);
            const visibleHistory = expanded ? group.history : [];
            return <div key={group.protocolId} className="bg-surface">
              {group.primary ? <ProtocolVersionAddButton version={group.primary} latestId={group.latest.id} onAdd={add} /> : <div className="px-[var(--ln-experiment-protocol-picker-row-padding-x)] py-[var(--ln-experiment-protocol-picker-row-padding-y)]">
                <ProtocolIdentity compact title={group.latest.protocol.title} code={group.latest.protocol.humanCode} />
                <span className="mt-1 block text-[length:var(--ln-experiment-protocol-picker-meta-size)] leading-tight text-muted">最新版本 v{group.latest.displayVersion} 已选择；如确实需要，可展开历史版本。</span>
              </div>}
              {group.history.length ? <div className="border-t border-hairline bg-warm/45 px-[var(--ln-experiment-protocol-picker-row-padding-x)] py-1.5">
                {group.searchMode ? <span className="text-[length:var(--ln-experiment-protocol-picker-meta-size)] font-medium text-muted">匹配到 {group.history.length + (group.primary ? 1 : 0)} 个版本</span> : <button type="button" onClick={() => toggleHistory(group.protocolId)} className="focus-ring inline-flex items-center gap-1 rounded-[var(--ln-radius-control-sm)] px-1.5 py-1 text-[length:var(--ln-experiment-protocol-picker-meta-size)] font-semibold text-moss hover:bg-sage-surface">{expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}{expanded ? "收起历史版本" : `显示历史版本（${group.history.length}）`}</button>}
              </div> : null}
              {visibleHistory.length ? <div className="divide-y divide-hairline border-t border-hairline bg-stone/25 pl-[var(--ln-experiment-protocol-picker-history-padding-left)]">
                {visibleHistory.map((version) => <ProtocolVersionAddButton key={version.id} version={version} latestId={group.latest.id} onAdd={add} />)}
              </div> : null}
            </div>;
          }) : <p className="px-3 py-6 text-center text-sm text-muted">{versions.length === selectedIds.length ? "All ProtocolVersions are selected." : "No matching ProtocolVersion."}</p>}
        </div>
      </div>
      <p className="rounded-[var(--ln-radius-control-lg)] border border-hairline bg-sage-surface/55 px-3 py-2 text-xs leading-5 text-graphite"><strong className="font-semibold text-ink">What happens after Save:</strong> the selected versions are frozen in this order, each version becomes one execution block, and its Steps become individually and whole-block checkable items in On-bench Run.</p>
    </div>
  );
}
