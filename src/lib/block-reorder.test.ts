import { describe, expect, it } from "vitest";
import { reorderBlocks } from "./block-reorder";

describe("block reordering", () => {
  const blocks = ["objective", "table", "notes", "warning"];

  it("moves a block before a later target", () => {
    expect(reorderBlocks(blocks, 0, 2, "before")).toEqual(["table", "objective", "notes", "warning"]);
  });

  it("moves a block after a later target", () => {
    expect(reorderBlocks(blocks, 0, 2, "after")).toEqual(["table", "notes", "objective", "warning"]);
  });

  it("moves a block around an earlier target", () => {
    expect(reorderBlocks(blocks, 3, 1, "before")).toEqual(["objective", "warning", "table", "notes"]);
    expect(reorderBlocks(blocks, 3, 1, "after")).toEqual(["objective", "table", "warning", "notes"]);
  });

  it("keeps the original order for equivalent or invalid drops", () => {
    expect(reorderBlocks(blocks, 1, 1, "before")).toBe(blocks);
    expect(reorderBlocks(blocks, 0, 1, "before")).toBe(blocks);
    expect(reorderBlocks(blocks, -1, 1, "after")).toBe(blocks);
  });
});
