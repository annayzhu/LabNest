import { describe, expect, it } from "vitest";
import { inspectDataset } from "./result-datasets";
import {
  checkResultTemplate,
  inferResultKind,
  inferResultViewPreset,
  normalizeResultTemplate,
  resultDatasetValuesFromResultValues,
  resultTemplateFieldsToRows,
  uniqueResultKey,
  validateResultDatasetRows,
  validateDatasetPreview,
  validateResultRecord,
  withResultDatasetValues,
} from "./result-templates";

const qpcrTemplate = normalizeResultTemplate({
  result_type: "qPCR relative expression",
  templateKey: "qpcr_relative_expression",
  resultKind: "assay",
  cardinality: "per_run",
  fields: [
    { key: "reference_gene", label: "Reference gene", dataType: "text", required: true, semanticRole: "design" },
    { key: "efficiency", label: "Efficiency", dataType: "number", unit: "%", semanticRole: "qc", validation: { min: 90, max: 110 } },
  ],
  datasets: [{
    key: "relative_expression",
    label: "Relative expression",
    required: true,
    columns: [
      { key: "sample_id", label: "Sample ID", dataType: "text", required: true, semanticRole: "identifier" },
      { key: "group", label: "Group", dataType: "category", required: true, semanticRole: "group" },
      { key: "fold_change", label: "Fold change", dataType: "number", required: true, semanticRole: "measurement" },
    ],
  }],
  artifacts: [{ key: "raw_export", label: "Raw instrument export", kind: "file", required: true }],
  view: { preset: "qpcr", charts: [{ key: "fold_change", label: "Fold change", type: "bar", datasetKey: "relative_expression", xField: "group", yField: "fold_change" }] },
});

