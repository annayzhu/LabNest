import { strToU8, zipSync } from "fflate";
import { reverseComplement } from "@/lib/sequence";
import { abifTag, snapGeneDna, writeAbif, writeSnapGene, xmlEscape, type AbifTag } from "./writers";

/**
 * Builds the PRD's simulated acceptance samples (Q281). Every file carries the label
 * 软件测试用模拟序列; none is a real construct or result. Output is deterministic, so the
 * committed files can be checked against a rebuild.
 */
export const SAMPLE_LABEL = "软件测试用模拟序列";

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomDna(seed: number, length: number) {
  const next = random(seed);
  let sequence = "";
  for (let index = 0; index < length; index += 1) sequence += "ACGT"[Math.floor(next() * 4)];
  return sequence;
}

function randomProtein(seed: number, length: number) {
  const next = random(seed);
  const residues = "ACDEFGHIKLMNPQRSTVWY";
  let protein = "M";
  while (protein.length < length) protein += residues[Math.floor(next() * residues.length)];
  return protein;
}

const codons: Record<string, string[]> = {
  A: ["GCC", "GCT"], R: ["AGA", "CGG"], N: ["AAC", "AAT"], D: ["GAC", "GAT"], C: ["TGC", "TGT"], Q: ["CAG", "CAA"],
  E: ["GAG", "GAA"], G: ["GGC", "GGA"], H: ["CAC", "CAT"], I: ["ATC", "ATT"], L: ["CTG", "CTC"], K: ["AAG", "AAA"],
  M: ["ATG"], F: ["TTC", "TTT"], P: ["CCC", "CCT"], S: ["AGC", "TCC"], T: ["ACC", "ACA"], W: ["TGG"], Y: ["TAC", "TAT"],
  V: ["GTG", "GTC"], "*": ["TGA"],
};

/** Back-translates with synonymous codons in turn, so repeats in the protein are not exact DNA repeats. */
export function backTranslate(protein: string, used: Record<string, number> = {}) {
  return [...protein].map((residue) => {
    const options = codons[residue];
    const count = used[residue] ?? 0;
    used[residue] = count + 1;
    return options[count % options.length];
  }).join("");
}

/** Human serglycin (UniProtKB P10124 v3), public reference used for the A10/A11 test construct. */
export const SRGN_PROTEIN = "MMQKLLKCSRLVLALALILVLESSVQGYPTRRARYQWVRCNPDSNSANCLEEKGPMFELLPGESNKIPRLRTDLFPKTRIQDLNRIFPLSEDYSGSGFGSGSGSGSGSGSGFLTEMEQDYQLVDESDAFHDNLRSLDRNLPSDSQDLGQHGLEEDFML";
export const FLAG = "DYKDDDDK";
export const FLAG_3X_22AA = "DYKDHDGDYKDHDIDYKDDDDK";

function buildConstruct() {
  const backbone = randomDna(11, 2400);
  const used: Record<string, number> = {};
  const signal = backTranslate(SRGN_PROTEIN.slice(0, 27), used);
  const tag = backTranslate(FLAG_3X_22AA, used);
  const mature = backTranslate(SRGN_PROTEIN.slice(27), used);
  const cds = `${signal}${tag}${mature}TGA`;
  const cdsStart = 606;
  const sequence = `${backbone.slice(0, 600)}GCCACC${cds}${backbone.slice(600)}`;
  // R31 is the second arginine, so the codon list puts CGG there and R31Q is one change (CGG→CAG).
  const r31 = cdsStart + (27 + 22 + 3) * 3;
  if (sequence.slice(r31, r31 + 3) !== "CGG") throw new Error("The test construct must code R31 as CGG.");
  return {
    name: "SIM-SRGN-3xFLAG",
    sequence,
    cdsStart,
    cdsEnd: cdsStart + cds.length,
    signal: { start: cdsStart, end: cdsStart + 81 },
    tag: { start: cdsStart + 81, end: cdsStart + 147 },
    mature: { start: cdsStart + 147, end: cdsStart + cds.length - 3 },
    r31Middle: r31 + 1,
  };
}

