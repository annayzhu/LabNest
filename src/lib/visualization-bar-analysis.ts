import { regularizedIncompleteBeta } from "./visualization-advanced";

export type BarAnalysisMode = "none" | "supplied" | "raw-independent" | "summary-independent" | "raw-paired" | "qpcr-delta-ct";
export type BarPAdjustment = "none" | "holm" | "bh";

export type BarAnalysisMapping = {
  category?: string;
  value?: string;
  group?: string;
  facet?: string;
  pValue?: string;
  sd?: string;
  sem?: string;
  n?: string;
  subject?: string;
  analysisValue?: string;
};

export type BarComparisonResult = {
  facet: string;
  group: string;
  reference: string;
  comparison: string;
  nReference: number;
  nComparison: number;
  meanReference: number;
  meanComparison: number;
  difference: number;
  lower95: number;
  upper95: number;
  statistic: number;
  degreesOfFreedom: number;
  rawPValue: number;
  adjustedPValue: number;
  method: "Welch two-sample t-test" | "Paired t-test";
  analysisScale: string;
};

export type BarAnalysisResult<Row extends Record<string, string> = Record<string, string>> = {
  rows: Row[];
  pValueColumn: string | null;
  results: BarComparisonResult[];
  errors: string[];
  warnings: string[];
};

export type BarAnalysisOptions = {
  mode: BarAnalysisMode;
  referenceCategory?: string;
  adjustment: BarPAdjustment;
};

const computedPValueColumn = "__bar_adjusted_p_value";
type Summary = { mean: number; sd: number; n: number };
type Unit<Row> = { facet: string; group: string; rows: Row[] };

function numeric(value: string | undefined) {
  if (value === undefined || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sampleSummary(values: number[]): Summary {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.length > 1
    ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)
    : Number.NaN;
  return { mean, sd: Math.sqrt(variance), n: values.length };
}

function twoSidedStudentP(statistic: number, degreesOfFreedom: number) {
  if (!Number.isFinite(degreesOfFreedom) || degreesOfFreedom <= 0) return Number.NaN;
  if (!Number.isFinite(statistic)) return statistic === 0 ? 1 : 0;
  const squared = statistic ** 2;
  return Math.max(0, Math.min(1, regularizedIncompleteBeta(
    degreesOfFreedom / (degreesOfFreedom + squared),
    degreesOfFreedom / 2,
    0.5,
  )));
}

function criticalT95(degreesOfFreedom: number) {
  let lower = 0;
  let upper = 64;
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const midpoint = (lower + upper) / 2;
    if (twoSidedStudentP(midpoint, degreesOfFreedom) > 0.05) lower = midpoint;
    else upper = midpoint;
  }
  return (lower + upper) / 2;
}

function welchComparison(reference: Summary, comparison: Summary) {
  const referenceVariance = reference.sd ** 2 / reference.n;
  const comparisonVariance = comparison.sd ** 2 / comparison.n;
  const standardErrorSquared = referenceVariance + comparisonVariance;
  const standardError = Math.sqrt(standardErrorSquared);
  const difference = comparison.mean - reference.mean;
  if (standardError === 0) {
    return {
      difference,
      lower95: difference,
      upper95: difference,
      statistic: difference === 0 ? 0 : Math.sign(difference) * Number.POSITIVE_INFINITY,
      degreesOfFreedom: reference.n + comparison.n - 2,
      pValue: difference === 0 ? 1 : 0,
    };
  }
  const denominator = referenceVariance ** 2 / (reference.n - 1) + comparisonVariance ** 2 / (comparison.n - 1);
  const degreesOfFreedom = standardErrorSquared ** 2 / denominator;
  const statistic = difference / standardError;
  const margin = criticalT95(degreesOfFreedom) * standardError;
  return {
    difference,
    lower95: difference - margin,
    upper95: difference + margin,
    statistic,
    degreesOfFreedom,
    pValue: twoSidedStudentP(statistic, degreesOfFreedom),
  };
}

