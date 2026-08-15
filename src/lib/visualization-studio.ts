export type PlotType =
  | "bar"
  | "line"
  | "scatter"
  | "box"
  | "violin"
  | "volcano"
  | "heatmap"
  | "enrichment";

export type JournalThemeId =
  | "nature"
  | "cell"
  | "science"
  | "nejm"
  | "lancet"
  | "jama"
  | "nordic"
  | "earth"
  | "colorblind";

export type FigureFontId = "arial" | "helvetica" | "system" | "times" | "georgia" | "palatino";

export type DelimitedRow = Record<string, string>;

export type ParsedDataset = {
  headers: string[];
  rows: DelimitedRow[];
  delimiter: "tab" | "comma";
  errors: string[];
  warnings: string[];
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
};

export type JournalTheme = {
  id: JournalThemeId;
  name: string;
  description: string;
  categorical: string[];
  sequential: [string, string];
  diverging: [string, string, string];
  ink: string;
  muted: string;
  grid: string;
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
  boxErrorType: "none" | "sd" | "sem";
  barErrorType: "none" | "sd" | "sem";
  lineErrorType: "none" | "sd" | "sem";
  barBorderWidth: number;
  barBorderColor: string;
  errorBarLineWidth: number;
  errorBarCapSize: number;
  violinBandwidth: number;
  violinWidth: number;
  foldChangeThreshold: number;
  pValueThreshold: number;
  labelLimit: number;
  heatmapScale: "row" | "none";
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
  width: 620,
  height: 440,
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
  barErrorType: "none",
  lineErrorType: "none",
  barBorderWidth: 0,
  barBorderColor: "#23242A",
  errorBarLineWidth: 1.5,
  errorBarCapSize: 14,
  violinBandwidth: 1,
  violinWidth: 0.34,
  foldChangeThreshold: 1,
  pValueThreshold: 0.05,
  labelLimit: 8,
  heatmapScale: "row",
  categoricalColors: ["#3C5488", "#E64B35", "#00A087", "#4DBBD5", "#F39B7F", "#8491B4", "#91D1C2", "#7E6148"],
  continuousLow: "#E8F1F2",
  continuousHigh: "#147A86",
  divergingLow: "#3C5488",
  divergingMid: "#F7F7F4",
  divergingHigh: "#E64B35",
};