export const construct = buildConstruct();

/** Made-up 30 aa chain for A08/A09. */
export const testChainProtein = randomProtein(61, 30);

type GenbankFeature = { key: string; location: string; qualifiers: Array<[string, string | number]> };

/** Hand-formatted GenBank in the style of desktop editors, kept apart from LabNest's own writer. */
function genbankText(record: { name: string; topology: "linear" | "circular"; definition: string; features: GenbankFeature[]; sequence: string }) {
  const lines = [
    `LOCUS       ${record.name.padEnd(16)} ${String(record.sequence.length).padStart(5)} bp ds-DNA     ${record.topology} SYN 02-NOV-2026`,
    `DEFINITION  ${record.definition}`,
    "ACCESSION   .",
    "VERSION     .",
    "KEYWORDS    .",
    "SOURCE      synthetic DNA construct",
    "  ORGANISM  synthetic DNA construct",
    `COMMENT     ${SAMPLE_LABEL}. Not a real construct or result.`,
    "FEATURES             Location/Qualifiers",
  ];
  for (const feature of record.features) {
    lines.push(`     ${feature.key.padEnd(16)}${feature.location}`);
    for (const [key, value] of feature.qualifiers) {
      let text = typeof value === "number" ? `/${key}=${value}` : `/${key}="${value}"`;
      while (text.length > 58) {
        const cut = key === "translation" ? 58 : text.lastIndexOf(" ", 58);
        if (cut <= 0) break;
        lines.push(`${" ".repeat(21)}${text.slice(0, cut).trimEnd()}`);
        text = text.slice(cut).trimStart();
      }
      lines.push(`${" ".repeat(21)}${text}`);
    }
  }
  lines.push("ORIGIN");
  const bases = record.sequence.toLowerCase();
  for (let start = 0; start < bases.length; start += 60) {
    const groups: string[] = [];
    for (let at = start; at < Math.min(bases.length, start + 60); at += 10) groups.push(bases.slice(at, at + 10));
    lines.push(`${String(start + 1).padStart(9)} ${groups.join(" ")}`);
  }
  lines.push("//");
  return lines.join("\n");
}

function translateSimple(dna: string) {
  const table: Record<string, string> = {};
  for (const [residue, options] of Object.entries(codons)) for (const codon of options) table[codon] = residue;
  Object.assign(table, { TAA: "*", TAG: "*" });
  let protein = "";
  for (let at = 0; at + 3 <= dna.length; at += 3) protein += table[dna.slice(at, at + 3)] ?? "X";
  return protein;
}

type ReadPlan = {
  name: string;
  template: string;
  quality: (index: number, length: number) => number;
  seed: number;
  baseOrder?: string;
  nRate?: (index: number, length: number) => number;
  editedAt?: number;
};

function standardQuality(index: number, length: number) {
  if (index < 18) return 12 + index;
  if (index > length - 30) return Math.max(12, 45 - (index - (length - 30)));
  return 40 + ((index * 7) % 16);
}

function gaussian(channel: Float64Array, centre: number, height: number, sigma: number) {
  for (let scan = Math.max(0, Math.floor(centre - 4 * sigma)); scan <= Math.min(channel.length - 1, Math.ceil(centre + 4 * sigma)); scan += 1) {
    channel[scan] += height * Math.exp(-((scan - centre) ** 2) / (2 * sigma * sigma));
  }
}

