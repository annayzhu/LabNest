export type MoleculeType = "DNA" | "RNA" | "Protein";

export type SequenceValidationOptions = {
  allowTerminalDeoxythymidineOverhang?: boolean;
};

const dnaComplement: Record<string, string> = {
  A: "T",
  T: "A",
  G: "C",
  C: "G",
  R: "Y",
  Y: "R",
  S: "S",
  W: "W",
  K: "M",
  M: "K",
  B: "V",
  D: "H",
  H: "D",
  V: "B",
  N: "N",
};

const rnaComplement: Record<string, string> = {
  A: "U",
  U: "A",
  // T is accepted only for the explicitly validated terminal dT overhang in
  // synthetic siRNA records; it still pairs with A in derived views.
  T: "A",
  G: "C",
  C: "G",
  R: "Y",
  Y: "R",
  S: "S",
  W: "W",
  K: "M",
  M: "K",
  B: "V",
  D: "H",
  H: "D",
  V: "B",
  N: "N",
};

const sequenceAlphabets: Record<MoleculeType, RegExp> = {
  DNA: /^[ACGTRYSWKMBDHVN]*$/,
  RNA: /^[ACGURYSWKMBDHVN]*$/,
  Protein: /^[ACDEFGHIKLMNPQRSTVWYBXZJUO*]*$/,
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

export function validateSequence(
  sequence: string,
  moleculeType: MoleculeType,
  options: SequenceValidationOptions = {},
): { normalized: string; errors: string[] } {
  const normalized = normalizeSequence(sequence);
  const errors: string[] = [];
  if (!normalized) errors.push("Sequence is required.");
  // Synthetic siRNAs are commonly written as an RNA guide/passenger strand
  // followed by a one- or two-base 3' dT overhang (for example, AUGCUUTT).
  // Preserve that chemistry-aware notation while keeping T invalid elsewhere
  // in RNA records.
  const terminalDeoxythymidineMatch = moleculeType === "RNA" && options.allowTerminalDeoxythymidineOverhang
    ? normalized.match(/T{1,2}$/)
    : null;
  const terminalDeoxythymidineStart = terminalDeoxythymidineMatch
    ? normalized.length - terminalDeoxythymidineMatch[0].length
    : normalized.length;
  const isValidCharacter = (character: string, index: number) => (
    sequenceAlphabets[moleculeType].test(character)
    || (character === "T" && index >= terminalDeoxythymidineStart)
  );
  if ([...normalized].some((character, index) => !isValidCharacter(character, index))) {
    const invalid = [...new Set([...normalized].filter((character, index) => !isValidCharacter(character, index)))];
    errors.push(`Invalid ${moleculeType} character${invalid.length === 1 ? "" : "s"}: ${invalid.join(", ")}.`);
  }
  return { normalized, errors };
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

export function estimatedMeltingTemperature(sequence: string, moleculeType: "DNA" | "RNA" = "DNA"): number | undefined {
  const normalized = normalizeSequence(sequence).replace(/U/g, "T");
  if (!normalized || !/^[ACGT]+$/.test(normalized)) return undefined;
  const gc = [...normalized].filter((base) => base === "G" || base === "C").length;
  const at = normalized.length - gc;
  const temperature = normalized.length < 14
    ? 2 * at + 4 * gc
    : 64.9 + 41 * (gc - 16.4) / normalized.length;
  const rnaAdjustment = moleculeType === "RNA" ? 2 : 0;
  return Number((temperature + rnaAdjustment).toFixed(1));
}

export function estimatedMolecularWeight(sequence: string, moleculeType: MoleculeType): number {
  const length = sequenceLength(sequence);
  const averageResidueWeight = moleculeType === "DNA" ? 330 : moleculeType === "RNA" ? 340 : 110;
  return Math.round(length * averageResidueWeight);
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

export type FastaRecord = { name: string; description?: string; sequence: string };

export function parseFasta(input: string): FastaRecord[] {
  const records: FastaRecord[] = [];
  let current: FastaRecord | undefined;
  for (const rawLine of input.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith(";")) continue;
    if (line.startsWith(">")) {
      if (current) records.push({ ...current, sequence: normalizeSequence(current.sequence) });
      const header = line.slice(1).trim();
      const separator = header.search(/\s/);
      current = separator < 0
        ? { name: header || `Sequence ${records.length + 1}`, sequence: "" }
        : { name: header.slice(0, separator), description: header.slice(separator).trim() || undefined, sequence: "" };
      continue;
    }
    if (!current) current = { name: `Sequence ${records.length + 1}`, sequence: "" };
    current.sequence += line;
  }
  if (current) records.push({ ...current, sequence: normalizeSequence(current.sequence) });
  return records.filter((record) => record.sequence.length > 0);
}
