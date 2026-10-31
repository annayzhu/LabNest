import type { ScientificDocument } from "./scientific-document";
import { matchKey } from "./samples";

/** A pasted list of codes or names: one per line, or separated by commas, semicolons or tabs. */
export function parseSampleList(text: string) {
  return [...new Set(text.split(/[\n\r,;，；\t]+/).map((token) => token.trim()).filter(Boolean))];
}

/**
 * Pasted codes or names matched to samples: a code first (it is unique), else a name when exactly one sample has it.
 * Names several samples share are reported, not guessed.
 */
export function matchSampleTokens<T extends { id: string; code: string; name: string }>(tokens: string[], candidates: T[]) {
  const byCode = new Map(candidates.map((sample) => [matchKey(sample.code), sample]));
  const byName = new Map<string, T[]>();
  for (const sample of candidates) byName.set(matchKey(sample.name), [...(byName.get(matchKey(sample.name)) ?? []), sample]);
  const matched: T[] = [], missing: string[] = [], ambiguous: string[] = [];
  for (const token of tokens) {
    const byKey = byCode.get(matchKey(token)) ?? (byName.get(matchKey(token))?.length === 1 ? byName.get(matchKey(token))![0] : undefined);
    if (byKey) { if (!matched.includes(byKey)) matched.push(byKey); }
    else if ((byName.get(matchKey(token))?.length ?? 0) > 1) ambiguous.push(token);
    else missing.push(token);
  }
  return { matched, missing, ambiguous };
}

/** "Sample⇥Group" lines (S13): the first cell names a sample of the experiment, the second its group. */
export function parseGroupAssignments(text: string) {
  return text.split(/\r?\n/).map((line) => line.split(/\t|,|，/).map((cell) => cell.trim())).filter(([sample, group]) => sample && group).map(([sample, group]) => ({ sample, group: group.slice(0, 60) }));
}

export type ExperimentSampleLine = { role: "input" | "output"; code: string; name: string; type: string; group: string | null; place: string | null; used: string | null; parent: string | null };

/** The experiment's samples as a table at the head of 实验设置与样本, for print and export (S12). */
export function withExperimentSamples(document: ScientificDocument, lines: ExperimentSampleLine[]): ScientificDocument {
  if (!lines.length) return document;
  const table = (role: ExperimentSampleLine["role"], title: string) => {
    const rows = lines.filter((line) => line.role === role);
    if (!rows.length) return [];
    return [
      { id: `run-derived:samples:${role}:title`, type: "text" as const, text: title },
      { id: `run-derived:samples:${role}`, type: "table" as const, rows: [
        ["Code", "Name", "Type", role === "input" ? "Group" : "Parent sample", "Place", ...(role === "input" ? ["Used"] : [])],
        ...rows.map((line) => [line.code, line.name, line.type, (role === "input" ? line.group : line.parent) ?? "", line.place ?? "", ...(role === "input" ? [line.used ?? ""] : [])]),
      ] },
    ];
  };
  return {
    ...document,
    sections: document.sections.map((section) => section.key === "setup"
      ? { ...section, blocks: [...table("input", "Samples used"), ...table("output", "Samples produced"), ...section.blocks] }
      : section),
  };
}

/** Sample names and codes in a plate layout: which wells each of the experiment's samples occupies (S14). */
export function wellsBySample(plates: Array<{ name: string; wells: Record<string, Record<string, string | number>> }>, samples: Array<{ id: string; code: string; name: string }>) {
  const byCode = new Map(samples.map((sample) => [matchKey(sample.code), sample.id]));
  const byName = new Map<string, string[]>();
  for (const sample of samples) byName.set(matchKey(sample.name), [...(byName.get(matchKey(sample.name)) ?? []), sample.id]);
  const wells = new Map<string, string[]>();
  for (const plate of plates) {
    for (const [well, params] of Object.entries(plate.wells)) {
      const ids = new Set<string>();
      for (const value of Object.values(params)) {
        const key = matchKey(String(value));
        // A name several of the experiment's samples share cannot tell them apart; a code always can.
        const id = byCode.get(key) ?? (byName.get(key)?.length === 1 ? byName.get(key)![0] : undefined);
        if (id) ids.add(id);
      }
      for (const id of ids) wells.set(id, [...(wells.get(id) ?? []), plates.length > 1 ? `${plate.name} ${well}` : well]);
    }
  }
  return wells;
}

const outputHints: Array<{ key: string; pattern: RegExp }> = [
  { key: "sample_cdna", pattern: /\bRT\b|reverse[- ]transcri|逆转录|反转录|\bcDNA\b/i },
  { key: "sample_rna", pattern: /\bRNA\b.*(isolat|extract|purif|提取|纯化|抽提)|(提取|抽提|纯化).*\bRNA\b/i },
  { key: "sample_dna", pattern: /(?<!c)\bDNA\b.*(isolat|extract|purif|提取|纯化|抽提)|(提取|抽提|纯化).*(?<!c)DNA/i },
  { key: "sample_protein", pattern: /(protein|蛋白).*(lys|extract|提取|裂解)|(裂解|提取).*(protein|蛋白)/i },
];

/** The output type an experiment's title suggests (RNA isolation → RNA, RT → cDNA); none when it suggests several or none. */
export function suggestedOutputType(texts: Array<string | null | undefined>) {
  const text = texts.filter(Boolean).join(" · ");
  const matches = outputHints.filter((hint) => hint.pattern.test(text));
  return matches.length === 1 ? matches[0].key : undefined;
}

/**
 * How many of the experiment's input samples each run group holds (S15): by group name when the run's groups carry
 * the sample groups' names, else everything for a run without groups. Undefined when it cannot tell.
 */
export function runSampleCount(inputGroups: Array<string | null>, runGroupLabel: string | undefined) {
  if (!inputGroups.length) return undefined;
  if (!runGroupLabel) return inputGroups.length;
  return inputGroups.filter((group) => group === runGroupLabel).length || undefined;
}
