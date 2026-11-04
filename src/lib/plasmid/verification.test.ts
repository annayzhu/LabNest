import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { alignInRegion, createAligner, type ReadAlignment } from "./align";
import { coverageProfile } from "./coverage";
import { parseSequenceFile } from "./files";
import { construct } from "./test-samples/build";
import { allowedResults, confirmBlockers, draftItems, itemRows, rangeScope, scopedCoverage, toCsv, wholeScope, type Disposition, type ItemKind } from "./verification";

// PRD v2.0 PW-07 and §6: a check speaks only for its scope, and "checked" never turns into "consistent" by itself.
const root = "src/lib/plasmid/test-samples/files";
const bytesOf = (path: string) => new Uint8Array(readFileSync(join(root, path)));
const [reference] = parseSequenceFile("A10-reference.gb", bytesOf("A10-reference.gb")).records;
const aligner = createAligner(reference.sequence, reference.topology);
const readOf = (path: string) => parseSequenceFile(path, bytesOf(path)).reads[0];
function aligned(path: string) {
  const read = readOf(path);
  const outcome = aligner.align(read);
  if (!outcome.aligned) throw new Error(outcome.reason);
  return { read, alignment: outcome.alignment as ReadAlignment };
}
const items = (...pairs: Array<[ItemKind, Disposition]>) => pairs.map(([kind, disposition]) => ({ kind, disposition }));

describe("verification records (C1)", () => {
  it("AT06: a read over the insert leaves the backbone as gaps, so the whole reference cannot be consistent", () => {
    const placed = aligned("A11-read-Q31.ab1");
    const profile = coverageProfile(reference.sequence.length, [{ alignment: placed.alignment }]);
    const whole = draftItems({ record: reference, scope: wholeScope(reference.sequence.length), reads: [placed], profile });
    expect(whole.some((item) => item.kind === "gap" && item.start === 0)).toBe(true);
    expect(whole.filter((item) => item.kind === "difference").map((item) => item.start)).toContain(construct.r31Middle);
    const decided = whole.map((item) => ({ kind: item.kind, disposition: (item.kind === "gap" ? "acknowledged" : "expected") as Disposition }));
    expect(allowedResults(decided)).toEqual(["mismatch", "insufficient"]);

    const insert = rangeScope(construct.r31Middle - 40, construct.r31Middle + 40, reference.sequence.length, true)!;
    const narrow = draftItems({ record: reference, scope: insert, reads: [placed], profile });
    expect(narrow.filter((item) => item.kind === "gap")).toEqual([]);
    expect(narrow.map((item) => item.start)).toEqual([construct.r31Middle]);
    expect(scopedCoverage(profile, insert).totals.uncovered).toBe(0);
  });

  it("keeps a trace snippet with each difference, marked at the difference", () => {
    const placed = aligned("A11-read-Q31.ab1");
    const profile = coverageProfile(reference.sequence.length, [{ alignment: placed.alignment }]);
    const [difference] = draftItems({ record: reference, scope: rangeScope(construct.r31Middle, construct.r31Middle + 2, reference.sequence.length, true)!, reads: [placed], profile });
    const detail = difference.detail as { trace?: { calls: Array<{ mark: boolean }>; channels: Record<string, number[]> } };
    expect(detail.trace?.calls.filter((call) => call.mark)).toHaveLength(1);
    expect(detail.trace?.channels.A.length).toBeGreaterThan(20);
  });

  it("AT07: an accepted difference allows \"explained\", never \"consistent\"; sequencing problems alone allow \"consistent\"", () => {
    expect(allowedResults(items(["difference", "expected"]))).toEqual(["explained", "mismatch", "insufficient"]);
    expect(allowedResults(items(["difference", "sequencing_issue"], ["difference", "excluded_read"]))).toEqual(["consistent", "mismatch", "insufficient"]);
    expect(allowedResults(items(["difference", "sample_mismatch"]))).toEqual(["mismatch", "insufficient"]);
    expect(allowedResults([])).toEqual(["consistent", "mismatch", "insufficient"]);
  });

  it("AT10: open items, a missing result or a missing confirmer block confirming", () => {
    const open = items(["difference", "pending"], ["gap", "acknowledged"]);
    expect(confirmBlockers(open, "consistent", "", allowedResults(open))).toEqual(["1 item(s) still to check", "The items do not allow this result", "Type who confirms"]);
    const done = items(["difference", "sequencing_issue"]);
    expect(confirmBlockers(done, null, "Li", allowedResults(done))).toEqual(["Choose a result"]);
    expect(confirmBlockers(done, "consistent", "Li", allowedResults(done))).toEqual([]);
  });

  it("a typed range across the origin of a circular reference becomes two segments; a linear one refuses it", () => {
    expect(rangeScope(2900, 20, 2949, true)?.segments).toEqual([{ start: 2899, end: 2949 }, { start: 0, end: 20 }]);
    expect(rangeScope(2900, 20, 2949, false)).toBeUndefined();
    expect(rangeScope(0, 20, 2949, true)).toBeUndefined();
  });

  it("holds a read to a stretch of the reference: another copy of a repeat, on whole-reference coordinates", () => {
    const unit = reference.sequence.slice(400, 1000);
    const repeated = `${reference.sequence.slice(0, 1000)}${"T".repeat(50)}${unit}`;
    const read = { name: "SIM-repeat", bases: `${unit.slice(0, 300)}${unit[300] === "A" ? "C" : "A"}${unit.slice(301)}`, quality: Array(600).fill(40), peaks: null, traces: null, metadata: {} };
    const free = createAligner(repeated, "linear").align(read);
    expect(free.aligned && free.alignment.secondary.length).toBeGreaterThan(0);
    const region = { start: 1000, end: repeated.length };
    const held = alignInRegion(repeated, read, region);
    if (!held.aligned) throw new Error(held.reason);
    expect(held.alignment.region).toEqual(region);
    expect(held.alignment.referenceSegments[0].start).toBe(1050);
    expect(held.alignment.differences).toEqual([expect.objectContaining({ kind: "mismatch", referenceStart: 1350, referenceEnd: 1351 })]);
    expect(held.alignment.columns.find((column) => column.referencePosition !== null)?.referencePosition).toBe(1050);
    expect(alignInRegion(repeated, read, { start: 0, end: 300 }).aligned).toBe(false);
  });

  it("exports the items in 1-based coordinates and quotes what needs quoting", () => {
    const rows = itemRows([
      { kind: "difference", start: 9, end: 10, readName: "SIM, read", detailJson: { kind: "mismatch", referenceBases: "G", readBases: "A", lowestQuality: 40, confidence: "high", features: ["CDS"], coding: [] }, disposition: "expected", reason: "known \"R31Q\"" },
      { kind: "gap", start: 0, end: 100, readName: null, detailJson: { state: "uncovered", length: 100 }, disposition: "acknowledged", reason: "backbone" },
    ]);
    expect(rows[1].slice(0, 4)).toEqual(["mismatch", "10", "10", "SIM, read"]);
    expect(rows[2].slice(0, 3)).toEqual(["gap (uncovered)", "1", "100"]);
    expect(toCsv(rows)).toContain('"SIM, read"');
    expect(toCsv(rows)).toContain('"known ""R31Q"""');
  });
});
