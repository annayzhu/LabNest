import { AlertTriangle, BarChart3, CheckCircle2, Database, FileCheck2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ProtocolRichTextContent } from "@/components/ProtocolDocumentView";
import { ResultDatasetTableView } from "@/components/ResultDatasetTable";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import {
  fieldDataType,
  fieldSemanticRole,
  normalizeResultTemplate,
  normalizeResultValues,
  resultDatasetValuesFromResultValues,
  resultTemplateCardinalityLabel,
  stableResultKey,
  validateResultDatasetRows,
} from "@/lib/result-templates";
import type { ResultChartSpec, ResultTemplate } from "@/lib/types";
import { richTextPlainText } from "@/lib/protocol-document";

type DatasetView = {
  id: string;
  name: string;
  templateDatasetKey: string | null;
  validationStatus: string;
  columnsJson: unknown;
  previewJson: unknown;
};

type AttachmentView = { linkType: string; attachment: { id: string; originalFilename: string; mimeType: string } };
type ValidationView = { errors?: string[]; warnings?: string[]; checkedAt?: string };

export function ResultTemplateView({ template: rawTemplate, values: rawValues, validationStatus, validation: rawValidation, datasets, attachments }: {
  template: unknown;
  values: unknown;
  validationStatus: string;
  validation: unknown;
  datasets: DatasetView[];
  attachments: AttachmentView[];
}) {
  if (!rawTemplate || typeof rawTemplate !== "object" || Array.isArray(rawTemplate) || !Object.keys(rawTemplate as object).length) return null;
  const template = normalizeResultTemplate(rawTemplate);
  const values = normalizeResultValues(rawValues);
  const inlineDatasets = resultDatasetValuesFromResultValues(values);
  const validation = rawValidation && typeof rawValidation === "object" ? rawValidation as ValidationView : {};
  const metrics = template.fields.filter((field) => fieldSemanticRole(field) === "measurement" || fieldSemanticRole(field) === "qc").filter((field) => values[field.key ?? ""] !== undefined && values[field.key ?? ""] !== "");
  const remainingFields = template.fields.filter((field) => !metrics.includes(field)).filter((field) => values[field.key ?? ""] !== undefined && values[field.key ?? ""] !== "");
  const artifactLinks = new Map(attachments.flatMap((link) => link.linkType.startsWith("template_artifact:") ? [[link.linkType.slice("template_artifact:".length), link]] as const : []));
  const charts = resolveCharts(template, datasets);

  return <div className="space-y-5">
    <Card><CardHeader title="实验结果 / Result record" eyebrow={template.title ?? template.result_type} action={<ValidationBadge status={validationStatus} />} /><CardBody className="space-y-4">
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted"><span className="font-medium text-ink">{template.title ?? template.result_type}</span><span>{resultTemplateCardinalityLabel(template.cardinality)}</span></div>
      {template.description ? <p className="text-sm leading-6 text-graphite">{template.description}</p> : null}
      {template.instructions?.length && richTextPlainText(template.instructions).trim() ? <div className="rounded-[9px] border border-sage/35 bg-sage-surface/45 p-3"><p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-moss">填写说明 / Instructions</p><ProtocolRichTextContent nodes={template.instructions} /></div> : null}
      {validation.errors?.length || validation.warnings?.length ? <div className="rounded-[9px] border border-warning/40 bg-warning-surface p-3"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-warning"><AlertTriangle className="h-4 w-4" />Validation findings</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-graphite">{[...(validation.errors ?? []), ...(validation.warnings ?? [])].map((message) => <li key={message}>{message}</li>)}</ul></div> : null}
    </CardBody></Card>

    {metrics.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((field) => { const key = field.key ?? ""; return <Card key={key}><CardHeader title={field.label ?? field.name ?? key} eyebrow={fieldSemanticRole(field)} /><CardBody><p className="font-serif text-3xl text-ink">{formatValue(values[key], fieldDataType(field))} {field.unit ? <span className="text-base text-muted">{field.unit}</span> : null}</p>{field.description ? <p className="mt-2 text-xs leading-5 text-muted">{field.description}</p> : null}</CardBody></Card>; })}</div> : null}

    {remainingFields.length ? <Card><CardHeader title="Structured fields" eyebrow="Template values" /><CardBody><dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">{remainingFields.map((field) => { const key = field.key ?? ""; return <div key={key} className="border-b border-hairline pb-3"><dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{field.label ?? field.name ?? key}</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-ink">{formatValue(values[key], fieldDataType(field))}{field.unit ? ` ${field.unit}` : ""}</dd></div>; })}</dl></CardBody></Card> : null}

    {template.datasets?.length ? <ResultDatasetTableView datasets={template.datasets} values={inlineDatasets} /> : null}

    {charts.length ? <div className="grid gap-4 xl:grid-cols-2">{charts.map(({ chart, dataset }) => <Card key={`${dataset.id}-${chart.key}`}><CardHeader title={chart.label} eyebrow={`${chart.type} · ${dataset.name}`} /><CardBody><DatasetPreviewChart chart={chart} dataset={dataset} /></CardBody></Card>)}</div> : null}

    {(template.datasets?.length || template.artifacts?.length) ? <div className="grid gap-4 xl:grid-cols-2">
      <Card><CardHeader title="Dataset requirements" eyebrow="Structured table or original data file" /><CardBody className="space-y-3">{(template.datasets ?? []).map((expected) => { const matches = datasets.filter((dataset) => dataset.templateDatasetKey === expected.key); const inline = validateResultDatasetRows(expected, inlineDatasets[expected.key]); const status = inline.status === "invalid" || matches.some((item) => item.validationStatus === "invalid") ? "invalid" : inline.rowCount || matches.some((item) => item.validationStatus === "valid") ? "complete" : matches.some((item) => item.validationStatus === "warning") ? "warning" : "missing"; const detail = inline.rowCount ? `${inline.rowCount} manually recorded rows` : matches.length ? `${matches.length} registered data file${matches.length === 1 ? "" : "s"}` : `${expected.columns.length} expected columns${expected.required ? " · required" : ""}`; return <Requirement key={expected.key} icon={<Database className="h-4 w-4" />} label={expected.label} detail={detail} status={status} />; })}{!template.datasets?.length ? <p className="text-sm text-muted">No Dataset requirements.</p> : null}</CardBody></Card>
      <Card><CardHeader title="Artifact requirements" eyebrow="Raw and visual evidence" /><CardBody className="space-y-3">{(template.artifacts ?? []).map((expected) => { const link = artifactLinks.get(expected.key); return <Requirement key={expected.key} icon={<FileCheck2 className="h-4 w-4" />} label={expected.label} detail={link?.attachment.originalFilename ?? `${expected.kind}${expected.required ? " · required" : ""}`} status={link ? "complete" : "missing"} />; })}{!template.artifacts?.length ? <p className="text-sm text-muted">No artifact requirements.</p> : null}</CardBody></Card>
    </div> : null}
  </div>;
}

