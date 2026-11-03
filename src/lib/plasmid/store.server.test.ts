import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

const { storedFeature, versionFingerprint } = await import("./store.server");

describe("plasmid versions", () => {
  const feature = { name: "CDS", type: "CDS", strand: -1 as const, segments: [{ start: 0, end: 80 }, { start: 460, end: 500 }], codonStart: 1 as const, qualifiers: { label: ["CDS"], note: ["a"] }, evidence: "file" as const };
  const record = { sequence: "ACGT".repeat(125), topology: "circular" as const, features: [feature] };

  it("sees no change when JSONB hands the qualifiers back in another key order", () => {
    const stored = storedFeature({ name: "CDS", type: "CDS", start: 1, end: 500, strand: "-", note: "a", segmentsJson: [{ end: 80, start: 0 }, { end: 500, start: 460 }], codonStart: 1, qualifiersJson: { note: ["a"], label: ["CDS"] }, color: null, evidence: "file" });
    expect(stored.segments).toEqual(feature.segments);
    expect(versionFingerprint({ ...record, features: [stored] }, "full_length")).toBe(versionFingerprint(record, "full_length"));
  });

  it("makes a new version when completeness, topology or a feature changes", () => {
    const base = versionFingerprint(record, "full_length");
    expect(versionFingerprint(record, "unknown")).not.toBe(base);
    expect(versionFingerprint({ ...record, topology: "linear" }, "full_length")).not.toBe(base);
    expect(versionFingerprint({ ...record, features: [{ ...feature, segments: [{ start: 0, end: 81 }, { start: 460, end: 500 }] }] }, "full_length")).not.toBe(base);
  });

  it("reads rows written before exact segments as one 1-based span", () => {
    expect(storedFeature({ name: "GFP", type: "CDS", start: 1, end: 120, strand: "+", note: null })).toMatchObject({ strand: 1, segments: [{ start: 0, end: 120 }], qualifiers: {} });
  });
});
