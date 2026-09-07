"use client";

import { useI18n } from "./I18nProvider";
import { declarationLabel, protocolImportIssueText } from "@/lib/protocol-import-messages";
import type { ProtocolImportDecision } from "@/lib/protocol-import-state";

export function ProtocolImportDecisionNotice({ decision }: { decision: ProtocolImportDecision }) {
  const { locale } = useI18n();
  const zh = locale === "zh";
  const mismatch = decision.issues.some((issue) => issue.code === "PROTOCOL_AVAILABILITY_MISMATCH");
  return <section data-i18n-ignore data-protocol-import-decision className="space-y-2 border-y border-hairline py-3 text-sm">
    <h4 className="font-semibold text-ink">{mismatch ? (zh ? "文件状态不一致" : "File state declarations differ") : (zh ? "导入状态确认" : "Confirm import states")}</h4>
    <dl className="grid gap-2 sm:grid-cols-3">
      <div><dt className="text-muted">{zh ? "文件名可用状态" : "Filename availability"}</dt><dd>{declarationLabel(decision.filenameAvailability, locale)}</dd></div>
      <div><dt className="text-muted">{zh ? "文档内可用状态" : "Document availability"}</dt><dd>{declarationLabel(decision.documentAvailability, locale)}</dd></div>
      <div><dt className="text-muted">{zh ? "本次将导入为" : "Will be imported as"}</dt><dd className="font-semibold text-ink">{zh ? "草稿" : "Draft"}</dd></div>
    </dl>
    <p>{zh ? "科学审核状态：文档声明为" : "Scientific review: document declares "}{declarationLabel(decision.documentReviewStage, locale)}{zh ? "；本次导入为草稿。" : "; imported as Draft."}</p>
    {decision.issues.filter((issue) => issue.code !== "PROTOCOL_AVAILABILITY_MISMATCH").map((issue, index) => <p key={index} className="text-warning">{protocolImportIssueText(issue, locale)}</p>)}
    <p className="text-muted">{zh ? "正文不受状态处理影响。所有入口均按草稿导入；启用及科学审核请在导入后按现有流程操作。" : "State handling does not change the body. All entry points import as Draft; activate and review after import using the existing workflow."}</p>
  </section>;
}