/** Simulated Sanger read: errors and N only where quality is below Q20, so good regions stay exact. */
export function simulateRead(plan: ReadPlan) {
  const next = random(plan.seed);
  const length = plan.template.length;
  const quality: number[] = [];
  let bases = "";
  for (let index = 0; index < length; index += 1) {
    const q = plan.quality(index, length);
    quality.push(q);
    let base = plan.template[index];
    if (q < 20) {
      if (next() < (plan.nRate?.(index, length) ?? 0)) base = "N";
      else if (next() < 10 ** (-q / 10)) base = "ACGT".replace(base, "")[Math.floor(next() * 3)];
    }
    bases += base;
  }
  const spacing = 10;
  const margin = 30;
  const scans = margin * 2 + spacing * (length - 1) + 1;
  const channels: Record<string, Float64Array> = { A: new Float64Array(scans), C: new Float64Array(scans), G: new Float64Array(scans), T: new Float64Array(scans) };
  const peaks = Array.from({ length }, (_, index) => margin + spacing * index);
  for (let index = 0; index < length; index += 1) {
    const good = quality[index] >= 20;
    const height = good ? 900 + 300 * next() : 220 + 200 * next();
    const sigma = good ? 2.2 : 3;
    const base = bases[index];
    const main = base === "N" ? "ACGT"[Math.floor(next() * 4)] : base;
    gaussian(channels[main], peaks[index], height, sigma);
    if (!good || base === "N") {
      const other = "ACGT".replace(main, "")[Math.floor(next() * 3)];
      gaussian(channels[other], peaks[index], height * (base === "N" ? 0.9 : 0.35 + 0.3 * next()), sigma);
    }
  }
  const order = plan.baseOrder ?? "GATC";
  const data = [...order].map((channel) => Int16Array.from(channels[channel], (value) => Math.min(32767, Math.round(value + 8 * next()))));
  const edited = plan.editedAt === undefined ? bases : `${bases.slice(0, plan.editedAt)}${"ACGT".replace(bases[plan.editedAt], "")[0]}${bases.slice(plan.editedAt + 1)}`;
  const tags: AbifTag[] = [
    abifTag.chars("PBAS", 1, edited),
    abifTag.chars("PBAS", 2, bases),
    abifTag.bytes("PCON", 1, quality),
    abifTag.bytes("PCON", 2, quality),
    abifTag.shorts("PLOC", 1, peaks),
    abifTag.shorts("PLOC", 2, peaks),
    ...data.map((values, index) => abifTag.shorts("DATA", 9 + index, values)),
    abifTag.chars("FWO_", 1, order),
    abifTag.pString("SMPL", 1, plan.name),
    abifTag.pString("CMNT", 1, `${SAMPLE_LABEL} (simulated read, not a real result)`),
    abifTag.pString("MCHN", 1, "LabNest simulator"),
    abifTag.date("RUND", 1, 2026, 11, 2),
    abifTag.time("RUNT", 1, 9, 0, 0),
  ];
  return { bytes: writeAbif(tags), bases, quality, peaks };
}

const forward = (start: number, end: number) => construct.sequence.slice(start, end);

export const readPlans = {
  a10: { name: "A10-read-F", template: forward(560, 1260), quality: standardQuality, seed: 101 },
  a11: { name: "A11-read-Q31", template: `${forward(650, construct.r31Middle)}A${forward(construct.r31Middle + 1, 1300)}`, quality: standardQuality, seed: 111 },
  a12: { name: "A12-read-R", template: reverseComplement(forward(900, 1600)), quality: standardQuality, seed: 121, baseOrder: "TACG" },
  a13: {
    name: "A13-read-low-tail",
    template: forward(700, 1450),
    quality: (index: number, length: number) => (index < 30 ? 6 + (index % 5) : index >= length - 120 ? 4 + (index % 9) : 38 + ((index * 5) % 18)),
    nRate: (index: number, length: number) => (index >= length - 120 ? 0.08 : 0),
    seed: 131,
    editedAt: 300,
  },
  a14: { name: "SIM-C3-M13F", template: forward(1300, 2000), quality: standardQuality, seed: 141 },
  a15: { name: "A15-read-insert-only", template: forward(construct.cdsStart, construct.cdsEnd), quality: standardQuality, seed: 151 },
  a16: { name: "A16-read-origin", template: `${forward(construct.sequence.length - 300, construct.sequence.length)}${forward(0, 300)}`, quality: standardQuality, seed: 161 },
  indels: { name: "F06-read-indels", template: `${forward(1500, 1800)}${forward(1801, 1950)}TTA${forward(1950, 2200)}`, quality: () => 45, seed: 171 },
  a03: { name: "good-read", template: forward(200, 700), quality: standardQuality, seed: 181 },
} satisfies Record<string, ReadPlan>;

