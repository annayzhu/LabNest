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
export type SequenceEntryClassValue = typeof sequenceEntryClasses[number]["value"];

const designTypesByEntryClass: Record<SequenceEntryClassValue, readonly SequenceDesignTypeValue[]> = {
  nucleic_acid: ["plasmid", "fragment", "other"],
  amino_acid: ["peptide", "protein", "other"],
  oligo: ["probe", "shRNA", "gRNA", "oligo", "other"],
};

export function sequenceDesignTypesForEntryClass(entryClass: SequenceEntryClassValue) {
  const allowed = new Set<SequenceDesignTypeValue>(designTypesByEntryClass[entryClass]);
  return sequenceDesignTypes.filter((item) => allowed.has(item.value));
}

type SequenceInputPrompt = {
  nameLabel: string;
  namePlaceholder: string;
  targetLabel: string;
  targetPlaceholder: string;
  organismLabel: string;
  organismPlaceholder: string;
  descriptionPlaceholder: string;
  validationPlaceholder: string;
  changeSummaryPlaceholder: string;
};

const genericSequenceInputPrompt: SequenceInputPrompt = {
  nameLabel: "Sequence name *",
  namePlaceholder: "FBN2 sequence",
  targetLabel: "Target / source",
  targetPlaceholder: "Gene, transcript, locus, or source",
  organismLabel: "Source organism",
  organismPlaceholder: "Homo sapiens",
  descriptionPlaceholder: "Purpose, source, and relevant design context…",
  validationPlaceholder: "Evidence, conditions, limitations, and decision…",
  changeSummaryPlaceholder: "Initial design or source.",
};

const sequenceInputPrompts: Partial<Record<SequenceDesignTypeValue, Partial<SequenceInputPrompt>>> = {
  plasmid: {
    nameLabel: "Plasmid name *",
    namePlaceholder: "pLenti-FBN2",
    targetLabel: "Insert / construct",
    targetPlaceholder: "FBN2 CDS",
    descriptionPlaceholder: "Vector purpose, backbone, insert, and source…",
  },
  primer: {
    nameLabel: "Primer name *",
    namePlaceholder: "FBN2 primer",
    targetLabel: "Target gene / transcript",
    targetPlaceholder: "FBN2 / transcript accession",
    descriptionPlaceholder: "Application, expected amplicon, and design source…",
    validationPlaceholder: "Efficiency, specificity, assay conditions, and decision…",
  },
  probe: {
    nameLabel: "Probe name *",
    namePlaceholder: "FBN2 TaqMan probe",
    targetLabel: "Target gene / transcript",
    targetPlaceholder: "FBN2 / transcript accession",
    descriptionPlaceholder: "Assay, chemistry, target region, and design source…",
  },
  siRNA: {
    nameLabel: "siRNA name *",
    namePlaceholder: "FBN2 siRNA 1",
    targetLabel: "Target gene / transcript",
    targetPlaceholder: "FBN2 / transcript accession",
    descriptionPlaceholder: "Target position, duplex source, and intended assay…",
    validationPlaceholder: "Knockdown conditions, measured effect, and limitations…",
  },
  shRNA: {
    nameLabel: "shRNA name *",
    namePlaceholder: "FBN2 shRNA 1",
    targetLabel: "Target gene / transcript",
    targetPlaceholder: "FBN2 / transcript accession",
    descriptionPlaceholder: "Vector context, target position, and design source…",
  },
  gRNA: {
    nameLabel: "gRNA name *",
    namePlaceholder: "FBN2 exon 3 gRNA 1",
    targetLabel: "Target gene / locus",
    targetPlaceholder: "FBN2 exon 3 / genomic locus",
    descriptionPlaceholder: "Editing objective, target locus, PAM, and design source…",
    validationPlaceholder: "Editing conditions, efficiency, specificity, and limitations…",
  },
  oligo: {
    nameLabel: "Oligo name *",
    namePlaceholder: "FBN2 capture oligo 1",
    targetLabel: "Target / application",
    targetPlaceholder: "FBN2 / adapter / barcode",
    descriptionPlaceholder: "Application, supplier notation, and design source…",
  },
  peptide: {
    nameLabel: "Peptide name *",
    namePlaceholder: "FBN2 peptide 1",
    targetLabel: "Protein / epitope",
    targetPlaceholder: "FBN2 amino-acid range",
    descriptionPlaceholder: "Biological purpose, residue range, purity, and source…",
  },
  protein: {
    nameLabel: "Protein / construct name *",
    namePlaceholder: "FBN2 protein construct",
    targetLabel: "Gene / accession",
    targetPlaceholder: "FBN2 / protein accession",
    descriptionPlaceholder: "Construct boundaries, expression context, and source…",
    validationPlaceholder: "Identity, purity, activity evidence, and limitations…",
  },
  fragment: {
    nameLabel: "Sequence name *",
    namePlaceholder: "FBN2 CDS fragment",
    targetLabel: "Gene / region / accession",
    targetPlaceholder: "FBN2 CDS / transcript accession",
    descriptionPlaceholder: "Sequence region, source, and intended use…",
  },
  other: {
    nameLabel: "Sequence name *",
    namePlaceholder: "Descriptive sequence name",
  },
};

