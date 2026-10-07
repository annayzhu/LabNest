import 'dotenv/config';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import type {Prisma} from '../src/generated/prisma/client';
import {prisma} from '../src/lib/db';
import {copyExperiment} from '../src/lib/experiment-copy';
import {createExperimentWithProtocolSnapshot} from '../src/lib/experiments';
import {executionFragments} from '../src/lib/protocol-execution';
import {protocolDocumentSchema} from '../src/lib/protocol-document';

const output=process.env.LABNEST_QA_DIR??'docs/qa/protocol-consistency-20261007/evidence';
assert(new URL(process.env.DATABASE_URL!).pathname.includes('protocol_consistency'),'Persistence acceptance requires the isolated database.');
const fixture=JSON.parse(readFileSync(output+'/fixtures.json','utf8'));
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function read(id:string){return prisma.experiment.findUniqueOrThrow({where:{id},include:{steps:{orderBy:{order:'asc'}},protocolRun:true}});}
async function main(){
 const original=await read(fixture.idempotentExperimentId),originalHash=hash(original);
 const copy=await copyExperiment(original.id,{clientMutationId:randomUUID()}),record=await read(copy.id);
 assert(record.steps.every(step=>!original.steps.some(old=>old.id===step.id)&&!step.completed&&!step.completedAt&&!step.deviationNote&&!step.timerStartedAt));
 assert.deepEqual(record.protocolSnapshotJson,original.protocolSnapshotJson);
 const snapshot=record.protocolSnapshotJson as {versions:Array<{protocolVersionId:string;contentJson:unknown}>};
 const version=snapshot.versions[0],document=protocolDocumentSchema.parse(version.contentJson);
 const decisions=Object.fromEntries(executionFragments(document).map(block=>[block.id,block.execution]));
 const mapping:Record<string,string>={},keepers:Record<string,string>={};
 for(const step of record.steps){const ref=step.protocolStepRef!.slice(version.protocolVersionId.length+1);mapping[step.id]=ref;keepers[ref]=step.id;}
 // Simulate the reported bad projection, only on a new synthetic copy: an
 // operation body and an information paragraph were wrongly persisted as steps.
 const extraBody=await prisma.experimentStep.create({data:{experimentId:copy.id,groupKey:version.protocolVersionId,groupTitle:record.steps[0].groupTitle,groupOrder:0,order:4,title:'Generated body fragment',description:'Synthetic source body',deviationNote:'保留拆分正文上的备注',deviationType:'method'}});
 const extraInfo=await prisma.experimentStep.create({data:{experimentId:copy.id,groupKey:version.protocolVersionId,groupTitle:record.steps[0].groupTitle,groupOrder:0,order:5,title:'Generated information',description:'Synthetic information',deviationNote:'保留资料备注'}});
 mapping[extraBody.id]=mapping[record.steps[0].id];mapping[extraInfo.id]='info';
 const link=await prisma.attachmentLink.create({data:{attachmentId:fixture.attachmentId,targetType:'experiment_step',targetId:extraBody.id,linkType:'execution_evidence'}});
 const fileBefore=await prisma.attachment.findUniqueOrThrow({where:{id:fixture.attachmentId}});
 const root=path.join('.local-runtime','protocol-consistency',`db-repair-${copy.id}`);mkdirSync(root,{recursive:true});
 const plan={experimentId:copy.id,versionId:version.protocolVersionId,snapshotHash:hash(snapshot),decisions,mapping,keepers};
 writeFileSync(root+'/plan.json',JSON.stringify(plan));
 const invoke=(apply:boolean)=>execFileSync(process.execPath,['--import','tsx','scripts/repair-draft-protocol-execution.ts',`--plan=${root}/plan.json`,`--output=${root}/${apply?'applied':'dry-run'}`,...(apply?['--apply']:[])],{encoding:'utf8'});
 invoke(false);const diff=JSON.parse(readFileSync(root+'/dry-run/diff.json','utf8'));assert.equal(diff.beforeSteps,5);assert.equal(diff.afterSteps,3);assert.equal(diff.repair.updates[0].id,record.steps[0].id);invoke(true);
 const repaired=await read(copy.id);assert.deepEqual(repaired.steps.map(step=>step.id),record.steps.map(step=>step.id));assert.equal(repaired.steps[0].deviationNote,'保留拆分正文上的备注');assert(JSON.stringify(repaired.contentJson).includes('保留资料备注'));
 assert.equal((await prisma.attachmentLink.findUniqueOrThrow({where:{id:link.id}})).targetId,record.steps[0].id);assert.deepEqual(await prisma.attachment.findUniqueOrThrow({where:{id:fixture.attachmentId}}),fileBefore);
 assert.equal(hash(await read(original.id)),originalHash,'Copy/repair must not alter the originating experiment.');
 // The same CLI refuses completed/started records before changing anything.
 await prisma.experiment.update({where:{id:copy.id},data:{status:'completed',recordStatus:'reviewed'}});const protectedHash=hash(await read(copy.id));
 let rejected=false;try{invoke(true);}catch{rejected=true;}assert(rejected);assert.equal(hash(await read(copy.id)),protectedHash);
 // A newer ProtocolVersion must not rewrite any captured Experiment payload.
 const source=await prisma.protocolVersion.findUniqueOrThrow({where:{id:fixture.versionId}});
 const latest=await prisma.protocolVersion.findFirstOrThrow({where:{protocolId:source.protocolId},orderBy:{revision:'desc'}});
 const changed=structuredClone(document);changed.sections.find(section=>section.key==='steps')!.blocks.push({id:randomUUID(),type:'text',text:'仅属于新版的参数 999 µL',execution:{role:'detail',stepId:'qa-operation-a'}});
 await prisma.protocolVersion.create({data:{protocolId:source.protocolId,revision:latest.revision+1,displayVersion:`1.${latest.revision}`,previousVersionId:latest.id,title:source.title,contentJson:changed,stepsJson:source.stepsJson as Prisma.InputJsonValue}});
 assert.equal(hash(await read(original.id)),originalHash);assert(!JSON.stringify((await read(original.id)).protocolSnapshotJson).includes('999 µL'));
 let keyRejected=false;try{await createExperimentWithProtocolSnapshot({creationKey:original.creationKey!,researchPlanId:fixture.planId,title:'Different retry payload',date:new Date(),status:'planned',recordStatus:'draft',tags:[],contentJson:{schemaVersion:1,sections:[]},methodMode:'protocol',protocolVersionIds:[fixture.versionId],customSteps:[]});}catch(error){keyRejected=String(error).includes('already used');}assert(keyRejected);
 const report={synthetic:true,status:'通过',checks:['Separate copied step IDs and unchecked initial state','Explicit Draft 5→3 mapping retains keeper IDs, notes, information notes and original attachment bytes','Completed/reviewed CLI repair rejected without any change','New ProtocolVersion leaves old frozen content/state unchanged','Creation-key reuse with different payload rejected'],privateBackupHash:diff.backupHash};
 writeFileSync(output+'/database-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
main().finally(()=>prisma.$disconnect());
