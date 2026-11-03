import { reverseComplement } from "@/lib/sequence";
import { IUPAC_BASES, type Strand } from "./model";

const codonBases = "TCAG";
const standardCode = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";
const iupac: Record<string, string> = { ...IUPAC_BASES, U: "T" };
const codonTable = buildCodonTable();

export function translateCodon(codon: string) {
  return codonTable.get(codon.toUpperCase()) ?? "X";
}

/** Translates whole codons from `offset` and drops a trailing partial codon. */
export function translate(sequence: string, offset = 0) {
  let protein = "";
  for (let at = offset; at + 3 <= sequence.length; at += 3) protein += translateCodon(sequence.slice(at, at + 3));
  return protein;
}

/** A strand and the first base of codon 1, counted along that strand. */
export type Frame = { strand: Strand; offset: number };

export type ReadingFrame = Frame & { offset: 0 | 1 | 2; protein: string };

export function sixFrameTranslations(sequence: string): ReadingFrame[] {
  const reverse = reverseComplement(sequence);
  const frames: ReadingFrame[] = [];
  for (const strand of [1, -1] as const) {
    for (const offset of [0, 1, 2] as const) frames.push({ strand, offset, protein: translate(strand === 1 ? sequence : reverse, offset) });
  }
  return frames;
}

/** Top-strand interval (0-based, half-open) of amino acids `[aaStart, aaEnd)` in a frame. */
export function frameSpan(frame: Frame, aaStart: number, aaEnd: number, length: number) {
  const start = frame.offset + aaStart * 3;
  const end = frame.offset + aaEnd * 3;
  return frame.strand === 1 ? { start, end } : { start: length - end, end: length - start };
}

/**
 * Standard code (NCBI table 1) with IUPAC codons resolved the way Biopython's
 * `Seq.translate` does: one amino acid when every reading agrees, B/Z/J for N|D, Q|E and
 * I|L, `*` when every reading is a stop, otherwise X.
 */
function buildCodonTable() {
  const table = new Map<string, string>();
  const letters = Object.keys(iupac);
  for (const first of letters) {
    for (const second of letters) {
      for (const third of letters) {
        const readings = new Set<string>();
        for (const a of iupac[first]) for (const b of iupac[second]) for (const c of iupac[third]) {
          readings.add(standardCode[16 * codonBases.indexOf(a) + 4 * codonBases.indexOf(b) + codonBases.indexOf(c)]);
        }
        const values = [...readings];
        const only = (allowed: string) => values.every((value) => allowed.includes(value));
        table.set(first + second + third, values.length === 1 ? values[0] : only("ND") ? "B" : only("QE") ? "Z" : only("IL") ? "J" : "X");
      }
    }
  }
  return table;
}
