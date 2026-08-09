import { Download } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { formatLabel, structuredModules, type StructuredFileFormat, type StructuredModuleKey } from "@/lib/structured-modules";

type ExportSearchParams = Record<string, string | string[] | undefined>;

function values(params: ExportSearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value : value ? [value] : [];
}

function formatDescription(format: StructuredFileFormat) {
  if (format === "json") return "Lossless structured package for backup, migration, and re-import.";
  if (format === "md") return "Readable, editable scientific document with stable section headings.";
  if (format === "xlsx") return "Spreadsheet for review, collaboration, and controlled bulk editing.";
  return "Flat table for analysis software and data pipelines.";
}

export function StructuredExportWorkspace({
  module,
  searchParams = {},
}: {
  module: StructuredModuleKey;
  searchParams?: ExportSearchParams;
}) {
  const definition = structuredModules[module];
  const selectedIds = values(searchParams, "id").slice(0, 500);
  const incomingScope = values(searchParams, "exportScope")[0];
  const forwarded = Object.entries(searchParams).flatMap(([key, value]) => {
    if (["format", "exportScope", "id"].includes(key) || value === undefined) return [];
    return (Array.isArray(value) ? value : [value]).map((item) => [key, item] as const);
  });
  const activeFilters = forwarded.filter(([key, value]) => key !== "sort" && value !== "");
  const defaultScope = incomingScope === "selected" && selectedIds.length
    ? "selected"
    : incomingScope === "filtered" || activeFilters.length
      ? "filtered"
      : "all";
  const filterSummary = activeFilters.length
    ? activeFilters.map(([key, value]) => `${key === "q" ? "search" : key}: ${value}`).join(" · ")
    : "No filters are active; this currently matches the full collection.";

  return (
    <form action={`/api/structured-export/${module}`} method="get" className="space-y-4">
      {selectedIds.map((id) => <input key={id} type="hidden" name="id" value={id} />)}
      {forwarded.map(([key, value], index) => <input key={`${key}-${index}`} type="hidden" name={key} value={value} />)}

      <Card>
        <CardHeader title="1. Choose what to export" />
        <CardBody className="grid gap-3 lg:grid-cols-3">
          <ScopeOption value="filtered" defaultChecked={defaultScope === "filtered"} title="Current filtered view" detail={filterSummary} />
          <ScopeOption value="selected" defaultChecked={defaultScope === "selected"} disabled={!selectedIds.length} title={`Selected records${selectedIds.length ? ` (${selectedIds.length})` : ""}`} detail={selectedIds.length ? "Only the records selected in the collection list." : "Select records in the list first to enable this scope."} />
          <ScopeOption value="all" defaultChecked={defaultScope === "all"} title="All records" detail={`Every ${definition.singular.toLowerCase()} in LabNest. This is never selected implicitly when filters are active.`} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="2. Choose the output" />
        <CardBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {definition.exportFormats.map((format) => (
            <button key={format} type="submit" name="format" value={format} className="focus-ring flex min-h-24 items-center justify-between gap-3 rounded-[9px] border border-hairline bg-warm px-4 py-4 text-left transition hover:border-border-strong hover:bg-sage-surface/50">
              <span>
                <strong className="block text-sm text-ink">{formatLabel(format)}</strong>
                <span className="mt-1 block text-xs leading-5 text-muted">{formatDescription(format)}</span>
              </span>
              <Download className="h-4 w-4 shrink-0 text-moss" aria-hidden />
            </button>
          ))}
        </CardBody>
      </Card>
    </form>
  );
}

function ScopeOption({
  value,
  title,
  detail,
  defaultChecked,
  disabled = false,
}: {
  value: "filtered" | "selected" | "all";
  title: string;
  detail: string;
  defaultChecked: boolean;
  disabled?: boolean;
}) {
  return (
    <label className={`rounded-[9px] border p-4 ${disabled ? "cursor-not-allowed border-hairline bg-stone/60 opacity-60" : "cursor-pointer border-hairline bg-warm has-[:checked]:border-moss has-[:checked]:bg-sage-surface/50"}`}>
      <span className="flex items-start gap-3">
        <input type="radio" name="exportScope" value={value} defaultChecked={defaultChecked} disabled={disabled} className="focus-ring mt-0.5 h-4 w-4 accent-moss" />
        <span><strong className="block text-sm text-ink">{title}</strong><span className="mt-1 block text-xs leading-5 text-muted">{detail}</span></span>
      </span>
    </label>
  );
}
