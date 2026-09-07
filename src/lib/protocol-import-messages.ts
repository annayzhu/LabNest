import type { ProtocolImportIssue, StateDeclaration } from "./protocol-import-state";

/** Audit timestamps must render identically in a UTC container and any client timezone. */
export function formatProtocolImportTime(value: string | null, locale: "zh" | "en") {
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return locale === "zh" ? "未记录" : "Not recorded";
  return `${new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date)} UTC`;
}

export function protocolStateLabel(value: string, locale: "zh" | "en") {
  const labels: Record<string, [string, string]> = { draft: ["草稿", "Draft"], active: ["启用", "Active"], retired: ["已停用", "Retired"], archived: ["已归档", "Archived"], ready_for_review: ["待审核", "Ready for review"], reviewed: ["已审核", "Reviewed"] };
  return labels[value]?.[locale === "zh" ? 0 : 1] ?? value;
}
export function declarationLabel(state: StateDeclaration, locale: "zh" | "en") {
  if (state.status === "valid" && state.value) return protocolStateLabel(state.value, locale);
  if (state.status === "missing") return locale === "zh" ? "未声明" : "Not declared";
  return locale === "zh" ? `无法识别（${state.raw}）` : `Unrecognized (${state.raw})`;
}
export function protocolImportIssueText(issue: ProtocolImportIssue, locale: "zh" | "en", history = false) {
  if (issue.resolution === "legacy_unverified") return locale === "zh" ? "历史导入提示，处理情况待核对。" : "Historical import notice; resolution needs verification.";
  if (issue.code === "PROTOCOL_AVAILABILITY_MISMATCH") {
    if (history) return locale === "zh" ? "导入时发现状态不一致，已按草稿导入。" : "State declarations differed at import; imported as Draft.";
    return locale === "zh" ? "文件状态不一致" : "File state declarations differ";
  }
  const source = issue.source === "filename" ? (locale === "zh" ? "文件名" : "Filename") : (locale === "zh" ? "文档" : "Document");
  const field = issue.field === "reviewStage" ? (locale === "zh" ? "科学审核状态" : "scientific review state") : (locale === "zh" ? "可用状态" : "availability");
  if (issue.code === "PROTOCOL_STATE_MISSING") return locale === "zh" ? `${source}未声明${field}。` : `${source} does not declare ${field}.`;
  return locale === "zh" ? `${source}的${field}无法识别：${issue.rawValue}。` : `${source} has an unrecognized ${field}: ${issue.rawValue}.`;
}
