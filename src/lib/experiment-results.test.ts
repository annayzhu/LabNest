import { describe, expect, it } from "vitest";
import { buildExperimentResultRecording, preferredResultRecordingHref } from "./experiment-results";

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
  it("matches an existing template draft to its locked ProtocolVersion slot", () => {
    const recording = buildExperimentResultRecording(sources, [result]);
    expect(recording.slots[0].records).toEqual([result]);
    expect(recording.additionalResults).toEqual([]);
    expect(preferredResultRecordingHref("experiment-1", recording)).toBe("/results/result-1/edit");
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

  it("opens the locked template when a per-run draft has not been created yet", () => {
    const recording = buildExperimentResultRecording(sources, []);
    expect(preferredResultRecordingHref("experiment-1", recording)).toBe("/results/new?experiment=experiment-1&template=rna_record&protocolVersionId=pv-1");
  });
});
