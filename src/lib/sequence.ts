const dnaComplement: Record<string, string> = {
  A: "T",
  T: "A",
  G: "C",
  C: "G",
  N: "N",
};

const rnaComplement: Record<string, string> = {
  A: "U",
  U: "A",
  G: "C",
  C: "G",
  N: "N",
};

const codonTable: Record<string, string> = {
  TTT: "F",
  TTC: "F",
  TTA: "L",
  TTG: "L",
  CTT: "L",
  CTC: "L",
  CTA: "L",
  CTG: "L",
  ATT: "I",
  ATC: "I",
  ATA: "I",
  ATG: "M",
  GTT: "V",
  GTC: "V",
  GTA: "V",
  GTG: "V",
  TCT: "S",
  TCC: "S",
  TCA: "S",
  TCG: "S",
  CCT: "P",
  CCC: "P",
  CCA: "P",
  CCG: "P",
  ACT: "T",
  ACC: "T",
  ACA: "T",
  ACG: "T",
  GCT: "A",
  GCC: "A",
  GCA: "A",
  GCG: "A",
  TAT: "Y",
  TAC: "Y",
  TAA: "*",
  TAG: "*",
  CAT: "H",
  CAC: "H",
  CAA: "Q",
  CAG: "Q",
  AAT: "N",
  AAC: "N",
  AAA: "K",
  AAG: "K",
  GAT: "D",
  GAC: "D",
  GAA: "E",
  GAG: "E",
  TGT: "C",
  TGC: "C",
  TGA: "*",
  TGG: "W",
  CGT: "R",
  CGC: "R",
  CGA: "R",
  CGG: "R",
  AGT: "S",
  AGC: "S",
  AGA: "R",
  AGG: "R",
  GGT: "G",
  GGC: "G",
  GGA: "G",
  GGG: "G",
};

export function normalizeSequence(sequence: string): string {
  return sequence.replace(/\s+/g, "").toUpperCase();
}

export function sequenceLength(sequence: string): number {
  return normalizeSequence(sequence).length;
}

export function gcPercent(sequence: string): number {
  const normalized = normalizeSequence(sequence).replace(/U/g, "T");
  if (normalized.length === 0) return 0;
  const gc = [...normalized].filter((base) => base === "G" || base === "C").length;
  return Number(((gc / normalized.length) * 100).toFixed(2));
}

export function reverseComplement(sequence: string, molecule: "DNA" | "RNA" = "DNA"): string {
  const normalized = normalizeSequence(sequence);
  const complement = molecule === "RNA" ? rnaComplement : dnaComplement;
  return [...normalized]
    .reverse()
    .map((base) => complement[base] ?? "N")
    .join("");
}

export function translateDna(sequence: string): string {
  const normalized = normalizeSequence(sequence).replace(/U/g, "T");
  const aminoAcids: string[] = [];
  for (let index = 0; index + 2 < normalized.length; index += 3) {
    const codon = normalized.slice(index, index + 3);
    aminoAcids.push(codonTable[codon] ?? "X");
  }
  return aminoAcids.join("");
}

export function toFasta(name: string, sequence: string, lineWidth = 70): string {
  const normalized = normalizeSequence(sequence);
  const lines = [`>${name}`];
  for (let index = 0; index < normalized.length; index += lineWidth) {
    lines.push(normalized.slice(index, index + lineWidth));
  }
  return lines.join("\n");
}
