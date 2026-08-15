"use client";

import { useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Check, Download, FileJson, Image as ImageIcon, RotateCcw, Upload } from "lucide-react";
import { ScientificChartPreview } from "@/components/ScientificChartPreview";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import {
  defaultVisualizationSettings,
  figureFontPresets,
  getPlotDefinition,
  journalThemes,
  parseDelimitedData,
  plotDefinitions,
  validatePlotDataset,
  type JournalThemeId,
  type FieldRole,
  type FigureFontId,
  type PlotDefinition,
  type PlotType,
  type VisualizationSettings,
} from "@/lib/visualization-studio";

const controlClass =
  "focus-ring h-8 w-full rounded-[7px] border border-hairline bg-white px-2.5 text-xs text-ink placeholder:text-muted";

function settingsForTheme(themeId: JournalThemeId): VisualizationSettings {
  const theme = journalThemes[themeId];
  return {
    ...defaultVisualizationSettings,
    categoricalColors: [...theme.categorical],
    continuousLow: theme.sequential[0],
    continuousHigh: theme.sequential[1],
    divergingLow: theme.diverging[0],
    divergingMid: theme.diverging[1],
    divergingHigh: theme.diverging[2],
    barBorderColor: theme.ink,
  };
}

function mappingRoleLabel(plotType: PlotType, role: FieldRole, swapAxes: boolean) {
  if (plotType !== "bar") return role.label;
  if (role.key === "category") return `${swapAxes ? "Y" : "X"}-axis · category`;
  if (role.key === "value") return `${swapAxes ? "X" : "Y"}-axis · value`;
  return role.label;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function slug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "labnest-figure";
}

function uniqueColumnValues(rows: Array<Record<string, string>>, column: string | undefined, fallback: string) {
  if (!column) return [fallback];
  const values = rows.map((row) => row[column]?.trim()).filter((value): value is string => Boolean(value));
  return [...new Set(values.length > 0 ? values : [fallback])];
}

function categoricalColorLabels(plotType: PlotType, rows: Array<Record<string, string>>, mapping: Record<string, string>) {
  if (plotType === "bar") return uniqueColumnValues(rows, mapping.group, "Value");
  if (plotType === "line") return uniqueColumnValues(rows, mapping.series, "All");
  if (plotType === "scatter") return uniqueColumnValues(rows, mapping.group, "All");
  if (plotType === "box" || plotType === "violin") return uniqueColumnValues(rows, mapping.group, "All");
  if (plotType === "volcano") return ["Down", "Up", "Not significant"];
  return [];
}

function serializeSvg(svg: SVGSVGElement, fontFamily: string) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("font-family", fontFamily);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
}

function inferMapping(definition: PlotDefinition, headers: string[]) {
  const normalized = new Map(headers.map((header) => [header.toLowerCase().replace(/[^a-z0-9]/g, ""), header]));
  const aliases: Record<string, string[]> = {
    category: ["category", "condition", "sample", "name", "term"],
    value: ["value", "expression", "score", "abundance", "count"],
    group: ["group", "class", "condition", "cluster", "ontology"],
    series: ["series", "group", "condition", "class"],
    x: ["x", "time", "dose", "pc1", "dimension1"],
    y: ["y", "response", "pc2", "dimension2"],
    error: ["error", "sd", "sem", "se", "stderr", "standarddeviation", "standarderror"],
    label: ["label", "gene", "feature", "id", "name"],
    effect: ["log2fc", "logfc", "effect", "estimate"],
    pValue: ["padj", "fdr", "adjustedpvalue", "pvalue", "p"],
    term: ["term", "pathway", "description", "name"],
    ratio: ["generatio", "ratio", "richfactor", "foldenrichment"],
    count: ["count", "genes", "hits", "size"],
  };
  return Object.fromEntries(definition.roles.map((role) => {
    const exact = normalized.get(role.key.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const fallback = aliases[role.key]?.map((alias) => normalized.get(alias)).find(Boolean);
    return [role.key, exact ?? fallback ?? ""];
  }));
}

function ControlGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-2.5 border-t border-hairline pt-3 first:border-0 first:pt-0">
      <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{title}</legend>
      {children}
    </fieldset>
  );
}

