export const sequenceDesignTypes = [
  { value: "plasmid", label: "Plasmid", defaultMolecule: "DNA" },
  { value: "primer", label: "Primer", defaultMolecule: "DNA" },
  { value: "probe", label: "Probe", defaultMolecule: "DNA" },
  { value: "siRNA", label: "siRNA", defaultMolecule: "RNA" },
  { value: "shRNA", label: "shRNA", defaultMolecule: "RNA" },
  { value: "gRNA", label: "gRNA", defaultMolecule: "RNA" },
  { value: "oligo", label: "Oligo", defaultMolecule: "DNA" },
  { value: "peptide", label: "Peptide", defaultMolecule: "Protein" },
  { value: "protein", label: "Protein", defaultMolecule: "Protein" },
  { value: "fragment", label: "DNA / RNA fragment", defaultMolecule: "DNA" },
  { value: "other", label: "Other", defaultMolecule: "DNA" },
] as const;

export const sequenceEntryClasses = [
  { value: "nucleic_acid", label: "DNA / RNA sequence" },
  { value: "amino_acid", label: "Amino acid sequence" },
  { value: "oligo", label: "Oligo" },
] as const;

export const sequencePairTypes = [
  { value: "primer_pair", label: "Primer pair", roles: ["forward", "reverse"] },
  { value: "sirna_duplex", label: "siRNA duplex", roles: ["sense", "antisense"] },
] as const;

export type SequenceDesignTypeValue = typeof sequenceDesignTypes[number]["value"];

export const sequenceLifecycleStatuses = [
  { value: "draft", label: "Draft", description: "Still being prepared and not ready for routine use." },
  { value: "active", label: "Active", description: "Available for selection in current work." },
  { value: "inactive", label: "Inactive", description: "Kept for traceability but not offered for routine use." },
  { value: "archived", label: "Archived", description: "Historical record retained without active maintenance." },
] as const;

export const sequenceValidationStatuses = [
  { value: "unverified", label: "Unverified", description: "No experimental validation has been recorded." },
  { value: "validation_in_progress", label: "Validation in progress", description: "Validation experiments are underway." },
  { value: "validated_recommended", label: "Validated · recommended", description: "Verified to perform well and recommended for continued use." },
  { value: "validated_limited", label: "Validated · limited use", description: "Usable only under documented conditions or with known limitations." },
  { value: "validated_not_recommended", label: "Validated · not recommended", description: "Tested and retained for history, but should not be selected for new work." },
  { value: "inconclusive", label: "Inconclusive", description: "Available evidence does not support a clear decision." },
] as const;

export const sequenceCollectionTypes = [
  { value: "primer_panel", label: "Primer panel", roles: ["member"] },
  { value: "sirna_series", label: "siRNA series", roles: ["member"] },
  { value: "sequence_series", label: "Sequence series", roles: ["member"] },
  { value: "shrna_construct", label: "shRNA construct", roles: ["guide", "loop", "antisense", "full_hairpin"] },
  { value: "probe_panel", label: "Probe panel", roles: ["probe"] },
  { value: "plasmid_construct", label: "Plasmid construct", roles: ["backbone", "insert", "full_construct"] },
  { value: "peptide_set", label: "Peptide set", roles: ["member"] },
  { value: "other", label: "Other set", roles: ["member"] },
] as const;

export type SequenceCollectionTypeValue = typeof sequenceCollectionTypes[number]["value"];

export const designMetadataFields: Partial<Record<SequenceDesignTypeValue, Array<{ key: string; label: string; placeholder?: string; type?: "text" | "number" }>>> = {
  plasmid: [
    { key: "backbone", label: "Backbone" },
    { key: "promoter", label: "Promoter" },
    { key: "selectionMarker", label: "Selection marker" },
    { key: "origin", label: "Origin of replication" },
    { key: "insertName", label: "Insert" },
  ],
  primer: [
    { key: "application", label: "Application", placeholder: "qPCR, sequencing, cloning…" },
    { key: "expectedTmC", label: "Expected Tm (°C)", type: "number" },
    { key: "ampliconLengthBp", label: "Expected amplicon (bp)", type: "number" },
  ],
  probe: [
    { key: "chemistry", label: "Probe chemistry", placeholder: "TaqMan, molecular beacon…" },
    { key: "fluorophore", label: "Fluorophore" },
    { key: "quencher", label: "Quencher" },
    { key: "expectedTmC", label: "Expected Tm (°C)", type: "number" },
  ],
  siRNA: [
    { key: "transcriptAccession", label: "Transcript accession" },
    { key: "targetRegion", label: "Target region" },
    { key: "designSource", label: "Design source" },
  ],
  shRNA: [
    { key: "transcriptAccession", label: "Transcript accession" },
    { key: "targetRegion", label: "Target region" },
    { key: "designSource", label: "Design source" },
    { key: "loopSequence", label: "Loop sequence" },
  ],
  gRNA: [
    { key: "transcriptAccession", label: "Transcript accession" },
    { key: "targetRegion", label: "Target region" },
    { key: "pam", label: "PAM" },
    { key: "designSource", label: "Design source" },
  ],
  peptide: [
    { key: "terminalModification", label: "Terminal modification" },
    { key: "purityPercent", label: "Purity (%)", type: "number" },
    { key: "designSource", label: "Design source" },
  ],
  protein: [
    { key: "accession", label: "Accession" },
    { key: "domain", label: "Domain / construct range" },
  ],
  oligo: [{ key: "application", label: "Application" }],
  fragment: [{ key: "source", label: "Source / accession" }],
  other: [{ key: "application", label: "Application" }],
};

export function validationStatusLabel(value: string) {
  return sequenceValidationStatuses.find((status) => status.value === value)?.label ?? value.replaceAll("_", " ");
}

export function designTypeLabel(value: string) {
  return sequenceDesignTypes.find((type) => type.value === value)?.label ?? value;
}

export function collectionTypeLabel(value: string) {
  return sequenceCollectionTypes.find((type) => type.value === value)?.label ?? sequencePairTypes.find((type) => type.value === value)?.label ?? value.replaceAll("_", " ");
}

export function entryClassLabel(value: string) {
  return sequenceEntryClasses.find((type) => type.value === value)?.label ?? value.replaceAll("_", " ");
}

export function pairTypeLabel(value: string) {
  return sequencePairTypes.find((type) => type.value === value)?.label ?? value.replaceAll("_", " ");
}
