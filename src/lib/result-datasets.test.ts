import { describe, expect, it } from "vitest";
import { inspectDataset } from "./result-datasets";

describe("result dataset inspection", () => {
  it("keeps the full dimensions but only a bounded preview", async () => {
    const rows = ["sample,ct,detected", ...Array.from({ length: 40 }, (_, index) => `S${index + 1},${20 + index / 10},true`)];
    const preview = await inspectDataset(Buffer.from(rows.join("\n")), "qpcr.csv");
    expect(preview.rowCount).toBe(40);
    expect(preview.columnCount).toBe(3);
    expect(preview.rows).toHaveLength(30);
    expect(preview.columns[1]).toMatchObject({ name: "ct", inferredType: "number" });
  });
});
