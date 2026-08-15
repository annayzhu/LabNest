export type RecordLifecycleBlocker = {
  key: string;
  label: string;
  labelZh: string;
  count?: number;
  detail?: string;
  detailZh?: string;
};

type DependencyDefinition<T extends Record<string, number>> = {
  key: keyof T;
  label: string;
  labelZh: string;
};

function dependencyBlockers<T extends Record<string, number>>(
  counts: T,
  definitions: Array<DependencyDefinition<T>>,
) {
  return definitions.flatMap<RecordLifecycleBlocker>(({ key, label, labelZh }) => {
    const count = counts[key];
    return count > 0 ? [{ key: String(key), label, labelZh, count }] : [];
  });
}

function stateBlocker(
  key: string,
  label: string,
  labelZh: string,
  current: string,
  allowed: string,
): RecordLifecycleBlocker | undefined {
  if (current === allowed) return undefined;
  return {
    key,
    label,
    labelZh,
    detail: `current value is ${current}; moving to the recycle bin requires ${allowed}`,
    detailZh: `当前为 ${current}；移入回收站要求为 ${allowed}`,
  };
}

export type ProjectDependencyCounts = {
  researchPlans: number;
  protocols: number;
  experiments: number;
  results: number;
  reports: number;
  entries: number;
  entities: number;
  procurementInquiries: number;
  genericReferences: number;
};

export function projectDeleteBlockers(counts: ProjectDependencyCounts) {
  return dependencyBlockers(counts, [
    { key: "researchPlans", label: "Research Plans", labelZh: "研究方案" },
    { key: "protocols", label: "Protocols", labelZh: "实验规程" },
    { key: "experiments", label: "Experiments", labelZh: "实验" },
    { key: "results", label: "Results", labelZh: "结果" },
    { key: "reports", label: "Reports", labelZh: "报告" },
    { key: "entries", label: "Entries", labelZh: "实验记录" },
    { key: "entities", label: "Entities", labelZh: "科研对象" },
    { key: "procurementInquiries", label: "Procurement inquiries", labelZh: "采购询价" },
    { key: "genericReferences", label: "Other record links", labelZh: "其他记录链接" },
  ]);
}

export type ResearchPlanDependencyCounts = {
  entries: number;
  experiments: number;
  results: number;
  reports: number;
  reportSourceReferences: number;
};

export function researchPlanDeleteBlockerItems(status: string, counts: ResearchPlanDependencyCounts) {
  const state = stateBlocker("status", "Status", "状态", status, "draft");
  return [
    ...(state ? [state] : []),
    ...dependencyBlockers(counts, [
      { key: "experiments", label: "Experiments", labelZh: "实验" },
      { key: "results", label: "Results", labelZh: "结果" },
      { key: "reports", label: "Reports", labelZh: "报告" },
      { key: "entries", label: "Entries", labelZh: "实验记录" },
      { key: "reportSourceReferences", label: "Report source references", labelZh: "报告来源引用" },
    ]),
  ];
}

export function researchPlanRequiresAssociationPreservingRecycle(counts: ResearchPlanDependencyCounts) {
  return Object.values(counts).some((count) => count > 0);
}

export type ProtocolDependencyCounts = {
  projects: number;
  researchPlans: number;
  experiments: number;
  results: number;
  nonDraftVersions: number;
  derivedVersions: number;
  reportSourceReferences: number;
};

export function protocolDeleteBlockers(
  availability: string,
  recordStatus: string,
  counts: ProtocolDependencyCounts,
) {
  const availabilityBlocker = stateBlocker("availability", "Availability", "可用状态", availability, "draft");
  const recordBlocker = stateBlocker("recordStatus", "Record status", "记录状态", recordStatus, "draft");
  return [
    ...(availabilityBlocker ? [availabilityBlocker] : []),
    ...(recordBlocker ? [recordBlocker] : []),
    ...dependencyBlockers(counts, [
      { key: "projects", label: "Project links", labelZh: "项目关联" },
      { key: "researchPlans", label: "Research Plan links", labelZh: "研究方案关联" },
      { key: "experiments", label: "Experiment uses", labelZh: "实验引用" },
      { key: "results", label: "Result references", labelZh: "结果引用" },
      { key: "nonDraftVersions", label: "Recorded or reviewed versions", labelZh: "已记录或已审核版本" },
      { key: "derivedVersions", label: "Derived Protocol versions", labelZh: "派生实验规程版本" },
      { key: "reportSourceReferences", label: "Report source references", labelZh: "报告来源引用" },
    ]),
  ];
}