function pairedComparison(referenceValues: number[], comparisonValues: number[]) {
  const summary = sampleSummary(comparisonValues.map((value, index) => value - referenceValues[index]));
  const standardError = summary.sd / Math.sqrt(summary.n);
  if (standardError === 0) {
    return {
      difference: summary.mean,
      lower95: summary.mean,
      upper95: summary.mean,
      statistic: summary.mean === 0 ? 0 : Math.sign(summary.mean) * Number.POSITIVE_INFINITY,
      degreesOfFreedom: summary.n - 1,
      pValue: summary.mean === 0 ? 1 : 0,
    };
  }
  const degreesOfFreedom = summary.n - 1;
  const statistic = summary.mean / standardError;
  const margin = criticalT95(degreesOfFreedom) * standardError;
  return {
    difference: summary.mean,
    lower95: summary.mean - margin,
    upper95: summary.mean + margin,
    statistic,
    degreesOfFreedom,
    pValue: twoSidedStudentP(statistic, degreesOfFreedom),
  };
}

export function adjustPValues(values: number[], method: BarPAdjustment) {
  if (method === "none") return [...values];
  const indexed = values.map((value, index) => ({ value, index })).sort((left, right) => left.value - right.value);
  const adjusted = Array(values.length).fill(Number.NaN) as number[];
  if (method === "holm") {
    let runningMaximum = 0;
    indexed.forEach((entry, rank) => {
      runningMaximum = Math.max(runningMaximum, Math.min(1, entry.value * (values.length - rank)));
      adjusted[entry.index] = runningMaximum;
    });
    return adjusted;
  }
  let runningMinimum = 1;
  for (let rank = indexed.length - 1; rank >= 0; rank -= 1) {
    const entry = indexed[rank];
    runningMinimum = Math.min(runningMinimum, entry.value * values.length / (rank + 1));
    adjusted[entry.index] = Math.min(1, runningMinimum);
  }
  return adjusted;
}

function unitKey(row: Record<string, string>, mapping: BarAnalysisMapping) {
  const facet = mapping.facet ? row[mapping.facet] || "All facets" : "All facets";
  const group = mapping.group ? row[mapping.group] || "All groups" : "All groups";
  return `${facet}\u0000${group}`;
}

function resultKey(facet: string, group: string, category: string) {
  return `${facet}\u0000${group}\u0000${category}`;
}

function groupRows<Row extends Record<string, string>>(rows: Row[], mapping: BarAnalysisMapping): Unit<Row>[] {
  const units = new Map<string, Unit<Row>>();
  rows.forEach((row) => {
    const key = unitKey(row, mapping);
    const [facet, group] = key.split("\u0000");
    const unit = units.get(key) ?? { facet, group, rows: [] };
    unit.rows.push(row);
    units.set(key, unit);
  });
  return [...units.values()];
}

function requireMapping(mapping: BarAnalysisMapping, key: keyof BarAnalysisMapping, label: string, errors: string[]) {
  const column = mapping[key];
  if (!column) errors.push(`Map ${label} before running Bar statistical analysis.`);
  return column ?? "";
}

function context(unit: Unit<Record<string, string>>) {
  return `facet “${unit.facet}”, group “${unit.group}”`;
}