export function sequenceInputPrompt(designType: SequenceDesignTypeValue, moleculeType: "DNA" | "RNA" | "Protein") {
  const prompt = { ...genericSequenceInputPrompt, ...sequenceInputPrompts[designType] };
  return {
    ...prompt,
    sequenceLabel: moleculeType === "Protein" ? "Amino acid sequence (N → C) *" : `${moleculeType} sequence (5′ → 3′) *`,
    sequencePlaceholder: moleculeType === "Protein" ? "MKWVTFISLL…" : moleculeType === "RNA" ? "AUGCUU…" : "ATGCTT…",
  };
}

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
    { key: "backbone", label: "Backbone", placeholder: "pLenti, pcDNA3.1…" },
    { key: "promoter", label: "Promoter", placeholder: "CMV, EF1α, U6…" },
    { key: "selectionMarker", label: "Selection marker", placeholder: "Puromycin, ampicillin…" },
    { key: "origin", label: "Origin of replication", placeholder: "pUC, ColE1…" },
    { key: "insertName", label: "Insert", placeholder: "FBN2 CDS" },
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
    { key: "transcriptAccession", label: "Transcript accession", placeholder: "NM_… / ENST…" },
    { key: "targetRegion", label: "Target region", placeholder: "CDS position or exon" },
    { key: "designSource", label: "Design source", placeholder: "Supplier, publication, or design tool" },
  ],
  shRNA: [
    { key: "transcriptAccession", label: "Transcript accession", placeholder: "NM_… / ENST…" },
    { key: "targetRegion", label: "Target region", placeholder: "CDS position or exon" },
    { key: "designSource", label: "Design source", placeholder: "Supplier, publication, or design tool" },
    { key: "loopSequence", label: "Loop sequence", placeholder: "TTCAAGAGA" },
  ],
  gRNA: [
    { key: "transcriptAccession", label: "Transcript accession", placeholder: "NM_… / ENST…" },
    { key: "targetRegion", label: "Target region", placeholder: "Exon, genomic coordinate, or regulatory element" },
    { key: "pam", label: "PAM" },
    { key: "designSource", label: "Design source", placeholder: "CRISPick, CHOPCHOP, publication…" },
  ],
  peptide: [
    { key: "terminalModification", label: "Terminal modification", placeholder: "N-acetyl, C-amide…" },
    { key: "purityPercent", label: "Purity (%)", type: "number" },
    { key: "designSource", label: "Design source", placeholder: "Protein region, publication, or supplier" },
  ],
  protein: [
    { key: "accession", label: "Accession", placeholder: "UniProt or RefSeq accession" },
    { key: "domain", label: "Domain / construct range", placeholder: "Full length or amino-acid range" },
  ],
  oligo: [{ key: "application", label: "Application", placeholder: "Adapter, barcode, capture, blocking…" }],
  fragment: [{ key: "source", label: "Source / accession", placeholder: "Transcript, genome build, or publication" }],
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
