/**
 * Builds the built-in plasmid feature library (Q362) from public NCBI GenBank records: each element is cut from the
 * cited record at the cited coordinates, CDS elements are kept as their translation (matched at the protein level), and
 * the result is written to src/lib/plasmid/feature-library.data.ts. Run: npx tsx scripts/build-plasmid-feature-library.ts
 */
import { writeFileSync } from "node:fs";
import { parseGenbankText } from "../src/lib/plasmid/genbank";
import { reverseComplement } from "../src/lib/sequence";
import { translate } from "../src/lib/plasmid/translate";

type Spec = { id: string; name: string; type: string; accession: string; from: number; to: number; strand: 1 | -1; protein?: boolean; note?: string };

// Coordinates are 1-based and closed, as the records annotate them.
const specs: Spec[] = [
  { id: "cmv-enhancer", name: "CMV enhancer", type: "enhancer", accession: "PV031347.1", from: 96, to: 475, strand: 1 },
  { id: "cmv-promoter", name: "CMV promoter", type: "promoter", accession: "PV031347.1", from: 476, to: 679, strand: 1 },
  { id: "bgh-polya", name: "bGH poly(A) signal", type: "polyA_signal", accession: "PV031347.1", from: 1893, to: 2117, strand: 1 },
  { id: "t7-promoter", name: "T7 promoter", type: "promoter", accession: "PV031347.1", from: 2192, to: 2210, strand: -1 },
  { id: "m13-fwd", name: "M13 fwd", type: "primer_bind", accession: "PV031347.1", from: 2217, to: 2233, strand: -1 },
  { id: "f1-ori", name: "f1 ori", type: "rep_origin", accession: "PV031347.1", from: 2375, to: 2830, strand: 1 },
  { id: "ampr-promoter", name: "AmpR promoter", type: "promoter", accession: "PV031347.1", from: 2856, to: 2960, strand: 1 },
  { id: "ampr", name: "AmpR", type: "CDS", accession: "PV031347.1", from: 2961, to: 3821, strand: 1, protein: true, note: "β-lactamase (bla)" },
  { id: "ori", name: "ori", type: "rep_origin", accession: "PV031347.1", from: 3992, to: 4580, strand: 1, note: "high-copy ColE1/pMB1/pUC origin" },
  { id: "cap-site", name: "CAP binding site", type: "protein_bind", accession: "PV031347.1", from: 4868, to: 4889, strand: 1 },
  { id: "lac-promoter", name: "lac promoter", type: "promoter", accession: "PV031347.1", from: 4904, to: 4934, strand: 1 },
  { id: "lac-operator", name: "lac operator", type: "protein_bind", accession: "PV031347.1", from: 4942, to: 4958, strand: 1 },
  { id: "m13-rev", name: "M13 rev", type: "primer_bind", accession: "PV031347.1", from: 4966, to: 4982, strand: 1 },
  { id: "t3-promoter", name: "T3 promoter", type: "promoter", accession: "PV031347.1", from: 5003, to: 5021, strand: 1 },
  { id: "ef1a-promoter", name: "EF-1α promoter", type: "promoter", accession: "LT727211.1", from: 1948, to: 3091, strand: -1, note: "human EEF1A1 promoter with its first intron" },
  { id: "sv40-ori", name: "SV40 ori", type: "rep_origin", accession: "LT727211.1", from: 3240, to: 3315, strand: -1 },
  { id: "sv40-promoter", name: "SV40 promoter", type: "promoter", accession: "LT727211.1", from: 3272, to: 3443, strand: -1, note: "SV40 early promoter" },
  { id: "cag-promoter", name: "CAG promoter", type: "promoter", accession: "LT727518.1", from: 3074, to: 4798, strand: 1, note: "CMV enhancer, chicken β-actin promoter and intron" },
  { id: "beta-globin-polya", name: "β-globin poly(A) signal", type: "polyA_signal", accession: "LT727518.1", from: 91, to: 182, strand: 1, note: "rabbit β-globin" },
  { id: "sv40-polya", name: "SV40 poly(A) signal", type: "polyA_signal", accession: "LT727518.1", from: 947, to: 1021, strand: 1 },
  { id: "hpgk-promoter", name: "hPGK promoter", type: "promoter", accession: "PX675714.1", from: 1, to: 511, strand: 1, note: "human PGK1 promoter" },
  { id: "puror", name: "PuroR", type: "CDS", accession: "PX675714.1", from: 533, to: 1132, strand: 1, protein: true, note: "puromycin N-acetyltransferase (pac)" },
  { id: "rsv-promoter", name: "RSV promoter", type: "promoter", accession: "PX675714.1", from: 4742, to: 4968, strand: 1 },
  { id: "hiv-psi", name: "HIV-1 Ψ", type: "misc_feature", accession: "PX675714.1", from: 5196, to: 5321, strand: 1, note: "packaging signal" },
  { id: "rre", name: "RRE", type: "misc_feature", accession: "PX675714.1", from: 5814, to: 6047, strand: 1, note: "Rev response element" },
  { id: "u6-promoter", name: "U6 promoter", type: "promoter", accession: "PX675714.1", from: 6574, to: 6820, strand: 1, note: "human U6" },
  { id: "cppt", name: "cPPT/CTS", type: "misc_feature", accession: "PX675714.1", from: 6919, to: 7036, strand: 1 },
  { id: "hygr", name: "HygR", type: "CDS", accession: "KF853604.1", from: 3865, to: 4902, strand: 1, protein: true, note: "hygromycin B phosphotransferase (hph)" },
  { id: "bsd", name: "BSD", type: "CDS", accession: "JN596069.1", from: 267, to: 665, strand: 1, protein: true, note: "blasticidin S deaminase" },
  { id: "bleor", name: "BleoR", type: "CDS", accession: "L36850.1", from: 5896, to: 6270, strand: 1, protein: true, note: "Sh ble, Zeocin resistance" },
  { id: "neor", name: "NeoR/KanR", type: "CDS", accession: "U55762.1", from: 2629, to: 3423, strand: 1, protein: true, note: "aminoglycoside phosphotransferase aph(3')-II" },
  { id: "attb1", name: "attB1", type: "protein_bind", accession: "LC744045.1", from: 4801, to: 4825, strand: 1 },
  { id: "loxp", name: "loxP", type: "protein_bind", accession: "LC744045.1", from: 6611, to: 6644, strand: 1 },
  { id: "frt", name: "FRT", type: "protein_bind", accession: "LC744045.1", from: 7120, to: 7167, strand: 1 },
  { id: "mpgk-promoter", name: "PGK promoter", type: "promoter", accession: "LC744045.1", from: 7172, to: 7671, strand: 1, note: "mouse Pgk1 promoter" },
  { id: "wpre", name: "WPRE", type: "misc_feature", accession: "LC744045.1", from: 12116, to: 12704, strand: 1, note: "woodchuck hepatitis virus post-transcriptional element" },
  { id: "attb2", name: "attB2", type: "protein_bind", accession: "PV983739.1", from: 3148, to: 3172, strand: -1 },
  { id: "attr1", name: "attR1", type: "protein_bind", accession: "AY822457.1", from: 517, to: 641, strand: 1 },
  { id: "cmr", name: "CmR", type: "CDS", accession: "AY822457.1", from: 918, to: 1577, strand: 1, protein: true, note: "chloramphenicol acetyltransferase" },
  { id: "ccdb", name: "ccdB", type: "CDS", accession: "AY822457.1", from: 1919, to: 2224, strand: 1, protein: true, note: "toxic in standard E. coli strains" },
  { id: "attr2", name: "attR2", type: "protein_bind", accession: "AY822457.1", from: 2265, to: 2389, strand: 1 },
  { id: "attl1", name: "attL1", type: "protein_bind", accession: "HC471040.1", from: 569, to: 668, strand: 1 },
  { id: "attl2", name: "attL2", type: "protein_bind", accession: "HC471040.1", from: 755, to: 853, strand: -1 },
  { id: "egfp", name: "EGFP", type: "CDS", accession: "U55762.1", from: 679, to: 1398, strand: 1, protein: true },
  { id: "mcherry", name: "mCherry", type: "CDS", accession: "AY678264.1", from: 1, to: 711, strand: 1, protein: true },
];