export function analyzeBarData<Row extends Record<string, string>>(
  sourceRows: Row[],
  mapping: BarAnalysisMapping,
  options: BarAnalysisOptions,
): BarAnalysisResult<Row> {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (options.mode === "none") return { rows: sourceRows, pValueColumn: null, results: [], errors, warnings };
  if (options.mode === "supplied") {
    if (!mapping.pValue) errors.push("Map a supplied P value column before displaying significance annotations.");
    return { rows: sourceRows, pValueColumn: mapping.pValue ?? null, results: [], errors, warnings };
  }

  const categoryColumn = requireMapping(mapping, "category", "a category column", errors);
  const valueColumn = requireMapping(mapping, "value", "a display value column", errors);
  const subjectColumn = ["raw-independent", "raw-paired", "qpcr-delta-ct"].includes(options.mode)
    ? requireMapping(mapping, "subject", "a biological sample / subject ID column", errors)
    : "";
  const analysisColumn = options.mode === "qpcr-delta-ct"
    ? requireMapping(mapping, "analysisValue", "a ΔCt analysis column", errors)
    : valueColumn;
  if (options.mode === "summary-independent") requireMapping(mapping, "n", "an explicit sample-size (n) column", errors);
  if (errors.length > 0) return { rows: sourceRows, pValueColumn: null, results: [], errors, warnings };

  const rawResults: BarComparisonResult[] = [];
  for (const unit of groupRows(sourceRows, mapping)) {
    const categories = [...new Set(unit.rows.map((row) => row[categoryColumn]).filter(Boolean))];
    if (categories.length < 2) continue;
    const reference = options.referenceCategory && categories.includes(options.referenceCategory)
      ? options.referenceCategory
      : categories[0];
    if (options.referenceCategory && !categories.includes(options.referenceCategory)) {
      warnings.push(`${context(unit)} does not contain reference “${options.referenceCategory}”; its first category “${reference}” was used.`);
    }
    const referenceRows = unit.rows.filter((row) => row[categoryColumn] === reference);

    for (const comparison of categories.filter((category) => category !== reference)) {
      const comparisonRows = unit.rows.filter((row) => row[categoryColumn] === comparison);
      let referenceSummary: Summary;
      let comparisonSummary: Summary;
      let computed: ReturnType<typeof welchComparison> | ReturnType<typeof pairedComparison>;
      let method: BarComparisonResult["method"];

      if (options.mode === "summary-independent") {
        if (referenceRows.length !== 1 || comparisonRows.length !== 1) {
          errors.push(`${context(unit)} requires exactly one summary row for “${reference}” and “${comparison}”.`);
          continue;
        }
        const toSummary = (row: Row, category: string) => {
          const mean = numeric(row[valueColumn]);
          const sampleSize = numeric(row[mapping.n ?? ""]);
          const sdValue = mapping.sd ? numeric(row[mapping.sd]) : null;
          const semValue = mapping.sem ? numeric(row[mapping.sem]) : null;
          if (mean === null) errors.push(`${context(unit)}, category “${category}” has a missing or invalid mean.`);
          if (sampleSize === null || !Number.isInteger(sampleSize) || sampleSize < 2) {
            errors.push(`${context(unit)}, category “${category}” requires an explicit integer n ≥ 2.`);
          }
          if ((sdValue === null || sdValue < 0) && (semValue === null || semValue < 0)) {
            errors.push(`${context(unit)}, category “${category}” requires a non-negative SD or SEM.`);
          }
          if (mean === null || sampleSize === null || !Number.isInteger(sampleSize) || sampleSize < 2) return null;
          const sd = sdValue !== null && sdValue >= 0 ? sdValue : (semValue ?? Number.NaN) * Math.sqrt(sampleSize);
          if (mapping.sd && mapping.sem && sdValue !== null && semValue !== null) {
            const expectedSem = sdValue / Math.sqrt(sampleSize);
            if (Math.abs(expectedSem - semValue) > Math.max(1e-8, Math.abs(expectedSem) * 0.02)) {
              warnings.push(`${context(unit)}, category “${category}” has SD and SEM values inconsistent with n by more than 2%; SD was used.`);
            }
          }
          return { mean, sd, n: sampleSize };
        };
        const parsedReference = toSummary(referenceRows[0], reference);
        const parsedComparison = toSummary(comparisonRows[0], comparison);
        if (!parsedReference || !parsedComparison || !Number.isFinite(parsedReference.sd) || !Number.isFinite(parsedComparison.sd)) continue;
        referenceSummary = parsedReference;
        comparisonSummary = parsedComparison;
        computed = welchComparison(referenceSummary, comparisonSummary);
        method = "Welch two-sample t-test";
      } else {
        const checkIds = (rows: Row[], category: string) => {
          const ids = rows.map((row) => row[subjectColumn]).filter(Boolean);
          if (ids.length !== rows.length) errors.push(`${context(unit)}, category “${category}” has a missing biological sample / subject ID.`);
          const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
          if (duplicates.length > 0) {
            errors.push(`${context(unit)}, category “${category}” repeats ID(s) ${duplicates.join(", ")}; aggregate technical replicates before inference.`);
          }
        };
        checkIds(referenceRows, reference);
        checkIds(comparisonRows, comparison);
        const referenceValues = referenceRows.map((row) => numeric(row[analysisColumn]));
        const comparisonValues = comparisonRows.map((row) => numeric(row[analysisColumn]));
        if (referenceValues.some((value) => value === null) || comparisonValues.some((value) => value === null)) {
          errors.push(`${context(unit)}, comparison “${reference}” versus “${comparison}” contains a missing or invalid analysis value.`);
          continue;
        }

        if (options.mode === "raw-paired") {
          const referenceById = new Map(referenceRows.map((row) => [row[subjectColumn], numeric(row[analysisColumn]) as number]));
          const comparisonById = new Map(comparisonRows.map((row) => [row[subjectColumn], numeric(row[analysisColumn]) as number]));
          const referenceIds = [...referenceById.keys()].sort();
          const comparisonIds = [...comparisonById.keys()].sort();
          if (referenceIds.join("\u0000") !== comparisonIds.join("\u0000")) {
            errors.push(`${context(unit)}, paired comparison “${reference}” versus “${comparison}” must contain the same subject IDs; incomplete pairs were not silently dropped.`);
            continue;
          }
          if (referenceIds.length < 2) {
            errors.push(`${context(unit)}, paired comparison “${reference}” versus “${comparison}” requires at least two complete biological pairs.`);
            continue;
          }
          const pairedReference = referenceIds.map((id) => referenceById.get(id) as number);
          const pairedValues = referenceIds.map((id) => comparisonById.get(id) as number);
          referenceSummary = sampleSummary(pairedReference);
          comparisonSummary = sampleSummary(pairedValues);
          computed = pairedComparison(pairedReference, pairedValues);
          method = "Paired t-test";
        } else {
          if (referenceValues.length < 2 || comparisonValues.length < 2) {
            errors.push(`${context(unit)}, comparison “${reference}” versus “${comparison}” requires at least two biological observations per category.`);
            continue;
          }
          referenceSummary = sampleSummary(referenceValues as number[]);
          comparisonSummary = sampleSummary(comparisonValues as number[]);
          computed = welchComparison(referenceSummary, comparisonSummary);
          method = "Welch two-sample t-test";
        }
      }

      rawResults.push({
        facet: unit.facet,
        group: unit.group,
        reference,
        comparison,
        nReference: referenceSummary.n,
        nComparison: comparisonSummary.n,
        meanReference: referenceSummary.mean,
        meanComparison: comparisonSummary.mean,
        difference: computed.difference,
        lower95: computed.lower95,
        upper95: computed.upper95,
        statistic: computed.statistic,
        degreesOfFreedom: computed.degreesOfFreedom,
        rawPValue: computed.pValue,
        adjustedPValue: computed.pValue,
        method,
        analysisScale: options.mode === "qpcr-delta-ct" ? "ΔCt" : valueColumn,
      });
    }
  }

  const adjusted = adjustPValues(rawResults.map((result) => result.rawPValue), options.adjustment);
  const results = rawResults.map((result, index) => ({ ...result, adjustedPValue: adjusted[index] }));
  const pValues = new Map(results.map((result) => [resultKey(result.facet, result.group, result.comparison), result.adjustedPValue]));
  const rows = sourceRows.map((row) => {
    const [facet, group] = unitKey(row, mapping).split("\u0000");
    const pValue = pValues.get(resultKey(facet, group, row[categoryColumn]));
    return { ...row, [computedPValueColumn]: pValue === undefined ? "" : String(pValue) } as Row;
  });
  return { rows, pValueColumn: computedPValueColumn, results, errors, warnings };
}

function tsvCell(value: string | number) {
  const text = typeof value === "number" ? (Number.isFinite(value) ? String(value) : "") : value;
  return /[\t\n\r"]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function barAnalysisResultsTsv(results: BarComparisonResult[]) {
  const headers = ["facet", "group", "reference", "comparison", "n_reference", "n_comparison", "mean_reference", "mean_comparison", "difference", "ci95_lower", "ci95_upper", "t", "df", "p_raw", "p_adjusted", "method", "analysis_scale"];
  const rows = results.map((result) => [
    result.facet, result.group, result.reference, result.comparison, result.nReference, result.nComparison,
    result.meanReference, result.meanComparison, result.difference, result.lower95, result.upper95,
    result.statistic, result.degreesOfFreedom, result.rawPValue, result.adjustedPValue, result.method, result.analysisScale,
  ]);
  return [headers, ...rows].map((row) => row.map(tsvCell).join("\t")).join("\n");
}