function fasta(records: Array<{ name: string; description?: string; sequence: string }>) {
  return records.map((record) => {
    const lines = [`>${record.name}${record.description ? ` ${record.description}` : ""}`];
    for (let at = 0; at < record.sequence.length; at += 60) lines.push(record.sequence.slice(at, at + 60));
    return lines.join("\n");
  }).join("\n") + "\n";
}

function a04Records() {
  const plusProtein = `${randomProtein(41, 39)}*`;
  const plusDna = backTranslate(plusProtein);
  const plusBackbone = randomDna(42, 500 - plusDna.length);
  // 50 bases before the origin, 70 after: join(451..500,1..70).
  const plusSequence = `${plusDna.slice(50)}${plusBackbone}${plusDna.slice(0, 50)}`;

  const minusProtein = `${randomProtein(43, 39)}*`;
  const minusCoding = backTranslate(minusProtein);
  const exonProtein = `${randomProtein(44, 29)}*`;
  const exonCoding = backTranslate(exonProtein);
  const partialProtein = randomProtein(45, 16);
  const partialCoding = `GA${backTranslate(partialProtein)}`;
  const minusBackbone = randomDna(46, 500);
  // complement(join(461..500,1..80)): the top strand holds the reverse complement.
  const minusTop = reverseComplement(minusCoding);
  const exonTop = reverseComplement(exonCoding);
  let minusSequence = `${minusTop.slice(40)}${minusBackbone.slice(80, 460)}${minusTop.slice(0, 40)}`;
  // complement(join(101..130,201..260)): 5' exon part is the 201..260 block.
  minusSequence = `${minusSequence.slice(0, 100)}${exonTop.slice(0, 30)}${minusSequence.slice(130, 200)}${exonTop.slice(30)}${minusSequence.slice(260)}`;
  minusSequence = `${minusSequence.slice(0, 300)}${partialCoding.slice(0, 50)}${minusSequence.slice(350)}`;
  return {
    plus: { protein: plusProtein, sequence: plusSequence },
    minus: { protein: minusProtein, exonProtein, partialProtein, sequence: minusSequence },
  };
}

export const a04 = a04Records();

function a02Sequence() {
  const protein = `${randomProtein(51, 33)}*`;
  const coding = backTranslate(protein);
  const middle = randomDna(52, 1000 - coding.length);
  return { protein, sequence: `${coding.slice(50)}${middle}${coding.slice(0, 50)}` };
}

export const a02 = a02Sequence();

