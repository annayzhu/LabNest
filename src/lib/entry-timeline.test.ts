import { describe, expect, it } from "vitest";
import { groupEntriesByMonth, summarizeProjectCollections } from "./entry-timeline";
import type { Entry } from "./types";

function entry(overrides: Partial<Entry> & Pick<Entry, "id" | "occurredAt">): Entry {
  return {
    title: "Entry",
    body: "Observation",
    tags: [],
    sourceType: "text",
    recordStatus: "recorded",
    attachmentCount: 0,
    relevantItems: [],
    pendingActionCount: 0,
    ...overrides,
  };
}

describe("entry timeline", () => {
  it("groups entries by calendar month while preserving input order", () => {
    const entries = [
      entry({ id: "aug-2", occurredAt: "2026-08-08T10:00:00.000Z" }),
      entry({ id: "aug-1", occurredAt: "2026-08-01T10:00:00.000Z" }),
      entry({ id: "jul-1", occurredAt: "2026-07-31T10:00:00.000Z" }),
    ];

    const groups = groupEntriesByMonth(entries);

    expect(groups.map((group) => group.key)).toEqual(["2026-08", "2026-07"]);
    expect(groups[0].entries.map((item) => item.id)).toEqual(["aug-2", "aug-1"]);
  });

  it("summarizes project-backed journals and excludes unassigned entries", () => {
    const entries = [
      entry({ id: "one", occurredAt: "2026-08-08T10:00:00.000Z", projectId: "p1", projectName: "Alpha" }),
      entry({ id: "two", occurredAt: "2026-08-07T10:00:00.000Z", projectId: "p1", projectName: "Alpha" }),
      entry({ id: "three", occurredAt: "2026-08-06T10:00:00.000Z" }),
    ];

    expect(summarizeProjectCollections(entries)).toEqual([{ id: "p1", name: "Alpha", count: 2 }]);
  });
});
