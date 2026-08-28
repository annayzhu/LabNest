"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type ReactNode } from "react";
import { Check, ChevronDown, Download, ExternalLink, FileJson, Image as ImageIcon, Lightbulb, RotateCcw, Save, Search, Upload } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ScientificChartPreview } from "@/components/ScientificChartPreview";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { analyzeExpressionMatrix, defaultPcaOptions, type PcaDataLayer, type PcaOptions } from "@/lib/visualization-pca";
import { analyzeSetIntersections, intersectionExportTsv } from "@/lib/visualization-sets";
import { analyzeBarData, barAnalysisResultsTsv } from "@/lib/visualization-bar-analysis";
import {
  defaultVisualizationPaletteSeriesId,
  defaultVisualizationSettings,
  defaultVisualizationThemeId,
  activeNumericAxes,
  assessCategoricalPalette,
  categoricalColorForIndex,
  analysisProvenanceForPlot,
  figureFontPresets,
  getPlotDefinition,
  getPlotModule,
  inferPlotMapping,
  isPlotRoleActive,
  journalThemes,
  paletteSeries,
  parseDelimitedData,
  parseNumericValue,
  plotModuleRegistry,
  validatePlotDataset,
  type JournalThemeId,
  type PaletteSeriesId,
  type FieldRole,
  type FigureFontId,
  type PlotType,
  type VisualizationSettings,
} from "@/lib/visualization-studio";

const controlClass =
  "focus-ring h-8 w-full rounded-[7px] border border-hairline bg-white px-2.5 text-xs text-ink placeholder:text-muted";
const palettePreferenceStorageKey = "labnest:visualization-studio:palette";
const customPaletteStorageKey = "labnest:visualization-studio:custom-palettes";

type BuiltInPaletteSeriesId = Exclude<PaletteSeriesId, "custom">;
type PcaInputMode = "scores" | "matrix";
type PlotFinderGoalId = "compare" | "trend" | "distribution" | "association" | "ordination" | "differential" | "enrichment" | "composition" | "sets" | "network" | "clinical" | "genomic";

const plotFinderGoals: ReadonlyArray<{ id: PlotFinderGoalId; label: string; description: string; keywords: string; plots: readonly PlotType[] }> = [
  { id: "compare", label: "Compare groups", description: "Compare group means, uncertainty, or raw observations.", keywords: "比较 分组 均值 差异 误差", plots: ["bar", "errorbar", "box", "violin", "beeswarm", "raincloud"] },
  { id: "trend", label: "Show change or trend", description: "Show ordered, longitudinal, or time-series change.", keywords: "趋势 时间 时序 纵向 变化", plots: ["line", "area", "lollipop"] },
  { id: "distribution", label: "Show a distribution", description: "Describe spread, shape, density, and outliers.", keywords: "分布 密度 离群 四分位", plots: ["histogram", "density", "box", "violin", "ridge", "raincloud"] },
  { id: "association", label: "Show an association", description: "Inspect relationships, correlation, and multivariable patterns.", keywords: "相关 关联 回归 关系", plots: ["scatter", "correlation", "correlation-heatmap", "quadrant", "radar"] },
  { id: "ordination", label: "Sample similarity", description: "Display reduced coordinates or sample-level dissimilarity.", keywords: "降维 样本相似 聚类 主成分 beta diversity", plots: ["pca", "pcoa", "umap", "tsne", "nmds"] },
  { id: "differential", label: "Show differential results", description: "Display effect sizes, abundance, and statistical evidence.", keywords: "差异表达 差异丰度 fold change 显著", plots: ["volcano", "ma", "waterfall"] },
  { id: "enrichment", label: "Show pathways or enrichment", description: "Summarize enriched terms, gene sets, and pathway effects.", keywords: "富集 通路 GO KEGG GSEA", plots: ["enrichment", "enrichment-bar", "gsea", "go-circle", "kegg-circle", "pathway-impact", "nes-fdr"] },
  { id: "composition", label: "Show composition", description: "Display parts of a whole or hierarchical composition.", keywords: "组成 占比 构成 比例", plots: ["bar", "donut", "waffle", "treemap", "sunburst", "rose"] },
  { id: "sets", label: "Compare sets", description: "Show exact membership and intersections among sets.", keywords: "集合 交集 overlap", plots: ["venn", "upset"] },
  { id: "network", label: "Show flows or networks", description: "Display links, flows, interactions, and regulatory relationships.", keywords: "网络 流向 相互作用 调控 关系", plots: ["network", "ppi", "cnet", "enrichment-map", "sankey", "alluvial", "chord", "circos"] },
  { id: "clinical", label: "Show clinical or model results", description: "Present survival, effect estimates, discrimination, and calibration.", keywords: "临床 生存 预后 模型 诊断", plots: ["km", "survival-forest", "roc", "precision-recall", "calibration", "decision-curve", "funnel"] },
  { id: "genomic", label: "Show genomic context", description: "Display genomic positions, variants, alterations, and sequence motifs.", keywords: "基因组 染色体 突变 位点 motif", plots: ["manhattan", "qq", "genome-tracks", "chromosome-ideogram", "snp-density", "oncoplot", "motif-logo"] },
];

type PalettePreference = {
  seriesId: PaletteSeriesId;
  themeId: JournalThemeId;
  customPaletteId?: string;
};

type CustomPalette = {
  id: string;
  name: string;
  sourceThemeId: JournalThemeId;
  categoricalColors: string[];
  continuousLow: string;
  continuousHigh: string;
  divergingLow: string;
  divergingMid: string;
  divergingHigh: string;
  barBorderColor: string;
  createdAt: string;
  updatedAt: string;
};

function isPaletteSeriesId(value: string | null): value is PaletteSeriesId {
  return Boolean(value && value in paletteSeries);
}

function isJournalThemeId(value: string | null): value is JournalThemeId {
  return Boolean(value && value in journalThemes);
}

function readPalettePreference(): PalettePreference | null {
  try {
    const stored = window.localStorage.getItem(palettePreferenceStorageKey);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<Record<keyof PalettePreference, string>>;
    const seriesId = parsed.seriesId ?? null;
    const themeId = parsed.themeId ?? null;
    if (!isPaletteSeriesId(seriesId) || !isJournalThemeId(themeId)) return null;
    if (seriesId !== "custom" && journalThemes[themeId].series !== seriesId) return null;
    return { seriesId, themeId, customPaletteId: parsed.customPaletteId };
  } catch {
    return null;
  }
}

function writePalettePreference(preference: PalettePreference) {
  try {
    window.localStorage.setItem(palettePreferenceStorageKey, JSON.stringify(preference));
  } catch {
    // Local storage can be disabled; the studio should remain fully usable.
  }
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9A-F]{6}$/i.test(value);
}

function isCustomPalette(value: unknown): value is CustomPalette {
  if (!value || typeof value !== "object") return false;
  const palette = value as Partial<CustomPalette>;
  return (
    typeof palette.id === "string" &&
    typeof palette.name === "string" &&
    isJournalThemeId(palette.sourceThemeId ?? null) &&
    Array.isArray(palette.categoricalColors) &&
    palette.categoricalColors.length > 0 &&
    palette.categoricalColors.every(isHexColor) &&
    isHexColor(palette.continuousLow) &&
    isHexColor(palette.continuousHigh) &&
    isHexColor(palette.divergingLow) &&
    isHexColor(palette.divergingMid) &&
    isHexColor(palette.divergingHigh) &&
    isHexColor(palette.barBorderColor) &&
    typeof palette.createdAt === "string" &&
    typeof palette.updatedAt === "string"
  );
}

function readCustomPalettes(): CustomPalette[] {
  try {
    const stored = window.localStorage.getItem(customPaletteStorageKey);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isCustomPalette) : [];
  } catch {
    return [];
  }
}

function writeCustomPalettes(palettes: CustomPalette[]) {
  try {
    window.localStorage.setItem(customPaletteStorageKey, JSON.stringify(palettes));
  } catch {
    // Local storage can be disabled; custom palette saving should fail quietly.
  }
}

function paletteColorsFromSettings(settings: VisualizationSettings, sourceThemeId: JournalThemeId): Omit<CustomPalette, "id" | "name" | "createdAt" | "updatedAt"> {
  return {
    sourceThemeId,
    categoricalColors: [...settings.categoricalColors],
    continuousLow: settings.continuousLow,
    continuousHigh: settings.continuousHigh,
    divergingLow: settings.divergingLow,
    divergingMid: settings.divergingMid,
    divergingHigh: settings.divergingHigh,
    barBorderColor: settings.barBorderColor,
  };
}

function applyCustomPalette(current: VisualizationSettings, palette: CustomPalette): VisualizationSettings {
  return {
    ...current,
    categoricalColors: [...palette.categoricalColors],
    continuousLow: palette.continuousLow,
    continuousHigh: palette.continuousHigh,
    divergingLow: palette.divergingLow,
    divergingMid: palette.divergingMid,
    divergingHigh: palette.divergingHigh,
    barBorderColor: palette.barBorderColor,
  };
}

function colorFingerprint(colors: Omit<CustomPalette, "id" | "name" | "createdAt" | "updatedAt">) {
  return JSON.stringify(colors);
}

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

const distributionPlotTypes: PlotType[] = ["box", "violin", "beeswarm", "raincloud", "histogram", "density", "ridge"];

function settingsForDistributionPreset(current: VisualizationSettings, type: PlotType): VisualizationSettings {
  if (!distributionPlotTypes.includes(type)) return current;
  return {
    ...current,
    showDensity: ["violin", "raincloud", "density", "ridge"].includes(type),
    showHistogram: type === "histogram",
    showBox: ["box", "raincloud"].includes(type),
    showPoints: ["box", "violin", "beeswarm", "raincloud"].includes(type),
    showSampleSize: true,
    distributionSummary: ["violin", "raincloud"].includes(type) ? "median" : "none",
    boxErrorType: "none",
    distributionShowPairedLines: false,
    distributionShowSignificance: false,
    distributionOrientation: type === "ridge" ? "horizontal" : "vertical",
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
  if (plotType === "line" || plotType === "area") return uniqueColumnValues(rows, mapping.series, "All");
  if (["scatter", "correlation", "quadrant", "pca", "pcoa", "umap", "tsne", "nmds", "errorbar", "lollipop", "km", "survival-forest", "roc"].includes(plotType)) return uniqueColumnValues(rows, mapping.group, "All");
  if (distributionPlotTypes.includes(plotType)) return uniqueColumnValues(rows, mapping.group, "All");
  if (plotType === "volcano" || plotType === "ma") return ["Down", "Up", "Not significant"];
  if (plotType === "gsea") return ["Running ES", "Gene-set hits"];
  if (plotType === "venn" || plotType === "upset") return uniqueColumnValues(rows, mapping.set, "Set");
  if (plotType === "sankey" || plotType === "chord") return [...new Set(rows.flatMap((row) => [row[mapping.source], row[mapping.target]]).filter(Boolean))];
  if (plotType === "alluvial") return uniqueColumnValues(rows, mapping.group, "Flow");
  if (plotType === "ligand-receptor") return [...new Set(rows.flatMap((row) => [row[mapping.sourceCell], row[mapping.targetCell]]).filter(Boolean))];
  if (plotType === "circos") return [...new Set(rows.flatMap((row) => [row[mapping.chromosome], row[mapping.targetChromosome]]).filter(Boolean))];
  if (["pie", "donut", "rose", "waffle"].includes(plotType)) return uniqueColumnValues(rows, mapping.category, "Part");
  if (plotType === "treemap" || plotType === "sunburst") {
    const root = rows.find((row) => !mapping.parent || !row[mapping.parent]?.trim())?.[mapping.node];
    const topLevel = root && mapping.parent ? rows.filter((row) => row[mapping.parent] === root).map((row) => row[mapping.node]).filter(Boolean) : [];
    return [...new Set(topLevel.length > 0 ? topLevel : ["Node"])].slice(0, 12);
  }
  if (plotType === "radar" || plotType === "polar-profile") return uniqueColumnValues(rows, mapping.series, "All");
  if (plotType === "population-pyramid") return uniqueColumnValues(rows, mapping.group, "Group");
  if (plotType === "go-circle" || plotType === "kegg-circle") return uniqueColumnValues(rows, mapping.group, plotType === "go-circle" ? "GO" : "KEGG");
  if (plotType === "go-chord") return ["Positive effect", "Negative effect", ...uniqueColumnValues(rows, mapping.group, "Ontology")];
  if (plotType === "pathway-impact") return uniqueColumnValues(rows, mapping.group, "Pathway group");
  if (plotType === "multi-gsea") return uniqueColumnValues(rows, mapping.group, "Gene set");
  if (plotType === "enrichment-ridge") return uniqueColumnValues(rows, mapping.term, "Term");
  if (plotType === "sankey-bubble") return uniqueColumnValues(rows, mapping.source, "Source");
  if (plotType === "geographic-map") return uniqueColumnValues(rows, mapping.group, "Sites");
  if (plotType === "petal") return uniqueColumnValues(rows, mapping.label, "Category");
  if (plotType === "word-cloud") return uniqueColumnValues(rows, mapping.label, "Term");
  return [];
}

function spreadsheetRowsToTsv(rows: unknown[][]) {
  return rows.map((row) => row.map((cell) => String(cell ?? "").replace(/[\t\r\n]+/g, " ")).join("\t")).join("\n");
}

function pcaAxisLabel(component: string, explainedVariance: number[]) {
  const match = component.match(/^PC(\d+)$/i);
  const index = match ? Number(match[1]) - 1 : -1;
  const proportion = explainedVariance[index];
  return Number.isFinite(proportion) ? `${component.toUpperCase()} (${(proportion * 100).toFixed(1)}%)` : component;
}

function serializeSvg(svg: SVGSVGElement, fontFamily: string) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("font-family", fontFamily);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
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

function TextareaControl({ label, value, onChange, placeholder, hint }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; hint?: string }) {
  return (
    <label className="grid gap-1 text-xs text-graphite">
      <span>{label}</span>
      <textarea
        aria-label={label}
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        className="focus-ring min-h-20 resize-y rounded-[7px] border border-hairline bg-[#FBFBF9] px-2.5 py-2 font-mono text-[10px] leading-4 text-ink placeholder:text-muted"
      />
      {hint ? <span className="text-[10px] leading-4 text-muted">{hint}</span> : null}
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
  const [draft, setDraft] = useState<string | null>(null);
  const displayedValue = draft ?? String(value);

  const commitDraft = () => {
    const parsed = Number(displayedValue.trim());
    if (!Number.isFinite(parsed)) {
      setDraft(null);
      return;
    }
    const nextValue = Math.min(maximum, Math.max(minimum, parsed));
    setDraft(null);
    onChange(nextValue);
  };

  return (
    <div className="grid gap-1 text-xs text-graphite">
      <div className="flex items-center justify-between gap-2">
        <span>{label}</span>
        <span className="flex items-center font-mono text-[11px] text-muted">
          <input
            type="text"
            inputMode="decimal"
            aria-label={`${label} value`}
            value={displayedValue}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                setDraft(null);
              }
            }}
            className="focus-ring w-14 rounded-[4px] border border-transparent bg-transparent px-1 py-0.5 text-right font-mono text-[11px] text-muted hover:border-hairline focus:border-border-strong focus:bg-white focus:text-ink"
          />
          {unit ? <span>{unit}</span> : null}
        </span>
      </div>
      <input aria-label={`${label} slider`} className="h-5 w-full accent-[var(--color-moss)]" type="range" min={minimum} max={maximum} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}

