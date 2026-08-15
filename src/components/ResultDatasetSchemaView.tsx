import { Table2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ResizableTableFrame } from "@/components/ui/ResizableTableFrame";
import type { ResultDatasetColumnType, ResultSemanticRole, ResultTemplateDataset } from "@/lib/types";

const dataTypeLabels: Record<ResultDatasetColumnType, string> = {
  text: "文本 / Text",
  number: "数值 / Number",
  category: "分类 / Category",
  boolean: "是/否 / Boolean",
  date: "日期 / Date",
  datetime: "日期时间 / Datetime",
};

const roleLabels: Record<ResultSemanticRole, string> = {
  identifier: "标识 / Identifier",
  design: "设计 / Design",
  group: "分组 / Group",
  label: "标签 / Label",
  measurement: "测量值 / Measurement",
  qc: "质控 / QC",
  annotation: "备注 / Annotation",
};

export function ResultDatasetSchemaView({ datasets, showHeading = true }: {
  datasets: ResultTemplateDataset[];
  showHeading?: boolean;
}) {
  if (!datasets.length) return null;

  return <section className="space-y-3" aria-label="数据表结构 / Dataset schemas" data-testid="result-dataset-schemas">
    {showHeading ? <header className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted"><Table2 className="h-4 w-4" aria-hidden />数据表结构 / Dataset schemas</header> : null}
    {datasets.map((dataset) => <div key={dataset.key} className="overflow-hidden rounded-[9px] border border-hairline bg-surface" data-testid={`result-dataset-schema-${dataset.key}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline bg-warm/60 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{dataset.label}</p>
          <p className="mt-0.5 break-all font-mono text-[11px] text-muted">{dataset.key}</p>
        </div>
        <Badge tone={dataset.required ? "warning" : "neutral"}>{dataset.required ? "必填 / Required" : "可选 / Optional"}</Badge>
      </div>
      {dataset.columns.length ? <ResizableTableFrame storageKey={`result-dataset-schema:${dataset.key}`} className="overflow-x-auto editorial-scrollbar">
        <table className="document-three-line-table ln-result-dataset-schema-table min-w-[var(--ln-result-dataset-schema-min-width)] table-fixed text-left text-[length:var(--ln-result-dataset-font-size)]">
          <colgroup>
            <col data-resizable-column-index="0" style={{ width: "var(--ln-result-dataset-schema-key-col-width)" }} />
            <col data-resizable-column-index="1" style={{ width: "var(--ln-result-dataset-schema-label-col-width)" }} />
            <col data-resizable-column-index="2" style={{ width: "var(--ln-result-dataset-schema-type-col-width)" }} />
            <col data-resizable-column-index="3" style={{ width: "var(--ln-result-dataset-schema-unit-col-width)" }} />
            <col data-resizable-column-index="4" style={{ width: "var(--ln-result-dataset-schema-required-col-width)" }} />
            <col data-resizable-column-index="5" style={{ width: "var(--ln-result-dataset-schema-role-col-width)" }} />
          </colgroup>
          <thead><tr>
            <th data-resizable-column-cell="0" scope="col" className="px-[var(--ln-result-dataset-schema-cell-padding-x)] py-[var(--ln-result-dataset-schema-cell-padding-y)] pr-4 align-top font-semibold">字段键 / Field key<span data-column-resize-handle="0" data-min-width="var(--ln-result-dataset-schema-min-col-width)" aria-hidden /></th>
            <th data-resizable-column-cell="1" scope="col" className="px-[var(--ln-result-dataset-schema-cell-padding-x)] py-[var(--ln-result-dataset-schema-cell-padding-y)] pr-4 align-top font-semibold">标签 / Label<span data-column-resize-handle="1" data-min-width="var(--ln-result-dataset-schema-min-col-width)" aria-hidden /></th>
            <th data-resizable-column-cell="2" scope="col" className="px-[var(--ln-result-dataset-schema-cell-padding-x)] py-[var(--ln-result-dataset-schema-cell-padding-y)] pr-4 align-top font-semibold">类型 / Type<span data-column-resize-handle="2" data-min-width="var(--ln-result-dataset-schema-min-col-width)" aria-hidden /></th>
            <th data-resizable-column-cell="3" scope="col" className="px-[var(--ln-result-dataset-schema-cell-padding-x)] py-[var(--ln-result-dataset-schema-cell-padding-y)] pr-4 align-top font-semibold">单位 / Unit<span data-column-resize-handle="3" data-min-width="3rem" aria-hidden /></th>
            <th data-resizable-column-cell="4" scope="col" className="px-[var(--ln-result-dataset-schema-cell-padding-x)] py-[var(--ln-result-dataset-schema-cell-padding-y)] pr-4 align-top font-semibold">必填 / Required<span data-column-resize-handle="4" data-min-width="3.5rem" aria-hidden /></th>
            <th data-resizable-column-cell="5" scope="col" className="px-[var(--ln-result-dataset-schema-cell-padding-x)] py-[var(--ln-result-dataset-schema-cell-padding-y)] pr-4 align-top font-semibold">用途 / Role<span data-column-resize-handle="5" data-min-width="var(--ln-result-dataset-schema-min-col-width)" aria-hidden /></th>
          </tr></thead>
          <tbody>{dataset.columns.map((column) => <tr key={column.key} className="text-graphite">
            <td className="ln-result-dataset-schema-key-cell px-[var(--ln-result-dataset-schema-cell-padding-x)] py-[var(--ln-result-dataset-schema-cell-padding-y)] align-top font-mono text-[length:var(--ln-result-dataset-schema-key-font-size)] text-ink">{column.key}</td>
            <td className="break-words px-[var(--ln-result-dataset-schema-cell-padding-x)] py-[var(--ln-result-dataset-schema-cell-padding-y)] align-top">{column.label}</td>
            <td className="px-[var(--ln-result-dataset-schema-cell-padding-x)] py-[var(--ln-result-dataset-schema-cell-padding-y)] align-top">{dataTypeLabels[column.dataType]}</td>
            <td className="px-[var(--ln-result-dataset-schema-cell-padding-x)] py-[var(--ln-result-dataset-schema-cell-padding-y)] align-top">{column.unit || "—"}</td>
            <td className="px-[var(--ln-result-dataset-schema-cell-padding-x)] py-[var(--ln-result-dataset-schema-cell-padding-y)] align-top">{column.required ? "是 / Yes" : "否 / No"}</td>
            <td className="px-[var(--ln-result-dataset-schema-cell-padding-x)] py-[var(--ln-result-dataset-schema-cell-padding-y)] align-top">{column.semanticRole ? roleLabels[column.semanticRole] : "—"}</td>
          </tr>)}</tbody>
        </table>
      </ResizableTableFrame> : <p className="px-3 py-4 text-sm text-muted">尚未定义列 / No columns defined.</p>}
    </div>)}
  </section>;
}
