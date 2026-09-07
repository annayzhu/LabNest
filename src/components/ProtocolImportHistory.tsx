"use client";

import { useI18n } from "./I18nProvider";
import type { ProtocolImportHistoryEntry } from "@/lib/protocol-import-history";
import { declarationLabel, formatProtocolImportTime, protocolImportIssueText } from "@/lib/protocol-import-messages";

export function ProtocolImportHistory({ entries }: { entries: ProtocolImportHistoryEntry[] }) {
  const { locale } = useI18n();
  const zh = locale === "zh";
  if (!entries.length) return null;
  return <details data-i18n-ignore data-protocol-import-history className="min-w-0 border-t border-hairline px-[var(--ln-wysiwyg-properties-padding-x)] py-3 text-sm">
    <summary className="focus-ring cursor-pointer font-medium text-ink">{zh ? "导入历史" : "Import history"} · {entries.length}</summary>
    <div className="mt-3 space-y-4">
      {entries.map((entry) => <section key={entry.id} className="min-w-0 space-y-2">
        <p className="break-words font-medium">{entry.sourceAttachmentId ? <a className="focus-ring text-moss underline underline-offset-2" href={`/api/attachments/${entry.sourceAttachmentId}`}>{entry.sourceFileName}</a> : entry.sourceFileName ?? (zh ? "来源文件未记录" : "Source filename not recorded")}</p>
        {!entry.decision ? <p>{zh ? "历史导入提示，处理情况待核对。" : "Historical import notice; resolution needs verification."}</p> : <>
          {entry.issues.length ? entry.issues.map((issue, index) => <p key={index}>{protocolImportIssueText(issue, locale, true)}</p>) : null}
          <p>{zh ? "当时导入为：草稿；科学审核：草稿。" : "Imported as Draft; scientific review: Draft."}</p>
          <p className="text-muted">{zh ? "文件名：" : "Filename: "}{declarationLabel(entry.decision.filenameAvailability, locale)}{zh ? "；文档：" : "; document: "}{declarationLabel(entry.decision.documentAvailability, locale)}</p>
          <p className="text-muted">{zh ? "文档声明的科学审核状态：" : "Declared scientific review: "}{declarationLabel(entry.decision.documentReviewStage, locale)}</p>
        </>}
        <dl className="grid gap-x-3 gap-y-1 text-xs sm:grid-cols-[auto_minmax(0,1fr)]">
          <dt className="text-muted">{zh ? "导入时间" : "Imported at"}</dt><dd>{formatProtocolImportTime(entry.importedAt, locale)}</dd>
          <dt className="text-muted">{zh ? "操作人" : "Actor"}</dt><dd>{entry.actorUserId ?? (zh ? "未识别操作人（当时未记录登录身份）" : "Unidentified (no authenticated identity recorded)")}</dd>
          <dt className="text-muted">{zh ? "目标版本" : "Target version"}</dt><dd className="break-all">{entry.protocolVersionId}</dd>
          <dt className="text-muted">SHA-256</dt><dd className="break-all">{entry.sourceFileChecksum ?? (zh ? "未记录" : "Not recorded")}</dd>
        </dl>
        {entry.issues.some((issue) => issue.originalText) ? <details><summary className="focus-ring cursor-pointer text-xs text-muted">{zh ? "原始提示" : "Original notice"}</summary>{entry.issues.filter((issue) => issue.originalText).map((issue, index) => <p key={index} className="mt-1 break-words text-xs">{issue.originalText}</p>)}</details> : null}
      </section>)}
    </div>
  </details>;
}