export const journalThemes: Record<JournalThemeId, JournalTheme> = {
  nature: {
    id: "nature",
    name: "Nature",
    description: "Cool blue, coral red, and restrained botanical accents.",
    categorical: ["#3C5488", "#E64B35", "#00A087", "#4DBBD5", "#F39B7F", "#8491B4", "#91D1C2", "#7E6148"],
    sequential: ["#E8F1F2", "#147A86"],
    diverging: ["#3C5488", "#F7F7F4", "#E64B35"],
    ink: "#23242A",
    muted: "#686A73",
    grid: "#E5E5E1",
  },
  cell: {
    id: "cell",
    name: "Cell",
    description: "Warm coral, teal, plum, and muted gold for mechanistic figures.",
    categorical: ["#C44E52", "#4C8B8B", "#8172B3", "#CCB974", "#4C72B0", "#DD8452", "#64A66A", "#937860"],
    sequential: ["#F4EEE5", "#A65A3A"],
    diverging: ["#4C72B0", "#FAF7F2", "#C44E52"],
    ink: "#252427",
    muted: "#6B6768",
    grid: "#E8E2DD",
  },
  science: {
    id: "science",
    name: "Science",
    description: "High-clarity navy, red, green, and purple with strong separation.",
    categorical: ["#3B4992", "#D64545", "#008B68", "#6A4C93", "#1F7A8C", "#A33D5D", "#7B8F3A", "#6B6D76"],
    sequential: ["#E9EEF6", "#315B88"],
    diverging: ["#3B4992", "#F7F7F7", "#D64545"],
    ink: "#1F2025",
    muted: "#62656D",
    grid: "#E2E4E8",
  },
  nejm: {
    id: "nejm",
    name: "NEJM",
    description: "Clinical oxblood, steel blue, muted teal, and restrained ochre.",
    categorical: ["#8E2C3A", "#356A87", "#4E8174", "#C18A3B", "#71627C", "#7C8F99", "#B96A58", "#8B7A64"],
    sequential: ["#F5ECEE", "#8E2C3A"],
    diverging: ["#356A87", "#F8F6F2", "#A33A45"],
    ink: "#252326",
    muted: "#6E686B",
    grid: "#E8E3E2",
  },
  lancet: {
    id: "lancet",
    name: "Lancet",
    description: "Editorial burgundy, deep teal, warm amber, and composed slate.",
    categorical: ["#8C294A", "#006D77", "#D49A3A", "#536B87", "#816A8D", "#577C67", "#B9654F", "#74777E"],
    sequential: ["#F5EBEF", "#8C294A"],
    diverging: ["#006D77", "#FAF7F2", "#A64050"],
    ink: "#262326",
    muted: "#6D686C",
    grid: "#E7E2E4",
  },
  jama: {
    id: "jama",
    name: "JAMA",
    description: "Medical teal, burnished orange, clear cyan, and muted wine.",
    categorical: ["#374E55", "#DF8F44", "#00A1D5", "#B24745", "#79AF97", "#6A6599", "#80796B", "#5C8290"],
    sequential: ["#EDF2F2", "#374E55"],
    diverging: ["#007FA3", "#F7F6F2", "#B24745"],
    ink: "#23282A",
    muted: "#687176",
    grid: "#E2E7E7",
  },
  nordic: {
    id: "nordic",
    name: "Nordic",
    description: "Cool navy and fjord teal balanced by clay, straw, and soft violet.",
    categorical: ["#294C60", "#5B8E8D", "#C7785A", "#A49B62", "#776987", "#688292", "#D0A15F", "#547064"],
    sequential: ["#EAF1F2", "#294C60"],
    diverging: ["#3E7188", "#F7F5EF", "#C7785A"],
    ink: "#22282C",
    muted: "#647078",
    grid: "#E1E7E8",
  },
  earth: {
    id: "earth",
    name: "Earth",
    description: "Botanical green, terracotta, ochre, aubergine, and mineral blue.",
    categorical: ["#405D53", "#B86B4B", "#C19745", "#6F5C78", "#718355", "#986A5A", "#4F7880", "#85725B"],
    sequential: ["#F1EFE5", "#405D53"],
    diverging: ["#4F7880", "#F6F2E8", "#B86B4B"],
    ink: "#292825",
    muted: "#706D65",
    grid: "#E7E3D8",
  },
  colorblind: {
    id: "colorblind",
    name: "Colorblind",
    description: "Okabe–Ito-derived contrasts tuned for legibility on a white background.",
    categorical: ["#0072B2", "#D55E00", "#009E73", "#CC79A7", "#C58A00", "#56B4E9", "#6B6B6B", "#8A6E00"],
    sequential: ["#E8F2F7", "#0072B2"],
    diverging: ["#0072B2", "#F7F7F3", "#D55E00"],
    ink: "#222426",
    muted: "#666B70",
    grid: "#E2E6E8",
  },
};

