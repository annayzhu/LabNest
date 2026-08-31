import Link from "next/link";
import { FileText, Layers3 } from "lucide-react";
import { StatusPill } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { existingResultHref, type ExperimentResultRecording } from "@/lib/experiment-results";

const secondaryButton = buttonStyles({ size: "sm", className: "h-9 bg-surface font-medium text-moss hover:bg-warm" });
const primaryButton = buttonStyles({ variant: "primary", size: "sm", className: "h-9 font-medium" });

export function ExperimentResultRecordingCard({ experimentId, recording }: {
  experimentId: string;
  recording: ExperimentResultRecording;
}) {
  const reportHref = recording.report
    ? existingResultHref(recording.report)
    : `/results/new?experiment=${encodeURIComponent(experimentId)}&report=1`;
  const legacyCount = recording.legacyTemplateResults.length + recording.additionalResults.length;

  return <div id="result-recording" className="scroll-mt-24">
    <Card>
      <CardHeader title="实验结果" />
      <CardBody className="space-y-3">
        <div className="flex flex-col gap-3 rounded-[9px] border border-hairline bg-warm/55 p-3 sm:flex-row sm:items-center">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-action-surface text-moss"><FileText className="h-4 w-4" aria-hidden /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-ink">Result</p>
              {recording.report ? <><StatusPill status={recording.report.recordStatus} /><StatusPill status={recording.report.validationStatus} /></> : null}
            </div>
            <p className="mt-0.5 text-xs leading-5 text-muted">一个实验一份结果。可从 {recording.modules.length} 个预设模块中选择内容，相同结果字段自动合并。</p>
          </div>
          <Link href={reportHref} className={`${recording.report ? secondaryButton : primaryButton} w-full sm:w-auto`}>
            {recording.report ? "继续填写" : "填写结果"}
          </Link>
        </div>

        {recording.modules.length ? <details className="rounded-[8px] border border-hairline bg-surface">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-medium text-graphite marker:hidden">
            <Layers3 className="h-3.5 w-3.5 text-muted" aria-hidden />结果模块
            <span className="ml-auto text-muted">{recording.modules.length}</span>
          </summary>
          <ul className="grid gap-1 border-t border-hairline px-3 py-2 sm:grid-cols-2">{recording.modules.map((module) => <li key={module.id} className="min-w-0 truncate text-xs text-muted" title={`${module.template.title} · ${module.protocolLabel}`}><span className="font-medium text-graphite">{module.template.title}</span> · {module.protocolLabel}</li>)}</ul>
        </details> : null}

        {legacyCount ? <details className="rounded-[8px] border border-hairline bg-surface">
          <summary className="cursor-pointer px-3 py-2.5 text-xs font-medium text-muted">历史独立结果 {legacyCount}</summary>
          <ul className="space-y-1 border-t border-hairline px-3 py-2">{[...recording.legacyTemplateResults, ...recording.additionalResults].map((result) => <li key={result.id}><Link href={existingResultHref(result)} className="text-xs text-moss hover:underline">{result.title}</Link></li>)}</ul>
        </details> : null}
      </CardBody>
    </Card>
  </div>;
}
