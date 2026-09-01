export type SequenceOwnershipScopeValue = "library" | "project";
export type SequenceEntryClassValue = "nucleic_acid" | "amino_acid" | "oligo";
export type SequenceRecordKindValue = "single" | "paired";
export type SequencePairTypeValue = "primer_pair" | "sirna_duplex";
export type SequencePairRoleValue = "forward" | "reverse" | "sense" | "antisense";
export type SequenceCreateCategory = "dna-rna" | "amino-acid" | "oligo" | "primer-pair" | "sirna-duplex";

type SequenceCreationPreset = {
  recordKind: SequenceRecordKindValue;
  entryClass: SequenceEntryClassValue;
  moleculeType: "DNA" | "RNA" | "Protein";
  designType: "primer" | "siRNA" | "oligo" | "protein" | "fragment";
  pairType?: SequencePairTypeValue;
  roles?: readonly [SequencePairRoleValue, SequencePairRoleValue];
  title: string;
};

const presets: Record<SequenceCreateCategory, SequenceCreationPreset> = {
  "dna-rna": {
    recordKind: "single",
    entryClass: "nucleic_acid",
    moleculeType: "DNA",
    designType: "fragment",
    title: "New DNA / RNA sequence",
  },
  "amino-acid": {
    recordKind: "single",
    entryClass: "amino_acid",
    moleculeType: "Protein",
    designType: "protein",
    title: "New amino acid sequence",
  },
  oligo: {
    recordKind: "single",
    entryClass: "oligo",
    moleculeType: "DNA",
    designType: "oligo",
    title: "New oligo",
  },
  "primer-pair": {
    recordKind: "paired",
    entryClass: "oligo",
    moleculeType: "DNA",
    designType: "primer",
    pairType: "primer_pair",
    roles: ["forward", "reverse"],
    title: "New primer pair",
  },
  "sirna-duplex": {
    recordKind: "paired",
    entryClass: "oligo",
    moleculeType: "RNA",
    designType: "siRNA",
    pairType: "sirna_duplex",
    roles: ["sense", "antisense"],
    title: "New siRNA duplex",
  },
};

export function sequenceCreationPreset(value: string | undefined): SequenceCreationPreset {
  return presets[value as SequenceCreateCategory] ?? presets["dna-rna"];
}

export function normalizeSequenceOwnership(scope: unknown, projectId: unknown) {
  if (scope === "project") {
    const normalizedProjectId = String(projectId ?? "").trim();
    if (!normalizedProjectId) throw new Error("Choose a Project for a Project-owned sequence entry.");
    return { ownershipScope: "project" as const, projectId: normalizedProjectId };
  }
  return { ownershipScope: "library" as const, projectId: null };
}

export function collectionTypeIsPair(value: string): value is SequencePairTypeValue {
  return value === "primer_pair" || value === "sirna_duplex";
}

export function sequencePairRoles(type: SequencePairTypeValue): readonly [SequencePairRoleValue, SequencePairRoleValue] {
  return type === "primer_pair" ? ["forward", "reverse"] : ["sense", "antisense"];
}

export function sequenceWorkflowLabel(type: string) {
  if (type === "alignment") return "Alignment";
  if (type === "assembly") return "Assembly";
  return "CRISPR design";
}
