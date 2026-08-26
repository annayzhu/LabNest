import Link from "next/link";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { buttonStyles } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import {
  existingResultHref,
  isSingleResultTemplate,
  newTemplateResultHref,
  type ExperimentResultRecording,
} from "@/lib/experiment-results";

const secondaryButton = buttonStyles({ size: "sm", className: "h-auto min-h-9 bg-surface py-2 font-medium text-moss hover:bg-warm" });
const primaryButton = buttonStyles({ variant: "primary", size: "sm", className: "h-auto min-h-9 py-2 font-medium" });

export function ExperimentResultRecordingCard({ experimentId, recording }: {
  experimentId: string;
  recording: ExperimentResultRecording;
}) {
  return <div id="result-recording" className="scroll-mt-24">
    <Card>
      <CardHeader title="Result recording" action={<Link href={`/results/new?experiment=${encodeURIComponent(experimentId)}&manual=1`} className={secondaryButton}>Add other result</Link>} />
      <CardBody className="space-y-4">
        {recording.slots.length ? <>
          <p className="text-xs leading-5 text-muted">Protocol templates are the primary result records for this Experiment. Continue an existing draft instead of creating a separate manual Result.</p>
          <div className="space-y-3">{recording.slots.map((slot) => {
            const repeatable = !isSingleResultTemplate(slot.template);
            return <section key={`${slot.protocolVersionId}-${slot.template.templateKey}`} className="rounded-[9px] border border-hairline bg-warm/55 p-3">
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-ink">{slot.template.title ?? slot.template.result_type}</p>
                <p className="mt-1 text-xs text-muted">{slot.protocolLabel} · v{slot.displayVersion}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{slot.template.fields.length} fields · {slot.template.datasets?.length ?? 0} tables · {slot.template.artifacts?.length ?? 0} files</p>
              </div>
              {slot.records.length ? <ul className="mt-3 space-y-2 border-t border-hairline pt-3">{slot.records.map((result) => {
                const editable = result.status !== "archived" && ["draft", "recorded"].includes(result.recordStatus);
                return <li key={result.id} className="rounded-[8px] bg-surface p-2.5">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5"><StatusPill status={result.recordStatus} /><StatusPill status={result.validationStatus} /></div>
                  <p className="mt-2 break-words text-xs leading-5 text-graphite">{result.title}</p>
                  <Link href={existingResultHref(result)} className={`${editable ? primaryButton : secondaryButton} mt-2 w-full`}>{editable ? "Fill result" : "View result"}</Link>
                </li>;
              })}</ul> : <Link href={newTemplateResultHref(experimentId, slot)} className={`${primaryButton} mt-3 w-full`}>Create and fill result</Link>}
              {repeatable ? <Link href={newTemplateResultHref(experimentId, slot)} className={`${secondaryButton} mt-2 w-full`}>Add another template record</Link> : null}
            </section>;
          })}</div>
        </> : <p className="text-sm leading-6 text-muted">This Experiment has no locked Result Template. Use an additional Result only when evidence still needs to be recorded.</p>}

        {recording.additionalResults.length ? <div className="border-t border-hairline pt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Other results</p>
          <ul className="mt-2 space-y-2">{recording.additionalResults.map((result) => <li key={result.id} className="rounded-[8px] border border-hairline bg-surface p-2.5"><div className="flex flex-wrap items-center gap-1.5"><Badge>{result.resultType}</Badge><StatusPill status={result.recordStatus} /></div><Link href={existingResultHref(result)} className="mt-2 block break-words text-sm font-medium text-moss hover:underline">{result.title}</Link></li>)}</ul>
        </div> : null}
      </CardBody>
    </Card>
  </div>;
}
