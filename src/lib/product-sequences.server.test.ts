import { describe, expect, it, vi } from "vitest";
import { sequenceKind } from "./product-sequences";

vi.mock("./record-codes", () => ({ reserveRecordCode: vi.fn() }));

const { saveProductSequences } = await import("./product-sequences.server");

describe("editing a plasmid's bases on the product page", () => {
  it("keeps the topology, the completeness and the features away from the changed bases", async () => {
    const row = (name: string, start: number, end: number, order: number) => ({
      name, type: "misc_feature", start: start + 1, end, strand: "+", note: null, segmentsJson: [{ start, end }], codonStart: null,
      qualifiersJson: { label: [name] }, color: "#336699", evidence: "file", sourceLabel: "pUC19.gb", order,
    });
    const created: Array<Record<string, unknown>> = [];
    const tx = {
      entity: { create: vi.fn(), update: vi.fn() },
      entitySequenceLink: {
        findMany: vi.fn(async () => [{
          id: "link", role: "primary", sequenceId: "sequence",
          sequenceVersion: { sequence: "AAAACCCCGGGGTTTT", topology: "circular", completeness: "full_length", features: [row("before", 0, 4, 0), row("over", 6, 10, 1), row("after", 8, 12, 2)] },
        }]),
        update: vi.fn(),
      },
      sequenceVersion: {
        findFirst: vi.fn(async () => ({ versionNumber: 1 })),
        create: vi.fn(async (input: { data: Record<string, unknown> }) => {
          created.push(input.data);
          return { id: "version-2" };
        }),
      },
    };
    // Two bases go in after the Cs: "over" sits on them, "after" moves along.
    await saveProductSequences(tx as never, { name: "pUC19", entityId: "entity" }, sequenceKind("plasmid")!, { primary: "AAAACCCCAAGGGGTTTT" });
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ topology: "circular", completeness: "full_length", changeSummary: "Changed on the product page; 1 feature(s) on the changed bases were dropped." });
    const features = (created[0].features as { create: Array<{ name: string; segmentsJson: unknown; start: number; end: number; sourceLabel: string | null; color: string | null }> }).create;
    expect(features.map((feature) => [feature.name, feature.segmentsJson, feature.start, feature.end])).toEqual([
      ["before", [{ start: 0, end: 4 }], 1, 4],
      ["after", [{ start: 10, end: 14 }], 11, 14],
    ]);
    expect(features.every((feature) => feature.sourceLabel === "pUC19.gb" && feature.color === "#336699")).toBe(true);
  });
});
