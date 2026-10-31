import { estimatedMeltingTemperature, estimatedMolecularWeight, gcPercent, reverseComplement, sequenceLength, toFasta, validateSequence, type MoleculeType } from "./sequence";

// Sequences belong to products (docs/modules/inventory/sequence-merge-20261031, Q185): a primer pair is one product with
// a forward and a reverse strand, an siRNA one with sense and antisense, and a probe, gRNA, plasmid or protein one with
// a single sequence. The strands are sequence records linked to the product's entity, one link per role.

export type SequenceStrand = { role: string; label: string };
export type SequenceKind = {
  design: "primer" | "siRNA" | "probe" | "gRNA" | "plasmid" | "protein";
  molecule: MoleculeType;
  entity: "primer" | "oligo" | "plasmid" | "protein";
  strands: SequenceStrand[];
};

/** The product types whose products carry sequences, by type key, with the strands each holds in order. */
export const sequenceKinds: Record<string, SequenceKind> = {
  primer: { design: "primer", molecule: "DNA", entity: "primer", strands: [{ role: "forward", label: "Forward primer" }, { role: "reverse", label: "Reverse primer" }] },
  sirna: { design: "siRNA", molecule: "RNA", entity: "oligo", strands: [{ role: "sense", label: "Sense strand" }, { role: "antisense", label: "Antisense strand" }] },
  probe: { design: "probe", molecule: "DNA", entity: "oligo", strands: [{ role: "primary", label: "Sequence" }] },
  grna: { design: "gRNA", molecule: "DNA", entity: "oligo", strands: [{ role: "primary", label: "Spacer sequence" }] },
  plasmid: { design: "plasmid", molecule: "DNA", entity: "plasmid", strands: [{ role: "primary", label: "Sequence" }] },
  protein: { design: "protein", molecule: "Protein", entity: "protein", strands: [{ role: "primary", label: "Sequence" }] },
};

export const sequenceKind = (typeKey: string | null | undefined) => (typeKey ? sequenceKinds[typeKey] : undefined);

/** The typed strands, checked and written the way sequences are kept; an empty strand is "". Throws on a bad letter. */
export function cleanStrands(kind: SequenceKind, typed: Record<string, string>) {
  return kind.strands.map((strand) => {
    const raw = typed[strand.role]?.trim() ?? "";
    if (!raw) return { ...strand, sequence: "" };
    const checked = validateSequence(raw, kind.molecule, { allowTerminalDeoxythymidineOverhang: kind.design === "siRNA" });
    if (checked.errors.length) throw new Error(`${strand.label}: ${checked.errors.join(" ")}`);
    return { ...strand, sequence: checked.normalized };
  });
}

/** What a strand's numbers are: length, GC and an estimated Tm for nucleic acids, molecular weight for all. */
export function strandFacts(sequence: string, molecule: MoleculeType) {
  const nucleic = molecule !== "Protein";
  return {
    length: sequenceLength(sequence),
    gc: nucleic ? gcPercent(sequence) : undefined,
    tm: nucleic && sequenceLength(sequence) <= 60 ? estimatedMeltingTemperature(sequence, molecule) : undefined,
    weight: estimatedMolecularWeight(sequence, molecule),
    reverseComplement: nucleic ? reverseComplement(sequence, molecule) : undefined,
  };
}

/** FASTA for products' strands: one record per strand, named “product strand”. */
export function productsFasta(products: { name: string; strands: { label: string; sequence: string }[] }[]) {
  return products.flatMap((product) => product.strands.map((strand) => toFasta(product.strands.length > 1 ? `${product.name} ${strand.label}` : product.name, strand.sequence))).join("\n");
}
