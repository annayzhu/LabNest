import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { createAligner } from "./align";
import { coverageProfile } from "./coverage";
import { groupReadEvidence, importSequenceFiles, parseSequenceFile, type ImportedSource } from "./files";
import { checkStructure, type StructureElement } from "./fusion";
import type { SangerRead } from "./model";
import { frameSpan, sixFrameTranslations } from "./translate";

/**
 * A18 runs only on this machine against the real history folder (Q281): nothing from it
 * is committed or written to a database. Set PLASMID_A18_SOURCE (the folder) and
 * PLASMID_A18_AUDIT (the 2026-11-01 audit output with audit_summary.json, reference.json,
 * audit_results.json, representative_evidence.json). PLASMID_A18_CONSTRUCT optionally
 * names the A18+ positive control (Q356): a folder with a construct GenBank and its own
 * reads. PLASMID_A18_OUTPUT receives the detailed result.
 */
const sourceRoot = process.env.PLASMID_A18_SOURCE;
const auditRoot = process.env.PLASMID_A18_AUDIT;
const constructRoot = process.env.PLASMID_A18_CONSTRUCT;
const outputRoot = process.env.PLASMID_A18_OUTPUT;

type AuditReference = { protein: string; signal_peptide_end_aa_1based: number; motifs: Record<string, string> };
type AuditRecord = { source: string; file_sha256: string; sequence: string; phred: number[] };

function walk(directory: string): string[] {
  return readdirSync(directory).sort().flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return walk(path);
    return name === ".DS_Store" ? [] : [path];
  });
}

function occurrences(text: string, motif: string) {
  const found: number[] = [];
  for (let at = text.indexOf(motif); at >= 0; at = text.indexOf(motif, at + motif.length)) found.push(at);
  return found;
}

/**
 * Longest exact common substring, earliest in `a` and then in `b` — the same block
 * `difflib.SequenceMatcher(None, a, b, autojunk=False).find_longest_match()` returns.
 */
function longestCommonSubstring(a: string, b: string) {
  let best = { aStart: 0, bStart: 0, length: 0 };
  let previous = new Uint16Array(b.length + 1);
  let current = new Uint16Array(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = a[i - 1] === b[j - 1] ? previous[j - 1] + 1 : 0;
      if (current[j] > best.length) best = { aStart: i - current[j], bStart: j - current[j], length: current[j] };
    }
    [previous, current] = [current, previous];
  }
  return best;
}

/** The audit's six-frame screen (scripts/audit_sequences.py, scan_read), rebuilt on LabNest's translation. */
function screen(bases: string, reference: AuditReference) {
  const signal = reference.protein.slice(0, reference.signal_peptide_end_aa_1based);
  const approximate: Record<string, number> = {};
  for (const label of Object.keys(reference.motifs)) if (label.includes("3x")) approximate[label] = 999;
  let anchor = 0;
  let threeFlagHits = 0;
  let flagHits = 0;
  let largestCluster = 0;
  const junctions: string[] = [];
  for (const frame of sixFrameTranslations(bases)) {
    const peptide = frame.protein;
    anchor = Math.max(anchor, longestCommonSubstring(reference.protein, peptide).length);
    for (const [label, motif] of Object.entries(reference.motifs)) {
      const hits = occurrences(peptide, motif);
      if (label.includes("3x")) {
        threeFlagHits += hits.length;
        for (let at = 0; at + motif.length <= peptide.length; at += 1) {
          let distance = 0;
          for (let index = 0; index < motif.length; index += 1) if (motif[index] !== peptide[at + index]) distance += 1;
          approximate[label] = Math.min(approximate[label], distance);
        }
      } else if (label === "FLAG_1x") {
        flagHits += hits.length;
        let cluster = 0;
        let previousEnd = Number.NEGATIVE_INFINITY;
        for (const start of hits) {
          cluster = start - previousEnd <= 10 ? cluster + 1 : 1;
          previousEnd = start + motif.length;
          largestCluster = Math.max(largestCluster, cluster);
        }
      }
    }
    for (const start of occurrences(peptide, signal)) junctions.push(peptide.slice(start + signal.length, start + signal.length + 16));
  }
  return { anchor, threeFlagHits, flagHits, largestCluster, junctions, approximate };
}

const targetArrangement = (reference: AuditReference): StructureElement[] => [
  { name: "SRGN signal peptide", protein: reference.protein.slice(0, reference.signal_peptide_end_aa_1based) },
  { name: "3×FLAG", protein: Object.entries(reference.motifs).filter(([label]) => label.includes("3x")).map(([, motif]) => motif) },
  // Mature-chain start, allowing the documented R31Q variant.
  { name: "SRGN mature start", protein: ["YPTRRARY", "YPTQRARY"] },
];

