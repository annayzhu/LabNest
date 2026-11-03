import type { AlignmentDifference, ReadAlignment } from "./align";
import type { CoverageProfile, CoverageState } from "./coverage";
import { differenceContext } from "./effects";
import type { StructureCheck } from "./fusion";
import { foldSegments } from "./layout";
import type { Channel, SangerRead, Segment, SequenceRecord } from "./model";
import { traceWindow } from "./trace";

/**
 * 核查记录 (PRD v2.0 PW-07, Q372–Q378): what a check covers, what in it a person must deal with, and which conclusions
 * the dispositions allow. Pure, so the page that builds a record and the server that keeps it apply the same rules.
 */

export const dispositions = ["pending", "sequencing_issue", "expected", "sample_mismatch", "excluded_read", "acknowledged"] as const;
export type Disposition = (typeof dispositions)[number];
export const results = ["consistent", "explained", "mismatch", "insufficient"] as const;
export type VerificationResult = (typeof results)[number];
export const statuses = ["draft", "review", "confirmed", "superseded"] as const;
export type VerificationStatus = (typeof statuses)[number];

export const dispositionLabels: Record<Disposition, string> = {
  pending: "To check",
  sequencing_issue: "Likely a sequencing problem",
  expected: "Accepted as an expected difference",
  sample_mismatch: "The sample does not match",
  excluded_read: "Read excluded here",
  acknowledged: "Known gap, no conclusion",
};
export const resultLabels: Record<VerificationResult, string> = {
  consistent: "Consistent within the scope",
  explained: "Differences, all explained",
  mismatch: "Does not match the target",
  insufficient: "Not enough evidence",
};
export const statusLabels: Record<VerificationStatus, string> = { draft: "Draft", review: "Awaiting review", confirmed: "Confirmed", superseded: "Superseded" };

/** A difference can be judged; a gap can only be acknowledged, since there is nothing to judge (Q374). */
export const choicesFor = (kind: ItemKind): Disposition[] => (kind === "gap" ? ["pending", "acknowledged"] : ["pending", "sequencing_issue", "expected", "sample_mismatch", "excluded_read"]);

/** What a check speaks for (Q375), in 0-based half-open reference coordinates; two segments when it crosses the origin. */
export type VerificationScope = { kind: "whole" | "feature" | "range"; label: string; segments: Segment[] };

export function wholeScope(length: number): VerificationScope {
  return { kind: "whole", label: "Whole reference", segments: [{ start: 0, end: length }] };
}

/** A 1-based closed range typed by a person, folded onto a circular reference when it runs past the origin. */
export function rangeScope(start1: number, end1: number, length: number, circular: boolean): VerificationScope | undefined {
  if (!Number.isInteger(start1) || !Number.isInteger(end1) || start1 < 1 || end1 < 1 || start1 > length || end1 > length) return undefined;
  if (start1 > end1 && !circular) return undefined;
  const end = start1 > end1 ? end1 + length : end1;
  return { kind: "range", label: `${start1}–${end1}`, segments: foldSegments(start1 - 1, end, length) };
}

/**
 * The default scope when the plasmid has an expected structure (Q375): from the first element's DNA to the last one's,
 * when every element was found. Undefined otherwise, and the whole reference applies.
 */
export function structureScope(check: Pick<StructureCheck, "elements"> | undefined): VerificationScope | undefined {
  const hits = check?.elements.map((element) => element.anyFrame[0]);
  if (!hits?.length || hits.some((hit) => !hit)) return undefined;
  const start = Math.min(...hits.map((hit) => hit!.start));
  const end = Math.max(...hits.map((hit) => hit!.end));
  return { kind: "range", label: `Expected structure (${start + 1}–${end})`, segments: [{ start, end }] };
}

export const scopeLength = (scope: VerificationScope) => scope.segments.reduce((total, segment) => total + segment.end - segment.start, 0);
export const inScope = (scope: VerificationScope, position: number) => scope.segments.some((segment) => position >= segment.start && position < segment.end);

export type ItemKind = "difference" | "gap";

export type TraceSnippet = { scans: number; channels: Record<Channel, number[]>; calls: Array<{ scan: number; base: string; quality: number | null; mark: boolean }> };

export type DifferenceDetail = Pick<AlignmentDifference, "kind" | "referenceBases" | "readBases" | "lowestQuality" | "confidence" | "homopolymer"> & {
  features: string[];
  coding: Array<{ feature: string; codon: number; change: string }>;
  knownVariant?: string;
  trace?: TraceSnippet;
};
export type GapDetail = { state: Exclude<CoverageState, "supported">; length: number };

export type DraftItem = { kind: ItemKind; start: number; end: number; readName?: string; detail: DifferenceDetail | GapDetail };

/**
 * The items a new record starts with: every difference in every read inside the scope, whatever its quality (PW-06: the
 * list must not skip what needs a person), and every stretch of the scope with no reliable evidence (uncovered or low
 * quality). Conflicts and interrupted support sit around differences, which are items of their own.
 */
