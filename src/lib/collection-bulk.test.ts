import { describe, expect, it } from "vitest";
import { collectionBulkSchema, planCollectionBulk, type BulkSnapshot } from "./collection-bulk";

const row: BulkSnapshot = { id: "a", title: "Synthetic", status: "active", tags: ["original"], updatedAt: "2026-01-01" };
const request = (overrides: Record<string, unknown> = {}) => collectionBulkSchema.parse({ kind: "project", ids: ["a"], operation: "edit", ...overrides });
describe("collection bulk scope and lifecycle", () => {
  it("rejects over 500, duplicates, unselected titles and scientific fields", () => {
    for (const patch of [{ ids: Array.from({ length: 501 }, (_, i) => `${i}`) }, { ids: ["a", "a"] }, { titles: [{ id: "b", title: "Other" }] }, { numericValue: 2 }]) expect(() => request(patch)).toThrow();
    expect(request({ ids: Array.from({ length: 500 }, (_, i) => `${i}`) }).ids).toHaveLength(500);
  });
  it("rejects execution status, Result tags, wrong notes and implicit blank replacement", () => {
    for (const patch of [{ kind: "experiment", status: "completed" }, { kind: "result", tags: { mode: "add", values: ["x"] } }, { appendNotes: "x" }, { tags: { mode: "replace", values: [] } }, { titles: [{ id: "a", title: " " }] }]) expect(() => request(patch)).toThrow();
  });
  it("defaults to no modification and explicitly adds/removes/replaces tags", () => {
    expect(planCollectionBulk(request(), [row])[0].outcome).toBe("noop");
    for (const [mode, expected] of [["add", ["original", "new"]], ["remove", ["original"]], ["replace", ["new"]]] as const) expect(planCollectionBulk(request({ tags: { mode, values: ["new", "new"] } }), [row])[0].after?.tags).toEqual(expected);
  });
  it("skips locked and missing records without unlocking", () => {
    const plan = planCollectionBulk(request({ ids: ["a", "b"], titles: [{ id: "a", title: "Changed" }] }), [{ ...row, recordStatus: "reviewed" }]);
    expect(plan.map(row => row.outcome)).toEqual(["skip", "skip"]);
    expect(plan[0].after?.title).toBe("Synthetic");
  });
  it("appends notes preserving the old value", () => {
    const plan = planCollectionBulk(request({ kind: "result", appendNotes: "Added" }), [{ ...row, tags: undefined, notes: "Original" }]);
    expect(plan[0].after?.notes).toBe("Original\n\nAdded");
  });
  it("previews archive fallback and association preserving recycle distinctly", () => {
    expect(planCollectionBulk(request({ operation: "delete" }), [{ ...row, deletion: { mode: "archive", counts: { experiments: 1 } } }])[0].outcome).toBe("archive");
    expect(planCollectionBulk(request({ operation: "delete" }), [{ ...row, deletion: { mode: "soft", counts: {} } }])[0].outcome).toBe("retain_recycle");
    expect(planCollectionBulk(request({ operation: "delete" }), [{ ...row, deletion: { mode: "physical", counts: {} } }])[0].after).toBeUndefined();
  });
  it("never guesses the status of old archives, and restores a reliable run status", () => {
    const archived = { ...row, status: "archived", runStatus: "archived" };
    expect(planCollectionBulk(request({ operation: "restore" }), [archived])[0].needsStatus).toBe(true);
    expect(planCollectionBulk(request({ operation: "restore", restoreStatuses: { a: "paused" } }), [archived])[0].after?.status).toBe("paused");
    const plan = planCollectionBulk(request({ kind: "experiment", operation: "restore" }), [{ ...archived, previousStatus: "failed", previousRunStatus: "running" }]);
    expect(plan[0].after).toMatchObject({ status: "failed", runStatus: "running" });
    expect(planCollectionBulk(request({ operation: "archive" }), [archived])[0].outcome).toBe("noop");
    expect(planCollectionBulk(request({ kind: "experiment", tags: { mode: "add", values: ["x"] } }), [{ ...archived, runStatus: "planned" }])[0].after?.runStatus).toBe("planned");
    expect(planCollectionBulk(request({ operation: "archive" }), [{ ...archived, runStatus: "planned" }])[0].outcome).toBe("noop");
  });
});
