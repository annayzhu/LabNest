"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useI18n } from "./I18nProvider";
import { addAnalysisResult, type AnalysisUploadState } from "@/app/experiments/analysis-actions";
import { analysisTools } from "@/lib/analysis-results";
import { formInputClass } from "./forms";
import { Button } from "./ui/Button";

/** Add an analysis result (添加分析结果): pick the tool and the workbook it exported; the result starts as a draft to complete from there. */
/** The analysis tools as their workbench is called on screen. */
const analysisWorkbenchNames: Record<keyof typeof analysisTools, string> = { "qpcr-analysis": "qPCR analysis workbench", "cnv-analysis": "CNV analysis workbench" };

export function AnalysisResultUpload({ experimentId }: { experimentId: string }) {
  const [state, action, pending] = useActionState(addAnalysisResult.bind(null, experimentId), {} as AnalysisUploadState);
  const { locale } = useI18n();
  return <details className="border-t border-hairline bg-surface">
    <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-graphite">Add an analysis result</summary>
    <form action={action} className="space-y-2 border-t border-hairline px-3 py-2 text-xs text-graphite">
      <label className="block">Exported from<select name="tool" defaultValue="qpcr-analysis" className={formInputClass}>{Object.keys(analysisTools).map(key => <option key={key} value={key}>{analysisWorkbenchNames[key as keyof typeof analysisTools]}</option>)}</select></label>
      <label className="block">Exported workbook (.xlsx, .xls or .csv)<input name="file" type="file" accept=".xlsx,.xls,.csv" required className="mt-1 block w-full text-xs" /></label>
      <label className="block">Result name (optional)<input name="title" placeholder="e.g. GAPDH relative expression" className={formInputClass} /></label>
      <p className="text-muted">The workbook goes into a new result as a file; LabNest neither reads nor changes its values.</p>
      <Button type="submit" size="sm" variant="primary" disabled={pending} aria-busy={pending}>{pending ? "Adding the result…" : "Add"}</Button>
      {state.error ? <p role="alert" className="text-error">{state.error}</p> : null}
      {state.resultId ? <p role="status" className="text-success">Added as a draft result.{locale === "en" ? " " : ""}<Link href={`/results/${state.resultId}`} className="focus-ring font-medium text-moss underline">Open the result</Link></p> : null}
    </form>
  </details>;
}
