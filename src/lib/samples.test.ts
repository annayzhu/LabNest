import { describe, expect, it } from "vitest";
import {
  calculateSampleQuantityFromAliquots,
  countActionableSampleWarnings,
  getSampleAliquots,
  sortSampleEventsByTime,
} from "./samples";
import type { InventoryItem, SampleLifecycleEvent, SampleProfile } from "./types";

const sample: SampleProfile = {
  id: "sample-1",
  entityId: "entity-sample-1",
  name: "Working cell bank",
  sampleCode: "SMP-001",
  sampleType: "cell_line_bank",
  status: "stocked",
  freezeThawCount: 0,
  aliquotCount: 2,
  totalQuantity: 2,
  unit: "vial",
  relatedExperimentIds: [],
  warnings: [],
};

const aliquots: InventoryItem[] = [
  {
    id: "inv-a01",
    entityId: "entity-sample-1",
    name: "Working cell bank A01",
    currentQuantity: 1,
    unit: "vial",
    location: "Freezer A / box 1",
    status: "active",
  },
  {
    id: "inv-a02",
    entityId: "entity-sample-1",
    name: "Working cell bank A02",
    currentQuantity: 1,
    unit: "vial",
    location: "Freezer A / box 1",
    status: "active",
  },
  {
    id: "inv-other",
    entityId: "entity-other",
    name: "Unrelated sample",
    currentQuantity: 5,
    unit: "vial",
    location: "Freezer B",
    status: "active",
  },
];

describe("sample management helpers", () => {
  it("selects aliquots linked to the same sample entity", () => {
    expect(getSampleAliquots(sample, aliquots).map((item) => item.id)).toEqual(["inv-a01", "inv-a02"]);
  });

  it("derives sample-level quantity from aliquots", () => {
    expect(calculateSampleQuantityFromAliquots(sample, aliquots)).toBe(2);
  });

  it("blocks mixed-unit aliquot aggregation", () => {
    expect(() =>
      calculateSampleQuantityFromAliquots(sample, [
        ...aliquots.slice(0, 1),
        { ...aliquots[1], unit: "tube" },
      ]),
    ).toThrow("unit mismatch");
  });

  it("sorts lifecycle events with the newest event first", () => {
    const events: SampleLifecycleEvent[] = [
      {
        id: "event-old",
        sampleProfileId: sample.id,
        type: "register",
        title: "Registered",
        occurredAt: "2026-07-01T00:00:00Z",
      },
      {
        id: "event-new",
        sampleProfileId: sample.id,
        type: "thaw",
        title: "Thawed",
        occurredAt: "2026-07-02T00:00:00Z",
      },
    ];

    expect(sortSampleEventsByTime(events).map((event) => event.id)).toEqual(["event-new", "event-old"]);
  });

  it("counts only action-level sample warnings", () => {
    expect(
      countActionableSampleWarnings([
        {
          warnings: [
            { type: "freeze_thaw", severity: "watch", message: "Watch this vial." },
            { type: "missing_location", severity: "action", message: "Add a storage position." },
          ],
        },
      ]),
    ).toBe(1);
  });
});

