"use client";

import { ArrowDown, ArrowUp, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { formInputClass, formLabelClass } from "@/components/forms";

export type ExperimentProtocolVersionOption = {
  id: string;
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
  const normalizedQuery = query.trim().toLowerCase();
  const selectedSet = new Set(selectedIds);
  const matches = versions.filter((version) => !selectedSet.has(version.id) && (!normalizedQuery || optionSearchText(version).includes(normalizedQuery)));

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

  return (
    <div className="space-y-4">
      {selectedIds.map((id) => <input key={id} type="hidden" name="protocolVersionIds" value={id} />)}
      <div>
        <p className={formLabelClass}>Selected ProtocolVersions · execution order</p>
        {selectedIds.length ? <ol className="mt-2 space-y-2">
          {selectedIds.map((id, index) => {
            const version = versionMap.get(id)!;
            return <li key={id} className="grid gap-3 rounded-[9px] border border-hairline bg-warm/70 px-3 py-3 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-moss font-mono text-xs font-semibold text-warm">{index + 1}</span>
              <span className="min-w-0">
                <strong className="block text-sm font-medium text-ink">{version.protocol.humanCode} · {version.protocol.title}</strong>
                <span className="mt-0.5 block text-xs text-muted">{version.versionTitle} · v{version.displayVersion} · {version.reviewStage}{version.protocol.projectName ? ` · ${version.protocol.projectName}` : " · Protocol library"} · {version.stepCount} checkable step{version.stepCount === 1 ? "" : "s"}</span>
              </span>
              <span className="flex items-center justify-end gap-1">
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move ProtocolVersion earlier" className="focus-ring rounded p-1.5 text-muted hover:bg-stone disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" onClick={() => move(index, 1)} disabled={index === selectedIds.length - 1} aria-label="Move ProtocolVersion later" className="focus-ring rounded p-1.5 text-muted hover:bg-stone disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                <button type="button" onClick={() => commit(selectedIds.filter((item) => item !== id))} aria-label={`Remove ${version.protocol.title} ${version.versionTitle}`} className="focus-ring rounded p-1.5 text-error hover:bg-error-surface"><X className="h-4 w-4" /></button>
              </span>
            </li>;
          })}
        </ol> : <p className="mt-2 rounded-[8px] border border-dashed border-hairline px-3 py-4 text-sm text-muted">No ProtocolVersion selected. Add versions below in the order you will perform them; their Steps will become the on-bench checklist.</p>}
      </div>

      <div>
        <label><span className={formLabelClass}>Add from the complete Protocol library</span><span className="relative block"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search code, Protocol title or version title…" className={`${formInputClass} pl-9`} /></span></label>
        <div className="mt-2 max-h-72 divide-y divide-hairline overflow-y-auto rounded-[9px] border border-hairline bg-surface">
          {matches.length ? matches.map((version) => <button key={version.id} type="button" onClick={() => add(version.id)} className="focus-ring grid w-full gap-2 px-3 py-3 text-left hover:bg-sage-surface sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <span className="min-w-0"><strong className="block text-sm font-medium text-ink">{version.protocol.humanCode} · {version.protocol.title}</strong><span className="mt-0.5 block text-xs text-muted">{version.versionTitle} · v{version.displayVersion} · {version.reviewStage}{version.protocol.projectName ? ` · ${version.protocol.projectName}` : " · Protocol library"} · imports {version.stepCount} step{version.stepCount === 1 ? "" : "s"}</span></span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-moss"><Plus className="h-3.5 w-3.5" />Add</span>
          </button>) : <p className="px-3 py-6 text-center text-sm text-muted">{versions.length === selectedIds.length ? "All ProtocolVersions are selected." : "No matching ProtocolVersion."}</p>}
        </div>
      </div>
      <p className="rounded-[8px] border border-hairline bg-sage-surface/55 px-3 py-2 text-xs leading-5 text-graphite"><strong className="font-semibold text-ink">What happens after Save:</strong> the selected versions are frozen in this order, each version becomes one execution block, and its Steps become individually and whole-block checkable items in On-bench Run.</p>
    </div>
  );
}
