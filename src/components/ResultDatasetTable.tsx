"use client";

import { useState, type ClipboardEvent } from "react";
import { ArrowDown, ArrowUp, Plus, Table2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ResizableTableFrame } from "@/components/ui/ResizableTableFrame";
import { cn } from "@/lib/cn";
import { applySpreadsheetPaste, type ResultDatasetPasteResult } from "@/lib/result-dataset-paste";
import { validateResultDatasetRows, type ResultDatasetRowValues, type ResultDatasetValues } from "@/lib/result-templates";
import type { ResultDatasetColumn, ResultTemplateDataset } from "@/lib/types";

const cellInputClass = "focus-ring h-[var(--ln-result-dataset-input-height)] min-w-[var(--ln-result-dataset-input-min-width)] w-full rounded-[6px] border border-hairline bg-surface px-[var(--ln-result-dataset-input-padding-x)] text-[length:var(--ln-result-dataset-font-size)] text-ink";

export function ResultDatasetTableEditor({ datasets, values, onChange }: {
  datasets: ResultTemplateDataset[];
  values: ResultDatasetValues;
  onChange: (values: ResultDatasetValues) => void;
}) {
  const [pasteNotices, setPasteNotices] = useState<Record<string, string>>({});
  if (!datasets.length) return null;

  function updateRows(datasetKey: string, rows: ResultDatasetRowValues[]) {
    onChange({ ...values, [datasetKey]: rows });
  }

  function moveRow(datasetKey: string, rows: ResultDatasetRowValues[], rowIndex: number, direction: -1 | 1) {
    const targetIndex = rowIndex + direction;
    if (targetIndex < 0 || targetIndex >= rows.length) return;
    const nextRows = [...rows];
    [nextRows[rowIndex], nextRows[targetIndex]] = [nextRows[targetIndex], nextRows[rowIndex]];
    updateRows(datasetKey, nextRows);
  }

  return <div className="min-w-0 max-w-full space-y-4 overflow-hidden" data-testid="result-dataset-table-editor">
    {datasets.map((dataset) => {
      const rows = values[dataset.key] ?? [];
      const displayRows = rows.length ? rows : [{}];
      return <section key={dataset.key} className="min-w-0 max-w-full overflow-hidden rounded-[9px] border border-hairline bg-surface" data-testid={`result-dataset-entry-${dataset.key}`}>
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline bg-warm/65 px-4 py-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink"><Table2 className="h-4 w-4 text-moss" aria-hidden />{dataset.label}</h3>
            <p className="mt-1 text-xs leading-5 text-muted">可从 Excel 复制多行多列区域；点击起始单元格后按 Command + V 粘贴，系统会按模板列自动填入并新增所需行。</p>
          </div>
          <Badge tone={dataset.required ? "warning" : "neutral"}>{dataset.required ? "必填 / Required" : "可选 / Optional"}</Badge>
        </header>
        {dataset.columns.length ? <ResizableTableFrame storageKey={`result-dataset-editor:${dataset.key}`} className="w-full max-w-full overflow-x-auto overscroll-x-contain editorial-scrollbar">
          <table className="min-w-full table-fixed border-collapse text-left text-sm">
            <colgroup>
              {dataset.columns.map((column, columnIndex) => <col key={column.key} data-resizable-column-index={columnIndex} style={{ width: column.dataType === "number" ? "var(--ln-result-dataset-number-col-width)" : "var(--ln-result-dataset-text-col-width)" }} />)}
              <col style={{ width: "var(--ln-result-dataset-action-col-width)" }} />
            </colgroup>
            <thead><tr className="border-b border-hairline bg-stone/55">{dataset.columns.map((column, columnIndex) => <th key={column.key} data-resizable-column-cell={columnIndex} scope="col" className="min-w-[var(--ln-result-dataset-input-min-width)] px-[var(--ln-result-dataset-cell-padding-x)] py-[var(--ln-result-dataset-cell-padding-y)] pr-4 align-bottom text-[length:var(--ln-result-dataset-font-size)] font-semibold leading-4 text-ink"><span className="block">{column.label}{column.required ? <span className="ml-1 text-error">*</span> : null}{column.unit ? <span className="ml-1 font-normal text-muted">({column.unit})</span> : null}</span><span className="mt-0.5 block font-mono text-[length:var(--ln-result-dataset-key-font-size)] font-normal text-muted">{column.key}</span><span data-column-resize-handle={columnIndex} data-min-width="var(--ln-result-dataset-min-col-width)" aria-hidden /></th>)}<th scope="col" className="w-[var(--ln-result-dataset-action-col-width)] px-[var(--ln-result-dataset-cell-padding-x)] py-[var(--ln-result-dataset-cell-padding-y)]"><span className="sr-only">Row actions</span></th></tr></thead>
            <tbody>{displayRows.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-hairline last:border-b-0">{dataset.columns.map((column, columnIndex) => <td key={column.key} className="px-[var(--ln-result-dataset-cell-padding-x)] py-[var(--ln-result-dataset-cell-padding-y)] align-top"><DatasetCellInput column={column} value={row[column.key]} onChange={(value) => {
              const nextRows = displayRows.map((item, index) => index === rowIndex ? { ...item, [column.key]: value } : item);
              updateRows(dataset.key, nextRows);
            }} onPaste={(event) => {
              const clipboardText = event.clipboardData.getData("text/plain");
              if (!clipboardText) return;
              event.preventDefault();
              const result = applySpreadsheetPaste({
                text: clipboardText,
                columns: dataset.columns,
                rows: displayRows,
                startRow: rowIndex,
                startColumn: columnIndex,
              });
              updateRows(dataset.key, result.rows);
              setPasteNotices((current) => ({ ...current, [dataset.key]: describePasteResult(result) }));
            }} /></td>)}<td className="px-[var(--ln-result-dataset-cell-padding-x)] py-[var(--ln-result-dataset-cell-padding-y)] align-middle"><div className="flex items-center justify-end gap-1">
              <button type="button" aria-label={`上移第 ${rowIndex + 1} 行`} disabled={rowIndex === 0 || displayRows.length <= 1} onClick={() => moveRow(dataset.key, displayRows, rowIndex, -1)} className="focus-ring rounded-[6px] p-1.5 text-muted hover:bg-stone hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
              <button type="button" aria-label={`下移第 ${rowIndex + 1} 行`} disabled={rowIndex === displayRows.length - 1 || displayRows.length <= 1} onClick={() => moveRow(dataset.key, displayRows, rowIndex, 1)} className="focus-ring rounded-[6px] p-1.5 text-muted hover:bg-stone hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
              <button type="button" aria-label={`删除第 ${rowIndex + 1} 行`} onClick={() => updateRows(dataset.key, displayRows.filter((_, index) => index !== rowIndex))} className="focus-ring rounded-[6px] p-1.5 text-muted hover:bg-error-surface hover:text-error"><Trash2 className="h-4 w-4" /></button>
            </div></td></tr>)}</tbody>
          </table>
        </ResizableTableFrame> : <p className="px-4 py-4 text-sm text-muted">该数据表尚未定义列，需先回到实验规程补充列结构。</p>}
        {dataset.columns.length ? <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-hairline px-3 py-2"><button type="button" onClick={() => updateRows(dataset.key, [...displayRows, {}])} className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-[7px] border border-hairline px-3 text-xs font-medium text-moss hover:bg-sage-surface"><Plus className="h-3.5 w-3.5" />添加一行</button>{pasteNotices[dataset.key] ? <p role="status" aria-live="polite" className="text-xs leading-5 text-muted">{pasteNotices[dataset.key]}</p> : null}</div> : null}
      </section>;
    })}
  </div>;
}