function a02SnapGene() {
  const html = (text: string) => xmlEscape(`<html><body>${text}</body></html>`);
  const features = `<?xml version="1.0"?><Features nextValidID="3">`
    + `<Feature recentID="0" name="SIM wrap CDS" directionality="1" type="CDS" allowSegmentOverlaps="0" consecutiveTranslationNumbering="1"><Segment range="951-52" color="#993366" type="standard" translated="1"/><Q name="codon_start"><V int="1"/></Q><Q name="note"><V text="${html(SAMPLE_LABEL)}"/></Q></Feature>`
    + `<Feature recentID="1" name="SIM reverse promoter" directionality="2" type="promoter"><Segment range="201-300" color="#ffffff" type="standard"/></Feature>`
    + `<Feature recentID="2" name="SIM two-part" directionality="1" type="misc_feature"><Segment range="401-450" type="standard"/><Segment range="451-470" type="gap"/><Segment range="471-500" type="standard"/></Feature>`
    + `</Features>`;
  const forwardPrimer = a02.sequence.slice(600, 620);
  const reversePrimer = reverseComplement(a02.sequence.slice(700, 720));
  const primers = `<?xml version="1.0"?><Primers nextValidID="2"><HybridizationParams minContinuousMatchLen="10" allowMismatch="1" minMeltingTemperature="40" showAdditionalFivePrimeMatches="1" minimumFivePrimeAnnealing="15"/>`
    + `<Primer recentID="0" name="SIM-F1" sequence="${forwardPrimer}" description="${SAMPLE_LABEL}"><BindingSite location="600-619" boundStrand="0" annealedBases="${forwardPrimer}" meltingTemperature="60"><Component hybridizedRange="600-619" bases="${forwardPrimer}"/></BindingSite></Primer>`
    + `<Primer recentID="1" name="SIM-R1" sequence="${reversePrimer}" description="${SAMPLE_LABEL}"><BindingSite location="700-719" boundStrand="1" annealedBases="${reversePrimer}" meltingTemperature="60"><Component hybridizedRange="700-719" bases="${reversePrimer}"/></BindingSite></Primer>`
    + `</Primers>`;
  const notes = `<Notes><UUID>00000000-0000-4000-8000-000000000a02</UUID><Type>Synthetic</Type><Description>${html(`${SAMPLE_LABEL} A02`)}</Description><Created UTC="0:0:0">2026.11.2</Created><LastModified UTC="0:0:0">2026.11.2</LastModified></Notes>`;
  return writeSnapGene([
    snapGeneDna(a02.sequence, true),
    { type: 0x0a, data: features },
    { type: 0x05, data: primers },
    { type: 0x06, data: notes },
    { type: 0x07, data: `<HistoryTree><Node name="A02-limited.dna" type="DNA" seqLen="1000" strandedness="double" ID="0" circular="1"/></HistoryTree>` },
    { type: 0x08, data: `<AdditionalSequenceProperties><UpstreamStickiness>0</UpstreamStickiness><DownstreamStickiness>0</DownstreamStickiness></AdditionalSequenceProperties>` },
    { type: 0x11, data: `<AlignableSequences trimStringency="Medium"/>` },
    { type: 0x63, data: Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8) },
  ]);
}

export type SampleFile = { path: string; bytes: Uint8Array };

