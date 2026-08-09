import { describe, expect, it } from "vitest";
import { inspectDataset } from "./result-datasets";
import {
  checkResultTemplate,
  normalizeResultTemplate,
  resultTemplateFieldsToRows,
  validateDatasetPreview,
  validateResultRecord,
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
    expect(resultTemplateFieldsToRows(normalizeResultTemplate({ result_type: "result_type", fields: [] }))).toHaveLength(2);
    expect(resultTemplateFieldsToRows(normalizeResultTemplate({ result_type: "result_type", fields: [] }))[1][0]).toBe("");
  });
});