const samples = {
  bar: `category\tvalue\tsd\tsem\tgroup
Control\t4.2\t0.45\t0.20\tBaseline
Treatment A\t7.8\t0.72\t0.32\tResponse
Treatment B\t6.3\t0.58\t0.26\tResponse
Treatment C\t9.1\t0.81\t0.36\tResponse`,
  line: `time\tvalue\tsd\tsem\tseries
0\t1.0\t0.12\t0.05\tControl
1\t1.3\t0.16\t0.07\tControl
2\t1.6\t0.18\t0.08\tControl
3\t1.8\t0.21\t0.09\tControl
0\t1.0\t0.14\t0.06\tTreatment
1\t2.1\t0.24\t0.11\tTreatment
2\t3.5\t0.31\t0.14\tTreatment
3\t4.4\t0.38\t0.17\tTreatment`,
  scatter: `x\ty\tgroup\tlabel
1.2\t1.6\tControl\tS1
1.8\t2.1\tControl\tS2
2.2\t2.4\tControl\tS3
2.5\t3.4\tTreatment\tS4
3.2\t3.7\tTreatment\tS5
3.8\t4.6\tTreatment\tS6
4.4\t5.0\tTreatment\tS7`,
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
  heatmap: `gene\tControl_1\tControl_2\tTreatment_1\tTreatment_2
TP53\t6.2\t6.5\t8.4\t8.8
EGFR\t8.1\t7.8\t5.2\t5.5
MYC\t5.4\t5.8\t7.1\t7.5
CDKN2A\t7.2\t7.0\t4.6\t4.2
MKI67\t4.3\t4.7\t7.8\t8.1
VIM\t5.8\t6.0\t6.9\t7.2`,
  enrichment: `term\tgeneRatio\tcount\tpadj\tgroup
Cell cycle\t0.36\t18\t0.0003\tBP
DNA repair\t0.30\t15\t0.0012\tBP
Apoptosis\t0.24\t12\t0.0041\tBP
PI3K-AKT signaling\t0.32\t16\t0.0008\tKEGG
p53 signaling\t0.22\t11\t0.0063\tKEGG
Focal adhesion\t0.18\t9\t0.018\tKEGG`,
};

export const plotDefinitions: PlotDefinition[] = [
  {
    id: "bar",
    name: "Bar",
    family: "Comparison",
    summary: "Compact categorical comparison with optional grouping and axis swap.",
    inputHint: "One row per category. Map an optional non-negative SD or SEM column to draw symmetric error bars.",
    roles: [
      { key: "category", label: "Category", kind: "category", required: true },
      { key: "value", label: "Value", kind: "number", required: true },
      { key: "error", label: "Error magnitude (SD / SEM)", kind: "number", required: false },
      { key: "group", label: "Group", kind: "category", required: false },
    ],
    defaultMapping: { category: "category", value: "value", error: "sd", group: "group" },
    sampleData: samples.bar,
  },
  {
    id: "line",
    name: "Line",
    family: "Trend",
    summary: "Time-course or ordered trend with multiple series and visible markers.",
    inputHint: "One row per observation. Map an optional non-negative SD or SEM column to draw a symmetric error bar at every Y value.",
    roles: [
      { key: "x", label: "X", kind: "number", required: true },
      { key: "value", label: "Value", kind: "number", required: true },
      { key: "error", label: "Error magnitude (SD / SEM)", kind: "number", required: false },
      { key: "series", label: "Series", kind: "category", required: false },
    ],
    defaultMapping: { x: "time", value: "value", error: "sd", series: "series" },
    sampleData: samples.line,
  },
  {
    id: "scatter",
    name: "Scatter",
    family: "Association",
    summary: "Grouped scatter plot with an optional linear fit and point labels.",
    inputHint: "One row per observation; x and y must be numeric.",
    roles: [
      { key: "x", label: "X", kind: "number", required: true },
      { key: "y", label: "Y", kind: "number", required: true },
      { key: "group", label: "Group", kind: "category", required: false },
      { key: "label", label: "Label", kind: "label", required: false },
    ],
    defaultMapping: { x: "x", y: "y", group: "group", label: "label" },
    sampleData: samples.scatter,
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
    ],
    defaultMapping: { group: "group", value: "value" },
    sampleData: samples.distribution,
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
    ],
    defaultMapping: { group: "group", value: "value" },
    sampleData: samples.distribution,
  },
  {
    id: "volcano",
    name: "Volcano",
    family: "Omics",
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
    family: "Pathway",
    summary: "Term, ratio, count, and FDR encoded independently and legibly.",
    inputHint: "One row per term. Ratios may be decimals or fractions such as 8/40.",
    roles: [
      { key: "term", label: "Term", kind: "label", required: true },
      { key: "ratio", label: "Gene ratio", kind: "number", required: true },
      { key: "count", label: "Gene count", kind: "number", required: true },
      { key: "pValue", label: "Adjusted P value", kind: "number", required: true },
      { key: "group", label: "Ontology / group", kind: "category", required: false },
    ],
    defaultMapping: { term: "term", ratio: "geneRatio", count: "count", pValue: "padj", group: "group" },
    sampleData: samples.enrichment,
  },
];

