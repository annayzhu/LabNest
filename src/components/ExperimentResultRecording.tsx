import Link from "next/link";
import { Layers3 } from "lucide-react";
import { StatusPill } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { existingResultHref, type ExperimentResultRecording } from "@/lib/experiment-results";

const secondaryButton = buttonStyles({ size: "sm", className: "h-8 bg-surface px-2.5 font-medium text-moss hover:bg-warm" });

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
      <CardHeader className="min-h-10 px-3 py-2" title="Experiment results" action={<div className="flex items-center gap-1.5">{recording.report ? <div className="hidden gap-1 min-[360px]:flex"><StatusPill status={recording.report.recordStatus} /><StatusPill status={recording.report.validationStatus} /></div> : null}<Link href={reportHref} className={`${secondaryButton} shrink-0`}>{recording.report ? "Continue result" : "Fill result"}</Link></div>} />
      <CardBody className="p-0">
        {recording.modules.length ? <details className="border-t border-hairline bg-surface">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-medium text-graphite marker:hidden">
            <Layers3 className="h-3.5 w-3.5 text-muted" aria-hidden />Result modules
            <span className="ml-auto text-muted">{recording.modules.length}</span>
          </summary>
          <ul className="divide-y divide-hairline border-t border-hairline px-3">{recording.modules.map((module) => <li key={module.id} className="min-w-0 py-2"><p className="break-words text-xs font-medium leading-5 text-graphite">{module.template.title}</p><p className="mt-0.5 break-words text-xs leading-4 text-muted">{module.protocolTitle}<span className="record-identifier ml-1 text-xs">{module.protocolCode ? `· ${module.protocolCode} ` : ""}· v{module.displayVersion}</span></p></li>)}</ul>
        </details> : null}

        {legacyCount ? <details className="border-t border-hairline bg-surface">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted">Legacy standalone results <span className="ml-1">{legacyCount}</span></summary>
          <ul className="space-y-1 border-t border-hairline px-3 py-2">{[...recording.legacyTemplateResults, ...recording.additionalResults].map((result) => <li key={result.id}><Link href={existingResultHref(result)} className="text-xs text-moss hover:underline">{result.title}</Link></li>)}</ul>
        </details> : null}
      </CardBody>
    </Card>
  </div>;
}
