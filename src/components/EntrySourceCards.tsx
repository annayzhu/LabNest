import Link from "next/link";
import { DocumentCanvas } from "./DocumentCanvas";
import { EntryContentView } from "./EntryContentView";
import { getEntrySources } from "@/lib/entry-assignment.server";
import { collectDocumentMedia, documentMediaAttachmentId } from "@/lib/document-media";

export async function EntrySourceCards({type,id,locked}:{type:"experiment"|"result";id:string;locked:boolean}) {
 const data=await getEntrySources(type,id,locked);
 if(!data.sources.length&&!data.legacy)return null;
 return <DocumentCanvas label="来源快速记录"><section aria-label="来源快速记录" className="space-y-3"><h2 className="text-lg font-semibold text-ink">来源快速记录{data.frozen?" · 已冻结版本":""}</h2>
  {data.legacy?<p role="status" className="text-sm text-warning">历史锁定记录未保存来源版本，请核对原始记录；不以当前正文冒充审核时的内容。</p>:null}
  {data.sources.map(source=>{const inline=new Set(collectDocumentMedia(source.markdown).map(documentMediaAttachmentId));return <article key={source.id} className="rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-4">
   <h3 className="font-semibold">{source.title}</h3><p className="mt-1 text-xs text-muted">记录于 <time dateTime={source.createdAt}>{new Date(source.createdAt).toLocaleString("zh-CN",{timeZone:process.env.TZ||"Asia/Shanghai"})}</time> · 作者：{source.author??"未记录"} · 修改于 {new Date(source.updatedAt).toLocaleString("zh-CN",{timeZone:process.env.TZ||"Asia/Shanghai"})}</p>
   <p className="text-xs text-muted">实验／观察时间：{source.eventTimePrecision === "datetime" ? new Date(source.occurredAt).toLocaleString("zh-CN", {timeZone:process.env.TZ||"Asia/Shanghai"}) : source.eventTimePrecision === "date" ? source.occurredAt.slice(0,10) + "（仅日期）" : "未记录"}</p>
   <div className="mt-3"><EntryContentView markdown={source.markdown} /></div>
   {source.attachments.filter(a=>!inline.has(a.id)).map(a=><a key={a.id} className="mt-2 block text-moss underline" href={`/api/attachments/${a.id}`}>{a.originalFilename}</a>)}
   <div className="mt-3 flex gap-4 text-sm" data-print-hidden><Link href={`/entries/${source.id}`} className="text-moss underline">查看原始记录</Link>{!data.frozen?<Link href={`/entries/${source.id}/edit`} className="text-moss underline">编辑原始记录</Link>:null}</div>
  </article>})}
 </section></DocumentCanvas>;
}
