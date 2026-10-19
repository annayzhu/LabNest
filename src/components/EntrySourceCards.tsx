import Link from "next/link";
import { ProtocolMediaImage } from "./ProtocolMediaImage";
import { DocumentCanvas } from "./DocumentCanvas";
import { EntryContentView } from "./EntryContentView";
import { getEntrySources } from "@/lib/entry-assignment.server";
import { collectDocumentMedia, documentMediaAttachmentId } from "@/lib/document-media";

export async function EntrySourceCards({type,id,locked}:{type:"experiment"|"result";id:string;locked:boolean}) {
 const data=await getEntrySources(type,id,locked);
 if(!data.sources.length&&!data.legacy)return null;
 return <DocumentCanvas label="Source entries"><section aria-label="Source entries" className="space-y-3"><h2 className="text-lg font-semibold text-ink">{data.frozen?"Source entries · frozen version":"Source entries"}</h2>
  {data.legacy?<p role="status" className="text-sm text-warning">This locked record from before source versions were kept has no saved source version. Check the original entries; the current text is not shown as what was reviewed.</p>:null}
  {data.sources.map(source=>{const inline=new Set(collectDocumentMedia(source.markdown).map(documentMediaAttachmentId));return <article key={source.id} className="rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-4">
   <h3 className="font-semibold">{source.title}</h3><p className="mt-1 text-xs text-muted">{`Recorded ${new Date(source.createdAt).toLocaleString("zh-CN",{timeZone:process.env.TZ||"Asia/Shanghai"})} · Author: ${source.author??"not recorded"} · Modified ${new Date(source.updatedAt).toLocaleString("zh-CN",{timeZone:process.env.TZ||"Asia/Shanghai"})}`}</p>
   <p className="text-xs text-muted">{`Experiment / observation time: ${source.eventTimePrecision === "datetime" ? new Date(source.occurredAt).toLocaleString("zh-CN", {timeZone:process.env.TZ||"Asia/Shanghai"}) : source.eventTimePrecision === "date" ? `${source.occurredAt.slice(0,10)} (date only)` : "not recorded"}`}</p>
   <div className="mt-3"><EntryContentView markdown={source.markdown} /></div>
   {source.attachments.filter(a=>!inline.has(a.id)).map(a=>a.mimeType.startsWith("image/") ? <figure key={a.id} className="mt-3"><ProtocolMediaImage href={`/api/attachments/${a.id}?inline=1`} label={a.originalFilename} /><figcaption className="text-sm text-muted">{a.originalFilename}</figcaption></figure> : <a key={a.id} className="mt-2 block text-moss underline" href={`/api/attachments/${a.id}`}>{a.originalFilename}</a>)}
   <div className="mt-3 flex gap-4 text-sm" data-print-hidden><Link href={`/entries/${source.id}`} className="text-moss underline">View the original entry</Link>{!data.frozen?<Link href={`/entries/${source.id}/edit`} className="text-moss underline">Edit the original entry</Link>:null}</div>
  </article>})}
 </section></DocumentCanvas>;
}