export function protocolRequiresAssociationPreservingRecycle(counts: ProtocolDependencyCounts) {
  return counts.projects + counts.researchPlans + counts.experiments + counts.results + counts.derivedVersions + counts.reportSourceReferences > 0;
}

export type ExperimentDependencyCounts = {
  results: number;
  inventoryTransactions: number;
  sampleEvents: number;
  completedSteps: number;
  deviations: number;
  attachments: number;
  reportSourceReferences: number;
  entryReferences: number;
  proposedActions: number;
};

export function experimentDeleteBlockers(
  status: string,
  recordStatus: string,
  counts: ExperimentDependencyCounts,
) {
  const statusBlocker = stateBlocker("status", "Execution status", "执行状态", status, "planned");
  const recordBlocker = stateBlocker("recordStatus", "Record status", "记录状态", recordStatus, "draft");
  return [
    ...(statusBlocker ? [statusBlocker] : []),
    ...(recordBlocker ? [recordBlocker] : []),
    ...dependencyBlockers(counts, [
      { key: "results", label: "Results", labelZh: "结果" },
      { key: "inventoryTransactions", label: "Inventory transactions", labelZh: "库存操作" },
      { key: "sampleEvents", label: "Sample lifecycle events", labelZh: "样本生命周期事件" },
      { key: "completedSteps", label: "Completed steps", labelZh: "已完成步骤" },
      { key: "deviations", label: "Recorded deviations", labelZh: "偏差记录" },
      { key: "attachments", label: "Attachments", labelZh: "附件" },
      { key: "reportSourceReferences", label: "Report source references", labelZh: "报告来源引用" },
      { key: "entryReferences", label: "Entry references", labelZh: "实验记录引用" },
      { key: "proposedActions", label: "Proposed inventory actions", labelZh: "待处理库存操作" },
    ]),
  ];
}

export type ResultDependencyCounts = {
  datasets: number;
  attachments: number;
  reportSources: number;
  inboundLinks: number;
};

export function resultDeleteBlockers(recordStatus: string, counts: ResultDependencyCounts) {
  const state = stateBlocker("recordStatus", "Record status", "记录状态", recordStatus, "draft");
  return [
    ...(state ? [state] : []),
    ...dependencyBlockers(counts, [
      { key: "datasets", label: "Datasets", labelZh: "数据集" },
      { key: "attachments", label: "Attachments", labelZh: "附件" },
      { key: "reportSources", label: "Report uses", labelZh: "报告引用" },
      { key: "inboundLinks", label: "Inbound record links", labelZh: "入站记录链接" },
    ]),
  ];
}

export function resultRequiresAssociationPreservingRecycle(counts: ResultDependencyCounts) {
  return Object.values(counts).some((count) => count > 0);
}

export type ReportDependencyCounts = {
  externalReferences: number;
};

export function reportDeleteBlockers(status: string, counts: ReportDependencyCounts) {
  const state = stateBlocker("status", "Status", "状态", status, "draft");
  return [
    ...(state ? [state] : []),
    ...dependencyBlockers(counts, [
      { key: "externalReferences", label: "External record references", labelZh: "外部记录引用" },
    ]),
  ];
}

export type EntryDependencyCounts = {
  itemLinks: number;
  proposedActions: number;
  reportSourceReferences: number;
};

export function entryDeleteBlockers(recordStatus: string, counts: EntryDependencyCounts) {
  const state = stateBlocker("recordStatus", "Record status", "记录状态", recordStatus, "draft");
  return [
    ...(state ? [state] : []),
    ...dependencyBlockers(counts, [
      { key: "itemLinks", label: "Linked records", labelZh: "关联记录" },
      { key: "proposedActions", label: "Proposed actions", labelZh: "待处理操作" },
      { key: "reportSourceReferences", label: "Report source references", labelZh: "报告来源引用" },
    ]),
  ];
}
