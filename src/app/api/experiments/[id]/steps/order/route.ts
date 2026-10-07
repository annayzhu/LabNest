import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {prisma} from '@/lib/db';
import {assertDocumentSaveVersion} from '@/lib/document-save-version';
import {experimentStepOrder} from '@/lib/experiment-step-order';
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}) {
 const origin=request.headers.get('origin');
 if(origin && origin!==new URL(request.url).origin)return Response.json({error:'Origin mismatch'},{status:403});
 try {
  const {id}=await params;
  const input=z.object({ids:z.array(z.string().min(1)),expectedUpdatedAt:z.string().datetime()}).parse(await request.json());
  const orders=await prisma.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM "Experiment" WHERE id=${id} FOR UPDATE`;
   const experiment=await tx.experiment.findUniqueOrThrow({where:{id},include:{steps:{orderBy:[{groupOrder:'asc'},{order:'asc'}]}}});
   if(experiment.status!=='planned'||experiment.recordStatus!=='draft'||experiment.steps.some(step=>step.completed||step.completedAt||step.timerStartedAt))throw new Error('Only a Draft Experiment that has not started can reorder its saved steps.');
   const form=new FormData();form.set("expectedUpdatedAt",input.expectedUpdatedAt);
   assertDocumentSaveVersion(form,experiment);
   const orders=experimentStepOrder(experiment.steps,input.ids);
   for(const order of orders)await tx.experimentStep.update({where:{id:order.id},data:{order:order.order}});
   await tx.experiment.update({where:{id},data:{updatedAt:new Date()}});
   await tx.activityLog.create({data:{action:'reorder_steps',targetType:'experiment',targetId:id,metadataJson:{before:experiment.steps.map(step=>step.id),after:input.ids}}});
   return orders;
  });
  revalidatePath(`/experiments/${id}`);revalidatePath(`/experiments/${id}/run`);
  return Response.json({orders});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Step order could not be saved.'},{status:409});}
}
