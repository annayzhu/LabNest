import { describe, expect, it } from "vitest";
import { buildExperimentResultRecording, buildExperimentResultReportTemplate, preferredResultRecordingHref } from "./experiment-results";

const sources = [{
  protocolVersionId: "pv-1",
  protocolCode: "PRT-100008",
  protocolTitle: "RNA extraction",
  displayVersion: "0.2",
  resultTemplatesJson: [{ result_type: "RNA_Extraction_Record", templateKey: "rna_record", cardinality: "per_run", fields: [] }],
}];

const result = {
  id: "result-1",
  title: "RNA extraction · RNA_Extraction_Record",
  resultType: "RNA_Extraction_Record",
  sourceType: "protocol_template",
  status: "active",
  recordStatus: "draft",
  qualityStatus: "not_assessed",
  validationStatus: "incomplete",
  protocolVersionId: "pv-1",
  templateKey: "rna_record",
};

describe("experiment result recording", () => {
  it("keeps legacy template drafts readable without using them as the experiment report", () => {
    const recording = buildExperimentResultRecording(sources, [result]);
    expect(recording.slots[0].records).toEqual([result]);
    expect(recording.additionalResults).toEqual([]);
    expect(recording.legacyTemplateResults).toEqual([result]);
    expect(preferredResultRecordingHref("experiment-1", recording)).toBe("/results/new?experiment=experiment-1&report=1");
  });

  it("keeps manual and unmatched evidence in the additional-results group", () => {
    const manual = { ...result, id: "manual-1", sourceType: "manual", protocolVersionId: null, templateKey: null };
    const recording = buildExperimentResultRecording(sources, [result, manual]);
    expect(recording.additionalResults).toEqual([manual]);
  });

  it("does not let a recycled Result occupy the active template slot", () => {
    const recording = buildExperimentResultRecording(sources, [{ ...result, status: "archived" }]);
    expect(recording.slots[0].records).toEqual([]);
    expect(recording.additionalResults).toEqual([]);
  });

  it("opens one experiment report instead of a Protocol-specific record", () => {
    const recording = buildExperimentResultRecording(sources, []);
    expect(preferredResultRecordingHref("experiment-1", recording)).toBe("/results/new?experiment=experiment-1&report=1");
  });

  it("merges semantically identical measurements from multiple Protocol modules", () => {
    const recording = buildExperimentResultRecording([
      { ...sources[0], resultTemplatesJson: [{ result_type: "RNA extraction", templateKey: "rna_extraction", fields: [{ key: "rna_concentration", label: "RNA concentration", dataType: "number", unit: "ng/µL", required: true }] }] },
      { ...sources[0], protocolVersionId: "pv-2", protocolCode: "PRT-100009", protocolTitle: "NanoDrop", resultTemplatesJson: [{ result_type: "NanoDrop", templateKey: "nanodrop", fields: [{ key: "concentration", label: "Concentration", dataType: "number", unit: "ng/µL" }] }] },
    ], []);
    const report = buildExperimentResultReportTemplate(recording.modules);
    expect(report.result_type).toBe("Experiment result");
    expect(report.title).toBe("Experiment result");
    expect(report.fields).toHaveLength(1);
    expect(report.fields[0]).toMatchObject({ unit: "ng/µL", required: true });
  });

  it("merges per-sample tables and removes a duplicate direct measurement", () => {
    const modules = buildExperimentResultRecording([
      { ...sources[0], resultTemplatesJson: [{ result_type: "RNA extraction", templateKey: "rna_extraction", fields: [{ key: "rna_concentration", label: "RNA concentration", dataType: "number", unit: "ng/µL", required: true }], datasets: [{ key: "extraction_qc", label: "Extraction QC", columns: [{ key: "sample_id", label: "Sample ID", dataType: "text", semanticRole: "identifier", required: true }] }] }] },
      { ...sources[0], protocolVersionId: "pv-2", protocolCode: "PRT-100009", protocolTitle: "NanoDrop", resultTemplatesJson: [{ result_type: "NanoDrop", templateKey: "nanodrop", fields: [], datasets: [{ key: "nanodrop_qc", label: "NanoDrop QC", columns: [{ key: "sample", label: "Sample ID", dataType: "text", semanticRole: "identifier", required: true }, { key: "concentration", label: "Concentration", dataType: "number", unit: "ng/µL" }] }] }] },
    ], []).modules;

    const report = buildExperimentResultReportTemplate(modules);
    expect(report.fields).toEqual([]);
    expect(report.datasets).toHaveLength(1);
    expect(report.datasets?.[0].columns).toHaveLength(2);
    expect(report.datasets?.[0].columns.find((column) => column.key === "concentration")).toMatchObject({ required: true, unit: "ng/µL" });
  });

  it("does not merge distinct analytes that happen to share a unit", () => {
    const modules = buildExperimentResultRecording([
      { ...sources[0], resultTemplatesJson: [{ result_type: "RNA", templateKey: "rna", fields: [{ key: "rna_concentration", label: "RNA concentration", dataType: "number", unit: "ng/µL" }] }] },
      { ...sources[0], protocolVersionId: "pv-2", resultTemplatesJson: [{ result_type: "DNA", templateKey: "dna", fields: [{ key: "dna_concentration", label: "DNA concentration", dataType: "number", unit: "ng/µL" }] }] },
    ], []).modules;

    expect(buildExperimentResultReportTemplate(modules).fields).toHaveLength(2);
  });

  it("keeps each selected Protocol template instruction in the experiment report snapshot", () => {
    const modules = buildExperimentResultRecording([
      { ...sources[0], resultTemplatesJson: [{ result_type: "RNA", templateKey: "rna", instructions: [{ type: "paragraph", content: [{ text: "Record the extraction batch." }] }], fields: [] }] },
      { ...sources[0], protocolVersionId: "pv-2", protocolCode: "PRT-100009", protocolTitle: "NanoDrop", displayVersion: "0.1", resultTemplatesJson: [{ result_type: "QC", templateKey: "qc", instructions: [{ type: "paragraph", content: [{ text: "Keep the raw instrument export." }] }], fields: [] }] },
    ], []).modules;

    const report = buildExperimentResultReportTemplate(modules);
    expect(report.instructions?.map((node) => node.content.map((run) => run.text).join(""))).toEqual([
      "RNA · PRT-100008 · v0.2",
      "Record the extraction batch.",
      "QC · PRT-100009 · v0.1",
      "Keep the raw instrument export.",
    ]);
  });
});
