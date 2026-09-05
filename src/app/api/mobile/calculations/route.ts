import {isDeepStrictEqual} from "node:util";
import {z} from 'zod';
import type {Prisma} from '@/generated/prisma/client';
import {prisma} from '@/lib/db';
import {calculate} from '@/lib/calculators/calculator-engine';
const schema=z.object({clientMutationId:z.string().uuid(),deviceCreatedAt:z.coerce.date(),experimentId:z.string().min(1),experimentStepId:z.string().min(1),operator:z.string().trim().min(1).max(160),calculatorId:z.string(),inputs:z.record(z.string(),z.unknown()),snapshot:z.object({methodVersion:z.string(),outputs:z.array(z.unknown()),table:z.array(z.unknown()).optional()}).passthrough()});
const json=(value:unknown)=>value as Prisma.InputJsonValue;
export async function POST(request:Request) {
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Origin not allowed'}, {status:403});
  try {
    const input=schema.parse(await request.json());
    const step=await prisma.experimentStep.findFirst({where:{id:input.experimentStepId,experimentId:input.experimentId},include:{experiment:{select:{projectId:true,researchPlanId:true,status:true}}}});
    if(!step||step.experiment.status==='archived')return Response.json({error:'实验或步骤不可写入 / Experiment or step is unavailable'}, {status:409});
    const existing=await prisma.result.findUnique({where:{clientMutationId:input.clientMutationId}});
    if(existing) return existing.experimentId===input.experimentId&&existing.experimentStepId===step.id&&isDeepStrictEqual(existing.valuesJson,input.snapshot)?Response.json({resultId:existing.id,replay:true}):Response.json({error:'Mutation context or snapshot mismatch'}, {status:409});
    const computed=calculate({calculatorId:input.calculatorId,inputs:input.inputs});
    if(computed.methodVersion!==input.snapshot.methodVersion||JSON.stringify(computed.outputs)!==JSON.stringify(input.snapshot.outputs)||JSON.stringify(computed.table)!==JSON.stringify(input.snapshot.table))return Response.json({error:'方法版本或结果不一致，请重新确认 / Method or snapshot mismatch; review before saving'}, {status:409});
    const result=await prisma.$transaction(async tx=>{
      const created=await tx.result.create({data:{experimentId:input.experimentId,experimentStepId:step.id,projectId:step.experiment.projectId,researchPlanId:step.experiment.researchPlanId,title:`${step.title} · ${input.calculatorId}`,resultType:'Calculation',analysisMethod:computed.methodVersion,recordStatus:'recorded',sourceType:'manual',validationStatus:'valid',valuesJson:json(computed),contentJson:json({inputs:input.inputs,snapshot:computed}),provenanceJson:json({operator:input.operator,operatorSource:'user-entered',deviceCreatedAt:input.deviceCreatedAt.toISOString(),calculatorId:input.calculatorId}),clientMutationId:input.clientMutationId,deviceCreatedAt:input.deviceCreatedAt}});
      await tx.experimentStepEvent.create({data:{experimentId:input.experimentId,experimentStepId:step.id,eventType:'calculation',clientMutationId:input.clientMutationId,deviceCreatedAt:input.deviceCreatedAt,payloadJson:json({resultId:created.id,methodVersion:computed.methodVersion,operator:input.operator})}});
      await tx.activityLog.create({data:{action:'create_calculation',targetType:'result',targetId:created.id,metadataJson:json({experimentId:input.experimentId,experimentStepId:step.id,operator:input.operator,clientMutationId:input.clientMutationId})}});
      return created;
    });
    return Response.json({resultId:result.id},{status:201});
  }catch(error){
    if(error&&typeof error==='object'&&'code' in error&&error.code==='P2002')return Response.json({error:'并发重放，请重试相同记录 / Concurrent replay; retry same record'}, {status:503});
    return Response.json({error:error instanceof Error?error.message:'Calculation could not be saved'},{status:400});
  }
}
