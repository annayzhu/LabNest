import type { ParsedDataset } from "@/lib/visualization-studio";

export type PcaDataLayer = "auto" | "counts" | "abundance" | "normalized";

export type PcaOptions = {
  dataLayer: PcaDataLayer;
  topVariableFeatures: number;
  scaleFeatures: boolean;
};

export type PcaAnalysisResult = {
  dataset: ParsedDataset;
  detectedLayer: Exclude<PcaDataLayer, "auto"> | null;
  sampleColumns: string[];
  sampleNames: string[];
  groups: string[];
  availableLayers: Array<{ id: "counts" | "abundance"; label: string; columns: number }>;
  featuresRead: number;
  featuresUsed: number;
  explainedVariance: number[];
  transformation: string;
};

export const defaultPcaOptions: PcaOptions = {
  dataLayer: "auto",
  topVariableFeatures: 2_000,
  scaleFeatures: false,
};

const annotationHeader = /^(gene([_. -]?(id|name|symbol|chr|chromosome|start|end|strand|length|biotype|description))?|feature([_. -]?id)?|transcript([_. -]?id)?|family|tf_family)$/i;
const resultHeader = /(^|[_ .-])(p(value)?|padj|fdr|qvalue|log2?f(old)?c(hange)?|foldchange|basemean|stat|lfcse)([_ .-]|$)/i;

function normalizeLines(raw: string) {
  return raw.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n").filter((line) => line.trim().length > 0);
}

function detectDelimiter(line: string) {
  return line.includes("\t") ? "\t" : ",";
}

function splitLine(line: string, delimiter: string) {
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
      } else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
    } else current += character;
  }
  cells.push(current.trim());
  return cells;
}

function emptyResult(errors: string[], delimiter: "tab" | "comma" = "tab"): PcaAnalysisResult {
  return {
    dataset: { headers: ["sample", "group", "PC1", "PC2"], rows: [], delimiter, errors, warnings: [] },
    detectedLayer: null,
    sampleColumns: [],
    sampleNames: [],
    groups: [],
    availableLayers: [],
    featuresRead: 0,
    featuresUsed: 0,
    explainedVariance: [],
    transformation: "",
  };
}

function isExcludedNumericHeader(header: string, firstHeader: string) {
  const normalized = header.trim();
  return normalized === firstHeader || annotationHeader.test(normalized) || resultHeader.test(normalized) || /vs/i.test(normalized);
}

function numericCandidateColumns(headers: string[], previewRows: string[][]) {
  const firstHeader = headers[0];
  return headers.filter((header, columnIndex) => {
    if (isExcludedNumericHeader(header, firstHeader)) return false;
    let numeric = 0;
    let observed = 0;
    for (const row of previewRows) {
      const rawValue = row[columnIndex];
      if (rawValue === undefined || rawValue.trim() === "") continue;
      observed += 1;
      if (Number.isFinite(Number(rawValue))) numeric += 1;
    }
    return observed > 0 && numeric / observed >= 0.95;
  });
}

function sampleNameFromColumn(column: string) {
  return column.replace(/_(count|counts|tpm|fpkm)$/i, "");
}

export function inferPcaGroup(sampleName: string) {
  const withoutReplicate = sampleName.replace(/(?:[_ .-]?\d+)$/u, "").replace(/[_ .-]+$/u, "");
  return withoutReplicate || sampleName;
}

function variance(values: number[]) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
}

function identity(size: number): number[][] {
  return Array.from({ length: size }, (_, row): number[] => Array.from({ length: size }, (_, column): number => row === column ? 1 : 0));
}

function symmetricEigenDecomposition(input: number[][]) {
  const size = input.length;
  const matrix = input.map((row) => [...row]);
  const vectors = identity(size);
  const maximumIterations = Math.max(80, size * size * 40);

  for (let iteration = 0; iteration < maximumIterations; iteration += 1) {
    let p = 0;
    let q = 1;
    let maximum = 0;
    for (let row = 0; row < size; row += 1) {
      for (let column = row + 1; column < size; column += 1) {
        const magnitude = Math.abs(matrix[row][column]);
        if (magnitude > maximum) {
          maximum = magnitude;
          p = row;
          q = column;
        }
      }
    }
    if (maximum < 1e-10) break;

    const angle = 0.5 * Math.atan2(2 * matrix[p][q], matrix[q][q] - matrix[p][p]);
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const app = matrix[p][p];
    const aqq = matrix[q][q];
    const apq = matrix[p][q];

    matrix[p][p] = cosine * cosine * app - 2 * sine * cosine * apq + sine * sine * aqq;
    matrix[q][q] = sine * sine * app + 2 * sine * cosine * apq + cosine * cosine * aqq;
    matrix[p][q] = 0;
    matrix[q][p] = 0;

    for (let index = 0; index < size; index += 1) {
      if (index !== p && index !== q) {
        const aip = matrix[index][p];
        const aiq = matrix[index][q];
        matrix[index][p] = cosine * aip - sine * aiq;
        matrix[p][index] = matrix[index][p];
        matrix[index][q] = sine * aip + cosine * aiq;
        matrix[q][index] = matrix[index][q];
      }
      const vip = vectors[index][p];
      const viq = vectors[index][q];
      vectors[index][p] = cosine * vip - sine * viq;
      vectors[index][q] = sine * vip + cosine * viq;
    }
  }

  return Array.from({ length: size }, (_, index) => ({
    value: Math.max(0, matrix[index][index]),
    vector: vectors.map((row) => row[index]),
  })).sort((left, right) => right.value - left.value);
}

