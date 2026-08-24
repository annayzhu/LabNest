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
  featuresComplete: number;
  featuresVariable: number;
  featuresUsed: number;
  explainedVariance: number[];
  loadings: Array<{ feature: string; coordinates: number[] }>;
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
    featuresComplete: 0,
    featuresVariable: 0,
    featuresUsed: 0,
    explainedVariance: [],
    loadings: [],
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
    return observed > 0 && numeric / observed >= 0.8;
  });
}

function sampleNameFromColumn(column: string) {
  return column.replace(/_(count|counts|tpm|fpkm)$/i, "");
}

export function inferPcaGroup(sampleName: string) {
  const withoutReplicate = sampleName.replace(/(?:[_ .-]\d+)$/u, "").replace(/[_ .-]+$/u, "");
  return withoutReplicate || sampleName;
}

function variance(values: number[]) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
}

function vectorNorm(values: number[]) {
  return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
}

export function nipalsPca(matrix: number[][], maximumComponents: number, denominator: number, maximumIterations = 200) {
  const residual = matrix.map((row) => [...row]);
  const featureCount = residual.length;
  const sampleCount = residual[0]?.length ?? 0;
  const components: Array<{ value: number; scores: number[]; loadings: number[] }> = [];
  let converged = true;
  for (let componentIndex = 0; componentIndex < Math.min(maximumComponents, featureCount, Math.max(0, sampleCount - 1)); componentIndex += 1) {
    const initialRow = residual.reduce((best, row) => row.reduce((sum, value) => sum + value * value, 0) > best.reduce((sum, value) => sum + value * value, 0) ? row : best, residual[0]);
    let scores = [...initialRow];
    if (vectorNorm(scores) <= 1e-12) break;
    let loadings = Array(featureCount).fill(0) as number[];
    let componentConverged = false;
    for (let iteration = 0; iteration < maximumIterations; iteration += 1) {
      const scoreNormSquared = scores.reduce((sum, value) => sum + value * value, 0);
      if (scoreNormSquared <= 1e-24) break;
      loadings = residual.map((row) => row.reduce((sum, value, sampleIndex) => sum + value * scores[sampleIndex], 0) / scoreNormSquared);
      const loadingNorm = vectorNorm(loadings);
      if (loadingNorm <= 1e-12) break;
      loadings = loadings.map((value) => value / loadingNorm);
      const nextScores = Array.from({ length: sampleCount }, (_, sampleIndex) => residual.reduce((sum, row, featureIndex) => sum + row[sampleIndex] * loadings[featureIndex], 0));
      const nextNorm = vectorNorm(nextScores);
      const directDifference = Math.sqrt(nextScores.reduce((sum, value, index) => sum + (value - scores[index]) ** 2, 0));
      const flippedDifference = Math.sqrt(nextScores.reduce((sum, value, index) => sum + (value + scores[index]) ** 2, 0));
      scores = nextScores;
      if (Math.min(directDifference, flippedDifference) <= 1e-10 * Math.max(1, nextNorm)) { componentConverged = true; break; }
    }
    const scoreNormSquared = scores.reduce((sum, value) => sum + value * value, 0);
    const value = scoreNormSquared / denominator;
    if (value <= 1e-12) break;
    if (!componentConverged) { converged = false; break; }
    const anchor = scores.reduce((best, score) => Math.abs(score) > Math.abs(best) ? score : best, 0);
    if (anchor < 0) {
      scores = scores.map((score) => -score);
      loadings = loadings.map((loading) => -loading);
    }
    components.push({ value, scores, loadings });
    residual.forEach((row, featureIndex) => row.forEach((entry, sampleIndex) => { row[sampleIndex] = entry - loadings[featureIndex] * scores[sampleIndex]; }));
  }
  return { components, converged };
}

function formatScore(value: number) {
  return Number.isFinite(value) ? value.toPrecision(8) : "0";
}

