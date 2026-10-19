"use client";

import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { formInputClass, formLabelClass } from "@/components/forms";
import { ProtocolIdentity } from "@/components/ProtocolIdentity";
import { protocolStateLabel } from "@/lib/protocol-import-messages";

export type ExperimentProtocolVersionOption = {
  id: string;
  researchPlanIds?: string[];
  revision: number;
  displayVersion: string;
  versionTitle: string;
  reviewStage: string;
  stepCount: number;
  hasSystems?: boolean;
  execution?: import("./ExecutionRecordPreview").ProtocolExecutionPreviewData;
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
  return `${titlePart}v${version.displayVersion} · ${protocolStateLabel(version.reviewStage, "en")} · ${version.protocol.projectName ?? "Protocol library"} · ${version.stepCount} ${version.stepCount === 1 ? "step" : "steps"}`;
}

function ProtocolVersionAddButton({ latestId, onAdd, version }: { latestId: string; onAdd: (id: string) => void; version: ExperimentProtocolVersionOption }) {
  return <button type="button" onClick={() => onAdd(version.id)} className="focus-ring flex w-full min-w-0 items-center gap-2 px-[var(--ln-experiment-protocol-picker-row-padding-x)] py-[var(--ln-experiment-protocol-picker-row-padding-y)] text-left hover:bg-sage-surface">
    <span className="min-w-0 flex-1">
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-[length:var(--ln-experiment-protocol-picker-title-size)] font-medium text-ink" title={version.protocol.title}>{version.protocol.title}</span>
        {version.id === latestId ? null : <span className="shrink-0 rounded-full bg-stone px-1.5 text-[length:var(--ln-experiment-protocol-picker-badge-size)] leading-5 text-muted">Earlier version</span>}
      </span>
      <span className="block truncate text-[length:var(--ln-experiment-protocol-picker-meta-size)] leading-tight text-muted">{version.protocol.humanCode} · {protocolVersionMeta(version)}</span>
    </span>
    <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold text-moss"><Plus className="h-3.5 w-3.5" aria-hidden />Add</span>
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
  return [...byProtocol.entries()].flatMap<ProtocolVersionGroup>(([protocolId, groupVersions]) => {
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
  });
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
    <div className="space-y-3">
      {selectedIds.map((id) => <input key={id} type="hidden" name="protocolVersionIds" value={id} />)}
      <div>
        <p className={formLabelClass}>Chosen Protocols · in run order</p>
        {selectedIds.length ? <ol className="mt-1">
          {selectedIds.map((id, index) => {
            const version = versionMap.get(id)!;
            return <li key={id} className="flex min-w-0 items-center gap-2 border-b border-hairline py-1.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-moss font-mono text-xs font-semibold text-warm" aria-label={`Position ${index + 1}`}>{index + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium" title={version.protocol.title}>{version.protocol.title}</span>
                <span className="block truncate text-xs text-muted">{`v${version.displayVersion} · ${version.stepCount} ${version.stepCount === 1 ? "step" : "steps"}`}</span>
              </span>
              <span className="flex shrink-0 items-center">
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move Protocol up" className="focus-ring flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-stone disabled:opacity-30"><ArrowUp className="h-4 w-4" aria-hidden /></button>
                <button type="button" onClick={() => move(index, 1)} disabled={index === selectedIds.length - 1} aria-label="Move Protocol down" className="focus-ring flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-stone disabled:opacity-30"><ArrowDown className="h-4 w-4" aria-hidden /></button>
                <button type="button" onClick={() => commit(selectedIds.filter((item) => item !== id))} aria-label={`Remove ${version.protocol.title} from the chosen Protocols`} className="focus-ring flex h-7 w-7 items-center justify-center rounded text-error hover:bg-error-surface"><X className="h-4 w-4" aria-hidden /></button>
              </span>
            </li>;
          })}
        </ol> : <p className="mt-1 rounded-[var(--ln-radius-control-lg)] border border-dashed border-hairline px-3 py-2 text-sm text-muted">No Protocol chosen yet.</p>}
      </div>

      <div>
        <label><span className={formLabelClass}>Add from Protocol library</span><span className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 mt-[calc(var(--ln-form-field-gap)/2)] h-4 w-4 -translate-y-1/2 text-muted" aria-hidden /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, version or code…" className={`${formInputClass} pl-9`} /></span></label>
        <div className="mt-1.5 max-h-72 divide-y divide-hairline overflow-y-auto rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-surface">
          {protocolGroups.length ? protocolGroups.map((group) => {
            const expanded = group.searchMode || expandedProtocolIds.has(group.protocolId);
            const visibleHistory = expanded ? group.history : [];
            return <div key={group.protocolId} className="bg-surface">
              {group.primary ? <ProtocolVersionAddButton version={group.primary} latestId={group.latest.id} onAdd={add} /> : <div className="px-[var(--ln-experiment-protocol-picker-row-padding-x)] py-[var(--ln-experiment-protocol-picker-row-padding-y)]">
                <ProtocolIdentity compact title={group.latest.protocol.title} code={group.latest.protocol.humanCode} />
                <span className="mt-0.5 block text-[length:var(--ln-experiment-protocol-picker-meta-size)] leading-tight text-muted">{`Latest version v${group.latest.displayVersion} is chosen; open earlier versions if you need one.`}</span>
              </div>}
              {group.history.length ? <div className="border-t border-hairline bg-warm/45 px-[var(--ln-experiment-protocol-picker-row-padding-x)] py-1.5">
                {group.searchMode ? <span className="text-[length:var(--ln-experiment-protocol-picker-meta-size)] font-medium text-muted">{`${group.history.length + (group.primary ? 1 : 0)} matching versions`}</span> : <button type="button" onClick={() => toggleHistory(group.protocolId)} className="focus-ring inline-flex items-center gap-1 rounded-[var(--ln-radius-control-sm)] px-1.5 py-1 text-[length:var(--ln-experiment-protocol-picker-meta-size)] font-semibold text-moss hover:bg-sage-surface">{expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}{expanded ? "Hide earlier versions" : `Show earlier versions (${group.history.length})`}</button>}
              </div> : null}
              {visibleHistory.length ? <div className="divide-y divide-hairline border-t border-hairline bg-stone/25 pl-[var(--ln-experiment-protocol-picker-history-padding-left)]">
                {visibleHistory.map((version) => <ProtocolVersionAddButton key={version.id} version={version} latestId={group.latest.id} onAdd={add} />)}
              </div> : null}
            </div>;
          }) : <p className="px-3 py-6 text-center text-sm text-muted">{versions.length === selectedIds.length ? "All versions are chosen." : "No matching Protocol version."}</p>}
        </div>
      </div>
    </div>
  );
}