describe("Result Template runtime", () => {
  it("normalizes legacy field aliases and infers a view preset", () => {
    const template = normalizeResultTemplate({ result_type: "qPCR output", fields: [{ name: "timepoint", type: "number", unit: "h", required: true }] });
    expect(template.templateKey).toBe("qpcr_output");
    expect(template.view?.preset).toBe("qpcr");
    expect(template.fields[0]).toMatchObject({ key: "timepoint", label: "timepoint", dataType: "number", unit: "h", required: true });
  });

  it("derives hidden presentation metadata from user-facing evidence choices", () => {
    const imageTemplate = { result_type: "Cell morphology", fields: [], datasets: [], artifacts: [{ key: "images", label: "Images", kind: "image" as const }] };
    expect(inferResultViewPreset(imageTemplate)).toBe("imaging");
    expect(inferResultKind(imageTemplate)).toBe("imaging");

    const timeSeriesTemplate = { result_type: "Growth", fields: [], artifacts: [], datasets: [{ key: "growth", label: "Growth", columns: [{ key: "time_h", label: "Time", dataType: "number" as const }] }] };
    expect(inferResultViewPreset(timeSeriesTemplate)).toBe("timeseries");
    expect(inferResultKind(timeSeriesTemplate)).toBe("measurement");
  });

  it("preserves explicit legacy metadata and creates collision-safe generated keys", () => {
    const template = normalizeResultTemplate({ result_type: "Result", resultKind: "assay", fields: [], view: { preset: "flow" } });
    expect(template.resultKind).toBe("assay");
    expect(template.view?.preset).toBe("flow");
    expect(uniqueResultKey("Sample ID", ["sample_id", "sample_id_2"])).toBe("sample_id_3");
  });

  it("preserves formatted Instructions inside the frozen Result Template", () => {
    const template = normalizeResultTemplate({
      result_type: "Imaging result",
      instructions: [
        { type: "heading3", content: [{ text: "Before recording", bold: true }] },
        { type: "bullet", content: [{ text: "Use the same exposure for every group." }] },
      ],
      fields: [],
    });
    expect(template.instructions).toEqual([
      { type: "heading3", content: [{ text: "Before recording", bold: true }] },
      { type: "bullet", content: [{ text: "Use the same exposure for every group." }] },
    ]);
  });

  it("preserves every Dataset column detail for downstream schema display", () => {
    expect(qpcrTemplate.datasets?.[0]).toMatchObject({
      key: "relative_expression",
      label: "Relative expression",
      required: true,
      columns: [
        { key: "sample_id", label: "Sample ID", dataType: "text", required: true, semanticRole: "identifier" },
        { key: "group", label: "Group", dataType: "category", required: true, semanticRole: "group" },
        { key: "fold_change", label: "Fold change", dataType: "number", required: true, semanticRole: "measurement" },
      ],
    });
  });

  it("stores template tables as structured Result values and validates entered rows", () => {
    const dataset = qpcrTemplate.datasets?.[0];
    expect(dataset).toBeDefined();
    if (!dataset) return;
    const datasetValues = {
      relative_expression: [
        { sample_id: "S1", group: "Control", fold_change: 1 },
        { sample_id: "S2", group: "Treated", fold_change: 2.4 },
      ],
    };
    const values = withResultDatasetValues({ reference_gene: "GAPDH" }, datasetValues);
    expect(resultDatasetValuesFromResultValues(values)).toEqual(datasetValues);
    expect(validateResultDatasetRows(dataset, datasetValues.relative_expression)).toMatchObject({ status: "valid", rowCount: 2 });
    expect(validateResultRecord({ template: qpcrTemplate, values, artifactKeys: ["raw_export"] })).toMatchObject({ status: "valid", complete: true });
  });

  it("ignores an untouched blank table row but reports incomplete required table evidence", () => {
    const values = withResultDatasetValues({}, { relative_expression: [{ sample_id: "", group: "", fold_change: undefined }] });
    const validation = validateResultRecord({ template: qpcrTemplate, values });
    expect(validation.status).toBe("incomplete");
    expect(validation.errors).toContain("Relative expression Dataset is required.");
  });

  it("reports the exact row and required column for partially entered table rows", () => {
    const dataset = qpcrTemplate.datasets?.[0];
    expect(dataset).toBeDefined();
    if (!dataset) return;
    const validation = validateResultDatasetRows(dataset, [{ sample_id: "S1", group: "", fold_change: 1 }]);
    expect(validation.status).toBe("invalid");
    expect(validation.errors).toContain("Row 1: Group is required.");
  });

  it("checks template keys, select options and chart mappings", () => {
    const invalid = checkResultTemplate({
      result_type: "Broken",
      fields: [{ key: "state", label: "State", dataType: "select" }, { key: "state", label: "Duplicate", dataType: "text" }],
      datasets: [{ key: "table", label: "Table", columns: [{ key: "x", label: "X", dataType: "text" }] }],
      view: { charts: [{ key: "plot", label: "Plot", type: "bar", datasetKey: "table", xField: "missing", yField: "also_missing" }] },
    });
    expect(invalid.status).toBe("invalid");
    expect(invalid.errors.join(" ")).toMatch(/Duplicate field keys/);
    expect(invalid.errors.join(" ")).toMatch(/without options/);
    expect(invalid.errors.join(" ")).toMatch(/unknown x field/);
  });

  it("distinguishes incomplete evidence from valid evidence", () => {
    const incomplete = validateResultRecord({ template: qpcrTemplate, values: {} });
    expect(incomplete.status).toBe("incomplete");
    expect(incomplete.errors.join(" ")).toMatch(/Reference gene is required/);
    expect(incomplete.errors.join(" ")).toMatch(/Dataset is required/);
    expect(incomplete.errors.join(" ")).toMatch(/attachment is required/);

    const complete = validateResultRecord({
      template: qpcrTemplate,
      values: { reference_gene: "GAPDH", efficiency: 99.4 },
      datasetStatuses: [{ templateDatasetKey: "relative_expression", validationStatus: "valid" }],
      artifactKeys: ["raw_export"],
    });
    expect(complete.status).toBe("valid");
    expect(complete.complete).toBe(true);
  });

  it("validates Dataset columns without discarding the original file", async () => {
    const preview = await inspectDataset(Buffer.from("Sample ID,Group,Fold change\nS1,Control,1\nS2,Treated,2.4\n"), "qpcr.csv");
    const validation = validateDatasetPreview(qpcrTemplate.datasets?.[0], preview);
    expect(validation.status).toBe("valid");
    expect(validation.columnMapping).toEqual({ sample_id: "Sample ID", group: "Group", fold_change: "Fold change" });

    const missing = await inspectDataset(Buffer.from("Sample ID,Group\nS1,Control\n"), "missing.csv");
    expect(validateDatasetPreview(qpcrTemplate.datasets?.[0], missing)).toMatchObject({ status: "invalid" });
  });

  it("keeps a blank Protocol template free of fabricated result fields", () => {
    const blankTemplate = normalizeResultTemplate({ result_type: "result_type", fields: [] });
    expect(resultTemplateFieldsToRows(blankTemplate)).toHaveLength(2);
    expect(resultTemplateFieldsToRows(blankTemplate)[1][0]).toBe("");
    expect(checkResultTemplate(blankTemplate).errors).toContain("Replace the placeholder with a Result name.");
  });
});