export function getPlotDefinition(type: PlotType) {
  return plotDefinitions.find((definition) => definition.id === type) ?? plotDefinitions[0];
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

export function parseRatioValue(value: string | undefined) {
  if (!value) return null;
  if (value.includes("/")) {
    const [numerator, denominator] = value.split("/").map(Number);
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) return numerator / denominator;
  }
  return parseNumericValue(value);
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

  if (definition.id === "heatmap") {
    if (dataset.headers.length < 3) errors.push("Heatmap data needs one row-label column and at least two numeric sample columns.");
    const numericHeaders = dataset.headers.slice(1);
    const invalid = dataset.rows.filter((row) => numericHeaders.some((header) => parseNumericValue(row[header]) === null));
    if (invalid.length > 0) errors.push(`${invalid.length} heatmap row${invalid.length === 1 ? "" : "s"} contain non-numeric or blank values.`);
    return { errors, warnings };
  }

  definition.roles.forEach((role) => {
    const column = mapping[role.key];
    if (role.required && !column) errors.push(`${role.label} must be mapped to a column.`);
    if (column && !dataset.headers.includes(column)) errors.push(`${role.label} references a missing column (${column}).`);
    if (column && role.kind === "number") {
      const invalidCount = dataset.rows.filter((row) => {
        const value = definition.id === "enrichment" && role.key === "ratio"
          ? parseRatioValue(row[column])
          : parseNumericValue(row[column]);
        return value === null;
      }).length;
      if (invalidCount > 0) errors.push(`${role.label} contains ${invalidCount} non-numeric or blank value${invalidCount === 1 ? "" : "s"}.`);
    }
  });

  if (definition.id === "volcano") {
    const pColumn = mapping.pValue;
    const invalidP = pColumn
      ? dataset.rows.filter((row) => {
          const value = parseNumericValue(row[pColumn]);
          return value === null || value <= 0 || value > 1;
        }).length
      : 0;
    if (invalidP > 0) errors.push(`Adjusted P value contains ${invalidP} value${invalidP === 1 ? "" : "s"} outside (0, 1].`);
  }

  if (definition.id === "bar" || definition.id === "line") {
    const errorType = definition.id === "bar" ? settings?.barErrorType : settings?.lineErrorType;
    if (errorType !== undefined && errorType !== "none" && !mapping.error) {
      errors.push(`Map an error column before displaying ${errorType.toUpperCase()} error bars.`);
    }
    if (mapping.error) {
      const negativeErrors = dataset.rows.filter((row) => {
        const value = parseNumericValue(row[mapping.error]);
        return value !== null && value < 0;
      }).length;
      if (negativeErrors > 0) errors.push(`Error magnitude contains ${negativeErrors} negative value${negativeErrors === 1 ? "" : "s"}; SD and SEM must be non-negative.`);
    }
  }

  if ((definition.id === "box" || definition.id === "violin") && mapping.group) {
    const groups = groupNumericValues(dataset.rows, mapping.group, mapping.value);
    for (const [group, values] of groups) {
      if (values.length < 3) warnings.push(`${group} has n=${values.length}; distribution estimates are unstable.`);
    }
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
