"use client";

import Link from "next/link";
import { useActionState } from "react";
import { addAnalysisResult, type AnalysisUploadState } from "@/app/experiments/analysis-actions";
import { analysisTools } from "@/lib/analysis-results";
import { formInputClass } from "./forms";
import { Button } from "./ui/Button";

/** 添加分析结果: pick the tool and the workbook it exported; the result starts as a draft to complete from there. */
export function AnalysisResultUpload({ experimentId }: { experimentId: string }) {
  const [state, action, pending] = useActionState(addAnalysisResult.bind(null, experimentId), {} as AnalysisUploadState);
  return <details className="border-t border-hairline bg-surface">
    <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-graphite">添加分析结果</summary>
    <form action={action} className="space-y-2 border-t border-hairline px-3 py-2 text-xs text-graphite">
      <label className="block">来自<select name="tool" defaultValue="qpcr-analysis" className={formInputClass}>{Object.entries(analysisTools).map(([key, label]) => <option key={key} value={key}>{label}工作台</option>)}</select></label>
      <label className="block">导出的工作簿（.xlsx、.xls 或 .csv）<input name="file" type="file" accept=".xlsx,.xls,.csv" required className="mt-1 block w-full text-xs" /></label>
      <label className="block">结果名称（可留空）<input name="title" placeholder="例如：GAPDH 相对表达" className={formInputClass} /></label>
      <p className="text-muted">工作簿作为文件放进新结果，LabNest 不读取也不改动其中的数值。</p>
      <Button type="submit" size="sm" variant="primary" disabled={pending} aria-busy={pending}>{pending ? "添加中…" : "添加"}</Button>
      {state.error ? <p role="alert" className="text-error">{state.error}</p> : null}
      {state.resultId ? <p role="status" className="text-success">已添加为草稿结果。<Link href={`/results/${state.resultId}`} className="focus-ring font-medium text-moss underline">打开结果</Link></p> : null}
    </form>
  </details>;
}
