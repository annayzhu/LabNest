export type PlotType =
  | "bar"
  | "line"
  | "scatter"
  | "correlation"
  | "pca"
  | "pcoa"
  | "umap"
  | "box"
  | "violin"
  | "beeswarm"
  | "raincloud"
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
  | "km"
  | "survival-forest"
  | "roc"
  | "venn"
  | "upset"
  | "sankey"
  | "chord"
  | "circos";

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
};

export type PlotReference = {
  citation: string;
  href: string;
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

export type CategoricalPaletteQuality = {
  validHex: boolean;
  duplicateColors: string[];
  nearWhiteIndexes: number[];
  minimumNormalDistance: number;
  minimumProtanopiaDistance: number;
  minimumDeuteranopiaDistance: number;
  requiresSecondaryEncoding: boolean;
};

function paletteRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255) as [number, number, number];
}

function simulatedRgb(rgb: [number, number, number], mode: "protanopia" | "deuteranopia"): [number, number, number] {
  const matrix = mode === "protanopia"
    ? [[0.56667, 0.43333, 0], [0.55833, 0.44167, 0], [0, 0.24167, 0.75833]]
    : [[0.625, 0.375, 0], [0.7, 0.3, 0], [0, 0.3, 0.7]];
  return matrix.map((row) => row.reduce((sum, weight, index) => sum + weight * rgb[index], 0)) as [number, number, number];
}

function minimumPaletteDistance(colors: string[], mode?: "protanopia" | "deuteranopia"): number {
  if (colors.length < 2) return 1;
  const vectors = colors.map((color) => {
    const rgb = paletteRgb(color);
    return mode ? simulatedRgb(rgb, mode) : rgb;
  });
  let minimum = Number.POSITIVE_INFINITY;
  vectors.forEach((left, leftIndex) => vectors.slice(leftIndex + 1).forEach((right) => {
    minimum = Math.min(minimum, Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]) / Math.sqrt(3));
  }));
  return minimum;
}