export function buildSamples(): SampleFile[] {
  const text = (path: string, content: string): SampleFile => ({ path, bytes: strToU8(content) });
  const reads = Object.fromEntries(Object.entries(readPlans).map(([key, plan]) => [key, simulateRead(plan)])) as Record<keyof typeof readPlans, ReturnType<typeof simulateRead>>;
  const a14Seq = fasta([{ name: "SIM-C3-M13F", description: SAMPLE_LABEL, sequence: reads.a14.bases.slice(15, -15) }]);
  const archived = new Date("2026-11-02T12:00:00");
  const c = construct;
  const cdsProtein = translateSimple(c.sequence.slice(c.cdsStart, c.cdsEnd));
  const a01Cds = backTranslate(`${randomProtein(31, 49)}*`);
  const a01Sequence = `${randomDna(32, 60)}${a01Cds}${randomDna(33, 400 - 60 - a01Cds.length)}`;

  return [
    text("README.md", readme()),
    text("A01-multi-record.fasta", fasta([
      { name: "SIM-A01-one", description: SAMPLE_LABEL, sequence: randomDna(1, 120) },
      { name: "SIM-A01-two", description: SAMPLE_LABEL, sequence: randomDna(2, 75) },
    ])),
    text("A01-construct.gb", genbankText({
      name: "SIM-A01",
      topology: "linear",
      definition: `${SAMPLE_LABEL} A01, linear.`,
      sequence: a01Sequence,
      features: [
        { key: "CDS", location: `61..${60 + a01Cds.length}`, qualifiers: [["codon_start", 1], ["label", "SIM A01 CDS"], ["translation", translateSimple(a01Cds).replace(/\*$/, "")]] },
        { key: "misc_feature", location: "complement(<300..>340)", qualifiers: [["label", "SIM partial reverse"], ["note", `${SAMPLE_LABEL}; this note is long enough to wrap onto a second qualifier line in the file`]] },
      ],
    })),
    text("A01-plain.seq", `${randomDna(3, 240).match(/.{1,60}/g)!.join("\n")}\n`),
    text("A01-fasta-like.seq", `>SIM-A01-read ${SAMPLE_LABEL}\n${randomDna(4, 180).match(/.{1,60}/g)!.join("\n")}\n`),
    { path: "A02-limited.dna", bytes: a02SnapGene() },
    { path: "A02-compressed-only.dna", bytes: writeSnapGene([{ type: 0x01, data: Uint8Array.of(9, 9, 9, 9) }, { type: 0x06, data: `<Notes><Description>${SAMPLE_LABEL}</Description></Notes>` }]) },
    text("A03-mixed/good.fasta", fasta([{ name: "SIM-A03-good", description: SAMPLE_LABEL, sequence: randomDna(5, 90) }])),
    { path: "A03-mixed/good-read.ab1", bytes: reads.a03.bytes },
    { path: "A03-mixed/truncated.ab1", bytes: reads.a03.bytes.slice(0, 1500) },
    { path: "A03-mixed/binary.seq", bytes: Uint8Array.of(0, 1, 2, 3, 0xff, 0, 65, 67, 71, 84) },
    text("A03-mixed/words.seq", "HELLO WORLD\nTHIS IS NOT DNA\n"),
    text("A04-origin-features.gb", [
      genbankText({
        name: "SIM-ORI-PLUS",
        topology: "circular",
        definition: `${SAMPLE_LABEL} A04, plus-strand CDS across the origin.`,
        sequence: a04.plus.sequence,
        features: [{ key: "CDS", location: "join(451..500,1..70)", qualifiers: [["codon_start", 1], ["label", "SIM origin CDS plus"]] }],
      }),
      genbankText({
        name: "SIM-ORI-MINUS",
        topology: "circular",
        definition: `${SAMPLE_LABEL} A04, minus-strand features.`,
        sequence: a04.minus.sequence,
        features: [
          { key: "CDS", location: "complement(join(461..500,1..80))", qualifiers: [["codon_start", 1], ["label", "SIM origin CDS minus"]] },
          { key: "CDS", location: "complement(join(101..130,201..260))", qualifiers: [["codon_start", 1], ["label", "SIM two-exon minus"]] },
          { key: "CDS", location: "<301..>350", qualifiers: [["codon_start", 3], ["label", "SIM partial codon_start 3"]] },
        ],
      }),
    ].join("\n") + "\n"),
    text("A07-flag-variants.fasta", fasta([
      { name: "SIM-3xFLAG-22aa", description: SAMPLE_LABEL, sequence: `ATG${backTranslate(FLAG_3X_22AA)}${backTranslate("GSGS")}TGA` },
      { name: "SIM-FLAG-x3", description: SAMPLE_LABEL, sequence: `ATG${backTranslate(FLAG.repeat(3))}TGA` },
    ])),
    text("A08-flag-after-stop.fasta", fasta([{ name: "SIM-A08", description: SAMPLE_LABEL, sequence: `${backTranslate(testChainProtein)}TAAGGATCC${backTranslate(FLAG)}TAG` }])),
    text("A09-flag-other-frame.fasta", fasta([{ name: "SIM-A09", description: SAMPLE_LABEL, sequence: `${backTranslate(testChainProtein)}G${backTranslate(FLAG)}TAA` }])),
    text("A10-reference.gb", genbankText({
      name: c.name,
      topology: "circular",
      definition: `${SAMPLE_LABEL}: SRGN signal peptide, 3xFLAG, mature SRGN (protein from UniProt P10124).`,
      sequence: c.sequence,
      features: [
        { key: "CDS", location: `${c.cdsStart + 1}..${c.cdsEnd}`, qualifiers: [["codon_start", 1], ["label", "SIM SRGN signal-3xFLAG-mature"], ["translation", cdsProtein.replace(/\*$/, "")]] },
        { key: "sig_peptide", location: `${c.signal.start + 1}..${c.signal.end}`, qualifiers: [["label", "SRGN signal peptide 1-27"]] },
        { key: "misc_feature", location: `${c.tag.start + 1}..${c.tag.end}`, qualifiers: [["label", "3xFLAG"]] },
        { key: "mature_peptide", location: `${c.mature.start + 1}..${c.mature.end}`, qualifiers: [["label", "SRGN mature chain 28-158"]] },
        { key: "variation", location: `${c.r31Middle + 1}`, qualifiers: [["replace", "a"], ["note", "R31Q, UniProt VAR_032761 natural variant"]] },
        { key: "misc_feature", location: "complement(1801..2300)", qualifiers: [["label", "SIM backbone reverse"]] },
      ],
    })),
    { path: "A10-read-F.ab1", bytes: reads.a10.bytes },
    { path: "A11-read-Q31.ab1", bytes: reads.a11.bytes },
    { path: "A12-read-R.ab1", bytes: reads.a12.bytes },
    { path: "A13-read-low-tail.ab1", bytes: reads.a13.bytes },
    { path: "A14-run/SIM-C3-M13F.ab1", bytes: reads.a14.bytes },
    text("A14-run/SIM-C3-M13F.seq", a14Seq),
    {
      path: "A14-run/SIM-C3-copy.zip",
      bytes: zipSync({
        "SIM-C3/SIM-C3-M13F.ab1": [reads.a14.bytes, { mtime: archived }],
        "SIM-C3/SIM-C3-M13F.seq": [strToU8(a14Seq), { mtime: archived }],
        "__MACOSX/SIM-C3/._SIM-C3-M13F.ab1": [Uint8Array.of(0, 5, 22, 7), { mtime: archived }],
      }),
    },
    { path: "A15-read-insert-only.ab1", bytes: reads.a15.bytes },
    { path: "A16-read-origin.ab1", bytes: reads.a16.bytes },
    { path: "F06-read-indels.ab1", bytes: reads.indels.bytes },
    text("A19-vendor-catalog.csv", `# ${SAMPLE_LABEL}: simulated vendor list of universal vectors\nVector,Universal primer\np3xFLAG-CMV-14,CMV-F\npcDNA3.1(+),T7\n`),
  ];
}

