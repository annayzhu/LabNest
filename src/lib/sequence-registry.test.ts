import { describe, expect, it } from "vitest";
import { sequenceDesignTypesForEntryClass, sequenceInputPrompt } from "./sequence-registry";

describe("sequence design type boundaries", () => {
  it("offers only design types that fit the selected entry class", () => {
    expect(sequenceDesignTypesForEntryClass("nucleic_acid").map((item) => item.value)).toEqual(["plasmid", "fragment", "other"]);
    expect(sequenceDesignTypesForEntryClass("amino_acid").map((item) => item.value)).toEqual(["peptide", "protein", "other"]);
    expect(sequenceDesignTypesForEntryClass("oligo").map((item) => item.value)).toEqual(["probe", "shRNA", "gRNA", "oligo", "other"]);
  });
});

describe("sequence input prompts", () => {
  it("uses design-specific identity and target prompts", () => {
    expect(sequenceInputPrompt("plasmid", "DNA")).toMatchObject({
      nameLabel: "Plasmid name *",
      namePlaceholder: "pLenti-FBN2",
      targetLabel: "Insert / construct",
    });
    expect(sequenceInputPrompt("gRNA", "RNA")).toMatchObject({
      nameLabel: "gRNA name *",
      targetLabel: "Target gene / locus",
    });
    expect(sequenceInputPrompt("peptide", "Protein")).toMatchObject({
      nameLabel: "Peptide name *",
      targetLabel: "Protein / epitope",
    });
  });

  it("uses the scientifically correct sequence direction for each molecule", () => {
    expect(sequenceInputPrompt("fragment", "DNA").sequenceLabel).toBe("DNA sequence (5′ → 3′) *");
    expect(sequenceInputPrompt("fragment", "RNA").sequenceLabel).toBe("RNA sequence (5′ → 3′) *");
    expect(sequenceInputPrompt("protein", "Protein").sequenceLabel).toBe("Amino acid sequence (N → C) *");
  });
});