export function analyzeExpressionMatrix(raw: string, options: PcaOptions = defaultPcaOptions, observationMetadataRaw = ""): PcaAnalysisResult {
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
  if (selectedColumns.length > 300) {
    return { ...emptyResult([`Browser PCA is limited to 300 observations; detected ${selectedColumns.length}. Compute PCA in a documented external workflow and import the coordinates instead.`], delimiterName), availableLayers };
  }
  const sampleNames = selectedColumns.map(sampleNameFromColumn);
  const duplicateSampleNames = [...new Set(sampleNames.filter((sample, index) => sampleNames.indexOf(sample) !== index))];
  if (duplicateSampleNames.length > 0) {
    return { ...emptyResult([`Observation names must remain unique after removing data-layer suffixes; duplicates: ${duplicateSampleNames.slice(0, 6).join(", ")}.`], delimiterName), availableLayers };
  }

  const columnIndexes = selectedColumns.map((column) => headers.indexOf(column));
  const rawFeatures: Array<{ feature: string; values: number[] }> = [];
  const seenFeatureIds = new Set<string>();
  const duplicateFeatureIds = new Set<string>();
  const blankFeatureRows: number[] = [];
  let malformedRows = 0;
  let incompleteRows = 0;
  for (const line of lines.slice(1)) {
    const cells = splitLine(line, delimiter);
    if (cells.length !== headers.length) {
      malformedRows += 1;
      continue;
    }
    const selectedCells = columnIndexes.map((index) => cells[index]);
    if (selectedCells.some((value) => value === undefined || value.trim() === "")) {
      incompleteRows += 1;
      continue;
    }
    const values = selectedCells.map((value) => Number(value));
    if (values.some((value) => !Number.isFinite(value))) {
      incompleteRows += 1;
      continue;
    }
    const feature = cells[0]?.trim();
    if (!feature) {
      blankFeatureRows.push(rawFeatures.length + malformedRows + incompleteRows + blankFeatureRows.length + 2);
      continue;
    }
    if (seenFeatureIds.has(feature)) duplicateFeatureIds.add(feature);
    seenFeatureIds.add(feature);
    rawFeatures.push({ feature, values });
  }

  if (blankFeatureRows.length > 0) {
    return { ...emptyResult([`Feature IDs must not be blank; affected input row${blankFeatureRows.length === 1 ? "" : "s"}: ${blankFeatureRows.slice(0, 6).join(", ")}.`], delimiterName), availableLayers, featuresRead: lines.length - 1, featuresComplete: rawFeatures.length };
  }

  if (duplicateFeatureIds.size > 0) {
    return { ...emptyResult([`Feature IDs must be unique for traceable PCA loadings; duplicates: ${[...duplicateFeatureIds].slice(0, 6).join(", ")}.`], delimiterName), availableLayers, featuresRead: lines.length - 1, featuresComplete: rawFeatures.length };
  }

  if (rawFeatures.length < 2) {
    return { ...emptyResult(["The selected observation columns do not contain enough complete numeric feature rows."], delimiterName), availableLayers };
  }

  const inferredLayer: Exclude<PcaDataLayer, "auto"> = options.dataLayer !== "auto"
    ? options.dataLayer
    : countColumns.length >= 3
      ? "counts"
      : abundanceColumns.length >= 3
        ? "abundance"
        : "normalized";

  if ((inferredLayer === "counts" || inferredLayer === "abundance") && rawFeatures.some((feature) => feature.values.some((value) => value < 0))) {
    return { ...emptyResult([`${inferredLayer === "counts" ? "Counts" : "Non-negative abundance values"} cannot contain negative values.`], delimiterName), availableLayers };
  }

  const librarySizes = Array.from({ length: selectedColumns.length }, (_, sampleIndex) => rawFeatures.reduce((sum, feature) => sum + feature.values[sampleIndex], 0));
  if (inferredLayer === "counts" && librarySizes.some((size) => size <= 0)) {
    return { ...emptyResult(["Every count-matrix observation must have a positive column total."], delimiterName), availableLayers };
  }

  const minimumSamples = Math.min(3, Math.max(2, Math.floor(selectedColumns.length / 4)));
  const transformed = rawFeatures.flatMap((feature) => {
    if (inferredLayer === "counts" && feature.values.filter((value) => value >= 10).length < minimumSamples) return [];
    const values = inferredLayer === "counts"
      ? feature.values.map((value, sampleIndex) => Math.log2((value / librarySizes[sampleIndex]) * 1_000_000 + 1))
      : inferredLayer === "abundance"
        ? feature.values.map((value) => Math.log2(value + 1))
        : feature.values;
    const featureVariance = variance(values);
    return featureVariance > 0 ? [{ feature: feature.feature, values, variance: featureVariance }] : [];
  });

  transformed.sort((left, right) => right.variance - left.variance);
  const selectedFeatures = options.topVariableFeatures > 0 ? transformed.slice(0, options.topVariableFeatures) : transformed;
  if (selectedFeatures.length < 2) {
    return { ...emptyResult(["Too few variable features remain after filtering."], delimiterName), availableLayers, featuresRead: lines.length - 1, featuresComplete: rawFeatures.length, featuresVariable: transformed.length };
  }

  const sampleCount = selectedColumns.length;
  if (selectedFeatures.length * sampleCount > 1_000_000) {
    return { ...emptyResult([`Browser PCA is limited to one million selected feature-by-observation cells; detected ${(selectedFeatures.length * sampleCount).toLocaleString()}. Reduce top-variable features or import externally computed coordinates.`], delimiterName), availableLayers, featuresRead: lines.length - 1, featuresComplete: rawFeatures.length, featuresVariable: transformed.length };
  }
  const centeredFeatures: Array<{ feature: string; values: number[] }> = [];
  for (const feature of selectedFeatures) {
    const mean = feature.values.reduce((sum, value) => sum + value, 0) / sampleCount;
    const centered = feature.values.map((value) => value - mean);
    if (options.scaleFeatures) {
      const standardDeviation = Math.sqrt(variance(feature.values));
      if (standardDeviation > 0) centered.forEach((value, index) => { centered[index] = value / standardDeviation; });
    }
    centeredFeatures.push({ feature: feature.feature, values: centered });
  }
  const denominator = Math.max(1, sampleCount - 1);
  const decomposition = nipalsPca(centeredFeatures.map((feature) => feature.values), 10, denominator);
  if (!decomposition.converged) {
    return { ...emptyResult(["PCA NIPALS solver did not converge for this matrix. Reduce the observation count or compute PCA in a documented external workflow."], delimiterName), availableLayers, featuresRead: lines.length - 1, featuresComplete: rawFeatures.length, featuresVariable: transformed.length };
  }
  const components = decomposition.components.filter((component) => component.value > 1e-12);
  if (components.length < 2) {
    return { ...emptyResult(["PCA needs at least two non-zero components; the selected observations may be identical."], delimiterName), availableLayers, featuresRead: lines.length - 1, featuresComplete: rawFeatures.length, featuresVariable: transformed.length };
  }
  const totalVariance = centeredFeatures.reduce((sum, feature) => sum + feature.values.reduce((rowSum, value) => rowSum + value * value, 0), 0) / denominator;
  const explainedVariance = components.map((component) => component.value / totalVariance);
  const componentScores = components.map((component) => component.scores);
  const loadings = centeredFeatures.map((feature, featureIndex) => ({
    feature: feature.feature,
    coordinates: components.map((component) => component.loadings[featureIndex]),
  }));
  const metadataLines = normalizeLines(observationMetadataRaw);
  const metadataErrors: string[] = [];
  const metadataWarnings: string[] = [];
  let metadataHeaders: string[] = [];
  const metadataBySample = new Map<string, Record<string, string>>();
  if (metadataLines.length > 0) {
    const metadataDelimiter = detectDelimiter(metadataLines[0]);
    const headers = splitLine(metadataLines[0], metadataDelimiter);
    metadataHeaders = headers.slice(1);
    if (headers.length < 2) metadataErrors.push("PCA observation metadata needs a sample-ID column and at least one annotation column.");
    if (new Set(headers).size !== headers.length) metadataErrors.push("PCA observation metadata headers must be unique.");
    if (metadataHeaders.some((header) => header === "sample" || /^PC\d+$/i.test(header))) metadataErrors.push("PCA observation metadata columns cannot be named sample or PC1, PC2, and so on.");
    metadataLines.slice(1).forEach((line, rowIndex) => {
      const cells = splitLine(line, metadataDelimiter);
      if (cells.length !== headers.length) { metadataErrors.push(`PCA observation metadata row ${rowIndex + 2} has ${cells.length} fields; expected ${headers.length}.`); return; }
      const sampleId = cells[0]?.trim();
      if (!sampleId) { metadataErrors.push(`PCA observation metadata row ${rowIndex + 2} has a blank sample ID.`); return; }
      if (metadataBySample.has(sampleId)) { metadataErrors.push(`PCA observation metadata sample IDs must be unique; duplicate: ${sampleId}.`); return; }
      metadataBySample.set(sampleId, Object.fromEntries(metadataHeaders.map((header, index) => [header, cells[index + 1] ?? ""])));
    });
    const missing = sampleNames.filter((sample) => !metadataBySample.has(sample));
    const extra = [...metadataBySample.keys()].filter((sample) => !sampleNames.includes(sample));
    if (missing.length > 0) metadataErrors.push(`PCA observation metadata is missing ${missing.length} sample ID${missing.length === 1 ? "" : "s"}: ${missing.slice(0, 6).join(", ")}${missing.length > 6 ? "…" : ""}.`);
    if (extra.length > 0) metadataWarnings.push(`${extra.length} PCA observation metadata row${extra.length === 1 ? " does" : "s do"} not match a matrix observation and will be ignored: ${extra.slice(0, 6).join(", ")}${extra.length > 6 ? "…" : ""}.`);
  }
  const groupValues = sampleNames.map((sample) => metadataBySample.get(sample)?.group ?? inferPcaGroup(sample));
  const groups = [...new Set(groupValues)];
  const rows = sampleNames.map((sample, sampleIndex) => Object.fromEntries([
    ["sample", sample],
    ["group", groupValues[sampleIndex]],
    ...metadataHeaders.filter((header) => header !== "group").map((header) => [header, metadataBySample.get(sample)?.[header] ?? ""]),
    ...componentScores.map((scores, componentIndex) => [`PC${componentIndex + 1}`, formatScore(scores[sampleIndex])]),
  ]));
  const warnings: string[] = [...metadataWarnings];
  if (malformedRows > 0) warnings.push(`${malformedRows} malformed feature row${malformedRows === 1 ? " was" : "s were"} skipped.`);
  if (incompleteRows > 0) warnings.push(`${incompleteRows} feature row${incompleteRows === 1 ? " was" : "s were"} skipped because selected observation values were incomplete.`);
  if (options.dataLayer === "auto") warnings.push(inferredLayer === "counts" ? "Auto-detected count columns from explicit _count/_counts suffixes." : inferredLayer === "abundance" ? "Auto-detected abundance columns from explicit _tpm/_fpkm suffixes." : "No explicit count/TPM/FPKM suffixes were detected; values were treated as continuous / already normalized without a log transform.");

  const transformation = inferredLayer === "counts"
    ? `Features with count ≥10 in at least ${minimumSamples} observations; log₂(CPM + 1)`
    : inferredLayer === "abundance"
      ? "log₂(non-negative abundance + 1)"
      : "No log transformation";
  warnings.push(`${selectedFeatures.length.toLocaleString()} top-variable feature${selectedFeatures.length === 1 ? "" : "s"} used; features were centered${options.scaleFeatures ? " and scaled to unit variance" : " without unit-variance scaling"}.`);

  return {
    dataset: {
      headers: ["sample", "group", ...metadataHeaders.filter((header) => header !== "group"), ...componentScores.map((_, index) => `PC${index + 1}`)],
      rows,
      delimiter: delimiterName,
      errors: metadataErrors,
      warnings,
      analysis: { pca: { explainedVariance, loadings } },
    },
    detectedLayer: inferredLayer,
    sampleColumns: selectedColumns,
    sampleNames,
    groups,
    availableLayers,
    featuresRead: lines.length - 1,
    featuresComplete: rawFeatures.length,
    featuresVariable: transformed.length,
    featuresUsed: selectedFeatures.length,
    explainedVariance,
    loadings,
    transformation,
  };
}