export function assessCategoricalPalette(colors: string[]): CategoricalPaletteQuality {
  const validHex = colors.every((color) => /^#[0-9A-F]{6}$/i.test(color));
  if (!validHex) return { validHex, duplicateColors: [], nearWhiteIndexes: [], minimumNormalDistance: 0, minimumProtanopiaDistance: 0, minimumDeuteranopiaDistance: 0, requiresSecondaryEncoding: true };
  const normalizedColors = colors.map((color) => color.toUpperCase());
  const duplicateColors = [...new Set(normalizedColors.filter((color, index) => normalizedColors.indexOf(color) !== index))];
  const nearWhiteIndexes = colors.map((color, index) => ({ color, index })).filter(({ color }) => {
    const [red, green, blue] = paletteRgb(color);
    return (red + green + blue) / 3 > 0.9;
  }).map(({ index }) => index);
  const minimumNormalDistance = minimumPaletteDistance(colors);
  const minimumProtanopiaDistance = minimumPaletteDistance(colors, "protanopia");
  const minimumDeuteranopiaDistance = minimumPaletteDistance(colors, "deuteranopia");
  return {
    validHex,
    duplicateColors,
    nearWhiteIndexes,
    minimumNormalDistance,
    minimumProtanopiaDistance,
    minimumDeuteranopiaDistance,
    requiresSecondaryEncoding: duplicateColors.length > 0 || nearWhiteIndexes.length > 0 || minimumNormalDistance < 0.08 || Math.min(minimumProtanopiaDistance, minimumDeuteranopiaDistance) < 0.08,
  };
}

/** Expand a chosen categorical palette deterministically without reusing a color. */
export function categoricalColorForIndex(index: number, colors: string[]) {
  const safeColors = colors.length > 0 ? colors : ["#A7A5A0"];
  const base = safeColors[index % safeColors.length];
  const tier = Math.floor(index / safeColors.length);
  if (tier === 0) return base;
  const hue = (index * 137.50776405003785) % 360;
  const saturation = 34 + (tier % 4) * 4;
  const lightness = 42 + (tier % 5) * 5;
  const normalizedSaturation = saturation / 100;
  const normalizedLightness = lightness / 100;
  const chroma = (1 - Math.abs(2 * normalizedLightness - 1)) * normalizedSaturation;
  const hueSector = hue / 60;
  const secondary = chroma * (1 - Math.abs(hueSector % 2 - 1));
  const [red, green, blue] = hueSector < 1 ? [chroma, secondary, 0]
    : hueSector < 2 ? [secondary, chroma, 0]
      : hueSector < 3 ? [0, chroma, secondary]
        : hueSector < 4 ? [0, secondary, chroma]
          : hueSector < 5 ? [secondary, 0, chroma]
            : [chroma, 0, secondary];
  const match = normalizedLightness - chroma / 2;
  return `#${[red, green, blue].map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
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
    description: "九套经白底科研图表校准的中国传统色，颜色名称与来源可追溯。",
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
  correlationMethod: "pearson" | "spearman";
  xThreshold: number;
  yThreshold: number;
  clusterRows: boolean;
  clusterColumns: boolean;
  showRiskTable: boolean;
  forestReferenceValue: number;
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
  barErrorType: "none",
  lineErrorType: "none",
  barBorderWidth: 0,
  barBorderColor: "#1D4C50",
  errorBarLineWidth: 1.5,
  errorBarCapSize: 14,
  violinBandwidth: 1,
  violinWidth: 0.34,
  foldChangeThreshold: 1,
  pValueThreshold: 0.05,
  labelLimit: 8,
  heatmapScale: "row",
  correlationMethod: "pearson",
  xThreshold: 0,
  yThreshold: 0,
  clusterRows: true,
  clusterColumns: true,
  showRiskTable: true,
  forestReferenceValue: 1,
  categoricalColors: ["#C09351", "#6C9BCA", "#F0945D", "#5FA88F"],
  continuousLow: "#F5E9D7",
  continuousHigh: "#A87535",
  divergingLow: "#90B5CF",
  divergingMid: "#FAF8F3",
  divergingHigh: "#CDA18A",
};

export const journalThemes: Record<JournalThemeId, JournalTheme> = {
  "minimal-ink": {
    id: "minimal-ink", series: "minimal", name: "石墨", description: "近单色石墨阶梯，适合需要最大克制感的比较图。",
    categorical: ["#46505A", "#65707A", "#838D96", "#A3AAB1", "#596168", "#778087", "#969EA4", "#B3B8BD"],
    sequential: ["#F1F3F4", "#4B5660"], diverging: ["#7890A0", "#F8F8F6", "#A9827A"], ink: "#23242A", muted: "#6C737B", grid: "#E4E6E7",
  },
  "minimal-cobalt": {
    id: "minimal-cobalt", series: "minimal", name: "墨蓝", description: "一组蓝灰明度阶梯，以墨蓝作为唯一强调色。",
    categorical: ["#3F6F9D", "#6686A4", "#879DB3", "#A8B4C0", "#596168", "#778087", "#969EA4", "#B3B8BD"],
    sequential: ["#EFF4F7", "#3F6F9D"], diverging: ["#6F8FA8", "#F8F8F6", "#B58176"], ink: "#23242A", muted: "#687784", grid: "#E2E7EA",
  },
  "minimal-pine": {
    id: "minimal-pine", series: "minimal", name: "松柏", description: "一组松绿色阶梯，安静、自然，适合组学与生态数据。",
    categorical: ["#43796D", "#6A9187", "#8AA79F", "#A9BBB6", "#59635F", "#77817D", "#969F9C", "#B3BAB8"],
    sequential: ["#EFF5F2", "#43796D"], diverging: ["#78969C", "#F8F8F5", "#B38472"], ink: "#23242A", muted: "#6A7A74", grid: "#E2E8E5",
  },
  "minimal-clay": {
    id: "minimal-clay", series: "minimal", name: "陶赭", description: "一组温暖陶赭阶梯，适合临床与实验比较图。",
    categorical: ["#AD6954", "#BB826F", "#C79B8B", "#D1B2A7", "#655954", "#837570", "#A0948F", "#B9B1AD"],
    sequential: ["#F8F0ED", "#AD6954"], diverging: ["#78909D", "#FAF8F5", "#B97A63"], ink: "#23242A", muted: "#806F68", grid: "#EAE3DF",
  },
  "minimal-plum": {
    id: "minimal-plum", series: "minimal", name: "梅灰", description: "一组克制梅紫阶梯，适合强调单一研究主题。",
    categorical: ["#8B617B", "#9F7991", "#B092A4", "#C0AABA", "#62575F", "#80727C", "#9E929A", "#B7AFB4"],
    sequential: ["#F5F0F3", "#8B617B"], diverging: ["#7893A0", "#FAF8F7", "#A77793"], ink: "#23242A", muted: "#786B74", grid: "#E8E2E6",
  },
  nature: {
    id: "nature",
    series: "journal",
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
    series: "journal",
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
    series: "journal",
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
    series: "journal",
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
    series: "journal",
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
    series: "journal",
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
    series: "curated",
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
    series: "curated",
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
    series: "curated",
    name: "Colorblind",
    description: "Okabe–Ito-derived contrasts tuned for legibility on a white background.",
    categorical: ["#0072B2", "#D55E00", "#009E73", "#CC79A7", "#C58A00", "#56B4E9", "#6B6B6B", "#8A6E00"],
    sequential: ["#E8F2F7", "#0072B2"],
    diverging: ["#0072B2", "#F7F7F3", "#D55E00"],
    ink: "#222426",
    muted: "#666B70",
    grid: "#E2E6E8",
  },
  "cn-beihai": {
    id: "cn-beihai",
    series: "chinese-traditional",
    name: "柴染棕",
    description: "桂皮淡棕、天青、海螺橙与梧枝绿；梧枝绿为白底色觉区分做轻微校准。",
    categorical: ["#C09351", "#6C9BCA", "#F0945D", "#5FA88F"],
    sequential: ["#F5E9D7", "#A87535"],
    diverging: ["#90B5CF", "#FAF8F3", "#CDA18A"],
    ink: "#23242A",
    muted: "#7A7065",
    grid: "#F1E7E5",
  },
  "cn-imperial-orange": {
    id: "cn-imperial-orange",
    series: "chinese-traditional",
    name: "橙绯红",
    description: "纁色、青矾绿、谷鞘红与烟蓝；暖色主调配合清晰冷色对照。",
    categorical: ["#D46D3A", "#2C9678", "#F17666", "#7BA4B8"],
    sequential: ["#F8E6DC", "#B6542E"],
    diverging: ["#91BEB0", "#FCF9F5", "#D4A08D"],
    ink: "#23242A",
    muted: "#786E68",
    grid: "#F1E7E5",
  },
  "cn-wisteria": {
    id: "cn-wisteria",
    series: "chinese-traditional",
    name: "淡藤萝紫",
    description: "藤萝紫、凤信紫、景泰蓝与颊红；避免近白色数据标记。",
    categorical: ["#8076A3", "#C8ADC4", "#2775B6", "#EEAA9C"],
    sequential: ["#F0EDF5", "#685D8C"],
    diverging: ["#9BB8D1", "#FCFAFC", "#C4A9BE"],
    ink: "#23242A",
    muted: "#786F82",
    grid: "#F1E7E5",
  },
  "cn-sunset": {
    id: "cn-sunset",
    series: "chinese-traditional",
    name: "瓜瓤粉",
    description: "瓜瓤粉、霁青、玉红与松霜绿；明快但保留期刊图表的克制感。",
    categorical: ["#F9CB8B", "#63BBD0", "#C04851", "#83A78D"],
    sequential: ["#FFF0D9", "#B67638"],
    diverging: ["#93C2CF", "#FFFAF4", "#D2A1A4"],
    ink: "#23242A",
    muted: "#7C7470",
    grid: "#F1E7E5",
  },
  "cn-hutong": {
    id: "cn-hutong",
    series: "chinese-traditional",
    name: "蓝墨茶",
    description: "蝶翅蓝、浅栗棕、鹅黄与梧枝绿；以蓝色为主轴的清爽组合。",
    categorical: ["#4E7CA1", "#C8A58E", "#F2C867", "#69A794"],
    sequential: ["#EAF1F6", "#3F6788"],
    diverging: ["#93B4CE", "#FAF9F6", "#D1AA91"],
    ink: "#23242A",
    muted: "#6F7478",
    grid: "#F1E7E5",
  },
  "cn-dragon": {
    id: "cn-dragon",
    series: "chinese-traditional",
    name: "棉絮灰",
    description: "中灰、晴山蓝、谷鞘红与梧枝绿；中性基底配合三种清晰强调色。",
    categorical: ["#A49C93", "#8FB2C9", "#F17666", "#69A794"],
    sequential: ["#F1F3F4", "#6F7F89"],
    diverging: ["#A5BDC9", "#FAF9F7", "#D0A3A0"],
    ink: "#23242A",
    muted: "#74706C",
    grid: "#F1E7E5",
  },
  "cn-coral": {
    id: "cn-coral",
    series: "chinese-traditional",
    name: "珊瑚朱",
    description: "珊瑚红、天水碧、景泰蓝与鹅黄；高识别度的冷暖四组配色。",
    categorical: ["#F04A3A", "#AED9D4", "#2775B6", "#F2C867"],
    sequential: ["#FDE8E3", "#C43D32"],
    diverging: ["#91B8CE", "#FCFAF7", "#D4A19B"],
    ink: "#23242A",
    muted: "#776D69",
    grid: "#F1E7E5",
  },
  "cn-autumn": {
    id: "cn-autumn",
    series: "chinese-traditional",
    name: "杏叶黄",
    description: "金莺黄、晴山蓝、藤萝紫与梅子青；适合多组比较的秋日明色。",
    categorical: ["#F4A83A", "#8FB2C9", "#8076A3", "#7BC092"],
    sequential: ["#FFF0D6", "#B87527"],
    diverging: ["#9CB9D0", "#FBFAF5", "#CCB18E"],
    ink: "#23242A",
    muted: "#746F68",
    grid: "#F1E7E5",
  },
  "cn-vermilion": {
    id: "cn-vermilion",
    series: "chinese-traditional",
    name: "中国红",
    description: "朱砂红、景泰蓝、金莺黄与青矾绿；保留中国红主色并增加跨色相区分。",
    categorical: ["#D92121", "#2775B6", "#F4A83A", "#2C9678"],
    sequential: ["#FDE5E3", "#B41C1C"],
    diverging: ["#91B6CC", "#FCF9F7", "#D1A09C"],
    ink: "#23242A",
    muted: "#746A68",
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
    return `${group.slice(0, 3)}_${String(index + 1).padStart(2, "0")}\t${x.toFixed(3)}\t${y.toFixed(3)}\t${group}`;
  }));
  return `sample\tdim1\tdim2\tgroup\n${rows.join("\n")}`;
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
    return `${truth}\t${Math.max(0.01, Math.min(0.99, score)).toFixed(4)}\t${model.name}`;
  }));
  return `truth\tscore\tmodel\n${rows.join("\n")}`;
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
  line: `time\tvalue\tsd\tsem\tseries
0\t1.0\t0.12\t0.05\tControl
1\t1.3\t0.16\t0.07\tControl
2\t1.6\t0.18\t0.08\tControl
3\t1.8\t0.21\t0.09\tControl
0\t1.0\t0.14\t0.06\tTreatment
1\t2.1\t0.24\t0.11\tTreatment
2\t3.5\t0.31\t0.14\tTreatment
3\t4.4\t0.38\t0.17\tTreatment`,
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
  heatmap: buildHeatmapExample(),
  enrichment: `term\tgeneRatio\tcount\tpadj\tgroup
Cell cycle\t0.36\t18\t0.0003\tBP
DNA repair\t0.30\t15\t0.0012\tBP
Apoptosis\t0.24\t12\t0.0041\tBP
PI3K-AKT signaling\t0.32\t16\t0.0008\tKEGG
p53 signaling\t0.22\t11\t0.0063\tKEGG
Focal adhesion\t0.18\t9\t0.018\tKEGG`,
  enrichmentFraction: `term\tgeneRatio\tcount\tpadj\tgroup
Cell cycle\t18/50\t18\t0.0003\tBP
DNA repair\t15/50\t15\t0.0012\tBP
Apoptosis\t12/50\t12\t0.0041\tBP
PI3K-AKT signaling\t16/50\t16\t0.0008\tKEGG
p53 signaling\t11/50\t11\t0.0063\tKEGG
Focal adhesion\t9/50\t9\t0.018\tKEGG`,
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
  pcoa: `sample\tdim1\tdim2\tgroup
Control_1\t-2.1\t0.8\tControl
Control_2\t-1.6\t1.2\tControl
Control_3\t-1.9\t0.2\tControl
Treatment_1\t1.4\t-0.5\tTreatment
Treatment_2\t2.0\t-0.9\tTreatment
Treatment_3\t1.7\t0.1\tTreatment`,
  umap: buildUmapExample(),
  gsea: buildGseaExample(),
  km: buildKaplanMeierExample(),
  forest: `label\testimate\tlower\tupper\tgroup
Age (per 10 years)\t1.22\t1.05\t1.42\tClinical
Male vs female\t1.11\t0.84\t1.47\tClinical
Stage III-IV\t2.08\t1.45\t2.98\tClinical
High signature\t1.73\t1.20\t2.49\tMolecular`,
  roc: buildRocExample(),
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
  network: `source\ttarget\tvalue\tgroup
Tumor\tT cell\t18\tImmune
Tumor\tMacrophage\t12\tImmune
Fibroblast\tTumor\t10\tStroma
Macrophage\tT cell\t7\tImmune
Endothelial\tTumor\t6\tStroma`,
  circos: `sourceChr\tsourceStart\tsourceEnd\ttargetChr\ttargetStart\ttargetEnd\tvalue
chr1\t12000000\t18000000\tchr5\t42000000\t47000000\t8
chr2\t35000000\t39000000\tchr8\t76000000\t80000000\t5
chr5\t60000000\t65000000\tchr12\t22000000\t26000000\t7
chr8\t18000000\t23000000\tchr1\t90000000\t96000000\t4`,
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
    examples: [
      { label: "Example 1", description: "Summary values with SD and SEM columns.", data: samples.bar, mapping: { category: "category", value: "value", error: "sd", group: "group" } },
      { label: "Example 2", description: "Category counts or proportions without error bars.", data: samples.barCount, mapping: { category: "category", value: "value", error: "", group: "group" } },
    ],
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
    examples: [
      { label: "Example 1", description: "Ordered means with SD and SEM columns.", data: samples.line, mapping: { x: "time", value: "value", error: "sd", series: "series" } },
      { label: "Example 2", description: "Ordered observations without an error column.", data: samples.lineNoError, mapping: { x: "time", value: "value", error: "", series: "series" } },
    ],
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
    id: "pca",
    name: "PCA",
    family: "Dimension reduction",
    summary: "Principal component analysis calculated from a wide high-dimensional feature matrix.",
    inputHint: "Wide matrix: the first column identifies features and remaining columns are observations. Inputs may be counts, non-negative abundance measurements, or already normalized continuous values.",
    roles: [
      { key: "x", label: "X component", kind: "number", required: true },
      { key: "y", label: "Y component", kind: "number", required: true },
      { key: "group", label: "Group", kind: "category", required: false },
      { key: "label", label: "Observation label", kind: "label", required: false },
    ],
    defaultMapping: { x: "PC1", y: "PC2", group: "group", label: "sample" },
    sampleData: samples.pca,
    examples: [
      { label: "Example 1", description: "Wide feature matrix with raw count columns.", data: samples.pca },
      { label: "Example 2", description: "Wide feature matrix with TPM/abundance columns.", data: samples.pcaAbundance },
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
    examples: [
      { label: "Example 1", description: "Gene ratio supplied as decimals.", data: samples.enrichment },
      { label: "Example 2", description: "Gene ratio supplied as fractions such as 18/50.", data: samples.enrichmentFraction },
    ],
  },
  {
    id: "correlation",
    name: "Correlation",
    family: "Association",
    summary: "Scatter, fitted line, and a directly calculated Pearson or Spearman coefficient.",
    inputHint: "One row per paired observation. The coefficient is calculated in the browser; no P value is fabricated.",
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
  ...(["beeswarm", "raincloud"] as const).map((id) => ({
    id,
    name: id === "beeswarm" ? "Beeswarm" : "Raincloud",
    family: "Distribution",
    summary: id === "beeswarm" ? "Deterministically packed raw observations without an enclosing box." : "Half-violin density, raw observations, and a compact median/IQR summary.",
    inputHint: "Long format: one row per raw observation. At least three values per group are recommended.",
    roles: [
      { key: "group", label: "Group", kind: "category" as const, required: true },
      { key: "value", label: "Value", kind: "number" as const, required: true },
    ],
    defaultMapping: { group: "group", value: "value" },
    sampleData: samples.distribution,
  })),
  ...(["pcoa", "umap"] as const).map((id) => ({
    id,
    name: id === "pcoa" ? "PCoA" : "UMAP",
    family: "Dimension reduction",
    summary: id === "pcoa" ? "Publication-ready display of principal-coordinate scores from a distance analysis." : "Publication-ready display of a precomputed UMAP embedding.",
    inputHint: id === "pcoa" ? "Upload PCoA coordinates produced from a documented distance metric. This plotter does not silently choose a distance." : "Upload precomputed UMAP coordinates; preserve the upstream seed and parameters in your analysis record.",
    roles: [
      { key: "x", label: id === "pcoa" ? "PCoA axis 1" : "UMAP 1", kind: "number" as const, required: true },
      { key: "y", label: id === "pcoa" ? "PCoA axis 2" : "UMAP 2", kind: "number" as const, required: true },
      { key: "group", label: "Group", kind: "category" as const, required: false },
      { key: "label", label: "Observation label", kind: "label" as const, required: false },
    ],
    defaultMapping: { x: "dim1", y: "dim2", group: "group", label: "sample" },
    sampleData: id === "pcoa" ? samples.pcoa : samples.umap,
  })),
  ...(["clustered-heatmap", "correlation-heatmap"] as const).map((id) => ({
    id,
    name: id === "clustered-heatmap" ? "Clustered heatmap" : "Correlation heatmap",
    family: "Matrix",
    summary: id === "clustered-heatmap" ? "Expression heatmap with deterministic average-linkage row and column ordering." : "Pearson or Spearman correlation calculated across numeric columns and displayed as a symmetric matrix.",
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
    inputHint: "One row per term; ratios may be decimals or fractions such as 8/40.",
    roles: [
      { key: "term", label: "Term", kind: "label", required: true },
      { key: "ratio", label: "Gene ratio", kind: "number", required: true },
      { key: "pValue", label: "Adjusted P value", kind: "number", required: true },
      { key: "group", label: "Ontology / group", kind: "category", required: false },
    ],
    defaultMapping: { term: "term", ratio: "geneRatio", pValue: "padj", group: "group" },
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
    summary: "ROC curves and trapezoidal AUC calculated directly from binary outcomes and continuous scores.",
    inputHint: "Truth must be 0/1. Use held-out or externally validated prediction scores to avoid optimistic performance.",
    roles: [
      { key: "truth", label: "True class (0 / 1)", kind: "number", required: true },
      { key: "score", label: "Prediction score", kind: "number", required: true },
      { key: "group", label: "Model", kind: "category", required: false },
    ],
    defaultMapping: { truth: "truth", score: "score", group: "model" },
    sampleData: samples.roc,
  },
  ...(["venn", "upset"] as const).map((id) => ({
    id,
    name: id === "venn" ? "Venn" : "UpSet",
    family: "Set relationships",
    summary: id === "venn" ? "Two- or three-set overlap with exact region counts." : "Scalable set intersections with membership matrix and ranked intersection sizes.",
    inputHint: id === "venn" ? "Long format item/set membership. Venn is restricted to 2–3 unique sets." : "Long format item/set membership; duplicate memberships are collapsed.",
    roles: [
      { key: "item", label: "Item", kind: "label" as const, required: true },
      { key: "set", label: "Set", kind: "category" as const, required: true },
    ],
    defaultMapping: { item: "item", set: "set" },
    sampleData: samples.sets,
  })),
  ...(["sankey", "chord"] as const).map((id) => ({
    id,
    name: id === "sankey" ? "Sankey" : "Chord",
    family: id === "sankey" ? "Flow" : "Relationships",
    summary: id === "sankey" ? "Weighted source-to-target flows with proportional node and ribbon widths." : "Circular weighted relationships between categorical sectors.",
    inputHint: "One row per edge with non-negative weight. Repeated edges are aggregated.",
    roles: [
      { key: "source", label: "Source", kind: "category" as const, required: true },
      { key: "target", label: "Target", kind: "category" as const, required: true },
      { key: "value", label: "Weight", kind: "number" as const, required: true },
      { key: "group", label: "Group", kind: "category" as const, required: false },
    ],
    defaultMapping: { source: "source", target: "target", value: "value", group: "group" },
    sampleData: samples.network,
  })),
  {
    id: "circos",
    name: "Circos",
    family: "Genomic context",
    summary: "Genomic sectors and inter-locus links using explicit chromosome intervals.",
    inputHint: "Each link needs source and target chromosome/start/end coordinates. Coordinates must be non-negative and end ≥ start.",
    roles: [
      { key: "sourceChr", label: "Source chromosome", kind: "category", required: true },
      { key: "sourceStart", label: "Source start", kind: "number", required: true },
      { key: "sourceEnd", label: "Source end", kind: "number", required: true },
      { key: "targetChr", label: "Target chromosome", kind: "category", required: true },
      { key: "targetStart", label: "Target start", kind: "number", required: true },
      { key: "targetEnd", label: "Target end", kind: "number", required: true },
      { key: "value", label: "Link weight", kind: "number", required: false },
    ],
    defaultMapping: { sourceChr: "sourceChr", sourceStart: "sourceStart", sourceEnd: "sourceEnd", targetChr: "targetChr", targetStart: "targetStart", targetEnd: "targetEnd", value: "value" },
    sampleData: samples.circos,
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
  boxplot: { citation: "McGill, Tukey & Larsen, 1978. Variations of Box Plots. The American Statistician.", href: "https://doi.org/10.1080/00031305.1978.10479236" },
  violin: { citation: "Hintze & Nelson, 1998. Violin Plots: A Box Plot-Density Trace Synergism. The American Statistician.", href: "https://doi.org/10.1080/00031305.1998.10480559" },
  rawData: { citation: "Weissgerber et al., 2015. Beyond Bar and Line Graphs: Time for a New Data Presentation Paradigm. PLoS Biol.", href: "https://doi.org/10.1371/journal.pbio.1002128" },
  raincloud: { citation: "Allen et al., 2021. Raincloud plots: a multi-platform tool for robust data visualization. Wellcome Open Res.", href: "https://doi.org/10.12688/wellcomeopenres.15191.2" },
  volcano: { citation: "Li, 2012. Volcano Plots in Analyzing Differential Expressions with mRNA Microarrays. J Bioinform Comput Biol.", href: "https://doi.org/10.1142/S0219720012310038" },
  ma: { citation: "Yang et al., 2002. Normalization for cDNA microarray data. Nucleic Acids Res.", href: "https://doi.org/10.1093/nar/30.4.e15" },
  lollipop: { citation: "Jay & Brouwer, 2016. Lollipops in the Clinic: Information Dense Mutation Plots for Precision Medicine. PLoS ONE.", href: "https://doi.org/10.1371/journal.pone.0160519" },
  heatmap: { citation: "Wilkinson & Friendly, 2009. The History of the Cluster Heat Map. The American Statistician.", href: "https://doi.org/10.1198/tas.2009.0033" },
  clusteredHeatmap: { citation: "Eisen et al., 1998. Cluster analysis and display of genome-wide expression patterns. PNAS.", href: "https://doi.org/10.1073/pnas.95.25.14863" },
  corrgram: { citation: "Friendly, 2002. Corrgrams: Exploratory Displays for Correlation Matrices. The American Statistician.", href: "https://doi.org/10.1198/000313002533" },
  enrichment: { citation: "Yu et al., 2012. clusterProfiler: an R package for comparing biological themes among gene clusters. OMICS.", href: "https://doi.org/10.1089/omi.2011.0118" },
  gsea: { citation: "Subramanian et al., 2005. Gene set enrichment analysis: a knowledge-based approach. PNAS.", href: "https://doi.org/10.1073/pnas.0506580102" },
  kaplanMeier: { citation: "Kaplan & Meier, 1958. Nonparametric Estimation from Incomplete Observations. JASA.", href: "https://doi.org/10.1080/01621459.1958.10501452" },
  forest: { citation: "Lewis & Clarke, 2001. Forest plots: trying to see the wood and the trees. BMJ.", href: "https://doi.org/10.1136/bmj.322.7300.1479" },
  roc: { citation: "Hanley & McNeil, 1982. The meaning and use of the area under a ROC curve. Radiology.", href: "https://doi.org/10.1148/radiology.143.1.7063747" },
  venn: { citation: "Venn, 1880. On the Diagrammatic and Mechanical Representation of Propositions and Reasonings. Philosophical Magazine.", href: "https://doi.org/10.1080/14786448008626877" },
  upset: { citation: "Lex et al., 2014. UpSet: Visualization of Intersecting Sets. IEEE TVCG.", href: "https://doi.org/10.1109/TVCG.2014.2346248" },
  sankeyHistory: { citation: "Schmidt, 2008. The Sankey Diagram in Energy and Material Flow Management: Part I. J Ind Ecol.", href: "https://doi.org/10.1111/j.1530-9290.2008.00004.x" },
  sankey: { citation: "Schmidt, 2008. The Sankey Diagram in Energy and Material Flow Management. J Ind Ecol.", href: "https://doi.org/10.1111/j.1530-9290.2008.00015.x" },
  chord: { citation: "Gu et al., 2014. circlize Implements and Enhances Circular Visualization in R. Bioinformatics.", href: "https://doi.org/10.1093/bioinformatics/btu393" },
  circos: { citation: "Krzywinski et al., 2009. Circos: An information aesthetic for comparative genomics. Genome Res.", href: "https://doi.org/10.1101/gr.092759.109" },
} satisfies Record<string, PlotReference>;

export const plotGuidance: Record<PlotType, PlotGuidance> = {
  bar: {
    definition: "用从共同基线出发的柱长编码离散类别的数值；每根柱表示一个汇总量，而不是完整的原始分布。",
    suitableData: "离散类别对应的汇总值、计数、比例或均值；可同时提供 SD/SEM。",
    answers: "不同类别的总体大小或汇总水平是否存在直观差异。",
    origin: "William Playfair 在 1786 年的《Commercial and Political Atlas》中用柱形比较贸易量，奠定了现代统计柱状图的形式。",
    references: [plotReferences.visualizationHistory, plotReferences.graphicalPerception, plotReferences.errorBars],
  },
  line: {
    definition: "按 X 的自然顺序连接相邻数据点，以位置和线段方向编码连续变化；连线本身暗示顺序或连续性。",
    suitableData: "具有自然顺序的连续或离散 X 数据，如时间、剂量、阶段及多条重复序列。",
    answers: "指标随顺序如何变化，不同序列的方向、速度或响应模式是否不同。",
    origin: "Playfair 同样在 1786 年用时间序列折线展示贸易变化，使“随时间阅读趋势”成为统计图形的核心用途。",
    references: [plotReferences.visualizationHistory, plotReferences.graphicalPerception, plotReferences.errorBars],
  },
  scatter: {
    definition: "把每个观察对象映射成二维坐标中的一个点，用点的位置同时表示两个连续变量。",
    suitableData: "每个观察对象具有两个连续数值，可附带分组和标签。",
    answers: "两变量的联合分布、可能关系、聚类结构和离群观察是什么。",
    references: [plotReferences.anscombe],
  },
  correlation: {
    definition: "在成对数值的散点分布基础上，用 Pearson 或 Spearman 系数量化关系方向与强度的关联图。",
    suitableData: "成对连续或有序数值；Pearson 适合线性关系，Spearman 适合单调关系或秩数据。",
    answers: "两变量关系的方向和强度如何；相关本身不说明因果。",
    references: [plotReferences.anscombe],
  },
  pca: {
    definition: "一种线性无监督降维方法，把高维数据旋转到相互正交、按解释方差由高到低排列的主成分轴。",
    suitableData: "高维特征×观察矩阵，如组学、影像特征、形态学、光谱、传感器或标准化临床特征。",
    answers: "主要变异轴是什么，观察对象是否聚集、分离或存在离群点，以及分组或批次是否与总体结构相关。",
    origin: "Karl Pearson 于 1901 年提出空间点的最佳拟合直线与平面，Harold Hotelling 在 1933 年进一步建立并命名主成分分析。",
    references: [plotReferences.pca],
  },
  pcoa: {
    definition: "从样本间距离或相异度矩阵出发，通过特征分解构造低维坐标；它不是直接对原始特征矩阵做 PCA。",
    suitableData: "由明确距离或相异度度量得到的 PCoA 坐标，常见于生态、微生物群、组成或其他距离型数据。",
    answers: "在所选距离定义下，各观察对象的相似性结构和组间分离情况如何。",
    origin: "J. C. Gower 在 1966 年系统阐述了从距离关系恢复主坐标的数学性质，因此 PCoA 也常称为 Gower 主坐标分析。",
    references: [plotReferences.pcoa],
  },
  umap: {
    definition: "一种非线性流形学习方法，先构建高维邻域图，再寻找尽量保留局部邻域结构的低维嵌入。",
    suitableData: "高维数据上游计算得到的 UMAP 坐标，如单细胞、多组学、影像或表型特征。",
    answers: "局部邻域、亚群和异质性结构如何；不宜把远距离直接解释为定量差异。",
    origin: "McInnes 等人在 2018 年发布 UMAP，把黎曼几何与拓扑思想转化为可扩展的通用降维算法。",
    references: [plotReferences.umap],
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
    references: [plotReferences.heatmap],
  },
  "clustered-heatmap": {
    definition: "先按指定距离和连接方法对行列进行层次聚类，再按树状图顺序重排热图；颜色和树结构表达的是两层信息。",
    suitableData: "可比较的数值矩阵；行列聚类前应明确缩放、距离和连接方法。",
    answers: "哪些行或列具有相似模式，是否形成候选亚群、模块或共变结构。",
    origin: "聚类热图有更早的统计学前身；Eisen 等人在 1998 年把它用于全基因组表达模式后，使其成为组学分析的经典图形。",
    references: [plotReferences.clusteredHeatmap, plotReferences.heatmap],
  },
  "correlation-heatmap": {
    definition: "以同一组变量同时作为行和列，用颜色编码每对变量的相关系数，因此矩阵通常对称且对角线为 1。",
    suitableData: "同一批观察上测量的多个连续或有序变量。",
    answers: "变量之间的相关方向、强度、冗余和潜在模块结构是什么。",
    origin: "Friendly 在 2002 年提出 corrgram 体系，强调同时用颜色、顺序和符号阅读相关矩阵结构。",
    references: [plotReferences.corrgram],
  },
  enrichment: {
    definition: "每个功能条目用一个点表示，通常以位置编码富集比例、点大小编码命中数、颜色编码校正 P 值。",
    suitableData: "富集结果表，包含条目、富集比例、命中数量和校正 P 值。",
    answers: "哪些功能条目同时具有较强统计证据、较高富集比例和足够命中数量。",
    origin: "这种多通道编码随着 clusterProfiler 等富集分析工具普及，用一个点同时压缩展示效应、规模和统计证据。",
    references: [plotReferences.enrichment],
  },
  "enrichment-bar": {
    definition: "每个功能条目对应一根横向或纵向柱，柱长编码富集比例、计数或效应量，主要用于清晰排序。",
    suitableData: "可排序的富集结果表，至少包含条目、富集比例或效应值及统计证据。",
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
    definition: "遍历二分类预测阈值，以假阳性率为 X、真阳性率为 Y，展示敏感度与特异度之间的权衡。",
    suitableData: "二分类真实标签与连续预测分数，最好来自验证集或外部队列。",
    answers: "模型区分两类对象的能力和不同阈值下敏感度/特异度权衡如何；不能说明校准。",
    origin: "ROC 的思想源自信号检测问题，随后进入诊断检验和预测模型评价；AUC 可解释为随机阳性样本得分高于随机阴性样本的概率。",
    references: [plotReferences.roc],
  },
  venn: {
    definition: "用重叠闭合区域表示集合及其交集；区域位置表达集合逻辑，但面积通常不严格按成员数成比例。",
    suitableData: "2–3 个集合的成员关系，如基因、蛋白、峰、样本或候选条目列表。",
    answers: "少量集合之间独有和共享成员各有多少。",
    origin: "John Venn 在 1880 年为形式逻辑系统化这类集合关系图；现代生物学后来把它用于少量基因或候选集合比较。",
    references: [plotReferences.venn],
  },
  upset: {
    definition: "用点阵列明确标出参与某个交集的集合，再用柱长显示该精确交集的大小。",
    suitableData: "三个及以上集合的成员关系，尤其适合交集组合较多的情况。",
    answers: "哪些集合组合构成主要交集，各交集和单集合规模分别多大。",
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
  circos: {
    definition: "以染色体或 contig 的真实坐标为圆周骨架，叠加同心数据轨道，并把连接精确锚定到两个基因组区间。",
    suitableData: "带染色体和起止坐标的基因组区段及区段间连接，如融合、重排或染色质互作。",
    answers: "事件位于哪些基因组区域，跨染色体或远距离连接的整体格局如何。",
    origin: "Krzywinski 等人在 2009 年创建 Circos 来展示比较基因组和结构变异；圆内连带只是它众多轨道中的一种。",
    references: [plotReferences.circos],
  },
};

export function getPlotDefinition(type: PlotType) {
  return plotDefinitions.find((definition) => definition.id === type) ?? plotDefinitions[0];
}

export function getPlotExamples(definition: PlotDefinition): PlotDataExample[] {
  return definition.examples?.length
    ? definition.examples
    : [{ label: "Example 1", description: "Default input template for this plot type.", data: definition.sampleData, mapping: definition.defaultMapping }];
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

  if (["heatmap", "clustered-heatmap", "correlation-heatmap"].includes(definition.id)) {
    if (dataset.headers.length < 3) errors.push("Heatmap data needs one row-label column and at least two numeric sample columns.");
    const numericHeaders = dataset.headers.slice(1);
    const invalid = dataset.rows.filter((row) => numericHeaders.some((header) => parseNumericValue(row[header]) === null));
    if (invalid.length > 0) errors.push(`${invalid.length} heatmap row${invalid.length === 1 ? "" : "s"} contain non-numeric or blank values.`);
    if (definition.id !== "correlation-heatmap" && dataset.rows.length > 250) errors.push("Heatmap previews are limited to 250 rows; select biologically justified features before plotting.");
    if (numericHeaders.length > 100) errors.push("Heatmap previews are limited to 100 numeric columns to preserve legibility and browser performance.");
    return { errors, warnings };
  }

  definition.roles.forEach((role) => {
    const column = mapping[role.key];
    if (role.required && !column) errors.push(`${role.label} must be mapped to a column.`);
    if (column && !dataset.headers.includes(column)) errors.push(`${role.label} references a missing column (${column}).`);
    if (column && role.kind === "number") {
      const invalidCount = dataset.rows.filter((row) => {
        const value = (definition.id === "enrichment" || definition.id === "enrichment-bar") && role.key === "ratio"
          ? parseRatioValue(row[column])
          : parseNumericValue(row[column]);
        return value === null;
      }).length;
      if (invalidCount > 0) errors.push(`${role.label} contains ${invalidCount} non-numeric or blank value${invalidCount === 1 ? "" : "s"}.`);
    }
  });

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

  if (definition.id === "bar" || definition.id === "line" || definition.id === "errorbar") {
    const errorType = definition.id === "bar" ? settings?.barErrorType : settings?.lineErrorType;
    if (definition.id !== "errorbar" && errorType !== undefined && errorType !== "none" && !mapping.error) {
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

  if (["box", "violin", "beeswarm", "raincloud"].includes(definition.id) && mapping.group) {
    const groups = groupNumericValues(dataset.rows, mapping.group, mapping.value);
    for (const [group, values] of groups) {
      if (values.length < 3) warnings.push(`${group} has n=${values.length}; distribution estimates are unstable.`);
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

  if (definition.id === "roc" && mapping.truth) {
    const invalidTruth = dataset.rows.filter((row) => ![0, 1].includes(parseNumericValue(row[mapping.truth]) ?? Number.NaN)).length;
    if (invalidTruth > 0) errors.push(`True class contains ${invalidTruth} value${invalidTruth === 1 ? "" : "s"} other than 0 or 1.`);
    const classes = new Set(dataset.rows.map((row) => parseNumericValue(row[mapping.truth])));
    if (invalidTruth === 0 && classes.size < 2) errors.push("ROC calculation requires both outcome classes (0 and 1).");
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

  if (definition.id === "venn" && mapping.set) {
    const setCount = new Set(dataset.rows.map((row) => row[mapping.set]).filter(Boolean)).size;
    if (setCount < 2 || setCount > 3) errors.push(`Venn diagrams require 2–3 unique sets; detected ${setCount}. Use UpSet for more sets.`);
  }

  if (["sankey", "chord"].includes(definition.id) && mapping.value) {
    const negativeWeights = dataset.rows.filter((row) => (parseNumericValue(row[mapping.value]) ?? 0) < 0).length;
    if (negativeWeights > 0) errors.push(`Weight contains ${negativeWeights} negative value${negativeWeights === 1 ? "" : "s"}.`);
    if (dataset.rows.length > 250) warnings.push("More than 250 network edges will be visually dense; filter or aggregate before publication.");
  }

  if (definition.id === "circos") {
    const invalidIntervals = dataset.rows.filter((row) => {
      const ss = parseNumericValue(row[mapping.sourceStart]);
      const se = parseNumericValue(row[mapping.sourceEnd]);
      const ts = parseNumericValue(row[mapping.targetStart]);
      const te = parseNumericValue(row[mapping.targetEnd]);
      return ss === null || se === null || ts === null || te === null || ss < 0 || ts < 0 || se < ss || te < ts;
    }).length;
    if (invalidIntervals > 0) errors.push(`${invalidIntervals} Circos row${invalidIntervals === 1 ? " has" : "s have"} invalid genomic intervals.`);
    if (dataset.rows.length > 500) warnings.push("More than 500 Circos links may obscure structure; consider filtering by evidence or weight.");
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
