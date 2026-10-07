import 'dotenv/config';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import type {Prisma} from '../src/generated/prisma/client';
import {prisma} from '../src/lib/db';
import {protocolDocumentSchema,protocolExecutionRoleSchema,projectProtocolDocument} from '../src/lib/protocol-document';
import {executionFragments,confirmExecutionRoles} from '../src/lib/protocol-execution';
import {draftExecutionRepair} from '../src/lib/draft-execution-repair';
import {appendExperimentObservation,experimentSearchText} from '../src/lib/experiment-document';
const args=process.argv.slice(2),planPath=args.find(arg=>arg.startsWith('--plan='))?.slice(7),output=args.find(arg=>arg.startsWith('--output='))?.slice(9)??'.local-runtime/protocol-consistency/draft-repair';
if(!planPath)throw new Error('Provide --plan=<audited Draft mapping>. Default dry-run; examine original backup and diff before --apply.');
const plan=z.object({experimentId:z.string(),snapshotHash:z.string(),versionId:z.string(),decisions:z.record(z.string(),protocolExecutionRoleSchema),mapping:z.record(z.string(),z.string()),keepers:z.record(z.string(),z.string())}).parse(JSON.parse(readFileSync(planPath,'utf8')));
const apply=args.includes('--apply'),hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');mkdirSync(output,{recursive:true});
async function main(){await prisma.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM "Experiment" WHERE id=${plan.experimentId} FOR UPDATE`;
 await tx.$queryRaw`SELECT id FROM "ExperimentStep" WHERE "experimentId"=${plan.experimentId} ORDER BY id FOR UPDATE`;
 const experiment=await tx.experiment.findUniqueOrThrow({where:{id:plan.experimentId},include:{steps:{orderBy:[{groupOrder:'asc'},{order:'asc'}],include:{events:true,inventoryTransactions:true}},protocolRun:true}});
 if(experiment.status!=='planned'||experiment.recordStatus!=='draft')throw new Error('Only a planned Draft may receive an explicitly audited repair.');
 if(experiment.steps.some(step=>step.events.length||step.inventoryTransactions.length))throw new Error('Execution events or inventory transactions must not be rebuilt.');
 const snapshot=experiment.protocolSnapshotJson as {versions:Array<{protocolVersionId:string;contentJson:unknown;stepsJson:unknown}>};
 if(hash(snapshot)!==plan.snapshotHash)throw new Error('Frozen source changed; re-audit before repairing.');
 const version=snapshot.versions.find(version=>version.protocolVersionId===plan.versionId);if(!version)throw new Error('Audited captured version not found.');
 if(experiment.steps.some(step=>step.groupKey!==plan.versionId))throw new Error('Multi-Protocol historical repair requires a separate explicit plan.');
 const document=protocolDocumentSchema.parse(version.contentJson),fragments=executionFragments(document);
 if(fragments.some(block=>!plan.decisions[block.id])||Object.keys(plan.decisions).length!==fragments.length)throw new Error('Every frozen source block must be mapped exactly once.');
 const confirmed=confirmExecutionRoles(document,fragments.map(block=>({...block,execution:plan.decisions[block.id]})));
 const projection=projectProtocolDocument(confirmed);if(projection.executionNeedsReview||!projection.steps.length)throw new Error('Incomplete operation contract.');
 const repair=draftExecutionRepair(experiment.steps,projection.steps,plan.mapping,plan.keepers,plan.versionId);
 const links=await tx.attachmentLink.findMany({where:{targetType:'experiment_step',targetId:{in:experiment.steps.map(step=>step.id)}}});
 const entryBindings=await tx.entry.findMany({where:{experimentStepId:{in:experiment.steps.map(step=>step.id)}},select:{id:true,experimentStepId:true}});
 const resultBindings=await tx.result.findMany({where:{experimentStepId:{in:experiment.steps.map(step=>step.id)}},select:{id:true,experimentStepId:true}});
 const backup={experiment,links,entryBindings,resultBindings},backupHash=hash(backup);
 writeFileSync(`${output}/original.json`,JSON.stringify(backup,null,2));
 writeFileSync(`${output}/diff.json`,JSON.stringify({beforeSteps:experiment.steps.length,afterSteps:projection.steps.length,backupHash,repair,mapping:plan.mapping,keepers:plan.keepers},null,2));
 if(!apply){console.log(JSON.stringify({apply:false,beforeSteps:experiment.steps.length,afterSteps:projection.steps.length,backupHash}));return;}
 let content=experiment.contentJson;
 for(const removed of repair.removed){
  if(removed.informationNote)content=appendExperimentObservation(content,{id:`execution-repair-note:${removed.id}`,text:`划分修复保留的说明备注（源步骤 ${removed.id}）：\n${removed.informationNote}`,recordedAt:new Date()}) as Prisma.JsonValue;
  await tx.attachmentLink.updateMany({where:{targetType:'experiment_step',targetId:removed.id},data:removed.targetId?{targetId:removed.targetId}:{targetType:'experiment',targetId:experiment.id}});
  await tx.entry.updateMany({where:{experimentStepId:removed.id},data:{experimentStepId:removed.targetId}});
  await tx.result.updateMany({where:{experimentStepId:removed.id},data:{experimentStepId:removed.targetId}});
 }
 for(const update of repair.updates)await tx.experimentStep.update({where:{id:update.id},data:update.data});
 await tx.experimentStep.deleteMany({where:{id:{in:repair.removed.map(step=>step.id)}}});
 version.contentJson=confirmed;version.stepsJson=projection.steps;
 await tx.experiment.update({where:{id:experiment.id},data:{contentJson:content as Prisma.InputJsonValue,searchText:experimentSearchText(experiment.purpose,content),protocolSnapshotJson:{...snapshot,executionRepair:{capturedVersionId:plan.versionId,backupHash,mapping:plan.mapping,keepers:plan.keepers}} as Prisma.InputJsonValue}});
 await tx.activityLog.create({data:{action:'repair_draft_execution',targetType:'experiment',targetId:experiment.id,metadataJson:{beforeSteps:experiment.steps.length,afterSteps:projection.steps.length,backupHash,mapping:plan.mapping,keepers:plan.keepers,completionUnchanged:true}}});
 console.log(JSON.stringify({apply:true,beforeSteps:experiment.steps.length,afterSteps:projection.steps.length,retainedIds:repair.updates.map(update=>update.id),backupHash}));
 });}
main().finally(()=>prisma.$disconnect());
