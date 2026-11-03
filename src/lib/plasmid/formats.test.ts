import { readFileSync } from "node:fs";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { extractFeature } from "./effects";
import { groupReadEvidence, importSequenceFiles, parseSequenceFile } from "./files";
import { formatGenbank, parseGenbankLocation, parseGenbankText } from "./genbank";
import { SequenceParseError } from "./model";
import { a02, a04, SAMPLE_LABEL } from "./test-samples/build";
import { abifTag, writeAbif } from "./test-samples/writers";
import { translate } from "./translate";

const root = "src/lib/plasmid/test-samples/files";
const bytesOf = (path: string) => new Uint8Array(readFileSync(join(root, path)));
const parse = (path: string) => parseSequenceFile(path, bytesOf(path));
const files = (...paths: string[]) => paths.map((path) => ({ path, bytes: bytesOf(path) }));

function parseError(run: () => unknown) {
  try {
    run();
  } catch (error) {
    if (error instanceof SequenceParseError) return error.code;
    throw error;
  }
  return undefined;
}

describe("A01 FASTA, GenBank and text .seq", () => {
  it("keeps multi-record FASTA records apart", () => {
    const { records } = parse("A01-multi-record.fasta");
    expect(records.map((record) => [record.name, record.sequence.length, record.topology])).toEqual([
      ["SIM-A01-one", 120, "unknown"],
      ["SIM-A01-two", 75, "unknown"],
    ]);
  });

  it("reads GenBank topology, partial markers and a CDS that matches its translation", () => {
    const [record] = parse("A01-construct.gb").records;
    expect(record).toMatchObject({ name: "SIM-A01", topology: "linear" });
    expect(record.sequence).toHaveLength(400);
    expect(record.description).toContain(SAMPLE_LABEL);
    const [cds, partial] = record.features;
    expect(cds).toMatchObject({ type: "CDS", strand: 1, segments: [{ start: 60, end: 210 }], codonStart: 1, name: "SIM A01 CDS" });
    expect(translate(extractFeature(record, cds)).replace(/\*$/, "")).toBe(cds.qualifiers.translation[0]);
    expect(partial).toMatchObject({ strand: -1, segments: [{ start: 299, end: 340, openStart: true, openEnd: true }] });
    expect(partial.qualifiers.note[0]).toContain("wrap onto a second qualifier line");
  });

  it("reads vendor .seq files as reads without quality", () => {
    const plain = parse("A01-plain.seq");
    expect(plain.format).toBe("seq-text");
    expect(plain.reads[0]).toMatchObject({ name: "A01-plain", quality: null, peaks: null, traces: null });
    expect(plain.reads[0].bases).toHaveLength(240);
    expect(parse("A01-fasta-like.seq").reads.map((read) => [read.name, read.bases.length])).toEqual([["SIM-A01-read", 180]]);
  });
});

describe("A02 SnapGene subset", () => {
  it("reads sequence, topology, features and primers and lists what it does not read", () => {
    const parsed = parse("A02-limited.dna");
    const [record] = parsed.records;
    expect(record.topology).toBe("circular");
    expect(record.sequence).toBe(a02.sequence);
    expect(record.description).toContain(SAMPLE_LABEL);
    const byName = Object.fromEntries(record.features.map((feature) => [feature.name, feature]));
    expect(byName["SIM wrap CDS"]).toMatchObject({ strand: 1, codonStart: 1, segments: [{ start: 950, end: 1000 }, { start: 0, end: 52 }] });
    expect(translate(extractFeature(record, byName["SIM wrap CDS"]))).toBe(a02.protein);
    expect(byName["SIM wrap CDS"].qualifiers.note).toEqual([SAMPLE_LABEL]);
    expect(byName["SIM reverse promoter"]).toMatchObject({ strand: -1, segments: [{ start: 200, end: 300 }] });
    expect(byName["SIM two-part"].segments).toEqual([{ start: 400, end: 450 }, { start: 470, end: 500 }]);
    for (const primer of ["SIM-F1", "SIM-R1"]) {
      expect(extractFeature(record, byName[primer])).toBe(byName[primer].qualifiers.primer_sequence[0]);
    }
    expect(parsed.unsupported.map((item) => item.code)).toEqual(["snapgene.packet-0x07", "snapgene.packet-0x08", "snapgene.packet-0x11", "snapgene.packet-0x63"]);
  });

  it("refuses a file whose bases cannot be read reliably", () => {
    expect(parseError(() => parse("A02-compressed-only.dna"))).toBe("snapgene.no-dna");
  });
});

