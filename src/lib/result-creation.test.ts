import { describe, expect, it, vi } from "vitest";
import { EXPERIMENT_RESULT_REPORT_KEY } from "./experiment-results";
import { createResultInTransaction } from "./result-creation";

function fakeTransaction(options: { entry?: boolean; attachments?: boolean } = {}) {
  const createResult = vi.fn().mockResolvedValue({ id: "result-1" });
  const createLinks = vi.fn().mockResolvedValue({ count: 1 });
  const createAttachmentLinks = vi.fn().mockResolvedValue({ count: 1 });
  const createLog = vi.fn().mockResolvedValue({ id: "log-1" });
  const tx = {
    experiment: { findUnique: vi.fn().mockResolvedValue({ id: "experiment-1", projectId: "project-1", researchPlanId: "plan-1", protocolVersions: [] }) },
    result: { findFirst: vi.fn().mockResolvedValue(null), create: createResult },
    resultTypeDefinition: { findUnique: vi.fn().mockResolvedValue({ id: "type-1" }) },
    entry: { findUnique: vi.fn().mockResolvedValue(options.entry ? { id: "entry-1", projectId: "project-1", researchPlanId: "plan-1", occurredAt: new Date("2026-08-27T00:00:00.000Z") } : null) },
    itemLink: { createMany: createLinks },
    attachmentLink: {
      findMany: vi.fn().mockResolvedValue(options.attachments ? [{ attachmentId: "attachment-1", order: 0 }] : []),
      createMany: createAttachmentLinks,
    },
    activityLog: { create: createLog },
  };
  return { tx, createResult, createLinks, createAttachmentLinks, createLog };
}

describe("Result creation provenance module", () => {
  it("creates the Result, canonical Experiment link, and activity record through one interface", async () => {
    const fake = fakeTransaction();
    const saved = await createResultInTransaction(fake.tx as never, {
      experimentId: "experiment-1",
      title: "Observed morphology",
      resultType: "Observation",
      recordStatus: "draft",
      sourceType: "manual",
      qualityStatus: "not_assessed",
      origin: { kind: "manual", requireManagedResultType: true },
    });

    expect(saved).toEqual({ resultId: "result-1", experimentId: "experiment-1", researchPlanId: "plan-1" });
    expect(fake.createResult).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ projectId: "project-1", researchPlanId: "plan-1" }) }));
    expect(fake.createLinks).toHaveBeenCalledWith({ data: [expect.objectContaining({ linkType: "produced_by", targetId: "experiment-1" })] });
    expect(fake.createLog).toHaveBeenCalledOnce();
  });

  it("adds an Entry backlink and reuses its attachments without copying files", async () => {
    const fake = fakeTransaction({ entry: true, attachments: true });
    await createResultInTransaction(fake.tx as never, {
      experimentId: "experiment-1",
      title: "Imported quick note",
      resultType: "Observation",
      recordStatus: "draft",
      sourceType: "manual",
      qualityStatus: "not_assessed",
      origin: { kind: "entry", entryId: "entry-1", includeAttachments: true },
    });

    expect(fake.createLinks).toHaveBeenCalledWith({ data: [
      expect.objectContaining({ linkType: "produced_by", targetId: "experiment-1" }),
      expect.objectContaining({ linkType: "derived_from", targetId: "entry-1" }),
    ] });
    expect(fake.createAttachmentLinks).toHaveBeenCalledWith({ data: [expect.objectContaining({ attachmentId: "attachment-1", linkType: "source_evidence", targetId: "result-1" })] });
    expect(fake.createResult).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ provenanceJson: expect.objectContaining({ sourceEntryId: "entry-1" }) }) }));
  });

  it("rejects an Entry from a different scientific context", async () => {
    const fake = fakeTransaction({ entry: true });
    fake.tx.entry.findUnique.mockResolvedValue({ id: "entry-1", projectId: "other-project", researchPlanId: "plan-1", occurredAt: new Date() });
    await expect(createResultInTransaction(fake.tx as never, {
      experimentId: "experiment-1",
      title: "Invalid import",
      resultType: "Observation",
      recordStatus: "draft",
      sourceType: "manual",
      qualityStatus: "not_assessed",
      origin: { kind: "entry", entryId: "entry-1" },
    })).rejects.toThrow("different Projects");
    expect(fake.createResult).not.toHaveBeenCalled();
  });

  it("creates one experiment-level report from selected Protocol modules", async () => {
    const fake = fakeTransaction();
    fake.tx.experiment.findUnique.mockResolvedValue({
      id: "experiment-1",
      projectId: "project-1",
      researchPlanId: "plan-1",
      protocolVersions: [
        {
          protocolVersionId: "pv-1",
          protocolVersion: {
            displayVersion: "1.0",
            resultTemplatesJson: [{ templateKey: "rna_extraction", result_type: "RNA extraction", fields: [{ key: "rna_concentration", label: "RNA concentration", dataType: "number", unit: "ng/µL" }] }],
            protocol: { humanCode: "PRT-1", canonicalTitle: "RNA extraction", title: "RNA extraction" },
          },
        },
        {
          protocolVersionId: "pv-2",
          protocolVersion: {
            displayVersion: "1.0",
            resultTemplatesJson: [{ templateKey: "nanodrop", result_type: "NanoDrop", fields: [{ key: "concentration", label: "Concentration", dataType: "number", unit: "ng/µL" }] }],
            protocol: { humanCode: "PRT-2", canonicalTitle: "NanoDrop", title: "NanoDrop" },
          },
        },
      ],
    });

    await createResultInTransaction(fake.tx as never, {
      experimentId: "experiment-1",
      title: "RNA extraction · Result",
      resultType: "Experiment result",
      recordStatus: "draft",
      sourceType: "protocol_template",
      qualityStatus: "not_assessed",
      origin: { kind: "manual" },
      templateKey: EXPERIMENT_RESULT_REPORT_KEY,
      templateModuleIds: ["pv-1:rna_extraction", "pv-2:nanodrop"],
    });

    expect(fake.createResult).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        protocolVersionId: undefined,
        templateKey: EXPERIMENT_RESULT_REPORT_KEY,
        templateSnapshotJson: expect.objectContaining({ fields: [expect.objectContaining({ key: "rna_concentration" })] }),
        metadataJson: expect.objectContaining({ moduleIds: ["pv-1:rna_extraction", "pv-2:nanodrop"] }),
      }),
    }));
  });
});
