import Link from "next/link";
import { Layers3 } from "lucide-react";
import { StatusPill } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { existingResultHref, type ExperimentResultRecording } from "@/lib/experiment-results";

const secondaryButton = buttonStyles({ size: "sm", className: "h-8 bg-surface px-2.5 font-medium text-moss hover:bg-warm" });
const primaryButton = buttonStyles({ variant: "primary", size: "sm", className: "h-8 px-2.5 font-medium" });

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
      <CardHeader className="min-h-10 px-3 py-2" title="实验结果" action={<div className="flex items-center gap-1.5">{recording.report ? <div className="hidden gap-1 min-[360px]:flex"><StatusPill status={recording.report.recordStatus} /><StatusPill status={recording.report.validationStatus} /></div> : null}<Link href={reportHref} className={`${recording.report ? secondaryButton : primaryButton} shrink-0`}>{recording.report ? "继续填写" : "填写结果"}</Link></div>} />
      <CardBody className="p-0">
        {recording.modules.length ? <details className="border-t border-hairline bg-surface">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-medium text-graphite marker:hidden">
            <Layers3 className="h-3.5 w-3.5 text-muted" aria-hidden />结果模块
            <span className="ml-auto text-muted">{recording.modules.length}</span>
          </summary>
          <ul className="divide-y divide-hairline border-t border-hairline px-3">{recording.modules.map((module) => <li key={module.id} className="min-w-0 py-2"><p className="break-words text-xs font-medium leading-5 text-graphite">{module.template.title}</p><p className="mt-0.5 break-words text-[11px] leading-4 text-muted">{module.protocolTitle}<span className="ml-1 font-mono text-[10px]">{module.protocolCode ? `· ${module.protocolCode} ` : ""}· v{module.displayVersion}</span></p></li>)}</ul>
        </details> : null}

        {legacyCount ? <details className="border-t border-hairline bg-surface">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted">历史独立结果 {legacyCount}</summary>
          <ul className="space-y-1 border-t border-hairline px-3 py-2">{[...recording.legacyTemplateResults, ...recording.additionalResults].map((result) => <li key={result.id}><Link href={existingResultHref(result)} className="text-xs text-moss hover:underline">{result.title}</Link></li>)}</ul>
        </details> : null}
      </CardBody>
    </Card>
  </div>;
}