describe("the audit's anchor metric", () => {
  it("finds the longest common block like difflib", () => {
    expect(longestCommonSubstring("ABCXABC", "ZABCABC")).toEqual({ aStart: 0, bStart: 1, length: 3 });
    expect(longestCommonSubstring("AAAA", "BBB").length).toBe(0);
  });
});

describe.skipIf(!sourceRoot || !auditRoot)("A18: real SRGN history folder (local only)", () => {
  let sources: ImportedSource[] = [];
  let reference: AuditReference;
  let summary: Record<string, unknown>;
  let auditRecords: AuditRecord[];
  const result: Record<string, unknown> = {};
  const readSources = () => sources.filter((source) => source.reads.length > 0);

  beforeAll(async () => {
    reference = JSON.parse(readFileSync(join(auditRoot!, "reference.json"), "utf8"));
    summary = JSON.parse(readFileSync(join(auditRoot!, "audit_summary.json"), "utf8"));
    auditRecords = JSON.parse(readFileSync(join(auditRoot!, "audit_results.json"), "utf8")).records;
    const started = performance.now();
    const files = walk(sourceRoot!).map((path) => ({ path: relative(sourceRoot!, path), bytes: new Uint8Array(readFileSync(path)) }));
    sources = await importSequenceFiles(files);
    result.importSeconds = (performance.now() - started) / 1000;
  }, 300_000);

  it("reads the same files and the same 344 sequence records as the audit", () => {
    const topLevel = sources.filter((source) => !source.container);
    const extensions: Record<string, number> = {};
    for (const source of topLevel) extensions[extname(source.path).toLowerCase()] = (extensions[extname(source.path).toLowerCase()] ?? 0) + 1;
    const failed = sources.filter((source) => source.status === "failed");
    const reads = readSources();
    result.files = topLevel.length;
    result.extensions = extensions;
    result.sequenceRecords = reads.length;
    result.failed = failed.map((source) => ({ path: source.path, error: source.error }));
    result.formats = Object.fromEntries(["abif", "seq-text", "attachment", "zip"].map((format) => [format, sources.filter((source) => source.format === format).length]));
    result.warnings = Object.entries(sources.flatMap((source) => source.warnings.map((warning) => warning.code)).reduce<Record<string, number>>((counts, code) => ({ ...counts, [code]: (counts[code] ?? 0) + 1 }), {}));
    expect(topLevel).toHaveLength(summary.source_files_excluding_ds_store as number);
    expect(extensions).toEqual(summary.file_extensions);
    expect(failed).toEqual([]);
    expect(reads).toHaveLength(summary.sequence_records_including_zip_members as number);
    expect(new Set(reads.map((source) => source.reads[0].bases)).size).toBe(summary.exact_unique_basecall_strings);
  });

  it("matches Biopython's bases and Phred values record by record", () => {
    const byHash = new Map<string, AuditRecord>();
    for (const record of auditRecords) byHash.set(record.file_sha256, record);
    const mismatches = readSources().filter((source) => {
      const audit = byHash.get(source.sha256);
      const read = source.reads[0];
      return !audit || audit.sequence !== read.bases || JSON.stringify(audit.phred) !== JSON.stringify(read.quality ?? []);
    });
    result.recordMismatches = mismatches.map((source) => source.path);
    expect(mismatches).toEqual([]);
  });

  it("reproduces the audit's screening summary with the same reference and motifs", () => {
    const screens = readSources().map((source) => screen(source.reads[0].bases, reference));
    const junctions: Record<string, number> = {};
    for (const value of screens.flatMap((item) => item.junctions)) junctions[value] = (junctions[value] ?? 0) + 1;
    const approximate: Record<string, number> = {};
    for (const item of screens) for (const [label, distance] of Object.entries(item.approximate)) approximate[label] = Math.min(approximate[label] ?? 999, distance);
    const reproduced = {
      records_with_srgn_exact_anchor_ge12aa: screens.filter((item) => item.anchor >= 12).length,
      records_with_exact_signal: screens.filter((item) => item.junctions.length > 0).length,
      signal_junction_following_16aa: junctions,
      exact_3xflag_hits: screens.reduce((total, item) => total + item.threeFlagHits, 0),
      maximum_exact_flag_cluster_copies: Math.max(...screens.map((item) => item.largestCluster)),
      minimum_ungapped_mismatches_to_3xflag: approximate,
    };
    result.screen = reproduced;
    for (const [key, value] of Object.entries(reproduced)) expect(value, key).toEqual(summary[key]);
  });

  it("finds the target arrangement in no record, with the product's structure check", () => {
    const checks = readSources().map((source) => ({ source, check: checkStructure({ sequence: source.reads[0].bases, quality: source.reads[0].quality, elements: targetArrangement(reference) }) }));
    const { groups } = groupReadEvidence(sources);
    result.structure = {
      anchoredOnSignal: checks.filter((item) => item.check.frame !== undefined).length,
      arrangementFound: checks.filter((item) => item.check.arrangementFound).length,
      threeFlagPresentAnywhere: checks.filter((item) => item.check.elements[1].anyFrame.length > 0).length,
      independentReadGroups: groups.length,
      scope: "Exact six-frame peptides; reads only, no assembly; untested regions and divergent tags are not excluded.",
    };
    expect(checks.filter((item) => item.check.frame !== undefined)).toHaveLength(summary.records_with_exact_signal as number);
    expect(checks.filter((item) => item.check.arrangementFound)).toEqual([]);
  });

  it("explains the representative C1 and C2 reads and aligns C2 reverse onto C2 forward", () => {
    const evidence: { records: Array<{ sample: string; source: string }> } = JSON.parse(readFileSync(join(auditRoot!, "representative_evidence.json"), "utf8"));
    const read = (sample: string) => {
      const source = evidence.records.find((record) => record.sample.startsWith(sample))!.source;
      return sources.find((item) => item.path === source)!.reads[0];
    };
    const tagAfterChain: StructureElement[] = [
      { name: "SRGN signal peptide", protein: reference.protein.slice(0, reference.signal_peptide_end_aa_1based) },
      { name: "SRGN mature start", protein: ["YPTRRARY", "YPTQRARY"] },
      { name: "FLAG", protein: reference.motifs.FLAG_1x },
    ];
    const statusOf = (check: ReturnType<typeof checkStructure>, id: string) => check.items.find((item) => item.element === "FLAG" && item.id === id)?.status;
    const c1 = checkStructure({ sequence: read("C1").bases, quality: read("C1").quality, elements: tagAfterChain });
    const c2 = checkStructure({ sequence: read("C2_forward").bases, quality: read("C2_forward").quality, elements: tagAfterChain });
    result.c1 = { present: statusOf(c1, "present"), inFrame: statusOf(c1, "in-frame"), noStop: statusOf(c1, "no-stop") };
    result.c2Forward = { present: statusOf(c2, "present"), inFrame: statusOf(c2, "in-frame"), noStop: statusOf(c2, "no-stop") };
    expect(result.c1).toEqual({ present: "pass", inFrame: "pass", noStop: "fail" });
    expect(result.c2Forward).toEqual({ present: "pass", inFrame: "pass", noStop: "pass" });

    const forward = read("C2_forward");
    const outcome = createAligner(forward.bases, "linear").align(read("C2_reverse"));
    expect(outcome.aligned).toBe(true);
    if (!outcome.aligned) return;
    const alignment = outcome.alignment;
    // The audit compared C2's SRGN start to FLAG end, forward-read positions 125–430.
    const region = alignment.columns.filter((column) => column.referencePosition !== null && column.referencePosition >= 124 && column.referencePosition < 430);
    result.c2ReverseOnForward = {
      orientation: alignment.orientation,
      referenceSegments: alignment.referenceSegments,
      regionColumns: region.length,
      regionDifferences: region.filter((column) => column.kind !== "match").length,
      highConfidenceDifferences: alignment.differences.filter((difference) => difference.confidence === "high").length,
      allDifferences: alignment.differences.length,
    };
    expect(alignment.orientation).toBe("reverse");
    expect(region).toHaveLength(306);
    expect(region.every((column) => column.kind === "match")).toBe(true);
  });

  it.skipIf(!constructRoot)("A18+ (Q356): a synthesized construct passes with its own reads, and no history read supports its 3×FLAG", () => {
    const files = walk(constructRoot!);
    const genbank = files.find((path) => /\.(gb|gbk)$/i.test(path))!;
    const [construct] = parseSequenceFile(genbank, new Uint8Array(readFileSync(genbank))).records;
    const length = construct.sequence.length;
    const mature = reference.protein.slice(reference.signal_peptide_end_aa_1based);
    const structure = checkStructure({
      sequence: construct.sequence,
      elements: [...targetArrangement(reference).slice(0, 2), { name: "SRGN mature chain", protein: [mature, `${mature.slice(0, 3)}Q${mature.slice(4)}`] }],
    });
    expect(structure.arrangementFound).toBe(true);
    const frame = structure.frame!;
    const coding = frameSpan(frame, 0, structure.elements[2].inFrame!.aaEnd, length);
    const tagCodons = structure.elements[1].inFrame!;
    const tag = frameSpan(frame, tagCodons.aaStart, tagCodons.aaEnd, length);
    const aligner = createAligner(construct.sequence, construct.topology);
    const inside = (difference: { referenceStart: number; referenceEnd: number }, range: { start: number; end: number }) => difference.referenceEnd >= range.start && difference.referenceStart < range.end;
    const own = files.filter((path) => /\.ab1$/i.test(path)).map((path) => ({ path: relative(constructRoot!, path), outcome: aligner.align(parseSequenceFile(path, new Uint8Array(readFileSync(path))).reads[0]) }));
    const alignments = own.map(({ outcome }) => (outcome.aligned ? outcome.alignment : undefined));
    const ownProfile = coverageProfile(length, alignments.filter((item) => item !== undefined).map((alignment) => ({ alignment })));
    const codingStates = Array.from({ length: coding.end - coding.start }, (_, offset) => ownProfile.stateAt(coding.start + offset));

    const { reads, groups } = groupReadEvidence(sources);
    const history = reads.map((item) => ({ item, outcome: aligner.align(item.read as SangerRead) }));
    const overTag = history.flatMap(({ outcome }) => (outcome.aligned && outcome.alignment.referenceSegments.some((segment) => segment.start < tag.start && segment.end > tag.end) ? [outcome.alignment] : []));
    const tagSupportPerRead = overTag.map((alignment) => {
      const single = coverageProfile(length, [{ alignment }]);
      let supported = 0;
      for (let position = tag.start; position < tag.end; position += 1) if (single.stateAt(position) === "supported") supported += 1;
      return supported;
    });
    result.construct = {
      reference: { name: construct.name, length, topology: construct.topology, features: construct.features.length, coding1Based: [coding.start + 1, coding.end], tag1Based: [tag.start + 1, tag.end] },
      structure: structure.items.filter((item) => item.status !== "pass").map((item) => `${item.element}/${item.id}: ${item.status}`),
      ownReads: own.map(({ path, outcome }) => (outcome.aligned
        ? {
          path,
          orientation: outcome.alignment.orientation,
          segments: outcome.alignment.referenceSegments,
          highConfidence: outcome.alignment.differences.filter((item) => item.confidence === "high")
            .map((item) => ({ kind: item.kind, at1Based: item.referenceStart + 1, reference: item.referenceBases, read: item.readBases, q: item.lowestQuality, homopolymer: item.homopolymer ?? false, insideCoding: inside(item, coding) })),
        }
        : { path, reason: outcome.reason })),
      codingCoverage: codingStates.reduce<Record<string, number>>((counts, state) => ({ ...counts, [state]: (counts[state] ?? 0) + 1 }), {}),
      codingSupportedByBothReads: Array.from({ length: coding.end - coding.start }, (_, offset) => ownProfile.supported[coding.start + offset]).filter((count) => count >= 2).length,
      history: {
        reads: reads.length,
        independentGroups: groups.length,
        aligned: history.filter(({ outcome }) => outcome.aligned).length,
        spanningTag: overTag.length,
        spanningTagWithTagDeleted: overTag.filter((alignment) => alignment.differences.some((item) => item.kind === "deletion" && item.referenceStart <= tag.start + 3 && item.referenceEnd >= tag.end - 3)).length,
        mostTagPositionsSupportedByOneRead: Math.max(0, ...tagSupportPerRead),
      },
    };
    expect(alignments.every(Boolean)).toBe(true);
    for (const alignment of alignments) {
      expect(alignment!.referenceSegments.some((segment) => segment.start <= coding.start && segment.end >= coding.end)).toBe(true);
      expect(alignment!.differences.filter((item) => item.confidence === "high" && inside(item, coding))).toEqual([]);
    }
    expect(codingStates.every((state) => state === "supported")).toBe(true);
    expect(Math.max(0, ...tagSupportPerRead)).toBeLessThan(tag.end - tag.start);
  }, 300_000);

  it("writes the local result when asked", () => {
    if (!outputRoot) return;
    mkdirSync(outputRoot, { recursive: true });
    writeFileSync(join(outputRoot, "a18-result.json"), `${JSON.stringify(result, null, 2)}\n`);
  });
});
