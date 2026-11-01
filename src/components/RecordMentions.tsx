import Link from "next/link";
import { format } from "date-fns";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { RecordMention } from "@/lib/record-mentions.server";

const kindLabels: Record<RecordMention["kind"], string> = { entry: "Entry", experiment: "Experiment", result: "Result", research_plan: "Research Plan", report: "Report" };

/** "记录中提到" (Q253): the records whose text names a sample, product or lot, newest first. */
export function RecordMentionList({ mentions }: { mentions: RecordMention[] }) {
  return mentions.length ? <ul className="divide-y divide-hairline text-sm">
    {mentions.map((mention) => <li key={`${mention.kind}:${mention.id}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-1.5">
      <span className="text-xs text-muted">{kindLabels[mention.kind]}</span>
      <Link href={mention.href} className="min-w-0 text-moss hover:underline">{mention.code ? <span className="record-identifier">{mention.code} </span> : null}<span data-i18n-ignore>{mention.title}</span></Link>
      {mention.archived ? <span className="text-xs text-muted">Archived</span> : null}
      <time className="ml-auto font-mono text-xs text-muted" dateTime={mention.at.toISOString()}>{format(mention.at, "yyyy-MM-dd")}</time>
    </li>)}
  </ul> : <p className="text-xs text-muted">No record mentions this yet.</p>;
}

/** The sample page's card of the same list. */
export function RecordMentions({ mentions }: { mentions: RecordMention[] }) {
  return <Card>
    <CardHeader title="Mentioned in records" />
    <CardBody><RecordMentionList mentions={mentions} /></CardBody>
  </Card>;
}