describe("A03 mixed batch", () => {
  it("reports each bad file and keeps the good ones", async () => {
    const sources = await importSequenceFiles(files("A03-mixed/good.fasta", "A03-mixed/good-read.ab1", "A03-mixed/truncated.ab1", "A03-mixed/binary.seq", "A03-mixed/words.seq"));
    expect(sources.map((source) => [source.path.split("/").pop(), source.status, source.error?.code])).toEqual([
      ["good.fasta", "parsed", undefined],
      ["good-read.ab1", "parsed", undefined],
      ["truncated.ab1", "failed", "abif.directory"],
      ["binary.seq", "failed", "file.unknown-format"],
      ["words.seq", "failed", "seq.alphabet"],
    ]);
    expect(sources.every((source) => /^[0-9a-f]{64}$/.test(source.sha256))).toBe(true);
  });
});

describe("A04 features across the origin and on the minus strand", () => {
  const [plus, minus] = parse("A04-origin-features.gb").records;

  it("extracts and translates in biological order", () => {
    expect(plus.features[0].segments).toEqual([{ start: 450, end: 500 }, { start: 0, end: 70 }]);
    expect(translate(extractFeature(plus, plus.features[0]))).toBe(a04.plus.protein);
    const [origin, exons, partial] = minus.features;
    expect(origin).toMatchObject({ strand: -1, segments: [{ start: 0, end: 80 }, { start: 460, end: 500 }] });
    expect(translate(extractFeature(minus, origin))).toBe(a04.minus.protein);
    expect(exons.segments).toEqual([{ start: 200, end: 260 }, { start: 100, end: 130 }]);
    expect(translate(extractFeature(minus, exons))).toBe(a04.minus.exonProtein);
    expect(partial).toMatchObject({ codonStart: 3, segments: [{ start: 300, end: 350, openStart: true, openEnd: true }] });
    expect(translate(extractFeature(minus, partial), 2)).toBe(a04.minus.partialProtein);
  });

  it("survives a GenBank round trip", () => {
    for (const record of [plus, minus]) {
      const [again] = parseGenbankText(formatGenbank(record, new Date("2026-11-02T00:00:00Z"))).records;
      expect(again.sequence).toBe(record.sequence);
      expect(again.topology).toBe(record.topology);
      expect(again.features.map(({ type, strand, segments, codonStart, name }) => ({ type, strand, segments, codonStart, name })))
        .toEqual(record.features.map(({ type, strand, segments, codonStart, name }) => ({ type, strand, segments, codonStart, name })));
    }
  });

  it("parses location forms and refuses the unsupported ones", () => {
    expect(parseGenbankLocation("complement(join(1..10,20..30))", 100, "linear")).toEqual({ strand: -1, segments: [{ start: 19, end: 30 }, { start: 0, end: 10 }] });
    expect(parseGenbankLocation("95..5", 100, "circular").segments).toEqual([{ start: 94, end: 100 }, { start: 0, end: 5 }]);
    expect(parseGenbankLocation("order(1..2,5..6)", 10, "linear").segments).toEqual([{ start: 0, end: 2 }, { start: 4, end: 6 }]);
    expect(parseGenbankLocation("3^4", 10, "linear").segments).toEqual([{ start: 3, end: 3 }]);
    expect(parseError(() => parseGenbankLocation("95..5", 100, "linear"))).toBe("genbank.location");
    expect(parseError(() => parseGenbankLocation("J00194.1:100..202", 1000, "linear"))).toBe("genbank.location");
    expect(parseError(() => parseGenbankLocation("join(1..5,complement(8..9))", 10, "linear"))).toBe("genbank.location");
  });
});

