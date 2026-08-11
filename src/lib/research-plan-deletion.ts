import type { ResearchPlanDependencyCounts } from "./record-lifecycle";

export type { ResearchPlanDependencyCounts } from "./record-lifecycle";

export function researchPlanDeleteBlockers(
  status: string,
  counts: ResearchPlanDependencyCounts,
) {
  const labels: Record<keyof ResearchPlanDependencyCounts, string> = {
    experiments: "Experiment",
    results: "Result",
    reports: "Report",
    entries: "Entry",
    reportSourceReferences: "Report source reference",
  };
  const blockers: string[] = [];
  if (status !== "draft") blockers.push(`status is ${status}; only Draft plans can be moved to the Recycle Bin`);
  for (const key of Object.keys(labels) as Array<keyof ResearchPlanDependencyCounts>) {
    const count = counts[key];
    if (count) blockers.push(`${count} ${labels[key]}${count === 1 ? "" : "s"}`);
  }
  return blockers;
}