function OptionalNumberControl({ label, value, invalid = false, describedBy, onChange }: { label: string; value: number | null; invalid?: boolean; describedBy?: string; onChange: (value: number | null) => void }) {
  const commit = (draft: string) => {
    const trimmed = draft.trim();
    if (!trimmed) {
      onChange(null);
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) onChange(parsed);
  };
  return (
    <label className="grid gap-1 text-xs text-graphite">
      <span>{label}</span>
      <input
        className={controlClass}
        type="text"
        inputMode="decimal"
        key={value ?? "auto"}
        defaultValue={value ?? ""}
        placeholder="Auto"
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? describedBy : undefined}
        onBlur={(event) => {
          commit(event.currentTarget.value);
          if (event.currentTarget.value.trim() && !Number.isFinite(Number(event.currentTarget.value))) {
            event.currentTarget.value = value === null ? "" : String(value);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") event.currentTarget.value = value === null ? "" : String(value);
        }}
      />
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
  const [selectedExampleIndex, setSelectedExampleIndex] = useState(0);
  const [themeId, setThemeId] = useState<JournalThemeId>(defaultVisualizationThemeId);
  const [paletteSeriesId, setPaletteSeriesId] = useState<PaletteSeriesId>(defaultVisualizationPaletteSeriesId);
  const [settings, setSettings] = useState<VisualizationSettings>(() => settingsForTheme(defaultVisualizationThemeId));
  const [pcaInputMode, setPcaInputMode] = useState<PcaInputMode>("scores");
  const [pcaOptions, setPcaOptions] = useState<PcaOptions>(defaultPcaOptions);
  const [pcaObservationMetadata, setPcaObservationMetadata] = useState("");
  const [customPalettes, setCustomPalettes] = useState<CustomPalette[]>([]);
  const [selectedCustomPaletteId, setSelectedCustomPaletteId] = useState("");
  const [customPaletteName, setCustomPaletteName] = useState("");
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);
  const [plotSearchQuery, setPlotSearchQuery] = useState("");
  const [plotFinderOpen, setPlotFinderOpen] = useState(false);
  const [plotFinderGoalId, setPlotFinderGoalId] = useState<PlotFinderGoalId>("compare");
  const [loadedFileName, setLoadedFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [stickyHeaderHeight, setStickyHeaderHeight] = useState(0);
  const [selectedIntersectionSignature, setSelectedIntersectionSignature] = useState("");
  const svgRef = useRef<SVGSVGElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const stickyHeaderRef = useRef<HTMLDivElement | null>(null);
  const previewCardRef = useRef<HTMLDivElement | null>(null);
  const parameterScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const storedCustomPalettes = readCustomPalettes();
      setCustomPalettes(storedCustomPalettes);
      const preference = readPalettePreference();
      if (!preference) return;
      if (preference.seriesId === "custom") {
        const customPalette = storedCustomPalettes.find((palette) => palette.id === preference.customPaletteId) ?? storedCustomPalettes[0];
        if (!customPalette) return;
        setPaletteSeriesId("custom");
        setSelectedCustomPaletteId(customPalette.id);
        setCustomPaletteName(customPalette.name);
        setThemeId(customPalette.sourceThemeId);
        setSettings((current) => applyCustomPalette(current, customPalette));
        return;
      }
      setPaletteSeriesId(preference.seriesId);
      setThemeId(preference.themeId);
      setSettings(settingsForTheme(preference.themeId));
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const element = stickyHeaderRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    let frameId = 0;
    const updateHeight = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        setStickyHeaderHeight(Math.ceil(element.getBoundingClientRect().height));
      });
    };
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    window.addEventListener("resize", updateHeight);
    updateHeight();
    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  const plotModule = getPlotModule(plotType);
  const definition = plotModule.definition;
  const dataExamples = plotModule.examples;
  const guidance = plotModule.guidance;
  const selectedPlotFinderGoal = plotFinderGoals.find((goal) => goal.id === plotFinderGoalId) ?? plotFinderGoals[0];
  const recommendedPlotModules = useMemo(() => selectedPlotFinderGoal.plots.map((id) => getPlotModule(id)), [selectedPlotFinderGoal]);
  const filteredPlotModules = useMemo(() => {
    const query = plotSearchQuery.trim().toLocaleLowerCase();
    if (!query) return plotModuleRegistry.list();
    const queryTokens = query.split(/\s+/).filter(Boolean);
    return plotModuleRegistry.list().filter((candidate) => {
      const relatedGoals = plotFinderGoals.filter((goal) => goal.plots.includes(candidate.definition.id));
      const corpus = [
        candidate.definition.name,
        candidate.definition.family,
        candidate.definition.summary,
        candidate.definition.inputHint,
        ...candidate.definition.roles.map((role) => role.label),
        candidate.guidance.definition,
        candidate.guidance.suitableData,
        candidate.guidance.answers,
        candidate.guidance.origin ?? "",
        ...relatedGoals.flatMap((goal) => [goal.label, goal.description, goal.keywords]),
      ].join(" ").toLocaleLowerCase();
      return queryTokens.every((token) => corpus.includes(token));
    });
  }, [plotSearchQuery]);
  const hasSetting = (key: keyof VisualizationSettings) => plotModule.capabilities.settingKeys.includes(key);
  const visibleRoles = definition.roles.filter((role) => isPlotRoleActive(plotType, role.key, settings));
  const manualAxes = activeNumericAxes(plotType, settings);
  const invalidXLimits = manualAxes.includes("x") && settings.xMin !== null && settings.xMax !== null && settings.xMin >= settings.xMax;
  const invalidYLimits = manualAxes.includes("y") && settings.yMin !== null && settings.yMax !== null && settings.yMin >= settings.yMax;
  const pcaAnalysis = useMemo(() => plotType === "pca" && pcaInputMode === "matrix" ? analyzeExpressionMatrix(rawData, pcaOptions, pcaObservationMetadata) : null, [plotType, pcaInputMode, rawData, pcaObservationMetadata, pcaOptions]);
  const dataset = useMemo(() => pcaAnalysis?.dataset ?? parseDelimitedData(rawData), [pcaAnalysis, rawData]);
  const barCategoryOptions = useMemo(() => plotType === "bar" && mapping.category
    ? [...new Set(dataset.rows.map((row) => row[mapping.category]).filter(Boolean))]
    : [], [dataset.rows, mapping.category, plotType]);
  const barAnalysis = useMemo(() => plotType === "bar" ? analyzeBarData(dataset.rows, mapping, {
    mode: settings.barAnalysisMode,
    referenceCategory: settings.barReferenceCategory || barCategoryOptions[0],
    adjustment: settings.barPAdjustment,
  }) : null, [barCategoryOptions, dataset.rows, mapping, plotType, settings.barAnalysisMode, settings.barPAdjustment, settings.barReferenceCategory]);
  const displayDataset = useMemo(() => barAnalysis ? {
    ...dataset,
    headers: barAnalysis.pValueColumn && !dataset.headers.includes(barAnalysis.pValueColumn) ? [...dataset.headers, barAnalysis.pValueColumn] : dataset.headers,
    rows: barAnalysis.rows,
  } : dataset, [barAnalysis, dataset]);
  const displayMapping = useMemo(() => plotType === "bar" ? {
    ...mapping,
    error: settings.barInputMode === "summary" && settings.barErrorType !== "none" ? mapping[settings.barErrorType] || mapping.error : mapping.error,
    pValue: barAnalysis?.pValueColumn ?? mapping.pValue,
  } : mapping, [barAnalysis?.pValueColumn, mapping, plotType, settings.barErrorType, settings.barInputMode]);
  const setAnalysis = useMemo(
    () => (plotType === "venn" || plotType === "upset") ? analyzeSetIntersections(dataset.rows, mapping, settings.setInputMode) : null,
    [dataset.rows, mapping, plotType, settings.setInputMode],
  );
  const selectedSetIntersection = setAnalysis?.intersections.find((entry) => entry.signature === selectedIntersectionSignature) ?? setAnalysis?.intersections[0] ?? null;
  const barBreakRange = useMemo(() => {
    if (plotType !== "bar" || !mapping.value) return { minimum: -100, maximum: 100, step: 0.5 };
    const values = dataset.rows.flatMap((row) => {
      const value = parseNumericValue(row[mapping.value]);
      return value === null ? [] : [value];
    });
    if (!values.length) return { minimum: -100, maximum: 100, step: 0.5 };
    const low = Math.min(...values); const high = Math.max(...values); const span = Math.max(1, high - low, Math.abs(low) * .2, Math.abs(high) * .2);
    return { minimum: Math.floor(low - span * .25), maximum: Math.ceil(high + span * .25), step: Math.max(0.01, Number((span / 200).toPrecision(2))) };
  }, [dataset.rows, mapping.value, plotType]);
  const validation = useMemo(() => {
    const base = validatePlotDataset(getPlotDefinition(plotType), displayDataset, displayMapping, settings);
    if (!barAnalysis) return base;
    return { errors: [...base.errors, ...barAnalysis.errors], warnings: [...base.warnings, ...barAnalysis.warnings] };
  }, [barAnalysis, displayDataset, displayMapping, plotType, settings]);
  const categoryLabels = useMemo(() => categoricalColorLabels(plotType, displayDataset.rows, displayMapping), [displayDataset.rows, displayMapping, plotType]);
  const analysisProvenance = useMemo(() => analysisProvenanceForPlot(plotType, settings, pcaInputMode), [pcaInputMode, plotType, settings]);
  const isValid = validation.errors.length === 0;
  const mainGridStyle = {
    "--visualization-panel-top": `${stickyHeaderHeight + 12}px`,
    "--visualization-panel-height": `calc(100dvh - ${stickyHeaderHeight + 28}px)`,
  } as CSSProperties;
  const currentColorFingerprint = useMemo(() => colorFingerprint(paletteColorsFromSettings(settings, themeId)), [settings, themeId]);
  const selectedCustomPalette = useMemo(() => customPalettes.find((palette) => palette.id === selectedCustomPaletteId), [customPalettes, selectedCustomPaletteId]);
  const selectedPaletteFingerprint = useMemo(() => {
    if (selectedCustomPalette) return colorFingerprint(paletteColorsFromSettings(applyCustomPalette(settingsForTheme(selectedCustomPalette.sourceThemeId), selectedCustomPalette), selectedCustomPalette.sourceThemeId));
    if (paletteSeriesId === "custom") return "";
    return colorFingerprint(paletteColorsFromSettings(settingsForTheme(themeId), themeId));
  }, [paletteSeriesId, selectedCustomPalette, themeId]);
  const currentPaletteName = paletteSeriesId === "custom" ? selectedCustomPalette?.name || "Custom" : journalThemes[themeId].name;
  const currentPalettePreviewColors = paletteColorsFromSettings(settings, themeId).categoricalColors.slice(0, 4);
  const effectiveCategoricalColors = useMemo(() => categoryLabels.map((_, index) => categoricalColorForIndex(index, settings.categoricalColors)), [categoryLabels, settings.categoricalColors]);
  const currentPaletteQuality = useMemo(() => assessCategoricalPalette(effectiveCategoricalColors.length ? effectiveCategoricalColors : settings.categoricalColors.slice(0, 4)), [effectiveCategoricalColors, settings.categoricalColors]);
  const hasUnsavedColorChanges = currentColorFingerprint !== selectedPaletteFingerprint;
  const colorResolvedSettings = useMemo(() => effectiveCategoricalColors.length ? { ...settings, categoricalColors: effectiveCategoricalColors } : settings, [effectiveCategoricalColors, settings]);
  const previewSettings = useMemo(() => {
    if (!pcaAnalysis) return colorResolvedSettings;
    if (settings.ordinationView === "scree") return colorResolvedSettings;
    const displayedX = settings.swapAxes ? mapping.y : mapping.x;
    const displayedY = settings.swapAxes ? mapping.x : mapping.y;
    return {
      ...colorResolvedSettings,
      xLabel: settings.xLabel || pcaAxisLabel(displayedX, pcaAnalysis.explainedVariance),
      yLabel: settings.yLabel || pcaAxisLabel(displayedY, pcaAnalysis.explainedVariance),
    };
  }, [colorResolvedSettings, mapping.x, mapping.y, pcaAnalysis, settings.ordinationView, settings.swapAxes, settings.xLabel, settings.yLabel]);

  const updateSetting = <Key extends keyof VisualizationSettings>(key: Key, value: VisualizationSettings[Key]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const updateCategoryColor = (index: number, value: string) => {
    setSettings((current) => {
      const themeColors = journalThemes[themeId].categorical;
      const nextLength = Math.max(current.categoricalColors.length, index + 1);
      const categoricalColors = Array.from({ length: nextLength }, (_, colorIndex) => current.categoricalColors[colorIndex] ?? categoricalColorForIndex(colorIndex, themeColors));
      categoricalColors[index] = value;
      return { ...current, categoricalColors };
    });
  };

  const applyDataExample = (exampleIndex: number) => {
    const example = dataExamples[exampleIndex];
    if (!example) return;
    setSelectedExampleIndex(exampleIndex);
    setRawData(example.data);
    setPcaObservationMetadata(example.metadata ?? "");
    setMapping(example.mapping ?? definition.defaultMapping);
    setLoadedFileName("");
    setFileError("");
    setSelectedIntersectionSignature("");
    if (plotType === "pca") {
      const nextInputMode = example.pcaInputMode ?? "matrix";
      setPcaInputMode(nextInputMode);
      setPcaOptions(defaultPcaOptions);
      if (nextInputMode === "scores") setSettings((current) => ({ ...current, ordinationView: "scores", ordinationShowLoadings: false }));
    }
    if (plotType === "bar" && !example.settings?.barInputMode) updateSetting("barInputMode", exampleIndex === 1 ? "long" : "summary");
    if (plotType === "roc") updateSetting("rocInputMode", exampleIndex === 1 ? "precomputed-time" : "raw");
    if (plotType === "venn" || plotType === "upset") updateSetting("setInputMode", exampleIndex === 1 ? "peak-overlap" : "membership");
    if (example.settings) setSettings((current) => ({ ...current, ...example.settings as Partial<VisualizationSettings> }));
  };

  const selectPcaInputMode = (nextMode: PcaInputMode) => {
    const exampleIndex = dataExamples.findIndex((example) => example.pcaInputMode === nextMode);
    if (exampleIndex >= 0) applyDataExample(exampleIndex);
  };

  const selectPlot = (nextType: PlotType) => {
    const nextModule = getPlotModule(nextType);
    const next = nextModule.definition;
    const nextExample = nextModule.examples[0];
    setPlotType(nextType);
    setSelectedExampleIndex(0);
    setRawData(nextExample.data);
    setPcaObservationMetadata(nextExample.metadata ?? "");
    setMapping(nextExample.mapping ?? next.defaultMapping);
    setLoadedFileName("");
    setFileError("");
    setSelectedIntersectionSignature("");
    if (nextType === "pca") {
      setPcaInputMode(nextExample.pcaInputMode ?? "matrix");
      setPcaOptions(defaultPcaOptions);
    }
    setSettings((current) => settingsForDistributionPreset({
      ...current,
      title: "",
      xLabel: "",
      yLabel: "",
      swapAxes: false,
      showLabels: (["sankey", "alluvial", "chord", "ligand-receptor", "circos"] as PlotType[]).includes(nextType) ? true : current.showLabels,
      ordinationView: (["pca", "pcoa", "umap", "tsne", "nmds"] as PlotType[]).includes(nextType) ? "scores" : current.ordinationView,
      clusterColumns: nextType === "correlation-heatmap" ? current.clusterRows : current.clusterColumns,
      heatmapColumnClusters: nextType === "correlation-heatmap" ? current.heatmapRowClusters : current.heatmapColumnClusters,
      compositionLabelMode: nextType === "rose" ? "value" : current.compositionLabelMode,
      setInputMode: (nextType === "venn" || nextType === "upset") ? "membership" : current.setInputMode,
      rocInputMode: nextType === "roc" ? "raw" : current.rocInputMode,
      ...(nextExample.settings ?? {}),
      legendPosition: (["heatmap", "clustered-heatmap", "correlation-heatmap", "enrichment", "enrichment-bar", "venn", "upset", "sankey", "alluvial", "chord", "ligand-receptor", "circos"] as PlotType[]).includes(nextType) && current.legendPosition === "bottom" ? "right" : current.legendPosition,
    }, nextType));
    window.requestAnimationFrame(() => {
      if (parameterScrollRef.current) parameterScrollRef.current.scrollTop = 0;
      previewCardRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
    });
  };

  const selectTheme = (nextTheme: JournalThemeId) => {
    const theme = journalThemes[nextTheme];
    setThemeId(nextTheme);
    setPaletteSeriesId(theme.series);
    setSelectedCustomPaletteId("");
    writePalettePreference({ seriesId: theme.series, themeId: nextTheme });
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

  const selectPaletteSeries = (nextSeries: PaletteSeriesId) => {
    if (nextSeries === "custom") {
      const firstCustomPalette = customPalettes[0];
      setPaletteSeriesId("custom");
      if (!firstCustomPalette) {
        writePalettePreference({ seriesId: "custom", themeId });
        return;
      }
      setSelectedCustomPaletteId(firstCustomPalette.id);
      setCustomPaletteName(firstCustomPalette.name);
      setThemeId(firstCustomPalette.sourceThemeId);
      setSettings((current) => applyCustomPalette(current, firstCustomPalette));
      writePalettePreference({ seriesId: "custom", themeId: firstCustomPalette.sourceThemeId, customPaletteId: firstCustomPalette.id });
      return;
    }
    const builtInSeries = nextSeries as BuiltInPaletteSeriesId;
    const firstTheme = paletteSeries[builtInSeries].themeIds[0];
    setPaletteSeriesId(nextSeries);
    selectTheme(firstTheme);
  };

  const selectCustomPalette = (palette: CustomPalette) => {
    setPaletteSeriesId("custom");
    setSelectedCustomPaletteId(palette.id);
    setCustomPaletteName(palette.name);
    setThemeId(palette.sourceThemeId);
    setSettings((current) => applyCustomPalette(current, palette));
    writePalettePreference({ seriesId: "custom", themeId: palette.sourceThemeId, customPaletteId: palette.id });
  };

  const saveCustomPalette = () => {
    const name = customPaletteName.trim() || `Custom ${customPalettes.length + 1}`;
    const now = new Date().toISOString();
    const existing = customPalettes.find((palette) => palette.name.trim().toLowerCase() === name.toLowerCase());
    const palette: CustomPalette = {
      id: existing?.id ?? globalThis.crypto?.randomUUID?.() ?? `custom-${Date.now()}`,
      name,
      ...paletteColorsFromSettings(settings, themeId),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const nextPalettes = existing
      ? customPalettes.map((item) => item.id === existing.id ? palette : item)
      : [palette, ...customPalettes];
    writeCustomPalettes(nextPalettes);
    setCustomPalettes(nextPalettes);
    setPaletteSeriesId("custom");
    setSelectedCustomPaletteId(palette.id);
    setCustomPaletteName(name);
    writePalettePreference({ seriesId: "custom", themeId: palette.sourceThemeId, customPaletteId: palette.id });
  };

  const selectErrorType = (key: "barErrorType" | "lineErrorType", value: VisualizationSettings["barErrorType"] | VisualizationSettings["lineErrorType"]) => {
    setSettings((current) => ({ ...current, [key]: value }));
    if (value === "none") return;
    const preferredAliases = value === "sd"
      ? ["sd", "standarddeviation", "error"]
      : value === "sem"
        ? ["sem", "se", "stderr", "standarderror", "error"]
        : ["ci95", "ci", "confidenceinterval", "error"];
    const normalizedHeaders = new Map(dataset.headers.map((header) => [header.toLowerCase().replace(/[^a-z0-9]/g, ""), header]));
    const preferredColumn = preferredAliases.map((alias) => normalizedHeaders.get(alias)).find(Boolean);
    if (preferredColumn) setMapping((current) => ({ ...current, error: preferredColumn }));
  };

  const selectBarVariant = (value: VisualizationSettings["barVariant"]) => {
    setSettings((current) => ({
      ...current,
      barVariant: value,
      swapAxes: ["dual-axis", "overlay", "polar", "faceted"].includes(value) ? false : current.swapAxes,
      legendPosition: value === "dual-axis" && current.legendPosition === "right" ? "bottom" : current.legendPosition,
    }));
  };

  const selectBarAnalysisMode = (mode: VisualizationSettings["barAnalysisMode"]) => {
    setSettings((current) => ({
      ...current,
      barAnalysisMode: mode,
      barInputMode: ["raw-independent", "raw-paired", "qpcr-delta-ct"].includes(mode) ? "long" : "summary",
      showSignificance: mode !== "none",
      barReferenceCategory: current.barReferenceCategory || barCategoryOptions[0] || "",
    }));
  };

  const selectAssociationVariant = (value: VisualizationSettings["associationVariant"]) => {
    setSettings((current) => ({
      ...current,
      associationVariant: value,
      swapAxes: ["pair-matrix", "3d", "ternary"].includes(value) ? false : current.swapAxes,
      associationGroupMode: ["density", "hexbin"].includes(value) ? "combined" : current.associationGroupMode,
    }));
  };

  const loadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileError("");
    try {
      const text = file.name.toLowerCase().endsWith(".xlsx")
        ? spreadsheetRowsToTsv(await (await import("read-excel-file/browser")).readSheet(file))
        : await file.text();
      setRawData(text);
      setSelectedExampleIndex(-1);
      setLoadedFileName(file.name);
      if (plotType === "pca" && pcaInputMode === "matrix") { setPcaObservationMetadata(""); setMapping(definition.defaultMapping); }
      else if (plotType === "pca") setMapping(inferPlotMapping(definition, parseDelimitedData(text).headers));
      else setMapping(inferPlotMapping(definition, parseDelimitedData(text).headers));
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "The selected file could not be read.");
    }
    event.target.value = "";
  };

  const downloadInputTemplate = () => {
    const example = dataExamples[selectedExampleIndex >= 0 ? selectedExampleIndex : 0] ?? dataExamples[0];
    downloadBlob(new Blob([example.data], { type: "text/tab-separated-values;charset=utf-8" }), `${slug(definition.name)}-${slug(example.label)}-template.tsv`);
  };

  const downloadPcaMetadataTemplate = () => {
    const example = dataExamples[selectedExampleIndex >= 0 ? selectedExampleIndex : 0] ?? dataExamples[0];
    const metadata = example.metadata ?? "sample\tgroup\tbatch\tlabel\nSample_1\tControl\tBatch 1\tS1";
    downloadBlob(new Blob([metadata], { type: "text/tab-separated-values;charset=utf-8" }), `${slug(definition.name)}-observation-metadata-template.tsv`);
  };

  const downloadSelectedIntersection = () => {
    if (!setAnalysis || !selectedSetIntersection) return;
    const content = intersectionExportTsv(setAnalysis, selectedSetIntersection.signature);
    const label = selectedSetIntersection.sets.join("-and-");
    downloadBlob(new Blob([content], { type: "text/tab-separated-values;charset=utf-8" }), `${slug(definition.name)}-${slug(label)}-exact-members.tsv`);
  };

  const downloadBarAnalysis = () => {
    if (!barAnalysis?.results.length) return;
    const content = barAnalysisResultsTsv(barAnalysis.results);
    downloadBlob(new Blob([content], { type: "text/tab-separated-values;charset=utf-8" }), "bar-statistical-results.tsv");
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
      settings: previewSettings,
      analysisProvenance: analysisProvenance ?? undefined,
      pca: plotType === "pca" ? {
        inputMode: pcaInputMode,
        provenance: analysisProvenance?.source ?? (pcaInputMode === "matrix" ? "calculated-in-studio" : "supplied"),
        ...(pcaAnalysis ? {
        options: pcaOptions,
        detectedLayer: pcaAnalysis.detectedLayer,
        sampleColumns: pcaAnalysis.sampleColumns,
        featuresRead: pcaAnalysis.featuresRead,
        featuresComplete: pcaAnalysis.featuresComplete,
        featuresVariable: pcaAnalysis.featuresVariable,
        featuresUsed: pcaAnalysis.featuresUsed,
        explainedVariance: pcaAnalysis.explainedVariance,
        transformation: pcaAnalysis.transformation,
        observationMetadata: pcaObservationMetadata,
        } : {}),
      } : undefined,
      data: rawData,
    };
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), `${slug(settings.title || definition.name)}.labnest-figure.json`);
  };

  return (
    <div className="space-y-[var(--ln-vis-panel-gap)]" data-visualization-workbench>
      <div ref={stickyHeaderRef} data-visualization-sticky-header className="sticky top-0 z-20 -mx-1 space-y-1.5 border-b border-hairline/70 bg-paper/95 px-1 pb-2 backdrop-blur">
        <PageHeader identifier="TOOLS / VIS" title="Visualization Studio" className="min-h-8" />
        <Card className="overflow-hidden rounded-[var(--ln-vis-panel-radius)] border-[var(--ln-vis-panel-border)] shadow-none">
          <button
            type="button"
            aria-expanded={mobilePaletteOpen}
            aria-controls="visualization-mobile-palette-controls"
            onClick={() => setMobilePaletteOpen((open) => !open)}
            className="focus-ring flex w-full items-center justify-between gap-3 px-3 py-2 text-left md:hidden"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex -space-x-0.5" aria-hidden>{currentPalettePreviewColors.map((color, colorIndex) => <span key={`mobile-current-${color}-${colorIndex}`} className="h-3.5 w-3.5 rounded-full border border-white" style={{ backgroundColor: color }} />)}</span>
              <span className="truncate text-xs font-semibold text-ink">{currentPaletteName}</span>
            </span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", mobilePaletteOpen && "rotate-180")} aria-hidden />
          </button>
          <div id="visualization-mobile-palette-controls" className={cn("md:block", mobilePaletteOpen ? "block border-t border-hairline" : "hidden")}>
          <CardBody className="grid gap-1.5 p-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-0.5 text-[11px] font-semibold text-graphite">Palette</span>
              {(Object.keys(paletteSeries) as PaletteSeriesId[]).map((id) => (
                <button key={id} type="button" title={paletteSeries[id].description} onClick={() => selectPaletteSeries(id)} className={cn("focus-ring h-7 rounded-[6px] border px-2 text-[11px] font-medium transition-colors", paletteSeriesId === id ? "border-moss bg-[var(--ln-vis-active-bg)] text-ink" : "border-transparent bg-transparent text-graphite hover:border-hairline hover:bg-warm")}>{paletteSeries[id].name}</button>
              ))}
              <span className="mx-0.5 h-5 w-px bg-hairline" aria-hidden />
              {paletteSeriesId === "custom" ? customPalettes.length ? customPalettes.map((palette) => (
                <button key={palette.id} type="button" title={palette.name} onClick={() => selectCustomPalette(palette)} className={cn("focus-ring flex h-7 items-center gap-1.5 rounded-[6px] border px-2 text-[11px] transition", selectedCustomPaletteId === palette.id ? "border-moss bg-sage-surface text-ink" : "border-hairline bg-white text-graphite hover:border-border-strong")}>
                  <span className="flex -space-x-0.5">{palette.categoricalColors.slice(0, 4).map((color, colorIndex) => <span key={`${palette.id}-${color}-${colorIndex}`} className="h-3 w-3 rounded-full border border-white" style={{ backgroundColor: color }} />)}</span>
                  {palette.name}
                  {selectedCustomPaletteId === palette.id ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                </button>
              )) : <span className="rounded-[6px] border border-dashed border-hairline px-2 py-1 text-[11px] text-muted">No custom palettes</span> : paletteSeries[paletteSeriesId].themeIds.map((id) => (
                <button key={id} type="button" title={journalThemes[id].description} onClick={() => selectTheme(id)} className={cn("focus-ring flex h-7 items-center gap-1.5 rounded-[6px] border px-2 text-[11px] transition", themeId === id ? "border-moss bg-sage-surface text-ink" : "border-hairline bg-white text-graphite hover:border-border-strong") }>
                  <span className="flex -space-x-0.5">{journalThemes[id].categorical.slice(0, 4).map((color) => <span key={color} className="h-3 w-3 rounded-full border border-white" style={{ backgroundColor: color }} />)}</span>
                  {journalThemes[id].name}
                  {themeId === id ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                </button>
              ))}
              {currentPaletteQuality.requiresSecondaryEncoding ? <Badge tone="warning">Color overlap · use outlines, shapes, line styles, or direct labels</Badge> : <Badge tone="success">Categorical contrast checked</Badge>}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <input aria-label="Custom palette name" value={customPaletteName} placeholder="Custom palette name" onChange={(event) => setCustomPaletteName(event.target.value)} className="focus-ring h-7 w-40 rounded-[6px] border border-hairline bg-white px-2 text-[11px] text-ink placeholder:text-muted" />
              <Button size="sm" variant={hasUnsavedColorChanges ? "primary" : "secondary"} onClick={saveCustomPalette}><Save className="h-3.5 w-3.5" aria-hidden />Save palette</Button>
              {hasUnsavedColorChanges ? <Badge tone="warning">Unsaved colors</Badge> : selectedCustomPaletteId ? <Badge tone="success">Saved palette</Badge> : null}
              <select aria-label="Figure font" className="focus-ring h-7 rounded-[6px] border border-hairline bg-white px-2 text-[11px] text-graphite" value={settings.fontFamily} onChange={(event) => updateSetting("fontFamily", event.target.value as FigureFontId)}>
                {(Object.keys(figureFontPresets) as FigureFontId[]).map((id) => <option key={id} value={id}>{figureFontPresets[id].name}</option>)}
              </select>
              <Badge tone="sage">Compact preset</Badge>
            </div>
          </CardBody>
          </div>
        </Card>
        <Card className="rounded-[var(--ln-vis-panel-radius)] border-[var(--ln-vis-panel-border)] shadow-none md:hidden">
          <CardBody className="space-y-2 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden />
              <input aria-label="Search plot types" type="search" value={plotSearchQuery} onChange={(event) => setPlotSearchQuery(event.target.value)} placeholder="Search plots or questions" className="focus-ring h-9 w-full rounded-[8px] border border-hairline bg-white pl-9 pr-3 text-xs text-ink placeholder:text-muted" />
            </div>
            <div className="relative">
              <select aria-label="Plot type" value={plotType} onChange={(event) => selectPlot(event.target.value as PlotType)} className="focus-ring h-10 w-full appearance-none rounded-[8px] border border-hairline bg-white px-3 pr-9 text-sm font-medium text-ink">
                {!filteredPlotModules.some((candidate) => candidate.definition.id === plotType) ? <option value={plotType}>{definition.name} · current</option> : null}
                {filteredPlotModules.map(({ definition: plot }) => <option key={plot.id} value={plot.id}>{plot.name}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            </div>
            <button type="button" aria-expanded={plotFinderOpen} onClick={() => setPlotFinderOpen((open) => !open)} className="focus-ring flex w-full items-center justify-between rounded-[7px] px-2 py-1.5 text-left text-[11px] font-medium text-moss hover:bg-sage-surface"><span className="flex items-center gap-1.5"><Lightbulb className="h-3.5 w-3.5" aria-hidden />Help me choose a plot</span><ChevronDown className={cn("h-3.5 w-3.5 transition-transform", plotFinderOpen && "rotate-180")} aria-hidden /></button>
            {plotFinderOpen ? <div className="space-y-2 rounded-[8px] border border-hairline bg-stone p-2">
              <select aria-label="What do you want to show?" value={plotFinderGoalId} onChange={(event) => setPlotFinderGoalId(event.target.value as PlotFinderGoalId)} className={controlClass}>{plotFinderGoals.map((goal) => <option key={goal.id} value={goal.id}>{goal.label}</option>)}</select>
              <p className="text-[11px] leading-4 text-muted">{selectedPlotFinderGoal.description}</p>
              <div className="flex flex-wrap gap-1">{recommendedPlotModules.map((candidate) => <button key={`mobile-recommend-${candidate.definition.id}`} type="button" onClick={() => selectPlot(candidate.definition.id)} className="focus-ring rounded-[6px] border border-hairline bg-white px-2 py-1 text-[11px] text-graphite hover:border-moss hover:text-ink">{candidate.definition.name}</button>)}</div>
            </div> : null}
          </CardBody>
        </Card>
      </div>

      <div className="grid items-start gap-[var(--ln-vis-panel-gap)] xl:grid-cols-[180px_minmax(0,1fr)_288px] xl:items-start" style={mainGridStyle}>
        <Card data-visualization-panel="plots" className="hidden rounded-[var(--ln-vis-panel-radius)] border-[var(--ln-vis-panel-border)] shadow-none md:block xl:sticky xl:top-[var(--visualization-panel-top)] xl:flex xl:h-[var(--visualization-panel-height)] xl:min-h-0 xl:flex-col xl:overflow-hidden">
          <CardHeader title="Plot types" className="h-12 shrink-0" action={<button type="button" aria-expanded={plotFinderOpen} onClick={() => setPlotFinderOpen((open) => !open)} className="focus-ring rounded-[6px] px-1.5 py-1 text-[10px] font-semibold text-moss hover:bg-sage-surface">Choose</button>} />
          <div className="shrink-0 space-y-2 border-b border-hairline p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden />
              <input aria-label="Search plot types" type="search" value={plotSearchQuery} onChange={(event) => setPlotSearchQuery(event.target.value)} placeholder="Search plots" className="focus-ring h-8 w-full rounded-[7px] border border-hairline bg-white pl-8 pr-2 text-[11px] text-ink placeholder:text-muted" />
            </div>
            {plotFinderOpen ? <div className="space-y-1.5 rounded-[7px] bg-stone p-2">
              <label className="block text-[10px] font-semibold uppercase tracking-[0.06em] text-muted" htmlFor="plot-finder-goal">What should the figure show?</label>
              <select id="plot-finder-goal" aria-label="What do you want to show?" value={plotFinderGoalId} onChange={(event) => setPlotFinderGoalId(event.target.value as PlotFinderGoalId)} className="focus-ring h-8 w-full rounded-[6px] border border-hairline bg-white px-2 text-[11px] text-ink">{plotFinderGoals.map((goal) => <option key={goal.id} value={goal.id}>{goal.label}</option>)}</select>
              <p className="text-[10px] leading-4 text-muted">{selectedPlotFinderGoal.description}</p>
              <div className="flex flex-wrap gap-1">{recommendedPlotModules.map((candidate) => <button key={`desktop-recommend-${candidate.definition.id}`} type="button" onClick={() => selectPlot(candidate.definition.id)} className="focus-ring rounded-[5px] border border-hairline bg-white px-1.5 py-1 text-[10px] text-graphite hover:border-moss hover:text-ink">{candidate.definition.name}</button>)}</div>
            </div> : <p className="text-[10px] text-muted">{filteredPlotModules.length} of {plotModuleRegistry.list().length} plots</p>}
          </div>
          <CardBody className="space-y-1 p-2 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:[scrollbar-gutter:stable]">
            {filteredPlotModules.map(({ definition: plot }) => (
              <button key={plot.id} type="button" onClick={() => selectPlot(plot.id)} className={cn("focus-ring relative w-full rounded-[6px] border border-transparent px-2.5 py-2 text-left transition-colors before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-transparent", plotType === plot.id ? "bg-[var(--ln-vis-active-bg)] before:bg-moss" : "hover:bg-warm") }>
                <span className="block text-[13px] font-medium text-ink">{plot.name}</span>
                <span className="mt-0.5 block text-[10px] uppercase tracking-[0.07em] text-muted">{plot.family}</span>
              </button>
            ))}
            {filteredPlotModules.length === 0 ? <div className="rounded-[7px] border border-dashed border-hairline px-2 py-4 text-center text-[11px] leading-4 text-muted">No matching plot. Try a scientific question such as “survival”, “enrichment”, “微生物”, or “相关”.</div> : null}
          </CardBody>
        </Card>

        <div className="min-w-0 space-y-[var(--ln-vis-panel-gap)]">
          <div ref={previewCardRef} data-visualization-panel="preview" className="scroll-mt-[var(--visualization-panel-top)]">
          <Card className="overflow-hidden rounded-[var(--ln-vis-panel-radius)] border-[var(--ln-vis-preview-border)] shadow-[var(--ln-vis-preview-shadow)]">
            <CardHeader className="min-h-12 shrink-0 max-sm:block max-sm:[&_.card-action]:mt-2" title={`${definition.name} preview`} action={<div className="flex flex-wrap items-center justify-end gap-1.5 max-sm:justify-start">{analysisProvenance ? <span data-analysis-provenance={analysisProvenance.source} data-provenance-detail={analysisProvenance.detail} title={analysisProvenance.detail} aria-label={`${analysisProvenance.label}. ${analysisProvenance.detail}`}><Badge tone={analysisProvenance.source === "calculated-in-studio" ? "sage" : "info"}>{analysisProvenance.label}</Badge></span> : null}<Badge>{dataset.rows.length} {plotType === "pca" ? "observations" : "rows"}</Badge><Badge tone={isValid ? "success" : "danger"}>{isValid ? "Ready" : "Check data"}</Badge><span className="mx-0.5 h-5 w-px bg-hairline max-sm:hidden" aria-hidden /><Button size="sm" onClick={exportSvg} disabled={!isValid}><Download className="h-3.5 w-3.5" aria-hidden />SVG</Button><Button size="sm" onClick={exportPng} disabled={!isValid} title="Export PNG at 600 dpi"><ImageIcon className="h-3.5 w-3.5" aria-hidden />PNG</Button><Button size="sm" onClick={exportConfig}><FileJson className="h-3.5 w-3.5" aria-hidden />Config</Button></div>} />
            <CardBody className="p-3 sm:p-4">
              <p className="mb-3 text-xs leading-5 text-muted">{definition.summary}</p>
              {validation.errors.length > 0 ? (
                <div className="rounded-[9px] border border-error/25 bg-error-surface px-3 py-2 text-xs leading-5 text-error">
                  {validation.errors.map((error) => <p key={error}>• {error}</p>)}
                </div>
              ) : (
                <div className="overflow-auto rounded-[8px] border border-[var(--ln-vis-panel-border)] bg-[var(--ln-vis-canvas-bg)] p-2 sm:p-3">
                  <div className="mx-auto w-fit min-w-max max-w-none rounded-[4px] bg-white shadow-[0_1px_6px_rgba(35,36,42,0.08)]">
                    <ScientificChartPreview svgRef={svgRef} type={plotType} dataset={displayDataset} mapping={displayMapping} settings={previewSettings} themeId={themeId} />
                  </div>
                </div>
              )}
              {validation.warnings.length > 0 ? <div className="mt-3 rounded-[8px] border border-warning/20 bg-warning-surface px-3 py-2 text-xs leading-5 text-warning">{validation.warnings.join(" · ")}</div> : null}
              {plotType === "bar" && isValid && barAnalysis?.results.length ? <details className="mt-3 overflow-hidden rounded-[8px] border border-hairline bg-white">
                <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-semibold text-ink"><span>Statistical results · {barAnalysis.results.length} comparison{barAnalysis.results.length === 1 ? "" : "s"}</span><Button type="button" size="sm" onClick={(event) => { event.preventDefault(); downloadBarAnalysis(); }}><Download className="h-3.5 w-3.5" aria-hidden />TSV</Button></summary>
                <div className="overflow-x-auto border-t border-hairline"><table className="min-w-full text-left text-[11px] text-graphite"><thead className="bg-stone text-[10px] uppercase tracking-[0.04em] text-muted"><tr><th className="px-3 py-2">Group</th><th className="px-3 py-2">Comparison</th><th className="px-3 py-2">Difference (95% CI)</th><th className="px-3 py-2">n</th><th className="px-3 py-2">P raw</th><th className="px-3 py-2">P adjusted</th><th className="px-3 py-2">Method / scale</th></tr></thead><tbody>{barAnalysis.results.map((result) => <tr key={`${result.facet}-${result.group}-${result.reference}-${result.comparison}`} className="border-t border-hairline first:border-t-0"><td className="whitespace-nowrap px-3 py-2">{result.group}</td><td className="whitespace-nowrap px-3 py-2">{result.comparison} vs {result.reference}</td><td className="whitespace-nowrap px-3 py-2 font-mono">{result.difference.toPrecision(4)} ({result.lower95.toPrecision(4)}, {result.upper95.toPrecision(4)})</td><td className="whitespace-nowrap px-3 py-2">{result.nComparison} / {result.nReference}</td><td className="whitespace-nowrap px-3 py-2 font-mono">{result.rawPValue.toPrecision(3)}</td><td className="whitespace-nowrap px-3 py-2 font-mono">{result.adjustedPValue.toPrecision(3)}</td><td className="whitespace-nowrap px-3 py-2">{result.method} · {result.analysisScale}</td></tr>)}</tbody></table></div>
              </details> : null}
            </CardBody>
          </Card>
          </div>

          <Card className="overflow-hidden rounded-[var(--ln-vis-panel-radius)] border-[var(--ln-vis-panel-border)] shadow-none">
            <CardHeader
              className="h-12"
              title="Data & mapping"
              action={(
                <div className="flex flex-wrap justify-end gap-2">
                  <input ref={fileRef} type="file" accept=".tsv,.csv,.txt,.xls,.xlsx,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={loadFile} />
                  <Button size="sm" onClick={() => fileRef.current?.click()}><Upload className="h-3.5 w-3.5" aria-hidden />Upload</Button>
                  <Button size="sm" onClick={downloadInputTemplate} title="Download input data template"><Download className="h-3.5 w-3.5" aria-hidden />Template</Button>
                </div>
              )}
            />
            <CardBody className="grid items-start gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.56fr)] sm:p-4">
              <div className="grid content-start gap-2 text-xs text-graphite">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <span>{plotType === "pca" ? (pcaInputMode === "matrix" ? "Feature matrix" : "PCA coordinates") : "CSV or TSV data"}</span>
                  <div className="flex flex-wrap gap-1.5" aria-label="Example data">
                    {dataExamples.map((example, exampleIndex) => (
                      <button
                        key={`${definition.id}-${example.label}`}
                        type="button"
                        title={example.description}
                        onClick={() => applyDataExample(exampleIndex)}
                        className={cn(
                          "focus-ring h-7 rounded-[7px] border px-2 text-[11px] font-medium transition",
                          selectedExampleIndex === exampleIndex ? "border-moss bg-sage-surface text-ink" : "border-hairline bg-white text-graphite hover:border-border-strong",
                        )}
                      >
                        {example.label}
                      </button>
                    ))}
                  </div>
                </div>
                {rawData.length > 500_000 ? (
                  <div className="min-h-44 overflow-hidden rounded-[8px] border border-hairline bg-[#FBFBF9] p-3">
                    <p className="font-medium text-ink">{loadedFileName || "Large matrix"} loaded locally</p>
                    <p className="mt-1 text-[11px] text-muted">{(rawData.length / 1_048_576).toFixed(1)} MB · the full text is not rendered here to keep the browser responsive.</p>
                    <pre className="mt-3 max-h-40 overflow-hidden whitespace-pre-wrap font-mono text-[10px] leading-4 text-graphite">{rawData.slice(0, 8_000)}</pre>
                  </div>
                ) : <textarea aria-label={plotType === "pca" ? (pcaInputMode === "matrix" ? "Feature matrix" : "PCA coordinates") : "CSV or TSV data"} value={rawData} onChange={(event) => { setRawData(event.target.value); setSelectedExampleIndex(-1); setLoadedFileName(""); }} spellCheck={false} className="focus-ring min-h-44 resize-y rounded-[8px] border border-hairline bg-[#FBFBF9] p-3 font-mono text-[11px] leading-5 text-ink" />}
                {plotType === "pca" && pcaInputMode === "matrix" ? <div className="grid gap-1.5"><span className="flex items-center justify-between gap-2"><label htmlFor="pca-observation-metadata">Observation metadata <span className="font-normal text-muted">(optional; exact sample-ID join)</span></label><button type="button" onClick={downloadPcaMetadataTemplate} className="focus-ring rounded px-1.5 py-1 text-[11px] font-medium text-moss hover:bg-sage-surface">Metadata template</button></span><textarea id="pca-observation-metadata" aria-label="PCA observation metadata" value={pcaObservationMetadata} onChange={(event) => { setPcaObservationMetadata(event.target.value); setSelectedExampleIndex(-1); }} spellCheck={false} placeholder={'sample\tgroup\tbatch\tlabel\nSample_1\tControl\tBatch 1\tS1'} className="focus-ring min-h-28 resize-y rounded-[8px] border border-hairline bg-[#FBFBF9] p-3 font-mono text-[11px] leading-5 text-ink" /><span className="text-[11px] leading-4 text-muted">The first column must match matrix observation names after removing _count, _counts, _tpm, or _fpkm. Duplicate or missing IDs block export.</span></div> : null}
                {fileError ? <span className="text-error">{fileError}</span> : null}
              </div>
              <div className="space-y-2.5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-graphite">{plotType === "pca" ? "PCA input" : "Column mapping"}</p>
                    {(plotType !== "pca" || pcaInputMode === "scores") && definition.roles.length > 0 ? <Button size="sm" variant="ghost" onClick={() => setMapping(inferPlotMapping(definition, dataset.headers))}>Auto-map</Button> : null}
                  </div>
                  <p className="mt-1 text-[11px] leading-4 text-muted">{definition.inputHint}</p>
                </div>
                {plotType === "pca" ? <div className="grid grid-cols-2 gap-1 rounded-[8px] border border-hairline bg-stone p-1" aria-label="PCA input mode">
                  <button type="button" aria-pressed={pcaInputMode === "scores"} onClick={() => selectPcaInputMode("scores")} className={cn("focus-ring rounded-[6px] px-2 py-2 text-[11px] font-medium", pcaInputMode === "scores" ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink")}>Supplied coordinates</button>
                  <button type="button" aria-pressed={pcaInputMode === "matrix"} onClick={() => selectPcaInputMode("matrix")} className={cn("focus-ring rounded-[6px] px-2 py-2 text-[11px] font-medium", pcaInputMode === "matrix" ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink")}>Calculate from matrix</button>
                </div> : null}
                {plotType === "pca" && pcaAnalysis ? <>
                  <SelectControl label="Data layer" value={pcaOptions.dataLayer} onChange={(value) => setPcaOptions((current) => ({ ...current, dataLayer: value as PcaDataLayer }))}>
                    <option value="auto">Auto by explicit suffix; otherwise normalized</option>
                    <option value="counts">Count matrix → log₂(CPM + 1)</option>
                    <option value="abundance">Non-negative abundance → log₂(x + 1)</option>
                    <option value="normalized">Continuous / already normalized</option>
                  </SelectControl>
                  <SelectControl label="Top variable features" value={String(pcaOptions.topVariableFeatures)} onChange={(value) => setPcaOptions((current) => ({ ...current, topVariableFeatures: Number(value) }))}>
                    <option value="500">500</option><option value="1000">1,000</option><option value="2000">2,000</option><option value="5000">5,000</option><option value="10000">10,000</option><option value="0">All variable features</option>
                  </SelectControl>
                  <ToggleControl label="Scale each feature to unit variance" checked={pcaOptions.scaleFeatures} onChange={(value) => setPcaOptions((current) => ({ ...current, scaleFeatures: value }))} />
                  <SelectControl label="X component" value={mapping.x} onChange={(value) => setMapping((current) => ({ ...current, x: value }))}>
                    {dataset.headers.filter((header) => /^PC\d+$/.test(header)).map((header) => <option key={header} value={header}>{pcaAxisLabel(header, pcaAnalysis.explainedVariance)}</option>)}
                  </SelectControl>
                  <SelectControl label="Y component" value={mapping.y} onChange={(value) => setMapping((current) => ({ ...current, y: value }))}>
                    {dataset.headers.filter((header) => /^PC\d+$/.test(header)).map((header) => <option key={header} value={header}>{pcaAxisLabel(header, pcaAnalysis.explainedVariance)}</option>)}
                  </SelectControl>
                  {settings.ordinationView === "3d" ? <SelectControl label="Z component" value={mapping.z} onChange={(value) => setMapping((current) => ({ ...current, z: value }))}>
                    {dataset.headers.filter((header) => /^PC\d+$/.test(header)).map((header) => <option key={header} value={header}>{pcaAxisLabel(header, pcaAnalysis.explainedVariance)}</option>)}
                  </SelectControl> : null}
                  <SelectControl label="Color group" value={mapping.group} onChange={(value) => setMapping((current) => ({ ...current, group: value }))}><option value="">None</option>{dataset.headers.map((header) => <option key={header} value={header}>{header}</option>)}</SelectControl>
                  <SelectControl label="Shape group" value={mapping.shape} onChange={(value) => setMapping((current) => ({ ...current, shape: value }))}><option value="">None</option>{dataset.headers.map((header) => <option key={header} value={header}>{header}</option>)}</SelectControl>
                  <SelectControl label="Observation label" value={mapping.label} onChange={(value) => setMapping((current) => ({ ...current, label: value }))}><option value="">None</option>{dataset.headers.map((header) => <option key={header} value={header}>{header}</option>)}</SelectControl>
                  <div className="rounded-[8px] border border-hairline px-3 py-2 text-[11px] leading-5 text-muted">
                    <p>{pcaAnalysis.sampleColumns.length} observations · {pcaAnalysis.featuresUsed.toLocaleString()} used / {pcaAnalysis.featuresVariable.toLocaleString()} variable / {pcaAnalysis.featuresComplete.toLocaleString()} complete / {pcaAnalysis.featuresRead.toLocaleString()} input features</p>
                    <p>{pcaAnalysis.transformation || "Waiting for a valid feature matrix."}</p>
                    <p>{pcaAnalysis.groups.length} displayed group{pcaAnalysis.groups.length === 1 ? "" : "s"}: {pcaAnalysis.groups.join(" · ") || "—"}{pcaObservationMetadata.trim() ? " · exact-ID metadata" : " · inferred from delimited replicate suffixes"}</p>
                    {pcaAnalysis.availableLayers.length > 1 ? <p>Detected layers: {pcaAnalysis.availableLayers.map((layer) => `${layer.label} (${layer.columns})`).join(" · ")}</p> : null}
                  </div>
                </> : visibleRoles.length === 0 ? <p className="rounded-[8px] bg-stone px-3 py-2 text-xs leading-5 text-graphite">The first column supplies row labels; all remaining columns form the numeric matrix.</p> : <>{visibleRoles.map((role) => (
                  <SelectControl key={role.key} label={`${mappingRoleLabel(plotType, role, settings.swapAxes || ["horizontal", "bullet", "pyramid"].includes(settings.barVariant))}${role.required ? " *" : ""}`} value={mapping[role.key] ?? ""} onChange={(value) => setMapping((current) => ({ ...current, [role.key]: value }))}>
                    <option value="">{role.required ? "Select column" : "None"}</option>
                    {dataset.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                  </SelectControl>
                ))}{plotType === "pca" ? <p className="rounded-[8px] bg-sage-surface px-3 py-2 text-[11px] leading-4 text-graphite">Studio renders the supplied coordinates without recomputing PCA. Add explained variance to the X/Y axis labels when it is available from the upstream workflow.</p> : null}</>}
                <div className="rounded-[8px] border border-hairline px-3 py-2 text-[11px] leading-5 text-muted">
                  <p>{dataset.headers.length} columns · {dataset.rows.length} {plotType === "pca" ? "PCA observations" : "data rows"} · {dataset.delimiter === "tab" ? "TSV" : "CSV"}</p>
                  <p>Input stays in your browser; exports include a reproducible parameter file.</p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        <div data-visualization-panel="parameters" className="flex min-h-0 flex-col gap-[var(--ln-vis-panel-gap)] overflow-hidden xl:sticky xl:top-[var(--visualization-panel-top)] xl:h-[var(--visualization-panel-height)]">
          <Card className="min-h-0 rounded-[var(--ln-vis-panel-radius)] border-[var(--ln-vis-panel-border)] shadow-none xl:flex xl:flex-1 xl:flex-col">
            <CardHeader className="h-12 shrink-0" title="Figure parameters" action={<Button size="sm" variant="ghost" onClick={() => {
              const resetSettings = settingsForTheme(themeId);
              const plotResetSettings = plotType === "rose" ? { ...resetSettings, compositionLabelMode: "value" as const } : resetSettings;
              setSettings(settingsForDistributionPreset(plotResetSettings, plotType));
            }}><RotateCcw className="h-3.5 w-3.5" aria-hidden />Reset</Button>} />
            <CardBody ref={parameterScrollRef} className="space-y-4 p-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:[scrollbar-gutter:stable]">
              <ControlGroup title="Labels">
                <TextControl label="Title" value={settings.title} onChange={(value) => updateSetting("title", value)} placeholder={`${definition.name} title`} />
              {hasSetting("xLabel") ? <TextControl label="X-axis label" value={settings.xLabel} onChange={(value) => updateSetting("xLabel", value)} /> : null}
              {hasSetting("yLabel") ? <TextControl label="Y-axis label" value={settings.yLabel} onChange={(value) => updateSetting("yLabel", value)} /> : null}
              {manualAxes.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {manualAxes.includes("x") ? <><OptionalNumberControl label="X minimum" value={settings.xMin} invalid={invalidXLimits} describedBy="x-axis-limit-error" onChange={(value) => updateSetting("xMin", value)} /><OptionalNumberControl label="X maximum" value={settings.xMax} invalid={invalidXLimits} describedBy="x-axis-limit-error" onChange={(value) => updateSetting("xMax", value)} /></> : null}
                  {manualAxes.includes("y") ? <><OptionalNumberControl label="Y minimum" value={settings.yMin} invalid={invalidYLimits} describedBy="y-axis-limit-error" onChange={(value) => updateSetting("yMin", value)} /><OptionalNumberControl label="Y maximum" value={settings.yMax} invalid={invalidYLimits} describedBy="y-axis-limit-error" onChange={(value) => updateSetting("yMax", value)} /></> : null}
                  {invalidXLimits ? <p id="x-axis-limit-error" className="col-span-2 text-[11px] leading-4 text-error">X minimum must be smaller than X maximum.</p> : null}
                  {invalidYLimits ? <p id="y-axis-limit-error" className="col-span-2 text-[11px] leading-4 text-error">Y minimum must be smaller than Y maximum.</p> : null}
                  <p className="col-span-2 text-[11px] leading-4 text-muted">Leave blank for data-aware automatic limits. Clipped mapped values are reported below the preview.</p>
                </div>
              ) : null}
              </ControlGroup>

            <ControlGroup title="Compact layout">
              <RangeControl label="Width" value={settings.width} minimum={300} maximum={1600} step={10} unit=" px" onChange={(value) => updateSetting("width", value)} />
              <RangeControl label="Height" value={settings.height} minimum={280} maximum={1200} step={10} unit=" px" onChange={(value) => updateSetting("height", value)} />
              <RangeControl label="Title size" value={settings.titleSize} minimum={13} maximum={26} unit=" pt" onChange={(value) => updateSetting("titleSize", value)} />
              {hasSetting("axisLabelSize") ? <RangeControl label="Axis label size" value={settings.axisLabelSize} minimum={10} maximum={20} unit=" pt" onChange={(value) => updateSetting("axisLabelSize", value)} /> : null}
              {hasSetting("tickSize") ? <RangeControl label="Tick size" value={settings.tickSize} minimum={9} maximum={16} unit=" pt" onChange={(value) => updateSetting("tickSize", value)} /> : null}
              {hasSetting("legendSize") ? <RangeControl label="Legend size" value={settings.legendSize} minimum={9} maximum={16} unit=" pt" onChange={(value) => updateSetting("legendSize", value)} /> : null}
            </ControlGroup>

            {(["axisLineWidth", "gridLineWidth", "dataLineWidth", "pointSize", "opacity", "grid", "legendPosition", "swapAxes", "showTrend", "showLabels", "showPoints", "showSampleSize"] as Array<keyof VisualizationSettings>).some(hasSetting) ? <ControlGroup title="Marks & axes">
              {hasSetting("axisLineWidth") ? <RangeControl label="Axis line" value={settings.axisLineWidth} minimum={0.8} maximum={3} step={0.1} unit=" px" onChange={(value) => updateSetting("axisLineWidth", value)} /> : null}
              {hasSetting("gridLineWidth") ? <RangeControl label="Grid line" value={settings.gridLineWidth} minimum={0.4} maximum={2} step={0.1} unit=" px" onChange={(value) => updateSetting("gridLineWidth", value)} /> : null}
              {hasSetting("dataLineWidth") ? <RangeControl label="Data line" value={settings.dataLineWidth} minimum={1} maximum={5} step={0.1} unit=" px" onChange={(value) => updateSetting("dataLineWidth", value)} /> : null}
              {hasSetting("pointSize") ? <RangeControl label="Point size" value={settings.pointSize} minimum={2} maximum={12} step={0.5} unit=" px" onChange={(value) => updateSetting("pointSize", value)} /> : null}
              {hasSetting("opacity") ? <RangeControl label="Opacity" value={settings.opacity} minimum={0.25} maximum={1} step={0.05} onChange={(value) => updateSetting("opacity", value)} /> : null}
              {hasSetting("grid") ? <SelectControl label="Grid" value={settings.grid} onChange={(value) => updateSetting("grid", value as VisualizationSettings["grid"])}><option value="none">None</option><option value="y">Horizontal only</option><option value="both">Both axes</option></SelectControl> : null}
              {hasSetting("legendPosition") && !((plotType === "scatter" || plotType === "correlation") && ["density", "hexbin"].includes(settings.associationVariant)) ? <SelectControl label="Legend" value={settings.legendPosition} onChange={(value) => updateSetting("legendPosition", value as VisualizationSettings["legendPosition"])}><option value="right">Right</option>{plotType !== "enrichment" && plotType !== "enrichment-bar" ? <option value="bottom">Bottom</option> : null}<option value="none">Hidden</option></SelectControl> : null}
              {(plotType === "line" || (plotType === "pca" && settings.ordinationView === "scores") || ((plotType === "scatter" || plotType === "correlation") && !["pair-matrix", "3d", "ternary"].includes(settings.associationVariant)) || (plotType === "bar" && !["horizontal", "bullet", "pyramid", "dual-axis", "overlay", "polar", "faceted"].includes(settings.barVariant))) ? <ToggleControl label="Swap axes" checked={settings.swapAxes} onChange={(value) => updateSetting("swapAxes", value)} /> : null}
              {(plotType === "scatter" || plotType === "correlation") && ["points", "marginal", "ellipse", "hull"].includes(settings.associationVariant) ? <ToggleControl label="Point labels" checked={settings.showLabels} onChange={(value) => updateSetting("showLabels", value)} /> : null}
              {(["pca", "pcoa", "umap", "tsne", "nmds", "quadrant"] as PlotType[]).includes(plotType) ? <ToggleControl label="Point labels" checked={settings.showLabels} onChange={(value) => updateSetting("showLabels", value)} /> : null}
              {(["go-circle", "kegg-circle", "go-chord", "pathway-impact", "sankey-bubble", "geographic-map", "petal"] as PlotType[]).includes(plotType) ? <ToggleControl label="Labels" checked={settings.showLabels} onChange={(value) => updateSetting("showLabels", value)} /> : null}
            </ControlGroup> : null}

            {(plotType === "venn" || plotType === "upset") ? <ControlGroup title="Set intersections">
              <SelectControl label="Input structure" value={settings.setInputMode} onChange={(value) => { updateSetting("setInputMode", value as VisualizationSettings["setInputMode"]); setSelectedIntersectionSignature(""); }}><option value="auto">Auto detect</option><option value="membership">Item–set membership</option><option value="peak-overlap">Genomic peak overlap</option></SelectControl>
              {plotType === "venn" ? <><SelectControl label="Diagram layout" value={settings.vennLayout} onChange={(value) => updateSetting("vennLayout", value as VisualizationSettings["vennLayout"])}><option value="auto">Auto · circles / radial index</option><option value="classic">Classic circles · 2–3 sets</option><option value="radial">Radial exact intersections · 2–7 sets</option></SelectControl><ToggleControl label="Size-weighted visual cue" checked={settings.vennProportional} onChange={(value) => updateSetting("vennProportional", value)} /></> : <RangeControl label="Displayed intersections" value={settings.upsetMaxIntersections} minimum={3} maximum={30} step={1} onChange={(value) => updateSetting("upsetMaxIntersections", value)} />}
              {setAnalysis && setAnalysis.intersections.length > 0 ? <><SelectControl label="Exact intersection to download" value={selectedSetIntersection?.signature ?? ""} onChange={setSelectedIntersectionSignature}>{setAnalysis.intersections.map((entry) => <option key={entry.signature} value={entry.signature}>{entry.sets.join(" ∩ ")} · n={entry.size}</option>)}</SelectControl><Button type="button" variant="secondary" size="sm" className="w-full justify-center" onClick={downloadSelectedIntersection}><Download className="h-3.5 w-3.5" aria-hidden />Download selected members</Button></> : null}
              <p className="rounded-[8px] bg-stone px-3 py-2 text-[11px] leading-4 text-graphite">Counts are exact membership combinations. Peak mode splits half-open intervals [start, end) into disjoint atomic genomic segments wherever active set membership changes; counts are segments, not base pairs or original peaks. Size weighting is only a visual cue, never an area-proportional fit.</p>
            </ControlGroup> : null}

            {plotType === "roc" ? <ControlGroup title="ROC input">
              <SelectControl label="Input structure" value={settings.rocInputMode} onChange={(value) => updateSetting("rocInputMode", value as VisualizationSettings["rocInputMode"])}><option value="raw">Raw binary outcomes + scores</option><option value="precomputed-time">Time-dependent coordinates + 95% CI</option></SelectControl>
              <p className="rounded-[8px] bg-stone px-3 py-2 text-[11px] leading-4 text-graphite">Raw mode computes empirical ROC and trapezoidal AUC per model. Time-dependent mode only displays censoring-aware coordinates, pointwise TPR intervals, horizons, and AUC intervals supplied by a documented upstream method; it never infers them from ordinary binary scores.</p>
            </ControlGroup> : null}

            {plotType === "calibration" ? <ControlGroup title="Calibration grouping"><RangeControl label="Equal-frequency bins" value={settings.calibrationBinCount} minimum={3} maximum={15} step={1} onChange={(value) => updateSetting("calibrationBinCount", value)} /><p className="rounded-[8px] bg-stone px-3 py-2 text-[11px] leading-4 text-graphite">Subjects are sorted by predicted probability and divided into approximately equal-frequency bins separately for each model. Fewer bins are more stable in small cohorts.</p></ControlGroup> : null}

            {plotType === "decision-curve" ? <ControlGroup title="Decision thresholds"><RangeControl label="Minimum threshold" value={settings.decisionThresholdMinimum} minimum={0.005} maximum={0.5} step={0.005} onChange={(value) => updateSetting("decisionThresholdMinimum", value)} /><RangeControl label="Maximum threshold" value={settings.decisionThresholdMaximum} minimum={0.05} maximum={0.99} step={0.01} onChange={(value) => updateSetting("decisionThresholdMaximum", value)} /><RangeControl label="Grid resolution" value={settings.decisionThresholdStep} minimum={0.005} maximum={0.05} step={0.005} onChange={(value) => updateSetting("decisionThresholdStep", value)} /><p className="rounded-[8px] bg-stone px-3 py-2 text-[11px] leading-4 text-graphite">Net benefit is evaluated only on the displayed threshold grid. Choose a clinically meaningful interval; a grid step ≤0.01 is recommended when narrow utility regions matter.</p></ControlGroup> : null}

            {plotType === "line" || (plotType === "bar" && !["stacked", "percentage", "polar"].includes(settings.barVariant)) ? <ControlGroup title={`${plotType === "bar" ? "Bar" : "Line"} uncertainty`}>
              <SelectControl label="Error representation" value={plotType === "bar" ? settings.barErrorType : settings.lineErrorType} onChange={(value) => selectErrorType(plotType === "bar" ? "barErrorType" : "lineErrorType", value as VisualizationSettings["barErrorType"] | VisualizationSettings["lineErrorType"])}><option value="none">None</option><option value="sd">Mean ± SD</option><option value="sem">Mean ± SEM</option>{plotType === "line" ? <option value="ci95">95% CI half-width</option> : null}</SelectControl>
              {(plotType === "bar" ? settings.barErrorType : settings.lineErrorType) !== "none" ? <>{plotType === "line" ? <SelectControl label="Display style" value={settings.lineUncertaintyStyle} onChange={(value) => updateSetting("lineUncertaintyStyle", value as VisualizationSettings["lineUncertaintyStyle"])}><option value="bars">Pointwise bars</option><option value="band">Ribbon</option></SelectControl> : null}{plotType === "line" && settings.lineUncertaintyStyle === "band" ? <RangeControl label="Ribbon opacity" value={settings.lineBandOpacity} minimum={0.04} maximum={0.5} step={0.01} onChange={(value) => updateSetting("lineBandOpacity", value)} /> : <><RangeControl label="Error line" value={settings.errorBarLineWidth} minimum={0.8} maximum={3} step={0.1} unit=" px" onChange={(value) => updateSetting("errorBarLineWidth", value)} /><RangeControl label="Cap width" value={settings.errorBarCapSize} minimum={4} maximum={30} step={1} unit=" px" onChange={(value) => updateSetting("errorBarCapSize", value)} /></>}<p className="rounded-[8px] bg-stone px-3 py-2 text-[11px] leading-4 text-graphite">Map an already-calculated non-negative half-width. SD describes spread, SEM describes mean precision, and a 95% CI half-width describes an interval around the estimate. A ribbon changes only the display, not the statistic.</p></> : null}
            </ControlGroup> : null}

            {plotType === "bar" ? <>
              <ControlGroup title="Categorical design">
                <SelectControl label="Variant" value={settings.barVariant} onChange={(value) => selectBarVariant(value as VisualizationSettings["barVariant"])}>
                  <option value="grouped">Grouped</option><option value="stacked">Stacked</option><option value="percentage">100% stacked</option><option value="horizontal">Horizontal</option><option value="bidirectional">Bidirectional</option><option value="faceted">Faceted</option><option value="polar">Polar bars</option><option value="bullet">Bullet</option><option value="pyramid">Pyramid</option><option value="axis-break">Axis break</option><option value="dual-axis">Dual axis</option><option value="overlay">Bar + overlay</option>
                </SelectControl>
                <SelectControl label="Input structure" value={settings.barInputMode} onChange={(value) => updateSetting("barInputMode", value as VisualizationSettings["barInputMode"])}><option value="summary">Summary values</option><option value="long">Long-form observations</option></SelectControl>
                <RangeControl label={settings.barVariant === "polar" ? "Angular gap" : "Gap"} value={settings.barGap} minimum={0.04} maximum={0.5} step={0.01} onChange={(value) => updateSetting("barGap", value)} />
                {["dual-axis", "overlay"].includes(settings.barVariant) ? <SelectControl label="Secondary mark" value={settings.barOverlayType} onChange={(value) => updateSetting("barOverlayType", value as VisualizationSettings["barOverlayType"])}><option value="line">Line + points</option><option value="points">Points only</option></SelectControl> : null}
                {settings.barVariant === "dual-axis" ? <TextControl label="Secondary axis label" value={settings.secondaryAxisLabel} onChange={(value) => updateSetting("secondaryAxisLabel", value)} placeholder="Secondary value (unit)" /> : null}
                {settings.barVariant === "dual-axis" ? <p className="rounded-[8px] bg-stone px-3 py-2 text-[11px] leading-4 text-graphite">The secondary column uses an independently labelled right-side scale. Use only when the two units are explicit and a shared baseline would be misleading.</p> : null}
                {settings.barVariant === "overlay" ? <p className="rounded-[8px] bg-stone px-3 py-2 text-[11px] leading-4 text-graphite">The secondary column shares the primary value axis and should use the same unit.</p> : null}
                {settings.barVariant === "axis-break" ? <><RangeControl label="Break start" value={settings.axisBreakStart} minimum={barBreakRange.minimum} maximum={barBreakRange.maximum} step={barBreakRange.step} onChange={(value) => updateSetting("axisBreakStart", value)} /><RangeControl label="Break end" value={settings.axisBreakEnd} minimum={barBreakRange.minimum} maximum={barBreakRange.maximum} step={barBreakRange.step} onChange={(value) => updateSetting("axisBreakEnd", value)} /></> : null}
              </ControlGroup>
              {settings.barVariant !== "polar" ? <ControlGroup title="Statistical analysis">
                <SelectControl label="Analysis source / design" value={settings.barAnalysisMode} onChange={(value) => selectBarAnalysisMode(value as VisualizationSettings["barAnalysisMode"])}>
                  <option value="none">Visualization only · no P values</option><option value="supplied">Display supplied P values</option><option value="raw-independent">Raw independent observations · Welch</option><option value="summary-independent">Mean + SD/SEM + n · Welch</option><option value="raw-paired">Raw matched observations · paired t</option><option value="qpcr-delta-ct">qPCR · display relative expression, test ΔCt</option>
                </SelectControl>
                {!["none", "supplied"].includes(settings.barAnalysisMode) ? <><SelectControl label="Reference category" value={settings.barReferenceCategory || barCategoryOptions[0] || ""} onChange={(value) => updateSetting("barReferenceCategory", value)}>{barCategoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</SelectControl><SelectControl label="Multiple-testing correction" value={settings.barPAdjustment} onChange={(value) => updateSetting("barPAdjustment", value as VisualizationSettings["barPAdjustment"])}><option value="bh">Benjamini–Hochberg FDR</option><option value="holm">Holm family-wise correction</option><option value="none">None</option></SelectControl></> : null}
                {settings.barAnalysisMode !== "none" ? <ToggleControl label="Significance annotations" checked={settings.showSignificance} onChange={(value) => updateSetting("showSignificance", value)} /> : null}
                {settings.showSignificance ? <RangeControl label={settings.barPAdjustment === "none" || settings.barAnalysisMode === "supplied" ? "P-value threshold" : "Adjusted P threshold"} value={settings.significanceThreshold} minimum={0.001} maximum={0.1} step={0.001} onChange={(value) => updateSetting("significanceThreshold", value)} /> : null}
                <p className="rounded-[8px] bg-stone px-3 py-2 text-[11px] leading-4 text-graphite">Independent modes use two-sided Welch t-tests within each group/facet. Summary inference requires explicit integer n ≥ 2 and SD or SEM; n is never inferred. Paired mode requires the same subject IDs in both categories. qPCR displays relative expression but tests biological-replicate ΔCt. Technical replicates must be aggregated before import.</p>
              </ControlGroup> : null}
              {settings.barVariant !== "polar" ? <ControlGroup title="Bar appearance"><RangeControl label="Border width" value={settings.barBorderWidth} minimum={0} maximum={3} step={0.1} unit=" px" onChange={(value) => updateSetting("barBorderWidth", value)} />{settings.barBorderWidth > 0 ? <ColorControl label="Border color" value={settings.barBorderColor} onChange={(value) => updateSetting("barBorderColor", value)} /> : null}<p className="text-[11px] leading-4 text-muted">Set the width to 0 for borderless bars. The outline remains fully opaque so it stays legible when fill opacity is reduced.</p></ControlGroup> : null}
            </> : null}

            {distributionPlotTypes.includes(plotType) ? <ControlGroup title="Distribution layers">
              <SelectControl label="Orientation" value={settings.distributionOrientation} onChange={(value) => updateSetting("distributionOrientation", value as VisualizationSettings["distributionOrientation"])}><option value="vertical">Vertical values</option><option value="horizontal">Horizontal values</option></SelectControl>
              <ToggleControl label="Density" checked={settings.showDensity} onChange={(value) => updateSetting("showDensity", value)} />
              <ToggleControl label="Histogram" checked={settings.showHistogram} onChange={(value) => updateSetting("showHistogram", value)} />
              <ToggleControl label="Box & whiskers" checked={settings.showBox} onChange={(value) => updateSetting("showBox", value)} />
              <ToggleControl label="Raw observations" checked={settings.showPoints} onChange={(value) => updateSetting("showPoints", value)} />
              <SelectControl label="Center summary" value={settings.distributionSummary} onChange={(value) => updateSetting("distributionSummary", value as VisualizationSettings["distributionSummary"])}><option value="none">Hidden</option><option value="median">Median</option><option value="mean">Mean</option></SelectControl>
              <SelectControl label="Uncertainty" value={settings.boxErrorType} onChange={(value) => updateSetting("boxErrorType", value as VisualizationSettings["boxErrorType"])}><option value="none">Hidden</option><option value="sd">Mean ± SD</option><option value="sem">Mean ± SEM</option><option value="ci95">Mean 95% CI</option></SelectControl>
              <ToggleControl label="Paired lines" checked={settings.distributionShowPairedLines} onChange={(value) => updateSetting("distributionShowPairedLines", value)} />
              <ToggleControl label="Supplied P-value labels" checked={settings.distributionShowSignificance} onChange={(value) => updateSetting("distributionShowSignificance", value)} />
              <ToggleControl label="Sample size" checked={settings.showSampleSize} onChange={(value) => updateSetting("showSampleSize", value)} />
              {settings.showHistogram ? <RangeControl label="Histogram bins" value={settings.histogramBins} minimum={3} maximum={30} step={1} onChange={(value) => updateSetting("histogramBins", value)} /> : null}
              {settings.showDensity ? <><RangeControl label="Bandwidth" value={settings.violinBandwidth} minimum={0.5} maximum={2.5} step={0.05} unit="×" onChange={(value) => updateSetting("violinBandwidth", value)} /><RangeControl label="Density width" value={settings.violinWidth} minimum={0.18} maximum={0.46} step={0.01} onChange={(value) => updateSetting("violinWidth", value)} /></> : null}
              {settings.boxErrorType !== "none" ? <><RangeControl label="Uncertainty line" value={settings.errorBarLineWidth} minimum={0.8} maximum={3} step={0.1} unit=" px" onChange={(value) => updateSetting("errorBarLineWidth", value)} /><RangeControl label="Cap width" value={settings.errorBarCapSize} minimum={4} maximum={30} step={1} unit=" px" onChange={(value) => updateSetting("errorBarCapSize", value)} /></> : null}
              {settings.distributionShowSignificance ? <RangeControl label="P-value threshold" value={settings.significanceThreshold} minimum={0.001} maximum={0.1} step={0.001} onChange={(value) => updateSetting("significanceThreshold", value)} /> : null}
              <p className="rounded-[8px] bg-stone px-3 py-2 text-[11px] leading-4 text-graphite">SD describes sample spread, SEM describes mean precision, and the 95% CI uses a two-sided Student t interval. Paired lines require a subject ID. P-value labels display mapped results only; this tool does not choose or run a significance test.</p>
            </ControlGroup> : null}

            {plotType === "volcano" || plotType === "ma" ? <ControlGroup title={`${plotType === "volcano" ? "Volcano" : "MA"} thresholds`}><RangeControl label="|log₂FC| threshold" value={settings.foldChangeThreshold} minimum={0} maximum={5} step={0.1} onChange={(value) => updateSetting("foldChangeThreshold", value)} /><RangeControl label="Adjusted P threshold" value={settings.pValueThreshold} minimum={0.001} maximum={0.1} step={0.001} onChange={(value) => updateSetting("pValueThreshold", value)} /><RangeControl label="Maximum labels" value={settings.labelLimit} minimum={0} maximum={30} onChange={(value) => updateSetting("labelLimit", value)} /></ControlGroup> : null}
            {plotType === "scatter" || plotType === "correlation" ? <ControlGroup title="Association view">
              <SelectControl label="Variant" value={settings.associationVariant} onChange={(value) => selectAssociationVariant(value as VisualizationSettings["associationVariant"])}><option value="points">Points</option><option value="marginal">Marginal histograms</option><option value="density">2D kernel density</option><option value="hexbin">Hexbin counts</option><option value="ellipse">95% covariance ellipse</option><option value="hull">Convex hull</option><option value="pair-matrix">Three-variable pair matrix</option><option value="3d">Orthographic 3D</option><option value="ternary">Ternary composition</option></SelectControl>
              {!(["pair-matrix", "3d", "ternary"] as VisualizationSettings["associationVariant"][]).includes(settings.associationVariant) ? <><SelectControl label="Fit" value={settings.associationFit} onChange={(value) => updateSetting("associationFit", value as VisualizationSettings["associationFit"])}><option value="none">None</option><option value="linear">Linear regression</option><option value="polynomial">Polynomial regression</option><option value="loess">LOESS smoother</option></SelectControl>{settings.associationFit === "polynomial" ? <SelectControl label="Polynomial degree" value={String(settings.associationPolynomialDegree)} onChange={(value) => updateSetting("associationPolynomialDegree", Number(value) as 2 | 3)}><option value="2">Degree 2</option><option value="3">Degree 3</option></SelectControl> : null}{settings.associationFit === "loess" ? <RangeControl label="LOESS span" value={settings.associationLoessSpan} minimum={0.25} maximum={1} step={0.05} onChange={(value) => updateSetting("associationLoessSpan", value)} /> : null}{settings.associationFit === "linear" ? <ToggleControl label="Mean 95% confidence band" checked={settings.associationShowConfidenceBand} onChange={(value) => updateSetting("associationShowConfidenceBand", value)} /> : null}</> : null}
              {!(["pair-matrix", "3d", "ternary"] as VisualizationSettings["associationVariant"][]).includes(settings.associationVariant) ? <SelectControl label="Correlation method" value={settings.correlationMethod} onChange={(value) => updateSetting("correlationMethod", value as VisualizationSettings["correlationMethod"])}><option value="pearson">Pearson product-moment</option><option value="spearman">Spearman rank</option></SelectControl> : null}
              {!(["pair-matrix", "3d", "ternary"] as VisualizationSettings["associationVariant"][]).includes(settings.associationVariant) ? <><ToggleControl label="Show correlation P value" checked={settings.associationShowPValue} onChange={(value) => updateSetting("associationShowPValue", value)} />{!["density", "hexbin"].includes(settings.associationVariant) ? <SelectControl label="Group behavior" value={settings.associationGroupMode} onChange={(value) => updateSetting("associationGroupMode", value as VisualizationSettings["associationGroupMode"])}><option value="by-group">Fit/report by group</option><option value="combined">Combine all rows</option></SelectControl> : <p className="text-[11px] leading-4 text-muted">Dense bins aggregate all rows on one common intensity scale; use Points, Ellipse, or Hull to compare groups.</p>}</> : null}
              {settings.associationVariant === "hexbin" ? <RangeControl label="Hexagon size" value={settings.associationHexbinSize} minimum={7} maximum={28} step={1} unit=" px" onChange={(value) => updateSetting("associationHexbinSize", value)} /> : null}
              {settings.associationVariant === "density" ? <RangeControl label="Density bandwidth" value={settings.associationDensityBandwidth} minimum={0.45} maximum={2.5} step={0.05} unit="×" onChange={(value) => updateSetting("associationDensityBandwidth", value)} /> : null}
              <p className="rounded-[8px] bg-stone px-3 py-2 text-[11px] leading-4 text-graphite">Pearson tests linear association; Spearman tests monotonic rank association. Reported P values use a two-sided t approximation and do not adjust for multiple testing. Confidence ribbons are mean-response intervals for linear fits, not prediction intervals. Ternary rows are normalized to proportions. The 3D view independently min–max scales X, Y, and Z before a fixed-size orthographic projection; it preserves order, not cross-axis units or perspective.</p>
            </ControlGroup> : null}
            {plotType === "correlation-heatmap" ? <ControlGroup title="Correlation"><SelectControl label="Method" value={settings.correlationMethod} onChange={(value) => updateSetting("correlationMethod", value as VisualizationSettings["correlationMethod"])}><option value="pearson">Pearson</option><option value="spearman">Spearman</option></SelectControl><p className="rounded-[8px] bg-stone px-3 py-2 text-[11px] leading-4 text-graphite">Each matrix cell is calculated from paired complete observations. This view reports coefficients, not inferential P values.</p></ControlGroup> : null}
            {(["pca", "pcoa", "umap", "tsne", "nmds"] as PlotType[]).includes(plotType) ? <>
              <ControlGroup title="Ordination view">
                <SelectControl label="View" value={settings.ordinationView} onChange={(value) => updateSetting("ordinationView", value as VisualizationSettings["ordinationView"])}><option value="scores">Scores / coordinates</option>{plotType === "pca" && pcaAnalysis ? <option value="scree">Scree plot</option> : null}<option value="3d">Orthographic 3D projection</option></SelectControl>
                {settings.ordinationView === "scores" ? <><ToggleControl label="Group covariance ellipses" checked={settings.ordinationShowEllipse} onChange={(value) => updateSetting("ordinationShowEllipse", value)} /><ToggleControl label="Group convex hulls" checked={settings.ordinationShowHull} onChange={(value) => updateSetting("ordinationShowHull", value)} /><ToggleControl label="Group centroids" checked={settings.ordinationShowCentroids} onChange={(value) => updateSetting("ordinationShowCentroids", value)} />{plotType === "pca" && pcaAnalysis ? <><ToggleControl label="Feature loading arrows" checked={settings.ordinationShowLoadings} onChange={(value) => updateSetting("ordinationShowLoadings", value)} />{settings.ordinationShowLoadings ? <RangeControl label="Loading labels" value={settings.ordinationLoadingCount} minimum={1} maximum={30} step={1} onChange={(value) => updateSetting("ordinationLoadingCount", value)} /> : null}</> : null}</> : settings.ordinationView === "3d" ? <ToggleControl label="Group centroids" checked={settings.ordinationShowCentroids} onChange={(value) => updateSetting("ordinationShowCentroids", value)} /> : null}
                {settings.ordinationView !== "scree" ? <ToggleControl label="Use mapped shapes" checked={settings.ordinationUseShapes} onChange={(value) => updateSetting("ordinationUseShapes", value)} /> : null}
              <p className="rounded-[8px] bg-stone px-3 py-2 text-[11px] leading-4 text-graphite">Ellipses summarize within-group covariance; hulls only enclose observed extremes. Neither is a confidence region. The 3D view independently min–max scales each axis before a fixed orthographic projection, so cross-axis distances, angles, and apparent separation are not quantitative; manual 2D limits do not apply.</p>
              </ControlGroup>
              {settings.ordinationView !== "scree" ? <><ControlGroup title={plotType === "pca" ? "Analysis note" : "Upstream method"}>
                {plotType === "pcoa" ? <div className="grid grid-cols-2 gap-2"><OptionalNumberControl label="PCoA 1 variance (%)" value={settings.ordinationXVariance} onChange={(value) => updateSetting("ordinationXVariance", value)} /><OptionalNumberControl label="PCoA 2 variance (%)" value={settings.ordinationYVariance} onChange={(value) => updateSetting("ordinationYVariance", value)} /><OptionalNumberControl label="PCoA 3 variance (%)" value={settings.ordinationZVariance} onChange={(value) => updateSetting("ordinationZVariance", value)} /></div> : null}
                {plotType === "nmds" ? <OptionalNumberControl label="Supplied stress" value={settings.ordinationStress} onChange={(value) => updateSetting("ordinationStress", value)} /> : null}
                <TextControl label="Method note" value={settings.ordinationMethodNote} onChange={(value) => updateSetting("ordinationMethodNote", value)} placeholder={plotType === "pca" ? "PERMANOVA formula, distance, strata, and permutation scheme" : plotType === "umap" ? "seed=42; n_neighbors=15; min_dist=0.1; metric=cosine" : plotType === "tsne" ? "seed=42; perplexity=30; iterations=1000" : plotType === "nmds" ? "Bray–Curtis; k=2; 50 starts; converged" : "Bray–Curtis distance; correction=none"} />
              </ControlGroup>
              <ControlGroup title="Supplied PERMANOVA">
                <div className="grid grid-cols-2 gap-2"><OptionalNumberControl label="R²" value={settings.ordinationPermanovaR2} onChange={(value) => updateSetting("ordinationPermanovaR2", value)} /><OptionalNumberControl label="P value" value={settings.ordinationPermanovaP} onChange={(value) => updateSetting("ordinationPermanovaP", value)} /><OptionalNumberControl label="Permutations" value={settings.ordinationPermanovaPermutations} onChange={(value) => updateSetting("ordinationPermanovaPermutations", value)} /></div>
                <p className="text-[11px] leading-4 text-muted">These values are displayed exactly as supplied and are never inferred from the plotted coordinates. Report the upstream distance, grouping formula, strata/blocking, and permutation scheme in the method note.</p>
              </ControlGroup>
              </> : null}
            </> : null}
            {plotType === "manhattan" ? <ControlGroup title="Genome-wide threshold"><RangeControl label="Significance −log₁₀(P)" value={settings.genomicSignificanceLog10} minimum={1} maximum={15} step={0.1} onChange={(value) => updateSetting("genomicSignificanceLog10", value)} /><ToggleControl label="Label strongest loci" checked={settings.showLabels} onChange={(value) => updateSetting("showLabels", value)} />{settings.showLabels ? <RangeControl label="Maximum labels" value={settings.labelLimit} minimum={1} maximum={30} step={1} onChange={(value) => updateSetting("labelLimit", value)} /> : null}<p className="rounded-[8px] bg-stone px-3 py-2 text-[11px] leading-4 text-graphite">The threshold is a display reference only. Choose genome-wide significance according to the tested hypothesis family and study design; the tool does not adjust P values.</p></ControlGroup> : null}
            {plotType === "qq" ? <ControlGroup title="QQ labels"><ToggleControl label="Label strongest deviations" checked={settings.showLabels} onChange={(value) => updateSetting("showLabels", value)} />{settings.showLabels ? <RangeControl label="Maximum labels" value={settings.labelLimit} minimum={1} maximum={30} step={1} onChange={(value) => updateSetting("labelLimit", value)} /> : null}<p className="rounded-[8px] bg-stone px-3 py-2 text-[11px] leading-4 text-graphite">Expected quantiles use (i − 0.5) / n. Systematic deviation can reflect polygenicity, confounding, or model misspecification; this view does not estimate genomic inflation by itself.</p></ControlGroup> : null}
            {plotType === "chromosome-ideogram" ? <ControlGroup title="Ideogram labels"><ToggleControl label="Show cytoband labels" checked={settings.showLabels} onChange={(value) => updateSetting("showLabels", value)} /><p className="text-[11px] leading-4 text-muted">Stain and centromere geometry are taken only from uploaded intervals; no cytobands are inferred.</p></ControlGroup> : null}
            {plotType === "genome-tracks" ? <ControlGroup title="Genome tracks"><RangeControl label="Track gap" value={settings.genomicTrackGap} minimum={0} maximum={12} step={1} unit=" px" onChange={(value) => updateSetting("genomicTrackGap", value)} /><ToggleControl label="Show feature labels" checked={settings.showLabels} onChange={(value) => updateSetting("showLabels", value)} /><p className="rounded-[8px] bg-stone px-3 py-2 text-[11px] leading-4 text-graphite">All intervals are aligned on one coordinate system. The viewer does not infer reference build, strand, transcript model, or assay normalization.</p></ControlGroup> : null}
            {(["sankey", "alluvial", "chord", "ligand-receptor"] as PlotType[]).includes(plotType) ? <ControlGroup title="Flow semantics"><ToggleControl label="Show compact labels" checked={settings.showLabels} onChange={(value) => updateSetting("showLabels", value)} /><p className="rounded-[8px] bg-stone px-3 py-2 text-[11px] leading-4 text-graphite">Ribbon width uses the supplied non-negative weight. Sankey aggregates repeated source–target–group rows and discloses it; Alluvial requires conserved flow IDs across ordered axes. Ligand–receptor scores remain upstream evidence, not causal communication proof.</p></ControlGroup> : null}
            {plotType === "circos" ? <ControlGroup title="Circos tracks"><RangeControl label="Track gap" value={settings.genomicTrackGap} minimum={0} maximum={12} step={1} unit=" px" onChange={(value) => updateSetting("genomicTrackGap", value)} /><ToggleControl label="Show compact labels" checked={settings.showLabels} onChange={(value) => updateSetting("showLabels", value)} /><p className="rounded-[8px] bg-stone px-3 py-2 text-[11px] leading-4 text-graphite">All record types share explicit chromosome/contig lengths from one reference build. Numeric tracks scale independently and display their ranges; correlation is a signed coefficient in [−1, 1]. link, fusion, and correlation require target intervals and target sequence lengths.</p></ControlGroup> : null}
            {(plotType === "waterfall" || plotType === "oncoplot") ? <ControlGroup title="Cohort ordering"><ToggleControl label="Sort samples by event burden" checked={settings.genomicSortSamples} onChange={(value) => updateSetting("genomicSortSamples", value)} />{plotType === "oncoplot" ? <ToggleControl label="Show burden and frequency margins" checked={settings.oncoplotShowMargins} onChange={(value) => updateSetting("oncoplotShowMargins", value)} /> : null}<p className="rounded-[8px] bg-stone px-3 py-2 text-[11px] leading-4 text-graphite">Rows are input alteration events. Waterfall height is event count, not normalized tumor mutation burden. Oncoplot co-occurrence is descriptive and is not a mutual-exclusivity test.</p></ControlGroup> : null}
            {plotType === "motif-logo" ? <ControlGroup title="Motif scale"><SelectControl label="Letter height" value={settings.motifDisplayMode} onChange={(value) => updateSetting("motifDisplayMode", value as VisualizationSettings["motifDisplayMode"])}><option value="information">Information content (bits)</option><option value="probability">Probability</option></SelectControl><p className="rounded-[8px] bg-stone px-3 py-2 text-[11px] leading-4 text-graphite">Information mode uses R = 2 − H for DNA and letter height p(base) × R. Probabilities must already include any pseudocount treatment; sample-size correction is not inferred.</p></ControlGroup> : null}
            {(["network", "ppi", "cerna", "mirna-target", "cnet", "enrichment-map"] as PlotType[]).includes(plotType) ? <ControlGroup title="Network layout">
              <SelectControl label="Layout" value={settings.networkLayout} onChange={(value) => updateSetting("networkLayout", value as VisualizationSettings["networkLayout"])}><option value="circular">Deterministic circular</option><option value="layered">Grouped layers</option><option value="radial">Degree-centered radial</option></SelectControl>
              <RangeControl label="Reproducible seed" value={settings.networkSeed} minimum={0} maximum={9999} step={1} onChange={(value) => updateSetting("networkSeed", value)} />
              <ToggleControl label="Show node labels" checked={settings.showLabels} onChange={(value) => updateSetting("showLabels", value)} />
              <ToggleControl label="Keep explicit isolated nodes" checked={settings.networkShowIsolates} onChange={(value) => updateSetting("networkShowIsolates", value)} />
              <RangeControl label="Edge opacity" value={settings.networkEdgeOpacity} minimum={0.15} maximum={1} step={0.05} onChange={(value) => updateSetting("networkEdgeOpacity", value)} />
              <p className="rounded-[8px] bg-stone px-3 py-2 text-[11px] leading-4 text-graphite">Node color encodes group and optional value controls size. Edge width encodes weight, arrowheads encode direction, color encodes sign, and dash pattern encodes edge type. Layout coordinates are deterministic for the exported seed but have no biological distance meaning.</p>
            </ControlGroup> : null}
            {(plotType === "tree" || plotType === "dendrogram") ? <ControlGroup title="Hierarchy layout"><SelectControl label="Orientation" value={settings.treeOrientation} onChange={(value) => updateSetting("treeOrientation", value as VisualizationSettings["treeOrientation"])}><option value="vertical">Top to bottom</option><option value="horizontal">Left to right</option></SelectControl><ToggleControl label="Show leaf labels" checked={settings.showLabels} onChange={(value) => updateSetting("showLabels", value)} /><p className="rounded-[8px] bg-stone px-3 py-2 text-[11px] leading-4 text-graphite">Tree branch length encodes hierarchy depth only. Dendrogram branch position uses supplied merge height; horizontal leaf spacing is layout and is not a sample distance.</p></ControlGroup> : null}
            {plotType === "quadrant" ? <ControlGroup title="Quadrant thresholds"><RangeControl label="X threshold" value={settings.xThreshold} minimum={-10} maximum={10} step={0.1} onChange={(value) => updateSetting("xThreshold", value)} /><RangeControl label="Y threshold" value={settings.yThreshold} minimum={-10} maximum={10} step={0.1} onChange={(value) => updateSetting("yThreshold", value)} /></ControlGroup> : null}
            {plotType === "errorbar" ? <ControlGroup title="Error bars"><RangeControl label="Error line" value={settings.errorBarLineWidth} minimum={0.8} maximum={3} step={0.1} unit=" px" onChange={(value) => updateSetting("errorBarLineWidth", value)} /><RangeControl label="Cap width" value={settings.errorBarCapSize} minimum={4} maximum={30} step={1} unit=" px" onChange={(value) => updateSetting("errorBarCapSize", value)} /><p className="rounded-[8px] bg-stone px-3 py-2 text-[11px] leading-4 text-graphite">The mapped error column must already contain SD or SEM. Record which statistic you used in the title, axis, caption, or exported config.</p></ControlGroup> : null}
            {(["heatmap", "clustered-heatmap", "correlation-heatmap"] as PlotType[]).includes(plotType) ? <>
              <ControlGroup title="Heatmap view">
                <SelectControl label="Layout" value={settings.heatmapDisplay} onChange={(value) => updateSetting("heatmapDisplay", value as VisualizationSettings["heatmapDisplay"])}><option value="rectangular">Rectangular matrix</option><option value="circular">Circular heatmap</option></SelectControl>
                {plotType === "correlation-heatmap" && settings.heatmapDisplay === "rectangular" ? <SelectControl label="Correlation cells" value={settings.heatmapTriangle} onChange={(value) => updateSetting("heatmapTriangle", value as VisualizationSettings["heatmapTriangle"])}><option value="lower">Lower triangle</option><option value="upper">Upper triangle</option><option value="full">Full matrix</option></SelectControl> : null}
                {plotType !== "correlation-heatmap" ? <SelectControl label="Scaling" value={settings.heatmapScale} onChange={(value) => updateSetting("heatmapScale", value as VisualizationSettings["heatmapScale"])}><option value="row">Row z-score</option><option value="column">Column z-score</option><option value="none">Raw values</option></SelectControl> : null}
                {plotType !== "correlation-heatmap" && settings.heatmapScale === "none" ? <SelectControl label="Color scale" value={settings.heatmapColorMode} onChange={(value) => updateSetting("heatmapColorMode", value as VisualizationSettings["heatmapColorMode"])}><option value="sequential">Sequential low → high</option><option value="diverging">Diverging around zero</option></SelectControl> : null}
                <SelectControl label="Label density" value={settings.heatmapLabelDensity} onChange={(value) => updateSetting("heatmapLabelDensity", value as VisualizationSettings["heatmapLabelDensity"])}><option value="auto">Auto (legible)</option><option value="all">All labels</option><option value="none">Hidden</option></SelectControl>
                {settings.heatmapDisplay === "rectangular" ? <ToggleControl label="Cell values when legible" checked={settings.heatmapShowValues} onChange={(value) => updateSetting("heatmapShowValues", value)} /> : null}
                {settings.heatmapDisplay === "rectangular" ? <><ToggleControl label="Coordinated raw-value row summary" checked={settings.heatmapShowSidePlot} onChange={(value) => updateSetting("heatmapShowSidePlot", value)} />
                {settings.heatmapShowSidePlot ? <><SelectControl label="Raw row summary" value={settings.heatmapSidePlotStatistic} onChange={(value) => updateSetting("heatmapSidePlotStatistic", value as VisualizationSettings["heatmapSidePlotStatistic"])}><option value="mean">Mean</option><option value="sd">SD</option><option value="range">Range</option></SelectControl><p className="text-[11px] leading-4 text-muted">The side plot summarizes uploaded values before heatmap scaling; correlation heatmaps summarize displayed coefficients.</p></> : null}</> : <p className="rounded-[8px] bg-stone px-3 py-2 text-[11px] leading-4 text-graphite">Circular view keeps cluster ordering, cut tracks, and annotations. Cell text, dendrogram geometry, and the coordinated side plot are available in rectangular view.</p>}
              </ControlGroup>
              {plotType !== "heatmap" ? <ControlGroup title="Clustering">
                {plotType === "correlation-heatmap" ? <ToggleControl label="Cluster variables (linked rows + columns)" checked={settings.clusterRows && settings.clusterColumns} onChange={(value) => setSettings((current) => ({ ...current, clusterRows: value, clusterColumns: value }))} /> : <><ToggleControl label="Cluster rows" checked={settings.clusterRows} onChange={(value) => updateSetting("clusterRows", value)} /><ToggleControl label="Cluster columns" checked={settings.clusterColumns} onChange={(value) => updateSetting("clusterColumns", value)} /></>}
                {(settings.clusterRows || settings.clusterColumns) ? <>
                  <SelectControl label="Distance" value={settings.heatmapDistance} onChange={(value) => updateSetting("heatmapDistance", value as VisualizationSettings["heatmapDistance"])}><option value="euclidean">Euclidean</option><option value="correlation">1 − Pearson correlation</option></SelectControl>
                  <SelectControl label="Linkage" value={settings.heatmapLinkage} onChange={(value) => updateSetting("heatmapLinkage", value as VisualizationSettings["heatmapLinkage"])}><option value="average">Average</option><option value="complete">Complete</option><option value="single">Single</option></SelectControl>
                  {settings.heatmapDisplay === "rectangular" ? <ToggleControl label="Dendrograms" checked={settings.heatmapShowDendrograms} onChange={(value) => updateSetting("heatmapShowDendrograms", value)} /> : null}
                  {plotType === "correlation-heatmap" ? <RangeControl label="Variable cluster cut" value={settings.heatmapRowClusters} minimum={1} maximum={8} step={1} onChange={(value) => setSettings((current) => ({ ...current, heatmapRowClusters: value, heatmapColumnClusters: value }))} /> : <>{settings.clusterRows ? <RangeControl label="Row cluster cut" value={settings.heatmapRowClusters} minimum={1} maximum={8} step={1} onChange={(value) => updateSetting("heatmapRowClusters", value)} /> : null}{settings.clusterColumns ? <RangeControl label="Column cluster cut" value={settings.heatmapColumnClusters} minimum={1} maximum={8} step={1} onChange={(value) => updateSetting("heatmapColumnClusters", value)} /> : null}</>}
                  <p className="text-[11px] leading-4 text-muted">Ordering, distance, linkage, and cut count are deterministic and included in the exported configuration.{plotType === "correlation-heatmap" ? " Symmetric rows and columns always share one variable order." : ""}</p>
                </> : null}
              </ControlGroup> : null}
              <ControlGroup title="Annotation tracks">
                <TextareaControl label="Row annotations (TSV)" value={settings.heatmapRowAnnotationData} onChange={(value) => updateSetting("heatmapRowAnnotationData", value)} placeholder={"id\tpathway[categorical]\nTP53\tp53 response\nEGFR\tRTK"} hint="First column is a stable row ID; append [categorical] or [continuous] to declare each track." />
                <TextareaControl label="Column annotations (TSV)" value={settings.heatmapColumnAnnotationData} onChange={(value) => updateSetting("heatmapColumnAnnotationData", value)} placeholder={"id\tgroup[categorical]\tbatch[categorical]\nControl_1\tControl\t1\nTreatment_1\tTreatment\t2"} hint="IDs are matched by name, never by row position. Undeclared numeric tracks trigger a warning instead of silently assuming coded categories." />
              </ControlGroup>
            </> : null}
            {plotType === "km" ? <ControlGroup title="Survival"><ToggleControl label="Show numbers at risk" checked={settings.showRiskTable} onChange={(value) => updateSetting("showRiskTable", value)} /><p className="rounded-[8px] bg-stone px-3 py-2 text-[11px] leading-4 text-graphite">Kaplan–Meier estimates and censor marks are calculated from individual records. A log-rank P value is intentionally omitted until a tested inferential module is added.</p></ControlGroup> : null}
            {plotType === "survival-forest" ? <ControlGroup title="Forest reference"><RangeControl label="Null reference" value={settings.forestReferenceValue} minimum={0} maximum={5} step={0.1} onChange={(value) => updateSetting("forestReferenceValue", value)} /><p className="text-[11px] leading-4 text-muted">Use 1 for ratios such as HR/OR and 0 for additive coefficients.</p></ControlGroup> : null}

            {(["pie", "donut", "waffle", "treemap", "sunburst"] as PlotType[]).includes(plotType) ? <ControlGroup title="Labels & composition">
              <SelectControl label="Value labels" value={settings.compositionLabelMode} onChange={(value) => updateSetting("compositionLabelMode", value as VisualizationSettings["compositionLabelMode"])}><option value="percent">Percent</option><option value="value">Value</option><option value="both">Value + percent</option><option value="none">Hidden</option></SelectControl>
              {plotType === "donut" ? <RangeControl label="Center hole" value={settings.donutHole} minimum={0.32} maximum={0.72} step={0.02} onChange={(value) => updateSetting("donutHole", value)} /> : null}
              {plotType === "waffle" ? <RangeControl label="Grid units" value={settings.waffleCells} minimum={25} maximum={225} step={25} onChange={(value) => updateSetting("waffleCells", value)} /> : null}
              {plotType === "treemap" || plotType === "sunburst" ? <RangeControl label="Hierarchy gap" value={settings.hierarchyGap} minimum={0} maximum={8} step={0.5} unit=" px" onChange={(value) => updateSetting("hierarchyGap", value)} /> : null}
              <p className="text-[11px] leading-4 text-muted">Percentages are calculated from the currently mapped non-negative values. Exported labels retain the underlying total.</p>
            </ControlGroup> : null}

            {plotType === "rose" ? <ControlGroup title="Rose labels">
              <SelectControl label="Sector labels" value={settings.compositionLabelMode === "none" ? "none" : "value"} onChange={(value) => updateSetting("compositionLabelMode", value as "value" | "none")}><option value="value">Category + value</option><option value="none">Hidden</option></SelectControl>
              <p className="text-[11px] leading-4 text-muted">Rose sector area is proportional to magnitude, with radius scaled by the square root of the value. Values are not normalized to percentages.</p>
            </ControlGroup> : null}

            {(["rose", "radar", "polar-profile"] as PlotType[]).includes(plotType) ? <ControlGroup title="Radial scale">
              <OptionalNumberControl label="Radial maximum" value={settings.radialMaximum} invalid={settings.radialMaximum !== null && settings.radialMaximum <= 0} onChange={(value) => updateSetting("radialMaximum", value)} />
              {plotType === "radar" || plotType === "polar-profile" ? <RangeControl label="Profile fill" value={settings.radarFillOpacity} minimum={0} maximum={0.5} step={0.02} onChange={(value) => updateSetting("radarFillOpacity", value)} /> : null}
              <p className="text-[11px] leading-4 text-muted">Auto uses a padded maximum from the mapped values. A manual maximum must be positive and may clip larger values.</p>
            </ControlGroup> : null}

            {plotType === "population-pyramid" ? <ControlGroup title="Population pyramid scale">
              <SelectControl label="Display values" value={settings.pyramidDisplayMode} onChange={(value) => updateSetting("pyramidDisplayMode", value as VisualizationSettings["pyramidDisplayMode"])}><option value="value">Absolute values</option><option value="percent">Within-group percent</option></SelectControl>
              <p className="text-[11px] leading-4 text-muted">Mirroring is a layout convention, not a negative measurement. Percent mode normalizes each of the two groups independently to 100%.</p>
            </ControlGroup> : null}

              <ControlGroup title="Editable colors">
                {categoryLabels.map((label, index) => <ColorControl key={`${label}-${index}`} label={`${index + 1} · ${label}`} value={effectiveCategoricalColors[index] ?? categoricalColorForIndex(index, journalThemes[themeId].categorical)} onChange={(value) => updateCategoryColor(index, value)} />)}
                {(["enrichment", "enrichment-bar", "go-circle", "kegg-circle", "pathway-impact", "nes-fdr"] as PlotType[]).includes(plotType) || ((plotType === "heatmap" || plotType === "clustered-heatmap") && settings.heatmapScale === "none" && settings.heatmapColorMode === "sequential") ? <><ColorControl label="Sequential low" value={settings.continuousLow} onChange={(value) => updateSetting("continuousLow", value)} /><ColorControl label="Sequential high" value={settings.continuousHigh} onChange={(value) => updateSetting("continuousHigh", value)} /></> : null}
                {(["heatmap", "clustered-heatmap", "correlation-heatmap"] as PlotType[]).includes(plotType) && (plotType === "correlation-heatmap" || settings.heatmapScale !== "none" || settings.heatmapColorMode === "diverging") ? <><ColorControl label="Diverging low" value={settings.divergingLow} onChange={(value) => updateSetting("divergingLow", value)} /><ColorControl label="Midpoint" value={settings.divergingMid} onChange={(value) => updateSetting("divergingMid", value)} /><ColorControl label="Diverging high" value={settings.divergingHigh} onChange={(value) => updateSetting("divergingHigh", value)} /></> : null}
              </ControlGroup>
            </CardBody>
          </Card>

          <aside data-plot-guidance={plotType} aria-live="polite" className="rounded-[var(--ln-vis-panel-radius)] border border-moss/20 bg-sage-surface/70 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink"><Lightbulb className="h-3.5 w-3.5 text-moss" aria-hidden />图形定义与适用场景</div>
            <div className="mt-2 space-y-2 text-[11px] leading-[1.55] text-graphite">
              <p><span className="font-semibold text-ink">基本定义：</span>{guidance.definition}</p>
              <p><span className="font-semibold text-ink">适合的数据：</span>{guidance.suitableData}</p>
              <p><span className="font-semibold text-ink">适合说明的问题：</span>{guidance.answers}</p>
              {guidance.origin ? (
                <details data-plot-origin={plotType} className="border-t border-moss/20 pt-2">
                  <summary className="focus-ring cursor-pointer rounded text-[11px] font-semibold text-ink">方法由来</summary>
                  <p className="mt-2 text-[10px] leading-[1.55] text-graphite">{guidance.origin}</p>
                </details>
              ) : null}
              <details data-plot-references={plotType} className="border-t border-moss/20 pt-2">
                <summary className="focus-ring cursor-pointer rounded text-[11px] font-semibold text-ink">方法学参考文献（{guidance.references.length}）</summary>
                <ul className="mt-2 space-y-2">
                  {guidance.references.map((reference) => (
                    <li key={reference.href}>
                      <a className="group flex items-start gap-1.5 text-[10px] leading-[1.5] text-graphite underline decoration-moss/35 underline-offset-2 hover:text-ink hover:decoration-moss" href={reference.href} target="_blank" rel="noreferrer">
                        <span>{reference.citation}</span>
                        <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-moss" aria-hidden />
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