export function ResultDatasetTableView({ datasets, values, showHeading = true }: {
  datasets: ResultTemplateDataset[];
  values: ResultDatasetValues;
  showHeading?: boolean;
}) {
  if (!datasets.length) return null;
  return <section className="min-w-0 max-w-full space-y-4 overflow-hidden" aria-label="实验结果数据表 / Result data tables" data-testid="result-dataset-table-view">
    {showHeading ? <header><h2 className="document-section-title font-serif font-medium text-ink">实验结果数据表 / Result data tables</h2></header> : null}
    {datasets.map((dataset) => {
      const validation = validateResultDatasetRows(dataset, values[dataset.key]);
      return <div key={dataset.key} className="min-w-0 max-w-full overflow-hidden rounded-[9px] border border-hairline bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline bg-warm/65 px-4 py-3"><div><h3 className="text-sm font-semibold text-ink">{dataset.label}</h3><p className="mt-0.5 text-xs text-muted">{validation.rowCount} 条记录 / rows</p></div><Badge tone={validation.status === "invalid" ? "danger" : validation.rowCount ? "success" : dataset.required ? "warning" : "neutral"}>{validation.status === "invalid" ? "需修正 / Invalid" : validation.rowCount ? "已填写 / Recorded" : "未填写 / Empty"}</Badge></div>
        <ResizableTableFrame storageKey={`result-dataset-view:${dataset.key}`} className="w-full max-w-full overflow-x-auto overscroll-x-contain editorial-scrollbar"><table className="min-w-full table-fixed border-collapse text-left text-sm"><colgroup>{dataset.columns.map((column, columnIndex) => <col key={column.key} data-resizable-column-index={columnIndex} style={{ width: column.dataType === "number" ? "var(--ln-result-dataset-view-number-col-width)" : "var(--ln-result-dataset-view-text-col-width)" }} />)}</colgroup><thead><tr className="border-b border-hairline bg-stone/55">{dataset.columns.map((column, columnIndex) => <th key={column.key} data-resizable-column-cell={columnIndex} scope="col" className="min-w-[var(--ln-result-dataset-min-col-width)] px-[var(--ln-result-dataset-cell-padding-x)] py-[var(--ln-result-dataset-cell-padding-y)] pr-4 text-[length:var(--ln-result-dataset-font-size)] font-semibold leading-4 text-ink">{column.label}{column.unit ? <span className="ml-1 font-normal text-muted">({column.unit})</span> : null}<span data-column-resize-handle={columnIndex} data-min-width="var(--ln-result-dataset-min-col-width)" aria-hidden /></th>)}</tr></thead><tbody>{validation.rows.length ? validation.rows.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-hairline text-graphite last:border-b-0">{dataset.columns.map((column) => <td key={column.key} className="max-w-56 whitespace-pre-wrap px-[var(--ln-result-dataset-cell-padding-x)] py-[var(--ln-result-dataset-cell-padding-y)] align-top">{formatDatasetValue(row[column.key], column)}</td>)}</tr>) : <tr><td colSpan={Math.max(dataset.columns.length, 1)} className="px-3 py-5 text-center text-sm text-muted">尚未记录表格数据。</td></tr>}</tbody></table></ResizableTableFrame>
        {validation.errors.length ? <ul className="border-t border-error/25 bg-error-surface px-8 py-3 text-xs text-error">{validation.errors.map((error) => <li key={error} className="list-disc">{error}</li>)}</ul> : null}
      </div>;
    })}
  </section>;
}

function DatasetCellInput({ column, value, onChange, onPaste }: { column: ResultDatasetColumn; value: unknown; onChange: (value: unknown) => void; onPaste: (event: ClipboardEvent<HTMLInputElement | HTMLSelectElement>) => void }) {
  const common = { "aria-label": column.label, className: cellInputClass };
  if (column.dataType === "number") return <input {...common} onPaste={onPaste} type="number" step="any" value={typeof value === "number" && Number.isFinite(value) ? value : ""} onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))} />;
  if (column.dataType === "boolean") return <select {...common} onPaste={onPaste} value={value === true ? "true" : value === false ? "false" : ""} onChange={(event) => onChange(event.target.value === "" ? undefined : event.target.value === "true")}><option value="">—</option><option value="true">是 / Yes</option><option value="false">否 / No</option></select>;
  if (column.dataType === "date" || column.dataType === "datetime") return <input {...common} onPaste={onPaste} type={column.dataType === "date" ? "date" : "datetime-local"} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value || undefined)} />;
  return <input {...common} onPaste={onPaste} value={typeof value === "string" || typeof value === "number" ? String(value) : ""} onChange={(event) => onChange(event.target.value || undefined)} />;
}

function describePasteResult(result: ResultDatasetPasteResult) {
  const messages = [`已粘贴 ${result.pastedRows} 行 × ${result.pastedColumns} 列。`];
  if (result.skippedHeader) messages.push("已自动识别并跳过表头。");
  if (result.ignoredColumns) messages.push(`${result.ignoredColumns} 个超出模板范围的列已忽略。`);
  if (result.invalidCells.length) messages.push(`${result.invalidCells.length} 个格式不匹配的单元格未写入，请检查数字、日期或是/否格式。`);
  return messages.join("");
}

function formatDatasetValue(value: unknown, column: ResultDatasetColumn) {
  if (value === undefined || value === null || value === "") return "—";
  if (column.dataType === "boolean") return value === true ? "是 / Yes" : value === false ? "否 / No" : String(value);
  return <span className={cn(column.semanticRole === "identifier" && "font-mono text-xs text-ink")}>{String(value)}</span>;
}
