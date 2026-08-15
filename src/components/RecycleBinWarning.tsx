"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";

export function RecycleBinWarning({
  kind = "linked",
  label,
  labelZh,
}: {
  kind?: "self" | "linked";
  label: string;
  labelZh: string;
}) {
  const { locale } = useI18n();
  const self = kind === "self";

  return (
    <div className="flex items-start gap-3 rounded-[9px] border border-warning/35 bg-warning-surface px-4 py-3 text-sm text-graphite">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold text-warning">
          {locale === "zh"
            ? self ? `该${labelZh}已移入回收站` : `关联的${labelZh}已移入回收站`
            : self ? `This ${label} is in the Recycle Bin` : `A linked ${label} is in the Recycle Bin`}
        </p>
        <p className="mt-1 leading-6">
          {locale === "zh"
            ? "科研关联与来源记录仍被保留；恢复该记录后即可重新作为正常数据使用。"
            : "Scientific associations and provenance remain intact. Restore the record to make it available normally again."}{" "}
          <Link href="/trash" className="font-medium text-moss hover:underline">
            {locale === "zh" ? "打开回收站" : "Open Recycle Bin"}
          </Link>
        </p>
      </div>
    </div>
  );
}
