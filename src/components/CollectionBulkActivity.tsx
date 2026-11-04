"use client";

import { useI18n } from "@/components/I18nProvider";
import type { BulkMessage, BulkValues } from "@/lib/collection-bulk";

export function CollectionBulkActivityLabel({ action }: { action: string }) {
  const { locale } = useI18n();
  const labels: Record<string, [string, string]> = { bulk_edit: ["Edited", "已修改"], bulk_restore: ["Restored", "已恢复"], bulk_skip: ["Skipped", "已跳过"], bulk_noop: ["No change", "无变化"], archive: ["Archived", "已归档"], delete: ["Moved to Recycle Bin", "已移入回收站"], recycle: ["Recycled, keeping associations", "已回收并保留关联"] };
  return <span data-i18n-ignore>{labels[action]?.[locale === "zh" ? 1 : 0] ?? action}</span>;
}

export function CollectionBulkActivity({ batchId, before, after, reason }: { batchId: string; before?: BulkValues; after?: BulkValues; reason?: BulkMessage }) {
  const { locale } = useI18n();
  const zh = locale === "zh";
  const labels: Record<string, string> = zh ? { title: "名称／标题", status: "管理状态", tags: "标签", notes: "备注", runStatus: "运行对象状态" } : { title: "Title", status: "Status", tags: "Tags", notes: "Notes", runStatus: "Run status" };
  const statuses: Record<string, string> = { active: "启用", paused: "暂停", completed: "已完成", archived: "已归档", draft: "草稿", retired: "停用", planned: "计划中", running: "运行中", failed: "失败", inactive: "停用" };
  const value = (input: unknown, key: string) => Array.isArray(input) ? input.join(" · ") : zh && (key === "status" || key === "runStatus") ? statuses[String(input)] ?? String(input) : String(input ?? "—");
  return <details data-i18n-ignore className="text-xs">
    <summary className="cursor-pointer text-moss">{zh ? "查看本批变更" : "View batch changes"}</summary>
    <p className="my-1 break-all text-muted">{zh ? "批次：" : "Batch: "}{batchId}</p>
    {reason ? <p>{reason[zh ? "zh" : "en"]}</p> : null}
    {before && after ? <dl className="space-y-1">{Object.keys(after).filter(key => JSON.stringify(before[key as keyof BulkValues]) !== JSON.stringify(after[key as keyof BulkValues])).map(key => <div key={key}><dt className="text-muted">{labels[key] ?? key}</dt><dd className="whitespace-pre-wrap break-words">{value(before[key as keyof BulkValues], key)} → {value(after[key as keyof BulkValues], key)}</dd></div>)}</dl> : null}
  </details>;
}