function TextControl({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="grid gap-1 text-xs text-graphite">
      <span>{label}</span>
      <input className={controlClass} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectControl({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-xs text-graphite">
      <span>{label}</span>
      <select className={controlClass} value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
    </label>
  );
}

function RangeControl({ label, value, minimum, maximum, step = 1, unit, onChange }: { label: string; value: number; minimum: number; maximum: number; step?: number; unit?: string; onChange: (value: number) => void }) {
  return (
    <label className="grid gap-1 text-xs text-graphite">
      <span className="flex items-center justify-between gap-2"><span>{label}</span><span className="font-mono text-[11px] text-muted">{value}{unit}</span></span>
      <input className="h-5 w-full accent-[var(--color-moss)]" type="range" min={minimum} max={maximum} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function ToggleControl({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-xs text-graphite">
      <span>{label}</span>
      <span className={cn("relative h-5 w-9 rounded-full transition", checked ? "bg-moss" : "bg-stone")}>
        <input type="checkbox" className="sr-only" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition", checked ? "left-[18px]" : "left-0.5")} />
      </span>
    </label>
  );
}

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs text-graphite">
      <span>{label}</span>
      <span className="flex items-center gap-2 font-mono text-[10px] text-muted">
        {value.toUpperCase()}
        <input aria-label={label} type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-7 w-9 cursor-pointer rounded border border-hairline bg-white p-0.5" />
      </span>
    </label>
  );
}

export function VisualizationStudio() {
  const initialDefinition = getPlotDefinition("bar");
  const [plotType, setPlotType] = useState<PlotType>("bar");
  const [rawData, setRawData] = useState(initialDefinition.sampleData);
  const [mapping, setMapping] = useState<Record<string, string>>(initialDefinition.defaultMapping);
  const [themeId, setThemeId] = useState<JournalThemeId>("nature");
  const [settings, setSettings] = useState<VisualizationSettings>(() => settingsForTheme("nature"));
  const svgRef = useRef<SVGSVGElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const definition = getPlotDefinition(plotType);
  const dataset = useMemo(() => parseDelimitedData(rawData), [rawData]);
  const validation = useMemo(() => validatePlotDataset(definition, dataset, mapping, settings), [definition, dataset, mapping, settings]);
  const categoryLabels = useMemo(() => categoricalColorLabels(plotType, dataset.rows, mapping), [plotType, dataset.rows, mapping]);
  const isValid = validation.errors.length === 0;

  const updateSetting = <Key extends keyof VisualizationSettings>(key: Key, value: VisualizationSettings[Key]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const updateCategoryColor = (index: number, value: string) => {
    setSettings((current) => {
      const themeColors = journalThemes[themeId].categorical;
      const nextLength = Math.max(current.categoricalColors.length, index + 1);
      const categoricalColors = Array.from({ length: nextLength }, (_, colorIndex) => current.categoricalColors[colorIndex] ?? themeColors[colorIndex % themeColors.length]);
      categoricalColors[index] = value;
      return { ...current, categoricalColors };
    });
  };

  const selectPlot = (nextType: PlotType) => {
    const next = getPlotDefinition(nextType);
    setPlotType(nextType);
    setRawData(next.sampleData);
    setMapping(next.defaultMapping);
    setSettings((current) => ({
      ...current,
      title: "",
      xLabel: "",
      yLabel: "",
      swapAxes: false,
      legendPosition: (nextType === "heatmap" || nextType === "enrichment") && current.legendPosition === "bottom" ? "right" : current.legendPosition,
    }));
  };

  const selectTheme = (nextTheme: JournalThemeId) => {
    const theme = journalThemes[nextTheme];
    setThemeId(nextTheme);
    setSettings((current) => ({
      ...current,
      categoricalColors: [...theme.categorical],
      continuousLow: theme.sequential[0],
      continuousHigh: theme.sequential[1],
      divergingLow: theme.diverging[0],
      divergingMid: theme.diverging[1],
      divergingHigh: theme.diverging[2],
      barBorderColor: theme.ink,
    }));
  };

  const selectErrorType = (key: "barErrorType" | "lineErrorType", value: VisualizationSettings["barErrorType"]) => {
    setSettings((current) => ({ ...current, [key]: value }));
    if (value === "none") return;
    const preferredAliases = value === "sd"
      ? ["sd", "standarddeviation", "error"]
      : ["sem", "se", "stderr", "standarderror", "error"];
    const normalizedHeaders = new Map(dataset.headers.map((header) => [header.toLowerCase().replace(/[^a-z0-9]/g, ""), header]));
    const preferredColumn = preferredAliases.map((alias) => normalizedHeaders.get(alias)).find(Boolean);
    if (preferredColumn) setMapping((current) => ({ ...current, error: preferredColumn }));
  };

  const loadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseDelimitedData(text);
    setRawData(text);
    setMapping(inferMapping(definition, parsed.headers));
    event.target.value = "";
  };

  const exportSvg = () => {
    if (!svgRef.current || !isValid) return;
    const source = serializeSvg(svgRef.current, figureFontPresets[settings.fontFamily].family);
    downloadBlob(new Blob([source], { type: "image/svg+xml;charset=utf-8" }), `${slug(settings.title || definition.name)}.svg`);
  };

  const exportPng = async () => {
    if (!svgRef.current || !isValid) return;
    const source = serializeSvg(svgRef.current, figureFontPresets[settings.fontFamily].family);
    const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
    const image = new window.Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The SVG preview could not be rasterized."));
      image.src = url;
    });
    const scale = 600 / 96;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(settings.width * scale);
    canvas.height = Math.round(settings.height * scale);
    const context = canvas.getContext("2d");
    if (!context) {
      URL.revokeObjectURL(url);
      return;
    }
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (blob) downloadBlob(blob, `${slug(settings.title || definition.name)}-600dpi.png`);
  };

  const exportConfig = () => {
    const payload = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      plotType,
      themeId,
      mapping,
      settings,
      data: rawData,
    };
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `${slug(settings.title || definition.name)}.labnest-figure.json`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="flex flex-col gap-3 p-3.5 2xl:flex-row 2xl:items-start 2xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold text-graphite">Journal palette</span>
            {(Object.keys(journalThemes) as JournalThemeId[]).map((id) => (
              <button key={id} type="button" title={journalThemes[id].description} onClick={() => selectTheme(id)} className={cn("focus-ring flex h-8 items-center gap-2 rounded-[7px] border px-2.5 text-xs transition", themeId === id ? "border-moss bg-sage-surface text-ink" : "border-hairline bg-white text-graphite hover:border-border-strong") }>
                <span className="flex -space-x-0.5">{journalThemes[id].categorical.slice(0, 5).map((color) => <span key={color} className="h-3.5 w-3.5 rounded-full border border-white" style={{ backgroundColor: color }} />)}</span>
                {journalThemes[id].name}
                {themeId === id ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
              </button>
            ))}
            <select aria-label="Figure font" className="focus-ring h-8 rounded-[7px] border border-hairline bg-white px-2.5 text-xs text-graphite" value={settings.fontFamily} onChange={(event) => updateSetting("fontFamily", event.target.value as FigureFontId)}>
              {(Object.keys(figureFontPresets) as FigureFontId[]).map((id) => <option key={id} value={id}>{figureFontPresets[id].name}</option>)}
            </select>
            <Badge tone="sage">Compact preset</Badge>
          </div>
          <div className="flex shrink-0 flex-nowrap gap-2">
            <Button size="sm" onClick={exportSvg} disabled={!isValid}><Download className="h-3.5 w-3.5" aria-hidden />SVG</Button>
            <Button size="sm" onClick={exportPng} disabled={!isValid}><ImageIcon className="h-3.5 w-3.5" aria-hidden />PNG 600 dpi</Button>
            <Button size="sm" onClick={exportConfig}><FileJson className="h-3.5 w-3.5" aria-hidden />Config</Button>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[188px_minmax(0,1fr)_296px]">
        <Card className="self-start xl:sticky xl:top-4">
          <CardHeader title="Plot types" className="px-3.5 py-2.5" />
          <CardBody className="space-y-1 p-2">
            {plotDefinitions.map((plot) => (
              <button key={plot.id} type="button" onClick={() => selectPlot(plot.id)} className={cn("focus-ring w-full rounded-[8px] border px-2.5 py-2 text-left transition", plotType === plot.id ? "border-moss bg-sage-surface" : "border-transparent hover:border-hairline hover:bg-warm") }>
                <span className="block text-[13px] font-medium text-ink">{plot.name}</span>
                <span className="mt-0.5 block text-[10px] uppercase tracking-[0.07em] text-muted">{plot.family}</span>
              </button>
            ))}
          </CardBody>
        </Card>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title={`${definition.name} preview`} action={<div className="flex items-center gap-2"><Badge>{dataset.rows.length} rows</Badge><Badge tone={isValid ? "success" : "danger"}>{isValid ? "Ready" : "Check data"}</Badge></div>} />
            <CardBody className="p-3 sm:p-4">
              <p className="mb-3 text-xs leading-5 text-muted">{definition.summary}</p>
              {validation.errors.length > 0 ? (
                <div className="rounded-[9px] border border-error/25 bg-error-surface px-3 py-2 text-xs leading-5 text-error">
                  {validation.errors.map((error) => <p key={error}>• {error}</p>)}
                </div>
              ) : (
                <div className="overflow-auto rounded-[9px] border border-hairline bg-[#F5F5F2] p-2 sm:p-4">
                  <div className="mx-auto w-fit max-w-full overflow-hidden rounded-[4px] bg-white shadow-[0_1px_6px_rgba(35,36,42,0.08)]">
                    <ScientificChartPreview svgRef={svgRef} type={plotType} dataset={dataset} mapping={mapping} settings={settings} themeId={themeId} />
                  </div>
                </div>
              )}
              {validation.warnings.length > 0 ? <div className="mt-3 rounded-[8px] border border-warning/20 bg-warning-surface px-3 py-2 text-xs leading-5 text-warning">{validation.warnings.join(" · ")}</div> : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Data & mapping" action={<div className="flex gap-2"><input ref={fileRef} type="file" accept=".tsv,.csv,.txt,text/csv,text/tab-separated-values" className="hidden" onChange={loadFile} /><Button size="sm" onClick={() => fileRef.current?.click()}><Upload className="h-3.5 w-3.5" aria-hidden />Upload</Button><Button size="sm" onClick={() => { setRawData(definition.sampleData); setMapping(definition.defaultMapping); }}><RotateCcw className="h-3.5 w-3.5" aria-hidden />Example</Button></div>} />
            <CardBody className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(230px,0.7fr)]">
              <label className="grid gap-1.5 text-xs text-graphite">
                <span>CSV or TSV data</span>
                <textarea value={rawData} onChange={(event) => setRawData(event.target.value)} spellCheck={false} className="focus-ring min-h-56 resize-y rounded-[8px] border border-hairline bg-[#FBFBF9] p-3 font-mono text-[11px] leading-5 text-ink" />
              </label>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-graphite">Column mapping</p>
                    {definition.roles.length > 0 ? <Button size="sm" variant="ghost" onClick={() => setMapping(inferMapping(definition, dataset.headers))}>Auto-map</Button> : null}
                  </div>
                  <p className="mt-1 text-[11px] leading-4 text-muted">{definition.inputHint}</p>
                </div>
                {definition.roles.length === 0 ? <p className="rounded-[8px] bg-stone px-3 py-2 text-xs leading-5 text-graphite">The first column supplies row labels; all remaining columns form the numeric matrix.</p> : definition.roles.map((role) => (
                  <SelectControl key={role.key} label={`${mappingRoleLabel(plotType, role, settings.swapAxes)}${role.required ? " *" : ""}`} value={mapping[role.key] ?? ""} onChange={(value) => setMapping((current) => ({ ...current, [role.key]: value }))}>
                    <option value="">{role.required ? "Select column" : "None"}</option>
                    {dataset.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                  </SelectControl>
                ))}
                <div className="rounded-[8px] border border-hairline px-3 py-2 text-[11px] leading-5 text-muted">
                  <p>{dataset.headers.length} columns · {dataset.rows.length} data rows · {dataset.delimiter === "tab" ? "TSV" : "CSV"}</p>
                  <p>Input stays in your browser; exports include a reproducible parameter file.</p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        <Card className="self-start xl:sticky xl:top-4 xl:max-h-[calc(100vh-7rem)] xl:overflow-auto">
          <CardHeader title="Figure parameters" action={<Button size="sm" variant="ghost" onClick={() => setSettings(settingsForTheme(themeId))}><RotateCcw className="h-3.5 w-3.5" aria-hidden />Reset</Button>} />
          <CardBody className="space-y-4 p-4">
            <ControlGroup title="Labels">
              <TextControl label="Title" value={settings.title} onChange={(value) => updateSetting("title", value)} placeholder={`${definition.name} title`} />
              <TextControl label="X-axis label" value={settings.xLabel} onChange={(value) => updateSetting("xLabel", value)} />
              <TextControl label="Y-axis label" value={settings.yLabel} onChange={(value) => updateSetting("yLabel", value)} />
            </ControlGroup>

            <ControlGroup title="Compact layout">
              <RangeControl label="Width" value={settings.width} minimum={360} maximum={1600} step={10} unit=" px" onChange={(value) => updateSetting("width", value)} />
              <RangeControl label="Height" value={settings.height} minimum={280} maximum={1200} step={10} unit=" px" onChange={(value) => updateSetting("height", value)} />
              <RangeControl label="Title size" value={settings.titleSize} minimum={13} maximum={26} unit=" pt" onChange={(value) => updateSetting("titleSize", value)} />
              <RangeControl label="Axis label size" value={settings.axisLabelSize} minimum={10} maximum={20} unit=" pt" onChange={(value) => updateSetting("axisLabelSize", value)} />
              <RangeControl label="Tick size" value={settings.tickSize} minimum={9} maximum={16} unit=" pt" onChange={(value) => updateSetting("tickSize", value)} />
              <RangeControl label="Legend size" value={settings.legendSize} minimum={9} maximum={16} unit=" pt" onChange={(value) => updateSetting("legendSize", value)} />
            </ControlGroup>

            <ControlGroup title="Marks & axes">
              <RangeControl label="Axis line" value={settings.axisLineWidth} minimum={0.8} maximum={3} step={0.1} unit=" px" onChange={(value) => updateSetting("axisLineWidth", value)} />
              <RangeControl label="Grid line" value={settings.gridLineWidth} minimum={0.4} maximum={2} step={0.1} unit=" px" onChange={(value) => updateSetting("gridLineWidth", value)} />
              <RangeControl label="Data line" value={settings.dataLineWidth} minimum={1} maximum={5} step={0.1} unit=" px" onChange={(value) => updateSetting("dataLineWidth", value)} />
              <RangeControl label="Point size" value={settings.pointSize} minimum={2} maximum={12} step={0.5} unit=" px" onChange={(value) => updateSetting("pointSize", value)} />
              <RangeControl label="Opacity" value={settings.opacity} minimum={0.25} maximum={1} step={0.05} onChange={(value) => updateSetting("opacity", value)} />
              <SelectControl label="Grid" value={settings.grid} onChange={(value) => updateSetting("grid", value as VisualizationSettings["grid"])}><option value="none">None</option><option value="y">Horizontal only</option><option value="both">Both axes</option></SelectControl>
              {plotType !== "box" && plotType !== "violin" ? <SelectControl label="Legend" value={settings.legendPosition} onChange={(value) => updateSetting("legendPosition", value as VisualizationSettings["legendPosition"])}><option value="right">Right</option>{plotType !== "heatmap" && plotType !== "enrichment" ? <option value="bottom">Bottom</option> : null}<option value="none">Hidden</option></SelectControl> : null}
              {(["bar", "line", "scatter"] as PlotType[]).includes(plotType) ? <ToggleControl label="Swap axes" checked={settings.swapAxes} onChange={(value) => updateSetting("swapAxes", value)} /> : null}
              {plotType === "scatter" ? <><ToggleControl label="Linear trend" checked={settings.showTrend} onChange={(value) => updateSetting("showTrend", value)} /><ToggleControl label="Point labels" checked={settings.showLabels} onChange={(value) => updateSetting("showLabels", value)} /></> : null}
              {plotType === "box" || plotType === "violin" ? <><ToggleControl label="Show observations" checked={settings.showPoints} onChange={(value) => updateSetting("showPoints", value)} /><ToggleControl label="Show sample size" checked={settings.showSampleSize} onChange={(value) => updateSetting("showSampleSize", value)} /></> : null}
            </ControlGroup>

            {plotType === "bar" || plotType === "line" ? <ControlGroup title={`${plotType === "bar" ? "Bar" : "Line"} error bars`}>
              <SelectControl label="Error representation" value={plotType === "bar" ? settings.barErrorType : settings.lineErrorType} onChange={(value) => selectErrorType(plotType === "bar" ? "barErrorType" : "lineErrorType", value as VisualizationSettings["barErrorType"])}><option value="none">None</option><option value="sd">Mean ± SD</option><option value="sem">Mean ± SEM</option></SelectControl>
              {(plotType === "bar" ? settings.barErrorType : settings.lineErrorType) !== "none" ? <><RangeControl label="Error line" value={settings.errorBarLineWidth} minimum={0.8} maximum={3} step={0.1} unit=" px" onChange={(value) => updateSetting("errorBarLineWidth", value)} /><RangeControl label="Cap width" value={settings.errorBarCapSize} minimum={4} maximum={30} step={1} unit=" px" onChange={(value) => updateSetting("errorBarCapSize", value)} /><p className="rounded-[8px] bg-stone px-3 py-2 text-[11px] leading-4 text-graphite">Map the column containing the already-calculated {(plotType === "bar" ? settings.barErrorType : settings.lineErrorType).toUpperCase()} values under Data &amp; mapping. SD and SEM are not interchangeable; SEM = SD / √n.</p></> : null}
            </ControlGroup> : null}

            {plotType === "bar" ? <ControlGroup title="Bar appearance"><RangeControl label="Border width" value={settings.barBorderWidth} minimum={0} maximum={3} step={0.1} unit=" px" onChange={(value) => updateSetting("barBorderWidth", value)} />{settings.barBorderWidth > 0 ? <ColorControl label="Border color" value={settings.barBorderColor} onChange={(value) => updateSetting("barBorderColor", value)} /> : null}<p className="text-[11px] leading-4 text-muted">Set the width to 0 for borderless bars. The outline remains fully opaque so it stays legible when fill opacity is reduced.</p></ControlGroup> : null}

            {plotType === "box" ? <ControlGroup title="Box & summary">
              <ToggleControl label="Show box & whiskers" checked={settings.showBox} onChange={(value) => updateSetting("showBox", value)} />
              <SelectControl label="Summary error bar" value={settings.boxErrorType} onChange={(value) => updateSetting("boxErrorType", value as VisualizationSettings["boxErrorType"])}><option value="none">None</option><option value="sd">Mean ± SD</option><option value="sem">Mean ± SEM</option></SelectControl>
              {settings.boxErrorType !== "none" ? <><RangeControl label="Error line" value={settings.errorBarLineWidth} minimum={0.8} maximum={3} step={0.1} unit=" px" onChange={(value) => updateSetting("errorBarLineWidth", value)} /><RangeControl label="Cap width" value={settings.errorBarCapSize} minimum={4} maximum={30} step={1} unit=" px" onChange={(value) => updateSetting("errorBarCapSize", value)} /><p className="rounded-[8px] bg-stone px-3 py-2 text-[11px] leading-4 text-graphite">Calculated from the raw observations in each group. SD uses the sample estimate (n−1); SEM = SD / √n. The open center marker denotes the mean.</p></> : <p className="text-[11px] leading-4 text-muted">Turn off the box layer to show raw points only, or add a mean ± SD/SEM summary bar.</p>}
            </ControlGroup> : null}

            {plotType === "violin" ? <ControlGroup title="Violin density"><RangeControl label="Bandwidth" value={settings.violinBandwidth} minimum={0.5} maximum={2.5} step={0.05} unit="×" onChange={(value) => updateSetting("violinBandwidth", value)} /><RangeControl label="Body width" value={settings.violinWidth} minimum={0.18} maximum={0.46} step={0.01} onChange={(value) => updateSetting("violinWidth", value)} /><p className="text-[11px] leading-4 text-muted">Higher bandwidth produces a smoother density. The curve now tapers to zero within each group’s own support instead of spanning the full plot.</p></ControlGroup> : null}

            {plotType === "volcano" ? <ControlGroup title="Volcano thresholds"><RangeControl label="|log₂FC| threshold" value={settings.foldChangeThreshold} minimum={0} maximum={5} step={0.1} onChange={(value) => updateSetting("foldChangeThreshold", value)} /><RangeControl label="Adjusted P threshold" value={settings.pValueThreshold} minimum={0.001} maximum={0.1} step={0.001} onChange={(value) => updateSetting("pValueThreshold", value)} /><RangeControl label="Maximum labels" value={settings.labelLimit} minimum={0} maximum={30} onChange={(value) => updateSetting("labelLimit", value)} /></ControlGroup> : null}
            {plotType === "heatmap" ? <ControlGroup title="Heatmap"><SelectControl label="Scaling" value={settings.heatmapScale} onChange={(value) => updateSetting("heatmapScale", value as VisualizationSettings["heatmapScale"])}><option value="row">Row z-score</option><option value="none">Raw values</option></SelectControl></ControlGroup> : null}

            <ControlGroup title="Editable colors">
              {categoryLabels.map((label, index) => <ColorControl key={`${label}-${index}`} label={`${index + 1} · ${label}`} value={settings.categoricalColors[index] ?? journalThemes[themeId].categorical[index % journalThemes[themeId].categorical.length]} onChange={(value) => updateCategoryColor(index, value)} />)}
              {plotType === "enrichment" ? <><ColorControl label="Sequential low" value={settings.continuousLow} onChange={(value) => updateSetting("continuousLow", value)} /><ColorControl label="Sequential high" value={settings.continuousHigh} onChange={(value) => updateSetting("continuousHigh", value)} /></> : null}
              {plotType === "heatmap" ? <><ColorControl label="Diverging low" value={settings.divergingLow} onChange={(value) => updateSetting("divergingLow", value)} /><ColorControl label="Midpoint" value={settings.divergingMid} onChange={(value) => updateSetting("divergingMid", value)} /><ColorControl label="Diverging high" value={settings.divergingHigh} onChange={(value) => updateSetting("divergingHigh", value)} /></> : null}
            </ControlGroup>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
