import type { ProtocolStep } from "./types";

export type ExperimentMethodMode = "protocol" | "custom";

export type ProtocolStepSnapshotSource = {
  versionId: string;
  humanCode: string;
  protocolTitle: string;
  versionTitle: string;
  displayVersion: string;
  steps: ProtocolStep[];
};

export type ExperimentStepSnapshotDraft = {
  protocolStepRef: string;
  groupKey: string;
  groupTitle: string;
  groupOrder: number;
  order: number;
  title: string;
  description: string;
  requiresConfirmation: boolean;
  allowsDeviation: boolean;
};

export type ExperimentStepGroupHeading = {
  title: string;
  detail?: string;
};

function normalizedHeadingPart(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[\s·•]/g, "");
}

function versionLabel(value: string) {
  const trimmed = value.trim();
  return /^v/i.test(trimmed) ? trimmed : `v${trimmed}`;
}

function isRedundantVersionTitle(protocolTitle: string, versionTitle: string, displayVersion: string) {
  const normalizedProtocol = normalizedHeadingPart(protocolTitle);
  const normalizedVersionTitle = normalizedHeadingPart(versionTitle);
  const normalizedVersion = normalizedHeadingPart(versionLabel(displayVersion));
  return !normalizedVersionTitle
    || normalizedVersionTitle === normalizedProtocol
    || normalizedVersionTitle === `${normalizedProtocol}${normalizedVersion}`;
}

/**
 * Keep the stored snapshot readable without repeating a version title that is
 * merely the Protocol title plus the same display version.
 */
export function buildExperimentStepGroupTitle(source: Omit<ProtocolStepSnapshotSource, "versionId" | "steps">) {
  const parts = [source.humanCode.trim(), source.protocolTitle.trim()];
  if (!isRedundantVersionTitle(source.protocolTitle, source.versionTitle, source.displayVersion)) {
    parts.push(source.versionTitle.trim());
  }
  parts.push(versionLabel(source.displayVersion));
  return parts.filter(Boolean).join(" · ");
}

/**
 * Older ExperimentStep snapshots may contain both the Protocol title and a
 * duplicate "Protocol title vX" version title. Present them as one stable main
 * heading with version metadata on the secondary line; the historical value
 * itself remains untouched.
 */
export function experimentStepGroupHeading(groupTitle: string): ExperimentStepGroupHeading {
  const parts = groupTitle.split(/\s*·\s*/).map((part) => part.trim()).filter(Boolean);
  const versionIndex = parts.findLastIndex((part) => /^v(?:ersion\s*)?\d/i.test(part));
  if (versionIndex < 1) return { title: groupTitle };

  const hasProtocolCode = /^PRT-/i.test(parts[0]);
  const protocolTitleIndex = hasProtocolCode ? 1 : 0;
  const protocolTitle = parts[protocolTitleIndex] ?? "";
  const version = parts[versionIndex];
  const normalizedProtocol = normalizedHeadingPart(protocolTitle);
  const normalizedVersion = normalizedHeadingPart(version);
  const meaningfulDetails = parts
    .slice(protocolTitleIndex + 1, versionIndex)
    .filter((part) => {
      const normalized = normalizedHeadingPart(part);
      return normalized !== normalizedProtocol && normalized !== `${normalizedProtocol}${normalizedVersion}`;
    });

  return {
    title: protocolTitle || groupTitle,
    detail: [...(hasProtocolCode ? [parts[0]] : []), ...meaningfulDetails, version].filter(Boolean).join(" · ") || undefined,
  };
}

export function orderedUniqueIds(values: Iterable<string>) {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    ordered.push(value);
  }
  return ordered;
}

export function buildProtocolExperimentSteps(sources: ProtocolStepSnapshotSource[]): ExperimentStepSnapshotDraft[] {
  return sources.flatMap((source, groupOrder) => source.steps.map((step, index) => ({
    protocolStepRef: `${source.versionId}:${step.order ?? index + 1}`,
    groupKey: source.versionId,
    groupTitle: buildExperimentStepGroupTitle(source),
    groupOrder,
    order: step.order ?? index + 1,
    title: step.title || `Step ${index + 1}`,
    description: step.description ?? "",
    requiresConfirmation: step.requires_confirmation ?? true,
    allowsDeviation: step.allows_deviation ?? true,
  })));
}

/**
 * Custom experiments use one step per line. A vertical bar separates the
 * short bench-facing title from optional detail:
 *
 *   Seed cells | 2.0 × 10^5 cells per well
 *
 * Numbering typed by the user is stripped because ExperimentStep.order is the
 * canonical execution order.
 */
export function parseCustomExperimentSteps(value: string): ProtocolStep[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const normalized = line.replace(/^\s*\d+[.)、]\s*/, "");
      const separator = normalized.indexOf("|");
      const title = (separator >= 0 ? normalized.slice(0, separator) : normalized).trim();
      const description = separator >= 0 ? normalized.slice(separator + 1).trim() : "";
      return {
        order: index + 1,
        title: title || `Step ${index + 1}`,
        description,
        requires_confirmation: true,
        allows_deviation: true,
      };
    });
}
