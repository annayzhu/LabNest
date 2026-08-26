import { describe, expect, it } from "vitest";
import { calibrationBins, decisionCurve, precisionRecallCurve } from "./visualization-clinical";
import { kaplanMeier, rocCurve } from "./visualization-advanced";
import { defaultVisualizationSettings, getPlotDefinition, getPlotModule, parseDelimitedData, validatePlotDataset } from "./visualization-studio";

describe("clinical evaluation calculations", () => {
  it("computes average precision from recall increments and reports prevalence", () => {
    const result = precisionRecallCurve([
      { truth: 1, score: 0.9 },
      { truth: 0, score: 0.8 },
      { truth: 1, score: 0.7 },
      { truth: 0, score: 0.1 },
    ]);
    expect(result.auprc).toBeCloseTo(5 / 6, 8);
    expect(result.prevalence).toBe(0.5);
    expect(result.points.at(-1)).toEqual({ recall: 1, precision: 0.5 });
  });

  it("treats tied scores as one threshold and is invariant to tie order", () => {
    const first = [{ truth: 1 as const, score: 0.8 }, { truth: 0 as const, score: 0.8 }, { truth: 1 as const, score: 0.4 }, { truth: 0 as const, score: 0.2 }];
    const reordered = [first[1], first[0], first[2], first[3]];
    expect(precisionRecallCurve(first)).toEqual(precisionRecallCurve(reordered));
    expect(precisionRecallCurve(first).points).toHaveLength(4);
  });

  it("uses equal-frequency calibration groups with ordered Wilson intervals", () => {
    const rows = Array.from({ length: 24 }, (_, index) => ({
      truth: (index % 3 === 0 ? 1 : 0) as 0 | 1,
      score: (index + 0.5) / 24,
    }));
    const bins = calibrationBins(rows, 6);
    expect(bins).toHaveLength(6);
    expect(bins.every((bin) => bin.n === 4)).toBe(true);
    expect(bins.every((bin) => bin.lower <= bin.observed && bin.observed <= bin.upper)).toBe(true);
    expect(bins.every((bin, index) => index === 0 || bin.predicted > bins[index - 1].predicted)).toBe(true);
  });

  it("never splits tied probabilities across calibration bins", () => {
    const rows = [{ truth: 1 as const, score: 0.2 }, { truth: 0 as const, score: 0.2 }, { truth: 1 as const, score: 0.2 }, { truth: 0 as const, score: 0.7 }, { truth: 1 as const, score: 0.9 }, { truth: 0 as const, score: 0.9 }];
    const reordered = [rows[2], rows[0], rows[1], rows[5], rows[3], rows[4]];
    expect(calibrationBins(rows, 3)).toEqual(calibrationBins(reordered, 3));
    expect(calibrationBins(rows, 3).map((bin) => bin.n)).toEqual([3, 3]);
  });

  it("computes standard decision-curve net benefit and reference strategies", () => {
    const rows = [
      { truth: 1 as const, score: 0.9 },
      { truth: 1 as const, score: 0.8 },
      { truth: 0 as const, score: 0.7 },
      { truth: 0 as const, score: 0.1 },
    ];
    const [point] = decisionCurve(rows, [0.5]);
    expect(point.model).toBeCloseTo(0.25, 8);
    expect(point.all).toBeCloseTo(0, 8);
    expect(point.none).toBe(0);
  });
});

