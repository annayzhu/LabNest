import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createAligner, differenceStops, rescore, type ReadAlignment } from "./align";
import { coverageProfile } from "./coverage";
import { copyKey, groupReadEvidence, importSequenceFiles, joinKnownCopies, parseSequenceFile } from "./files";
import { versionFingerprint } from "./store.server";

vi.mock("@/lib/db", () => ({ prisma: {} }));
import { declaredCompleteness, defaultCompleteness, workbenchItems } from "./workbench";

// PRD v2.0 §3.1 (C0): what the workbench concluded must not depend on how a record is drawn, which threshold a view
// happened to use, or which folder a file was saved in.
const root = "src/lib/plasmid/test-samples/files";
const bytesOf = (path: string) => new Uint8Array(readFileSync(join(root, path)));
const [reference] = parseSequenceFile("A10-reference.gb", bytesOf("A10-reference.gb")).records;
const aligner = createAligner(reference.sequence, reference.topology);

function aligned(bases: string, quality: number[]): ReadAlignment {
  const outcome = aligner.align({ name: "SIM-check", bases, quality, peaks: null, traces: null, metadata: {} });
  if (!outcome.aligned) throw new Error(outcome.reason);
  return outcome.alignment;
}

describe("C0 reliability (PRD v2.0 R01–R04)", () => {
  it("AT01: a circular record without a declaration is of unknown completeness; a read stays partial", async () => {
    expect(reference.topology).toBe("circular");
    const items = workbenchItems(await importSequenceFiles([{ path: "A10-reference.gb", bytes: bytesOf("A10-reference.gb") }, { path: "A10-read-F.ab1", bytes: bytesOf("A10-read-F.ab1") }]));
    expect(items.map((item) => [item.kind, defaultCompleteness(item)])).toEqual([["record", { completeness: "unknown", source: null }], ["read", { completeness: "partial", source: null }]]);
  });

  it("Q369: only the file's own \"complete sequence\" makes a record full length, with the line as evidence", () => {
    expect(declaredCompleteness({ description: "Cloning vector pEGFP-N1, complete sequence." })).toEqual({ completeness: "full_length", text: "Cloning vector pEGFP-N1, complete sequence." });
    expect(declaredCompleteness({ description: "Cloning vector pX, partial sequence." })).toBeUndefined();
    expect(declaredCompleteness({ description: "Synthetic construct, complete sequence of the partial insert" })).toBeUndefined();
    expect(declaredCompleteness({ description: "SIM-SRGN-3xFLAG reference" })).toBeUndefined();
    const record = { kind: "record" as const, key: "x", record: { name: "p", description: "Vector p, complete sequence.", sequence: "ACGT", topology: "circular" as const, features: [] } };
    expect(defaultCompleteness(record)).toEqual({ completeness: "full_length", source: "file" });
  });

  it("Q370: confirming a completeness nobody recorded makes a new version; an unrecorded one keeps its old fingerprint", () => {
    const record = { sequence: "ACGTACGT", topology: "circular" as const, features: [] };
    expect(versionFingerprint(record, "full_length", null)).toBe(versionFingerprint(record, "full_length"));
    expect(versionFingerprint(record, "full_length", "user")).not.toBe(versionFingerprint(record, "full_length", null));
    expect(versionFingerprint(record, "full_length", "user")).not.toBe(versionFingerprint(record, "full_length", "file"));
  });

  it("Q371: identical bases alone group reads until a person splits one off; copies of one file never split", async () => {
    const bytes = bytesOf("A10-read-F.ab1");
    const read = parseSequenceFile("A10-read-F.ab1", bytes).reads[0];
    const seq = new TextEncoder().encode(`>${read.name}\n${read.bases}\n`);
    const sources = await importSequenceFiles([{ path: "run-1/A.ab1", bytes }, { path: "run-2/B.seq", bytes: seq }, { path: "run-3/A-copy.ab1", bytes }]);
    const joined = groupReadEvidence(sources);
    expect(joined.groups).toHaveLength(1);
    expect(joined.groups[0].reasons.sort()).toEqual(["identical-bases", "identical-file"]);
    const split = groupReadEvidence(sources, new Set([joined.reads[1].id]));
    expect(split.groups.map((group) => group.readIds.length).sort()).toEqual([1, 2]);
    expect(groupReadEvidence(sources, new Set([joined.reads[2].id])).groups).toHaveLength(1);
  });

  it("AT03: a Q25 difference is high quality at Q20 and low quality at Q30 in confidence, stops and coverage alike", () => {
    const position = 700;
    const bases = reference.sequence.slice(400, 1000).split("");
    bases[position - 400] = reference.sequence[position] === "A" ? "C" : "A";
    const quality = bases.map((_, index) => (index === position - 400 ? 25 : 40));
    const alignment = aligned(bases.join(""), quality);
    const at = (minQuality: number) => {
      const judged = rescore(alignment, minQuality, reference.sequence.length);
      return {
        confidence: judged.differences.find((difference) => difference.referenceStart === position)?.confidence,
        stops: differenceStops([judged]).length,
        coverage: coverageProfile(reference.sequence.length, [{ alignment: judged }], { minQuality }).stateAt(position),
        parameter: judged.parameters.minQuality,
      };
    };
    expect(at(20)).toEqual({ confidence: "high", stops: 1, coverage: "conflict", parameter: 20 });
    expect(at(30)).toEqual({ confidence: "low-quality", stops: 0, coverage: "low", parameter: 30 });
    expect(rescore(alignment, 20, reference.sequence.length)).toBe(alignment);
  });

  it("AT05: the same original saved in two folders counts once; other reads of the second folder stay apart", async () => {
    const open = groupReadEvidence(await importSequenceFiles([{ path: "run-1/A10-read-F.ab1", bytes: bytesOf("A10-read-F.ab1") }]));
    const known = new Map(open.reads.map((item) => [copyKey(item), item.group]));
    const second = groupReadEvidence(await importSequenceFiles(["A10-read-F.ab1", "A12-read-R.ab1"].map((path) => ({ path: `run-2/${path}`, bytes: bytesOf(path) }))));
    const groups = joinKnownCopies(second.reads, known, "folder-2");
    expect(groups[0]).toBe(open.reads[0].group);
    expect(groups[1]).toBe(`folder-2:${second.reads[1].group}`);
  });
});
