/** Read-only diagnosis. Never delete originals or merge attachments by filename/hash. */
import {prisma} from '../src/lib/db';
import {getEntryMarkdown,selectEntryAttachments} from '../src/lib/entry-content';
import {collectDocumentMedia,documentMediaAttachmentId} from '../src/lib/document-media';
import {writeFileSync,mkdirSync} from 'node:fs';
async function main(){
 const id=process.env.ENTRY_DIAG_ID;if(!id)throw new Error('Set ENTRY_DIAG_ID to the authorized record; no default record is selected.');
 const entry=await prisma.entry.findUniqueOrThrow({where:{id}});
 const links=await prisma.attachmentLink.findMany({where:{targetType:'entry',targetId:id},include:{attachment:true}});
 const markdown=getEntryMarkdown(entry.contentJson,entry.body),inline=collectDocumentMedia(markdown).map(documentMediaAttachmentId);
 const selected=selectEntryAttachments(entry.contentJson,links),active=new Set(selected.map(x=>x.id));
 const files=[...new Map(links.map(x=>[x.attachmentId,x.attachment])).values()].map(file=>({id:file.id,originalFilename:file.originalFilename,mimeType:file.mimeType,derivedFromId:file.derivedFromId,positions:inline.filter(x=>x===file.id).length,active:active.has(file.id),links:links.filter(x=>x.attachmentId===file.id).map(x=>({id:x.id,type:x.linkType})),provenance:'File and links verified; the historical user gesture is not inferred from the filename.'}));
 const historyOnly=files.filter(x=>!x.active&&x.links.some(l=>l.type==='document_media_history'));
 const plan={mode:'read-only',entryId:id,version:entry.updatedAt.toISOString(),activeCount:selected.length,files,optionalReclassification:historyOnly.flatMap(f=>f.links.filter(l=>l.type==='entry_content').map(l=>({linkId:l.id,attachmentId:f.id,from:'entry_content',to:'document_media_history',rollback:'Restore this linkType only; preserve every file and all other links.'}))),repair:'The current-original projection fixes display without any historical write. Optional link reclassification is not applied.'};
 mkdirSync('.local-runtime/entry-richtext',{recursive:true});writeFileSync('.local-runtime/entry-richtext/attachment-diagnosis.json',JSON.stringify(plan,null,2));
 console.log(JSON.stringify({mode:plan.mode,activeCount:plan.activeCount,originalRows:files.length,historyOnly:historyOnly.length,proposedLinks:plan.optionalReclassification.length}));
}
main().finally(()=>prisma.$disconnect());
