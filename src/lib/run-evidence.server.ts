import { prisma } from './db';
import { collectDocumentMedia } from './document-media';
import type { ScientificContentBlock } from './scientific-document';
/** Read only explicitly step-linked evidence, never distribute experiment-wide files to every step. */
export async function stepsWithExecutionEvidence<T extends {id:string}>(steps:T[]) {
  if(!steps.length)return steps.map(step=>({...step,evidence:[] as ScientificContentBlock[]}));
  const ids=steps.map(step=>step.id);
  const [links,entries,results]=await Promise.all([
    prisma.attachmentLink.findMany({where:{targetType:'experiment_step',targetId:{in:ids}},include:{attachment:true},orderBy:[{order:'asc'},{createdAt:'asc'}]}),
    prisma.entry.findMany({where:{experimentStepId:{in:ids}},orderBy:{occurredAt:'asc'}}),
    prisma.result.findMany({where:{experimentStepId:{in:ids}},orderBy:{createdAt:'asc'}}),
  ]);
  return steps.map(step=>{
    const evidence:ScientificContentBlock[]=[];
    for(const entry of entries.filter(e=>e.experimentStepId===step.id)) {
      evidence.push({id:`entry:${entry.id}`,type:'text',text:`观察记录：${entry.title}\n${entry.body}`});
      evidence.push(...collectDocumentMedia(entry.contentJson));
    }
    for(const result of results.filter(r=>r.experimentStepId===step.id)) {
      if(result.numericValue!==null)evidence.push({id:`result:${result.id}`,type:'metric',label:result.title,value:String(result.numericValue),unit:result.unit??undefined});
      else evidence.push({id:`result:${result.id}`,type:'text',text:`结果记录：${result.title}\n${result.textValue??result.notes??'未填写结果值'}`});
      evidence.push(...collectDocumentMedia(result.contentJson));
    }
    for(const link of links.filter(l=>l.targetId===step.id))evidence.push({id:`attachment:${link.attachment.id}`,type:'media',mediaType:link.attachment.mimeType.startsWith('image/')?'image':'file',url:`/api/attachments/${link.attachment.id}`,attachmentId:link.attachment.id,filename:link.attachment.originalFilename,caption:link.attachment.originalFilename});
    return {...step,evidence};
  });
}
