import {
  createPlotModuleRegistry,
  type PlotDataShape,
  type PlotModuleSeed,
} from "./plot-module-registry";
import {
  chromosomeLaneLayout,
  canonicalAlteration,
  genomeAxisSpanMetrics,
  genomeTrackLayout,
  isValidChromosome,
  motifLayoutMetrics,
  normalizeChromosome,
  oncoplotLayoutMetrics,
  supportedCytobandStains,
  waterfallLayoutMetrics,
} from "./visualization-genomics";
import {
  hierarchyLayoutMetrics,
  networkEncodingLegendEntries,
  networkLegendMetrics,
  networkLayoutMetrics,
  parseHierarchyRecords,
  parseNetworkRecords,
  type NetworkPlotType,
} from "./visualization-network";
import {
  aggregateFlowEdges,
  alluvialAxisOrder,
  chordSectorLayout,
  circularLabelLayoutMetrics,
  circosCoordinateSystem,
  circosTrackOrder,
  flowCircularFrame,
  flowCircularLayoutMetrics,
  isCircosRecordType,
  parseAlluvialRecords,
  parseCircosTrackRecords,
  parseLigandReceptorRecords,
} from "./visualization-flow-circular";
import {
  analyzeSetIntersections,
  setDiagramLayoutMetrics,
  upsetAdaptiveLayout,
} from "./visualization-sets";

export type PlotType =
  | "bar"
  | "line"
  | "scatter"
  | "correlation"
  | "pca"
  | "pcoa"
  | "umap"
  | "tsne"
  | "nmds"
  | "box"
  | "violin"
  | "beeswarm"
  | "raincloud"
  | "histogram"
  | "density"
  | "ridge"
  | "volcano"
  | "ma"
  | "quadrant"
  | "errorbar"
  | "area"
  | "lollipop"
  | "heatmap"
  | "clustered-heatmap"
  | "correlation-heatmap"
  | "enrichment"
  | "enrichment-bar"
  | "gsea"
  | "go-circle"
  | "kegg-circle"
  | "go-chord"
  | "pathway-impact"
  | "nes-fdr"
  | "multi-gsea"
  | "enrichment-ridge"
  | "sankey-bubble"
  | "geographic-map"
  | "petal"
  | "word-cloud"
  | "km"
  | "survival-forest"
  | "roc"
  | "funnel"
  | "precision-recall"
  | "calibration"
  | "decision-curve"
  | "nomogram"
  | "lasso-path"
  | "km-cutoff"
  | "risk-score"
  | "venn"
  | "upset"
  | "sankey"
  | "alluvial"
  | "chord"
  | "ligand-receptor"
  | "circos"
  | "manhattan"
  | "qq"
  | "chromosome-ideogram"
  | "snp-density"
  | "genome-tracks"
  | "waterfall"
  | "oncoplot"
  | "motif-logo"
  | "network"
  | "ppi"
  | "cerna"
  | "mirna-target"
  | "cnet"
  | "enrichment-map"
  | "tree"
  | "dendrogram"
  | "pie"
  | "donut"
  | "rose"
  | "waffle"
  | "treemap"
  | "sunburst"
  | "radar"
  | "polar-profile"
  | "population-pyramid";

export type JournalThemeId =
  | "minimal-ink"
  | "minimal-cobalt"
  | "minimal-pine"
  | "minimal-clay"
  | "minimal-plum"
  | "nature"
  | "cell"
  | "science"
  | "nejm"
  | "lancet"
  | "jama"
  | "nordic"
  | "earth"
  | "colorblind"
  | "cn-beihai"
  | "cn-imperial-orange"
  | "cn-wisteria"
  | "cn-sunset"
  | "cn-hutong"
  | "cn-dragon"
  | "cn-coral"
  | "cn-autumn"
  | "cn-vermilion";

export type PaletteSeriesId = "minimal" | "journal" | "curated" | "chinese-traditional" | "custom";

export const defaultVisualizationThemeId: JournalThemeId = "cn-beihai";
export const defaultVisualizationPaletteSeriesId: PaletteSeriesId = "chinese-traditional";

export type FigureFontId = "arial" | "helvetica" | "system" | "times" | "georgia" | "palatino";

export type DelimitedRow = Record<string, string>;

export type ParsedDataset = {
  headers: string[];
  rows: DelimitedRow[];
  delimiter: "tab" | "comma";
  errors: string[];
  warnings: string[];
  analysis?: {
    pca?: {
      explainedVariance: number[];
      loadings: Array<{ feature: string; coordinates: number[] }>;
    };
  };
};

export type FieldRole = {
  key: string;
  label: string;
  kind: "category" | "number" | "label";
  required: boolean;
};

export type PlotDefinition = {
  id: PlotType;
  name: string;
  family: string;
  summary: string;
  inputHint: string;
  roles: FieldRole[];
  defaultMapping: Record<string, string>;
  sampleData: string;
  examples?: PlotDataExample[];
};

export type PlotGuidance = {
  definition: string;
  suitableData: string;
  answers: string;
  origin?: string;
  references: PlotReference[];
};

export type PlotDataExample = {
  label: string;
  description: string;
  data: string;
  mapping?: Record<string, string>;
  metadata?: string;
  pcaInputMode?: "scores" | "matrix";
  settings?: Partial<VisualizationSettings>;
};

export type PlotReference = {
  citation: string;
  href: string;
};

export type AnalysisProvenance = {
  source: "supplied" | "calculated-in-studio";
  label: "Supplied" | "Calculated in Studio";
  detail: string;
};

export type JournalTheme = {
  id: JournalThemeId;
  series: PaletteSeriesId;
  name: string;
  description: string;
  categorical: string[];
  sequential: [string, string];
  diverging: [string, string, string];
  ink: string;
  muted: string;
  grid: string;
};

export function analysisProvenanceForPlot(
  type: PlotType,
  settings: VisualizationSettings,
  pcaInputMode: "scores" | "matrix" = "scores",
): AnalysisProvenance | null {
  if (type === "bar") return settings.barAnalysisMode === "none"
    ? null
    : settings.barAnalysisMode === "supplied"
      ? { source: "supplied", label: "Supplied", detail: "P values are supplied by an upstream analysis; Studio displays them without recomputing significance." }
      : { source: "calculated-in-studio", label: "Calculated in Studio", detail: settings.barAnalysisMode === "qpcr-delta-ct" ? "Bar heights summarize relative expression, while two-sided Welch tests are calculated locally on biological-replicate ΔCt values." : "Reference-category comparisons, confidence intervals, and multiple-testing adjustments are calculated locally from the declared Bar design." };
  if (type === "pca") return pcaInputMode === "matrix"
    ? { source: "calculated-in-studio", label: "Calculated in Studio", detail: "PCA scores, explained variance, and loadings are calculated locally from the supplied feature matrix." }
    : { source: "supplied", label: "Supplied", detail: "PCA coordinates are supplied by an upstream analysis; Studio renders them without recomputing PCA." };
  if (type === "pcoa") return { source: "supplied", label: "Supplied", detail: "PCoA coordinates and any explained-variance values are supplied by an upstream distance analysis; Studio renders them without recomputing PCoA." };
  if (type === "roc") return settings.rocInputMode === "raw"
    ? { source: "calculated-in-studio", label: "Calculated in Studio", detail: "Empirical ROC coordinates and trapezoidal AUC are calculated locally from the supplied binary outcomes and prediction scores." }
    : { source: "supplied", label: "Supplied", detail: "Time-dependent ROC coordinates, confidence intervals, horizons, and AUC estimates are supplied by an upstream censoring-aware method." };
  if (type === "km") return { source: "calculated-in-studio", label: "Calculated in Studio", detail: "Kaplan–Meier estimates, censor marks, and numbers at risk are calculated locally from the supplied subject-level records." };
  if (type === "clustered-heatmap") return settings.clusterRows || settings.clusterColumns
    ? { source: "calculated-in-studio", label: "Calculated in Studio", detail: `Hierarchical clustering is calculated locally for ${settings.clusterRows && settings.clusterColumns ? "rows and columns" : settings.clusterRows ? "rows" : "columns"} using the selected distance and linkage settings.` }
    : { source: "supplied", label: "Supplied", detail: "Clustering is disabled; matrix values and row/column order are displayed as supplied." };
  if (type === "correlation-heatmap") return { source: "calculated-in-studio", label: "Calculated in Studio", detail: "The correlation matrix and any enabled hierarchical clustering are calculated locally from paired complete observations." };
  if (type === "venn" || type === "upset") return {
    source: "calculated-in-studio",
    label: "Calculated in Studio",
    detail: settings.setInputMode === "peak-overlap"
      ? "Disjoint atomic genomic overlaps and exact set intersections are calculated locally from the supplied genomic intervals."
      : "Exact set intersections and member lists are calculated locally from the supplied membership records.",
  };
  return null;
}

export const paletteSeries: Record<PaletteSeriesId, { id: PaletteSeriesId; name: string; description: string; themeIds: JournalThemeId[] }> = {
  minimal: {
    id: "minimal",
    name: "极简",
    description: "单一主色配合中性明度阶梯，减少同图中的色相数量。",
    themeIds: ["minimal-ink", "minimal-cobalt", "minimal-pine", "minimal-clay", "minimal-plum"],
  },
  journal: {
    id: "journal",
    name: "期刊配色",
    description: "Nature、Cell、Science 与临床医学期刊风格。",
    themeIds: ["nature", "cell", "science", "nejm", "lancet", "jama"],
  },
  curated: {
    id: "curated",
    name: "精选风格",
    description: "适合科研图表的克制型编辑配色与色盲友好方案。",
    themeIds: ["nordic", "earth", "colorblind"],
  },
  "chinese-traditional": {
    id: "chinese-traditional",
    name: "中国传统",
    description: "九套低饱和、适合科研图表的中国传统色。",
    themeIds: ["cn-beihai", "cn-imperial-orange", "cn-wisteria", "cn-sunset", "cn-hutong", "cn-dragon", "cn-coral", "cn-autumn", "cn-vermilion"],
  },
  custom: {
    id: "custom",
    name: "自定义",
    description: "保存并复用你手动调整过的科研图表配色。",
    themeIds: [],
  },
};

export const figureFontPresets: Record<FigureFontId, { id: FigureFontId; name: string; family: string; style: "sans" | "serif" }> = {
  arial: { id: "arial", name: "Arial", family: 'Arial, "Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif', style: "sans" },
  helvetica: { id: "helvetica", name: "Helvetica Neue", family: '"Helvetica Neue", Helvetica, Arial, "PingFang SC", "Microsoft YaHei", sans-serif', style: "sans" },
  system: { id: "system", name: "System Sans", family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, "PingFang SC", "Microsoft YaHei", sans-serif', style: "sans" },
  times: { id: "times", name: "Times New Roman", family: '"Times New Roman", Times, "Songti SC", SimSun, serif', style: "serif" },
  georgia: { id: "georgia", name: "Georgia", family: 'Georgia, "Times New Roman", "Songti SC", SimSun, serif', style: "serif" },
  palatino: { id: "palatino", name: "Palatino", family: 'Palatino, "Palatino Linotype", "Songti SC", SimSun, serif', style: "serif" },
};

export type VisualizationSettings = {
  title: string;
  fontFamily: FigureFontId;
  xLabel: string;
  yLabel: string;
  xMin: number | null;
  xMax: number | null;
  yMin: number | null;
  yMax: number | null;
  width: number;
  height: number;
  titleSize: number;
  axisLabelSize: number;
  tickSize: number;
  legendSize: number;
  axisLineWidth: number;
  gridLineWidth: number;
  dataLineWidth: number;
  pointSize: number;
  opacity: number;
  grid: "none" | "y" | "both";
  legendPosition: "right" | "bottom" | "none";
  swapAxes: boolean;
  showTrend: boolean;
  showLabels: boolean;
  showPoints: boolean;
  showSampleSize: boolean;
  showBox: boolean;
  boxErrorType: "none" | "sd" | "sem" | "ci95";
  showDensity: boolean;
  showHistogram: boolean;
  distributionSummary: "none" | "median" | "mean";
  distributionShowPairedLines: boolean;
  distributionShowSignificance: boolean;
  distributionOrientation: "vertical" | "horizontal";
  histogramBins: number;
  barErrorType: "none" | "sd" | "sem";
  barVariant: "grouped" | "stacked" | "percentage" | "horizontal" | "bidirectional" | "faceted" | "polar" | "bullet" | "pyramid" | "axis-break" | "dual-axis" | "overlay";
  barInputMode: "summary" | "long";
  barAnalysisMode: "none" | "supplied" | "raw-independent" | "summary-independent" | "raw-paired" | "qpcr-delta-ct";
  barReferenceCategory: string;
  barPAdjustment: "none" | "holm" | "bh";
  barOverlayType: "line" | "points";
  secondaryAxisLabel: string;
  showSignificance: boolean;
  significanceThreshold: number;
  axisBreakStart: number;
  axisBreakEnd: number;
  barGap: number;
  lineErrorType: "none" | "sd" | "sem" | "ci95";
  lineUncertaintyStyle: "bars" | "band";
  lineBandOpacity: number;
  lineReferenceSeries: string;
  linePAdjustment: "none" | "bh";
  associationVariant: "points" | "marginal" | "density" | "hexbin" | "ellipse" | "hull" | "pair-matrix" | "3d" | "ternary";
  associationFit: "none" | "linear" | "polynomial" | "loess";
  associationPolynomialDegree: 2 | 3;
  associationLoessSpan: number;
  associationShowConfidenceBand: boolean;
  associationShowPValue: boolean;
  associationGroupMode: "combined" | "by-group";
  associationHexbinSize: number;
  associationDensityBandwidth: number;
  barBorderWidth: number;
  barBorderColor: string;
  errorBarLineWidth: number;
  errorBarCapSize: number;
  violinBandwidth: number;
  violinWidth: number;
  foldChangeThreshold: number;
  pValueThreshold: number;
  labelLimit: number;
  heatmapScale: "row" | "column" | "none";
  heatmapColorMode: "diverging" | "sequential";
  heatmapDisplay: "rectangular" | "circular";
  heatmapTriangle: "full" | "lower" | "upper";
  heatmapDistance: "euclidean" | "correlation";
  heatmapLinkage: "average" | "complete" | "single";
  heatmapShowDendrograms: boolean;
  heatmapRowClusters: number;
  heatmapColumnClusters: number;
  heatmapShowValues: boolean;
  heatmapShowSidePlot: boolean;
  heatmapSidePlotStatistic: "mean" | "sd" | "range";
  heatmapLabelDensity: "auto" | "all" | "none";
  heatmapRowAnnotationData: string;
  heatmapColumnAnnotationData: string;
  ordinationView: "scores" | "scree" | "3d";
  ordinationShowEllipse: boolean;
  ordinationShowHull: boolean;
  ordinationShowCentroids: boolean;
  ordinationShowLoadings: boolean;
  ordinationLoadingCount: number;
  ordinationUseShapes: boolean;
  ordinationXVariance: number | null;
  ordinationYVariance: number | null;
  ordinationZVariance: number | null;
  ordinationPermanovaR2: number | null;
  ordinationPermanovaP: number | null;
  ordinationPermanovaPermutations: number | null;
  ordinationStress: number | null;
  ordinationMethodNote: string;
  genomicSignificanceLog10: number;
  genomicTrackGap: number;
  genomicSortSamples: boolean;
  oncoplotShowMargins: boolean;
  motifDisplayMode: "information" | "probability";
  networkLayout: "circular" | "layered" | "radial";
  networkSeed: number;
  networkShowIsolates: boolean;
  networkEdgeOpacity: number;
  treeOrientation: "vertical" | "horizontal";
  setInputMode: "auto" | "membership" | "peak-overlap";
  rocInputMode: "raw" | "precomputed-time";
  calibrationBinCount: number;
  decisionThresholdMinimum: number;
  decisionThresholdMaximum: number;
  decisionThresholdStep: number;
  vennLayout: "auto" | "classic" | "radial";
  vennProportional: boolean;
  upsetMaxIntersections: number;
  correlationMethod: "pearson" | "spearman";
  xThreshold: number;
  yThreshold: number;
  clusterRows: boolean;
  clusterColumns: boolean;
  showRiskTable: boolean;
  forestReferenceValue: number;
  compositionLabelMode: "percent" | "value" | "both" | "none";
  donutHole: number;
  waffleCells: number;
  hierarchyGap: number;
  radarFillOpacity: number;
  radialMaximum: number | null;
  pyramidDisplayMode: "value" | "percent";
  categoricalColors: string[];
  continuousLow: string;
  continuousHigh: string;
  divergingLow: string;
  divergingMid: string;
  divergingHigh: string;
};

export const defaultVisualizationSettings: VisualizationSettings = {
  title: "",
  fontFamily: "arial",
  xLabel: "",
  yLabel: "",
  xMin: null,
  xMax: null,
  yMin: null,
  yMax: null,
  width: 340,
  height: 340,
  titleSize: 17,
  axisLabelSize: 14,
  tickSize: 11,
  legendSize: 11,
  axisLineWidth: 1.4,
  gridLineWidth: 0.8,
  dataLineWidth: 2,
  pointSize: 5,
  opacity: 0.82,
  grid: "y",
  legendPosition: "right",
  swapAxes: false,
  showTrend: true,
  showLabels: false,
  showPoints: true,
  showSampleSize: true,
  showBox: true,
  boxErrorType: "none",
  showDensity: false,
  showHistogram: false,
  distributionSummary: "median",
  distributionShowPairedLines: false,
  distributionShowSignificance: false,
  distributionOrientation: "vertical",
  histogramBins: 8,
  barErrorType: "none",
  barVariant: "grouped",
  barInputMode: "summary",
  barAnalysisMode: "none",
  barReferenceCategory: "",
  barPAdjustment: "bh",
  barOverlayType: "line",
  secondaryAxisLabel: "Secondary value",
  showSignificance: false,
  significanceThreshold: 0.05,
  axisBreakStart: 5.5,
  axisBreakEnd: 6.5,
  barGap: 0.18,
  lineErrorType: "none",
  lineUncertaintyStyle: "bars",
  lineBandOpacity: 0.16,
  lineReferenceSeries: "",
  linePAdjustment: "bh",
  associationVariant: "points",
  associationFit: "none",
  associationPolynomialDegree: 2,
  associationLoessSpan: 0.65,
  associationShowConfidenceBand: false,
  associationShowPValue: false,
  associationGroupMode: "by-group",
  associationHexbinSize: 14,
  associationDensityBandwidth: 1,
  barBorderWidth: 0,
  barBorderColor: "#355F61",
  errorBarLineWidth: 1.5,
  errorBarCapSize: 14,
  violinBandwidth: 1,
  violinWidth: 0.34,
  foldChangeThreshold: 1,
  pValueThreshold: 0.05,
  labelLimit: 8,
  heatmapScale: "row",
  heatmapColorMode: "diverging",
  heatmapDisplay: "rectangular",
  heatmapTriangle: "lower",
  heatmapDistance: "euclidean",
  heatmapLinkage: "average",
  heatmapShowDendrograms: true,
  heatmapRowClusters: 3,
  heatmapColumnClusters: 3,
  heatmapShowValues: false,
  heatmapShowSidePlot: false,
  heatmapSidePlotStatistic: "mean",
  heatmapLabelDensity: "auto",
  heatmapRowAnnotationData: "",
  heatmapColumnAnnotationData: "",
  ordinationView: "scores",
  ordinationShowEllipse: false,
  ordinationShowHull: false,
  ordinationShowCentroids: false,
  ordinationShowLoadings: false,
  ordinationLoadingCount: 8,
  ordinationUseShapes: true,
  ordinationXVariance: null,
  ordinationYVariance: null,
  ordinationZVariance: null,
  ordinationPermanovaR2: null,
  ordinationPermanovaP: null,
  ordinationPermanovaPermutations: null,
  ordinationStress: null,
  ordinationMethodNote: "",
  genomicSignificanceLog10: 7.3,
  genomicTrackGap: 4,
  genomicSortSamples: true,
  oncoplotShowMargins: true,
  motifDisplayMode: "information",
  networkLayout: "circular",
  networkSeed: 42,
  networkShowIsolates: true,
  networkEdgeOpacity: 0.62,
  treeOrientation: "vertical",
  setInputMode: "auto",
  rocInputMode: "raw",
  calibrationBinCount: 8,
  decisionThresholdMinimum: 0.05,
  decisionThresholdMaximum: 0.8,
  decisionThresholdStep: 0.01,
  vennLayout: "auto",
  vennProportional: false,
  upsetMaxIntersections: 10,
  correlationMethod: "pearson",
  xThreshold: 0,
  yThreshold: 0,
  clusterRows: true,
  clusterColumns: true,
  showRiskTable: true,
  forestReferenceValue: 1,
  compositionLabelMode: "percent",
  donutHole: 0.54,
  waffleCells: 100,
  hierarchyGap: 2,
  radarFillOpacity: 0.16,
  radialMaximum: null,
  pyramidDisplayMode: "value",
  categoricalColors: ["#957454", "#1D4C50", "#D4A278", "#3F605B"],
  continuousLow: "#F3E6DC",
  continuousHigh: "#3F605B",
  divergingLow: "#1D4C50",
  divergingMid: "#FAF8F4",
  divergingHigh: "#D4A278",
};

export type OrdinationType = "pca" | "pcoa" | "umap" | "tsne" | "nmds";

export function ordinationAnnotationLayout(type: OrdinationType, settings: VisualizationSettings) {
  const sources = [
    settings.ordinationPermanovaR2 !== null && settings.ordinationPermanovaP !== null && settings.ordinationPermanovaPermutations !== null
      ? `PERMANOVA (supplied) · R²=${settings.ordinationPermanovaR2.toFixed(3)} · p=${settings.ordinationPermanovaP < 0.001 ? "<0.001" : settings.ordinationPermanovaP.toFixed(3)} · nperm=${settings.ordinationPermanovaPermutations}`
      : "",
    type === "nmds" && settings.ordinationStress !== null ? `Supplied NMDS stress = ${settings.ordinationStress.toFixed(3)}` : "",
    settings.ordinationMethodNote.trim() ? `Upstream: ${settings.ordinationMethodNote.trim().slice(0, 72)}` : "",
  ].filter(Boolean);
  const fontSize = Math.max(8, settings.legendSize - 1);
  const charactersPerLine = Math.max(28, Math.floor((settings.width - 28) / (fontSize * 0.56)));
  const lines = sources.flatMap((source) => {
    const words = source.split(/\s+/);
    const wrapped: string[] = [];
    let line = "";
    words.forEach((word) => {
      if (!line || `${line} ${word}`.length <= charactersPerLine) line = line ? `${line} ${word}` : word;
      else { wrapped.push(line); line = word; }
    });
    if (line) wrapped.push(line);
    return wrapped;
  });
  return { lines, fontSize, lineHeight: Math.max(11, settings.legendSize + 3) };
}

/** Shared ordination plot geometry used by validation and SVG rendering. */
export function ordinationFrameMetrics(type: OrdinationType, settings: VisualizationSettings) {
  const left = 66;
  const top = settings.title ? 48 : 24;
  const bottom = settings.legendPosition === "bottom" ? 80 : 58;
  const right = 22 + (settings.legendPosition === "right" ? 145 : 0);
  const plotWidth = Math.max(100, settings.width - left - right);
  const basePlotHeight = Math.max(90, settings.height - top - bottom);
  const annotation = ordinationAnnotationLayout(type, settings);
  const annotationHeight = annotation.lines.length * annotation.lineHeight;
  return {
    width: settings.width,
    height: settings.height,
    left,
    right,
    top: top + annotationHeight,
    bottom,
    plotWidth,
    plotHeight: annotation.lines.length ? Math.max(80, basePlotHeight - annotationHeight) : basePlotHeight,
    annotation,
    annotationTop: top,
  };
}

export function ordinationLegendLayout(
  type: OrdinationType,
  settings: VisualizationSettings,
  groupCount: number,
  shapeCount: number,
) {
  const frame = ordinationFrameMetrics(type, settings);
  const visibleGroups = Math.min(12, groupCount);
  const visibleShapes = Math.min(4, shapeCount);
  const hasColorLegend = settings.legendPosition !== "none" && visibleGroups >= 2;
  const hasShapeLegend = settings.legendPosition !== "none" && settings.ordinationUseShapes && visibleShapes >= 2;
  if (settings.legendPosition === "none") return { fits: true, shapeX: frame.left, shapeY: frame.height, colorBottom: frame.top, shapeBottom: frame.top };
  if (settings.legendPosition === "right") {
    const colorBottom = hasColorLegend
      ? frame.top + 5 + (visibleGroups - 1) * (settings.legendSize + 10) + settings.legendSize
      : frame.top;
    const shapeX = frame.left + frame.plotWidth + 10;
    const shapeY = frame.top + visibleGroups * (settings.legendSize + 8) + 20;
    const shapeBottom = hasShapeLegend
      ? shapeY + 17 + (visibleShapes - 1) * (settings.legendSize + 6)
      : frame.top;
    return { fits: Math.max(colorBottom, shapeBottom) <= settings.height - 4, shapeX, shapeY, colorBottom, shapeBottom };
  }
  const groupsPerRow = Math.max(2, Math.min(4, Math.floor(frame.plotWidth / 90)));
  const colorRows = hasColorLegend ? Math.ceil(visibleGroups / groupsPerRow) : 0;
  const colorBottom = colorRows ? frame.height - 72 + (colorRows - 1) * (settings.legendSize + 7) + settings.legendSize : frame.top;
  const shapeX = frame.left;
  const shapeY = frame.height - 24;
  const shapeBottom = hasShapeLegend ? shapeY + 17 : frame.top;
  const conservativeShapeRight = hasShapeLegend ? shapeX + (visibleShapes - 1) * 74 + 12 + 10 * Math.max(8, settings.legendSize - 1) : shapeX;
  const noVerticalCollision = !hasColorLegend || !hasShapeLegend || colorBottom + 4 < shapeY;
  return { fits: noVerticalCollision && shapeBottom <= settings.height - 4 && conservativeShapeRight <= settings.width - 4, shapeX, shapeY, colorBottom, shapeBottom };
}

export function estimateLegendTextWidth(label: string, fontSize: number) {
  const em = [...label].reduce((sum, character) => {
    if (character === "…") return sum + 1;
    if (/[^\u0000-\u00ff]/.test(character)) return sum + 1;
    if (/[WM@%&]/.test(character)) return sum + 0.98;
    if (/[A-Z]/.test(character)) return sum + 0.74;
    if (/[a-z0-9]/.test(character)) return sum + 0.62;
    if (/\s/.test(character)) return sum + 0.34;
    return sum + 0.46;
  }, 0);
  return em * Math.max(1, fontSize);
}

export const BAR_CATEGORY_LABEL_ANGLE = -30;

/** Keep the visible bar-category text identical in layout and rendering. */
export function barCategoryLabelText(value: string) {
  return value.length <= 16 ? value : `${value.slice(0, 15)}…`;
}

/**
 * Deterministic bottom-axis geometry for compact vertical bar charts.
 *
 * The rotated labels extend below their SVG baseline by roughly half their
 * text width at -30 degrees. Reserving that footprint before the plot frame is
 * created keeps preview and exported SVG geometry identical without relying on
 * a post-render DOM measurement.
 */
export function barCategoryAxisLayoutMetrics(settings: VisualizationSettings, labels: string[]) {
  const isHorizontal = settings.swapAxes || ["horizontal", "bullet", "pyramid"].includes(settings.barVariant);
  const applies = !isHorizontal && settings.barVariant !== "polar";
  const compactHeight = settings.height < 300;
  const baseBottom = (compactHeight ? 48 : 58) + (settings.legendPosition === "bottom" ? 34 : 0);
  const top = (compactHeight ? 20 : 24) + (settings.title ? 24 : 0);
  if (!applies) return {
    applies,
    bottom: baseBottom,
    requiredBottom: baseBottom,
    labelBottomOffset: 0,
    xTitleY: settings.height - (settings.legendPosition === "bottom" ? 57 : 13),
    minimumGap: 4,
    fits: settings.height - top - baseBottom >= 80,
  };

  const displayedLabels = labels.map(barCategoryLabelText);
  const maximumLabelWidth = Math.max(0, ...displayedLabels.map((label) => estimateLegendTextWidth(label, settings.tickSize)));
  const rotation = Math.abs(BAR_CATEGORY_LABEL_ANGLE) * Math.PI / 180;
  const labelBaselineOffset = 10;
  const labelDescent = settings.tickSize * 0.25;
  const labelBottomOffset = labelBaselineOffset + Math.sin(rotation) * maximumLabelWidth + Math.cos(rotation) * labelDescent;
  const minimumGap = 4;
  const hasXTitle = Boolean(settings.xLabel.trim());
  const xTitleY = settings.height - (settings.legendPosition === "bottom" ? 57 : 13);
  const contentTopFromBottom = hasXTitle
    ? settings.height - xTitleY + settings.axisLabelSize * 0.82
    : settings.legendPosition === "bottom" ? 34 : 4;
  const requiredBottom = Math.ceil(labelBottomOffset + minimumGap + contentTopFromBottom);
  const bottom = Math.max(baseBottom, requiredBottom);
  return {
    applies,
    bottom,
    requiredBottom,
    labelBottomOffset,
    xTitleY,
    minimumGap,
    fits: settings.height - top - bottom >= 80,
  };
}

export type EnrichmentSpecializedLayoutInput = {
  rowCount: number;
  groupCount?: number;
  termCount?: number;
  geneCount?: number;
  maximumGroupLabelWidth?: number;
};

export function enrichmentSpecializedFrameMetrics(type: PlotType, settings: VisualizationSettings) {
  const noAxes = ["go-circle", "kegg-circle", "go-chord", "sankey-bubble", "geographic-map", "petal", "word-cloud"].includes(type);
  const left = noAxes ? 14 : 66;
  const top = settings.title ? 48 : 24;
  const right = 22;
  const bottom = ["go-circle", "kegg-circle"].includes(type) ? 110
    : ["geographic-map"].includes(type) ? 90
      : ["pathway-impact"].includes(type) ? 145
        : ["go-chord", "nes-fdr", "multi-gsea", "enrichment-ridge", "sankey-bubble"].includes(type) ? 82
        : 58;
  return {
    width: settings.width,
    height: settings.height,
    left,
    right,
    top,
    bottom,
    plotWidth: Math.max(100, settings.width - left - right),
    plotHeight: Math.max(90, settings.height - top - bottom),
  };
}

export type GeographicLayoutRow = { label: string; latitude: number; longitude: number; value: number };

export const enrichmentCircleRadius = (value: number, maximum: number) => 5 + Math.sqrt(Math.max(0, value) / Math.max(maximum, Number.EPSILON)) * 11;
export const pathwayImpactRadius = (value: number, maximum: number, pointSize: number) => 4 + Math.sqrt(Math.max(0, value) / Math.max(maximum, Number.EPSILON)) * pointSize;
export const geographicPointRadius = (value: number, maximum: number, pointSize: number) => 3 + Math.sqrt(Math.max(0, value) / Math.max(maximum, Number.EPSILON)) * pointSize;
export const relationshipRibbonWidth = (ratio: number) => 1 + Math.max(0, ratio) * 12;
export const relationshipBubbleRadius = (value: number, maximum: number) => 4 + Math.sqrt(Math.max(0, value) / Math.max(maximum, Number.EPSILON)) * 10;

export function categoryFooterLayoutMetrics(type: PlotType, settings: VisualizationSettings, labels: string[], offset = 16) {
  const frame = enrichmentSpecializedFrameMetrics(type, settings);
  const perRow = Math.max(2, Math.min(4, Math.floor(frame.plotWidth / 70)));
  const rows = Math.max(1, Math.ceil(labels.length / perRow));
  const cellWidth = frame.plotWidth / perRow;
  const fontSize = Math.max(7, settings.tickSize - 2);
  const labelsFit = labels.every((label) => estimateLegendTextWidth(compactLegendLabel(label, fontSize, cellWidth - 13, 14), fontSize) <= cellWidth - 13 + 0.5);
  const lastLegendBaseline = offset + (rows - 1) * 14;
  const sizeOffset = offset + rows * 14 + 4;
  const noteOffset = sizeOffset + 24;
  const bottomFits = noteOffset + fontSize * 0.25 <= frame.bottom - 1;
  return { frame, perRow, rows, cellWidth, fontSize, labelsFit, lastLegendBaseline, sizeOffset, noteOffset, bottomFits, offset };
}

export function geographicPointLayout(settings: VisualizationSettings, rows: GeographicLayoutRow[]) {
  const frame = enrichmentSpecializedFrameMetrics("geographic-map", settings);
  const maximumValue = Math.max(...rows.map((row) => row.value), 1);
  const maximumRadius = geographicPointRadius(maximumValue, maximumValue, settings.pointSize);
  const inset = maximumRadius + 1.5;
  const xAt = (longitude: number) => scaleLinear(longitude, [-180, 180], [frame.left + inset, frame.left + frame.plotWidth - inset]);
  const yAt = (latitude: number) => scaleLinear(latitude, [-90, 90], [frame.top + frame.plotHeight - inset, frame.top + inset]);
  const marks = rows.map((row) => ({ ...row, x: xAt(row.longitude), y: yAt(row.latitude), radius: geographicPointRadius(row.value, maximumValue, settings.pointSize) }));
  let markCollisionPairs = 0;
  marks.forEach((mark, index) => marks.slice(index + 1).forEach((other) => { if (Math.hypot(mark.x - other.x, mark.y - other.y) < mark.radius + other.radius + 1) markCollisionPairs += 1; }));
  const placedBoxes: Array<{ left: number; right: number; top: number; bottom: number }> = [];
  let labelCollisionCount = 0;
  const items = marks.map((mark, index) => {
    const maximumWidth = Math.max(20, frame.plotWidth * 0.25);
    const text = compactLegendLabel(mark.label, settings.tickSize, maximumWidth, 16);
    const width = estimateLegendTextWidth(text, settings.tickSize);
    const height = settings.tickSize * 1.05;
    const sideY = Math.max(frame.top + 1 + height * 0.82, Math.min(frame.top + frame.plotHeight - 1 - height * 0.18, mark.y - 4));
    const candidates = [
      { x: mark.x + mark.radius + 5, y: sideY, anchor: "start" as const, left: mark.x + mark.radius + 5, right: mark.x + mark.radius + 5 + width, top: sideY - height * 0.82, bottom: sideY + height * 0.18 },
      { x: mark.x - mark.radius - 5, y: sideY, anchor: "end" as const, left: mark.x - mark.radius - 5 - width, right: mark.x - mark.radius - 5, top: sideY - height * 0.82, bottom: sideY + height * 0.18 },
      { x: mark.x, y: mark.y - mark.radius - 5, anchor: "middle" as const, left: mark.x - width / 2, right: mark.x + width / 2, top: mark.y - mark.radius - 5 - height * 0.82, bottom: mark.y - mark.radius - 5 + height * 0.18 },
      { x: mark.x, y: mark.y + mark.radius + settings.tickSize, anchor: "middle" as const, left: mark.x - width / 2, right: mark.x + width / 2, top: mark.y + mark.radius + settings.tickSize - height * 0.82, bottom: mark.y + mark.radius + settings.tickSize + height * 0.18 },
    ];
    const fits = (candidate: typeof candidates[number]) => candidate.left >= frame.left + 1 && candidate.right <= frame.left + frame.plotWidth - 1 && candidate.top >= frame.top + 1 && candidate.bottom <= frame.top + frame.plotHeight - 1;
    const overlapsBox = (candidate: typeof candidates[number], box: typeof placedBoxes[number]) => candidate.left < box.right + 2 && candidate.right > box.left - 2 && candidate.top < box.bottom + 2 && candidate.bottom > box.top - 2;
    const overlapsMark = (candidate: typeof candidates[number], other: typeof marks[number]) => {
      if (other === mark) return false;
      const nearestX = Math.max(candidate.left, Math.min(other.x, candidate.right));
      const nearestY = Math.max(candidate.top, Math.min(other.y, candidate.bottom));
      return Math.hypot(nearestX - other.x, nearestY - other.y) < other.radius + 1;
    };
    const chosen = candidates.find((candidate) => fits(candidate) && !placedBoxes.some((box) => overlapsBox(candidate, box)) && !marks.some((other) => overlapsMark(candidate, other)));
    if (!chosen && settings.showLabels) labelCollisionCount += 1;
    const fallback = chosen ?? candidates.find(fits) ?? candidates[0];
    if (settings.showLabels) placedBoxes.push({ left: fallback.left, right: fallback.right, top: fallback.top, bottom: fallback.bottom });
    return { ...mark, index, text, labelX: fallback.x, labelY: fallback.y, textAnchor: fallback.anchor, labelBox: fallback };
  });
  return { frame, items, markCollisionPairs, labelCollisionCount, inset, xAt, yAt };
}

export type PathwayImpactLayoutRow = { term: string; impact: number; fdr: number; count: number };

/** Shared mark and label geometry keeps validation and the exported pathway-impact SVG in sync. */
export function pathwayImpactLayout(settings: VisualizationSettings, rows: PathwayImpactLayoutRow[]) {
  const frame = enrichmentSpecializedFrameMetrics("pathway-impact", settings);
  const significance = rows.map((row) => -Math.log10(row.fdr));
  const paddedDomain = (values: number[]): [number, number] => {
    const extent = numericExtent([...values, 0], true);
    const domain: [number, number] = extent[0] === extent[1] ? [extent[0] - 1, extent[1] + 1] : extent;
    const padding = Math.max((domain[1] - domain[0]) * 0.08, Number.EPSILON);
    return [domain[0] - padding, domain[1] + padding];
  };
  const xDomain = paddedDomain(rows.map((row) => row.impact));
  const yDomain = paddedDomain(significance);
  const significanceDomain = numericExtent([...significance, 0], true);
  const maximumCount = Math.max(...rows.map((row) => row.count), 1);
  const xAt = (value: number) => scaleLinear(value, xDomain, [frame.left, frame.left + frame.plotWidth]);
  const yAt = (value: number) => scaleLinear(value, yDomain, [frame.top + frame.plotHeight, frame.top]);
  const marks = rows.map((row) => ({ ...row, x: xAt(row.impact), y: yAt(-Math.log10(row.fdr)), radius: pathwayImpactRadius(row.count, maximumCount, settings.pointSize) }));
  let markCollisionPairs = 0;
  marks.forEach((mark, index) => marks.slice(index + 1).forEach((other) => {
    if (Math.hypot(mark.x - other.x, mark.y - other.y) < mark.radius + other.radius + 1) markCollisionPairs += 1;
  }));
  const placedBoxes: Array<{ left: number; right: number; top: number; bottom: number }> = [];
  let labelCollisionCount = 0;
  const items = marks.map((mark, index) => {
    const maximumWidth = Math.max(24, frame.plotWidth * 0.32);
    const text = compactLegendLabel(mark.term, settings.tickSize, maximumWidth, 18);
    const width = estimateLegendTextWidth(text, settings.tickSize);
    const height = settings.tickSize * 1.05;
    const sideY = Math.max(frame.top + 1 + height * 0.82, Math.min(frame.top + frame.plotHeight - 1 - height * 0.18, mark.y - 4));
    const candidates = [
      { x: mark.x + mark.radius + 5, y: sideY, anchor: "start" as const, left: mark.x + mark.radius + 5, right: mark.x + mark.radius + 5 + width, top: sideY - height * 0.82, bottom: sideY + height * 0.18 },
      { x: mark.x - mark.radius - 5, y: sideY, anchor: "end" as const, left: mark.x - mark.radius - 5 - width, right: mark.x - mark.radius - 5, top: sideY - height * 0.82, bottom: sideY + height * 0.18 },
      { x: mark.x, y: mark.y - mark.radius - 5, anchor: "middle" as const, left: mark.x - width / 2, right: mark.x + width / 2, top: mark.y - mark.radius - 5 - height * 0.82, bottom: mark.y - mark.radius - 5 + height * 0.18 },
      { x: mark.x, y: mark.y + mark.radius + settings.tickSize, anchor: "middle" as const, left: mark.x - width / 2, right: mark.x + width / 2, top: mark.y + mark.radius + settings.tickSize - height * 0.82, bottom: mark.y + mark.radius + settings.tickSize + height * 0.18 },
    ];
    const fits = (candidate: typeof candidates[number]) => candidate.left >= frame.left + 1 && candidate.right <= frame.left + frame.plotWidth - 1 && candidate.top >= frame.top + 1 && candidate.bottom <= frame.top + frame.plotHeight - 1;
    const overlapsBox = (candidate: typeof candidates[number], box: typeof placedBoxes[number]) => candidate.left < box.right + 2 && candidate.right > box.left - 2 && candidate.top < box.bottom + 2 && candidate.bottom > box.top - 2;
    const overlapsMark = (candidate: typeof candidates[number], other: typeof marks[number]) => {
      if (other === mark) return false;
      const nearestX = Math.max(candidate.left, Math.min(other.x, candidate.right));
      const nearestY = Math.max(candidate.top, Math.min(other.y, candidate.bottom));
      return Math.hypot(nearestX - other.x, nearestY - other.y) < other.radius + 1;
    };
    const chosen = candidates.find((candidate) => fits(candidate) && !placedBoxes.some((box) => overlapsBox(candidate, box)) && !marks.some((other) => overlapsMark(candidate, other)));
    if (!chosen && settings.showLabels) labelCollisionCount += 1;
    const fallback = chosen ?? candidates.find(fits) ?? candidates[0];
    if (settings.showLabels) placedBoxes.push({ left: fallback.left, right: fallback.right, top: fallback.top, bottom: fallback.bottom });
    return { ...mark, index, text, labelX: fallback.x, labelY: fallback.y, textAnchor: fallback.anchor, labelBox: fallback };
  });
  return { frame, xDomain, yDomain, significanceDomain, items, markCollisionPairs, labelCollisionCount };
}

export function petalLabelLayout(settings: VisualizationSettings, labels: string[]) {
  const frame = enrichmentSpecializedFrameMetrics("petal", settings);
  const cx = frame.left + frame.plotWidth / 2;
  const cy = frame.top + frame.plotHeight / 2;
  const maxRadius = Math.min(frame.plotWidth, frame.plotHeight) * 0.36;
  return labels.map((label, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / labels.length;
    const preferredX = cx + Math.cos(angle) * (maxRadius + 8);
    const y = Math.max(frame.top + settings.tickSize, Math.min(frame.top + frame.plotHeight - 2, cy + Math.sin(angle) * (maxRadius + 8) + 3));
    const direction = Math.cos(angle);
    const anchor = direction < -0.2 ? "end" as const : direction > 0.2 ? "start" as const : "middle" as const;
    const available = anchor === "start" ? frame.left + frame.plotWidth - preferredX - 2 : anchor === "end" ? preferredX - frame.left - 2 : 2 * Math.min(preferredX - frame.left - 2, frame.left + frame.plotWidth - preferredX - 2);
    const text = compactLegendLabel(label, settings.tickSize, Math.max(8, available), 12);
    return { angle, x: preferredX, y, textAnchor: anchor, text };
  });
}

export function enrichmentSpecializedLayoutMetrics(type: PlotType, settings: VisualizationSettings, input: EnrichmentSpecializedLayoutInput) {
  const frame = enrichmentSpecializedFrameMetrics(type, settings);
  const rows = Math.max(1, input.rowCount);
  const groups = Math.max(1, input.groupCount ?? 1);
  const terms = Math.max(1, input.termCount ?? rows);
  const genes = Math.max(1, input.geneCount ?? rows);
  const radius = Math.min(frame.plotWidth, frame.plotHeight) * 0.38;
  const circleOrbit = Math.min(frame.plotWidth, frame.plotHeight) * 0.32;
  const circleSpacing = 2 * Math.PI * circleOrbit / rows;
  const circleMinimum = settings.showLabels ? Math.max(34, settings.tickSize * 4.2) : 34;
  const groupCellWidth = frame.plotWidth / groups;
  const groupLegendMinimum = Math.max(42, Math.min(92, (input.maximumGroupLabelWidth ?? 0) + 15));
  const termArcSpacing = Math.PI * 0.9 * radius / terms;
  const geneArcSpacing = Math.PI * 0.9 * radius / genes;
  const chordMinimum = settings.showLabels ? Math.max(10, settings.tickSize + 3) : 10;
  const rowSpacing = frame.plotHeight / rows;
  const nesMinimum = Math.max(settings.tickSize + 3, settings.pointSize * 1.4 + 3);
  const ridgeMinimum = settings.tickSize + 6;
  const sankeyMinimum = Math.max(30, settings.showLabels ? settings.tickSize + 4 : 0);
  const gseaLabelFont = Math.max(8, settings.legendSize - 1);
  const gseaLabelBlock = groups * (gseaLabelFont + 3);
  const petalArcSpacing = 2 * Math.PI * Math.min(frame.plotWidth, frame.plotHeight) * 0.36 / rows;
  const petalMinimum = settings.showLabels ? settings.tickSize * 3.6 : 9;
  const cloudColumns = Math.max(2, Math.ceil(Math.sqrt(rows)));
  const cloudRows = Math.ceil(rows / cloudColumns);
  const cloudCellWidth = frame.plotWidth / cloudColumns;
  const cloudCellHeight = frame.plotHeight / cloudRows;
  return {
    frame,
    circleSpacing,
    circleMinimum,
    groupCellWidth,
    groupLegendMinimum,
    termArcSpacing,
    geneArcSpacing,
    chordMinimum,
    rowSpacing,
    nesMinimum,
    ridgeMinimum,
    sankeyMinimum,
    gseaLabelBlock,
    gseaLabelCapacity: frame.plotHeight * 0.42,
    petalArcSpacing,
    petalMinimum,
    cloudCellWidth,
    cloudCellHeight,
  };
}

/** Character-aware conservative truncation keeps Arial legend text inside its assigned cell. */
export function compactLegendLabel(label: string, fontSize: number, availablePixels: number, maximumCharacters: number) {
  const maximum = Math.max(1, maximumCharacters);
  if (label.length <= maximum && estimateLegendTextWidth(label, fontSize) <= availablePixels) return label;
  for (let capacity = Math.min(maximum, label.length); capacity >= 2; capacity -= 1) {
    const candidate = `${label.slice(0, capacity - 1)}…`;
    if (estimateLegendTextWidth(candidate, fontSize) <= availablePixels) return candidate;
  }
  return "…";
}

export function ordinationScoreDomains(
  type: OrdinationType,
  dataset: ParsedDataset,
  mapping: Record<string, string>,
  settings: VisualizationSettings,
) {
  const displayedXColumn = type === "pca" && settings.swapAxes ? mapping.y : mapping.x;
  const displayedYColumn = type === "pca" && settings.swapAxes ? mapping.x : mapping.y;
  const points = dataset.rows.map((row) => ({
    x: parseNumericValue(row[displayedXColumn]) ?? 0,
    y: parseNumericValue(row[displayedYColumn]) ?? 0,
    group: mapping.group ? row[mapping.group] || "All" : "All",
  }));
  const groups = [...new Set(points.map((point) => point.group))];
  const ellipseBoundary = settings.ordinationShowEllipse
    ? groups.flatMap((group) => covarianceEllipsePoints(points.filter((point) => point.group === group)))
    : [];
  // A convex hull cannot extend beyond the raw extrema, so raw points plus the
  // covariance boundary fully determine the renderer's automatic score domain.
  const rawXExtent = numericExtent([...points.map((point) => point.x), ...ellipseBoundary.map((point) => point.x)]);
  const rawYExtent = numericExtent([...points.map((point) => point.y), ...ellipseBoundary.map((point) => point.y)]);
  const symmetricExtent = (extent: [number, number]): [number, number] => {
    const maximum = Math.max(Math.abs(extent[0]), Math.abs(extent[1]), 1e-6);
    return [-maximum, maximum];
  };
  return {
    displayedXColumn,
    displayedYColumn,
    xDomain: resolveAxisDomain(settings.ordinationShowLoadings && type === "pca" && settings.xMin === null && settings.xMax === null ? symmetricExtent(rawXExtent) : rawXExtent, settings.xMin, settings.xMax),
    yDomain: resolveAxisDomain(settings.ordinationShowLoadings && type === "pca" && settings.yMin === null && settings.yMax === null ? symmetricExtent(rawYExtent) : rawYExtent, settings.yMin, settings.yMax),
  };
}

export function ordinationLoadingLayout(
  dataset: ParsedDataset,
  mapping: Record<string, string>,
  settings: VisualizationSettings,
) {
  const frame = ordinationFrameMetrics("pca", settings);
  const domains = ordinationScoreDomains("pca", dataset, mapping, settings);
  const componentIndex = (header: string) => Math.max(0, Number(header?.match(/\d+/)?.[0] ?? 1) - 1);
  const selected = (dataset.analysis?.pca?.loadings ?? [])
    .map((loading) => ({
      feature: loading.feature,
      x: loading.coordinates[componentIndex(domains.displayedXColumn)] ?? 0,
      y: loading.coordinates[componentIndex(domains.displayedYColumn)] ?? 0,
    }))
    .filter((loading) => Math.hypot(loading.x, loading.y) > Number.EPSILON)
    .sort((left, right) => Math.hypot(right.x, right.y) - Math.hypot(left.x, left.y))
    .slice(0, settings.ordinationLoadingCount);
  const loadingMaximum = Math.max(...selected.flatMap((loading) => [Math.abs(loading.x), Math.abs(loading.y)]), Number.EPSILON);
  const originX = scaleLinear(0, domains.xDomain, [frame.left, frame.left + frame.plotWidth]);
  const originY = scaleLinear(0, domains.yDomain, [frame.top + frame.plotHeight, frame.top]);
  const fontSize = Math.max(8, settings.tickSize - 1);
  const labelCapacity = Math.max(2, Math.min(12, Math.floor((frame.plotWidth * 0.5 - 14) / fontSize)));
  const desired = selected.map((loading) => ({
    ...loading,
    displayFeature: loading.feature.length <= labelCapacity ? loading.feature : `${loading.feature.slice(0, Math.max(1, labelCapacity - 1))}…`,
    dx: loading.x / loadingMaximum * frame.plotWidth * 0.28,
    dy: -loading.y / loadingMaximum * frame.plotHeight * 0.28,
  }));
  const safetyScale = Math.max(0, Math.min(1, ...desired.flatMap((loading) => {
    const labelWidth = loading.displayFeature.length * fontSize + 5;
    const horizontal = loading.dx > 0 ? (frame.left + frame.plotWidth - originX - labelWidth) / loading.dx : loading.dx < 0 ? (originX - frame.left - labelWidth) / -loading.dx : 1;
    const vertical = loading.dy > 0 ? (frame.top + frame.plotHeight - originY - 3) / loading.dy : loading.dy < 0 ? (originY - frame.top - fontSize - 3) / -loading.dy : 1;
    return [horizontal, vertical];
  })));
  const geometries = desired.map((loading) => ({
    ...loading,
    endX: originX + loading.dx * safetyScale,
    endY: originY + loading.dy * safetyScale,
  }));
  const minimumArrowLength = geometries.length
    ? Math.min(...geometries.map((loading) => Math.hypot(loading.endX - originX, loading.endY - originY)))
    : Number.POSITIVE_INFINITY;
  return { frame, ...domains, originX, originY, fontSize, safetyScale, geometries, minimumArrowLength };
}

export const journalThemes: Record<JournalThemeId, JournalTheme> = {
  "minimal-ink": {
    id: "minimal-ink",
    series: "minimal",
    name: "石墨",
    description: "近单色石墨阶梯，适合需要最大克制感的比较图。",
    categorical: ["#4A4D52", "#696D73", "#898E94", "#ABB0B5", "#565A5F", "#74797E", "#969BA0", "#B9BDC1"],
    sequential: ["#F0F1F2", "#4A4D52"],
    diverging: ["#657B89", "#F7F7F5", "#A86F68"],
    ink: "#25292E",
    muted: "#6C737B",
    grid: "#E4E6E7",
  },
  "minimal-cobalt": {
    id: "minimal-cobalt",
    series: "minimal",
    name: "墨蓝",
    description: "一组蓝灰明度阶梯，以墨蓝作为唯一强调色。",
    categorical: ["#2878B5", "#5595C3", "#82B0D2", "#B7D5E8", "#515B64", "#707A83", "#929AA2", "#B7BDC2"],
    sequential: ["#EDF5FA", "#2878B5"],
    diverging: ["#2878B5", "#F7F7F5", "#E88482"],
    ink: "#26333F",
    muted: "#687784",
    grid: "#E2E7EA",
  },
  "minimal-pine": {
    id: "minimal-pine",
    series: "minimal",
    name: "松柏",
    description: "一组松绿色阶梯，安静、自然，适合组学与生态数据。",
    categorical: ["#3F8F7F", "#63A694", "#8FCFC9", "#BDDCD7", "#4F5B57", "#6F7B77", "#919B98", "#B6BEBC"],
    sequential: ["#EDF7F4", "#3F8F7F"],
    diverging: ["#3F8F7F", "#F7F7F4", "#E88482"],
    ink: "#293B36",
    muted: "#6A7A74",
    grid: "#E2E8E5",
  },
  "minimal-clay": {
    id: "minimal-clay",
    series: "minimal",
    name: "陶赭",
    description: "一组温暖陶赭阶梯，适合临床与实验比较图。",
    categorical: ["#C86852", "#E0846E", "#F2A08D", "#F7C2B5", "#5C5350", "#7A706C", "#9A908C", "#BAB2AE"],
    sequential: ["#FBEFEB", "#C86852"],
    diverging: ["#5F97D2", "#F8F7F4", "#C86852"],
    ink: "#46342E",
    muted: "#806F68",
    grid: "#EAE3DF",
  },
  "minimal-plum": {
    id: "minimal-plum",
    series: "minimal",
    name: "梅灰",
    description: "一组克制梅紫阶梯，适合强调单一研究主题。",
    categorical: ["#8B6FB0", "#A186C1", "#B8A2D0", "#D1C4E1", "#575158", "#756E76", "#958E96", "#B8B1B8"],
    sequential: ["#F4F0F7", "#8B6FB0"],
    diverging: ["#5F97D2", "#F8F7F5", "#B883D4"],
    ink: "#3E303A",
    muted: "#786B74",
    grid: "#E8E2E6",
  },
  nature: {
    id: "nature",
    series: "journal",
    name: "Nature",
    description: "Cool blue, coral red, and restrained botanical accents.",
    categorical: ["#8FCFC9", "#FFBE7A", "#FA7F6F", "#82B0D2", "#BEB8DC", "#E7DAD2", "#999999", "#6BAED6"],
    sequential: ["#EDF6F5", "#3E8E89"],
    diverging: ["#2878B5", "#F7F7F4", "#E46E61"],
    ink: "#23242A",
    muted: "#686A73",
    grid: "#E5E5E1",
  },
  cell: {
    id: "cell",
    series: "journal",
    name: "Cell",
    description: "Warm coral, teal, plum, and muted gold for mechanistic figures.",
    categorical: ["#934B43", "#D76364", "#EF7A6D", "#F1D77E", "#B1CE46", "#63CFA0", "#9394E7", "#5F97D2"],
    sequential: ["#FFF2EE", "#D76364"],
    diverging: ["#5F97D2", "#FAF7F2", "#EF7A6D"],
    ink: "#252427",
    muted: "#6B6768",
    grid: "#E8E2DD",
  },
  science: {
    id: "science",
    series: "journal",
    name: "Science",
    description: "High-clarity navy, red, green, and purple with strong separation.",
    categorical: ["#2878B5", "#9AC9DB", "#F8AC8C", "#C82423", "#FF8884", "#5A9F68", "#8D7DBE", "#6F6F6F"],
    sequential: ["#EEF5F9", "#2878B5"],
    diverging: ["#2878B5", "#F7F7F6", "#C82423"],
    ink: "#1F2025",
    muted: "#62656D",
    grid: "#E2E4E8",
  },
  nejm: {
    id: "nejm",
    series: "journal",
    name: "NEJM",
    description: "Clinical oxblood, steel blue, muted teal, and restrained ochre.",
    categorical: ["#496C88", "#A5B6C5", "#FEB2B4", "#7E8FA4", "#D79B9C", "#C9D3DD", "#B9A3A4", "#767676"],
    sequential: ["#EEF2F5", "#496C88"],
    diverging: ["#496C88", "#F8F6F2", "#E88482"],
    ink: "#252326",
    muted: "#6E686B",
    grid: "#E8E3E2",
  },
  lancet: {
    id: "lancet",
    series: "journal",
    name: "Lancet",
    description: "Editorial burgundy, deep teal, warm amber, and composed slate.",
    categorical: ["#8E8BFE", "#FEA3A2", "#E88482", "#6F6F6F", "#6F91D7", "#B99BE5", "#F3C27D", "#79B8A4"],
    sequential: ["#F2F0FF", "#8E8BFE"],
    diverging: ["#8E8BFE", "#FAF7F2", "#E88482"],
    ink: "#262326",
    muted: "#6D686C",
    grid: "#E7E2E4",
  },
  jama: {
    id: "jama",
    series: "journal",
    name: "JAMA",
    description: "Medical teal, burnished orange, clear cyan, and muted wine.",
    categorical: ["#A1A9D0", "#F0988C", "#B883D4", "#9E9E9E", "#CFEAF1", "#C4A5DE", "#F6CAE5", "#96CCCB"],
    sequential: ["#F2F5FA", "#A1A9D0"],
    diverging: ["#96CCCB", "#F7F6F2", "#F0988C"],
    ink: "#23282A",
    muted: "#687176",
    grid: "#E2E7E7",
  },
  nordic: {
    id: "nordic",
    series: "curated",
    name: "Nordic",
    description: "Cool navy and fjord teal balanced by clay, straw, and soft violet.",
    categorical: ["#14517C", "#2F7FC1", "#96C37D", "#F3D266", "#D8383A", "#C497B2", "#A9B8C6", "#E7EFFA"],
    sequential: ["#E7EFFA", "#2F7FC1"],
    diverging: ["#2F7FC1", "#F7F5EF", "#D8383A"],
    ink: "#22282C",
    muted: "#647078",
    grid: "#E1E7E8",
  },
  earth: {
    id: "earth",
    series: "curated",
    name: "Earth",
    description: "Botanical green, terracotta, ochre, aubergine, and mineral blue.",
    categorical: ["#3B4E3D", "#AF5F54", "#E5B552", "#655045", "#D3A488", "#283F3E", "#DFBE96", "#8B6B5B"],
    sequential: ["#F1EFE5", "#3B4E3D"],
    diverging: ["#283F3E", "#F6F2E8", "#AF5F54"],
    ink: "#292825",
    muted: "#706D65",
    grid: "#E7E3D8",
  },
  colorblind: {
    id: "colorblind",
    series: "curated",
    name: "Colorblind",
    description: "Okabe–Ito-derived contrasts tuned for legibility on a white background.",
    categorical: ["#0072B2", "#D55E00", "#009E73", "#CC79A7", "#E69F00", "#56B4E9", "#F0E442", "#6B6B6B"],
    sequential: ["#EAF4F8", "#0072B2"],
    diverging: ["#0072B2", "#F7F7F3", "#D55E00"],
    ink: "#222426",
    muted: "#666B70",
    grid: "#E2E6E8",
  },
  "cn-beihai": {
    id: "cn-beihai",
    series: "chinese-traditional",
    name: "柴染棕",
    description: "北海公园：柴染棕、青灰蓝、薄香橙与飞泉青。",
    categorical: ["#957454", "#1D4C50", "#D4A278", "#3F605B"],
    sequential: ["#F3E6DC", "#3F605B"],
    diverging: ["#1D4C50", "#FAF8F4", "#D4A278"],
    ink: "#1D4C50",
    muted: "#957454",
    grid: "#F1E7E5",
  },
  "cn-imperial-orange": {
    id: "cn-imperial-orange",
    series: "chinese-traditional",
    name: "橙绯红",
    description: "贵气天成：橙绯红、石槲绿、洗柿橙与伽罗褐。",
    categorical: ["#DB5E40", "#2E2F25", "#E68959", "#866040"],
    sequential: ["#F6E2D8", "#DB5E40"],
    diverging: ["#2E2F25", "#FCF8F3", "#E68959"],
    ink: "#2E2F25",
    muted: "#866040",
    grid: "#F1E7E5",
  },
  "cn-wisteria": {
    id: "cn-wisteria",
    series: "chinese-traditional",
    name: "淡藤萝紫",
    description: "园博园：淡藤萝紫、青灰蓝、赤白橡与芦穗灰。",
    categorical: ["#F1E7E5", "#1D4C50", "#D3A488", "#BDAEAD"],
    sequential: ["#F1E7E5", "#1D4C50"],
    diverging: ["#1D4C50", "#FCF9F8", "#D3A488"],
    ink: "#1D4C50",
    muted: "#BDAEAD",
    grid: "#F1E7E5",
  },
  "cn-sunset": {
    id: "cn-sunset",
    series: "chinese-traditional",
    name: "瓜瓤粉",
    description: "夕阳古楼：瓜瓤粉、长石灰、金莺黄与淡玫瑰灰。",
    categorical: ["#F7CD9B", "#313534", "#F0A72E", "#AE7F77"],
    sequential: ["#FFF2DE", "#F0A72E"],
    diverging: ["#313534", "#FFF9F2", "#F0A72E"],
    ink: "#313534",
    muted: "#AE7F77",
    grid: "#F1E7E5",
  },
  "cn-hutong": {
    id: "cn-hutong",
    series: "chinese-traditional",
    name: "蓝墨茶",
    description: "京城胡同：蓝墨茶、赤白橡、中红驼与岩碇黑。",
    categorical: ["#3E443C", "#D3A488", "#8B6B5B", "#24271E"],
    sequential: ["#F1E3D9", "#3E443C"],
    diverging: ["#24271E", "#FAF7F3", "#D3A488"],
    ink: "#24271E",
    muted: "#8B6B5B",
    grid: "#F1E7E5",
  },
  "cn-dragon": {
    id: "cn-dragon",
    series: "chinese-traditional",
    name: "棉絮灰",
    description: "盘龙纹：棉絮灰、老茶棕、淡红穹与苍灰绿。",
    categorical: ["#B5A59B", "#655045", "#AF5F54", "#3B4E3D"],
    sequential: ["#E9E1DC", "#3B4E3D"],
    diverging: ["#3B4E3D", "#FAF7F5", "#AF5F54"],
    ink: "#3B4E3D",
    muted: "#655045",
    grid: "#F1E7E5",
  },
  "cn-coral": {
    id: "cn-coral",
    series: "chinese-traditional",
    name: "珊瑚朱",
    description: "京城脚下：珊瑚朱、铜器青、藏花红与淡土棕。",
    categorical: ["#DB785C", "#283F3E", "#E9A182", "#824E40"],
    sequential: ["#F8E5DC", "#DB785C"],
    diverging: ["#283F3E", "#FCF8F4", "#DB785C"],
    ink: "#283F3E",
    muted: "#824E40",
    grid: "#F1E7E5",
  },
  "cn-autumn": {
    id: "cn-autumn",
    series: "chinese-traditional",
    name: "杏叶黄",
    description: "故宫之秋：杏叶黄、岩碇黑、穹灰蓝与鹿角棕。",
    categorical: ["#E5B552", "#24271E", "#CCD8D0", "#DFBE96"],
    sequential: ["#F6EDCF", "#E5B552"],
    diverging: ["#24271E", "#FBF9F3", "#E5B552"],
    ink: "#24271E",
    muted: "#DFBE96",
    grid: "#F1E7E5",
  },
  "cn-vermilion": {
    id: "cn-vermilion",
    series: "chinese-traditional",
    name: "中国红",
    description: "青铜兽环：中国红、深栗棕、淡枣红与鹿角棕。",
    categorical: ["#BF1103", "#580F05", "#970804", "#DFBE96"],
    sequential: ["#F5DECF", "#BF1103"],
    diverging: ["#580F05", "#FCF7F3", "#BF1103"],
    ink: "#580F05",
    muted: "#970804",
    grid: "#F1E7E5",
  },
};

function buildUmapExample() {
  const clusters = [
    { group: "Control", cx: -3.1, cy: 1.5, count: 24 },
    { group: "Responder", cx: 0.2, cy: -1.8, count: 26 },
    { group: "Resistant", cx: 3.4, cy: 1.2, count: 24 },
  ];
  const rows = clusters.flatMap(({ group, cx, cy, count }) => Array.from({ length: count }, (_, index) => {
    const angle = index * 2.3999632297;
    const radius = 0.18 + 0.11 * Math.sqrt(index + 1);
    const x = cx + Math.cos(angle) * radius * 1.35 + Math.sin(index * 0.73) * 0.12;
    const y = cy + Math.sin(angle) * radius * 0.82 + Math.cos(index * 0.51) * 0.1;
    const z = Math.sin(angle * 0.7) * 0.9 + (group === "Responder" ? -0.7 : group === "Resistant" ? 0.8 : 0);
    const batch = index % 2 === 0 ? "Batch 1" : "Batch 2";
    return `${group.slice(0, 3)}_${String(index + 1).padStart(2, "0")}\t${x.toFixed(3)}\t${y.toFixed(3)}\t${z.toFixed(3)}\t${group}\t${batch}`;
  }));
  return `sample\tdim1\tdim2\tdim3\tgroup\tshape\n${rows.join("\n")}`;
}

function buildOrdinationExample(kind: "pcoa" | "tsne" | "nmds") {
  const clusters = kind === "nmds"
    ? [{ group: "Forest", cx: -0.62, cy: 0.28 }, { group: "Grassland", cx: 0.04, cy: -0.42 }, { group: "Wetland", cx: 0.62, cy: 0.31 }]
    : kind === "tsne"
      ? [{ group: "Type A", cx: -7.2, cy: 4.8 }, { group: "Type B", cx: 0.4, cy: -5.6 }, { group: "Type C", cx: 7.4, cy: 3.9 }]
      : [{ group: "Control", cx: -2.4, cy: 0.8 }, { group: "Treatment A", cx: 0.15, cy: -1.55 }, { group: "Treatment B", cx: 2.55, cy: 0.95 }];
  const rows = clusters.flatMap(({ group, cx, cy }, groupIndex) => Array.from({ length: 14 }, (_, index) => {
    const angle = index * 2.3999632297 + groupIndex * 0.37;
    const scale = kind === "nmds" ? 0.055 : kind === "tsne" ? 0.58 : 0.2;
    const radius = (1.3 + Math.sqrt(index + 1) * 0.42) * scale;
    const x = cx + Math.cos(angle) * radius * 1.25;
    const y = cy + Math.sin(angle) * radius * 0.78;
    const z = groupIndex * 0.8 - 0.8 + Math.sin(angle * 0.8) * scale * 2;
    return `${group.replaceAll(" ", "_").slice(0, 5)}_${String(index + 1).padStart(2, "0")}\t${x.toFixed(4)}\t${y.toFixed(4)}\t${z.toFixed(4)}\t${group}\t${index % 2 === 0 ? "Cohort 1" : "Cohort 2"}`;
  }));
  return `sample\tdim1\tdim2\tdim3\tgroup\tshape\n${rows.join("\n")}`;
}

function buildGseaExample() {
  const totalRanks = 100;
  const hitLabels = new Map<number, string>([
    [3, "TP53"], [5, "CDKN1A"], [8, "BAX"], [12, "BBC3"], [16, "GADD45A"],
    [21, "FAS"], [27, "CASP8"], [35, "MDM2"], [49, "SESN1"], [68, "DDB2"],
  ]);
  const hitIncrement = 0.11;
  const missDecrement = (hitLabels.size * hitIncrement) / (totalRanks - hitLabels.size);
  let score = 0;
  const rows = Array.from({ length: totalRanks }, (_, index) => {
    const rank = index + 1;
    const geneLabel = hitLabels.get(rank);
    score += geneLabel ? hitIncrement : -missDecrement;
    if (rank === totalRanks) score = 0;
    return `${rank}\t${score.toFixed(4)}\t${geneLabel ? 1 : 0}\t${geneLabel ?? "—"}`;
  });
  return `rank\trunningES\thit\tlabel\n${rows.join("\n")}`;
}

function buildKaplanMeierExample() {
  const highRisk = Array.from({ length: 24 }, (_, index) => {
    const time = 2 + index * 0.9 + (index % 3) * 0.25;
    const event = index % 6 === 4 ? 0 : 1;
    return `${time.toFixed(1)}\t${event}\tHigh risk`;
  });
  const lowRisk = Array.from({ length: 24 }, (_, index) => {
    const time = 4 + index * 1.25 + (index % 4) * 0.35;
    const event = index < 8 ? (index % 4 === 3 ? 1 : 0) : (index % 3 === 1 ? 1 : 0);
    return `${time.toFixed(1)}\t${event}\tLow risk`;
  });
  return `time\tevent\tgroup\n${[...highRisk, ...lowRisk].join("\n")}`;
}

function buildHeatmapExample() {
  const genes = [
    "TP53", "CDKN1A", "BAX", "BBC3", "EGFR", "ERBB2", "MYC", "CCND1",
    "MKI67", "PCNA", "TOP2A", "BIRC5", "EPCAM", "CDH1", "KRT8", "KRT18",
    "VIM", "SNAI1", "SNAI2", "ZEB1", "BCL2", "MCL1", "GAPDH", "ACTB",
  ];
  const samples = [
    ...Array.from({ length: 6 }, (_, index) => `Control_${index + 1}`),
    ...Array.from({ length: 6 }, (_, index) => `Treatment_${index + 1}`),
  ];
  const rows = genes.map((gene, geneIndex) => {
    const moduleIndex = Math.floor(geneIndex / 4);
    const base = 5.1 + (geneIndex % 5) * 0.48 + Math.floor(geneIndex / 8) * 0.22;
    const values = samples.map((_, sampleIndex) => {
      const treated = sampleIndex >= 6;
      const replicate = sampleIndex % 6;
      const direction = moduleIndex % 4 === 0 ? 1.65 : moduleIndex % 4 === 1 ? -1.45 : moduleIndex % 4 === 2 ? 1.05 : moduleIndex % 4 === 3 ? -0.9 : 0;
      const biologicalShift = treated ? direction : 0;
      const replicateEffect = Math.sin((geneIndex + 1) * 0.81 + replicate * 1.17) * 0.2;
      const batchEffect = (replicate - 2.5) * 0.035 + (sampleIndex % 2 ? 0.06 : -0.04);
      return (base + biologicalShift + replicateEffect + batchEffect).toFixed(2);
    });
    return `${gene}\t${values.join("\t")}`;
  });
  return `gene\t${samples.join("\t")}\n${rows.join("\n")}`;
}

function buildRocExample() {
  const models = [
    { name: "Model A", positiveBase: 0.54, positiveSpan: 0.43, negativeBase: 0.13, negativeSpan: 0.62 },
    { name: "Model B", positiveBase: 0.42, positiveSpan: 0.48, negativeBase: 0.18, negativeSpan: 0.64 },
  ];
  const rows = models.flatMap((model, modelIndex) => Array.from({ length: 60 }, (_, index) => {
    const truth = index % 2 === 0 ? 1 : 0;
    const rank = Math.floor(index / 2) / 29;
    const wave = Math.sin((index + 1) * (modelIndex + 1) * 1.37) * 0.035;
    const score = truth
      ? model.positiveBase + model.positiveSpan * (1 - rank) + wave
      : model.negativeBase + model.negativeSpan * (1 - rank) - wave;
    return `S${String(index + 1).padStart(2, "0")}\t${truth}\t${Math.max(0.01, Math.min(0.99, score)).toFixed(4)}\t${model.name}`;
  }));
  return `sample\ttruth\tscore\tmodel\n${rows.join("\n")}`;
}

function buildTimeDependentRocExample() {
  const curves = [
    { model: "Clinical model", horizon: 12, auc: 0.742, lower: 0.681, upper: 0.803, lift: 0.66 },
    { model: "Clinical model", horizon: 36, auc: 0.781, lower: 0.724, upper: 0.838, lift: 0.74 },
    { model: "Integrated model", horizon: 12, auc: 0.816, lower: 0.764, upper: 0.868, lift: 0.83 },
    { model: "Integrated model", horizon: 36, auc: 0.847, lower: 0.799, upper: 0.895, lift: 0.91 },
  ];
  const rows = curves.flatMap((curve) => Array.from({ length: 11 }, (_, index) => {
    const fpr = index / 10;
    const tpr = Math.min(1, Math.pow(fpr, 1 / (1 + curve.lift * 3.2)));
    const halfWidth = index === 0 || index === 10 ? 0 : 0.035 + Math.sin(Math.PI * fpr) * 0.025;
    return [fpr, tpr, Math.max(0, tpr - halfWidth), Math.min(1, tpr + halfWidth), curve.horizon, curve.model, curve.auc, curve.lower, curve.upper].map((value) => typeof value === "number" ? value.toFixed(3) : value).join("\t");
  }));
  return `fpr\ttpr\ttpr_lower\ttpr_upper\thorizon\tgroup\tauc\tauc_lower\tauc_upper\n${rows.join("\n")}`;
}

const demoChromosomeLengths = [249_250_621, 243_199_373, 198_022_430, 191_154_276, 180_915_260, 171_115_067, 159_138_663, 146_364_022, 141_213_431, 135_534_747, 135_006_516, 133_851_895];

function buildManhattanExample() {
  const peaks = new Map([["2-7", 2.1e-10], ["6-11", 7.4e-9], ["10-4", 4.8e-12]]);
  const rows = demoChromosomeLengths.flatMap((length, chromosomeIndex) => Array.from({ length: 18 }, (_, index) => {
    const chromosome = chromosomeIndex + 1;
    const position = Math.round(length * (index + 1) / 19);
    const key = `${chromosome}-${index}`;
    const background = Math.max(1e-6, Math.min(0.98, 0.012 + Math.abs(Math.sin((chromosomeIndex + 1) * 1.31 + index * 0.77)) * 0.82));
    const pValue = peaks.get(key) ?? background;
    const label = peaks.has(key) ? ["LINC01234", "HLA-DQA1", "TERT"][key === "2-7" ? 0 : key === "6-11" ? 1 : 2] : `rs${chromosome}${String(index + 1).padStart(3, "0")}`;
    return `chr${chromosome}\t${position}\t${pValue}\t${label}`;
  }));
  return `chromosome\tposition\tp_value\tvariant\n${rows.join("\n")}`;
}

function buildQqExample() {
  const rows = Array.from({ length: 120 }, (_, index) => {
    const expected = (index + 0.5) / 120;
    const tail = index < 7 ? expected ** 2.25 : expected * (0.92 + 0.08 * Math.sin(index * 1.7) ** 2);
    return `${Math.max(1e-12, Math.min(0.999, tail)).toPrecision(6)}\trs${String(index + 1).padStart(5, "0")}`;
  });
  return `p_value\tvariant\n${rows.join("\n")}`;
}

function buildIdeogramExample() {
  const stains = ["gneg", "gpos25", "gpos50", "gpos75", "gpos100"];
  const rows = demoChromosomeLengths.flatMap((length, index) => Array.from({ length: 5 }, (_, band) => {
    const start = Math.round(length * band / 5);
    const end = band === 4 ? length : Math.round(length * (band + 1) / 5);
    return `chr${index + 1}\t${start}\t${end}\t${stains[(band + index) % stains.length]}\t${index + 1}${band < 2 ? "p" : "q"}${band + 1}`;
  }));
  return `chromosome\tstart\tend\tstain\tband\n${rows.join("\n")}`;
}

function buildSnpDensityExample() {
  const rows = demoChromosomeLengths.flatMap((length, index) => Array.from({ length: 10 }, (_, bin) => {
    const start = Math.round(length * bin / 10);
    const end = bin === 9 ? length : Math.round(length * (bin + 1) / 10);
    const count = Math.round(18 + 62 * Math.abs(Math.sin((index + 1) * 0.83 + bin * 0.57)));
    return `chr${index + 1}\t${start}\t${end}\t${count}`;
  }));
  return `chromosome\tstart\tend\tvariant_count\n${rows.join("\n")}`;
}

function buildAlterationExample() {
  const genes = ["TP53", "PIK3CA", "KRAS", "EGFR", "PTEN", "RB1", "KEAP1", "STK11", "ERBB2", "BRAF"];
  const types = ["Missense", "Nonsense", "Frameshift", "Amplification", "Deletion", "Splice", "Fusion"];
  const rows: string[] = [];
  Array.from({ length: 24 }, (_, sampleIndex) => {
    const sample = `P${String(sampleIndex + 1).padStart(2, "0")}`;
    genes.forEach((gene, geneIndex) => {
      const enriched = geneIndex === 0 ? sampleIndex % 3 !== 1 : geneIndex === 1 ? sampleIndex % 4 === 0 : (sampleIndex * 3 + geneIndex * 5) % 17 < 2;
      if (!enriched) return;
      rows.push(`${sample}\t${gene}\t${types[(sampleIndex + geneIndex * 2) % types.length]}`);
      if ((sampleIndex + geneIndex) % 19 === 0) rows.push(`${sample}\t${gene}\tAmplification`);
    });
  });
  return `sample\tgene\talteration\n${rows.join("\n")}`;
}

function buildMultiGseaExample() {
  const sets = [
    { name: "Interferon response", nes: 2.18, fdr: 0.004, phase: 0.15, hits: new Set([2, 4, 7, 9, 13, 18, 24, 31, 42, 54]) },
    { name: "Oxidative phosphorylation", nes: -1.74, fdr: 0.018, phase: 1.35, hits: new Set([8, 16, 27, 38, 45, 50, 55, 58]) },
    { name: "DNA repair", nes: 1.52, fdr: 0.041, phase: 2.45, hits: new Set([3, 11, 15, 22, 29, 33, 41, 49, 57]) },
  ];
  const background = 18_000;
  const rows = sets.flatMap((set, setIndex) => Array.from({ length: 61 }, (_, rankIndex) => {
    const rank = rankIndex * (background / 60);
    const position = rank / background;
    const direction = set.nes < 0 ? -1 : 1;
    const envelope = Math.sin(position * Math.PI);
    const score = direction * envelope * (0.42 + 0.08 * Math.sin(position * Math.PI * 3 + set.phase)) * (1 - setIndex * .09);
    return `${rank}\t${score.toFixed(4)}\t${set.hits.has(rankIndex) ? 1 : 0}\t${set.name}\t${set.nes}\t${set.fdr}\t${background}`;
  }));
  return `rank\trunningES\thit\tset\tNES\tFDR\tbackground\n${rows.join("\n")}`;
}

function buildEnrichmentRidgeExample() {
  const terms = ["Interferon response", "DNA repair", "Cell cycle", "Apoptosis", "Metabolism"];
  const rows = terms.flatMap((term, termIndex) => Array.from({ length: 16 }, (_, index) => {
    const score = -2.4 + index * .32 + Math.sin((index + 1) * (termIndex + 2) * .41) * .38 + (2 - termIndex) * .22;
    return `${term}\tGene_${termIndex + 1}_${String(index + 1).padStart(2, "0")}\t${score.toFixed(3)}\t${(0.004 + termIndex * .008).toFixed(3)}\t${(0.18 + termIndex * .025).toFixed(3)}\t18000`;
  }));
  return `term\tgene\tscore\tFDR\tgeneRatio\tbackground\n${rows.join("\n")}`;
}

const samples = {
  bar: `category\tvalue\tsd\tsem\tgroup
Control\t4.2\t0.45\t0.20\tControl
Treatment A\t7.8\t0.72\t0.32\tTreatment A
Treatment B\t6.3\t0.58\t0.26\tTreatment B
Treatment C\t9.1\t0.81\t0.36\tTreatment C`,
  barCount: `category\tvalue\tgroup
Low\t18\tNight A
Medium\t32\tNight B
High\t27\tNight C
Very high\t14\tNight D`,
  barLong: `category\tvalue\tgroup\tfacet
Day 1\t3.7\tControl\tEarly
Day 1\t3.9\tControl\tEarly
Day 1\t4.0\tControl\tEarly
Day 1\t4.4\tTreatment\tEarly
Day 1\t4.6\tTreatment\tEarly
Day 1\t4.7\tTreatment\tEarly
Day 7\t7.1\tControl\tLate
Day 7\t7.3\tControl\tLate
Day 7\t7.2\tControl\tLate
Day 7\t8.2\tTreatment\tLate
Day 7\t8.5\tTreatment\tLate
Day 7\t8.4\tTreatment\tLate`,
  barRawIndependent: `category\tvalue\tgroup\tsample_id
Control\t1.02\tGene A\tA-C1
Control\t0.96\tGene A\tA-C2
Control\t1.08\tGene A\tA-C3
Treatment\t1.54\tGene A\tA-T1
Treatment\t1.63\tGene A\tA-T2
Treatment\t1.48\tGene A\tA-T3
Control\t1.01\tGene B\tB-C1
Control\t0.93\tGene B\tB-C2
Control\t1.06\tGene B\tB-C3
Treatment\t0.68\tGene B\tB-T1
Treatment\t0.74\tGene B\tB-T2
Treatment\t0.71\tGene B\tB-T3`,
  barSummaryInference: `category\tvalue\tsd\tsem\tn\tgroup
Control\t1.02\t0.061\t0.035\t3\tGene A
Treatment\t1.55\t0.075\t0.043\t3\tGene A
Control\t1.00\t0.066\t0.038\t3\tGene B
Treatment\t0.71\t0.030\t0.017\t3\tGene B`,
  barPaired: `category\tvalue\tgroup\tsubject_id
Before\t2.1\tMarker A\tP01
After\t2.8\tMarker A\tP01
Before\t2.4\tMarker A\tP02
After\t3.0\tMarker A\tP02
Before\t2.0\tMarker A\tP03
After\t2.9\tMarker A\tP03
Before\t2.5\tMarker A\tP04
After\t3.1\tMarker A\tP04`,
  barQpcr: `category\tgroup\tsample_id\tdelta_ct\trelative_expression
Control\tFBN2\tC01\t6.12\t1.00
Control\tFBN2\tC02\t6.28\t0.90
Control\tFBN2\tC03\t6.03\t1.06
siFBN2\tFBN2\tT01\t8.71\t0.17
siFBN2\tFBN2\tT02\t8.95\t0.14
siFBN2\tFBN2\tT03\t8.62\t0.18
Control\tEGR1\tC04\t4.32\t1.00
Control\tEGR1\tC05\t4.21\t1.08
Control\tEGR1\tC06\t4.39\t0.95
siFBN2\tEGR1\tT04\t4.51\t0.88
siFBN2\tEGR1\tT05\t4.44\t0.92
siFBN2\tEGR1\tT06\t4.62\t0.81`,
  barVariants: `category\tvalue\tsd\tgroup\tsecondary\ttarget\tp_value\tfacet
Day 1\t3.8\t0.31\tControl\t4.0\t4.5\t0.41\tEarly
Day 1\t4.2\t0.36\tTreatment A\t4.4\t4.8\t0.12\tEarly
Day 1\t4.5\t0.40\tTreatment B\t4.6\t5.0\t0.032\tEarly
Day 1\t4.8\t0.42\tTreatment C\t4.9\t5.2\t0.008\tEarly
Day 7\t7.2\t0.54\tControl\t6.8\t7.5\t0.18\tLate
Day 7\t7.8\t0.61\tTreatment A\t7.4\t8.1\t0.041\tLate
Day 7\t8.4\t0.66\tTreatment B\t8.0\t8.8\t0.006\tLate
Day 7\t9.0\t0.72\tTreatment C\t8.6\t9.4\t0.0007\tLate`,
  line: `time\tvalue\tsd\tsem\tn\tseries
0\t1.0\t0.12\t0.069\t3\tControl
1\t1.3\t0.16\t0.092\t3\tControl
2\t1.6\t0.18\t0.104\t3\tControl
3\t1.8\t0.21\t0.121\t3\tControl
0\t1.0\t0.14\t0.081\t3\tTreatment
1\t2.1\t0.24\t0.139\t3\tTreatment
2\t3.5\t0.31\t0.179\t3\tTreatment
3\t4.4\t0.38\t0.219\t3\tTreatment`,
  lineNoError: `time\tvalue\tseries
0\t1.0\tControl
1\t1.3\tControl
2\t1.6\tControl
3\t1.8\tControl
0\t1.0\tTreatment
1\t2.1\tTreatment
2\t3.5\tTreatment
3\t4.4\tTreatment`,
  scatter: `x\ty\tgroup\tlabel
1.2\t1.6\tControl\tS1
1.8\t2.1\tControl\tS2
2.2\t2.4\tControl\tS3
2.5\t3.4\tTreatment\tS4
3.2\t3.7\tTreatment\tS5
3.8\t4.6\tTreatment\tS6
4.4\t5.0\tTreatment\tS7`,
  scatterThreeAxis: `x\ty\tz\tgroup\tlabel
0.62\t0.24\t0.14\tControl\tS1
0.55\t0.31\t0.14\tControl\tS2
0.48\t0.36\t0.16\tControl\tS3
0.41\t0.42\t0.17\tControl\tS4
0.30\t0.50\t0.20\tTreatment\tS5
0.24\t0.55\t0.21\tTreatment\tS6
0.20\t0.49\t0.31\tTreatment\tS7
0.16\t0.44\t0.40\tTreatment\tS8
0.12\t0.38\t0.50\tTreatment\tS9`,
  pcaScores: `sample\tPC1\tPC2\tPC3\tgroup\tbatch\tlabel
C1\t-3.42\t0.88\t0.21\tControl\tBatch 1\tControl 1
C2\t-3.05\t0.22\t-0.36\tControl\tBatch 2\tControl 2
C3\t-2.61\t1.34\t0.08\tControl\tBatch 1\tControl 3
C4\t-2.28\t0.61\t0.42\tControl\tBatch 2\tControl 4
T1\t0.74\t-1.62\t0.31\tTreatment A\tBatch 1\tTreatment A1
T2\t1.18\t-1.05\t-0.28\tTreatment A\tBatch 2\tTreatment A2
T3\t1.46\t-2.08\t0.16\tTreatment A\tBatch 1\tTreatment A3
T4\t0.52\t-0.74\t-0.41\tTreatment A\tBatch 2\tTreatment A4
R1\t2.15\t1.48\t-0.12\tTreatment B\tBatch 1\tTreatment B1
R2\t2.63\t0.92\t0.38\tTreatment B\tBatch 2\tTreatment B2
R3\t3.08\t1.76\t-0.22\tTreatment B\tBatch 1\tTreatment B3
R4\t2.48\t2.21\t0.09\tTreatment B\tBatch 2\tTreatment B4`,
  pca: `feature_id\tControl_1_count\tControl_2_count\tControl_3_count\tTreatment_1_count\tTreatment_2_count\tTreatment_3_count
Feature_A\t120\t132\t118\t420\t398\t445
Feature_B\t560\t585\t542\t190\t205\t178
Feature_C\t88\t94\t91\t260\t248\t275
Feature_D\t310\t298\t325\t305\t318\t300
Feature_E\t45\t52\t49\t160\t148\t172
Feature_F\t720\t690\t735\t410\t395\t430
Feature_G\t205\t215\t198\t520\t548\t505
Feature_H\t150\t142\t158\t155\t148\t162`,
  pcaAbundance: `feature_id\tControl_1_tpm\tControl_2_tpm\tControl_3_tpm\tTreatment_1_tpm\tTreatment_2_tpm\tTreatment_3_tpm
Feature_A\t3.2\t3.4\t3.1\t8.9\t8.4\t9.1
Feature_B\t12.5\t12.9\t12.1\t5.2\t5.5\t5.0
Feature_C\t2.1\t2.3\t2.2\t6.8\t6.4\t7.0
Feature_D\t7.4\t7.0\t7.6\t7.2\t7.5\t7.1
Feature_E\t1.0\t1.2\t1.1\t4.6\t4.3\t4.8
Feature_F\t15.8\t15.1\t16.0\t9.2\t8.8\t9.5
Feature_G\t4.9\t5.1\t4.7\t11.3\t11.9\t10.8
Feature_H\t3.6\t3.4\t3.8\t3.7\t3.5\t3.9`,
  pcaMetadata: `sample\tgroup\tbatch\tlabel
Control_1\tControl\tBatch 1\tC1
Control_2\tControl\tBatch 2\tC2
Control_3\tControl\tBatch 1\tC3
Treatment_1\tTreatment\tBatch 2\tT1
Treatment_2\tTreatment\tBatch 1\tT2
Treatment_3\tTreatment\tBatch 2\tT3`,
  distribution: `group\tvalue
Control\t4.1
Control\t4.6
Control\t4.8
Control\t5.0
Control\t5.4
Treatment A\t5.5
Treatment A\t6.2
Treatment A\t6.4
Treatment A\t6.8
Treatment A\t7.4
Treatment B\t4.9
Treatment B\t5.6
Treatment B\t6.1
Treatment B\t7.0
Treatment B\t7.8`,
  distributionPaired: `subject\tgroup\tvalue\tfacet\tp_value
S01\tControl\t4.1\tDiscovery\t0.032
S01\tTreatment\t5.5\tDiscovery\t0.032
S02\tControl\t4.6\tDiscovery\t0.032
S02\tTreatment\t6.2\tDiscovery\t0.032
S03\tControl\t4.8\tDiscovery\t0.032
S03\tTreatment\t6.4\tDiscovery\t0.032
S04\tControl\t4.3\tValidation\t0.018
S04\tTreatment\t5.8\tValidation\t0.018
S05\tControl\t4.9\tValidation\t0.018
S05\tTreatment\t6.7\tValidation\t0.018
S06\tControl\t5.1\tValidation\t0.018
S06\tTreatment\t7.0\tValidation\t0.018`,
  volcano: `gene\tlog2FC\tpadj
TP53\t-2.8\t0.0002
EGFR\t2.4\t0.0008
MYC\t1.8\t0.004
KRAS\t1.2\t0.018
CDKN2A\t-1.9\t0.006
MKI67\t1.5\t0.012
VIM\t0.7\t0.032
GAPDH\t0.2\t0.61
ACTB\t-0.3\t0.44
EPCAM\t-1.1\t0.021
MUC1\t0.9\t0.084
SOX2\t2.1\t0.0014`,
  heatmap: buildHeatmapExample(),
  enrichment: `term\tgeneRatio\tcount\tpadj\tgroup\tbackground
Cell cycle\t0.36\t18\t0.0003\tBP\t18000
DNA repair\t0.30\t15\t0.0012\tBP\t18000
Mitochondrial matrix\t0.24\t12\t0.0031\tCC\t18000
DNA binding\t0.28\t14\t0.0026\tMF\t18000
PI3K-AKT signaling\t0.32\t16\t0.0008\tKEGG\t18000
p53 signaling\t0.22\t11\t0.0063\tKEGG\t18000
Focal adhesion\t0.18\t9\t0.018\tKEGG\t18000`,
  enrichmentFraction: `term\tgeneRatio\tcount\tpadj\tgroup\tbackground
Cell cycle\t18/50\t18\t0.0003\tBP\t18000
DNA repair\t15/50\t15\t0.0012\tBP\t18000
Mitochondrial matrix\t12/50\t12\t0.0031\tCC\t18000
DNA binding\t14/50\t14\t0.0026\tMF\t18000
PI3K-AKT signaling\t16/50\t16\t0.0008\tKEGG\t18000
p53 signaling\t11/50\t11\t0.0063\tKEGG\t18000
Focal adhesion\t9/50\t9\t0.018\tKEGG\t18000`,
  goCircle: `term\tgeneRatio\tcount\tFDR\tontology\tbackground
Cell cycle\t0.36\t18\t0.0003\tBP\t18000
DNA repair\t0.30\t15\t0.0012\tBP\t18000
Mitochondrial matrix\t0.24\t12\t0.0031\tCC\t18000
Chromosome region\t0.20\t10\t0.0074\tCC\t18000
ATPase activity\t0.18\t9\t0.0092\tMF\t18000
DNA binding\t0.28\t14\t0.0026\tMF\t18000
Apoptotic process\t0.22\t11\t0.011\tBP\t18000
Nuclear envelope\t0.16\t8\t0.024\tCC\t18000`,
  keggCircle: `term\tgeneRatio\tcount\tFDR\tpathway_group\tbackground
PI3K-AKT signaling\t0.32\t16\t0.0008\tSignaling\t18000
p53 signaling\t0.22\t11\t0.0063\tSignaling\t18000
Focal adhesion\t0.18\t9\t0.018\tCellular process\t18000
Cell cycle\t0.30\t15\t0.0016\tCellular process\t18000
Oxidative phosphorylation\t0.24\t12\t0.0049\tMetabolism\t18000
Glutathione metabolism\t0.16\t8\t0.027\tMetabolism\t18000`,
  goChord: `term\tgene\teffect\tgeneRatio\tcount\tFDR\tontology\tbackground
Cell cycle\tCDK1\t1.8\t0.36\t18\t0.0003\tBP\t18000
Cell cycle\tCCNB1\t1.5\t0.36\t18\t0.0003\tBP\t18000
Cell cycle\tMKI67\t1.2\t0.36\t18\t0.0003\tBP\t18000
DNA repair\tBRCA1\t1.1\t0.30\t15\t0.0012\tBP\t18000
DNA repair\tRAD51\t1.4\t0.30\t15\t0.0012\tBP\t18000
DNA repair\tTP53\t-1.3\t0.30\t15\t0.0012\tBP\t18000
Apoptotic process\tTP53\t-1.3\t0.22\t11\t0.011\tBP\t18000
Apoptotic process\tBAX\t1.0\t0.22\t11\t0.011\tBP\t18000
ATPase activity\tATP5F1A\t0.9\t0.18\t9\t0.0092\tMF\t18000
ATPase activity\tABCB1\t1.6\t0.18\t9\t0.0092\tMF\t18000`,
  pathwayImpact: `term\timpact\tcount\tgeneRatio\tFDR\tgroup\tbackground
PI3K-AKT signaling\t0.62\t16\t0.32\t0.0008\tSignaling\t18000
p53 signaling\t0.54\t11\t0.22\t0.0063\tSignaling\t18000
Cell cycle\t0.48\t15\t0.30\t0.0016\tCellular process\t18000
Focal adhesion\t0.29\t9\t0.18\t0.018\tCellular process\t18000
Oxidative phosphorylation\t0.38\t12\t0.24\t0.0049\tMetabolism\t18000
Glutathione metabolism\t0.17\t8\t0.16\t0.027\tMetabolism\t18000`,
  nesFdr: `term\tNES\tFDR\tgroup\tgeneRatio\tbackground
Interferon response\t2.18\t0.004\tHallmark\t0.28\t18000
DNA repair\t1.52\t0.041\tGO BP\t0.22\t18000
Cell cycle\t1.86\t0.009\tKEGG\t0.30\t18000
Apoptosis\t1.21\t0.083\tHallmark\t0.18\t18000
Oxidative phosphorylation\t-1.74\t0.018\tKEGG\t0.24\t18000
Fatty acid metabolism\t-1.43\t0.036\tHallmark\t0.20\t18000
Ribosome biogenesis\t-1.12\t0.097\tGO BP\t0.16\t18000`,
  multiGsea: buildMultiGseaExample(),
  enrichmentRidge: buildEnrichmentRidgeExample(),
  sankeyBubble: `source\tterm\tgeneRatio\tcount\tFDR\tbackground
BP\tCell cycle\t0.36\t18\t0.0003\t18000
BP\tDNA repair\t0.30\t15\t0.0012\t18000
BP\tApoptosis\t0.22\t11\t0.011\t18000
CC\tMitochondrial matrix\t0.24\t12\t0.0031\t18000
CC\tChromosome region\t0.20\t10\t0.0074\t18000
MF\tATPase activity\t0.18\t9\t0.0092\t18000
MF\tDNA binding\t0.28\t14\t0.0026\t18000`,
  geographicMap: `site\tlatitude\tlongitude\tvalue\tgroup
Shanghai\t31.23\t121.47\t42\tEast Asia
London\t51.51\t-0.13\t28\tEurope
New York\t40.71\t-74.01\t35\tNorth America
Sao Paulo\t-23.55\t-46.63\t19\tSouth America
Cape Town\t-33.92\t18.42\t16\tAfrica
Sydney\t-33.87\t151.21\t21\tOceania
Cairo\t30.04\t31.24\t31\tMiddle East
Delhi\t28.61\t77.21\t26\tSouth Asia`,
  petal: `category\tvalue
Sensitivity\t0.88
Specificity\t0.81
Calibration\t0.74
Reproducibility\t0.79
Coverage\t0.68
Robustness\t0.83
Interpretability\t0.71
Feasibility\t0.76`,
  wordCloud: `term\tweight
Immunity\t96
Metabolism\t82
Cell cycle\t74
DNA repair\t69
Inflammation\t63
Apoptosis\t58
Migration\t52
Angiogenesis\t46
Hypoxia\t41
Signaling\t37
Chromatin\t32
Translation\t28`,
  ma: `gene\tmeanExpression\tlog2FC\tpadj
TP53\t240.5\t-2.8\t0.0002
EGFR\t1580.2\t2.4\t0.0008
MYC\t820.4\t1.8\t0.004
KRAS\t430.8\t1.2\t0.018
CDKN2A\t95.1\t-1.9\t0.006
MKI67\t610.7\t1.5\t0.012
GAPDH\t8900.4\t0.2\t0.61`,
  quadrant: `label\tx\ty\tgroup
Gene A\t1.8\t2.4\tQ1
Gene B\t-1.4\t2.1\tQ2
Gene C\t-2.0\t-1.5\tQ3
Gene D\t1.2\t-2.2\tQ4
Gene E\t0.4\t1.0\tQ1
Gene F\t-0.8\t-0.7\tQ3`,
  errorbar: `category\tmean\tsd\tsem\tgroup
Control\t4.2\t0.45\t0.20\tBaseline
Treatment A\t7.8\t0.72\t0.32\tResponse
Treatment B\t6.3\t0.58\t0.26\tResponse
Treatment C\t9.1\t0.81\t0.36\tResponse`,
  area: `time\tvalue\tseries
0\t1.0\tControl
1\t1.4\tControl
2\t1.8\tControl
3\t2.1\tControl
0\t1.0\tTreatment
1\t2.2\tTreatment
2\t3.4\tTreatment
3\t4.1\tTreatment`,
  lollipop: `category\tvalue\tgroup
Cell cycle\t8.4\tBP
DNA repair\t6.8\tBP
PI3K-AKT\t5.9\tKEGG
p53 signaling\t4.7\tKEGG
Apoptosis\t3.8\tBP`,
  pcoa: buildOrdinationExample("pcoa"),
  umap: buildUmapExample(),
  tsne: buildOrdinationExample("tsne"),
  nmds: buildOrdinationExample("nmds"),
  gsea: buildGseaExample(),
  km: buildKaplanMeierExample(),
  forest: `label\testimate\tlower\tupper\tgroup
Age (per 10 years)\t1.22\t1.05\t1.42\tClinical
Male vs female\t1.11\t0.84\t1.47\tClinical
Stage III-IV\t2.08\t1.45\t2.98\tClinical
High signature\t1.73\t1.20\t2.49\tMolecular`,
  roc: buildRocExample(),
  rocTimeDependent: buildTimeDependentRocExample(),
  funnel: `study\teffect\tse
Study A\t0.42\t0.11
Study B\t0.31\t0.16
Study C\t0.58\t0.13
Study D\t0.27\t0.22
Study E\t0.49\t0.09
Study F\t0.18\t0.25
Study G\t0.55\t0.18`,
  nomogram: `predictor\tlevel\tpoints
Age\t40\t8
Age\t60\t24
Age\t80\t42
Stage\tI\t0
Stage\tII\t28
Stage\tIII\t61
Biomarker\tLow\t0
Biomarker\tHigh\t54`,
  lasso: `lambda\tcoefficient\tfeature
1\t0\tGene A
0.3\t0.12\tGene A
0.1\t0.31\tGene A
0.03\t0.48\tGene A
1\t0\tGene B
0.3\t-0.08\tGene B
0.1\t-0.21\tGene B
0.03\t-0.38\tGene B
1\t0\tClinical score
0.3\t0.18\tClinical score
0.1\t0.26\tClinical score
0.03\t0.29\tClinical score`,
  kmCutoff: `time\tevent\tscore\tcutoff
4\t1\t0.82\t0.50
7\t0\t0.31\t0.50
9\t1\t0.74\t0.50
12\t1\t0.65\t0.50
14\t0\t0.42\t0.50
18\t1\t0.58\t0.50
20\t0\t0.22\t0.50
24\t0\t0.37\t0.50
28\t1\t0.91\t0.50
32\t0\t0.48\t0.50
36\t0\t0.18\t0.50
40\t1\t0.69\t0.50`,
  riskScore: `sample\tscore\toutcome
S01\t0.12\t0
S02\t0.19\t0
S03\t0.25\t1
S04\t0.31\t0
S05\t0.39\t0
S06\t0.47\t1
S07\t0.54\t0
S08\t0.62\t1
S09\t0.71\t1
S10\t0.83\t1
S11\t0.91\t1`,
  sets: `item\tset
TP53\tRNA-seq
EGFR\tRNA-seq
MYC\tRNA-seq
TP53\tProteomics
MYC\tProteomics
AKT1\tProteomics
TP53\tCRISPR
AKT1\tCRISPR
KRAS\tCRISPR`,
  setPeaks: `peak_id\tset\tchromosome\tstart\tend
RNA_1\tRNA-seq\tchr1\t100\t180
RNA_2\tRNA-seq\tchr1\t260\t330
RNA_3\tRNA-seq\tchr2\t500\t570
ATAC_1\tATAC-seq\tchr1\t140\t220
ATAC_2\tATAC-seq\tchr1\t300\t380
ATAC_3\tATAC-seq\tchr2\t700\t760
H3K27ac_1\tH3K27ac\tchr1\t160\t205
H3K27ac_2\tH3K27ac\tchr2\t530\t610
H3K27ac_3\tH3K27ac\tchr2\t720\t790
TF_1\tTF ChIP-seq\tchr1\t175\t240
TF_2\tTF ChIP-seq\tchr2\t540\t590
TF_3\tTF ChIP-seq\tchr3\t80\t140`,
  network: `source\ttarget\tvalue\tgroup
Tumor\tT cell\t18\tImmune
Tumor\tMacrophage\t12\tImmune
Fibroblast\tTumor\t10\tStroma
Macrophage\tT cell\t7\tImmune
Endothelial\tTumor\t6\tStroma`,
  alluvial: `flow_id\taxis\tstratum\tvalue\tgroup
P1\tBaseline\tSensitive\t18\tSensitive
P1\tWeek 4\tPartial response\t18\tSensitive
P1\tWeek 12\tDurable response\t18\tSensitive
P2\tBaseline\tSensitive\t8\tSensitive
P2\tWeek 4\tStable disease\t8\tSensitive
P2\tWeek 12\tProgression\t8\tSensitive
P3\tBaseline\tResistant\t13\tResistant
P3\tWeek 4\tStable disease\t13\tResistant
P3\tWeek 12\tProgression\t13\tResistant
P4\tBaseline\tResistant\t7\tResistant
P4\tWeek 4\tPartial response\t7\tResistant
P4\tWeek 12\tDurable response\t7\tResistant`,
  ligandReceptor: `source_cell\tligand\treceptor\ttarget_cell\tweight\tevidence
Tumor\tTGFB1\tTGFBR2\tFibroblast\t0.86\tcurated database
Tumor\tVEGFA\tKDR\tEndothelial\t0.79\tcurated database
Macrophage\tIL1B\tIL1R1\tFibroblast\t0.67\tpredicted
Fibroblast\tCXCL12\tCXCR4\tT cell\t0.74\tcurated database
T cell\tIFNG\tIFNGR1\tTumor\t0.71\tvalidated
Endothelial\tDLL4\tNOTCH1\tTumor\t0.58\tpredicted`,
  generalNetwork: `record_type\tnode\tsource\ttarget\tweight\tdirection\tsign\tedge_type\tgroup\tnode_type\tnode_value
node\tTumor cell\t\t\t\t\t\t\tMalignant\tCell type\t18
node\tCD8 T cell\t\t\t\t\t\t\tImmune\tCell type\t14
node\tMacrophage\t\t\t\t\t\t\tImmune\tCell type\t11
node\tFibroblast\t\t\t\t\t\t\tStroma\tCell type\t8
node\tEndothelial\t\t\t\t\t\t\tStroma\tCell type\t6
node\tDendritic cell\t\t\t\t\t\t\tImmune\tCell type\t4
edge\t\tTumor cell\tCD8 T cell\t0.82\tdirected\tnegative\timmune suppression\tCommunication\t\t
edge\t\tMacrophage\tCD8 T cell\t0.65\tdirected\tnegative\timmune suppression\tCommunication\t\t
edge\t\tFibroblast\tTumor cell\t0.58\tdirected\tpositive\tgrowth support\tCommunication\t\t
edge\t\tEndothelial\tTumor cell\t0.41\tdirected\tpositive\tvascular support\tCommunication\t\t
edge\t\tDendritic cell\tCD8 T cell\t0.74\tdirected\tpositive\tantigen presentation\tCommunication\t\t`,
  ppiNetwork: `record_type\tnode\tsource\ttarget\tweight\tdirection\tsign\tedge_type\tgroup\tnode_type\tnode_value
node\tTP53\t\t\t\t\t\t\tDNA damage\tProtein\t18
node\tMDM2\t\t\t\t\t\t\tDNA damage\tProtein\t12
node\tCDKN1A\t\t\t\t\t\t\tCell cycle\tProtein\t10
node\tATM\t\t\t\t\t\t\tDNA damage\tProtein\t11
node\tCHEK2\t\t\t\t\t\t\tDNA damage\tProtein\t8
node\tRB1\t\t\t\t\t\t\tCell cycle\tProtein\t9
node\tE2F1\t\t\t\t\t\t\tCell cycle\tProtein\t7
node\tIsolated_candidate\t\t\t\t\t\t\tCandidate\tProtein\t3
edge\t\tTP53\tMDM2\t0.92\tundirected\tneutral\tphysical\tPPI\t\t
edge\t\tATM\tTP53\t0.88\tundirected\tneutral\tphosphorylation\tPPI\t\t
edge\t\tCHEK2\tTP53\t0.81\tundirected\tneutral\tphosphorylation\tPPI\t\t
edge\t\tTP53\tCDKN1A\t0.84\tundirected\tneutral\tfunctional\tPPI\t\t
edge\t\tCDKN1A\tRB1\t0.69\tundirected\tneutral\tfunctional\tPPI\t\t
edge\t\tRB1\tE2F1\t0.90\tundirected\tneutral\tphysical\tPPI\t\t`,
  cernaNetwork: `record_type\tnode\tsource\ttarget\tweight\tdirection\tsign\tedge_type\tgroup\tnode_type\tnode_value
node\tMALAT1\t\t\t\t\t\t\tlncRNA\tlncRNA\t9
node\tNEAT1\t\t\t\t\t\t\tlncRNA\tlncRNA\t8
node\tmiR-34a-5p\t\t\t\t\t\t\tmiRNA\tmiRNA\t12
node\tmiR-200c-3p\t\t\t\t\t\t\tmiRNA\tmiRNA\t10
node\tMET\t\t\t\t\t\t\tmRNA\tmRNA\t11
node\tZEB1\t\t\t\t\t\t\tmRNA\tmRNA\t13
edge\t\tMALAT1\tmiR-34a-5p\t0.71\tdirected\tnegative\tputative binding\tceRNA\t\t
edge\t\tmiR-34a-5p\tMET\t0.83\tdirected\tnegative\ttarget repression\tceRNA\t\t
edge\t\tNEAT1\tmiR-200c-3p\t0.66\tdirected\tnegative\tputative binding\tceRNA\t\t
edge\t\tmiR-200c-3p\tZEB1\t0.88\tdirected\tnegative\ttarget repression\tceRNA\t\t`,
  mirnaNetwork: `record_type\tnode\tsource\ttarget\tweight\tdirection\tsign\tedge_type\tgroup\tnode_type\tnode_value
node\tmiR-34a-5p\t\t\t\t\t\t\tmiRNA\tmiRNA\t14
node\tmiR-200c-3p\t\t\t\t\t\t\tmiRNA\tmiRNA\t12
node\tMET\t\t\t\t\t\t\tTarget gene\tmRNA\t10
node\tBCL2\t\t\t\t\t\t\tTarget gene\tmRNA\t8
node\tZEB1\t\t\t\t\t\t\tTarget gene\tmRNA\t11
node\tBMI1\t\t\t\t\t\t\tTarget gene\tmRNA\t7
edge\t\tmiR-34a-5p\tMET\t0.87\tdirected\tnegative\tvalidated target\tmiRNA-target\t\t
edge\t\tmiR-34a-5p\tBCL2\t0.79\tdirected\tnegative\tvalidated target\tmiRNA-target\t\t
edge\t\tmiR-200c-3p\tZEB1\t0.91\tdirected\tnegative\tvalidated target\tmiRNA-target\t\t
edge\t\tmiR-200c-3p\tBMI1\t0.68\tdirected\tnegative\tpredicted target\tmiRNA-target\t\t`,
  cnetNetwork: `record_type\tnode\tsource\ttarget\tweight\tdirection\tsign\tedge_type\tgroup\tnode_type\tnode_value
node\tDNA repair\t\t\t\t\t\t\tTerm\tEnriched term\t0.001
node\tp53 signaling\t\t\t\t\t\t\tTerm\tEnriched term\t0.004
node\tCell cycle\t\t\t\t\t\t\tTerm\tEnriched term\t0.0003
node\tTP53\t\t\t\t\t\t\tGene\tGene\t2.4
node\tATM\t\t\t\t\t\t\tGene\tGene\t1.8
node\tCDKN1A\t\t\t\t\t\t\tGene\tGene\t2.1
node\tRB1\t\t\t\t\t\t\tGene\tGene\t1.5
edge\t\tDNA repair\tTP53\t1\tundirected\tneutral\tmembership\tCnet\t\t
edge\t\tDNA repair\tATM\t1\tundirected\tneutral\tmembership\tCnet\t\t
edge\t\tp53 signaling\tTP53\t1\tundirected\tneutral\tmembership\tCnet\t\t
edge\t\tp53 signaling\tCDKN1A\t1\tundirected\tneutral\tmembership\tCnet\t\t
edge\t\tCell cycle\tCDKN1A\t1\tundirected\tneutral\tmembership\tCnet\t\t
edge\t\tCell cycle\tRB1\t1\tundirected\tneutral\tmembership\tCnet\t\t`,
  enrichmentMapNetwork: `record_type\tnode\tsource\ttarget\tweight\tdirection\tsign\tedge_type\tgroup\tnode_type\tnode_value
node\tDNA repair\t\t\t\t\t\t\tGenome stability\tTerm\t18
node\tHomologous recombination\t\t\t\t\t\t\tGenome stability\tTerm\t12
node\tp53 signaling\t\t\t\t\t\t\tStress response\tTerm\t14
node\tCell cycle checkpoint\t\t\t\t\t\t\tStress response\tTerm\t16
node\tApoptosis\t\t\t\t\t\t\tStress response\tTerm\t11
edge\t\tDNA repair\tHomologous recombination\t0.62\tundirected\tneutral\tgene-set overlap\tSimilarity\t\t
edge\t\tDNA repair\tp53 signaling\t0.34\tundirected\tneutral\tgene-set overlap\tSimilarity\t\t
edge\t\tp53 signaling\tCell cycle checkpoint\t0.57\tundirected\tneutral\tgene-set overlap\tSimilarity\t\t
edge\t\tp53 signaling\tApoptosis\t0.49\tundirected\tneutral\tgene-set overlap\tSimilarity\t\t`,
  tree: `node\tparent\tlabel\tgroup\theight
Root\t\tStudy cohort\tRoot\t0
Responder\tRoot\tResponders\tClinical response\t0
Nonresponder\tRoot\tNonresponders\tClinical response\t0
R_TcellHigh\tResponder\tT-cell high\tImmune phenotype\t0
R_TcellLow\tResponder\tT-cell low\tImmune phenotype\t0
NR_MyeloidHigh\tNonresponder\tMyeloid high\tImmune phenotype\t0
NR_Other\tNonresponder\tOther\tImmune phenotype\t0`,
  dendrogram: `node\tparent\tlabel\tgroup\theight
Root\t\tAll samples\tInternal\t1.00
Cluster_A\tRoot\tCluster A\tInternal\t0.58
Cluster_B\tRoot\tCluster B\tInternal\t0.66
A1\tCluster_A\tControl_1\tControl\t0
A2\tCluster_A\tControl_2\tControl\t0
B_left\tCluster_B\tB left\tInternal\t0.31
B1\tB_left\tTreatment_1\tTreatment\t0
B2\tB_left\tTreatment_2\tTreatment\t0
B3\tCluster_B\tTreatment_3\tTreatment\t0`,
  composition: `category\tvalue
Immune\t34
Stromal\t27
Epithelial\t21
Endothelial\t11
Other\t7`,
  rose: `category\tvalue
Baseline\t42
Week 2\t58
Week 4\t76
Week 6\t64
Week 8\t51
Week 10\t37`,
  hierarchy: `node\tparent\tvalue
All samples\t\t0
Immune\tAll samples\t0
Lymphoid\tImmune\t0
Myeloid\tImmune\t0
T cells\tLymphoid\t32
B cells\tLymphoid\t18
Macrophages\tMyeloid\t24
Dendritic cells\tMyeloid\t10
Stromal\tAll samples\t0
Fibroblasts\tStromal\t12
Endothelial\tStromal\t4`,
  radar: `feature\tvalue\tseries
Sensitivity\t0.88\tModel A
Specificity\t0.81\tModel A
Precision\t0.77\tModel A
Recall\t0.88\tModel A
Calibration\t0.72\tModel A
Robustness\t0.79\tModel A
Sensitivity\t0.79\tModel B
Specificity\t0.90\tModel B
Precision\t0.83\tModel B
Recall\t0.79\tModel B
Calibration\t0.84\tModel B
Robustness\t0.74\tModel B`,
  polarProfile: `angle\tvalue\tseries
ZT0\t1.2\tControl
ZT4\t1.8\tControl
ZT8\t3.1\tControl
ZT12\t4.0\tControl
ZT16\t2.7\tControl
ZT20\t1.5\tControl
ZT0\t1.1\tTreatment
ZT4\t2.4\tTreatment
ZT8\t4.2\tTreatment
ZT12\t3.3\tTreatment
ZT16\t2.0\tTreatment
ZT20\t1.2\tTreatment`,
  populationPyramid: `category\tvalue\tgroup
0-19\t18\tFemale
20-39\t31\tFemale
40-59\t27\tFemale
60-79\t17\tFemale
80+\t7\tFemale
0-19\t20\tMale
20-39\t33\tMale
40-59\t25\tMale
60-79\t15\tMale
80+\t5\tMale`,
  manhattan: buildManhattanExample(),
  qq: buildQqExample(),
  chromosomeIdeogram: buildIdeogramExample(),
  snpDensity: buildSnpDensityExample(),
  genomeTracks: `chromosome\tstart\tend\tvalue\ttrack\tfeature
chr7\t55019017\t55211628\t1\tGenes\tEGFR
chr7\t55086714\t55087058\t8.4\tATAC peaks\tEnhancer A
chr7\t55109002\t55109488\t6.7\tATAC peaks\tEnhancer B
chr7\t55142050\t55143180\t9.1\tH3K27ac\tPeak 1
chr7\t55178010\t55179220\t7.5\tH3K27ac\tPeak 2
chr7\t55000000\t55130000\t2.2\tCopy number\tGain
chr7\t55130000\t55240000\t1.0\tCopy number\tNeutral
chr7\t55034000\t55034100\t4.6\tVariants\tEGFR p.L858R
chr7\t55202000\t55202100\t3.8\tVariants\tVariant B`,
  alterations: buildAlterationExample(),
  motifLogo: `position\tA\tC\tG\tT
1\t0.88\t0.04\t0.04\t0.04
2\t0.05\t0.08\t0.82\t0.05
3\t0.07\t0.78\t0.08\t0.07
4\t0.05\t0.04\t0.06\t0.85
5\t0.42\t0.08\t0.44\t0.06
6\t0.08\t0.76\t0.09\t0.07
7\t0.06\t0.07\t0.81\t0.06
8\t0.84\t0.05\t0.06\t0.05
9\t0.10\t0.38\t0.41\t0.11
10\t0.06\t0.05\t0.08\t0.81`,
  circos: `record_type\tchromosome\tstart\tend\tchromosome_length\tvalue\tlabel\ttrack\ttarget_chromosome\ttarget_start\ttarget_end\ttarget_chromosome_length
heatmap\tchr1\t10000000\t24000000\t100000000\t2.8\tGain\tCopy number\t\t\t\t
heatmap\tchr1\t24000000\t42000000\t100000000\t-1.4\tLoss\tCopy number\t\t\t\t
heatmap\tchr5\t18000000\t36000000\t80000000\t1.7\tGain\tCopy number\t\t\t\t
bar\tchr1\t15000000\t17000000\t100000000\t8.4\tPeak A\tAccessibility\t\t\t\t
bar\tchr5\t25000000\t27000000\t80000000\t6.9\tPeak B\tAccessibility\t\t\t\t
bar\tchr8\t43000000\t45000000\t100000000\t9.2\tPeak C\tAccessibility\t\t\t\t
scatter\tchr1\t31000000\t31000100\t100000000\t0.82\trsA\tAssociation\t\t\t\t
scatter\tchr5\t52000000\t52000100\t80000000\t0.64\trsB\tAssociation\t\t\t\t
scatter\tchr8\t69000000\t69000100\t100000000\t0.91\trsC\tAssociation\t\t\t\t
label\tchr1\t36000000\t36000100\t100000000\t\tGENE1\tGenes\t\t\t\t
label\tchr5\t41000000\t41000100\t80000000\t\tGENE5\tGenes\t\t\t\t
fusion\tchr1\t16000000\t16500000\t100000000\t3\tFusion A\tEvents\tchr5\t26000000\t26500000\t80000000
correlation\tchr5\t52000000\t52500000\t80000000\t-0.62\tContact B\tEvents\tchr8\t69000000\t69500000\t100000000
link\tchr8\t43000000\t44000000\t100000000\t2.5\tLink C\tEvents\tchr1\t31000000\t31500000\t100000000`,
};

const plotDefinitionSeeds: PlotDefinition[] = [
  {
    id: "bar",
    name: "Bar",
    family: "Comparison",
    summary: "One categorical family for grouped, stacked, radial, target, overlay, and uncertainty comparisons.",
    inputHint: "Choose a visualization-only, supplied-P, independent raw, summary-statistics, paired, or qPCR ΔCt workflow. Inference requires biological IDs or explicit n.",
    roles: [
      { key: "category", label: "Category", kind: "category", required: true },
      { key: "value", label: "Value", kind: "number", required: true },
      { key: "error", label: "Error magnitude (SD / SEM)", kind: "number", required: false },
      { key: "sd", label: "Standard deviation (SD)", kind: "number", required: false },
      { key: "sem", label: "Standard error (SEM)", kind: "number", required: false },
      { key: "n", label: "Biological sample size (n)", kind: "number", required: false },
      { key: "subject", label: "Biological sample / subject ID", kind: "label", required: false },
      { key: "analysisValue", label: "Analysis value (ΔCt)", kind: "number", required: false },
      { key: "group", label: "Group", kind: "category", required: false },
      { key: "secondary", label: "Secondary value", kind: "number", required: false },
      { key: "target", label: "Target value", kind: "number", required: false },
      { key: "pValue", label: "P value", kind: "number", required: false },
      { key: "facet", label: "Facet", kind: "category", required: false },
    ],
    defaultMapping: { category: "category", value: "value", error: "sd", sd: "sd", sem: "sem", n: "n", subject: "sample_id", analysisValue: "delta_ct", group: "group", secondary: "secondary", target: "target", pValue: "p_value", facet: "facet" },
    sampleData: samples.barVariants,
    examples: [
      { label: "Example 1", description: "Summary values for visualization; optional upstream P values can be displayed without recalculation.", data: samples.barVariants, mapping: { category: "category", value: "value", error: "sd", sd: "sd", sem: "", n: "", subject: "", analysisValue: "", group: "group", secondary: "secondary", target: "target", pValue: "p_value", facet: "facet" }, settings: { barInputMode: "summary", barAnalysisMode: "none", showSignificance: false } },
      { label: "Example 2", description: "Independent biological observations; Welch tests compare each category with the reference within each group.", data: samples.barRawIndependent, mapping: { category: "category", value: "value", error: "", sd: "", sem: "", n: "", subject: "sample_id", analysisValue: "", group: "group", secondary: "", target: "", pValue: "", facet: "" }, settings: { barInputMode: "long", barAnalysisMode: "raw-independent", barReferenceCategory: "Control", barPAdjustment: "bh", showSignificance: true, barErrorType: "sem" } },
      { label: "Example 3", description: "Means with SD or SEM and explicit biological n; inference uses a summary-statistics Welch test.", data: samples.barSummaryInference, mapping: { category: "category", value: "value", error: "sd", sd: "sd", sem: "sem", n: "n", subject: "", analysisValue: "", group: "group", secondary: "", target: "", pValue: "", facet: "" }, settings: { barInputMode: "summary", barAnalysisMode: "summary-independent", barReferenceCategory: "Control", barPAdjustment: "bh", showSignificance: true, barErrorType: "sd" } },
      { label: "Example 4", description: "Matched observations with exact subject IDs; incomplete pairs block the paired t-test.", data: samples.barPaired, mapping: { category: "category", value: "value", error: "", sd: "", sem: "", n: "", subject: "subject_id", analysisValue: "", group: "group", secondary: "", target: "", pValue: "", facet: "" }, settings: { barInputMode: "long", barAnalysisMode: "raw-paired", barReferenceCategory: "Before", barPAdjustment: "holm", showSignificance: true, barErrorType: "sem" } },
      { label: "Example 5", description: "qPCR displays relative expression but performs the Welch test on biological-replicate ΔCt values.", data: samples.barQpcr, mapping: { category: "category", value: "relative_expression", error: "", sd: "", sem: "", n: "", subject: "sample_id", analysisValue: "delta_ct", group: "group", secondary: "", target: "", pValue: "", facet: "" }, settings: { barInputMode: "long", barAnalysisMode: "qpcr-delta-ct", barReferenceCategory: "Control", barPAdjustment: "bh", showSignificance: true, barErrorType: "sem" } },
    ],
  },
  {
    id: "line",
    name: "Line",
    family: "Trend",
    summary: "Time-course or ordered trend with multiple series and visible markers.",
    inputHint: "One row per ordered estimate. Map SD or SEM plus sample size to calculate reference-series Welch tests at each X value, or display uncertainty without testing.",
    roles: [
      { key: "x", label: "X", kind: "number", required: true },
      { key: "value", label: "Value", kind: "number", required: true },
      { key: "error", label: "Uncertainty half-width (SD / SEM / 95% CI)", kind: "number", required: false },
      { key: "n", label: "Sample size (n)", kind: "number", required: false },
      { key: "series", label: "Series", kind: "category", required: false },
    ],
    defaultMapping: { x: "time", value: "value", error: "sd", n: "n", series: "series" },
    sampleData: samples.line,
    examples: [
      { label: "Example 1", description: "Ordered means with SD, SEM, and explicit sample size for optional Welch tests.", data: samples.line, mapping: { x: "time", value: "value", error: "sd", n: "n", series: "series" } },
      { label: "Example 2", description: "Ordered estimates without uncertainty or significance calculation.", data: samples.lineNoError, mapping: { x: "time", value: "value", error: "", n: "", series: "series" } },
    ],
  },
  {
    id: "scatter",
    name: "Scatter",
    family: "Association",
    summary: "Compact association views from points and marginals to fitted, dense, three-axis, and compositional encodings.",
    inputHint: "One row per observation. X and Y are required; Z is additionally required for pair-matrix, 3D, and ternary views.",
    roles: [
      { key: "x", label: "X", kind: "number", required: true },
      { key: "y", label: "Y", kind: "number", required: true },
      { key: "z", label: "Z / third component", kind: "number", required: false },
      { key: "group", label: "Group", kind: "category", required: false },
      { key: "label", label: "Label", kind: "label", required: false },
    ],
    defaultMapping: { x: "x", y: "y", z: "", group: "group", label: "label" },
    sampleData: samples.scatter,
    examples: [
      { label: "Example 1", description: "Two-axis grouped observations for point, fit, marginal, density, hexbin, ellipse, and hull views.", data: samples.scatter, mapping: { x: "x", y: "y", z: "", group: "group", label: "label" } },
      { label: "Example 2", description: "Three non-negative components for pair-matrix, orthographic 3D, and normalized ternary views.", data: samples.scatterThreeAxis, mapping: { x: "x", y: "y", z: "z", group: "group", label: "label" } },
    ],
  },
  {
    id: "pca",
    name: "PCA",
    family: "Dimension reduction",
    summary: "Plot supplied principal-component coordinates or calculate PCA locally from a wide feature matrix.",
    inputHint: "Choose supplied coordinates when PCA was calculated upstream, or matrix calculation when the first column identifies features and remaining columns are observations.",
    roles: [
      { key: "x", label: "X component", kind: "number", required: true },
      { key: "y", label: "Y component", kind: "number", required: true },
      { key: "z", label: "Z component (3D only)", kind: "number", required: false },
      { key: "group", label: "Group", kind: "category", required: false },
      { key: "shape", label: "Shape", kind: "category", required: false },
      { key: "label", label: "Observation label", kind: "label", required: false },
    ],
    defaultMapping: { x: "PC1", y: "PC2", z: "PC3", group: "group", shape: "", label: "sample" },
    sampleData: samples.pcaScores,
    examples: [
      { label: "Example 1", description: "Precomputed PC1–PC3 coordinates supplied by an upstream PCA workflow; Studio only renders them.", data: samples.pcaScores, pcaInputMode: "scores", mapping: { x: "PC1", y: "PC2", z: "PC3", group: "group", shape: "batch", label: "label" } },
      { label: "Example 2", description: "Wide feature matrix with raw count columns plus sample metadata; Studio calculates PCA locally.", data: samples.pca, metadata: samples.pcaMetadata, pcaInputMode: "matrix", mapping: { x: "PC1", y: "PC2", z: "PC3", group: "group", shape: "batch", label: "label" } },
    ],
  },
  {
    id: "box",
    name: "Box",
    family: "Distribution",
    summary: "Median, IQR, whiskers, and all observations without hiding sample size.",
    inputHint: "Long format: one row per observation.",
    roles: [
      { key: "group", label: "Group", kind: "category", required: true },
      { key: "value", label: "Value", kind: "number", required: true },
      { key: "subject", label: "Subject / pair ID", kind: "label", required: false },
      { key: "facet", label: "Facet", kind: "category", required: false },
      { key: "pValue", label: "Facet / comparison P value", kind: "number", required: false },
    ],
    defaultMapping: { group: "group", value: "value", subject: "", facet: "", pValue: "" },
    sampleData: samples.distribution,
    examples: [
      { label: "Example 1", description: "Independent long-form observations grouped by condition.", data: samples.distribution, mapping: { group: "group", value: "value", subject: "", facet: "", pValue: "" } },
      { label: "Example 2", description: "Paired observations with subject IDs, facets, and supplied group P values.", data: samples.distributionPaired, mapping: { group: "group", value: "value", subject: "subject", facet: "facet", pValue: "p_value" } },
    ],
  },
  {
    id: "violin",
    name: "Violin",
    family: "Distribution",
    summary: "Kernel-density distribution with median and raw observations.",
    inputHint: "Long format. At least three values per group are recommended.",
    roles: [
      { key: "group", label: "Group", kind: "category", required: true },
      { key: "value", label: "Value", kind: "number", required: true },
      { key: "subject", label: "Subject / pair ID", kind: "label", required: false },
      { key: "facet", label: "Facet", kind: "category", required: false },
      { key: "pValue", label: "Facet / comparison P value", kind: "number", required: false },
    ],
    defaultMapping: { group: "group", value: "value", subject: "", facet: "", pValue: "" },
    sampleData: samples.distribution,
    examples: [
      { label: "Example 1", description: "Independent long-form observations grouped by condition.", data: samples.distribution, mapping: { group: "group", value: "value", subject: "", facet: "", pValue: "" } },
      { label: "Example 2", description: "Paired observations with subject IDs, facets, and supplied group P values.", data: samples.distributionPaired, mapping: { group: "group", value: "value", subject: "subject", facet: "facet", pValue: "p_value" } },
    ],
  },
  {
    id: "volcano",
    name: "Volcano",
    family: "Differential analysis",
    summary: "Effect size versus significance with explicit FC and FDR thresholds.",
    inputHint: "Use adjusted P values when available; values must be greater than zero.",
    roles: [
      { key: "label", label: "Gene label", kind: "label", required: true },
      { key: "effect", label: "log2 fold change", kind: "number", required: true },
      { key: "pValue", label: "Adjusted P value", kind: "number", required: true },
    ],
    defaultMapping: { label: "gene", effect: "log2FC", pValue: "padj" },
    sampleData: samples.volcano,
  },
  {
    id: "heatmap",
    name: "Heatmap",
    family: "Matrix",
    summary: "Compact expression matrix with row scaling and a centered diverging scale.",
    inputHint: "First column is the row label; remaining columns must be numeric samples.",
    roles: [],
    defaultMapping: {},
    sampleData: samples.heatmap,
  },
  {
    id: "enrichment",
    name: "Enrichment dot",
    family: "Enrichment",
    summary: "Term, ratio, count, and FDR encoded independently and legibly.",
    inputHint: "One row per precomputed term with tested background, ratio, count, and FDR. Ratios may be decimals or fractions such as 8/40; this module does not run enrichment.",
    roles: [
      { key: "term", label: "Term", kind: "label", required: true },
      { key: "ratio", label: "Gene ratio", kind: "number", required: true },
      { key: "count", label: "Gene count", kind: "number", required: true },
      { key: "pValue", label: "Adjusted P value", kind: "number", required: true },
      { key: "group", label: "Ontology / group", kind: "category", required: false },
      { key: "background", label: "Tested background size", kind: "number", required: true },
    ],
    defaultMapping: { term: "term", ratio: "geneRatio", count: "count", pValue: "padj", group: "group", background: "background" },
    sampleData: samples.enrichment,
    examples: [
      { label: "Example 1", description: "Gene ratio supplied as decimals.", data: samples.enrichment },
      { label: "Example 2", description: "Gene ratio supplied as fractions such as 18/50.", data: samples.enrichmentFraction },
    ],
  },
  {
    id: "correlation",
    name: "Correlation",
    family: "Association",
    summary: "Association views with explicit Pearson or Spearman statistics, optional P values, fitted curves, and confidence bands.",
    inputHint: "One row per paired observation. X and Y are required; Z is additionally required for pair-matrix, 3D, and ternary views.",
    roles: [
      { key: "x", label: "X", kind: "number", required: true },
      { key: "y", label: "Y", kind: "number", required: true },
      { key: "z", label: "Z / third component", kind: "number", required: false },
      { key: "group", label: "Group", kind: "category", required: false },
      { key: "label", label: "Label", kind: "label", required: false },
    ],
    defaultMapping: { x: "x", y: "y", z: "", group: "group", label: "label" },
    sampleData: samples.scatter,
    examples: [
      { label: "Example 1", description: "Two-axis grouped observations for association statistics and fitted views.", data: samples.scatter, mapping: { x: "x", y: "y", z: "", group: "group", label: "label" } },
      { label: "Example 2", description: "Three non-negative components for pair-matrix, orthographic 3D, and normalized ternary views.", data: samples.scatterThreeAxis, mapping: { x: "x", y: "y", z: "z", group: "group", label: "label" } },
    ],
  },
  {
    id: "ma",
    name: "MA",
    family: "Differential analysis",
    summary: "Mean abundance versus log2 fold change with FDR and effect-size highlighting.",
    inputHint: "Use a positive baseMean/mean-expression column, log2 fold change, and adjusted P value.",
    roles: [
      { key: "label", label: "Gene label", kind: "label", required: true },
      { key: "mean", label: "Mean expression", kind: "number", required: true },
      { key: "effect", label: "log2 fold change", kind: "number", required: true },
      { key: "pValue", label: "Adjusted P value", kind: "number", required: true },
    ],
    defaultMapping: { label: "gene", mean: "meanExpression", effect: "log2FC", pValue: "padj" },
    sampleData: samples.ma,
  },
  {
    id: "quadrant",
    name: "Quadrant",
    family: "Association",
    summary: "Two-dimensional comparison divided by independently adjustable X and Y thresholds.",
    inputHint: "One row per item with numeric X/Y values; group and label are optional.",
    roles: [
      { key: "x", label: "X", kind: "number", required: true },
      { key: "y", label: "Y", kind: "number", required: true },
      { key: "group", label: "Group", kind: "category", required: false },
      { key: "label", label: "Label", kind: "label", required: false },
    ],
    defaultMapping: { x: "x", y: "y", group: "group", label: "label" },
    sampleData: samples.quadrant,
  },
  {
    id: "errorbar",
    name: "Error bar",
    family: "Comparison",
    summary: "Mean points with symmetric SD or SEM intervals and no compulsory bars.",
    inputHint: "Map a mean and an already-calculated non-negative SD or SEM column.",
    roles: [
      { key: "category", label: "Category", kind: "category", required: true },
      { key: "value", label: "Mean", kind: "number", required: true },
      { key: "error", label: "Error magnitude (SD / SEM)", kind: "number", required: true },
      { key: "group", label: "Group", kind: "category", required: false },
    ],
    defaultMapping: { category: "category", value: "mean", error: "sd", group: "group" },
    sampleData: samples.errorbar,
  },
  {
    id: "area",
    name: "Area",
    family: "Trend",
    summary: "Ordered trajectories with restrained translucent fills and visible outlines.",
    inputHint: "Long format with numeric X, numeric value, and optional series.",
    roles: [
      { key: "x", label: "X", kind: "number", required: true },
      { key: "value", label: "Value", kind: "number", required: true },
      { key: "series", label: "Series", kind: "category", required: false },
    ],
    defaultMapping: { x: "time", value: "value", series: "series" },
    sampleData: samples.area,
  },
  {
    id: "lollipop",
    name: "Lollipop",
    family: "Ranking",
    summary: "Compact ranked values using stems and emphasized endpoints.",
    inputHint: "One row per category with a numeric value and optional group.",
    roles: [
      { key: "category", label: "Category", kind: "category", required: true },
      { key: "value", label: "Value", kind: "number", required: true },
      { key: "group", label: "Group", kind: "category", required: false },
    ],
    defaultMapping: { category: "category", value: "value", group: "group" },
    sampleData: samples.lollipop,
  },
  ...(["beeswarm", "raincloud", "histogram", "density", "ridge"] as const).map((id) => ({
    id,
    name: id === "beeswarm" ? "Beeswarm" : id === "raincloud" ? "Raincloud" : id === "histogram" ? "Histogram" : id === "density" ? "Density" : "Ridge",
    family: "Distribution",
    summary: id === "beeswarm" ? "Deterministically packed raw observations without an enclosing box." : id === "raincloud" ? "Density, raw observations, and compact summaries in one layered view." : id === "histogram" ? "Deterministically binned frequency distributions for grouped observations." : id === "density" ? "Kernel-density estimates with explicit bandwidth and optional raw-data layers." : "Overlapping kernel-density profiles arranged as compact ridgelines.",
    inputHint: "Long format: one row per raw observation. At least three values per group are recommended.",
    roles: [
      { key: "group", label: "Group", kind: "category" as const, required: true },
      { key: "value", label: "Value", kind: "number" as const, required: true },
      { key: "subject", label: "Subject / pair ID", kind: "label" as const, required: false },
      { key: "facet", label: "Facet", kind: "category" as const, required: false },
      { key: "pValue", label: "Facet / comparison P value", kind: "number" as const, required: false },
    ],
    defaultMapping: { group: "group", value: "value", subject: "", facet: "", pValue: "" },
    sampleData: samples.distribution,
    examples: [
      { label: "Example 1", description: "Independent long-form observations grouped by condition.", data: samples.distribution, mapping: { group: "group", value: "value", subject: "", facet: "", pValue: "" } },
      { label: "Example 2", description: "Paired observations with subject IDs, facets, and supplied group P values.", data: samples.distributionPaired, mapping: { group: "group", value: "value", subject: "subject", facet: "facet", pValue: "p_value" } },
    ],
  })),
  ...(["pcoa", "umap", "tsne", "nmds"] as const).map((id) => ({
    id,
    name: id === "pcoa" ? "PCoA" : id === "umap" ? "UMAP" : id === "tsne" ? "t-SNE" : "NMDS",
    family: "Dimension reduction",
    summary: id === "pcoa" ? "Publication-ready display of principal-coordinate scores from a documented distance analysis." : id === "umap" ? "Publication-ready display of a precomputed UMAP embedding." : id === "tsne" ? "Publication-ready display of a precomputed t-SNE embedding." : "Publication-ready display of precomputed non-metric multidimensional scaling coordinates.",
    inputHint: id === "pcoa" ? "Upload precomputed PCoA coordinates and document the upstream distance metric; coordinates are never silently recomputed." : id === "umap" ? "Upload precomputed UMAP coordinates; preserve the upstream seed, neighbors, minimum distance, and metric in your analysis record." : id === "tsne" ? "Upload precomputed t-SNE coordinates; preserve the upstream seed, perplexity, metric, initialization, and iterations." : "Upload precomputed NMDS coordinates; preserve the dissimilarity, dimensions, starts, convergence, and stress.",
    roles: [
      { key: "x", label: "Dimension 1", kind: "number" as const, required: true },
      { key: "y", label: "Dimension 2", kind: "number" as const, required: true },
      { key: "z", label: "Dimension 3 (3D only)", kind: "number" as const, required: false },
      { key: "group", label: "Group", kind: "category" as const, required: false },
      { key: "shape", label: "Shape", kind: "category" as const, required: false },
      { key: "label", label: "Observation label", kind: "label" as const, required: false },
    ],
    defaultMapping: { x: "dim1", y: "dim2", z: "dim3", group: "group", shape: "shape", label: "sample" },
    sampleData: samples[id],
    examples: [
      { label: "Example 1", description: "Precomputed two-dimensional coordinates with color groups, shapes, and labels.", data: samples[id], mapping: { x: "dim1", y: "dim2", z: "", group: "group", shape: "shape", label: "sample" } },
      { label: "Example 2", description: "The same documented embedding with a supplied third coordinate for the optional 3D projection.", data: samples[id], mapping: { x: "dim1", y: "dim2", z: "dim3", group: "group", shape: "shape", label: "sample" } },
    ],
  })),
  ...(["clustered-heatmap", "correlation-heatmap"] as const).map((id) => ({
    id,
    name: id === "clustered-heatmap" ? "Clustered heatmap" : "Correlation heatmap",
    family: "Matrix",
    summary: id === "clustered-heatmap" ? "Matrix heatmap with explicit, deterministic row and column clustering." : "Pearson or Spearman correlation calculated across numeric columns and displayed as a symmetric matrix.",
    inputHint: "First column supplies row labels; every remaining column must be numeric.",
    roles: [],
    defaultMapping: {},
    sampleData: samples.heatmap,
  })),
  {
    id: "enrichment-bar",
    name: "Enrichment bar",
    family: "Enrichment",
    summary: "Ranked pathway bars with FDR encoded by a continuous color scale.",
    inputHint: "One row per precomputed term with tested background, ratio, and FDR; ratios may be decimals or fractions such as 8/40. This module does not run enrichment.",
    roles: [
      { key: "term", label: "Term", kind: "label", required: true },
      { key: "ratio", label: "Gene ratio", kind: "number", required: true },
      { key: "pValue", label: "Adjusted P value", kind: "number", required: true },
      { key: "group", label: "Ontology / group", kind: "category", required: false },
      { key: "background", label: "Tested background size", kind: "number", required: true },
    ],
    defaultMapping: { term: "term", ratio: "geneRatio", pValue: "padj", group: "group", background: "background" },
    sampleData: samples.enrichment,
    examples: [
      { label: "Example 1", description: "Gene ratio supplied as decimals.", data: samples.enrichment },
      { label: "Example 2", description: "Gene ratio supplied as fractions such as 18/50.", data: samples.enrichmentFraction },
    ],
  },
  {
    id: "gsea",
    name: "GSEA",
    family: "Enrichment",
    summary: "Running enrichment score with ranked-position hit ticks.",
    inputHint: "Use the running-score output of a documented GSEA workflow; hit must be 0/1. The plotter does not invent NES or FDR.",
    roles: [
      { key: "rank", label: "Rank", kind: "number", required: true },
      { key: "score", label: "Running enrichment score", kind: "number", required: true },
      { key: "hit", label: "Gene-set hit (0 / 1)", kind: "number", required: true },
      { key: "label", label: "Gene label", kind: "label", required: false },
    ],
    defaultMapping: { rank: "rank", score: "runningES", hit: "hit", label: "label" },
    sampleData: samples.gsea,
  },
  {
    id: "go-circle", name: "GO circle", family: "Enrichment", summary: "Circular GO term overview grouped by BP, CC, and MF with count and FDR encodings.", inputHint: "Use precomputed GO enrichment results. Supply ontology, gene ratio, hit count, FDR, and tested background size; this module does not run enrichment.",
    roles: [{ key: "term", label: "GO term", kind: "label", required: true }, { key: "ratio", label: "Gene ratio", kind: "number", required: true }, { key: "count", label: "Hit count", kind: "number", required: true }, { key: "pValue", label: "FDR", kind: "number", required: true }, { key: "group", label: "Ontology (BP / CC / MF)", kind: "category", required: true }, { key: "background", label: "Tested background size", kind: "number", required: true }],
    defaultMapping: { term: "term", ratio: "geneRatio", count: "count", pValue: "FDR", group: "ontology", background: "background" }, sampleData: samples.goCircle,
    examples: [{ label: "Example 1 · BP / CC / MF", description: "Precomputed GO results with explicit ontology, denominator background, gene ratio, count, and FDR.", data: samples.goCircle }],
  },
  {
    id: "kegg-circle", name: "KEGG circle", family: "Enrichment", summary: "Circular KEGG pathway overview with pathway groups, counts, ratios, and FDR.", inputHint: "Use precomputed KEGG enrichment output with a declared tested background; the circular position is decorative and does not recalculate pathways.",
    roles: [{ key: "term", label: "KEGG pathway", kind: "label", required: true }, { key: "ratio", label: "Gene ratio", kind: "number", required: true }, { key: "count", label: "Hit count", kind: "number", required: true }, { key: "pValue", label: "FDR", kind: "number", required: true }, { key: "group", label: "Pathway group", kind: "category", required: true }, { key: "background", label: "Tested background size", kind: "number", required: true }],
    defaultMapping: { term: "term", ratio: "geneRatio", count: "count", pValue: "FDR", group: "pathway_group", background: "background" }, sampleData: samples.keggCircle,
  },
  {
    id: "go-chord", name: "GO chord", family: "Enrichment relationships", summary: "Term–gene membership links arranged as a compact circular relationship diagram.", inputHint: "One row per precomputed GO term–gene membership. Repeat term-level ratio, count, FDR, ontology, and tested background consistently across member rows.",
    roles: [{ key: "term", label: "GO term", kind: "label", required: true }, { key: "label", label: "Member gene", kind: "label", required: true }, { key: "effect", label: "Gene effect", kind: "number", required: true }, { key: "ratio", label: "Gene ratio", kind: "number", required: true }, { key: "count", label: "Term hit count", kind: "number", required: true }, { key: "pValue", label: "Term FDR", kind: "number", required: true }, { key: "group", label: "Ontology", kind: "category", required: true }, { key: "background", label: "Tested background size", kind: "number", required: true }],
    defaultMapping: { term: "term", label: "gene", effect: "effect", ratio: "geneRatio", count: "count", pValue: "FDR", group: "ontology", background: "background" }, sampleData: samples.goChord,
  },
  {
    id: "pathway-impact", name: "Pathway impact", family: "Pathway analysis", summary: "Supplied pathway-topology impact versus FDR with hit-count bubbles.", inputHint: "Use impact scores from a documented upstream topology-aware pathway method. Supply ratio, count, FDR, pathway group, and tested background; impact is never inferred here.",
    roles: [{ key: "term", label: "Pathway", kind: "label", required: true }, { key: "impact", label: "Upstream impact score", kind: "number", required: true }, { key: "count", label: "Hit count", kind: "number", required: true }, { key: "ratio", label: "Gene ratio", kind: "number", required: true }, { key: "pValue", label: "FDR", kind: "number", required: true }, { key: "group", label: "Pathway group", kind: "category", required: true }, { key: "background", label: "Tested background size", kind: "number", required: true }],
    defaultMapping: { term: "term", impact: "impact", count: "count", ratio: "geneRatio", pValue: "FDR", group: "group", background: "background" }, sampleData: samples.pathwayImpact,
  },
  {
    id: "nes-fdr", name: "NES / FDR summary", family: "Enrichment", summary: "Signed normalized enrichment scores with FDR encoded independently.", inputHint: "Use precomputed NES and FDR values from a documented ranked-set analysis; include gene ratio and tested background for context.",
    roles: [{ key: "term", label: "Gene set", kind: "label", required: true }, { key: "nes", label: "NES", kind: "number", required: true }, { key: "pValue", label: "FDR", kind: "number", required: true }, { key: "group", label: "Collection", kind: "category", required: true }, { key: "ratio", label: "Gene ratio", kind: "number", required: true }, { key: "background", label: "Ranked background size", kind: "number", required: true }],
    defaultMapping: { term: "term", nes: "NES", pValue: "FDR", group: "group", ratio: "geneRatio", background: "background" }, sampleData: samples.nesFdr,
  },
  {
    id: "multi-gsea", name: "Multi-GSEA", family: "Enrichment", summary: "Multiple supplied running-enrichment curves over one complete common ranked list, with hit positions, NES, and FDR.", inputHint: "Provide precomputed running scores and 0/1 hit indicators at representative positions spanning rank 0 through one common ranked-background endpoint for every set. Running ES must be zero at both endpoints; repeat constant per-set NES and FDR.",
    roles: [{ key: "rank", label: "Rank", kind: "number", required: true }, { key: "score", label: "Running enrichment score", kind: "number", required: true }, { key: "hit", label: "Gene-set hit (0 / 1)", kind: "number", required: true }, { key: "group", label: "Gene set", kind: "category", required: true }, { key: "nes", label: "NES", kind: "number", required: true }, { key: "pValue", label: "FDR", kind: "number", required: true }, { key: "background", label: "Ranked background size", kind: "number", required: true }],
    defaultMapping: { rank: "rank", score: "runningES", hit: "hit", group: "set", nes: "NES", pValue: "FDR", background: "background" }, sampleData: samples.multiGsea,
  },
  {
    id: "enrichment-ridge", name: "Enrichment ridge", family: "Enrichment", summary: "Per-term distributions of supplied member-level ranked statistics.", inputHint: "Provide member-level statistics for each precomputed enriched term and repeat its FDR, gene ratio, and tested background consistently; density is normalized within term.",
    roles: [{ key: "term", label: "Enriched term", kind: "label", required: true }, { key: "label", label: "Member gene", kind: "label", required: true }, { key: "score", label: "Ranked statistic", kind: "number", required: true }, { key: "pValue", label: "Term FDR", kind: "number", required: true }, { key: "ratio", label: "Gene ratio", kind: "number", required: true }, { key: "background", label: "Tested background size", kind: "number", required: true }],
    defaultMapping: { term: "term", label: "gene", score: "score", pValue: "FDR", ratio: "geneRatio", background: "background" }, sampleData: samples.enrichmentRidge,
  },
  {
    id: "sankey-bubble", name: "Relationship ribbon–bubble", family: "Enrichment", summary: "Non-conserved source-to-term relationship ribbons combined with term bubbles for ratios and counts.", inputHint: "Use precomputed enrichment rows with source collection, term, gene ratio, hit count, FDR, and tested background. Each ribbon width is an independent ratio; unlike a Sankey flow, widths are not conserved or summed at the source.",
    roles: [{ key: "source", label: "Ontology / source", kind: "category", required: true }, { key: "term", label: "Term", kind: "label", required: true }, { key: "ratio", label: "Gene ratio", kind: "number", required: true }, { key: "count", label: "Hit count", kind: "number", required: true }, { key: "pValue", label: "FDR", kind: "number", required: true }, { key: "background", label: "Tested background size", kind: "number", required: true }],
    defaultMapping: { source: "source", term: "term", ratio: "geneRatio", count: "count", pValue: "FDR", background: "background" }, sampleData: samples.sankeyBubble,
  },
  {
    id: "geographic-map", name: "Geographic point map", family: "Specialized", summary: "Approximate equirectangular site locations with value-sized points.", inputHint: "One row per site with decimal latitude, longitude, non-negative value, and optional group. This is a locator map, not a boundary, distance, or area analysis.",
    roles: [{ key: "label", label: "Site", kind: "label", required: true }, { key: "latitude", label: "Latitude", kind: "number", required: true }, { key: "longitude", label: "Longitude", kind: "number", required: true }, { key: "value", label: "Magnitude", kind: "number", required: true }, { key: "group", label: "Group", kind: "category", required: false }],
    defaultMapping: { label: "site", latitude: "latitude", longitude: "longitude", value: "value", group: "group" }, sampleData: samples.geographicMap,
  },
  {
    id: "petal", name: "Petal", family: "Specialized", summary: "Decorative radial ranking with value-proportional petal lengths.", inputHint: "One row per category with a non-negative value. Use bars or dots when accurate magnitude comparison is required.",
    roles: [{ key: "label", label: "Category", kind: "label", required: true }, { key: "value", label: "Value", kind: "number", required: true }],
    defaultMapping: { label: "category", value: "value" }, sampleData: samples.petal,
  },
  {
    id: "word-cloud", name: "Word cloud", family: "Specialized", summary: "Deterministic word-size overview for qualitative prominence.", inputHint: "One row per unique term with a strictly positive weight. Font size supports approximate prominence only; position and color are non-quantitative.",
    roles: [{ key: "label", label: "Term", kind: "label", required: true }, { key: "value", label: "Positive weight", kind: "number", required: true }],
    defaultMapping: { label: "term", value: "weight" }, sampleData: samples.wordCloud,
  },
  {
    id: "km",
    name: "Kaplan–Meier",
    family: "Survival",
    summary: "Kaplan–Meier estimates calculated from subject-level time and event data with censor marks.",
    inputHint: "One row per subject. Event must be 1 for event and 0 for censoring; time must be non-negative.",
    roles: [
      { key: "time", label: "Follow-up time", kind: "number", required: true },
      { key: "event", label: "Event (0 / 1)", kind: "number", required: true },
      { key: "group", label: "Group", kind: "category", required: false },
    ],
    defaultMapping: { time: "time", event: "event", group: "group" },
    sampleData: samples.km,
  },
  {
    id: "survival-forest",
    name: "Survival forest",
    family: "Survival",
    summary: "Effect estimates and confidence intervals against an adjustable null reference.",
    inputHint: "Provide model estimates and lower/upper confidence limits from the same model and scale.",
    roles: [
      { key: "label", label: "Variable", kind: "label", required: true },
      { key: "estimate", label: "Estimate", kind: "number", required: true },
      { key: "lower", label: "Lower CI", kind: "number", required: true },
      { key: "upper", label: "Upper CI", kind: "number", required: true },
      { key: "group", label: "Group", kind: "category", required: false },
    ],
    defaultMapping: { label: "label", estimate: "estimate", lower: "lower", upper: "upper", group: "group" },
    sampleData: samples.forest,
  },
  {
    id: "roc",
    name: "ROC",
    family: "Model evaluation",
    summary: "Raw multi-model ROC or supplied time-dependent ROC curves with explicit uncertainty and evaluation horizons.",
    inputHint: "Raw mode calculates ROC/AUC from 0/1 outcomes and held-out scores. Time-dependent mode displays upstream estimates and pointwise 95% confidence limits without recomputing censoring-aware statistics.",
    roles: [
      { key: "truth", label: "True class (0 / 1)", kind: "number", required: true },
      { key: "score", label: "Prediction score", kind: "number", required: true },
      { key: "group", label: "Model", kind: "category", required: false },
      { key: "fpr", label: "False-positive rate", kind: "number", required: true },
      { key: "tpr", label: "True-positive rate", kind: "number", required: true },
      { key: "tprLower", label: "TPR lower 95% CI", kind: "number", required: true },
      { key: "tprUpper", label: "TPR upper 95% CI", kind: "number", required: true },
      { key: "horizon", label: "Evaluation horizon", kind: "number", required: true },
      { key: "auc", label: "AUC", kind: "number", required: true },
      { key: "aucLower", label: "AUC lower 95% CI", kind: "number", required: true },
      { key: "aucUpper", label: "AUC upper 95% CI", kind: "number", required: true },
    ],
    defaultMapping: { truth: "truth", score: "score", group: "model", fpr: "", tpr: "", tprLower: "", tprUpper: "", horizon: "", auc: "", aucLower: "", aucUpper: "" },
    sampleData: samples.roc,
    examples: [
      { label: "Example 1 · Raw predictions", description: "Two models evaluated on binary outcomes; ROC and trapezoidal AUC are calculated in-browser.", data: samples.roc, mapping: { truth: "truth", score: "score", group: "model", fpr: "", tpr: "", tprLower: "", tprUpper: "", horizon: "", auc: "", aucLower: "", aucUpper: "" } },
      { label: "Example 2 · Time-dependent + CI", description: "Censoring-aware time-dependent ROC coordinates, pointwise TPR intervals, horizons, and AUC intervals supplied by an upstream survival model.", data: samples.rocTimeDependent, mapping: { truth: "", score: "", group: "group", fpr: "fpr", tpr: "tpr", tprLower: "tpr_lower", tprUpper: "tpr_upper", horizon: "horizon", auc: "auc", aucLower: "auc_lower", aucUpper: "auc_upper" }, settings: { rocInputMode: "precomputed-time" } },
    ],
  },
  {
    id: "funnel", name: "Funnel", family: "Evidence synthesis", summary: "Study effects against precision with inverse-variance center and pseudo 95% funnel limits.", inputHint: "One row per independent study estimate. SE must be positive and on the same effect scale; asymmetry is not by itself proof of publication bias.",
    roles: [{ key: "label", label: "Study", kind: "label", required: true }, { key: "estimate", label: "Effect estimate", kind: "number", required: true }, { key: "error", label: "Standard error", kind: "number", required: true }], defaultMapping: { label: "study", estimate: "effect", error: "se" }, sampleData: samples.funnel,
  },
  ...(["precision-recall", "calibration", "decision-curve"] as const).map((id) => ({
    id, name: id === "precision-recall" ? "Precision–recall" : id === "calibration" ? "Calibration" : "Decision curve", family: "Model evaluation",
    summary: id === "precision-recall" ? "Precision–recall curves and average precision from binary outcomes and held-out scores." : id === "calibration" ? "Grouped observed-versus-predicted calibration with Wilson 95% intervals and identity reference." : "Net benefit across threshold probabilities with treat-all and treat-none references.",
    inputHint: id === "precision-recall" ? "One row per subject per model. Outcome must be 0/1; any continuous held-out ranking score is accepted. Average precision is prevalence-dependent." : "One row per subject per model. Outcome must be 0/1; prediction must be a held-out probability in [0,1]. Repeated subjects across model names are allowed.",
    roles: [{ key: "subject", label: "Subject ID", kind: "label" as const, required: false }, { key: "truth", label: "Observed outcome (0 / 1)", kind: "number" as const, required: true }, { key: "score", label: id === "precision-recall" ? "Prediction / ranking score" : "Predicted probability", kind: "number" as const, required: true }, { key: "group", label: "Model", kind: "category" as const, required: false }],
    defaultMapping: { subject: "sample", truth: "truth", score: "score", group: "model" }, sampleData: samples.roc,
  })),
  {
    id: "nomogram", name: "Nomogram", family: "Clinical prediction", summary: "Aligned predictor-level point assignments supplied by a documented fitted model.", inputHint: "Provide predictor, displayed level, and already-derived points. This renderer does not fit a model or infer individual risk.",
    roles: [{ key: "group", label: "Predictor", kind: "category", required: true }, { key: "label", label: "Level", kind: "label", required: true }, { key: "value", label: "Assigned points", kind: "number", required: true }], defaultMapping: { group: "predictor", label: "level", value: "points" }, sampleData: samples.nomogram,
  },
  {
    id: "lasso-path", name: "LASSO path", family: "Model development", summary: "Coefficient trajectories across positive regularization parameters from an upstream penalized model.", inputHint: "Provide one row per feature and lambda. Paths are descriptive; model selection and cross-validation must be performed upstream without test-set leakage.",
    roles: [{ key: "x", label: "Lambda", kind: "number", required: true }, { key: "y", label: "Coefficient", kind: "number", required: true }, { key: "group", label: "Feature", kind: "category", required: true }], defaultMapping: { x: "lambda", y: "coefficient", group: "feature" }, sampleData: samples.lasso,
  },
  {
    id: "km-cutoff", name: "Cutoff KM", family: "Survival", summary: "Kaplan–Meier curves stratified by a single supplied risk-score cutoff.", inputHint: "Provide subject-level follow-up, event, risk score, and one constant cutoff derived upstream. Optimizing and evaluating the cutoff in the same cohort is exploratory and optimistic.",
    roles: [{ key: "time", label: "Follow-up time", kind: "number", required: true }, { key: "event", label: "Event (0 / 1)", kind: "number", required: true }, { key: "score", label: "Risk score", kind: "number", required: true }, { key: "cutoff", label: "Supplied cutoff", kind: "number", required: true }], defaultMapping: { time: "time", event: "event", score: "score", cutoff: "cutoff" }, sampleData: samples.kmCutoff,
  },
  {
    id: "risk-score", name: "Risk-score panel", family: "Model evaluation", summary: "Subjects ranked by supplied risk score with an aligned binary-outcome strip.", inputHint: "One row per subject with a score and observed 0/1 outcome. This descriptive panel does not estimate discrimination, calibration, or clinical utility.",
    roles: [{ key: "label", label: "Subject", kind: "label", required: true }, { key: "score", label: "Risk score", kind: "number", required: true }, { key: "truth", label: "Observed outcome (0 / 1)", kind: "number", required: true }], defaultMapping: { label: "sample", score: "score", truth: "outcome" }, sampleData: samples.riskScore,
  },
  ...(["venn", "upset"] as const).map((id) => ({
    id,
    name: id === "venn" ? "Venn" : "UpSet",
    family: "Set relationships",
    summary: id === "venn" ? "Exact two-to-seven-set intersections using classic circles or a compact radial exact-intersection layout." : "Adaptive ranked exact intersections with a membership matrix, set-size summaries, and downloadable members.",
    inputHint: "Use item–set membership rows, or genomic peak intervals (set, chromosome, start, end). Duplicate rows collapse; peak counts are disjoint atomic genomic segments with constant active-set membership.",
    roles: [
      { key: "item", label: "Item / peak ID", kind: "label" as const, required: false },
      { key: "set", label: "Set", kind: "category" as const, required: true },
      { key: "chromosome", label: "Chromosome (peak input)", kind: "category" as const, required: false },
      { key: "start", label: "Start (peak input)", kind: "number" as const, required: false },
      { key: "end", label: "End (peak input)", kind: "number" as const, required: false },
    ],
    defaultMapping: { item: "item", set: "set", chromosome: "", start: "", end: "" },
    sampleData: samples.sets,
    examples: [
      { label: "Example 1 · Membership", description: "Long-form item–set membership; repeated item–set rows are deduplicated before exact combinations are counted.", data: samples.sets, mapping: { item: "item", set: "set", chromosome: "", start: "", end: "" } },
      { label: "Example 2 · Peak overlap", description: "Half-open genomic intervals split into disjoint chromosome-specific segments wherever the active set membership changes.", data: samples.setPeaks, mapping: { item: "peak_id", set: "set", chromosome: "chromosome", start: "start", end: "end" } },
    ],
  })),
  ...(["sankey", "chord"] as const).map((id) => ({
    id,
    name: id === "sankey" ? "Sankey" : "Chord",
    family: id === "sankey" ? "Flow" : "Relationships",
    summary: id === "sankey" ? "Weighted source-to-target flows with proportional node and ribbon widths." : "Circular weighted relationships between categorical sectors.",
    inputHint: id === "sankey" ? "One row per directed flow with a strictly positive weight. Repeated source–target–group rows are aggregated and disclosed." : "One row per categorical relationship with a strictly positive weight. Repeated source–target rows are aggregated; Chord color represents the source sector.",
    roles: [
      { key: "source", label: "Source", kind: "category" as const, required: true },
      { key: "target", label: "Target", kind: "category" as const, required: true },
      { key: "value", label: "Weight", kind: "number" as const, required: true },
      ...(id === "sankey" ? [{ key: "group", label: "Group", kind: "category" as const, required: false }] : []),
    ],
    defaultMapping: (id === "sankey" ? { source: "source", target: "target", value: "value", group: "group" } : { source: "source", target: "target", value: "value" }) as Record<string, string>,
    sampleData: samples.network,
  })),
  {
    id: "alluvial",
    name: "Alluvial",
    family: "Multi-stage flow",
    summary: "Weighted cohorts traced across two or more ordered categorical axes.",
    inputHint: "Long format: one row per flow ID and ordered axis. A flow must retain one positive weight across every supplied axis.",
    roles: [
      { key: "flow", label: "Flow ID", kind: "label", required: true },
      { key: "axis", label: "Ordered axis", kind: "category", required: true },
      { key: "stratum", label: "Stratum", kind: "category", required: true },
      { key: "value", label: "Weight", kind: "number", required: true },
      { key: "group", label: "Ribbon group", kind: "category", required: false },
    ],
    defaultMapping: { flow: "flow_id", axis: "axis", stratum: "stratum", value: "value", group: "group" },
    sampleData: samples.alluvial,
  },
  {
    id: "ligand-receptor",
    name: "Ligand–receptor",
    family: "Cell communication",
    summary: "Directed sender–ligand–receptor–receiver relationships with explicit evidence and weight.",
    inputHint: "One row per supplied ligand–receptor interaction. Weight must be strictly positive and its upstream meaning must be documented.",
    roles: [
      { key: "sourceCell", label: "Sender cell", kind: "category", required: true },
      { key: "ligand", label: "Ligand", kind: "label", required: true },
      { key: "receptor", label: "Receptor", kind: "label", required: true },
      { key: "targetCell", label: "Receiver cell", kind: "category", required: true },
      { key: "value", label: "Interaction weight", kind: "number", required: true },
      { key: "evidence", label: "Evidence / method", kind: "category", required: true },
    ],
    defaultMapping: { sourceCell: "source_cell", ligand: "ligand", receptor: "receptor", targetCell: "target_cell", value: "weight", evidence: "evidence" },
    sampleData: samples.ligandReceptor,
  },
  ...(["network", "ppi", "cerna", "mirna-target", "cnet", "enrichment-map"] as const).map((id) => {
    const metadata = {
      network: { name: "Network", family: "Relationships", summary: "General node–edge network with explicit direction, weight, sign, type, grouping, and isolated-node records.", sample: samples.generalNetwork },
      ppi: { name: "PPI network", family: "Molecular interactions", summary: "Protein–protein interaction network that keeps evidence type and interaction weight explicit.", sample: samples.ppiNetwork },
      cerna: { name: "ceRNA network", family: "Regulatory relationships", summary: "Typed lncRNA/miRNA/mRNA relationship network for explicitly supplied putative ceRNA edges.", sample: samples.cernaNetwork },
      "mirna-target": { name: "miRNA–target", family: "Regulatory relationships", summary: "Directed miRNA-to-target relationships with validation/evidence class retained as edge type.", sample: samples.mirnaNetwork },
      cnet: { name: "Cnet", family: "Enrichment relationships", summary: "Bipartite enriched-term–gene membership network with term and gene nodes kept distinct.", sample: samples.cnetNetwork },
      "enrichment-map": { name: "Enrichment map", family: "Enrichment relationships", summary: "Term similarity network whose edge weight represents an explicitly supplied overlap or similarity score.", sample: samples.enrichmentMapNetwork },
    }[id];
    return {
      id,
      name: metadata.name,
      family: metadata.family,
      summary: metadata.summary,
      inputHint: "One row per record. Node rows require node and may declare group/type/value; edge rows require source/target and may declare non-negative weight, direction, sign, edge type, and group.",
      roles: [
        { key: "recordType", label: "Record type (node / edge)", kind: "category" as const, required: true },
        { key: "node", label: "Node ID", kind: "label" as const, required: false },
        { key: "source", label: "Edge source", kind: "label" as const, required: false },
        { key: "target", label: "Edge target", kind: "label" as const, required: false },
        { key: "weight", label: "Edge weight", kind: "number" as const, required: false },
        { key: "direction", label: "Direction", kind: "category" as const, required: false },
        { key: "sign", label: "Sign", kind: "category" as const, required: false },
        { key: "edgeType", label: "Edge type / evidence", kind: "category" as const, required: false },
        { key: "group", label: "Node / edge group", kind: "category" as const, required: false },
        { key: "nodeType", label: "Node type", kind: "category" as const, required: false },
        { key: "nodeValue", label: "Node value / size", kind: "number" as const, required: false },
      ],
      defaultMapping: { recordType: "record_type", node: "node", source: "source", target: "target", weight: "weight", direction: "direction", sign: "sign", edgeType: "edge_type", group: "group", nodeType: "node_type", nodeValue: "node_value" },
      sampleData: metadata.sample,
    };
  }),
  ...(["tree", "dendrogram"] as const).map((id) => ({
    id,
    name: id === "tree" ? "Tree" : "Dendrogram",
    family: id === "tree" ? "Hierarchy" : "Hierarchical clustering",
    summary: id === "tree" ? "Parent–child hierarchy drawn as a rooted tree without converting branches into a generic network." : "Rooted hierarchy whose internal merge heights determine dendrogram branch positions.",
    inputHint: id === "tree" ? "One row per unique node with exactly one blank-parent root. Input child order is preserved." : "One row per unique node with one root; leaf heights are zero and every parent height must be at least each child height.",
    roles: [
      { key: "node", label: "Node ID", kind: "label" as const, required: true },
      { key: "parent", label: "Parent ID", kind: "label" as const, required: false },
      { key: "label", label: "Display label", kind: "label" as const, required: false },
      { key: "group", label: "Leaf group", kind: "category" as const, required: false },
      { key: "height", label: "Merge height", kind: "number" as const, required: id === "dendrogram" },
    ],
    defaultMapping: { node: "node", parent: "parent", label: "label", group: "group", height: "height" },
    sampleData: id === "tree" ? samples.tree : samples.dendrogram,
  })),
  {
    id: "circos",
    name: "Circos",
    family: "Genomic context",
    summary: "A shared genomic coordinate system for concentric bars, heatmaps, scatter, labels, fusions, correlations, and links.",
    inputHint: "Each row declares record_type and an explicit chromosome/contig length from one reference build. Link, fusion, and correlation rows additionally need target coordinates and target sequence length.",
    roles: [
      { key: "recordType", label: "Record type", kind: "category", required: true },
      { key: "chromosome", label: "Chromosome", kind: "category", required: true },
      { key: "start", label: "Start", kind: "number", required: true },
      { key: "end", label: "End", kind: "number", required: true },
      { key: "chromosomeLength", label: "Chromosome / contig length", kind: "number", required: true },
      { key: "value", label: "Value / link weight", kind: "number", required: false },
      { key: "label", label: "Label", kind: "label", required: false },
      { key: "track", label: "Track", kind: "category", required: false },
      { key: "targetChromosome", label: "Target chromosome", kind: "category", required: false },
      { key: "targetStart", label: "Target start", kind: "number", required: false },
      { key: "targetEnd", label: "Target end", kind: "number", required: false },
      { key: "targetChromosomeLength", label: "Target chromosome / contig length", kind: "number", required: false },
    ],
    defaultMapping: { recordType: "record_type", chromosome: "chromosome", start: "start", end: "end", chromosomeLength: "chromosome_length", value: "value", label: "label", track: "track", targetChromosome: "target_chromosome", targetStart: "target_start", targetEnd: "target_end", targetChromosomeLength: "target_chromosome_length" },
    sampleData: samples.circos,
  },
  {
    id: "manhattan",
    name: "Manhattan",
    family: "Genomic association",
    summary: "Genome-wide association significance across naturally ordered chromosomes.",
    inputHint: "One row per tested variant with a chromosome, positive base-pair position, P value in (0, 1], and optional label.",
    roles: [
      { key: "chromosome", label: "Chromosome", kind: "category", required: true },
      { key: "position", label: "Position (bp)", kind: "number", required: true },
      { key: "pValue", label: "P value", kind: "number", required: true },
      { key: "label", label: "Variant / locus label", kind: "label", required: false },
    ],
    defaultMapping: { chromosome: "chromosome", position: "position", pValue: "p_value", label: "variant" },
    sampleData: samples.manhattan,
  },
  {
    id: "qq",
    name: "QQ",
    family: "Genomic association",
    summary: "Observed versus expected −log10 P values for association-calibration assessment.",
    inputHint: "One row per test with a P value in (0, 1]; expected quantiles are calculated from rank using (i − 0.5) / n.",
    roles: [
      { key: "pValue", label: "P value", kind: "number", required: true },
      { key: "label", label: "Variant label", kind: "label", required: false },
    ],
    defaultMapping: { pValue: "p_value", label: "variant" },
    sampleData: samples.qq,
  },
  {
    id: "chromosome-ideogram",
    name: "Chromosome ideogram",
    family: "Genomic context",
    summary: "Naturally ordered chromosome bars partitioned into supplied cytoband intervals.",
    inputHint: "One row per non-overlapping band with chromosome, zero-based start, end greater than start, optional stain, and band label.",
    roles: [
      { key: "chromosome", label: "Chromosome", kind: "category", required: true },
      { key: "start", label: "Start (bp)", kind: "number", required: true },
      { key: "end", label: "End (bp)", kind: "number", required: true },
      { key: "stain", label: "Cytoband stain", kind: "category", required: false },
      { key: "label", label: "Band label", kind: "label", required: false },
    ],
    defaultMapping: { chromosome: "chromosome", start: "start", end: "end", stain: "stain", label: "band" },
    sampleData: samples.chromosomeIdeogram,
  },
  {
    id: "snp-density",
    name: "SNP density",
    family: "Genomic context",
    summary: "Binned variant density along naturally ordered chromosome ideograms.",
    inputHint: "One row per genomic bin with chromosome, zero-based start, end greater than start, and a non-negative variant count or density.",
    roles: [
      { key: "chromosome", label: "Chromosome", kind: "category", required: true },
      { key: "start", label: "Bin start (bp)", kind: "number", required: true },
      { key: "end", label: "Bin end (bp)", kind: "number", required: true },
      { key: "value", label: "Variant count / density", kind: "number", required: true },
    ],
    defaultMapping: { chromosome: "chromosome", start: "start", end: "end", value: "variant_count" },
    sampleData: samples.snpDensity,
  },
  {
    id: "genome-tracks",
    name: "Genome tracks",
    family: "Genomic context",
    summary: "Aligned interval tracks on one shared naturally ordered genomic coordinate system.",
    inputHint: "One row per feature interval with chromosome, zero-based start, end greater than start, track, optional numeric value, and optional label.",
    roles: [
      { key: "chromosome", label: "Chromosome", kind: "category", required: true },
      { key: "start", label: "Start (bp)", kind: "number", required: true },
      { key: "end", label: "End (bp)", kind: "number", required: true },
      { key: "value", label: "Track value", kind: "number", required: false },
      { key: "track", label: "Track", kind: "category", required: true },
      { key: "label", label: "Feature label", kind: "label", required: false },
    ],
    defaultMapping: { chromosome: "chromosome", start: "start", end: "end", value: "value", track: "track", label: "feature" },
    sampleData: samples.genomeTracks,
  },
  ...(["waterfall", "oncoplot"] as const).map((id) => ({
    id,
    name: id === "waterfall" ? "Mutation waterfall" : "Oncoplot",
    family: "Cancer genomics",
    summary: id === "waterfall" ? "Samples ranked by total alteration burden with stacked alteration classes." : "Gene-by-sample alteration matrix with optional sample burden and gene-frequency margins.",
    inputHint: "Long format: one row per sample–gene alteration event. Repeated sample–gene rows are retained as multiple alteration classes.",
    roles: [
      { key: "sample", label: "Sample", kind: "category" as const, required: true },
      { key: "gene", label: "Gene", kind: "category" as const, required: true },
      { key: "alteration", label: "Alteration class", kind: "category" as const, required: true },
    ],
    defaultMapping: { sample: "sample", gene: "gene", alteration: "alteration" },
    sampleData: samples.alterations,
  })),
  {
    id: "motif-logo",
    name: "Motif logo",
    family: "Sequence motif",
    summary: "DNA sequence logo from position-specific A/C/G/T probabilities.",
    inputHint: "One row per unique positive integer position. A, C, G, and T must be probabilities in [0, 1] that sum to 1; no small-sample correction is inferred.",
    roles: [
      { key: "position", label: "Position", kind: "number", required: true },
      { key: "A", label: "A probability", kind: "number", required: true },
      { key: "C", label: "C probability", kind: "number", required: true },
      { key: "G", label: "G probability", kind: "number", required: true },
      { key: "T", label: "T probability", kind: "number", required: true },
    ],
    defaultMapping: { position: "position", A: "A", C: "C", G: "G", T: "T" },
    sampleData: samples.motifLogo,
  },
  ...(["pie", "donut", "waffle"] as const).map((id) => ({
    id,
    name: id === "pie" ? "Pie" : id === "donut" ? "Donut" : "Waffle",
    family: "Composition",
    summary: id === "pie"
      ? "Part-to-whole composition encoded by sector angle and area."
      : id === "donut"
        ? "Part-to-whole composition with a central total and compact ring geometry."
        : "Approximate part-to-whole composition on a discrete unit grid.",
    inputHint: "One row per mutually exclusive category with a non-negative value. Values are normalized to the displayed total.",
    roles: [
      { key: "category", label: "Category", kind: "category" as const, required: true },
      { key: "value", label: "Value", kind: "number" as const, required: true },
    ],
    defaultMapping: { category: "category", value: "value" },
    sampleData: samples.composition,
  })),
  {
    id: "rose",
    name: "Rose",
    family: "Cyclic comparison",
    summary: "Equal-angle sectors whose areas encode magnitude rather than part-to-whole share.",
    inputHint: "One row per ordered category with a non-negative magnitude. Rows are not normalized to a compositional total.",
    roles: [
      { key: "category", label: "Ordered category", kind: "category", required: true },
      { key: "value", label: "Magnitude", kind: "number", required: true },
    ],
    defaultMapping: { category: "category", value: "value" },
    sampleData: samples.rose,
  },
  ...(["treemap", "sunburst"] as const).map((id) => ({
    id,
    name: id === "treemap" ? "Treemap" : "Sunburst",
    family: "Hierarchical composition",
    summary: id === "treemap" ? "Nested rectangles encode hierarchical part-to-whole area." : "Concentric rings encode parent-child hierarchy and descendant share.",
    inputHint: "One row per unique node. Parent is blank only for the single root. Leaf values must be non-negative; internal totals are calculated from descendants.",
    roles: [
      { key: "node", label: "Node", kind: "label" as const, required: true },
      { key: "parent", label: "Parent", kind: "label" as const, required: false },
      { key: "value", label: "Leaf value", kind: "number" as const, required: true },
    ],
    defaultMapping: { node: "node", parent: "parent", value: "value" },
    sampleData: samples.hierarchy,
  })),
  {
    id: "radar",
    name: "Radar",
    family: "Multivariate profile",
    summary: "Comparable multivariate profiles arranged on shared radial axes.",
    inputHint: "Long format with at least three features per series. Every series must contain the same features on a common, interpretable scale.",
    roles: [
      { key: "feature", label: "Feature", kind: "category", required: true },
      { key: "value", label: "Value", kind: "number", required: true },
      { key: "series", label: "Series", kind: "category", required: false },
    ],
    defaultMapping: { feature: "feature", value: "value", series: "series" },
    sampleData: samples.radar,
  },
  {
    id: "polar-profile",
    name: "Polar profile",
    family: "Cyclic profile",
    summary: "Ordered or cyclic measurements connected around a shared radial scale.",
    inputHint: "Rows follow the angular order. Each series must contain the same ordered categories and non-negative values.",
    roles: [
      { key: "angle", label: "Ordered angle category", kind: "category", required: true },
      { key: "value", label: "Value", kind: "number", required: true },
      { key: "series", label: "Series", kind: "category", required: false },
    ],
    defaultMapping: { angle: "angle", value: "value", series: "series" },
    sampleData: samples.polarProfile,
  },
  {
    id: "population-pyramid",
    name: "Population pyramid",
    family: "Paired distribution",
    summary: "Two non-negative distributions mirrored across a common ordered-category baseline.",
    inputHint: "Long format with exactly two groups and one non-negative value per ordered category/group pair.",
    roles: [
      { key: "category", label: "Ordered category", kind: "category", required: true },
      { key: "value", label: "Value", kind: "number", required: true },
      { key: "group", label: "Group", kind: "category", required: true },
    ],
    defaultMapping: { category: "category", value: "value", group: "group" },
    sampleData: samples.populationPyramid,
  },
];

export const plotReferences = {
  visualizationHistory: { citation: "Friendly, 2008. A Brief History of Data Visualization. Handbook of Data Visualization.", href: "https://doi.org/10.1007/978-3-540-33037-0_2" },
  graphicalPerception: { citation: "Cleveland & McGill, 1984. Graphical Perception. JASA.", href: "https://doi.org/10.1080/01621459.1984.10478080" },
  errorBars: { citation: "Cumming, Fidler & Vaux, 2007. Error bars in experimental biology. J Cell Biol.", href: "https://doi.org/10.1083/jcb.200611141" },
  anscombe: { citation: "Anscombe, 1973. Graphs in Statistical Analysis. The American Statistician.", href: "https://doi.org/10.1080/00031305.1973.10478966" },
  pca: { citation: "Jolliffe & Cadima, 2016. Principal component analysis: a review and recent developments. Phil Trans R Soc A.", href: "https://doi.org/10.1098/rsta.2015.0202" },
  pcoa: { citation: "Gower, 1966. Some distance properties of latent root and vector methods used in multivariate analysis. Biometrika.", href: "https://doi.org/10.1093/biomet/53.3-4.325" },
  umap: { citation: "McInnes et al., 2018. UMAP: Uniform Manifold Approximation and Projection. JOSS.", href: "https://doi.org/10.21105/joss.00861" },
  tsne: { citation: "van der Maaten & Hinton, 2008. Visualizing Data using t-SNE. JMLR.", href: "https://doi.org/10.5555/1390156.1390177" },
  nmds: { citation: "Kruskal, 1964. Nonmetric multidimensional scaling: a numerical method. Psychometrika.", href: "https://doi.org/10.1007/BF02289694" },
  permanova: { citation: "Anderson, 2001. A new method for non-parametric multivariate analysis of variance. Austral Ecology.", href: "https://doi.org/10.1111/j.1442-9993.2001.01070.pp.x" },
  boxplot: { citation: "McGill, Tukey & Larsen, 1978. Variations of Box Plots. The American Statistician.", href: "https://doi.org/10.1080/00031305.1978.10479236" },
  violin: { citation: "Hintze & Nelson, 1998. Violin Plots: A Box Plot-Density Trace Synergism. The American Statistician.", href: "https://doi.org/10.1080/00031305.1998.10480559" },
  rawData: { citation: "Weissgerber et al., 2015. Beyond Bar and Line Graphs: Time for a New Data Presentation Paradigm. PLoS Biol.", href: "https://doi.org/10.1371/journal.pbio.1002128" },
  raincloud: { citation: "Allen et al., 2021. Raincloud plots: a multi-platform tool for robust data visualization. Wellcome Open Res.", href: "https://doi.org/10.12688/wellcomeopenres.15191.2" },
  histogram: { citation: "Scott, 1979. On optimal and data-based histograms. Biometrika.", href: "https://doi.org/10.1093/biomet/66.3.605" },
  kernelDensity: { citation: "Silverman, 1986. Density Estimation for Statistics and Data Analysis. Chapman and Hall.", href: "https://doi.org/10.1201/9781315140919" },
  ridgeline: { citation: "Wilke, 2019. Fundamentals of Data Visualization: Visualizing many distributions at once. O'Reilly.", href: "https://clauswilke.com/dataviz/visualizing-many-distributions-at-once.html" },
  volcano: { citation: "Li, 2012. Volcano Plots in Analyzing Differential Expressions with mRNA Microarrays. J Bioinform Comput Biol.", href: "https://doi.org/10.1142/S0219720012310038" },
  ma: { citation: "Yang et al., 2002. Normalization for cDNA microarray data. Nucleic Acids Res.", href: "https://doi.org/10.1093/nar/30.4.e15" },
  lollipop: { citation: "Jay & Brouwer, 2016. Lollipops in the Clinic: Information Dense Mutation Plots for Precision Medicine. PLoS ONE.", href: "https://doi.org/10.1371/journal.pone.0160519" },
  heatmap: { citation: "Wilkinson & Friendly, 2009. The History of the Cluster Heat Map. The American Statistician.", href: "https://doi.org/10.1198/tas.2009.0033" },
  clusteredHeatmap: { citation: "Eisen et al., 1998. Cluster analysis and display of genome-wide expression patterns. PNAS.", href: "https://doi.org/10.1073/pnas.95.25.14863" },
  complexHeatmap: { citation: "Gu, Eils & Schlesner, 2016. Complex heatmaps reveal patterns and correlations in multidimensional genomic data. Bioinformatics.", href: "https://doi.org/10.1093/bioinformatics/btw313" },
  corrgram: { citation: "Friendly, 2002. Corrgrams: Exploratory Displays for Correlation Matrices. The American Statistician.", href: "https://doi.org/10.1198/000313002533" },
  enrichment: { citation: "Yu et al., 2012. clusterProfiler: an R package for comparing biological themes among gene clusters. OMICS.", href: "https://doi.org/10.1089/omi.2011.0118" },
  gsea: { citation: "Subramanian et al., 2005. Gene set enrichment analysis: a knowledge-based approach. PNAS.", href: "https://doi.org/10.1073/pnas.0506580102" },
  geneOntology: { citation: "Ashburner et al., 2000. Gene Ontology: tool for the unification of biology. Nature Genetics.", href: "https://doi.org/10.1038/75556" },
  kegg: { citation: "Kanehisa & Goto, 2000. KEGG: Kyoto Encyclopedia of Genes and Genomes. Nucleic Acids Research.", href: "https://doi.org/10.1093/nar/28.1.27" },
  pathwayImpact: { citation: "Tarca et al., 2009. A novel signaling pathway impact analysis. Bioinformatics.", href: "https://doi.org/10.1093/bioinformatics/btn577" },
  wordCloud: { citation: "Viegas, Wattenberg & Feinberg, 2009. Participatory Visualization with Wordle. IEEE TVCG.", href: "https://doi.org/10.1109/TVCG.2009.171" },
  mapProjection: { citation: "Snyder, 1987. Map Projections—A Working Manual. US Geological Survey Professional Paper 1395.", href: "https://doi.org/10.3133/pp1395" },
  kaplanMeier: { citation: "Kaplan & Meier, 1958. Nonparametric Estimation from Incomplete Observations. JASA.", href: "https://doi.org/10.1080/01621459.1958.10501452" },
  forest: { citation: "Lewis & Clarke, 2001. Forest plots: trying to see the wood and the trees. BMJ.", href: "https://doi.org/10.1136/bmj.322.7300.1479" },
  roc: { citation: "Hanley & McNeil, 1982. The meaning and use of the area under a ROC curve. Radiology.", href: "https://doi.org/10.1148/radiology.143.1.7063747" },
  funnel: { citation: "Egger et al., 1997. Bias in meta-analysis detected by a simple, graphical test. BMJ.", href: "https://doi.org/10.1136/bmj.315.7109.629" },
  precisionRecall: { citation: "Saito & Rehmsmeier, 2015. The Precision-Recall Plot Is More Informative than the ROC Plot When Evaluating Binary Classifiers on Imbalanced Datasets. PLoS ONE.", href: "https://doi.org/10.1371/journal.pone.0118432" },
  calibration: { citation: "Van Calster et al., 2019. Calibration: the Achilles heel of predictive analytics. BMC Medicine.", href: "https://doi.org/10.1186/s12916-019-1466-7" },
  decisionCurve: { citation: "Vickers & Elkin, 2006. Decision curve analysis: a novel method for evaluating prediction models. Medical Decision Making.", href: "https://doi.org/10.1177/0272989X06295361" },
  nomogram: { citation: "Iasonos et al., 2008. How to build and interpret a nomogram for cancer prognosis. Journal of Clinical Oncology.", href: "https://doi.org/10.1200/JCO.2007.12.9791" },
  lasso: { citation: "Tibshirani, 1996. Regression Shrinkage and Selection via the Lasso. Journal of the Royal Statistical Society B.", href: "https://doi.org/10.1111/j.2517-6161.1996.tb02080.x" },
  cutoff: { citation: "Altman et al., 1994. Dangers of using optimal cutpoints in the evaluation of prognostic factors. Journal of the National Cancer Institute.", href: "https://doi.org/10.1093/jnci/86.11.829" },
  tripod: { citation: "Collins et al., 2015. Transparent Reporting of a multivariable prediction model for Individual Prognosis Or Diagnosis (TRIPOD). Annals of Internal Medicine.", href: "https://doi.org/10.7326/M14-0697" },
  venn: { citation: "Venn, 1880. On the Diagrammatic and Mechanical Representation of Propositions and Reasonings. Philosophical Magazine.", href: "https://doi.org/10.1080/14786448008626877" },
  upset: { citation: "Lex et al., 2014. UpSet: Visualization of Intersecting Sets. IEEE TVCG.", href: "https://doi.org/10.1109/TVCG.2014.2346248" },
  sankeyHistory: { citation: "Schmidt, 2008. The Sankey Diagram in Energy and Material Flow Management: Part I. J Ind Ecol.", href: "https://doi.org/10.1111/j.1530-9290.2008.00004.x" },
  sankey: { citation: "Schmidt, 2008. The Sankey Diagram in Energy and Material Flow Management. J Ind Ecol.", href: "https://doi.org/10.1111/j.1530-9290.2008.00015.x" },
  alluvial: { citation: "Rosvall & Bergstrom, 2010. Mapping Change in Large Networks. PLoS ONE.", href: "https://doi.org/10.1371/journal.pone.0008694" },
  chord: { citation: "Gu et al., 2014. circlize Implements and Enhances Circular Visualization in R. Bioinformatics.", href: "https://doi.org/10.1093/bioinformatics/btu393" },
  ligandReceptor: { citation: "Armingol et al., 2021. Deciphering cell–cell interactions and communication from gene expression. Nat Rev Genet.", href: "https://doi.org/10.1038/s41576-020-00292-x" },
  networkLayout: { citation: "Fruchterman & Reingold, 1991. Graph drawing by force-directed placement. Software: Practice and Experience.", href: "https://doi.org/10.1002/spe.4380211102" },
  cytoscape: { citation: "Shannon et al., 2003. Cytoscape: a software environment for integrated models of biomolecular interaction networks. Genome Research.", href: "https://doi.org/10.1101/gr.1239303" },
  cerna: { citation: "Salmena et al., 2011. A ceRNA hypothesis: the Rosetta Stone of a hidden RNA language? Cell.", href: "https://doi.org/10.1016/j.cell.2011.07.014" },
  mirna: { citation: "Bartel, 2009. MicroRNAs: target recognition and regulatory functions. Cell.", href: "https://doi.org/10.1016/j.cell.2009.01.002" },
  enrichmentMap: { citation: "Merico et al., 2010. Enrichment Map: a network-based method for gene-set enrichment visualization and interpretation. PLoS ONE.", href: "https://doi.org/10.1371/journal.pone.0013984" },
  tidyTree: { citation: "Reingold & Tilford, 1981. Tidier drawings of trees. IEEE Transactions on Software Engineering.", href: "https://doi.org/10.1109/TSE.1981.234519" },
  dendrogram: { citation: "Murtagh & Contreras, 2012. Algorithms for hierarchical clustering: an overview. Wiley Interdisciplinary Reviews: Data Mining and Knowledge Discovery.", href: "https://doi.org/10.1002/widm.53" },
  circos: { citation: "Krzywinski et al., 2009. Circos: An information aesthetic for comparative genomics. Genome Res.", href: "https://doi.org/10.1101/gr.092759.109" },
  manhattan: { citation: "Turner, 2014. qqman: an R package for visualizing GWAS results using Q-Q and Manhattan plots. bioRxiv.", href: "https://doi.org/10.1101/005165" },
  qq: { citation: "Wilk & Gnanadesikan, 1968. Probability plotting methods for the analysis of data. Biometrika.", href: "https://doi.org/10.1093/biomet/55.1.1" },
  genomeBrowser: { citation: "Kent et al., 2002. The Human Genome Browser at UCSC. Genome Research.", href: "https://doi.org/10.1101/gr.229102" },
  snpDensity: { citation: "Yin et al., 2021. CMplot: Circle Manhattan Plot. Genomics Proteomics Bioinformatics.", href: "https://doi.org/10.1016/j.gpb.2020.10.005" },
  genomeTracks: { citation: "Hahne & Ivanek, 2016. Visualizing Genomic Data Using Gviz and Bioconductor. Methods Mol Biol.", href: "https://doi.org/10.1007/978-1-4939-3578-9_16" },
  cbioportal: { citation: "Cerami et al., 2012. The cBio Cancer Genomics Portal. Cancer Discovery.", href: "https://doi.org/10.1158/2159-8290.CD-12-0095" },
  sequenceLogo: { citation: "Schneider & Stephens, 1990. Sequence logos: a new way to display consensus sequences. Nucleic Acids Research.", href: "https://doi.org/10.1093/nar/18.20.6097" },
  pie: { citation: "Spence, 2005. No Humble Pie: The Origins and Usage of a Statistical Chart. Journal of Educational and Behavioral Statistics.", href: "https://doi.org/10.3102/10769986030004353" },
  nightingale: { citation: "Magnello, 2012. Victorian statistical graphics and the iconography of Florence Nightingale's polar area graph. BSHM Bulletin.", href: "https://doi.org/10.1080/17498430.2012.618102" },
  treemap: { citation: "Shneiderman, 1992. Tree visualization with tree-maps: 2-d space-filling approach. ACM Transactions on Graphics.", href: "https://doi.org/10.1145/102377.115768" },
  sunburst: { citation: "Stasko & Zhang, 2000. Focus+context display and navigation techniques for enhancing radial, space-filling hierarchy visualizations. IEEE InfoVis.", href: "https://doi.org/10.1109/INFVIS.2000.885107" },
  radar: { citation: "Kolence & Kiviat, 1973. Software Unit Profiles & Kiviat Figures. ACM SIGMETRICS Performance Evaluation Review.", href: "https://doi.org/10.1145/1041613.1041614" },
  populationPyramid: { citation: "Wilson, 2016. Visualising the demographic factors which shape population age structure. Demographic Research.", href: "https://doi.org/10.4054/DemRes.2016.35.29" },
  loess: { citation: "Cleveland, 1979. Robust Locally Weighted Regression and Smoothing Scatterplots. Journal of the American Statistical Association.", href: "https://doi.org/10.1080/01621459.1979.10481038" },
  hexbin: { citation: "Carr et al., 1987. Scatterplot Matrix Techniques for Large N. Journal of the American Statistical Association.", href: "https://doi.org/10.1080/01621459.1987.10478510" },
  composition: { citation: "Aitchison, 1986. The Statistical Analysis of Compositional Data. Chapman and Hall.", href: "https://doi.org/10.1007/978-94-009-4109-0" },
  correlationTest: { citation: "Student, 1908. The Probable Error of a Correlation Coefficient. Biometrika.", href: "https://doi.org/10.2307/2331554" },
} satisfies Record<string, PlotReference>;

const plotGuidanceSeeds: Record<PlotType, PlotGuidance> = {
  bar: {
    definition: "以共同基线上的长度编码类别汇总量；同一数据契约可切换分组、堆叠、百分比、双向、分面、极坐标、目标线、断轴、双轴和叠加表达。柱形仍代表汇总量，而不是完整原始分布。",
    suitableData: "离散类别的计数、比例、均值或其他汇总值；可输入预先计算的 SD/SEM，也可由长表重复观测计算。Bullet 需要目标值，叠加/双轴需要第二数值，显著性标记需要有效 P 值。",
    answers: "类别间大小、组成、方向、分层差异或相对目标的偏离。百分比图回答组成而非绝对量；双轴仅用于单位明确且必须同时展示的指标。",
    origin: "William Playfair 在 1786 年的《Commercial and Political Atlas》中用柱形比较贸易量，奠定了现代统计柱状图的形式。",
    references: [plotReferences.visualizationHistory, plotReferences.graphicalPerception, plotReferences.errorBars],
  },
  line: {
    definition: "按实际 X 采样值的自然顺序连接相邻估计值，以位置和线段方向编码连续变化；可将预先计算的 SD、SEM 或 95% CI 半宽显示为逐点误差棒或连续不确定性带。",
    suitableData: "具有自然顺序的时间、剂量或阶段数据；每行应是一个估计值。若计算逐时间点显著性，必须提供均值、SD 或 SEM、显式样本量 n 和分组，并明确数据不是配对或重复测量。",
    answers: "指标随顺序如何变化，不同序列的方向、速度或响应模式是否不同，以及已给定的不确定性范围有多大。可选 Welch 检验只回答各时间点相对参考组的独立样本差异，不检验整体时间×组交互。",
    origin: "Playfair 同样在 1786 年用时间序列折线展示贸易变化，使“随时间阅读趋势”成为统计图形的核心用途。",
    references: [plotReferences.visualizationHistory, plotReferences.graphicalPerception, plotReferences.errorBars],
  },
  scatter: {
    definition: "把观察对象映射到二维位置；可叠加边际分布、二维密度、六边形计数、协方差椭圆、凸包、三变量散点矩阵、正交 3D 投影或三元组成坐标。每种变体回答的问题不同，并非装饰性切换。",
    suitableData: "标准视图需要两个连续变量；pair-matrix 与 3D 需要第三个连续变量；ternary 需要三个非负且每行总和大于零的组成分量。分组可决定颜色以及拟合/统计是合并还是组内计算。",
    answers: "变量的联合分布、局部密度、非线性趋势、组内包络、三变量关系或三部分组成权衡是什么。3D 投影会损失深度判断，ternary 只表示相对组成。",
    references: [plotReferences.anscombe, plotReferences.loess, plotReferences.hexbin, plotReferences.composition],
  },
  correlation: {
    definition: "在成对数值的可视分布基础上，用 Pearson r 或 Spearman ρ 量化方向与强度；可选 P 值明确标注为 Pearson t 检验或 Spearman 的渐近 t 近似。",
    suitableData: "成对连续或有序数值；Pearson 适合近似线性且无强影响点的关系，Spearman 适合单调关系或秩数据。组内模式要求每组有足够样本。",
    answers: "两变量关系的方向、强度与在指定检验假设下的兼容性如何；P 值不等于效应大小，相关也不说明因果。",
    references: [plotReferences.anscombe, plotReferences.correlationTest, plotReferences.loess],
  },
  pca: {
    definition: "一种线性无监督降维方法，把高维数据旋转到相互正交、按解释方差由高到低排列的主成分轴；scores 表示观察对象，loadings 表示特征对各轴的贡献。",
    suitableData: "高维特征×观察矩阵，如组学、影像特征、形态学、光谱、传感器或标准化临床特征。矩阵模式会透明记录过滤、变换、中心化与缩放。",
    answers: "主要变异轴是什么，观察对象是否聚集、分离或存在离群点，哪些特征推动这些轴，以及分组或批次是否与总体结构相关。Scree 图用于判断方差在各主成分间如何分配。",
    origin: "Karl Pearson 于 1901 年提出空间点的最佳拟合直线与平面，Harold Hotelling 在 1933 年进一步建立并命名主成分分析。",
    references: [plotReferences.pca, plotReferences.permanova],
  },
  pcoa: {
    definition: "从样本间距离或相异度矩阵出发，通过特征分解构造低维坐标；它不是直接对原始特征矩阵做 PCA。",
    suitableData: "由明确距离或相异度度量得到的 PCoA 坐标，常见于生态、微生物群、组成或其他距离型数据。",
    answers: "在所选距离定义下，各观察对象的相似性结构和组间分离情况如何。",
    origin: "J. C. Gower 在 1966 年系统阐述了从距离关系恢复主坐标的数学性质，因此 PCoA 也常称为 Gower 主坐标分析。",
    references: [plotReferences.pcoa, plotReferences.permanova],
  },
  umap: {
    definition: "一种非线性流形学习方法，先构建高维邻域图，再寻找尽量保留局部邻域结构的低维嵌入。",
    suitableData: "高维数据上游计算得到的 UMAP 坐标，如单细胞、多组学、影像或表型特征。",
    answers: "局部邻域、亚群和异质性结构如何；不宜把远距离直接解释为定量差异。",
    origin: "McInnes 等人在 2018 年发布 UMAP，把黎曼几何与拓扑思想转化为可扩展的通用降维算法。",
    references: [plotReferences.umap, plotReferences.permanova],
  },
  tsne: {
    definition: "t-SNE 以高维与低维邻域概率分布之间的差异为目标进行非线性嵌入；本模块只展示上游已计算坐标，不重新拟合。",
    suitableData: "由记录了随机种子、perplexity、距离度量、初始化与迭代设置的 t-SNE 流程产生的样本或细胞坐标。",
    answers: "局部邻域和潜在亚群在所给嵌入中如何组织。簇间距离、簇面积与全局方向通常没有直接定量含义。",
    origin: "van der Maaten 与 Hinton 于 2008 年以重尾 Student t 分布缓解拥挤问题，形成今天广泛使用的 t-SNE。",
    references: [plotReferences.tsne, plotReferences.permanova],
  },
  nmds: {
    definition: "非度量多维尺度分析仅要求低维距离保持原始相异度的秩次关系，通过最小化 stress 得到配置；本模块展示预计算结果。",
    suitableData: "由明确相异度（如 Bray–Curtis）和多次随机起点得到的 NMDS 坐标，并应同时记录维数、收敛状态与 stress。",
    answers: "在相异度排序意义下样本结构、梯度和组间重叠如何；轴方向与绝对尺度本身通常没有固定含义。",
    origin: "Kruskal 于 1964 年系统建立非度量多维尺度分析与 stress 优化框架，使秩次相异度能够映射到低维空间。",
    references: [plotReferences.nmds, plotReferences.permanova],
  },
  box: {
    definition: "用中位数、上下四分位数、四分位距和按规则定义的“须”概括分布；须不一定代表最小值和最大值。",
    suitableData: "一个或多个分组下的连续原始观测值。",
    answers: "各组的中位数、四分位范围、离群值和整体离散程度有何不同。",
    origin: "John Tukey 在探索性数据分析中推广箱线图；McGill、Tukey 与 Larsen 于 1978 年讨论了缺口和变宽等变体。",
    references: [plotReferences.boxplot],
  },
  violin: {
    definition: "把核密度估计沿中心轴镜像形成“琴身”，并可叠加中位数、箱线或原始点来展示分布形状。",
    suitableData: "各组具有足够观测数的连续数据，适合展示分布密度。",
    answers: "各组分布的形状、偏态、长尾或多峰特征是否不同。",
    origin: "Hintze 与 Nelson 在 1998 年提出 violin plot，意图把箱线图的稳健摘要与密度轨迹结合起来。",
    references: [plotReferences.violin],
  },
  beeswarm: {
    definition: "把每个原始观察值画成点，并在分类轴方向进行防重叠排列；点群宽度来自排布，不是核密度估计。",
    suitableData: "样本量较小或中等的分组连续数据，希望保留每一个原始观察点。",
    answers: "数据实际分散在哪里，是否存在重复、空档、离群点和组内异质性。",
    references: [plotReferences.rawData],
  },
  raincloud: {
    definition: "把半小提琴密度“云”、原始观察点“雨”和箱线或区间摘要组合在同一组中。",
    suitableData: "分组连续原始数据，且希望同时展示密度、稳健汇总和单个观察。",
    answers: "组间中心趋势、分布形状和个体变异能否同时得到支持。",
    origin: "Allen 等人于 2019 年系统整理并命名 raincloud plot，用一个视图同时保留分布、原始数据和汇总统计。",
    references: [plotReferences.raincloud],
  },
  histogram: {
    definition: "把连续数值划入等宽区间，以每个区间的频数绘制相邻矩形；图形形状会随箱数改变。",
    suitableData: "单组或多组连续原始观测，可按分组与分面比较；应报告箱数或箱宽。",
    answers: "数据集中在哪些范围，是否偏态、多峰、长尾或存在稀疏区间。",
    references: [plotReferences.histogram, plotReferences.rawData],
  },
  density: {
    definition: "用核函数平滑每个观察值并求和，得到连续概率密度估计；曲线面积而非高度总和对应 1。",
    suitableData: "具有足够样本量的连续原始观测；带宽必须可追踪并避免把小样本的平滑形状当作真实结构。",
    answers: "分布的整体形状、偏态、峰和尾部如何，且这些形状对带宽是否稳定。",
    references: [plotReferences.kernelDensity, plotReferences.violin],
  },
  ridge: {
    definition: "把多个密度曲线沿分类轴错开排列，以紧凑方式比较许多组的分布轮廓。",
    suitableData: "多个有序或可比较分组的连续原始观测，尤其适合时间点、剂量层级或细胞群。",
    answers: "分布位置与形状如何沿组别移动；曲线重叠较多时不适合精确读取单个密度值。",
    references: [plotReferences.kernelDensity, plotReferences.graphicalPerception],
  },
  volcano: {
    definition: "以效应量（常为 log₂ fold change）为 X，以 −log₁₀(P 值或 FDR) 为 Y 的差异结果散点图。",
    suitableData: "每个特征具有效应量和 P 值或校正 P 值的差异分析结果。",
    answers: "哪些特征同时具有较大的变化幅度和较强的统计证据，变化方向是什么。",
    origin: "它在高通量差异表达分析中流行，点云常形成火山轮廓；Li 在 2012 年系统总结了这种图的统计解释。",
    references: [plotReferences.volcano],
  },
  ma: {
    definition: "以平均丰度 A 为横轴、两条件的对数比值 M 为纵轴，检查效应量是否随总体信号强度变化。",
    suitableData: "每个特征具有平均丰度、效应量及统计证据的差异分析结果。",
    answers: "变化幅度是否依赖总体丰度，低丰度区域是否存在偏差或异常波动。",
    origin: "M–A 表示 log ratio 与 mean average，这种图在早期双通道微阵列归一化和强度依赖偏差诊断中形成。",
    references: [plotReferences.ma],
  },
  quadrant: {
    definition: "用一条 X 阈值线和一条 Y 阈值线把散点图分成四个决策区域，以比较两套量化结果的一致与不一致。",
    suitableData: "同一对象的两套效应量、评分或测量值，并具有可解释的 X/Y 阈值。",
    answers: "两套结果在哪些区域一致或不一致，哪些对象跨越预设决策阈值。",
    references: [plotReferences.anscombe],
  },
  errorbar: {
    definition: "用中心标记配合端帽线段表示估计值及其不确定性或离散程度；必须明确线段是 SD、SEM 还是置信区间。",
    suitableData: "类别汇总值及对应的非负 SD 或 SEM；误差类型必须事先明确。",
    answers: "各组中心估计及其变异或估计精度如何，不替代原始数据分布。",
    references: [plotReferences.errorBars],
  },
  area: {
    definition: "在有序 X 上绘制折线并填充到基线的面积，以强调总量、累计量或趋势的视觉重量。",
    suitableData: "有序 X 上的连续数值或多条序列，适合强调整体量级或累积变化。",
    answers: "趋势和总体量级如何随顺序变化；重叠面积较多时不适合精确组间比较。",
    origin: "Playfair 的早期经济时间序列图已经使用线下填充来强调盈余与赤字，成为现代面积图的前身。",
    references: [plotReferences.visualizationHistory, plotReferences.graphicalPerception],
  },
  lollipop: {
    definition: "用从基线伸出的细杆和末端圆点编码数值，保留柱状图的共同基线，同时降低大面积色块的视觉重量。",
    suitableData: "类别对应的单个数值、效应量、评分或排名。",
    answers: "项目的排序、极端值和相对大小是什么，同时减少实心柱的视觉重量。",
    origin: "这种形状后来被基因组学借用于蛋白结构上的突变位置图；本工具的 Lollipop 是更通用的类别—数值图。",
    references: [plotReferences.lollipop],
  },
  heatmap: {
    definition: "把数值矩阵的每个单元格映射为颜色；如果未启用聚类，行列顺序完全由输入数据决定。",
    suitableData: "行列结构明确的数值矩阵，可使用原始尺度或经过合理标准化的值。",
    answers: "二维矩阵中哪些区域呈现高低模式、梯度、块状结构或异常值。",
    origin: "矩阵着色可追溯到 19 世纪统计图形；Wilkinson 与 Friendly 的历史综述梳理了它发展为现代热图的过程。",
    references: [plotReferences.heatmap, plotReferences.complexHeatmap],
  },
  "clustered-heatmap": {
    definition: "先按指定距离和连接方法对行列进行层次聚类，再按树状图顺序重排热图；颜色和树结构表达的是两层信息。",
    suitableData: "可比较的数值矩阵；行列聚类前应明确缩放、距离和连接方法。",
    answers: "哪些行或列具有相似模式，是否形成候选亚群、模块或共变结构。",
    origin: "聚类热图有更早的统计学前身；Eisen 等人在 1998 年把它用于全基因组表达模式后，使其成为组学分析的经典图形。",
    references: [plotReferences.clusteredHeatmap, plotReferences.heatmap, plotReferences.complexHeatmap],
  },
  "correlation-heatmap": {
    definition: "以同一组变量同时作为行和列，用颜色编码每对变量的相关系数，因此矩阵通常对称且对角线为 1。",
    suitableData: "同一批观察上测量的多个连续或有序变量。",
    answers: "变量之间的相关方向、强度、冗余和潜在模块结构是什么。",
    origin: "Friendly 在 2002 年提出 corrgram 体系，强调同时用颜色、顺序和符号阅读相关矩阵结构。",
    references: [plotReferences.corrgram, plotReferences.complexHeatmap],
  },
  enrichment: {
    definition: "每个功能条目用一个点表示，通常以位置编码富集比例、点大小编码命中数、颜色编码校正 P 值。",
    suitableData: "预计算富集结果表，包含条目、明确测试背景、富集比例、命中数量和 FDR；数据库版本与多重校正方法应保存在分析记录中。",
    answers: "哪些功能条目同时具有较强统计证据、较高富集比例和足够命中数量。",
    origin: "这种多通道编码随着 clusterProfiler 等富集分析工具普及，用一个点同时压缩展示效应、规模和统计证据。",
    references: [plotReferences.enrichment],
  },
  "enrichment-bar": {
    definition: "每个功能条目对应一根横向或纵向柱，柱长编码富集比例、计数或效应量，主要用于清晰排序。",
    suitableData: "可排序的预计算富集结果表，至少包含条目、明确测试背景、富集比例和 FDR。",
    answers: "最主要的富集条目如何排序，其效应或富集程度有多大。",
    references: [plotReferences.enrichment],
  },
  gsea: {
    definition: "沿完整的排序特征列表计算运行和统计量，并标出基因集成员命中位置和 leading-edge 区域。",
    suitableData: "基于完整排序列表计算的运行富集分数和基因集命中位置。",
    answers: "一个基因集主要富集在排序列表的哪一端，驱动富集的命中集中在哪里。",
    origin: "Subramanian 等人在 2005 年系统提出 GSEA，目的是避免只依赖任意显著性阈值截取基因列表。",
    references: [plotReferences.gsea],
  },
  "go-circle": { definition: "把预计算 GO 条目排列在装饰性圆周上，以颜色表示 FDR、圆面积近似表示命中数，并保留 BP、CC、MF 本体分组。", suitableData: "具有明确背景基因数、Gene ratio、命中数和 FDR 的 GO 富集结果；本模块不执行富集检验。", answers: "哪些 GO 条目在三个本体分支中具有更强证据或更多命中；圆周位置不表示条目相似度。", references: [plotReferences.geneOntology, plotReferences.enrichment, plotReferences.graphicalPerception] },
  "kegg-circle": { definition: "把预计算 KEGG 通路以圆形概览展示，颜色、面积分别编码 FDR 与命中数。", suitableData: "具有明确测试背景、Gene ratio、命中数和 FDR 的 KEGG 富集结果。", answers: "哪些通路兼具统计证据和命中规模；圆周顺序与距离没有定量含义。", references: [plotReferences.kegg, plotReferences.enrichment, plotReferences.graphicalPerception] },
  "go-chord": { definition: "以圆形节点和弦线展示 GO term 与成员基因的多对多关系，线宽只编码明确提供的基因效应绝对值。", suitableData: "预计算 GO term–gene membership 长表，并在同一 term 的各行一致重复背景、ratio、count 与 FDR。", answers: "哪些基因同时连接多个富集条目，成员效应方向如何；曲率和弧顺序不代表统计距离。", references: [plotReferences.geneOntology, plotReferences.chord, plotReferences.enrichment] },
  "pathway-impact": { definition: "把上游拓扑感知方法给出的 pathway impact 与 −log10(FDR) 放在正交坐标上，并以点面积表示命中数。", suitableData: "已由明确算法计算的 pathway impact、FDR、Gene ratio、命中数和背景；不能把普通富集比例伪装成 impact。", answers: "哪些通路同时有较高拓扑影响和统计证据；影响分数的定义取决于上游方法。", references: [plotReferences.pathwayImpact, plotReferences.kegg] },
  "nes-fdr": { definition: "以共同零基线显示带方向的 NES，并独立披露 FDR。", suitableData: "由 GSEA 或兼容 ranked-set 方法预计算的 NES、FDR、Gene ratio、集合来源和排序背景。", answers: "哪些基因集富集于排序列表上端或下端，以及证据强弱如何。", references: [plotReferences.gsea, plotReferences.enrichment] },
  "multi-gsea": { definition: "在同一完整共同排序坐标中叠加多个预计算 running-ES 轨迹，并显示各自命中位置、NES 和 FDR。", suitableData: "每个集合在从 0 到共同 background 端点、足够密集且递增的 rank 网格上的 running ES 与 0/1 hits；两端 ES=0，集合内 NES/FDR 恒定。", answers: "多个集合的富集方向、峰位置和 hit density 如何在同一排序尺度上比较；曲线只显示上游结果，不重算统计量。", references: [plotReferences.gsea] },
  "enrichment-ridge": { definition: "按富集条目分层绘制成员级排序统计量的核密度，每一条密度独立归一化。", suitableData: "每个预计算富集条目下的成员基因及其排名统计量，并一致重复 term 的 FDR、ratio 与背景。", answers: "不同条目的成员统计量主要位于排序的哪一侧、分布是否集中；ridge 高度不能跨条目比较总量。", references: [plotReferences.gsea, plotReferences.kernelDensity] },
  "sankey-bubble": { definition: "用非守恒 relationship ribbon 连接来源本体与条目，以每条独立 ribbon 的宽度表示 ratio、bubble 面积近似表示 count；它不是满足流量守恒的 Sankey 图。", suitableData: "每个预计算富集条目的来源、背景、ratio、count 与 FDR；各 ratio 不要求在来源内相加为固定总量。", answers: "不同来源关联哪些条目以及单条关联的相对规模如何；面积和宽度不适合精确读数，也不能解释成来源总流量的分配。", references: [plotReferences.enrichment, plotReferences.sankey, plotReferences.graphicalPerception] },
  "geographic-map": { definition: "以等距圆柱投影近似定位经纬度站点，并用点面积表示非负量值。", suitableData: "十进制度纬度、经度、站点名称与量值；不包含行政边界推断。", answers: "观察站点大致位于何处、哪些区域量值更大；投影会扭曲距离和面积。", references: [plotReferences.mapProjection, plotReferences.graphicalPerception] },
  petal: { definition: "以花瓣长度近似编码类别值的装饰性径向排名图。", suitableData: "少量类别及非负汇总值，适合概览或海报式摘要。", answers: "哪些维度相对突出；角度与花瓣形状降低精确比较能力，正式定量比较优先使用 bar/dot。", references: [plotReferences.graphicalPerception] },
  "word-cloud": { definition: "以字号近似表示词项权重，并采用确定性网格避免随机位置漂移。", suitableData: "唯一词项及严格正权重，例如文本频次或主题权重。", answers: "哪些词更突出；位置、方向和颜色没有数量含义，字号也不适合精确比值判断。", references: [plotReferences.wordCloud, plotReferences.graphicalPerception] },
  km: {
    definition: "一种处理删失数据的非参数阶梯估计，每个事件时点按条件存活概率的乘积更新生存曲线。",
    suitableData: "个体级随访时间、事件状态和可选分组，包含正确记录的删失。",
    answers: "随时间推移的事件未发生概率如何，各组生存轨迹何时开始分离。",
    origin: "Kaplan 与 Meier 在 1958 年发表乘积极限估计，使不同随访长度和右删失能够被统一处理。",
    references: [plotReferences.kaplanMeier],
  },
  "survival-forest": {
    definition: "把多个效应估计及其置信区间逐行排列在共同参考线上；这里的 forest plot 与“随机森林算法”无关。",
    suitableData: "同一统计尺度上的效应估计及置信区间，如 HR、OR 或回归系数。",
    answers: "各因素或亚组效应的方向、大小和精确度如何，置信区间是否跨越无效线。",
    origin: "森林图从荟萃分析的效应量汇总图发展而来，后来也广泛用于 Cox 回归、亚组分析和多变量结果展示。",
    references: [plotReferences.forest],
  },
  roc: {
    definition: "普通模式遍历二分类预测阈值；时间依赖模式显示上游删失感知方法提供的 FPR、TPR、逐点区间、评价时点和 AUC 区间。",
    suitableData: "验证集或外部队列的二分类真实标签与连续预测分数，或由明确生存方法计算的时间依赖 ROC 坐标与不确定性。",
    answers: "模型区分两类对象的能力和不同阈值下敏感度/特异度权衡如何；时间依赖模式还比较指定时点，但两种模式都不能说明校准或临床效用。",
    origin: "ROC 的思想源自信号检测问题，随后进入诊断检验和预测模型评价；AUC 可解释为随机阳性样本得分高于随机阴性样本的概率。",
    references: [plotReferences.roc],
  },
  funnel: { definition: "把独立研究的效应量放在横轴、精度 1/SE 放在纵轴，并叠加逆方差中心与伪 95% 漏斗边界。", suitableData: "同一效应尺度上的研究级估计与正标准误。", answers: "研究结果是否围绕汇总效应近似对称；不对称也可能来自异质性、小样本效应或方法差异，不能单独证明发表偏倚。", origin: "漏斗图源于荟萃分析中用于观察小样本效应和结果不对称性的图形诊断方法。", references: [plotReferences.funnel] },
  "precision-recall": { definition: "遍历分类阈值，以召回率为横轴、阳性预测值为纵轴，并计算 average precision。", suitableData: "二分类结局与独立验证或交叉验证得到的连续分数。", answers: "在类别不平衡时，模型找回阳性与保持阳性预测值之间的权衡。", references: [plotReferences.precisionRecall, plotReferences.tripod] },
  calibration: { definition: "按预测概率分箱，比较每箱平均预测概率与实际事件比例，并显示 Wilson 95% 区间和理想对角线。", suitableData: "0/1 观察结局和真正概率尺度的预测值。", answers: "预测概率是否系统性过高或过低；分箱图不能替代校准截距、斜率和外部验证。", references: [plotReferences.calibration, plotReferences.tripod] },
  "decision-curve": { definition: "在一系列阈值概率下计算模型净获益，并与 treat-all 和 treat-none 策略比较。", suitableData: "0/1 结局与验证集预测概率；阈值范围应有临床意义。", answers: "在给定错判权衡下使用模型是否比全做或全不做更有净获益；不是治疗建议。", references: [plotReferences.decisionCurve, plotReferences.tripod] },
  nomogram: { definition: "把已拟合模型中不同预测变量水平转换成对齐的积分标尺。", suitableData: "上游模型已经给出的 predictor-level points。", answers: "各变量水平如何贡献模型积分；本图不重新拟合模型，也不能证明临床有效性。", references: [plotReferences.nomogram, plotReferences.tripod] },
  "lasso-path": { definition: "展示 L1 正则化参数变化时各特征系数从零进入并收缩的轨迹。", suitableData: "上游 penalized regression 输出的 lambda、feature、coefficient 长表。", answers: "不同正则化强度下模型稀疏性和系数稳定性如何；最终 lambda 必须在训练流程内选择。", references: [plotReferences.lasso, plotReferences.tripod] },
  "km-cutoff": { definition: "使用一个明确提供的风险分数截点把受试者分组，再计算 Kaplan–Meier 曲线。", suitableData: "随访时间、删失事件、连续风险分数和同一常数截点。", answers: "该预先指定或上游优化截点下两组生存经验分布如何；同队列寻优再评价会夸大差异。", references: [plotReferences.kaplanMeier, plotReferences.cutoff] },
  "risk-score": { definition: "按风险分数排序受试者，并对齐显示二分类结局条带。", suitableData: "每位受试者一个风险分数和0/1观察结局。", answers: "分数排序与结局分布的描述性关系；不能替代 ROC、校准、DCA 或外部验证。", references: [plotReferences.tripod] },
  venn: {
    definition: "用经典圆形（2–3 集合）或径向精确交集索引（4–7 集合）表示观察到的集合组合；径向模式不是闭合曲线 Venn 图。",
    suitableData: "2–7 个集合的 item–set 成员长表，或带 set、chromosome、start、end 的 genomic peak 区间。",
    answers: "少量集合之间独有和共享成员各有多少；size-weighted 模式只是视觉提示，不是面积拟合，仍应以区域数字作为精确计数。",
    origin: "John Venn 在 1880 年系统化集合关系图；当集合多于三个时，本工具改用可辨认的径向精确交集索引，不把它冒充为经典 Venn 闭合曲线。",
    references: [plotReferences.venn, plotReferences.upset],
  },
  upset: {
    definition: "用点阵列明确标出参与某个交集的集合，再用柱长显示该精确交集的大小。",
    suitableData: "两个及以上集合的 item–set 成员关系或 genomic peak 区间，尤其适合交集组合较多的情况。",
    answers: "哪些精确集合组合构成主要交集，各交集和单集合规模分别多大，并可下载所选交集的明确成员清单。",
    origin: "Lex 等人在 2014 年提出 UpSet，目标是把难以扩展到许多集合的 Venn 图转换为可排序、可查询的矩阵视图。",
    references: [plotReferences.upset],
  },
  sankey: {
    definition: "一种有方向的流量图，节点表示阶段或状态，连接带的宽度与从来源流向去向的数量成比例。",
    suitableData: "带非负权重的来源—去向或阶段间流量数据。",
    answers: "对象、数量或比例如何在类别或阶段之间流动，主要通路在哪里。",
    origin: "Captain Sankey 在 1898 年用带宽表示蒸汽机能量输入、有效功和损失，因此这种图最初讲的是“量从哪里流到哪里”。",
    references: [plotReferences.sankeyHistory, plotReferences.sankey],
  },
  chord: {
    definition: "把类别排列在圆周上，用圆内带状连线表示类别之间的关系；带宽编码关系量，默认不包含真实空间或基因组坐标。",
    suitableData: "类别之间的成对关系及非负权重，类别数量不宜过多。",
    answers: "哪些类别之间联系最强，整体关系是否集中于少数节点或模块。",
    origin: "现代 Chord diagram 常由邻接矩阵或 from–to 表生成；circlize 等工具把这种通用圆形关系图推广到迁移、通信和生物网络。",
    references: [plotReferences.chord],
  },
  alluvial: {
    definition: "Alluvial 图把同一 flow ID 在多个有序阶段中的类别位置连接起来；每条带宽代表该 cohort 的恒定数量或权重，竖向块表示各阶段的类别总量。",
    suitableData: "同一批对象在至少两个有序时间点、状态或分类轴上的去向；每个 flow ID 在各轴应有唯一类别和一致的正权重。",
    answers: "同一 cohort 如何跨多个阶段重新分配，主要迁移路径和流失/聚合位置在哪里。阶段顺序来自输入，不由图形推断。",
    origin: "Alluvial 这一名称借用了冲积层的视觉隐喻；Rosvall 与 Bergstrom 将其用于追踪大型网络中随时间变化的模块结构。",
    references: [plotReferences.alluvial, plotReferences.sankey],
  },
  "ligand-receptor": {
    definition: "按 sender cell → ligand → receptor → receiver cell 四层展示上游给定的细胞通讯候选关系，线宽编码显式输入的 interaction weight，evidence 字段保留推断或验证来源。",
    suitableData: "来自明确配体–受体数据库和上游评分流程的细胞对、配体、受体、权重与证据类型。不同工具的分数不可在未校准时直接比较。",
    answers: "哪些细胞群可能通过哪些配体–受体对发生通信，以及候选关系由什么证据支持。表达共现或算法评分不证明直接结合、方向性效应或体内因果。",
    origin: "配体–受体网络图随着单细胞转录组细胞通讯推断方法普及而广泛使用，但它本质上是对预定义分子配对与表达/评分结果的结构化展示。",
    references: [plotReferences.ligandReceptor],
  },
  network: {
    definition: "通用 network 由节点与边构成：节点颜色编码分组，大小编码可选节点值；边宽编码非负权重，箭头编码方向，颜色编码正/负/中性符号，线型编码关系类型。孤立节点必须用独立 node 记录声明。",
    suitableData: "明确区分 node 与 edge 的关系数据。Edge 记录可给 direction、weight、sign、edge type；node 记录可给 group、type、value。布局由所选算法和整数 seed 确定，但几何距离不等于统计距离。",
    answers: "哪些对象相连、关系方向与符号是什么、哪些节点具有较高连接度或形成模块。网络中心性外观不证明因果、调控或生物学重要性。",
    origin: "图论把对象抽象为顶点和边；现代网络图借助确定性或带随机种子的布局把拓扑结构映射到二维平面。",
    references: [plotReferences.networkLayout, plotReferences.cytoscape],
  },
  ppi: {
    definition: "PPI network 专门表示蛋白质之间的物理或功能相互作用；边默认无向，但仍保留输入的证据类型、权重和方向声明。",
    suitableData: "来自明确数据库、实验或评分流程的蛋白–蛋白关系，并应保留物种、数据库版本、证据类型和评分含义。不同来源的分数不可在没有校准时直接比较。",
    answers: "候选蛋白是否处于同一相互作用模块、哪些连接由何种证据支持。数据库共现或预测边不等于体内直接结合。",
    references: [plotReferences.cytoscape, plotReferences.networkLayout],
  },
  cerna: {
    definition: "ceRNA network 用带类型的 lncRNA/miRNA/mRNA 节点和有向边表达上游给定的竞争性内源 RNA 假设关系；图形不会从相关性自动建立 ceRNA 机制。",
    suitableData: "具有 miRNA 靶向证据、表达方向、位点或其他验证依据的候选 ceRNA 关系。应分别保存预测、数据库支持和实验验证等 edge type。",
    answers: "哪些 RNA 通过共享 miRNA 形成候选调控结构，以及证据链在何处中断。它是机制假设图，不是因果证明。",
    references: [plotReferences.cerna, plotReferences.mirna],
  },
  "mirna-target": {
    definition: "从 miRNA 指向靶基因的有向二部网络；箭头表示声明的调控方向，负号通常表示抑制，但必须来自输入而非图形默认推断。",
    suitableData: "miRNA–target 配对及预测或验证类别、非负权重和可选效应符号。建议保留物种、3′UTR/位点上下文、数据库版本与验证来源。",
    answers: "一个 miRNA 可能影响哪些靶点、多个 miRNA 是否汇聚于共同靶基因，以及哪些边具有更强或更直接的证据。",
    references: [plotReferences.mirna, plotReferences.cytoscape],
  },
  cnet: {
    definition: "cnet 是富集 term 与 gene 的二部成员网络：term–gene 边表示基因属于对应富集集合，不等同于基因之间存在调控或蛋白互作。",
    suitableData: "富集结果中选定的 term–gene membership，可在 node value 中放入基因效应量或 term 显著性，但必须在图注说明尺度。",
    answers: "哪些富集条目共享驱动基因，哪些基因连接多个生物学主题。共享成员不会自动证明通路间调控。",
    references: [plotReferences.enrichment, plotReferences.cytoscape],
  },
  "enrichment-map": {
    definition: "把每个富集 term 作为节点，以基因集重叠或相似度作为无向加权边；节点分组可表示上游主题聚类。",
    suitableData: "经过明确阈值筛选的富集条目，以及由 Jaccard、overlap coefficient 或其他已记录指标计算的非负 term–term similarity。不同指标不可混用。",
    answers: "冗余富集条目如何聚成主题、哪些 term 共享大量成员。它概括 gene-set 重叠，不表示通路因果顺序。",
    references: [plotReferences.enrichmentMap, plotReferences.enrichment],
  },
  tree: {
    definition: "rooted tree 以唯一父节点关系保存层级；每个非根节点恰有一个 parent，分支位置表示层级与输入子节点顺序，而不是通用网络的力导向距离。",
    suitableData: "分类体系、谱系、决策或其他单根无环 parent–child 结构。输入顺序会作为同一父节点下的显示顺序保留。",
    answers: "对象如何从根分层展开、每条路径包含哪些父子关系。分支长度在普通 tree 中没有数值含义。",
    references: [plotReferences.tidyTree],
  },
  dendrogram: {
    definition: "dendrogram 是层次聚类结果的树形表示，内部节点的 merge height 决定分支高度；叶顺序与合并结构必须由上游聚类结果提供。",
    suitableData: "单根无环层级及每个节点的非负 height；叶通常为 0，父节点 height 不得低于任一子节点。距离、链接方法、标准化和叶排序必须在方法中记录。",
    answers: "哪些观察对象先合并、各簇在何种不相似度高度汇合。叶片间横向距离只用于排版，不是原始样本距离。",
    references: [plotReferences.dendrogram, plotReferences.tidyTree],
  },
  circos: {
    definition: "以显式提供的染色体或 contig 长度及真实坐标为唯一圆周骨架，在同一坐标系叠加 bar、heatmap、scatter、label 等同心数据轨道，并把 link、fusion、correlation 精确锚定到两个基因组区间。每个数值轨道独立缩放并显示范围；它不同于只表达类别关系的 Chord。",
    suitableData: "同一参考基因组版本下的染色体或 contig 序列长度与安全整数起止坐标、区段数值及区段间连接。每行用 record_type 明确图层语义；correlation 必须为 [-1,1] 的系数，数值记录不得留空。",
    answers: "多类事件位于哪些基因组区域，不同轨道是否共定位，跨染色体或远距离连接的整体格局如何。图形不会推断参考版本或结构变异真实性。",
    origin: "Krzywinski 等人在 2009 年创建 Circos 来展示比较基因组和结构变异；圆内连带只是它众多轨道中的一种。",
    references: [plotReferences.circos],
  },
  manhattan: {
    definition: "把每个遗传变异按染色体与碱基位置排列在连续基因组轴上，纵轴为 −log10(P)；交替颜色只帮助区分相邻染色体。",
    suitableData: "GWAS、QTL 或其他全基因组关联检验结果；每行需包含染色体、正整数位置和 (0,1] 内的 P 值。不同基因组版本不可混用；浏览器预览最多 20,000 个位点。",
    answers: "哪些基因组区域出现超出预设阈值的关联信号，以及信号是否聚集成区域。它不单独证明因果变异，也不替代群体结构、批次和多重检验控制。",
    origin: "这类图因高信号形成类似城市天际线的峰群而得名 Manhattan plot，后成为 GWAS 的标准总览。",
    references: [plotReferences.manhattan],
  },
  qq: {
    definition: "将排序后的观测 P 值与均匀零假设下的期望分位数比较，两个轴都显示 −log10(P)。对角线表示整体校准一致。",
    suitableData: "同一分析框架产生的一组有效 P 值；应保留全部检验而非只输入显著结果。浏览器预览上限为 20,000 个 P 值，更大分析应使用有记录的确定性子集或上游栅格化流程。",
    answers: "P 值整体是否接近期望分布，是否存在系统性膨胀、保守性或仅在尾部偏离。偏离可能来自真实多基因信号，也可能来自混杂或模型失配。",
    origin: "Q–Q plot 源自概率绘图：把样本分位数与理论分位数逐点比较，而不是先汇总为单一统计量。",
    references: [plotReferences.qq, plotReferences.manhattan],
  },
  "chromosome-ideogram": {
    definition: "按自然染色体顺序排列长度成比例的染色体条，并用输入的细胞遗传学区带区间分割条带。",
    suitableData: "与同一参考基因组版本一致的 chromosome/start/end 区带表；stain 可留空，或使用 gneg、gpos25/50/75/100、acen、gvar、stalk，并可附 band 名称。",
    answers: "染色体的相对长度、区带边界与目标区域的大体基因组位置。该图不会从坐标自动推断真实着丝粒或细胞遗传学带。",
    references: [plotReferences.genomeBrowser],
  },
  "snp-density": {
    definition: "把预先划分的基因组窗口沿染色体排列，以颜色强度编码每个窗口的变异计数或密度。",
    suitableData: "不重叠或有明确含义的 chromosome/start/end 窗口及非负计数/密度；不同窗口宽度时应优先输入密度而非原始计数。",
    answers: "变异在基因组上的疏密是否均匀，哪些染色体区段形成高密度或低密度区域。",
    references: [plotReferences.snpDensity, plotReferences.genomeBrowser],
  },
  "genome-tracks": {
    definition: "把多个区间型数据轨道对齐到同一基因组坐标轴；每个轨道保持独立行，位置与宽度都由真实区间决定。",
    suitableData: "基因、峰、拷贝数区段、变异或注释等 chromosome/start/end 区间，附 track、可选数值和标签；所有轨道必须使用同一参考版本。",
    answers: "不同类型的基因组事件是否在同一位置重叠或邻近，以及一个区域内的多层证据如何对齐。",
    references: [plotReferences.genomeTracks, plotReferences.genomeBrowser],
  },
  waterfall: {
    definition: "按每个样本的事件总数排序，用堆叠柱显示不同 alteration class 对样本总突变/变异负荷的贡献。",
    suitableData: "长表 sample–gene–alteration 事件，可包含 SNV、indel、融合和拷贝数类别，预览最多 10,000 个事件。这里的柱高是输入事件数，不是标准化 TMB；无事件样本不会出现在纯事件长表中。",
    answers: "队列中哪些样本事件负荷较高，负荷由哪些 alteration class 构成。它不显示每个基因在每个样本中的完整矩阵。",
    references: [plotReferences.cbioportal, plotReferences.complexHeatmap],
  },
  oncoplot: {
    definition: "以基因为行、样本为列显示 alteration class；上方可给出样本事件数，右侧给出受影响样本比例。一个格可保留多种事件。",
    suitableData: "长表 sample–gene–alteration 队列结果，预览最多 10,000 个事件；样本和基因标识必须非空，alteration 类别应定义清楚。纯事件长表不能表示所选基因中完全无事件的样本。",
    answers: "常见驱动基因是否互斥或共现，队列的分子异质性与基因频率格局如何。可视共现不等于统计学互斥/共现检验。",
    references: [plotReferences.complexHeatmap, plotReferences.cbioportal],
  },
  "motif-logo": {
    definition: "在每个位置堆叠 A/C/G/T 字母；information 模式中总高度为 2−H bits，各字母高度等于其概率乘以该信息量。",
    suitableData: "DNA position probability matrix：每个正整数位置唯一，A/C/G/T 均在 [0,1] 且和为 1，最多 60 个位置且还需满足当前画幅的最小字母宽度。输入应已处理 pseudocount；工具不会反推样本量或加入小样本校正。",
    answers: "序列 motif 在哪些位置最保守、偏好哪些碱基，以及各位置的不确定性有多大。Probability 模式显示频率而非信息量。",
    origin: "Schneider 与 Stephens 在 1990 年提出 sequence logo，用堆叠字母同时表达碱基偏好和每个位点的信息含量。",
    references: [plotReferences.sequenceLogo],
  },
  pie: {
    definition: "把互斥类别占总量的比例映射为圆形扇区的角度与面积。所有扇区共同构成一个整体。",
    suitableData: "单一总体中的非负计数、构成比或资源份额，类别应互斥且数量较少。",
    answers: "每个类别占总量多少，以及少数主要部分如何构成整体。精确比较多个相近比例时应优先使用柱状图。",
    origin: "William Playfair 在 1801 年出版的统计图集中使用圆形分区图。现代饼图由此发展，但面积和角度的比较精度低于共同基线上的长度。",
    references: [plotReferences.pie, plotReferences.graphicalPerception],
  },
  donut: {
    definition: "在饼图中心留出空白的环形组成图。扇区仍编码整体中的份额，中心用于显示总量而不是第二个变量。",
    suitableData: "与饼图相同的互斥非负组成数据，适合需要在中心明确显示总量的紧凑版式。",
    answers: "整体由哪些部分构成以及总量是多少。中心孔不会提高相近比例的比较精度。",
    references: [plotReferences.pie, plotReferences.graphicalPerception],
  },
  rose: {
    definition: "把类别分成等角扇区，以扇区面积编码每一项的数值，因此半径按数值平方根缩放。它比较周期或类别强度，不要求各项相加为整体。",
    suitableData: "按时间、方向或阶段排列的非负数值，尤其适合周期模式和同权类别的强度比较。",
    answers: "哪些方向或周期阶段更高，整体轮廓是否呈现集中、偏向或季节性。不要把扇区解释为构成比例。",
    origin: "Florence Nightingale 在 1858 年用极坐标面积图呈现不同死因随月份的变化，使这种图形常被称为 Nightingale rose。",
    references: [plotReferences.nightingale, plotReferences.graphicalPerception],
  },
  waffle: {
    definition: "把总量离散成固定数量的小格，再按比例分配给各类别，是对组成比例的近似计数式表达。",
    suitableData: "互斥非负组成数据，适合面向非技术受众展示直观百分比。",
    answers: "每 100 个单位中大约有多少属于各类别。小份额会受到网格取整影响，精确值应结合标签。",
    references: [plotReferences.graphicalPerception, plotReferences.pie],
  },
  treemap: {
    definition: "用嵌套矩形表示树状层级，叶节点面积编码数值，父节点面积由后代汇总。",
    suitableData: "具有单一根节点、明确父子关系和非负叶节点数值的层级组成数据。",
    answers: "总量在多个层级如何分配，哪些分支和叶节点占据主要份额。细长矩形不适合精确比较。",
    origin: "Ben Shneiderman 在 1990 年代初提出 tree-map，用二维空间填充方式浏览大型层级文件结构。",
    references: [plotReferences.treemap, plotReferences.graphicalPerception],
  },
  sunburst: {
    definition: "以同心环表示树的深度，父节点扇区沿径向向外展开为子节点，角度编码后代份额。",
    suitableData: "具有单一根节点、明确父子关系和非负叶节点数值的层级组成数据。",
    answers: "层级路径如何从根部向外展开，各分支在不同深度的相对份额是多少。层级过深时标签会变得拥挤。",
    origin: "Sunburst 属于径向空间填充层级图。Stasko 与 Zhang 在 2000 年系统研究了这类图的聚焦与导航方法。",
    references: [plotReferences.sunburst, plotReferences.graphicalPerception],
  },
  radar: {
    definition: "把多个可比较指标放在从同一中心放射的轴上，并连接同一对象的数值形成多边形轮廓。",
    suitableData: "至少三个方向一致、量纲可比或已标准化的指标。每个系列必须包含相同指标集合。",
    answers: "对象的多维特征轮廓是否均衡，优势和短板集中在哪些指标。多边形面积不应被当作统计量。",
    origin: "Kiviat figure 在 1970 年代的软件性能分析中用于同时观察多个指标，后来发展为常见的雷达图。",
    references: [plotReferences.radar, plotReferences.graphicalPerception],
  },
  "polar-profile": {
    definition: "把有自然循环顺序的测量放在角度轴上，以半径编码数值并连接为闭合曲线。它强调周期轨迹，不是组成图。",
    suitableData: "昼夜、季节、方向、细胞周期阶段等循环顺序数据，各系列应具有相同的角度类别。",
    answers: "峰值出现在周期的哪个位置，不同系列的相位、振幅和轮廓是否不同。",
    references: [plotReferences.radar, plotReferences.graphicalPerception],
  },
  "population-pyramid": {
    definition: "把两个群体在同一组有序区间上的非负分布分别镜像到中心线两侧，以共同尺度比较形状。",
    suitableData: "恰好两个群体在年龄、分期、剂量区间或其他有序类别中的计数或比例。",
    answers: "两个群体的分布形状、峰值区间和结构差异在哪里。镜像方向是布局，不代表数值为负。",
    origin: "人口学长期使用按年龄和性别镜像排列的条形分布来读取人口结构，后来扩展到其他两组有序分布比较。",
    references: [plotReferences.populationPyramid, plotReferences.graphicalPerception],
  },
};

const advancedRendererIds = new Set<PlotType>([
  "line", "scatter", "correlation", "pca", "pcoa", "umap", "tsne", "nmds", "box", "violin", "beeswarm", "raincloud", "histogram", "density", "ridge", "ma", "quadrant", "errorbar", "area", "lollipop",
  "heatmap", "clustered-heatmap", "correlation-heatmap", "enrichment-bar", "gsea", "km", "survival-forest", "roc", "venn",
  "go-circle", "kegg-circle", "go-chord", "pathway-impact", "nes-fdr", "multi-gsea", "enrichment-ridge", "sankey-bubble", "geographic-map", "petal", "word-cloud",
  "funnel", "precision-recall", "calibration", "decision-curve", "nomogram", "lasso-path", "km-cutoff", "risk-score",
  "upset", "sankey", "alluvial", "chord", "ligand-receptor", "circos",
  "network", "ppi", "cerna", "mirna-target", "cnet", "enrichment-map", "tree", "dendrogram",
  "manhattan", "qq", "chromosome-ideogram", "snp-density", "genome-tracks", "waterfall", "oncoplot", "motif-logo",
  "pie", "donut", "rose", "waffle", "treemap", "sunburst", "radar", "polar-profile", "population-pyramid",
]);
const commonSettingKeys: Array<keyof VisualizationSettings> = [
  "title", "fontFamily", "xLabel", "yLabel", "width", "height", "titleSize", "axisLabelSize", "tickSize",
  "legendSize", "axisLineWidth", "gridLineWidth", "dataLineWidth", "pointSize", "opacity", "grid",
  "categoricalColors",
];
const hiddenLegendIds = new Set<PlotType>(["box", "violin", "beeswarm", "raincloud", "histogram", "density", "ridge", "heatmap", "clustered-heatmap", "correlation-heatmap", "venn", "upset", "sankey", "alluvial", "chord", "ligand-receptor", "circos", "manhattan", "qq", "chromosome-ideogram", "snp-density", "genome-tracks", "waterfall", "oncoplot", "motif-logo", "treemap", "funnel", "precision-recall", "calibration", "decision-curve", "nomogram", "lasso-path", "km-cutoff", "risk-score", "go-circle", "kegg-circle", "go-chord", "pathway-impact", "nes-fdr", "multi-gsea", "enrichment-ridge", "sankey-bubble", "geographic-map", "petal", "word-cloud"]);
const specializedSettingKeys: Partial<Record<PlotType, Array<keyof VisualizationSettings>>> = {
  bar: ["swapAxes", "barErrorType", "barVariant", "barInputMode", "barAnalysisMode", "barReferenceCategory", "barPAdjustment", "barOverlayType", "secondaryAxisLabel", "showSignificance", "significanceThreshold", "axisBreakStart", "axisBreakEnd", "barGap", "barBorderWidth", "barBorderColor", "errorBarLineWidth", "errorBarCapSize"],
  line: ["swapAxes", "showPoints", "lineErrorType", "lineUncertaintyStyle", "lineBandOpacity", "showSignificance", "significanceThreshold", "lineReferenceSeries", "linePAdjustment", "errorBarLineWidth", "errorBarCapSize"],
  scatter: ["swapAxes", "showLabels", "correlationMethod", "associationVariant", "associationFit", "associationPolynomialDegree", "associationLoessSpan", "associationShowConfidenceBand", "associationShowPValue", "associationGroupMode", "associationHexbinSize", "associationDensityBandwidth"],
  correlation: ["showLabels", "correlationMethod", "associationVariant", "associationFit", "associationPolynomialDegree", "associationLoessSpan", "associationShowConfidenceBand", "associationShowPValue", "associationGroupMode", "associationHexbinSize", "associationDensityBandwidth"],
  pca: ["swapAxes", "showLabels", "ordinationView", "ordinationShowEllipse", "ordinationShowHull", "ordinationShowCentroids", "ordinationShowLoadings", "ordinationLoadingCount", "ordinationUseShapes", "ordinationPermanovaR2", "ordinationPermanovaP", "ordinationPermanovaPermutations", "ordinationMethodNote"],
  pcoa: ["showLabels", "ordinationView", "ordinationShowEllipse", "ordinationShowHull", "ordinationShowCentroids", "ordinationUseShapes", "ordinationXVariance", "ordinationYVariance", "ordinationZVariance", "ordinationPermanovaR2", "ordinationPermanovaP", "ordinationPermanovaPermutations", "ordinationMethodNote"],
  umap: ["showLabels", "ordinationView", "ordinationShowEllipse", "ordinationShowHull", "ordinationShowCentroids", "ordinationUseShapes", "ordinationPermanovaR2", "ordinationPermanovaP", "ordinationPermanovaPermutations", "ordinationMethodNote"],
  tsne: ["showLabels", "ordinationView", "ordinationShowEllipse", "ordinationShowHull", "ordinationShowCentroids", "ordinationUseShapes", "ordinationPermanovaR2", "ordinationPermanovaP", "ordinationPermanovaPermutations", "ordinationMethodNote"],
  nmds: ["showLabels", "ordinationView", "ordinationShowEllipse", "ordinationShowHull", "ordinationShowCentroids", "ordinationUseShapes", "ordinationPermanovaR2", "ordinationPermanovaP", "ordinationPermanovaPermutations", "ordinationStress", "ordinationMethodNote"],
  box: ["showDensity", "showHistogram", "showBox", "showPoints", "showSampleSize", "distributionSummary", "boxErrorType", "distributionShowPairedLines", "distributionShowSignificance", "significanceThreshold", "distributionOrientation", "histogramBins", "violinBandwidth", "violinWidth", "errorBarLineWidth", "errorBarCapSize"],
  violin: ["showDensity", "showHistogram", "showBox", "showPoints", "showSampleSize", "distributionSummary", "boxErrorType", "distributionShowPairedLines", "distributionShowSignificance", "significanceThreshold", "distributionOrientation", "histogramBins", "violinBandwidth", "violinWidth", "errorBarLineWidth", "errorBarCapSize"],
  beeswarm: ["showDensity", "showHistogram", "showBox", "showPoints", "showSampleSize", "distributionSummary", "boxErrorType", "distributionShowPairedLines", "distributionShowSignificance", "significanceThreshold", "distributionOrientation", "histogramBins", "violinBandwidth", "violinWidth", "errorBarLineWidth", "errorBarCapSize"],
  raincloud: ["showDensity", "showHistogram", "showBox", "showPoints", "showSampleSize", "distributionSummary", "boxErrorType", "distributionShowPairedLines", "distributionShowSignificance", "significanceThreshold", "distributionOrientation", "histogramBins", "violinBandwidth", "violinWidth", "errorBarLineWidth", "errorBarCapSize"],
  histogram: ["showDensity", "showHistogram", "showBox", "showPoints", "showSampleSize", "distributionSummary", "boxErrorType", "distributionShowPairedLines", "distributionShowSignificance", "significanceThreshold", "distributionOrientation", "histogramBins", "violinBandwidth", "violinWidth", "errorBarLineWidth", "errorBarCapSize"],
  density: ["showDensity", "showHistogram", "showBox", "showPoints", "showSampleSize", "distributionSummary", "boxErrorType", "distributionShowPairedLines", "distributionShowSignificance", "significanceThreshold", "distributionOrientation", "histogramBins", "violinBandwidth", "violinWidth", "errorBarLineWidth", "errorBarCapSize"],
  ridge: ["showDensity", "showHistogram", "showBox", "showPoints", "showSampleSize", "distributionSummary", "boxErrorType", "distributionShowPairedLines", "distributionShowSignificance", "significanceThreshold", "distributionOrientation", "histogramBins", "violinBandwidth", "violinWidth", "errorBarLineWidth", "errorBarCapSize"],
  volcano: ["showLabels", "foldChangeThreshold", "pValueThreshold", "labelLimit"],
  ma: ["showLabels", "foldChangeThreshold", "pValueThreshold", "labelLimit"], quadrant: ["showLabels", "xThreshold", "yThreshold"],
  errorbar: ["errorBarLineWidth", "errorBarCapSize"],
  heatmap: ["heatmapScale", "heatmapColorMode", "heatmapDisplay", "heatmapShowValues", "heatmapShowSidePlot", "heatmapSidePlotStatistic", "heatmapLabelDensity", "heatmapRowAnnotationData", "heatmapColumnAnnotationData", "continuousLow", "continuousHigh", "divergingLow", "divergingMid", "divergingHigh"],
  "clustered-heatmap": ["heatmapScale", "heatmapColorMode", "heatmapDisplay", "clusterRows", "clusterColumns", "heatmapDistance", "heatmapLinkage", "heatmapShowDendrograms", "heatmapRowClusters", "heatmapColumnClusters", "heatmapShowValues", "heatmapShowSidePlot", "heatmapSidePlotStatistic", "heatmapLabelDensity", "heatmapRowAnnotationData", "heatmapColumnAnnotationData", "continuousLow", "continuousHigh", "divergingLow", "divergingMid", "divergingHigh"],
  "correlation-heatmap": ["correlationMethod", "heatmapDisplay", "heatmapTriangle", "clusterRows", "clusterColumns", "heatmapDistance", "heatmapLinkage", "heatmapShowDendrograms", "heatmapRowClusters", "heatmapColumnClusters", "heatmapShowValues", "heatmapShowSidePlot", "heatmapSidePlotStatistic", "heatmapLabelDensity", "heatmapRowAnnotationData", "heatmapColumnAnnotationData", "divergingLow", "divergingMid", "divergingHigh"],
  enrichment: ["continuousLow", "continuousHigh"], "enrichment-bar": ["continuousLow", "continuousHigh"],
  "go-circle": ["showLabels", "continuousLow", "continuousHigh"], "kegg-circle": ["showLabels", "continuousLow", "continuousHigh"], "go-chord": ["showLabels"],
  "pathway-impact": ["showLabels", "continuousLow", "continuousHigh"], "nes-fdr": ["continuousLow", "continuousHigh"], "multi-gsea": [], "enrichment-ridge": [], "sankey-bubble": ["showLabels"], "geographic-map": ["showLabels"], petal: ["showLabels"], "word-cloud": [],
  km: ["showRiskTable"], "survival-forest": ["forestReferenceValue"],
  roc: ["rocInputMode"],
  calibration: ["calibrationBinCount"],
  "decision-curve": ["decisionThresholdMinimum", "decisionThresholdMaximum", "decisionThresholdStep"],
  pie: ["compositionLabelMode"], donut: ["compositionLabelMode", "donutHole"], waffle: ["compositionLabelMode", "waffleCells"],
  rose: ["compositionLabelMode", "radialMaximum"], treemap: ["compositionLabelMode", "hierarchyGap"], sunburst: ["compositionLabelMode", "hierarchyGap"],
  radar: ["radarFillOpacity", "radialMaximum"], "polar-profile": ["radarFillOpacity", "radialMaximum"],
  "population-pyramid": ["pyramidDisplayMode"],
  manhattan: ["showLabels", "labelLimit", "genomicSignificanceLog10"],
  qq: ["showLabels", "labelLimit"],
  "chromosome-ideogram": ["showLabels"],
  "snp-density": ["continuousLow", "continuousHigh"],
  "genome-tracks": ["showLabels", "genomicTrackGap", "continuousLow", "continuousHigh"],
  waterfall: ["genomicSortSamples"],
  oncoplot: ["genomicSortSamples", "oncoplotShowMargins"],
  "motif-logo": ["motifDisplayMode"],
  sankey: ["showLabels"],
  alluvial: ["showLabels"],
  chord: ["showLabels"],
  "ligand-receptor": ["showLabels"],
  circos: ["showLabels", "genomicTrackGap", "continuousLow", "continuousHigh"],
  venn: ["setInputMode", "vennLayout", "vennProportional"],
  upset: ["setInputMode", "upsetMaxIntersections"],
  network: ["showLabels", "networkLayout", "networkSeed", "networkShowIsolates", "networkEdgeOpacity"],
  ppi: ["showLabels", "networkLayout", "networkSeed", "networkShowIsolates", "networkEdgeOpacity"],
  cerna: ["showLabels", "networkLayout", "networkSeed", "networkShowIsolates", "networkEdgeOpacity"],
  "mirna-target": ["showLabels", "networkLayout", "networkSeed", "networkShowIsolates", "networkEdgeOpacity"],
  cnet: ["showLabels", "networkLayout", "networkSeed", "networkShowIsolates", "networkEdgeOpacity"],
  "enrichment-map": ["showLabels", "networkLayout", "networkSeed", "networkShowIsolates", "networkEdgeOpacity"],
  tree: ["showLabels", "treeOrientation"],
  dendrogram: ["showLabels", "treeOrientation"],
};

const newAxislessSettingKeys: Partial<Record<PlotType, ReadonlySet<keyof VisualizationSettings>>> = {
  funnel: new Set(["title", "fontFamily", "xLabel", "yLabel", "width", "height", "titleSize", "axisLabelSize", "tickSize", "axisLineWidth", "gridLineWidth", "dataLineWidth", "pointSize", "grid", "categoricalColors"]),
  "precision-recall": new Set(["title", "fontFamily", "xLabel", "yLabel", "width", "height", "titleSize", "axisLabelSize", "tickSize", "legendSize", "axisLineWidth", "gridLineWidth", "dataLineWidth", "grid", "categoricalColors"]),
  calibration: new Set(["title", "fontFamily", "xLabel", "yLabel", "width", "height", "titleSize", "axisLabelSize", "tickSize", "legendSize", "axisLineWidth", "gridLineWidth", "dataLineWidth", "pointSize", "grid", "categoricalColors", "calibrationBinCount"]),
  "decision-curve": new Set(["title", "fontFamily", "xLabel", "yLabel", "width", "height", "titleSize", "axisLabelSize", "tickSize", "legendSize", "axisLineWidth", "gridLineWidth", "dataLineWidth", "grid", "categoricalColors", "decisionThresholdMinimum", "decisionThresholdMaximum", "decisionThresholdStep"]),
  nomogram: new Set(["title", "fontFamily", "xLabel", "width", "height", "titleSize", "axisLabelSize", "tickSize", "pointSize", "categoricalColors"]),
  "lasso-path": new Set(["title", "fontFamily", "xLabel", "yLabel", "width", "height", "titleSize", "axisLabelSize", "tickSize", "legendSize", "axisLineWidth", "gridLineWidth", "dataLineWidth", "grid", "categoricalColors"]),
  "km-cutoff": new Set(["title", "fontFamily", "xLabel", "yLabel", "width", "height", "titleSize", "axisLabelSize", "tickSize", "legendSize", "axisLineWidth", "gridLineWidth", "dataLineWidth", "grid", "categoricalColors"]),
  "risk-score": new Set(["title", "fontFamily", "xLabel", "yLabel", "width", "height", "titleSize", "axisLabelSize", "tickSize", "legendSize", "axisLineWidth", "dataLineWidth", "pointSize", "categoricalColors"]),
  "go-circle": new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "opacity", "categoricalColors", "continuousLow", "continuousHigh", "showLabels"]),
  "kegg-circle": new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "opacity", "categoricalColors", "continuousLow", "continuousHigh", "showLabels"]),
  "go-chord": new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "dataLineWidth", "categoricalColors", "showLabels"]),
  "pathway-impact": new Set(["title", "fontFamily", "xLabel", "yLabel", "width", "height", "titleSize", "axisLabelSize", "tickSize", "axisLineWidth", "gridLineWidth", "pointSize", "opacity", "grid", "continuousLow", "continuousHigh", "showLabels"]),
  "nes-fdr": new Set(["title", "fontFamily", "xLabel", "width", "height", "titleSize", "axisLabelSize", "tickSize", "axisLineWidth", "gridLineWidth", "dataLineWidth", "pointSize", "grid", "continuousLow", "continuousHigh"]),
  "multi-gsea": new Set(["title", "fontFamily", "xLabel", "yLabel", "width", "height", "titleSize", "axisLabelSize", "tickSize", "legendSize", "axisLineWidth", "gridLineWidth", "dataLineWidth", "grid", "categoricalColors"]),
  "enrichment-ridge": new Set(["title", "fontFamily", "xLabel", "width", "height", "titleSize", "axisLabelSize", "tickSize", "axisLineWidth", "gridLineWidth", "grid", "categoricalColors"]),
  "sankey-bubble": new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "opacity", "categoricalColors", "showLabels"]),
  "geographic-map": new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "pointSize", "opacity", "categoricalColors", "showLabels"]),
  petal: new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "opacity", "categoricalColors", "showLabels"]),
  "word-cloud": new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "categoricalColors"]),
  venn: new Set(["title", "fontFamily", "width", "height", "titleSize", "axisLabelSize", "tickSize", "dataLineWidth", "opacity", "categoricalColors", "setInputMode", "vennLayout", "vennProportional"]),
  upset: new Set(["title", "fontFamily", "width", "height", "titleSize", "axisLabelSize", "tickSize", "axisLineWidth", "opacity", "categoricalColors", "setInputMode", "upsetMaxIntersections"]),
  sankey: new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "opacity", "categoricalColors", "showLabels"]),
  alluvial: new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "opacity", "categoricalColors", "showLabels"]),
  chord: new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "opacity", "categoricalColors", "showLabels"]),
  "ligand-receptor": new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "opacity", "categoricalColors", "showLabels"]),
  circos: new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "pointSize", "opacity", "categoricalColors", "showLabels", "genomicTrackGap", "continuousLow", "continuousHigh"]),
  manhattan: new Set(["title", "fontFamily", "xLabel", "yLabel", "width", "height", "titleSize", "axisLabelSize", "tickSize", "axisLineWidth", "gridLineWidth", "dataLineWidth", "pointSize", "opacity", "grid", "categoricalColors", "showLabels", "labelLimit", "genomicSignificanceLog10"]),
  qq: new Set(["title", "fontFamily", "xLabel", "yLabel", "width", "height", "titleSize", "axisLabelSize", "tickSize", "axisLineWidth", "gridLineWidth", "dataLineWidth", "pointSize", "opacity", "grid", "categoricalColors", "showLabels", "labelLimit"]),
  "chromosome-ideogram": new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "axisLineWidth", "showLabels"]),
  "snp-density": new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "continuousLow", "continuousHigh"]),
  "genome-tracks": new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "axisLineWidth", "opacity", "categoricalColors", "continuousLow", "continuousHigh", "showLabels", "genomicTrackGap"]),
  waterfall: new Set(["title", "fontFamily", "width", "height", "titleSize", "axisLabelSize", "tickSize", "legendSize", "axisLineWidth", "gridLineWidth", "grid", "categoricalColors", "genomicSortSamples"]),
  oncoplot: new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "legendSize", "categoricalColors", "genomicSortSamples", "oncoplotShowMargins"]),
  "motif-logo": new Set(["title", "fontFamily", "xLabel", "yLabel", "width", "height", "titleSize", "axisLabelSize", "tickSize", "axisLineWidth", "gridLineWidth", "grid", "motifDisplayMode"]),
  network: new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "legendSize", "dataLineWidth", "pointSize", "opacity", "legendPosition", "categoricalColors", "showLabels", "networkLayout", "networkSeed", "networkShowIsolates", "networkEdgeOpacity"]),
  ppi: new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "legendSize", "dataLineWidth", "pointSize", "opacity", "legendPosition", "categoricalColors", "showLabels", "networkLayout", "networkSeed", "networkShowIsolates", "networkEdgeOpacity"]),
  cerna: new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "legendSize", "dataLineWidth", "pointSize", "opacity", "legendPosition", "categoricalColors", "showLabels", "networkLayout", "networkSeed", "networkShowIsolates", "networkEdgeOpacity"]),
  "mirna-target": new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "legendSize", "dataLineWidth", "pointSize", "opacity", "legendPosition", "categoricalColors", "showLabels", "networkLayout", "networkSeed", "networkShowIsolates", "networkEdgeOpacity"]),
  cnet: new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "legendSize", "dataLineWidth", "pointSize", "opacity", "legendPosition", "categoricalColors", "showLabels", "networkLayout", "networkSeed", "networkShowIsolates", "networkEdgeOpacity"]),
  "enrichment-map": new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "legendSize", "dataLineWidth", "pointSize", "opacity", "legendPosition", "categoricalColors", "showLabels", "networkLayout", "networkSeed", "networkShowIsolates", "networkEdgeOpacity"]),
  tree: new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "legendSize", "dataLineWidth", "pointSize", "legendPosition", "categoricalColors", "showLabels", "treeOrientation"]),
  dendrogram: new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "legendSize", "dataLineWidth", "pointSize", "legendPosition", "categoricalColors", "showLabels", "treeOrientation"]),
  pie: new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "legendSize", "opacity", "legendPosition", "categoricalColors", "compositionLabelMode"]),
  donut: new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "legendSize", "opacity", "legendPosition", "categoricalColors", "compositionLabelMode", "donutHole"]),
  waffle: new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "legendSize", "opacity", "legendPosition", "categoricalColors", "compositionLabelMode", "waffleCells"]),
  rose: new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "legendSize", "gridLineWidth", "opacity", "legendPosition", "categoricalColors", "compositionLabelMode", "radialMaximum"]),
  treemap: new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "opacity", "categoricalColors", "compositionLabelMode", "hierarchyGap"]),
  sunburst: new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "legendSize", "opacity", "legendPosition", "categoricalColors", "compositionLabelMode", "hierarchyGap"]),
  radar: new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "legendSize", "gridLineWidth", "dataLineWidth", "pointSize", "opacity", "legendPosition", "categoricalColors", "radarFillOpacity", "radialMaximum"]),
  "polar-profile": new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "legendSize", "gridLineWidth", "dataLineWidth", "pointSize", "opacity", "legendPosition", "categoricalColors", "radarFillOpacity", "radialMaximum"]),
  "population-pyramid": new Set(["title", "fontFamily", "width", "height", "titleSize", "tickSize", "legendSize", "axisLineWidth", "opacity", "legendPosition", "categoricalColors", "pyramidDisplayMode"]),
};

function dataShapeFor(type: PlotType): PlotDataShape {
  if (["heatmap", "clustered-heatmap", "correlation-heatmap", "pca"].includes(type)) return "matrix";
  if (["pcoa", "umap", "tsne", "nmds"].includes(type)) return "coordinates";
  if (["venn", "upset"].includes(type)) return "sets";
  if (["sankey", "chord", "ligand-receptor", "network", "ppi", "cerna", "mirna-target", "cnet", "enrichment-map"].includes(type)) return "network";
  if (type === "alluvial") return "long";
  if (["treemap", "sunburst", "tree", "dendrogram"].includes(type)) return "hierarchy";
  if (type === "circos") return "genomic-links";
  if (["manhattan", "chromosome-ideogram", "snp-density", "genome-tracks"].includes(type)) return "genomic-coordinates";
  if (["waterfall", "oncoplot"].includes(type)) return "alterations";
  if (type === "motif-logo") return "motif-matrix";
  return "long";
}

function numericAxesFor(type: PlotType): Array<"x" | "y"> {
  if (["heatmap", "clustered-heatmap", "correlation-heatmap", "venn", "upset", "sankey", "alluvial", "chord", "ligand-receptor", "network", "ppi", "cerna", "mirna-target", "cnet", "enrichment-map", "tree", "dendrogram", "circos", "manhattan", "chromosome-ideogram", "snp-density", "genome-tracks", "waterfall", "oncoplot", "motif-logo", "pie", "donut", "rose", "waffle", "treemap", "sunburst", "radar", "polar-profile", "population-pyramid"].includes(type)) return [];
  if (["enrichment", "enrichment-bar", "survival-forest"].includes(type)) return ["x"];
  if (["box", "violin", "beeswarm", "raincloud", "histogram", "density", "ridge"].includes(type)) return ["x", "y"];
  if (["errorbar", "lollipop"].includes(type)) return ["y"];
  if (type === "bar") return ["x", "y"];
  return ["x", "y"];
}

export function activeNumericAxes(type: PlotType, settings: Pick<VisualizationSettings, "swapAxes" | "barVariant" | "distributionOrientation" | "associationVariant" | "ordinationView">): Array<"x" | "y"> {
  if (["funnel", "precision-recall", "calibration", "decision-curve", "nomogram", "lasso-path", "km-cutoff", "risk-score", "go-circle", "kegg-circle", "go-chord", "pathway-impact", "nes-fdr", "multi-gsea", "enrichment-ridge", "sankey-bubble", "geographic-map", "petal", "word-cloud"].includes(type)) return [];
  if (type === "bar") {
    if (settings.barVariant === "polar") return [];
    return settings.swapAxes || ["horizontal", "bullet", "pyramid"].includes(settings.barVariant) ? ["x"] : ["y"];
  }
  if (["box", "violin", "beeswarm", "raincloud", "histogram", "density", "ridge"].includes(type)) return settings.distributionOrientation === "horizontal" ? ["x"] : ["y"];
  if (["scatter", "correlation"].includes(type) && ["pair-matrix", "3d", "ternary"].includes(settings.associationVariant)) return [];
  if (["pca", "pcoa", "umap", "tsne", "nmds"].includes(type) && settings.ordinationView !== "scores") return [];
  return numericAxesFor(type);
}

export function isPlotRoleActive(type: PlotType, roleKey: string, settings: VisualizationSettings) {
  if (["pca", "pcoa", "umap", "tsne", "nmds"].includes(type)) {
    if (settings.ordinationView === "scree") return false;
    if (roleKey === "z") return settings.ordinationView === "3d";
  }
  if (type === "venn" || type === "upset") {
    if (roleKey === "item") return settings.setInputMode !== "peak-overlap";
    if (["chromosome", "start", "end"].includes(roleKey)) return settings.setInputMode !== "membership";
  }
  if (type === "roc") {
    const precomputedRoles = ["fpr", "tpr", "tprLower", "tprUpper", "horizon", "auc", "aucLower", "aucUpper"];
    if (["truth", "score"].includes(roleKey)) return settings.rocInputMode === "raw";
    if (precomputedRoles.includes(roleKey)) return settings.rocInputMode === "precomputed-time";
  }
  if (type !== "bar") return true;
  if (roleKey === "secondary") return ["dual-axis", "overlay"].includes(settings.barVariant);
  if (roleKey === "target") return settings.barVariant === "bullet";
  if (roleKey === "pValue") return settings.showSignificance && settings.barVariant !== "polar" && settings.barAnalysisMode === "supplied";
  if (roleKey === "sd" || roleKey === "sem" || roleKey === "n") return settings.barAnalysisMode === "summary-independent";
  if (roleKey === "subject") return ["raw-independent", "raw-paired", "qpcr-delta-ct"].includes(settings.barAnalysisMode);
  if (roleKey === "analysisValue") return settings.barAnalysisMode === "qpcr-delta-ct";
  if (roleKey === "facet") return settings.barVariant === "faceted";
  if (roleKey === "error") return settings.barErrorType !== "none" && !["stacked", "percentage", "polar"].includes(settings.barVariant);
  return true;
}

const plotModuleSeeds: Array<PlotModuleSeed<PlotType, keyof VisualizationSettings>> = plotDefinitionSeeds.map((definition) => ({
  definition,
  guidance: plotGuidanceSeeds[definition.id],
  renderer: advancedRendererIds.has(definition.id) ? "advanced" : "standard",
  capabilities: {
    dataShape: dataShapeFor(definition.id),
    numericAxes: numericAxesFor(definition.id),
    settingKeys: newAxislessSettingKeys[definition.id] ? [...newAxislessSettingKeys[definition.id]!] : [
      ...commonSettingKeys,
      ...(numericAxesFor(definition.id).includes("x") ? ["xMin" as const, "xMax" as const] : []),
      ...(numericAxesFor(definition.id).includes("y") ? ["yMin" as const, "yMax" as const] : []),
      ...(hiddenLegendIds.has(definition.id) ? [] : ["legendPosition" as const]),
      ...(specializedSettingKeys[definition.id] ?? []),
    ],
    grouping: definition.roles.some((role) => role.key === "group" || role.key === "series"),
    multipleExamples: (definition.examples?.length ?? 0) > 1,
  },
}));

export const plotModuleRegistry = createPlotModuleRegistry(plotModuleSeeds, {
  allowedSettingKeys: Object.keys(defaultVisualizationSettings) as Array<keyof VisualizationSettings>,
});

/** @deprecated Read plot definitions through plotModuleRegistry. */
export const plotDefinitions = plotModuleRegistry.list().map((plotModule) => plotModule.definition);

/** @deprecated Read guidance through plotModuleRegistry. */
export const plotGuidance = Object.fromEntries(
  plotModuleRegistry.list().map((plotModule) => [plotModule.definition.id, plotModule.guidance]),
) as Record<PlotType, PlotGuidance>;

export function getPlotModule(type: PlotType) {
  return plotModuleRegistry.get(type);
}

export function getPlotDefinition(type: PlotType) {
  return getPlotModule(type).definition;
}

export function getPlotExamples(definition: PlotDefinition): PlotDataExample[] {
  return [...getPlotModule(definition.id).examples];
}

function detectDelimiter(line: string) {
  return line.includes("\t") ? "\t" : ",";
}

function splitDelimitedLine(line: string, delimiter: string) {
  if (delimiter === "\t") return line.split("\t").map((value) => value.trim());

  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseDelimitedData(raw: string): ParsedDataset {
  const lines = raw.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
  if (nonEmptyLines.length === 0) {
    return { headers: [], rows: [], delimiter: "tab", errors: ["Paste tab- or comma-delimited data."], warnings: [] };
  }

  const delimiter = detectDelimiter(nonEmptyLines[0]);
  const headers = splitDelimitedLine(nonEmptyLines[0], delimiter);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (headers.some((header) => header.length === 0)) errors.push("Every column must have a header.");
  if (new Set(headers).size !== headers.length) errors.push("Column headers must be unique.");

  const rows: DelimitedRow[] = [];
  nonEmptyLines.slice(1).forEach((line, rowIndex) => {
    const cells = splitDelimitedLine(line, delimiter);
    if (cells.length !== headers.length) {
      errors.push(`Row ${rowIndex + 2} has ${cells.length} values; expected ${headers.length}.`);
      return;
    }
    rows.push(Object.fromEntries(headers.map((header, index) => [header, cells[index]])));
  });

  if (rows.length === 0 && errors.length === 0) errors.push("The dataset needs at least one data row.");
  const blankCells = rows.reduce((count, row) => count + headers.filter((header) => row[header] === "").length, 0);
  if (blankCells > 0) warnings.push(`${blankCells} blank cell${blankCells === 1 ? "" : "s"} detected.`);
  if (rows.length > 5_000) warnings.push("More than 5,000 rows may reduce browser preview performance.");

  return {
    headers,
    rows,
    delimiter: delimiter === "\t" ? "tab" : "comma",
    errors: errors.slice(0, 8),
    warnings,
  };
}

export function parseNumericValue(value: string | undefined) {
  if (value === undefined || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export type HeatmapAnnotationTrack = {
  name: string;
  kind: "continuous" | "categorical";
  values: Map<string, string>;
  numericExtent: [number, number] | null;
  categories: string[];
};

export type HeatmapAnnotationAlignment = {
  tracks: HeatmapAnnotationTrack[];
  errors: string[];
  warnings: string[];
  matchedIds: number;
  missingIds: string[];
  extraIds: string[];
};

export type HeatmapLayoutOptions = {
  hasAnnotationLegend: boolean;
  rowAnnotationTracks: number;
  columnAnnotationTracks: number;
  showRowCut: boolean;
  showColumnCut: boolean;
  showRowDendrogram: boolean;
  showColumnDendrogram: boolean;
  showSidePlot: boolean;
  rowCount: number;
  columnCount: number;
  maxColumnLabelCharacters: number;
  maxCutClusters: number;
};

/**
 * One source of truth for compact heatmap geometry. Validation and rendering
 * deliberately share these exact measurements so a view that passes the
 * safety gate cannot later grow beyond its export frame.
 */
export function heatmapLayoutMetrics(settings: VisualizationSettings, options: HeatmapLayoutOptions) {
  const annotationLegendWidth = options.hasAnnotationLegend ? Math.max(104, Math.ceil(Math.max(8, settings.legendSize) * 8)) : 0;
  const left = Math.min(108, settings.width * 0.27);
  const top = settings.title ? 48 : 24;
  const bottom = 58;
  const right = 22 + annotationLegendWidth;
  const plotWidth = Math.max(0, settings.width - left - right);
  const plotHeight = Math.max(0, settings.height - top - bottom);
  const rowTrackCount = options.rowAnnotationTracks + (options.showRowCut ? 1 : 0);
  const columnTrackCount = options.columnAnnotationTracks + (options.showColumnCut ? 1 : 0);
  const rowTrackWidth = rowTrackCount * 6;
  const columnTrackHeight = columnTrackCount * 6;
  const rowDendrogramWidth = options.showRowDendrogram ? 28 : 0;
  const columnDendrogramHeight = options.showColumnDendrogram ? 28 : 0;
  const sidePlotWidth = options.showSidePlot ? 48 : 0;
  const legendFontSize = Math.max(8, settings.legendSize);
  const cutItemStep = Math.max(13, legendFontSize * 1.15);
  const cutLegendWidth = options.maxCutClusters > 1 ? 12 + options.maxCutClusters * cutItemStep + legendFontSize * 0.7 : 0;
  const colorLegendHeight = options.showRowCut || options.showColumnCut ? Math.max(36, legendFontSize * 3 + 10) : Math.max(18, legendFontSize + 8);
  const matrixWidth = plotWidth - rowDendrogramWidth - rowTrackWidth - sidePlotWidth;
  const matrixHeight = plotHeight - colorLegendHeight - columnDendrogramHeight - columnTrackHeight;
  const labelReserve = settings.heatmapLabelDensity === "none"
    ? 4
    : Math.ceil(12 + Math.min(12, options.maxColumnLabelCharacters) * Math.max(8, settings.tickSize) * 0.58);
  const circularOuterRadius = Math.min(plotWidth, plotHeight) / 2 - labelReserve - options.columnAnnotationTracks * 5;
  const circularInnerRadius = Math.max(12, circularOuterRadius * 0.2);
  const circularRingWidth = (circularOuterRadius - circularInnerRadius) / Math.max(1, options.rowCount);
  const circularSectorArc = Math.PI * 2 * Math.max(0, circularOuterRadius) / Math.max(1, options.columnCount);
  const circularRingListAvailableHeight = Math.max(0, plotHeight - (legendFontSize * 2 + 4) - colorLegendHeight);
  return {
    frame: { width: settings.width, height: settings.height, left, right, top, bottom, plotWidth, plotHeight },
    annotationLegendWidth,
    rowTrackCount,
    columnTrackCount,
    rowTrackWidth,
    columnTrackHeight,
    rowDendrogramWidth,
    columnDendrogramHeight,
    sidePlotWidth,
    colorLegendHeight,
    matrixWidth,
    matrixHeight,
    circularOuterRadius,
    circularInnerRadius,
    circularRingWidth,
    circularSectorArc,
    circularRingListAvailableHeight,
    cutLegendWidth,
  };
}

/** Expand a chosen categorical palette without silently reusing a color. */
export function categoricalColorForIndex(index: number, colors: string[]) {
  const safeColors = colors.length > 0 ? colors : ["#A7A5A0"];
  const base = safeColors[index % safeColors.length];
  const tier = Math.floor(index / safeColors.length);
  if (tier === 0) return base;
  // Golden-angle hues remain deterministic and unique across the browser
  // safety ceiling (250 categories) while keeping restrained saturation.
  const hue = ((index * 137.50776405003785) % 360).toFixed(6);
  const saturation = 34 + (tier % 4) * 4;
  const lightness = 42 + (tier % 5) * 5;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

/** Parse and align a row/column annotation table by its stable first-column identifier. */
export function alignHeatmapAnnotations(text: string, targetIds: string[], targetLabel: "row" | "column"): HeatmapAnnotationAlignment {
  if (!text.trim()) return { tracks: [], errors: [], warnings: [], matchedIds: 0, missingIds: [], extraIds: [] };
  const parsed = parseDelimitedData(text);
  const errors = [...parsed.errors];
  const warnings = [...parsed.warnings];
  if (parsed.headers.length < 2) errors.push(`${targetLabel === "row" ? "Row" : "Column"} annotations need an ID column and at least one track.`);
  if (parsed.headers.length > 7) errors.push(`${targetLabel === "row" ? "Row" : "Column"} annotations are limited to six tracks in the browser preview.`);
  const idColumn = parsed.headers[0] ?? "id";
  const ids = parsed.rows.map((row) => row[idColumn]?.trim()).filter(Boolean);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicateIds.length > 0) errors.push(`${targetLabel === "row" ? "Row" : "Column"} annotation IDs must be unique; duplicates: ${duplicateIds.slice(0, 6).join(", ")}.`);
  const idSet = new Set(ids);
  const targetSet = new Set(targetIds);
  const missingIds = targetIds.filter((id) => !idSet.has(id));
  const extraIds = ids.filter((id) => !targetSet.has(id));
  if (missingIds.length > 0) warnings.push(`${missingIds.length} ${targetLabel} ID${missingIds.length === 1 ? " is" : "s are"} missing from the annotation table: ${missingIds.slice(0, 5).join(", ")}${missingIds.length > 5 ? "…" : ""}.`);
  if (extraIds.length > 0) warnings.push(`${extraIds.length} annotation ID${extraIds.length === 1 ? " does" : "s do"} not match the matrix and will be ignored: ${extraIds.slice(0, 5).join(", ")}${extraIds.length > 5 ? "…" : ""}.`);
  const trackHeaders = parsed.headers.slice(1, 7);
  const normalizedTrackNames = trackHeaders.map((header) => header.match(/^(.*?)\s*\[(categorical|continuous)\]\s*$/i)?.[1]?.trim() || header);
  const duplicateTrackNames = [...new Set(normalizedTrackNames.filter((name, index) => normalizedTrackNames.indexOf(name) !== index))];
  if (duplicateTrackNames.length > 0) errors.push(`${targetLabel === "row" ? "Row" : "Column"} annotation track names must remain unique after type declarations are removed; duplicates: ${duplicateTrackNames.join(", ")}.`);
  const tracks = trackHeaders.map((header) => {
    const declaration = header.match(/^(.*?)\s*\[(categorical|continuous)\]\s*$/i);
    const name = declaration?.[1]?.trim() || header;
    const declaredKind = declaration?.[2]?.toLowerCase() as "categorical" | "continuous" | undefined;
    const values = new Map(parsed.rows.map((row) => [row[idColumn]?.trim(), row[header]?.trim() ?? ""]));
    const matchedValues = targetIds.map((id) => values.get(id) ?? "").filter((value) => value !== "");
    const numericValues = matchedValues.map((value) => parseNumericValue(value));
    const allNumeric = matchedValues.length > 0 && numericValues.every((value) => value !== null);
    if (declaredKind === "continuous" && !allNumeric) errors.push(`${targetLabel === "row" ? "Row" : "Column"} annotation track ${name} is declared continuous but contains non-numeric values.`);
    const continuous = declaredKind === "continuous" || (declaredKind === undefined && allNumeric);
    if (declaredKind === undefined && allNumeric) warnings.push(`Numeric annotation track ${name} was inferred as continuous; add [categorical] to the header for codes such as batch, stage, or cluster IDs.`);
    const finite = numericValues.filter((value): value is number => value !== null);
    return {
      name,
      kind: continuous ? "continuous" as const : "categorical" as const,
      values,
      numericExtent: continuous && finite.length > 0 ? [Math.min(...finite), Math.max(...finite)] as [number, number] : null,
      categories: continuous ? [] : [...new Set(matchedValues)].sort((left, right) => left.localeCompare(right)),
    };
  });
  return { tracks, errors, warnings, matchedIds: targetIds.filter((id) => idSet.has(id)).length, missingIds, extraIds };
}

export function parseRatioValue(value: string | undefined) {
  if (!value) return null;
  if (value.includes("/")) {
    const [numerator, denominator] = value.split("/").map(Number);
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) return numerator / denominator;
  }
  return parseNumericValue(value);
}

const mappingAliases: Record<string, string[]> = {
  category: ["category", "condition", "sample", "name", "term"],
  value: ["value", "weight", "mean", "relativeexpression", "expression", "score", "points", "abundance", "count", "variantcount", "density"],
  secondary: ["secondary", "secondaryvalue", "comparison", "overlay", "value2"],
  target: ["target", "reference", "goal", "benchmark", "to", "receiver"],
  facet: ["facet", "panel", "stratum", "cohort"],
  subject: ["subject", "subjectid", "pair", "pairid", "participant", "sample", "sampleid"],
  group: ["group", "class", "condition", "cluster", "ontology", "pathwaygroup", "set", "collection", "model", "predictor", "feature"],
  series: ["series", "group", "condition", "class"],
  x: ["x", "time", "dose", "lambda", "pc1", "dim1", "dimension1", "umap1", "tsne1", "nmds1"],
  y: ["y", "response", "coefficient", "pc2", "dim2", "dimension2", "umap2", "tsne2", "nmds2"],
  z: ["z", "pc3", "dim3", "dimension3", "umap3", "tsne3", "nmds3"],
  shape: ["shape", "batch", "cohort", "site", "sex"],
  error: ["error", "sd", "sem", "se", "stderr", "standarddeviation", "standarderror"],
  sd: ["sd", "standarddeviation"],
  sem: ["sem", "se", "stderr", "standarderror"],
  n: ["n", "samplesize", "biologicaln", "replicates"],
  analysisValue: ["deltact", "delta_ct", "dct", "analysisvalue"],
  label: ["label", "gene", "feature", "id", "name", "study", "sample", "site", "level", "term", "category"],
  effect: ["log2fc", "logfc", "effect", "estimate"],
  pValue: ["padj", "fdr", "adjustedpvalue", "pvalue", "p"],
  term: ["term", "pathway", "description", "name"],
  ratio: ["generatio", "ratio", "richfactor", "foldenrichment"],
  count: ["count", "genes", "hits", "size"],
  background: ["background", "backgroundsize", "universe", "universesize", "testedgenes"],
  impact: ["impact", "pathwayimpact", "topologyimpact"],
  nes: ["nes", "normalizedenrichmentscore"],
  latitude: ["latitude", "lat"],
  longitude: ["longitude", "lon", "lng"],
  mean: ["mean", "basemean", "meanexpression", "averagelogexpression"],
  rank: ["rank", "position", "index"],
  hit: ["hit", "member", "membership", "ingeneset"],
  time: ["time", "followuptime", "survivaltime", "os", "pfs"],
  event: ["event", "status", "death", "outcome"],
  estimate: ["estimate", "effect", "hr", "hazardratio", "or", "oddsratio"],
  lower: ["lower", "lowerci", "cilower", "lcl"],
  upper: ["upper", "upperci", "ciupper", "ucl"],
  truth: ["truth", "class", "outcome", "label", "event"],
  score: ["score", "prediction", "probability", "risk", "runninges", "enrichmentscore", "es"],
  cutoff: ["cutoff", "threshold"],
  item: ["item", "gene", "feature", "id"],
  set: ["set", "geneset", "list", "collection"],
  source: ["source", "from", "sender"],
  flow: ["flow", "flowid", "cohort", "path"],
  sourceChr: ["sourcechr", "chr1", "chromosome1"],
  sourceStart: ["sourcestart", "start1"],
  sourceEnd: ["sourceend", "end1"],
  targetChr: ["targetchr", "chr2", "chromosome2"],
  targetStart: ["targetstart", "start2"],
  targetEnd: ["targetend", "end2"],
  node: ["node", "name", "label", "id"],
  parent: ["parent", "parentnode", "parentid"],
  feature: ["feature", "metric", "dimension", "axis"],
  angle: ["angle", "phase", "time", "direction", "category"],
  chromosome: ["chromosome", "chr", "chrom", "seqname", "contig"],
  position: ["position", "pos", "bp", "basepair"],
  start: ["start", "begin", "chromstart"],
  end: ["end", "stop", "chromend"],
  stain: ["stain", "gieStain", "cytoband"],
  track: ["track", "trackname", "assay", "layer"],
  sample: ["sample", "sampleid", "tumor", "case"],
  gene: ["gene", "symbol", "hugo", "feature"],
  alteration: ["alteration", "variantclass", "mutationtype", "eventtype"],
};

function normalizeMappingName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function inferPlotMapping(definition: PlotDefinition, headers: string[]) {
  const normalized = new Map<string, string>();
  headers.forEach((header) => {
    const key = normalizeMappingName(header);
    if (!normalized.has(key)) normalized.set(key, header);
  });
  return Object.fromEntries(definition.roles.map((role) => {
    const exact = normalized.get(normalizeMappingName(role.key));
    const fallback = mappingAliases[role.key]?.map((alias) => normalized.get(alias)).find(Boolean);
    return [role.key, exact ?? fallback ?? ""];
  }));
}

function heatmapStandardize(values: number[]) {
  const average = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const deviation = Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / Math.max(1, values.length - 1)) || 1;
  return values.map((value) => (value - average) / deviation);
}

function heatmapRanks(values: number[]) {
  const ordered = values.map((value, index) => ({ value, index })).sort((left, right) => left.value - right.value || left.index - right.index);
  const ranks = Array(values.length).fill(0) as number[];
  for (let start = 0; start < ordered.length;) {
    let end = start;
    while (end + 1 < ordered.length && ordered[end + 1].value === ordered[start].value) end += 1;
    const rank = (start + end + 2) / 2;
    for (let cursor = start; cursor <= end; cursor += 1) ranks[ordered[cursor].index] = rank;
    start = end + 1;
  }
  return ranks;
}

function heatmapCorrelation(left: number[], right: number[], method: VisualizationSettings["correlationMethod"]) {
  const x = method === "spearman" ? heatmapRanks(left) : left;
  const y = method === "spearman" ? heatmapRanks(right) : right;
  const xMean = x.reduce((sum, value) => sum + value, 0) / x.length;
  const yMean = y.reduce((sum, value) => sum + value, 0) / y.length;
  const numerator = x.reduce((sum, value, index) => sum + (value - xMean) * (y[index] - yMean), 0);
  const denominator = Math.sqrt(x.reduce((sum, value) => sum + (value - xMean) ** 2, 0) * y.reduce((sum, value) => sum + (value - yMean) ** 2, 0));
  return denominator > 0 ? numerator / denominator : Number.NaN;
}

function isZeroVariance(values: number[]) {
  return values.length < 2 || values.every((value) => Math.abs(value - values[0]) <= 1e-12);
}

export function validatePlotDataset(
  definition: PlotDefinition,
  dataset: ParsedDataset,
  mapping: Record<string, string>,
  settings?: VisualizationSettings,
) {
  const errors = [...dataset.errors];
  const warnings = [...dataset.warnings];
  if (errors.length > 0) return { errors, warnings };
  if (settings) {
    const activeAxes = activeNumericAxes(definition.id, settings);
    const invalidXLimits = activeAxes.includes("x") && settings.xMin !== null && settings.xMax !== null && settings.xMin >= settings.xMax;
    const invalidYLimits = activeAxes.includes("y") && settings.yMin !== null && settings.yMax !== null && settings.yMin >= settings.yMax;
    if (invalidXLimits) errors.push("X-axis minimum must be smaller than the maximum.");
    if (invalidYLimits) errors.push("Y-axis minimum must be smaller than the maximum.");
    if (!invalidXLimits && !invalidYLimits) {
      const clippingWarning = axisLimitWarning(definition, dataset, mapping, settings);
      if (clippingWarning) warnings.push(clippingWarning);
    }
  }

  if (["heatmap", "clustered-heatmap", "correlation-heatmap"].includes(definition.id)) {
    if (dataset.headers.length < 3) errors.push("Heatmap data needs one row-label column and at least two numeric sample columns.");
    const labelHeader = dataset.headers[0];
    const numericHeaders = dataset.headers.slice(1);
    const rowIds = dataset.rows.map((row) => row[labelHeader]?.trim()).filter(Boolean);
    if (rowIds.length !== dataset.rows.length) errors.push("Heatmap row identifiers must not be blank.");
    if (new Set(rowIds).size !== rowIds.length) errors.push("Heatmap row identifiers must be unique so annotations and labels align reproducibly.");
    const invalid = dataset.rows.filter((row) => numericHeaders.some((header) => parseNumericValue(row[header]) === null));
    if (invalid.length > 0) errors.push(`${invalid.length} heatmap row${invalid.length === 1 ? "" : "s"} contain non-numeric or blank values.`);
    if (definition.id === "correlation-heatmap" && invalid.length === 0) {
      const constantHeaders = numericHeaders.filter((header) => new Set(dataset.rows.map((row) => parseNumericValue(row[header]))).size < 2);
      if (constantHeaders.length > 0) errors.push(`Correlation is undefined for constant columns: ${constantHeaders.join(", ")}.`);
    }
    const circular = settings?.heatmapDisplay === "circular";
    const rowLimit = circular ? 80 : 250;
    const columnLimit = circular ? 60 : 100;
    if (definition.id !== "correlation-heatmap" && dataset.rows.length > rowLimit) errors.push(`${circular ? "Circular h" : "H"}eatmap previews are limited to ${rowLimit} rows; select biologically justified features before plotting.`);
    if (numericHeaders.length > columnLimit) errors.push(`${circular ? "Circular h" : "H"}eatmap previews are limited to ${columnLimit} numeric columns to preserve legibility and browser performance.`);
    if (settings) {
      if (invalid.length === 0 && settings.heatmapDistance === "correlation" && definition.id !== "heatmap") {
        const rawMatrix = dataset.rows.map((row) => numericHeaders.map((header) => parseNumericValue(row[header]) ?? 0));
        let clusteringMatrix = rawMatrix;
        if (definition.id === "correlation-heatmap") {
          const variables = numericHeaders.map((_, columnIndex) => rawMatrix.map((row) => row[columnIndex]));
          clusteringMatrix = variables.map((left) => variables.map((right) => heatmapCorrelation(left, right, settings.correlationMethod)));
        } else if (settings.heatmapScale === "row") clusteringMatrix = rawMatrix.map(heatmapStandardize);
        else if (settings.heatmapScale === "column") {
          const scaledColumns = numericHeaders.map((_, columnIndex) => heatmapStandardize(rawMatrix.map((row) => row[columnIndex])));
          clusteringMatrix = rawMatrix.map((_, rowIndex) => scaledColumns.map((column) => column[rowIndex]));
        }
        const clusteringRowLabels = definition.id === "correlation-heatmap" ? numericHeaders : rowIds;
        if (settings.clusterRows) {
          const constantRows = clusteringMatrix.map((values, index) => isZeroVariance(values) || values.some((value) => !Number.isFinite(value)) ? clusteringRowLabels[index] : "").filter(Boolean);
          if (constantRows.length > 0) errors.push(`Correlation distance is undefined for zero-variance row vectors: ${constantRows.slice(0, 8).join(", ")}${constantRows.length > 8 ? "…" : ""}. Use Euclidean distance or remove/transform these rows.`);
        }
        if (settings.clusterColumns) {
          const constantColumns = numericHeaders.map((header, columnIndex) => ({ header, values: clusteringMatrix.map((row) => row[columnIndex]) })).filter(({ values }) => isZeroVariance(values) || values.some((value) => !Number.isFinite(value))).map(({ header }) => header);
          if (constantColumns.length > 0) errors.push(`Correlation distance is undefined for zero-variance column vectors: ${constantColumns.slice(0, 8).join(", ")}${constantColumns.length > 8 ? "…" : ""}. Use Euclidean distance or remove/transform these columns.`);
        }
      }
      const displayedRowIds = definition.id === "correlation-heatmap" ? numericHeaders : rowIds;
      const rowAnnotations = alignHeatmapAnnotations(settings.heatmapRowAnnotationData, displayedRowIds, "row");
      const columnAnnotations = alignHeatmapAnnotations(settings.heatmapColumnAnnotationData, numericHeaders, "column");
      errors.push(...rowAnnotations.errors, ...columnAnnotations.errors);
      warnings.push(...rowAnnotations.warnings, ...columnAnnotations.warnings);
      const annotationTracks = [...rowAnnotations.tracks, ...columnAnnotations.tracks];
      if (annotationTracks.length > 6) errors.push("The compact export supports at most six annotation tracks in total across rows and columns.");
      const legendRows = annotationTracks.reduce((sum, track) => sum + 1 + (track.kind === "continuous" ? 2 : track.categories.length), 0) + (rowAnnotations.tracks.length > 0 ? 1 : 0) + (columnAnnotations.tracks.length > 0 ? 1 : 0);
      const legendRowHeight = Math.max(8, settings.legendSize) + 3;
      const maximumLegendRows = Math.max(4, Math.floor((settings.height - 54) / legendRowHeight));
      if (legendRows > maximumLegendRows) errors.push(`Annotation legends need ${legendRows} compact rows but this ${settings.height}px-high export can display ${maximumLegendRows}; increase height or reduce tracks/categories.`);
      if (settings.heatmapShowValues && settings.heatmapDisplay === "rectangular" && displayedRowIds.length * numericHeaders.length > 225) warnings.push("Cell values are shown only when the selected view has enough room for legible text.");
      const linkedCorrelation = definition.id === "correlation-heatmap";
      if (linkedCorrelation && settings.clusterRows !== settings.clusterColumns) errors.push("Correlation heatmap row and column clustering must be enabled or disabled together because both axes represent the same variables.");
      const rowCutCount = settings.heatmapRowClusters;
      const columnCutCount = linkedCorrelation ? rowCutCount : settings.heatmapColumnClusters;
      const canCluster = definition.id !== "heatmap";
      const clusterRows = linkedCorrelation ? settings.clusterRows && settings.clusterColumns : settings.clusterRows;
      const clusterColumns = linkedCorrelation ? settings.clusterRows && settings.clusterColumns : settings.clusterColumns;
      const showRowCut = canCluster && clusterRows && rowCutCount > 1;
      const showColumnCut = canCluster && clusterColumns && columnCutCount > 1;
      const showDendrograms = settings.heatmapDisplay === "rectangular" && canCluster && settings.heatmapShowDendrograms;
      const layout = heatmapLayoutMetrics(settings, {
        hasAnnotationLegend: annotationTracks.length > 0,
        rowAnnotationTracks: rowAnnotations.tracks.length,
        columnAnnotationTracks: columnAnnotations.tracks.length,
        showRowCut,
        showColumnCut,
        showRowDendrogram: showDendrograms && clusterRows,
        showColumnDendrogram: showDendrograms && clusterColumns,
        showSidePlot: settings.heatmapDisplay === "rectangular" && settings.heatmapShowSidePlot,
        rowCount: displayedRowIds.length,
        columnCount: numericHeaders.length,
        maxColumnLabelCharacters: Math.max(0, ...numericHeaders.map((label) => label.length)),
        maxCutClusters: Math.max(showRowCut ? Math.min(rowCutCount, displayedRowIds.length) : 0, showColumnCut ? Math.min(columnCutCount, numericHeaders.length) : 0),
      });
      if (settings.heatmapDisplay === "circular") {
        if (layout.circularOuterRadius <= layout.circularInnerRadius) errors.push(`Circular heatmap tracks do not fit inside the ${settings.width} × ${settings.height} export after labels, annotation rings, and legends; increase the figure size or reduce annotations.`);
        if (layout.circularRingWidth < 0.75) errors.push(`Circular heatmap rings would be ${Math.max(0, layout.circularRingWidth).toFixed(2)} px at ${settings.width} × ${settings.height}; reduce rows or increase the figure size.`);
        else if (layout.circularRingWidth < 1.5) warnings.push(`Circular heatmap rings are approximately ${layout.circularRingWidth.toFixed(1)} px; increase the figure size or reduce rows for reliable print reproduction.`);
        if (layout.circularSectorArc < 0.75) errors.push(`Circular heatmap sectors would be ${layout.circularSectorArc.toFixed(2)} px along the outer arc; reduce columns or increase the figure size.`);
        if (settings.heatmapLabelDensity === "all") {
          const requiredRingListHeight = displayedRowIds.length * (Math.max(8, settings.legendSize) + 3);
          if (requiredRingListHeight > layout.circularRingListAvailableHeight) errors.push(`All ${displayedRowIds.length} ring identities need ${requiredRingListHeight.toFixed(0)} px, but only ${layout.circularRingListAvailableHeight.toFixed(0)} px is available; use Auto label density, increase height, or reduce rows.`);
        }
        if (layout.cutLegendWidth > layout.frame.plotWidth) errors.push(`The cluster-cut legend needs ${layout.cutLegendWidth.toFixed(0)} px of width, but the circular plot frame has ${layout.frame.plotWidth.toFixed(0)} px; increase width, reduce the cut count, or reduce legend size.`);
      } else {
        if (layout.matrixWidth < 70) errors.push(`The heatmap matrix has only ${Math.max(0, layout.matrixWidth).toFixed(0)} px of usable width after dendrograms, annotations, legends, and the side plot; increase width or hide optional layers (minimum 70 px).`);
        if (layout.matrixHeight < 70) errors.push(`The heatmap matrix has only ${Math.max(0, layout.matrixHeight).toFixed(0)} px of usable height after dendrograms, annotations, and legends; increase height or hide optional layers (minimum 70 px).`);
        if (layout.cutLegendWidth > Math.max(0, layout.matrixWidth)) errors.push(`The cluster-cut legend needs ${layout.cutLegendWidth.toFixed(0)} px, but the matrix header has ${Math.max(0, layout.matrixWidth).toFixed(0)} px; increase width, reduce the cut count, or reduce legend size.`);
      }
      if (settings.heatmapRowClusters > displayedRowIds.length) warnings.push(`Row cluster cut is capped at ${displayedRowIds.length}, the number of displayed rows.`);
      if (columnCutCount > numericHeaders.length) warnings.push(`Column cluster cut is capped at ${numericHeaders.length}, the number of displayed columns.`);
    }
    return { errors, warnings };
  }

  definition.roles.filter((role) => !settings || isPlotRoleActive(definition.id, role.key, settings)).forEach((role) => {
    const column = mapping[role.key];
    if (role.required && !column) errors.push(`${role.label} must be mapped to a column.`);
    if (column && !dataset.headers.includes(column)) errors.push(`${role.label} references a missing column (${column}).`);
    if (column && role.kind === "number") {
      const invalidCount = dataset.rows.filter((row) => {
        if (["network", "ppi", "cerna", "mirna-target", "cnet", "enrichment-map", "circos"].includes(definition.id) && !role.required && !row[column]?.trim()) return false;
        const value = (["enrichment", "enrichment-bar", "go-circle", "kegg-circle", "go-chord", "pathway-impact", "nes-fdr", "enrichment-ridge", "sankey-bubble"].includes(definition.id)) && role.key === "ratio"
          ? parseRatioValue(row[column])
          : parseNumericValue(row[column]);
        return value === null;
      }).length;
      if (invalidCount > 0) errors.push(`${role.label} contains ${invalidCount} non-numeric or blank value${invalidCount === 1 ? "" : "s"}.`);
    }
    if (column && role.required && role.kind !== "number") {
      const blankCount = dataset.rows.filter((row) => !row[column]?.trim()).length;
      if (blankCount > 0) errors.push(`${role.label} contains ${blankCount} blank value${blankCount === 1 ? "" : "s"}.`);
    }
  });

  const precomputedEnrichmentTypes: PlotType[] = ["enrichment", "enrichment-bar", "go-circle", "kegg-circle", "go-chord", "pathway-impact", "nes-fdr", "multi-gsea", "enrichment-ridge", "sankey-bubble"];
  if (precomputedEnrichmentTypes.includes(definition.id)) {
    if (mapping.pValue) {
      const invalid = dataset.rows.filter((row) => { const value = parseNumericValue(row[mapping.pValue]); return value === null || value <= 0 || value > 1; }).length;
      if (invalid > 0) errors.push(`FDR must be in (0, 1] for every precomputed enrichment row; invalid rows: ${invalid}.`);
    }
    if (mapping.ratio) {
      const invalid = dataset.rows.filter((row) => { const value = parseRatioValue(row[mapping.ratio]); return value === null || value < 0 || value > 1; }).length;
      if (invalid > 0) errors.push(`Gene ratio must be a fraction or decimal in [0, 1]; invalid rows: ${invalid}.`);
    }
    if (mapping.background) {
      const invalid = dataset.rows.filter((row) => { const value = parseNumericValue(row[mapping.background]); return value === null || !Number.isInteger(value) || value <= 0; }).length;
      if (invalid > 0) errors.push(`Tested background size must be a strictly positive integer; invalid rows: ${invalid}.`);
    }
    if (mapping.count) {
      const invalid = dataset.rows.filter((row) => { const value = parseNumericValue(row[mapping.count]); return value === null || !Number.isInteger(value) || value <= 0; }).length;
      if (invalid > 0) errors.push(`Hit count must be a strictly positive integer; invalid rows: ${invalid}.`);
    }
    if (mapping.count && mapping.ratio && mapping.background) {
      dataset.rows.forEach((row, index) => {
        const count = parseNumericValue(row[mapping.count]);
        const ratio = parseRatioValue(row[mapping.ratio]);
        const background = parseNumericValue(row[mapping.background]);
        if (count !== null && background !== null && count > background) errors.push(`Row ${index + 1} has hit count ${count} greater than tested background ${background}.`);
        if (count !== null && count > 0 && ratio === 0) errors.push(`Row ${index + 1} has a positive hit count but zero gene ratio.`);
        const fractionMatch = row[mapping.ratio]?.trim().match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*\/\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/);
        if (fractionMatch && count !== null && Number(fractionMatch[1]) !== count) errors.push(`Row ${index + 1} has fraction numerator ${fractionMatch[1]} but hit count ${count}; these must agree.`);
      });
    }
    warnings.push("This view displays results precomputed by an upstream enrichment or ranked-set method. Preserve the tested background, database/version, multiple-testing procedure, and complete result table outside the figure.");
  }
  if (["go-circle", "kegg-circle"].includes(definition.id)) {
    const terms = dataset.rows.map((row) => row[mapping.term]?.trim());
    if (new Set(terms).size !== terms.length) errors.push(`${definition.name} requires unique term rows; aggregate duplicate terms upstream.`);
    if (definition.id === "go-circle" && mapping.group) {
      const allowed = new Set(["BP", "CC", "MF"]); const invalid = [...new Set(dataset.rows.map((row) => row[mapping.group]?.trim().toUpperCase()))].filter((group) => !allowed.has(group));
      if (invalid.length > 0) errors.push(`GO ontology must use BP, CC, or MF; unsupported values: ${invalid.join(", ")}.`);
    }
    if (settings) {
      const groupLabels = [...new Set(dataset.rows.map((row) => row[mapping.group]?.trim()).filter(Boolean))];
      const layout = enrichmentSpecializedLayoutMetrics(definition.id, settings, { rowCount: dataset.rows.length, groupCount: groupLabels.length, maximumGroupLabelWidth: Math.max(0, ...groupLabels.map((label) => estimateLegendTextWidth(label, Math.max(7, settings.tickSize - 2)))) });
      if (layout.circleSpacing < layout.circleMinimum) errors.push(`${definition.name} terms would have only ${layout.circleSpacing.toFixed(1)} px of circular spacing, below the ${layout.circleMinimum.toFixed(1)} px mark/label budget; increase figure size, hide labels, or filter terms.`);
      if (layout.groupCellWidth < layout.groupLegendMinimum) errors.push(`${definition.name} group legend cells have ${layout.groupCellWidth.toFixed(1)} px, but the longest group needs ${layout.groupLegendMinimum.toFixed(1)} px; increase width or shorten group labels.`);
    }
    warnings.push("Terms are grouped into contiguous ontology/pathway sectors, but angular position within a sector remains decorative and does not encode semantic similarity, ontology distance, or pathway topology.");
  }
  if (definition.id === "go-chord") {
    const terms = new Set(dataset.rows.map((row) => row[mapping.term])); const genes = new Set(dataset.rows.map((row) => row[mapping.label]));
    const groups = [...new Set(dataset.rows.map((row) => row[mapping.group]?.trim().toUpperCase()))];
    const invalidGroups = groups.filter((group) => !new Set(["BP", "CC", "MF"]).has(group));
    if (invalidGroups.length > 0) errors.push(`GO chord ontology must use BP, CC, or MF; unsupported values: ${invalidGroups.join(", ")}.`);
    const memberships = dataset.rows.map((row) => `${row[mapping.term]}\u0000${row[mapping.label]}`);
    if (new Set(memberships).size !== memberships.length) errors.push("GO chord requires unique term–gene membership rows; aggregate duplicate memberships upstream.");
    if (terms.size > 8 || genes.size > 16 || dataset.rows.length > 40) errors.push(`GO chord compact limits are 8 terms, 16 genes, and 40 links; received ${terms.size}, ${genes.size}, and ${dataset.rows.length}.`);
    if (groups.length > 4) errors.push(`GO chord compact footer supports at most four ontology groups; received ${groups.length}.`);
    if (settings) {
      const layout = enrichmentSpecializedLayoutMetrics(definition.id, settings, { rowCount: dataset.rows.length, termCount: terms.size, geneCount: genes.size });
      if (layout.termArcSpacing < layout.chordMinimum || layout.geneArcSpacing < layout.chordMinimum) errors.push(`GO chord node spacing is unsafe at ${settings.width} × ${settings.height}: terms ${layout.termArcSpacing.toFixed(1)} px, genes ${layout.geneArcSpacing.toFixed(1)} px, required ${layout.chordMinimum.toFixed(1)} px; increase size, hide labels, or reduce nodes.`);
    }
    terms.forEach((term) => {
      const rows = dataset.rows.filter((row) => row[mapping.term] === term);
      ["ratio", "count", "pValue", "group", "background"].forEach((role) => {
        const values = rows.map((row) => role === "ratio" ? parseRatioValue(row[mapping[role]]) : ["count", "pValue", "background"].includes(role) ? parseNumericValue(row[mapping[role]]) : row[mapping[role]]?.trim().toUpperCase());
        if (mapping[role] && new Set(values).size !== 1) errors.push(`GO chord term “${term}” must repeat one consistent ${role} value across member genes.`);
      });
    });
    warnings.push("Effect sign is encoded by color/dash and absolute effect by line width; chord curvature and circular order remain layout choices and do not encode biological distance.");
  }
  if (definition.id === "pathway-impact") {
    const invalid = dataset.rows.filter((row) => (parseNumericValue(row[mapping.impact]) ?? -1) < 0).length;
    if (invalid > 0) errors.push(`Pathway impact must be non-negative; invalid rows: ${invalid}.`);
    const terms = dataset.rows.map((row) => row[mapping.term]?.trim());
    const groups = [...new Set(dataset.rows.map((row) => row[mapping.group]?.trim()))];
    if (new Set(terms).size !== terms.length) errors.push("Pathway impact requires unique pathway rows; aggregate duplicate pathways upstream.");
    if (dataset.rows.length > 20) errors.push("Pathway impact compact view supports at most 20 pathways; filter using a documented rule.");
    if (groups.length > 4) errors.push(`Pathway impact compact footer supports at most four pathway groups; received ${groups.length}.`);
    if (settings) {
      const layout = pathwayImpactLayout(settings, dataset.rows.map((row) => ({ term: row[mapping.term], impact: parseNumericValue(row[mapping.impact]) ?? 0, fdr: parseNumericValue(row[mapping.pValue]) ?? 1, count: parseNumericValue(row[mapping.count]) ?? 1 })));
      if (layout.markCollisionPairs > 0) errors.push(`Pathway impact has ${layout.markCollisionPairs} overlapping point pair${layout.markCollisionPairs === 1 ? "" : "s"} at the current size; increase dimensions, reduce point size, or aggregate indistinguishable pathways.`);
      if (settings.showLabels && layout.labelCollisionCount > 0) errors.push(`Pathway impact cannot place ${layout.labelCollisionCount} pathway label${layout.labelCollisionCount === 1 ? "" : "s"} without overlap at the current size; increase dimensions, shorten or hide labels, or filter pathways.`);
    }
  }
  if (definition.id === "nes-fdr") {
    const terms = dataset.rows.map((row) => row[mapping.term]?.trim());
    if (new Set(terms).size !== terms.length) errors.push("NES / FDR summary requires unique gene-set rows; aggregate duplicates upstream.");
    if (settings) {
      const layout = enrichmentSpecializedLayoutMetrics(definition.id, settings, { rowCount: dataset.rows.length });
      if (layout.rowSpacing < layout.nesMinimum) errors.push(`NES / FDR rows would be ${layout.rowSpacing.toFixed(1)} px apart, below the ${layout.nesMinimum.toFixed(1)} px point/text budget; increase height, reduce point or tick size, or filter gene sets.`);
    }
  }
  if (definition.id === "multi-gsea") {
    const sets = new Set(dataset.rows.map((row) => row[mapping.group]));
    if (sets.size > 6) errors.push("Multi-GSEA supports at most six curves in the compact figure.");
    const sharedBackgrounds = new Set(dataset.rows.map((row) => parseNumericValue(row[mapping.background])));
    if (sharedBackgrounds.size !== 1) errors.push("Multi-GSEA curves must use one common ranked background so their horizontal positions are comparable.");
    sets.forEach((set) => {
      const rows = dataset.rows.filter((row) => row[mapping.group] === set); const ranks = rows.map((row) => parseNumericValue(row[mapping.rank]) ?? Number.NaN); const background = parseNumericValue(rows[0]?.[mapping.background]) ?? Number.NaN;
      const invalidHits = rows.filter((row) => ![0, 1].includes(parseNumericValue(row[mapping.hit]) ?? Number.NaN)).length;
      if (rows.length < 20) errors.push(`Multi-GSEA set “${set}” requires at least 20 representative ranked positions.`);
      if (new Set(ranks).size !== ranks.length) errors.push(`Multi-GSEA set “${set}” contains duplicate rank positions.`);
      if (ranks.some((rank) => !Number.isInteger(rank) || rank < 0 || rank > background)) errors.push(`Multi-GSEA set “${set}” ranks must be non-negative integers no greater than its ranked background (${background}).`);
      const minimumRank = Math.min(...ranks); const maximumRank = Math.max(...ranks);
      if (minimumRank !== 0 || maximumRank !== background) errors.push(`Multi-GSEA set “${set}” must cover the common ranked list from 0 through background ${background}; received ${minimumRank}–${maximumRank}.`);
      const endpoints = rows.filter((row) => { const rank = parseNumericValue(row[mapping.rank]); return rank === 0 || rank === background; }).map((row) => Math.abs(parseNumericValue(row[mapping.score]) ?? Number.POSITIVE_INFINITY));
      if (endpoints.length !== 2 || endpoints.some((score) => score > 1e-6)) errors.push(`Multi-GSEA set “${set}” must supply running ES=0 at both rank endpoints (0 and ${background}).`);
      if (invalidHits > 0) errors.push(`Multi-GSEA set “${set}” contains ${invalidHits} hit values other than 0 or 1.`);
      if (rows.filter((row) => parseNumericValue(row[mapping.hit]) === 1).length < 3) warnings.push(`Multi-GSEA set “${set}” has fewer than three displayed hits; verify that representative hit density was not over-thinned.`);
      ["nes", "pValue", "background"].forEach((role) => { if (new Set(rows.map((row) => parseNumericValue(row[mapping[role]]))).size !== 1) errors.push(`Multi-GSEA set “${set}” must repeat one constant ${role} value.`); });
    });
    if (settings) {
      const layout = enrichmentSpecializedLayoutMetrics(definition.id, settings, { rowCount: dataset.rows.length, groupCount: sets.size });
      if (layout.gseaLabelBlock > layout.gseaLabelCapacity) errors.push(`Multi-GSEA legend needs ${layout.gseaLabelBlock.toFixed(1)} px but only ${layout.gseaLabelCapacity.toFixed(1)} px is safely available inside the curve panel; increase height, reduce legend size, or show fewer sets.`);
    }
  }
  if (definition.id === "enrichment-ridge") {
    const terms = new Set(dataset.rows.map((row) => row[mapping.term]));
    const memberships = dataset.rows.map((row) => `${row[mapping.term]}\u0000${row[mapping.label]}`);
    if (new Set(memberships).size !== memberships.length) errors.push("Enrichment ridge requires unique term–gene rows; duplicate member statistics would be counted more than once.");
    terms.forEach((term) => { const rows = dataset.rows.filter((row) => row[mapping.term] === term); if (rows.length < 5) errors.push(`Enrichment ridge term “${term}” requires at least five member-level statistics.`); ["pValue", "ratio", "background"].forEach((role) => { const values = rows.map((row) => role === "ratio" ? parseRatioValue(row[mapping[role]]) : parseNumericValue(row[mapping[role]])); if (new Set(values).size !== 1) errors.push(`Enrichment ridge term “${term}” must repeat one constant ${role} value.`); }); });
    if (settings) { const layout = enrichmentSpecializedLayoutMetrics(definition.id, settings, { rowCount: terms.size }); if (layout.rowSpacing < layout.ridgeMinimum) errors.push(`Enrichment ridge rows would be ${layout.rowSpacing.toFixed(1)} px apart, below the ${layout.ridgeMinimum.toFixed(1)} px label/density budget; increase height, reduce tick size, or filter terms.`); }
    warnings.push("Each ridge is normalized separately; density height cannot be used to compare total membership across terms.");
  }
  if (definition.id === "sankey-bubble") {
    const duplicated = dataset.rows.map((row) => `${row[mapping.source]}\u0000${row[mapping.term]}`).filter((key, index, keys) => keys.indexOf(key) !== index);
    if (duplicated.length > 0) errors.push("Sankey–bubble requires unique source–term rows; aggregate or distinguish duplicate terms upstream.");
    if (settings) { const layout = enrichmentSpecializedLayoutMetrics(definition.id, settings, { rowCount: dataset.rows.length }); if (layout.rowSpacing < layout.sankeyMinimum) errors.push(`Sankey–bubble terms would be ${layout.rowSpacing.toFixed(1)} px apart, below the ${layout.sankeyMinimum.toFixed(1)} px bubble/label budget; increase height, hide labels, or filter terms.`); }
    warnings.push("These are non-conserved relationship ribbons: each width is an independent enrichment ratio and widths do not sum to a source total. Bubble area is approximate; exact ratio, count, FDR, and background remain authoritative in the input table.");
  }
  if (definition.id === "geographic-map") {
    const invalidLatitudes = dataset.rows.filter((row) => { const value = parseNumericValue(row[mapping.latitude]); return value === null || value < -90 || value > 90; }).length;
    const invalidLongitudes = dataset.rows.filter((row) => { const value = parseNumericValue(row[mapping.longitude]); return value === null || value < -180 || value > 180; }).length;
    const invalidValues = dataset.rows.filter((row) => (parseNumericValue(row[mapping.value]) ?? -1) < 0).length;
    if (invalidLatitudes > 0 || invalidLongitudes > 0) errors.push(`Geographic coordinates must satisfy latitude [-90, 90] and longitude [-180, 180]; invalid latitude rows: ${invalidLatitudes}, longitude rows: ${invalidLongitudes}.`);
    if (invalidValues > 0) errors.push(`Geographic magnitude must be non-negative; invalid rows: ${invalidValues}.`);
    const sites = dataset.rows.map((row) => row[mapping.label]?.trim());
    const mappedGroups = mapping.group ? dataset.rows.map((row) => row[mapping.group]?.trim()) : ["Sites"];
    if (mapping.group && mappedGroups.some((group) => !group)) errors.push("Mapped geographic groups must be non-empty on every row; remove the mapping or supply a group for each site.");
    if (new Set(sites).size !== sites.length) errors.push("Geographic point map requires unique site labels; distinguish or aggregate duplicate sites upstream.");
    if (dataset.rows.length > 30) errors.push("Geographic point map supports at most 30 labelled sites in the compact figure.");
    if (settings) {
      const groups = [...new Set(mappedGroups.filter(Boolean))];
      const footer = categoryFooterLayoutMetrics(definition.id, settings, groups);
      if (!footer.bottomFits) errors.push(`Geographic group legend needs ${footer.rows} footer rows, which does not fit the ${footer.frame.bottom} px compact footer; reduce tick size or merge groups into fewer rows.`);
      if (!footer.labelsFit) errors.push("Geographic group names cannot fit their compact legend cells; increase width or shorten the group labels.");
      const layout = geographicPointLayout(settings, dataset.rows.map((row) => ({ label: row[mapping.label], latitude: parseNumericValue(row[mapping.latitude]) ?? 0, longitude: parseNumericValue(row[mapping.longitude]) ?? 0, value: parseNumericValue(row[mapping.value]) ?? 0 })));
      if (layout.markCollisionPairs > 0) errors.push(`Geographic point map has ${layout.markCollisionPairs} overlapping point pair${layout.markCollisionPairs === 1 ? "" : "s"} at the current size; increase figure dimensions, reduce point size, or aggregate/offset nearby sites.`);
      if (settings.showLabels && layout.labelCollisionCount > 0) errors.push(`Geographic point map cannot place ${layout.labelCollisionCount} site label${layout.labelCollisionCount === 1 ? "" : "s"} without overlap at the current size; increase dimensions, shorten labels, hide labels, or filter sites.`);
    }
    warnings.push("The equirectangular locator map distorts distance and area and does not establish geographic causation or administrative membership.");
  }
  if (definition.id === "petal") {
    const invalid = dataset.rows.filter((row) => (parseNumericValue(row[mapping.value]) ?? -1) < 0).length;
    if (invalid > 0) errors.push(`Petal values must be non-negative; invalid rows: ${invalid}.`);
    const labels = dataset.rows.map((row) => row[mapping.label]?.trim());
    if (new Set(labels).size !== labels.length) errors.push("Petal categories must be unique; aggregate duplicate categories upstream.");
    if (dataset.rows.length < 3 || dataset.rows.length > 12) errors.push("Petal view requires 3–12 categories.");
    if (settings) { const layout = enrichmentSpecializedLayoutMetrics(definition.id, settings, { rowCount: dataset.rows.length }); if (layout.petalArcSpacing < layout.petalMinimum) errors.push(`Petal labels have ${layout.petalArcSpacing.toFixed(1)} px of arc spacing, below the ${layout.petalMinimum.toFixed(1)} px text budget; increase size, hide labels, or reduce categories.`); }
    warnings.push("Petal length is a decorative approximate encoding; use a common-baseline bar or dot plot for precise comparison.");
  }
  if (definition.id === "word-cloud") {
    const invalid = dataset.rows.filter((row) => (parseNumericValue(row[mapping.value]) ?? 0) <= 0).length; const labels = dataset.rows.map((row) => row[mapping.label]?.trim());
    if (invalid > 0) errors.push(`Word-cloud weights must be strictly positive; invalid rows: ${invalid}.`);
    if (new Set(labels).size !== labels.length) errors.push("Word-cloud terms must be unique; aggregate duplicate labels upstream.");
    if (dataset.rows.length < 3 || dataset.rows.length > 40) errors.push("Word cloud requires 3–40 unique terms.");
    if (settings) { const layout = enrichmentSpecializedLayoutMetrics(definition.id, settings, { rowCount: dataset.rows.length }); if (layout.cloudCellHeight < 30 || layout.cloudCellWidth < 34) errors.push(`Word-cloud cells would be ${layout.cloudCellWidth.toFixed(1)} × ${layout.cloudCellHeight.toFixed(1)} px, too small for the 28 px maximum word size; increase figure size or reduce terms.`); }
    warnings.push("Font size supports approximate prominence only; position and color have no quantitative meaning.");
  }

  const pointCoordinateTypes: PlotType[] = ["manhattan"];
  const intervalCoordinateTypes: PlotType[] = ["chromosome-ideogram", "snp-density", "genome-tracks"];
  if ([...pointCoordinateTypes, ...intervalCoordinateTypes].includes(definition.id)) {
    const chromosomeColumn = mapping.chromosome;
    if (chromosomeColumn && dataset.headers.includes(chromosomeColumn)) {
      const invalidChromosomes = dataset.rows.filter((row) => !isValidChromosome(row[chromosomeColumn] ?? ""));
      if (invalidChromosomes.length > 0) errors.push(`Chromosome contains ${invalidChromosomes.length} invalid label${invalidChromosomes.length === 1 ? "" : "s"}; use labels such as 1, chr1, X, MT, or a non-blank contig identifier without spaces.`);
      const rawByNormalized = new Map<string, Set<string>>();
      dataset.rows.forEach((row) => {
        const raw = row[chromosomeColumn]?.trim();
        if (!raw) return;
        const normalized = normalizeChromosome(raw);
        const labels = rawByNormalized.get(normalized) ?? new Set<string>();
        labels.add(raw);
        rawByNormalized.set(normalized, labels);
      });
      const mixed = [...rawByNormalized].filter(([, labels]) => labels.size > 1).map(([chromosome]) => chromosome);
      if (mixed.length > 0) warnings.push(`Equivalent chromosome labels use mixed prefixes/case (${mixed.slice(0, 6).join(", ")}); they are merged for natural ordering.`);
      if (settings && (definition.id === "chromosome-ideogram" || definition.id === "snp-density")) {
        const chromosomeCount = rawByNormalized.size;
        const laneLayout = chromosomeLaneLayout(definition.id, settings, chromosomeCount);
        if (!laneLayout.fits) errors.push(`${definition.name} needs at least ${laneLayout.minimumLaneHeight.toFixed(1)} px per chromosome label, but ${chromosomeCount} chromosomes provide only ${laneLayout.laneHeight.toFixed(1)} px each; increase height or filter chromosomes.`);
      }
    }
    if (pointCoordinateTypes.includes(definition.id) && mapping.position && dataset.headers.includes(mapping.position)) {
      const invalidPositions = dataset.rows.filter((row) => {
        const value = parseNumericValue(row[mapping.position]);
        return value === null || !Number.isSafeInteger(value) || value <= 0;
      });
      if (invalidPositions.length > 0) errors.push(`Genomic position contains ${invalidPositions.length} invalid value${invalidPositions.length === 1 ? "" : "s"}; positions must be positive safe integers in base pairs.`);
    }
    if (intervalCoordinateTypes.includes(definition.id) && mapping.start && mapping.end && dataset.headers.includes(mapping.start) && dataset.headers.includes(mapping.end)) {
      const invalidRanges = dataset.rows.filter((row) => {
        const start = parseNumericValue(row[mapping.start]);
        const end = parseNumericValue(row[mapping.end]);
        return start === null || end === null || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start;
      });
      if (invalidRanges.length > 0) errors.push(`Genomic ranges contain ${invalidRanges.length} invalid interval${invalidRanges.length === 1 ? "" : "s"}; start/end must be safe integers with 0 ≤ start < end.`);
      if (invalidRanges.length === 0 && (definition.id === "chromosome-ideogram" || definition.id === "snp-density") && chromosomeColumn) {
        const overlaps: string[] = [];
        const chromosomes = [...new Set(dataset.rows.map((row) => normalizeChromosome(row[chromosomeColumn])))];
        chromosomes.forEach((chromosome) => {
          const intervals = dataset.rows.filter((row) => normalizeChromosome(row[chromosomeColumn]) === chromosome).map((row) => ({ start: parseNumericValue(row[mapping.start]) ?? 0, end: parseNumericValue(row[mapping.end]) ?? 0 })).sort((left, right) => left.start - right.start || left.end - right.end);
          if (intervals.some((interval, index) => index > 0 && interval.start < intervals[index - 1].end)) overlaps.push(chromosome);
        });
        if (overlaps.length > 0) errors.push(`${definition.name} bins/bands must not overlap within a chromosome; affected: ${overlaps.slice(0, 8).join(", ")}.`);
      }
    }
    if (chromosomeColumn) {
      const endColumn = pointCoordinateTypes.includes(definition.id) ? mapping.position : mapping.end;
      if (endColumn && dataset.headers.includes(endColumn)) {
        const axisIntervals = dataset.rows.flatMap((row) => {
          const end = parseNumericValue(row[endColumn]);
          return end !== null && Number.isSafeInteger(end) && end >= 0 ? [{ chromosome: row[chromosomeColumn], start: end, end }] : [];
        });
        if (axisIntervals.length === dataset.rows.length) {
          const span = genomeAxisSpanMetrics(axisIntervals);
          if (!span.fits) errors.push(`The cumulative genomic axis spans ${Number.isFinite(span.totalSpan) ? span.totalSpan.toExponential(3) : "an invalid number of"} bp across ${span.chromosomeCount} chromosomes, exceeding the safe browser limit of ${span.maximumSpan.toExponential(0)} bp; split the view or use a documented rescaled coordinate system.`);
        }
      }
    }
    if (definition.id === "snp-density" && mapping.value) {
      const negative = dataset.rows.filter((row) => (parseNumericValue(row[mapping.value]) ?? -1) < 0).length;
      if (negative > 0) errors.push("SNP density/count values must be non-negative.");
    }
    if (definition.id === "chromosome-ideogram" && mapping.stain && dataset.headers.includes(mapping.stain)) {
      const supported = new Set<string>(supportedCytobandStains);
      const invalidStains = [...new Set(dataset.rows.map((row) => row[mapping.stain]?.trim().toLowerCase()).filter((value) => value && !supported.has(value)))];
      if (invalidStains.length > 0) errors.push(`Unsupported cytoband stain value${invalidStains.length === 1 ? "" : "s"}: ${invalidStains.slice(0, 8).join(", ")}. Supported values are ${supportedCytobandStains.join(", ")}; leave the optional stain blank for a neutral band.`);
    }
    if (dataset.rows.length > 20_000) errors.push("Coordinate-based browser previews are limited to 20,000 rows; pre-filter or aggregate with a documented genomic window.");
  }

  if ((definition.id === "manhattan" || definition.id === "qq") && mapping.pValue && dataset.headers.includes(mapping.pValue)) {
    const invalidPValues = dataset.rows.filter((row) => {
      const value = parseNumericValue(row[mapping.pValue]);
      return value === null || value <= 0 || value > 1;
    });
    if (invalidPValues.length > 0) errors.push(`${definition.name} P values must lie in (0, 1]; ${invalidPValues.length} invalid row${invalidPValues.length === 1 ? "" : "s"} found.`);
    if (definition.id === "qq" && dataset.rows.length < 2) errors.push("QQ plots require at least two P values to define observed and expected quantiles.");
    if (definition.id === "qq" && dataset.rows.length > 20_000) errors.push("QQ browser previews are limited to 20,000 P values; use a documented deterministic subset or an upstream rasterized workflow for larger analyses.");
  }

  if ((definition.id === "waterfall" || definition.id === "oncoplot") && mapping.sample && mapping.gene && mapping.alteration) {
    const sampleCount = new Set(dataset.rows.map((row) => row[mapping.sample])).size;
    const geneCount = new Set(dataset.rows.map((row) => row[mapping.gene])).size;
    if (sampleCount > 200) errors.push(`${definition.name} compact previews support at most 200 samples; filter to a documented cohort or increase aggregation.`);
    if (geneCount > 100) errors.push(`${definition.name} compact previews support at most 100 genes; select a justified gene panel before plotting.`);
    if (dataset.rows.length > 10_000) errors.push(`${definition.name} browser previews support at most 10,000 alteration events; filter to a documented cohort/gene panel or pre-aggregate events.`);
    if (sampleCount < 2) warnings.push(`${definition.name} is most informative for a cohort with at least two samples.`);
    if (settings) {
      const alterationCount = new Set(dataset.rows.map((row) => canonicalAlteration(row[mapping.alteration] ?? ""))).size;
      if (definition.id === "oncoplot") {
        const layout = oncoplotLayoutMetrics(settings, geneCount, sampleCount, alterationCount);
        if (!layout.fits) errors.push(`Oncoplot cells are only ${layout.cellWidth.toFixed(1)} × ${layout.cellHeight.toFixed(1)} px in the selected canvas; need ≥${layout.minimumSampleWidth.toFixed(0)} px per sample and ≥${layout.minimumGeneHeight.toFixed(1)} px per gene with at least 70 px matrix height. Increase width/height or filter samples/genes.`);
      } else {
        const layout = waterfallLayoutMetrics(settings, sampleCount, alterationCount);
        if (!layout.fits) errors.push(`Mutation waterfall bars are only ${layout.bandWidth.toFixed(1)} px wide with ${layout.availableChartHeight.toFixed(1)} px chart height; need ≥${layout.minimumBandWidth.toFixed(0)} px per sample and at least 70 px chart height. Increase width/height or filter samples.`);
      }
    }
  }

  if (definition.id === "genome-tracks" && settings && mapping.track && dataset.headers.includes(mapping.track)) {
    const trackCount = new Set(dataset.rows.map((row) => row[mapping.track])).size;
    const layout = genomeTrackLayout(settings, trackCount);
    if (!layout.fits) errors.push(`Genome tracks need at least ${layout.requestedHeight.toFixed(0)} px for ${trackCount} labeled tracks at the selected gap, but the plot area has ${layout.frame.plotHeight.toFixed(0)} px; increase height, reduce the gap, or filter tracks.`);
  }

  if (definition.id === "motif-logo" && [mapping.position, mapping.A, mapping.C, mapping.G, mapping.T].every((column) => column && dataset.headers.includes(column))) {
    const positions = dataset.rows.map((row) => parseNumericValue(row[mapping.position]) ?? Number.NaN);
    const invalidPositions = positions.filter((position) => !Number.isSafeInteger(position) || position <= 0);
    if (invalidPositions.length > 0) errors.push("Motif positions must be unique positive safe integers.");
    if (new Set(positions).size !== positions.length) errors.push("Motif positions must be unique positive safe integers.");
    const invalidProbabilityRows = dataset.rows.filter((row) => {
      const values = (["A", "C", "G", "T"] as const).map((base) => parseNumericValue(row[mapping[base]]));
      const containsInvalidValue = values.some((value) => value === null || (value !== null && (value < 0 || value > 1)));
      const probabilitySum = values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
      return containsInvalidValue || Math.abs(probabilitySum - 1) > 0.005;
    });
    if (invalidProbabilityRows.length > 0) errors.push(`Motif A/C/G/T values must be probabilities in [0, 1] summing to 1 (±0.005); ${invalidProbabilityRows.length} invalid position${invalidProbabilityRows.length === 1 ? "" : "s"} found.`);
    if (dataset.rows.length > 60) errors.push("Motif logo previews are limited to 60 positions to keep letters legible.");
    if (settings) {
      const layout = motifLayoutMetrics(settings, dataset.rows.length);
      if (!layout.fits) errors.push(`Motif positions are only ${layout.bandWidth.toFixed(1)} px wide in the selected canvas; need ≥${layout.minimumBandWidth.toFixed(1)} px per position. Increase width or filter positions.`);
    }
  }

  if (settings && definition.id === "manhattan" && settings.genomicSignificanceLog10 <= 0) errors.push("The Manhattan −log10 significance threshold must be positive.");
  if (settings && definition.id === "genome-tracks" && settings.genomicTrackGap < 0) errors.push("Genome track gap must be non-negative.");
  if (settings && definition.id === "circos" && settings.genomicTrackGap < 0) errors.push("Circos track gap must be non-negative.");

  if (["pca", "pcoa", "umap", "tsne", "nmds"].includes(definition.id) && settings) {
    const ordinationName = definition.name;
    if (settings.ordinationView === "3d" && !mapping.z) errors.push(`${ordinationName} 3D projection requires a mapped third coordinate.`);
    if (settings.ordinationView !== "scree") {
      const coordinateColumns = [mapping.x, mapping.y, ...(settings.ordinationView === "3d" ? [mapping.z] : [])].filter(Boolean);
      if (new Set(coordinateColumns).size !== coordinateColumns.length) errors.push("Every displayed ordination axis must map to a different coordinate column.");
    }
    if (settings.ordinationView === "scree") {
      if (definition.id !== "pca") errors.push("Scree view is available only for PCA.");
      if (!(dataset.analysis?.pca?.explainedVariance.length)) errors.push("PCA scree view requires explained-variance metadata from the matrix analysis.");
    }

    const scoreView = settings.ordinationView === "scores";
    const threeDimensionalView = settings.ordinationView === "3d";
    const groupedLayers = scoreView
      ? settings.ordinationShowEllipse || settings.ordinationShowHull || settings.ordinationShowCentroids
      : threeDimensionalView && settings.ordinationShowCentroids;
    if (groupedLayers && !mapping.group) errors.push("Map a group column before displaying group ellipses, hulls, or centroids.");
    if (scoreView && mapping.group && (settings.ordinationShowEllipse || settings.ordinationShowHull)) {
      const groupedPoints = new Map<string, Array<{ x: number; y: number }>>();
      dataset.rows.forEach((row) => {
        const x = parseNumericValue(row[mapping.x]);
        const y = parseNumericValue(row[mapping.y]);
        if (x === null || y === null) return;
        const group = row[mapping.group] || "All";
        const points = groupedPoints.get(group) ?? [];
        points.push({ x, y });
        groupedPoints.set(group, points);
      });
      const undersized = [...groupedPoints].filter(([, points]) => points.length < 3).map(([group, points]) => `${group} (n=${points.length})`);
      if (undersized.length > 0) errors.push(`${settings.ordinationShowEllipse ? "Covariance ellipses" : "Convex hulls"} require at least three observations per group; insufficient: ${undersized.join(", ")}.`);
      if (settings.ordinationShowEllipse || settings.ordinationShowHull) {
        const collinear = [...groupedPoints].filter(([, points]) => {
          if (points.length < 3) return false;
          const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
          const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
          const xx = points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
          const yy = points.reduce((sum, point) => sum + (point.y - meanY) ** 2, 0);
          const xy = points.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0);
          return xx * yy - xy * xy <= 1e-12;
        }).map(([group]) => group);
        if (collinear.length > 0) errors.push(`${settings.ordinationShowEllipse && settings.ordinationShowHull ? "Covariance ellipses and convex hulls" : settings.ordinationShowEllipse ? "Covariance ellipses" : "Convex hulls"} require non-collinear coordinates; affected: ${collinear.join(", ")}.`);
      }
      if (settings.ordinationShowEllipse && [settings.xMin, settings.xMax, settings.yMin, settings.yMax].some((limit) => limit !== null)) {
        const boundary = [...groupedPoints.values()].flatMap((points) => covarianceEllipsePoints(points.map((point) => definition.id === "pca" && settings.swapAxes ? { x: point.y, y: point.x } : point)));
        const clipped = boundary.some((point) => (settings.xMin !== null && point.x < settings.xMin) || (settings.xMax !== null && point.x > settings.xMax) || (settings.yMin !== null && point.y < settings.yMin) || (settings.yMax !== null && point.y > settings.yMax));
        if (clipped) warnings.push("Manual axis limits clip part of at least one ordination 95% covariance ellipse boundary.");
      }
    }

    const pointView = scoreView || threeDimensionalView;
    const displayedGroups = pointView && mapping.group ? dataset.rows.map((row) => row[mapping.group]?.trim()).filter(Boolean) : [];
    const groupCount = new Set(displayedGroups).size;
    if (pointView && mapping.group && displayedGroups.length !== dataset.rows.length) errors.push("Mapped ordination groups must not contain blank values.");
    if (pointView && groupCount > 12 && settings.legendPosition !== "none") errors.push(`Ordination has ${groupCount} color groups, but the compact legend supports at most 12. Filter/facet the display or intentionally hide the legend.`);
    if (pointView && groupCount > 12 && settings.legendPosition === "none") warnings.push(`${groupCount} groups use deterministic distinct colors with the legend intentionally hidden; preserve an external color key.`);
    const shapeCount = pointView && settings.ordinationUseShapes && mapping.shape
      ? new Set(dataset.rows.map((row) => row[mapping.shape]).filter(Boolean)).size
      : 0;
    if ((scoreView || threeDimensionalView) && settings.ordinationUseShapes && mapping.shape) {
      if (shapeCount > 4) errors.push(`Mapped shape contains ${shapeCount} levels; the compact ordination view supports at most four distinct shapes.`);
    }
    if (pointView && settings.legendPosition !== "none" && !ordinationLegendLayout(definition.id as OrdinationType, settings, groupCount, shapeCount).fits) {
      errors.push("The combined ordination color and shape legends do not fit inside the annotated compact canvas. Reduce group/shape levels, move or hide the legend, shorten annotations, or increase figure height.");
    }
    if (definition.id === "pca" && settings.ordinationShowLoadings && settings.ordinationView === "scores" && !(dataset.analysis?.pca?.loadings.length)) {
      errors.push("PCA loading arrows require loading metadata from the matrix analysis.");
    }
    if (definition.id === "pca" && scoreView && settings.ordinationShowLoadings && [settings.xMin, settings.xMax, settings.yMin, settings.yMax].some((limit) => limit !== null)) {
      const loadingLayout = ordinationLoadingLayout(dataset, mapping, settings);
      if (loadingLayout.minimumArrowLength < 2) errors.push("PCA loading arrows require manual domains that include zero with enough room for every visible arrow and label in the final annotated plot. Use automatic or more balanced limits.");
    }

    const allPcoaVariances = [settings.ordinationXVariance, settings.ordinationYVariance, settings.ordinationZVariance];
    const displayedPcoaIndexes = [mapping.x, mapping.y, ...(settings.ordinationView === "3d" ? [mapping.z] : [])].map((column, axisIndex) => {
      const explicitAxis = column?.match(/(?:^|[_ .-])(?:dim|axis|component|pc|pcoa)[_ .-]?(\d+)$/i)?.[1];
      return Math.max(0, Number(explicitAxis ?? axisIndex + 1) - 1);
    });
    const displayedPcoaVariances = displayedPcoaIndexes.map((index) => allPcoaVariances[index] ?? null);
    if (definition.id === "pcoa" && allPcoaVariances.some((value) => value !== null)) {
      if (displayedPcoaVariances.some((value) => value === null)) errors.push(`Supply explained variance for every displayed PCoA coordinate or leave all displayed values blank.`);
      const numericVariances = allPcoaVariances.filter((value): value is number => value !== null);
      if (numericVariances.some((value) => value < 0 || value > 100)) errors.push("PCoA explained-variance percentages must lie between 0 and 100.");
      if (numericVariances.reduce((sum, value) => sum + value, 0) > 100.01) errors.push("Supplied PCoA explained-variance percentages cannot sum to more than 100%.");
      const unusedSupplied = allPcoaVariances.flatMap((value, index) => value !== null && !displayedPcoaIndexes.includes(index) ? [`PCoA ${index + 1}`] : []);
      if (unusedSupplied.length > 0) warnings.push(`Supplied variance for ${unusedSupplied.join(", ")} is preserved but not displayed in the current coordinate view.`);
    }

    const permanovaValues = [settings.ordinationPermanovaR2, settings.ordinationPermanovaP, settings.ordinationPermanovaPermutations];
    if (settings.ordinationView !== "scree" && permanovaValues.some((value) => value !== null)) {
      if (permanovaValues.some((value) => value === null)) errors.push("Supplied PERMANOVA requires R², P value, and permutation count together.");
      if (!mapping.group) errors.push("Map the tested group column before displaying supplied PERMANOVA results.");
      if (mapping.group && groupCount < 2) errors.push("Supplied PERMANOVA requires at least two non-empty levels in the mapped tested-group column.");
      if (settings.ordinationMethodNote.trim().length < 12) errors.push("Supplied PERMANOVA requires a method note identifying the distance, tested formula/factor, and any strata or permutation constraints.");
      if (settings.ordinationPermanovaR2 !== null && (settings.ordinationPermanovaR2 < 0 || settings.ordinationPermanovaR2 > 1)) errors.push("PERMANOVA R² must lie between 0 and 1.");
      if (settings.ordinationPermanovaP !== null && (settings.ordinationPermanovaP <= 0 || settings.ordinationPermanovaP > 1)) errors.push("PERMANOVA P value must lie in (0, 1].");
      if (settings.ordinationPermanovaPermutations !== null && (!Number.isInteger(settings.ordinationPermanovaPermutations) || settings.ordinationPermanovaPermutations < 1)) errors.push("PERMANOVA permutations must be a positive integer.");
      warnings.push("PERMANOVA values are displayed as supplied; Visualization Studio does not recompute them from ordination coordinates. Confirm that the mapped display group matches the tested model factor.");
    }
    if (definition.id === "nmds" && settings.ordinationStress !== null) {
      if (settings.ordinationStress < 0) errors.push("NMDS stress must be non-negative.");
      if (settings.ordinationMethodNote.trim().length < 12) errors.push("Supplied NMDS stress requires a method note identifying the stress definition, dissimilarity, dimensionality, and convergence information.");
    }
    if (settings.ordinationMethodNote.trim().length > 72) warnings.push("The upstream method note is truncated to 72 characters in the compact figure; preserve the full method in the caption or analysis record.");
    if (dataset.rows.length > 5_000) warnings.push(`${ordinationName} contains ${dataset.rows.length.toLocaleString()} observations; consider rasterization or stratified downsampling for a legible compact export.`);
  }

  if (["volcano", "ma", "enrichment", "enrichment-bar"].includes(definition.id) && mapping.pValue) {
    const pColumn = mapping.pValue;
    const invalidP = pColumn
      ? dataset.rows.filter((row) => {
          const value = parseNumericValue(row[pColumn]);
          return value === null || value <= 0 || value > 1;
        }).length
      : 0;
    if (invalidP > 0) errors.push(`Adjusted P value contains ${invalidP} value${invalidP === 1 ? "" : "s"} outside (0, 1].`);
  }

  if (["pie", "donut", "waffle", "rose"].includes(definition.id) && mapping.value) {
    const values = dataset.rows.map((row) => parseNumericValue(row[mapping.value]) ?? 0);
    const negative = values.filter((value) => value < 0).length;
    if (negative > 0) errors.push(`${definition.name} requires non-negative values; detected ${negative} negative value${negative === 1 ? "" : "s"}.`);
    if (values.reduce((sum, value) => sum + value, 0) <= 0) errors.push(`${definition.name} requires a positive displayed total.`);
    const categoryCount = mapping.category ? new Set(dataset.rows.map((row) => row[mapping.category]).filter(Boolean)).size : 0;
    if (mapping.category && categoryCount !== dataset.rows.length) errors.push(`${definition.name} requires one row per unique category.`);
    if (categoryCount > 12) errors.push(`${definition.name} is limited to 12 categories so every exported category remains identifiable; aggregate small parts or use a sorted bar chart.`);
    if (definition.id === "rose" && settings?.radialMaximum !== null && settings?.radialMaximum !== undefined) {
      if (settings.radialMaximum <= 0) errors.push("Radial maximum must be positive or left on Auto.");
      else if (values.some((value) => value > settings.radialMaximum!)) warnings.push("The manual radial maximum clips one or more rose sectors.");
    }
  }

  if (["treemap", "sunburst"].includes(definition.id) && mapping.node && mapping.value) {
    const nodes = dataset.rows.map((row) => row[mapping.node]?.trim()).filter(Boolean);
    const nodeSet = new Set(nodes);
    if (nodeSet.size !== nodes.length) errors.push("Hierarchy node labels must be unique.");
    const roots = dataset.rows.filter((row) => !mapping.parent || !row[mapping.parent]?.trim());
    if (roots.length !== 1) errors.push(`Hierarchy data require exactly one blank-parent root; detected ${roots.length}.`);
    if (roots.length === 1) {
      const expectedRootBlankWarning = warnings.indexOf("1 blank cell detected.");
      if (expectedRootBlankWarning >= 0) warnings.splice(expectedRootBlankWarning, 1);
      if (definition.id === "sunburst" && mapping.parent) {
        const rootName = roots[0][mapping.node]?.trim();
        const topLevelCount = dataset.rows.filter((row) => row[mapping.parent]?.trim() === rootName).length;
        if (topLevelCount > 12) errors.push("Sunburst is limited to 12 top-level branches so every exported branch remains identifiable; combine small branches or use a treemap.");
      }
    }
    const missingParents = dataset.rows.filter((row) => {
      const parent = mapping.parent ? row[mapping.parent]?.trim() : "";
      return Boolean(parent) && !nodeSet.has(parent);
    }).length;
    if (missingParents > 0) errors.push(`${missingParents} hierarchy node${missingParents === 1 ? " references" : "s reference"} a missing parent.`);
    const selfParents = dataset.rows.filter((row) => mapping.parent && row[mapping.node]?.trim() === row[mapping.parent]?.trim()).length;
    if (selfParents > 0) errors.push(`${selfParents} hierarchy node${selfParents === 1 ? " is" : "s are"} its own parent.`);
    const negative = dataset.rows.filter((row) => (parseNumericValue(row[mapping.value]) ?? 0) < 0).length;
    if (negative > 0) errors.push(`Hierarchy leaf values must be non-negative; detected ${negative} negative value${negative === 1 ? "" : "s"}.`);
    const parents = new Set(dataset.rows.map((row) => mapping.parent ? row[mapping.parent]?.trim() : "").filter(Boolean));
    const internalValues = dataset.rows.filter((row) => parents.has(row[mapping.node]?.trim()) && (parseNumericValue(row[mapping.value]) ?? 0) !== 0).length;
    if (internalValues > 0) errors.push(`${internalValues} internal hierarchy node${internalValues === 1 ? " has" : "s have"} a non-zero value; enter values on leaves only.`);
    if (mapping.parent && roots.length === 1) {
      const rootName = roots[0][mapping.node]?.trim();
      const parentByNode = new Map(dataset.rows.map((row) => [row[mapping.node]?.trim(), row[mapping.parent]?.trim()]));
      let cycleCount = 0;
      let disconnectedCount = 0;
      for (const node of nodes) {
        const visited = new Set<string>();
        let cursor = node;
        while (cursor && cursor !== rootName) {
          if (visited.has(cursor)) { cycleCount += 1; break; }
          visited.add(cursor);
          cursor = parentByNode.get(cursor) ?? "";
        }
        if (cursor !== rootName && ![...visited].some((visitedNode) => parentByNode.get(visitedNode) && !nodeSet.has(parentByNode.get(visitedNode)!))) disconnectedCount += 1;
      }
      if (cycleCount > 0) errors.push("Hierarchy parent relationships contain a cycle.");
      else if (disconnectedCount > 0 && missingParents === 0) errors.push(`${disconnectedCount} hierarchy node${disconnectedCount === 1 ? " is" : "s are"} disconnected from the root.`);
    }
    const leafTotal = dataset.rows.filter((row) => !parents.has(row[mapping.node]?.trim())).reduce((sum, row) => sum + (parseNumericValue(row[mapping.value]) ?? 0), 0);
    if (leafTotal <= 0) errors.push("Hierarchy data require a positive total across leaf nodes.");
    if (dataset.rows.length > 80) warnings.push(`${definition.name} has ${dataset.rows.length} nodes; labels may be dense in a compact export.`);
  }

  if (["radar", "polar-profile"].includes(definition.id) && mapping.value) {
    const categoryRole = definition.id === "radar" ? "feature" : "angle";
    const categoryColumn = mapping[categoryRole];
    const seriesColumn = mapping.series;
    const series = [...new Set(dataset.rows.map((row) => seriesColumn ? row[seriesColumn] || "All" : "All"))];
    const referenceCategories = categoryColumn ? [...new Set(dataset.rows.filter((row) => (seriesColumn ? row[seriesColumn] || "All" : "All") === series[0]).map((row) => row[categoryColumn]))] : [];
    if (referenceCategories.length < 3) errors.push(`${definition.name} requires at least three ${definition.id === "radar" ? "features" : "ordered angle categories"}.`);
    for (const currentSeries of series.slice(1)) {
      const categories = categoryColumn ? new Set(dataset.rows.filter((row) => (seriesColumn ? row[seriesColumn] || "All" : "All") === currentSeries).map((row) => row[categoryColumn])) : new Set<string>();
      if (categories.size !== referenceCategories.length || referenceCategories.some((category) => !categories.has(category))) {
        errors.push(`Every ${definition.name} series must contain the same category set.`);
        break;
      }
      if (definition.id === "polar-profile" && categoryColumn) {
        const orderedCategories = dataset.rows.filter((row) => (seriesColumn ? row[seriesColumn] || "All" : "All") === currentSeries).map((row) => row[categoryColumn]);
        if (orderedCategories.some((category, index) => category !== referenceCategories[index])) {
          errors.push("Every Polar profile series must use the same category order.");
          break;
        }
      }
    }
    const duplicates = new Set<string>();
    const seen = new Set<string>();
    dataset.rows.forEach((row) => {
      const key = `${seriesColumn ? row[seriesColumn] || "All" : "All"}\u0000${categoryColumn ? row[categoryColumn] : ""}`;
      if (seen.has(key)) duplicates.add(key); else seen.add(key);
    });
    if (duplicates.size > 0) errors.push(`${definition.name} requires one value per category and series; detected ${duplicates.size} duplicate pair${duplicates.size === 1 ? "" : "s"}.`);
    const negative = dataset.rows.filter((row) => (parseNumericValue(row[mapping.value]) ?? 0) < 0).length;
    if (negative > 0) errors.push(`${definition.name} radial values must be non-negative; detected ${negative} negative value${negative === 1 ? "" : "s"}.`);
    if (series.length > 5) warnings.push(`${definition.name} overlays ${series.length} series; use facets or fewer series to avoid occlusion.`);
    if (settings?.radialMaximum !== null && settings?.radialMaximum !== undefined) {
      if (settings.radialMaximum <= 0) errors.push("Radial maximum must be positive or left on Auto.");
      else if (dataset.rows.some((row) => (parseNumericValue(row[mapping.value]) ?? 0) > settings.radialMaximum!)) warnings.push(`The manual radial maximum clips one or more ${definition.name} values.`);
    }
  }

  if (definition.id === "population-pyramid" && mapping.category && mapping.value && mapping.group) {
    const groups = [...new Set(dataset.rows.map((row) => row[mapping.group]).filter(Boolean))];
    if (groups.length !== 2) errors.push(`Population pyramids require exactly two groups; detected ${groups.length}.`);
    const negative = dataset.rows.filter((row) => (parseNumericValue(row[mapping.value]) ?? 0) < 0).length;
    if (negative > 0) errors.push(`Population-pyramid inputs must be non-negative; detected ${negative} negative value${negative === 1 ? "" : "s"}.`);
    const pairs = dataset.rows.map((row) => `${row[mapping.category]}\u0000${row[mapping.group]}`);
    if (new Set(pairs).size !== pairs.length) errors.push("Population pyramids require one value per category and group pair.");
    const categories = [...new Set(dataset.rows.map((row) => row[mapping.category]).filter(Boolean))];
    if (groups.length === 2 && categories.some((category) => groups.some((group) => !dataset.rows.some((row) => row[mapping.category] === category && row[mapping.group] === group)))) {
      errors.push("Every population-pyramid category must contain both groups.");
    }
    if (groups.some((group) => dataset.rows.filter((row) => row[mapping.group] === group).reduce((sum, row) => sum + (parseNumericValue(row[mapping.value]) ?? 0), 0) <= 0)) {
      errors.push("Each population-pyramid group requires a positive displayed total.");
    }
  }

  if (definition.id === "bar" || definition.id === "line" || definition.id === "errorbar") {
    const barSupportsUncertainty = definition.id !== "bar" || !settings || !["stacked", "percentage", "polar"].includes(settings.barVariant);
    const errorType = definition.id === "bar" ? (barSupportsUncertainty ? settings?.barErrorType : "none") : settings?.lineErrorType;
    const calculatesFromLongForm = definition.id === "bar" && settings?.barInputMode === "long";
    if (definition.id !== "errorbar" && errorType !== undefined && errorType !== "none" && !mapping.error && !calculatesFromLongForm) {
      errors.push(`Map an error column before displaying ${errorType.toUpperCase()} error bars.`);
    }
    if (mapping.error && (definition.id !== "bar" || !settings || isPlotRoleActive("bar", "error", settings))) {
      const negativeErrors = dataset.rows.filter((row) => {
        const value = parseNumericValue(row[mapping.error]);
        return value !== null && value < 0;
      }).length;
      if (negativeErrors > 0) errors.push(`Error magnitude contains ${negativeErrors} negative value${negativeErrors === 1 ? "" : "s"}; SD and SEM must be non-negative, as must all uncertainty half-widths.`);
    }
    if (definition.id === "line" && settings?.showSignificance) {
      if (settings.lineErrorType !== "sd" && settings.lineErrorType !== "sem") errors.push("Line significance calculation requires Mean ± SD or Mean ± SEM.");
      if (!mapping.n) errors.push("Map an explicit sample-size (n) column before calculating line significance.");
      if (!mapping.series) errors.push("Map a series column before calculating line significance.");
      if (mapping.n) {
        const invalidSampleSizes = dataset.rows.filter((row) => {
          const sampleSize = parseNumericValue(row[mapping.n]);
          return sampleSize === null || !Number.isInteger(sampleSize) || sampleSize < 2;
        }).length;
        if (invalidSampleSizes > 0) errors.push(`Sample size contains ${invalidSampleSizes} invalid value${invalidSampleSizes === 1 ? "" : "s"}; Welch tests require an integer n ≥ 2 for every estimate.`);
      }
      if (mapping.x && mapping.series) {
        const duplicatePairs = dataset.rows.map((row) => `${row[mapping.x]}\u0000${row[mapping.series] || "All"}`);
        if (new Set(duplicatePairs).size !== duplicatePairs.length) errors.push("Summary-mode line significance requires exactly one mean per X and series pair.");
        const series = [...new Set(dataset.rows.map((row) => row[mapping.series]).filter(Boolean))];
        if (series.length < 2) errors.push("Line significance calculation requires at least two series.");
      }
    }
  }

  if ((definition.id === "scatter" || definition.id === "correlation") && settings) {
    const needsZ = ["pair-matrix", "3d", "ternary"].includes(settings.associationVariant);
    if (needsZ && !mapping.z) errors.push(`${settings.associationVariant === "pair-matrix" ? "Pair-matrix" : settings.associationVariant === "3d" ? "3D scatter" : "Ternary scatter"} requires a mapped Z / third component column.`);
    const points = dataset.rows.flatMap((row) => {
      const x = parseNumericValue(row[mapping.x]);
      const y = parseNumericValue(row[mapping.y]);
      const z = mapping.z ? parseNumericValue(row[mapping.z]) : null;
      return x === null || y === null ? [] : [{ x, y, z, group: mapping.group ? row[mapping.group] || "All" : "All" }];
    });
    if (settings.associationVariant === "ternary" && mapping.z) {
      const negative = points.filter((point) => point.x < 0 || point.y < 0 || (point.z ?? -1) < 0).length;
      const zeroTotal = points.filter((point) => point.x + point.y + (point.z ?? 0) <= 0).length;
      if (negative > 0) errors.push(`Ternary scatter requires non-negative components; detected ${negative} invalid row${negative === 1 ? "" : "s"}.`);
      if (zeroTotal > 0) errors.push(`Ternary scatter requires a positive row total; detected ${zeroTotal} zero-total row${zeroTotal === 1 ? "" : "s"}.`);
      if (points.length > 0 && points.some((point) => Math.abs(point.x + point.y + (point.z ?? 0) - 1) > 1e-6)) warnings.push("Ternary rows are normalized to proportions because one or more component totals differ from 1.");
    }
    if (settings.associationVariant === "3d" && mapping.z && new Set(points.map((point) => point.z)).size < 2) warnings.push("The mapped Z values are constant, so the orthographic 3D projection contains no depth variation.");
    const buckets = settings.associationGroupMode === "by-group"
      ? [...new Set(points.map((point) => point.group))].map((group) => ({ group, points: points.filter((point) => point.group === group) }))
      : [{ group: "Combined", points }];
    const supportsPlanarAnalysis = !["pair-matrix", "3d", "ternary"].includes(settings.associationVariant);
    const reportsByGroup = settings.associationGroupMode === "by-group" && (definition.id === "correlation" || settings.associationShowPValue || settings.associationFit !== "none");
    if (supportsPlanarAnalysis && reportsByGroup && buckets.length > 4) errors.push(`Compact by-group association summaries support at most four groups; found ${buckets.length}. Choose Combined group behavior or filter the displayed groups.`);
    if (supportsPlanarAnalysis && settings.associationFit !== "none") {
      const minimum = settings.associationFit === "polynomial" ? settings.associationPolynomialDegree + 2 : settings.associationFit === "loess" ? 4 : 3;
      const undersized = buckets.filter((bucket) => bucket.points.length < minimum).map((bucket) => `${bucket.group} (n=${bucket.points.length})`);
      if (undersized.length > 0) errors.push(`${settings.associationFit === "linear" ? "Linear regression" : settings.associationFit === "polynomial" ? `Degree-${settings.associationPolynomialDegree} polynomial regression` : "LOESS"} requires at least ${minimum} observations per fitted set; insufficient: ${undersized.join(", ")}.`);
      const requiredDistinctX = settings.associationFit === "polynomial" ? settings.associationPolynomialDegree + 1 : 2;
      const degenerate = buckets.filter((bucket) => new Set(bucket.points.map((point) => point.x)).size < requiredDistinctX).map((bucket) => bucket.group);
      if (degenerate.length > 0) errors.push(`${settings.associationFit === "polynomial" ? `Degree-${settings.associationPolynomialDegree} polynomial regression` : settings.associationFit === "linear" ? "Linear regression" : "LOESS"} requires at least ${requiredDistinctX} distinct X values per fitted set; affected: ${degenerate.join(", ")}.`);
      if (settings.yMin !== null || settings.yMax !== null) {
        const displayedBuckets = buckets.map((bucket) => ({ ...bucket, points: bucket.points.map((point) => settings.swapAxes ? { x: point.y, y: point.x } : point) }));
        const displayedX = displayedBuckets.flatMap((bucket) => bucket.points.map((point) => point.x));
        const xDomain = resolveAxisDomain(numericExtent(displayedX), settings.xMin, settings.xMax);
        const samples = Array.from({ length: 64 }, (_, index) => xDomain[0] + (xDomain[1] - xDomain[0]) * index / 63);
        const fittedValues = displayedBuckets.flatMap((bucket) => {
          if (settings.associationFit === "linear") {
            const fit = linearRegression(bucket.points);
            if (!fit) return [];
            const curve = samples.map((x) => fit.intercept + fit.slope * x);
            const band = settings.associationShowConfidenceBand ? linearConfidenceBand95(bucket.points, samples).flatMap((point) => [point.lower, point.upper]) : [];
            return [...curve, ...band];
          }
          if (settings.associationFit === "polynomial") {
            const fit = polynomialRegression(bucket.points, settings.associationPolynomialDegree);
            return fit ? samples.map((x) => fit.predict(x)) : [];
          }
          return loessSmooth(bucket.points, settings.associationLoessSpan).map((point) => point.y);
        });
        const clippedFit = fittedValues.some((value) => (settings.yMin !== null && value < settings.yMin) || (settings.yMax !== null && value > settings.yMax));
        if (clippedFit) warnings.push("Manual Y-axis limits clip part of the fitted curve or confidence band.");
      }
    }
    if (supportsPlanarAnalysis && settings.associationShowConfidenceBand && settings.associationFit !== "linear") errors.push("Mean 95% confidence bands are currently supported only for linear regression fits.");
    if (supportsPlanarAnalysis && (definition.id === "correlation" || settings.associationShowPValue)) {
      const undersized = buckets.filter((bucket) => bucket.points.length < 3).map((bucket) => `${bucket.group} (n=${bucket.points.length})`);
      if (undersized.length > 0) errors.push(`Correlation P values require at least three observations per reported set; insufficient: ${undersized.join(", ")}.`);
      const constant = buckets.filter((bucket) => new Set(bucket.points.map((point) => point.x)).size < 2 || new Set(bucket.points.map((point) => point.y)).size < 2).map((bucket) => bucket.group);
      if (constant.length > 0) errors.push(`Correlation is undefined for constant X or Y values; affected: ${constant.join(", ")}.`);
    }
    if (["density", "hexbin"].includes(settings.associationVariant) && settings.associationGroupMode !== "combined") errors.push("Density and hexbin aggregation require Combined group behavior so every bin uses one shared count or intensity scale.");
    if (["ellipse", "hull"].includes(settings.associationVariant)) {
      const minimum = settings.associationVariant === "ellipse" ? 3 : 3;
      const undersized = buckets.filter((bucket) => bucket.points.length < minimum).map((bucket) => `${bucket.group} (n=${bucket.points.length})`);
      if (undersized.length > 0) errors.push(`${settings.associationVariant === "ellipse" ? "Covariance ellipses" : "Convex hulls"} require at least three observations per displayed set; insufficient: ${undersized.join(", ")}.`);
      const degenerate = buckets.filter((bucket) => {
        const meanX = bucket.points.reduce((sum, point) => sum + point.x, 0) / Math.max(1, bucket.points.length);
        const meanY = bucket.points.reduce((sum, point) => sum + point.y, 0) / Math.max(1, bucket.points.length);
        const xx = bucket.points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
        const yy = bucket.points.reduce((sum, point) => sum + (point.y - meanY) ** 2, 0);
        const xy = bucket.points.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0);
        return xx * yy - xy * xy <= 1e-12;
      }).map((bucket) => bucket.group);
      if (degenerate.length > 0) errors.push(`${settings.associationVariant === "ellipse" ? "Covariance ellipses" : "Convex hulls"} require non-collinear X/Y observations; affected: ${degenerate.join(", ")}.`);
      if (settings.associationVariant === "ellipse" && [settings.xMin, settings.xMax, settings.yMin, settings.yMax].some((limit) => limit !== null)) {
        const boundary = buckets.flatMap((bucket) => covarianceEllipsePoints(bucket.points.map((point) => settings.swapAxes ? { x: point.y, y: point.x } : point)));
        const clipped = boundary.some((point) => (settings.xMin !== null && point.x < settings.xMin) || (settings.xMax !== null && point.x > settings.xMax) || (settings.yMin !== null && point.y < settings.yMin) || (settings.yMax !== null && point.y > settings.yMax));
        if (clipped) warnings.push("Manual axis limits clip part of at least one 95% covariance ellipse boundary.");
      }
    }
    if (settings.associationVariant === "density" && points.length < 5) warnings.push("Two-dimensional density estimates are unstable with fewer than five observations.");
    if (settings.associationVariant === "hexbin" && points.length < 10) warnings.push("Hexbin aggregation is usually unnecessary with fewer than ten observations; a point view may be clearer.");
  }

  if (definition.id === "bar" && settings) {
    const needsSecondary = ["dual-axis", "overlay"].includes(settings.barVariant);
    const needsTarget = settings.barVariant === "bullet";
    const needsFacet = settings.barVariant === "faceted";
    const categoryLayout = barCategoryAxisLayoutMetrics(settings, dataset.rows.map((row) => mapping.category ? row[mapping.category] ?? "" : ""));
    if (categoryLayout.applies && !categoryLayout.fits) {
      errors.push(`Category labels and the X-axis title need ${categoryLayout.requiredBottom}px of bottom space at the current text sizes; increase figure height, shorten category labels, or reduce the configured text sizes.`);
    }
    if (needsSecondary && !mapping.secondary) errors.push(`${settings.barVariant === "dual-axis" ? "Dual-axis" : "Overlay"} bars require a mapped secondary value column.`);
    if (needsTarget && !mapping.target) errors.push("Bullet charts require a mapped target value column.");
    if (needsFacet && !mapping.facet) errors.push("Faceted bars require a mapped facet column.");
    if (settings.showSignificance && settings.barVariant !== "polar" && settings.barAnalysisMode === "supplied" && !mapping.pValue) errors.push("Map a supplied P value column before displaying significance annotations.");
    if (mapping.pValue && isPlotRoleActive("bar", "pValue", settings)) {
      const invalidP = dataset.rows.filter((row) => {
        const value = parseNumericValue(row[mapping.pValue]);
        const raw = row[mapping.pValue]?.trim();
        if (!raw) return false;
        return value === null || value < 0 || value > 1;
      }).length;
      if (invalidP > 0) errors.push(`P value contains ${invalidP} value${invalidP === 1 ? "" : "s"} outside (0, 1].`);
    }
    if (settings.barVariant === "axis-break" && settings.axisBreakStart >= settings.axisBreakEnd) {
      errors.push("Axis-break start must be lower than axis-break end.");
    }
    if (settings.barVariant === "pyramid" && (!mapping.group || new Set(dataset.rows.map((row) => row[mapping.group]).filter(Boolean)).size < 2)) {
      errors.push("Pyramid charts require at least two groups.");
    }
    if (settings.barVariant === "polar") {
      const negativeValues = dataset.rows.filter((row) => (parseNumericValue(row[mapping.value]) ?? 0) < 0).length;
      if (negativeValues > 0) errors.push("Polar bars require non-negative values because radius cannot encode direction.");
    }
    if (settings.barVariant === "percentage") {
      const negativeValues = dataset.rows.filter((row) => (parseNumericValue(row[mapping.value]) ?? 0) < 0).length;
      if (negativeValues > 0) errors.push("100% stacked bars require non-negative parts; use Bidirectional for signed values.");
    }
    if (settings.barVariant === "axis-break") {
      const displayedValues = settings.barInputMode === "long" ? [...dataset.rows.reduce((buckets, row) => {
        const value = parseNumericValue(row[mapping.value]);
        if (value === null) return buckets;
        const key = `${row[mapping.category] ?? ""}\u0000${mapping.group ? row[mapping.group] ?? "" : ""}\u0000${mapping.facet ? row[mapping.facet] ?? "" : ""}`;
        const bucket = buckets.get(key) ?? []; bucket.push(value); buckets.set(key, bucket); return buckets;
      }, new Map<string, number[]>()).values()].flatMap((values) => {
        const summary = meanErrorStatistics(values);
        const error = settings.barErrorType === "sd" ? summary.sd : settings.barErrorType === "sem" ? summary.sem : 0;
        return error > 0 ? [summary.mean, summary.mean - error, summary.mean + error] : [summary.mean];
      }) : dataset.rows.flatMap((row) => {
        const value = parseNumericValue(row[mapping.value]);
        if (value === null) return [];
        const error = isPlotRoleActive("bar", "error", settings) && mapping.error ? Math.max(0, parseNumericValue(row[mapping.error]) ?? 0) : 0;
        return error > 0 ? [value, value - error, value + error] : [value];
      });
      if (!displayedValues.some((value) => value <= settings.axisBreakStart) || !displayedValues.some((value) => value >= settings.axisBreakEnd)) {
        warnings.push("The current data do not span both sides of the requested axis break; the preview will use an unbroken scale.");
      }
      const insideBreak = displayedValues.filter((value) => value > settings.axisBreakStart && value < settings.axisBreakEnd).length;
      if (insideBreak > 0) errors.push(`Axis break contains ${insideBreak} displayed value${insideBreak === 1 ? "" : "s"} or uncertainty bound${insideBreak === 1 ? "" : "s"}; choose an empty interval so no marks are hidden or relocated.`);
    }
    if (settings.barInputMode === "long" && mapping.error) {
      warnings.push("Long-form mode calculates SD or SEM from replicate observations; the mapped summary error column is ignored.");
    }
  }

  if (["box", "violin", "beeswarm", "raincloud", "histogram", "density", "ridge"].includes(definition.id) && mapping.group) {
    const lanes = distributionNumericLanes(dataset.rows, mapping.group, mapping.value, mapping.facet);
    for (const lane of lanes) {
      const label = mapping.facet ? `${lane.facet} / ${lane.group}` : lane.group;
      if (lane.values.length < 3) warnings.push(`${label} has n=${lane.values.length}; distribution estimates are unstable.`);
    }
    if (settings) {
      const visibleLayers = settings.showDensity || settings.showHistogram || settings.showBox || settings.showPoints || settings.distributionSummary !== "none" || settings.boxErrorType !== "none";
      if (!visibleLayers) errors.push("Enable at least one distribution layer before exporting.");
      if (settings.histogramBins < 3 || settings.histogramBins > 60 || !Number.isInteger(settings.histogramBins)) errors.push("Histogram bins must be an integer from 3 to 60.");
      if (settings.distributionShowPairedLines) {
        if (!mapping.subject) errors.push("Map a Subject / pair ID column before displaying paired lines.");
        else {
          const blankSubjects = dataset.rows.filter((row) => !row[mapping.subject]?.trim()).length;
          if (blankSubjects > 0) errors.push(`Subject / pair ID contains ${blankSubjects} blank value${blankSubjects === 1 ? "" : "s"}; paired lines require a complete identifier for every row.`);
          const pairKeys = dataset.rows.filter((row) => row[mapping.subject]?.trim()).map((row) => `${mapping.facet ? row[mapping.facet] || "All" : "All"}\u0000${row[mapping.group]}\u0000${row[mapping.subject]}`);
          if (new Set(pairKeys).size !== pairKeys.length) errors.push("Paired distribution data require at most one value per subject, group, and facet combination.");
          const facets = [...new Set(dataset.rows.map((row) => mapping.facet ? row[mapping.facet] || "All" : "All"))];
          for (const facet of facets) {
            const facetRows = dataset.rows.filter((row) => (mapping.facet ? row[mapping.facet] || "All" : "All") === facet && row[mapping.subject]?.trim());
            const requiredGroups = [...new Set(facetRows.map((row) => row[mapping.group] || "All"))].sort();
            if (requiredGroups.length < 2) {
              errors.push(`${mapping.facet ? `${facet}: ` : ""}Paired lines require at least two groups.`);
              continue;
            }
            const subjects = [...new Set(facetRows.map((row) => row[mapping.subject]))];
            for (const subject of subjects) {
              const observedGroups = [...new Set(facetRows.filter((row) => row[mapping.subject] === subject).map((row) => row[mapping.group] || "All"))].sort();
              if (observedGroups.length !== requiredGroups.length || observedGroups.some((group, index) => group !== requiredGroups[index])) {
                errors.push(`${mapping.facet ? `${facet}: ` : ""}Subject ${subject} is missing one or more paired groups; every subject must have the same group set within a facet.`);
              }
            }
          }
        }
      }
      if (settings.distributionShowSignificance) {
        if (!mapping.pValue) errors.push("Map a Group P value column before displaying significance labels.");
        else {
          const invalidP = dataset.rows.filter((row) => {
            const value = parseNumericValue(row[mapping.pValue]);
            return value === null || value <= 0 || value > 1;
          }).length;
          if (invalidP > 0) errors.push(`Facet / comparison P value contains ${invalidP} value${invalidP === 1 ? "" : "s"} outside (0, 1].`);
          const facetValues = new Map<string, Set<number>>();
          dataset.rows.forEach((row) => { const value = parseNumericValue(row[mapping.pValue]); if (value === null) return; const facet = mapping.facet ? row[mapping.facet] || "All" : "All"; const values = facetValues.get(facet) ?? new Set<number>(); values.add(value); facetValues.set(facet, values); });
          if ([...facetValues.values()].some((values) => values.size > 1)) errors.push("Each facet must supply one consistent comparison P value.");
        }
      }
      if (settings.boxErrorType !== "none") {
        const insufficient = lanes.filter((lane) => lane.values.length < 2).map((lane) => mapping.facet ? `${lane.facet} / ${lane.group}` : lane.group);
        if (insufficient.length > 0) errors.push(`Uncertainty requires at least two observations in every facet × group lane; insufficient: ${insufficient.join(", ")}.`);
      }
    }
  }

  if (definition.id === "ma" && mapping.mean) {
    const invalidMean = dataset.rows.filter((row) => (parseNumericValue(row[mapping.mean]) ?? 0) <= 0).length;
    if (invalidMean > 0) errors.push(`Mean expression contains ${invalidMean} non-positive value${invalidMean === 1 ? "" : "s"}; MA plots require positive abundance.`);
  }

  if (definition.id === "gsea" && mapping.hit) {
    const invalidHits = dataset.rows.filter((row) => ![0, 1].includes(parseNumericValue(row[mapping.hit]) ?? Number.NaN)).length;
    if (invalidHits > 0) errors.push(`Gene-set hit contains ${invalidHits} value${invalidHits === 1 ? "" : "s"} other than 0 or 1.`);
  }

  if (definition.id === "km") {
    const invalidEvents = dataset.rows.filter((row) => ![0, 1].includes(parseNumericValue(row[mapping.event]) ?? Number.NaN)).length;
    const invalidTimes = dataset.rows.filter((row) => (parseNumericValue(row[mapping.time]) ?? -1) < 0).length;
    if (invalidEvents > 0) errors.push(`Event contains ${invalidEvents} value${invalidEvents === 1 ? "" : "s"} other than 0 or 1.`);
    if (invalidTimes > 0) errors.push(`Follow-up time contains ${invalidTimes} negative value${invalidTimes === 1 ? "" : "s"}.`);
  }

  if (definition.id === "roc" && (settings?.rocInputMode ?? "raw") === "raw" && mapping.truth) {
    const invalidTruth = dataset.rows.filter((row) => ![0, 1].includes(parseNumericValue(row[mapping.truth]) ?? Number.NaN)).length;
    if (invalidTruth > 0) errors.push(`True class contains ${invalidTruth} value${invalidTruth === 1 ? "" : "s"} other than 0 or 1.`);
    const groups = [...new Set(dataset.rows.map((row) => mapping.group ? row[mapping.group] || "Model" : "Model"))];
    if (invalidTruth === 0) groups.forEach((group) => {
      const classes = new Set(dataset.rows.filter((row) => (mapping.group ? row[mapping.group] || "Model" : "Model") === group).map((row) => parseNumericValue(row[mapping.truth])));
      if (classes.size < 2) errors.push(groups.length === 1 ? "ROC calculation requires both outcome classes (0 and 1)." : `ROC model “${group}” requires both outcome classes (0 and 1).`);
    });
    warnings.push("ROC/AUC describe discrimination in the supplied predictions. They are not evidence of calibration, clinical utility, or external validation.");
  }
  if (definition.id === "roc" && settings) {
    if ((settings.xMin !== null && settings.xMin > 0) || (settings.xMax !== null && settings.xMax < 1) || (settings.yMin !== null && settings.yMin > 0) || (settings.yMax !== null && settings.yMax < 1)) errors.push("ROC manual axis limits must contain the full [0, 1] false-positive and true-positive range so curve endpoints and confidence bands are not clipped.");
  }

  if (definition.id === "roc" && settings?.rocInputMode === "precomputed-time" && mapping.fpr && mapping.tpr) {
    const probabilityRoles = ["fpr", "tpr", "tprLower", "tprUpper", "auc", "aucLower", "aucUpper"] as const;
    probabilityRoles.forEach((role) => {
      if (!mapping[role]) return;
      const invalid = dataset.rows.filter((row) => { const value = parseNumericValue(row[mapping[role]]); return value === null || value < 0 || value > 1; }).length;
      if (invalid > 0) errors.push(`${role} contains ${invalid} value${invalid === 1 ? "" : "s"} outside [0, 1].`);
    });
    const invalidHorizon = mapping.horizon ? dataset.rows.filter((row) => (parseNumericValue(row[mapping.horizon]) ?? 0) <= 0).length : 0;
    if (invalidHorizon > 0) errors.push(`Evaluation horizon contains ${invalidHorizon} non-positive or missing value${invalidHorizon === 1 ? "" : "s"}.`);
    const curveKeys = new Set(dataset.rows.map((row) => `${mapping.group ? row[mapping.group] || "Model" : "Model"}\u0000${parseNumericValue(row[mapping.horizon])}`));
    const maximumCurves = settings.legendPosition === "bottom" ? 4 : settings.legendPosition === "right" ? Math.max(2, Math.floor((settings.height - (settings.title ? 48 : 24) - 58) / (settings.legendSize * 2 + 11))) : 12;
    if (curveKeys.size > maximumCurves) errors.push(`The ${settings.legendPosition} time-dependent ROC layout can display ${maximumCurves} model × horizon curves at this height; reduce curves, hide the legend, or increase height.`);
    curveKeys.forEach((key) => {
      const [group, horizon] = key.split("\u0000");
      const numericHorizon = Number(horizon);
      const rows = dataset.rows.filter((row) => (mapping.group ? row[mapping.group] || "Model" : "Model") === group && parseNumericValue(row[mapping.horizon]) === numericHorizon).sort((a, b) => (parseNumericValue(a[mapping.fpr]) ?? 0) - (parseNumericValue(b[mapping.fpr]) ?? 0));
      const monotone = rows.every((row, index) => index === 0 || (parseNumericValue(row[mapping.tpr]) ?? 0) >= (parseNumericValue(rows[index - 1][mapping.tpr]) ?? 0));
      const startsAtOrigin = (parseNumericValue(rows[0]?.[mapping.fpr]) ?? -1) === 0 && (parseNumericValue(rows[0]?.[mapping.tpr]) ?? -1) === 0;
      const endsAtOne = (parseNumericValue(rows.at(-1)?.[mapping.fpr]) ?? -1) === 1 && (parseNumericValue(rows.at(-1)?.[mapping.tpr]) ?? -1) === 1;
      if (!monotone || !startsAtOrigin || !endsAtOne) errors.push(`ROC curve “${group} · ${horizon}” must be monotone and include (0,0) and (1,1).`);
      const invalidIntervals = rows.filter((row) => {
        const tpr = parseNumericValue(row[mapping.tpr]); const lower = parseNumericValue(row[mapping.tprLower]); const upper = parseNumericValue(row[mapping.tprUpper]);
        const auc = parseNumericValue(row[mapping.auc]); const aucLower = parseNumericValue(row[mapping.aucLower]); const aucUpper = parseNumericValue(row[mapping.aucUpper]);
        return tpr === null || lower === null || upper === null || lower > tpr || tpr > upper || auc === null || aucLower === null || aucUpper === null || aucLower > auc || auc > aucUpper;
      }).length;
      if (invalidIntervals > 0) errors.push(`ROC curve “${group} · ${horizon}” has ${invalidIntervals} unordered TPR or AUC confidence interval row${invalidIntervals === 1 ? "" : "s"}.`);
      const aucTriples = new Set(rows.map((row) => [mapping.auc, mapping.aucLower, mapping.aucUpper].map((role) => row[role]).join("\u0000")));
      if (aucTriples.size !== 1) errors.push(`ROC curve “${group} · ${horizon}” must repeat one consistent AUC and confidence interval across its coordinates.`);
    });
    warnings.push("Time-dependent ROC estimates are displayed as supplied. Document the censoring method, evaluation cohort, prediction horizon, and uncertainty procedure in the upstream analysis.");
  }

  if (["precision-recall", "calibration", "decision-curve", "risk-score"].includes(definition.id) && mapping.truth) {
    const invalidTruth = dataset.rows.filter((row) => ![0, 1].includes(parseNumericValue(row[mapping.truth]) ?? Number.NaN)).length;
    if (invalidTruth > 0) errors.push(`Observed outcome contains ${invalidTruth} value${invalidTruth === 1 ? "" : "s"} other than 0 or 1.`);
    const groups = [...new Set(dataset.rows.map((row) => mapping.group ? row[mapping.group] || "Model" : "Model"))];
    if (invalidTruth === 0) groups.forEach((group) => {
      const classes = new Set(dataset.rows.filter((row) => (mapping.group ? row[mapping.group] || "Model" : "Model") === group).map((row) => parseNumericValue(row[mapping.truth])));
      if (classes.size < 2) errors.push(`${definition.name} model “${group}” requires both observed outcome classes (0 and 1).`);
    });
    if (["calibration", "decision-curve"].includes(definition.id) && mapping.score) {
      const outside = dataset.rows.filter((row) => { const value = parseNumericValue(row[mapping.score]); return value === null || value < 0 || value > 1; }).length;
      if (outside > 0) errors.push(`Predicted probability contains ${outside} value${outside === 1 ? "" : "s"} outside [0, 1].`);
    }
  }
  if (settings && ["precision-recall", "calibration", "decision-curve"].includes(definition.id)) {
    const groups = new Set(dataset.rows.map((row) => mapping.group ? row[mapping.group] || "Model" : "Model"));
    const plotHeight = Math.max(90, settings.height - (settings.title ? 48 : 24) - 58);
    const maximumModels = Math.max(2, Math.min(12, Math.floor(plotHeight * 0.35 / (settings.legendSize + 4))));
    if (groups.size > maximumModels) errors.push(`${definition.name} can display ${maximumModels} model labels in this compact ${settings.height}px-high figure; reduce models or increase height.`);
    if (definition.id === "calibration") groups.forEach((group) => {
      const count = dataset.rows.filter((row) => (mapping.group ? row[mapping.group] || "Model" : "Model") === group).length;
      if (count < 20) warnings.push(`Calibration model “${group}” has only ${count} observations; grouped observed proportions and Wilson intervals will be unstable.`);
    });
  }
  if (definition.id === "decision-curve" && mapping.group) {
    const groups = [...new Set(dataset.rows.map((row) => row[mapping.group] || "Model"))];
    if (groups.length > 1) {
      if (!mapping.subject) errors.push("Multi-model decision curves require a Subject ID column so every model can be verified on the same cohort and outcomes.");
      else {
        const expectedGroups = [...groups].sort(); const subjectRows = new Map<string, typeof dataset.rows>();
        const blankSubjects = dataset.rows.filter((row) => !row[mapping.subject]?.trim()).length;
        if (blankSubjects > 0) errors.push(`Decision-curve Subject ID contains ${blankSubjects} blank value${blankSubjects === 1 ? "" : "s"}; every prediction must identify its subject.`);
        dataset.rows.forEach((row) => { const subject = row[mapping.subject]; const rows = subjectRows.get(subject) ?? []; rows.push(row); subjectRows.set(subject, rows); });
        subjectRows.forEach((rows, subject) => {
          const observedGroups = [...new Set(rows.map((row) => row[mapping.group] || "Model"))].sort(); const truths = new Set(rows.map((row) => parseNumericValue(row[mapping.truth])));
          if (observedGroups.length !== expectedGroups.length || observedGroups.some((group, index) => group !== expectedGroups[index]) || rows.length !== expectedGroups.length) errors.push(`Subject “${subject || "(blank)"}” must have exactly one prediction from every decision-curve model.`);
          if (truths.size !== 1) errors.push(`Subject “${subject}” has inconsistent observed outcomes across decision-curve models.`);
        });
      }
    }
  }

  if (definition.id === "funnel" && mapping.error) {
    const invalid = dataset.rows.filter((row) => (parseNumericValue(row[mapping.error]) ?? 0) <= 0).length;
    if (invalid > 0) errors.push(`Standard error must be strictly positive in every study; invalid rows: ${invalid}.`);
  }
  if (definition.id === "calibration" && settings && (!Number.isInteger(settings.calibrationBinCount) || settings.calibrationBinCount < 3 || settings.calibrationBinCount > 15)) errors.push("Calibration equal-frequency bins must be an integer from 3 to 15.");
  if (definition.id === "decision-curve" && settings) {
    const { decisionThresholdMinimum: minimum, decisionThresholdMaximum: maximum, decisionThresholdStep: step } = settings;
    if (![minimum, maximum, step].every(Number.isFinite) || minimum <= 0 || minimum >= maximum || maximum >= 1) errors.push("Decision-curve thresholds must satisfy 0 < minimum < maximum < 1.");
    if (!Number.isFinite(step) || step < 0.005 || step > 0.05) errors.push("Decision-curve grid resolution must be between 0.005 and 0.05.");
    const gridCount = Number.isFinite(step) && step > 0 ? Math.ceil((maximum - minimum) / step) + 1 : Number.POSITIVE_INFINITY;
    if (gridCount < 5 || gridCount > 200) errors.push(`Decision-curve threshold grid contains ${Number.isFinite(gridCount) ? gridCount : "an invalid number of"} points; choose 5–200 points by adjusting the interval or resolution.`);
  }
  if (definition.id === "lasso-path" && mapping.x) {
    const invalid = dataset.rows.filter((row) => (parseNumericValue(row[mapping.x]) ?? 0) <= 0).length;
    if (invalid > 0) errors.push(`LASSO lambda must be strictly positive before the log₁₀ transform; invalid rows: ${invalid}.`);
    const features = new Set(dataset.rows.map((row) => row[mapping.group]));
    if (features.size > 12) errors.push("The compact LASSO path view supports at most 12 identified coefficient paths; filter to interpretable features or increase upstream sparsity.");
    if (settings) {
      const plotHeight = Math.max(90, settings.height - (settings.title ? 48 : 24) - 58);
      const labelFont = Math.max(8, settings.legendSize - 1); const labelStep = labelFont + 3;
      const maximumLabels = Math.max(1, Math.floor((plotHeight - labelFont - 4) / labelStep) + 1);
      if (features.size > maximumLabels) errors.push(`LASSO labels need more vertical space at ${settings.legendSize} pt: ${features.size} paths supplied, ${maximumLabels} fit without overlap. Increase height, reduce legend size, or filter features.`);
    }
    const referenceGrid = new Set<number>(); let referenceFeature = "";
    features.forEach((feature) => {
      const rows = dataset.rows.filter((row) => row[mapping.group] === feature); const byLambda = new Map<number, number[]>();
      rows.forEach((row) => { const lambda = parseNumericValue(row[mapping.x]); const coefficient = parseNumericValue(row[mapping.y]); if (lambda === null || coefficient === null) return; const values = byLambda.get(lambda) ?? []; values.push(coefficient); byLambda.set(lambda, values); });
      if (byLambda.size < 2) errors.push(`LASSO feature “${feature}” requires at least two unique lambda values to form a path.`);
      byLambda.forEach((coefficients, lambda) => { if (coefficients.length !== 1) errors.push(`LASSO feature “${feature}” has ${coefficients.length} rows at lambda ${lambda}; each feature × lambda pair must be unique.`); });
      const grid = new Set(byLambda.keys());
      if (!referenceFeature) { referenceFeature = feature; grid.forEach((lambda) => referenceGrid.add(lambda)); }
      else if (grid.size !== referenceGrid.size || [...grid].some((lambda) => !referenceGrid.has(lambda))) errors.push(`LASSO feature “${feature}” does not use the same lambda grid as “${referenceFeature}”.`);
    });
  }
  if (definition.id === "nomogram" && mapping.value) {
    const invalid = dataset.rows.filter((row) => (parseNumericValue(row[mapping.value]) ?? -1) < 0).length;
    if (invalid > 0) errors.push(`Nomogram points must be non-negative; invalid rows: ${invalid}.`);
    if (settings) {
      const predictors = new Set(dataset.rows.map((row) => row[mapping.group]));
      const plotHeight = Math.max(90, settings.height - (settings.title ? 48 : 24) - 58);
      const maximumPredictors = Math.max(2, Math.floor(plotHeight / Math.max(settings.tickSize + 9, settings.pointSize * 1.1 + 9)));
      if (predictors.size > maximumPredictors) errors.push(`Nomogram predictor rows need more vertical space: ${predictors.size} supplied, ${maximumPredictors} fit at the current height and text size.`);
      const maximum = Math.max(...dataset.rows.map((row) => parseNumericValue(row[mapping.value]) ?? 0), 1); const scaleEnd = maximum * 1.03; const laneWidth = Math.max(30, Math.max(100, settings.width - 88) - 70); const labelFont = Math.max(7, settings.tickSize - 2);
      predictors.forEach((predictor) => {
        const levels = dataset.rows.filter((row) => row[mapping.group] === predictor).map((row) => { const label = compactLegendLabel(row[mapping.label], labelFont, 42, 10); const width = estimateLegendTextWidth(label, labelFont); const pointX = (parseNumericValue(row[mapping.value]) ?? 0) / scaleEnd * laneWidth; const x = Math.min(laneWidth - width / 2 - 2, Math.max(width / 2 + 2, pointX)); return { label, fullLabel: row[mapping.label], x, width }; }).sort((left, right) => left.x - right.x);
        for (let index = 1; index < levels.length; index += 1) if (levels[index].x - levels[index - 1].x < (levels[index].width + levels[index - 1].width) / 2 + 4) { errors.push(`Nomogram levels “${levels[index - 1].fullLabel}” and “${levels[index].fullLabel}” overlap within predictor “${predictor}” at the current width; increase width or supply separated point assignments.`); break; }
      });
    }
  }
  if (definition.id === "km-cutoff") {
    const invalidEvents = dataset.rows.filter((row) => ![0, 1].includes(parseNumericValue(row[mapping.event]) ?? Number.NaN)).length;
    const invalidTimes = dataset.rows.filter((row) => (parseNumericValue(row[mapping.time]) ?? -1) < 0).length;
    if (invalidEvents > 0) errors.push(`Event contains ${invalidEvents} value${invalidEvents === 1 ? "" : "s"} other than 0 or 1.`);
    if (invalidTimes > 0) errors.push(`Follow-up time contains ${invalidTimes} negative or missing value${invalidTimes === 1 ? "" : "s"}.`);
    const cutoffs = new Set(dataset.rows.map((row) => parseNumericValue(row[mapping.cutoff])));
    if (cutoffs.size !== 1 || cutoffs.has(null)) errors.push("Cutoff KM requires one constant numeric cutoff repeated across all rows.");
    const cutoff = [...cutoffs][0];
    if (typeof cutoff === "number" && mapping.score) {
      const low = dataset.rows.filter((row) => (parseNumericValue(row[mapping.score]) ?? cutoff) < cutoff).length; const high = dataset.rows.length - low;
      if (low < 2 || high < 2) errors.push("The supplied cutoff must create two groups with at least two subjects each.");
    }
    warnings.push("Cutoff KM displays a supplied threshold only. If the cutoff was optimized and evaluated in the same cohort, treat the separation as exploratory and validate it independently.");
  }
  if (definition.id === "risk-score" && settings) {
    const subjects = dataset.rows.map((row) => row[mapping.label]?.trim()); const blankSubjects = subjects.filter((subject) => !subject).length; const duplicateSubjects = subjects.filter((subject, index) => Boolean(subject) && subjects.indexOf(subject) !== index);
    if (blankSubjects > 0) errors.push(`Risk-score Subject contains ${blankSubjects} blank identifier${blankSubjects === 1 ? "" : "s"}.`);
    if (duplicateSubjects.length > 0) errors.push(`Risk-score Subject IDs must be unique; duplicated: ${[...new Set(duplicateSubjects)].slice(0, 8).join(", ")}.`);
    const plotWidth = Math.max(100, settings.width - 88);
    const minimumSubjectSpacing = Math.max(2.5, settings.pointSize * 0.7);
    const maximumSubjects = Math.max(10, Math.floor(plotWidth / minimumSubjectSpacing));
    if (dataset.rows.length > maximumSubjects) errors.push(`Risk-score marks would overlap at ${settings.width}px: ${dataset.rows.length} subjects supplied, ${maximumSubjects} fit at the current point size. Increase width or reduce point size.`);
  }

  if (definition.id === "survival-forest") {
    const invalidIntervals = dataset.rows.filter((row) => {
      const estimate = parseNumericValue(row[mapping.estimate]);
      const lower = parseNumericValue(row[mapping.lower]);
      const upper = parseNumericValue(row[mapping.upper]);
      return estimate === null || lower === null || upper === null || lower > estimate || estimate > upper;
    }).length;
    if (invalidIntervals > 0) errors.push(`${invalidIntervals} confidence interval${invalidIntervals === 1 ? " is" : "s are"} not ordered lower ≤ estimate ≤ upper.`);
  }

  if ((definition.id === "venn" || definition.id === "upset") && mapping.set) {
    const requestedMode = settings?.setInputMode ?? "auto";
    const analysis = analyzeSetIntersections(dataset.rows, mapping, requestedMode);
    if (analysis.safetyError) errors.push(analysis.safetyError);
    if (analysis.mode === "membership" && !mapping.item) errors.push("Item ID must be mapped for item–set membership input.");
    if (analysis.mode === "peak-overlap") {
      const missingIntervalRoles = ["chromosome", "start", "end"].filter((role) => !mapping[role]);
      if (missingIntervalRoles.length > 0) errors.push(`Peak-overlap input requires chromosome, start, and end mappings; missing ${missingIntervalRoles.join(", ")}.`);
      if (!analysis.safetyError && analysis.invalidRows.length === 0) warnings.push("Peak overlaps use half-open intervals [start, end). Counts refer to disjoint atomic genomic segments over which the active set combination is constant; they are segment counts, not base-pair totals or original peak counts.");
    }
    if (analysis.invalidRows.length > 0) errors.push(`${analysis.invalidRows.length} set row${analysis.invalidRows.length === 1 ? " is" : "s are"} incomplete or invalid (rows ${analysis.invalidRows.slice(0, 8).join(", ")}${analysis.invalidRows.length > 8 ? ", …" : ""}).`);
    if (!analysis.safetyError && analysis.memberships.size < 1) errors.push("No valid set members or atomic genomic segments were detected.");
    if (analysis.duplicatesCollapsed > 0) warnings.push(`${analysis.duplicatesCollapsed} duplicate record${analysis.duplicatesCollapsed === 1 ? " was" : "s were"} collapsed before exact intersections were counted.`);
    const setCount = analysis.sets.length;
    if (definition.id === "venn") {
      if (setCount < 2 || setCount > 7) errors.push(`Venn/radial intersection diagrams require 2–7 unique sets; detected ${setCount}. Use UpSet for larger collections.`);
      const requestedLayout = settings?.vennLayout ?? "auto";
      if (requestedLayout === "classic" && setCount > 3) errors.push("Classic circle Venn layout supports 2–3 sets; choose Auto or Radial exact intersections for 4–7 sets.");
      const useRadial = requestedLayout === "radial" || (requestedLayout === "auto" && setCount > 3);
      if (useRadial && settings) {
        const layout = setDiagramLayoutMetrics(settings.width, settings.height, analysis, settings.tickSize, settings.vennProportional);
        if (!layout.fits) errors.push(`The ${analysis.intersections.length} observed exact regions need at least ${layout.minimumLabelArc.toFixed(1)} px each, but the smallest radial region has ${layout.minimumArc.toFixed(1)} px; increase figure size, turn off size weighting, filter the data, or use UpSet.`);
      }
      if (settings?.vennProportional) warnings.push("Size weighting is a visual cue, not an area-proportional Venn fit; printed numbers remain the authoritative exact-intersection counts.");
    } else {
      if (setCount < 2 || setCount > 20) errors.push(`UpSet supports 2–20 sets in the compact studio; detected ${setCount}.`);
      if (settings) {
        const left = Math.min(178, settings.width * 0.32);
        const top = settings.title ? 48 : 24;
        const plotWidth = Math.max(100, settings.width - left - 22);
        const plotHeight = Math.max(90, settings.height - top - 58);
        const visibleIntersections = Math.max(1, Math.min(settings.upsetMaxIntersections, analysis.intersections.length, Math.floor(plotWidth / 24)));
        const layout = upsetAdaptiveLayout(top, plotHeight, setCount, visibleIntersections, plotWidth, settings.tickSize);
        if (!layout.fits) errors.push(`The UpSet matrix cannot keep ${setCount} set rows and ${visibleIntersections} intersections legible at ${settings.width} × ${settings.height} px; increase the figure size, reduce sets, or show fewer intersections.`);
      }
    }
  }

  const explicitNetworkTypes: NetworkPlotType[] = ["network", "ppi", "cerna", "mirna-target", "cnet", "enrichment-map"];
  if (explicitNetworkTypes.includes(definition.id as NetworkPlotType)) {
    const type = definition.id as NetworkPlotType;
    const parsed = parseNetworkRecords(type, dataset.rows, mapping);
    if (parsed.invalidRecordTypes.length > 0) errors.push(`Record type must be node or edge; invalid rows: ${parsed.invalidRecordTypes.slice(0, 8).join(", ")}.`);
    if (parsed.incompleteRows.length > 0) errors.push(`Node rows need a Node ID and edge rows need both Source and Target; incomplete rows: ${parsed.incompleteRows.slice(0, 8).join(", ")}.`);
    if (parsed.invalidWeights.length > 0) errors.push(`Edge weight must be a non-negative number when supplied; invalid rows: ${parsed.invalidWeights.slice(0, 8).join(", ")}.`);
    if (parsed.missingWeights.length > 0) errors.push(`Edge weight is mapped, so every edge row needs a numeric weight; missing rows: ${parsed.missingWeights.slice(0, 8).join(", ")}. Unmap Weight for a truly unweighted network.`);
    if (parsed.invalidDirections.length > 0) errors.push(`Direction must be directed, undirected, or bidirectional; invalid rows: ${parsed.invalidDirections.slice(0, 8).join(", ")}.`);
    if (parsed.invalidSigns.length > 0) errors.push(`Sign must be positive, negative, or neutral; invalid rows: ${parsed.invalidSigns.slice(0, 8).join(", ")}.`);
    if (mapping.nodeValue) {
      const negativeNodeValues = dataset.rows.filter((row) => row[mapping.recordType]?.trim().toLowerCase() === "node" && row[mapping.nodeValue]?.trim() && (parseNumericValue(row[mapping.nodeValue]) ?? -1) < 0).length;
      if (negativeNodeValues > 0) errors.push(`Node value contains ${negativeNodeValues} negative value${negativeNodeValues === 1 ? "" : "s"}; node size requires a non-negative magnitude.`);
      if (parsed.invalidNodeValues.length > 0) errors.push(`Node value is mapped but contains non-numeric values in rows: ${parsed.invalidNodeValues.slice(0, 8).join(", ")}.`);
      if (parsed.missingNodeValues.length > 0) errors.push(`Node value is mapped, so every node row needs a numeric value; missing rows: ${parsed.missingNodeValues.slice(0, 8).join(", ")}. Unmap Node value to size nodes by degree.`);
    }
    const implicitNodes = parsed.nodes.filter((node) => !node.explicit).map((node) => node.id);
    if (implicitNodes.length > 0) errors.push(`Every edge endpoint needs one explicit node record so node grouping/type and isolated nodes are reproducible; missing records: ${implicitNodes.slice(0, 8).join(", ")}.`);
    const nodeRows = dataset.rows.filter((row) => row[mapping.recordType]?.trim().toLowerCase() === "node");
    const nodeIds = nodeRows.map((row) => row[mapping.node]?.trim()).filter(Boolean);
    const duplicateNodes = [...new Set(nodeIds.filter((id, index) => nodeIds.indexOf(id) !== index))];
    if (duplicateNodes.length > 0) errors.push(`Node IDs must be unique; duplicates: ${duplicateNodes.slice(0, 8).join(", ")}.`);
    if (parsed.nodes.length < 2) errors.push("A relationship view needs at least two explicit nodes.");
    if (parsed.edges.length < 1) errors.push("A relationship view needs at least one valid edge; use a tree for parent–child hierarchy without relationship edges.");
    const selfEdges = parsed.edges.filter((edge) => edge.source === edge.target).length;
    if (selfEdges > 0) warnings.push(`${selfEdges} self-loop${selfEdges === 1 ? " is" : "s are"} retained; confirm that self-regulation/self-interaction is intended.`);
    const normalizeNodeType = (value: string) => value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
    const nodeTypes = new Map(parsed.nodes.map((node) => [node.id, normalizeNodeType(node.nodeType)]));
    const proteinTypes = new Set(["protein"]);
    const miRnaTypes = new Set(["mirna", "micro rna", "microrna"]);
    const nonMiRnaRnaTypes = new Set(["rna", "mrna", "lncrna", "circ rna", "circrna", "sncrna", "rrna", "trna"]);
    const targetTypes = new Set(["mrna", "gene", "target gene", "protein coding gene"]);
    const termTypes = new Set(["term", "enriched term", "pathway", "gene set", "ontology term", "biological process", "molecular function", "cellular component"]);
    const geneTypes = new Set(["gene", "target gene", "protein coding gene"]);
    const isMiRna = (value: string) => miRnaTypes.has(normalizeNodeType(value));
    const isNonMiRnaRna = (value: string) => nonMiRnaRnaTypes.has(normalizeNodeType(value));
    if (type === "ppi") {
      const nonProteins = parsed.nodes.filter((node) => !proteinTypes.has(normalizeNodeType(node.nodeType)));
      if (nonProteins.length > 0) errors.push(`PPI views require every endpoint node to be typed as Protein; invalid nodes: ${nonProteins.slice(0, 8).map((node) => node.id).join(", ")}. Use the general Network module for mixed molecular entities.`);
    }
    if (type === "mirna-target") {
      const invalidEdges = parsed.edges.filter((edge) => {
        const sourceType = nodeTypes.get(edge.source) ?? "";
        const targetType = nodeTypes.get(edge.target) ?? "";
        return edge.direction !== "directed" || !isMiRna(sourceType) || !targetTypes.has(normalizeNodeType(targetType));
      });
      if (invalidEdges.length > 0) errors.push(`${invalidEdges.length} miRNA–target edge${invalidEdges.length === 1 ? " does" : "s do"} not follow the directed miRNA → mRNA/gene target contract.`);
    }
    if (type === "cnet") {
      const invalidMemberships = parsed.edges.filter((edge) => { const pair = [nodeTypes.get(edge.source) ?? "", nodeTypes.get(edge.target) ?? ""]; return edge.direction !== "undirected" || !(pair.some((value) => termTypes.has(value)) && pair.some((value) => geneTypes.has(value))); }).length;
      if (invalidMemberships > 0) errors.push(`${invalidMemberships} Cnet edge${invalidMemberships === 1 ? " is" : "s are"} not a term–gene membership; type one endpoint as enriched term and the other as gene.`);
    }
    if (type === "enrichment-map") {
      if (!mapping.weight) errors.push("Enrichment maps require a mapped Weight column containing an explicit overlap/similarity score for every edge.");
      const invalidSimilarity = parsed.edges.filter((edge) => edge.weight > 1).length;
      if (invalidSimilarity > 0) errors.push(`${invalidSimilarity} enrichment-map similarity weight${invalidSimilarity === 1 ? " is" : "s are"} above 1; use a documented overlap/similarity proportion in [0, 1].`);
      const nonTerms = parsed.nodes.filter((node) => !termTypes.has(normalizeNodeType(node.nodeType)));
      const directedEdges = parsed.edges.filter((edge) => edge.direction !== "undirected").length;
      if (nonTerms.length > 0) errors.push(`Enrichment maps require term nodes only; invalid nodes: ${nonTerms.slice(0, 8).map((node) => node.id).join(", ")}.`);
      if (directedEdges > 0) errors.push(`${directedEdges} enrichment-map edge${directedEdges === 1 ? " is" : "s are"} directed; term similarity/overlap edges must be undirected.`);
    }
    if (type === "cerna") {
      const nonRnaNodes = parsed.nodes.filter((node) => !isMiRna(node.nodeType) && !isNonMiRnaRna(node.nodeType));
      const invalidEdges = parsed.edges.filter((edge) => {
        const sourceType = nodeTypes.get(edge.source) ?? "";
        const targetType = nodeTypes.get(edge.target) ?? "";
        return edge.direction !== "directed" || !((isMiRna(sourceType) && isNonMiRnaRna(targetType)) || (isNonMiRnaRna(sourceType) && isMiRna(targetType)));
      });
      if (nonRnaNodes.length > 0) errors.push(`ceRNA views accept typed RNA entities only; invalid nodes: ${nonRnaNodes.slice(0, 8).map((node) => node.id).join(", ")}.`);
      if (invalidEdges.length > 0) errors.push(`${invalidEdges.length} ceRNA edge${invalidEdges.length === 1 ? " does" : "s do"} not follow a directed miRNA ↔ non-miRNA RNA binding/target step. Use the general Network module for other relationships.`);
    }
    if (settings) {
      if (!Number.isInteger(settings.networkSeed) || settings.networkSeed < 0 || settings.networkSeed > 1_000_000_000) errors.push("Network layout seed must be an integer from 0 to 1,000,000,000.");
      const visibleNodes = settings.networkShowIsolates ? parsed.nodes : parsed.nodes.filter((node) => parsed.edges.some((edge) => edge.source === node.id || edge.target === node.id));
      const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
      const visibleEdges = parsed.edges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));
      const visibleGroups = new Set(visibleNodes.map((node) => node.group));
      const visibleEdgeTypes = new Set(visibleEdges.map((edge) => edge.edgeType));
      const visibleSigns = new Set(visibleEdges.map((edge) => edge.sign));
      const visibleDirections = new Set(visibleEdges.map((edge) => edge.direction));
      if (visibleGroups.size > 8 && settings.legendPosition !== "none") errors.push(`The compact network legend supports at most eight visible node groups; detected ${visibleGroups.size}. Filter/facet groups or intentionally hide the legend.`);
      if (visibleEdgeTypes.size > 4 && settings.legendPosition !== "none") errors.push(`The compact network legend supports at most four visible edge types; detected ${visibleEdgeTypes.size}. Filter edge types or intentionally hide the legend.`);
      const layout = networkLayoutMetrics(settings, visibleNodes, visibleEdges, Boolean(mapping.nodeValue), Boolean(mapping.weight));
      const labelIssues = layout.labelCollisionCount + layout.labelNodeCollisionCount + layout.labelsOutsidePlot;
      const boundaryIssues = layout.nodesOutsidePlot + layout.edgeBoundaryIssues;
      if (!layout.fits) errors.push(`The current ${settings.networkLayout} layout is not pixel-safe (${visibleNodes.length} nodes, ${visibleEdges.length} edges, ${layout.nodeCollisionCount} node collision${layout.nodeCollisionCount === 1 ? "" : "s"}, ${labelIssues} label issue${labelIssues === 1 ? "" : "s"}, ${boundaryIssues} node/edge boundary issue${boundaryIssues === 1 ? "" : "s"}, ${layout.duplicateEdgePaths} overlapping edge path${layout.duplicateEdgePaths === 1 ? "" : "s"}). Increase width/height, hide labels, change layout, or filter to at most 120 nodes and 400 edges.`);
      const encodingEntries = networkEncodingLegendEntries(visibleNodes, visibleEdges, Boolean(mapping.nodeValue), Boolean(mapping.weight), settings);
      const legendLabels = encodingEntries.map((entry) => entry.label);
      const legend = networkLegendMetrics(settings, visibleGroups.size, visibleEdgeTypes.size, visibleSigns.size, visibleDirections.size, encodingEntries.length, legendLabels);
      if (!legend.fits) errors.push(`The network legend needs ${legend.requiredHeight.toFixed(0)} px vertically (available ${legend.availableHeight.toFixed(0)} px) and ${legend.requiredCellWidth.toFixed(0)} px per complete entry (available ${legend.cellWidth.toFixed(0)} px). Increase width/height, shorten labels, move the legend, or intentionally hide it.`);
      if (layout.density > 8) warnings.push(`The network averages ${layout.density.toFixed(1)} edges per node; even a valid export may be visually dense, so consider a biologically justified filter or module-level summary.`);
    }
  }

  if (["tree", "dendrogram"].includes(definition.id)) {
    const rows = parseHierarchyRecords(dataset.rows, mapping);
    if (rows.length > 1_000) errors.push("Tree and dendrogram previews are limited to 1,000 hierarchy nodes; prune or aggregate the hierarchy before browser rendering.");
    const ids = rows.map((row) => row.id).filter(Boolean);
    const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
    if (ids.length !== rows.length) errors.push("Hierarchy node IDs must not be blank.");
    if (duplicates.length > 0) errors.push(`Hierarchy node IDs must be unique; duplicates: ${duplicates.slice(0, 8).join(", ")}.`);
    const idSet = new Set(ids);
    const roots = rows.filter((row) => !row.parent);
    if (roots.length !== 1) errors.push(`Hierarchy requires exactly one blank-parent root; detected ${roots.length}.`);
    const missingParents = rows.filter((row) => row.parent && !idSet.has(row.parent));
    if (missingParents.length > 0) errors.push(`${missingParents.length} hierarchy node${missingParents.length === 1 ? " references" : "s reference"} a missing parent.`);
    const selfParents = rows.filter((row) => row.id && row.parent === row.id);
    if (selfParents.length > 0) errors.push(`${selfParents.length} hierarchy node${selfParents.length === 1 ? " is" : "s are"} its own parent.`);
    const children = new Map(rows.map((row) => [row.id, [] as string[]]));
    rows.forEach((row) => { if (row.parent && children.has(row.parent)) children.get(row.parent)!.push(row.id); });
    const state = new Map<string, 0 | 1 | 2>();
    let cycle = false;
    const visit = (id: string) => { if (state.get(id) === 1) { cycle = true; return; } if (state.get(id) === 2) return; state.set(id, 1); (children.get(id) ?? []).forEach(visit); state.set(id, 2); };
    if (roots.length === 1 && rows.length <= 1_000) visit(roots[0].id);
    if (cycle) errors.push("Hierarchy contains a cycle; tree and dendrogram inputs must be acyclic.");
    if (roots.length === 1 && rows.length <= 1_000 && state.size < rows.length && missingParents.length === 0) errors.push(`${rows.length - state.size} hierarchy node${rows.length - state.size === 1 ? " is" : "s are"} disconnected from the root.`);
    const leaves = rows.filter((row) => (children.get(row.id) ?? []).length === 0);
    const depth = (id: string): number => (children.get(id) ?? []).length ? 1 + Math.max(...children.get(id)!.map(depth)) : 0;
    const maximumDepth = roots.length === 1 && !cycle && rows.length <= 1_000 ? depth(roots[0].id) : 0;
    if (definition.id === "dendrogram") {
      const invalidHeights = rows.filter((row) => !Number.isFinite(row.height) || row.height < 0);
      if (invalidHeights.length > 0) errors.push(`${invalidHeights.length} dendrogram height${invalidHeights.length === 1 ? " is" : "s are"} missing, non-numeric, or negative.`);
      const elevatedLeaves = leaves.filter((leaf) => Number.isFinite(leaf.height) && Math.abs(leaf.height) > 1e-9);
      if (elevatedLeaves.length > 0) errors.push(`Dendrogram leaf heights must be zero (tolerance 1e-9); elevated leaves: ${elevatedLeaves.slice(0, 8).map((leaf) => leaf.id).join(", ")}.`);
      const descending = rows.filter((row) => row.parent && Number.isFinite(row.height) && Number.isFinite(rows.find((entry) => entry.id === row.parent)?.height) && (rows.find((entry) => entry.id === row.parent)?.height ?? 0) < row.height);
      if (descending.length > 0) errors.push(`${descending.length} dendrogram branch${descending.length === 1 ? " has" : "es have"} a parent merge height below its child.`);
      if (rows.every((row) => row.height === 0)) errors.push("Dendrogram merge heights cannot all be zero; supply the upstream clustering height/dissimilarity scale.");
      const unary = rows.filter((row) => (children.get(row.id) ?? []).length === 1);
      if (unary.length > 0) warnings.push(`${unary.length} dendrogram internal node${unary.length === 1 ? " has" : "s have"} one child; confirm this is an intentional retained hierarchy rather than an incomplete merge.`);
    }
    const groupCount = new Set(leaves.map((leaf) => leaf.group)).size;
    if (groupCount > 8 && settings?.legendPosition !== "none") errors.push(`The compact hierarchy legend supports at most eight leaf groups; detected ${groupCount}.`);
    if (settings && roots.length === 1 && !cycle) {
      const layout = hierarchyLayoutMetrics(settings, leaves.length, maximumDepth, settings.showLabels);
      if (!layout.fits) errors.push(`The hierarchy does not fit safely (${leaves.length} leaves, depth ${maximumDepth}, ${layout.leafSpacing.toFixed(1)} px/leaf). Increase width/height, hide leaf labels, or filter/prune the hierarchy.`);
      const legend = networkLegendMetrics(settings, groupCount, 0);
      if (!legend.fits) errors.push(`The hierarchy legend needs ${legend.requiredHeight.toFixed(0)} px but only ${legend.availableHeight.toFixed(0)} px are available.`);
    }
  }

  if (["sankey", "chord"].includes(definition.id) && mapping.value) {
    const nonPositiveWeights = dataset.rows.filter((row) => (parseNumericValue(row[mapping.value]) ?? 0) <= 0).length;
    if (nonPositiveWeights > 0) errors.push(`Weight contains ${nonPositiveWeights} missing, zero, or negative value${nonPositiveWeights === 1 ? "" : "s"}; Sankey and Chord flows must be strictly positive.`);
    const flowMapping = definition.id === "chord" ? { ...mapping, group: "" } : mapping;
    const edges = aggregateFlowEdges(dataset.rows, flowMapping);
    const categories = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
    const compactFrame = flowCircularFrame(settings?.width ?? 340, settings?.height ?? 340, Boolean(settings?.title));
    const chordRadius = Math.min(compactFrame.plotWidth, compactFrame.plotHeight) * 0.37;
    const chordLayout = definition.id === "chord" ? chordSectorLayout(edges, chordRadius) : null;
    const layout = flowCircularLayoutMetrics(definition.id as "sankey" | "chord", settings?.width ?? 340, settings?.height ?? 340, definition.id === "chord" ? categories.size : Math.max(new Set(edges.map((edge) => edge.source)).size, new Set(edges.map((edge) => edge.target)).size), 0, { title: Boolean(settings?.title), tickSize: settings?.tickSize, showLabels: settings?.showLabels, minimumSectorPixels: chordLayout?.minimumArcPixels });
    if (!layout.fits) errors.push(`${definition.name} cannot fit ${categories.size} categories safely in the current compact canvas (${layout.spacing.toFixed(1)} px ${layout.reason}); increase the figure size or filter categories.`);
    const aggregated = edges.reduce((sum, edge) => sum + Math.max(0, edge.rows - 1), 0);
    if (aggregated > 0) warnings.push(`${aggregated} repeated flow row${aggregated === 1 ? " was" : "s were"} aggregated by source and target${mapping.group ? ", plus mapped group" : ""}; the preview discloses this aggregation.`);
    if (definition.id === "chord" && edges.some((edge) => edge.source === edge.target)) errors.push("Chord self-loops are not supported in the compact renderer; remove them or represent the diagonal quantity in a separate composition view.");
    if (definition.id === "chord" && settings?.showLabels && chordLayout) {
      const cx = compactFrame.left + compactFrame.plotWidth / 2; const cy = compactFrame.top + compactFrame.plotHeight / 2;
      const candidates = chordLayout.nodes.map((node) => { const sector = chordLayout.sectors.get(node)!; const mid = (sector.start + sector.end) / 2; const x = cx + Math.cos(mid) * (chordRadius + 16); const y = cy + Math.sin(mid) * (chordRadius + 16) + 3; const anchor = Math.cos(mid) > 0.15 ? "start" as const : Math.cos(mid) < -0.15 ? "end" as const : "middle" as const; const available = anchor === "start" ? Math.max(8, compactFrame.width - x - 4) : anchor === "end" ? Math.max(8, x - 4) : Math.max(8, Math.min(x - 4, compactFrame.width - x - 4) * 2); return { label: node, x, y, anchor, available, fontSize: settings.tickSize }; });
      const labels = circularLabelLayoutMetrics(candidates, compactFrame.width, compactFrame.height);
      if (!labels.fits) errors.push(`Chord labels are not collision-safe in the current canvas (${labels.collisions} overlap${labels.collisions === 1 ? "" : "s"}, ${labels.outside} outside); increase size, hide labels, shorten category names, or filter small sectors.`);
    }
    const flowGroups = new Set(edges.map((edge) => edge.group));
    if (definition.id === "sankey" && mapping.group && dataset.rows.some((row) => !row[mapping.group]?.trim())) errors.push("Mapped Sankey group values must be complete; unmap Group to color by source, or supply an explicit group for every flow row.");
    if (definition.id === "sankey" && mapping.group && flowGroups.size > 4) errors.push(`The compact Sankey group legend supports at most four groups; detected ${flowGroups.size}. Filter, combine explicitly as Other, or increase semantic aggregation.`);
    if (dataset.rows.length > 1_000) errors.push("Flow previews are limited to 1,000 input rows before aggregation; pre-aggregate or filter with a documented rule.");
  }

  if (definition.id === "alluvial") {
    const records = parseAlluvialRecords(dataset.rows, mapping);
    const axes = alluvialAxisOrder(records);
    if (axes.length < 2) errors.push("Alluvial input needs at least two ordered axes.");
    const invalid = records.filter((record) => !record.flow || !record.axis || !record.stratum || !Number.isFinite(record.value) || record.value <= 0);
    if (invalid.length > 0) errors.push(`${invalid.length} alluvial row${invalid.length === 1 ? " is" : "s are"} missing a flow ID, axis, stratum, or positive finite weight.`);
    const duplicateFlowAxes = new Set<string>(); const seenFlowAxes = new Set<string>();
    records.forEach((record) => { const key = `${record.flow}\u0000${record.axis}`; if (seenFlowAxes.has(key)) duplicateFlowAxes.add(key); seenFlowAxes.add(key); });
    if (duplicateFlowAxes.size > 0) errors.push(`${duplicateFlowAxes.size} flow–axis pair${duplicateFlowAxes.size === 1 ? " is" : "s are"} duplicated; every flow ID must occupy exactly one stratum per axis.`);
    const flows = [...new Set(records.map((record) => record.flow))];
    const incomplete = flows.filter((flow) => new Set(records.filter((record) => record.flow === flow).map((record) => record.axis)).size !== axes.length);
    if (incomplete.length > 0) errors.push(`${incomplete.length} alluvial flow${incomplete.length === 1 ? " does" : "s do"} not occur on every axis; missing paths cannot be interpreted as conserved flow.`);
    const changing = flows.filter((flow) => new Set(records.filter((record) => record.flow === flow).map((record) => record.value)).size > 1);
    if (changing.length > 0) errors.push(`${changing.length} alluvial flow${changing.length === 1 ? " changes" : "s change"} weight across axes; use a constant cohort weight or split gain/loss into explicit flows.`);
    const changingGroups = mapping.group ? flows.filter((flow) => new Set(records.filter((record) => record.flow === flow).map((record) => record.group)).size > 1) : [];
    if (changingGroups.length > 0) errors.push(`${changingGroups.length} alluvial flow${changingGroups.length === 1 ? " changes" : "s change"} ribbon group across axes; one conserved path must keep one group/color.`);
    if (mapping.group && dataset.rows.some((row) => !row[mapping.group]?.trim())) errors.push("Mapped Alluvial group values must be complete; unmap Ribbon group for one neutral cohort color, or supply a group on every axis row.");
    const alluvialGroups = mapping.group ? new Set(records.map((record) => record.group)) : new Set<string>();
    if (alluvialGroups.size > 4) errors.push(`The compact Alluvial group legend supports at most four groups; detected ${alluvialGroups.size}. Filter or combine groups explicitly.`);
    const maxStrata = Math.max(0, ...axes.map((axis) => new Set(records.filter((record) => record.axis === axis).map((record) => record.stratum)).size));
    const layout = flowCircularLayoutMetrics("alluvial", settings?.width ?? 340, settings?.height ?? 340, maxStrata, axes.length, { title: Boolean(settings?.title), tickSize: settings?.tickSize, showLabels: settings?.showLabels });
    if (!layout.fits) errors.push(`Alluvial layout cannot fit ${axes.length} axes and up to ${maxStrata} strata safely (${layout.spacing.toFixed(1)} px ${layout.reason}); increase the figure size or reduce axes/strata.`);
    if (dataset.rows.length > 1_500) errors.push("Alluvial previews are limited to 1,500 rows; aggregate cohorts before rendering.");
  }

  if (definition.id === "ligand-receptor") {
    const records = parseLigandReceptorRecords(dataset.rows, mapping);
    const invalid = records.filter((record) => !record.sourceCell || !record.targetCell || !record.ligand || !record.receptor || !record.evidence || !Number.isFinite(record.value) || record.value <= 0);
    if (invalid.length > 0) errors.push(`${invalid.length} ligand–receptor row${invalid.length === 1 ? " is" : "s are"} incomplete; sender, ligand, receptor, receiver, evidence, and a strictly positive finite weight are required.`);
    const maximumLayer = Math.max(0, new Set(records.map((record) => record.sourceCell)).size, new Set(records.map((record) => record.ligand)).size, new Set(records.map((record) => record.receptor)).size, new Set(records.map((record) => record.targetCell)).size);
    const layout = flowCircularLayoutMetrics("ligand-receptor", settings?.width ?? 340, settings?.height ?? 340, maximumLayer, 4, { title: Boolean(settings?.title), tickSize: settings?.tickSize, showLabels: settings?.showLabels });
    if (!layout.fits) errors.push(`Ligand–receptor layout cannot fit ${maximumLayer} entries in its densest layer safely (${layout.spacing.toFixed(1)} px ${layout.reason}); increase height or filter interactions.`);
    if (dataset.rows.length > 400) errors.push("Ligand–receptor previews are limited to 400 supplied interactions; filter by a documented evidence/weight rule.");
  }

  if (definition.id === "circos") {
    const records = parseCircosTrackRecords(dataset.rows, mapping);
    const unknownTypes = [...new Set(dataset.rows.map((row) => row[mapping.recordType]?.trim().toLowerCase() ?? "").filter((type) => !isCircosRecordType(type)))];
    if (unknownTypes.length > 0) errors.push(`Unsupported Circos record type${unknownTypes.length === 1 ? "" : "s"}: ${unknownTypes.slice(0, 8).join(", ")}. Use bar, heatmap, scatter, label, link, fusion, or correlation.`);
    const invalidIntervals = records.filter((record) => !record.chromosome || !Number.isSafeInteger(record.start) || !Number.isSafeInteger(record.end) || record.start < 0 || record.end <= record.start);
    if (invalidIntervals.length > 0) errors.push(`${invalidIntervals.length} Circos row${invalidIntervals.length === 1 ? " has" : "s have"} invalid genomic coordinates; 0 ≤ start < end must use safe integers.`);
    const linkRecords = records.filter((record) => ["link", "fusion", "correlation"].includes(record.type));
    const invalidTargets = linkRecords.filter((record) => !record.targetChromosome || !Number.isSafeInteger(record.targetStart) || !Number.isSafeInteger(record.targetEnd) || record.targetStart < 0 || record.targetEnd <= record.targetStart);
    if (invalidTargets.length > 0) errors.push(`${invalidTargets.length} Circos link/fusion/correlation row${invalidTargets.length === 1 ? " has" : "s have"} invalid or missing target genomic coordinates.`);
    const invalidLengths = records.filter((record) => !Number.isSafeInteger(record.chromosomeLength) || record.chromosomeLength <= 0 || record.end > record.chromosomeLength);
    if (invalidLengths.length > 0) errors.push(`${invalidLengths.length} Circos row${invalidLengths.length === 1 ? " has" : "s have"} an invalid chromosome/contig length or an interval extending beyond it.`);
    const invalidTargetLengths = linkRecords.filter((record) => !Number.isSafeInteger(record.targetChromosomeLength) || record.targetChromosomeLength <= 0 || record.targetEnd > record.targetChromosomeLength);
    if (invalidTargetLengths.length > 0) errors.push(`${invalidTargetLengths.length} Circos link/fusion/correlation row${invalidTargetLengths.length === 1 ? " has" : "s have"} an invalid target chromosome/contig length or an interval extending beyond it.`);
    const declaredLengths = new Map<string, Set<number>>();
    records.forEach((record) => { const source = declaredLengths.get(record.chromosome) ?? new Set<number>(); source.add(record.chromosomeLength); declaredLengths.set(record.chromosome, source); if (record.targetChromosome) { const target = declaredLengths.get(record.targetChromosome) ?? new Set<number>(); target.add(record.targetChromosomeLength); declaredLengths.set(record.targetChromosome, target); } });
    const conflictingLengths = [...declaredLengths.entries()].filter(([, lengths]) => lengths.size > 1).map(([chromosome]) => chromosome);
    if (conflictingLengths.length > 0) errors.push(`Circos chromosome/contig lengths conflict across rows for: ${conflictingLengths.slice(0, 8).join(", ")}. Use one reference build and one explicit length per sequence.`);
    const numericRecords = records.filter((record) => ["bar", "heatmap", "scatter", "link", "fusion", "correlation"].includes(record.type));
    const missingValues = numericRecords.filter((record) => !Number.isFinite(record.value));
    if (missingValues.length > 0) errors.push(`${missingValues.length} numeric Circos record${missingValues.length === 1 ? " is" : "s are"} missing a finite value; values are never imputed.`);
    const nonPositiveWeights = records.filter((record) => ["link", "fusion"].includes(record.type) && Number.isFinite(record.value) && record.value <= 0);
    if (nonPositiveWeights.length > 0) errors.push("Circos link and fusion weights must be strictly positive; correlation is the only signed relationship record.");
    const negativeBars = records.filter((record) => record.type === "bar" && Number.isFinite(record.value) && record.value < 0);
    if (negativeBars.length > 0) errors.push("Circos bar values must be non-negative; use a heatmap track for signed continuous values.");
    const invalidCorrelations = records.filter((record) => record.type === "correlation" && (!Number.isFinite(record.value) || record.value < -1 || record.value > 1));
    if (invalidCorrelations.length > 0) errors.push("Circos correlation values must be finite coefficients in [-1, 1].");
    const zeroCorrelations = records.filter((record) => record.type === "correlation" && record.value === 0).length;
    if (zeroCorrelations > 0) warnings.push(`${zeroCorrelations} zero-correlation record${zeroCorrelations === 1 ? " is" : "s are"} omitted because r = 0 has no visible relationship width.`);
    const axisIntervals = [...declaredLengths.entries()].flatMap(([chromosome, lengths]) => { const length = [...lengths][0]; return Number.isSafeInteger(length) && length > 0 ? [{ chromosome, start: 0, end: length }] : []; });
    if (invalidIntervals.length === 0 && invalidTargets.length === 0 && invalidLengths.length === 0 && invalidTargetLengths.length === 0) {
      const span = genomeAxisSpanMetrics(axisIntervals);
      if (!span.fits) errors.push(`Circos cumulative genomic span exceeds the safe browser limit of ${span.maximumSpan.toExponential(0)} bp; split the view or use a documented rescaled coordinate system.`);
    }
    const coordinates = circosCoordinateSystem(records); const tracks = circosTrackOrder(records);
    const compactFrame = flowCircularFrame(settings?.width ?? 340, settings?.height ?? 340, Boolean(settings?.title));
    const provisionalOuter = Math.min(compactFrame.plotWidth, compactFrame.plotHeight) * 0.39;
    const minimumSectorPixels = coordinates.chromosomes.length ? Math.min(...coordinates.chromosomes.map((chromosome) => { const sector = coordinates.sectors.get(chromosome)!; return (sector.end - sector.start) * provisionalOuter; })) : 0;
    const hasScatter = records.some((record) => record.type === "scatter");
    const layout = flowCircularLayoutMetrics("circos", settings?.width ?? 340, settings?.height ?? 340, coordinates.chromosomes.length, tracks.length, { title: Boolean(settings?.title), trackGap: settings?.genomicTrackGap ?? 4, minimumSectorPixels, pointSize: settings?.pointSize, hasScatter });
    if (!layout.fits) errors.push(`Circos cannot fit ${coordinates.chromosomes.length} chromosomes/contigs and ${tracks.length} concentric tracks safely (${layout.spacing.toFixed(1)} px ${layout.reason}); increase size or reduce tracks.`);
    const mixedNumericTracks = tracks.filter((track) => new Set(records.filter((record) => record.track === track && ["bar", "heatmap", "scatter"].includes(record.type)).map((record) => record.type)).size > 1);
    if (mixedNumericTracks.length > 0) errors.push(`Each Circos numeric track must use one mark type so its scale remains interpretable; mixed tracks: ${mixedNumericTracks.slice(0, 8).join(", ")}.`);
    const numericTrackCount = tracks.filter((track) => records.some((record) => record.track === track && ["bar", "heatmap", "scatter"].includes(record.type))).length;
    const hasCorrelation = records.some((record) => record.type === "correlation");
    if (Math.ceil(numericTrackCount / 2) * 10 + (hasCorrelation ? 18 : 0) > 48) errors.push(`The Circos scale legend cannot fit ${numericTrackCount} numeric tracks${hasCorrelation ? " plus the signed-correlation key" : ""} in the compact footer; reduce tracks or increase figure height.`);
    if (settings?.showLabels && layout.radial) {
      const cx = compactFrame.left + compactFrame.plotWidth / 2; const cy = compactFrame.top + compactFrame.plotHeight / 2; const outer = layout.radial.outer;
      const candidates = coordinates.chromosomes.map((chromosome) => { const sector = coordinates.sectors.get(chromosome)!; const mid = (sector.start + sector.end) / 2; const x = cx + Math.cos(mid) * (outer + 13); const y = cy + Math.sin(mid) * (outer + 13) + 3; const anchor = Math.cos(mid) > 0.16 ? "start" as const : Math.cos(mid) < -0.16 ? "end" as const : "middle" as const; const available = anchor === "start" ? Math.max(8, compactFrame.width - x - 4) : anchor === "end" ? Math.max(8, x - 4) : Math.max(8, Math.min(x - 4, compactFrame.width - x - 4) * 2); return { label: chromosome, x, y, anchor, available, fontSize: Math.max(8, settings.tickSize - 1) }; });
      records.filter((record) => record.type === "label" && record.label).forEach((record) => { const trackIndex = tracks.indexOf(record.track); const radius = Math.max(14, layout.radial!.radii[trackIndex] ?? outer - 17); const middle = (coordinates.angle(record.chromosome, record.start) + coordinates.angle(record.chromosome, record.end)) / 2; candidates.push({ label: record.label, x: cx + Math.cos(middle) * radius, y: cy + Math.sin(middle) * radius - 3, anchor: "middle", available: 42, fontSize: Math.max(7, settings.tickSize - 3) }); });
      const labels = circularLabelLayoutMetrics(candidates, compactFrame.width, compactFrame.height);
      if (!labels.fits) errors.push(`Circos labels are not collision-safe in the current canvas (${labels.collisions} overlap${labels.collisions === 1 ? "" : "s"}, ${labels.outside} outside); increase size, hide labels, or filter/coalesce nearby labels.`);
    }
    const labelCount = records.filter((record) => record.type === "label").length;
    if (labelCount > 24) errors.push(`Circos compact export supports at most 24 label records; detected ${labelCount}. Filter labels or increase semantic aggregation.`);
    if (dataset.rows.length > 2_000) errors.push("Circos browser previews are limited to 2,000 total track records; pre-bin dense tracks using a documented aggregation rule.");
  }

  return { errors: [...new Set(errors)].slice(0, 10), warnings: [...new Set(warnings)].slice(0, 10) };
}

export function groupNumericValues(rows: DelimitedRow[], groupColumn: string, valueColumn: string) {
  const groups = new Map<string, number[]>();
  rows.forEach((row) => {
    const group = row[groupColumn] || "All";
    const value = parseNumericValue(row[valueColumn]);
    if (value === null) return;
    const current = groups.get(group) ?? [];
    current.push(value);
    groups.set(group, current);
  });
  return groups;
}

export function distributionNumericLanes(rows: DelimitedRow[], groupColumn: string, valueColumn: string, facetColumn = "") {
  const lanes = new Map<string, { facet: string; group: string; values: number[] }>();
  rows.forEach((row) => {
    const facet = facetColumn ? row[facetColumn] || "All" : "All";
    const group = row[groupColumn] || "All";
    const value = parseNumericValue(row[valueColumn]);
    if (value === null) return;
    const key = `${facet}\u0000${group}`;
    const lane = lanes.get(key) ?? { facet, group, values: [] };
    lane.values.push(value);
    lanes.set(key, lane);
  });
  return [...lanes.values()];
}

export function quantile(values: number[], probability: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

export function boxStatistics(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const median = quantile(sorted, 0.5);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  const inliers = sorted.filter((value) => value >= lowerFence && value <= upperFence);
  return {
    q1,
    median,
    q3,
    low: inliers[0] ?? sorted[0] ?? 0,
    high: inliers[inliers.length - 1] ?? sorted[sorted.length - 1] ?? 0,
    outliers: sorted.filter((value) => value < lowerFence || value > upperFence),
  };
}

export function meanErrorStatistics(values: number[]) {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return { mean: 0, sd: 0, sem: 0, n: 0 };
  const mean = finite.reduce((sum, value) => sum + value, 0) / finite.length;
  const variance = finite.length > 1
    ? finite.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (finite.length - 1)
    : 0;
  const sd = Math.sqrt(variance);
  return { mean, sd, sem: sd / Math.sqrt(finite.length), n: finite.length };
}

export function confidenceInterval95(values: number[]) {
  const summary = meanErrorStatistics(values);
  if (summary.n < 2) return { mean: summary.mean, lower: summary.mean, upper: summary.mean, margin: 0, n: summary.n };
  const criticalValues = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
  const degreesOfFreedom = summary.n - 1;
  const critical = degreesOfFreedom <= criticalValues.length ? criticalValues[degreesOfFreedom - 1] : studentTCritical95(degreesOfFreedom);
  const margin = critical * summary.sem;
  return { mean: summary.mean, lower: summary.mean - margin, upper: summary.mean + margin, margin, n: summary.n };
}

export function studentTCritical95(degreesOfFreedom: number) {
  if (!Number.isFinite(degreesOfFreedom) || degreesOfFreedom <= 0) return Number.NaN;
  const df = Math.max(1, degreesOfFreedom);
  const z = 1.959963984540054;
  const z2 = z * z;
  const z3 = z2 * z;
  const z5 = z3 * z2;
  const z7 = z5 * z2;
  const z9 = z7 * z2;
  const inverseDf = 1 / df;
  return z
    + (z3 + z) * inverseDf / 4
    + (5 * z5 + 16 * z3 + 3 * z) * inverseDf ** 2 / 96
    + (3 * z7 + 19 * z5 + 17 * z3 - 15 * z) * inverseDf ** 3 / 384
    + (79 * z9 + 776 * z7 + 1482 * z5 - 1920 * z3 - 945 * z) * inverseDf ** 4 / 92160;
}

export function deterministicHistogram(values: number[], requestedBins: number, domain?: [number, number]) {
  const finite = values.filter(Number.isFinite);
  const count = Math.max(3, Math.min(60, Math.round(requestedBins)));
  const automatic = numericExtent(finite);
  const [minimum, maximum] = domain ?? automatic;
  const span = Math.max(maximum - minimum, Number.EPSILON);
  const width = span / count;
  const bins = Array.from({ length: count }, (_, index) => ({
    index,
    lower: minimum + index * width,
    upper: index === count - 1 ? maximum : minimum + (index + 1) * width,
    midpoint: minimum + (index + 0.5) * width,
    count: 0,
  }));
  finite.forEach((value) => {
    if (value < minimum || value > maximum) return;
    const index = value === maximum ? count - 1 : Math.min(count - 1, Math.max(0, Math.floor((value - minimum) / width)));
    bins[index].count += 1;
  });
  return bins;
}

export function deterministicBeeswarmLayout(valuePositions: number[], requestedPointRadius: number, maximumOffset: number) {
  const requestedRadius = Math.max(0.05, requestedPointRadius);
  const limit = Math.max(0, maximumOffset);
  const order = valuePositions.map((valuePosition, index) => ({ valuePosition, index })).sort((left, right) => left.valuePosition - right.valuePosition || left.index - right.index);
  const attempt = (pointRadius: number, gap: number) => {
    const minimumDistance = pointRadius * 2 + gap;
    const candidateStep = Math.max(minimumDistance / 3, Number.EPSILON);
    const candidates = [0];
    for (let distance = candidateStep; distance <= limit + Number.EPSILON; distance += candidateStep) {
      const bounded = Math.min(limit, distance);
      candidates.push(bounded, -bounded);
    }
    const offsets = Array(valuePositions.length).fill(0) as number[];
    const cells = new Map<string, Array<{ valuePosition: number; offset: number }>>();
    const cellAt = (value: number) => Math.floor(value / minimumDistance);
    const clears = (valuePosition: number, offset: number) => {
      const valueCell = cellAt(valuePosition);
      const offsetCell = cellAt(offset);
      for (let valueDelta = -1; valueDelta <= 1; valueDelta += 1) {
        for (let offsetDelta = -1; offsetDelta <= 1; offsetDelta += 1) {
          const neighbors = cells.get(`${valueCell + valueDelta}\u0000${offsetCell + offsetDelta}`) ?? [];
          if (neighbors.some((point) => Math.hypot(valuePosition - point.valuePosition, offset - point.offset) < minimumDistance - 1e-7)) return false;
        }
      }
      return true;
    };
    for (const { valuePosition, index } of order) {
      const selected = candidates.find((candidate) => clears(valuePosition, candidate));
      if (selected === undefined) return null;
      offsets[index] = selected;
      const key = `${cellAt(valuePosition)}\u0000${cellAt(selected)}`;
      const points = cells.get(key) ?? [];
      points.push({ valuePosition, offset: selected });
      cells.set(key, points);
    }
    return { offsets, pointRadius, minimumDistance };
  };
  const requested = attempt(requestedRadius, 0.8);
  if (requested) return { ...requested, scaled: false };
  const capacityDistance = valuePositions.length > 1 ? (limit * 2) / (valuePositions.length - 1) : requestedRadius * 2 + 0.8;
  let scaledRadius = Math.min(requestedRadius, Math.max(Number.EPSILON, capacityDistance / 2.25));
  for (let retry = 0; retry < 12; retry += 1) {
    const scaled = attempt(scaledRadius, scaledRadius * 0.25);
    if (scaled) return { ...scaled, scaled: true };
    scaledRadius *= 0.9;
  }
  const fallbackSpacing = valuePositions.length > 1 ? (limit * 2) / (valuePositions.length - 1) : requestedRadius * 2.25;
  const fallbackRadius = fallbackSpacing / 2.25;
  const offsets = Array(valuePositions.length).fill(0) as number[];
  order.forEach(({ index }, orderIndex) => { offsets[index] = valuePositions.length > 1 ? -limit + orderIndex * fallbackSpacing : 0; });
  return { offsets, pointRadius: fallbackRadius, minimumDistance: fallbackSpacing, scaled: true };
}

export function deterministicBeeswarmOffsets(valuePositions: number[], pointRadius: number, maximumOffset: number) {
  return deterministicBeeswarmLayout(valuePositions, pointRadius, maximumOffset).offsets;
}

export function kernelDensityEstimate(
  values: number[],
  domain: [number, number],
  bandwidthAdjustment = 1,
  sampleCount = 64,
) {
  if (values.length === 0) return { bandwidth: 0, points: [] as Array<{ position: number; density: number }> };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  const variance = sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, sorted.length - 1);
  const standardDeviation = Math.sqrt(variance);
  const robustScale = (quantile(sorted, 0.75) - quantile(sorted, 0.25)) / 1.349;
  const positiveScales = [standardDeviation, robustScale].filter((value) => Number.isFinite(value) && value > 0);
  const domainSpan = Math.max(domain[1] - domain[0], Number.EPSILON);
  const scale = positiveScales.length > 0 ? Math.min(...positiveScales) : domainSpan / 12;
  const baseBandwidth = 0.9 * scale * Math.pow(Math.max(1, sorted.length), -0.2);
  const bandwidth = Math.max(domainSpan / 120, baseBandwidth * Math.max(0.25, bandwidthAdjustment));
  const supportPadding = bandwidth * 1.8;
  const lower = Math.max(domain[0], sorted[0] - supportPadding);
  const upper = Math.min(domain[1], sorted[sorted.length - 1] + supportPadding);
  const count = Math.max(16, sampleCount);
  const points = Array.from({ length: count }, (_, index) => {
    const position = lower + ((upper - lower) * index) / Math.max(1, count - 1);
    const density = index === 0 || index === count - 1
      ? 0
      : sorted.reduce((sum, value) => sum + Math.exp(-0.5 * ((position - value) / bandwidth) ** 2), 0)
        / (sorted.length * bandwidth * Math.sqrt(2 * Math.PI));
    return { position, density };
  });
  return { bandwidth, points };
}

export function linearRegression(points: Array<{ x: number; y: number }>) {
  if (points.length < 2) return null;
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const denominator = points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
  if (denominator === 0) return null;
  const slope = points.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0) / denominator;
  const intercept = meanY - slope * meanX;
  const total = points.reduce((sum, point) => sum + (point.y - meanY) ** 2, 0);
  const residual = points.reduce((sum, point) => sum + (point.y - (slope * point.x + intercept)) ** 2, 0);
  return { slope, intercept, rSquared: total === 0 ? 1 : Math.max(0, 1 - residual / total) };
}

function solveLinearSystem(matrix: number[][], vector: number[]) {
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let pivot = 0; pivot < augmented.length; pivot += 1) {
    let best = pivot;
    for (let row = pivot + 1; row < augmented.length; row += 1) if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[best][pivot])) best = row;
    [augmented[pivot], augmented[best]] = [augmented[best], augmented[pivot]];
    const divisor = augmented[pivot][pivot];
    if (Math.abs(divisor) < 1e-12) return null;
    for (let column = pivot; column <= augmented.length; column += 1) augmented[pivot][column] /= divisor;
    for (let row = 0; row < augmented.length; row += 1) {
      if (row === pivot) continue;
      const factor = augmented[row][pivot];
      for (let column = pivot; column <= augmented.length; column += 1) augmented[row][column] -= factor * augmented[pivot][column];
    }
  }
  return augmented.map((row) => row[augmented.length]);
}

export function polynomialRegression(points: Array<{ x: number; y: number }>, degree: 2 | 3) {
  if (points.length < degree + 1) return null;
  const center = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const scale = Math.max(...points.map((point) => Math.abs(point.x - center)), Number.EPSILON);
  const normalized = points.map((point) => ({ x: (point.x - center) / scale, y: point.y }));
  const size = degree + 1;
  const matrix = Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, column) => normalized.reduce((sum, point) => sum + point.x ** (row + column), 0)));
  const vector = Array.from({ length: size }, (_, power) => normalized.reduce((sum, point) => sum + point.y * point.x ** power, 0));
  const normalizedCoefficients = solveLinearSystem(matrix, vector);
  if (!normalizedCoefficients) return null;
  const choose = (n: number, k: number) => {
    let result = 1;
    for (let index = 1; index <= k; index += 1) result = result * (n - index + 1) / index;
    return result;
  };
  const coefficients = Array(size).fill(0) as number[];
  normalizedCoefficients.forEach((coefficient, power) => {
    for (let expandedPower = 0; expandedPower <= power; expandedPower += 1) coefficients[expandedPower] += coefficient * choose(power, expandedPower) * (-center) ** (power - expandedPower) / scale ** power;
  });
  const predict = (x: number) => normalizedCoefficients.reduce((sum, coefficient, power) => sum + coefficient * ((x - center) / scale) ** power, 0);
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const total = points.reduce((sum, point) => sum + (point.y - meanY) ** 2, 0);
  const residual = points.reduce((sum, point) => sum + (point.y - predict(point.x)) ** 2, 0);
  return { coefficients, degree, center, scale, rSquared: total === 0 ? 1 : Math.max(0, 1 - residual / total), predict };
}

export function loessSmooth(points: Array<{ x: number; y: number }>, span = 0.65, sampleCount = 64) {
  if (points.length < 3) return [] as Array<{ x: number; y: number }>;
  const sorted = [...points].sort((left, right) => left.x - right.x);
  const minimum = sorted[0].x;
  const maximum = sorted[sorted.length - 1].x;
  const neighborhood = Math.max(3, Math.min(sorted.length, Math.ceil(sorted.length * Math.max(0.25, Math.min(1, span)))));
  const count = Math.max(16, sampleCount);
  return Array.from({ length: count }, (_, index) => {
    const x = minimum + (maximum - minimum) * index / Math.max(1, count - 1);
    const nearest = [...sorted].sort((left, right) => Math.abs(left.x - x) - Math.abs(right.x - x)).slice(0, neighborhood);
    const distance = Math.max(...nearest.map((point) => Math.abs(point.x - x)), Number.EPSILON);
    const weighted = nearest.map((point) => ({ ...point, weight: (1 - Math.min(1, Math.abs(point.x - x) / distance) ** 3) ** 3 }));
    const weightSum = weighted.reduce((sum, point) => sum + point.weight, 0) || 1;
    const meanX = weighted.reduce((sum, point) => sum + point.x * point.weight, 0) / weightSum;
    const meanY = weighted.reduce((sum, point) => sum + point.y * point.weight, 0) / weightSum;
    const denominator = weighted.reduce((sum, point) => sum + point.weight * (point.x - meanX) ** 2, 0);
    const slope = denominator > 1e-12 ? weighted.reduce((sum, point) => sum + point.weight * (point.x - meanX) * (point.y - meanY), 0) / denominator : 0;
    return { x, y: meanY + slope * (x - meanX) };
  });
}

export function linearConfidenceBand95(points: Array<{ x: number; y: number }>, xValues: number[]) {
  const fit = linearRegression(points);
  if (!fit || points.length < 3) return [] as Array<{ x: number; estimate: number; lower: number; upper: number }>;
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const sumSquaresX = points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
  if (sumSquaresX <= 0) return [];
  const residualSumSquares = points.reduce((sum, point) => sum + (point.y - (fit.intercept + fit.slope * point.x)) ** 2, 0);
  const residualStandardError = Math.sqrt(residualSumSquares / (points.length - 2));
  const critical = studentTCritical95(points.length - 2);
  return xValues.map((x) => {
    const estimate = fit.intercept + fit.slope * x;
    const margin = critical * residualStandardError * Math.sqrt(1 / points.length + (x - meanX) ** 2 / sumSquaresX);
    return { x, estimate, lower: estimate - margin, upper: estimate + margin };
  });
}

export function covarianceEllipsePoints(points: Array<{ x: number; y: number }>, probabilityRadius = Math.sqrt(5.991)) {
  if (points.length < 3) return [] as Array<{ x: number; y: number }>;
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const varianceX = points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0) / (points.length - 1);
  const varianceY = points.reduce((sum, point) => sum + (point.y - meanY) ** 2, 0) / (points.length - 1);
  const covariance = points.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0) / (points.length - 1);
  const trace = varianceX + varianceY;
  const difference = Math.sqrt(Math.max(0, (varianceX - varianceY) ** 2 + 4 * covariance ** 2));
  const firstEigenvalue = Math.max(0, (trace + difference) / 2);
  const secondEigenvalue = Math.max(0, (trace - difference) / 2);
  if (firstEigenvalue <= 1e-12 || secondEigenvalue <= 1e-12) return [];
  const angle = 0.5 * Math.atan2(2 * covariance, varianceX - varianceY);
  return Array.from({ length: 65 }, (_, index) => {
    const theta = index / 64 * Math.PI * 2;
    const major = probabilityRadius * Math.sqrt(firstEigenvalue) * Math.cos(theta);
    const minor = probabilityRadius * Math.sqrt(secondEigenvalue) * Math.sin(theta);
    return { x: meanX + major * Math.cos(angle) - minor * Math.sin(angle), y: meanY + major * Math.sin(angle) + minor * Math.cos(angle) };
  });
}

export function numericExtent(values: number[], includeZero = false): [number, number] {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return [0, 1];
  const minimum = Math.min(...finite);
  const maximum = Math.max(...finite);
  if (includeZero) {
    if (minimum >= 0) {
      if (maximum === 0) return [0, 1];
      return [0, maximum + maximum * 0.08];
    }
    if (maximum <= 0) {
      return [minimum - Math.abs(minimum) * 0.08, 0];
    }
  }
  if (minimum === maximum) {
    const padding = Math.abs(minimum || 1) * 0.12;
    return [minimum - padding, maximum + padding];
  }
  const padding = (maximum - minimum) * 0.08;
  return [minimum - padding, maximum + padding];
}

/** Prefer the actual ordered sampling values for compact time-course axes. */
export function observedAxisTicks(values: number[], maximumCount: number) {
  const ticks = [...new Set(values.filter(Number.isFinite))].sort((a, b) => a - b);
  return ticks.length >= 2 && ticks.length <= Math.max(2, maximumCount) ? ticks : undefined;
}

function logGamma(value: number): number {
  const coefficients = [676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406, 12.507343278686905, -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7];
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  const shifted = value - 1;
  let series = 0.9999999999998099;
  coefficients.forEach((coefficient, index) => { series += coefficient / (shifted + index + 1); });
  const t = shifted + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(series);
}

function betaContinuedFraction(a: number, b: number, x: number) {
  const maximumIterations = 200;
  const epsilon = 3e-12;
  const floor = 1e-300;
  const qab = a + b; const qap = a + 1; const qam = a - 1;
  let c = 1; let d = 1 - qab * x / qap;
  if (Math.abs(d) < floor) d = floor;
  d = 1 / d;
  let result = d;
  for (let iteration = 1; iteration <= maximumIterations; iteration += 1) {
    const twice = 2 * iteration;
    let aa = iteration * (b - iteration) * x / ((qam + twice) * (a + twice));
    d = 1 + aa * d; if (Math.abs(d) < floor) d = floor;
    c = 1 + aa / c; if (Math.abs(c) < floor) c = floor;
    d = 1 / d; result *= d * c;
    aa = -(a + iteration) * (qab + iteration) * x / ((a + twice) * (qap + twice));
    d = 1 + aa * d; if (Math.abs(d) < floor) d = floor;
    c = 1 + aa / c; if (Math.abs(c) < floor) c = floor;
    d = 1 / d;
    const delta = d * c; result *= delta;
    if (Math.abs(delta - 1) < epsilon) break;
  }
  return result;
}

function regularizedIncompleteBeta(x: number, a: number, b: number) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2)
    ? front * betaContinuedFraction(a, b, x) / a
    : 1 - front * betaContinuedFraction(b, a, 1 - x) / b;
}

export function studentTTwoSidedPValue(tStatistic: number, degreesOfFreedom: number) {
  if (!Number.isFinite(tStatistic) || !Number.isFinite(degreesOfFreedom) || degreesOfFreedom <= 0) return null;
  const squared = tStatistic * tStatistic;
  return Math.min(1, Math.max(0, regularizedIncompleteBeta(degreesOfFreedom / (degreesOfFreedom + squared), degreesOfFreedom / 2, 0.5)));
}

export function welchSummaryPValue(meanA: number, sdA: number, nA: number, meanB: number, sdB: number, nB: number) {
  if (![meanA, sdA, nA, meanB, sdB, nB].every(Number.isFinite) || sdA < 0 || sdB < 0 || nA < 2 || nB < 2) return null;
  const varianceA = sdA * sdA / nA;
  const varianceB = sdB * sdB / nB;
  const variance = varianceA + varianceB;
  if (variance === 0) return meanA === meanB ? 1 : 0;
  const degreesOfFreedom = variance * variance / (varianceA * varianceA / (nA - 1) + varianceB * varianceB / (nB - 1));
  return studentTTwoSidedPValue(Math.abs(meanA - meanB) / Math.sqrt(variance), degreesOfFreedom);
}

export function benjaminiHochbergAdjust(pValues: number[]) {
  const indexed = pValues.map((pValue, index) => ({ pValue: Math.min(1, Math.max(0, pValue)), index })).sort((a, b) => a.pValue - b.pValue);
  const adjusted = Array<number>(pValues.length).fill(1);
  let runningMinimum = 1;
  for (let rankIndex = indexed.length - 1; rankIndex >= 0; rankIndex -= 1) {
    const entry = indexed[rankIndex];
    runningMinimum = Math.min(runningMinimum, entry.pValue * indexed.length / (rankIndex + 1));
    adjusted[entry.index] = Math.min(1, runningMinimum);
  }
  return adjusted;
}

export function resolveAxisDomain(
  automatic: [number, number],
  minimum: number | null,
  maximum: number | null,
): [number, number] {
  if (minimum !== null && maximum !== null) return minimum < maximum ? [minimum, maximum] : automatic;
  const automaticSpan = Math.max(automatic[1] - automatic[0], Math.abs(automatic[0]) * 0.12, Math.abs(automatic[1]) * 0.12, 1);
  if (minimum !== null) return [minimum, Math.max(automatic[1], minimum + automaticSpan)];
  if (maximum !== null) return [Math.min(automatic[0], maximum - automaticSpan), maximum];
  return automatic;
}

export function axisLimitWarning(
  definition: PlotDefinition,
  dataset: ParsedDataset,
  mapping: Record<string, string>,
  settings: VisualizationSettings,
) {
  const activeAxes = activeNumericAxes(definition.id, settings);
  const numberAt = (row: DelimitedRow, role: string) => {
    const column = mapping[role];
    return column ? parseNumericValue(row[column]) : null;
  };
  const valuesAt = (role: string) => dataset.rows.flatMap((row) => {
    const value = numberAt(row, role);
    return value === null ? [] : [value];
  });
  let xValues: number[] = [];
  let yValues: number[] = [];
  if (["scatter", "correlation", "pca", "pcoa", "umap", "tsne", "nmds", "quadrant"].includes(definition.id)) {
    xValues = valuesAt("x");
    yValues = valuesAt("y");
    if (["scatter", "correlation", "pca"].includes(definition.id) && settings.swapAxes) [xValues, yValues] = [yValues, xValues];
    if (definition.id === "quadrant") {
      xValues.push(settings.xThreshold);
      yValues.push(settings.yThreshold);
    }
  } else if (definition.id === "line") {
    const ordered = valuesAt("x");
    const valueExtent = dataset.rows.flatMap((row) => {
      const value = numberAt(row, "value");
      if (value === null) return [];
      const error = settings.lineErrorType !== "none" ? Math.max(0, numberAt(row, "error") ?? 0) : 0;
      return [value - error, value + error];
    });
    [xValues, yValues] = settings.swapAxes ? [valueExtent, ordered] : [ordered, valueExtent];
  } else if (definition.id === "bar") {
    let valueExtent = dataset.rows.flatMap((row) => {
      const value = numberAt(row, "value");
      if (value === null) return [];
      const showsUncertainty = settings.barErrorType !== "none" && !["stacked", "percentage", "polar"].includes(settings.barVariant);
      const error = showsUncertainty ? Math.max(0, numberAt(row, "error") ?? 0) : 0;
      return [value - error, value + error];
    });
    if (["stacked", "percentage"].includes(settings.barVariant)) {
      if (settings.barVariant === "percentage") valueExtent = [0, 100];
      else {
        const categories = new Map<string, { positive: number; negative: number }>();
        dataset.rows.forEach((row) => {
          const category = row[mapping.category] ?? ""; const value = numberAt(row, "value") ?? 0;
          const totals = categories.get(category) ?? { positive: 0, negative: 0 };
          if (value >= 0) totals.positive += value; else totals.negative += value;
          categories.set(category, totals);
        });
        valueExtent = [...categories.values()].flatMap((totals) => [totals.negative, totals.positive]);
      }
    } else {
      if (settings.barVariant === "overlay") valueExtent.push(...valuesAt("secondary"));
      if (settings.barVariant === "bullet") valueExtent.push(...valuesAt("target"));
      if (settings.barVariant === "pyramid" && mapping.group) {
        const groups = [...new Set(dataset.rows.map((row) => row[mapping.group]).filter(Boolean))];
        valueExtent = dataset.rows.flatMap((row) => {
          const value = numberAt(row, "value"); if (value === null) return [];
          return [groups.indexOf(row[mapping.group]) < Math.ceil(groups.length / 2) ? -Math.abs(value) : Math.abs(value)];
        });
      }
    }
    if (settings.swapAxes || ["horizontal", "bullet", "pyramid"].includes(settings.barVariant)) xValues = valueExtent;
    else yValues = valueExtent;
  } else if (definition.id === "errorbar") {
    yValues = dataset.rows.flatMap((row) => {
      const value = numberAt(row, "value");
      if (value === null) return [];
      const error = Math.max(0, numberAt(row, "error") ?? 0);
      return [value - error, value + error];
    });
  } else if (["box", "violin", "beeswarm", "raincloud", "histogram", "density", "ridge"].includes(definition.id)) {
    const distributionValues = valuesAt("value");
    if (settings.distributionOrientation === "horizontal") xValues = distributionValues;
    else yValues = distributionValues;
    if (settings.showDensity && mapping.group) {
      const rawDomain = numericExtent(distributionValues);
      const rawSpan = Math.max(rawDomain[1] - rawDomain[0], 1e-9);
      const densityBoundaryDomain: [number, number] = [rawDomain[0] - rawSpan * 0.16, rawDomain[1] + rawSpan * 0.16];
      const densitySupport = distributionNumericLanes(dataset.rows, mapping.group, mapping.value, mapping.facet).flatMap((lane) => {
        const points = kernelDensityEstimate(lane.values, densityBoundaryDomain, settings.violinBandwidth).points;
        return points.length > 0 ? [points[0].position, points[points.length - 1].position] : [];
      });
      if (settings.distributionOrientation === "horizontal") xValues.push(...densitySupport);
      else yValues.push(...densitySupport);
    }
    if (settings.boxErrorType !== "none" && mapping.group) {
      for (const lane of distributionNumericLanes(dataset.rows, mapping.group, mapping.value, mapping.facet)) {
        if (lane.values.length < 2) continue;
        const summary = meanErrorStatistics(lane.values);
        const error = settings.boxErrorType === "sd" ? summary.sd : settings.boxErrorType === "sem" ? summary.sem : confidenceInterval95(lane.values).margin;
        if (settings.distributionOrientation === "horizontal") xValues.push(summary.mean - error, summary.mean + error);
        else yValues.push(summary.mean - error, summary.mean + error);
      }
    }
  } else if (definition.id === "ma") {
    xValues = valuesAt("mean").map((value) => Math.log10(Math.max(value, Number.MIN_VALUE)));
    yValues = [...valuesAt("effect"), -settings.foldChangeThreshold, settings.foldChangeThreshold];
  } else if (definition.id === "volcano") {
    xValues = [...valuesAt("effect"), -settings.foldChangeThreshold, settings.foldChangeThreshold];
    yValues = valuesAt("pValue").map((value) => -Math.log10(Math.max(value, Number.MIN_VALUE)));
    yValues.push(-Math.log10(settings.pValueThreshold));
  } else if (definition.id === "survival-forest") {
    xValues = [...valuesAt("lower"), ...valuesAt("upper"), ...valuesAt("estimate"), settings.forestReferenceValue];
  } else if (definition.id === "km") {
    xValues = valuesAt("time");
    yValues = [0, 1];
  } else if (definition.id === "roc") {
    xValues = [0, 1];
    yValues = [0, 1];
  } else if (["enrichment", "enrichment-bar"].includes(definition.id)) {
    xValues = dataset.rows.flatMap((row) => {
      const column = mapping.ratio;
      const value = column ? parseRatioValue(row[column]) : null;
      return value === null ? [] : [value];
    });
  } else {
    xValues = valuesAt("x").concat(valuesAt("rank"));
    yValues = valuesAt("y").concat(valuesAt("value"), valuesAt("score"));
  }
  const clippedX = activeAxes.includes("x") ? xValues.filter((value) => (settings.xMin !== null && value < settings.xMin) || (settings.xMax !== null && value > settings.xMax)).length : 0;
  const clippedY = activeAxes.includes("y") ? yValues.filter((value) => (settings.yMin !== null && value < settings.yMin) || (settings.yMax !== null && value > settings.yMax)).length : 0;
  if (clippedX + clippedY === 0) return null;
  return `Manual axis limits clip ${clippedX + clippedY} mapped value${clippedX + clippedY === 1 ? "" : "s"} (${clippedX} on X, ${clippedY} on Y).`;
}

export function scaleLinear(value: number, domain: [number, number], range: [number, number]) {
  const denominator = domain[1] - domain[0] || 1;
  return range[0] + ((value - domain[0]) / denominator) * (range[1] - range[0]);
}

export function formatTick(value: number) {
  const magnitude = Math.abs(value);
  if ((magnitude >= 10_000 || (magnitude > 0 && magnitude < 0.001))) return value.toExponential(1);
  if (magnitude >= 100) return value.toFixed(0);
  if (magnitude >= 10) return value.toFixed(1).replace(/\.0$/, "");
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function interpolateColor(start: string, end: string, fraction: number) {
  const clamp = Math.max(0, Math.min(1, fraction));
  const parse = (hex: string) => [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  const startRgb = parse(start);
  const endRgb = parse(end);
  return `#${startRgb.map((channel, index) => Math.round(channel + (endRgb[index] - channel) * clamp).toString(16).padStart(2, "0")).join("")}`;
}

export function divergingColor(low: string, middle: string, high: string, fraction: number) {
  return fraction <= 0.5
    ? interpolateColor(low, middle, fraction * 2)
    : interpolateColor(middle, high, (fraction - 0.5) * 2);
}
