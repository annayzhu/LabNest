export type SequenceOwnershipScopeValue = "library" | "project";
export type SequenceEntryClassValue = "nucleic_acid" | "amino_acid" | "oligo";
export type SequenceRecordKindValue = "single" | "paired";
export type SequencePairTypeValue = "primer_pair" | "sirna_duplex";
export type SequencePairRoleValue = "forward" | "reverse" | "sense" | "antisense";
export type SequenceCreateCategory =
  | "primer"
  | "single-primer"
  | "primer-pair"
  | "sirna-duplex"
  | "dna-rna"
  | "probe-oligo"
  | "oligo"
  | "crispr-guide"
  | "shrna"
  | "amino-acid";

const pairDefinitions = {
  primer_pair: { designType: "primer", moleculeType: "DNA", roles: ["forward", "reverse"], label: "Primer pair" },
  sirna_duplex: { designType: "siRNA", moleculeType: "RNA", roles: ["sense", "antisense"], label: "siRNA duplex" },
} as const satisfies Record<SequencePairTypeValue, { designType: "primer" | "siRNA"; moleculeType: "DNA" | "RNA"; roles: readonly [SequencePairRoleValue, SequencePairRoleValue]; label: string }>;

export function sequencePairDefinition(type: SequencePairTypeValue) {
  return pairDefinitions[type];
}

export function sequencePairTypeForDesignType(designType: string): SequencePairTypeValue | undefined {
  return designType === "primer" ? "primer_pair" : designType === "siRNA" ? "sirna_duplex" : undefined;
}

type SequenceCreationPreset = {
  recordKind: SequenceRecordKindValue;
  entryClass: SequenceEntryClassValue;
  moleculeType: "DNA" | "RNA" | "Protein";
  designType: "primer" | "siRNA" | "probe" | "oligo" | "gRNA" | "shRNA" | "protein" | "fragment";
  allowedDesignTypes?: readonly ("plasmid" | "primer" | "probe" | "siRNA" | "shRNA" | "gRNA" | "oligo" | "peptide" | "protein" | "fragment" | "other")[];
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
    allowedDesignTypes: ["plasmid", "fragment", "other"],
  },
  "amino-acid": {
    recordKind: "single",
    entryClass: "amino_acid",
    moleculeType: "Protein",
    designType: "protein",
    title: "New amino acid sequence",
    allowedDesignTypes: ["peptide", "protein", "other"],
  },
  oligo: {
    recordKind: "single",
    entryClass: "oligo",
    moleculeType: "DNA",
    designType: "oligo",
    title: "New oligo",
    allowedDesignTypes: ["probe", "oligo", "other"],
  },
  "probe-oligo": {
    recordKind: "single",
    entryClass: "oligo",
    moleculeType: "DNA",
    designType: "probe",
    title: "New probe / oligo",
    allowedDesignTypes: ["probe", "oligo", "other"],
  },
  "single-primer": {
    recordKind: "single",
    entryClass: "oligo",
    moleculeType: "DNA",
    designType: "primer",
    title: "New single primer",
    allowedDesignTypes: ["primer"],
  },
  "crispr-guide": {
    recordKind: "single",
    entryClass: "oligo",
    moleculeType: "RNA",
    designType: "gRNA",
    title: "New CRISPR guide",
    allowedDesignTypes: ["gRNA"],
  },
  shrna: {
    recordKind: "single",
    entryClass: "oligo",
    moleculeType: "RNA",
    designType: "shRNA",
    title: "New shRNA",
    allowedDesignTypes: ["shRNA"],
  },
  primer: {
    recordKind: "paired",
    entryClass: "oligo",
    moleculeType: "DNA",
    designType: "primer",
    pairType: "primer_pair",
    roles: ["forward", "reverse"],
    title: "New primer pair",
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

export function sequenceCreationPreset(value: string | undefined): SequenceCreationPreset | undefined {
  return presets[value as SequenceCreateCategory];
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
  return sequencePairDefinition(type).roles;
}

export type SequencePairMetadataFieldDefinition = {
  key: "application" | "transcriptAccession" | "ampliconLengthBp" | "exonJunction" | "targetRegion" | "designSource";
  label: string;
  placeholder: string;
  type?: "number";
  min?: number;
  unit?: string;
  pairTypes: readonly SequencePairTypeValue[];
};

export const sequencePairMetadataFieldDefinitions = [
  { key: "application", label: "Application", placeholder: "qPCR, genotyping, cloning…", pairTypes: ["primer_pair"] },
  { key: "transcriptAccession", label: "Template / transcript accession", placeholder: "NM_… / ENST…", pairTypes: ["primer_pair", "sirna_duplex"] },
  { key: "ampliconLengthBp", label: "Expected amplicon (bp)", placeholder: "120", type: "number", min: 1, unit: "bp", pairTypes: ["primer_pair"] },
  { key: "exonJunction", label: "Exon-junction strategy", placeholder: "Spans exon 5–6 junction", pairTypes: ["primer_pair"] },
  { key: "targetRegion", label: "Target region", placeholder: "CDS position or exon", pairTypes: ["sirna_duplex"] },
  { key: "designSource", label: "Design source", placeholder: "Supplier, publication, or design tool", pairTypes: ["primer_pair", "sirna_duplex"] },
] as const satisfies readonly SequencePairMetadataFieldDefinition[];

export function sequencePairMetadataFields(type: SequencePairTypeValue): readonly SequencePairMetadataFieldDefinition[] {
  return sequencePairMetadataFieldDefinitions.filter((field) => (field.pairTypes as readonly SequencePairTypeValue[]).includes(type));
}

export function normalizeSequencePairMetadata(type: SequencePairTypeValue, values: Record<string, unknown>) {
  const entries: Array<[string, string | number]> = [];
  for (const field of sequencePairMetadataFields(type)) {
    const raw = String(values[field.key] ?? "").trim();
    if (!raw) continue;
    if (field.type === "number") {
      const number = Number(raw);
      if (!Number.isFinite(number) || (field.min !== undefined && number < field.min)) throw new Error(`${field.label} must be ${field.min !== undefined ? `at least ${field.min}` : "a number"}.`);
      entries.push([field.key, number]);
    } else entries.push([field.key, raw]);
  }
  return Object.fromEntries(entries);
}

export function sequenceWorkflowLabel(type: string) {
  if (type === "alignment") return "Alignment";
  if (type === "assembly") return "Assembly";
  return "CRISPR design";
}