function formatScore(value: number) {
  return Number.isFinite(value) ? value.toPrecision(8) : "0";
}

export function analyzeExpressionMatrix(raw: string, options: PcaOptions = defaultPcaOptions): PcaAnalysisResult {
  const lines = normalizeLines(raw);
  if (lines.length < 2) return emptyResult(["Upload or paste a feature-by-observation matrix."]);

  const delimiter = detectDelimiter(lines[0]);
  const delimiterName = delimiter === "\t" ? "tab" : "comma";
  const headers = splitLine(lines[0], delimiter);
  if (headers.length < 4) return emptyResult(["PCA needs a feature column and at least three observation columns."], delimiterName);
  if (new Set(headers).size !== headers.length) return emptyResult(["Feature-matrix column headers must be unique."], delimiterName);

  const previewRows = lines.slice(1, 51).map((line) => splitLine(line, delimiter));
  const countColumns = headers.filter((header) => /_(count|counts)$/i.test(header));
  const abundanceColumns = headers.filter((header) => /_(tpm|fpkm)$/i.test(header));
  const numericColumns = numericCandidateColumns(headers, previewRows);
  const availableLayers: PcaAnalysisResult["availableLayers"] = [];
  if (countColumns.length >= 3) availableLayers.push({ id: "counts", label: "Raw count", columns: countColumns.length });
  if (abundanceColumns.length >= 3) availableLayers.push({ id: "abundance", label: headers.some((header) => /_tpm$/i.test(header)) ? "TPM / FPKM" : "FPKM", columns: abundanceColumns.length });

  let selectedColumns: string[];
  if (options.dataLayer === "counts") selectedColumns = countColumns.length >= 3 ? countColumns : numericColumns;
  else if (options.dataLayer === "abundance") selectedColumns = abundanceColumns.length >= 3 ? abundanceColumns : numericColumns;
  else if (options.dataLayer === "normalized") selectedColumns = numericColumns;
  else if (countColumns.length >= 3) selectedColumns = countColumns;
  else if (abundanceColumns.length >= 3) selectedColumns = abundanceColumns;
  else selectedColumns = numericColumns;

  if (selectedColumns.length < 3) {
    return { ...emptyResult(["Could not identify at least three numeric observation columns. Choose a data layer or remove annotation-only columns."], delimiterName), availableLayers };
  }

  const columnIndexes = selectedColumns.map((column) => headers.indexOf(column));
  const rawFeatures: number[][] = [];
  let malformedRows = 0;
  let incompleteRows = 0;
  for (const line of lines.slice(1)) {
    const cells = splitLine(line, delimiter);
    if (cells.length !== headers.length) {
      malformedRows += 1;
      continue;
    }
    const values = columnIndexes.map((index) => Number(cells[index]));
    if (values.some((value) => !Number.isFinite(value))) {
      incompleteRows += 1;
      continue;
    }
    rawFeatures.push(values);
  }

  if (rawFeatures.length < 2) {
    return { ...emptyResult(["The selected observation columns do not contain enough complete numeric feature rows."], delimiterName), availableLayers };
  }

  const flattenedPreview = rawFeatures.slice(0, 500).flat();
  const allNonNegative = flattenedPreview.every((value) => value >= 0);
  const integerRatio = flattenedPreview.filter(Number.isInteger).length / Math.max(1, flattenedPreview.length);
  const inferredLayer: Exclude<PcaDataLayer, "auto"> = options.dataLayer !== "auto"
    ? options.dataLayer
    : countColumns.length >= 3 || (allNonNegative && integerRatio >= 0.995)
      ? "counts"
      : abundanceColumns.length >= 3 || allNonNegative
        ? "abundance"
        : "normalized";

  if ((inferredLayer === "counts" || inferredLayer === "abundance") && rawFeatures.some((feature) => feature.some((value) => value < 0))) {
    return { ...emptyResult([`${inferredLayer === "counts" ? "Counts" : "Non-negative abundance values"} cannot contain negative values.`], delimiterName), availableLayers };
  }

  const librarySizes = Array.from({ length: selectedColumns.length }, (_, sampleIndex) => rawFeatures.reduce((sum, feature) => sum + feature[sampleIndex], 0));
  if (inferredLayer === "counts" && librarySizes.some((size) => size <= 0)) {
    return { ...emptyResult(["Every count-matrix observation must have a positive column total."], delimiterName), availableLayers };
  }

  const minimumSamples = Math.min(3, Math.max(2, Math.floor(selectedColumns.length / 4)));
  const transformed = rawFeatures.flatMap((feature) => {
    if (inferredLayer === "counts" && feature.filter((value) => value >= 10).length < minimumSamples) return [];
    const values = inferredLayer === "counts"
      ? feature.map((value, sampleIndex) => Math.log2((value / librarySizes[sampleIndex]) * 1_000_000 + 1))
      : inferredLayer === "abundance"
        ? feature.map((value) => Math.log2(value + 1))
        : feature;
    const featureVariance = variance(values);
    return featureVariance > 0 ? [{ values, variance: featureVariance }] : [];
  });

  transformed.sort((left, right) => right.variance - left.variance);
  const selectedFeatures = options.topVariableFeatures > 0 ? transformed.slice(0, options.topVariableFeatures) : transformed;
  if (selectedFeatures.length < 2) {
    return { ...emptyResult(["Too few variable features remain after filtering."], delimiterName), availableLayers };
  }

  const sampleCount = selectedColumns.length;
  const gram = Array.from({ length: sampleCount }, () => Array(sampleCount).fill(0) as number[]);
  for (const feature of selectedFeatures) {
    const mean = feature.values.reduce((sum, value) => sum + value, 0) / sampleCount;
    const centered = feature.values.map((value) => value - mean);
    if (options.scaleFeatures) {
      const standardDeviation = Math.sqrt(variance(feature.values));
      if (standardDeviation > 0) centered.forEach((value, index) => { centered[index] = value / standardDeviation; });
    }
    for (let row = 0; row < sampleCount; row += 1) {
      for (let column = row; column < sampleCount; column += 1) {
        gram[row][column] += centered[row] * centered[column];
      }
    }
  }
  const denominator = Math.max(1, sampleCount - 1);
  for (let row = 0; row < sampleCount; row += 1) {
    for (let column = row; column < sampleCount; column += 1) {
      gram[row][column] /= denominator;
      gram[column][row] = gram[row][column];
    }
  }

  const components = symmetricEigenDecomposition(gram).filter((component) => component.value > 1e-12);
  if (components.length < 2) {
    return { ...emptyResult(["PCA needs at least two non-zero components; the selected observations may be identical."], delimiterName), availableLayers };
  }
  const totalVariance = components.reduce((sum, component) => sum + component.value, 0);
  const explainedVariance = components.map((component) => component.value / totalVariance);
  const componentScores = components.slice(0, Math.min(10, components.length)).map((component) => {
    const scale = Math.sqrt(component.value * denominator);
    const scores = component.vector.map((value) => value * scale);
    const anchor = scores.reduce((best, value) => Math.abs(value) > Math.abs(best) ? value : best, 0);
    return anchor < 0 ? scores.map((value) => -value) : scores;
  });
  const sampleNames = selectedColumns.map(sampleNameFromColumn);
  const groupValues = sampleNames.map(inferPcaGroup);
  const groups = [...new Set(groupValues)];
  const rows = sampleNames.map((sample, sampleIndex) => Object.fromEntries([
    ["sample", sample],
    ["group", groupValues[sampleIndex]],
    ...componentScores.map((scores, componentIndex) => [`PC${componentIndex + 1}`, formatScore(scores[sampleIndex])]),
  ]));
  const warnings: string[] = [];
  if (malformedRows > 0) warnings.push(`${malformedRows} malformed feature row${malformedRows === 1 ? " was" : "s were"} skipped.`);
  if (incompleteRows > 0) warnings.push(`${incompleteRows} feature row${incompleteRows === 1 ? " was" : "s were"} skipped because selected observation values were incomplete.`);
  if (options.dataLayer === "auto") warnings.push(`Auto-detected ${inferredLayer === "counts" ? "count-like values" : inferredLayer === "abundance" ? "non-negative abundance values" : "continuous / already normalized values"}.`);

  const transformation = inferredLayer === "counts"
    ? `Features with count ≥10 in at least ${minimumSamples} observations; log₂(CPM + 1)`
    : inferredLayer === "abundance"
      ? "log₂(non-negative abundance + 1)"
      : "No log transformation";
  warnings.push(`${selectedFeatures.length.toLocaleString()} top-variable feature${selectedFeatures.length === 1 ? "" : "s"} used; features were centered${options.scaleFeatures ? " and scaled to unit variance" : " without unit-variance scaling"}.`);

  return {
    dataset: {
      headers: ["sample", "group", ...componentScores.map((_, index) => `PC${index + 1}`)],
      rows,
      delimiter: delimiterName,
      errors: [],
      warnings,
    },
    detectedLayer: inferredLayer,
    sampleColumns: selectedColumns,
    sampleNames,
    groups,
    availableLayers,
    featuresRead: rawFeatures.length,
    featuresUsed: selectedFeatures.length,
    explainedVariance,
    transformation,
  };
}
