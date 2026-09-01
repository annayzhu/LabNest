import { describe, expect, it } from "vitest";
import {
  collectionTypeIsPair,
  normalizeSequenceOwnership,
  sequenceCreationPreset,
  sequencePairDefinition,
} from "./sequence-entry";

describe("sequence creation presets", () => {
  it("maps the public create categories to concrete record defaults", () => {
    expect(sequenceCreationPreset("dna-rna")).toMatchObject({
      recordKind: "single",
      entryClass: "nucleic_acid",
      moleculeType: "DNA",
    });
    expect(sequenceCreationPreset("amino-acid")).toMatchObject({
      recordKind: "single",
      entryClass: "amino_acid",
      moleculeType: "Protein",
    });
    expect(sequenceCreationPreset("oligo")).toMatchObject({
      recordKind: "single",
      entryClass: "oligo",
      designType: "oligo",
    });
  });

  it("treats primer pairs and siRNA duplexes as one paired entry", () => {
    expect(sequenceCreationPreset("primer-pair")).toMatchObject({
      recordKind: "paired",
      pairType: "primer_pair",
      roles: ["forward", "reverse"],
      moleculeType: "DNA",
    });
    expect(sequenceCreationPreset("sirna-duplex")).toMatchObject({
      recordKind: "paired",
      pairType: "sirna_duplex",
      roles: ["sense", "antisense"],
      moleculeType: "RNA",
    });
  });

  it("keeps molecule and design semantics tied to the pair type", () => {
    expect(sequencePairDefinition("primer_pair")).toMatchObject({ designType: "primer", moleculeType: "DNA", roles: ["forward", "reverse"] });
    expect(sequencePairDefinition("sirna_duplex")).toMatchObject({ designType: "siRNA", moleculeType: "RNA", roles: ["sense", "antisense"] });
  });
});

describe("sequence ownership", () => {
  it("normalizes a library entry to no owner Project", () => {
    expect(normalizeSequenceOwnership("library", "project-ignored")).toEqual({
      ownershipScope: "library",
      projectId: null,
    });
  });

  it("requires a Project for a Project-owned entry", () => {
    expect(() => normalizeSequenceOwnership("project", undefined)).toThrow("Choose a Project");
    expect(normalizeSequenceOwnership("project", "project-1")).toEqual({
      ownershipScope: "project",
      projectId: "project-1",
    });
  });
});

describe("legacy pair compatibility", () => {
  it("recognizes only the two-member collection types as pairs", () => {
    expect(collectionTypeIsPair("primer_pair")).toBe(true);
    expect(collectionTypeIsPair("sirna_duplex")).toBe(true);
    expect(collectionTypeIsPair("probe_panel")).toBe(false);
  });
});
