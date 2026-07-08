import { describe, expect, it } from "vitest";
import {
  canTransitionRecordStatus,
  calculateConsumption,
  createExperimentSteps,
  createProtocolVersionFromParameterChange,
  createProtocolRunPreview,
  evaluateFormula,
  getNextRecordStatus,
} from "./protocol";
import type { ProtocolVersionData } from "./types";

const protocolVersion: ProtocolVersionData = {
  id: "pv-1",
  protocolId: "p-1",
  versionNumber: 1,
  recordStatus: "recorded",
  title: "Cell transfection v1",
  purpose: "Demo",
  background: "Demo",
  scope: "Demo",
  notes: "Demo",
  parameters: [{ name: "well_count", type: "number", default: 2, required: true }],
  materials: [],
  equipment: [],
  steps: [
    {
      order: 1,
      title: "Seed cells",
      description: "Seed {{cell_line}} into {{well_count}} wells.",
      requires_confirmation: true,
      allows_deviation: true,
    },
  ],
  consumptionRules: [
    {
      material_name: "Lipofectamine 3000",
      formula: "well_count * 4",
      unit: "uL",
      requires_inventory_selection: true,
    },
    {
      material_name: "Complete DMEM",
      formula: "(well_count + 1) * 2",
      unit: "mL",
      requires_inventory_selection: true,
    },
  ],
  resultTemplates: [],
  createdAt: "2026-07-07T00:00:00Z",
};

describe("protocol calculations", () => {
  it("advances record lifecycle one step at a time", () => {
    expect(getNextRecordStatus("draft")).toBe("recorded");
    expect(getNextRecordStatus("reviewed")).toBeUndefined();
    expect(canTransitionRecordStatus("recorded", "submitted")).toBe(true);
    expect(canTransitionRecordStatus("draft", "reviewed")).toBe(false);
  });

  it("creates a new protocol version for confirmed parameter changes", () => {
    const nextVersion = createProtocolVersionFromParameterChange({
      previousVersion: protocolVersion,
      parameterChanges: [{ name: "well_count", updates: { default: 3 } }],
      changeSummary: "Confirmed pilot scale default from 2 wells to 3 wells.",
      createdAt: "2026-07-08T09:00:00Z",
    });

    expect(nextVersion.versionNumber).toBe(2);
    expect(nextVersion.title).toBe("Cell transfection v2");
    expect(nextVersion.recordStatus).toBe("recorded");
    expect(nextVersion.createdFromVersionId).toBe("pv-1");
    expect(nextVersion.changeSummary).toBe("Confirmed pilot scale default from 2 wells to 3 wells.");
    expect(nextVersion.parameters[0].default).toBe(3);
    expect(protocolVersion.parameters[0].default).toBe(2);
  });

  it("rejects protocol parameter changes that do not map to the source version", () => {
    expect(() =>
      createProtocolVersionFromParameterChange({
        previousVersion: protocolVersion,
        parameterChanges: [{ name: "missing_parameter", updates: { default: 1 } }],
        changeSummary: "Invalid local change.",
      }),
    ).toThrow("does not exist");
  });

  it("evaluates restricted protocol formulas", () => {
    expect(evaluateFormula("well_count * 4", { well_count: 3 })).toBe(12);
    expect(evaluateFormula("(well_count + 1) * 2", { well_count: 3 })).toBe(8);
  });

  it("rejects missing or non-numeric formula parameters", () => {
    expect(() => evaluateFormula("well_count * 4", { well_count: "two" })).toThrow(
      "must be a finite number",
    );
  });

  it("calculates consumption without creating inventory transactions", () => {
    const consumption = calculateConsumption(protocolVersion.consumptionRules, { well_count: 2 });
    expect(consumption).toEqual([
      {
        materialName: "Lipofectamine 3000",
        quantity: 8,
        unit: "uL",
        formula: "well_count * 4",
        requiresInventorySelection: true,
      },
      {
        materialName: "Complete DMEM",
        quantity: 6,
        unit: "mL",
        formula: "(well_count + 1) * 2",
        requiresInventorySelection: true,
      },
    ]);
  });

  it("renders protocol variables into experiment checklist steps", () => {
    const steps = createExperimentSteps(protocolVersion.steps, {
      well_count: 2,
      cell_line: "HEK293T",
    });

    expect(steps[0].description).toBe("Seed HEK293T into 2 wells.");
    expect(steps[0].completed).toBe(false);
  });

  it("creates proposed actions instead of direct inventory changes", () => {
    const preview = createProtocolRunPreview(protocolVersion, {
      well_count: 2,
      cell_line: "HEK293T",
    });

    expect(preview.proposedActions).toHaveLength(2);
    expect(preview.proposedActions[0].actionType).toBe("consume_inventory");
    expect(preview.proposedActions[0].status).toBe("pending");
    expect(preview.proposedActions[0].payload.quantity_change).toBe(-8);
  });
});