async function record(accession: string) {
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=${accession}&rettype=gbwithparts&retmode=text`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${accession}: HTTP ${response.status}`);
  const [parsed] = parseGenbankText(await response.text()).records;
  await new Promise((resolve) => setTimeout(resolve, 400));
  return parsed;
}

async function main() {
  const records = new Map<string, Awaited<ReturnType<typeof record>>>();
  for (const accession of new Set(specs.map((spec) => spec.accession))) records.set(accession, await record(accession));

  const entries = specs.map((spec) => {
    const source = records.get(spec.accession)!;
    const top = source.sequence.slice(spec.from - 1, spec.to);
    const dna = spec.strand === 1 ? top : reverseComplement(top);
    if (!spec.protein) return { id: spec.id, name: spec.name, type: spec.type, kind: "dna" as const, sequence: dna, source: { accession: spec.accession, from: spec.from, to: spec.to, strand: spec.strand }, ...(spec.note ? { note: spec.note } : {}) };
    const protein = translate(dna).replace(/\*$/, "");
    if (protein.includes("*") || !protein.startsWith("M")) throw new Error(`${spec.id}: not a clean CDS (${protein.slice(0, 20)}…)`);
    return { id: spec.id, name: spec.name, type: spec.type, kind: "protein" as const, sequence: protein, source: { accession: spec.accession, from: spec.from, to: spec.to, strand: spec.strand }, ...(spec.note ? { note: spec.note } : {}) };
  });

  const header = `// Built by scripts/build-plasmid-feature-library.ts from public NCBI GenBank records; do not edit by hand.\n// Each entry names the record and the 1-based closed coordinates it was cut from.\n`;
  writeFileSync("src/lib/plasmid/feature-library.data.ts", `${header}import type { LibraryElement } from "./feature-library";\n\nexport const FEATURE_LIBRARY_VERSION = "labnest-features/2026-11-02";\n\nexport const BUILT_IN_ELEMENTS: LibraryElement[] = ${JSON.stringify(entries, null, 2)};\n`);
  console.log(entries.map((entry) => `${entry.id} ${entry.kind} ${entry.sequence.length}`).join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
