import { describe, expect, it } from "vitest";
import {
  entryDeleteBlockers,
  experimentDeleteBlockers,
  projectDeleteBlockers,
  protocolDeleteBlockers,
  protocolRequiresAssociationPreservingRecycle,
  reportDeleteBlockers,
  researchPlanDeleteBlockerItems,
  researchPlanRequiresAssociationPreservingRecycle,
  resultDeleteBlockers,
  resultRequiresAssociationPreservingRecycle,
} from "./record-lifecycle";

describe("two-tier record lifecycle deletion policy", () => {
  it("allows only an empty Project to be permanently deleted", () => {
    const empty = { researchPlans: 0, protocols: 0, experiments: 0, results: 0, reports: 0, entries: 0, entities: 0, procurementInquiries: 0, genericReferences: 0 };
    expect(projectDeleteBlockers(empty)).toEqual([]);
    expect(projectDeleteBlockers({ ...empty, reports: 2 })).toMatchObject([{ key: "reports", count: 2 }]);
  });

  it("requires an unreferenced Draft Research Plan", () => {
    const empty = { entries: 0, experiments: 0, results: 0, reports: 0, reportSourceReferences: 0 };
    expect(researchPlanDeleteBlockerItems("draft", empty)).toEqual([]);
    expect(researchPlanDeleteBlockerItems("active", empty)[0]?.key).toBe("status");
  });

  it("protects used or reviewed Protocols", () => {
    const empty = { projects: 0, researchPlans: 0, experiments: 0, results: 0, nonDraftVersions: 0, derivedVersions: 0, reportSourceReferences: 0 };
    expect(protocolDeleteBlockers("draft", "draft", empty)).toEqual([]);
    expect(protocolDeleteBlockers("draft", "draft", { ...empty, experiments: 1 })[0]).toMatchObject({ key: "experiments", count: 1 });
    expect(protocolRequiresAssociationPreservingRecycle({ ...empty, nonDraftVersions: 1 })).toBe(false);
    expect(protocolRequiresAssociationPreservingRecycle({ ...empty, researchPlans: 1 })).toBe(true);
  });

  it("protects Experiments as soon as execution evidence exists", () => {
    const empty = { results: 0, inventoryTransactions: 0, sampleEvents: 0, completedSteps: 0, deviations: 0, attachments: 0, reportSourceReferences: 0, entryReferences: 0, proposedActions: 0 };
    expect(experimentDeleteBlockers("planned", "draft", empty)).toEqual([]);
    expect(experimentDeleteBlockers("running", "draft", empty)[0]?.key).toBe("status");
  });

  it("protects Result data and downstream report use", () => {
    const empty = { datasets: 0, attachments: 0, reportSources: 0, inboundLinks: 0 };
    expect(resultDeleteBlockers("draft", empty)).toEqual([]);
    expect(resultDeleteBlockers("draft", { ...empty, datasets: 1 })[0]?.key).toBe("datasets");
  });

  it("uses association-preserving recycle only when linked evidence exists", () => {
    const planCounts = { entries: 0, experiments: 0, results: 0, reports: 0, reportSourceReferences: 0 };
    const resultCounts = { datasets: 0, attachments: 0, reportSources: 0, inboundLinks: 0 };
    expect(researchPlanRequiresAssociationPreservingRecycle(planCounts)).toBe(false);
    expect(researchPlanRequiresAssociationPreservingRecycle({ ...planCounts, experiments: 1 })).toBe(true);
    expect(resultRequiresAssociationPreservingRecycle(resultCounts)).toBe(false);
    expect(resultRequiresAssociationPreservingRecycle({ ...resultCounts, datasets: 1 })).toBe(true);
  });

  it("allows only unreferenced Draft Reports and Entries", () => {
    expect(reportDeleteBlockers("draft", { externalReferences: 0 })).toEqual([]);
    expect(reportDeleteBlockers("final", { externalReferences: 0 })[0]?.key).toBe("status");
    expect(entryDeleteBlockers("draft", { itemLinks: 0, proposedActions: 0, reportSourceReferences: 0 })).toEqual([]);
    expect(entryDeleteBlockers("reviewed", { itemLinks: 0, proposedActions: 0, reportSourceReferences: 0 })[0]?.key).toBe("recordStatus");
  });
});