function readme() {
  return `# ${SAMPLE_LABEL}

These files are simulated for software tests (PRD v1.0 §10, Q281). They are not real
constructs, sequencing results or lab records. Regenerate them with
\`npx tsx src/lib/plasmid/test-samples/write-samples.ts\`; \`samples.test.ts\` checks that the
committed files match a rebuild.

| Case | Files | Expected |
| --- | --- | --- |
| A01 | A01-multi-record.fasta, A01-construct.gb, A01-plain.seq, A01-fasta-like.seq | Sequences and lengths exact; FASTA records stay separate |
| A02 | A02-limited.dna, A02-compressed-only.dna | Sequence, topology, features and primers read; history, properties, alignable sequences and an unknown block listed as not read; a file without a readable DNA packet is refused |
| A03 | A03-mixed/ | Two files parse; the truncated .ab1, binary .seq and non-DNA .seq fail one by one |
| A04 | A04-origin-features.gb | Origin-crossing and minus-strand joins extract and translate to the planned proteins; GenBank round trip keeps them |
| A07 | A07-flag-variants.fasta | 22 aa 3×FLAG and three standard FLAGs are told apart |
| A08 | A08-flag-after-stop.fasta | FLAG found in frame but after a stop codon: fusion check fails |
| A09 | A09-flag-other-frame.fasta | FLAG found only in another frame: fusion check fails |
| A10 | A10-reference.gb, A10-read-F.ab1 | Signal peptide → 3×FLAG → mature chain: order, frame, gaps and junction coverage checked separately |
| A11 | A11-read-Q31.ab1 | One high-quality difference at the R31 codon, matching the reference's known-variant note |
| A12 | A12-read-R.ab1 | Reverse read: position, complement bases, quality and trace (channel order TACG) map consistently |
| A13 | A13-read-low-tail.ab1 | Low-quality tails and N are never high-confidence differences or support; PBAS1 hand edit reported |
| A14 | A14-run/ | The .ab1, its trimmed .seq export and the ZIP copies form one evidence group |
| A15 | A15-read-insert-only.ab1 | Only part of the reference is covered: never a full-sequence check |
| A16 | A16-read-origin.ab1 | A read across the circular origin covers each position once |
| F06 | F06-read-indels.ab1 | A 1 bp deletion and a 3 bp insertion at high quality |
| A19 | A19-vendor-catalog.csv | Kept as an attachment; no construct is inferred from it |
`;
}