describe("clinical input contracts", () => {
  it("requires both outcomes inside every raw prediction model", () => {
    const dataset = parseDelimitedData("truth\tscore\tmodel\n1\t0.9\tA\n0\t0.2\tA\n1\t0.8\tB\n1\t0.6\tB");
    const validation = validatePlotDataset(getPlotDefinition("precision-recall"), dataset, { truth: "truth", score: "score", group: "model" }, defaultVisualizationSettings);
    expect(validation.errors).toContain("Precision–recall model “B” requires both observed outcome classes (0 and 1).");
  });

  it("blocks unordered time-dependent ROC uncertainty", () => {
    const dataset = parseDelimitedData("fpr\ttpr\ttpr_lower\ttpr_upper\thorizon\tgroup\tauc\tauc_lower\tauc_upper\n0\t0\t0\t0\t12\tModel\t0.75\t0.70\t0.80\n0.5\t0.8\t0.85\t0.9\t12\tModel\t0.75\t0.70\t0.80\n1\t1\t1\t1\t12\tModel\t0.75\t0.70\t0.80");
    const validation = validatePlotDataset(getPlotDefinition("roc"), dataset, { truth: "", score: "", group: "group", fpr: "fpr", tpr: "tpr", tprLower: "tpr_lower", tprUpper: "tpr_upper", horizon: "horizon", auc: "auc", aucLower: "auc_lower", aucUpper: "auc_upper" }, { ...defaultVisualizationSettings, rocInputMode: "precomputed-time" });
    expect(validation.errors.some((error) => /unordered TPR or AUC/.test(error))).toBe(true);
  });

  it("canonicalizes numerically equivalent time horizons", () => {
    const dataset = parseDelimitedData("fpr\ttpr\ttpr_lower\ttpr_upper\thorizon\tgroup\tauc\tauc_lower\tauc_upper\n0\t0\t0\t0\t12\tModel\t0.75\t0.70\t0.80\n0.5\t0.8\t0.7\t0.9\t12.0\tModel\t0.75\t0.70\t0.80\n1\t1\t1\t1\t12.00\tModel\t0.75\t0.70\t0.80");
    const validation = validatePlotDataset(getPlotDefinition("roc"), dataset, { truth: "", score: "", group: "group", fpr: "fpr", tpr: "tpr", tprLower: "tpr_lower", tprUpper: "tpr_upper", horizon: "horizon", auc: "auc", aucLower: "auc_lower", aucUpper: "auc_upper" }, { ...defaultVisualizationSettings, rocInputMode: "precomputed-time" });
    expect(validation.errors).toEqual([]);
  });

  it("requires a shared subject-outcome cohort for multi-model decision curves", () => {
    const dataset = parseDelimitedData("sample\ttruth\tscore\tmodel\nS1\t1\t0.8\tA\nS1\t0\t0.7\tB\nS2\t0\t0.2\tA\nS2\t0\t0.3\tB");
    const validation = validatePlotDataset(getPlotDefinition("decision-curve"), dataset, { subject: "sample", truth: "truth", score: "score", group: "model" }, defaultVisualizationSettings);
    expect(validation.errors).toContain("Subject “S1” has inconsistent observed outcomes across decision-curve models.");
  });

  it("validates an explicit decision-threshold interval and grid resolution", () => {
    const dataset = parseDelimitedData("sample\ttruth\tscore\nS1\t1\t0.8\nS2\t0\t0.2");
    const definition = getPlotDefinition("decision-curve");
    const mapping = { subject: "sample", truth: "truth", score: "score", group: "" };
    expect(validatePlotDataset(definition, dataset, mapping, { ...defaultVisualizationSettings, decisionThresholdMinimum: 0.01, decisionThresholdMaximum: 0.9, decisionThresholdStep: 0.01 }).errors).toEqual([]);
    expect(validatePlotDataset(definition, dataset, mapping, { ...defaultVisualizationSettings, decisionThresholdMinimum: 0.6, decisionThresholdMaximum: 0.5 }).errors.some((error) => /0 < minimum < maximum < 1/.test(error))).toBe(true);
    expect(validatePlotDataset(definition, dataset, mapping, { ...defaultVisualizationSettings, decisionThresholdStep: 0.1 }).errors.some((error) => /resolution must be between/.test(error))).toBe(true);
  });

  it("rejects blank shared-cohort IDs and duplicate risk-score subjects", () => {
    const decision = parseDelimitedData("sample\ttruth\tscore\tmodel\n\t1\t0.8\tA\n\t1\t0.7\tB");
    expect(validatePlotDataset(getPlotDefinition("decision-curve"), decision, { subject: "sample", truth: "truth", score: "score", group: "model" }, defaultVisualizationSettings).errors.some((error) => /blank value/.test(error))).toBe(true);
    const risk = parseDelimitedData("sample\tscore\toutcome\nS1\t0.2\t0\nS1\t0.8\t1");
    expect(validatePlotDataset(getPlotDefinition("risk-score"), risk, { label: "sample", score: "score", truth: "outcome" }, defaultVisualizationSettings).errors.some((error) => /must be unique/.test(error))).toBe(true);
  });

  it("requires complete unique LASSO paths on a common lambda grid", () => {
    const dataset = parseDelimitedData("lambda\tcoefficient\tfeature\n1\t0\tA\n1\t0.1\tA\n0.5\t0.2\tB\n0.1\t0.4\tB");
    const errors = validatePlotDataset(getPlotDefinition("lasso-path"), dataset, { x: "lambda", y: "coefficient", group: "feature" }, defaultVisualizationSettings).errors;
    expect(errors.some((error) => /feature × lambda pair must be unique/.test(error))).toBe(true);
    expect(errors.some((error) => /same lambda grid/.test(error))).toBe(true);
  });

  it("blocks ROC domains that would crop endpoints or confidence bands", () => {
    const dataset = parseDelimitedData("truth\tscore\n1\t0.9\n0\t0.1");
    const validation = validatePlotDataset(getPlotDefinition("roc"), dataset, { truth: "truth", score: "score", group: "" }, { ...defaultVisualizationSettings, xMin: 0.1 });
    expect(validation.errors.some((error) => /must contain the full \[0, 1\]/.test(error))).toBe(true);
  });

  it("blocks colliding nomogram level labels", () => {
    const dataset = parseDelimitedData("predictor\tlevel\tpoints\nStage\tLevel alpha\t10\nStage\tLevel beta\t10.1");
    const validation = validatePlotDataset(getPlotDefinition("nomogram"), dataset, { group: "predictor", label: "level", value: "points" }, defaultVisualizationSettings);
    expect(validation.errors.some((error) => /overlap within predictor/.test(error))).toBe(true);
  });

  it("does not expose ignored manual limits and does expose scientific controls", () => {
    expect(getPlotModule("funnel").capabilities.settingKeys).not.toContain("xMin");
    expect(getPlotModule("calibration").capabilities.settingKeys).toContain("calibrationBinCount");
    expect(getPlotModule("decision-curve").capabilities.settingKeys).toContain("decisionThresholdMaximum");
    expect(getPlotModule("decision-curve").capabilities.settingKeys).toContain("decisionThresholdMinimum");
    expect(getPlotModule("decision-curve").capabilities.settingKeys).toContain("decisionThresholdStep");
  });

  it("handles many unique scores and follow-up times with sorting sweeps", () => {
    const records = Array.from({ length: 10_000 }, (_, index) => ({ truth: (index % 2) as 0 | 1, score: index / 10_000 }));
    expect(rocCurve(records).points).toHaveLength(10_001);
    expect(kaplanMeier(records.map((record, index) => ({ time: index + 1, event: record.truth })))).toHaveLength(10_001);
  });
});
