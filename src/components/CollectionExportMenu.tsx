"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckSquare2, ChevronDown, Download, ListFilter, Rows3 } from "lucide-react";
import { collectionSecondaryActionClass } from "@/components/CollectionToolbar";
import { useI18n } from "@/components/I18nProvider";
import { allCollectionExportHref, selectedCollectionExportHref } from "@/lib/collection-export";

export function CollectionExportMenu({ filteredHref, exportPath }: { filteredHref: string; exportPath: string }) {
  const { locale } = useI18n();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const refreshSelection = useCallback(() => {
    const ids = [...document.querySelectorAll<HTMLInputElement>("input[data-selection-group]:checked")]
      .filter((input) => input.dataset.selectionGroup === exportPath)
      .map((input) => input.value)
      .filter(Boolean);
    setSelectedIds(ids);
  }, [exportPath]);

  useEffect(() => {
    const onChange = (event: Event) => {
      const input = event.target;
      if (input instanceof HTMLInputElement && input.dataset.selectionGroup === exportPath) refreshSelection();
    };
    document.addEventListener("change", onChange);
    return () => document.removeEventListener("change", onChange);
  }, [exportPath, refreshSelection]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key === "Escape") setOpen(false);
      if (event instanceof MouseEvent && !rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const selectedHref = useMemo(() => selectedCollectionExportHref(exportPath, selectedIds), [exportPath, selectedIds]);
  const allHref = useMemo(() => allCollectionExportHref(exportPath), [exportPath]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={collectionSecondaryActionClass}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          refreshSelection();
          setOpen((value) => !value);
        }}
      >
        <Download className="h-4 w-4" aria-hidden />
        {locale === "zh" ? "导出" : "Export"}{selectedIds.length ? ` (${selectedIds.length})` : ""}…
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-72 overflow-hidden rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-surface p-1.5 shadow-soft">
          {selectedIds.length ? (
            <Link role="menuitem" href={selectedHref} onClick={() => setOpen(false)} className="ln-dropdown-motion-item focus-ring flex items-start gap-3 rounded-[var(--ln-radius-control-md)] px-3 py-2.5 hover:bg-sage-surface/60">
              <CheckSquare2 className="ln-dropdown-motion-icon mt-0.5 h-4 w-4 shrink-0 text-moss" aria-hidden />
              <span><strong className="block text-sm text-ink">{locale === "zh" ? `导出已选 ${selectedIds.length} 项` : `Export ${selectedIds.length} selected`}</strong><span className="mt-0.5 block text-xs leading-5 text-muted">{locale === "zh" ? "只导出表格中已勾选的记录" : "Only the records checked in the table"}</span></span>
            </Link>
          ) : (
            <div aria-disabled="true" className="flex items-start gap-3 rounded-[var(--ln-radius-control-md)] px-3 py-2.5 opacity-55">
              <CheckSquare2 className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
              <span><strong className="block text-sm text-ink">{locale === "zh" ? "导出已选项" : "Export selected"}</strong><span className="mt-0.5 block text-xs leading-5 text-muted">{locale === "zh" ? "请先勾选表格记录" : "Select records in the table first"}</span></span>
            </div>
          )}
          <Link role="menuitem" href={filteredHref} onClick={() => setOpen(false)} className="ln-dropdown-motion-item focus-ring flex items-start gap-3 rounded-[var(--ln-radius-control-md)] px-3 py-2.5 hover:bg-warm">
            <ListFilter className="ln-dropdown-motion-icon mt-0.5 h-4 w-4 shrink-0 text-moss" aria-hidden />
            <span><strong className="block text-sm text-ink">{locale === "zh" ? "导出当前筛选结果" : "Export filtered view"}</strong><span className="mt-0.5 block text-xs leading-5 text-muted">{locale === "zh" ? "保留当前搜索和筛选范围" : "Keep the current search and filters"}</span></span>
          </Link>
          <Link role="menuitem" href={allHref} onClick={() => setOpen(false)} className="ln-dropdown-motion-item focus-ring flex items-start gap-3 rounded-[var(--ln-radius-control-md)] px-3 py-2.5 hover:bg-warm">
            <Rows3 className="ln-dropdown-motion-icon mt-0.5 h-4 w-4 shrink-0 text-moss" aria-hidden />
            <span><strong className="block text-sm text-ink">{locale === "zh" ? "导出全部记录" : "Export all records"}</strong><span className="mt-0.5 block text-xs leading-5 text-muted">{locale === "zh" ? "忽略当前筛选条件" : "Ignore the current filters"}</span></span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
