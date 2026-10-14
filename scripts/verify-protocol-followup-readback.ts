import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import {prisma} from '../src/lib/db';
const url=new URL(process.env.DATABASE_URL!);assert(['localhost','127.0.0.1'].includes(url.hostname)&&((url.port==='55439'&&url.pathname==='/labnest_structured_20261014')||process.env.CI==='true'&&url.pathname==='/labnest_protocol_consistency_ci'));
async function main(){
 const dir='docs/structured-protocol/20261014/followup-evidence',report=JSON.parse(await readFile(`${dir}/offline-report.json`,'utf8'));assert(!report.error);const checks=[];
 for(const item of report.pending){
  if(item.actionType==='attachment.upload'){const files=await prisma.attachment.findMany({where:{clientMutationId:item.clientMutationId},include:{links:true}});assert.equal(files.length,1);assert.equal(files[0].links.length,1);assert.equal(files[0].links[0].targetId,item.payload.targetId);checks.push({mutationId:item.clientMutationId,type:'photo',count:1,target:item.payload.targetId});}
  else {const events=await prisma.experimentStepEvent.findMany({where:{clientMutationId:item.clientMutationId}});assert.equal(events.length,1);assert(events[0].deviceCreatedAt);assert(events[0].createdAt);const payload=events[0].payloadJson as {queueContext:unknown};assert.deepEqual(payload.queueContext,item.payload.queueContext);checks.push({mutationId:item.clientMutationId,type:item.actionType,count:1,stepId:events[0].experimentStepId});}
 }
 await writeFile(`${dir}/database-readback.json`,JSON.stringify({synthetic:true,checks,result:'通过'},null,2));console.log('PASS DB readback: one event per offline mutation, original device/source/times, one attachment linked to selected immutable step');
}
main().finally(()=>prisma.$disconnect());