function resolveCharts(template: ResultTemplate, datasets: DatasetView[]) {
  const explicit = template.view?.charts ?? [];
  if (explicit.length) return explicit.flatMap((chart) => { const dataset = datasets.find((item) => item.templateDatasetKey === chart.datasetKey); return dataset ? [{ chart, dataset }] : []; });
  const inferred: Array<{ chart: ResultChartSpec; dataset: DatasetView }> = [];
  for (const dataset of datasets) {
    const schema = template.datasets?.find((item) => item.key === dataset.templateDatasetKey);
    if (!schema) continue;
    const x = schema.columns.find((column) => column.semanticRole === "group" || column.semanticRole === "label" || column.semanticRole === "identifier") ?? schema.columns[0];
    const y = schema.columns.find((column) => column.dataType === "number" && column.semanticRole === "measurement") ?? schema.columns.find((column) => column.dataType === "number");
    if (!x || !y) continue;
    inferred.push({ chart: { key: `${schema.key}_preview`, label: `${schema.label} preview`, type: template.view?.preset === "timeseries" ? "line" : "bar", datasetKey: schema.key, xField: x.key, yField: y.key }, dataset });
  }
  return inferred;
}

function DatasetPreviewChart({ chart, dataset }: { chart: ResultChartSpec; dataset: DatasetView }) {
  const columns = Array.isArray(dataset.columnsJson) ? dataset.columnsJson as Array<{ name?: string }> : [];
  const rows = Array.isArray(dataset.previewJson) ? dataset.previewJson as unknown[][] : [];
  const columnIndex = (key: string) => columns.findIndex((column) => stableResultKey(column.name ?? "") === stableResultKey(key));
  const xIndex = columnIndex(chart.xField);
  const yIndex = columnIndex(chart.yField);
  if (xIndex < 0 || yIndex < 0) return <p className="text-sm text-muted">The configured chart columns are not present in the bounded Dataset preview.</p>;
  const points = rows.flatMap((row) => { const value = Number(row[yIndex]); return Number.isFinite(value) ? [{ label: String(row[xIndex] ?? ""), value }] : []; }).slice(0, 16);
  if (!points.length) return <p className="text-sm text-muted">No finite numeric values are available in the bounded Dataset preview.</p>;
  const width = 720; const height = 260; const left = 52; const right = 16; const top = 18; const bottom = 54;
  const plotWidth = width - left - right; const plotHeight = height - top - bottom;
  const min = Math.min(0, ...points.map((point) => point.value)); const max = Math.max(0, ...points.map((point) => point.value)); const range = max - min || 1;
  const x = (index: number) => left + (plotWidth * (index + 0.5)) / points.length;
  const y = (value: number) => top + ((max - value) / range) * plotHeight;
  const baseline = y(0);
  const path = points.map((point, index) => `${index ? "L" : "M"}${x(index)},${y(point.value)}`).join(" ");
  return <div className="overflow-x-auto"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={chart.label} className="min-w-[620px]">
    <line x1={left} x2={width - right} y1={baseline} y2={baseline} stroke="currentColor" className="text-hairline" />
    <line x1={left} x2={left} y1={top} y2={height - bottom} stroke="currentColor" className="text-hairline" />
    {chart.type === "bar" ? points.map((point, index) => { const barX = x(index) - Math.max(4, plotWidth / points.length * 0.32); const barWidth = Math.max(8, plotWidth / points.length * 0.64); const pointY = y(point.value); return <rect key={`${point.label}-${index}`} x={barX} y={Math.min(pointY, baseline)} width={barWidth} height={Math.max(1, Math.abs(baseline - pointY))} rx="2" className="fill-moss/75" />; }) : <><path d={path} fill="none" stroke="currentColor" strokeWidth="2" className="text-moss" />{points.map((point, index) => <circle key={`${point.label}-${index}`} cx={x(index)} cy={y(point.value)} r="4" className="fill-moss" />)}</>}
    {points.map((point, index) => <g key={`label-${point.label}-${index}`} transform={`translate(${x(index)},${height - bottom + 14}) rotate(35)`}><text className="fill-muted text-[10px]" textAnchor="start">{point.label.slice(0, 18)}</text></g>)}
    <text x={left - 8} y={top + 4} textAnchor="end" className="fill-muted text-[10px]">{max.toPrecision(3)}</text><text x={left - 8} y={height - bottom} textAnchor="end" className="fill-muted text-[10px]">{min.toPrecision(3)}</text>
  </svg><p className="mt-1 flex items-center gap-2 text-xs text-muted"><BarChart3 className="h-4 w-4" />Preview only · first {points.length} plottable rows · {chart.xField} vs {chart.yField}</p></div>;
}

function ValidationBadge({ status }: { status: string }) {
  const tone = status === "valid" ? "success" : status === "warning" || status === "incomplete" ? "warning" : status === "invalid" ? "danger" : "neutral";
  return <Badge tone={tone}>{status.replaceAll("_", " ")}</Badge>;
}

function formatValue(value: unknown, type: string) { if (Array.isArray(value)) return value.join(", "); if (type === "boolean") return value === true ? "Yes" : "No"; return String(value ?? "—"); }
function Requirement({ icon, label, detail, status }: { icon: React.ReactNode; label: string; detail: string; status: "complete" | "warning" | "invalid" | "missing" }) { return <div className="flex items-start gap-3 rounded-[8px] border border-hairline p-3"><span className={status === "complete" ? "text-success" : status === "warning" ? "text-warning" : "text-error"}>{status === "complete" ? <CheckCircle2 className="h-4 w-4" /> : icon}</span><div className="min-w-0 flex-1"><p className="text-sm font-medium text-ink">{label}</p><p className="mt-1 truncate text-xs text-muted">{detail}</p></div><span className="text-xs font-semibold capitalize text-muted">{status}</span></div>; }