describe("GenBank export", () => {
  const [record] = parseGenbankText(readFileSync(join(root, "A01-construct.gb"), "utf8")).records;

  it("keeps a value with line breaks on its qualifier lines", () => {
    const noted = { ...record, description: "Line one\nLine two", features: [{ ...record.features[0], qualifiers: { note: ["a\nDO NOT USE\nb"] } }] };
    const text = formatGenbank(noted, new Date("2026-11-02T00:00:00Z"));
    const features = text.slice(text.indexOf("FEATURES"), text.indexOf("ORIGIN")).split("\n").slice(1, -1);
    expect(features.every((line) => line.startsWith("     "))).toBe(true);
    const [again] = parseGenbankText(text).records;
    expect(again.description).toBe("Line one Line two");
    expect(again.features[0].qualifiers.note).toEqual(["a DO NOT USE b"]);
  });

  it("separates a feature type of 16 or more letters from its location", () => {
    const long = { ...record, features: [{ ...record.features[0], type: "primer_bind_reverse" }] };
    const [again] = parseGenbankText(formatGenbank(long, new Date("2026-11-02T00:00:00Z"))).records;
    expect(again.features.map((feature) => [feature.type, feature.segments])).toEqual([["primer_bind_reverse", record.features[0].segments]]);
  });
});

describe(".ab1 reading", () => {
  it("maps trace channels by the file's base order (FWO_)", () => {
    const { reads: [read] } = parse("A12-read-R.ab1");
    expect(read.metadata.baseOrder).toBe("TACG");
    let checked = 0;
    read.bases.split("").forEach((base, index) => {
      if (read.quality![index] < 20 || base === "N") return;
      const scan = read.peaks![index];
      const heights = (["A", "C", "G", "T"] as const).map((channel) => read.traces![channel][scan]);
      expect(read.traces![base as "A"][scan]).toBe(Math.max(...heights));
      checked += 1;
    });
    expect(checked).toBeGreaterThan(600);
  });

  it("reports hand-edited calls and a missing quality list", () => {
    const edited = parse("A13-read-low-tail.ab1");
    expect(edited.warnings.map((warning) => warning.code)).toContain("abif.edited-bases");
    expect(edited.reads[0].editedBases![300]).not.toBe(edited.reads[0].bases[300]);
    const bare = parseSequenceFile("bare.ab1", writeAbif([abifTag.chars("PBAS", 2, "ACGTACGTAC"), abifTag.pString("SMPL", 1, SAMPLE_LABEL)]));
    expect(bare.reads[0]).toMatchObject({ bases: "ACGTACGTAC", quality: null, peaks: null, traces: null });
    expect(bare.warnings.map((warning) => warning.code)).toEqual(["abif.no-quality", "abif.no-base-order", "abif.no-traces"]);
  });
});

describe("A14 and A19 imports", () => {
  it("treats an .ab1, its .seq export and the ZIP copies as one piece of evidence", async () => {
    const sources = await importSequenceFiles(files("A14-run/SIM-C3-M13F.ab1", "A14-run/SIM-C3-M13F.seq", "A14-run/SIM-C3-copy.zip"));
    expect(sources.map((source) => [source.path, source.status, source.duplicateOf])).toEqual([
      ["A14-run/SIM-C3-M13F.ab1", "parsed", undefined],
      ["A14-run/SIM-C3-M13F.seq", "parsed", undefined],
      ["A14-run/SIM-C3-copy.zip", "parsed", undefined],
      ["A14-run/SIM-C3-copy.zip::SIM-C3/SIM-C3-M13F.ab1", "parsed", "A14-run/SIM-C3-M13F.ab1"],
      ["A14-run/SIM-C3-copy.zip::SIM-C3/SIM-C3-M13F.seq", "parsed", "A14-run/SIM-C3-M13F.seq"],
    ]);
    const { reads, groups } = groupReadEvidence(sources);
    expect(reads).toHaveLength(4);
    expect(groups).toHaveLength(1);
    expect(groups[0].reasons).toEqual(expect.arrayContaining(["identical-file", "paired-export"]));
  });

  it("keeps a vendor vector list as an attachment without inferring a construct", async () => {
    const [source] = await importSequenceFiles(files("A19-vendor-catalog.csv"));
    expect(source).toMatchObject({ status: "attachment", records: [], reads: [] });
  });

  it("checks archive paths and limits before inflating", async () => {
    const archive = zipSync({ "../outside.seq": strToU8("ACGTACGTACGT"), "a.seq": strToU8("ACGTACGTAAAA"), "b.seq": strToU8("ACGTACGTCCCC") });
    const sources = await importSequenceFiles([{ path: "test.zip", bytes: archive }], { zipLimits: { maxEntries: 1, maxTotalBytes: 1_000, maxEntryBytes: 1_000 } });
    expect(sources.map((source) => source.path)).toEqual(["test.zip", "test.zip::a.seq"]);
    expect(sources[0].warnings.map((warning) => warning.code)).toEqual(["zip.unsafe-path", "zip.limit"]);
  });
});
