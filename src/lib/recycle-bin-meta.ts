export const recyclableRecordTypes = ["project", "research_plan", "protocol", "experiment", "result", "report", "entry"] as const;

export type RecyclableRecordType = (typeof recyclableRecordTypes)[number];

export function recycleBinHref(targetType: string, targetId: string) {
  const paths: Record<string, string> = {
    project: `/projects/${targetId}`,
    research_plan: `/research-plans/${targetId}`,
    protocol: `/protocols/${targetId}`,
    experiment: `/experiments/${targetId}`,
    result: `/results/${targetId}`,
    report: `/reports/${targetId}`,
    entry: `/entries/${targetId}`,
  };
  return paths[targetType] ?? "/trash";
}

export function recycleBinTypeLabel(targetType: string) {
  const labels: Record<string, string> = {
    project: "Project",
    research_plan: "Research Plan",
    protocol: "Protocol",
    experiment: "Experiment",
    result: "Result",
    report: "Report",
    entry: "Entry",
  };
  return labels[targetType] ?? targetType.replaceAll("_", " ");
}