export function draftItems(input: {
  record: SequenceRecord;
  scope: VerificationScope;
  reads: Array<{ read: SangerRead; alignment?: ReadAlignment }>;
  profile: CoverageProfile;
}): DraftItem[] {
  const { record, scope, reads, profile } = input;
  const items: DraftItem[] = [];
  reads.forEach(({ read, alignment }) => {
    if (!alignment) return;
    for (const difference of alignment.differences) {
      if (!inScope(scope, difference.referenceStart % record.sequence.length)) continue;
      const context = differenceContext(difference, record);
      const trace = traceSnippet(read, alignment, difference.referenceStart);
      items.push({
        kind: "difference",
        start: difference.referenceStart,
        end: difference.referenceEnd,
        readName: read.name,
        detail: {
          kind: difference.kind,
          referenceBases: difference.referenceBases,
          readBases: difference.readBases,
          lowestQuality: difference.lowestQuality,
          confidence: difference.confidence,
          ...(difference.homopolymer ? { homopolymer: true } : {}),
          features: context.features,
          coding: context.coding.map((change) => ({ feature: change.feature, codon: change.codon, change: `${change.referenceCodon} (${change.referenceAminoAcid}) → ${change.readCodon} (${change.readAminoAcid})` })),
          ...(context.knownVariant ? { knownVariant: context.knownVariant } : {}),
          ...(trace ? { trace } : {}),
        },
      });
    }
  });
  for (const range of profile.ranges) {
    if (range.state !== "uncovered" && range.state !== "low") continue;
    for (const segment of scope.segments) {
      const start = Math.max(range.start, segment.start);
      const end = Math.min(range.end, segment.end);
      if (end > start) items.push({ kind: "gap", start, end, detail: { state: range.state, length: end - start } });
    }
  }
  return items.sort((left, right) => left.start - right.start || (left.kind === right.kind ? 0 : left.kind === "gap" ? 1 : -1));
}

/** Coverage inside the scope by state, for the record and the report. */
export function scopedCoverage(profile: CoverageProfile, scope: VerificationScope) {
  const ranges: Array<{ start: number; end: number; state: CoverageState }> = [];
  for (const range of profile.ranges) {
    for (const segment of scope.segments) {
      const start = Math.max(range.start, segment.start);
      const end = Math.min(range.end, segment.end);
      if (end > start) ranges.push({ start, end, state: range.state });
    }
  }
  const totals = Object.fromEntries((["supported", "interrupted", "conflict", "low", "uncovered"] as CoverageState[]).map((state) => [state, ranges.filter((range) => range.state === state).reduce((sum, range) => sum + range.end - range.start, 0)])) as Record<CoverageState, number>;
  return { ranges: ranges.sort((left, right) => left.start - right.start), totals };
}

/**
 * Conclusions the items allow (Q377). "Consistent" needs every place in the scope covered and every difference put down
 * to sequencing; "explained" needs full coverage too, with at least one accepted difference and no mismatch. A gap or an
 * open item leaves only "not enough evidence" or "does not match".
 */
export function allowedResults(items: Array<{ kind: ItemKind; disposition: Disposition }>): VerificationResult[] {
  const gaps = items.some((item) => item.kind === "gap");
  const open = items.some((item) => item.disposition === "pending");
  const mismatch = items.some((item) => item.disposition === "sample_mismatch");
  const accepted = items.some((item) => item.disposition === "expected");
  const allowed: VerificationResult[] = [];
  if (!gaps && !open && !mismatch && !accepted) allowed.push("consistent");
  if (!gaps && !open && !mismatch && accepted) allowed.push("explained");
  allowed.push("mismatch", "insufficient");
  return allowed;
}

/** Why a record cannot be confirmed yet, or nothing when it can (Q377). */
export function confirmBlockers(items: Array<{ disposition: Disposition }>, result: VerificationResult | null | undefined, confirmedBy: string, allowed: VerificationResult[]) {
  const blockers: string[] = [];
  const open = items.filter((item) => item.disposition === "pending").length;
  if (open) blockers.push(`${open} item(s) still to check`);
  if (!result) blockers.push("Choose a result");
  else if (!allowed.includes(result)) blockers.push("The items do not allow this result");
  if (!confirmedBy.trim()) blockers.push("Type who confirms");
  return blockers;
}

const snippetBases = 8;

/** The chromatogram around one reference position, thinned to every other scan so a record stays small. */
export function traceSnippet(read: SangerRead, alignment: ReadAlignment, position: number): TraceSnippet | undefined {
  const window = traceWindow(read, alignment, position - snippetBases, position + snippetBases + 1, "aligned");
  if (!window) return undefined;
  const thin = (values: Int16Array) => Array.from(values).filter((_, index) => index % 2 === 0);
  return {
    scans: Math.ceil((window.scanEnd - window.scanStart) / 2),
    channels: { A: thin(window.channels.A), C: thin(window.channels.C), G: thin(window.channels.G), T: thin(window.channels.T) },
    calls: window.calls.map((call) => ({ scan: Math.round((call.scan - window.scanStart) / 2), base: call.base, quality: call.quality, mark: call.referencePosition === position })),
  };
}

/** Rows of the differences table (CSV/TSV export, Q379), in 1-based coordinates. */
export function itemRows(items: Array<{ kind: string; start: number; end: number; readName: string | null; detailJson: unknown; disposition: Disposition; reason: string | null }>) {
  const header = ["kind", "start", "end", "read", "reference", "read bases", "quality", "confidence", "features", "codon change", "disposition", "reason"];
  const rows = items.map((item) => {
    const detail = item.detailJson as Partial<DifferenceDetail & GapDetail>;
    return [
      item.kind === "gap" ? `gap (${detail.state})` : (detail.kind ?? "difference"),
      String(item.start + 1),
      String(Math.max(item.start + 1, item.end)),
      item.readName ?? "",
      detail.referenceBases ?? "",
      detail.readBases ?? "",
      detail.lowestQuality === null || detail.lowestQuality === undefined ? "" : `Q${detail.lowestQuality}`,
      detail.confidence ?? "",
      (detail.features ?? []).join("; "),
      (detail.coding ?? []).map((change) => `${change.feature} codon ${change.codon}: ${change.change}`).join("; "),
      dispositionLabels[item.disposition],
      item.reason ?? "",
    ];
  });
  return [header, ...rows];
}

export function toCsv(rows: string[][]) {
  return `${rows.map((row) => row.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell)).join(",")).join("\n")}\n`;
}
