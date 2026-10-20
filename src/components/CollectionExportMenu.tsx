"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckSquare2, ChevronDown, Download, ListFilter, Rows3, Upload } from "lucide-react";
import { collectionSecondaryActionClass } from "@/components/CollectionToolbar";
import { useI18n } from "@/components/I18nProvider";
import { allCollectionExportHref, selectedCollectionExportHref } from "@/lib/collection-export";
import { anchoredPopoverStyle, useAnchoredPopover } from "@/components/ui/useAnchoredPopover";

/** Import sits in the same menu as export so a list toolbar carries one secondary button. */
export function CollectionExportMenu({ filteredHref, exportPath, importHref }: { filteredHref: string; exportPath: string; importHref?: string }) {
  const { locale } = useI18n();
  const { id, button, panel, close } = useAnchoredPopover();
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

  const selectedHref = useMemo(() => selectedCollectionExportHref(exportPath, selectedIds), [exportPath, selectedIds]);
  const allHref = useMemo(() => allCollectionExportHref(exportPath), [exportPath]);

  return (
    <div className="relative">
      <button
        ref={button}
        popoverTarget={id}
        type="button"
        className={collectionSecondaryActionClass}
        aria-expanded={false}
        onClick={refreshSelection}
      >
        <Download className="h-4 w-4" aria-hidden />
        {importHref ? (locale === "zh" ? "导入 / 导出" : "Import / Export") : (locale === "zh" ? "导出" : "Export")}{selectedIds.length ? ` (${selectedIds.length})` : ""}
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </button>
        <div ref={panel} id={id} popover="auto" role="menu" style={anchoredPopoverStyle} className="w-72 rounded-[var(--ln-radius-panel-inner)] border border-hairline bg-surface p-1.5 shadow-soft">
          {importHref ? <Link role="menuitem" href={importHref} onClick={close} className="ln-dropdown-motion-item focus-ring mb-1 flex items-start gap-3 rounded-[var(--ln-radius-control-md)] border-b border-hairline px-3 py-2.5 hover:bg-warm">
            <Upload className="ln-dropdown-motion-icon mt-0.5 h-4 w-4 shrink-0 text-moss" aria-hidden />
            <span><strong className="block text-sm text-ink">{locale === "zh" ? "导入记录" : "Import records"}</strong><span className="mt-0.5 block text-xs leading-5 text-muted">{locale === "zh" ? "从结构化文件创建记录" : "Create records from a structured file"}</span></span>
          </Link> : null}
          {selectedIds.length ? (
            <Link role="menuitem" href={selectedHref} onClick={close} className="ln-dropdown-motion-item focus-ring flex items-start gap-3 rounded-[var(--ln-radius-control-md)] px-3 py-2.5 hover:bg-sage-surface/60">
              <CheckSquare2 className="ln-dropdown-motion-icon mt-0.5 h-4 w-4 shrink-0 text-moss" aria-hidden />
              <span><strong className="block text-sm text-ink">{locale === "zh" ? `导出已选 ${selectedIds.length} 项` : `Export ${selectedIds.length} selected`}</strong><span className="mt-0.5 block text-xs leading-5 text-muted">{locale === "zh" ? "只导出表格中已勾选的记录" : "Only the records checked in the table"}</span></span>
            </Link>
          ) : (
            <div aria-disabled="true" className="flex items-start gap-3 rounded-[var(--ln-radius-control-md)] px-3 py-2.5 opacity-55">
              <CheckSquare2 className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
              <span><strong className="block text-sm text-ink">{locale === "zh" ? "导出已选项" : "Export selected"}</strong><span className="mt-0.5 block text-xs leading-5 text-muted">{locale === "zh" ? "请先勾选表格记录" : "Select records in the table first"}</span></span>
            </div>
          )}
          <Link role="menuitem" href={filteredHref} onClick={close} className="ln-dropdown-motion-item focus-ring flex items-start gap-3 rounded-[var(--ln-radius-control-md)] px-3 py-2.5 hover:bg-warm">
            <ListFilter className="ln-dropdown-motion-icon mt-0.5 h-4 w-4 shrink-0 text-moss" aria-hidden />
            <span><strong className="block text-sm text-ink">{locale === "zh" ? "导出当前筛选结果" : "Export filtered view"}</strong><span className="mt-0.5 block text-xs leading-5 text-muted">{locale === "zh" ? "保留当前搜索和筛选范围" : "Keep the current search and filters"}</span></span>
          </Link>
          <Link role="menuitem" href={allHref} onClick={close} className="ln-dropdown-motion-item focus-ring flex items-start gap-3 rounded-[var(--ln-radius-control-md)] px-3 py-2.5 hover:bg-warm">
            <Rows3 className="ln-dropdown-motion-icon mt-0.5 h-4 w-4 shrink-0 text-moss" aria-hidden />
            <span><strong className="block text-sm text-ink">{locale === "zh" ? "导出全部记录" : "Export all records"}</strong><span className="mt-0.5 block text-xs leading-5 text-muted">{locale === "zh" ? "忽略当前筛选条件" : "Ignore the current filters"}</span></span>
          </Link>
        </div>
    </div>
  );
}
