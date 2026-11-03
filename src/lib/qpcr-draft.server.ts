import type { Prisma } from '@/generated/prisma/client';
/** Bind draft evidence inside the same transaction as its owning record save. */
export async function finalizeQpcrDraft(tx:Prisma.TransactionClient,draftId:string|undefined,ownerType:string,ownerId:string){
  if(!draftId)return;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${draftId}))`;
  const draft=await tx.qpcrWorkflowDraft.findUnique({where:{id:draftId}});
  if(!draft)return;
  if(draft.ownerType!==ownerType || draft.ownerId && draft.ownerId!==ownerId || draft.boundRecordId && draft.boundRecordId!==ownerId)throw new Error('草稿归属不匹配');
  await tx.qpcrWorkflowDraft.update({where:{id:draftId},data:{boundRecordId:ownerId,sessionsJson:{}}});
  await tx.attachmentLink.updateMany({where:{targetType:'qpcr_draft',targetId:draftId},data:{targetType:ownerType,targetId:ownerId}});
}
